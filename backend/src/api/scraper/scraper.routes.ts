import { Router } from 'express';
import { scraperService } from './scraper.service';
import axios from 'axios';
import { redis } from '../mapping/mapper';
import { tmdbService } from './tmdb.service';
import { getBrowserInstance } from '../../utils/browser';

const router = Router();
const upstreamCookieJar = new Map<string, string>();

// ── Resilient in-memory caches (stale-serve on failure) ────────────────────
let spotlightMemCache: { spotlight: any[] } | null = null;
let latestUpdatesMemCache: { latestEpisodes: any[] } | null = null;
const newReleasesMemCache = new Map<string, { data: any[]; pagination: any }>();
const SPOTLIGHT_REDIS_KEY = 'anilist:native-spotlight:enriched:v2';
const LATEST_HOME_LIMIT = 10;
const LATEST_REDIS_KEY = 'allmanga:latest-updates:cards:v2';
const NEW_RELEASES_REDIS_PREFIX = 'allmanga:new-releases:cards:v2';
const CACHE_TTL_SECONDS = 300; // 5 min fresh window

const buildAnimeKaiFallbackItems = (items: any[]) => {
    const safeItems = Array.isArray(items) ? items.filter((item) => item?.title) : [];
    return safeItems.map((item) => ({
        ...item,
        id: Number(item?.id || 0) || 0,
        mal_id: Number(item?.mal_id || item?.id || 0) || 0,
        tmdb: item?.tmdb || null,
    }));
};

const enrichAnimeKaiItems = async (items: any[]) => {
    const safeItems = Array.isArray(items) ? items.filter((item) => item?.title) : [];
    const results = await Promise.allSettled(
        safeItems.map(async (item) => {
            const tmdbMedia = await tmdbService.resolveMediaTarget({
                titles: [item.title, item.jname].filter(Boolean),
                format: item.type,
            });

            return {
                ...item,
                id: item?.id || 0,
                mal_id: tmdbMedia?.tmdbId || 0,
                tmdb: tmdbMedia || null,
            };
        })
    );

    return results
        .map((result, index) => result.status === 'fulfilled'
            ? result.value
            : {
                ...safeItems[index],
                id: 0,
                mal_id: 0,
                tmdb: null,
            })
        .filter((item) => item?.title);
};

const enrichAnimeKaiItemsWithFallback = async (items: any[], timeoutMs = 5000) => {
    const rawItems = Array.isArray(items) ? items : [];
    return Promise.race([
        enrichAnimeKaiItems(rawItems),
        new Promise<any[]>((resolve) => setTimeout(() => resolve(buildAnimeKaiFallbackItems(rawItems)), timeoutMs)),
    ]);
};

const applyTmdbSpotlightBanners = async (items: any[]) => {
    const safeItems = Array.isArray(items) ? items : [];
    const resolved = await Promise.allSettled(
        safeItems.map(async (item) => {
            const banner = await tmdbService.resolveBackdrop({
                titles: [
                    item?.title,
                    item?.jname,
                    item?.anilist?.title?.english,
                    item?.anilist?.title?.romaji,
                    item?.anilist?.title?.native,
                ],
                year: item?.year || item?.anilist?.seasonYear || item?.anilist?.startDate?.year,
                format: item?.type || item?.anilist?.format,
            });

            return {
                ...item,
                banner: banner || item?.banner || item?.anilist?.bannerImage || undefined,
            };
        })
    );

    return resolved.map((result, index) => result.status === 'fulfilled'
        ? result.value
        : safeItems[index]);
};

const clearSpotlightBanners = (items: any[]) =>
    (Array.isArray(items) ? items : []).map((item) => ({
        ...item,
        banner: item?.banner || item?.anilist?.bannerImage || undefined,
    }));

const refreshSpotlightCache = async (): Promise<{ spotlight: any[] }> => {
    // Spotlight cache is no longer powered by AniList here.
    // It should hit TMDB instead, or just be empty if not used anymore.
    // Let's just return empty spotlight to prevent crashes since frontend uses /anime/home-fast anyway.
    return { spotlight: [] };
};

const getStaleSpotlight = async (): Promise<{ spotlight: any[] }> => {
    if (spotlightMemCache && spotlightMemCache.spotlight.length > 0) {
        return spotlightMemCache;
    }
    try {
        const redisHit = await redis.get<any>(SPOTLIGHT_REDIS_KEY);
        if (redisHit && Array.isArray(redisHit.spotlight) && redisHit.spotlight.length > 0) {
            spotlightMemCache = redisHit;
            return redisHit;
        }
    } catch { /* swallow */ }
    return { spotlight: [] };
};

/** Read stale data from memory → Redis → empty. Never throws. */
const getStaleLatestUpdates = async (): Promise<{ latestEpisodes: any[] }> => {
    if (latestUpdatesMemCache && latestUpdatesMemCache.latestEpisodes.length >= LATEST_HOME_LIMIT) {
        return latestUpdatesMemCache;
    }
    try {
        const redisHit = await redis.get<any>(LATEST_REDIS_KEY);
        if (redisHit && Array.isArray(redisHit.latestEpisodes) && redisHit.latestEpisodes.length >= LATEST_HOME_LIMIT) {
            latestUpdatesMemCache = redisHit;
            return redisHit;
        }
    } catch { /* swallow */ }
    return { latestEpisodes: [] };
};

const refreshLatestUpdatesCache = async (): Promise<{ latestEpisodes: any[] }> => {
    const latest = await scraperService.getAllMangaLatestUpdates(1, LATEST_HOME_LIMIT);
    const rawLatestEpisodes: any[] = Array.isArray(latest?.data) ? latest.data : [];
    const latestEpisodes = await enrichAnimeKaiItemsWithFallback(rawLatestEpisodes, 2500);
    const payload = { latestEpisodes };

    if (latestEpisodes.length > 0) {
        latestUpdatesMemCache = payload;
        redis.set(LATEST_REDIS_KEY, payload, { ex: CACHE_TTL_SECONDS }).catch(() => undefined);
    }

    return payload;
};

const getStaleNewReleases = async (key: string): Promise<{ data: any[]; pagination: any } | null> => {
    const mem = newReleasesMemCache.get(key);
    if (mem && mem.data.length > 0) return mem;
    try {
        const redisHit = await redis.get<any>(`${NEW_RELEASES_REDIS_PREFIX}:${key}`);
        if (redisHit && Array.isArray(redisHit.data) && redisHit.data.length > 0) {
            newReleasesMemCache.set(key, redisHit);
            return redisHit;
        }
    } catch { /* swallow */ }
    return null;
};

const mergeCookieHeader = (existing: string, setCookie: string[]) => {
    const jar = new Map<string, string>();
    existing
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean)
        .forEach((pair) => {
            const eq = pair.indexOf('=');
            if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
        });

    setCookie.forEach((entry) => {
        const first = String(entry || '').split(';')[0].trim();
        const eq = first.indexOf('=');
        if (eq > 0) jar.set(first.slice(0, eq), first.slice(eq + 1));
    });

    return Array.from(jar.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
};

const getPublicBase = (req: any) => {
    const xfProtoRaw = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
    const proto = xfProtoRaw === 'https' || xfProtoRaw === 'http'
        ? xfProtoRaw
        : (req.protocol === 'https' ? 'https' : 'http');
    return `${proto}://${req.get('host')}`;
};

const buildKwikEmbedProxyUrl = (req: any, targetUrl: string) => {
    const safeUrl = String(targetUrl || '').trim();
    if (!safeUrl || !/^https?:\/\//i.test(safeUrl)) return safeUrl;
    if (/\/api\/scraper\/embed(?:\?|$)/i.test(safeUrl)) return safeUrl;

    return `${getPublicBase(req)}/api/scraper/embed?url=${encodeURIComponent(safeUrl)}`;
};

const buildScraperProxyUrl = (req: any, targetUrl: string, referer = '', proxyMedia = false) => {
    const safeUrl = String(targetUrl || '').trim();
    if (!safeUrl || !/^https?:\/\//i.test(safeUrl)) return safeUrl;

    const safeReferer = String(referer || '').trim();
    return `${getPublicBase(req)}/api/scraper/proxy?url=${encodeURIComponent(safeUrl)}${safeReferer ? `&referer=${encodeURIComponent(safeReferer)}` : ''}${proxyMedia ? '&proxyMedia=1' : ''}`;
};



const buildEmbedAssetProxyUrl = (req: any, targetUrl: string) => {
    const safeUrl = String(targetUrl || '').trim();
    if (!safeUrl || !/^https?:\/\//i.test(safeUrl)) return safeUrl;

    const target = new URL(safeUrl);
    const hash = target.hash;
    target.hash = '';
    return `${getPublicBase(req)}/api/scraper/embed-asset?url=${encodeURIComponent(target.toString())}${hash}`;
};

const patchEmbedHtml = (req: any, html: string, origin: string, embedReferer: string) => {
    const hostBase = getPublicBase(req);
    const mediaReferer = String(embedReferer || '').trim() || `${origin}/`;
    const toAbsolute = (value: string) => {
        const raw = String(value || '').trim();
        if (!raw || raw.startsWith('#') || raw.startsWith('data:') || raw.startsWith('blob:') || raw.startsWith('javascript:')) {
            return raw;
        }
        if (raw.startsWith('//')) return `https:${raw}`;
        if (/^https?:\/\//i.test(raw)) return raw;
        return new URL(raw, `${origin}/`).toString();
    };
    const proxyUrl = (value: string) => {
        const absolute = toAbsolute(value);
        if (!/^https?:\/\//i.test(absolute)) return value;
        if (/\.m3u8(?:[?#]|$)/i.test(absolute)) {
            return buildScraperProxyUrl(req, absolute, mediaReferer, true);
        }
        return new URL(absolute).origin === origin ? buildEmbedAssetProxyUrl(req, absolute) : absolute;
    };

    const proxyRuntime = `
<script>
(() => {
  const origin = ${JSON.stringify(origin)};
  const hostBase = ${JSON.stringify(hostBase)};
  const mediaReferer = ${JSON.stringify(mediaReferer)};
  const proxied = /\\/api\\/scraper\\/(?:proxy|embed-asset)\\?/i;
  const isStreamMedia = (absolute) => {
    try {
      const parsed = new URL(absolute);
      const path = parsed.pathname.toLowerCase();
      return (
        path.includes('/stream/') ||
        /(?:^|[\\/-])segment[-_]/i.test(path) ||
        /\\.(?:ts|m4s|mp4|aac|cmaf|fmp4|jpg|jpeg)(?:[?#]|$)/i.test(path)
      );
    } catch {
      return false;
    }
  };
  const toAbsolute = (value) => {
    const raw = String(value || '').trim();
    if (!raw || raw.startsWith('#') || raw.startsWith('data:') || raw.startsWith('blob:') || raw.startsWith('javascript:')) return raw;
    try { return new URL(raw, origin + '/').toString(); } catch { return raw; }
  };
  const proxify = (value) => {
    const absolute = toAbsolute(value);
    if (!/^https?:\\/\\//i.test(absolute) || proxied.test(absolute)) return value;
    if (/\\.m3u8(?:[?#]|$)/i.test(absolute) || isStreamMedia(absolute)) {
      return hostBase + '/api/scraper/proxy?url=' + encodeURIComponent(absolute) + '&referer=' + encodeURIComponent(mediaReferer) + '&proxyMedia=1';
    }
    if (new URL(absolute).origin === origin) {
      const parsed = new URL(absolute);
      const hash = parsed.hash;
      parsed.hash = '';
      return hostBase + '/api/scraper/embed-asset?url=' + encodeURIComponent(parsed.toString()) + hash;
    }
    return value;
  };
  const originalFetch = window.fetch;
  if (originalFetch) {
    window.fetch = (input, init) => {
      let next = input;
      if (typeof input === 'string' || input instanceof URL) {
        next = proxify(input);
      } else if (input && typeof input.url === 'string') {
        try { next = new Request(proxify(input.url), input); } catch { next = input; }
      }
      return originalFetch.call(window, next, init);
    };
  }
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    return originalOpen.call(this, method, proxify(url), ...rest);
  };
  const originalSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function(name, value) {
    const attr = String(name || '').toLowerCase();
    if (attr === 'src' || attr === 'href' || attr === 'xlink:href' || attr === 'action') {
      return originalSetAttribute.call(this, name, proxify(value));
    }
    return originalSetAttribute.call(this, name, value);
  };
  if (window.SVGElement) {
    const originalSetAttributeNS = Element.prototype.setAttributeNS;
    Element.prototype.setAttributeNS = function(namespace, name, value) {
      const attr = String(name || '').toLowerCase();
      if (attr === 'href' || attr === 'xlink:href') {
        return originalSetAttributeNS.call(this, namespace, name, proxify(value));
      }
      return originalSetAttributeNS.call(this, namespace, name, value);
    };
  }
  const patchAttr = (proto, attr) => {
    const desc = Object.getOwnPropertyDescriptor(proto, attr);
    if (!desc || !desc.set) return;
    Object.defineProperty(proto, attr, { ...desc, set(value) { desc.set.call(this, proxify(value)); } });
  };
  patchAttr(HTMLScriptElement.prototype, 'src');
  patchAttr(HTMLLinkElement.prototype, 'href');
  patchAttr(HTMLImageElement.prototype, 'src');
  patchAttr(HTMLIFrameElement.prototype, 'src');
  patchAttr(HTMLMediaElement.prototype, 'src');
  patchAttr(HTMLSourceElement.prototype, 'src');

  // Block pointer lock to prevent cursor capture by third-party players
  Element.prototype.requestPointerLock = function() {
    console.warn("Pointer lock blocked by Yorumi proxy script.");
    return Promise.resolve();
  };
  document.exitPointerLock = function() {};
})();
</script>`;

    const rewriteNonScriptHtml = (chunk: string) => chunk
        .replace(/<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/gi, '')
        .replace(/<meta[^>]+content=["'][^"']*frame-ancestors[^"']*["'][^>]*>/gi, '')
        .replace(/\b(src|href|action)=["']([^"']+)["']/gi, (_match, attr, value) => `${attr}="${proxyUrl(value)}"`)
        .replace(/url\((['"]?)(\/app\/[^'")]+)\1\)/gi, (_match, quote, value) => {
            const proxied = buildEmbedAssetProxyUrl(req, new URL(value, `${origin}/`).toString());
            return `url(${quote}${proxied}${quote})`;
        })
        .replace(/(["'`])(\/app\/[^"'`\s)]+)\1/g, (_match, quote, value) => {
            const proxied = buildEmbedAssetProxyUrl(req, new URL(value, `${origin}/`).toString());
            return `${quote}${proxied}${quote}`;
        });

    const cleaned = String(html || '')
        .split(/(<script\b[\s\S]*?<\/script>)/gi)
        .map((chunk) => /^<script\b/i.test(chunk) ? chunk : rewriteNonScriptHtml(chunk))
        .join('');
    return cleaned.includes('<head')
        ? cleaned.replace(/<head([^>]*)>/i, `<head$1><base href="${origin}/">${proxyRuntime}`)
        : `<base href="${origin}/">${proxyRuntime}${cleaned}`;
};

const sanitizeCookie = (raw: string) => String(raw || '').replace(/[\r\n]/g, '').trim();
const normalizeEpisodeSession = (animeSessionRaw: string, raw: string) => {
    const source = String(raw || '').trim();
    if (!source) return source;
    const animeSession = String(animeSessionRaw || '').trim().replace(/\/+$/, '');

    // Handle legacy forms like "...-20401?ep=162349" or full URLs containing ?ep=
    const tryDecode = (value: string) => {
        try {
            return decodeURIComponent(value);
        } catch {
            return value;
        }
    };

    const decoded = tryDecode(tryDecode(source));
    if (decoded.includes('$token=')) {
        return decoded;
    }

    const pairMatch = decoded.match(/([^?#]+)\?ep=([^&#]+)/i);
    if (pairMatch?.[1] && pairMatch?.[2]) {
        const base = pairMatch[1].trim().replace(/\/+$/, '');
        const ep = pairMatch[2].trim();
        return `${base}?ep=${ep}`;
    }
    const epOnlyMatch = decoded.match(/[?&]?ep=([^&#]+)/i);
    if (epOnlyMatch?.[1] && animeSession) {
        return `${animeSession}?ep=${epOnlyMatch[1].trim()}`;
    }

    const stripped = decoded.split('#')[0].split('?')[0].trim();
    const withoutTrailingSlash = stripped.replace(/\/+$/, '');
    if (!withoutTrailingSlash) return source;
    const lastSegment = withoutTrailingSlash.split('/').pop() || withoutTrailingSlash;
    return lastSegment.trim() || source;
};

router.get('/search', async (req, res) => {
    try {
        const query = req.query.q as string;
        if (!query) {
            return res.status(400).json({ error: 'Query parameter q is required' });
        }
        const result = await scraperService.search(query);
        res.set('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=300');
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ── Latest Updates (homepage section) — never 500s ─────────────────────────
router.get('/animekai/spotlight', async (_req, res) => {
    res.set('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=300');
    try {
        const payload = await refreshSpotlightCache();
        res.json(payload);
    } catch (error: any) {
        console.error('Native spotlight failed, serving stale:', error?.message || error);
        const stale = await getStaleSpotlight();
        if (!Array.isArray(stale.spotlight) || stale.spotlight.length === 0) {
            res.set('Cache-Control', 'no-store');
            res.status(503).json({ error: 'Native spotlight temporarily unavailable' });
            return;
        }
        res.json(stale);
    }
});

router.get('/search/animepahe', async (req, res) => {
    try {
        const query = req.query.q as string;
        if (!query) {
            return res.status(400).json({ error: 'Query parameter q is required' });
        }
        res.set('Cache-Control', 'no-store');
        res.json([]);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/search/allmanga', async (req, res) => {
    try {
        const query = req.query.q as string;
        if (!query) {
            return res.status(400).json({ error: 'Query parameter q is required' });
        }
        const result = await scraperService.searchAllManga(query);
        res.set('Cache-Control', 'public, max-age=120, s-maxage=300, stale-while-revalidate=600');
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/search/animekai', async (req, res) => {
    try {
        const query = req.query.q as string;
        if (!query) {
            return res.status(400).json({ error: 'Query parameter q is required' });
        }
        const result = await scraperService.searchAnimeKai(query);
        res.set('Cache-Control', 'public, max-age=120, s-maxage=300, stale-while-revalidate=600');
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/animekai/latest-updates', async (_req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    try {
        if (latestUpdatesMemCache && latestUpdatesMemCache.latestEpisodes.length >= LATEST_HOME_LIMIT) {
            res.json(latestUpdatesMemCache);
            refreshLatestUpdatesCache().catch((error) => {
                console.error('AnimeKai latest-updates background refresh failed:', error?.message || error);
            });
            return;
        }

        const redisHit = await redis.get<any>(LATEST_REDIS_KEY).catch(() => null);
        if (redisHit && Array.isArray(redisHit.latestEpisodes) && redisHit.latestEpisodes.length >= LATEST_HOME_LIMIT) {
            latestUpdatesMemCache = redisHit;
            res.json(redisHit);
            refreshLatestUpdatesCache().catch((error) => {
                console.error('AnimeKai latest-updates background refresh failed:', error?.message || error);
            });
            return;
        }

        const payload = await refreshLatestUpdatesCache();
        res.json(payload);
    } catch (error: any) {
        console.error('AllManga latest-updates scrape failed, serving stale:', error?.message || error);
        const stale = await getStaleLatestUpdates();
        res.json(stale);
    }
});

// ── Recently Updated / View All (paginated) — never 500s ──────────────────
router.get('/animepahe/latest-releases', async (req, res) => {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

    try {
        const result = await scraperService.getAllMangaLatestUpdates(page);
        res.json(result);
    } catch (error: any) {
        console.error(`AllManga latest releases failed (page=${page}):`, error?.message || error);
        const safePage = Math.max(1, page);
        res.status(503).json({
            data: [],
            pagination: {
                current_page: safePage,
                last_visible_page: safePage,
                has_next_page: false,
            },
        });
    }
});

router.get('/recently-updated', async (req, res) => {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 18;
    const cacheKey = `${page}:${limit}`;

    res.set('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=300');
    try {
        const result = await scraperService.getAllMangaLatestUpdates(page, limit);
        const rawItems: any[] = Array.isArray(result?.data) ? result.data : [];
        const pagination = result?.pagination;

        const listItems = await enrichAnimeKaiItemsWithFallback(rawItems, 2500);
        const payload = { data: listItems, pagination };

        if (listItems.length > 0) {
            newReleasesMemCache.set(cacheKey, payload);
            redis.set(`${NEW_RELEASES_REDIS_PREFIX}:${cacheKey}`, payload, { ex: CACHE_TTL_SECONDS }).catch(() => undefined);
        }

        res.json(payload);
    } catch (error: any) {
        console.error(`AllManga recently-updated (page=${page}) failed, serving stale:`, error?.message || error);
        const stale = await getStaleNewReleases(cacheKey);
        res.json(stale || {
            data: [],
            pagination: { current_page: page, last_visible_page: page, has_next_page: false },
        });
    }
});

// ── New Releases (explicit endpoint, same resilience) ──────────────────────
router.get('/animekai/new-releases', async (req, res) => {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 18;
    const cacheKey = `${page}:${limit}`;

    res.set('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=300');
    try {
        const result = await scraperService.getAllMangaLatestUpdates(page, limit);
        const rawItems: any[] = Array.isArray(result?.data) ? result.data : [];
        const pagination = result?.pagination;

        const listItems = await enrichAnimeKaiItemsWithFallback(rawItems, 2500);
        const payload = { data: listItems, pagination };

        if (listItems.length > 0) {
            newReleasesMemCache.set(cacheKey, payload);
            redis.set(`${NEW_RELEASES_REDIS_PREFIX}:${cacheKey}`, payload, { ex: CACHE_TTL_SECONDS }).catch(() => undefined);
        }

        res.json(payload);
    } catch (error: any) {
        console.error(`AllManga new-releases (page=${page}) scrape failed, serving stale:`, error?.message || error);
        const stale = await getStaleNewReleases(cacheKey);
        res.json(stale || {
            data: [],
            pagination: { current_page: page, last_visible_page: page, has_next_page: false },
        });
    }
});

router.get('/animekai/az-list/:letter', async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ data: [], pagination: { current_page: 1, last_visible_page: 1, has_next_page: false } });
});

router.get('/animekai/genres', async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ genres: [] });
});

router.get('/animekai/genre/:name', async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ data: [], pagination: { current_page: 1, last_visible_page: 1, has_next_page: false } });
});

router.get('/animekai/top-trending', async (req, res) => {
    try {
        const requestedRange = String(req.query.range || 'now').toLowerCase();
        const range = ['now', 'day', 'week', 'month'].includes(requestedRange)
            ? requestedRange as 'now' | 'day' | 'week' | 'month'
            : 'now';
        const rawTop10: any[] = [];
        const top10 = await enrichAnimeKaiItemsWithFallback(rawTop10, 5000);
        res.set('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=300');
        res.json({ top10 });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/episodes', async (req, res) => {
    try {
        const session = req.query.session as string;
        if (!session) {
            return res.status(400).json({ error: 'Query parameter session is required' });
        }
        // Support hybrid s: IDs (strip prefix)
        const realSession = session.startsWith('s:') ? session.substring(2) : session;
        const expectedEpisodes = Math.max(0, Number(req.query.expectedEpisodes || 0) || 0);
        const result = await Promise.race([
            scraperService.getEpisodes(realSession, expectedEpisodes),
            new Promise((resolve) => setTimeout(() => resolve({ episodes: [], lastPage: 1 }), 30_000)),
        ]);
        res.set('Cache-Control', 'public, max-age=120, s-maxage=300, stale-while-revalidate=600');
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/streams', async (req, res) => {
    try {
        const animeSessionRaw = req.query.anime_session as string;
        const animeSession = animeSessionRaw?.startsWith('s:') ? animeSessionRaw.substring(2) : animeSessionRaw;
        const epSessionRaw = req.query.ep_session as string;
        const epSession = normalizeEpisodeSession(animeSession, epSessionRaw);

        if (!epSession || !animeSession) {
            const provider = String(req.query.provider || '').trim().toLowerCase();
            // Videasy resolves via TMDB (title + episode number) — no scraper session needed.
            if (provider !== 'videasy') {
                return res.status(400).json({ error: 'anime_session and ep_session are required' });
            }
        }
        const provider = String(req.query.provider || 'auto').trim().toLowerCase();
        const title = String(req.query.title || '').trim();
        const altTitles = String(req.query.alt_titles || '')
            .split('|')
            .map((value) => value.trim())
            .filter(Boolean);
        const year = String(req.query.year || '').trim();
        const format = String(req.query.format || '').trim();
        const episodeNumber = Number(req.query.ep_number || 0) || undefined;
        const result = await scraperService.getStreams(animeSession, epSession, {
            provider,
            title,
            titles: altTitles,
            year,
            format,
            episodeNumber,
        });
        const hostBase = getPublicBase(req);
        const normalized = Array.isArray(result)
            ? result.map((item: any) => {
                if (!item?.url || typeof item.url !== 'string') return item;

                const next = { ...item };
                const providerName = String(next.provider || '').trim().toLowerCase();
                const server = String(next.server || '').trim().toLowerCase();
                const isKwikUrl = /^https?:\/\/([^/]+\.)?kwik\./i.test(next.url);
                if (server === 'kwik' || isKwikUrl) {
                    next.url = buildKwikEmbedProxyUrl(req, next.url);
                    next.isHls = false;
                    delete next.directUrl;
                    return next;
                }

                if (providerName === 'allmanga' && /^https?:\/\//i.test(next.url)) {
                    const isMedia = next.isHls || /\.(mp4|webm|mkv|m3u8)(?:[?#]|$)/i.test(next.url) || /fast4speed\.rsvp|googlevideo\.com/i.test(next.url);
                    if (isMedia) {
                        next.url = buildScraperProxyUrl(req, next.url, next.referer || 'https://allmanga.to', true);
                        if (next.directUrl && /^https?:\/\//i.test(next.directUrl)) {
                            next.directUrl = buildScraperProxyUrl(req, next.directUrl, next.referer || 'https://allmanga.to', true);
                        }
                    } else {
                        const isKwikUrl = /^https?:\/\/([^/]+\.)?kwik\./i.test(next.url);
                        if (isKwikUrl) {
                            next.url = buildKwikEmbedProxyUrl(req, next.url);
                        }
                    }
                    return next;
                }



                if (next.url.includes('/api/scraper/proxy?')) {
                    if (next.url.startsWith('/api/')) {
                        next.url = hostBase + next.url;
                    } else {
                        next.url = next.url.replace(/^https?:\/\/[^/]+/i, hostBase);
                    }
                }
                return next;
            })
            : result;
        // Never allow HTTP caching of stream responses — stale streams cause wrong-episode playback.
        // All caching is handled server-side in Redis/memory with proper keying.
        res.set('Cache-Control', 'no-store');
        res.json(normalized);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ── Runtime cache wipe ─────────────────────────────────────────────────────
router.post('/clear-stream-cache', (_req, res) => {
    (scraperService as any).cache?.clear?.();
    (scraperService as any).inFlight?.clear?.();
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true, clearedAt: new Date().toISOString() });
});

router.get('/playable-stream', async (req, res) => {
    try {
        const animeSessionRaw = req.query.anime_session as string;
        const animeSession = animeSessionRaw?.startsWith('s:') ? animeSessionRaw.substring(2) : animeSessionRaw;
        const epSessionRaw = req.query.ep_session as string;
        const epSession = normalizeEpisodeSession(animeSession, epSessionRaw);
        const direct = String(req.query.direct || '').trim() === '1';

        if (!epSession || !animeSession) {
            return res.status(400).json({ error: 'anime_session and ep_session are required' });
        }

        const result = await scraperService.resolvePlayableStream(animeSession, epSession);
        if (!result) {
            res.set('Cache-Control', 'no-store');
            return res.status(404).json({ error: 'No playable stream found' });
        }

        const streamReferer = (() => {
            const referer = String(result.stream?.referer || '').trim();
            const streamUrl = String(result.stream?.url || '').trim();
            try {
                const parsed = new URL(streamUrl);
                if (/^([^/]+\.)?kwik\./i.test(parsed.host)) return streamUrl;
            } catch {
                // Fall back to the generic media proxy below.
            }
            return referer || '';
        })();

        const url = direct
            ? result.directUrl
            : `${getPublicBase(req)}/api/scraper/proxy?url=${encodeURIComponent(result.directUrl)}&referer=${encodeURIComponent(streamReferer)}&proxyMedia=1`;

        res.set('Cache-Control', 'no-store');
        return res.json({ stream: result.stream, url });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/prefetch/streams', async (req, res) => {
    try {
        const animeSession = req.body?.anime_session as string | undefined;
        const epSessions = req.body?.ep_sessions as string[] | undefined;

        if (!animeSession || !Array.isArray(epSessions) || epSessions.length === 0) {
            return res.status(400).json({ error: 'anime_session and ep_sessions[] are required' });
        }

        const result = await scraperService.prefetchStreams(animeSession, epSessions);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/embed', async (req, res) => {
    let targetUrl = String(req.query.url || '').trim();

    if (!targetUrl) {
        return res.status(400).send('Missing url parameter');
    }

    try {
        let target = new URL(targetUrl);
        if (/\/api\/scraper\/embed$/i.test(target.pathname)) {
            targetUrl = String(target.searchParams.get('url') || '').trim();
            target = new URL(targetUrl);
        }

        const host = target.hostname.toLowerCase();
        if (!/^([^/]+\.)?kwik\./i.test(host)) {
            return res.status(400).send('Unsupported embed host');
        }

        const cookieKey = target.origin;
        const storedCookie = sanitizeCookie(upstreamCookieJar.get(cookieKey) || '');
        const refererCandidates = [
            `${target.origin}/`,
            'https://kwik.cx/',
            'https://animepahe.pw/',
        ];

        let html = '';
        let status = 200;
        let lastError: any = null;

        for (const referer of refererCandidates) {
            try {
                const response = await axios.get(target.toString(), {
                    responseType: 'text',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                        Referer: referer,
                        Origin: new URL(referer).origin,
                        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.9',
                        ...(storedCookie ? { Cookie: storedCookie } : {}),
                    },
                    timeout: 15000,
                });

                const setCookie = response.headers?.['set-cookie'];
                if (Array.isArray(setCookie) && setCookie.length > 0) {
                    const merged = mergeCookieHeader(storedCookie, setCookie);
                    if (merged) upstreamCookieJar.set(cookieKey, merged);
                }

                html = String(response.data || '');
                status = response.status;
                break;
            } catch (error: any) {
                lastError = error;
                if (![401, 403].includes(error?.response?.status)) break;
            }
        }

        if (!html) {
            const browser = await getBrowserInstance();
            const page = await browser.newPage();
            try {
                await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
                await page.setExtraHTTPHeaders({
                    Referer: 'https://animepahe.pw/',
                    Origin: 'https://animepahe.pw',
                    'Accept-Language': 'en-US,en;q=0.9',
                });
                await page.goto(target.toString(), { waitUntil: 'domcontentloaded', timeout: 30000 });
                html = await page.content();
                status = 200;
            } finally {
                await page.close();
            }
        }

        if (!html) throw lastError || new Error('Embed host returned no HTML');

        const patchedHtml = patchEmbedHtml(req, html, target.origin, target.toString());

        res.status(status);
        res.set('Content-Type', 'text/html; charset=utf-8');
        res.set('Cache-Control', 'no-store');
        res.set('Access-Control-Allow-Origin', '*');
        res.removeHeader('Content-Security-Policy');
        res.removeHeader('X-Frame-Options');
        return res.send(patchedHtml);
    } catch (error: any) {
        console.error('Scraper embed proxy error:', targetUrl, error?.message || error);
        return res.status(error?.response?.status || 500).send('Embed proxy error');
    }
});

router.get('/embed-asset', async (req, res) => {
    const targetUrl = String(req.query.url || '').trim();

    if (!targetUrl) {
        return res.status(400).send('Missing url parameter');
    }

    try {
        const target = new URL(targetUrl);
        const host = target.hostname.toLowerCase();
        const isAllowedAssetHost =
            /^([^/]+\.)?kwik\./i.test(host) ||
            host === 'cdn.jsdelivr.net' ||
            host === 'cdnjs.cloudflare.com' ||
            host.endsWith('.cloudflareinsights.com');
        if (!isAllowedAssetHost) {
            return res.status(400).send('Unsupported asset host');
        }

        const cookieKey = target.origin;
        const storedCookie = sanitizeCookie(upstreamCookieJar.get(cookieKey) || '');
        const response = await axios.get(target.toString(), {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                Referer: `${target.origin}/`,
                Origin: target.origin,
                Accept: '*/*',
                ...(storedCookie ? { Cookie: storedCookie } : {}),
            },
            timeout: 15000,
        });

        const setCookie = response.headers?.['set-cookie'];
        if (Array.isArray(setCookie) && setCookie.length > 0) {
            const merged = mergeCookieHeader(storedCookie, setCookie);
            if (merged) upstreamCookieJar.set(cookieKey, merged);
        }

        res.status(response.status);
        res.set('Content-Type', response.headers['content-type'] || 'application/octet-stream');
        res.set('Cache-Control', 'public, max-age=300');
        res.set('Access-Control-Allow-Origin', '*');
        return res.send(response.data);
    } catch (error: any) {
        console.error('Scraper embed asset error:', targetUrl, error?.message || error);
        return res.status(error?.response?.status || 500).send('Embed asset proxy error');
    }
});

// Generic HLS proxy for stream sources (rewrites nested playlists and keys)
router.get('/proxy', async (req, res) => {
    const targetUrl = req.query.url as string;
    const requestedReferer = (req.query.referer as string) || '';
    const requestedCookie = sanitizeCookie((req.query.cookie as string) || '');
    const proxyMediaSegments = String(req.query.proxyMedia || '').trim() === '1';
    const requestedAudio = String(req.query.audio || '').trim().toLowerCase();

    if (!targetUrl) {
        return res.status(400).send('Missing url parameter');
    }

    try {
        const streamToBuffer = (stream: any) => new Promise<Buffer>((resolve, reject) => {
            const chunks: Buffer[] = [];
            stream.on('data', (chunk: Buffer | string) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
            stream.on('end', () => resolve(Buffer.concat(chunks)));
            stream.on('error', reject);
        });
        const target = new URL(targetUrl);
        const cookieKey = target.origin;
        const storedCookie = sanitizeCookie(upstreamCookieJar.get(cookieKey) || '');
        const refererCandidates = [
            requestedReferer,
            `${target.origin}/`,
            'https://kwik.cx/',
            'https://animepahe.pw/',
            'https://megacloud.blog/',
        ].filter(Boolean).filter((referer, index, list) => list.indexOf(referer) === index);

        let response: any = null;
        let lastError: any = null;

        for (const referer of refererCandidates) {
            for (const includeOrigin of [false, true]) {
                try {
                    response = await axios.get(targetUrl, {
                        responseType: 'stream',

                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                            Referer: referer,
                            ...(includeOrigin ? { Origin: new URL(referer).origin } : {}),
                            Accept: '*/*',
                            ...(req.headers.range ? { Range: req.headers.range } : {}),
                            ...((requestedCookie || storedCookie) ? { Cookie: requestedCookie || storedCookie } : {}),
                        },
                        timeout: 15000,
                    });

                    const setCookie = response.headers?.['set-cookie'];
                    if (Array.isArray(setCookie) && setCookie.length > 0) {
                        const seedCookie = requestedCookie || storedCookie;
                        const merged = mergeCookieHeader(seedCookie, setCookie);
                        if (merged) upstreamCookieJar.set(cookieKey, merged);
                    }
                    break;
                } catch (error: any) {
                    lastError = error;
                    // Retry 403/401 with the next header/referer candidate.
                    if (![401, 403].includes(error?.response?.status)) break;
                }
            }
            if (response || (lastError && ![401, 403].includes(lastError?.response?.status))) break;
        }

        if (!response) throw lastError;

        const contentType = response.headers['content-type'] || '';
        const lowerUrl = targetUrl.toLowerCase();

        const isSubtitle = lowerUrl.includes('.vtt') || lowerUrl.includes('.srt');
        const normalizedContentType = isSubtitle
            ? (lowerUrl.includes('.vtt') ? 'text/vtt; charset=utf-8' : 'text/plain; charset=utf-8')
            : contentType;

        const isM3u8 =
            contentType.includes('mpegurl') ||
            contentType.includes('m3u8') ||
            targetUrl.includes('.m3u8');

        if (isSubtitle) {
            res.status(response.status);
            res.set('Content-Type', normalizedContentType);
            res.set('Access-Control-Allow-Origin', '*');
            const text = (await streamToBuffer(response.data)).toString('utf-8');
            return res.send(text);
        }

        if (!isM3u8) {
            // Only buffer for PNG-magic check when explicitly requested (maskCheck=1)
            // Real video files must be piped for streaming/range-request support.
            const maskCheck = String(req.query.maskCheck || '').trim() === '1';
            const isExplicitVideo = /\.(mp4|webm|mkv|avi|mov)(?:[?#]|$)/i.test(targetUrl);
            const mightBeMasked = maskCheck || (!isExplicitVideo && (contentType.startsWith('image/') || contentType === 'application/octet-stream' || contentType === 'text/plain' || contentType === ''));

            if (mightBeMasked) {
                const { Transform } = require('stream');
                let foundSync = false;
                let buffer = Buffer.alloc(0);

                const demaskStream = new Transform({
                    transform(chunk: Buffer, _encoding: string, callback: () => void) {
                        if (foundSync) {
                            this.push(chunk);
                            return callback();
                        }

                        buffer = Buffer.concat([buffer, chunk]);

                        // Wait until we have enough bytes to check for PNG magic
                        if (buffer.length < 8) {
                            return callback();
                        }

                        // Check for PNG magic bytes: 0x89 0x50 0x4E 0x47
                        const isPngMasked = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;

                        if (isPngMasked) {
                            // It is PNG masked. Search for the first valid MPEG-TS sync byte sequence
                            let syncIdx = -1;
                            const limit = Math.min(buffer.length - 376, buffer.length);
                            for (let i = 0; i < limit; i++) {
                                if (buffer[i] === 0x47 && buffer[i + 188] === 0x47 && buffer[i + 376] === 0x47) {
                                    syncIdx = i;
                                    break;
                                }
                            }
                            
                            if (syncIdx !== -1) {
                                foundSync = true;
                                this.push(buffer.slice(syncIdx));
                                buffer = Buffer.alloc(0);
                            } else if (buffer.length > 100000) {
                                // Give up if not found within 100KB, push intact to avoid hanging
                                foundSync = true;
                                this.push(buffer);
                                buffer = Buffer.alloc(0);
                            }
                        } else {
                            // Not PNG masked. Push intact (preserves ID3 tags for standard streams)
                            foundSync = true;
                            this.push(buffer);
                            buffer = Buffer.alloc(0);
                        }
                        
                        callback();
                    },
                    flush(callback: () => void) {
                        if (!foundSync && buffer.length > 0) {
                            this.push(buffer);
                        }
                        callback();
                    }
                });

                res.status(response.status);
                res.set('Content-Type', 'video/mp2t');
                res.set('Access-Control-Allow-Origin', '*');
                res.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
                // Remove Content-Length because we are stripping the mask which changes the length
                req.on('close', () => { response.data?.destroy?.(); });
                return response.data.pipe(demaskStream).pipe(res);
            }

            // Real video/audio stream — pipe directly for streaming + range-request support.
            res.status(response.status);
            res.set('Content-Type', normalizedContentType);
            res.set('Access-Control-Allow-Origin', '*');
            res.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
            if (response.headers['content-range']) res.set('Content-Range', response.headers['content-range']);
            if (response.headers['accept-ranges']) res.set('Accept-Ranges', response.headers['accept-ranges']);
            if (response.headers['content-length']) res.set('Content-Length', response.headers['content-length']);
            req.on('close', () => { response.data?.destroy?.(); });
            return response.data.pipe(res);
        }

        res.status(response.status);
        res.set('Content-Type', normalizedContentType);
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
        if (response.headers['content-range']) res.set('Content-Range', response.headers['content-range']);
        if (response.headers['accept-ranges']) res.set('Accept-Ranges', response.headers['accept-ranges']);
        if (response.headers['content-length']) res.set('Content-Length', response.headers['content-length']);

        const body = (await streamToBuffer(response.data)).toString('utf-8');
        const urlObj = new URL(targetUrl);
        const basePath = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
        const nextReferer = requestedReferer || `${urlObj.origin}/`;
        const nextCookie = sanitizeCookie(upstreamCookieJar.get(cookieKey) || requestedCookie);

        const getUrlPath = (value: string) => {
            try {
                return new URL(value, basePath).pathname.toLowerCase();
            } catch {
                return value.toLowerCase().split('?')[0];
            }
        };

        const isMediaSegment = (line: string) => {
            const lower = getUrlPath(line);
            return (
                lower.endsWith('.ts') ||
                lower.endsWith('.aac') ||
                lower.endsWith('.mp4') ||
                lower.endsWith('.m4s') ||
                lower.endsWith('.cmaf') ||
                lower.endsWith('.fmp4') ||
                lower.endsWith('.jpg') ||
                lower.endsWith('.jpeg') ||
                lower.endsWith('.png') ||
                lower.endsWith('.webp') ||
                lower.startsWith('/p/') ||
                lower.startsWith('/hls/')
            );
        };

        const isLikelySubPlaylist = (line: string) => {
            const lowerPath = getUrlPath(line);
            return lowerPath.endsWith('.m3u8') || !/\.[a-z0-9]{2,5}$/i.test(lowerPath);
        };

        const filterHlsAudio = (playlist: string) => {
            if (!requestedAudio) return playlist;
            if (!/^[a-z]{2,3}$/i.test(requestedAudio)) return playlist;

            const audioLinePattern = /#EXT-X-MEDIA:TYPE=AUDIO[^\n]*/gi;
            let matchedAudio = false;
            const nextPlaylist = playlist.replace(audioLinePattern, (line) => {
                const language = line.match(/\bLANGUAGE=["']?([^"',]+)["']?/i)?.[1]?.toLowerCase();
                if (language !== requestedAudio) return '';
                matchedAudio = true;
                return line
                    .replace(/\bDEFAULT=(YES|NO)/i, 'DEFAULT=YES')
                    .replace(/\bAUTOSELECT=(YES|NO)/i, 'AUTOSELECT=YES');
            });

            return matchedAudio ? nextPlaylist.replace(/\n{3,}/g, '\n\n') : playlist;
        };

        const rewritten = filterHlsAudio(body)
            .split('\n')
            .map((line) => {
                const trimmed = line.trim();
                if (!trimmed) return line;

                if (trimmed.startsWith('#') && trimmed.includes('URI=')) {
                    return line.replace(/URI=["']([^"']+)["']/g, (_m, uri) => {
                        const absoluteUri = uri.startsWith('http')
                            ? uri
                            : (uri.startsWith('/') ? `${urlObj.origin}${uri}` : `${basePath}${uri}`);
                        return `URI="${getPublicBase(req)}/api/scraper/proxy?url=${encodeURIComponent(absoluteUri)}&referer=${encodeURIComponent(nextReferer)}${nextCookie ? `&cookie=${encodeURIComponent(nextCookie)}` : ''}${proxyMediaSegments ? '&proxyMedia=1' : ''}${req.query.maskCheck === '1' ? '&maskCheck=1' : ''}${requestedAudio ? `&audio=${encodeURIComponent(requestedAudio)}` : ''}"`;
                    });
                }

                if (trimmed.startsWith('#')) return line;

                const absolute = trimmed.startsWith('http')
                    ? trimmed
                    : (trimmed.startsWith('/') ? `${urlObj.origin}${trimmed}` : `${basePath}${trimmed}`);

                const proxySuffix = `&referer=${encodeURIComponent(nextReferer)}${nextCookie ? `&cookie=${encodeURIComponent(nextCookie)}` : ''}${proxyMediaSegments ? '&proxyMedia=1' : ''}${req.query.maskCheck === '1' ? '&maskCheck=1' : ''}${requestedAudio ? `&audio=${encodeURIComponent(requestedAudio)}` : ''}`;

                if (proxyMediaSegments) {
                    // Always proxy all segments when proxyMedia=1 (needed for PNG-masked TS like AniNeko).
                    return `${getPublicBase(req)}/api/scraper/proxy?url=${encodeURIComponent(absolute)}${proxySuffix}`;
                }

                // Sub-playlist lines must pass through the proxy for CORS.
                if (!isMediaSegment(trimmed) && isLikelySubPlaylist(trimmed)) {
                    return `${getPublicBase(req)}/api/scraper/proxy?url=${encodeURIComponent(absolute)}${proxySuffix}`;
                }

                // Direct absolute URL for media segments — browser fetches from CDN, not Vercel.
                return absolute;
            })
            .join('\n');

        return res.send(rewritten);
    } catch (error: any) {
        console.error('Scraper proxy error:', targetUrl, error?.message || error);
        return res.status(error?.response?.status || 500).send('Proxy error');
    }
});

export default router;

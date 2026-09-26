import axios from 'axios';
import * as cheerio from 'cheerio';
import type { VideoSource, StreamResponse, SubtitleTrack } from '../api/anime/video-sources';
import { cacheGet, cacheSet } from '../utils/redis-cache';
import { logger } from '../core/logger';
import { tmdbService } from '../api/scraper/tmdb.service';

const HIANIME_BASE = 'https://hianime.at';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const DEOBFUSCATION_KEY = Buffer.from('otaku-embed-v1', 'utf8');

const DEFAULT_HEADERS = {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
};

function deobfuscateBlob(blob: string): string {
    try {
        const bytes = Buffer.from(blob, 'base64');
        const output = Buffer.alloc(bytes.length);
        for (let i = 0; i < bytes.length; i++) {
            output[i] = bytes[i] ^ DEOBFUSCATION_KEY[i % DEOBFUSCATION_KEY.length];
        }
        return output.toString('utf8');
    } catch {
        return '';
    }
}

function cleanTitle(str: string): string {
    return String(str || '')
        .toLowerCase()
        .replace(/&amp;/gi, '&')
        .replace(/&#0*39;|&apos;|&#x27;/gi, "'")
        .replace(/&quot;/gi, '"')
        .replace(/\b(season|part|cour|nd|rd|th|st)\s*\d+\b/gi, ' ')
        .replace(/[^a-z0-9\s]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function isSafeTitleMatch(query: string, candidateTitle: string): boolean {
    const expected = cleanTitle(query);
    const actual = cleanTitle(candidateTitle);
    if (!expected || !actual) return false;
    if (expected === actual) return true;
    if (actual.startsWith(`${expected} `) || expected.startsWith(`${actual} `)) return true;

    const expectedTokens = expected.split(' ').filter((token) => token.length > 1);
    const actualTokens = new Set(actual.split(' ').filter((token) => token.length > 1));
    if (expectedTokens.length < 2) return false;
    const matched = expectedTokens.filter((token) => actualTokens.has(token)).length;
    return matched / expectedTokens.length >= 0.82;
}

function getKnownTitleAliases(title: string): string[] {
    const normalized = cleanTitle(title);
    if (normalized === 'the world is dancing' || normalized === 'world is dancing') {
        return ['World Is Dancing', 'World is Dancing'];
    }
    return [];
}

function absoluteUrl(url: string, baseUrl: string): string {
    if (/^https?:\/\//i.test(url)) return url;
    return new URL(url, baseUrl).href;
}

function normalizeSubtitleLanguage(value: unknown): string {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return '';
    const aliases: Record<string, string> = {
        english: 'en', arabic: 'ar', spanish: 'es', french: 'fr', german: 'de',
        indonesian: 'id', japanese: 'ja', korean: 'ko', portuguese: 'pt',
        russian: 'ru', thai: 'th', vietnamese: 'vi', chinese: 'zh',
    };
    return aliases[raw] || raw;
}

function detectSubtitleLanguage(text: string): string {
    if (/[\u0E00-\u0E7F]/u.test(text)) return 'th';
    if (/[\u0600-\u06FF]/u.test(text)) return 'ar';
    if (/[\uAC00-\uD7AF]/u.test(text)) return 'ko';
    if (/[\u3040-\u30FF]/u.test(text)) return 'ja';
    if (/[\u0400-\u04FF]/u.test(text)) return 'ru';
    if (/[\u4E00-\u9FFF]/u.test(text)) return 'zh';
    return 'und';
}

async function resolveSubtitleLanguage(subtitle: any, referer: string): Promise<string> {
    const explicit = normalizeSubtitleLanguage(
        subtitle?.lang || subtitle?.label || subtitle?.language || subtitle?.name || subtitle?.title || subtitle?.srclang
    );

    const sourceUrl = String(subtitle?.src || '');
    const urlHint = sourceUrl.match(/(?:^|[\/_?&=.-])(english|eng|en|arabic|ara|ar|thai|tha|th|spanish|spa|es|french|fra|fr|german|deu|de|indonesian|ind|id|japanese|jpn|ja|korean|kor|ko|portuguese|por|pt|russian|rus|ru|vietnamese|vie|vi|chinese|zho|zh)(?:[\/_?&=.-]|$)/i)?.[1];

    try {
        const { data } = await axios.get<string>(sourceUrl, {
            headers: { ...DEFAULT_HEADERS, Referer: referer, Range: 'bytes=0-65535' },
            timeout: 3500,
            responseType: 'text',
            maxContentLength: 256 * 1024,
        });
        const detected = detectSubtitleLanguage(String(data || ''));
        // Embed metadata is frequently copied as "English" for every track.
        // A distinctive subtitle script is stronger evidence than that label.
        if (detected !== 'und') return detected;
    } catch {
        // Fall through to the provider metadata when the subtitle cannot be sampled.
    }

    if (explicit) return explicit;
    if (urlHint) return normalizeSubtitleLanguage(urlHint);
    return 'und';
}

// In-memory caches to eliminate lookup latency on repeat queries
const animeSlugMemoryCache = new Map<string, { slug: string; animeId: string }>();
const episodeListMemoryCache = new Map<string, Array<{ epNumber: number; epId: string; title: string }>>();

export class HiAnimeScraper implements VideoSource {
    id = 'hianime';

    /**
     * Search HiAnime by keyword and pick the best matching anime item.
     */
    async searchAnime(query: string): Promise<{ slug: string; animeId: string; title: string } | null> {
        const normalized = cleanTitle(query);
        if (!normalized) return null;

        const cacheKey = `hianime:slug:v2:${normalized}`;
        const memCached = animeSlugMemoryCache.get(cacheKey);
        if (memCached) return { ...memCached, title: query };

        const redisCached = await cacheGet<{ slug: string; animeId: string }>(cacheKey).catch(() => null);
        if (redisCached) {
            animeSlugMemoryCache.set(cacheKey, redisCached);
            return { ...redisCached, title: query };
        }

        try {
            const { data } = await axios.get<string>(`${HIANIME_BASE}/search?keyword=${encodeURIComponent(query)}`, {
                headers: DEFAULT_HEADERS,
                timeout: 8000,
            });

            const $ = cheerio.load(data);
            const candidates: Array<{ title: string; slug: string; animeId: string }> = [];

            $('.film-detail .film-name a').each((_, el) => {
                const title = $(el).text().trim();
                const href = $(el).attr('href') || '';
                const cleanHref = href.replace(/^https?:\/\/hianime\.at\//i, '').replace(/^\//, '');
                const parts = cleanHref.split('-');
                const animeId = parts[parts.length - 1];
                if (title && cleanHref && animeId && /^\d+$/.test(animeId)) {
                    candidates.push({ title, slug: cleanHref, animeId });
                }
            });

            if (candidates.length === 0) return null;

            // Rank candidates against query, but reject weak matches so unrelated anime
            // never become cached routes for later playback.
            let bestCandidate: { title: string; slug: string; animeId: string } | null = null;
            let bestScore = -999;

            for (const cand of candidates) {
                if (!isSafeTitleMatch(query, cand.title)) continue;
                const candNorm = cleanTitle(cand.title);
                let score = 0;
                if (candNorm === normalized) score += 1000;
                else if (candNorm.startsWith(normalized)) score += 500;
                else if (candNorm.includes(normalized) || normalized.includes(candNorm)) score += 200;

                // Penalize movies if query didn't ask for movie
                const isMovie = /\b(movie|film)\b/i.test(cand.title);
                const asksMovie = /\b(movie|film)\b/i.test(query);
                if (isMovie && !asksMovie) score -= 300;

                if (score > bestScore) {
                    bestScore = score;
                    bestCandidate = cand;
                }
            }

            if (!bestCandidate) {
                logger.warn(`[HiAnime] Search rejected weak matches for "${query}". Candidates: ${candidates.slice(0, 5).map((c) => c.title).join(', ')}`);
                return null;
            }

            const result = { slug: bestCandidate.slug, animeId: bestCandidate.animeId };
            animeSlugMemoryCache.set(cacheKey, result);
            await cacheSet(cacheKey, result, 30 * 24 * 60 * 60).catch(() => {});

            return { ...result, title: bestCandidate.title };
        } catch (error: any) {
            logger.warn(`[HiAnime] Search failed for "${query}": ${error?.message || error}`);
            return null;
        }
    }

    /**
     * Fetch episode list for a HiAnime anime ID.
     */
    async getEpisodes(animeId: string, slug: string): Promise<Array<{ epNumber: number; epId: string; title: string }>> {
        const cacheKey = `hianime:episodes:${animeId}`;
        const memCached = episodeListMemoryCache.get(cacheKey);
        if (memCached) return memCached;

        const redisCached = await cacheGet<Array<{ epNumber: number; epId: string; title: string }>>(cacheKey).catch(() => null);
        if (redisCached) {
            episodeListMemoryCache.set(cacheKey, redisCached);
            return redisCached;
        }

        try {
            const { data } = await axios.get(`${HIANIME_BASE}/api/theme/episode/list/${animeId}`, {
                headers: {
                    ...DEFAULT_HEADERS,
                    Referer: `${HIANIME_BASE}/${slug}`,
                    'X-Requested-With': 'XMLHttpRequest',
                },
                timeout: 8000,
            });

            const html = typeof data === 'object' && data?.html ? data.html : String(data || '');
            const $ = cheerio.load(html);
            const episodes: Array<{ epNumber: number; epId: string; title: string }> = [];

            $('.ep-item').each((_, el) => {
                const numStr = $(el).attr('data-number') || '';
                const epId = $(el).attr('data-id') || '';
                const title = $(el).attr('title') || `Episode ${numStr}`;
                const epNum = parseFloat(numStr);
                if (!isNaN(epNum) && epId) {
                    episodes.push({ epNumber: epNum, epId, title });
                }
            });

            if (episodes.length > 0) {
                episodeListMemoryCache.set(cacheKey, episodes);
                await cacheSet(cacheKey, episodes, 24 * 60 * 60).catch(() => {});
            }

            return episodes;
        } catch (error: any) {
            logger.warn(`[HiAnime] Episode fetch failed for animeId ${animeId}: ${error?.message || error}`);
            return [];
        }
    }

    /**
     * Extract embed URLs for SUB and DUB from HiAnime episode servers API.
     */
    async getEpisodeServers(episodeId: string, slug: string): Promise<{ subEmbed?: string; dubEmbed?: string }> {
        try {
            const { data } = await axios.get(`${HIANIME_BASE}/api/theme/episode/servers?episodeId=${episodeId}`, {
                headers: {
                    ...DEFAULT_HEADERS,
                    Referer: `${HIANIME_BASE}/watch/${slug}?ep=${episodeId}`,
                    'X-Requested-With': 'XMLHttpRequest',
                },
                timeout: 8000,
            });

            const html = typeof data === 'object' && data?.html ? data.html : String(data || '');
            const $ = cheerio.load(html);

            let subEmbed: string | undefined;
            let dubEmbed: string | undefined;

            // Prioritize ZokoAnime (used by ani-cli) which ships decryptable window.__P
            const zokoSub = $('.server-item[data-server-name="ZokoAnime"][data-type="sub"], .server-item[data-server-name*="Zoko"][data-type="sub"]').first().attr('data-hash');
            const fallbackSub = $('.server-item[data-type="sub"]').first().attr('data-hash');
            const targetSubHash = zokoSub || fallbackSub;

            if (targetSubHash) {
                try {
                    subEmbed = Buffer.from(targetSubHash, 'base64').toString('utf8');
                } catch {}
            }

            const zokoDub = $('.server-item[data-server-name="ZokoAnime"][data-type="dub"], .server-item[data-server-name*="Zoko"][data-type="dub"]').first().attr('data-hash');
            const fallbackDub = $('.server-item[data-type="dub"]').first().attr('data-hash');
            const targetDubHash = zokoDub || fallbackDub;

            if (targetDubHash) {
                try {
                    dubEmbed = Buffer.from(targetDubHash, 'base64').toString('utf8');
                } catch {}
            }

            return { subEmbed, dubEmbed };
        } catch (error: any) {
            logger.warn(`[HiAnime] Servers fetch failed for epId ${episodeId}: ${error?.message || error}`);
            return {};
        }
    }

    /**
     * Fetch embed URL and decrypt payload using XOR 'otaku-embed-v1'.
     */
    async resolveEmbed(embedUrl: string): Promise<{
        m3u8: string;
        subtitles: SubtitleTrack[];
        variants?: Array<{ quality: string; url: string }>;
        skip?: { intro?: { start: number; end: number }; outro?: { start: number; end: number } };
    } | null> {
        try {
            const referer = `${new URL(embedUrl).origin}/`;
            const { data } = await axios.get<string>(embedUrl, {
                headers: {
                    ...DEFAULT_HEADERS,
                    Referer: HIANIME_BASE,
                },
                timeout: 8000,
            });

            const blobMatch = data.match(/window\.__P\s*=\s*["']([^"']+)["']/);
            if (!blobMatch?.[1]) {
                logger.warn(`[HiAnime] No window.__P found in embed ${embedUrl}`);
                return null;
            }

            const decryptedStr = deobfuscateBlob(blobMatch[1]);
            if (!decryptedStr) return null;

            const json = JSON.parse(decryptedStr);
            const masterM3u8 = json.src;
            if (!masterM3u8) return null;

            const subtitles: SubtitleTrack[] = Array.isArray(json.subtitles)
                ? (await Promise.all(json.subtitles.map(async (sub: any) => {
                    if (!sub?.src) return null;
                    return {
                        lang: await resolveSubtitleLanguage(sub, referer),
                        url: sub.src,
                    };
                }))).filter((subtitle): subtitle is SubtitleTrack => Boolean(subtitle))
                : [];

            // Fetch master playlist variants
            let variants: Array<{ quality: string; url: string }> | undefined;
            try {
                const { data: masterData } = await axios.get<string>(masterM3u8, {
                    headers: {
                        ...DEFAULT_HEADERS,
                        Referer: referer,
                    },
                    timeout: 4000,
                });

                if (masterData.includes('#EXTM3U')) {
                    const parsedVariants: Array<{ quality: string; url: string }> = [];
                    const lines = masterData.split(/\r?\n/);
                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i].trim();
                        if (line.startsWith('#EXT-X-STREAM-INF')) {
                            const resMatch = line.match(/RESOLUTION=\d+x(\d+)/i);
                            const bandwidth = Number(line.match(/BANDWIDTH=(\d+)/i)?.[1] || 0);
                            let targetUrl = '';
                            for (let j = i + 1; j < lines.length; j++) {
                                const next = lines[j].trim();
                                if (next && !next.startsWith('#')) {
                                    targetUrl = next;
                                    break;
                                }
                            }
                            if (targetUrl) {
                                const fullUrl = absoluteUrl(targetUrl, masterM3u8);
                                const qLabel = resMatch?.[1] ? `${resMatch[1]}p` : (bandwidth >= 2_500_000 ? '720p' : '480p');
                                parsedVariants.push({ quality: qLabel, url: fullUrl });
                            }
                        }
                    }
                    if (parsedVariants.length > 0) {
                        variants = parsedVariants.sort((a, b) => parseInt(b.quality, 10) - parseInt(a.quality, 10));
                    }
                }
            } catch {
                // Variants extraction is optional; master m3u8 is primary
            }

            return {
                m3u8: masterM3u8,
                subtitles,
                variants,
                skip: json.skip,
            };
        } catch (error: any) {
            logger.warn(`[HiAnime] Embed resolution failed for ${embedUrl}: ${error?.message || error}`);
            return null;
        }
    }

    /**
     * Resolves playable streams for an anime episode.
     */
    async getStream(
        anilistId: number,
        episode: number,
        options?: { title?: string; tmdbId?: number; format?: string; anilistId?: number }
    ): Promise<StreamResponse | null> {
        const rawTitle = options?.title || '';

        // 1. Check direct MAL ID shortcut (e.g., https://zokoanime.video/stream/mal/<id>/<ep>/sub)
        let malId: number | null = null;
        if (anilistId) {
            try {
                const aniZip = await tmdbService.resolveTmdbIdFromAniZip(anilistId).catch(() => null);
                // If aniZip contains mappings, we can check for mal id
            } catch {}
        }

        // Direct shortcut check if malId is known
        if (malId) {
            try {
                const directSubUrl = `https://zokoanime.video/stream/mal/${malId}/${episode}/sub`;
                const directDubUrl = `https://zokoanime.video/stream/mal/${malId}/${episode}/dub`;

                const [subRes, dubRes] = await Promise.all([
                    this.resolveEmbed(directSubUrl),
                    this.resolveEmbed(directDubUrl).catch(() => null),
                ]);

                if (subRes?.m3u8) {
                    logger.info(`[HiAnime] Resolved stream directly via MAL ID ${malId} ep ${episode}`);
                    return {
                        m3u8: subRes.m3u8,
                        dubM3u8: dubRes?.m3u8 || undefined,
                        subtitles: subRes.subtitles,
                        source: this.id,
                        episode,
                        title: options?.title,
                        referer: 'https://zokoanime.video/',
                        dubReferer: dubRes?.m3u8 ? 'https://zokoanime.video/' : undefined,
                        variants: subRes.variants,
                        dubVariants: dubRes?.variants,
                    };
                }
            } catch {}
        }

        // 2. Search HiAnime by Title Candidates (English, Romaji, userPreferred, synonyms)
        const candidateQueries: string[] = [];
        if (rawTitle) candidateQueries.push(rawTitle);
        for (const alias of getKnownTitleAliases(rawTitle)) {
            if (!candidateQueries.includes(alias)) candidateQueries.push(alias);
        }
        if (options?.titles) {
            const t = options.titles as any;
            if (Array.isArray(t)) {
                for (const title of t) {
                    if (typeof title === 'string' && title.trim() && !candidateQueries.includes(title.trim())) {
                        candidateQueries.push(title.trim());
                        for (const alias of getKnownTitleAliases(title)) {
                            if (!candidateQueries.includes(alias)) candidateQueries.push(alias);
                        }
                    }
                }
            } else if (typeof t === 'object') {
                const addTitle = (value: unknown) => {
                    const title = String(value || '').trim();
                    if (!title) return;
                    if (!candidateQueries.includes(title)) candidateQueries.push(title);
                    for (const alias of getKnownTitleAliases(title)) {
                        if (!candidateQueries.includes(alias)) candidateQueries.push(alias);
                    }
                };
                addTitle(t.english);
                addTitle(t.romaji);
                addTitle(t.userPreferred);
                if (Array.isArray(t.synonyms)) {
                    for (const s of t.synonyms) {
                        addTitle(s);
                    }
                }
            }
        }

        if (candidateQueries.length === 0) return null;

        let anime: { slug: string; animeId: string; title: string } | null = null;
        let matchedQuery = '';
        for (const query of candidateQueries) {
            anime = await this.searchAnime(query);
            if (anime) {
                matchedQuery = query;
                break;
            }
        }

        if (!anime) {
            logger.warn(`[HiAnime] Anime not found on HiAnime for queries: ${candidateQueries.join(', ')}`);
            return null;
        }

        // 3. Get Episode List
        const episodes = await this.getEpisodes(anime.animeId, anime.slug);
        if (episodes.length === 0) return null;

        const targetEp = episodes.find((e) => e.epNumber === episode);
        if (!targetEp?.epId) {
            logger.warn(`[HiAnime] Episode ${episode} not found in ${anime.slug}`);
            return null;
        }

        // 4. Get Servers for Episode
        const { subEmbed, dubEmbed } = await this.getEpisodeServers(targetEp.epId, anime.slug);
        if (!subEmbed && !dubEmbed) {
            logger.warn(`[HiAnime] No embeds found for ${anime.slug} ep ${episode}`);
            return null;
        }

        // 5. Decrypt and Resolve Embed Playlists
        const [subStream, dubStream] = await Promise.all([
            subEmbed ? this.resolveEmbed(subEmbed) : Promise.resolve(null),
            dubEmbed ? this.resolveEmbed(dubEmbed) : Promise.resolve(null),
        ]);

        const chosenM3u8 = subStream?.m3u8 || dubStream?.m3u8;
        if (!chosenM3u8) {
            logger.warn(`[HiAnime] Failed to extract m3u8 from embeds for ${anime.slug} ep ${episode}`);
            return null;
        }

        logger.info(`[HiAnime] Successfully extracted m3u8 for ${anime.slug} ep ${episode}${matchedQuery ? ` via "${matchedQuery}"` : ''}`);
        const streamReferer = 'https://zokoanime.video/';

        return {
            m3u8: chosenM3u8,
            audio: subStream?.m3u8 ? 'sub' : 'dub',
            dubM3u8: subStream?.m3u8 ? dubStream?.m3u8 : undefined,
            subtitles: subStream?.subtitles || dubStream?.subtitles || [],
            source: this.id,
            episode,
            title: targetEp.title || options?.title,
            referer: streamReferer,
            dubReferer: dubStream?.m3u8 ? streamReferer : undefined,
            variants: subStream?.variants || dubStream?.variants,
            dubVariants: subStream?.m3u8 ? dubStream?.variants : undefined,
        };
    }
}

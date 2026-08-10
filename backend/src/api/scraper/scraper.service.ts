import { AllMangaScraper } from '../../scraper/allmanga';
import { tmdbService } from './tmdb.service';
import { Request, Response } from 'express'; // Trigger restart
import { anilistService } from './anilist.service';

import { acquireLock, cacheGet, cacheSet, releaseLock } from '../../utils/redis-cache';

type StreamProviderOptions = {
    provider?: string;
    title?: string;
    titles?: string[];
    year?: string | number;
    format?: string;
    episodeNumber?: number;
    anilistId?: number;
};

class ScraperService {
    private allMangaScraper: AllMangaScraper;

    private cache = new Map<string, { expiresAt: number; value: any }>();
    private inFlight = new Map<string, Promise<any>>();
    private hotStreamKeys = new Map<string, { animeSession: string; epSession: string; hits: number; lastAccess: number }>();

    constructor() {
        this.allMangaScraper = new AllMangaScraper();
    }

    private isAnimePaheSession(session: string) {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(session || '').trim());
    }

    private isAnimePaheCompatibleSession(session: string) {
        const normalized = String(session || '').trim();
        return this.isAnimePaheSession(normalized) || /^apch:[a-z0-9-]+$/i.test(normalized);
    }

    private isAllMangaSession(session: string) {
        return AllMangaScraper.isAllMangaSession(session);
    }



    private normalizeTitle(value: unknown) {
        return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    private buildAnimePaheLookupQueries(item: any) {
        const queries = new Set<string>();
        const add = (value: unknown) => {
            const normalized = String(value || '').replace(/\s+/g, ' ').trim();
            if (normalized) queries.add(normalized);
        };

        add(item?.title);
        add(item?.jname);
        add(item?.anilist?.title?.english);
        add(item?.anilist?.title?.romaji);
        add(item?.anilist?.title?.native);
        (Array.isArray(item?.anilist?.synonyms) ? item.anilist.synonyms : []).slice(0, 3).forEach(add);

        return Array.from(queries).slice(0, 4);
    }

    private scoreAnimePaheCandidateForItem(item: any, candidate: any) {
        const candidateTitle = this.normalizeTitle(candidate?.title);
        if (!candidateTitle) return 0;

        const titleScore = this.buildAnimePaheLookupQueries(item).reduce((best, title) => {
            const targetTitle = this.normalizeTitle(title);
            if (!targetTitle || targetTitle.length < 4) return best;
            if (candidateTitle === targetTitle) return Math.max(best, 120);
            if (candidateTitle.includes(targetTitle) || targetTitle.includes(candidateTitle)) return Math.max(best, 80);
            return best;
        }, 0);
        if (titleScore <= 0) return 0;

        let score = titleScore;
        const expectedEpisodes = Number(item?.latestEpisode || item?.sub || item?.episodes || item?.anilist?.episodes || 0);
        const candidateEpisodes = Number(candidate?.episodes || 0);
        if (expectedEpisodes > 0 && candidateEpisodes > 0) {
            const diff = Math.abs(candidateEpisodes - expectedEpisodes);
            if (diff === 0) score += 30;
            else if (diff <= 1) score += 18;
            else if (diff <= 3) score += 8;
            else score -= 20;
        }

        const expectedYear = Number(item?.year || item?.anilist?.seasonYear || item?.anilist?.startDate?.year || 0);
        const candidateYear = Number(candidate?.year || 0);
        if (expectedYear > 0 && candidateYear > 0) {
            const diff = Math.abs(candidateYear - expectedYear);
            if (diff === 0) score += 8;
            else if (diff > 1) score -= 12;
        }

        return score;
    }

    private findLatestReleaseForItem(item: any, latestReleases: any[]) {
        const itemTitles = this.buildAnimePaheLookupQueries(item)
            .map((title) => this.normalizeTitle(title))
            .filter((title) => title.length >= 4);
        if (itemTitles.length === 0) return null;

        const itemSession = String(item?.animePaheSession || item?.animepaheSession || '').trim();
        const ranked = (Array.isArray(latestReleases) ? latestReleases : [])
            .map((release) => {
                const releaseTitle = this.normalizeTitle(release?.title);
                const releaseSession = String(release?.animeSession || release?.session || '').trim();
                if (!releaseTitle) return { release, score: 0 };

                let score = itemTitles.reduce((best, title) => {
                    if (releaseTitle === title) return Math.max(best, 120);
                    if (releaseTitle.includes(title) || title.includes(releaseTitle)) return Math.max(best, 80);
                    return best;
                }, 0);

                if (itemSession && releaseSession && itemSession === releaseSession) score += 80;

                return { release, score };
            })
            .filter((entry) => entry.score > 0 && Number(entry.release?.episodeNumber || 0) > 0)
            .sort((a, b) => b.score - a.score);

        return ranked[0]?.release || null;
    }

    private queryFromSessionSlug(value: unknown) {
        return String(value || '')
            .trim()
            .replace(/^s:/i, '')
            .replace(/^https?:\/\/[^/]+/i, '')
            .replace(/^\/+/, '')
            .replace(/^watch\//i, '')
            .split(/[?#]/)[0]
            .replace(/-\d+$/, '')
            .replace(/[-_]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    private parseEpisodeNumber(value: unknown) {
        const raw = String(value || '').trim();
        const match = raw.match(/\$ep=(\d+(?:\.\d+)?)/i)
            || raw.match(/[?&]ep=(\d+(?:\.\d+)?)/i)
            || raw.match(/(?:^|[^\d])(\d+(?:\.\d+)?)(?:[^\d]|$)/);
        const parsed = Number(match?.[1] || raw);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    }

    private async resolveAnimePaheAnimeTarget(animeSession: string) {
        return null;
    }

    private async resolveAnimePaheStreamTarget(animeSession: string, epSession: string) {
        return null;
    }

    private async getOrLoad<T>(
        key: string,
        ttlMs: number,
        loader: () => Promise<T>,
        options?: {
            shouldCache?: (value: T) => boolean;
            allowCached?: (value: T) => boolean;
        }
    ): Promise<T> {
        const now = Date.now();
        const cached = this.cache.get(key);
        if (cached && cached.expiresAt > now) {
            const value = cached.value as T;
            if (!options?.allowCached || options.allowCached(value)) {
                return value;
            }
            this.cache.delete(key);
        }

        const redisCached = await cacheGet<T>(key);
        if (redisCached !== null) {
            if (!options?.allowCached || options.allowCached(redisCached)) {
                this.cache.set(key, { expiresAt: now + ttlMs, value: redisCached });
                return redisCached;
            }
        }

        const inFlight = this.inFlight.get(key);
        if (inFlight) {
            return inFlight as Promise<T>;
        }

        // Cross-instance dedup for Vercel serverless: each cold start gets its own
        // empty inFlight Map, so in-memory dedup doesn't prevent duplicate scrapers.
        // Use a Redis lock so that only ONE instance runs the loader while others
        // poll Redis for the cached result.
        const lockKey = `lock:dedup:${key}`;
        const lockTtlSeconds = Math.min(60, Math.max(15, Math.ceil(ttlMs / 1000)));
        let acquiredLock = false;

        try {
            acquiredLock = await acquireLock(lockKey, lockTtlSeconds);
        } catch {
            // Redis unavailable — proceed without distributed dedup.
        }

        if (!acquiredLock) {
            // Another instance is already running this loader. Poll Redis for the result.
            const pollStart = Date.now();
            const pollTimeout = 15_000;
            while (Date.now() - pollStart < pollTimeout) {
                await new Promise((resolve) => setTimeout(resolve, 1000));
                const polled = await cacheGet<T>(key);
                if (polled !== null) {
                    if (!options?.allowCached || options.allowCached(polled)) {
                        this.cache.set(key, { expiresAt: Date.now() + ttlMs, value: polled });
                        return polled;
                    }
                }
            }
            // Timeout — fall through and run the loader ourselves as a safety net.
        }

        const promise = loader()
            .then((value) => {
                const shouldCache = options?.shouldCache ? options.shouldCache(value) : true;
                if (shouldCache) {
                    this.cache.set(key, { expiresAt: Date.now() + ttlMs, value });
                    cacheSet(key, value, Math.ceil(ttlMs / 1000)).catch((error) => {
                        console.warn(`[ScraperService] Redis cache set failed for "${key}"`, error);
                    });
                } else {
                    this.cache.delete(key);
                }
                return value;
            })
            .finally(() => {
                this.inFlight.delete(key);
                if (acquiredLock) {
                    releaseLock(lockKey).catch(() => undefined);
                }
            });

        this.inFlight.set(key, promise);

        // Opportunistic cleanup of expired entries.
        if (this.cache.size > 300) {
            const nowTs = Date.now();
            for (const [k, v] of this.cache.entries()) {
                if (v.expiresAt <= nowTs) {
                    this.cache.delete(k);
                }
            }
        }

        return promise;
    }

    private trackHotStream(animeSession: string, epSession: string): void {
        const key = `${animeSession}:${epSession}`;
        const current = this.hotStreamKeys.get(key);
        if (current) {
            current.hits += 1;
            current.lastAccess = Date.now();
            return;
        }
        this.hotStreamKeys.set(key, {
            animeSession,
            epSession,
            hits: 1,
            lastAccess: Date.now(),
        });

        if (this.hotStreamKeys.size > 200) {
            const sorted = [...this.hotStreamKeys.entries()].sort(
                (a, b) => (a[1].hits * 1000000 + a[1].lastAccess) - (b[1].hits * 1000000 + b[1].lastAccess)
            );
            for (let i = 0; i < sorted.length - 150; i++) {
                this.hotStreamKeys.delete(sorted[i][0]);
            }
        }
    }

    private async fetchStreamLinksWithRetries(animeSession: string, epSession: string) {
        return [];
    }

    async search(query: string) {
        const normalized = query.toLowerCase().trim();
        return this.getOrLoad(`search:v7:${normalized}`, 2 * 60 * 1000, async () => {
            const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> => {
                try {
                    return await Promise.race([
                        promise,
                        new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs)),
                    ]);
                } catch {
                    return fallback;
                }
            };
            const allManga = await withTimeout(this.allMangaScraper.searchAnime(query), 7000, []);
            const seen = new Set<string>();
            const merged: any[] = [];

            const addItems = (items: unknown) => {
                if (!Array.isArray(items)) return;
                items.forEach((item: any) => {
                    const session = String(item?.session || '').trim();
                    if (!session || seen.has(session)) return;
                    seen.add(session);
                    merged.push(item);
                });
            };

            addItems(allManga);

            return merged;
        });
    }

    async searchAnimePahe(query: string) {
        const normalized = query.toLowerCase().trim();
        return this.getOrLoad(
            `search:animepahe:v1:${normalized}`,
            5 * 60 * 1000,
            async () => [],
            {
                shouldCache: (value) => Array.isArray(value) && value.length > 0,
                allowCached: (value) => Array.isArray(value) && value.length > 0,
            }
        );
    }

    async searchAnimeKai(query: string) {
        return [];
    }

    async searchAllManga(query: string) {
        const normalized = query.toLowerCase().trim();
        return this.getOrLoad(
            `search:allmanga:v1:${normalized}`,
            5 * 60 * 1000,
            async () => this.allMangaScraper.searchAnime(query),
            {
                shouldCache: (value) => Array.isArray(value) && value.length > 0,
                allowCached: (value) => Array.isArray(value) && value.length > 0,
            }
        );
    }

    async attachAnimePaheSessions<T extends Record<string, any>>(items: T[], timeoutMs: number = 2500): Promise<T[]> {
        const safeItems = Array.isArray(items) ? items : [];
        return safeItems;
    }

    async getAnimePaheLatestReleases(page: number = 1) {
        const safePage = Math.max(1, Math.floor(Number(page) || 1));
        return this.getOrLoad(
            `animepahe:latest-releases:v6:${safePage}`,
            5 * 60 * 1000,
            async () => this.allMangaScraper.getLatestUpdates(safePage),
            {
                shouldCache: (value) => Array.isArray((value as any)?.data) && (value as any).data.length > 0,
                allowCached: (value) => Array.isArray((value as any)?.data) && (value as any).data.length > 0,
            }
        );
    }

    async getAnimePaheLatestUpdates(page: number = 1, limit?: number) {
        const safePage = Math.max(1, Math.floor(Number(page) || 1));
        const safeLimit = Math.max(1, Math.floor(Number(limit || 0)) || 0);
        const cacheKey = `animepahe:latest-updates:v6:${safePage}:${safeLimit || 'all'}`;

        return this.getOrLoad(
            cacheKey,
            5 * 60 * 1000,
            async () => {
                const latest = await this.getAnimePaheLatestReleases(safePage);
                const rawItems = Array.isArray(latest?.data) ? latest.data : [];
                const pageItems = safeLimit > 0 ? rawItems.slice(0, safeLimit) : rawItems;

                const data = pageItems.map((release: any) => {
                    const releaseSession = String(release?.animeSession || release?.session || '').trim();
                    const animeSession = this.isAnimePaheSession(releaseSession) ? releaseSession : '';
                    const latestEpisode = Number(release?.episodeNumber || 0) || undefined;
                    const poster = String(release?.snapshot || '').trim();

                    return {
                        id: animeSession || release?.id || release?.title,
                        mal_id: 0,
                        title: String(release?.title || 'Unknown'),
                        poster,
                        image: poster,
                        type: 'TV',
                        status: 'RELEASING',
                        episodes: latestEpisode,
                        latestEpisode,
                        sub: latestEpisode,
                        link: release?.url || (animeSession ? `/anime/${animeSession}` : ''),
                        scraperId: animeSession || undefined,
                        session: animeSession || undefined,
                        animePaheSession: animeSession || undefined,
                        episodeSession: release?.episodeSession,
                    };
                }).filter((item) => item?.title);

                return {
                    data,
                    pagination: latest?.pagination || {
                        current_page: safePage,
                        last_visible_page: safePage,
                        has_next_page: false,
                    },
                };
            },
            {
                shouldCache: (value) => Array.isArray((value as any)?.data) && (value as any).data.length > 0,
                allowCached: (value) => Array.isArray((value as any)?.data) && (value as any).data.length > 0,
            }
        );
    }

    async getAllMangaLatestUpdates(page: number = 1, limit: number = 18) {
        const safePage = Math.max(1, Math.floor(Number(page) || 1));
        const safeLimit = Math.max(1, Math.floor(Number(limit || 18)) || 18);
        return this.getOrLoad(
            `allmanga:latest-updates:v6:${safePage}:${safeLimit}`,
            5 * 60 * 1000,
            async () => this.allMangaScraper.getLatestUpdates(safePage, safeLimit),
            {
                shouldCache: (value) => Array.isArray((value as any)?.data) && (value as any).data.length > 0,
                allowCached: (value) => Array.isArray((value as any)?.data) && (value as any).data.length > 0,
            }
        );
    }

    async getAllMangaAnimeInfo(session: string) {
        return this.allMangaScraper.getAnimeInfo(session);
    }

    async getEpisodes(session: string, expectedEpisodes: number = 0) {
        if (this.isAllMangaSession(session)) {
            const isGoodPayload = (value: any) => {
                const episodes = Array.isArray(value?.episodes) ? value.episodes : [];
                if (episodes.length === 0) return false;
                // If caller told us how many episodes to expect, don't accept anything below 80% of that
                if (expectedEpisodes > 1 && episodes.length < Math.floor(expectedEpisodes * 0.8)) return false;
                return true;
            };
            return this.getOrLoad(
                `episodes:allmanga:v4:${session}`,
                60 * 60 * 1000,
                async () => this.allMangaScraper.getEpisodes(session),
                {
                    shouldCache: isGoodPayload,
                    allowCached: isGoodPayload,
                }
            );
        }

        const isCompleteEpisodePayload = (value: any) => {
            const episodes = Array.isArray(value?.episodes) ? value.episodes : [];
            const lastPage = Number(value?.lastPage || 1);
            const minimumExpectedEpisodes = Math.max(
                Number(expectedEpisodes || 0),
                lastPage <= 1 ? 1 : ((Math.floor(lastPage) - 1) * 30) + 1
            );
            return episodes.length >= minimumExpectedEpisodes;
        };
        const waitForFullCache = async (timeoutMs: number) => {
            const startedAt = Date.now();
            while (Date.now() - startedAt < timeoutMs) {
                const waitedCache = await cacheGet<any>(fullCacheKey);
                if (waitedCache && isCompleteEpisodePayload(waitedCache)) {
                    return waitedCache;
                }
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
            return null;
        };
        const fullCacheKey = `episodes:full:v4:${session}`;
        const lockKey = `lock:episodes:${session}`;
        const fullTtlMs = 24 * 60 * 60 * 1000;
        const shortTtlMs = 60 * 60 * 1000;
        const shortCacheKey = `episodes:v10:${session}`;

        const fullCached = await cacheGet<any>(fullCacheKey);
        if (fullCached && isCompleteEpisodePayload(fullCached)) {
            this.cache.set(shortCacheKey, { expiresAt: Date.now() + shortTtlMs, value: fullCached });
            return fullCached;
        }

        return this.getOrLoad(
            shortCacheKey,
            shortTtlMs,
            async () => {
                let hasLock = await acquireLock(lockKey, 90);
                if (!hasLock) {
                    const waitedCache = await waitForFullCache(25000);
                    if (waitedCache) return waitedCache;

                    hasLock = await acquireLock(lockKey, 90);
                }

                if (!hasLock) {
                    const staleCached = await cacheGet<any>(shortCacheKey);
                    if (staleCached && isCompleteEpisodePayload(staleCached)) {
                        return staleCached;
                    }
                    return { episodes: [], lastPage: 1 };
                }

                try {
                    return { episodes: [], lastPage: 1 };
                } finally {
                    releaseLock(lockKey).catch(() => undefined);
                }
            },
            {
                shouldCache: isCompleteEpisodePayload,
                allowCached: isCompleteEpisodePayload,
            }
        );
    }

    async getStreams(animeSession: string, epSession: string, options?: StreamProviderOptions) {
        const provider = String(options?.provider || 'auto').trim().toLowerCase() || 'auto';
        
        // ── Custom Video Sources (video-sources.ts) ─────────────────────────
        if (provider === 'vidsrc' || provider === 'vidking' || provider === 'anidb' || provider === 'anikoto' || provider === 'videasy' || provider === 'reanime' || provider === 'anineko') {
            const title = String(options?.title || this.queryFromSessionSlug(animeSession)).trim();
            const parsedAnilistId = parseInt(animeSession, 10);
            const anilistId = options?.anilistId || (!isNaN(parsedAnilistId) && parsedAnilistId > 0 ? parsedAnilistId : undefined);

            const tmdbTarget = await tmdbService.resolveMediaTarget({ 
                title, 
                titles: options?.titles, 
                year: options?.year, 
                format: options?.format,
                anilistId,
            }).catch(() => null);

            const episodeNumber = Number(options?.episodeNumber || this.parseEpisodeNumber(epSession)) || 1;
            const { animeVideoSources } = require('../anime/video-sources');
            const targetId = tmdbTarget?.tmdbId || (anilistId || 0);
            const streamResponse = await animeVideoSources.getStream(targetId, episodeNumber, provider, {
                title,
                tmdbId: tmdbTarget?.tmdbId,
                format: options?.format,
                anilistId,
            });
            
            if (streamResponse?.m3u8) {
                const isHls = /\.m3u8?(?:[?#]|$)/i.test(streamResponse.m3u8);
                const referer = streamResponse.referer || '';
                const actualSource = String(streamResponse.source || provider).trim().toLowerCase();
                let proxyMedia = '';
                if (actualSource === 'anineko' || actualSource === 'anidb') proxyMedia = '&proxyMedia=1';
                
                let masterUrl = streamResponse.m3u8;
                if ((actualSource === 'anineko' || actualSource === 'anidb') && masterUrl.startsWith('http')) {
                    masterUrl = `/api/scraper/proxy?url=${encodeURIComponent(masterUrl)}&referer=${encodeURIComponent(referer)}${proxyMedia}`;
                }
                // Don't double-wrap: if the source already returned a proxied /api/... path, use it as-is
                
                const serverName = actualSource === 'anidb' ? 'AniDB' : actualSource === 'videasy' ? 'Videasy' : actualSource === 'vidking' ? 'VidKing' : actualSource === 'vidsrc' ? 'VidSrc' : actualSource.toUpperCase();
                const isEmbedSource = !isHls && (/embed/i.test(masterUrl) || actualSource === 'vidsrc' || actualSource === 'vidking' || actualSource === 'videasy');

                const streamsList: any[] = [{
                    quality: 'auto',
                    audio: 'sub',
                    provider: actualSource,
                    server: serverName,
                    url: masterUrl,
                    isHls: isHls,
                    isEmbed: isEmbedSource,
                    referer: referer,
                    duration: streamResponse.duration,
                    subtitles: streamResponse.subtitles || [],
                    directUrl: streamResponse.m3u8
                }];

                if (streamResponse.dubM3u8) {
                    let dubMasterUrl = streamResponse.dubM3u8;
                    if ((actualSource === 'anineko' || actualSource === 'anikoto' || actualSource === 'anidb') && dubMasterUrl.startsWith('http')) {
                        dubMasterUrl = `/api/scraper/proxy?url=${encodeURIComponent(dubMasterUrl)}&referer=${encodeURIComponent(referer)}${proxyMedia}`;
                    }
                    streamsList.push({
                        quality: 'auto',
                        audio: 'dub',
                        provider: actualSource,
                        server: serverName,
                        url: dubMasterUrl,
                        isHls: true,
                        isEmbed: false,
                        referer: referer,
                        subtitles: streamResponse.subtitles || [],
                        directUrl: streamResponse.dubM3u8
                    });
                }

                if (Array.isArray(streamResponse.variants) && streamResponse.variants.length > 0) {
                    for (const v of streamResponse.variants) {
                        let vUrl = v.url;
                        if ((actualSource === 'anineko' || actualSource === 'anikoto' || actualSource === 'anidb') && vUrl.startsWith('http')) {
                            vUrl = `/api/scraper/proxy?url=${encodeURIComponent(vUrl)}&referer=${encodeURIComponent(referer)}${proxyMedia}`;
                        }
                        streamsList.push({
                            quality: v.quality,
                            audio: 'sub',
                            provider: actualSource,
                            server: serverName,
                            url: vUrl,
                            isHls: true,
                            referer: referer,
                            subtitles: streamResponse.subtitles || [],
                            directUrl: v.url
                        });
                    }
                }

                if (Array.isArray(streamResponse.dubVariants) && streamResponse.dubVariants.length > 0) {
                    for (const v of streamResponse.dubVariants) {
                        let vUrl = v.url;
                        if ((actualSource === 'anineko' || actualSource === 'anikoto' || actualSource === 'anidb') && vUrl.startsWith('http')) {
                            vUrl = `/api/scraper/proxy?url=${encodeURIComponent(vUrl)}&referer=${encodeURIComponent(referer)}${proxyMedia}`;
                        }
                        streamsList.push({
                            quality: v.quality,
                            audio: 'dub',
                            provider: actualSource,
                            server: serverName,
                            url: vUrl,
                            isHls: true,
                            referer: referer,
                            subtitles: streamResponse.subtitles || [],
                            directUrl: v.url
                        });
                    }
                }

                return streamsList;
            }
            // If custom provider has no direct stream, seamlessly fall back to AllManga so playback never fails
        }
        // ── AllManga provider ──────────────────────────────────────────────
        if (provider === 'allmanga' || provider === 'auto' || provider === 'anidb' || provider === 'anikoto' || this.isAllMangaSession(animeSession)) {
            let title = String(options?.title || this.queryFromSessionSlug(animeSession)).trim();
            const episodeNumber = Number(options?.episodeNumber || this.parseEpisodeNumber(epSession));
            let showId = AllMangaScraper.fromSession(animeSession);
            const year = options?.year;
            const format = options?.format;
            const titles = options?.titles;

            // Only resolve season title if showId is missing
            const isAllMangaSession = AllMangaScraper.isAllMangaSession(showId);
            if (!isAllMangaSession && title) {
                const anilistResult = await anilistService.resolveSeasonTitle(title, 1).catch(() => ({ romaji: '', title: '' }));
                const baseTitle = anilistResult.romaji || anilistResult.title || title;
                if (baseTitle) {
                    title = baseTitle;
                }
            }

            const key = `streams:allmanga:v7:${showId || title.toLowerCase()}:${episodeNumber || epSession}:${year || ''}`;
            const links = await this.getOrLoad(
                key,
                5 * 60 * 1000,
                async () => showId
                    ? this.allMangaScraper.getLinksForShowId(showId, episodeNumber, title, year ? Number(year) : undefined)
                    : this.allMangaScraper.getLinksForEpisodeNumber(title, episodeNumber, year ? Number(year) : undefined),
                {
                    shouldCache: (value) => Array.isArray(value) && value.length > 0,
                    allowCached: (value) => Array.isArray(value) && value.length > 0,
                }
            );

            // Filter out dead/parked domains that just serve ads now
            return (Array.isArray(links) ? links : []).filter(link => {
                const u = link?.directUrl || link?.url || '';
                return u && !/streamsb|sbvideo|sbfull|sbspeed|sbfast|streamtape|embedsito|streamwish|ok\.ru|sk\.json/i.test(u);
            });
        }

        return [];
    }

    async resolvePlayableStream(animeSession: string, epSession: string) {
        const streams = await this.getStreams(animeSession, epSession, {
            provider: 'allmanga',
            episodeNumber: this.parseEpisodeNumber(epSession),
        });
        if (!Array.isArray(streams) || streams.length === 0) return null;

        const normalizeAudio = (value: unknown) => {
            const lower = String(value || '').toLowerCase();
            return /(dub|eng|english)/.test(lower) ? 'dub' : 'sub';
        };
        const scoreStream = (stream: any) => {
            const quality = Number(String(stream?.quality || '').replace(/[^\d]/g, '')) || 0;
            const subScore = normalizeAudio(stream?.audio) === 'sub' ? 10_000 : 0;
            const directScore = stream?.directUrl ? 1_000 : 0;
            return subScore + directScore + quality;
        };
        const stream = [...streams].sort((a, b) => scoreStream(b) - scoreStream(a))[0];
        const directUrl = String(stream?.directUrl || stream?.url || '').trim();
        if (!directUrl) return null;

        return { stream, directUrl };
    }

    async prefetchStreams(animeSession: string, epSessions: string[]) {
        const uniqueSessions = [...new Set(epSessions.filter(Boolean))];
        await Promise.allSettled(uniqueSessions.map((epSession) => this.getStreams(animeSession, epSession, { provider: 'allmanga' })));
        return { success: true, warmed: uniqueSessions.length };
    }

    getHotStreamCandidates(limit: number = 20) {
        const now = Date.now();
        const fresh = [...this.hotStreamKeys.values()]
            .filter((entry) => now - entry.lastAccess < 6 * 60 * 60 * 1000)
            .sort((a, b) => (b.hits * 1000000 + b.lastAccess) - (a.hits * 1000000 + a.lastAccess))
            .slice(0, limit);
        return fresh;
    }
}

export const scraperService = new ScraperService();

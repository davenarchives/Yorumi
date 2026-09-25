

export interface EpisodeMeta {
    episodeNumber: number;
    seasonNumber?: number;
    absoluteEpisodeNumber?: number;
    title: string;
    thumbnail?: string;
    overview?: string;
    airDate?: string | null;
    runtime?: number;
}

export interface AnimeMetadataPayload {
    anilistId?: number;
    malId?: number;
    tmdbId?: number;
    tvdbId?: number;
    episodes: Map<number, EpisodeMeta>;
    absoluteEpisodes: Map<number, EpisodeMeta>;
}

interface SerializedMetadataPayload {
    timestamp: number;
    anilistId?: number;
    malId?: number;
    tmdbId?: number;
    tvdbId?: number;
    episodes: Array<[number, EpisodeMeta]>;
    absoluteEpisodes: Array<[number, EpisodeMeta]>;
}

const CACHE_PREFIX = 'yorumi_anizip_ep_meta_v1';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const memoryCache = new Map<string, AnimeMetadataPayload>();
const inFlightRequests = new Map<string, Promise<AnimeMetadataPayload | null>>();

const getCacheKey = (anilistId?: number, malId?: number): string | null => {
    if (anilistId && anilistId > 0) return `al:${anilistId}`;
    if (malId && malId > 0) return `mal:${malId}`;
    return null;
};

const readSessionCache = (key: string): AnimeMetadataPayload | null => {
    try {
        const raw = sessionStorage.getItem(`${CACHE_PREFIX}:${key}`);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as SerializedMetadataPayload;
        if (!parsed || !parsed.timestamp || Date.now() - parsed.timestamp > CACHE_TTL_MS) {
            sessionStorage.removeItem(`${CACHE_PREFIX}:${key}`);
            return null;
        }

        const payload: AnimeMetadataPayload = {
            anilistId: parsed.anilistId,
            malId: parsed.malId,
            tmdbId: parsed.tmdbId,
            tvdbId: parsed.tvdbId,
            episodes: new Map(parsed.episodes || []),
            absoluteEpisodes: new Map(parsed.absoluteEpisodes || []),
        };

        memoryCache.set(key, payload);
        return payload;
    } catch {
        return null;
    }
};

const writeSessionCache = (key: string, payload: AnimeMetadataPayload) => {
    try {
        const serialized: SerializedMetadataPayload = {
            timestamp: Date.now(),
            anilistId: payload.anilistId,
            malId: payload.malId,
            tmdbId: payload.tmdbId,
            tvdbId: payload.tvdbId,
            episodes: Array.from(payload.episodes.entries()),
            absoluteEpisodes: Array.from(payload.absoluteEpisodes.entries()),
        };
        sessionStorage.setItem(`${CACHE_PREFIX}:${key}`, JSON.stringify(serialized));
    } catch {
        // Handle storage quota or privacy mode limitations
    }
};

const resolveBestEpisodeTitle = (rawTitle: any, fallbackNum: number): string => {
    if (typeof rawTitle === 'string' && rawTitle.trim()) {
        const clean = rawTitle.split('<note-split>')[0].trim();
        return clean || `Episode ${fallbackNum}`;
    }

    if (rawTitle && typeof rawTitle === 'object') {
        const en = typeof rawTitle.en === 'string' ? rawTitle.en.trim() : '';
        const romaji = typeof rawTitle['x-jat'] === 'string' ? rawTitle['x-jat'].trim() : (typeof rawTitle.romaji === 'string' ? rawTitle.romaji.trim() : '');
        const ja = typeof rawTitle.ja === 'string' ? rawTitle.ja.trim() : '';
        const de = typeof rawTitle.de === 'string' ? rawTitle.de.trim() : '';
        const fr = typeof rawTitle.fr === 'string' ? rawTitle.fr.trim() : '';
        
        const candidate = en || romaji || ja || de || fr;
        if (candidate) {
            return candidate.split('<note-split>')[0].trim();
        }
    }

    return `Episode ${fallbackNum}`;
};

export const episodeMetadataService = {
    getCachedEpisodeMetadata(anilistId?: number, malId?: number): AnimeMetadataPayload | null {
        const key = getCacheKey(anilistId, malId);
        if (!key) return null;

        const inMemory = memoryCache.get(key);
        if (inMemory) return inMemory;

        return readSessionCache(key);
    },

    async getEpisodeMetadata(anilistId?: number, malId?: number): Promise<AnimeMetadataPayload | null> {
        const key = getCacheKey(anilistId, malId);
        if (!key) return null;

        const cached = this.getCachedEpisodeMetadata(anilistId, malId);
        if (cached) return cached;

        const existingRequest = inFlightRequests.get(key);
        if (existingRequest) return existingRequest;

        const requestPromise = (async (): Promise<AnimeMetadataPayload | null> => {
            const controller = new AbortController();
            const timeoutId = window.setTimeout(() => controller.abort(), 6000);

            try {
                const queryParam = anilistId && anilistId > 0
                    ? `anilist_id=${anilistId}`
                    : `mal_id=${malId}`;
                const res = await fetch(`https://api.ani.zip/mappings?${queryParam}`, {
                    signal: controller.signal,
                    headers: { Accept: 'application/json' },
                });

                if (!res.ok) return null;

                const data = await res.json();
                const rawEpisodes = data?.episodes;
                if (!rawEpisodes || typeof rawEpisodes !== 'object') return null;

                const episodes = new Map<number, EpisodeMeta>();
                const absoluteEpisodes = new Map<number, EpisodeMeta>();

                Object.entries(rawEpisodes).forEach(([key, ep]: [string, any]) => {
                    if (!ep || typeof ep !== 'object') return;

                    const epNum = Number(ep.episodeNumber || ep.episode || key);
                    if (!Number.isFinite(epNum) || epNum <= 0) return;

                    const title = resolveBestEpisodeTitle(ep.title, epNum);
                    const thumbnail = typeof ep.image === 'string' && ep.image.trim() ? ep.image.trim() : undefined;
                    const overview = typeof ep.overview === 'string' && ep.overview.trim() 
                        ? ep.overview.trim() 
                        : (typeof ep.summary === 'string' && ep.summary.trim() ? ep.summary.trim() : undefined);
                    const airDate = typeof ep.airDate === 'string' ? ep.airDate : (typeof ep.airdate === 'string' ? ep.airdate : null);
                    const runtime = Number(ep.runtime || ep.length) || undefined;
                    const seasonNumber = Number(ep.seasonNumber) || undefined;
                    const absEpNum = Number(ep.absoluteEpisodeNumber) || undefined;

                    const meta: EpisodeMeta = {
                        episodeNumber: epNum,
                        seasonNumber,
                        absoluteEpisodeNumber: absEpNum,
                        title,
                        thumbnail,
                        overview,
                        airDate,
                        runtime,
                    };

                    episodes.set(epNum, meta);
                    if (absEpNum && absEpNum > 0) {
                        absoluteEpisodes.set(absEpNum, meta);
                    }
                });

                const rawTmdbId = Number(data?.mappings?.themoviedb_id || data?.mappings?.tmdb_id || 0);
                const rawTvdbId = Number(data?.mappings?.thetvdb_id || 0);

                const payload: AnimeMetadataPayload = {
                    anilistId: Number(data?.mappings?.anilist_id) || anilistId,
                    malId: Number(data?.mappings?.mal_id) || malId,
                    tmdbId: Number.isFinite(rawTmdbId) && rawTmdbId > 0 ? rawTmdbId : undefined,
                    tvdbId: Number.isFinite(rawTvdbId) && rawTvdbId > 0 ? rawTvdbId : undefined,
                    episodes,
                    absoluteEpisodes,
                };

                memoryCache.set(key, payload);
                writeSessionCache(key, payload);

                // If both AniList and MAL IDs are known, cross-cache under both keys
                if (payload.anilistId && payload.malId) {
                    const altKey = anilistId ? `mal:${payload.malId}` : `al:${payload.anilistId}`;
                    memoryCache.set(altKey, payload);
                    writeSessionCache(altKey, payload);
                }

                return payload;
            } catch {
                return null;
            } finally {
                window.clearTimeout(timeoutId);
                inFlightRequests.delete(key);
            }
        })();

        inFlightRequests.set(key, requestPromise);
        return requestPromise;
    },
};

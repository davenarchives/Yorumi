import type { Anime } from '../types/anime';
import { setLocalStorageWithCleanup } from '../utils/localStorageQuota';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
const TOKEN_KEY = 'yorumi_tmdb_read_access_token';
const SETUP_COMPLETE_KEY = 'yorumi_tmdb_setup_complete';
const CACHE_PREFIX = 'yorumi_tmdb_cache_v3';
const CACHE_TTL = 24 * 60 * 60 * 1000;

type CachedValue<T> = {
    expiresAt: number;
    value: T;
};

type TmdbSearchResult = {
    id: number;
    name?: string;
    original_name?: string;
    title?: string;
    original_title?: string;
    first_air_date?: string;
    release_date?: string;
    origin_country?: string[];
    original_language?: string;
    popularity?: number;
    genre_ids?: number[];
    media_type?: string;
    poster_path?: string;
    vote_average?: number;
};

export type TmdbSeason = {
    id: number;
    name: string;
    season_number: number;
    episode_count: number;
    air_date?: string | null;
};

export type TmdbTvDetails = {
    id: number;
    name?: string;
    original_name?: string;
    first_air_date?: string;
    seasons?: TmdbSeason[];
};

type TmdbConfig = {
    images?: Record<string, unknown>;
};

type TmdbTitleDetails = {
    name?: string;
    original_name?: string;
    title?: string;
    original_title?: string;
};

export type TmdbEpisode = {
    id: number;
    name: string;
    overview: string;
    episode_number: number;
    season_number: number;
    still_path?: string | null;
    air_date?: string | null;
};

export type TmdbSeasonDetails = {
    _id: string;
    air_date: string;
    episodes: TmdbEpisode[];
    name: string;
    overview: string;
    id: number;
    poster_path: string | null;
    season_number: number;
};

type ValidateResult =
    | { ok: true }
    | { ok: false; reason: 'invalid_token' | 'forbidden' | 'timeout' | 'unreachable' | 'tmdb_error'; status?: number };

const memoryCache = new Map<string, CachedValue<unknown>>();

const buildTmdbImageUrl = (path?: string | null, size = 'w300') => {
    const cleanPath = String(path || '').trim();
    if (!cleanPath) return '';
    if (/^https?:\/\//i.test(cleanPath)) return cleanPath;
    return `${TMDB_IMAGE_BASE}/${size}${cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`}`;
};

const encodeCacheKey = (key: string) => `${CACHE_PREFIX}:${encodeURIComponent(key)}`;

const readCachedValue = <T>(cacheKey: string): T | null => {
    const cached = memoryCache.get(cacheKey) as CachedValue<T> | undefined;
    if (cached && Date.now() < cached.expiresAt) return cached.value;
    if (cached) memoryCache.delete(cacheKey);

    try {
        const raw = localStorage.getItem(encodeCacheKey(cacheKey));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as CachedValue<T>;
        if (!parsed || Date.now() >= Number(parsed.expiresAt || 0)) {
            localStorage.removeItem(encodeCacheKey(cacheKey));
            return null;
        }
        memoryCache.set(cacheKey, parsed);
        return parsed.value;
    } catch {
        return null;
    }
};

const writeCachedValue = <T>(cacheKey: string, value: T, ttl = CACHE_TTL) => {
    const payload: CachedValue<T> = { value, expiresAt: Date.now() + ttl };
    memoryCache.set(cacheKey, payload);
    try {
        setLocalStorageWithCleanup(encodeCacheKey(cacheKey), JSON.stringify(payload));
    } catch {
        // Keep the memory cache even if browser storage is unavailable or full.
    }
};

const normalizeTitle = (value: unknown) =>
    String(value || '')
        .toLowerCase()
        .replace(/\bseason\s*\d+\b/gi, ' ')
        .replace(/\b\d+(st|nd|rd|th)\s*season\b/gi, ' ')
        .replace(/\bcour\s*\d+\b/gi, ' ')
        .replace(/\bpart\s*\d+\b/gi, ' ')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, '');

const getYear = (value: unknown) => {
    const match = String(value || '').match(/\b(19|20)\d{2}\b/);
    return match ? Number(match[0]) : 0;
};

const readToken = () => {
    try {
        return localStorage.getItem(TOKEN_KEY)?.trim() || '';
    } catch {
        return '';
    }
};

const hasCompletedSetup = () => {
    try {
        return localStorage.getItem(SETUP_COMPLETE_KEY) === 'true';
    } catch {
        return false;
    }
};

const markSetupComplete = () => {
    try {
        localStorage.setItem(SETUP_COMPLETE_KEY, 'true');
    } catch {
        // Non-persistent storage can still continue for this session.
    }
};

const writeToken = (token: string) => {
    localStorage.setItem(TOKEN_KEY, token.trim());
    markSetupComplete();
    memoryCache.clear();
};

const buildSignal = (timeoutMs: number) => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    return { signal: controller.signal, cleanup: () => window.clearTimeout(timeout) };
};

const tmdbFetch = async <T>(path: string, token = readToken()): Promise<T> => {
    if (!token) throw new Error('TMDB token missing');

    const cacheKey = `${token}:${path}`;
    const cached = readCachedValue<T>(cacheKey);
    if (cached) return cached;

    const { signal, cleanup } = buildSignal(8000);
    try {
        const res = await fetch(`${TMDB_BASE}${path}`, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
            },
            signal,
        });

        if (!res.ok) throw new Error(`TMDB ${res.status}`);

        const value = await res.json() as T;
        writeCachedValue(cacheKey, value);
        return value;
    } finally {
        cleanup();
    }
};

const scoreCandidate = (candidate: TmdbSearchResult, titleTokens: string[], targetYear: number) => {
    const candidateTitles = [candidate.name, candidate.original_name].map(normalizeTitle).filter(Boolean);
    let score = Number(candidate.popularity || 0) / 100;

    for (const target of titleTokens) {
        for (const title of candidateTitles) {
            if (title === target) score += 100;
            else if (title.includes(target) || target.includes(title)) score += 45;
        }
    }

    const year = getYear(candidate.first_air_date);
    if (targetYear && year) score += Math.max(0, 30 - Math.abs(year - targetYear) * 6);
    if (candidate.origin_country?.includes('JP') || candidate.original_language === 'ja') score += 80;
    
    // Yorumi is an anime app; heavily boost Animation genre (16) to prevent live-action dramas from winning
    if (candidate.genre_ids?.includes(16)) score += 200;

    return score;
};

const getAnimeTitles = (anime: Anime) => [
    anime.title_english,
    anime.title_romaji,
    anime.title,
    anime.title_japanese,
    ...(anime.synonyms || []),
].map((title) => String(title || '').trim()).filter(Boolean);

const getSeededTmdbId = (anime: Anime) => {
    const seeded = (anime as Anime & { tmdbId?: unknown; tmdb_id?: unknown }).tmdbId
        ?? (anime as Anime & { tmdbId?: unknown; tmdb_id?: unknown }).tmdb_id;
    const parsed = Number(seeded);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const getAnimeDetailsCacheKey = (anime: Anime) => {
    const ids = [anime.id, anime.mal_id, getSeededTmdbId(anime)].filter(Boolean).join(':');
    const titles = getAnimeTitles(anime).slice(0, 4).join('|');
    return `anime-details:${ids}:${anime.year || ''}:${titles}`;
};

const resolveTvDetails = async (anime: Anime): Promise<TmdbTvDetails | null> => {
    if (String(anime.type || '').toUpperCase() === 'MOVIE') return null;
    const detailsCacheKey = getAnimeDetailsCacheKey(anime);
    const cachedDetails = readCachedValue<TmdbTvDetails | null>(detailsCacheKey);
    if (cachedDetails) return cachedDetails;

    const seededTmdbId = getSeededTmdbId(anime);
    if (seededTmdbId) {
        const details = await tmdbFetch<TmdbTvDetails>(`/tv/${seededTmdbId}?language=en-US`).catch(() => null);
        writeCachedValue(detailsCacheKey, details);
        return details;
    }

    const titles = getAnimeTitles(anime);
    const titleTokens = [...new Set(titles.map(normalizeTitle).filter(Boolean))];
    if (titleTokens.length === 0) return null;

    const targetYear = Number(anime.year || 0);
    const queries = [...new Set(titles.slice(0, 4).map((title) => title
        .replace(/\bseason\s*\d+\b/gi, ' ')
        .replace(/\b\d+(st|nd|rd|th)\s*season\b/gi, ' ')
        .replace(/\bcour\s*\d+\b/gi, ' ')
        .replace(/\bpart\s*\d+\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    ).filter(Boolean))];

    const candidates: TmdbSearchResult[] = [];
    for (const query of queries) {
        const params = new URLSearchParams({ query, include_adult: 'false', language: 'en-US' });
        // Removed strict `first_air_date_year` filtering so we can find parent franchises that started years earlier
        const result = await tmdbFetch<{ results?: TmdbSearchResult[] }>(`/search/tv?${params.toString()}`).catch(() => null);
        candidates.push(...(result?.results || []));
    }

    const best = candidates
        .filter((candidate, index, array) => array.findIndex((item) => item.id === candidate.id) === index)
        .sort((a, b) => scoreCandidate(b, titleTokens, targetYear) - scoreCandidate(a, titleTokens, targetYear))[0];

    if (!best) return null;

    const details = await tmdbFetch<TmdbTvDetails>(`/tv/${best.id}?language=en-US`).catch(() => null);
    writeCachedValue(detailsCacheKey, details);
    return details;
};

export const tmdbService = {
    getToken: readToken,

    imgUrl(path?: string | null, size = 'w300') {
        return buildTmdbImageUrl(path, size);
    },

    hasToken() {
        return Boolean(readToken());
    },

    hasCompletedSetup() {
        return hasCompletedSetup();
    },

    completeSetupWithoutToken() {
        markSetupComplete();
    },

    saveToken(token: string) {
        writeToken(token);
    },

    async validateToken(token: string): Promise<ValidateResult> {
        const trimmed = token.trim();
        if (!trimmed) return { ok: false, reason: 'invalid_token' };

        const { signal, cleanup } = buildSignal(7000);
        try {
            const config = await fetch(`${TMDB_BASE}/configuration`, {
                headers: { Authorization: `Bearer ${trimmed}`, Accept: 'application/json' },
                signal,
            });

            if (config.status === 401) return { ok: false, reason: 'invalid_token' };
            if (config.status === 403) return { ok: false, reason: 'forbidden' };
            if (!config.ok) return { ok: false, reason: 'tmdb_error', status: config.status };

            await config.json() as TmdbConfig;
            return { ok: true };
        } catch (error) {
            const name = error instanceof Error ? error.name : '';
            return { ok: false, reason: name === 'AbortError' ? 'timeout' : 'unreachable' };
        } finally {
            cleanup();
        }
    },

    async getTvDetailsForAnime(anime: Anime): Promise<TmdbTvDetails | null> {
        return resolveTvDetails(anime);
    },

    async getTvSeasonsForAnime(anime: Anime): Promise<TmdbSeason[]> {
        const details = await resolveTvDetails(anime);
        return (details?.seasons || []).filter((season) => Number(season.season_number) > 0);
    },

    getCachedTvSeasonEpisodes(tmdbId: string | number, seasonNumber: number): TmdbEpisode[] | null {
        const token = readToken();
        if (!token || !tmdbId || !seasonNumber) return null;
        const path = `/tv/${tmdbId}/season/${seasonNumber}?language=en-US`;
        const seasonData = readCachedValue<TmdbSeasonDetails>(`${token}:${path}`);
        return seasonData?.episodes || null;
    },

    async getTvSeasonEpisodes(tmdbId: string | number, seasonNumber: number): Promise<TmdbEpisode[]> {
        if (!tmdbId || !seasonNumber) return [];
        const seasonData = await tmdbFetch<TmdbSeasonDetails>(`/tv/${tmdbId}/season/${seasonNumber}?language=en-US`).catch(() => null);
        return seasonData?.episodes || [];
    },

    async searchMulti(query: string): Promise<TmdbSearchResult[]> {
        const params = new URLSearchParams({ query, include_adult: 'false', language: 'en-US' });
        const result = await tmdbFetch<{ results?: TmdbSearchResult[] }>(`/search/multi?${params.toString()}`).catch(() => null);
        return (result?.results || []).filter((r) => r.media_type !== 'person');
    },

    async resolveAbsoluteEpisode(tmdbId: string | number, absoluteEpisode: number): Promise<{ season_number: number; episode_number: number } | null> {
        const details = await tmdbFetch<TmdbTvDetails>(`/tv/${tmdbId}?language=en-US`).catch(() => null);
        if (!details || !details.seasons) return null;

        let remaining = absoluteEpisode;
        const validSeasons = details.seasons.filter(s => s.season_number > 0).sort((a, b) => a.season_number - b.season_number);

        for (const season of validSeasons) {
            if (remaining <= season.episode_count) {
                return { season_number: season.season_number, episode_number: remaining };
            }
            remaining -= season.episode_count;
        }
        return null;
    },

    async resolveTvEpisodeThumbnails(tmdbId: string | number): Promise<Map<number, string>> {
        const map = new Map<number, string>();
        const details = await tmdbFetch<TmdbTvDetails>(`/tv/${tmdbId}?language=en-US`).catch(() => null);
        if (!details || !details.seasons) return map;

        const validSeasons = details.seasons.filter(s => s.season_number > 0).sort((a, b) => a.season_number - b.season_number);
        let absoluteCounter = 1;

        for (const season of validSeasons) {
            const seasonData = await tmdbFetch<TmdbSeasonDetails>(`/tv/${tmdbId}/season/${season.season_number}?language=en-US`).catch(() => null);
            if (seasonData && seasonData.episodes) {
                const sortedEps = [...seasonData.episodes].sort((a, b) => a.episode_number - b.episode_number);
                for (const ep of sortedEps) {
                    if (ep.still_path) {
                        map.set(absoluteCounter, buildTmdbImageUrl(ep.still_path, 'w780'));
                    }
                    absoluteCounter++;
                }
            } else {
                absoluteCounter += season.episode_count;
            }
        }
        return map;
    },

    isAnimeContent(item: TmdbSearchResult): boolean {
        const lang = item.original_language;
        const countries = item.origin_country || [];
        const genreIds = item.genre_ids || [];
        const hasAnimation = genreIds.includes(16);
        return hasAnimation && (lang === 'ja' || countries.includes('JP'));
    }
};

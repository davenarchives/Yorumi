// API Service for Anime operations - Using AniList
import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";
import axios from "axios";
import type { Anime } from "../types/anime";
import { db, isFirebaseEnabled } from "./firebase";
import { API_BASE } from "../config/api";
import { getDisplayImageUrl } from "../utils/image";
import { isSupportedScraperSessionId } from "../utils/animeNavigation";
import { setLocalStorageWithCleanup } from "../utils/localStorageQuota";

const apiClient = axios.create({
    baseURL: API_BASE,
    timeout: 12000,
});

const API_ORIGIN = API_BASE.replace(/\/+$/, '').replace(/\/api$/i, '');
const normalizeProxyUrl = (url?: string) => {
    if (!url || typeof url !== 'string') return url;
    if (/^https?:\/\//i.test(url)) return url;
    if (url.startsWith('/api/')) return `${API_ORIGIN}${url}`;
    return url;
};
const isKwikUrl = (url?: string) => /^https?:\/\/([^/]+\.)?kwik\./i.test(String(url || ''));
const normalizeStreamUrl = (item: { url?: string; server?: string }) => {
    const url = normalizeProxyUrl(item?.url);
    const server = String(item?.server || '').trim().toLowerCase();
    if (String(url || '').includes('/api/scraper/embed')) return url;
    if (server === 'kwik' || isKwikUrl(url)) {
        return `${API_ORIGIN}/api/scraper/embed?url=${encodeURIComponent(String(url || ''))}`;
    }
    return url;
};
const extractScraperIdFromLink = (link?: string) => {
    const raw = String(link || '').trim();
    if (!raw) return '';
    return raw
        .replace(/^https?:\/\/[^/]+/i, '')
        .replace(/^\/+/, '')
        .split('?')[0]
        .trim();
};
const extractAniKaiScraperId = (value?: string) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    return raw
        .replace(/^https?:\/\/[^/]+/i, '')
        .replace(/^\/+/, '')
        .replace(/^watch\//i, '')
        .replace(/^\/watch\//i, '')
        .split('?')[0]
        .trim();
};
const extractAnimePaheSession = (value: unknown) => {
    const raw = String(value || '').trim();
    const normalized = raw.startsWith('s:') ? raw.slice(2) : raw;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalized)
        ? normalized
        : '';
};
const extractSupportedScraperSession = (value: unknown) => {
    const raw = String(value || '').trim();
    const normalized = raw
        .replace(/^s:/i, '')
        .replace(/^https?:\/\/[^/]+/i, '')
        .replace(/^\/+/, '')
        .replace(/^watch\//i, '')
        .split(/[?#]/)[0]
        .trim();
    return isSupportedScraperSessionId(normalized) ? normalized : '';
};
const getExpectedEpisodeCount = (anime?: Partial<Anime> | null) => {
    const latestEpisode = Number(anime?.latestEpisode || 0);
    if (latestEpisode > 0) return latestEpisode;

    const status = String(anime?.status || '').toUpperCase();
    if (status === 'RELEASING') return 0;

    return Number(anime?.episodes || 0);
};
type LatestUpdatesResult = { data: Anime[] };
type LatestUpdatesPageResult = {
    data: Anime[];
    pagination: {
        last_visible_page: number;
        current_page: number;
        has_next_page: boolean;
    };
};
const hasSufficientEpisodePayload = (anime: Partial<Anime> | null | undefined, payload: any) => {
    const episodes = Array.isArray(payload?.episodes) ? payload.episodes : [];
    if (episodes.length === 0) return false;
    const expectedEpisodes = getExpectedEpisodeCount(anime);
    if (expectedEpisodes > 0 && episodes.length < expectedEpisodes) return false;
    return true;
};

export function parseStudios(studiosInput: any): { name: string; mal_id: number }[] {
    if (!studiosInput) return [];
    if (typeof studiosInput === 'object' && !Array.isArray(studiosInput)) {
        const edges = Array.isArray(studiosInput.edges) ? studiosInput.edges : [];
        if (edges.length > 0) {
            const mainEdges = edges.filter((e: any) => e.isMain);
            const targetEdges = mainEdges.length > 0 ? mainEdges : edges;
            return targetEdges.map((e: any) => ({
                name: String(e?.node?.name || '').trim(),
                mal_id: 0
            })).filter((s: any) => Boolean(s.name) && s.name !== 'undefined');
        }
        const nodes = Array.isArray(studiosInput.nodes) ? studiosInput.nodes : [];
        if (nodes.length > 0) {
            return nodes.map((s: any) => ({
                name: typeof s === 'string' ? s.trim() : String(s?.name || '').trim(),
                mal_id: 0
            })).filter((s: any) => Boolean(s.name) && s.name !== 'undefined');
        }
    }
    if (Array.isArray(studiosInput)) {
        return studiosInput.map((s) => {
            if (typeof s === 'string') return { name: s.trim(), mal_id: 0 };
            if (s && typeof s === 'object') {
                const name = String(s.name || s.node?.name || '').trim();
                return { name, mal_id: Number(s.mal_id || 0) };
            }
            return { name: String(s || '').trim(), mal_id: 0 };
        }).filter((s) => Boolean(s.name) && s.name !== 'undefined');
    }
    if (typeof studiosInput === 'string') {
        return [{ name: studiosInput.trim(), mal_id: 0 }];
    }
    return [];
}

// Helper to map AniList response to our Anime interface format
const mapAnilistToAnime = (item: any) => {
    let extractedTitle = 'Unknown';
    if (typeof item.title === 'string') {
        extractedTitle = item.title;
    } else if (item.title && typeof item.title === 'object') {
        extractedTitle = item.title.english || item.title.romaji || item.title.native || item.title.userPreferred || 'Unknown';
    }

    return {
        mal_id: item.idMal || item.id,
        id: item.id,
        title: extractedTitle,
        title_japanese: item.title?.native,
        title_english: item.title?.english,
        title_romaji: item.title?.romaji,
        synonyms: item.synonyms || [],
        images: {
            jpg: {
                image_url: item.coverImage?.large || '',
                large_image_url: item.coverImage?.extraLarge || item.coverImage?.large || ''
            }
        },
        synopsis: item.description?.replace(/<[^>]*>/g, '') || '', // Strip HTML tags
        type: item.format,
        episodes: item.episodes,
        score: item.averageScore ? item.averageScore / 10 : 0,
        status: item.status,
        duration: item.duration ? `${item.duration} min` : undefined,
        rating: item.isAdult ? 'R+ - Mild Nudity' : undefined,
        genres: item.genres?.map((g: string) => ({ name: g, mal_id: 0 })) || [],
        studios: parseStudios(item.studios || item.anilist?.studios),
        year: item.seasonYear || item.startDate?.year || item.season?.year,
        season: typeof item.season === 'string' ? item.season.toLowerCase() : item.season?.quarter?.toLowerCase(),
        aired: {
            from: item.startDate ? `${item.startDate.year}-${item.startDate.month}-${item.startDate.day}` : undefined,
            to: item.endDate ? `${item.endDate.year}-${item.endDate.month}-${item.endDate.day}` : undefined,
            string: item.startDate?.year ? `${typeof item.season === 'string' ? item.season : (item.season?.quarter || '')} ${item.startDate.year}`.trim() : undefined
        },
        anilist_banner_image: item.bannerImage,
        anilist_cover_image: item.coverImage?.extraLarge || item.coverImage?.large,
        countryOfOrigin: item.countryOfOrigin,
        nextAiringEpisode: item.nextAiringEpisode ? {
            episode: item.nextAiringEpisode.episode,
            timeUntilAiring: item.nextAiringEpisode.timeUntilAiring ?? (item.nextAiringEpisode.airingAt ? item.nextAiringEpisode.airingAt - Math.floor(Date.now() / 1000) : 0)
        } : undefined,
        // For ongoing anime, latest episode = next airing episode - 1
        latestEpisode: item.nextAiringEpisode ? item.nextAiringEpisode.episode - 1 : undefined,
        characters: item.characters, // Pass through the characters object directly as logic is handled in component or matches structure
        trailer: item.trailer ? {
            id: item.trailer.id,
            site: item.trailer.site,
            thumbnail: item.trailer.thumbnail
        } : undefined,
        scraperId: extractSupportedScraperSession(item.scraperId) || undefined,
        episodeMetadata: item.streamingEpisodes?.map((e: any) => ({
            title: e.title,
            thumbnail: e.thumbnail,
            url: e.url,
            site: e.site
        })) || [],
        relations: item.relations // Map relations
    };
};

// Helper to map Scraper response to our Anime interface format
const mapScraperToAnime = (item: any) => {
    const score = typeof item.score === 'number' ? item.score : parseFloat(item.score || '0');
    const year = typeof item.year === 'number' ? item.year : parseInt(item.year || '', 10);
    const episodes = typeof item.episodes === 'number' ? item.episodes : parseInt(item.episodes || '', 10);
    const image = getDisplayImageUrl(item.poster || item.image || '');
    const cleanTitle = typeof item.title === 'string' ? item.title.split('<note-split>')[0].trim() : 'Unknown';
    return {
        mal_id: 0,
        id: 0,
        scraperId: item.session || item.scraperId || item.id,
        title: cleanTitle,
        title_english: cleanTitle,
        title_romaji: cleanTitle,
        images: {
            jpg: {
                image_url: image,
                large_image_url: image
            }
        },
        synopsis: '',
        type: item.type || 'TV',
        episodes: Number.isFinite(episodes) ? episodes : null,
        score: Number.isFinite(score) ? score : 0,
        status: item.status || 'Unknown',
        genres: [],
        studios: [],
        year: Number.isFinite(year) ? year : undefined,
        aired: {
            string: Number.isFinite(year) ? String(year) : ''
        }
    };
};

const mapTopTenItemToAnime = (item: any, index: number): Anime => {
    const anime = mapAnilistToAnime(item || {}) as Anime;
    anime.studios = parseStudios(item.studios || item.anilist?.studios || anime.studios);
    const score = typeof item.score === 'number' ? item.score : parseFloat(item.score || '0');
    if (item.poster) {
        const posterUrl = getDisplayImageUrl(item.poster);
        anime.images.jpg.image_url = posterUrl;
        anime.images.jpg.large_image_url = posterUrl;
        anime.anilist_cover_image = posterUrl;
    }
    if (!item.anilist && !item.id) {
        const fallbackId = parseInt(item.dataId || '', 10) || 0;
        anime.id = fallbackId || anime.id || 0;
        anime.mal_id = fallbackId || anime.mal_id || 0;
        anime.title = (typeof item.title === 'string' ? item.title : undefined) || anime.title;
        anime.type = anime.type || 'TV';
        anime.episodes = anime.episodes ?? (item.sub || null);
    }
    anime.score = Number.isFinite(score) && score > 0 ? score : anime.score || 0;
    anime.rating = item.rating || anime.rating;
    if (!anime.mal_id) {
        anime.mal_id = (parseInt(item.dataId || '', 10) || 0) || (index + 1);
    }
    if (item.sub && !anime.latestEpisode) {
        anime.latestEpisode = item.sub;
    }
    if (item.episodes !== undefined && item.episodes !== null && !anime.episodes) {
        anime.episodes = item.episodes;
    }
    if (item.latestEpisode !== undefined && item.latestEpisode !== null && !anime.latestEpisode) {
        anime.latestEpisode = item.latestEpisode;
    }
    if (item.scraperId) {
        anime.scraperId = item.scraperId;
    }
    return anime;
};

const mapLatestUpdateItemToAnime = (item: any): Anime => {
    const anime = item?.id || item?.title
        ? (mapAnilistToAnime(item) as Anime)
        : item?.anilist
            ? (mapAnilistToAnime(item.anilist) as Anime)
            : (mapScraperToAnime(item) as Anime);

    if (item.poster && !item?.anilist) {
        const posterUrl = getDisplayImageUrl(item.poster);
        anime.images.jpg.image_url = posterUrl;
        anime.images.jpg.large_image_url = posterUrl;
        anime.anilist_cover_image = posterUrl;
    }

    if (typeof item.title === 'string') {
        const cleanTitle = item.title.split('<note-split>')[0].trim();
        anime.title = cleanTitle || anime.title;
        anime.title_english = anime.title_english || cleanTitle;
    }
    const cleanJname = item.jname ? item.jname.split('<note-split>')[0].trim() : '';
    anime.title_romaji = cleanJname || anime.title_romaji;
    anime.type = item.type || anime.type || 'TV';
    anime.duration = item.duration || anime.duration;
    const latestImage = item.image || item.snapshot || item.poster;
    if (latestImage) {
        anime.episodeMetadata = [{
            title: item.episodeTitle || `Episode ${item.latestEpisode || item.sub || ''}`.trim(),
            thumbnail: getDisplayImageUrl(latestImage),
            url: item.url || item.link || '',
            site: 'latest',
        }];
    }
    const genericScraperId =
        String(item.scraperId || '').trim() ||
        extractAniKaiScraperId(item.link) ||
        extractAniKaiScraperId(String(anime.scraperId || ''));
    const animePaheSession =
        extractAnimePaheSession(item.animePaheSession) ||
        extractAnimePaheSession(item.animepaheSession) ||
        extractAnimePaheSession(genericScraperId) ||
        extractAnimePaheSession(extractScraperIdFromLink(item.link)) ||
        extractAnimePaheSession(anime.scraperId);
    if (animePaheSession) {
        anime.scraperId = animePaheSession;
    } else if (genericScraperId) {
        anime.scraperId = genericScraperId;
    } else {
        delete anime.scraperId;
    }

    if (item.latestEpisode && !anime.latestEpisode) {
        anime.latestEpisode = item.latestEpisode;
    }
    if (item.sub && !anime.latestEpisode) {
        anime.latestEpisode = item.sub;
    }

    const resolvedAniListId = Number(item.id || 0);
    const resolvedMalId = Number(item.mal_id || item.id || 0);

    if (!anime.id && resolvedAniListId > 0) {
        anime.id = resolvedAniListId;
    }
    if (!anime.mal_id && resolvedMalId > 0) {
        anime.mal_id = resolvedMalId;
    }

    return anime;
};

const isDeadLatestUpdateImage = (value: unknown): boolean => {
    const raw = String(value || '').trim();
    if (!raw) return true;
    const decoded = (() => {
        try {
            return decodeURIComponent(raw);
        } catch {
            return raw;
        }
    })();
    return /\/mcovers\/a_tbs\/dhw\//i.test(decoded);
};

const hasUsableLatestUpdateSourceImage = (item: any): boolean => {
    if (item?.anilist?.coverImage?.large || item?.anilist?.coverImage?.extraLarge) return true;
    const image = item?.poster || item?.image || item?.snapshot || item?.banner;
    return !isDeadLatestUpdateImage(image);
};

const hasUsableLatestUpdateAnimeImage = (anime: Anime): boolean => {
    const image = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || anime.anilist_cover_image;
    return !isDeadLatestUpdateImage(image);
};

const hasAvailableEpisodes = (anime: Anime) => {
    const latestEpisode = Number(anime.latestEpisode || 0);
    const totalEpisodes = Number(anime.episodes || 0);
    return latestEpisode > 0 || totalEpisodes > 0;
};

const isReleasedTrendingAnime = (anime: Anime) => {
    const status = String(anime.status || '').toUpperCase();
    if (status === 'NOT_YET_RELEASED') return false;
    return hasAvailableEpisodes(anime);
};

// Simple in-memory cache
const cache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const DETAIL_CACHE_TTL = 15 * 60 * 1000; // 15 minutes for anime details + episodes
const streamCache = new Map<string, { data: any, timestamp: number }>();
const STREAM_CACHE_TTL = 20 * 60 * 1000; // 20 minutes
const mappingCache = new Map<string, string>();
const scraperSearchCache = new Map<string, { data: any[]; timestamp: number }>();
const SCRAPER_SEARCH_TTL = 5 * 60 * 1000;
const AZ_LIST_CACHE_TTL = 10 * 60 * 1000;
const PERSISTED_CACHE_PREFIX = 'yorumi_api_cache_v8';
const STREAM_CACHE_VERSION = 'v14';
const PERSISTED_STREAM_CACHE_PREFIX = `yorumi_stream_cache_${STREAM_CACHE_VERSION}`;

const readPersistedCache = (key: string, ttl: number) => {
    try {
        const raw = localStorage.getItem(`${PERSISTED_CACHE_PREFIX}:${key}`);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { data: any; timestamp: number };
        if (!parsed || typeof parsed.timestamp !== 'number') return null;
        if (Date.now() - parsed.timestamp > ttl) {
            localStorage.removeItem(`${PERSISTED_CACHE_PREFIX}:${key}`);
            return null;
        }
        return parsed.data;
    } catch {
        return null;
    }
};

const writePersistedCache = (key: string, data: any, timestamp: number) => {
    try {
        setLocalStorageWithCleanup(
            `${PERSISTED_CACHE_PREFIX}:${key}`,
            JSON.stringify({ data, timestamp })
        );
    } catch {
        // Ignore quota/storage errors.
    }
};

const getCached = (key: string, customTtl?: number) => {
    if (cache.has(key)) {
        const entry = cache.get(key)!;
        const ttl = customTtl ?? CACHE_TTL;
        if (Date.now() - entry.timestamp < ttl) {
            return entry.data;
        }
        cache.delete(key);
    }
    const persisted = readPersistedCache(key, customTtl ?? CACHE_TTL);
    if (persisted) {
        cache.set(key, { data: persisted, timestamp: Date.now() });
        return persisted;
    }
    return null;
};

const setCache = (key: string, data: any, _customTtl?: number) => {
    const timestamp = Date.now();
    cache.set(key, { data, timestamp });
    writePersistedCache(key, data, timestamp);
};

const clearCacheEntry = (key: string) => {
    cache.delete(key);
    try {
        localStorage.removeItem(`${PERSISTED_CACHE_PREFIX}:${key}`);
    } catch {
        // Ignore storage errors.
    }
};
const getStaleCached = (key: string) => {
    if (cache.has(key)) {
        return cache.get(key)!.data;
    }
    try {
        const raw = localStorage.getItem(`${PERSISTED_CACHE_PREFIX}:${key}`);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { data: any; timestamp: number };
        return parsed?.data ?? null;
    } catch {
        return null;
    }
};

const getCachedStream = (key: string) => {
    if (streamCache.has(key)) {
        const entry = streamCache.get(key)!;
        if (Date.now() - entry.timestamp < STREAM_CACHE_TTL) {
            return entry.data;
        }
        streamCache.delete(key);
    }
    try {
        const raw = sessionStorage.getItem(`${PERSISTED_STREAM_CACHE_PREFIX}:${key}`);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { data: any; timestamp: number };
        if (!parsed || typeof parsed.timestamp !== 'number') return null;
        if (Date.now() - parsed.timestamp >= STREAM_CACHE_TTL) {
            sessionStorage.removeItem(`${PERSISTED_STREAM_CACHE_PREFIX}:${key}`);
            return null;
        }
        streamCache.set(key, { data: parsed.data, timestamp: parsed.timestamp });
        return parsed.data;
    } catch {
        return null;
    }
    return null;
};

const setCachedStream = (key: string, data: any) => {
    const timestamp = Date.now();
    streamCache.set(key, { data, timestamp });
    try {
        sessionStorage.setItem(
            `${PERSISTED_STREAM_CACHE_PREFIX}:${key}`,
            JSON.stringify({ data, timestamp })
        );
    } catch {
        // Ignore storage quota issues.
    }
};

const clearCachedStream = (key: string) => {
    streamCache.delete(key);
    try {
        sessionStorage.removeItem(`${PERSISTED_STREAM_CACHE_PREFIX}:${key}`);
    } catch {
        // Ignore storage errors.
    }
};

const getAnimeDetailsCacheKey = (id: number | string) => `anime-details:v7:${id}`;
const getAnimeDetailsFastCacheKey = (id: number | string) => `anime-details-fast:v16:${id}`;
const normalizeStreamLookupPart = (value: unknown) =>
    String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

const getStreamLookupCacheScope = (options?: {
    provider?: string;
    title?: string;
    titles?: string[];
    year?: string | number;
    format?: string;
}) => {
    const provider = String(options?.provider || '').trim().toLowerCase();
    const format = String(options?.format || '').trim().toUpperCase();
    if (provider !== 'videasy' && format !== 'MOVIE') return '';

    const titleParts = [
        options?.title,
        ...(Array.isArray(options?.titles) ? options.titles : []),
    ]
        .map(normalizeStreamLookupPart)
        .filter(Boolean);

    return [
        provider,
        ...Array.from(new Set(titleParts)),
        normalizeStreamLookupPart(options?.year),
        normalizeStreamLookupPart(format),
    ]
        .filter(Boolean)
        .join(':');
};

const getStreamCacheKey = (animeSession: string, episodeSession: string, provider = 'auto') =>
    `streams:${STREAM_CACHE_VERSION}:${provider}:${animeSession}:${episodeSession}`;
const isAnimePaheOnlyStream = (item: any) => {
    const provider = String(item?.provider || '').trim().toLowerCase();
    return !provider || provider === 'animepahe';
};
const normalizeAZListLetter = (letter: string) => {
    const rawLetter = String(letter || 'All').trim();
    if (!rawLetter || rawLetter.toLowerCase() === 'all') {
        return 'All';
    }
    if (rawLetter === '#') {
        return '#';
    }
    return rawLetter.toUpperCase();
};
const fetchJsonWithTimeout = async (url: string, init: RequestInit = {}, timeoutMs = 2500) => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { ...init, signal: controller.signal });
        return res;
    } finally {
        window.clearTimeout(timeoutId);
    }
};

// Track in-flight requests to prevent duplicates
const inFlightRequests = new Map<string, Promise<any>>();
export const animeService = {
    peekAnimeDetailsCache(id: number | string) {
        return getCached(getAnimeDetailsCacheKey(id), DETAIL_CACHE_TTL);
    },

    peekAnimeDetailsFastCache(id: number | string) {
        return getCached(getAnimeDetailsFastCacheKey(id), DETAIL_CACHE_TTL);
    },

    async getHomeFastData() {
        const cacheKey = 'home-fast-data-v29';
        const cached = getCached(cacheKey, DETAIL_CACHE_TTL);
        if (cached) return cached;

        if (inFlightRequests.has(cacheKey)) {
            return inFlightRequests.get(cacheKey);
        }

        const fetchPromise = (async () => {
            try {
                const res = await fetchJsonWithTimeout(`${API_BASE}/anime/home-fast`, {}, 6000);
                if (!res.ok) {
                    throw new Error(`Failed to fetch fast home data: ${res.statusText}`);
                }
                const payload = await res.json();

                const spotlightAnime = Array.isArray(payload?.spotlight)
                    ? payload.spotlight.map((item: any) => {
                        const anime = item?.id || item?.title?.romaji || item?.title?.english || item?.coverImage
                            ? (mapAnilistToAnime(item) as Anime)
                            : item?.anilist
                                ? (mapAnilistToAnime(item.anilist) as Anime)
                                : (mapScraperToAnime(item) as Anime);
                        anime.anilist_banner_image = item.banner || anime.anilist_banner_image;
                        if (item.poster) {
                            const posterUrl = getDisplayImageUrl(item.poster);
                            anime.images.jpg.image_url = posterUrl;
                            anime.images.jpg.large_image_url = posterUrl;
                            anime.anilist_cover_image = posterUrl;
                        }
                        const cleanTitle = typeof item.title === 'string' ? item.title.split('<note-split>')[0].trim() : '';
                        const cleanJname = typeof item.jname === 'string' ? item.jname.split('<note-split>')[0].trim() : '';
                        anime.title = cleanTitle || anime.title;
                        anime.title_romaji = cleanJname || anime.title_romaji;
                        anime.title_english = anime.title_english || cleanTitle;
                        anime.type = item.type || anime.type || 'TV';
                        anime.synopsis = anime.synopsis || item.description || '';
                        anime.trailer = anime.trailer || item.trailer;
                        if (item.scraperId) anime.scraperId = item.scraperId;
                        return anime;
                    })
                    : [];

                const result = {
                    spotlightAnime,
                    latestUpdates: Array.isArray(payload?.latestEpisodes)
                        ? payload.latestEpisodes.map(mapLatestUpdateItemToAnime)
                        : [],
                    trendingAnime: (payload?.trending?.media?.map(mapTopTenItemToAnime) || []).filter(isReleasedTrendingAnime),
                    popularSeason: payload?.seasonal?.media?.map(mapTopTenItemToAnime) || [],
                    popularMonth: payload?.monthly?.media?.map(mapTopTenItemToAnime) || [],
                    topAnime: payload?.topAnime?.media?.map(mapTopTenItemToAnime) || [],
                    topAnimePagination: {
                        last_visible_page: payload?.topAnime?.pageInfo?.lastPage || 1,
                        current_page: payload?.topAnime?.pageInfo?.currentPage || 1,
                        has_next_page: payload?.topAnime?.pageInfo?.hasNextPage || false,
                    },
                    topTenToday: Array.isArray(payload?.topTen?.day) ? payload.topTen.day.map(mapTopTenItemToAnime) : [],
                    topTenWeek: Array.isArray(payload?.topTen?.week) ? payload.topTen.week.map(mapTopTenItemToAnime) : [],
                    topTenMonth: Array.isArray(payload?.topTen?.month) ? payload.topTen.month.map(mapTopTenItemToAnime) : [],
                };

                setCache(cacheKey, result, DETAIL_CACHE_TTL);
                return result;
            } finally {
                inFlightRequests.delete(cacheKey);
            }
        })();

        inFlightRequests.set(cacheKey, fetchPromise);
        return fetchPromise;
    },

    peekTopAnime(page: number = 1, format?: string) {
        const cacheKey = `top-anime-${page}-${format ?? 'all'}`;
        return getCached(cacheKey);
    },

    prefetchTopAnimeFormats() {
        const formats: Array<string | undefined> = [undefined, 'MOVIE', 'TV', 'OVA', 'ONA', 'SPECIAL'];
        Promise.allSettled(formats.map((format) => this.getTopAnime(1, format))).catch(() => undefined);
    },

    async getLatestUpdates(): Promise<LatestUpdatesResult> {
        const cacheKey = 'animepahe-card-latest-updates-v7';
        const cached = getCached(cacheKey, DETAIL_CACHE_TTL);
        if (cached) return cached;
        const staleCached = getStaleCached(cacheKey);

        if (inFlightRequests.has(cacheKey)) {
            return inFlightRequests.get(cacheKey);
        }

        const fetchPromise: Promise<LatestUpdatesResult> = (async () => {
            try {
                const res = await fetchJsonWithTimeout(`${API_BASE}/scraper/recently-updated?page=1&limit=18`, {}, 8000);
                if (!res.ok) {
                    throw new Error(`Failed to fetch latest updates: ${res.statusText}`);
                }

                const payload = await res.json();
                const result: LatestUpdatesResult = {
                    data: Array.isArray(payload?.data)
                        ? payload.data
                            .filter(hasUsableLatestUpdateSourceImage)
                            .map(mapLatestUpdateItemToAnime)
                            .filter(hasUsableLatestUpdateAnimeImage)
                        : []
                };

                if (result.data.length > 0) {
                    setCache(cacheKey, result, DETAIL_CACHE_TTL);
                    return result;
                }

                if (staleCached?.data && Array.isArray(staleCached.data) && staleCached.data.length > 0) {
                    return staleCached;
                }

                return result;
            } catch (err) {
                console.error('getLatestUpdates error:', err);
                if (staleCached?.data && Array.isArray(staleCached.data) && staleCached.data.length > 0) {
                    return staleCached;
                }
                return { data: [] };
            } finally {
                inFlightRequests.delete(cacheKey);
            }
        })();

        inFlightRequests.set(cacheKey, fetchPromise);
        return fetchPromise;
    },

    async getLatestUpdatesPage(page: number = 1, limit: number = 18): Promise<LatestUpdatesPageResult> {
        const cacheKey = `animepahe-card-latest-updates-page-v7-${page}-${limit}`;
        const cached = getCached(cacheKey, DETAIL_CACHE_TTL);
        if (cached) return cached;
        const staleCached = getStaleCached(cacheKey);

        if (inFlightRequests.has(cacheKey)) {
            return inFlightRequests.get(cacheKey);
        }

        const fetchPromise: Promise<LatestUpdatesPageResult> = (async () => {
            try {
                const res = await fetchJsonWithTimeout(
                    `${API_BASE}/scraper/recently-updated?page=${page}&limit=${limit}`,
                    {},
                    8000
                );
                if (!res.ok) {
                    throw new Error(`Failed to fetch latest updates page: ${res.statusText}`);
                }

                const payload = await res.json();
                const result: LatestUpdatesPageResult = {
                    data: Array.isArray(payload?.data)
                        ? payload.data
                            .filter(hasUsableLatestUpdateSourceImage)
                            .map(mapLatestUpdateItemToAnime)
                            .filter(hasUsableLatestUpdateAnimeImage)
                        : [],
                    pagination: {
                        last_visible_page: payload?.pagination?.last_visible_page || 1,
                        current_page: payload?.pagination?.current_page || page,
                        has_next_page: payload?.pagination?.has_next_page || false
                    }
                };

                if (result.data.length > 0) {
                    setCache(cacheKey, result, DETAIL_CACHE_TTL);
                    return result;
                }

                if (staleCached?.data && Array.isArray(staleCached.data) && staleCached.data.length > 0) {
                    return staleCached;
                }

                return result;
            } finally {
                inFlightRequests.delete(cacheKey);
            }
        })();

        inFlightRequests.set(cacheKey, fetchPromise);
        return fetchPromise;
    },

    // Fetch top anime from AniList (Deduplicated)
    async getTopAnime(page: number = 1, format?: string) {
        const cacheKey = `top-anime-${page}-${format ?? 'all'}`;
        const cached = getCached(cacheKey, DETAIL_CACHE_TTL);
        if (cached) return cached;

        // Check for in-flight request
        if (inFlightRequests.has(cacheKey)) {
            return inFlightRequests.get(cacheKey);
        }

        const fetchPromise = (async () => {
            try {
                const formatParam = format ? `&format=${encodeURIComponent(format)}` : '';
                const res = await fetch(`${API_BASE}/anime/popular?page=${page}&limit=18${formatParam}`);
                if (!res.ok) {
                    throw new Error(`Failed to fetch top anime: ${res.statusText}`);
                }
                const data = await res.json();
                const result = {
                    data: (data.media?.map(mapAnilistToAnime) || []).filter(isReleasedTrendingAnime),
                    pagination: {
                        last_visible_page: data.pageInfo?.lastPage || 1,
                        current_page: data.pageInfo?.currentPage || 1,
                        has_next_page: data.pageInfo?.hasNextPage || false
                    }
                };

                if (result.data.length > 0) {
                    setCache(cacheKey, result, DETAIL_CACHE_TTL);
                }
                return result;
            } finally {
                inFlightRequests.delete(cacheKey);
            }
        })();

        inFlightRequests.set(cacheKey, fetchPromise);
        return fetchPromise;
    },

    // Search anime via AniList
    async searchAnime(query: string, page: number = 1, limit: number = 18) {
        const res = await fetch(`${API_BASE}/anime/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`);
        const data = await res.json();
        return {
            data: data.media?.map(mapAnilistToAnime) || [],
            pagination: {
                last_visible_page: data.pageInfo?.lastPage || 1,
                current_page: data.pageInfo?.currentPage || 1,
                has_next_page: data.pageInfo?.hasNextPage || false
            }
        };
    },

    // Search anime on scraper (AnimePahe)
    async searchAnimeScraper(query: string, page: number = 1, limit: number = 18) {
        const normalizedQuery = query.trim().toLowerCase();
        const cacheKey = `scraper-search:${normalizedQuery}`;

        let items = getCached(cacheKey) as any[] | null;
        if (!items) {
            const mem = scraperSearchCache.get(cacheKey);
            if (mem && Date.now() - mem.timestamp < SCRAPER_SEARCH_TTL) {
                items = mem.data;
            }
        }

        if (!items) {
            if (inFlightRequests.has(cacheKey)) {
                items = await inFlightRequests.get(cacheKey);
            } else {
                const fetchPromise = (async () => {
                    const { data } = await apiClient.get('/scraper/search', {
                        params: { q: query },
                    });
                    return Array.isArray(data) ? data : (data?.data || []);
                })()
                    .finally(() => {
                        inFlightRequests.delete(cacheKey);
                    });
                inFlightRequests.set(cacheKey, fetchPromise);
                items = await fetchPromise;
            }

            const fetchedItems = items ?? [];
            items = fetchedItems;
            setCache(cacheKey, fetchedItems);
            scraperSearchCache.set(cacheKey, { data: fetchedItems, timestamp: Date.now() });
        }

        const resolvedItems = items ?? [];
        const safeLimit = Math.max(1, limit);
        const total = resolvedItems.length;
        const lastPage = Math.max(1, Math.ceil(total / safeLimit));
        const currentPage = Math.min(Math.max(page, 1), lastPage);
        const start = (currentPage - 1) * safeLimit;
        const pageItems = resolvedItems.slice(start, start + safeLimit).map(mapScraperToAnime);
        return {
            data: pageItems,
            pagination: {
                last_visible_page: lastPage,
                current_page: currentPage,
                has_next_page: currentPage < lastPage
            }
        };
    },

    // Get A-Z List from AniList.
    async getAZList(letter: string, page: number = 1) {
        const normalizedLetter = normalizeAZListLetter(letter);
        const cacheKey = `anilist-az-list:${normalizedLetter}:${page}`;
        const cached = getCached(cacheKey, AZ_LIST_CACHE_TTL);
        if (cached) return cached;

        if (inFlightRequests.has(cacheKey)) {
            return inFlightRequests.get(cacheKey);
        }

        const fetchPromise = (async () => {
            try {
                const isBroadPage = normalizedLetter === 'All' || normalizedLetter === '#' || normalizedLetter === '0-9';
                const endpoint = isBroadPage
                    ? `${API_BASE}/anime/popular?page=${page}&limit=24`
                    : `${API_BASE}/anime/search?q=${encodeURIComponent(normalizedLetter)}&page=${page}&limit=24`;
                const res = await fetch(endpoint);
                if (!res.ok) {
                    throw new Error(`Failed to fetch A-Z list: ${res.statusText}`);
                }
                const payload = await res.json();
                const media = Array.isArray(payload?.media) ? payload.media : [];

                const result = {
                    data: media.map(mapAnilistToAnime),
                    pagination: {
                        last_visible_page: payload?.pageInfo?.lastPage || page,
                        current_page: payload?.pageInfo?.currentPage || page,
                        has_next_page: payload?.pageInfo?.hasNextPage || false,
                    }
                };

                if (result.data.length > 0) {
                    setCache(cacheKey, result, AZ_LIST_CACHE_TTL);
                }

                return result;
            } catch (error) {
                const stale = getStaleCached(cacheKey);
                if (stale) {
                    return stale;
                }
                throw error;
            } finally {
                inFlightRequests.delete(cacheKey);
            }
        })();

        inFlightRequests.set(cacheKey, fetchPromise);
        return fetchPromise;
    },

    async prefetchAZList(letter: string, page: number = 1) {
        await this.getAZList(letter, page).catch(() => undefined);
    },

    async getAnimeDetails(id: number | string, format?: string) {
        if (typeof id === 'string' && (id.startsWith('s:') || isNaN(Number(id)))) {
            return { data: null };
        }
        const cacheKey = getAnimeDetailsCacheKey(id);
        const cached = getCached(cacheKey, DETAIL_CACHE_TTL);
        if (cached) return cached;
        if (inFlightRequests.has(cacheKey)) {
            return inFlightRequests.get(cacheKey);
        }

        const fetchPromise = (async () => {
            try {
                const formatParam = format ? `&format=${encodeURIComponent(format)}` : '';
                const res = await fetch(`${API_BASE}/anime/metadata?id=${id}${formatParam}`);
                const data = await res.json();
                if (!data || data.error) return { data: null };
                const result = { data: mapAnilistToAnime(data) };
                if (result.data) {
                    setCache(cacheKey, result, DETAIL_CACHE_TTL);
                }
                return result;
            } finally {
                inFlightRequests.delete(cacheKey);
            }
        })();

        inFlightRequests.set(cacheKey, fetchPromise);
        return fetchPromise;
    },

    async getAnimeDetailsFast(id: number | string, format?: string) {
        if (typeof id === 'string' && (id.startsWith('s:') || isNaN(Number(id)))) {
            return { data: null, episodes: [], scraperSession: null };
        }
        const cacheKey = getAnimeDetailsFastCacheKey(id);
        const cached = getCached(cacheKey, DETAIL_CACHE_TTL);
        if (cached) {
            const cachedAnime = (cached as any)?.data as Anime | null | undefined;
            const cachedEpisodes = Array.isArray((cached as any)?.episodes) ? (cached as any).episodes : [];
            const cachedSession = String((cached as any)?.scraperSession || '').trim();
            if (cachedSession && cachedEpisodes.length > 0) {
                return cached;
            }
            if (hasSufficientEpisodePayload(cachedAnime, { episodes: cachedEpisodes })) {
                return cached;
            }
            if (cachedSession && !isSupportedScraperSessionId(cachedSession)) {
                clearCacheEntry(cacheKey);
            }
        }
        if (inFlightRequests.has(cacheKey)) {
            return inFlightRequests.get(cacheKey);
        }

        const fetchPromise = (async () => {
            try {
                const formatParam = format ? `&format=${encodeURIComponent(format)}` : '';
                const res = await fetch(`${API_BASE}/anime/metadata?id=${id}${formatParam}`);
                if (!res.ok) {
                    throw new Error(`Failed to fetch fast anime details: ${res.statusText}`);
                }
                const data = await res.json();
                const mappedAnime = data && !data.error ? (mapAnilistToAnime(data) as Anime) : null;
                
                const result = {
                    data: mappedAnime,
                    episodes: [], // Episodes are handled separately via /anime/episodes in new TMDB flow
                    scraperSession: null, // Anime metadata doesn't hold session in the new pipeline
                };
                if (hasSufficientEpisodePayload(mappedAnime, result)) {
                    setCache(cacheKey, result, DETAIL_CACHE_TTL);
                }
                return result;
            } finally {
                inFlightRequests.delete(cacheKey);
            }
        })();

        inFlightRequests.set(cacheKey, fetchPromise);
        return fetchPromise;
    },

    // Identify AniList ID from Scraper Slug/Title
    async identifyAnime(slug: string, title: string) {
        const res = await fetch(`${API_BASE}/mapping/identify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug, title })
        });
        if (!res.ok) return null;
        return res.json();
    },

    // Search anime on scraper
    async searchScraper(title: string) {
        const { data } = await apiClient.get('/scraper/search', {
            params: { q: title },
        });
        return data;
    },

    async searchAnimePahe(title: string) {
        const normalizedTitle = title.trim().toLowerCase();
        const cacheKey = `animepahe-search:${normalizedTitle}`;
        const cached = getCached(cacheKey, SCRAPER_SEARCH_TTL);
        if (cached) return cached;
        if (inFlightRequests.has(cacheKey)) {
            return inFlightRequests.get(cacheKey);
        }

        const fetchPromise = apiClient.get('/scraper/search/animepahe', {
            params: { q: title },
        })
            .then(({ data }) => {
                if (Array.isArray(data) && data.length > 0) {
                    setCache(cacheKey, data, SCRAPER_SEARCH_TTL);
                }
                return data;
            })
            .finally(() => {
                inFlightRequests.delete(cacheKey);
            });

        inFlightRequests.set(cacheKey, fetchPromise);
        return fetchPromise;
    },

    async searchAllManga(title: string) {
        const normalizedTitle = title.trim().toLowerCase();
        const cacheKey = `allmanga-search:${normalizedTitle}`;
        const cached = getCached(cacheKey, SCRAPER_SEARCH_TTL);
        if (cached) return cached;
        if (inFlightRequests.has(cacheKey)) {
            return inFlightRequests.get(cacheKey);
        }

        const fetchPromise = apiClient.get('/scraper/search/allmanga', {
            params: { q: title },
        })
            .then(({ data }) => {
                if (Array.isArray(data) && data.length > 0) {
                    setCache(cacheKey, data, SCRAPER_SEARCH_TTL);
                }
                return data;
            })
            .finally(() => {
                inFlightRequests.delete(cacheKey);
            });

        inFlightRequests.set(cacheKey, fetchPromise);
        return fetchPromise;
    },

    // Get popular this season from AniList (Deduplicated)
    async getPopularThisSeason(page: number = 1, limit: number = 10) {
        const cacheKey = `popular-season-${page}-${limit}`;
        const cached = getCached(cacheKey, DETAIL_CACHE_TTL);
        if (cached) return cached;

        if (inFlightRequests.has(cacheKey)) {
            return inFlightRequests.get(cacheKey);
        }

        const fetchPromise = (async () => {
            try {
                const res = await fetch(`${API_BASE}/anime/seasonal?page=${page}&limit=${limit}`);
                if (!res.ok) {
                    console.warn(`Failed to fetch popular season: ${res.statusText}`);
                    return { data: [], pagination: null };
                }
                const data = await res.json();
                const result = {
                    data: data.media?.map(mapAnilistToAnime) || [],
                    pagination: {
                        last_visible_page: data.pageInfo?.lastPage || 1,
                        current_page: data.pageInfo?.currentPage || 1,
                        has_next_page: data.pageInfo?.hasNextPage || false
                    }
                };

                if (result.data.length > 0) {
                    setCache(cacheKey, result, DETAIL_CACHE_TTL);
                }
                return result;
            } finally {
                inFlightRequests.delete(cacheKey);
            }
        })();

        inFlightRequests.set(cacheKey, fetchPromise);
        return fetchPromise;
    },


    // Get episodes from scraper. Backend/Redis is the primary cache layer.
    async getEpisodes(session: string, options?: { expectedEpisodes?: number }) {
        const expectedEpisodes = Number(options?.expectedEpisodes || 0);
        const cacheKey = `episodes:v10:${session}:${expectedEpisodes > 0 ? `min-${expectedEpisodes}` : 'any'}`;
        const hasEnoughEpisodes = (payload: any) => {
            const episodes = Array.isArray(payload?.episodes) ? payload.episodes : [];
            if (episodes.length === 0) return false;
            if (expectedEpisodes > 0 && episodes.length < expectedEpisodes) return false;
            return true;
        };
        const cached = getCached(cacheKey, DETAIL_CACHE_TTL);
        if (cached && hasEnoughEpisodes(cached)) return cached;
        if (inFlightRequests.has(cacheKey)) {
            return inFlightRequests.get(cacheKey);
        }

        const CACHE_COLLECTION = "anime_episodes_v7";
        const docRef = db ? doc(db, CACHE_COLLECTION, session) : null;

        const readFirebaseEpisodes = async (timeoutMs: number): Promise<{ episodes: any[] } | null> => {
            if (!isFirebaseEnabled || !docRef) return null;
            try {
                const docSnap = await Promise.race([
                    getDoc(docRef),
                    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
                ]);
                if (!docSnap || !docSnap.exists()) return null;
                const local = docSnap.data();
                if (!Array.isArray(local?.episodes) || local.episodes.length === 0) return null;
                const payload = { episodes: local.episodes };
                if (!hasEnoughEpisodes(payload)) return null;
                return payload;
            } catch (error) {
                console.warn("[AnimeService] Firebase read error:", error);
                return null;
            }
        };

        const fetchFromBackend = async () => {
            const { data } = await apiClient.get('/scraper/episodes', {
                params: {
                    session,
                    ...(expectedEpisodes > 0 ? { expectedEpisodes } : {}),
                },
            });

            if (data?.episodes && Array.isArray(data.episodes) && data.episodes.length > 0) {
                setCache(cacheKey, data, DETAIL_CACHE_TTL);
                // Persist cache asynchronously; don't block the UI.
                if (docRef) {
                    setDoc(docRef, {
                        episodes: data.episodes,
                        lastUpdated: Date.now()
                    }).catch((error) => {
                        console.warn("[AnimeService] Firebase write error:", error);
                    });
                }
            }

            return data;
        };

        const fetchPromise = (async () => {
            const backendPromise = fetchFromBackend();
            try {
                // Fast path: if Firebase has episodes cached, render immediately.
                // Keep backend request running in background to refresh cache.
                const quickFirebase = await readFirebaseEpisodes(350);
                if (quickFirebase) {
                    setCache(cacheKey, quickFirebase, DETAIL_CACHE_TTL);
                    backendPromise.catch(() => undefined);
                    return quickFirebase;
                }

                return await backendPromise;
            } catch (primaryError) {
                // Fallback to Firebase cache if backend request fails.
                const fallback = await readFirebaseEpisodes(1200);
                if (fallback) {
                    setCache(cacheKey, fallback, DETAIL_CACHE_TTL);
                    return fallback;
                }

                throw primaryError;
            } finally {
                inFlightRequests.delete(cacheKey);
            }
        })();

        inFlightRequests.set(cacheKey, fetchPromise);
        return fetchPromise;
    },

    // Get mapping from AniList ID to Scraper Session
    async getAnimeMapping(malId: string | number) {
        const key = String(malId);
        const cached = mappingCache.get(key);
        if (cached) return cached;
        if (!isFirebaseEnabled || !db) return null;

        const docRef = doc(db, "anime_mappings", key);
        try {
            const docSnap = await Promise.race([
                getDoc(docRef),
                new Promise<null>((resolve) => setTimeout(() => resolve(null), 250)),
            ]);
            if (!docSnap) return null;
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.session) {
                    mappingCache.set(key, data.session);
                    return data.session;
                }
            }
        } catch (error) {
            console.warn("[AnimeService] Error fetching mapping:", error);
        }
        return null;
    },

    // Save mapping
    async saveAnimeMapping(malId: string | number, session: string) {
        if (!session) return;
        const key = String(malId);
        mappingCache.set(key, session);
        if (!isFirebaseEnabled || !db) return;
        const docRef = doc(db, "anime_mappings", key);
        try {
            await setDoc(docRef, {
                session,
                lastUpdated: Date.now()
            });
            console.log(`[AnimeService] Saved mapping: ${malId} -> ${session}`);
        } catch (error) {
            console.warn("[AnimeService] Error saving mapping:", error);
        }
    },

    async clearAnimeMapping(malId: string | number) {
        const key = String(malId);
        mappingCache.delete(key);
        if (!isFirebaseEnabled || !db) return;
        const docRef = doc(db, "anime_mappings", key);
        try {
            await deleteDoc(docRef);
        } catch {
            // no-op
        }
    },

    invalidateAnimeDetailsFast(id: number | string) {
        clearCacheEntry(getAnimeDetailsFastCacheKey(id));
    },

    // Get stream links from scraper
    async getStreams(animeSession: string, episodeSession: string, options?: {
        provider?: string;
        title?: string;
        titles?: string[];
        year?: string | number;
        format?: string;
        episodeNumber?: number;
        anilistId?: number;
    }) {
        const provider = String(options?.provider || 'auto').trim().toLowerCase() || 'auto';
        const lookupScope = getStreamLookupCacheScope({ ...options, provider });
        const scopedEpisodeSession = lookupScope ? `${episodeSession}:${lookupScope}` : episodeSession;
        const cacheKey = getStreamCacheKey(animeSession, scopedEpisodeSession, provider);
        const cached = getCachedStream(cacheKey);
        if (cached) return cached;

        if (inFlightRequests.has(cacheKey)) {
            return inFlightRequests.get(cacheKey);
        }

        const fetchPromise = (async () => {
            try {


                const { data } = await apiClient.get('/scraper/streams', {
                    params: {
                        anime_session: animeSession,
                        ep_session: episodeSession,
                        provider,
                        ...(options?.episodeNumber ? { ep_number: options.episodeNumber } : {}),
                        ...(options?.title ? { title: options.title } : {}),
                        ...(Array.isArray(options?.titles) && options.titles.length > 0 ? { alt_titles: options.titles.join('|') } : {}),
                        ...(options?.year ? { year: options.year } : {}),
                        ...(options?.format ? { format: options.format } : {}),
                        ...(options?.anilistId ? { anilist_id: options.anilistId } : {}),
                        _cb: Date.now(),
                    },
                });
                const normalized = Array.isArray(data)
                    ? data.map((item: any) => ({
                        ...item,
                        url: normalizeStreamUrl(item),
                        directUrl: normalizeProxyUrl(item?.directUrl),
                        isHls: (String(item?.server || '').trim().toLowerCase() === 'kwik' || isKwikUrl(item?.url))
                            ? false
                            : item?.isHls,
                        subtitles: Array.isArray(item?.subtitles)
                            ? item.subtitles.map((sub: any) => ({
                                ...sub,
                                url: normalizeProxyUrl(sub?.url),
                            }))
                            : item?.subtitles,
                    }))
                    : data;
                const filtered = Array.isArray(normalized) && (provider === 'auto' || provider === 'animepahe') && extractAnimePaheSession(animeSession)
                    ? normalized.filter((item: any) => isAnimePaheOnlyStream(item))
                    : normalized;
                const resolved = filtered;
                if (Array.isArray(resolved) && resolved.length > 0) {
                    setCachedStream(cacheKey, resolved);
                }
                return resolved;
            } finally {
                inFlightRequests.delete(cacheKey);
            }
        })();

        inFlightRequests.set(cacheKey, fetchPromise);
        return fetchPromise;
    },

    invalidateStreamCache(animeSession: string, episodeSession?: string, provider = 'auto') {
        if (!animeSession) return;

        if (episodeSession) {
            clearCachedStream(getStreamCacheKey(animeSession, episodeSession, provider));
            inFlightRequests.delete(getStreamCacheKey(animeSession, episodeSession, provider));
            const scopedPrefix = `streams:${STREAM_CACHE_VERSION}:${provider}:${animeSession}:${episodeSession}:`;
            Array.from(streamCache.keys())
                .filter((key) => key.startsWith(scopedPrefix))
                .forEach((key) => clearCachedStream(key));
            Array.from(inFlightRequests.keys())
                .filter((key) => key.startsWith(scopedPrefix))
                .forEach((key) => inFlightRequests.delete(key));
            try {
                for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
                    const key = sessionStorage.key(i);
                    if (key && key.startsWith(`${PERSISTED_STREAM_CACHE_PREFIX}:${scopedPrefix}`)) {
                        sessionStorage.removeItem(key);
                    }
                }
            } catch {
                // Ignore storage errors.
            }
            return;
        }

        const prefix = `streams:${STREAM_CACHE_VERSION}:`;
        Array.from(streamCache.keys())
            .filter((key) => key.startsWith(prefix) && key.includes(`:${animeSession}:`))
            .forEach((key) => clearCachedStream(key));
        Array.from(inFlightRequests.keys())
            .filter((key) => key.startsWith(prefix) && key.includes(`:${animeSession}:`))
            .forEach((key) => inFlightRequests.delete(key));
        try {
            for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
                const key = sessionStorage.key(i);
                if (key && key.startsWith(`${PERSISTED_STREAM_CACHE_PREFIX}:${prefix}`)) {
                    sessionStorage.removeItem(key);
                }
            }
        } catch {
            // Ignore storage errors.
        }
    },

    // Get popular this month from AniList (Deduplicated)
    async getPopularThisMonth(page: number = 1, limit: number = 10) {
        const cacheKey = `popular-month-${page}-${limit}`;
        const cached = getCached(cacheKey, DETAIL_CACHE_TTL);
        if (cached) return cached;

        if (inFlightRequests.has(cacheKey)) {
            return inFlightRequests.get(cacheKey);
        }

        const fetchPromise = (async () => {
            try {
                const res = await fetch(`${API_BASE}/anime/popular?page=${page}&limit=${limit}`);
                if (!res.ok) {
                    console.warn(`Failed to fetch popular this month: ${res.statusText}`);
                    return { data: [], pagination: null };
                }
                const data = await res.json();
                const result = {
                    data: data.media?.map(mapAnilistToAnime) || [],
                    pagination: {
                        last_visible_page: data.pageInfo?.lastPage || 1,
                        current_page: data.pageInfo?.currentPage || 1,
                        has_next_page: data.pageInfo?.hasNextPage || false
                    }
                };

                if (result.data.length > 0) {
                    setCache(cacheKey, result, DETAIL_CACHE_TTL);
                }
                return result;
            } finally {
                inFlightRequests.delete(cacheKey);
            }
        })();

        inFlightRequests.set(cacheKey, fetchPromise);
        return fetchPromise;
    },

    async prefetchStreams(animeSession: string, episodeSessions: string[]) {
        const sessions = [...new Set(episodeSessions.filter(Boolean))];
        if (!animeSession || sessions.length === 0) return;

        await fetch(`${API_BASE}/scraper/prefetch/streams`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                anime_session: animeSession,
                ep_sessions: sessions,
            }),
        }).catch(() => undefined);
    },

    async getAnimeStream(tmdbId: number, episode: number, source = 'videasy', title?: string, year?: number | string) {
        let url = `${API_BASE}/anime/stream?tmdbId=${tmdbId}&episode=${episode}&source=${source}`;
        if (title) url += `&title=${encodeURIComponent(title)}`;
        if (year) url += `&year=${year}`;
        const res = await fetchJsonWithTimeout(url, {}, 25000);
        if (!res.ok) throw new Error('Failed to fetch anime stream');
        const data = await res.json();
        return Array.isArray(data) ? data : [data];
    },

    // Wipe the backend in-memory stream cache + all frontend sessionStorage stream entries.
    async clearStreamCache() {
        try {
            await fetch(`${API_BASE}/scraper/clear-stream-cache`, { method: 'POST' });
        } catch { /* ignore if backend unavailable */ }
        try {
            const toDelete: string[] = [];
            for (let i = 0; i < sessionStorage.length; i++) {
                const k = sessionStorage.key(i);
                if (k && k.startsWith('yorumi_stream_cache_')) toDelete.push(k);
            }
            toDelete.forEach(k => sessionStorage.removeItem(k));
        } catch { /* ignore */ }
        streamCache.clear();
    },

    // Get native spotlight anime from TMDB trending pool
    async getSpotlightAnime() {
        try {
            const res = await fetchJsonWithTimeout(`${API_BASE}/anime/trending?limit=8`, {}, 12000);
            if (!res.ok) throw new Error('Failed to fetch spotlight');
            const data = await res.json();
            const spotlight = data?.media || [];

            const processedSpotlight = (spotlight || []).map((item: any) => {
                const anime = (item?.id || item?.title?.romaji || item?.title?.english || item?.coverImage
                    ? mapAnilistToAnime(item)
                    : item?.anilist
                        ? mapAnilistToAnime(item.anilist)
                        : mapScraperToAnime(item)) as Anime;

                anime.anilist_banner_image = item.banner || anime.anilist_banner_image;
                if (item.poster) {
                    const posterUrl = getDisplayImageUrl(item.poster);
                    anime.images.jpg.image_url = posterUrl;
                    anime.images.jpg.large_image_url = posterUrl;
                    anime.anilist_cover_image = posterUrl;
                }
                if (typeof item.title === 'string') {
                    const cleanTitle = item.title.split('<note-split>')[0].trim();
                    anime.title = cleanTitle || anime.title;
                    anime.title_english = anime.title_english || cleanTitle;
                }
                const cleanJname = item.jname ? item.jname.split('<note-split>')[0].trim() : '';
                anime.title_romaji = cleanJname || anime.title_romaji;
                anime.type = item.type || anime.type || 'TV';
                anime.synopsis = anime.synopsis || item.description || '';
                anime.trailer = anime.trailer || item.trailer;
                if (item.scraperId) anime.scraperId = item.scraperId;
                return anime;
            });
            if (processedSpotlight.length === 0) {
                throw new Error('Spotlight endpoint returned no items');
            }
            return { data: processedSpotlight };
        } catch (error) {
            console.error('Error in getSpotlightAnime:', error);
            throw error;
        }
    },

    // Search AniList (returns raw AniList data for spotlight resolution)
    async searchAnilist(query: string) {
        const res = await fetch(`${API_BASE}/anime/search?q=${encodeURIComponent(query)}`);
        return res.json();
    },

    // Get trending anime from AniList (Deduplicated)
    async getTrendingAnime(page: number = 1, limit: number = 10) {
        const cacheKey = `trending-${page}-${limit}`;
        const cached = getCached(cacheKey, DETAIL_CACHE_TTL);
        if (cached) return cached;

        if (inFlightRequests.has(cacheKey)) {
            return inFlightRequests.get(cacheKey);
        }

        const fetchPromise = (async () => {
            try {
                const res = await fetch(`${API_BASE}/anime/trending?page=${page}&limit=${limit}`);
                if (!res.ok) {
                    console.warn(`Failed to fetch trending: ${res.statusText}`);
                    return { data: [], pagination: null };
                }

                const data = await res.json();
                const result = {
                    data: data.media?.map(mapAnilistToAnime) || [],
                    pagination: {
                        last_visible_page: data.pageInfo?.lastPage || 1,
                        current_page: data.pageInfo?.currentPage || 1,
                        has_next_page: data.pageInfo?.hasNextPage || false
                    }
                };

                if (result.data.length > 0) {
                    setCache(cacheKey, result, DETAIL_CACHE_TTL);
                }
                return result;
            } finally {
                inFlightRequests.delete(cacheKey);
            }
        })();

        inFlightRequests.set(cacheKey, fetchPromise);
        return fetchPromise;
    },

    // Get airing schedule for a time range
    async getAiringSchedule(start: number, end: number): Promise<any[]> {
        return []; // Deprecated: no longer using AniList schedule
    },

    // Get list of genres
    async getGenres(): Promise<{name: string; color: string}[]> {
        return [
            { name: 'Action', color: '#ff6b6b' },
            { name: 'Adventure', color: '#4ecdc4' },
            { name: 'Comedy', color: '#ffd93d' },
            { name: 'Drama', color: '#ff8c42' },
            { name: 'Fantasy', color: '#9d4edd' },
            { name: 'Horror', color: '#e5383b' },
            { name: 'Mecha', color: '#a0a0a0' },
            { name: 'Mystery', color: '#118ab2' },
            { name: 'Psychological', color: '#7b2cbf' },
            { name: 'Romance', color: '#ffb5a7' },
            { name: 'Sci-Fi', color: '#4cc9f0' },
            { name: 'Slice of Life', color: '#06d6a0' },
            { name: 'Sports', color: '#fca311' },
            { name: 'Supernatural', color: '#3a0ca3' },
            { name: 'Thriller', color: '#d90429' }
        ];
    },

    // Get random anime (Client-side pool for speed)
    async getRandomAnime() {
        // If queue is empty or running low, trigger a refill if not already happening
        if (randomAnimeQueue.length === 0) {
            if (!refillPromise) {
                refillPromise = (async () => {
                    try {
                        const res = await fetch(`${API_BASE}/anime/popular?limit=50`);
                        if (!res.ok) throw new Error('Failed to fetch random anime batch');
                        const data = await res.json();
                        const batch = data.media || [];

                        // Shuffle the batch
                        for (let i = batch.length - 1; i > 0; i--) {
                            const j = Math.floor(Math.random() * (i + 1));
                            [batch[i], batch[j]] = [batch[j], batch[i]];
                        }

                        randomAnimeQueue.push(...batch);
                    } catch (error) {
                        console.error('Error replenishing random queue:', error);
                        // Fallback if fetch fails
                        randomAnimeQueue.push({ id: Math.floor(Math.random() * 50000) + 1 });
                    } finally {
                        refillPromise = null;
                    }
                })();
            }

            // Wait for the refill to complete
            await refillPromise;
        }

        return randomAnimeQueue.pop() || { id: 1 };
    },

};

// Queue to store random anime IDs locally
const randomAnimeQueue: { id: number }[] = [];
// Singleton promise to prevent parallel refill requests (race condition fix)
let refillPromise: Promise<void> | null = null;


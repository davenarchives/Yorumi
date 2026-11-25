type EpisodeHistoryMap = Record<string, Array<number | string>>;

export interface PublicUserProfile {
    uid: string;
    displayName: string;
    email: string;
    avatar: string | null;
    banner: string | null;
    profileCardBackground: string | null;
    creationTime: string | null;
    watchList: any[];
    readList: any[];
    lnReadList?: any[];
    continueWatching: any[];
    continueReading: any[];
    continueLN?: any[];
    episodeHistory: EpisodeHistoryMap;
    chapterHistory: Record<string, string[]>;
    animeWatchTime: Record<string, number>;
    animeWatchTimeTotalSeconds: number;
    animeGenreCache: Record<string, string[]>;
    animeCompletionCache: Record<string, { title?: string; totalCount?: number; mediaStatus?: string }>;
    mangaCompletionCache: Record<string, { title?: string; totalCount?: number; mediaStatus?: string }>;
    mangaGenreCache: Record<string, string[]>;
    activityHistory: Record<string, number>;
    favoriteAnime: any[];
    favoriteManga: any[];
    favoriteLN?: any[];
    libraryCategories?: {
        anime: Array<{ id: string; name: string; itemIds: string[] }>;
        manga: Array<{ id: string; name: string; itemIds: string[] }>;
        ln: Array<{ id: string; name: string; itemIds: string[] }>;
    };
}

const DEFAULT_SYNC_API_BASE = 'https://yorumibot-1.onrender.com/api';

const getSyncApiBase = (): string => {
    const explicit = String(import.meta.env.VITE_SYNC_API_URL || '').trim();
    if (explicit) return explicit.replace(/\/+$/, '');

    return DEFAULT_SYNC_API_BASE;
};

const USER_SEARCH_CACHE_TTL_MS = 60 * 1000;
const USER_FETCH_TIMEOUT_MS = 4500;
const userListCache = new Map<string, { data: PublicUserProfile[]; expiresAt: number }>();

const fetchWithTimeout = async (url: string, timeoutMs = USER_FETCH_TIMEOUT_MS): Promise<Response> => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { signal: controller.signal });
    } finally {
        window.clearTimeout(timer);
    }
};

export const userSearchService = {
    searchUsers: async (queryStr: string, maxResults = 12): Promise<PublicUserProfile[]> => {
        const q = queryStr.trim();
        if (!q) return [];
        const cacheKey = `q:${q.toLowerCase()}:${maxResults}`;
        const cached = userListCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) return cached.data;

        try {
            const url = `${getSyncApiBase()}/sync/users?q=${encodeURIComponent(q)}&limit=${maxResults}`;
            const res = await fetchWithTimeout(url);
            if (!res.ok) return [];
            const json = (await res.json()) as { success?: boolean; data?: PublicUserProfile[] };
            const data = Array.isArray(json?.data) ? json.data : [];
            userListCache.set(cacheKey, { data, expiresAt: Date.now() + USER_SEARCH_CACHE_TTL_MS });
            return data;
        } catch {
            return [];
        }
    },

    getDiscoverUsers: async (maxResults = 20): Promise<PublicUserProfile[]> => {
        const cacheKey = `discover:${maxResults}`;
        const cached = userListCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) return cached.data;

        try {
            const url = `${getSyncApiBase()}/sync/users?limit=${maxResults}`;
            const res = await fetchWithTimeout(url);
            if (!res.ok) return [];
            const json = (await res.json()) as { success?: boolean; data?: PublicUserProfile[] };
            const data = Array.isArray(json?.data) ? json.data : [];
            if (data.length > 0) {
                userListCache.set(cacheKey, { data, expiresAt: Date.now() + USER_SEARCH_CACHE_TTL_MS });
            }
            return data;
        } catch {
            return [];
        }
    },

    getUserProfile: async (uid: string): Promise<PublicUserProfile | null> => {
        const cleanUid = uid.trim();
        if (!cleanUid) return null;
        try {
            const url = `${getSyncApiBase()}/sync/users/${encodeURIComponent(cleanUid)}`;
            const res = await fetchWithTimeout(url, 8000);
            if (!res.ok) return null;
            const json = (await res.json()) as { success?: boolean; data?: PublicUserProfile | null };
            return json?.data || null;
        } catch {
            return null;
        }
    },
};

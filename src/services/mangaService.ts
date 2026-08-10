// API Service for Manga operations - Using AniList
import type { Manga, MangaChapter } from '../types/manga';
import axios from 'axios';
import { API_BASE } from '../config/api';
import { getDisplayImageUrl } from '../utils/image';
const apiClient = axios.create({
    baseURL: API_BASE,
    timeout: 15000,
});
const responseCache = new Map<string, { data: any; timestamp: number }>();
const chapterListCache = new Map<string, { data: any; timestamp: number }>();
const chapterPagesCache = new Map<string, { data: any; timestamp: number }>();
const chapterListInFlight = new Map<string, Promise<any>>();
const chapterPagesInFlight = new Map<string, Promise<any>>();
const inFlightRequests = new Map<string, Promise<any>>();
const PERSISTED_CACHE_PREFIX = 'yorumi_manga_cache_v4';
const SEARCH_CACHE_TTL = 5 * 60 * 1000;
const DETAIL_CACHE_TTL = 15 * 60 * 1000;
const LIST_CACHE_TTL = 10 * 60 * 1000;
const SPOTLIGHT_CACHE_TTL = 10 * 60 * 1000;
const CHAPTER_LIST_CACHE_TTL = 20 * 60 * 1000;
const CHAPTER_PAGES_CACHE_TTL = 30 * 60 * 1000;

const isEmptyData = (data: any) => {
    if (!data) return true;
    if (Array.isArray(data) && data.length === 0) return true;
    if (Array.isArray(data.data) && data.data.length === 0) return true;
    return false;
};

const setLocalStorageWithCleanup = (key: string, value: string) => {
    try {
        localStorage.setItem(key, value);
    } catch (e) {
        localStorage.clear();
        localStorage.setItem(key, value);
    }
};

const readPersistedCache = (key: string, ttl: number) => {
    try {
        const raw = localStorage.getItem(`${PERSISTED_CACHE_PREFIX}:${key}`);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { data: any; timestamp: number };
        if (!parsed || typeof parsed.timestamp !== 'number') return null;
        const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
        if (!isOffline && ttl !== Infinity && Date.now() - parsed.timestamp > ttl && !isEmptyData(parsed.data)) {
            return null;
        }
        return parsed.data;
    } catch {
        return null;
    }
};

const writePersistedCache = (key: string, data: any, timestamp: number) => {
    try {
        setLocalStorageWithCleanup(`${PERSISTED_CACHE_PREFIX}:${key}`, JSON.stringify({ data, timestamp }));
    } catch {
        // Ignore quota limits
    }
};

// Auto-cleanup legacy/stale manga caches on load
try {
    if (typeof window !== 'undefined' && window.localStorage) {
        Object.keys(localStorage).forEach(k => {
            if (k.includes('manga-unified:') || k.includes('manga-spotlight') || k.includes('manga-top') || k.includes('manga-popular')) {
                localStorage.removeItem(k);
            }
        });
    }
} catch (e) {
    // Ignore
}

const getCached = (key: string, ttl: number) => {
    const memory = responseCache.get(key);
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    if (memory && !isEmptyData(memory.data) && (isOffline || ttl === Infinity || Date.now() - memory.timestamp < ttl)) {
        return memory.data;
    }

    const persisted = readPersistedCache(key, ttl);
    if (persisted && !isEmptyData(persisted)) {
        responseCache.set(key, { data: persisted, timestamp: Date.now() });
        return persisted;
    }

    return null;
};

const setCached = (key: string, data: any) => {
    if (isEmptyData(data)) return;
    const timestamp = Date.now();
    responseCache.set(key, { data, timestamp });
    writePersistedCache(key, data, timestamp);
};

const fetchWithCache = async <T>(cacheKey: string, ttl: number, fetcher: () => Promise<T>): Promise<T> => {
    const cached = getCached(cacheKey, ttl);
    if (cached && !isEmptyData(cached)) {
        return cached as T;
    }

    if (inFlightRequests.has(cacheKey)) {
        return inFlightRequests.get(cacheKey)! as Promise<T>;
    }

    const request = fetcher()
        .then((result) => {
            if (!isEmptyData(result)) {
                setCached(cacheKey, result);
            }
            return result;
        })
        .catch((err) => {
            const staleCache = getCached(cacheKey, Infinity);
            if (staleCache && !isEmptyData(staleCache)) {
                return staleCache as T;
            }
            throw err;
        })
        .finally(() => {
            inFlightRequests.delete(cacheKey);
        });

    inFlightRequests.set(cacheKey, request);
    return request;
};

interface AniListManga {
    id: number;
    title?: {
        english?: string;
        romaji?: string;
        native?: string;
    };
    coverImage?: {
        large?: string;
        extraLarge?: string;
    };
    description?: string;
    format?: string;
    chapters?: number;
    volumes?: number;
    averageScore?: number;
    status?: string;
    genres?: string[];
    startDate?: { year?: number; month?: number; day?: number };
    endDate?: { year?: number; month?: number; day?: number };
    countryOfOrigin?: string;
    synonyms?: string[];
    characters?: any;
    relations?: any;
    staff?: any;
}

const mapAnilistToManga = (item: AniListManga) => ({
    mal_id: item.id, // Use AniList ID as primary for routing to match backend expectation
    id: item.id,
    title: item.title?.english || item.title?.romaji || item.title?.native || 'Unknown',
    title_english: item.title?.english,
    title_romaji: item.title?.romaji,
    title_native: item.title?.native,
    title_japanese: item.title?.native,
    images: {
        jpg: {
            image_url: item.coverImage?.large || '',
            large_image_url: item.coverImage?.extraLarge || item.coverImage?.large || ''
        }
    },
    synopsis: item.description?.replace(/<[^>]*>/g, '') || '',
    type: item.format,
    chapters: item.chapters,
    volumes: item.volumes,
    score: item.averageScore ? item.averageScore / 10 : 0,
    status: item.status,
    genres: item.genres?.map((g: string) => ({ name: g, mal_id: 0 })) || [],
    authors: item.staff?.edges?.map((edge: any) => ({ name: edge.node?.name?.full || 'Unknown', role: edge.role || 'Story & Art', mal_id: 0 })) || [],
    published: {
        from: item.startDate ? `${item.startDate.year}-${item.startDate.month}-${item.startDate.day}` : undefined,
        to: item.endDate ? `${item.endDate.year}-${item.endDate.month}-${item.endDate.day}` : undefined,
        string: item.startDate?.year ? `${item.startDate.year}` : undefined
    },
    countryOfOrigin: item.countryOfOrigin,
    synonyms: item.synonyms || [],
    characters: item.characters,
    relations: item.relations
});

const isMostlyLatin = (value: string | undefined) => {
    const normalized = String(value || '').replace(/[\s\d\p{P}]/gu, '');
    if (!normalized) return false;
    const latinChars = (normalized.match(/\p{Script=Latin}/gu) || []).length;
    return latinChars / normalized.length >= 0.6;
};

const pickScraperRomajiTitle = (scraperData: ScraperManga) =>
    scraperData.altNames?.find((name) => isMostlyLatin(name) && name.trim() !== scraperData.title)?.trim()
    || scraperData.title;

const pickScraperNativeTitle = (scraperData: ScraperManga) =>
    scraperData.altNames?.find((name) => name.trim() && !isMostlyLatin(name))?.trim()
    || scraperData.altNames?.find((name) => name.trim() !== scraperData.title)?.trim()
    || undefined;

const mapScraperToManga = (scraperData: ScraperManga) => {
    const image = getDisplayImageUrl(scraperData.coverImage || scraperData.thumbnail || '');
    return ({
    mal_id: scraperData.id,
    id: scraperData.id,
    scraper_id: scraperData.id,
    title: scraperData.title || 'Unknown',
    title_english: scraperData.title || 'Unknown',
    title_romaji: pickScraperRomajiTitle(scraperData),
    title_native: pickScraperNativeTitle(scraperData),
    title_japanese: pickScraperNativeTitle(scraperData),
    images: {
        jpg: {
            image_url: image,
            large_image_url: image
        }
    },
    synopsis: scraperData.synopsis || 'No synopsis available from source.',
    type: 'Manga',
    chapters: Array.isArray(scraperData.chapters) ? scraperData.chapters.length : 0,
    volumes: 0,
    score: 0,
    status: scraperData.status || 'Unknown',
    genres: scraperData.genres?.map((g: string) => ({ name: g, mal_id: 0 })) || [],
    authors: scraperData.author ? [{ name: scraperData.author, role: 'Story & Art', mal_id: 0 }] : [],
    published: { from: '', to: '', string: '' },
    countryOfOrigin: 'JP',
    synonyms: scraperData.altNames || []
    });
};

interface ScraperManga {
    id: string;
    title: string;
    thumbnail?: string;
    coverImage?: string;
    url: string;
    latestChapter?: string;
    status?: string;
    genres?: string[];
    author?: string;
    source?: string;
    altNames?: string[];
    synopsis?: string;
    chapters?: any[];
}

type HydratedManga = Manga & {
    resolvedChapters?: MangaChapter[];
};

export const mangaService = {
    peekUnifiedMangaDetails(id: string | number) {
        return getCached(`manga-unified:${String(id)}`, DETAIL_CACHE_TTL) as Manga | null;
    },

    peekTopManga(page: number = 1) {
        return getCached(`manga-top:${page}`, LIST_CACHE_TTL) as { data: Manga[]; pagination: any } | null;
    },

    peekPopularManga(page: number = 1) {
        return getCached(`manga-popular:${page}`, LIST_CACHE_TTL) as { data: Manga[]; pagination: any } | null;
    },

    peekPopularManhwa(page: number = 1) {
        return getCached(`manga-popular-manhwa:${page}`, LIST_CACHE_TTL) as { data: Manga[]; pagination: any } | null;
    },

    peekOneShotManga(page: number = 1) {
        return getCached(`manga-one-shot:${page}`, LIST_CACHE_TTL) as { data: Manga[]; pagination: any } | null;
    },

    peekLatestMangaScraper(page: number = 1) {
        return getCached(`manga-latest:${page}`, LIST_CACHE_TTL) as { data: Manga[]; pagination: any } | null;
    },

    peekNewMangaScraper(page: number = 1) {
        return getCached(`manga-new:${page}`, LIST_CACHE_TTL) as { data: Manga[]; pagination: any } | null;
    },

    peekMangaDirectory(page: number = 1) {
        return getCached(`manga-directory:${page}`, LIST_CACHE_TTL) as { data: Manga[]; pagination: any } | null;
    },

    peekHotUpdates() {
        return getCached(`manga-hot-updates`, LIST_CACHE_TTL) as any[] | null;
    },

    peekEnrichedSpotlight() {
        return getCached(`manga-spotlight`, SPOTLIGHT_CACHE_TTL) as { data: Manga[] } | null;
    },

    // Fetch top manga from AniList (sorted by SCORE)
    async getTopManga(page: number = 1) {
        return fetchWithCache(`manga-top:${page}`, LIST_CACHE_TTL, async () => {
            try {
                const res = await fetch(`${API_BASE}/anilist/top/manga?page=${page}`);
                if (res.ok) {
                    const data = await res.json();
                    const items = data.media?.map(mapAnilistToManga) || [];
                    if (items.length > 0) {
                        return {
                            data: items,
                            pagination: {
                                last_visible_page: data.pageInfo?.lastPage || 1,
                                current_page: data.pageInfo?.currentPage || 1,
                                has_next_page: data.pageInfo?.hasNextPage || false
                            }
                        };
                    }
                }
            } catch (e) {
                console.warn('getTopManga failed, using directory fallback', e);
            }
            return mangaService.getMangaDirectory(page);
        });
    },

    // Fetch trending manga from AniList (sorted by TRENDING)
    async getTrendingManga(page: number = 1) {
        try {
            const res = await fetch(`${API_BASE}/anilist/trending/manga?page=${page}`);
            if (res.ok) {
                const data = await res.json();
                const items = data.media?.map(mapAnilistToManga) || [];
                if (items.length > 0) {
                    return {
                        data: items,
                        pagination: {
                            last_visible_page: data.pageInfo?.lastPage || 1,
                            current_page: data.pageInfo?.currentPage || 1,
                            has_next_page: data.pageInfo?.hasNextPage || false
                        }
                    };
                }
            }
        } catch (e) {
            console.warn('getTrendingManga failed, using latest fallback', e);
        }
        return mangaService.getLatestMangaScraper(page);
    },

    // Fetch all-time popular manga from AniList (sorted by POPULARITY)
    async getPopularManga(page: number = 1) {
        return fetchWithCache(`manga-popular:${page}`, LIST_CACHE_TTL, async () => {
            try {
                const res = await fetch(`${API_BASE}/anilist/popular/manga?page=${page}`);
                if (res.ok) {
                    const data = await res.json();
                    const items = data.media?.map(mapAnilistToManga) || [];
                    if (items.length > 0) {
                        return {
                            data: items,
                            pagination: {
                                last_visible_page: data.pageInfo?.lastPage || 1,
                                current_page: data.pageInfo?.currentPage || 1,
                                has_next_page: data.pageInfo?.hasNextPage || false
                            }
                        };
                    }
                }
            } catch (e) {
                console.warn('getPopularManga failed, using directory fallback', e);
            }
            return mangaService.getMangaDirectory(page);
        });
    },

    // Fetch popular manhwa from AniList
    async getPopularManhwa(page: number = 1) {
        return fetchWithCache(`manga-popular-manhwa:${page}`, LIST_CACHE_TTL, async () => {
            try {
                const res = await fetch(`${API_BASE}/anilist/top/manhwa?page=${page}`);
                if (res.ok) {
                    const data = await res.json();
                    const items = data.media?.map(mapAnilistToManga) || [];
                    if (items.length > 0) {
                        return {
                            data: items,
                            pagination: {
                                last_visible_page: data.pageInfo?.lastPage || 1,
                                current_page: data.pageInfo?.currentPage || 1,
                                has_next_page: data.pageInfo?.hasNextPage || false
                            }
                        };
                    }
                }
            } catch (e) {
                console.warn('getPopularManhwa failed, using new manga fallback', e);
            }
            return mangaService.getNewMangaScraper(page);
        });
    },

    // Search manga via AniList
    async searchManga(query: string, page: number = 1, limit: number = 18) {
        const res = await fetch(`${API_BASE}/anilist/search/manga?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`);
        const data = await res.json();
        return {
            data: data.media?.map(mapAnilistToManga) || [],
            pagination: {
                last_visible_page: data.pageInfo?.lastPage || 1,
                current_page: data.pageInfo?.currentPage || 1,
                has_next_page: data.pageInfo?.hasNextPage || false
            }
        };
    },

    // Get A-Z List for Manga via Backend (AniList)
    async getAZList(letter: string, page: number = 1) {
        const res = await fetch(`${API_BASE}/anilist/manga/az-list/${encodeURIComponent(letter)}?page=${page}`);
        const data = await res.json();
        return {
            data: data.media?.map(mapAnilistToManga) || [],
            pagination: {
                last_visible_page: data.pageInfo?.lastPage || 1,
                current_page: data.pageInfo?.currentPage || 1,
                has_next_page: data.pageInfo?.hasNextPage || false
            }
        };
    },

    async getOneShotManga(page: number = 1) {
        return fetchWithCache(`manga-one-shot:${page}`, LIST_CACHE_TTL, async () => {
            const res = await fetch(`${API_BASE}/anilist/top/one-shot?page=${page}`);
            const data = await res.json();
            return {
                data: data.media?.map(mapAnilistToManga) || [],
                pagination: {
                    last_visible_page: data.pageInfo?.lastPage || 1,
                    current_page: data.pageInfo?.currentPage || 1,
                    has_next_page: data.pageInfo?.hasNextPage || false
                }
            };
        });
    },

    // Get manga details by ID
    async getMangaDetails(id: number | string) {
        const cacheKey = `manga-details:${String(id)}`;
        const cached = getCached(cacheKey, DETAIL_CACHE_TTL);
        if (cached) return cached;
        if (inFlightRequests.has(cacheKey)) {
            return inFlightRequests.get(cacheKey)!;
        }

        try {
            const request = fetch(`${API_BASE}/anilist/manga/${id}`)
                .then(async (res) => {
                    if (!res.ok) throw new Error('Failed to fetch details');
                    const data = await res.json();
                    const result = { data: mapAnilistToManga(data) };
                    if (result.data) {
                        setCached(cacheKey, result);
                    }
                    return result;
                })
                .finally(() => {
                    inFlightRequests.delete(cacheKey);
                });

            inFlightRequests.set(cacheKey, request);
            return await request;
        } catch (e) {
            console.error('getMangaDetails failed:', e);
            return { data: null };
        }
    },

    // Get manga chapters from MangaKatana scraper
    async getChapters(mangaId: string) {
        const now = Date.now();
        const cached = chapterListCache.get(mangaId);
        if (cached && now - cached.timestamp < CHAPTER_LIST_CACHE_TTL) {
            return cached.data;
        }

        if (chapterListInFlight.has(mangaId)) {
            return chapterListInFlight.get(mangaId)!;
        }

        const request = apiClient
            .get(`/manga/chapters/${encodeURIComponent(mangaId)}`)
            .then(({ data }) => {
                if (data?.chapters && Array.isArray(data.chapters)) {
                    chapterListCache.set(mangaId, { data, timestamp: Date.now() });
                }
                return data;
            })
            .finally(() => {
                chapterListInFlight.delete(mangaId);
            });

        chapterListInFlight.set(mangaId, request);
        return request;
    },

    // Get chapter pages from MangaKatana scraper
    async getChapterPages(chapterUrl: string) {
        const now = Date.now();
        const cached = chapterPagesCache.get(chapterUrl);
        if (cached && now - cached.timestamp < CHAPTER_PAGES_CACHE_TTL) {
            return cached.data;
        }

        if (chapterPagesInFlight.has(chapterUrl)) {
            return chapterPagesInFlight.get(chapterUrl)!;
        }

        const fetchOnce = async () => {
            let resultData;
            if (chapterUrl.includes('toonily.com') || chapterUrl.includes('manhwaread.com')) {
                const res = await fetch(`${API_BASE}/vault/manga/pages?url=${encodeURIComponent(chapterUrl)}`);
                const vaultData = await res.json();
                
                // Proxy Toonily images to avoid 403 Forbidden hotlink blocks
                if (vaultData?.pages && Array.isArray(vaultData.pages)) {
                    vaultData.pages = vaultData.pages.map((p: any) => ({
                        ...p,
                        imageUrl: `${API_BASE}/image/proxy?url=${encodeURIComponent(p.imageUrl)}`
                    }));
                }
                resultData = vaultData;
            } else {
                const { data } = await apiClient.get('/manga/pages', {
                    params: { url: chapterUrl },
                });
                resultData = data;
            }
            
            if (resultData?.pages && Array.isArray(resultData.pages)) {
                chapterPagesCache.set(chapterUrl, { data: resultData, timestamp: Date.now() });
            }
            return resultData;
        };

        const request = (async () => {
            try {
                return await fetchOnce();
            } catch {
                // Retry once to handle transient scraper/network failures.
                return fetchOnce();
            } finally {
                chapterPagesInFlight.delete(chapterUrl);
            }
        })();

        chapterPagesInFlight.set(chapterUrl, request);
        return request;
    },

    // Search manga on MangaKatana scraper with local pagination
    async searchMangaScraper(query: string, page: number = 1, limit: number = 18) {
        const normalizedQuery = query.trim().toLowerCase();
        const cacheKey = `manga-search:${normalizedQuery}`;

        let items = getCached(cacheKey, SEARCH_CACHE_TTL) as ScraperManga[] | null;
        if (!items) {
            if (inFlightRequests.has(cacheKey)) {
                items = await inFlightRequests.get(cacheKey)!;
            } else {
                const request = fetch(`${API_BASE}/manga/search?q=${encodeURIComponent(query)}`)
                    .then(async (res) => {
                        const data = await res.json();
                        return Array.isArray(data) ? data : (data?.data || []);
                    })
                    .finally(() => {
                        inFlightRequests.delete(cacheKey);
                });
                inFlightRequests.set(cacheKey, request);
                items = await request;
                if (Array.isArray(items) && items.length > 0) {
                    setCached(cacheKey, items);
                }
            }
        }

        const safeLimit = Math.max(1, limit);
        const resolvedItems = items || [];
        const total = resolvedItems.length;
        const lastPage = Math.max(1, Math.ceil(total / safeLimit));
        const currentPage = Math.min(Math.max(page, 1), lastPage);
        const start = (currentPage - 1) * safeLimit;
        
        const pageItems = resolvedItems.slice(start, start + safeLimit).map((item: ScraperManga) => {
            const image = getDisplayImageUrl(item.thumbnail || item.coverImage || '');
            return {
                mal_id: item.id,
                id: item.id,
                scraper_id: item.id,
                title: item.title || 'Unknown',
                title_english: item.title,
                title_romaji: item.title,
                images: {
                    jpg: {
                        image_url: image,
                        large_image_url: image
                    }
                },
                synopsis: '',
                type: 'Manga',
                chapters: 0,
                volumes: 0,
                score: 0,
                status: 'Unknown',
                genres: [],
                authors: [],
                published: { string: '' },
                countryOfOrigin: 'JP',
                latestChapter: item.latestChapter,
                source: item.source || 'mangakatana'
            };
        });

        return {
            data: pageItems,
            pagination: {
                last_visible_page: lastPage,
                current_page: currentPage,
                has_next_page: currentPage < lastPage
            }
        };
    },

    async getLatestMangaScraper(page: number = 1) {
        return fetchWithCache(`manga-latest:${page}`, LIST_CACHE_TTL, async () => {
            const res = await fetch(`${API_BASE}/manga/latest?page=${page}`);
            const data = await res.json();
            const items = data.data || [];
            const totalPages = data.pagination?.total_pages || (page + (items.length === 20 ? 1 : 0));
            return {
                data: items.map((item: ScraperManga) => ({ ...mapScraperToManga(item), latestChapter: item.latestChapter, id: item.id })),
                pagination: {
                    last_visible_page: totalPages,
                    current_page: page,
                    has_next_page: page < totalPages
                }
            };
        });
    },

    async getNewMangaScraper(page: number = 1) {
        return fetchWithCache(`manga-new:${page}`, LIST_CACHE_TTL, async () => {
            const res = await fetch(`${API_BASE}/manga/new-manga?page=${page}`);
            const data = await res.json();
            const items = data.data || [];
            const totalPages = data.pagination?.total_pages || (page + (items.length === 20 ? 1 : 0));
            return {
                data: items.map((item: ScraperManga) => ({ ...mapScraperToManga(item), latestChapter: item.latestChapter, id: item.id })),
                pagination: {
                    last_visible_page: totalPages,
                    current_page: page,
                    has_next_page: page < totalPages
                }
            };
        });
    },

    async getMangaDirectory(page: number = 1) {
        return fetchWithCache(`manga-directory:${page}`, LIST_CACHE_TTL, async () => {
            const res = await fetch(`${API_BASE}/manga/directory?page=${page}`);
            const data = await res.json();
            const items = data.data || [];
            const totalPages = data.pagination?.total_pages || (page + (items.length === 20 ? 1 : 0));
            return {
                data: items.map((item: ScraperManga) => ({ ...mapScraperToManga(item), latestChapter: item.latestChapter, id: item.id })),
                pagination: {
                    last_visible_page: totalPages,
                    current_page: page,
                    has_next_page: page < totalPages
                }
            };
        });
    },

    async getHotUpdates() {
        return fetchWithCache(`manga-hot-updates`, LIST_CACHE_TTL, async () => {
            const response = await fetch(`${API_BASE}/manga/hot-updates`);
            if (!response.ok) throw new Error('Failed to fetch hot updates');
            const data = await response.json();
            return data.data;
        });
    },

    async prefetchChapters(urls: string[]) {
        try {
            await apiClient.post('/manga/prefetch', { urls });
        } catch (err) {
            console.error('Prefetch failed', err);
        }
    },

    async getEnrichedSpotlight() {
        return fetchWithCache(`manga-spotlight`, SPOTLIGHT_CACHE_TTL, async () => {
            try {
                const res = await fetch(`${API_BASE}/manga/spotlight`);
                if (res.ok) {
                    const data = await res.json();
                    const items = data.data?.map(mapAnilistToManga) || [];
                    if (items.length > 0) {
                        return { data: items };
                    }
                }
            } catch (e) {
                console.warn('getEnrichedSpotlight failed, using hot updates fallback', e);
            }
            const hot = await mangaService.getHotUpdates().catch(() => []);
            if (Array.isArray(hot) && hot.length > 0) {
                const mappedHot = hot.slice(0, 8).map((item: any) => ({
                    mal_id: item.id,
                    id: item.id,
                    title: item.title,
                    title_english: item.title,
                    images: { jpg: { large_image_url: item.thumbnail, image_url: item.thumbnail } },
                    chapters: item.chapter ? parseInt(item.chapter.replace(/\D/g, '')) || undefined : undefined,
                    type: 'Manga',
                    status: 'Unknown',
                    score: 0,
                    genres: [],
                    synopsis: `Latest Chapter: ${item.chapter}`
                } as unknown as Manga));
                return { data: mappedHot };
            }
            return { data: [] };
        });
    },

    // Get scraper details (fallback for string IDs)
    // Get scraper details (fallback for string IDs)
    async getScraperMangaDetails(id: string) {
        const cacheKey = `manga-scraper-details:${id}`;
        const cached = getCached(cacheKey, DETAIL_CACHE_TTL);
        if (cached) return cached;
        if (inFlightRequests.has(cacheKey)) {
            return inFlightRequests.get(cacheKey)!;
        }

        try {
            const request = fetch(`${API_BASE}/manga/details/${encodeURIComponent(id)}`)
                .then(async (res) => {
                    if (!res.ok) return null;
                    const json = await res.json();
                    const scraperData = json.data;

                    if (!scraperData) return null;

                    const mapped = mapScraperToManga(scraperData as any) as Manga;
                    if (mapped) {
                        setCached(cacheKey, mapped);
                    }
                    return mapped;
                })
                .finally(() => {
                    inFlightRequests.delete(cacheKey);
                });

            inFlightRequests.set(cacheKey, request);
            return await request;
        } catch (error) {
            console.error('getScraperMangaDetails failed:', error);
            return null;
        }
    },

    // Unified details endpoint (supports AniList numeric IDs and scraper IDs)
    async getUnifiedMangaDetails(id: string | number) {
        const cacheKey = `manga-unified:${String(id)}`;
        const cached = getCached(cacheKey, DETAIL_CACHE_TTL);
        if (cached) return cached;
        if (inFlightRequests.has(cacheKey)) {
            return inFlightRequests.get(cacheKey)!;
        }

        const request = fetch(`${API_BASE}/manga/details/${encodeURIComponent(String(id))}?includeChapters=1`)
            .then(async (res) => {
                if (!res.ok) throw new Error(`Failed to fetch unified manga details (${res.status})`);
                const json = await res.json();
                const data = json.data;
                if (!data) return null;

                let mapped: HydratedManga | null = null;

                if (data.title && typeof data.title === 'object') {
                    mapped = mapAnilistToManga(data) as HydratedManga;
                    if (typeof data.scraperId === 'string' && data.scraperId.trim()) {
                        mapped.scraper_id = data.scraperId.trim();
                    }
                } else if (typeof data.title === 'string') {
                    mapped = mapScraperToManga(data) as HydratedManga;
                }

                if (mapped && typeof json.scraperId === 'string' && json.scraperId.trim()) {
                    mapped.scraper_id = mapped.scraper_id || json.scraperId.trim();
                }

                if (mapped && Array.isArray(json.chapters) && json.chapters.length > 0) {
                    mapped.resolvedChapters = json.chapters;
                    const chapterPayload = { chapters: json.chapters };
                    [
                        String(id),
                        String(mapped.scraper_id || ''),
                        String(mapped.id || ''),
                        String(mapped.mal_id || ''),
                    ]
                        .map((key) => key.trim())
                        .filter(Boolean)
                        .forEach((key) => {
                            chapterListCache.set(key, { data: chapterPayload, timestamp: Date.now() });
                        });
                }

                if (mapped) {
                    setCached(cacheKey, mapped);
                }
                return mapped;
            })
            .finally(() => {
                inFlightRequests.delete(cacheKey);
            });

        inFlightRequests.set(cacheKey, request);
        return request;
    },

    // Get random manga (Client-side pool for speed)
    async getRandomManga() {
        // If queue is empty or running low, trigger a refill if not already happening
        if (randomMangaQueue.length === 0) {
            if (!refillPromise) {
                refillPromise = (async () => {
                    try {
                        const res = await fetch(`${API_BASE}/anilist/random-manga`);
                        if (!res.ok) throw new Error('Failed to fetch random manga batch');
                        const batch = await res.json();

                        // Shuffle the batch
                        for (let i = batch.length - 1; i > 0; i--) {
                            const j = Math.floor(Math.random() * (i + 1));
                            [batch[i], batch[j]] = [batch[j], batch[i]];
                        }

                        randomMangaQueue.push(...batch);
                    } catch (error) {
                        console.error('Error replenishing random manga queue:', error);
                        // Fallback if fetch fails
                        randomMangaQueue.push({ id: Math.floor(Math.random() * 50000) + 1 });
                    } finally {
                        refillPromise = null;
                    }
                })();
            }

            // Wait for the refill to complete
            await refillPromise;
        }

        return randomMangaQueue.pop() || { id: 1 };
    }
};

// Queue to store random manga IDs locally
const randomMangaQueue: { id: number }[] = [];
// Singleton promise to prevent parallel refill requests (race condition fix)
let refillPromise: Promise<void> | null = null;

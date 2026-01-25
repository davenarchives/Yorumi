// API Service for Anime operations - Using AniList
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Helper to map AniList response to our Anime interface format
const mapAnilistToAnime = (item: any) => {
    // Debug metadata availability
    if (!item.streamingEpisodes || item.streamingEpisodes.length === 0) {
        console.warn('[AnimeService] No streaming episodes found for:', item.title?.english || item.id, item);
    } else {
        console.log('[AnimeService] Found streaming episodes for:', item.title?.english, item.streamingEpisodes.length);
    }

    return {
        mal_id: item.idMal || item.id,
        id: item.id,
        title: item.title?.english || item.title?.romaji || item.title?.native || 'Unknown',
        title_japanese: item.title?.native,
        title_english: item.title?.english,
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
        studios: item.studios?.nodes?.map((s: any) => ({ name: s.name, mal_id: 0 })) || [],
        year: item.seasonYear || item.startDate?.year,
        season: item.season?.toLowerCase(),
        aired: {
            from: item.startDate ? `${item.startDate.year}-${item.startDate.month}-${item.startDate.day}` : undefined,
            to: item.endDate ? `${item.endDate.year}-${item.endDate.month}-${item.endDate.day}` : undefined,
            string: item.startDate?.year ? `${item.season || ''} ${item.startDate.year}`.trim() : undefined
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
        episodeMetadata: item.streamingEpisodes?.map((e: any) => ({
            title: e.title,
            thumbnail: e.thumbnail,
            url: e.url,
            site: e.site
        })) || [],
        relations: item.relations // Map relations
    };
};

// Simple in-memory cache
const cache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getCached = (key: string) => {
    if (cache.has(key)) {
        const entry = cache.get(key)!;
        if (Date.now() - entry.timestamp < CACHE_TTL) {
            return entry.data;
        }
        cache.delete(key);
    }
    return null;
};

const setCache = (key: string, data: any) => {
    cache.set(key, { data, timestamp: Date.now() });
};

// Track in-flight requests to prevent duplicates
const inFlightRequests = new Map<string, Promise<any>>();

export const animeService = {
    // Fetch top anime from AniList (Deduplicated)
    async getTopAnime(page: number = 1) {
        const cacheKey = `top-anime-${page}`;
        const cached = getCached(cacheKey);
        if (cached) return cached;

        // Check for in-flight request
        if (inFlightRequests.has(cacheKey)) {
            return inFlightRequests.get(cacheKey);
        }

        const fetchPromise = (async () => {
            try {
                const res = await fetch(`${API_BASE}/anilist/top?page=${page}&limit=18`);
                if (!res.ok) {
                    throw new Error(`Failed to fetch top anime: ${res.statusText}`);
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
                    setCache(cacheKey, result);
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
    async searchAnime(query: string, page: number = 1) {
        const res = await fetch(`${API_BASE}/anilist/search?q=${encodeURIComponent(query)}&page=${page}&limit=18`);
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

    // Get A-Z List from HiAnime Scraper
    async getAZList(letter: string, page: number = 1) {
        const res = await fetch(`${API_BASE}/hianime/az-list/${encodeURIComponent(letter)}?page=${page}`);
        const data = await res.json();

        return {
            data: data.data?.map((item: any) => ({
                mal_id: 0,
                id: 0,
                scraperId: item.id,
                title: item.title,
                images: {
                    jpg: {
                        image_url: item.poster,
                        large_image_url: item.poster
                    }
                },
                type: item.type,
                type_display: item.type,
                score: 0,
                status: 'Unknown',
                episodes: null,
                duration: null,
                rating: null,
                genres: [],
                synopsis: '',
                season: null,
                year: null,
                aired: { string: '' },
                studios: [],
                members: 0,
                rank: 0,
                popularity: 0,
                favorites: 0,
                source: 'Scraper',
                is_scraped: true
            })) || [],
            pagination: data.pagination
        };
    },

    // Get anime details from AniList
    async getAnimeDetails(id: number | string) {
        const res = await fetch(`${API_BASE}/anilist/anime/${id}`);
        const data = await res.json();
        if (!data || data.error) return { data: null };
        return { data: mapAnilistToAnime(data) };
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

    // Search anime on scraper (HiAnime)
    async searchScraper(title: string) {
        const res = await fetch(`${API_BASE}/scraper/search?q=${encodeURIComponent(title)}`);
        return res.json();
    },

    // Get popular this season from AniList (Deduplicated)
    async getPopularThisSeason(page: number = 1, limit: number = 10) {
        const cacheKey = `popular-season-${page}-${limit}`;
        const cached = getCached(cacheKey);
        if (cached) return cached;

        if (inFlightRequests.has(cacheKey)) {
            return inFlightRequests.get(cacheKey);
        }

        const fetchPromise = (async () => {
            try {
                const res = await fetch(`${API_BASE}/anilist/popular-this-season?page=${page}&limit=${limit}`);
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
                    setCache(cacheKey, result);
                }
                return result;
            } finally {
                inFlightRequests.delete(cacheKey);
            }
        })();

        inFlightRequests.set(cacheKey, fetchPromise);
        return fetchPromise;
    },


    // Get episodes from scraper with Firebase Caching
    async getEpisodes(session: string) {
        // Only use caching if session is a potential ID (Anilist ID usually, but session here comes from scraper search sometimes)
        // Wait, "session" in getEpisodes(session) typically refers to the anime ID or unique identifier used by the scraper.
        // Let's verify what "session" actually is. It seems to be the ID used by the scraper.

        // Use a consistent collection for episodes
        const CACHE_COLLECTION = "anime_episodes";
        // Convert session to a string safe for document ID if needed, though usually it's safe.
        const docRef = doc(db, CACHE_COLLECTION, session);

        try {
            // 1. Try to get from Firestore
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                // Optional: Check TTL here if needed. For now, assuming relatively static unless manually invalidated?
                // Or maybe a 24h TTL? Episodes update weekly for airing, but completed ones don't change.
                // Let's stick to simple caching first.
                if (data.episodes && Array.isArray(data.episodes) && data.episodes.length > 0) {
                    console.log(`[AnimeService] Hit Firebase cache for episodes: ${session}`);
                    return { episodes: data.episodes };
                }
            }
        } catch (error) {
            console.warn("[AnimeService] Firebase read error:", error);
            // Fallback to fetch
        }

        // 2. Fetch from API if not in cache
        console.log(`[AnimeService] Missed cache, fetching episodes: ${session}`);
        const res = await fetch(`${API_BASE}/scraper/episodes?session=${session}`);
        const data = await res.json();

        // 3. Save to Firestore
        if (data && data.episodes && Array.isArray(data.episodes) && data.episodes.length > 0) {
            try {
                await setDoc(docRef, {
                    episodes: data.episodes,
                    lastUpdated: Date.now()
                });
                console.log(`[AnimeService] Cached episodes to Firebase: ${session}`);
            } catch (error) {
                console.warn("[AnimeService] Firebase write error:", error);
            }
        }

        return data;
    },

    // Get mapping from AniList ID to Scraper Session
    async getAnimeMapping(malId: string | number) {
        const docRef = doc(db, "anime_mappings", String(malId));
        try {
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.session) {
                    console.log(`[AnimeService] Hit mapping cache: ${malId} -> ${data.session}`);
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
        const docRef = doc(db, "anime_mappings", String(malId));
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

    // Get stream links from scraper
    async getStreams(animeSession: string, episodeSession: string) {
        const res = await fetch(`${API_BASE}/scraper/streams?anime_session=${animeSession}&ep_session=${episodeSession}`);
        return res.json();
    },

    // Get HiAnime spotlight (enriched with AniList data)
    async getHiAnimeSpotlight() {
        try {
            const res = await fetch(`${API_BASE}/hianime/spotlight`);
            if (!res.ok) throw new Error('Failed to fetch HiAnime spotlight');
            const { spotlight } = await res.json();

            // Map to Anime interface
            const data = spotlight.map((item: any) => {
                // Base metadata from AniList
                const anime = mapAnilistToAnime(item.anilist || {});

                // Override images with HiAnime high-res versions
                if (item.banner) {
                    anime.anilist_banner_image = item.banner;
                }
                if (item.poster) {
                    anime.images.jpg.large_image_url = item.poster;
                    // Also update coverImage reference if used
                    anime.anilist_cover_image = item.poster;
                }
                return anime;
            });

            return { data };
        } catch (error) {
            console.error('Error in getHiAnimeSpotlight:', error);
            // Fallback to trending
            return this.getTrendingAnime();
        }
    },

    // Search AniList (returns raw AniList data for spotlight resolution)
    async searchAnilist(query: string) {
        const res = await fetch(`${API_BASE}/anilist/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query }),
        });
        return res.json();
    },

    // Get trending anime from AniList (Deduplicated)
    async getTrendingAnime(page: number = 1, limit: number = 10) {
        const cacheKey = `trending-${page}-${limit}`;
        const cached = getCached(cacheKey);
        if (cached) return cached;

        if (inFlightRequests.has(cacheKey)) {
            return inFlightRequests.get(cacheKey);
        }

        const fetchPromise = (async () => {
            try {
                const res = await fetch(`${API_BASE}/anilist/trending?page=${page}&limit=${limit}`);
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
                    setCache(cacheKey, result);
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
    async getAiringSchedule(start: number, end: number) {
        const res = await fetch(`${API_BASE}/anilist/schedule?start=${start}&end=${end}`);
        if (!res.ok) throw new Error('Failed to fetch schedule');
        return res.json();
    },

    // Get list of genres
    async getGenres() {
        const res = await fetch(`${API_BASE}/anilist/genres`);
        if (!res.ok) throw new Error('Failed to fetch genres');
        return res.json();
    },

    // Get random anime (Client-side pool for speed)
    async getRandomAnime() {
        // If queue is empty or running low, trigger a refill if not already happening
        if (randomAnimeQueue.length === 0) {
            if (!refillPromise) {
                refillPromise = (async () => {
                    try {
                        const res = await fetch(`${API_BASE}/anilist/random`);
                        if (!res.ok) throw new Error('Failed to fetch random anime batch');
                        const batch = await res.json();

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

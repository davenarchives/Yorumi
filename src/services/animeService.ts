// API Service for Anime operations - Using AniList
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

export const animeService = {
    // Fetch top anime from AniList
    async getTopAnime(page: number = 1) {
        const cacheKey = `top-anime-${page}`;
        const cached = getCached(cacheKey);
        if (cached) return cached;

        const res = await fetch(`${API_BASE}/anilist/top?page=${page}&limit=18`);
        const data = await res.json();
        const result = {
            data: data.media?.map(mapAnilistToAnime) || [],
            pagination: {
                last_visible_page: data.pageInfo?.lastPage || 1,
                current_page: data.pageInfo?.currentPage || 1,
                has_next_page: data.pageInfo?.hasNextPage || false
            }
        };

        setCache(cacheKey, result);
        return result;
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

    // Get anime details from AniList
    async getAnimeDetails(id: number) {
        const res = await fetch(`${API_BASE}/anilist/anime/${id}`);
        const data = await res.json();
        if (!data || data.error) return { data: null };
        return { data: mapAnilistToAnime(data) };
    },

    // Search anime on scraper (HiAnime)
    async searchScraper(title: string) {
        const res = await fetch(`${API_BASE}/scraper/search?q=${encodeURIComponent(title)}`);
        return res.json();
    },

    // Get popular this season from AniList
    async getPopularThisSeason(page: number = 1, limit: number = 10) {
        const cacheKey = `popular-season-${page}-${limit}`;
        const cached = getCached(cacheKey);
        if (cached) return cached;

        const res = await fetch(`${API_BASE}/anilist/popular-this-season?page=${page}&limit=${limit}`);
        const data = await res.json();
        const result = {
            data: data.media?.map(mapAnilistToAnime) || [],
            pagination: {
                last_visible_page: data.pageInfo?.lastPage || 1,
                current_page: data.pageInfo?.currentPage || 1,
                has_next_page: data.pageInfo?.hasNextPage || false
            }
        };
        setCache(cacheKey, result);
        return result;
    },

    // Get episodes from scraper
    async getEpisodes(session: string) {
        const res = await fetch(`${API_BASE}/scraper/episodes?session=${session}`);
        return res.json();
    },

    // Get stream links from scraper
    async getStreams(animeSession: string, episodeSession: string) {
        const res = await fetch(`${API_BASE}/scraper/streams?anime_session=${animeSession}&ep_session=${episodeSession}`);
        return res.json();
    },

    // Get HiAnime spotlight titles
    async getHiAnimeSpotlightTitles() {
        const res = await fetch(`${API_BASE}/hianime/spotlight`);
        return res.json();
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

    // Get trending anime from AniList
    async getTrendingAnime(page: number = 1, limit: number = 10) {
        const cacheKey = `trending-${page}-${limit}`;
        const cached = getCached(cacheKey);
        if (cached) return cached;

        const res = await fetch(`${API_BASE}/anilist/trending?page=${page}&limit=${limit}`);
        const data = await res.json(); // backend returns { media, pageInfo } structure for these endpoints?
        // Wait, backend anilist.service.ts returns response.data.data.Page which has fields 'media' and 'pageInfo'.
        // Frontend anilist.routes.ts sends back `data` which IS the Page object.
        const result = {
            data: data.media?.map(mapAnilistToAnime) || [],
            pagination: {
                last_visible_page: data.pageInfo?.lastPage || 1,
                current_page: data.pageInfo?.currentPage || 1,
                has_next_page: data.pageInfo?.hasNextPage || false
            }
        };
        setCache(cacheKey, result);
        return result;
    },
};

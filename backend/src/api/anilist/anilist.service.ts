import axios from 'axios';
import { redis } from '../mapping/mapper';

const ANILIST_API_URL = 'https://graphql.anilist.co';

// ============================================================================
// CACHING LAYER - Reduces API calls by caching responses
// ============================================================================
interface CacheEntry {
    data: any;
    timestamp: number;
    ttl: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = {
    trending: 5 * 60 * 1000,      // 5 minutes for trending
    seasonal: 10 * 60 * 1000,     // 10 minutes for seasonal
    popular: 30 * 60 * 1000,      // 30 minutes for all-time popular
    top: 30 * 60 * 1000,          // 30 minutes for top rated
    search: 5 * 60 * 1000,        // 5 minutes for search results
    details: 60 * 60 * 1000,      // 1 hour for anime/manga details
    schedule: 5 * 60 * 1000,      // 5 minutes for schedule
    default: 10 * 60 * 1000       // 10 minutes default
};

function getCacheKey(type: string, ...args: any[]): string {
    return `${type}:${JSON.stringify(args)}`;
}

function getFromCache(key: string): any | null {
    const entry = cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
        cache.delete(key);
        return null;
    }

    return entry.data;
}

function setCache(key: string, data: any, ttl: number): void {
    cache.set(key, { data, timestamp: Date.now(), ttl });

    // Clean old entries periodically (keep cache size manageable)
    if (cache.size > 100) {
        const now = Date.now();
        for (const [k, v] of cache.entries()) {
            if (now - v.timestamp > v.ttl) {
                cache.delete(k);
            }
        }
    }
}

// ============================================================================
// RATE LIMITING - Prevents hitting AniList's rate limit
// ============================================================================
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 500; // 500ms between requests (max 2/sec)

async function rateLimitedRequest(query: string, variables: any): Promise<any> {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;

    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
        await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
    }

    lastRequestTime = Date.now();

    try {
        const response = await axios.post(ANILIST_API_URL, { query, variables });
        return response.data;
    } catch (error: any) {
        // Handle rate limit error specifically
        if (error.response?.status === 429) {
            console.warn('AniList rate limit hit, waiting 60 seconds...');
            await new Promise(resolve => setTimeout(resolve, 60000));
            // Retry once after waiting
            const response = await axios.post(ANILIST_API_URL, { query, variables });
            return response.data;
        }
        throw error;
    }
}

// Common media fields fragment
const MEDIA_FIELDS = `
    id
    idMal
    title {
        romaji
        english
        native
    }
    description
    bannerImage
    coverImage {
        extraLarge
        large
    }
    format
    episodes
    chapters
    volumes
    duration
    status
    season
    seasonYear
    startDate {
        year
        month
        day
    }
    endDate {
        year
        month
        day
    }
    averageScore
    meanScore
    popularity
    genres
    studios(isMain: true) {
        nodes {
            name
        }
    }
    isAdult
    countryOfOrigin
    nextAiringEpisode {
        episode
        airingAt
    }
    streamingEpisodes {
        title
        thumbnail
        url
        site
    }
    synonyms
    staff(perPage: 3, sort: [RELEVANCE, ID]) {
        edges {
            role
            node {
                name {
                    full
                }
            }
        }
    }
`;


export const anilistService = {
    async getCoverImages(malIds: number[]) {
        const query = `
            query ($idMal: [Int]) {
                Page {
                    media(idMal_in: $idMal, type: ANIME) {
                        idMal
                        bannerImage
                        coverImage {
                            extraLarge
                            large
                        }
                    }
                }
            }
        `;

        try {
            const response = await axios.post(ANILIST_API_URL, {
                query,
                variables: { idMal: malIds }
            });

            return response.data.data.Page.media;
        } catch (error) {
            console.error('Error fetching AniList images:', error);
            return [];
        }
    },

    async getTrendingAnime(page: number = 1, perPage: number = 10) {
        const cacheKey = getCacheKey('trending_anime', page, perPage);
        const cached = getFromCache(cacheKey);
        if (cached) return cached;

        const query = `
            query ($page: Int, $perPage: Int) {
                Page(page: $page, perPage: $perPage) {
                    pageInfo {
                        total
                        currentPage
                        lastPage
                        hasNextPage
                    }
                    media(type: ANIME, sort: TRENDING_DESC, isAdult: false) {
                        ${MEDIA_FIELDS}
                    }
                }
            }
        `;

        try {
            const response = await rateLimitedRequest(query, { page, perPage });
            const result = response.data.Page;
            setCache(cacheKey, result, CACHE_TTL.trending);
            return result;
        } catch (error) {
            console.error('Error fetching trending anime:', error);
            return { media: [], pageInfo: {} };
        }
    },

    async getPopularThisSeason(page: number = 1, perPage: number = 10) {
        // Get current season and year
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();
        let season: string;
        if (month >= 1 && month <= 3) season = 'WINTER';
        else if (month >= 4 && month <= 6) season = 'SPRING';
        else if (month >= 7 && month <= 9) season = 'SUMMER';
        else season = 'FALL';

        const cacheKey = getCacheKey('popular_season', page, perPage, season, year);
        const cached = getFromCache(cacheKey);
        if (cached) return cached;

        const query = `
            query ($page: Int, $perPage: Int, $season: MediaSeason, $seasonYear: Int) {
                Page(page: $page, perPage: $perPage) {
                    pageInfo {
                        total
                        currentPage
                        lastPage
                        hasNextPage
                    }
                    media(type: ANIME, season: $season, seasonYear: $seasonYear, sort: POPULARITY_DESC, isAdult: false) {
                        ${MEDIA_FIELDS}
                    }
                }
            }
        `;

        try {
            const response = await rateLimitedRequest(query, { page, perPage, season, seasonYear: year });
            const result = response.data.Page;
            setCache(cacheKey, result, CACHE_TTL.seasonal);
            return result;
        } catch (error) {
            console.error('Error fetching popular this season:', error);
            return { media: [], pageInfo: {} };
        }
    },

    async getMangaAZList(letter: string, page: number = 1, perPage: number = 18) {
        const isAll = letter.toLowerCase() === 'all' || !letter;
        const isSpecial = letter === '#' || letter === '0-9';

        // If "All" or Special chars, start from page 1
        if (isAll || isSpecial) {
            const query = `
                query ($page: Int, $perPage: Int) {
                    Page(page: $page, perPage: $perPage) {
                        pageInfo { total currentPage lastPage hasNextPage }
                        media(type: MANGA, sort: TITLE_ROMAJI, isAdult: false) {
                            ${MEDIA_FIELDS}
                        }
                    }
                }
            `;
            try {
                const response = await rateLimitedRequest(query, { page, perPage });
                return response.data.Page;
            } catch (error) {
                console.error('Error fetching Manga All/#:', error);
                return { media: [], pageInfo: {} };
            }
        }

        // For Letters A-Z: Find the start page
        const startPage = await this.findStartPage(letter);
        if (startPage === -1) return { media: [], pageInfo: {} };

        // Calculate target page
        // If user wants page 1, we fetch startPage.
        // page 2 -> startPage + 1
        const targetPage = startPage + (page - 1);

        const query = `
            query ($page: Int, $perPage: Int) {
                Page(page: $page, perPage: $perPage) {
                    pageInfo { total currentPage lastPage hasNextPage }
                    media(type: MANGA, sort: TITLE_ROMAJI, isAdult: false) {
                        ${MEDIA_FIELDS}
                    }
                }
            }
        `;

        try {
            const response = await rateLimitedRequest(query, { page: targetPage, perPage });
            const pageData = response.data.Page;

            // Filter strictly by letter
            // But wait, if we filter, the page size shrinks.
            // Paging might be inconsistent if we just drop items.
            // Client expects 18 items. If we return 5, it assumes end of list?
            // To do this properly, we might need to fetch more and buffer?
            // For now, returning filtered list is better than wrong list.

            const filteredMedia = pageData.media.filter((m: any) => {
                const title = m.title.romaji || m.title.english || '';
                return title.toUpperCase().startsWith(letter.toUpperCase());
            });

            // If we filtered out everything but there ARE items for this letter (just on prev/next pages?)
            // Our binary search finds the FIRST page containing the letter (or close to it).
            // So title >= letter.

            // Should accurate hasNextPage
            // If the last item on this page starts with Letter, there is likely a next page.
            // If the last item starts with Next Letter, then no next page for THIS letter.

            const lastItem = pageData.media[pageData.media.length - 1];
            const lastTitle = lastItem?.title?.romaji || '';
            const hasMoreOfLetter = lastTitle.toUpperCase().startsWith(letter.toUpperCase());

            return {
                media: filteredMedia,
                pageInfo: {
                    ...pageData.pageInfo,
                    hasNextPage: hasMoreOfLetter && pageData.pageInfo.hasNextPage
                }
            };
        } catch (error) {
            console.error('Error fetching Manga A-Z:', error);
            return { media: [], pageInfo: {} };
        }
    },

    async getAnimeAZList(letter: string, page: number = 1, perPage: number = 18) {
        const isAll = letter.toLowerCase() === 'all' || !letter;
        const isSpecial = letter === '#' || letter === '0-9';

        if (isAll || isSpecial) {
            const query = `
                query ($page: Int, $perPage: Int) {
                    Page(page: $page, perPage: $perPage) {
                        pageInfo { total currentPage lastPage hasNextPage }
                        media(type: ANIME, sort: TITLE_ROMAJI, isAdult: false) {
                            ${MEDIA_FIELDS}
                        }
                    }
                }
            `;
            try {
                const response = await rateLimitedRequest(query, { page, perPage });
                return response.data.Page;
            } catch (error) {
                console.error('Error fetching Anime All/#:', error);
                return { media: [], pageInfo: {} };
            }
        }

        const startPage = await this.findStartPage(letter, 'ANIME');
        if (startPage === -1) return { media: [], pageInfo: {} };

        const targetPage = startPage + (page - 1);
        const query = `
            query ($page: Int, $perPage: Int) {
                Page(page: $page, perPage: $perPage) {
                    pageInfo { total currentPage lastPage hasNextPage }
                    media(type: ANIME, sort: TITLE_ROMAJI, isAdult: false) {
                        ${MEDIA_FIELDS}
                    }
                }
            }
        `;

        try {
            const response = await rateLimitedRequest(query, { page: targetPage, perPage });
            const pageData = response.data.Page;

            const filteredMedia = pageData.media.filter((m: any) => {
                const title = m.title.romaji || m.title.english || '';
                return title.toUpperCase().startsWith(letter.toUpperCase());
            });

            const lastItem = pageData.media[pageData.media.length - 1];
            const lastTitle = lastItem?.title?.romaji || '';
            const hasMoreOfLetter = lastTitle.toUpperCase().startsWith(letter.toUpperCase());

            return {
                media: filteredMedia,
                pageInfo: {
                    ...pageData.pageInfo,
                    hasNextPage: hasMoreOfLetter && pageData.pageInfo.hasNextPage
                }
            };
        } catch (error) {
            console.error('Error fetching Anime A-Z:', error);
            return { media: [], pageInfo: {} };
        }
    },

    // Cache for start pages: 'A' -> 150
    async findStartPage(letter: string, type: 'ANIME' | 'MANGA' = 'MANGA'): Promise<number> {
        const cacheKey = `start_page_${type}_${letter}`;
        const cached = getFromCache(cacheKey);
        if (cached !== null) return cached;

        console.log(`[Indexer] Finding start page for "${letter}"...`);

        // Binary Search
        // We need an upper bound. 3000 is safe estimate for now, or fetch page 1 to get lastPage.
        // Let's first fetch page 1 to get metadata
        let min = 1;
        let max = 5000; // refined from probe?

        try {
            // Get real max
            const query = `query { Page(page: 1, perPage: 1) { pageInfo { lastPage } } }`;
            const res = await rateLimitedRequest(query, {});
            max = res.data.Page.pageInfo.lastPage;
        } catch (e) { console.error("Indexer init failed", e); return 1; }

        let startPage = -1;

        while (min <= max) {
            const mid = Math.floor((min + max) / 2);

            // Check title at mid
            const query = `
                query ($page: Int) {
                    Page(page: $page, perPage: 1) {
                        media(type: ${type}, sort: TITLE_ROMAJI, isAdult: false) {
                            title { romaji }
                        }
                    }
                }
            `;

            try {
                const res = await rateLimitedRequest(query, { page: mid });
                const media = res.data.Page.media[0];
                if (!media) { max = mid - 1; continue; }

                const title = (media.title.romaji || '').toUpperCase();
                // We want first page where title >= letter

                // Compare
                // title "Aaron" vs "B" -> "Aaron" < "B" -> too early -> min = mid + 1
                // title "Cathy" vs "B" -> "Cathy" > "B" -> too late (potentially) -> max = mid - 1, but save as candidate

                // We want the insertion point.
                // Actually, just simple string compare.

                // Special case: First char comparison
                const firstChar = title.charAt(0);

                if (title < letter.toUpperCase()) {
                    // Too early
                    min = mid + 1;
                } else {
                    // Title >= Letter
                    // This could be the start page, or a page after the start.
                    startPage = mid;
                    max = mid - 1;
                }

                // Optimization: If exact match of first char?
                // No, "Aaron" starts with A, "Az" starts with A.
                // If we are looking for "B". "Az" < "B".
                // If we are looking for "A". "Az" >= "A". 
                // Wait. "Az" > "A". 
                // If title is "Az", and we want "A". Correct.

            } catch (e) {
                console.error(`Error probing page ${mid}:`, e);
                // Assume temporary error, break or retry?
                // Return fallback 1
                return 1;
            }
        }

        console.log(`[Indexer] Found start page for ${letter}: ${startPage}`);
        setCache(cacheKey, startPage, 24 * 60 * 60 * 1000); // Cache 24h
        return startPage;
    },

    async getTopAnime(page: number = 1, perPage: number = 24) {
        const cacheKey = getCacheKey('top_anime', page, perPage);
        const cached = getFromCache(cacheKey);
        if (cached) return cached;

        const query = `
            query ($page: Int, $perPage: Int) {
                Page(page: $page, perPage: $perPage) {
                    pageInfo {
                        total
                        currentPage
                        lastPage
                        hasNextPage
                    }
                    media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) {
                        ${MEDIA_FIELDS}
                    }
                }
            }
        `;

        try {
            const response = await rateLimitedRequest(query, { page, perPage });
            const result = response.data.Page;
            setCache(cacheKey, result, CACHE_TTL.popular);
            return result;
        } catch (error) {
            console.error('Error fetching top anime:', error);
            throw error;
        }
    },

    async getTopManga(page: number = 1, perPage: number = 24) {
        const cacheKey = getCacheKey('top_manga', page, perPage);
        const cached = getFromCache(cacheKey);
        if (cached) return cached;

        const query = `
            query ($page: Int, $perPage: Int) {
                Page(page: $page, perPage: $perPage) {
                    pageInfo {
                        total
                        currentPage
                        lastPage
                        hasNextPage
                    }
                    media(type: MANGA, sort: SCORE_DESC, isAdult: false) {
                        ${MEDIA_FIELDS}
                    }
                }
            }
        `;

        try {
            const response = await rateLimitedRequest(query, { page, perPage });
            const result = response.data.Page;
            setCache(cacheKey, result, CACHE_TTL.top);
            return result;
        } catch (error) {
            console.error('Error fetching top manga:', error);
            return { media: [], pageInfo: {} };
        }
    },

    async getPopularManga(page: number = 1, perPage: number = 24) {
        const cacheKey = getCacheKey('popular_manga', page, perPage);
        const cached = getFromCache(cacheKey);
        if (cached) return cached;

        const query = `
            query ($page: Int, $perPage: Int) {
                Page(page: $page, perPage: $perPage) {
                    pageInfo {
                        total
                        currentPage
                        lastPage
                        hasNextPage
                    }
                    media(type: MANGA, sort: POPULARITY_DESC, isAdult: false) {
                        ${MEDIA_FIELDS}
                    }
                }
            }
        `;

        try {
            const response = await rateLimitedRequest(query, { page, perPage });
            const result = response.data.Page;
            setCache(cacheKey, result, CACHE_TTL.popular);
            return result;
        } catch (error) {
            console.error('Error fetching popular manga:', error);
            return { media: [], pageInfo: {} };
        }
    },

    async getTrendingManga(page: number = 1, perPage: number = 10) {
        const cacheKey = getCacheKey('trending_manga', page, perPage);
        const cached = getFromCache(cacheKey);
        if (cached) return cached;

        const query = `
            query ($page: Int, $perPage: Int) {
                Page(page: $page, perPage: $perPage) {
                    pageInfo {
                        total
                        currentPage
                        lastPage
                        hasNextPage
                    }
                    media(type: MANGA, sort: TRENDING_DESC, isAdult: false) {
                        ${MEDIA_FIELDS}
                    }
                }
            }
        `;

        try {
            const response = await rateLimitedRequest(query, { page, perPage });
            const result = response.data.Page;
            setCache(cacheKey, result, CACHE_TTL.trending);
            return result;
        } catch (error) {
            console.error('Error fetching trending manga:', error);
            return { media: [], pageInfo: {} };
        }
    },

    async getMediaDetails(id: number) {
        const cacheKey = getCacheKey('media_details', id);
        const cached = getFromCache(cacheKey);
        if (cached) return cached;

        const query = `
            query ($id: Int) {
                Media(id: $id) {
                    ${MEDIA_FIELDS}
                }
            }
        `;

        try {
            const response = await rateLimitedRequest(query, { id });
            const result = response.data.Media;
            setCache(cacheKey, result, CACHE_TTL.details);
            return result;
        } catch (error) {
            console.error('Error fetching media details:', error);
            return null;
        }
    },

    async getPopularManhwa(page: number = 1, perPage: number = 24) {
        const cacheKey = getCacheKey('popular_manhwa', page, perPage);
        const cached = getFromCache(cacheKey);
        if (cached) return cached;

        const query = `
            query ($page: Int, $perPage: Int) {
                Page(page: $page, perPage: $perPage) {
                    pageInfo {
                        total
                        currentPage
                        lastPage
                        hasNextPage
                    }
                    media(type: MANGA, countryOfOrigin: "KR", sort: POPULARITY_DESC, isAdult: false) {
                        ${MEDIA_FIELDS}
                    }
                }
            }
        `;

        try {
            const response = await rateLimitedRequest(query, { page, perPage });
            const result = response.data.Page;
            setCache(cacheKey, result, CACHE_TTL.popular);
            return result;
        } catch (error) {
            console.error('Error fetching popular manhwa:', error);
            return { media: [], pageInfo: {} };
        }
    },

    async getRandomAnime() {
        // Fetch a random page of 50 items from the top 5000 popular anime
        // 5000 / 50 per page = 100 pages
        const randomPage = Math.floor(Math.random() * 100) + 1;

        const query = `
            query ($page: Int) {
                Page(page: $page, perPage: 50) {
                    media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) {
                        id
                    }
                }
            }
        `;

        try {
            const response = await rateLimitedRequest(query, { page: randomPage });
            const mediaList = response.data.Page.media;
            // Return array of IDs or fallback
            return mediaList.length > 0 ? mediaList.map((m: any) => ({ id: m.id })) : [{ id: 1 }];
        } catch (error) {
            console.error('Error fetching random anime:', error);
            return [{ id: 1 }];
        }
    },

    async getRandomManga() {
        // Fetch a random page of 50 items from the top 5000 popular manga
        const randomPage = Math.floor(Math.random() * 100) + 1;

        const query = `
            query ($page: Int) {
                Page(page: $page, perPage: 50) {
                    media(type: MANGA, sort: POPULARITY_DESC, isAdult: false) {
                        id
                    }
                }
            }
        `;

        try {
            const response = await rateLimitedRequest(query, { page: randomPage });
            const mediaList = response.data.Page.media;
            return mediaList.length > 0 ? mediaList.map((m: any) => ({ id: m.id })) : [{ id: 1 }];
        } catch (error) {
            console.error('Error fetching random manga:', error);
            return [{ id: 1 }];
        }
    },

    async searchAnime(search: string, page: number = 1, perPage: number = 24) {
        const cacheKey = `search:anime:${search.toLowerCase().trim()}:${page}:${perPage}`;

        // 1. Check Cache
        try {
            const cachedResult = await redis.get(cacheKey);
            if (cachedResult) {
                console.log(`⚡ Cache Hit (Search): ${search}`);
                return cachedResult;
            }
        } catch (error) {
            console.error('Redis Error (Get):', error);
        }

        const query = `
            query ($search: String, $page: Int, $perPage: Int) {
                Page(page: $page, perPage: $perPage) {
                    pageInfo {
                        total
                        currentPage
                        lastPage
                        hasNextPage
                    }
                    media(search: $search, type: ANIME, sort: SEARCH_MATCH, isAdult: false) {
                        ${MEDIA_FIELDS}
                    }
                }
            }
        `;

        try {
            const response = await axios.post(ANILIST_API_URL, {
                query,
                variables: { search, page, perPage }
            });

            const data = response.data.data.Page;

            // 2. Set Cache (24 hours)
            try {
                await redis.set(cacheKey, data, { ex: 86400 });
            } catch (error) {
                console.error('Redis Error (Set):', error);
            }

            return data;
        } catch (error) {
            console.error('Error searching anime:', error);
            throw error;
        }
    },

    async searchManga(search: string, page: number = 1, perPage: number = 24) {
        const query = `
            query ($search: String, $page: Int, $perPage: Int) {
                Page(page: $page, perPage: $perPage) {
                    pageInfo {
                        total
                        currentPage
                        lastPage
                        hasNextPage
                    }
                    media(search: $search, type: MANGA, sort: SEARCH_MATCH, isAdult: false) {
                        ${MEDIA_FIELDS}
                    }
                }
            }
        `;

        try {
            const response = await axios.post(ANILIST_API_URL, {
                query,
                variables: { search, page, perPage }
            });

            return response.data.data.Page;
        } catch (error) {
            console.error('Error searching manga:', error);
            return { media: [], pageInfo: {} };
        }
    },

    async getAnimeById(id: number) {
        const query = `
            query ($id: Int) {
                Media(id: $id, type: ANIME) {
                    ${MEDIA_FIELDS}
                    relations {
                        edges {
                            relationType
                            node {
                                id
                                title { romaji english }
                                coverImage { large }
                                format
                                isAdult
                            }
                        }
                    }
                    recommendations(perPage: 6) {
                        nodes {
                            mediaRecommendation {
                                id
                                title { romaji english }
                                coverImage { large }
                                isAdult
                            }
                        }
                    }
                    trailer {
                        id
                        site
                        thumbnail
                    }
                    characters(sort: [ROLE, RELEVANCE, ID], perPage: 12) {
                        edges {
                            role
                            node {
                                id
                                name { full }
                                image { large }
                            }
                            voiceActors(language: JAPANESE, sort: [RELEVANCE, ID]) {
                                id
                                name { full }
                                image { large }
                                languageV2
                            }
                        }
                    }
                }
            }
        `;

        try {
            const response = await axios.post(ANILIST_API_URL, {
                query,
                variables: { id }
            });

            const media = response.data.data.Media;
            if (media && media.recommendations && media.recommendations.nodes) {
                media.recommendations.nodes = media.recommendations.nodes.filter((node: any) => !node.mediaRecommendation?.isAdult);
            }
            if (media && media.recommendations && media.recommendations.nodes) {
                media.recommendations.nodes = media.recommendations.nodes.filter((node: any) => !node.mediaRecommendation?.isAdult);
            }
            if (media && media.relations && media.relations.edges) {
                media.relations.edges = media.relations.edges.filter((edge: any) => !edge.node?.isAdult);
            }
            return media;
        } catch (error) {
            console.error('Error fetching anime by ID:', error);
            return null;
        }
    },

    async getMangaById(id: number) {
        console.log('getMangaById called with:', id);
        const query = `
            query ($id: Int) {
                Media(id: $id, type: MANGA) {
                    ${MEDIA_FIELDS}
                    relations {
                        edges {
                            relationType
                            node {
                                id
                                title { romaji english }
                                coverImage { large }
                                format
                                type
                                isAdult
                            }
                        }
                    }
                    recommendations(perPage: 6) {
                        nodes {
                            mediaRecommendation {
                                id
                                title { romaji english }
                                coverImage { large }
                                type
                                isAdult
                            }
                        }
                    }
                    characters(sort: [ROLE, RELEVANCE, ID], perPage: 12) {
                        edges {
                            role
                            node {
                                id
                                name { full }
                                image { large }
                            }
                        }
                    }
                }
            }
        `;

        try {
            const response = await axios.post(ANILIST_API_URL, {
                query,
                variables: { id }
            });

            const media = response.data.data.Media;
            if (media && media.recommendations && media.recommendations.nodes) {
                media.recommendations.nodes = media.recommendations.nodes.filter((node: any) => !node.mediaRecommendation?.isAdult);
            }
            if (media && media.relations && media.relations.edges) {
                media.relations.edges = media.relations.edges.filter((edge: any) => !edge.node?.isAdult);
            }
            return media;
        } catch (error) {
            console.error('Error fetching manga by ID:', error);
            return null;
        }
    },

    async getAiringSchedule(startTime: number, endTime: number) {
        const query = `
            query ($airingAtGreater: Int, $airingAtLesser: Int) {
                Page(page: 1, perPage: 50) {
                    airingSchedules(airingAt_greater: $airingAtGreater, airingAt_lesser: $airingAtLesser, sort: TIME) {
                        id
                        airingAt
                        episode
                        media {
                            id
                            idMal
                            title {
                                romaji
                                english
                            }
                            coverImage {
                                large
                            }
                            format
                            isAdult
                        }
                    }
                }
            }
        `;

        try {
            const response = await axios.post(ANILIST_API_URL, {
                query,
                variables: { airingAtGreater: startTime, airingAtLesser: endTime }
            });
            // Filter out adult content
            const schedules = response.data.data.Page.airingSchedules.filter(
                (s: any) => !s.media.isAdult
            );
            return schedules;
        } catch (error) {
            console.error('Error fetching airing schedule:', error);
            return [];
        }
    },

    getGenres() {
        // Static list of common anime genres with colors
        return [
            { name: 'Action', color: '#ef4444' },
            { name: 'Adventure', color: '#f97316' },
            { name: 'Comedy', color: '#eab308' },
            { name: 'Drama', color: '#84cc16' },
            { name: 'Fantasy', color: '#22c55e' },
            { name: 'Horror', color: '#14b8a6' },
            { name: 'Mystery', color: '#06b6d4' },
            { name: 'Romance', color: '#ec4899' },
            { name: 'Sci-Fi', color: '#8b5cf6' },
            { name: 'Slice of Life', color: '#a855f7' },
            { name: 'Sports', color: '#f43f5e' },
            { name: 'Supernatural', color: '#6366f1' },
            { name: 'Thriller', color: '#64748b' },
            { name: 'Mecha', color: '#78716c' },
            { name: 'Music', color: '#d946ef' },
            { name: 'Psychological', color: '#0ea5e9' },
            { name: 'Ecchi', color: '#fb7185' },
            { name: 'Isekai', color: '#4ade80' },
        ];
    },

    async getAnimeByGenre(genre: string, page: number = 1, perPage: number = 24) {
        const query = `
            query ($genre: String, $page: Int, $perPage: Int) {
                Page(page: $page, perPage: $perPage) {
                    pageInfo {
                        total
                        currentPage
                        lastPage
                        hasNextPage
                    }
                    media(type: ANIME, genre: $genre, sort: POPULARITY_DESC, isAdult: false) {
                        ${MEDIA_FIELDS}
                    }
                }
            }
        `;

        try {
            const response = await axios.post(ANILIST_API_URL, {
                query,
                variables: { genre, page, perPage }
            });
            return response.data.data.Page;
        } catch (error) {
            console.error('Error fetching anime by genre:', error);
            return { media: [], pageInfo: {} };
        }
    },

    async getMangaByGenre(genre: string, page: number = 1, perPage: number = 24) {
        const query = `
            query ($genre: String, $page: Int, $perPage: Int) {
                Page(page: $page, perPage: $perPage) {
                    pageInfo {
                        total
                        currentPage
                        lastPage
                        hasNextPage
                    }
                    media(type: MANGA, genre: $genre, sort: POPULARITY_DESC, isAdult: false) {
                        ${MEDIA_FIELDS}
                    }
                }
            }
        `;

        try {
            const response = await axios.post(ANILIST_API_URL, {
                query,
                variables: { genre, page, perPage }
            });
            return response.data.data.Page;
        } catch (error) {
            console.error('Error fetching manga by genre:', error);
            return { media: [], pageInfo: {} };
        }
    }
};

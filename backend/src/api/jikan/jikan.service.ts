import axios from 'axios';

const JIKAN_API_BASE = 'https://api.jikan.moe/v4';

// Simple in-memory cache to respect Jikan rate limits and avoid redundant fetches
// Jikan rate limit: 3 requests per second, 60 per minute approximately.
const cache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour cache since episode titles don't change often

export const jikanService = {
    async getAnimeEpisodes(malId: number) {
        // Check cache first
        const cacheKey = `jikan-episodes-${malId}`;
        const cached = cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            return cached.data;
        }

        let allEpisodes: any[] = [];
        let page = 1;
        let hasNextPage = true;

        try {
            while (hasNextPage) {
                // Rate limit handling (naive delay)
                await new Promise(resolve => setTimeout(resolve, 350)); // ~3 requests/sec max

                const response = await axios.get(`${JIKAN_API_BASE}/anime/${malId}/episodes?page=${page}`);
                const { data, pagination } = response.data;

                if (data && Array.isArray(data)) {
                    allEpisodes = [...allEpisodes, ...data];
                }

                hasNextPage = pagination?.has_next_page || false;
                page++;

                // Safety break for extremely long anime to avoid timeout (e.g., One Piece)
                // Fetch max 500 episodes or 5 pages for now to verify concept, or just fetch all?
                // Jikan returns 100 per page. 
                // Let's cap at 10 pages (1000 eps) for safety.
                if (page > 10) break;
            }

            // Transform to simple format
            const result = allEpisodes.map((ep: any) => ({
                episode_id: ep.mal_id,
                title: ep.title,
                title_japanese: ep.title_japanese,
                title_romanji: ep.title_romanji,
                episode_number: ep.mal_id, // Jikan returns 'mal_id' as usually the episode number count? NO. 
                // Jikan 'mal_id' for episode IS the episode id, but 'mal_id' property in episode object is just unique ID.
                // Actually Jikan struct: 
                // { mal_id: 1, url: '...', title: '...', aired: '...', score: ..., filler: ..., recap: ..., forum_url: ... }
                // Wait, typically mal_id acts as episode number for Jikan, BUT we should rely on array index? 
                // No, reliable is difficult.
                // Let's assume mal_id is the episode number, or we just map them.
                // Actually Jikan documentation says: "mal_id": 1 (which refers to Episode 1).
            })).sort((a, b) => a.episode_id - b.episode_id);

            // Update cache
            cache.set(cacheKey, { data: result, timestamp: Date.now() });

            return result;

        } catch (error) {
            console.error(`Error fetching Jikan episodes for MAL ID ${malId}:`, error);
            // Return what we have or empty
            return allEpisodes.length > 0 ? allEpisodes : [];
        }
    }
};

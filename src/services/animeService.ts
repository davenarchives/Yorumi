// API Service for Anime operations
const API_BASE = 'http://localhost:3001/api';

export const animeService = {
    // Fetch top anime
    async getTopAnime(page: number = 1) {
        const res = await fetch(`${API_BASE}/jikan/top?page=${page}`);
        return res.json();
    },

    // Search anime
    async searchAnime(query: string, page: number = 1) {
        const res = await fetch(`${API_BASE}/jikan/search?q=${encodeURIComponent(query)}&page=${page}`);
        return res.json();
    },

    // Get anime details
    async getAnimeDetails(malId: number) {
        const res = await fetch(`${API_BASE}/jikan/anime/${malId}`);
        return res.json();
    },

    // Search anime on scraper
    async searchScraper(title: string) {
        const res = await fetch(`${API_BASE}/scraper/search?q=${encodeURIComponent(title)}`);
        return res.json();
    },

    // Get episodes
    async getEpisodes(session: string) {
        const res = await fetch(`${API_BASE}/scraper/episodes?session=${session}`);
        return res.json();
    },

    // Get stream links
    async getStreams(animeSession: string, episodeSession: string) {
        const res = await fetch(`${API_BASE}/scraper/streams?anime_session=${animeSession}&ep_session=${episodeSession}`);
        return res.json();
    },
};

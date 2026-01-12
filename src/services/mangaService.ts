// API Service for Manga operations
const API_BASE = 'http://localhost:3001/api';

export const mangaService = {
    // Fetch top manga
    async getTopManga(page: number = 1) {
        const res = await fetch(`${API_BASE}/jikan/top/manga?page=${page}`);
        return res.json();
    },

    // Search manga
    async searchManga(query: string, page: number = 1) {
        const res = await fetch(`${API_BASE}/jikan/search/manga?q=${encodeURIComponent(query)}&page=${page}`);
        return res.json();
    },

    // Get manga chapters
    async getChapters(mangaId: string) {
        const res = await fetch(`${API_BASE}/manga/chapters/${encodeURIComponent(mangaId)}`);
        return res.json();
    },

    // Get chapter pages
    async getChapterPages(chapterUrl: string) {
        const res = await fetch(`${API_BASE}/manga/pages?url=${encodeURIComponent(chapterUrl)}`);
        return res.json();
    },

    // Search manga on scraper
    async searchMangaScraper(query: string) {
        const res = await fetch(`${API_BASE}/manga/search?q=${encodeURIComponent(query)}`);
        return res.json();
    },
};

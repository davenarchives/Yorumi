// API Service for Manga operations - Using AniList
const API_BASE = 'http://localhost:3001/api';

// Helper to map AniList response to our Manga interface format
const mapAnilistToManga = (item: any) => ({
    mal_id: item.idMal || item.id,
    title: item.title?.english || item.title?.romaji || item.title?.native || 'Unknown',
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
    authors: [],
    published: {
        from: item.startDate ? `${item.startDate.year}-${item.startDate.month}-${item.startDate.day}` : undefined,
        to: item.endDate ? `${item.endDate.year}-${item.endDate.month}-${item.endDate.day}` : undefined,
        string: item.startDate?.year ? `${item.startDate.year}` : undefined
    }
});

export const mangaService = {
    // Fetch top manga from AniList
    async getTopManga(page: number = 1) {
        const res = await fetch(`${API_BASE}/anilist/top/manga?page=${page}`);
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

    // Search manga via AniList
    async searchManga(query: string, page: number = 1) {
        const res = await fetch(`${API_BASE}/anilist/search/manga?q=${encodeURIComponent(query)}&page=${page}&limit=18`);
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

    // Get manga chapters from MangaKatana scraper
    async getChapters(mangaId: string) {
        const res = await fetch(`${API_BASE}/manga/chapters/${encodeURIComponent(mangaId)}`);
        return res.json();
    },

    // Get chapter pages from MangaKatana scraper
    async getChapterPages(chapterUrl: string) {
        const res = await fetch(`${API_BASE}/manga/pages?url=${encodeURIComponent(chapterUrl)}`);
        return res.json();
    },

    // Search manga on MangaKatana scraper
    async searchMangaScraper(query: string) {
        const res = await fetch(`${API_BASE}/manga/search?q=${encodeURIComponent(query)}`);
        return res.json();
    },
};

// API Service for Manga operations - Using AniList
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Helper to map AniList response to our Manga interface format
const mapAnilistToManga = (item: any) => ({
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
    authors: [],
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

export const mangaService = {
    // Fetch top manga from AniList (sorted by SCORE)
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

    // Fetch trending manga from AniList (sorted by TRENDING)
    async getTrendingManga(page: number = 1) {
        const res = await fetch(`${API_BASE}/anilist/trending/manga?page=${page}`);
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

    // Fetch all-time popular manga from AniList (sorted by POPULARITY)
    async getPopularManga(page: number = 1) {
        const res = await fetch(`${API_BASE}/anilist/popular/manga?page=${page}`);
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

    // Fetch popular manhwa from AniList
    async getPopularManhwa(page: number = 1) {
        const res = await fetch(`${API_BASE}/anilist/top/manhwa?page=${page}`);
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

    // Get manga details by ID
    async getMangaDetails(id: number | string) {
        try {
            const res = await fetch(`${API_BASE}/anilist/manga/${id}`);
            if (!res.ok) throw new Error('Failed to fetch details');
            const data = await res.json();
            return { data: mapAnilistToManga(data) };
        } catch (e) {
            console.error('getMangaDetails failed:', e);
            return { data: null };
        }
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

    async getHotUpdates() {
        const response = await fetch(`${API_BASE}/manga/hot-updates`);
        if (!response.ok) throw new Error('Failed to fetch hot updates');
        const data = await response.json();
        return data.data;
    },

    async prefetchChapters(urls: string[]) {
        try {
            await fetch(`${API_BASE}/manga/prefetch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ urls }),
            });
        } catch (err) {
            console.error('Prefetch failed', err);
        }
    },

    async getEnrichedSpotlight() {
        const res = await fetch(`${API_BASE}/manga/spotlight`);
        const data = await res.json();
        return {
            data: data.data?.map(mapAnilistToManga) || []
        };
    },

    // Get scraper details (fallback for string IDs)
    // Get scraper details (fallback for string IDs)
    async getScraperMangaDetails(id: string) {
        try {
            const res = await fetch(`${API_BASE}/manga/details/${encodeURIComponent(id)}`);
            const json = await res.json();
            const scraperData = json.data;

            if (!scraperData) return null;

            // 1. Attempt to resolve to AniList for rich metadata - DISABLED to prevent mismatches
            /*
            try {
                // Remove some common scraper noise from title if needed, or just use as is
                const searchRes = await this.searchManga(scraperData.title);
                const bestMatch = searchRes.data?.[0];

                if (bestMatch) {
                    const enrichedManga = { ...bestMatch };
                    if (scraperData.id) {
                        enrichedManga.scraper_id = scraperData.id;
                    }
                    return enrichedManga;
                }
            } catch (err) {
                console.warn('Failed to resolve scraper manga to AniList:', err);
            }
            */

            // 2. Fallback: Return mapped scraper data
            return {
                mal_id: scraperData.id, // Keep string ID
                title: scraperData.title,
                title_english: scraperData.altNames?.[0] || scraperData.title, // Attempt to populate alt titles
                title_romaji: scraperData.title,
                title_native: scraperData.altNames?.[scraperData.altNames?.length - 1],
                images: {
                    jpg: {
                        image_url: scraperData.coverImage || '',
                        large_image_url: scraperData.coverImage || ''
                    }
                },
                synopsis: scraperData.synopsis || 'No synopsis available from source.',
                type: 'Manga',
                status: scraperData.status || 'Unknown',
                chapters: scraperData.chapters?.length || 0,
                volumes: 0,
                score: 0,
                genres: scraperData.genres?.map((g: string) => ({ name: g, mal_id: 0 })) || [],
                countryOfOrigin: 'JP', // Assume JP
                authors: scraperData.author ? [{ name: scraperData.author, role: 'Story & Art' }] : [],
                published: { from: '', to: '', string: '' }
            } as any;
        } catch (error) {
            console.error('getScraperMangaDetails failed:', error);
            return null;
        }
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

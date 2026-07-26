import axios from 'axios';
import type { MangaSearchResult, MangaDetails, Chapter, ChapterPage, HotUpdate } from './mangakatana';

const BASE_URL = 'https://api.mangadex.org';
const UPLOADS_URL = 'https://uploads.mangadex.org';

const axiosInstance = axios.create({
    baseURL: BASE_URL,
    headers: {
        'User-Agent': 'Yorumi/1.3.1 (https://github.com/daven/yorumi)',
    },
    timeout: 15000,
});

const getCoverUrl = (mangaId: string, fileName: string) => {
    if (!fileName) return '';
    return `${UPLOADS_URL}/covers/${mangaId}/${fileName}.256.jpg`;
};

export async function searchManga(query: string): Promise<MangaSearchResult[]> {
    try {
        const res = await axiosInstance.get('/manga', {
            params: {
                title: query,
                'order[relevance]': 'desc',
                'includes[]': ['cover_art', 'author'],
                limit: 15
            }
        });
        
        return res.data.data.map((item: any) => {
            const coverRel = item.relationships.find((r: any) => r.type === 'cover_art');
            const authorRel = item.relationships.find((r: any) => r.type === 'author');
            
            return {
                id: item.id,
                title: item.attributes.title.en || Object.values(item.attributes.title)[0] || 'Unknown Title',
                url: `/manga/${item.id}`,
                thumbnail: coverRel ? getCoverUrl(item.id, coverRel.attributes?.fileName) : '',
                author: authorRel?.attributes?.name || '',
                source: 'mangadex'
            };
        });
    } catch (e) {
        console.error('[MangaDex] Search error:', e);
        return [];
    }
}

export async function getLatestManga(page: number = 1): Promise<{ results: MangaSearchResult[], totalPages: number }> {
    try {
        const limit = 20;
        const offset = (page - 1) * limit;
        const res = await axiosInstance.get('/manga', {
            params: {
                'order[updatedAt]': 'desc',
                'includes[]': ['cover_art'],
                limit,
                offset
            }
        });
        
        const results = res.data.data.map((item: any) => {
            const coverRel = item.relationships.find((r: any) => r.type === 'cover_art');
            return {
                id: item.id,
                title: item.attributes.title.en || Object.values(item.attributes.title)[0] || 'Unknown Title',
                url: `/manga/${item.id}`,
                thumbnail: coverRel ? getCoverUrl(item.id, coverRel.attributes?.fileName) : '',
                source: 'mangadex'
            };
        });
        
        const totalPages = Math.ceil(res.data.total / limit);
        return { results, totalPages };
    } catch (e) {
        return { results: [], totalPages: 0 };
    }
}

export async function getNewManga(page: number = 1): Promise<{ results: MangaSearchResult[], totalPages: number }> {
    try {
        const limit = 20;
        const offset = (page - 1) * limit;
        const res = await axiosInstance.get('/manga', {
            params: {
                'order[createdAt]': 'desc',
                'includes[]': ['cover_art'],
                limit,
                offset
            }
        });
        
        const results = res.data.data.map((item: any) => {
            const coverRel = item.relationships.find((r: any) => r.type === 'cover_art');
            return {
                id: item.id,
                title: item.attributes.title.en || Object.values(item.attributes.title)[0] || 'Unknown Title',
                url: `/manga/${item.id}`,
                thumbnail: coverRel ? getCoverUrl(item.id, coverRel.attributes?.fileName) : '',
                source: 'mangadex'
            };
        });
        
        const totalPages = Math.ceil(res.data.total / limit);
        return { results, totalPages };
    } catch (e) {
        return { results: [], totalPages: 0 };
    }
}

export async function getMangaDirectory(page: number = 1): Promise<{ results: MangaSearchResult[], totalPages: number }> {
    return getLatestManga(page);
}

export async function getMangaDetails(mangaId: string): Promise<MangaDetails> {
    try {
        const res = await axiosInstance.get(`/manga/${mangaId}`, {
            params: {
                'includes[]': ['cover_art', 'author']
            }
        });
        
        const item = res.data.data;
        const coverRel = item.relationships.find((r: any) => r.type === 'cover_art');
        const authorRel = item.relationships.find((r: any) => r.type === 'author');
        
        return {
            id: item.id,
            title: item.attributes.title.en || Object.values(item.attributes.title)[0] || 'Unknown Title',
            altNames: item.attributes.altTitles.map((t: any) => Object.values(t)[0]),
            author: authorRel?.attributes?.name || 'Unknown',
            status: item.attributes.status,
            genres: item.attributes.tags.filter((t: any) => t.attributes.group === 'genre').map((t: any) => t.attributes.name.en),
            synopsis: item.attributes.description.en || Object.values(item.attributes.description)[0] || '',
            coverImage: coverRel ? getCoverUrl(item.id, coverRel.attributes?.fileName) : '',
            url: `/manga/${item.id}`,
            source: 'mangadex' as any
        };
    } catch (error) {
        console.error('[MangaDex] Error fetching manga details:', error);
        throw error;
    }
}

export async function getChapterList(mangaId: string): Promise<Chapter[]> {
    try {
        let allChapters: Chapter[] = [];
        let offset = 0;
        const limit = 500;
        
        while (true) {
            const res = await axiosInstance.get(`/manga/${mangaId}/feed`, {
                params: {
                    'translatedLanguage[]': ['en'],
                    'order[chapter]': 'desc',
                    limit,
                    offset
                }
            });
            
            const chapters = res.data.data.map((item: any) => {
                let title = `Chapter ${item.attributes.chapter || '?'}`;
                if (item.attributes.title) {
                    title += `: ${item.attributes.title}`;
                }
                
                return {
                    id: item.id,
                    title,
                    url: `/chapter/${item.id}`,
                    uploadDate: new Date(item.attributes.readableAt).toLocaleDateString()
                };
            });
            
            allChapters = [...allChapters, ...chapters];
            
            if (res.data.total <= offset + limit) break;
            offset += limit;
        }
        
        return allChapters;
    } catch (e) {
        console.error('[MangaDex] Error fetching chapters:', e);
        return [];
    }
}

export async function getChapterPages(chapterId: string): Promise<ChapterPage[]> {
    try {
        // Strip out '/chapter/' if it was passed from url
        const id = chapterId.replace('/chapter/', '');
        const res = await axiosInstance.get(`/at-home/server/${id}`);
        const { baseUrl, chapter } = res.data;
        
        return chapter.data.map((filename: string, index: number) => ({
            pageNumber: index + 1,
            imageUrl: `${baseUrl}/data/${chapter.hash}/${filename}`
        }));
    } catch (e) {
        console.error('[MangaDex] Error fetching pages:', e);
        return [];
    }
}

export async function getHotUpdates(): Promise<HotUpdate[]> {
    // MangaDex doesn't have a direct "hot updates" endpoint that matches mangakatana's format exactly,
    // but we can fetch recently updated manga.
    try {
        const res = await axiosInstance.get('/manga', {
            params: {
                'order[updatedAt]': 'desc',
                'includes[]': ['cover_art'],
                limit: 15
            }
        });
        
        return res.data.data.map((item: any) => {
            const coverRel = item.relationships.find((r: any) => r.type === 'cover_art');
            return {
                id: item.id,
                title: item.attributes.title.en || Object.values(item.attributes.title)[0] || 'Unknown Title',
                chapter: 'Updated',
                url: `/manga/${item.id}`,
                thumbnail: coverRel ? getCoverUrl(item.id, coverRel.attributes?.fileName) : '',
                source: 'mangadex' as any
            };
        });
    } catch (e) {
        return [];
    }
}

import axios from 'axios';
import * as cheerio from 'cheerio';

const BASE_URL = 'https://mangakatana.com';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';

const axiosInstance = axios.create({
    baseURL: BASE_URL,
    headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': BASE_URL,
    },
    timeout: 15000,
});

export interface MangaSearchResult {
    id: string;
    title: string;
    url: string;
    thumbnail: string;
}

export interface MangaDetails {
    id: string;
    title: string;
    altNames: string[];
    author: string;
    status: string;
    genres: string[];
    synopsis: string;
    coverImage: string;
    url: string;
}

export interface Chapter {
    id: string;
    title: string;
    url: string;
    uploadDate: string;
}

export interface ChapterPage {
    pageNumber: number;
    imageUrl: string;
}

/**
 * Search for manga on MangaKatana
 */
export async function searchManga(query: string): Promise<MangaSearchResult[]> {
    try {
        const response = await axiosInstance.get('/', {
            params: {
                search: query,
                search_by: 'book_name',
            },
        });

        const $ = cheerio.load(response.data);
        const results: MangaSearchResult[] = [];

        $('#book_list > div.item').each((_, element) => {
            const $el = $(element);
            const linkEl = $el.find('div.text > h3 > a');
            const title = linkEl.text().trim();
            const url = linkEl.attr('href') || '';
            const thumbnail = $el.find('div.cover img').attr('src') || '';

            // Extract ID from URL (e.g., /manga/one-piece.12345 -> one-piece.12345)
            const id = url.replace(`${BASE_URL}/manga/`, '').replace(/\/$/, '');

            if (title && url) {
                results.push({ id, title, url, thumbnail });
            }
        });

        return results;
    } catch (error) {
        console.error('Error searching manga:', error);
        throw error;
    }
}

/**
 * Get manga details from MangaKatana
 */
export async function getMangaDetails(mangaId: string): Promise<MangaDetails> {
    try {
        const url = `${BASE_URL}/manga/${mangaId}`;
        const response = await axiosInstance.get(url);
        const $ = cheerio.load(response.data);

        const title = $('h1.heading').text().trim();
        const altNames = $('.alt_name').text().split(';').map(s => s.trim()).filter(Boolean);
        const author = $('.author').text().trim();
        const status = $('.value.status').text().trim();
        const genres = $('.genres > a').map((_, el) => $(el).text().trim()).get();
        const synopsis = $('.summary > p').text().trim();
        const coverImage = $('div.media div.cover img').attr('src') || '';

        return {
            id: mangaId,
            title,
            altNames,
            author,
            status,
            genres,
            synopsis,
            coverImage,
            url,
        };
    } catch (error) {
        console.error('Error fetching manga details:', error);
        throw error;
    }
}

/**
 * Get chapter list for a manga
 */
export async function getChapterList(mangaId: string): Promise<Chapter[]> {
    try {
        const url = `${BASE_URL}/manga/${mangaId}`;
        const response = await axiosInstance.get(url);
        const $ = cheerio.load(response.data);

        const chapters: Chapter[] = [];

        // Chapters are in table rows with .chapter class
        $('tr:has(.chapter)').each((_, element) => {
            const $el = $(element);
            const linkEl = $el.find('a');
            const chapterTitle = linkEl.text().trim();
            const chapterUrl = linkEl.attr('href') || '';
            const uploadDate = $el.find('.update_time').text().trim();

            // Extract chapter ID from URL
            const chapterId = chapterUrl.split('/').pop() || '';

            if (chapterTitle && chapterUrl) {
                chapters.push({
                    id: chapterId,
                    title: chapterTitle,
                    url: chapterUrl,
                    uploadDate,
                });
            }
        });

        return chapters;
    } catch (error) {
        console.error('Error fetching chapter list:', error);
        throw error;
    }
}

/**
 * Get page images for a chapter
 * MangaKatana uses JavaScript arrays for image loading, so we need to extract from script tags
 */
export async function getChapterPages(chapterUrl: string): Promise<ChapterPage[]> {
    try {
        const response = await axiosInstance.get(chapterUrl);
        const html = response.data;

        // Find the script containing image data
        // Looking for pattern: var thzq=['url1','url2',...]
        const scriptMatch = html.match(/var\s+\w+\s*=\s*\[([^\]]+)\]/);

        if (!scriptMatch) {
            // Fallback: try to find data-src pattern
            const dataSrcMatch = html.match(/data-src['"]\s*,\s*(\w+)/);
            if (dataSrcMatch) {
                const arrayName = dataSrcMatch[1];
                const arrayMatch = html.match(new RegExp(`var\\s+${arrayName}\\s*=\\s*\\[([^\\]]+)\\]`));
                if (arrayMatch) {
                    return extractImagesFromArray(arrayMatch[1]);
                }
            }

            // Try cheerio fallback for direct img tags
            const $ = cheerio.load(html);
            const pages: ChapterPage[] = [];
            $('#imgs img').each((index, el) => {
                const src = $(el).attr('data-src') || $(el).attr('src');
                if (src) {
                    pages.push({ pageNumber: index + 1, imageUrl: src });
                }
            });
            return pages;
        }

        return extractImagesFromArray(scriptMatch[1]);
    } catch (error) {
        console.error('Error fetching chapter pages:', error);
        throw error;
    }
}

/**
 * Helper to extract image URLs from a JavaScript array string
 */
function extractImagesFromArray(arrayContent: string): ChapterPage[] {
    const pages: ChapterPage[] = [];

    // Match single or double quoted strings
    const urlMatches = arrayContent.match(/['"]([^'"]+)['"]/g);

    if (urlMatches) {
        urlMatches.forEach((match, index) => {
            const url = match.replace(/['"]/g, '').trim();
            if (url.startsWith('http') || url.startsWith('//')) {
                pages.push({
                    pageNumber: index + 1,
                    imageUrl: url.startsWith('//') ? `https:${url}` : url,
                });
            }
        });
    }

    return pages;
}

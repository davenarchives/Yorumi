import axios from 'axios';
import * as cheerio from 'cheerio';
import { getBrowserInstance } from '../utils/browser';
import { HTTPRequest } from 'puppeteer-core';

const BASE_URL = 'https://mangakatana.com';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

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

export interface HotUpdate {
    id: string;
    title: string;
    chapter: string;
    url: string;
    thumbnail: string;
    source: 'mangakatana';
}

export interface MangaSearchResult {
    id: string;
    title: string;
    url: string;
    thumbnail: string;
    latestChapter?: string;
    source: 'mangakatana';
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
    source: 'mangakatana';
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

            // Extract latest chapter
            // Usually found in .chapter class inside text div
            const chapters = $el.find('div.text .chapter a');
            let latestChapter = '';
            if (chapters.length > 0) {
                latestChapter = chapters.first().text().trim();
            }

            // Extract ID from URL (e.g., /manga/one-piece.12345 -> one-piece.12345)
            const id = url.replace(`${BASE_URL}/manga/`, '').replace(/\/$/, '');

            if (title && url) {
                results.push({ id, title, url, thumbnail, latestChapter, source: 'mangakatana' });
            }
        });

        // Check for redirect to detail page (no book_list, but has info heading)
        if (results.length === 0) {
            const detailTitle = $('.info .heading').text().trim();
            if (detailTitle) {
                // We are on a detail page
                // The URL in axiosInstance might be the original search URL, 
                // so we need to rely on the fact we are on a detail page.
                // However, axios response object has `request.res.responseUrl` which is the final URL
                const finalUrl = response.request.res.responseUrl;

                if (finalUrl && finalUrl.includes('/manga/')) {
                    const id = finalUrl.split('/manga/')[1].replace(/\/$/, '');
                    const thumbnail = $('div.media div.cover img').attr('src') || '';

                    results.push({
                        id,
                        title: detailTitle,
                        url: finalUrl,
                        thumbnail,
                        source: 'mangakatana'
                    });
                }
            }
        }

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
            source: 'mangakatana',
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
            const chapterId = chapterUrl.replace(/\/$/, '').split('/').pop() || '';

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
 * Uses Puppeteer to handle JavaScript rendering and extraction
 */
export async function getChapterPages(chapterUrl: string): Promise<ChapterPage[]> {
    // Regex optimization removed by user request
    // Falling back to Puppeteer directly

    let browser = null;
    try {
        // Launch Puppeteer headless browser
        console.log(`Launching Puppeteer for ${chapterUrl}...`);
        browser = await getBrowserInstance();

        const page = await browser.newPage();

        // Set a realistic user agent
        await page.setUserAgent(USER_AGENT);

        // Block images/css/fonts/media to speed up loading
        await page.setRequestInterception(true);
        page.on('request', (req: HTTPRequest) => {
            if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        // Navigate to the chapter URL
        await page.goto(chapterUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Wait a bit for scripts to populate variables
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Evaluate page context to extract global variables
        const imageUrls = await page.evaluate(() => {
            // Check common variable names
            // @ts-ignore
            if (window.thzq && Array.isArray(window.thzq) && window.thzq.length > 0) return window.thzq;
            // @ts-ignore
            if (window.ytaw && Array.isArray(window.ytaw) && window.ytaw.length > 0) return window.ytaw;
            // @ts-ignore
            if (window.htnc && Array.isArray(window.htnc) && window.htnc.length > 0) return window.htnc;

            // Fallback: look for script tags that contain array definitions
            const scripts = Array.from(document.querySelectorAll('script'));
            for (const script of scripts) {
                const content = script.textContent || '';
                const match = content.match(/var\s+\w+\s*=\s*\[(['"].*?['"])\]/);
                if (match) {
                    try {
                        const urls = eval(`[${match[1]}]`);
                        if (Array.isArray(urls) && urls.length > 0 && typeof urls[0] === 'string' && urls[0].includes('http')) {
                            return urls;
                        }
                    } catch (e) { }
                }
            }

            // Fallback: find all images in #imgs div
            const imgs = document.querySelectorAll('#imgs img');
            if (imgs.length > 0) {
                return Array.from(imgs)
                    .map(img => img.getAttribute('data-src') || img.getAttribute('src'))
                    .filter(src => src && (src.includes('http') || src.startsWith('//')));
            }

            return [];
        });

        if (imageUrls && imageUrls.length > 0) {
            console.log(`Found ${imageUrls.length} pages via Puppeteer`);
            return imageUrls.map((url: string, index: number) => ({
                pageNumber: index + 1,
                imageUrl: url.startsWith('//') ? `https:${url}` : url
            }));
        }

        console.log('No pages found with Puppeteer');
        return [];
    } catch (error) {
        console.error('Error fetching chapter pages with Puppeteer:', error);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

/**
 * Get hot updates from MangaKatana homepage
 * Uses Puppeteer to bypass bot protection
 */
export async function getHotUpdates(): Promise<HotUpdate[]> {
    let browser = null;
    try {
        console.log('Fetching hot updates from MangaKatana via Puppeteer...');
        browser = await getBrowserInstance();
        const page = await browser.newPage();

        // Set a realistic user agent
        await page.setUserAgent(USER_AGENT);

        // Block images/css/fonts/media to speed up loading
        await page.setRequestInterception(true);
        page.on('request', (req: HTTPRequest) => {
            if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        // Navigate to the homepage
        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Wait for potential Cloudflare challenge or content load
        try {
            await page.waitForSelector('#hot_update', { timeout: 10000 });
        } catch (e) {
            console.warn('Timeout waiting for #hot_update, trying fallback...');
            try {
                await page.waitForSelector('.widget-hot-update', { timeout: 5000 });
            } catch (e2) {
                console.warn('Timeout waiting for fallback widget...');
            }
        }

        const content = await page.content();
        const $ = cheerio.load(content);
        const updates: HotUpdate[] = [];

        // Strategy: Look for the specific "Hot Updates" section. 
        // MK usually has #hot_update

        let container = $('#hot_update');
        console.log('Found container #hot_update:', container.length);

        if (container.length === 0) {
            // Fallback: look for typical "item" grid if id changed
            container = $('.widget-hot-update');
            console.log('Found container .widget-hot-update:', container.length);
        }

        container.find('.item').each((_, element) => {
            const $el = $(element);

            // Image
            const imgEl = $el.find('.wrap_img img');
            const thumbnail = imgEl.attr('data-src') || imgEl.attr('src') || '';

            // Title
            const titleEl = $el.find('.title a');
            const title = titleEl.text().trim();
            const url = titleEl.attr('href') || '';

            // Latest Chapter
            const chapterEl = $el.find('.chapter a');
            // Sometimes multiple chapters, grab first
            const chapter = chapterEl.first().text().trim();

            if (title && url) {
                const id = url.split('/manga/')[1]?.replace(/\/$/, '') || '';
                updates.push({
                    id,
                    title,
                    chapter,
                    url,
                    thumbnail,
                    source: 'mangakatana'
                });
            }
        });

        console.log(`Found ${updates.length} hot updates.`);
        return updates.slice(0, 15);
    } catch (error) {
        console.error('Error fetching hot updates:', error);
        return [];
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

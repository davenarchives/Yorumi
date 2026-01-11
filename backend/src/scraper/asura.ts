import puppeteer from 'puppeteer';

const BASE_URL = 'https://asuracomic.net';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';

export interface MangaSearchResult {
    id: string;
    title: string;
    url: string;
    thumbnail: string;
    source: 'asura';
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
    source: 'asura';
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
 * Search for manga on AsuraScans
 */
export async function searchManga(query: string): Promise<MangaSearchResult[]> {
    let browser = null;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setUserAgent(USER_AGENT);

        // Block resources
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        // Search URL
        const url = `${BASE_URL}/series?name=${encodeURIComponent(query)}`;
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Wait for results
        await page.waitForSelector('.grid.grid-cols-2, .grid.grid-cols-1', { timeout: 5000 }).catch(() => { });

        const results = await page.evaluate((baseUrl) => {
            const items = document.querySelectorAll('a[href^="/series/"]');
            const data: any[] = [];

            items.forEach((el) => {
                // Determine if this is a manga item (ignoring random links)
                // Asura usually displays grid items.
                // We'll trust links that look like /series/
                const link = el.getAttribute('href');
                if (!link) return;

                // Structure might vary, but usually the 'a' wraps the card or is inside.
                // Let's look for a parent wrapper that contains title and img if possible.
                // But simplest is to extract from the A tag if it has title/img inside.
                // Asura grid items often look like: <a href="/series/xyz"><img src="...">...<span class="title">...</span></a>

                // Let's rely on finding grid items explicitly if possible
                // Fallback: iterate all /series/ links

                const titleEl = el.querySelector('.font-bold, .title') || el; // Try to extract title text
                const imgEl = el.querySelector('img');

                if (titleEl && imgEl) {
                    const title = (titleEl as HTMLElement).innerText.trim();
                    const thumbnail = imgEl.getAttribute('src') || '';
                    const fullUrl = link.startsWith('http') ? link : `${baseUrl}${link}`;
                    const id = link.replace('/series/', '');

                    if (title && id) {
                        data.push({ id, title, url: fullUrl, thumbnail });
                    }
                }
            });
            return data;
        }, BASE_URL);

        return results.map(r => ({ ...r, source: 'asura' }));

    } catch (error) {
        console.error('Asura Search Error:', error);
        return [];
    } finally {
        if (browser) await browser.close();
    }
}

/**
 * Get Manga Details
 */
export async function getMangaDetails(id: string): Promise<MangaDetails> {
    let browser = null;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setUserAgent(USER_AGENT);

        // Block heavy resources
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        const url = `${BASE_URL}/series/${id}`;
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForSelector('h1', { timeout: 5000 }).catch(() => { });

        const details = await page.evaluate((mangaId) => {
            const title = (document.querySelector('h1') as HTMLElement)?.innerText.trim() || '';
            const synopsis = (document.querySelector('span.font-medium.text-sm') as HTMLElement)?.innerText.trim() || ''; // Adjusted selector guess
            const coverImage = document.querySelector('img[alt="poster"]')?.getAttribute('src') || document.querySelector('img')?.getAttribute('src') || '';

            // Extract metadata (Author, Status) - Selectors are tricky on dynamic sites without visual.
            // We'll try to execute generic extraction
            const status = 'Unknown'; // Placeholder
            const author = 'Unknown';

            // Genres
            const genreButtons = Array.from(document.querySelectorAll('button, a')).filter(el => el.classList.contains('text-xs') || el.getAttribute('href')?.includes('genre'));
            const genres = genreButtons.map(el => (el as HTMLElement).innerText.trim());

            return {
                id: mangaId,
                title,
                altNames: [],
                author,
                status,
                genres: [...new Set(genres)], // Dedup
                synopsis,
                coverImage,
                url: document.location.href,
                source: 'asura'
            };
        }, id);

        return { ...details, source: 'asura' };

    } catch (error) {
        console.error('Asura Details Error:', error);
        throw error;
    } finally {
        if (browser) await browser.close();
    }
}

/**
 * Get Chapter List (Usually typically part of details page, but let's separate for consistency)
 * Note: Asura loads chapters dynamically or paginated sometimes.
 * We'll reuse the page instance if we can, but since these are stateless functions, we re-scrape.
 */
export async function getChapterList(id: string): Promise<Chapter[]> {
    let browser = null;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setUserAgent(USER_AGENT);

        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        const url = `${BASE_URL}/series/${id}`;
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        // Asura chapter list might need scroll or it's just a long list
        // Let's wait for chapter links
        await page.waitForSelector('a[href*="/chapter/"]', { timeout: 5000 }).catch(() => { });

        const chapters = await page.evaluate((baseUrl) => {
            const links = Array.from(document.querySelectorAll(`a[href*="/chapter/"]`));
            return links.map(el => {
                const title = (el as HTMLElement).innerText.trim().replace(/\n/g, ' ');
                const href = el.getAttribute('href')!;
                const fullUrl = href.startsWith('http') ? href : `${baseUrl}${href}`;
                // Extract chapter ID from URL: /series/slug/chapter/123 -> 123
                // Or /chapter/123456
                const parts = href.split('/');
                const chapterId = parts[parts.length - 1] || parts[parts.length - 2];

                // Try to find date
                const dateEl = el.querySelector('.text-xs, .date');
                const uploadDate = dateEl ? (dateEl as HTMLElement).innerText.trim() : '';

                return {
                    id: chapterId,
                    title,
                    url: fullUrl,
                    uploadDate
                };
            }).filter(c => c.id);
        }, BASE_URL);

        // Dedup chapters by ID
        const unique = new Map();
        chapters.forEach(c => unique.set(c.id, c));
        return Array.from(unique.values());

    } catch (error) {
        console.error('Asura Chapter List Error:', error);
        return [];
    } finally {
        if (browser) await browser.close();
    }
}

/**
 * Get Chapter Pages
 */
export async function getChapterPages(chapterIdOrUrl: string): Promise<ChapterPage[]> {
    let browser = null;
    try {
        // If passed a full URL, use it. If passed an ID, construct it (harder without series slug).
        // The service should pass the full URL from the chapter object.
        let url = chapterIdOrUrl;
        if (!url.startsWith('http')) {
            throw new Error('Asura getChapterPages requires full URL');
        }

        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setUserAgent(USER_AGENT);

        // We MUST load images for Asura? 
        // Actually no, we just need the SRC attributes.
        // But some sites lazy load src.
        // Asura usually has images in DOM.
        // We can block images to save bandwidth, but scripts must run.
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'media'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        // Wait for imagesContainer or similar. Asura usually has specific reader div.
        // Or just wait for any image with relevant src
        await page.waitForSelector('img[src*="storage.asuracomic.net"], img[src*="gg.asuracomic.net"]', { timeout: 10000 }).catch(() => { });

        const pages = await page.evaluate(() => {
            const images = Array.from(document.querySelectorAll('img'));
            // Filter assuming common Asura CDNs or large layout
            // Asura Comic reader usually is a vertical list of images.
            // Often inside a specific container like #reader, or just broad.

            return images
                .map(img => img.getAttribute('src') || '')
                .filter(src => src.includes('asuracomic.net') || src.includes('gg.asuracomic') || src.includes('b-cdn.net')) // Adjust filters based on observation
                .map((url, i) => ({
                    pageNumber: i + 1,
                    imageUrl: url
                }));
        });

        return pages;

    } catch (error) {
        console.error('Asura Pages Error:', error);
        return [];
    } finally {
        if (browser) await browser.close();
    }
}

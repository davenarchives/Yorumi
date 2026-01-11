
import puppeteer from 'puppeteer';

// Inlined interfaces to avoid import issues
export interface MangaSearchResult {
    id: string;
    title: string;
    url: string;
    thumbnail: string;
    source: 'asura' | 'mangakatana'; // relaxed type to match
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
    source: 'asura' | 'mangakatana';
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

const BASE_URL = 'https://asuracomic.net';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function launchBrowser() {
    return await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
}

export async function searchManga(query: string): Promise<MangaSearchResult[]> {
    const url = `${BASE_URL}/series?name=${encodeURIComponent(query)}`;
    let browser = null;
    try {
        browser = await launchBrowser();
        const page = await browser.newPage();
        await page.setUserAgent(USER_AGENT);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        try {
            await page.waitForSelector('a[href*="/series/"]', { timeout: 8000 });
        } catch (e) {
            console.log('Asura search timeout (no results?)');
            return [];
        }

        const results = await page.evaluate(() => {
            const items = Array.from(document.querySelectorAll('a[href*="/series/"]'));
            const map = new Map();

            items.forEach(a => {
                const href = a.getAttribute('href') || '';
                if (!href.includes('/series/')) return;

                const id = href.split('/series/')[1]?.split('/')[0];
                if (!id) return;

                let title = a.textContent?.trim() || '';
                let img = '';

                const titleEl = a.querySelector('span.font-bold, h3, div.text-sm');
                if (titleEl) title = titleEl.textContent?.trim() || title;

                const imgEl = a.querySelector('img');
                if (imgEl) img = imgEl.src;

                if (id && title && !map.has(id)) {
                    map.set(id, {
                        id,
                        title,
                        url: href,      // internal use
                        thumbnail: img, // map to thumbnail
                        source: 'asura'
                    });
                }
            });
            return Array.from(map.values());
        });

        return results.map((r: any) => ({
            id: r.id,
            title: r.title,
            url: `${BASE_URL}/series/${r.id}`,
            thumbnail: r.thumbnail,
            source: 'asura'
        }));

    } catch (error) {
        console.error('Error searching Asura:', error);
        return [];
    } finally {
        if (browser) await browser.close();
    }
}

export async function getMangaDetails(mangaId: string): Promise<MangaDetails> {
    const url = `${BASE_URL}/series/${mangaId}`;
    let browser = null;
    try {
        browser = await launchBrowser();
        const page = await browser.newPage();
        await page.setUserAgent(USER_AGENT);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        await page.waitForSelector('h1, span.font-bold', { timeout: 8000 }).catch(() => null);

        const details = await page.evaluate(() => {
            const title = document.querySelector('h1')?.textContent?.trim() || document.querySelector('span.text-xl')?.textContent?.trim() || 'Unknown Title';
            const synopsis = document.querySelector('span.text-base, p.description')?.textContent?.trim() || '';
            const status = document.querySelector('div.status')?.textContent?.trim() || 'Unknown';
            const img = document.querySelector('img[alt="' + title + '"]')?.getAttribute('src') || document.querySelector('img')?.src || '';

            const genres = Array.from(document.querySelectorAll('button, a.badge')).map(b => b.textContent?.trim() || '').filter(t => t.length > 2);

            return {
                title,
                synopsis,
                status,
                coverImage: img,
                genres,
                author: 'Unknown',
                altNames: []
            };
        });

        return {
            id: mangaId,
            title: details.title,
            altNames: details.altNames,
            author: details.author,
            status: details.status,
            genres: details.genres,
            synopsis: details.synopsis,
            coverImage: details.coverImage,
            url,
            source: 'asura'
        };

    } catch (error) {
        console.error('Error getting Asura details:', error);
        throw error;
    } finally {
        if (browser) await browser.close();
    }
}

export async function getChapterList(mangaId: string): Promise<Chapter[]> {
    const url = `${BASE_URL}/series/${mangaId}`;
    let browser = null;
    try {
        browser = await launchBrowser();
        const page = await browser.newPage();
        await page.setUserAgent(USER_AGENT);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        try {
            await page.waitForSelector('a[href*="/chapter/"]', { timeout: 8000 });
        } catch (e) {
            console.log('Asura chapter list timeout');
        }

        const chapters = await page.evaluate((mangaId) => {
            const links = Array.from(document.querySelectorAll('a'));
            const list = [];
            const seen = new Set();

            for (const a of links) {
                if (a.href.includes('/chapter/')) {
                    const parts = a.href.split('/chapter/');
                    const id = parts[1];
                    if (id && !seen.has(id)) {
                        seen.add(id);
                        const title = a.innerText.trim() || `Chapter ${id}`;
                        list.push({
                            id: id,
                            title: title,
                            uploadDate: new Date().toISOString(),
                            url: a.href
                        });
                    }
                }
            }
            return list;
        }, mangaId);

        return chapters.sort((a, b) => parseFloat(b.id) - parseFloat(a.id));

    } catch (error) {
        console.error('Error getting Asura chapters:', error);
        return [];
    } finally {
        if (browser) await browser.close();
    }
}

export async function getChapterPages(chapterUrl: string): Promise<ChapterPage[]> {
    const fullUrl = chapterUrl.startsWith('http') ? chapterUrl : `${BASE_URL}${chapterUrl}`;
    let browser = null;
    try {
        browser = await launchBrowser();
        const page = await browser.newPage();
        await page.setUserAgent(USER_AGENT);
        await page.goto(fullUrl, { waitUntil: 'networkidle2', timeout: 30000 });

        try {
            await page.evaluate(async () => {
                await new Promise((resolve) => {
                    let totalHeight = 0;
                    const distance = 500;
                    const timer = setInterval(() => {
                        window.scrollBy(0, distance);
                        totalHeight += distance;
                        if (totalHeight >= document.body.scrollHeight) {
                            clearInterval(timer);
                            resolve(true);
                        }
                    }, 100);
                });
            });
            await page.waitForSelector('img[alt*="page"], div.flex-col img', { timeout: 10000 });
        } catch (e) { }

        const pages = await page.evaluate(() => {
            const images = Array.from(document.querySelectorAll('img'));
            return images
                .filter(img => img.naturalWidth > 400 && !img.src.includes('logo') && !img.src.includes('banner'))
                .map((img, index) => ({
                    pageNumber: index + 1,
                    imageUrl: img.src
                }));
        });

        return pages.filter(p => p.imageUrl.startsWith('http'));

    } catch (error) {
        console.error('Error getting Asura pages:', error);
        return [];
    } finally {
        if (browser) await browser.close();
    }
}

import axios from 'axios';
import * as cheerio from 'cheerio';

const NOVELBIN_BASE = 'https://novel-bin.com';
const WUXIA_BASE = 'https://wuxiaworld.site';
const ROYALROAD_BASE = 'https://www.royalroad.com';
const ALLNOVELFULL_BASE = 'https://allnovelfull.com';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const headers = {
    'User-Agent': USER_AGENT,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': NOVELBIN_BASE,
};

const axiosNB = axios.create({ baseURL: NOVELBIN_BASE, headers, timeout: 10000 });
const axiosWuxia = axios.create({ baseURL: WUXIA_BASE, headers, timeout: 10000 });
const axiosRR = axios.create({ baseURL: ROYALROAD_BASE, headers, timeout: 10000 });
const axiosANF = axios.create({ baseURL: ALLNOVELFULL_BASE, headers, timeout: 10000 });

export interface NovelSearchResult {
    id: string; // e.g. "nb:classroom-of-the-elite-ln-2" or "wx:solo-leveling-ragnarok"
    title: string;
    url: string;
    cover?: string;
    latestChapter?: string;
    rating?: string;
    source: 'novelbin' | 'wuxiaworld' | 'royalroad' | 'allnovelfull';
}

export interface NovelDetails {
    id: string;
    title: string;
    cover: string;
    description: string;
    author: string;
    status: string;
    genres: string[];
    source: 'novelbin' | 'wuxiaworld' | 'royalroad' | 'allnovelfull';
    chapters: NovelChapter[];
}

export interface NovelChapter {
    id: string;
    number: number;
    title: string;
    url: string;
    releaseDate?: string;
}

export interface NovelChapterContent {
    id: string;
    novelId: string;
    title: string;
    chapterNumber: number;
    content: string;
    prevChapterId?: string | null;
    nextChapterId?: string | null;
}

function sanitizeChapterHtml(rawHtml: string): string {
    if (!rawHtml) return '';
    const $ = cheerio.load(rawHtml);

    $('script, style, iframe, ins, .adsbygoogle, .ads, .ad-container, .ads-holder, div[align="center"]').remove();

    $('p').each((_, el) => {
        const txt = $(el).text().trim();
        if (/find light novel|read novel online|translator:|editor:|novel-bin|wuxiaworld|allnovelfull/i.test(txt) && txt.length < 120) {
            $(el).remove();
        }
    });

    const paragraphs: string[] = [];
    $('#chr-content p, .reading-content p, .text-left p, p').each((_, el) => {
        const text = $(el).html()?.trim();
        if (text && text.length > 0) {
            paragraphs.push(`<p>${text}</p>`);
        }
    });

    if (paragraphs.length > 0) {
        return paragraphs.join('');
    }

    return $.html();
}

// ----------------------------------------------------
// 1. NOVEL-BIN.COM SCRAPER (Primary Official Light Novel Source)
// ----------------------------------------------------

export async function searchNovelBin(query: string): Promise<NovelSearchResult[]> {
    try {
        const { data: html } = await axiosNB.get(`/search?keyword=${encodeURIComponent(query)}`);
        const $ = cheerio.load(html);
        const results: NovelSearchResult[] = [];

        $('.list-novel .row').each((_, el) => {
            const title = $(el).find('.novel-title a').text().trim();
            const href = $(el).find('.novel-title a').attr('href');
            const img = $(el).find('img').attr('src') || $(el).find('img').attr('data-src');

            if (title && href) {
                const slug = href.replace(/^https?:\/\/novel-bin\.com\/novel-bin\//, '').replace(/^\/novel-bin\//, '').replace(/\/$/, '');
                results.push({
                    id: `nb:${slug}`,
                    title,
                    url: href.startsWith('http') ? href : `${NOVELBIN_BASE}${href.startsWith('/') ? '' : '/'}${href}`,
                    cover: img ? (img.startsWith('http') ? img : `${NOVELBIN_BASE}${img}`) : undefined,
                    source: 'novelbin',
                });
            }
        });

        return results;
    } catch (error) {
        console.error('[NovelBin] Search error:', error);
        return [];
    }
}

export async function getNovelBinDetails(slug: string): Promise<NovelDetails | null> {
    try {
        const cleanSlug = slug.replace(/^nb:/i, '').replace(/\/$/, '');
        const targetUrl = `/novel-bin/${cleanSlug}/`;
        const { data: html } = await axiosNB.get(targetUrl);
        const $ = cheerio.load(html);

        const title = $('.title').first().text().trim() || $('h3.title').text().trim() || 'Light Novel';
        const cover = $('.book img').attr('src') || $('.book img').attr('data-src') || '';

        let author = 'Unknown';
        $('.info li, .info div, .info-meta li, .info-meta div').each((_, el) => {
            const text = $(el).text().trim();
            if (/author:/i.test(text)) {
                author = text.replace(/author:/i, '').trim().replace(/\s+/g, ' ');
            }
        });
        if (!author || author === 'Unknown') {
            author = $('.info a[href*="/author/"]').text().trim() || 'Unknown';
        }

        const status = $('.info a[href*="/status/"]').text().trim() || 'Ongoing';

        const genres: string[] = [];
        $('.info a[href*="/genre/"]').each((_, el) => {
            const g = $(el).text().trim();
            if (g) genres.push(g);
        });

        const description = $('.desc-text').text().trim();

        // Extract chapter list (fetch AJAX archive for complete 500+ chapters if novelId exists)
        const chapters: NovelChapter[] = [];
        let num = 1;

        const novelIdAttr = $('#rating').attr('data-novel-id') || $('input#novelId').val() || $('input[name="novelId"]').val() || $('[data-novel-id]').attr('data-novel-id');
        let chapterHtml = html;
        if (novelIdAttr) {
            try {
                const { data: ajaxHtml } = await axiosNB.get(`/ajax/chapter-archive?novelId=${novelIdAttr}`);
                if (ajaxHtml && (ajaxHtml.includes('list-chapter') || ajaxHtml.includes('<a'))) {
                    chapterHtml = ajaxHtml;
                }
            } catch (err) {
                console.warn('[NovelBin] AJAX chapter archive fetch failed, using inline list:', err);
            }
        }

        const $c = cheerio.load(chapterHtml);
        const seenSlugs = new Set<string>();

        // Specifically find chapter list container to avoid top header / latest release widgets
        const $chapterList = $c('#list-chapter, .list-chapter, .chapter-list').length > 0
            ? $c('#list-chapter, .list-chapter, .chapter-list')
            : $c('body');

        $chapterList.find('a').each((_, el) => {
            const cTitle = $c(el).text().trim();
            const cHref = $c(el).attr('href') || '';
            if (cTitle && cHref && (cHref.includes('/chapter-') || cHref.includes('/novel-bin/'))) {
                const cSlug = cHref.replace(/^https?:\/\/novel-bin\.com\/novel-bin\//, '').replace(/^\/novel-bin\//, '').replace(/\/$/, '');
                if (!cSlug || seenSlugs.has(cSlug)) return;
                seenSlugs.add(cSlug);

                const numMatch = cTitle.match(/chapter\s+([\d.]+)/i) ||
                                 cTitle.match(/arc\s+\d+\s*[-–—]\s*([\d.]+)/i) ||
                                 cSlug.match(/chapter-([\d.]+)/i);
                const chapterNumber = numMatch ? parseFloat(numMatch[1]) : num++;

                chapters.push({
                    id: `nb:${cSlug}`,
                    number: chapterNumber,
                    title: cTitle,
                    url: cHref.startsWith('http') ? cHref : `${NOVELBIN_BASE}${cHref.startsWith('/') ? '' : '/'}${cHref}`,
                });
            }
        });

        // Ensure chapters are sorted in ascending order (Chapter 1, 2, 3...)
        chapters.sort((a, b) => a.number - b.number);

        return {
            id: `nb:${cleanSlug}`,
            title,
            cover: cover.startsWith('http') ? cover : `${NOVELBIN_BASE}${cover}`,
            description,
            author,
            status,
            genres,
            source: 'novelbin',
            chapters,
        };
    } catch (error) {
        console.error('[NovelBin] Details error:', error);
        return null;
    }
}

export async function getNovelBinChapterContent(chapterSlug: string): Promise<NovelChapterContent | null> {
    try {
        const cleanSlug = chapterSlug
            .replace(/^nb:/i, '')
            .replace(/^\/novel-bin\//i, '')
            .replace(/^novel-bin\//i, '')
            .replace(/\/$/, '');
        const targetUrl = `/novel-bin/${cleanSlug}`;
        const { data: html } = await axiosNB.get(targetUrl);
        const $ = cheerio.load(html);

        const title = $('.chr-title').text().trim() || $('h2').text().trim() || 'Chapter';
        const rawContent = $('#chr-content').html() || $('.chr-c').html() || $('.reading-content').html() || '';
        const sanitizedContent = sanitizeChapterHtml(rawContent);

        const prevHref = $('#prev_chap').attr('href');
        const nextHref = $('#next_chap').attr('href');

        const prevChapterId = prevHref && !prevHref.includes('javascript:')
            ? `nb:${prevHref.replace(/^https?:\/\/novel-bin\.com\/novel-bin\//, '').replace(/^\/novel-bin\//, '').replace(/^novel-bin\//, '').replace(/\/$/, '')}`
            : null;

        const nextChapterId = nextHref && !nextHref.includes('javascript:')
            ? `nb:${nextHref.replace(/^https?:\/\/novel-bin\.com\/novel-bin\//, '').replace(/^\/novel-bin\//, '').replace(/^novel-bin\//, '').replace(/\/$/, '')}`
            : null;

        const numMatch = cleanSlug.match(/chapter-([\d.]+)/i);
        const chapterNumber = numMatch ? parseFloat(numMatch[1]) : 1;
        const novelSlug = cleanSlug.split('/chapter-')[0];

        return {
            id: `nb:${cleanSlug}`,
            novelId: `nb:${novelSlug}`,
            title,
            chapterNumber,
            content: sanitizedContent,
            prevChapterId,
            nextChapterId,
        };
    } catch (error) {
        console.error('[NovelBin] Chapter content error:', error);
        return null;
    }
}

// ----------------------------------------------------
// 2. WUXIAWORLD.SITE SCRAPER
// ----------------------------------------------------

export async function searchWuxiaWorld(query: string): Promise<NovelSearchResult[]> {
    try {
        const { data: html } = await axiosWuxia.get(`/?s=${encodeURIComponent(query)}&post_type=wp-manga`);
        const $ = cheerio.load(html);
        const results: NovelSearchResult[] = [];

        $('.c-tabs-item__content').each((_, el) => {
            const title = $(el).find('.post-title a').text().trim();
            const href = $(el).find('.post-title a').attr('href');
            const img = $(el).find('img').attr('src') || $(el).find('img').attr('data-src');

            if (title && href) {
                const slug = href.replace(/^https?:\/\/wuxiaworld\.site\/novel\//, '').replace(/\/$/, '');
                results.push({
                    id: `wx:${slug}`,
                    title,
                    url: href,
                    cover: img || undefined,
                    source: 'wuxiaworld',
                });
            }
        });

        return results;
    } catch (error) {
        console.error('[WuxiaWorld] Search error:', error);
        return [];
    }
}

export async function getWuxiaWorldDetails(slug: string): Promise<NovelDetails | null> {
    try {
        const cleanSlug = slug.replace(/^wx:/i, '').replace(/\/$/, '');
        const novelUrl = `${WUXIA_BASE}/novel/${cleanSlug}/`;
        const { data: html } = await axiosWuxia.get(`/novel/${cleanSlug}/`);
        const $ = cheerio.load(html);

        const title = $('.post-title h1').text().trim() || $('h1').first().text().trim();
        const cover = $('.summary_image img').attr('src') || $('.summary_image img').attr('data-src') || '';
        const author = $('.author-content a').text().trim() || 'Unknown';
        const status = $('.post-status .summary-content').text().trim() || 'Ongoing';

        const genres: string[] = [];
        $('.genres-content a').each((_, el) => {
            const g = $(el).text().trim();
            if (g) genres.push(g);
        });

        const description = $('.description-summary').text().trim() || $('.summary__content').text().trim();

        let rawChapters: { title: string; href: string }[] = [];
        try {
            const { data: chHtml } = await axiosWuxia.post(`/novel/${cleanSlug}/ajax/chapters/`);
            const $c = cheerio.load(chHtml);
            $c('.wp-manga-chapter a').each((_, el) => {
                const cTitle = $c(el).text().trim();
                const cHref = $c(el).attr('href') || '';
                if (cTitle && cHref) {
                    rawChapters.push({ title: cTitle, href: cHref });
                }
            });
        } catch {
            $('.wp-manga-chapter a').each((_, el) => {
                const cTitle = $(el).text().trim();
                const cHref = $(el).attr('href') || '';
                if (cTitle && cHref) {
                    rawChapters.push({ title: cTitle, href: cHref });
                }
            });
        }

        rawChapters.reverse();

        const chapters: NovelChapter[] = [];
        const seenSlugs = new Set<string>();

        rawChapters.forEach((ch, idx) => {
            const chapterSlug = ch.href.replace(/^https?:\/\/wuxiaworld\.site\/novel\//, '').replace(/\/$/, '');
            if (!chapterSlug || seenSlugs.has(chapterSlug)) return;
            seenSlugs.add(chapterSlug);

            const numMatch = ch.title.match(/chapter\s+([\d.]+)/i) ||
                             ch.title.match(/arc\s+\d+\s*[-–—]\s*([\d.]+)/i);
            const number = numMatch ? parseFloat(numMatch[1]) : idx + 1;

            chapters.push({
                id: `wx:${chapterSlug}`,
                number,
                title: ch.title,
                url: ch.href,
            });
        });

        chapters.sort((a, b) => a.number - b.number);

        return {
            id: `wx:${cleanSlug}`,
            title,
            cover,
            description,
            author,
            status,
            genres,
            source: 'wuxiaworld',
            chapters,
        };
    } catch (error) {
        console.error('[WuxiaWorld] Details error:', error);
        return null;
    }
}

export async function getWuxiaWorldChapterContent(chapterSlug: string): Promise<NovelChapterContent | null> {
    try {
        const cleanSlug = chapterSlug.replace(/^wx:/i, '').replace(/\/$/, '');
        const { data: html } = await axiosWuxia.get(`/novel/${cleanSlug}/`);
        const $ = cheerio.load(html);

        const title = $('.breadcrumb li.active').text().trim() || $('h1').text().trim() || 'Chapter';
        const rawContent = $('.reading-content').html() || $('.text-left').html() || '';
        const sanitizedContent = sanitizeChapterHtml(rawContent);

        const prevHref = $('.nav-previous a').attr('href') || $('.prev_page').attr('href');
        const nextHref = $('.nav-next a').attr('href') || $('.next_page').attr('href');

        const prevChapterId = prevHref
            ? `wx:${prevHref.replace(/^https?:\/\/wuxiaworld\.site\/novel\//, '').replace(/\/$/, '')}`
            : null;

        const nextChapterId = nextHref
            ? `wx:${nextHref.replace(/^https?:\/\/wuxiaworld\.site\/novel\//, '').replace(/\/$/, '')}`
            : null;

        const numMatch = cleanSlug.match(/chapter-([\d.]+)/i);
        const chapterNumber = numMatch ? parseFloat(numMatch[1]) : 1;
        const novelSlug = cleanSlug.split('/chapter-')[0];

        return {
            id: `wx:${cleanSlug}`,
            novelId: `wx:${novelSlug}`,
            title,
            chapterNumber,
            content: sanitizedContent,
            prevChapterId,
            nextChapterId,
        };
    } catch (error) {
        console.error('[WuxiaWorld] Chapter content error:', error);
        return null;
    }
}

// ----------------------------------------------------
// 3. ROYALROAD SCRAPER (Web Originals / Fan fiction)
// ----------------------------------------------------

export async function searchRoyalRoad(query: string): Promise<NovelSearchResult[]> {
    try {
        const { data: html } = await axiosRR.get(`/fictions/search?title=${encodeURIComponent(query)}`);
        const $ = cheerio.load(html);
        const results: NovelSearchResult[] = [];

        $('.fiction-list-item').each((_, el) => {
            const titleEl = $(el).find('.fiction-title a');
            const title = titleEl.text().trim();
            const href = titleEl.attr('href');
            const img = $(el).find('img').attr('src');

            if (title && href) {
                const slug = href.replace(/^\/fiction\//, '');
                results.push({
                    id: `rr:${slug}`,
                    title,
                    url: href.startsWith('http') ? href : `${ROYALROAD_BASE}${href}`,
                    cover: img ? (img.startsWith('http') ? img : `${ROYALROAD_BASE}${img}`) : undefined,
                    source: 'royalroad',
                });
            }
        });

        return results;
    } catch (error) {
        console.error('[RoyalRoad] Search error:', error);
        return [];
    }
}

export async function getRoyalRoadDetails(fictionSlug: string): Promise<NovelDetails | null> {
    try {
        const cleanSlug = fictionSlug.replace(/^rr:/i, '');
        const { data: html } = await axiosRR.get(`/fiction/${cleanSlug}`);
        const $ = cheerio.load(html);

        const title = $('h1').text().trim();
        const cover = $('.thumbnail').attr('src') || '';
        const author = $('.fiction-info a[href*="/profile/"]').text().trim() || 'Unknown';
        const status = $('.fiction-info .label').first().text().trim() || 'Ongoing';

        const genres: string[] = [];
        $('.tags .label').each((_, el) => {
            const g = $(el).text().trim();
            if (g) genres.push(g);
        });

        const description = $('.description').text().trim();

        const chapters: NovelChapter[] = [];
        let num = 1;
        $('#chapters tbody tr').each((_, el) => {
            const link = $(el).find('td').first().find('a');
            const cTitle = link.text().trim();
            const cHref = link.attr('href') || '';
            const date = $(el).find('time').attr('title') || $(el).find('time').text().trim();

            if (cHref) {
                const cSlug = cHref.replace(/^\/fiction\//, '');
                chapters.push({
                    id: `rr:${cSlug}`,
                    number: num++,
                    title: cTitle,
                    url: cHref.startsWith('http') ? cHref : `${ROYALROAD_BASE}${cHref}`,
                    releaseDate: date || undefined,
                });
            }
        });

        return {
            id: `rr:${cleanSlug}`,
            title,
            cover: cover.startsWith('http') ? cover : `${ROYALROAD_BASE}${cover}`,
            description,
            author,
            status,
            genres,
            source: 'royalroad',
            chapters,
        };
    } catch (error) {
        console.error('[RoyalRoad] Details error:', error);
        return null;
    }
}

export async function getRoyalRoadChapterContent(chapterSlug: string): Promise<NovelChapterContent | null> {
    try {
        const cleanSlug = chapterSlug.replace(/^rr:/i, '');
        const { data: html } = await axiosRR.get(`/fiction/${cleanSlug}`);
        const $ = cheerio.load(html);

        const title = $('.chapter-title h1').text().trim() || $('h1').first().text().trim() || 'Chapter';
        const rawContent = $('.chapter-content').html() || '';
        const sanitizedContent = sanitizeChapterHtml(rawContent);

        const prevHref = $('.btn-primary[href*="/chapter/"]').first().attr('href');
        const nextHref = $('.btn-primary[href*="/chapter/"]').last().attr('href');

        return {
            id: `rr:${cleanSlug}`,
            novelId: `rr:${cleanSlug.split('/chapter/')[0]}`,
            title,
            chapterNumber: 1,
            content: sanitizedContent,
            prevChapterId: prevHref ? `rr:${prevHref.replace(/^\/fiction\//, '')}` : null,
            nextChapterId: nextHref && nextHref !== prevHref ? `rr:${nextHref.replace(/^\/fiction\//, '')}` : null,
        };
    } catch (error) {
        console.error('[RoyalRoad] Chapter content error:', error);
        return null;
    }
}

// ----------------------------------------------------
// 4. ALLNOVELFULL SCRAPER
// ----------------------------------------------------

export async function searchAllNovelFull(query: string): Promise<NovelSearchResult[]> {
    try {
        const { data: html } = await axiosANF.get(`/search?keyword=${encodeURIComponent(query)}`);
        const $ = cheerio.load(html);
        const results: NovelSearchResult[] = [];

        $('.list-truyen .row').each((_, el) => {
            const title = $(el).find('.truyen-title a').text().trim();
            const href = $(el).find('.truyen-title a').attr('href');
            const img = $(el).find('img').attr('src');
            if (title && href) {
                const slug = href.replace(/^\//, '').replace(/\.html$/, '');
                results.push({
                    id: `anf:${slug}`,
                    title,
                    url: href.startsWith('http') ? href : `${ALLNOVELFULL_BASE}${href}`,
                    cover: img ? (img.startsWith('http') ? img : `${ALLNOVELFULL_BASE}${img}`) : undefined,
                    source: 'allnovelfull',
                });
            }
        });

        return results;
    } catch (error) {
        console.error('[AllNovelFull] Search error:', error);
        return [];
    }
}

export async function getAllNovelFullDetails(slug: string): Promise<NovelDetails | null> {
    try {
        const cleanSlug = slug.replace(/^anf:/i, '').replace(/\.html$/, '');
        const { data: html } = await axiosANF.get(`/${cleanSlug}.html`);
        const $ = cheerio.load(html);

        const title = $('.books .title').text().trim() || $('.title').first().text().trim();
        const cover = $('.book img').attr('src') || '';
        const author = $('.info a[href*="/author/"]').text().trim() || 'Unknown';
        const status = $('.info a[href*="/status/"]').text().trim() || 'Ongoing';

        const genres: string[] = [];
        $('.info a[href*="/genre/"]').each((_, el) => {
            const g = $(el).text().trim();
            if (g) genres.push(g);
        });

        const description = $('.desc-text').text().trim();

        const chapters: NovelChapter[] = [];
        let num = 1;
        $('.list-chapter a').each((_, el) => {
            const cTitle = $(el).text().trim();
            const cHref = $(el).attr('href') || '';
            if (cHref) {
                const cSlug = cHref.replace(/^\//, '').replace(/\.html$/, '');
                chapters.push({
                    id: `anf:${cSlug}`,
                    number: num++,
                    title: cTitle,
                    url: cHref.startsWith('http') ? cHref : `${ALLNOVELFULL_BASE}${cHref}`,
                });
            }
        });

        return {
            id: `anf:${cleanSlug}`,
            title,
            cover: cover.startsWith('http') ? cover : `${ALLNOVELFULL_BASE}${cover}`,
            description,
            author,
            status,
            genres,
            source: 'allnovelfull',
            chapters,
        };
    } catch (error) {
        console.error('[AllNovelFull] Details error:', error);
        return null;
    }
}

export async function getAllNovelFullChapterContent(chapterSlug: string): Promise<NovelChapterContent | null> {
    try {
        const cleanSlug = chapterSlug.replace(/^anf:/i, '').replace(/\.html$/, '');
        const { data: html } = await axiosANF.get(`/${cleanSlug}.html`);
        const $ = cheerio.load(html);

        const title = $('.chapter-title').text().trim() || $('h2').text().trim() || 'Chapter';
        const rawContent = $('#chapter-content').html() || '';
        const sanitizedContent = sanitizeChapterHtml(rawContent);

        const prevHref = $('#prev_chap').attr('href');
        const nextHref = $('#next_chap').attr('href');

        return {
            id: `anf:${cleanSlug}`,
            novelId: `anf:${cleanSlug.split('/')[0]}`,
            title,
            chapterNumber: 1,
            content: sanitizedContent,
            prevChapterId: prevHref && !prevHref.includes('javascript:')
                ? `anf:${prevHref.replace(/^\//, '').replace(/\.html$/, '')}`
                : null,
            nextChapterId: nextHref && !nextHref.includes('javascript:')
                ? `anf:${nextHref.replace(/^\//, '').replace(/\.html$/, '')}`
                : null,
        };
    } catch (error) {
        console.error('[AllNovelFull] Chapter content error:', error);
        return null;
    }
}

// ----------------------------------------------------
// UNIFIED NOVEL SEARCH (NovelBin & WuxiaWorld prioritized first)
// ----------------------------------------------------

export async function searchAllNovelSources(query: string): Promise<NovelSearchResult[]> {
    const [nbResults, wxResults, anfResults, rrResults] = await Promise.all([
        searchNovelBin(query),
        searchWuxiaWorld(query),
        searchAllNovelFull(query),
        searchRoyalRoad(query),
    ]);

    return [...nbResults, ...wxResults, ...anfResults, ...rrResults];
}

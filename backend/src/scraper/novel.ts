import axios from 'axios';
import * as cheerio from 'cheerio';
import { AdaptiveEngine } from './adaptive';

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
        const seenHrefs = new Set<string>();

        // Adaptive query: tries primary selectors first, auto-recovers with fingerprint if site layout drifts
        const cards = AdaptiveEngine.query($, '.list-novel .row, a.almanac-book-row, a[href*="/novel-bin/"]', 'mediaSearchCard');

        cards.each((_, el) => {
            const isAnchor = $(el).is('a');
            const href = isAnchor ? $(el).attr('href') : $(el).find('a[href*="/novel-bin/"], .novel-title a').attr('href');
            if (!href || href === '/novel-bin/' || href.includes('/genre/') || href.includes('/author/')) return;

            const cleanHref = href.replace(/\/$/, '');
            if (seenHrefs.has(cleanHref)) return;
            seenHrefs.add(cleanHref);

            const title = isAnchor
                ? ($(el).attr('title') || $(el).find('h3, .almanac-row-copy, strong').first().text().trim())
                : ($(el).find('.novel-title a, h3 a').text().trim() || $(el).find('h3').text().trim());

            const imgEl = $(el).find('img');
            const img = imgEl.attr('src') || imgEl.attr('data-src') || imgEl.attr('srcset')?.split(' ')[0];

            if (title && href) {
                const slug = href.replace(/^https?:\/\/novel-bin\.com\/novel-bin\//, '').replace(/^\/novel-bin\//, '').replace(/\/$/, '');
                if (!slug || slug.includes('chapter') || slug === 'search') return;
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
    } catch (error: any) {
        console.error('[NovelBin] Search error:', error?.message || error);
        return [];
    }
}

export async function getNovelBinDetails(slug: string): Promise<NovelDetails | null> {
    try {
        const cleanSlug = slug.replace(/^nb:/i, '').replace(/\/$/, '');
        const targetUrl = `/novel-bin/${cleanSlug}/`;
        const { data: html } = await axiosNB.get(targetUrl);
        const $ = cheerio.load(html);

        const title = $('h1').first().text().trim() || $('.title').first().text().trim() || $('h3.title').text().trim() || 'Light Novel';
        const cover = $('img[src*="/files/image/"], .almanac-hero-cover img, .book img').first().attr('src') || $('.book img').attr('data-src') || '';

        let author = 'Unknown';
        $('.info li, .info div, .info-meta li, .info-meta div, dl').each((_, el) => {
            const text = $(el).text().trim();
            if (/author:/i.test(text)) {
                author = text.replace(/author:/i, '').trim().replace(/\s+/g, ' ');
            }
        });
        if (!author || author === 'Unknown') {
            author = $('.almanac-author, .author, .info a[href*="/author/"]').first().text().trim() || 'Unknown';
        }

        let status = 'Ongoing';
        $('dt:contains("Status")').each((_, el) => {
            const s = $(el).next('dd').text().trim();
            if (s) status = s;
        });
        if (status === 'Ongoing') {
            status = $('.info a[href*="/status/"]').text().trim() || 'Ongoing';
        }

        const genres: string[] = [];
        $('.info a[href*="/genre/"]').each((_, el) => {
            const g = $(el).text().trim();
            if (g && !genres.includes(g)) genres.push(g);
        });

        const description = $('.desc-text, p.description, .desc, [class*="synopsis"]').first().text().trim();

        // Extract chapter list
        const chapters: NovelChapter[] = [];
        let num = 1;

        // Try NovelBin AJAX chapter list by slug first (returns full catalog in JSON)
        try {
            const { data: ajaxData } = await axiosNB.get(`/ajax/chapter-list?slug=${cleanSlug}`);
            if (ajaxData?.chapters && Array.isArray(ajaxData.chapters) && ajaxData.chapters.length > 0) {
                const seenSlugs = new Set<string>();
                for (const ch of ajaxData.chapters) {
                    const cHref = String(ch.url || '');
                    const cSlug = cHref
                        .replace(/^https?:\/\/novel-bin\.com\/novel-bin\//, '')
                        .replace(/^\/novel-bin\//, '')
                        .replace(/\/$/, '');
                    if (!cSlug || seenSlugs.has(cSlug)) continue;
                    seenSlugs.add(cSlug);

                    chapters.push({
                        id: `nb:${cSlug}`,
                        number: Number(ch.index) || num++,
                        title: ch.title || `Chapter ${num}`,
                        url: cHref.startsWith('http') ? cHref : `${NOVELBIN_BASE}${cHref.startsWith('/') ? '' : '/'}${cHref}`,
                    });
                }
            }
        } catch (err: any) {
            console.warn('[NovelBin] AJAX chapter-list by slug failed, checking fallback:', err?.message || err);
        }

        if (chapters.length === 0) {
            const novelIdAttr = $('#rating').attr('data-novel-id') || $('input#novelId').val() || $('input[name="novelId"]').val() || $('[data-novel-id]').attr('data-novel-id') || $('article[data-book-id]').attr('data-book-id');
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

            // Search inside chapter container to avoid unrelated recommended novel links
            const $chapterList = AdaptiveEngine.query($c, 'ol.almanac-chapter-list, #list-chapter, .list-chapter, .chapter-list', 'chapterItem');
            const $target = $chapterList.length > 0 ? $chapterList : $c('body');

            $target.find('a[href*="/chapter-"], a[href*="/novel-bin/"]').each((_, el) => {
                const cTitle = $c(el).text().trim().replace(/^\d+\s*(Chapter\s*)/i, 'Chapter ');
                const cHref = $c(el).attr('href') || '';
                if (cTitle && cHref && cHref.includes('/chapter-')) {
                    const cSlug = cHref.replace(/^https?:\/\/novel-bin\.com\/novel-bin\//, '').replace(/^\/novel-bin\//, '').replace(/\/$/, '');
                    if (!cSlug || seenSlugs.has(cSlug)) return;
                    seenSlugs.add(cSlug);

                    chapters.push({
                        id: `nb:${cSlug}`,
                        number: num++,
                        title: cTitle,
                        url: cHref.startsWith('http') ? cHref : `${NOVELBIN_BASE}${cHref.startsWith('/') ? '' : '/'}${cHref}`,
                    });
                }
            });
        }

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
    } catch (error: any) {
        console.error('[NovelBin] Details error:', error?.message || error);
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

        const title = $('.chr-title, .chapter-title, h1, h2').filter((_, el) => /chapter/i.test($(el).text())).first().text().trim() || $('.chr-title').text().trim() || 'Chapter';
        const contentBlock = AdaptiveEngine.queryOne($, '#chr-content, .chr-c, .reading-content, #chapter-content, .chapter-content', 'chapterContentBlock');
        const rawContent = contentBlock.html() || '';
        const sanitizedContent = sanitizeChapterHtml(rawContent);

        const prevHref = $('#prev_chap, a.btn-prev, a[class*="prev"]').first().attr('href');
        const nextHref = $('#next_chap, a.btn-next, a[class*="next"]').first().attr('href');

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
    } catch (error: any) {
        console.error('[NovelBin] Chapter content error:', error?.message || error);
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

        AdaptiveEngine.query($, '.c-tabs-item__content, .page-item-detail', 'mediaSearchCard').each((_, el) => {
            const title = $(el).find('.post-title a, h3 a').first().text().trim();
            const href = $(el).find('.post-title a, h3 a').first().attr('href');
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

        const title = AdaptiveEngine.queryOne($, '.post-title h1, h1', 'detailTitle').text().trim() || 'Untitled Novel';
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

            chapters.push({
                id: `wx:${chapterSlug}`,
                number: idx + 1,
                title: ch.title,
                url: ch.href,
            });
        });

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
        const contentBlock = AdaptiveEngine.queryOne($, '.reading-content, .text-left', 'chapterContentBlock');
        const rawContent = contentBlock.html() || '';
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

        AdaptiveEngine.query($, '.fiction-list-item', 'mediaSearchCard').each((_, el) => {
            const titleEl = $(el).find('.fiction-title a, h2 a, h3 a').first();
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

        const title = AdaptiveEngine.queryOne($, 'h1', 'detailTitle').text().trim() || 'Untitled Novel';
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
        const contentBlock = AdaptiveEngine.queryOne($, '.chapter-content', 'chapterContentBlock');
        const rawContent = contentBlock.html() || '';
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
        const seenSlugs = new Set<string>();

        AdaptiveEngine.query($, '.list-truyen .row, .con, .list .item', 'mediaSearchCard').each((_, el) => {
            let title = $(el).find('.truyen-title a, h3.tit a, h3 a').first().text().trim();
            let href = $(el).find('.truyen-title a, h3.tit a, h3 a').first().attr('href');
            if (!title || !href) {
                const fallbackA = $(el).find('a[href*=".html"], a').filter((_, a) => $(a).text().trim().length > 2 && !$(a).find('img').length).first();
                title = fallbackA.text().trim();
                href = fallbackA.attr('href');
            }
            const imgEl = $(el).find('.pic img, img').first();
            const img = imgEl.attr('src') || imgEl.attr('data-src');
            if (title && href) {
                const slug = href.replace(/^\//, '').replace(/\.html$/, '');
                if (seenSlugs.has(slug)) return;
                seenSlugs.add(slug);
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

        const title = AdaptiveEngine.queryOne($, 'h1, .books .title, .title', 'detailTitle').text().trim() || 'Untitled Novel';
        const coverImg = $('.book img, .pic img, .info-holder img').first();
        const cover = coverImg.attr('src') || coverImg.attr('data-src') || '';
        const author = $('.info a[href*="/author/"]').text().trim() || 'Unknown';
        const status = $('.info a[href*="/status/"]').text().trim() || 'Ongoing';

        const genres: string[] = [];
        $('.info a[href*="/genre/"]').each((_, el) => {
            const g = $(el).text().trim();
            if (g && !genres.includes(g)) genres.push(g);
        });

        const description = $('#tab-description, .desc-text, .desc').text().trim();

        const chapters: NovelChapter[] = [];
        let num = 1;
        const seenSlugs = new Set<string>();

        // Try AllNovelFull AJAX chapter list to fetch all pages (each page has 50 chapters)
        const novelId = $('input#truyen-id').val() || $('[data-novel-id]').first().attr('data-novel-id');
        let rawHtmlChunks: string[] = [];

        if (novelId) {
            try {
                const { data: page1 } = await axiosANF.get(`/ajax-chapter-list?novelId=${novelId}&page=1`);
                if (page1?.html) {
                    rawHtmlChunks.push(page1.html);
                    const totalPage = Number(page1.totalPage) || 1;
                    if (totalPage > 1) {
                        const pagePromises = [];
                        for (let p = 2; p <= Math.min(totalPage, 50); p++) {
                            pagePromises.push(
                                axiosANF.get(`/ajax-chapter-list?novelId=${novelId}&page=${p}`)
                                    .then(r => r.data?.html || '')
                                    .catch(() => '')
                            );
                        }
                        const rest = await Promise.all(pagePromises);
                        rawHtmlChunks.push(...rest);
                    }
                }
            } catch (err: any) {
                console.warn('[AllNovelFull] AJAX chapter fetch failed:', err?.message || err);
            }
        }

        if (rawHtmlChunks.length > 0) {
            for (const chunk of rawHtmlChunks) {
                if (!chunk) continue;
                const $chunk = cheerio.load(chunk);
                $chunk('a[href*="/chapter-"], a').each((_, el) => {
                    const cTitle = $chunk(el).text().trim();
                    const cHref = $chunk(el).attr('href') || '';
                    if (cHref && !cHref.includes('?page=') && !cHref.includes('.html?') && !cHref.includes('javascript:')) {
                        const cSlug = cHref.replace(/^\//, '').replace(/\.html$/, '');
                        if (!cSlug || seenSlugs.has(cSlug)) return;
                        seenSlugs.add(cSlug);

                        chapters.push({
                            id: `anf:${cSlug}`,
                            number: num++,
                            title: cTitle,
                            url: cHref.startsWith('http') ? cHref : `${ALLNOVELFULL_BASE}${cHref.startsWith('/') ? '' : '/'}${cHref}`,
                        });
                    }
                });
            }
        } else {
            // Fallback to static HTML
            AdaptiveEngine.query($, '#list-chapter a, .list-chapter a', 'chapterItem').each((_, el) => {
                const cTitle = $(el).text().trim();
                const cHref = $(el).attr('href') || '';
                if (cHref && !cHref.includes('?page=') && !cHref.includes('.html?') && !cHref.includes('javascript:') && !/^(first|next|last|prev)$/i.test(cTitle)) {
                    const cSlug = cHref.replace(/^\//, '').replace(/\.html$/, '');
                    if (!cSlug || seenSlugs.has(cSlug)) return;
                    seenSlugs.add(cSlug);

                    chapters.push({
                        id: `anf:${cSlug}`,
                        number: num++,
                        title: cTitle,
                        url: cHref.startsWith('http') ? cHref : `${ALLNOVELFULL_BASE}${cHref.startsWith('/') ? '' : '/'}${cHref}`,
                    });
                }
            });
        }

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

        const title = $('.chapter-title').text().trim() || $('h1').text().trim() || $('h2').text().trim() || 'Chapter';
        const contentBlock = AdaptiveEngine.queryOne($, '#chapter-content, #chr-content, .chr-c', 'chapterContentBlock');
        const rawContent = contentBlock.html() || '';
        const sanitizedContent = sanitizeChapterHtml(rawContent);

        const prevHref = $('a#prev_chap, a.btn-prev').attr('href');
        const nextHref = $('a#next_chap, a.btn-next').attr('href');

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

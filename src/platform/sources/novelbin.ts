import type { LNChapter, LNChapterContent } from '../../types/ln';
import { getJson, getText } from '../nativeHttp';
import { registerLocalSource } from './registry';
import type { LocalSourceAdapter, SourceSearchResult } from './types';

const ANF_BASE_URL = 'https://allnovelfull.com';
const NF_BASE_URL = 'https://novelfire.net';

export type NovelBinResult = SourceSearchResult & {
    cover?: string;
    source: 'novelbin' | 'allnovelfull' | 'novelfire';
};

export type NovelBinDetails = {
    id: string;
    title: string;
    cover: string;
    description: string;
    author: string;
    status: string;
    genres: string[];
    source: 'novelbin' | 'allnovelfull' | 'novelfire';
    chapters: LNChapter[];
};

const chapterListCache = new Map<string, { chapters: LNChapter[]; timestamp: number }>();
const detailsCache = new Map<string, { data: NovelBinDetails; timestamp: number }>();
const CACHE_TTL = 20 * 60 * 1000;

const parseHtml = (html: string) => new DOMParser().parseFromString(html, 'text/html');
const text = (element: Element | null) => element?.textContent?.trim().replace(/\s+/g, ' ') || '';

const absoluteUrl = (value: string, base = ANF_BASE_URL) => {
    if (!value) return '';
    if (/^https?:\/\//i.test(value)) return value;
    if (value.startsWith('//')) return `https:${value}`;
    return `${base}${value.startsWith('/') ? '' : '/'}${value}`;
};

const normalizeSlug = (input: string) => {
    let value = String(input || '').trim().replace(/^(nb|anf|nf):/i, '');
    try {
        if (/^https?:\/\//i.test(value)) value = new URL(value).pathname;
    } catch {
        // Normalize the raw identifier below.
    }
    return value
        .replace(/^\/+/, '')
        .replace(/^(novel-bin|book)\//i, '')
        .replace(/\.html$/i, '')
        .replace(/\/+$/, '');
};

const scoreTitle = (query: string, title: string) => {
    const normalize = (value: string) => value.toLowerCase().replace(/['\u2019\u2018`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    const expected = normalize(query);
    const actual = normalize(title);
    if (!expected || !actual) return 0;
    if (actual === expected) return 100;
    if (actual.includes(expected) || expected.includes(actual)) return 90;
    const tokens = expected.split(' ').filter((token) => token.length > 1);
    const actualTokens = new Set(actual.split(' '));
    return tokens.length ? (tokens.filter((token) => actualTokens.has(token)).length / tokens.length) * 80 : 0;
};

const parseAnfSearch = (html: string): NovelBinResult[] => {
    const document = parseHtml(html);
    const seen = new Set<string>();
    return [...document.querySelectorAll('.list-truyen .row, .list .item, .li-row')]
        .flatMap((row) => {
            const link = row.querySelector<HTMLAnchorElement>('.truyen-title a, h3.tit a, h3 a, a[href$=".html"][title], a[href$=".html"]');
            if (!link) return [];
            const href = link.getAttribute('href') || '';
            const title = link.getAttribute('title')?.trim() || text(link);
            const slug = normalizeSlug(href);
            if (!slug || !title || slug.includes('chapter-') || slug.includes('/') || seen.has(slug)) return [];
            seen.add(slug);
            const img = row.querySelector<HTMLImageElement>('img');
            const cover = absoluteUrl(img?.dataset.src || img?.getAttribute('src') || '', ANF_BASE_URL);
            return [{
                id: `anf:${slug}`,
                title,
                image: cover,
                cover,
                url: `${ANF_BASE_URL}/${slug}.html`,
                source: 'allnovelfull' as const,
            }];
        });
};

const parseNfSearch = (html: string): NovelBinResult[] => {
    const document = parseHtml(html);
    const seen = new Set<string>();
    return [...document.querySelectorAll('li.novel-item, .novel-list .novel-item')]
        .flatMap((item) => {
            const link = item.querySelector<HTMLAnchorElement>('a[href*="/book/"]');
            if (!link) return [];
            const href = link.getAttribute('href') || '';
            const slug = normalizeSlug(href).split('/')[0];
            const title = link.getAttribute('title')?.trim() || text(item.querySelector('.novel-title, h4, h3')) || text(link);
            if (!slug || !title || seen.has(slug)) return [];
            seen.add(slug);
            const img = item.querySelector<HTMLImageElement>('img');
            const cover = absoluteUrl(img?.dataset.src || img?.getAttribute('src') || '', NF_BASE_URL);
            return [{
                id: `nf:${slug}`,
                title,
                image: cover,
                cover,
                url: `${NF_BASE_URL}/book/${slug}`,
                source: 'novelfire' as const,
            }];
        });
};

const isExplicitWebNovelHtml = (html: string): boolean => {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || '';
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1] || '';
    const combined = `${titleMatch} ${h1Match}`;
    return /\b(?:web\s*novel|wn)\b/i.test(combined) && !/\b(?:light\s*novel|ln)\b/i.test(combined);
};

const buildCandidateSlugs = (titles: string[], preferLightNovel = false): string[] => {
    const toSlug = (s: string) => s
        .toLowerCase()
        .replace(/['\u2019\u2018`]/g, '')
        .replace(/\s*[\(\[].*?[\)\]]\s*/g, ' ')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    const lnCandidates: string[] = [];
    const baseCandidates: string[] = [];
    const addTo = (list: string[], c: string) => {
        if (c && c.length >= 3 && !list.includes(c)) list.push(c);
    };

    for (const rawTitle of titles) {
        if (!/[A-Za-z0-9]/.test(rawTitle)) continue;
        const base = toSlug(rawTitle);
        if (preferLightNovel && base && !/-ln$|-light-novel$/.test(base)) {
            addTo(lnCandidates, `${base}-ln`);
            addTo(lnCandidates, `${base}-light-novel`);
        }
        addTo(baseCandidates, base);
        const stripped = toSlug(
            rawTitle
                .replace(/^so\s+/i, '')
                .replace(/\bas i expected\b/gi, 'as expected')
        );
        addTo(baseCandidates, stripped);
        const beforeColon = rawTitle.split(/[:–—―]/)[0]?.trim() || '';
        if (beforeColon.length >= 4 && beforeColon !== rawTitle) {
            const colonSlug = toSlug(beforeColon);
            if (preferLightNovel && colonSlug && !/-ln$|-light-novel$/.test(colonSlug)) {
                addTo(lnCandidates, `${colonSlug}-ln`);
                addTo(lnCandidates, `${colonSlug}-light-novel`);
            }
            addTo(baseCandidates, colonSlug);
        }
    }

    return [...lnCandidates, ...baseCandidates].slice(0, preferLightNovel ? 12 : 8);
};

const cleanChapterContent = (container: Element | null) => {
    if (!container) return '';
    const clone = container.cloneNode(true) as Element;
    clone.querySelectorAll('script, style, iframe, ins, .adsbygoogle, .ads, .ad-container, .ads-holder, .nf-ads, div[align="center"]').forEach((node) => node.remove());
    clone.querySelectorAll('p').forEach((paragraph) => {
        const value = text(paragraph);
        if (/find light novel|read novel online|translator:|editor:|novel-bin|allnovelfull|novelfire|novgo|freewebnovel/i.test(value) && value.length < 140) {
            paragraph.remove();
        }
    });
    const paragraphs = [...clone.querySelectorAll('p')]
        .map((paragraph) => paragraph.outerHTML.trim())
        .filter((html) => html.length > 7);
    return paragraphs.length > 0 ? paragraphs.join('') : clone.innerHTML;
};

const getAnfDetails = async (rawInput: string): Promise<NovelBinDetails> => {
    const slug = normalizeSlug(rawInput).split('/')[0];
    const cacheKey = `anf:${slug}`;
    const cached = detailsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL && cached.data.chapters.length > 0) {
        return cached.data;
    }

    const url = `${ANF_BASE_URL}/${slug}.html`;
    const html = await getText(url, { Referer: ANF_BASE_URL });
    const document = parseHtml(html);
    const title = text(document.querySelector('h1, .books .title, .title')) || slug.replace(/-/g, ' ');
    const coverImg = document.querySelector<HTMLImageElement>('.book img, .pic img, .info-holder img');
    const cover = absoluteUrl(coverImg?.dataset.src || coverImg?.getAttribute('src') || '', ANF_BASE_URL);
    const author = text(document.querySelector('.info a[href*="/author/"]')) || 'Unknown';
    const status = text(document.querySelector('.info a[href*="/status/"]')) || 'Ongoing';
    const genres = [...document.querySelectorAll('.info a[href*="/genre/"]')].map((el) => text(el)).filter(Boolean);
    const description = text(document.querySelector('#tab-description, .desc-text, .desc'));

    const novelId = document.querySelector('[data-novel-id]')?.getAttribute('data-novel-id')
        || document.querySelector<HTMLInputElement>('input#truyen-id')?.value
        || html.match(/data-novel-id="(\d+)"/i)?.[1]
        || '';

    const chapters: LNChapter[] = [];
    const seen = new Set<string>();
    let num = 1;

    const pushChapter = (cHref: string, cTitle: string) => {
        if (!cHref || cHref.includes('?page=') || cHref.includes('javascript:') || /^(first|next|last|prev)$/i.test(cTitle)) return;
        const cSlug = normalizeSlug(cHref);
        if (!cSlug || !cSlug.includes('/') || seen.has(cSlug)) return;
        seen.add(cSlug);
        chapters.push({
            id: `anf:${cSlug}`,
            number: num++,
            title: cTitle || `Chapter ${num - 1}`,
            url: absoluteUrl(cHref, ANF_BASE_URL),
        });
    };

    // Fast path: ONE single HTTP request returns every chapter option in order
    if (novelId) {
        try {
            const optionHtml = await getText(
                `${ANF_BASE_URL}/ajax-chapter-option?novelId=${encodeURIComponent(novelId)}`,
                { Referer: url },
            );
            const optionDoc = parseHtml(optionHtml);
            optionDoc.querySelectorAll<HTMLOptionElement>('option[value]').forEach((opt) => {
                pushChapter(opt.getAttribute('value') || '', text(opt));
            });
        } catch {
            // Fall through to ajax-chapter-list or inline chapter links
        }
    }

    if (chapters.length === 0 && novelId) {
        try {
            const page1 = await getJson<{ html?: string; totalPage?: number }>(
                `${ANF_BASE_URL}/ajax-chapter-list?novelId=${encodeURIComponent(novelId)}&page=1`,
                { Referer: url },
            );
            if (page1?.html) {
                parseHtml(page1.html).querySelectorAll<HTMLAnchorElement>('a[href]').forEach((link) => {
                    pushChapter(link.getAttribute('href') || '', text(link));
                });
                const totalPage = Math.min(Number(page1.totalPage) || 1, 25);
                if (totalPage > 1) {
                    const rest = await Promise.all(
                        Array.from({ length: totalPage - 1 }, (_, idx) =>
                            getJson<{ html?: string }>(
                                `${ANF_BASE_URL}/ajax-chapter-list?novelId=${encodeURIComponent(novelId)}&page=${idx + 2}`,
                                { Referer: url },
                            ).then((r) => r?.html || '').catch(() => '')
                        )
                    );
                    rest.forEach((chunk) => {
                        if (!chunk) return;
                        parseHtml(chunk).querySelectorAll<HTMLAnchorElement>('a[href]').forEach((link) => {
                            pushChapter(link.getAttribute('href') || '', text(link));
                        });
                    });
                }
            }
        } catch {
            // Fall back to inline HTML chapter list
        }
    }

    if (chapters.length === 0) {
        document.querySelectorAll<HTMLAnchorElement>('#list-chapter a, .list-chapter a, a[href*="/chapter-"]').forEach((link) => {
            pushChapter(link.getAttribute('href') || '', text(link));
        });
    }

    const details: NovelBinDetails = {
        id: `anf:${slug}`,
        title,
        cover,
        description,
        author,
        status,
        genres,
        source: 'allnovelfull',
        chapters,
    };
    if (chapters.length > 0) {
        detailsCache.set(cacheKey, { data: details, timestamp: Date.now() });
        chapterListCache.set(cacheKey, { chapters, timestamp: Date.now() });
    }
    return details;
};

const getNfDetails = async (rawInput: string): Promise<NovelBinDetails> => {
    const slug = normalizeSlug(rawInput).split('/')[0];
    const cacheKey = `nf:${slug}`;
    const cached = detailsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL && cached.data.chapters.length > 0) {
        return cached.data;
    }

    const chaptersUrl = `${NF_BASE_URL}/book/${slug}/chapters`;
    const page1Html = await getText(chaptersUrl, { Referer: `${NF_BASE_URL}/book/${slug}` });
    const page1Doc = parseHtml(page1Html);

    const chapters: LNChapter[] = [];
    const seen = new Set<string>();
    let num = 1;

    const extractNfChapters = (doc: Document) => {
        doc.querySelectorAll<HTMLAnchorElement>(`ul.chapter-list a[href*="/book/${slug}/chapter-"], a[href*="/book/${slug}/chapter-"]`).forEach((link) => {
            const cHref = link.getAttribute('href') || '';
            if (!cHref || cHref.includes('#')) return;
            const cSlug = normalizeSlug(cHref);
            if (!cSlug || !cSlug.startsWith(`${slug}/chapter-`) || seen.has(cSlug)) return;
            seen.add(cSlug);
            const rawTitle = link.getAttribute('title')?.trim()
                || text(link.querySelector('.chapter-title, strong'))
                || text(link);
            chapters.push({
                id: `nf:${cSlug}`,
                number: num++,
                title: rawTitle || `Chapter ${num - 1}`,
                url: absoluteUrl(cHref, NF_BASE_URL),
            });
        });
    };

    extractNfChapters(page1Doc);

    const pageNumbers = [...page1Doc.querySelectorAll<HTMLAnchorElement>('a[href*="chapters?page="]')]
        .map((a) => Number(a.getAttribute('href')?.match(/page=(\d+)/)?.[1] || 0))
        .filter((n) => n > 1);
    const maxPage = Math.min(pageNumbers.length > 0 ? Math.max(...pageNumbers) : 1, 25);

    if (maxPage > 1) {
        // Fetch remaining pages in small parallel batches of 5 to keep mobile fast & polite
        for (let start = 2; start <= maxPage; start += 5) {
            const batchPages = Array.from({ length: Math.min(5, maxPage - start + 1) }, (_, idx) => start + idx);
            const pagesHtml = await Promise.all(
                batchPages.map((p) =>
                    getText(`${chaptersUrl}?page=${p}`, { Referer: chaptersUrl }).catch(() => '')
                )
            );
            pagesHtml.forEach((chunk) => {
                if (chunk) extractNfChapters(parseHtml(chunk));
            });
        }
    }

    const title = text(page1Doc.querySelector('h1, .novel-title, .book-title')) || slug.replace(/-/g, ' ');
    const coverImg = page1Doc.querySelector<HTMLImageElement>('.cover img, .novel-cover img, meta[property="og:image"]');
    const cover = absoluteUrl(
        coverImg?.getAttribute('content') || coverImg?.dataset.src || coverImg?.getAttribute('src') || '',
        NF_BASE_URL
    );

    const details: NovelBinDetails = {
        id: `nf:${slug}`,
        title,
        cover,
        description: '',
        author: 'Unknown',
        status: 'Ongoing',
        genres: [],
        source: 'novelfire',
        chapters,
    };
    if (chapters.length > 0) {
        detailsCache.set(cacheKey, { data: details, timestamp: Date.now() });
        chapterListCache.set(cacheKey, { chapters, timestamp: Date.now() });
    }
    return details;
};

const getAnfContent = async (rawInput: string): Promise<LNChapterContent> => {
    const slug = normalizeSlug(rawInput);
    const url = `${ANF_BASE_URL}/${slug}.html`;
    const html = await getText(url, { Referer: `${ANF_BASE_URL}/${slug.split('/')[0]}.html` });
    const document = parseHtml(html);
    const prevHref = document.querySelector<HTMLAnchorElement>('a#prev_chap, a.btn-prev')?.getAttribute('href');
    const nextHref = document.querySelector<HTMLAnchorElement>('a#next_chap, a.btn-next')?.getAttribute('href');
    const numberMatch = slug.match(/chapter-([\d.]+)/i);
    const content = cleanChapterContent(document.querySelector('#chapter-content, #chr-content, .chr-c'));
    const readableText = text(parseHtml(content).body);
    if (!readableText || /Just a moment|Access denied|Redirecting/i.test(readableText)) {
        throw new Error(`AllNovelFull returned no readable chapter content for ${slug}`);
    }
    return {
        id: `anf:${slug}`,
        novelId: `anf:${slug.split('/')[0]}`,
        title: text(document.querySelector('.chapter-title, .chr-title, h1, h2')) || 'Chapter',
        chapterNumber: numberMatch ? Number.parseFloat(numberMatch[1]) : 1,
        content,
        prevChapterId: prevHref && !prevHref.includes('javascript:') ? `anf:${normalizeSlug(prevHref)}` : null,
        nextChapterId: nextHref && !nextHref.includes('javascript:') ? `anf:${normalizeSlug(nextHref)}` : null,
    };
};

const getNfContent = async (rawInput: string): Promise<LNChapterContent> => {
    const slug = normalizeSlug(rawInput);
    const url = `${NF_BASE_URL}/book/${slug}`;
    const html = await getText(url, { Referer: `${NF_BASE_URL}/book/${slug.split('/')[0]}/chapters` });
    const document = parseHtml(html);
    const prevHref = document.querySelector<HTMLAnchorElement>('a.prevchap, a[rel="prev"], a.chnav.prev')?.getAttribute('href');
    const nextHref = document.querySelector<HTMLAnchorElement>('a.nextchap, a[rel="next"], a.chnav.next')?.getAttribute('href');
    const numberMatch = slug.match(/chapter-([\d.]+)/i);
    const content = cleanChapterContent(document.querySelector('#content, #chapter-container, .chapter-content, article#chapter-article'));
    const readableText = text(parseHtml(content).body);
    if (!readableText || /Just a moment|Access denied|Redirecting/i.test(readableText)) {
        throw new Error(`NovelFire returned no readable chapter content for ${slug}`);
    }
    return {
        id: `nf:${slug}`,
        novelId: `nf:${slug.split('/')[0]}`,
        title: text(document.querySelector('.chapter-title, h1, .titles h2')) || 'Chapter',
        chapterNumber: numberMatch ? Number.parseFloat(numberMatch[1]) : 1,
        content,
        prevChapterId: prevHref && !prevHref.includes('javascript:') ? `nf:${normalizeSlug(prevHref)}` : null,
        nextChapterId: nextHref && !nextHref.includes('javascript:') ? `nf:${normalizeSlug(nextHref)}` : null,
    };
};

export const novelBinSource: LocalSourceAdapter<NovelBinDetails, LNChapterContent> & {
    probeByTitles(titles: string[], expectedEdition?: 'light-novel' | 'web-novel' | 'unknown'): Promise<string | null>;
    getDetailsFast(input: string, chaptersOnly?: boolean): Promise<NovelBinDetails>;
} = {
    id: 'novelbin',
    kind: 'novel',
    name: 'AllNovelFull / NovelFire',

    async probeByTitles(titles: string[], expectedEdition: 'light-novel' | 'web-novel' | 'unknown' = 'unknown'): Promise<string | null> {
        const preferLightNovel = expectedEdition === 'light-novel';
        const candidates = buildCandidateSlugs(titles, preferLightNovel);
        const probeLimit = preferLightNovel ? 6 : 4;
        for (const slug of candidates.slice(0, probeLimit)) {
            const [anfHit, nfHit] = await Promise.all([
                getText(`${ANF_BASE_URL}/${slug}.html`, { Referer: ANF_BASE_URL })
                    .then((html) => {
                        if (!/data-novel-id="\d+"/i.test(html)) return null;
                        if (preferLightNovel && isExplicitWebNovelHtml(html)) return null;
                        return `anf:${slug}`;
                    })
                    .catch(() => null),
                getText(`${NF_BASE_URL}/book/${slug}/chapters`, { Referer: NF_BASE_URL })
                    .then((html) => {
                        if (!html.includes(`/book/${slug}/chapter-`)) return null;
                        if (preferLightNovel && isExplicitWebNovelHtml(html)) return null;
                        return `nf:${slug}`;
                    })
                    .catch(() => null),
            ]);
            if (anfHit) return anfHit;
            if (nfHit) return nfHit;
        }
        return null;
    },

    async search(query) {
        const trimmed = query.trim();
        if (!/[A-Za-z0-9]/.test(trimmed)) return [];
        const [anfResults, nfResults] = await Promise.all([
            getText(`${ANF_BASE_URL}/search?keyword=${encodeURIComponent(trimmed)}`, { Referer: ANF_BASE_URL })
                .then(parseAnfSearch)
                .catch((error) => {
                    console.warn(`[AllNovelFull] Search failed for "${trimmed}":`, error);
                    return [] as NovelBinResult[];
                }),
            getText(`${NF_BASE_URL}/search?keyword=${encodeURIComponent(trimmed)}`, { Referer: NF_BASE_URL })
                .then(parseNfSearch)
                .catch((error) => {
                    console.warn(`[NovelFire] Search failed for "${trimmed}":`, error);
                    return [] as NovelBinResult[];
                }),
        ]);

        return [...anfResults, ...nfResults].sort(
            (left, right) => scoreTitle(trimmed, right.title) - scoreTitle(trimmed, left.title)
        );
    },

    async getDetailsFast(input) {
        return this.getDetails(input);
    },

    async getDetails(input) {
        const raw = String(input || '').trim();
        if (raw.startsWith('nf:')) {
            return getNfDetails(raw);
        }
        if (raw.startsWith('anf:')) {
            return getAnfDetails(raw);
        }
        // Legacy `nb:` IDs automatically re-route to AllNovelFull, then NovelFire
        const slug = normalizeSlug(raw).split('/chapter-')[0];
        try {
            const anf = await getAnfDetails(`anf:${slug}`);
            if (anf.chapters.length > 0) return anf;
        } catch {
            // Fall through to NovelFire
        }
        return getNfDetails(`nf:${slug}`);
    },

    async getContent(input) {
        const raw = String(input || '').trim();
        if (raw.startsWith('nf:')) {
            return getNfContent(raw);
        }
        if (raw.startsWith('anf:')) {
            return getAnfContent(raw);
        }
        // Legacy `nb:` chapter IDs try AllNovelFull, then NovelFire
        const slug = normalizeSlug(raw);
        try {
            return await getAnfContent(`anf:${slug}`);
        } catch {
            return getNfContent(`nf:${slug}`);
        }
    },
};

registerLocalSource(novelBinSource);

import type { MangaChapter, MangaPage } from '../../types/manga';
import { getText } from '../nativeHttp';
import { registerLocalSource } from './registry';
import type { LocalSourceAdapter, SourceSearchResult } from './types';

const BASE_URL = 'https://mangakatana.com';

export type MangaKatanaResult = SourceSearchResult & {
    thumbnail: string;
    latestChapter?: string;
    altNames?: string[];
    source: 'mangakatana';
};

export type MangaKatanaDetails = {
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
    chapters: MangaChapter[];
};

export type MangaKatanaList = {
    results: MangaKatanaResult[];
    totalPages: number;
};

export type MangaKatanaHotUpdate = {
    id: string;
    title: string;
    chapter: string;
    url: string;
    thumbnail: string;
    source: 'mangakatana';
};

const absoluteUrl = (value: string) => {
    if (!value) return '';
    if (value.startsWith('http')) return value;
    if (value.startsWith('//')) return `https:${value}`;
    return `${BASE_URL}${value.startsWith('/') ? '' : '/'}${value}`;
};

const normalizeId = (input: string) => {
    let value = String(input || '').trim().replace(/^mk:/i, '');
    try {
        if (/^https?:\/\//i.test(value)) value = new URL(value).pathname;
    } catch {
        // Keep the original value and normalize it below.
    }
    const mangaMarker = value.indexOf('/manga/');
    if (mangaMarker >= 0) value = value.slice(mangaMarker + '/manga/'.length);
    return value.replace(/^\/+|\/+$/g, '').split(/[/?#]/)[0];
};

const parseHtml = (html: string) => new DOMParser().parseFromString(html, 'text/html');
const text = (element: Element | null) => element?.textContent?.trim() || '';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const detailsCache = new Map<string, { data: MangaKatanaDetails; timestamp: number }>();
const DETAILS_CACHE_TTL = 15 * 60 * 1000;

let searchRequestQueue: Promise<void> = Promise.resolve();
let lastSearchRequestAt = 0;

const waitForMangaKatanaSearchSlot = async () => {
    const previous = searchRequestQueue;
    let release!: () => void;
    searchRequestQueue = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
        const delay = Math.max(0, 1_200 - (Date.now() - lastSearchRequestAt));
        if (delay > 0) await sleep(delay);
        lastSearchRequestAt = Date.now();
    } finally {
        release();
    }
};

const parseChapters = (document: Document): MangaChapter[] => (
    [...document.querySelectorAll('tr')].flatMap((row) => {
        const link = row.querySelector<HTMLElement>('.chapter a');
        const title = text(link);
        const url = absoluteUrl(link?.getAttribute('href') || '');
        if (!title || !url) return [];
        return [{
            id: url.replace(/\/$/, '').split('/').pop() || '',
            title,
            url,
            uploadDate: text(row.querySelector('.update_time')),
        }];
    })
);

const parseDetailsFromDocument = (id: string, url: string, document: Document): MangaKatanaDetails => {
    const cover = document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content
        || document.querySelector<HTMLImageElement>('.cover img, .media .wrap_img img')?.dataset.src
        || document.querySelector<HTMLImageElement>('.cover img, .media .wrap_img img')?.src
        || '';

    return {
        id,
        title: text(document.querySelector('h1.heading')),
        altNames: text(document.querySelector('.alt_name')).split(';').map((name) => name.trim()).filter(Boolean),
        author: text(document.querySelector('.author')),
        status: text(document.querySelector('.value.status')),
        genres: [...document.querySelectorAll('.genres > a')].map((genre) => text(genre)).filter(Boolean),
        synopsis: text(document.querySelector('.summary > p')),
        coverImage: absoluteUrl(cover),
        url,
        source: 'mangakatana',
        chapters: parseChapters(document),
    };
};

const parseSearchResults = (html: string): MangaKatanaResult[] => {
    const document = parseHtml(html);
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.getAttribute('href')
        || document.querySelector<HTMLMetaElement>('meta[property="og:url"]')?.getAttribute('content') || '';
    const title = text(document.querySelector('h1.heading'));
    try {
        const url = new URL(canonical, BASE_URL);
        if (title && url.hostname === new URL(BASE_URL).hostname && /^\/manga\/[^/]+\/?$/.test(url.pathname)) {
            const id = normalizeId(url.href);
            const details = parseDetailsFromDocument(id, url.href, document);
            if (details.chapters.length > 0) {
                detailsCache.set(id, { data: details, timestamp: Date.now() });
            }
            const thumbnail = details.coverImage;
            return [{
                id,
                title: details.title || title,
                altNames: details.altNames,
                latestChapter: details.chapters[0]?.title,
                image: thumbnail,
                thumbnail,
                url: url.href,
                source: 'mangakatana',
            }];
        }
    } catch {
        // Continue parsing the search results if the canonical URL is invalid.
    }
    const seen = new Set<string>();

    return [...document.querySelectorAll('#book_list .item, .item')].flatMap((item) => {
        const candidates = [...item.querySelectorAll<HTMLAnchorElement>('h3.title a, div.text > h3 > a, .title a, a[href*="/manga/"]')];
        const link = candidates.find((candidate) => text(candidate) && candidate.href.includes('/manga/'));
        if (!link) return [];

        const id = normalizeId(link.href);
        if (!id || seen.has(id)) return [];
        seen.add(id);

        const image = item.querySelector<HTMLImageElement>('.media .wrap_img img, div.cover img, img');
        const thumbnail = absoluteUrl(image?.dataset.src || image?.getAttribute('src') || '');
        const altNames = text(item.querySelector('.alt_name')).split(';').map((name) => name.trim()).filter(Boolean);
        return [{
            id,
            title: text(link),
            altNames,
            image: thumbnail,
            thumbnail,
            url: absoluteUrl(link.getAttribute('href') || link.href),
            latestChapter: text(item.querySelector('.chapter a')),
            source: 'mangakatana' as const,
        }];
    });
};

const scoreSingleTitle = (query: string, candidateTitle: string) => {
    const normalize = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    const expected = normalize(query);
    const actual = normalize(candidateTitle);
    if (!expected || !actual) return 0;
    if (actual === expected) return 100;
    if (actual.includes(expected) || (actual.length >= 5 && expected.startsWith(`${actual} `))) return 90;
    const tokens = expected.split(' ').filter((token) => token.length > 1);
    const titleTokens = new Set(actual.split(' '));
    return tokens.length ? tokens.filter((token) => titleTokens.has(token)).length / tokens.length * 80 : 0;
};

const ONESHOT_OR_SPINOFF_REGEX = /\b(one[\s-]?shot|pilot|doujinshi|anthology|4-koma|fan\s*colored|parody)\b/i;

const extractChapterNumber = (chapterLabel?: string): number => {
    const raw = String(chapterLabel || '');
    if (!raw) return 0;
    const match = raw.match(/(?:chapter|ch\.?)\s*(\d+(?:\.\d+)?)/i) || raw.match(/(\d+(?:\.\d+)?)/);
    return match ? Number.parseFloat(match[1]) || 0 : 0;
};

const scoreResult = (query: string, item: MangaKatanaResult) => {
    const candidates = [item.title, ...(item.altNames || [])].filter(Boolean);
    let score = candidates.reduce((best, candidate) => Math.max(best, scoreSingleTitle(query, candidate)), 0);

    // Strongly penalize oneshots/pilots/doujinshi unless the user explicitly searched for them
    const queryWantsSpecial = ONESHOT_OR_SPINOFF_REGEX.test(query);
    if (!queryWantsSpecial) {
        const titleLooksSpecial = ONESHOT_OR_SPINOFF_REGEX.test(item.title || '');
        const chapterLooksOneshot = ONESHOT_OR_SPINOFF_REGEX.test(item.latestChapter || '')
            || /^\s*(?:chapter|ch\.?)\s*0(?:\b|:)/i.test(item.latestChapter || '');
        if (titleLooksSpecial) score -= 35;
        if (chapterLooksOneshot) score -= 35;

        // Reward real serialized chapter depth so main series (e.g. 200+ / 1100+ chapters) beat 1-chapter entries
        const latestNum = extractChapterNumber(item.latestChapter);
        if (latestNum >= 5) {
            score += Math.min(18, Math.log10(latestNum + 1) * 6);
        } else if (latestNum > 0 && latestNum <= 1) {
            score -= 10;
        }
    }

    return score;
};

const isSafeSingleTitleMatch = (query: string, candidateTitle: string) => {
    const normalize = (value: string) => String(value || '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .replace(/\b(the|a|an|manga|manhwa|manhua)\b/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const expected = normalize(query);
    const actual = normalize(candidateTitle);
    if (!expected || !actual) return false;
    if (actual === expected) return true;
    if (actual.startsWith(`${expected} `) || actual.includes(` ${expected} `)) return true;
    if (actual.length >= 5 && expected.startsWith(`${actual} `)) return true;

    const expectedTokens = expected.split(' ').filter((token) => token.length > 1);
    const actualTokens = new Set(actual.split(' ').filter((token) => token.length > 1));
    if (expectedTokens.length === 0) return false;
    const matched = expectedTokens.filter((token) => actualTokens.has(token)).length;
    const ratio = matched / expectedTokens.length;

    return ratio >= 0.82 && expectedTokens.length >= 2;
};

const isSafeTitleMatch = (query: string, item: MangaKatanaResult) => {
    const candidates = [item.title, ...(item.altNames || [])].filter(Boolean);
    return candidates.some((candidate) => isSafeSingleTitleMatch(query, candidate));
};

export const mangaKatanaSource: LocalSourceAdapter<MangaKatanaDetails, MangaPage[]> & {
    getChapters(id: string): Promise<MangaChapter[]>;
    getList(path: '/latest' | '/new-manga' | '/manga', page?: number): Promise<MangaKatanaList>;
    getHotUpdates(): Promise<MangaKatanaHotUpdate[]>;
} = {
    id: 'mangakatana',
    kind: 'manga',
    name: 'MangaKatana',

    async search(query) {
        const normalized = query.trim();
        if (!/[A-Za-z0-9]/.test(normalized)) return [];
        const cleaned = normalized
            .replace(/['\u2019]s\b/gi, '')
            .replace(/\s*\(.*?\)\s*/g, ' ')
            .replace(/[^\p{L}\p{N}\s]/gu, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        const colonPrefix = normalized.split(/[:–—]/)[0]?.trim() || '';
        const keywords = cleaned.split(/\s+/).filter((word) => word.length >= 4);
        const queries = [...new Set([
            normalized,
            cleaned !== normalized ? cleaned : '',
            colonPrefix.length >= 4 && colonPrefix !== normalized ? colonPrefix : '',
            [...keywords].sort((a, b) => b.length - a.length)[0],
        ].filter(Boolean))].slice(0, 3);

        for (const search of queries) {
            try {
                const url = `${BASE_URL}/?search=${encodeURIComponent(search)}&search_by=book_name`;
                await waitForMangaKatanaSearchSlot();
                let html = await getText(url, { Referer: BASE_URL });
                if (!html.trim()) {
                    await sleep(1_300);
                    lastSearchRequestAt = Date.now();
                    html = await getText(url, { Referer: BASE_URL });
                }
                if (!html.trim()) continue;
                const results = parseSearchResults(html);
                const matches = results
                    .map((item) => ({
                        item,
                        score: Math.max(scoreResult(normalized, item), scoreResult(search, item)),
                    }))
                    .filter(({ item, score }) => score >= 75 && (isSafeTitleMatch(normalized, item) || isSafeTitleMatch(search, item)))
                    .sort((left, right) => right.score - left.score)
                    .map(({ item }) => item);
                if (matches.length) return matches;
            } catch (error) {
                console.warn(`[MangaKatana] Search failed for "${search}"`, error);
            }
        }
        return [];
    },

    async getDetails(input) {
        const id = normalizeId(input);
        const cached = detailsCache.get(id);
        if (cached && Date.now() - cached.timestamp < DETAILS_CACHE_TTL) {
            return cached.data;
        }
        const url = `${BASE_URL}/manga/${id}`;
        const html = await getText(url, { Referer: BASE_URL });
        if (!html.trim()) throw new Error('MangaKatana returned an empty details response');
        const document = parseHtml(html);
        const details = parseDetailsFromDocument(id, url, document);
        if (details.chapters.length > 0) {
            detailsCache.set(id, { data: details, timestamp: Date.now() });
        }
        return details;
    },

    async getChapters(id) {
        return (await this.getDetails(id)).chapters;
    },

    async getList(path, page = 1) {
        const url = page > 1 ? `${BASE_URL}${path}/page/${page}` : `${BASE_URL}${path}`;
        const document = parseHtml(await getText(url, { Referer: BASE_URL }));
        const results = parseSearchResults(document.documentElement.outerHTML);
        const lastPageText = text([...document.querySelectorAll('a.page-numbers:not(.next)')].pop() || null).replace(/,/g, '');
        return {
            results,
            totalPages: Number.parseInt(lastPageText, 10) || 1,
        };
    },

    async getHotUpdates() {
        const document = parseHtml(await getText(BASE_URL, { Referer: BASE_URL }));
        const container = document.querySelector('#hot_update, .widget-hot-update');
        if (!container) return [];

        return [...container.querySelectorAll('.item')].flatMap((item) => {
            const link = item.querySelector<HTMLAnchorElement>('.title a');
            const title = text(link);
            const url = absoluteUrl(link?.getAttribute('href') || '');
            const id = normalizeId(url);
            if (!id || !title) return [];
            const image = item.querySelector<HTMLImageElement>('.wrap_img img, img');
            return [{
                id,
                title,
                chapter: text(item.querySelector('.chapter a')),
                url,
                thumbnail: absoluteUrl(image?.dataset.src || image?.getAttribute('src') || ''),
                source: 'mangakatana' as const,
            }];
        }).slice(0, 15);
    },

    async getContent(chapterUrl) {
        const html = await getText(absoluteUrl(chapterUrl), { Referer: BASE_URL });
        for (const variable of ['thzq', 'ytaw', 'htnc']) {
            const match = html.match(new RegExp(`var\\s+${variable}\\s*=\\s*\\[([\\s\\S]*?)\\];`, 'm'));
            if (!match?.[1]) continue;
            const urls = [...match[1].matchAll(/['"]([^'"]+)['"]/g)]
                .map((entry) => entry[1].replace(/\\\//g, '/'))
                .filter((url) => /^https?:\/\//i.test(url) || url.startsWith('//'));
            if (urls.length > 0) {
                return urls.map((url, index) => ({ pageNumber: index + 1, imageUrl: absoluteUrl(url) }));
            }
        }

        const document = parseHtml(html);
        return [...document.querySelectorAll<HTMLImageElement>('#imgs img')]
            .map((image) => image.dataset.src || image.getAttribute('src') || '')
            .filter(Boolean)
            .map((url, index) => ({ pageNumber: index + 1, imageUrl: absoluteUrl(url) }));
    },
};

registerLocalSource(mangaKatanaSource);

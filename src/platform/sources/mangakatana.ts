import type { MangaChapter, MangaPage } from '../../types/manga';
import { getText } from '../nativeHttp';
import { registerLocalSource } from './registry';
import type { LocalSourceAdapter, SourceSearchResult } from './types';

const BASE_URL = 'https://mangakatana.com';

export type MangaKatanaResult = SourceSearchResult & {
    thumbnail: string;
    latestChapter?: string;
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

const parseSearchResults = (html: string): MangaKatanaResult[] => {
    const document = parseHtml(html);
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
        return [{
            id,
            title: text(link),
            image: thumbnail,
            thumbnail,
            url: absoluteUrl(link.getAttribute('href') || link.href),
            latestChapter: text(item.querySelector('.chapter a')),
            source: 'mangakatana' as const,
        }];
    });
};

const scoreResult = (query: string, item: MangaKatanaResult) => {
    const normalize = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    const expected = normalize(query);
    const actual = normalize(item.title);
    if (actual === expected) return 100;
    if (actual.includes(expected)) return 90;
    const tokens = expected.split(' ').filter((token) => token.length > 1);
    const titleTokens = new Set(actual.split(' '));
    return tokens.length ? tokens.filter((token) => titleTokens.has(token)).length / tokens.length * 80 : 0;
};

const isSafeTitleMatch = (query: string, item: MangaKatanaResult) => {
    const normalize = (value: string) => String(value || '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .replace(/\b(the|a|an|manga|manhwa|manhua)\b/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const expected = normalize(query);
    const actual = normalize(item.title);
    if (!expected || !actual) return false;
    if (actual === expected) return true;
    if (actual.startsWith(`${expected} `) || actual.includes(` ${expected} `)) return true;

    const expectedTokens = expected.split(' ').filter((token) => token.length > 1);
    const actualTokens = new Set(actual.split(' ').filter((token) => token.length > 1));
    if (expectedTokens.length === 0) return false;
    const matched = expectedTokens.filter((token) => actualTokens.has(token)).length;
    const ratio = matched / expectedTokens.length;

    return ratio >= 0.82 && expectedTokens.length >= 2;
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
        const url = `${BASE_URL}/?search=${encodeURIComponent(query.trim())}&search_by=m_name`;
        const results = parseSearchResults(await getText(url, { Referer: BASE_URL }));
        return results
            .map((item) => ({ item, score: scoreResult(query, item) }))
            .filter(({ item, score }) => score >= 75 && isSafeTitleMatch(query, item))
            .sort((left, right) => right.score - left.score)
            .map(({ item }) => item);
    },

    async getDetails(input) {
        const id = normalizeId(input);
        const url = `${BASE_URL}/manga/${id}`;
        const document = parseHtml(await getText(url, { Referer: BASE_URL }));
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

import type { LNChapter, LNChapterContent } from '../../types/ln';
import { getJson, getText } from '../nativeHttp';
import { registerLocalSource } from './registry';
import type { LocalSourceAdapter, SourceSearchResult } from './types';

const BASE_URL = 'https://novel-bin.com';

export type NovelBinResult = SourceSearchResult & {
    cover?: string;
    source: 'novelbin';
};

export type NovelBinDetails = {
    id: string;
    title: string;
    cover: string;
    description: string;
    author: string;
    status: string;
    genres: string[];
    source: 'novelbin';
    chapters: LNChapter[];
};

const parseHtml = (html: string) => new DOMParser().parseFromString(html, 'text/html');
const text = (element: Element | null) => element?.textContent?.trim().replace(/\s+/g, ' ') || '';

const absoluteUrl = (value: string) => {
    if (!value) return '';
    if (/^https?:\/\//i.test(value)) return value;
    if (value.startsWith('//')) return `https:${value}`;
    return `${BASE_URL}${value.startsWith('/') ? '' : '/'}${value}`;
};

const normalizeSlug = (input: string) => {
    let value = String(input || '').trim().replace(/^nb:/i, '');
    try {
        if (/^https?:\/\//i.test(value)) value = new URL(value).pathname;
    } catch {
        // Normalize the raw identifier below.
    }
    return value
        .replace(/^\/+/, '')
        .replace(/^novel-bin\//i, '')
        .replace(/\/+$/, '');
};

const scoreTitle = (query: string, title: string) => {
    const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const expected = normalize(query);
    const actual = normalize(title);
    if (actual === expected) return 100;
    if (actual.includes(expected) || expected.includes(actual)) return 90;
    const tokens = expected.split(' ').filter((token) => token.length > 1);
    const actualTokens = new Set(actual.split(' '));
    return tokens.length ? tokens.filter((token) => actualTokens.has(token)).length / tokens.length * 80 : 0;
};

const parseSearch = (html: string): NovelBinResult[] => {
    const document = parseHtml(html);
    const seen = new Set<string>();
    return [...document.querySelectorAll<HTMLAnchorElement>('a.almanac-book-row, .list-novel .row a[href*="/novel-bin/"]')]
        .flatMap((link) => {
            const slug = normalizeSlug(link.getAttribute('href') || link.href);
            const title = link.getAttribute('title')?.trim() || text(link.querySelector('h3, strong, .novel-title'));
            if (!slug || !title || slug.includes('/chapter-') || seen.has(slug)) return [];
            seen.add(slug);
            const image = link.querySelector<HTMLImageElement>('img');
            const cover = absoluteUrl(image?.dataset.src || image?.getAttribute('src') || '');
            return [{
                id: `nb:${slug}`,
                title,
                image: cover,
                cover,
                url: `${BASE_URL}/novel-bin/${slug}/`,
                source: 'novelbin' as const,
            }];
        });
};

const cleanChapterContent = (container: Element | null) => {
    if (!container) return '';
    const clone = container.cloneNode(true) as Element;
    clone.querySelectorAll('script, style, iframe, ins, .adsbygoogle, .ads, .ad-container, .ads-holder, div[align="center"]').forEach((node) => node.remove());
    clone.querySelectorAll('p').forEach((paragraph) => {
        const value = text(paragraph);
        if (/find light novel|read novel online|translator:|editor:|novel-bin/i.test(value) && value.length < 120) {
            paragraph.remove();
        }
    });
    const paragraphs = [...clone.querySelectorAll('p')]
        .map((paragraph) => paragraph.outerHTML.trim())
        .filter(Boolean);
    return paragraphs.length > 0 ? paragraphs.join('') : clone.innerHTML;
};

export const novelBinSource: LocalSourceAdapter<NovelBinDetails, LNChapterContent> = {
    id: 'novelbin',
    kind: 'novel',
    name: 'NovelBin',

    async search(query) {
        const results = parseSearch(await getText(`${BASE_URL}/search?keyword=${encodeURIComponent(query.trim())}`, { Referer: BASE_URL }));
        return results.sort((left, right) => scoreTitle(query, right.title) - scoreTitle(query, left.title));
    },

    async getDetails(input) {
        const slug = normalizeSlug(input).split('/chapter-')[0];
        const url = `${BASE_URL}/novel-bin/${slug}/`;
        const html = await getText(url, { Referer: BASE_URL });
        const document = parseHtml(html);
        const schema = [...document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]')]
            .map((script) => {
                try { return JSON.parse(script.textContent || ''); } catch { return null; }
            })
            .find((value) => value?.['@type'] === 'Book');
        const chapterResponse = await getJson<{
            chapters?: Array<{ index?: number; title?: string; url?: string }>;
        }>(`${BASE_URL}/ajax/chapter-list?slug=${encodeURIComponent(slug)}`, { Referer: url });
        const chapters: LNChapter[] = Array.isArray(chapterResponse?.chapters)
            ? chapterResponse.chapters.map((chapter: { index?: number; title?: string; url?: string }, index: number) => {
                const chapterSlug = normalizeSlug(chapter.url || '');
                return {
                    id: `nb:${chapterSlug}`,
                    number: Number(chapter.index) || index + 1,
                    title: chapter.title || `Chapter ${index + 1}`,
                    url: absoluteUrl(chapter.url || ''),
                };
            }).filter((chapter: LNChapter) => Boolean(chapter.url))
            : [];

        return {
            id: `nb:${slug}`,
            title: schema?.name || text(document.querySelector('h1')) || 'Light Novel',
            cover: absoluteUrl(schema?.image || document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content || ''),
            description: String(schema?.description || text(document.querySelector('.desc-text, .description, [class*="synopsis"]'))).replace(/\s*Show More\s*$/i, ''),
            author: schema?.author?.name || text(document.querySelector('.almanac-author, .author, a[href*="/author/"]')) || 'Unknown',
            status: text(document.querySelector('a[href*="/status/"]')) || 'Ongoing',
            genres: Array.isArray(schema?.genre) ? schema.genre : [],
            source: 'novelbin',
            chapters,
        };
    },

    async getContent(input) {
        const slug = normalizeSlug(input);
        const url = `${BASE_URL}/novel-bin/${slug}`;
        const html = await getText(url, { Referer: `${BASE_URL}/novel-bin/${slug.split('/chapter-')[0]}/` });
        const document = parseHtml(html);
        const prevHref = document.querySelector<HTMLAnchorElement>('#prev_chap, a.btn-prev, a[class*="prev"]')?.getAttribute('href');
        const nextHref = document.querySelector<HTMLAnchorElement>('#next_chap, a.btn-next, a[class*="next"]')?.getAttribute('href');
        const numberMatch = slug.match(/chapter-([\d.]+)/i);
        return {
            id: `nb:${slug}`,
            novelId: `nb:${slug.split('/chapter-')[0]}`,
            title: text([...document.querySelectorAll('h1, h2, .chr-title, .chapter-title')].find((element) => /chapter/i.test(text(element))) || null) || 'Chapter',
            chapterNumber: numberMatch ? Number.parseFloat(numberMatch[1]) : 1,
            content: cleanChapterContent(document.querySelector('#chr-content, .chapter-content, article#chapter, .chr-c, .reading-content, #chapter-content')),
            prevChapterId: prevHref && !prevHref.includes('javascript:') ? `nb:${normalizeSlug(prevHref)}` : null,
            nextChapterId: nextHref && !nextHref.includes('javascript:') ? `nb:${normalizeSlug(nextHref)}` : null,
        };
    },
};

registerLocalSource(novelBinSource);

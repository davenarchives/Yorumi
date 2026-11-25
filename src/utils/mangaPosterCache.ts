import { mangaService } from '../services/mangaService';
import type { Manga } from '../types/manga';

export interface EnhancedMangaPosterMeta {
    coverUrl?: string;
    bannerUrl?: string;
    score?: number;
    type?: string;
    countryOfOrigin?: string;
    synopsis?: string;
}

const enhancedCache = new Map<string, EnhancedMangaPosterMeta | null>();
const inFlightRequests = new Map<string, Promise<EnhancedMangaPosterMeta | null>>();

export const cleanMangaHotTitle = (rawTitle: string | undefined): string =>
    String(rawTitle || '')
        .replace(/\s*-\s*chapter\s*.*$/i, '')
        .replace(/\s*chapter\s*.*$/i, '')
        .trim();

const normalizeTitle = (title: string) => title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
const stripLeadingArticle = (title: string) => title.replace(/^(the|a|an)\s+/i, '').trim();

const isStrictAniListMatch = (candidateTitle: string | undefined, targetRaw: string): boolean => {
    if (!candidateTitle) return false;
    const cand = normalizeTitle(candidateTitle);
    const target = normalizeTitle(targetRaw);
    if (!cand || !target) return false;
    if (cand === target) return true;
    const candNoArticle = normalizeTitle(stripLeadingArticle(candidateTitle));
    const targetNoArticle = normalizeTitle(stripLeadingArticle(targetRaw));
    return Boolean(candNoArticle && candNoArticle === targetNoArticle);
};

export const peekEnhancedMangaMeta = (rawTitle: string | undefined): EnhancedMangaPosterMeta | null | undefined => {
    const clean = cleanMangaHotTitle(rawTitle);
    if (!clean) return undefined;
    return enhancedCache.get(clean);
};

export const isHighResAniListPoster = (url: string | undefined): boolean =>
    Boolean(url && /anilist\.co|kitsu\.io|myanimelist\.net/i.test(url));

export const enhanceMangaPosterMeta = async (rawTitle: string | undefined): Promise<EnhancedMangaPosterMeta | null> => {
    const clean = cleanMangaHotTitle(rawTitle);
    if (!clean) return null;

    if (enhancedCache.has(clean)) {
        return enhancedCache.get(clean) ?? null;
    }

    const existing = inFlightRequests.get(clean);
    if (existing) return existing;

    const request = (async (): Promise<EnhancedMangaPosterMeta | null> => {
        try {
            const { data } = await mangaService.searchManga(clean, 1, 5);
            const match = data.find((m: Manga) =>
                [m.title, m.title_english, m.title_romaji, ...(m.synonyms || [])].some(
                    (t) => isStrictAniListMatch(t, clean)
                )
            );

            if (!match) {
                enhancedCache.set(clean, null);
                return null;
            }

            const enhanced: EnhancedMangaPosterMeta = {
                coverUrl: match.images?.jpg?.large_image_url || match.images?.jpg?.image_url,
                bannerUrl: match.bannerImage,
                score: match.score,
                type: match.type,
                countryOfOrigin: match.countryOfOrigin,
                synopsis: match.synopsis,
            };
            enhancedCache.set(clean, enhanced);
            return enhanced;
        } catch {
            return null;
        } finally {
            inFlightRequests.delete(clean);
        }
    })();

    inFlightRequests.set(clean, request);
    return request;
};

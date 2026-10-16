import type { NovelEditionKind } from '../types/ln';

export const detectNovelEdition = (value: string): NovelEditionKind => {
    const normalized = String(value || '').toLowerCase().replace(/[_-]+/g, ' ');
    if (/\b(web novel|wn)\b/.test(normalized)) return 'web-novel';
    if (/\b(light novel|ln)\b/.test(normalized)) return 'light-novel';
    return 'unknown';
};

export const normalizeNovelTitle = (value: string) => String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(volume|vol)\s*\d*\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const isConfirmedNovelMatch = (
    expectedTitles: string[],
    candidateTitle: string,
    expectedEdition: NovelEditionKind = 'light-novel'
) => {
    const candidateEdition = detectNovelEdition(candidateTitle);
    if (expectedEdition !== 'unknown' && candidateEdition !== 'unknown' && candidateEdition !== expectedEdition) {
        return false;
    }
    const candidate = normalizeNovelTitle(candidateTitle);
    if (!candidate || /eroge|fanfic|fan fiction|woke up in|buff system|reincarnated in|system in|reacts to|reaction|multi verse/i.test(candidate)) return false;
    return expectedTitles.some((title) => {
        const expected = normalizeNovelTitle(title);
        if (!expected) return false;
        if (candidate === expected) return true;
        const expectedTokens = new Set(expected.split(' ').filter((token) => token.length > 2));
        const candidateTokens = new Set(candidate.split(' ').filter((token) => token.length > 2));
        if (expectedTokens.size < 2 || candidateTokens.size < 2) return false;
        const shared = [...expectedTokens].filter((token) => candidateTokens.has(token)).length;
        return shared / expectedTokens.size >= 0.8 && shared / candidateTokens.size >= 0.8;
    });
};

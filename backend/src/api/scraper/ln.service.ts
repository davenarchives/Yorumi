import * as novelScraper from '../../scraper/novel';
import { cacheGet, cacheSet, cacheDel } from '../../utils/redis-cache';
import { createHash } from 'crypto';

const SEARCH_CACHE_TTL = 10 * 60 * 1000;
const DETAILS_CACHE_TTL = 30 * 60 * 1000;
const CHAPTER_CONTENT_CACHE_TTL = 60 * 60 * 1000;

const hashKey = (input: string) => createHash('sha1').update(input).digest('hex');

const normalizeTitle = (title: string) =>
    String(title || '')
        .toLowerCase()
        .replace(/['\u2019]s\b/g, '')
        .replace(/['\u2019\u2018`]/g, '')
        .replace(/\s*\(.*?\)\s*/g, ' ')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();

function cleanTitleForSearch(title: string): string {
    return String(title || '')
        .replace(/\s*[\(\[].*?[\)\]]/g, '') // remove (Light Novel), [LN], etc.
        .replace(/\s*(novel\s+[a-z0-9]+|magazine|light\s+novel|web\s+novel|volume\s+\d+|vol\.\s*\d+)/gi, '')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function isFanfictionOrSpinoff(title: string): boolean {
    const t = title.toLowerCase();
    return (
        /eroge|fanfic|fan fiction|woke up in|buff system|reincarnated in|system in|reacts to|reaction|multi-verse/i.test(t)
    );
}

function isConfirmedTitleMatch(candidateTitle: string, targetTitles: string[]): boolean {
    const candidate = normalizeTitle(candidateTitle)
        .replace(/\b(light novel|web novel|novel|ln|wn)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!candidate || isFanfictionOrSpinoff(candidateTitle)) return false;

    return targetTitles.some((title) => {
        const target = normalizeTitle(title)
            .replace(/\b(light novel|web novel|novel|ln|wn)\b/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (!target) return false;
        if (candidate === target) return true;
        if (target.length >= 6 && (candidate.startsWith(`${target} `) || target.startsWith(`${candidate} `))) {
            return true;
        }

        const candidateTokens = new Set(candidate.split(' ').filter((token) => token.length >= 2));
        const targetTokens = new Set(target.split(' ').filter((token) => token.length >= 2));
        if (candidateTokens.size < 2 || targetTokens.size < 2) return false;
        const shared = [...targetTokens].filter((token) => candidateTokens.has(token)).length;
        return shared / targetTokens.size >= 0.78 && shared / candidateTokens.size >= 0.78;
    });
}

function scoreMatch(candidateTitle: string, targetTitles: string[], source: string, candidateId: string): number {
    const normCandidate = normalizeTitle(candidateTitle);
    if (!normCandidate) return 0;

    let baseScore = 0;
    for (const title of targetTitles) {
        const normTarget = normalizeTitle(title);
        if (!normTarget) continue;

        if (normCandidate === normTarget) {
            baseScore = 100;
            break;
        }

        const candidateWords = new Set(normCandidate.split(' ').filter(Boolean));
        const targetWords = normTarget.split(' ').filter(Boolean);

        const overlap = targetWords.filter((w) => candidateWords.has(w)).length;
        if (overlap > 0) {
            const ratio = overlap / Math.max(targetWords.length, candidateWords.size);
            baseScore = Math.max(baseScore, Math.round(ratio * 100));
        }

        if (normCandidate.includes(normTarget) || normTarget.includes(normCandidate)) {
            baseScore = Math.max(baseScore, 75);
        }
    }

    // Boost NovelBin & WuxiaWorld official sources
    if (source === 'novelbin') baseScore += 15;
    if (source === 'wuxiaworld') baseScore += 5;

    // Boost Web Novel / Light Novel main titles (e.g. (WN), (LN), -wn)
    if (/\((wn|ln|web novel|light novel)\)/i.test(candidateTitle) || /-(wn|ln)$/i.test(candidateId)) {
        baseScore += 25;
    }

    // Penalize fanfiction titles when matching official novel
    if (isFanfictionOrSpinoff(candidateTitle)) {
        baseScore -= 40;
    }

    return baseScore;
}

class LNService {
    async searchNovels(query: string) {
        const cacheKey = `ln:v4:search:${hashKey(query)}`;
        const cached = await cacheGet<novelScraper.NovelSearchResult[]>(cacheKey).catch(() => null);
        if (cached) return cached;

        let results = await novelScraper.searchAllNovelSources(query);

        if (results.length === 0) {
            const cleaned = cleanTitleForSearch(query);
            if (cleaned && cleaned.toLowerCase() !== query.toLowerCase()) {
                results = await novelScraper.searchAllNovelSources(cleaned);
            }
        }

        if (results.length > 0) {
            cacheSet(cacheKey, results, SEARCH_CACHE_TTL / 1000).catch(() => {});
        }
        return results;
    }

    async resolveNovel(titles: string[]) {
        const cleanTitles = [...new Set(titles.map((t) => String(t || '').trim()).filter((t) => /[A-Za-z0-9]/.test(t)))];
        if (cleanTitles.length === 0) return null;

        const cacheKey = `ln:v4:resolve:${hashKey(cleanTitles.join('|'))}`;
        const cached = await cacheGet<string>(cacheKey).catch(() => null);
        if (cached) return cached;

        // 1. Fast slug probe directly against NovelBin's AJAX chapter-list endpoint (~250ms, no /search 429)
        const probedId = await novelScraper.probeNovelBinByTitles(cleanTitles);
        if (probedId) {
            cacheSet(cacheKey, probedId, DETAILS_CACHE_TTL / 1000).catch(() => {});
            return probedId;
        }

        const searchQueries: string[] = [];
        const addQuery = (q: string) => {
            const trimmed = q.trim();
            if (trimmed.length >= 2 && !searchQueries.some((existing) => existing.toLowerCase() === trimmed.toLowerCase())) {
                searchQueries.push(trimmed);
            }
        };
        for (const t of cleanTitles) {
            addQuery(t);
            const cleaned = cleanTitleForSearch(t);
            if (cleaned) addQuery(cleaned);
            const noSo = cleaned.replace(/^so\s+/i, '');
            if (noSo !== cleaned) addQuery(noSo);
            const colonBase = cleanTitleForSearch(t.split(/[:–—―]/)[0] || '');
            if (colonBase.length >= 4) addQuery(colonBase);
        }

        let bestResult: novelScraper.NovelSearchResult | null = null;
        let maxScore = -100;

        for (const query of searchQueries.slice(0, 4)) {
            const results = await novelScraper.searchAllNovelSources(query);
            for (const r of results) {
                if (!isConfirmedTitleMatch(r.title, cleanTitles)) continue;
                const score = scoreMatch(r.title, cleanTitles, r.source, r.id);
                if (score > maxScore) {
                    maxScore = score;
                    bestResult = r;
                }
            }

            if (bestResult && maxScore >= 95) {
                break;
            }
        }

        if (bestResult) {
            cacheSet(cacheKey, bestResult.id, DETAILS_CACHE_TTL / 1000).catch(() => {});
            return bestResult.id;
        }

        return null;
    }

    async getNovelDetails(scraperId: string, refresh = false) {
        const cacheKey = `ln:v4:details:${scraperId}`;
        if (!refresh) {
            const cached = await cacheGet<novelScraper.NovelDetails>(cacheKey).catch(() => null);
            if (cached && Array.isArray(cached.chapters) && cached.chapters.length > 0) {
                // Invalidate stale caches from old bug where Arc 1-1 and Arc 5-1 were sorted together
                const chs = cached.chapters || [];
                const isStaleJumbled = chs.length > 5 &&
                    chs[0]?.title?.toLowerCase().includes('arc 1') &&
                    chs[1]?.title?.toLowerCase().includes('arc 5');
                if (!isStaleJumbled) {
                    return cached;
                }
                await cacheDel(cacheKey).catch(() => {});
            }
        }

        let details: novelScraper.NovelDetails | null = null;
        if (scraperId.startsWith('nb:')) {
            details = await novelScraper.getNovelBinDetails(scraperId);
        } else if (scraperId.startsWith('wx:')) {
            details = await novelScraper.getWuxiaWorldDetails(scraperId);
        } else if (scraperId.startsWith('rr:')) {
            details = await novelScraper.getRoyalRoadDetails(scraperId);
        } else if (scraperId.startsWith('anf:')) {
            details = await novelScraper.getAllNovelFullDetails(scraperId);
        } else {
            details = await novelScraper.getNovelBinDetails(scraperId);
        }

        if (details && Array.isArray(details.chapters) && details.chapters.length > 0) {
            cacheSet(cacheKey, details, DETAILS_CACHE_TTL / 1000).catch(() => {});
        }
        return details;
    }

    async getChapterContent(chapterId: string) {
        const cacheKey = `ln:v3:chapter:${hashKey(chapterId)}`;
        const cached = await cacheGet<novelScraper.NovelChapterContent>(cacheKey).catch(() => null);
        if (cached) return cached;

        let content: novelScraper.NovelChapterContent | null = null;
        if (chapterId.startsWith('nb:')) {
            content = await novelScraper.getNovelBinChapterContent(chapterId);
        } else if (chapterId.startsWith('wx:')) {
            content = await novelScraper.getWuxiaWorldChapterContent(chapterId);
        } else if (chapterId.startsWith('rr:')) {
            content = await novelScraper.getRoyalRoadChapterContent(chapterId);
        } else if (chapterId.startsWith('anf:')) {
            content = await novelScraper.getAllNovelFullChapterContent(chapterId);
        } else {
            content = await novelScraper.getNovelBinChapterContent(chapterId);
        }

        if (content) {
            cacheSet(cacheKey, content, CHAPTER_CONTENT_CACHE_TTL / 1000).catch(() => {});
        }
        return content;
    }
}

export const lnService = new LNService();

import axios from 'axios';
import { redis } from '../mapping/mapper';
import { createHash } from 'crypto';

const ANILIST_API_URL = 'https://graphql.anilist.co';

// ============================================================================
// CACHING LAYER - Reduces API calls by caching responses
// ============================================================================
interface CacheEntry {
    data: any;
    timestamp: number;
    ttl: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = {
    trending: 5 * 60 * 1000,      // 5 minutes for trending
    seasonal: 10 * 60 * 1000,     // 10 minutes for seasonal
    popular: 30 * 60 * 1000,      // 30 minutes for all-time popular
    monthly: 10 * 60 * 1000,      // 10 minutes for monthly popular
    top: 30 * 60 * 1000,          // 30 minutes for top rated
    search: 5 * 60 * 1000,        // 5 minutes for search results
    details: 60 * 60 * 1000,      // 1 hour for anime/manga details
    schedule: 5 * 60 * 1000,      // 5 minutes for schedule
    default: 10 * 60 * 1000       // 10 minutes default
};

function getCacheKey(type: string, ...args: any[]): string {
    return `v3:${type}:${JSON.stringify(args)}`;
}

function getFromCache(key: string): any | null {
    const entry = cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
        cache.delete(key);
        return null;
    }

    return entry.data;
}

function setCache(key: string, data: any, ttl: number): void {
    cache.set(key, { data, timestamp: Date.now(), ttl });

    // Clean old entries periodically (keep cache size manageable)
    if (cache.size > 100) {
        const now = Date.now();
        for (const [k, v] of cache.entries()) {
            if (now - v.timestamp > v.ttl) {
                cache.delete(k);
            }
        }
    }
}

function normalizeTitleForMatch(value: unknown): string {
    return String(value || '')
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function scoreAnimeSearchCandidate(
    titles: string[],
    candidate: any,
    hints?: { year?: number; episodes?: number; format?: string }
): number {
    const candidateTitles = [
        candidate?.title?.english,
        candidate?.title?.romaji,
        candidate?.title?.native,
        ...(Array.isArray(candidate?.synonyms) ? candidate.synonyms : []),
    ]
        .map((value) => String(value || '').trim())
        .filter(Boolean);

    if (candidateTitles.length === 0) return Number.NEGATIVE_INFINITY;

    const normalizedCandidateTitles = candidateTitles.map(normalizeTitleForMatch).filter(Boolean);
    let score = 0;

    for (const rawTitle of titles) {
        const normalizedTitle = normalizeTitleForMatch(rawTitle);
        if (!normalizedTitle) continue;

        for (const candidateTitle of normalizedCandidateTitles) {
            if (candidateTitle === normalizedTitle) {
                score += 180;
                continue;
            }

            if (candidateTitle.startsWith(`${normalizedTitle} `)) {
                score += 60;
                score -= Math.min(45, candidateTitle.length - normalizedTitle.length);
                continue;
            }

            if (normalizedTitle.startsWith(`${candidateTitle} `)) {
                score += 45;
                continue;
            }

            if (candidateTitle.includes(normalizedTitle) || normalizedTitle.includes(candidateTitle)) {
                score += 20;
            }
        }
    }

    const expectedEpisodes = Number(hints?.episodes || 0);
    const candidateEpisodes = Number(candidate?.episodes || 0);
    if (expectedEpisodes > 0 && candidateEpisodes > 0) {
        const diff = Math.abs(candidateEpisodes - expectedEpisodes);
        if (diff === 0) score += 70;
        else if (diff <= 2) score += 45;
        else if (diff <= 6) score += 15;
        else score -= 55;
    }

    const expectedYear = Number(hints?.year || 0);
    const candidateYear = Number(candidate?.seasonYear || candidate?.startDate?.year || 0);
    if (expectedYear > 0 && candidateYear > 0) {
        const diff = Math.abs(candidateYear - expectedYear);
        if (diff === 0) score += 20;
        else if (diff === 1) score += 8;
        else score -= 24;
    }

    const expectedFormat = String(hints?.format || '').trim().toUpperCase();
    const candidateFormat = String(candidate?.format || '').trim().toUpperCase();
    if (expectedFormat && candidateFormat) {
        if (expectedFormat === candidateFormat) score += 12;
        else score -= 10;
    }

    return score;
}

// ============================================================================
// RATE LIMITING - Prevents hitting AniList's rate limit
// ============================================================================
let lastRequestTime = 0;
let rateLimitQueue = Promise.resolve();
const MIN_REQUEST_INTERVAL = 1000; // Keep AniList requests serialized at about 60/min.
const inFlightRequests = new Map<string, Promise<any>>();
const REDIS_RATE_LIMIT_KEY = 'anilist:ratelimit:last-request-ms';

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getRequestHash(query: string, variables: any): string {
    return createHash('sha1')
        .update(query)
        .update(JSON.stringify(variables || {}))
        .digest('hex');
}

async function applyRateLimitOnce(): Promise<void> {
    const now = Date.now();
    const localElapsed = now - lastRequestTime;
    if (localElapsed < MIN_REQUEST_INTERVAL) {
        await sleep(MIN_REQUEST_INTERVAL - localElapsed);
    }

    // Best-effort cross-instance pacing via Redis timestamp.
    try {
        const remoteLast = await redis.get<number>(REDIS_RATE_LIMIT_KEY);
        if (remoteLast) {
            const remoteElapsed = Date.now() - remoteLast;
            if (remoteElapsed < MIN_REQUEST_INTERVAL) {
                await sleep(MIN_REQUEST_INTERVAL - remoteElapsed);
            }
        }
        const nextTs = Date.now();
        await redis.set(REDIS_RATE_LIMIT_KEY, nextTs, { ex: 120 });
        lastRequestTime = nextTs;
    } catch {
        lastRequestTime = Date.now();
    }
}

async function applyRateLimit(): Promise<void> {
    const previous = rateLimitQueue;
    let release: () => void = () => undefined;
    rateLimitQueue = new Promise<void>((resolve) => {
        release = resolve;
    });

    await previous;
    try {
        await applyRateLimitOnce();
    } finally {
        release();
    }
}

function getRetryDelayMs(error: any, attempt: number): number {
    const retryAfterHeader = error?.response?.headers?.['retry-after'];
    const retryAfterSec = Number(retryAfterHeader);
    if (Number.isFinite(retryAfterSec) && retryAfterSec > 0) {
        return Math.min(retryAfterSec * 1000, 5000);
    }

    const base = 800;
    const max = 5000;
    const jitter = Math.floor(Math.random() * 350);
    return Math.min(base * Math.pow(2, attempt) + jitter, max);
}

function toDateInt(date: Date): number {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return year * 10000 + month * 100 + day;
}

async function rateLimitedRequest(
    query: string,
    variables: any,
    options: { cacheTtlSeconds?: number; bypassCache?: boolean } = {}
): Promise<any> {
    const cacheTtlSeconds = options.cacheTtlSeconds ?? 120;
    const bypassCache = options.bypassCache ?? false;
    const requestHash = getRequestHash(query, variables);
    const responseCacheKey = `anilist:resp:${requestHash}`;

    if (!bypassCache) {
        try {
            const cached = await redis.get<any>(responseCacheKey);
            if (cached) return cached;
        } catch {
            // Ignore Redis cache failures and continue with network call.
        }
    }

    const inFlight = inFlightRequests.get(requestHash);
    if (inFlight) {
        return inFlight;
    }

    const requestPromise = (async () => {
        const maxAttempts = 5;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                await applyRateLimit();
                const response = await axios.post(
                    ANILIST_API_URL,
                    { query, variables },
                    { timeout: 20000 }
                );
                const payload = response.data;

                if (!bypassCache) {
                    try {
                        await redis.set(responseCacheKey, payload, { ex: cacheTtlSeconds });
                    } catch {
                        // Ignore Redis cache failures.
                    }
                }

                return payload;
            } catch (error: any) {
                const status = error?.response?.status;
                const isRetriable =
                    status === 429 ||
                    status === 408 ||
                    status === 502 ||
                    status === 503 ||
                    status === 504 ||
                    !status;

                if (!isRetriable || attempt === maxAttempts - 1) {
                    throw error;
                }

                const delayMs = getRetryDelayMs(error, attempt);
                console.warn(`AniList request retry ${attempt + 1}/${maxAttempts - 1} in ${delayMs}ms (status: ${status ?? 'network'})`);
                await sleep(delayMs);
            }
        }

        throw new Error('AniList request failed after retries');
    })();

    inFlightRequests.set(requestHash, requestPromise);
    try {
        return await requestPromise;
    } finally {
        inFlightRequests.delete(requestHash);
    }
}

// Common media fields fragment
const MEDIA_FIELDS = `
    id
    idMal
    title {
        romaji
        english
        native
    }
    description
    bannerImage
    coverImage {
        extraLarge
        large
    }
    format
    episodes
    chapters
    volumes
    duration
    status
    season
    seasonYear
    startDate {
        year
        month
        day
    }
    endDate {
        year
        month
        day
    }
    averageScore
    meanScore
    popularity
    genres
    studios {
        edges {
            isMain
            node {
                name
            }
        }
        nodes {
            name
        }
    }
    isAdult
    countryOfOrigin
    nextAiringEpisode {
        episode
        airingAt
        timeUntilAiring
    }
    streamingEpisodes {
        title
        thumbnail
        url
        site
    }
    trailer {
        id
        site
        thumbnail
    }
    synonyms
    staff(perPage: 3, sort: [RELEVANCE, ID]) {
        edges {
            role
            node {
                name {
                    full
                }
            }
        }
    }
`;


export const anilistService = {
    async getNativeSpotlightAnime(perPage: number = 8) {
        const limit = Math.max(1, Math.min(perPage, 20));
        const cacheKey = getCacheKey('native_spotlight_anime', limit);
        const cached = getFromCache(cacheKey);
        if (cached) return cached;

        const now = new Date();
        const month = now.getMonth() + 1;
        const season = month <= 3 ? 'WINTER' : month <= 6 ? 'SPRING' : month <= 9 ? 'SUMMER' : 'FALL';
        const seasonYear = now.getFullYear();
        const monthStart = new Date(seasonYear, now.getMonth(), 1);
        const monthEnd = new Date(seasonYear, now.getMonth() + 1, 0);
        const poolSize = Math.max(16, limit * 3);
        const query = `
            query ($poolSize: Int, $season: MediaSeason, $seasonYear: Int, $startDateGreater: FuzzyDateInt, $startDateLesser: FuzzyDateInt) {
                trending: Page(page: 1, perPage: $poolSize) {
                    media(type: ANIME, sort: TRENDING_DESC, isAdult: false) {
                        ${MEDIA_FIELDS}
                    }
                }
                seasonal: Page(page: 1, perPage: $poolSize) {
                    media(type: ANIME, season: $season, seasonYear: $seasonYear, sort: POPULARITY_DESC, isAdult: false) {
                        ${MEDIA_FIELDS}
                    }
                }
                monthly: Page(page: 1, perPage: $poolSize) {
                    media(type: ANIME, startDate_greater: $startDateGreater, startDate_lesser: $startDateLesser, sort: POPULARITY_DESC, isAdult: false) {
                        ${MEDIA_FIELDS}
                    }
                }
                popular: Page(page: 1, perPage: $poolSize) {
                    media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) {
                        ${MEDIA_FIELDS}
                    }
                }
            }
        `;

        let payload: any = null;
        try {
            const response = await rateLimitedRequest(query, {
                poolSize,
                season,
                seasonYear,
                startDateGreater: toDateInt(monthStart) - 1,
                startDateLesser: toDateInt(monthEnd) + 1,
            }, { cacheTtlSeconds: 300 });
            payload = response.data;
        } catch (error) {
            console.error('Error fetching native spotlight anime:', error);
            return [];
        }

        const candidates = new Map<number, { media: any; score: number; genres: string[] }>();
        const addCandidate = (media: any, source: 'trending' | 'seasonal' | 'monthly' | 'popular', index: number) => {
            const id = Number(media?.id || 0);
            if (!id || media?.isAdult) return;
            if (!media?.bannerImage && !media?.coverImage?.extraLarge && !media?.coverImage?.large) return;

            const rankScore = Math.max(0, 24 - index);
            const popularity = Number(media?.popularity || 0);
            const averageScore = Number(media?.averageScore || media?.meanScore || 0);
            const hasBackdrop = media?.bannerImage ? 1 : 0;
            const isAiring = media?.status === 'RELEASING' ? 1 : 0;
            const isCurrentSeason = media?.seasonYear === new Date().getFullYear() ? 1 : 0;
            const recentlyAired = media?.nextAiringEpisode?.airingAt
                ? Math.max(0, 10 - Math.abs((media.nextAiringEpisode.airingAt * 1000 - Date.now()) / (1000 * 60 * 60 * 24)))
                : 0;

            const sourceWeight = source === 'trending'
                ? 120
                : source === 'seasonal'
                    ? 90
                    : source === 'monthly'
                        ? 60
                        : 35;
            const score =
                sourceWeight +
                rankScore * 5 +
                Math.log10(Math.max(1, popularity)) * 18 +
                averageScore * 0.7 +
                hasBackdrop * 35 +
                isAiring * 25 +
                isCurrentSeason * 10 +
                recentlyAired * 3;

            const existing = candidates.get(id);
            candidates.set(id, {
                media,
                score: (existing?.score || 0) + score,
                genres: Array.isArray(media?.genres) ? media.genres : [],
            });
        };

        (Array.isArray(payload?.trending?.media) ? payload.trending.media : []).forEach((media: any, index: number) => addCandidate(media, 'trending', index));
        (Array.isArray(payload?.seasonal?.media) ? payload.seasonal.media : []).forEach((media: any, index: number) => addCandidate(media, 'seasonal', index));
        (Array.isArray(payload?.monthly?.media) ? payload.monthly.media : []).forEach((media: any, index: number) => addCandidate(media, 'monthly', index));
        (Array.isArray(payload?.popular?.media) ? payload.popular.media : []).forEach((media: any, index: number) => addCandidate(media, 'popular', index));

        const selected: any[] = [];
        const genreCounts = new Map<string, number>();
        const ranked = Array.from(candidates.values())
            .sort((a, b) => b.score - a.score);
        const rotationWindow = Math.max(limit, Math.min(ranked.length, limit * 3));
        const rotationSeed = Math.floor(Date.now() / (6 * 60 * 60 * 1000));
        const rotationOffset = rotationWindow > limit ? rotationSeed % rotationWindow : 0;
        const pinnedCount = Math.min(2, limit, ranked.length);
        const pinned = ranked.slice(0, pinnedCount);
        const rotatingPool = ranked.slice(pinnedCount, rotationWindow);
        const rotated = rotatingPool.length > 0
            ? [
                ...rotatingPool.slice(rotationOffset % rotatingPool.length),
                ...rotatingPool.slice(0, rotationOffset % rotatingPool.length),
            ]
            : [];
        const ordered = [
            ...pinned,
            ...rotated,
            ...ranked.slice(rotationWindow),
        ];

        for (const candidate of ordered) {
            const overusedGenres = candidate.genres.filter((genre) => (genreCounts.get(genre) || 0) >= 3);
            if (selected.length >= 4 && overusedGenres.length >= Math.min(2, candidate.genres.length)) continue;
            selected.push(candidate.media);
            candidate.genres.forEach((genre) => genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1));
            if (selected.length >= limit) break;
        }

        if (selected.length < limit) {
            for (const candidate of ranked) {
                if (selected.some((media) => media.id === candidate.media.id)) continue;
                selected.push(candidate.media);
                if (selected.length >= limit) break;
            }
        }

        setCache(cacheKey, selected, CACHE_TTL.trending);
        return selected;
    },

    async getSpotlightAnime(perPage: number = 10) {
        const cacheKey = getCacheKey('spotlight_anime', perPage);
        const cached = getFromCache(cacheKey);
        if (cached) return cached;

        const query = `
            query ($perPage: Int) {
                Page(page: 1, perPage: $perPage) {
                    media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) {
                        ${MEDIA_FIELDS}
                    }
                }
            }
        `;

        try {
            const response = await rateLimitedRequest(query, { perPage }, { cacheTtlSeconds: 1800 });
            const result = response.data.Page.media;
            setCache(cacheKey, result, CACHE_TTL.popular);
            return result;
        } catch (error) {
            console.error('Error fetching spotlight anime:', error);
            return [];
        }
    },
    async getCoverImages(malIds: number[]) {
        const query = `
            query ($idMal: [Int]) {
                Page {
                    media(idMal_in: $idMal, type: ANIME) {
                        idMal
                        bannerImage
                        coverImage {
                            extraLarge
                            large
                        }
                    }
                }
            }
        `;

        try {
            const response = await rateLimitedRequest(query, { idMal: malIds }, { cacheTtlSeconds: 3600 });
            return response.data.Page.media;
        } catch (error) {
            console.error('Error fetching AniList images:', error);
            return [];
        }
    },

    async getTrendingAnime(page: number = 1, perPage: number = 10) {
        const cacheKey = getCacheKey('trending_anime', page, perPage);
        const cached = getFromCache(cacheKey);
        if (cached) return cached;

        const query = `
            query ($page: Int, $perPage: Int) {
                Page(page: $page, perPage: $perPage) {
                    pageInfo {
                        total
                        currentPage
                        lastPage
                        hasNextPage
                    }
                    media(type: ANIME, sort: TRENDING_DESC, isAdult: false) {
                        ${MEDIA_FIELDS}
                    }
                }
            }
        `;

        try {
            const response = await rateLimitedRequest(query, { page, perPage });
            const result = response.data.Page;
            setCache(cacheKey, result, CACHE_TTL.trending);
            return result;
        } catch (error) {
            console.error('Error fetching trending anime:', error);
            return { media: [], pageInfo: {} };
        }
    },

    async getPopularThisSeason(page: number = 1, perPage: number = 10) {
        // Get current season and year
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();
        let season: string;
        if (month >= 1 && month <= 3) season = 'WINTER';
        else if (month >= 4 && month <= 6) season = 'SPRING';
        else if (month >= 7 && month <= 9) season = 'SUMMER';
        else season = 'FALL';

        const cacheKey = getCacheKey('popular_season', page, perPage, season, year);
        const cached = getFromCache(cacheKey);
        if (cached) return cached;

        const query = `
            query ($page: Int, $perPage: Int, $season: MediaSeason, $seasonYear: Int) {
                Page(page: $page, perPage: $perPage) {
                    pageInfo {
                        total
                        currentPage
                        lastPage
                        hasNextPage
                    }
                    media(type: ANIME, season: $season, seasonYear: $seasonYear, sort: POPULARITY_DESC, isAdult: false) {
                        ${MEDIA_FIELDS}
                    }
                }
            }
        `;

        try {
            const response = await rateLimitedRequest(query, { page, perPage, season, seasonYear: year });
            const result = response.data.Page;
            setCache(cacheKey, result, CACHE_TTL.seasonal);
            return result;
        } catch (error) {
            console.error('Error fetching popular this season:', error);
            return { media: [], pageInfo: {} };
        }
    },

    async getPopularAnime(page: number = 1, perPage: number = 10) {
        const cacheKey = getCacheKey('popular_anime', page, perPage);
        const cached = getFromCache(cacheKey);
        if (cached) return cached;

        const query = `
            query ($page: Int, $perPage: Int) {
                Page(page: $page, perPage: $perPage) {
                    pageInfo {
                        total
                        currentPage
                        lastPage
                        hasNextPage
                    }
                    media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) {
                        ${MEDIA_FIELDS}
                    }
                }
            }
        `;

        try {
            const response = await rateLimitedRequest(query, { page, perPage });
            const result = response.data.Page;
            setCache(cacheKey, result, CACHE_TTL.popular);
            return result;
        } catch (error) {
            console.error('Error fetching popular anime:', error);
            return { media: [], pageInfo: {} };
        }
    },

    async getPopularThisMonth(page: number = 1, perPage: number = 10) {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const start = new Date(year, month, 1);
        const end = new Date(year, month + 1, 0);
        const startInt = toDateInt(start) - 1;
        const endInt = toDateInt(end) + 1;

        const cacheKey = getCacheKey('popular_month', page, perPage, year, month + 1);
        const cached = getFromCache(cacheKey);
        if (cached) return cached;

        const query = `
            query ($page: Int, $perPage: Int, $startDateGreater: FuzzyDateInt, $startDateLesser: FuzzyDateInt) {
                Page(page: $page, perPage: $perPage) {
                    pageInfo {
                        total
                        currentPage
                        lastPage
                        hasNextPage
                    }
                    media(type: ANIME, startDate_greater: $startDateGreater, startDate_lesser: $startDateLesser, sort: POPULARITY_DESC, isAdult: false) {
                        ${MEDIA_FIELDS}
                    }
                }
            }
        `;

        try {
            const response = await rateLimitedRequest(query, { page, perPage, startDateGreater: startInt, startDateLesser: endInt });
            const result = response.data.Page;
            setCache(cacheKey, result, CACHE_TTL.monthly);
            return result;
        } catch (error) {
            console.error('Error fetching popular this month:', error);
            return { media: [], pageInfo: {} };
        }
    },

    async getMangaAZList(letter: string, page: number = 1, perPage: number = 18) {
        const isAll = letter.toLowerCase() === 'all' || !letter;
        const isSpecial = letter === '#' || letter === '0-9';

        // If "All" or Special chars, start from page 1
        if (isAll || isSpecial) {
            const query = `
                query ($page: Int, $perPage: Int) {
                    Page(page: $page, perPage: $perPage) {
                        pageInfo { total currentPage lastPage hasNextPage }
                        media(type: MANGA, sort: TITLE_ROMAJI, isAdult: false) {
                            ${MEDIA_FIELDS}
                        }
                    }
                }
            `;
            try {
                const response = await rateLimitedRequest(query, { page, perPage });
                return response.data.Page;
            } catch (error) {
                console.error('Error fetching Manga All/#:', error);
                return { media: [], pageInfo: {} };
            }
        }

        // For Letters A-Z: Find the start page
        const startPage = await this.findStartPage(letter);
        if (startPage === -1) return { media: [], pageInfo: {} };

        // Calculate target page
        // If user wants page 1, we fetch startPage.
        // page 2 -> startPage + 1
        const targetPage = startPage + (page - 1);

        const query = `
            query ($page: Int, $perPage: Int) {
                Page(page: $page, perPage: $perPage) {
                    pageInfo { total currentPage lastPage hasNextPage }
                    media(type: MANGA, sort: TITLE_ROMAJI, isAdult: false) {
                        ${MEDIA_FIELDS}
                    }
                }
            }
        `;

        try {
            const response = await rateLimitedRequest(query, { page: targetPage, perPage });
            const pageData = response.data.Page;

            // Filter strictly by letter
            // But wait, if we filter, the page size shrinks.
            // Paging might be inconsistent if we just drop items.
            // Client expects 18 items. If we return 5, it assumes end of list?
            // To do this properly, we might need to fetch more and buffer?
            // For now, returning filtered list is better than wrong list.

            const filteredMedia = pageData.media.filter((m: any) => {
                const title = m.title.romaji || m.title.english || '';
                return title.toUpperCase().startsWith(letter.toUpperCase());
            });

            // If we filtered out everything but there ARE items for this letter (just on prev/next pages?)
            // Our binary search finds the FIRST page containing the letter (or close to it).
            // So title >= letter.

            // Should accurate hasNextPage
            // If the last item on this page starts with Letter, there is likely a next page.
            // If the last item starts with Next Letter, then no next page for THIS letter.

            const lastItem = pageData.media[pageData.media.length - 1];
            const lastTitle = lastItem?.title?.romaji || '';
            const hasMoreOfLetter = lastTitle.toUpperCase().startsWith(letter.toUpperCase());

            return {
                media: filteredMedia,
                pageInfo: {
                    ...pageData.pageInfo,
                    hasNextPage: hasMoreOfLetter && pageData.pageInfo.hasNextPage
                }
            };
        } catch (error) {
            console.error('Error fetching Manga A-Z:', error);
            return { media: [], pageInfo: {} };
        }
    },

    async getAnimeAZList(letter: string, page: number = 1, perPage: number = 18) {
        const isAll = letter.toLowerCase() === 'all' || !letter;
        const isSpecial = letter === '#' || letter === '0-9';

        if (isAll || isSpecial) {
            const query = `
                query ($page: Int, $perPage: Int) {
                    Page(page: $page, perPage: $perPage) {
                        pageInfo { total currentPage lastPage hasNextPage }
                        media(type: ANIME, sort: TITLE_ROMAJI, isAdult: false) {
                            ${MEDIA_FIELDS}
                        }
                    }
                }
            `;
            try {
                const response = await rateLimitedRequest(query, { page, perPage });
                return response.data.Page;
            } catch (error) {
                console.error('Error fetching Anime All/#:', error);
                return { media: [], pageInfo: {} };
            }
        }

        const startPage = await this.findStartPage(letter, 'ANIME');
        if (startPage === -1) return { media: [], pageInfo: {} };

        const targetPage = startPage + (page - 1);
        const query = `
            query ($page: Int, $perPage: Int) {
                Page(page: $page, perPage: $perPage) {
                    pageInfo { total currentPage lastPage hasNextPage }
                    media(type: ANIME, sort: TITLE_ROMAJI, isAdult: false) {
                        ${MEDIA_FIELDS}
                    }
                }
            }
        `;

        try {
            const response = await rateLimitedRequest(query, { page: targetPage, perPage });
            const pageData = response.data.Page;

            const filteredMedia = pageData.media.filter((m: any) => {
                const title = m.title.romaji || m.title.english || '';
                return title.toUpperCase().startsWith(letter.toUpperCase());
            });

            const lastItem = pageData.media[pageData.media.length - 1];
            const lastTitle = lastItem?.title?.romaji || '';
            const hasMoreOfLetter = lastTitle.toUpperCase().startsWith(letter.toUpperCase());

            return {
                media: filteredMedia,
                pageInfo: {
                    ...pageData.pageInfo,
                    hasNextPage: hasMoreOfLetter && pageData.pageInfo.hasNextPage
                }
            };
        } catch (error) {
            console.error('Error fetching Anime A-Z:', error);
            return { media: [], pageInfo: {} };
        }
    },

    // Cache for start pages: 'A' -> 150
    async findStartPage(letter: string, type: 'ANIME' | 'MANGA' = 'MANGA'): Promise<number> {
        const cacheKey = `start_page_${type}_${letter}`;
        const cached = getFromCache(cacheKey);
        if (cached !== null) return cached;

        console.log(`[Indexer] Finding start page for "${letter}"...`);

        // Binary Search
        // We need an upper bound. 3000 is safe estimate for now, or fetch page 1 to get lastPage.
        // Let's first fetch page 1 to get metadata
        let min = 1;
        let max = 5000; // refined from probe?

        try {
            // Get real max
            const query = `query { Page(page: 1, perPage: 1) { pageInfo { lastPage } } }`;
            const res = await rateLimitedRequest(query, {});
            max = res.data.Page.pageInfo.lastPage;
        } catch (e) { console.error("Indexer init failed", e); return 1; }

        let startPage = -1;

        while (min <= max) {
            const mid = Math.floor((min + max) / 2);

            // Check title at mid
            const query = `
                query ($page: Int) {
                    Page(page: $page, perPage: 1) {
                        media(type: ${type}, sort: TITLE_ROMAJI, isAdult: false) {
                            title { romaji }
                        }
                    }
                }
            `;

            try {
                const res = await rateLimitedRequest(query, { page: mid });
                const media = res.data.Page.media[0];
                if (!media) { max = mid - 1; continue; }

                const title = (media.title.romaji || '').toUpperCase();
                // We want first page where title >= letter

                // Compare
                // title "Aaron" vs "B" -> "Aaron" < "B" -> too early -> min = mid + 1
                // title "Cathy" vs "B" -> "Cathy" > "B" -> too late (potentially) -> max = mid - 1, but save as candidate

                // We want the insertion point.
                // Actually, just simple string compare.

                // Special case: First char comparison
                const firstChar = title.charAt(0);

                if (title < letter.toUpperCase()) {
                    // Too early
                    min = mid + 1;
                } else {
                    // Title >= Letter
                    // This could be the start page, or a page after the start.
                    startPage = mid;
                    max = mid - 1;
                }

                // Optimization: If exact match of first char?
                // No, "Aaron" starts with A, "Az" starts with A.
                // If we are looking for "B". "Az" < "B".
                // If we are looking for "A". "Az" >= "A". 
                // Wait. "Az" > "A". 
                // If title is "Az", and we want "A". Correct.

            } catch (e) {
                console.error(`Error probing page ${mid}:`, e);
                // Assume temporary error, break or retry?
                // Return fallback 1
                return 1;
            }
        }

        console.log(`[Indexer] Found start page for ${letter}: ${startPage}`);
        setCache(cacheKey, startPage, 24 * 60 * 60 * 1000); // Cache 24h
        return startPage;
    },

    async getTopAnime(page: number = 1, perPage: number = 24, format?: string) {
        const cacheKey = getCacheKey('top_anime', page, perPage, format ?? 'all');
        const cached = getFromCache(cacheKey);
        if (cached) return cached;

        // Expand TV filter to include TV_SHORT
        const formatFilter = format
            ? (format === 'TV' ? ['TV', 'TV_SHORT'] : [format])
            : null;

        const query = formatFilter
            ? `
            query ($page: Int, $perPage: Int, $format: [MediaFormat]) {
                Page(page: $page, perPage: $perPage) {
                    pageInfo {
                        total
                        currentPage
                        lastPage
                        hasNextPage
                    }
                    media(type: ANIME, format_in: $format, sort: POPULARITY_DESC, isAdult: false) {
                        ${MEDIA_FIELDS}
                    }
                }
            }
        `
            : `
            query ($page: Int, $perPage: Int) {
                Page(page: $page, perPage: $perPage) {
                    pageInfo {
                        total
                        currentPage
                        lastPage
                        hasNextPage
                    }
                    media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) {
                        ${MEDIA_FIELDS}
                    }
                }
            }
        `;

        const variables = formatFilter
            ? { page, perPage, format: formatFilter }
            : { page, perPage };

        try {
            const response = await rateLimitedRequest(query, variables);
            const result = response.data.Page;
            setCache(cacheKey, result, CACHE_TTL.popular);
            return result;
        } catch (error) {
            console.error('Error fetching top anime:', error);
            throw error;
        }
    },

    async getTopManga(page: number = 1, perPage: number = 24) {
        const cacheKey = getCacheKey('top_manga', page, perPage);
        const cached = getFromCache(cacheKey);
        if (cached) return cached;

        const query = `
            query ($page: Int, $perPage: Int) {
                Page(page: $page, perPage: $perPage) {
                    pageInfo {
                        total
                        currentPage
                        lastPage
                        hasNextPage
                    }
                    media(type: MANGA, sort: SCORE_DESC, isAdult: false) {
                        ${MEDIA_FIELDS}
                    }
                }
            }
        `;

        try {
            const response = await rateLimitedRequest(query, { page, perPage }, { cacheTtlSeconds: 3600 });
            const result = response.data.Page;
            setCache(cacheKey, result, CACHE_TTL.top);
            return result;
        } catch (error) {
            console.error('Error fetching top manga:', error);
            return { media: [], pageInfo: {} };
        }
    },

    async getPopularManga(page: number = 1, perPage: number = 24) {
        const cacheKey = getCacheKey('popular_manga', page, perPage);
        const cached = getFromCache(cacheKey);
        if (cached) return cached;

        const query = `
            query ($page: Int, $perPage: Int) {
                Page(page: $page, perPage: $perPage) {
                    pageInfo {
                        total
                        currentPage
                        lastPage
                        hasNextPage
                    }
                    media(type: MANGA, sort: POPULARITY_DESC, isAdult: false) {
                        ${MEDIA_FIELDS}
                    }
                }
            }
        `;

        try {
            const response = await rateLimitedRequest(query, { page, perPage }, { cacheTtlSeconds: 3600 });
            const result = response.data.Page;
            setCache(cacheKey, result, CACHE_TTL.popular);
            return result;
        } catch (error) {
            console.error('Error fetching popular manga:', error);
            return { media: [], pageInfo: {} };
        }
    },

    async getTrendingManga(page: number = 1, perPage: number = 10) {
        const cacheKey = getCacheKey('trending_manga', page, perPage);
        const cached = getFromCache(cacheKey);
        if (cached) return cached;

        const query = `
            query ($page: Int, $perPage: Int) {
                Page(page: $page, perPage: $perPage) {
                    pageInfo {
                        total
                        currentPage
                        lastPage
                        hasNextPage
                    }
                    media(type: MANGA, sort: TRENDING_DESC, isAdult: false) {
                        ${MEDIA_FIELDS}
                    }
                }
            }
        `;

        try {
            const response = await rateLimitedRequest(query, { page, perPage }, { cacheTtlSeconds: 3600 });
            const result = response.data.Page;
            setCache(cacheKey, result, CACHE_TTL.trending);
            return result;
        } catch (error) {
            console.error('Error fetching trending manga:', error);
            return { media: [], pageInfo: {} };
        }
    },

    async getMediaDetails(id: number) {
        const cacheKey = getCacheKey('media_details', id);
        const cached = getFromCache(cacheKey);
        if (cached) return cached;

        const query = `
            query ($id: Int) {
                Media(id: $id) {
                    ${MEDIA_FIELDS}
                }
            }
        `;

        try {
            const response = await rateLimitedRequest(query, { id });
            const result = response.data.Media;
            setCache(cacheKey, result, CACHE_TTL.details);
            return result;
        } catch (error) {
            console.error('Error fetching media details:', error);
            return null;
        }
    },

    async getPopularManhwa(page: number = 1, perPage: number = 24) {
        const cacheKey = getCacheKey('popular_manhwa', page, perPage);
        const cached = getFromCache(cacheKey);
        if (cached) return cached;

        const query = `
            query ($page: Int, $perPage: Int) {
                Page(page: $page, perPage: $perPage) {
                    pageInfo {
                        total
                        currentPage
                        lastPage
                        hasNextPage
                    }
                    media(type: MANGA, countryOfOrigin: "KR", sort: POPULARITY_DESC, isAdult: false) {
                        ${MEDIA_FIELDS}
                    }
                }
            }
        `;

        try {
            const response = await rateLimitedRequest(query, { page, perPage }, { cacheTtlSeconds: 3600 });
            const result = response.data.Page;
            setCache(cacheKey, result, CACHE_TTL.popular);
            return result;
        } catch (error) {
            console.error('Error fetching popular manhwa:', error);
            return { media: [], pageInfo: {} };
        }
    },

    async getOneShotManga(page: number = 1, perPage: number = 24) {
        const cacheKey = getCacheKey('one_shot_manga', page, perPage);
        const cached = getFromCache(cacheKey);
        if (cached) return cached;

        const query = `
            query ($page: Int, $perPage: Int) {
                Page(page: $page, perPage: $perPage) {
                    pageInfo {
                        total
                        currentPage
                        lastPage
                        hasNextPage
                    }
                    media(type: MANGA, format: ONE_SHOT, sort: POPULARITY_DESC, isAdult: false) {
                        ${MEDIA_FIELDS}
                    }
                }
            }
        `;

        try {
            const response = await rateLimitedRequest(query, { page, perPage }, { cacheTtlSeconds: 3600 });
            const result = response.data.Page;
            setCache(cacheKey, result, CACHE_TTL.popular);
            return result;
        } catch (error) {
            console.error('Error fetching one-shot manga:', error);
            return { media: [], pageInfo: {} };
        }
    },

    async getRandomAnime() {
        // Fetch a random page of 50 items from the top 5000 popular anime
        // 5000 / 50 per page = 100 pages
        const randomPage = Math.floor(Math.random() * 100) + 1;

        const query = `
            query ($page: Int) {
                Page(page: $page, perPage: 50) {
                    media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) {
                        id
                    }
                }
            }
        `;

        try {
            const response = await rateLimitedRequest(query, { page: randomPage });
            const mediaList = response.data.Page.media;
            // Return array of IDs or fallback
            return mediaList.length > 0 ? mediaList.map((m: any) => ({ id: m.id })) : [{ id: 1 }];
        } catch (error) {
            console.error('Error fetching random anime:', error);
            return [{ id: 1 }];
        }
    },

    async getRandomManga() {
        // Fetch a random page of 50 items from the top 5000 popular manga
        const randomPage = Math.floor(Math.random() * 100) + 1;

        const query = `
            query ($page: Int) {
                Page(page: $page, perPage: 50) {
                    media(type: MANGA, sort: POPULARITY_DESC, isAdult: false) {
                        id
                    }
                }
            }
        `;

        try {
            const response = await rateLimitedRequest(query, { page: randomPage });
            const mediaList = response.data.Page.media;
            return mediaList.length > 0 ? mediaList.map((m: any) => ({ id: m.id })) : [{ id: 1 }];
        } catch (error) {
            console.error('Error fetching random manga:', error);
            return [{ id: 1 }];
        }
    },

    async searchAnime(search: string, page: number = 1, perPage: number = 24) {
        const cacheKey = `search:anime:${search.toLowerCase().trim()}:${page}:${perPage}`;
        const memoryCacheKey = getCacheKey('search', search.toLowerCase().trim(), page, perPage);
        const memoryHit = getFromCache(memoryCacheKey);
        if (memoryHit) return memoryHit;

        // 1. Check Cache
        try {
            const cachedResult = await redis.get(cacheKey);
            if (cachedResult) {
                console.log(`⚡ Cache Hit (Search): ${search}`);
                setCache(memoryCacheKey, cachedResult, CACHE_TTL.search);
                return cachedResult;
            }
        } catch (error) {
            console.error('Redis Error (Get):', error);
        }

        const query = `
            query ($search: String, $page: Int, $perPage: Int) {
                Page(page: $page, perPage: $perPage) {
                    pageInfo {
                        total
                        currentPage
                        lastPage
                        hasNextPage
                    }
                    media(search: $search, type: ANIME, sort: SEARCH_MATCH, isAdult: false) {
                        ${MEDIA_FIELDS}
                    }
                }
            }
        `;

        try {
            const response = await rateLimitedRequest(query, { search, page, perPage }, { cacheTtlSeconds: 300 });
            const data = response.data.Page;
            setCache(memoryCacheKey, data, CACHE_TTL.search);

            // 2. Set Cache (24 hours)
            try {
                await redis.set(cacheKey, data, { ex: 86400 });
            } catch (error) {
                console.error('Redis Error (Set):', error);
            }

            return data;
        } catch (error) {
            console.error('Error searching anime:', error);
            throw error;
        }
    },

    async findBestAnimeMatch(params: {
        titles: string[];
        year?: number;
        episodes?: number;
        format?: string;
        perPage?: number;
    }) {
        const titles = Array.from(
            new Set(
                (Array.isArray(params?.titles) ? params.titles : [])
                    .map((value) => String(value || '').replace(/\s+/g, ' ').trim())
                    .filter(Boolean)
            )
        );
        if (titles.length === 0) return null;

        const perPage = Math.max(3, Math.min(10, Number(params?.perPage || 6)));
        const candidateMap = new Map<number, any>();

        for (const title of titles.slice(0, 3)) {
            try {
                const result = await this.searchAnime(title, 1, perPage);
                const media = Array.isArray(result?.media) ? result.media : [];
                for (const item of media) {
                    const id = Number(item?.id || 0);
                    if (id > 0 && !candidateMap.has(id)) {
                        candidateMap.set(id, item);
                    }
                }
                if (candidateMap.size >= perPage) break;
            } catch (error) {
                console.error(`Error searching AniList candidates for "${title}":`, error);
            }
        }

        let best: { media: any; score: number } | null = null;
        for (const media of candidateMap.values()) {
            const score = scoreAnimeSearchCandidate(titles, media, {
                year: params?.year,
                episodes: params?.episodes,
                format: params?.format,
            });
            if (!best || score > best.score) {
                best = { media, score };
            }
        }

        return best?.media || null;
    },

    async searchManga(search: string, page: number = 1, perPage: number = 24) {
        const query = `
            query ($search: String, $page: Int, $perPage: Int) {
                Page(page: $page, perPage: $perPage) {
                    pageInfo {
                        total
                        currentPage
                        lastPage
                        hasNextPage
                    }
                    media(search: $search, type: MANGA, sort: SEARCH_MATCH, isAdult: false) {
                        ${MEDIA_FIELDS}
                    }
                }
            }
        `;

        try {
            const response = await rateLimitedRequest(query, { search, page, perPage }, { cacheTtlSeconds: 300 });
            return response.data.Page;
        } catch (error) {
            console.error('Error searching manga:', error);
            return { media: [], pageInfo: {} };
        }
    },

    async getAnimeById(id: number) {
        const queryById = `
            query ($id: Int) {
                Media(id: $id, type: ANIME) {
                    ${MEDIA_FIELDS}
                    relations {
                        edges {
                            relationType
                            node {
                                id
                                title { romaji english native }
                                coverImage { large }
                                format
                                isAdult
                                status
                                episodes
                                seasonYear
                                season
                                startDate {
                                    year
                                    month
                                    day
                                }
                            }
                        }
                    }
                    recommendations(perPage: 6) {
                        nodes {
                            mediaRecommendation {
                                id
                                title { romaji english }
                                coverImage { large }
                                isAdult
                            }
                        }
                    }
                    trailer {
                        id
                        site
                        thumbnail
                    }
                    characters(sort: [ROLE, RELEVANCE, ID], perPage: 12) {
                        edges {
                            role
                            node {
                                id
                                name { full }
                                image { large }
                            }
                            voiceActors(language: JAPANESE, sort: [RELEVANCE, ID]) {
                                id
                                name { full }
                                image { large }
                                languageV2
                            }
                        }
                    }
                }
            }
        `;
        const queryByMalId = `
            query ($idMal: Int) {
                Media(idMal: $idMal, type: ANIME) {
                    ${MEDIA_FIELDS}
                    relations {
                        edges {
                            relationType
                            node {
                                id
                                title { romaji english native }
                                coverImage { large }
                                format
                                isAdult
                                status
                                episodes
                                seasonYear
                                season
                                startDate {
                                    year
                                    month
                                    day
                                }
                            }
                        }
                    }
                    recommendations(perPage: 6) {
                        nodes {
                            mediaRecommendation {
                                id
                                title { romaji english }
                                coverImage { large }
                                isAdult
                            }
                        }
                    }
                    trailer {
                        id
                        site
                        thumbnail
                    }
                    characters(sort: [ROLE, RELEVANCE, ID], perPage: 12) {
                        edges {
                            role
                            node {
                                id
                                name { full }
                                image { large }
                            }
                            voiceActors(language: JAPANESE, sort: [RELEVANCE, ID]) {
                                id
                                name { full }
                                image { large }
                                languageV2
                            }
                        }
                    }
                }
            }
        `;

        try {
            let media = null;
            try {
                const response = await rateLimitedRequest(queryById, { id }, { cacheTtlSeconds: 3600 });
                media = response.data?.Media;
            } catch (innerError: any) {
                // If it's a 404, it might be a MAL ID instead of an AniList ID.
                if (innerError?.response?.status === 404) {
                    const byMal = await rateLimitedRequest(queryByMalId, { idMal: id }, { cacheTtlSeconds: 3600 });
                    media = byMal.data?.Media;
                } else {
                    throw innerError;
                }
            }
            
            if (!media) {
                return null;
            }
            
            if (media.recommendations && media.recommendations.nodes) {
                media.recommendations.nodes = media.recommendations.nodes.filter((node: any) => !node.mediaRecommendation?.isAdult);
            }
            if (media.relations && media.relations.edges) {
                media.relations.edges = media.relations.edges.filter((edge: any) => !edge.node?.isAdult);
            }
            return media;
        } catch (error) {
            console.error('Error fetching anime by ID:', error);
            return null;
        }
    },

    async getMangaById(id: number) {
        console.log('getMangaById called with:', id);
        const query = `
            query ($id: Int) {
                Media(id: $id, type: MANGA) {
                    ${MEDIA_FIELDS}
                    relations {
                        edges {
                            relationType
                            node {
                                id
                                title { romaji english }
                                coverImage { large }
                                format
                                type
                                isAdult
                            }
                        }
                    }
                    recommendations(perPage: 6) {
                        nodes {
                            mediaRecommendation {
                                id
                                title { romaji english }
                                coverImage { large }
                                type
                                isAdult
                            }
                        }
                    }
                    characters(sort: [ROLE, RELEVANCE, ID], perPage: 12) {
                        edges {
                            role
                            node {
                                id
                                name { full }
                                image { large }
                            }
                        }
                    }
                }
            }
        `;

        try {
            const response = await rateLimitedRequest(query, { id }, { cacheTtlSeconds: 3600 });
            const media = response.data.Media;
            if (media && media.recommendations && media.recommendations.nodes) {
                media.recommendations.nodes = media.recommendations.nodes.filter((node: any) => !node.mediaRecommendation?.isAdult);
            }
            if (media && media.relations && media.relations.edges) {
                media.relations.edges = media.relations.edges.filter((edge: any) => !edge.node?.isAdult);
            }
            return media;
        } catch (error) {
            console.error('Error fetching manga by ID:', error);
            return null;
        }
    },

    async getAiringSchedule(startTime: number, endTime: number) {
        const query = `
            query ($airingAtGreater: Int, $airingAtLesser: Int) {
                Page(page: 1, perPage: 50) {
                    airingSchedules(airingAt_greater: $airingAtGreater, airingAt_lesser: $airingAtLesser, sort: TIME) {
                        id
                        airingAt
                        episode
                        media {
                            id
                            idMal
                            title {
                                romaji
                                english
                            }
                            coverImage {
                                large
                            }
                            format
                            isAdult
                        }
                    }
                }
            }
        `;

        try {
            const response = await rateLimitedRequest(
                query,
                { airingAtGreater: startTime, airingAtLesser: endTime },
                { cacheTtlSeconds: 300 }
            );
            // Filter out adult content
            const schedules = response.data.Page.airingSchedules.filter(
                (s: any) => !s.media.isAdult
            );
            return schedules;
        } catch (error) {
            console.error('Error fetching airing schedule:', error);
            return [];
        }
    },

    getGenres() {
        // Static list of common anime genres with colors
        return [
            { name: 'Action', color: '#ef4444' },
            { name: 'Adventure', color: '#f97316' },
            { name: 'Comedy', color: '#eab308' },
            { name: 'Drama', color: '#84cc16' },
            { name: 'Fantasy', color: '#22c55e' },
            { name: 'Horror', color: '#14b8a6' },
            { name: 'Mystery', color: '#06b6d4' },
            { name: 'Romance', color: '#ec4899' },
            { name: 'Sci-Fi', color: '#8b5cf6' },
            { name: 'Slice of Life', color: '#a855f7' },
            { name: 'Sports', color: '#f43f5e' },
            { name: 'Supernatural', color: '#6366f1' },
            { name: 'Thriller', color: '#64748b' },
            { name: 'Mecha', color: '#78716c' },
            { name: 'Music', color: '#d946ef' },
            { name: 'Psychological', color: '#0ea5e9' },
            { name: 'Ecchi', color: '#fb7185' },
            { name: 'Isekai', color: '#4ade80' },
        ];
    },

    async getAnimeByGenre(genre: string, page: number = 1, perPage: number = 24) {
        const query = `
            query ($genre: String, $page: Int, $perPage: Int) {
                Page(page: $page, perPage: $perPage) {
                    pageInfo {
                        total
                        currentPage
                        lastPage
                        hasNextPage
                    }
                    media(type: ANIME, genre: $genre, sort: POPULARITY_DESC, isAdult: false) {
                        ${MEDIA_FIELDS}
                    }
                }
            }
        `;

        try {
            const response = await rateLimitedRequest(query, { genre, page, perPage }, { cacheTtlSeconds: 600 });
            return response.data.Page;
        } catch (error) {
            console.error('Error fetching anime by genre:', error);
            return { media: [], pageInfo: {} };
        }
    },

    async getMangaByGenre(genre: string, page: number = 1, perPage: number = 24) {
        const query = `
            query ($genre: String, $page: Int, $perPage: Int) {
                Page(page: $page, perPage: $perPage) {
                    pageInfo {
                        total
                        currentPage
                        lastPage
                        hasNextPage
                    }
                    media(type: MANGA, genre: $genre, sort: POPULARITY_DESC, isAdult: false) {
                        ${MEDIA_FIELDS}
                    }
                }
            }
        `;

        try {
            const response = await rateLimitedRequest(query, { genre, page, perPage }, { cacheTtlSeconds: 600 });
            return response.data.Page;
        } catch (error) {
            console.error('Error fetching manga by genre:', error);
            return { media: [], pageInfo: {} };
        }
    }
};

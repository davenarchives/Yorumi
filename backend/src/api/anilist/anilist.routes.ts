import { Router } from 'express';
import { anilistService } from './anilist.service';
import { AllMangaScraper } from '../../scraper/allmanga';
import { redis } from '../mapping/mapper';
import { mappingService } from '../mapping/mapping.service';
import { scraperService } from '../scraper/scraper.service';
import { tmdbService } from '../scraper/tmdb.service';
import * as mangaScraperService from '../scraper/manga.service';

const mapScraperMangaToAniListMedia = (items: any[]) =>
    (Array.isArray(items) ? items : []).map((item) => ({
        id: item.id,
        title: {
            english: item.title,
            romaji: item.title,
            native: item.title,
        },
        coverImage: {
            extraLarge: item.thumbnail || item.coverImage,
            large: item.thumbnail || item.coverImage,
        },
        description: item.synopsis || `Latest chapter: ${item.latestChapter || 'N/A'}`,
        format: 'MANGA',
        countryOfOrigin: item.countryOfOrigin || 'JP',
        status: (item.status || 'RELEASING').toUpperCase(),
        averageScore: 0,
        genres: Array.isArray(item.genres) ? item.genres.map((g: string) => ({ name: g })) : [],
        chapters: parseFloat(item.latestChapter?.replace(/\D/g, '') || '0') || undefined,
    }));

const router = Router();
const HOME_FAST_CACHE_KEY = 'anilist:home:fast:v21';
const HOME_FAST_TTL_SECONDS = 120;
let homeFastMemoryCache: { data: any; timestamp: number } | null = null;
let homeFastRefreshPromise: Promise<any> | null = null;
const isAllMangaSession = (value: unknown) => AllMangaScraper.isAllMangaSession(value);
const isGenericScraperSession = (value: unknown) => /^[a-z0-9-]+$/i.test(String(value || '').trim());
const toAnimePaheMirrorSlug = (value: unknown) =>
    String(value || '')
        .trim()
        .toLowerCase()
        .replace(/['’]/g, '')
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
const buildAnimePaheMirrorSession = (details: any) => {
    const title = details?.title?.english || details?.title?.romaji || '';
    const slug = toAnimePaheMirrorSlug(title);
    return slug ? `apch:${slug}` : null;
};
const normalizeTitleToken = (value: string) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const hasExplicitSeasonMarker = (title: string) => {
    const value = String(title || '');
    return (
        /\bseason\s*\d+\b/i.test(value) ||
        /\b\d+(st|nd|rd|th)\s*season\b/i.test(value) ||
        /(?:^|\s)[2-9]$/i.test(value.trim())
    );
};
const getSeasonNumber = (title: string) => {
    const value = String(title || '');
    const match =
        value.match(/\bseason\s*(\d+)\b/i) ||
        value.match(/\b(\d+)(st|nd|rd|th)\s*season\b/i) ||
        value.trim().match(/(?:^|\s)([2-9])$/i);
    return match ? parseInt(match[1], 10) : 1;
};
const getTargetSeasonNumber = (details: any) =>
    buildScraperQueries(details).map((title) => getSeasonNumber(title)).find((season) => season > 1) || 1;
const hasExplicitSequelSeason = (details: any) =>
    buildScraperQueries(details).some((title) => hasExplicitSeasonMarker(title) && getSeasonNumber(title) > 1);
const buildScraperQueries = (details: any): string[] => {
    const queries = new Set<string>();
    const add = (value: unknown) => {
        const raw = String(value ?? '').replace(/\s+/g, ' ').trim();
        if (raw) queries.add(raw);
    };
    const addSeasonAliases = (value: unknown) => {
        const raw = String(value ?? '').replace(/\s+/g, ' ').trim();
        if (!raw) return;
        add(raw);

        const seasonMatch = raw.match(/\bseason\s*(\d+)\b/i) || raw.match(/\b(\d+)(st|nd|rd|th)\s*season\b/i);
        if (seasonMatch?.[1]) {
            const seasonNumber = Number(seasonMatch[1]);
            const ordinal =
                seasonNumber % 100 >= 11 && seasonNumber % 100 <= 13
                    ? `${seasonNumber}th`
                    : `${seasonNumber}${(['th', 'st', 'nd', 'rd'][seasonNumber % 10] || 'th')}`;
            add(raw.replace(/\bseason\s*\d+\b/ig, `${ordinal} Season`));
            add(raw.replace(/\b\d+(st|nd|rd|th)\s*season\b/ig, `Season ${seasonNumber}`));
        }

        add(raw.replace(/:\s*[^:]+$/, '').trim());
        add(raw.replace(/\bpart\s*\d+\b/ig, '').replace(/\s+/g, ' ').trim());
    };

    addSeasonAliases(details?.title?.english);
    addSeasonAliases(details?.title?.romaji);
    addSeasonAliases(details?.title?.native);
    (Array.isArray(details?.synonyms) ? details.synonyms : []).slice(0, 6).forEach(addSeasonAliases);

    return Array.from(queries).slice(0, 8);
};
const rankCandidate = (title: string, candidate: any) => {
    const source = normalizeTitleToken(title);
    const target = normalizeTitleToken(String(candidate?.title || ''));
    if (!source || !target) return 0;
    if (source.length < 6 || target.length < 6) return 0;
    let score = 0;
    if (source === target) score += 100;
    else if (source.includes(target) || target.includes(source)) score += 70;

    const sourceSeason = getSeasonNumber(title);
    const candidateSeason = getSeasonNumber(String(candidate?.title || ''));
    if (sourceSeason === candidateSeason) score += 30;
    else if (sourceSeason > 1 && candidateSeason > 1) score -= 40;

    return score;
};
const rankAgainstAnime = (details: any, candidate: any) => {
    const titles = buildScraperQueries(details);
    const titleScore = titles.reduce((best, title) => Math.max(best, rankCandidate(title, candidate)), 0);
    if (titleScore <= 0) return 0;
    let score = titleScore;
    const targetSeason = getTargetSeasonNumber(details);
    const candidateTitle = String(candidate?.title || '');
    const candidateSeason = getSeasonNumber(candidateTitle);
    const candidateHasExplicitSeason = hasExplicitSeasonMarker(candidateTitle);

    const expectedEpisodes = Number(details?.nextAiringEpisode?.episode ? details.nextAiringEpisode.episode - 1 : (details?.episodes || 0));
    const candidateEpisodes = Number(candidate?.episodes || 0);
    if (expectedEpisodes > 0 && candidateEpisodes > 0) {
        const diff = Math.abs(candidateEpisodes - expectedEpisodes);
        if (diff === 0) score += 40;
        else if (diff <= 1) score += 25;
        else if (diff <= 3) score += 10;
        else score -= 35;
    }

    if (targetSeason > 1) {
        if (candidateHasExplicitSeason && candidateSeason === targetSeason) score += 120;
        else if (candidateHasExplicitSeason && candidateSeason !== targetSeason) score -= 160;
        else score -= 60;
    }

    const animeYear = Number(details?.seasonYear || 0);
    const candidateYear = Number(candidate?.year || 0);
    if (animeYear > 0 && candidateYear > 0) {
        const diff = Math.abs(candidateYear - animeYear);
        if (diff === 0) score += 10;
        else if (diff === 1) score += 4;
        else score -= 24;
    }

    return score;
};
const findRankedScraperCandidates = async (details: any) => {
    const titles = buildScraperQueries(details);
    const candidateMap = new Map<string, any>();
    const rankCandidates = () => [...candidateMap.values()]
        .map((candidate) => ({
            candidate,
            score: rankAgainstAnime(details, candidate),
        }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score);

    const searchAndAdd = async (batch: string[]) => {
        const resultSets = await Promise.all(
            batch.map((title) => scraperService.searchAllManga(title).catch(() => []))
        );

        resultSets.forEach((found) => {
            if (!Array.isArray(found)) return;
            found.forEach((candidate) => {
                const session = String(candidate?.session || '').trim();
                if (session && isAllMangaSession(session) && !candidateMap.has(session)) {
                    candidateMap.set(session, candidate);
                }
            });
        });
    };

    for (let index = 0; index < titles.length; index += 3) {
        await searchAndAdd(titles.slice(index, index + 3));
        const ranked = rankCandidates();
        if (ranked[0]?.score >= 90) {
            return ranked;
        }
    }

    return rankCandidates();
};
const pickPreferredScraperCandidate = (
    details: any,
    rankedCandidates: Array<{ candidate: any; score: number }>,
    currentSession?: string | null
) => {
    if (!Array.isArray(rankedCandidates) || rankedCandidates.length === 0) return null;

    const sequelSeason = hasExplicitSequelSeason(details);
    const targetSeason = getTargetSeasonNumber(details);
    const targetYear = Number(details?.seasonYear || 0);
    const refined = rankedCandidates.filter(({ candidate }) => {
        const candidateTitle = String(candidate?.title || '');
        const candidateYear = Number(candidate?.year || 0);
        if (!sequelSeason) return true;
        if (!hasExplicitSeasonMarker(candidateTitle)) return false;
        if (getSeasonNumber(candidateTitle) !== targetSeason) return false;
        if (targetYear > 0 && candidateYear > 0 && Math.abs(candidateYear - targetYear) > 1) return false;
        return true;
    });

    const pool = refined.length > 0 ? refined : rankedCandidates;
    const preferred = pool[0] || null;
    if (!preferred) return null;

    if (currentSession && String(preferred.candidate?.session || '') === String(currentSession)) {
        return preferred;
    }

    return preferred;
};
const isCompatibleResolvedSession = (
    resolvedSession: string | null | undefined,
    rankedCandidates: Array<{ candidate: any; score: number }>
) => {
    const current = String(resolvedSession || '').trim();
    if (!current) return false;
    if (!Array.isArray(rankedCandidates) || rankedCandidates.length === 0) return true;

    const currentEntry = rankedCandidates.find(
        ({ candidate }) => String(candidate?.session || '').trim() === current
    );
    if (!currentEntry || currentEntry.score <= 0) return false;

    const bestScore = Number(rankedCandidates[0]?.score || 0);
    if (bestScore <= 0) return true;

    return bestScore - currentEntry.score <= 80;
};
const getExpectedEpisodeCount = (details: any) => {
    if (details?.nextAiringEpisode?.episode) {
        return Number(details.nextAiringEpisode.episode - 1);
    }

    const status = String(details?.status || '').toUpperCase();
    if (status === 'RELEASING') return 0;

    return Number(details?.episodes || 0);
};
const hasSufficientEpisodes = (details: any, episodes: any[]) => {
    if (!Array.isArray(episodes) || episodes.length === 0) return false;
    const expectedEpisodes = getExpectedEpisodeCount(details);
    if (expectedEpisodes > 0 && episodes.length < expectedEpisodes) return false;
    return true;
};
const getEpisodesWithTimeout = async (session: string, timeoutMs = 9000) => {
    let timedOut = false;
    const timeout = new Promise<{ episodes: any[] }>((resolve) => {
        setTimeout(() => {
            timedOut = true;
            resolve({ episodes: [] });
        }, timeoutMs);
    });

    const result = await Promise.race([
        scraperService.getEpisodes(session).catch(() => ({ episodes: [] })),
        timeout,
    ]);

    if (timedOut) {
        console.warn(`Episode fetch timed out for scraper session ${session}`);
    }

    return result;
};
const getFreshHomeFastFromMemory = () => {
    if (!homeFastMemoryCache) return null;
    if (Date.now() - homeFastMemoryCache.timestamp > HOME_FAST_TTL_SECONDS * 1000) return null;
    return homeFastMemoryCache.data;
};

const mapWithConcurrency = async <T, R>(
    items: T[],
    limit: number,
    mapper: (item: T, index: number) => Promise<R>
) => {
    const results = new Array<R>(items.length);
    let nextIndex = 0;
    const workerCount = Math.min(Math.max(1, limit), items.length);

    await Promise.all(Array.from({ length: workerCount }, async () => {
        while (nextIndex < items.length) {
            const index = nextIndex;
            nextIndex += 1;
            results[index] = await mapper(items[index], index);
        }
    }));

    return results;
};

const enrichAnimeKaiItems = async (items: any[]) => {
    const safeItems = Array.isArray(items) ? items.filter((item) => item?.title) : [];
    const results = await mapWithConcurrency(
        safeItems,
        2,
        async (item) => {
            const anilistMedia = await anilistService.findBestAnimeMatch({
                titles: [item.title, item.jname].filter(Boolean),
                episodes: Number(item.episodes || item.latestEpisode || item.sub || 0) || undefined,
                format: item.type,
                perPage: 5,
            }).catch(() => null);

            return {
                ...item,
                id: anilistMedia?.id || 0,
                mal_id: anilistMedia?.idMal || anilistMedia?.id || 0,
                nextAiringEpisode: anilistMedia?.nextAiringEpisode || item.nextAiringEpisode,
                status: anilistMedia?.status || item.status,
                anilist: anilistMedia || null,
            };
        }
    );

    return results
        .map((result, index) => result || {
                ...safeItems[index],
                id: 0,
                mal_id: 0,
                anilist: null,
            })
        .filter((item) => item?.title);
};

const buildAnimeKaiFallbackItems = (items: any[]) => {
    const safeItems = Array.isArray(items) ? items.filter((item) => item?.title) : [];
    return safeItems.map((item) => ({
        ...item,
        id: Number(item?.id || 0) || 0,
        mal_id: Number(item?.mal_id || item?.id || 0) || 0,
        anilist: item?.anilist || null,
    }));
};

const applyTmdbSpotlightBanners = async (items: any[]) => {
    const safeItems = Array.isArray(items) ? items : [];
    const results = await Promise.allSettled(
        safeItems.map(async (item) => {
            const banner = await tmdbService.resolveBackdrop({
                titles: [
                    item?.title,
                    item?.jname,
                    item?.anilist?.title?.english,
                    item?.anilist?.title?.romaji,
                    item?.anilist?.title?.native,
                ],
                year: item?.year || item?.anilist?.seasonYear || item?.anilist?.startDate?.year,
                format: item?.type || item?.anilist?.format,
            });

            return {
                ...item,
                banner: banner || item?.banner || item?.anilist?.bannerImage || undefined,
            };
        })
    );

    return results.map((result, index) => result.status === 'fulfilled'
        ? result.value
        : safeItems[index]);
};

const clearSpotlightBanners = (items: any[]) =>
    (Array.isArray(items) ? items : []).map((item) => ({
        ...item,
        banner: item?.banner || item?.anilist?.bannerImage || undefined,
    }));

const wrapAniListMediaItems = (items: any[]) =>
    (Array.isArray(items) ? items : []).map((item) => ({
        title: item?.title?.english || item?.title?.romaji || item?.title?.native || 'Unknown',
        poster: item?.coverImage?.extraLarge || item?.coverImage?.large,
        banner: item?.bannerImage,
        type: item?.format || 'TV',
        episodes: item?.episodes || (item?.nextAiringEpisode?.episode ? item.nextAiringEpisode.episode - 1 : null),
        latestEpisode: item?.nextAiringEpisode?.episode ? item.nextAiringEpisode.episode - 1 : undefined,
        nextAiringEpisode: item?.nextAiringEpisode ? {
            episode: item.nextAiringEpisode.episode,
            airingAt: item.nextAiringEpisode.airingAt,
            timeUntilAiring: item.nextAiringEpisode.timeUntilAiring ?? (item.nextAiringEpisode.airingAt ? item.nextAiringEpisode.airingAt - Math.floor(Date.now() / 1000) : 0),
        } : undefined,
        status: item?.status,
        trailer: item?.trailer,
        score: item?.averageScore ? item.averageScore / 10 : 0,
        rating: item?.averageScore ? (item.averageScore / 10).toFixed(1) : undefined,
        id: item?.id || 0,
        mal_id: item?.idMal || item?.id || 0,
        anilist: item,
    }));

const buildHomeFastPayload = async () => {
    const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> => {
        try {
            return await Promise.race<T>([
                promise,
                new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs)),
            ]);
        } catch {
            return fallback;
        }
    };
    const [spotlightRaw, latestEpisodesRaw, trending, seasonal, monthly, topAnime] = await Promise.all([
        withTimeout(anilistService.getNativeSpotlightAnime(8), 5000, [] as any[]),
        withTimeout(
            scraperService.getAllMangaLatestUpdates(1, 10).then((result) =>
                Array.isArray(result?.data) ? result.data : []
            ),
            5500,
            [] as any[]
        ),
        withTimeout(anilistService.getTrendingAnime(1, 30), 4000, { media: [] }),
        withTimeout(anilistService.getPopularThisSeason(1, 24), 4000, { media: [] }),
        withTimeout(anilistService.getPopularThisMonth(1, 24), 4000, { media: [] }),
        withTimeout(anilistService.getTopAnime(1, 24), 4000, { media: [], pageInfo: { lastPage: 1, currentPage: 1, hasNextPage: false } }),
    ]);
    console.log(`[Spotlight] Source: AniList native (${Array.isArray(spotlightRaw) ? spotlightRaw.length : 0} items)`);
    const latestRawItems = Array.isArray(latestEpisodesRaw) ? latestEpisodesRaw : [];
    const latestEpisodes = await Promise.race([
        enrichAnimeKaiItems(latestRawItems),
        new Promise<any[]>((resolve) => setTimeout(() => resolve(buildAnimeKaiFallbackItems(latestRawItems)), 2500)),
    ]);
    const spotlightEnriched = wrapAniListMediaItems(Array.isArray(spotlightRaw) ? spotlightRaw : []);
    const spotlight = await Promise.race([
        applyTmdbSpotlightBanners(spotlightEnriched),
        new Promise<any[]>((resolve) => setTimeout(() => resolve(clearSpotlightBanners(spotlightEnriched)), 3500)),
    ]);

    return {
        spotlight: Array.isArray(spotlight) ? spotlight : [],
        latestEpisodes,
        trending,
        seasonal,
        monthly,
        topAnime,
        topTen: {
            day: wrapAniListMediaItems(trending?.media || []),
            week: wrapAniListMediaItems(seasonal?.media || []),
            month: wrapAniListMediaItems(monthly?.media || []),
        },
        generatedAt: Date.now(),
    };
};

const refreshHomeFastCache = async () => {
    if (homeFastRefreshPromise) return homeFastRefreshPromise;
    homeFastRefreshPromise = (async () => {
        try {
            const payload = await buildHomeFastPayload();
            // Allow partial payloads if spotlight times out to maintain resilience.
            homeFastMemoryCache = { data: payload, timestamp: Date.now() };
            await redis.set(HOME_FAST_CACHE_KEY, payload, { ex: HOME_FAST_TTL_SECONDS });
            return payload;
        } finally {
            homeFastRefreshPromise = null;
        }
    })();
    return homeFastRefreshPromise;
};

const warmHomeFastCache = async () => refreshHomeFastCache();

router.get('/home-fast', async (_req, res) => {
    try {
        const memoryHit = getFreshHomeFastFromMemory();
        if (memoryHit) {
            res.json(memoryHit);
            return;
        }

        const redisHit = await redis.get<any>(HOME_FAST_CACHE_KEY).catch(() => null);
        if (redisHit && Array.isArray(redisHit.spotlight) && redisHit.spotlight.length > 0) {
            homeFastMemoryCache = { data: redisHit, timestamp: Date.now() };
            res.json(redisHit);
            refreshHomeFastCache().catch(() => undefined);
            return;
        }
        if (redisHit) {
            redis.del(HOME_FAST_CACHE_KEY).catch(() => undefined);
        }

        const fresh = await refreshHomeFastCache();
        res.json(fresh);
    } catch (error) {
        console.error('Error in home-fast route:', error);
        res.status(500).json({ error: 'Failed to fetch home bundle' });
    }
});

// Get top/popular anime
router.get('/top', async (req, res) => {
    try {
        const page = req.query.page ? parseInt(req.query.page as string) : 1;
        const perPage = req.query.limit ? parseInt(req.query.limit as string) : 24;
        const format = req.query.format as string | undefined;

        const data = await anilistService.getTopAnime(page, perPage, format);
        res.json(data);
    } catch (error: any) {
        console.error('Error in top anime route:', error.message);
        if (error.response) {
            res.status(error.response.status).json({ error: error.response.data });
        } else {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

// Alias for /top for "Most Popular" page
router.get('/popular', async (req, res) => {
    try {
        const page = req.query.page ? parseInt(req.query.page as string) : 1;
        const perPage = req.query.limit ? parseInt(req.query.limit as string) : 24;
        const data = await anilistService.getTopAnime(page, perPage);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch popular anime' });
    }
});

// Get anime by format (MOVIE, TV, OVA, ONA, SPECIAL)
router.get('/format/:format', async (req, res) => {
    try {
        const { format } = req.params;
        const page = req.query.page ? parseInt(req.query.page as string) : 1;
        const perPage = req.query.limit ? parseInt(req.query.limit as string) : 24;

        const data = await anilistService.getTopAnime(page, perPage, format.toUpperCase());
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch anime by format' });
    }
});

// Get native spotlight anime (top 8) from AniList trend/season/popularity pools.
router.get('/spotlight', async (_req, res) => {
    try {
        const media = await anilistService.getNativeSpotlightAnime(8);
        const spotlight = wrapAniListMediaItems(media);
        res.set('Cache-Control', 'public, max-age=120, s-maxage=300, stale-while-revalidate=600');
        res.json({ spotlight });
    } catch (error) {
        console.error('Error in spotlight anime route:', error);
        res.status(500).json({ error: 'Failed to fetch spotlight anime' });
    }
});

router.get('/native-spotlight', async (_req, res) => {
    try {
        const media = await anilistService.getNativeSpotlightAnime(8);
        const spotlight = wrapAniListMediaItems(media);
        res.set('Cache-Control', 'public, max-age=120, s-maxage=300, stale-while-revalidate=600');
        res.json({ spotlight });
    } catch (error) {
        console.error('Error in native spotlight route:', error);
        res.status(500).json({ error: 'Failed to fetch native spotlight anime' });
    }
});

// Get top/popular manga (by SCORE)
router.get('/top/manga', async (req, res) => {
    try {
        const page = req.query.page ? parseInt(req.query.page as string) : 1;
        const perPage = req.query.limit ? parseInt(req.query.limit as string) : 24;

        let data = await anilistService.getTopManga(page, perPage).catch(() => null);
        if (!data?.media || data.media.length === 0) {
            const fallback = await mangaScraperService.getMangaDirectory(page).catch(() => ({ data: [], totalPages: 1 }));
            data = {
                media: mapScraperMangaToAniListMedia(fallback.data),
                pageInfo: { currentPage: page, lastPage: fallback.totalPages || 1, hasNextPage: page < (fallback.totalPages || 1) }
            };
        }
        res.json(data);
    } catch (error) {
        console.error('Error in top manga route:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all-time popular manga (by POPULARITY)
router.get('/popular/manga', async (req, res) => {
    try {
        const page = req.query.page ? parseInt(req.query.page as string) : 1;
        const perPage = req.query.limit ? parseInt(req.query.limit as string) : 24;

        let data = await anilistService.getPopularManga(page, perPage).catch(() => null);
        if (!data?.media || data.media.length === 0) {
            const fallback = await mangaScraperService.getMangaDirectory(page).catch(() => ({ data: [], totalPages: 1 }));
            data = {
                media: mapScraperMangaToAniListMedia(fallback.data),
                pageInfo: { currentPage: page, lastPage: fallback.totalPages || 1, hasNextPage: page < (fallback.totalPages || 1) }
            };
        }
        res.json(data);
    } catch (error) {
        console.error('Error in popular manga route:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get popular manhwa
router.get('/top/manhwa', async (req, res) => {
    try {
        const page = req.query.page ? parseInt(req.query.page as string) : 1;
        const perPage = req.query.limit ? parseInt(req.query.limit as string) : 24;

        let data = await anilistService.getPopularManhwa(page, perPage).catch(() => null);
        if (!data?.media || data.media.length === 0) {
            const fallback = await mangaScraperService.getNewManga(page).catch(() => ({ data: [], totalPages: 1 }));
            data = {
                media: mapScraperMangaToAniListMedia(fallback.data.map(item => ({ ...item, countryOfOrigin: 'KR' }))),
                pageInfo: { currentPage: page, lastPage: fallback.totalPages || 1, hasNextPage: page < (fallback.totalPages || 1) }
            };
        }
        res.json(data);
    } catch (error) {
        console.error('Error in top manhwa route:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get one-shot manga
router.get('/top/one-shot', async (req, res) => {
    try {
        const page = req.query.page ? parseInt(req.query.page as string) : 1;
        const perPage = req.query.limit ? parseInt(req.query.limit as string) : 24;

        let data = await anilistService.getOneShotManga(page, perPage).catch(() => null);
        if (!data?.media || data.media.length === 0) {
            const fallback = await mangaScraperService.getLatestManga(page).catch(() => ({ data: [], totalPages: 1 }));
            data = {
                media: mapScraperMangaToAniListMedia(fallback.data),
                pageInfo: { currentPage: page, lastPage: fallback.totalPages || 1, hasNextPage: page < (fallback.totalPages || 1) }
            };
        }
        res.json(data);
    } catch (error) {
        console.error('Error in top one-shot route:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// Get trending anime
router.get('/trending', async (req, res) => {
    try {
        const page = req.query.page ? parseInt(req.query.page as string) : 1;
        const perPage = req.query.limit ? parseInt(req.query.limit as string) : 50;

        const data = await anilistService.getTrendingAnime(page, perPage);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch trending anime' });
    }
});

// Get trending manga
router.get('/trending/manga', async (req, res) => {
    try {
        const page = req.query.page ? parseInt(req.query.page as string) : 1;
        const perPage = req.query.limit ? parseInt(req.query.limit as string) : 10;

        let data = await anilistService.getTrendingManga(page, perPage).catch(() => null);
        if (!data?.media || data.media.length === 0) {
            const fallback = await mangaScraperService.getLatestManga(page).catch(() => ({ data: [], totalPages: 1 }));
            data = {
                media: mapScraperMangaToAniListMedia(fallback.data),
                pageInfo: { currentPage: page, lastPage: fallback.totalPages || 1, hasNextPage: page < (fallback.totalPages || 1) }
            };
        }
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch trending manga' });
    }
});

// Get popular this season
router.get('/popular-this-season', async (req, res) => {
    try {
        const page = req.query.page ? parseInt(req.query.page as string) : 1;
        const perPage = req.query.limit ? parseInt(req.query.limit as string) : 50;

        const data = await anilistService.getPopularThisSeason(page, perPage);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch popular this season' });
    }
});

// Get popular this month
router.get('/popular-this-month', async (req, res) => {
    try {
        const page = req.query.page ? parseInt(req.query.page as string) : 1;
        const perPage = req.query.limit ? parseInt(req.query.limit as string) : 50;

        const data = await anilistService.getPopularThisMonth(page, perPage);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch popular this month' });
    }
});

// A-Z List for Manga
router.get('/manga/az-list/:letter', async (req, res) => {
    try {
        const { letter } = req.params;
        const page = req.query.page ? parseInt(req.query.page as string) : 1;
        const perPage = req.query.limit ? parseInt(req.query.limit as string) : 18;

        const data = await anilistService.getMangaAZList(letter, page, perPage);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch Manga A-Z list' });
    }
});

// A-Z List for Anime
router.get('/anime/az-list/:letter', async (req, res) => {
    try {
        const { letter } = req.params;
        const page = req.query.page ? parseInt(req.query.page as string) : 1;
        const perPage = req.query.limit ? parseInt(req.query.limit as string) : 18;

        const data = await anilistService.getAnimeAZList(letter, page, perPage);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch Anime A-Z list' });
    }
});

// Search anime
router.get('/search', async (req, res) => {
    try {
        const query = req.query.q as string;
        const page = req.query.page ? parseInt(req.query.page as string) : 1;
        const perPage = req.query.limit ? parseInt(req.query.limit as string) : 24;

        if (!query) {
            res.status(400).json({ error: 'Query parameter "q" is required' });
            return;
        }

        const data = await anilistService.searchAnime(query, page, perPage);
        res.json(data);
    } catch (error) {
        console.error('Error in search route:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Search manga
router.get('/search/manga', async (req, res) => {
    try {
        const query = req.query.q as string;
        const page = req.query.page ? parseInt(req.query.page as string) : 1;
        const perPage = req.query.limit ? parseInt(req.query.limit as string) : 24;

        if (!query) {
            res.status(400).json({ error: 'Query parameter "q" is required' });
            return;
        }

        const data = await anilistService.searchManga(query, page, perPage);
        res.json(data);
    } catch (error) {
        console.error('Error in search manga route:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/anime/:id/fast', async (req, res) => {
    try {
        const { id } = req.params;
        if (id.startsWith('s:')) {
            res.set('Cache-Control', 'no-store');
        }

        // Fast path: serve composed response from Redis (skip for scraper IDs)
        const composedCacheKey = `fast-composed:v8:${id}`;
        if (!id.startsWith('s:')) {
            try {
                const composedCached = await redis.get<any>(composedCacheKey).catch(() => null);
                if (composedCached && hasSufficientEpisodes(composedCached.anime, composedCached.episodes)) {
                    res.set('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=300');
                    res.json(composedCached);
                    return;
                }
                if (composedCached) {
                    redis.del(composedCacheKey).catch(() => undefined);
                }
            } catch { /* fall through */ }
        }

        let animeDetails: any = null;
        let resolvedSession: string | null = null;
        let rankedCandidates: Array<{ candidate: any; score: number }> = [];

        if (id.startsWith('s:')) {
            resolvedSession = id.substring(2).trim() || null;
            if (!resolvedSession || (!isAllMangaSession(resolvedSession) && !isGenericScraperSession(resolvedSession))) {
                res.status(400).json({ error: 'Unsupported scraper session' });
                return;
            }
            const allMangaSession = isAllMangaSession(resolvedSession);
            const genericScraperSession = !allMangaSession;
            const scraperDetails = allMangaSession
                    ? await scraperService.getAllMangaAnimeInfo(resolvedSession)
                : null;

            if (genericScraperSession) {
                animeDetails = scraperDetails ? {
                    id,
                    title: { romaji: scraperDetails.title, english: scraperDetails.title },
                    coverImage: { large: scraperDetails.poster },
                    description: scraperDetails.description,
                    status: scraperDetails.status,
                    episodes: scraperDetails.episodes || null,
                    format: scraperDetails.type || 'TV',
                    genres: [],
                    averageScore: 0,
                    scraperId: resolvedSession,
                } : null;
            }

            if (!genericScraperSession && scraperDetails?.title) {
                const anilistMatch = await anilistService.findBestAnimeMatch({
                    titles: [scraperDetails.title],
                    year: Number(scraperDetails.year || 0) || undefined,
                    episodes: Number(scraperDetails.episodes || 0) || undefined,
                    format: scraperDetails.type,
                });
                if (anilistMatch?.id) {
                    const full = await anilistService.getAnimeById(anilistMatch.id);
                    if (full) {
                        animeDetails = {
                            ...full,
                            id,
                            mal_id: full.id,
                            scraperId: resolvedSession,
                        };
                    }
                }
            }

            if (!animeDetails && scraperDetails) {
                animeDetails = {
                    id,
                    title: { romaji: scraperDetails.title, english: scraperDetails.title },
                    coverImage: { large: scraperDetails.poster },
                    description: scraperDetails.description,
                    status: scraperDetails.status,
                    episodes: scraperDetails.episodes || null,
                    format: scraperDetails.type || 'TV',
                    genres: [],
                    averageScore: 0,
                    scraperId: resolvedSession,
                };
            }
        } else {
            const numericId = parseInt(id, 10);
            if (Number.isNaN(numericId)) {
                res.status(400).json({ error: 'Invalid ID' });
                return;
            }

            animeDetails = await anilistService.getAnimeById(numericId);
            if (!animeDetails) {
                res.status(404).json({ error: 'Anime not found' });
                return;
            }

            const mapped = await mappingService.getMapping(String(numericId)).catch(() => null);
            if (mapped?.id) {
                resolvedSession = String(mapped.id).trim();
            }

            const shouldForceSeasonRefresh = hasExplicitSequelSeason(animeDetails);
            if (resolvedSession || shouldForceSeasonRefresh) {
                rankedCandidates = await findRankedScraperCandidates(animeDetails);

                if (resolvedSession && !isCompatibleResolvedSession(resolvedSession, rankedCandidates)) {
                    await mappingService.deleteMapping(String(numericId)).catch(() => undefined);
                    resolvedSession = null;
                }
            }

            if (!resolvedSession || shouldForceSeasonRefresh) {
                if (rankedCandidates.length === 0) {
                    rankedCandidates = await findRankedScraperCandidates(animeDetails);
                }
                const preferred = pickPreferredScraperCandidate(animeDetails, rankedCandidates, resolvedSession);
                const best = preferred?.candidate || rankedCandidates[0]?.candidate;
                if (best?.session && String(best.session) !== String(resolvedSession || '')) {
                    resolvedSession = String(best.session);
                    await mappingService.saveMapping(String(numericId), resolvedSession, String(best.title || animeDetails?.title?.english || animeDetails?.title?.romaji || '')).catch(() => undefined);
                }
            }
        }

        let episodes: any[] = [];
        if (resolvedSession) {
            const ep = await getEpisodesWithTimeout(resolvedSession);
            episodes = Array.isArray(ep?.episodes) ? ep.episodes : [];
        }

        if (!hasSufficientEpisodes(animeDetails, episodes) && animeDetails && !id.startsWith('s:')) {
            const numericId = parseInt(id, 10);
            if (!Number.isNaN(numericId)) {
                if (rankedCandidates.length === 0) {
                    rankedCandidates = await findRankedScraperCandidates(animeDetails);
                }
                for (const { candidate } of rankedCandidates) {
                    const candidateSession = String(candidate?.session || '');
                    if (!candidateSession || candidateSession === String(resolvedSession || '')) continue;
                    if (!isAllMangaSession(candidateSession)) continue;

                    const retry = await getEpisodesWithTimeout(candidateSession);
                    const retryEpisodes = Array.isArray(retry?.episodes) ? retry.episodes : [];
                    if (retryEpisodes.length === 0) continue;
                    if (!hasSufficientEpisodes(animeDetails, retryEpisodes)) continue;

                    resolvedSession = candidateSession;
                    episodes = retryEpisodes;
                    await mappingService.saveMapping(
                        String(numericId),
                        resolvedSession,
                        String(candidate.title || animeDetails?.title?.english || animeDetails?.title?.romaji || '')
                    ).catch(() => undefined);
                    break;
                }
            }
        }

        const result = {
            anime: animeDetails,
            scraperSession: resolvedSession,
            episodes,
        };

        // Cache composed response in Redis for 3 minutes
        if (!id.startsWith('s:') && hasSufficientEpisodes(animeDetails, episodes)) {
            redis.set(composedCacheKey, result, { ex: 180 }).catch(() => undefined);
        }

        res.set('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=300');
        res.json(result);
    } catch (error) {
        console.error('Error in anime fast route:', error);
        res.status(500).json({ error: 'Failed to fetch fast anime details' });
    }
});

// Get anime details
router.get('/anime/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (id.startsWith('s:')) {
            res.set('Cache-Control', 'no-store');
        }

        // Hybrid Logic for Scraper IDs (e.g. s:one-piece-100)
        if (id.startsWith('s:')) {
            const scraperId = id.substring(2);
            if (!scraperId || (!isAllMangaSession(scraperId) && !isGenericScraperSession(scraperId))) {
                return res.status(400).json({ error: 'Unsupported scraper session' });
            }
            const allMangaSession = isAllMangaSession(scraperId);
            const genericScraperSession = !allMangaSession;
            const scraperDetails = allMangaSession
                ? await scraperService.getAllMangaAnimeInfo(scraperId)
                : null;
            if (!scraperDetails) {
                return res.status(404).json({ error: 'Anime not found on scraper' });
            }

            if (!genericScraperSession) {
                // 2. Search AniList by Title
                const title = scraperDetails.title;
                const anilistMatch = await anilistService.findBestAnimeMatch({
                    titles: [title],
                    year: Number(scraperDetails.year || 0) || undefined,
                    episodes: Number(scraperDetails.episodes || 0) || undefined,
                    format: scraperDetails.type,
                });

                if (anilistMatch) {
                    // 3. Get full AniList details
                    const anilistDetails = await anilistService.getAnimeById(anilistMatch.id);
                    if (anilistDetails) {
                        // 4. Return merged result (AniList metadata + Scraper ID hint)
                        return res.json({
                            ...anilistDetails,
                            id: id, // Maintain s: prefix
                            mal_id: anilistDetails.id, // Keep AniList/MAL ID ref as mal_id
                            scraperId: scraperId
                        });
                    }
                }
            }

            // Fallback: Return mapped scraper data
            return res.json({
                id: id,
                title: { romaji: scraperDetails.title, english: scraperDetails.title },
                coverImage: { large: scraperDetails.poster },
                description: scraperDetails.description,
                status: scraperDetails.status,
                episodes: scraperDetails.episodes || null,
                format: scraperDetails.type || 'TV',
                genres: [],
                averageScore: 0,
                scraperId: scraperId
            });
        }

        const numericId = parseInt(id);
        if (isNaN(numericId)) {
            res.status(400).json({ error: 'Invalid ID' });
            return;
        }

        const data = await anilistService.getAnimeById(numericId);
        // Or getAnimeById was calling getMediaDetails? 
        // anilistService.getAnimeById uses generic fetch.
        // Let's stick to getMediaDetails which I added.
        if (!data) {
            res.status(404).json({ error: 'Anime not found' });
            return;
        }
        res.json(data);
    } catch (error: any) {
        console.error('Error in anime by ID route:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get manga by ID
router.get('/manga/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            res.status(400).json({ error: 'Invalid ID' });
            return;
        }

        const data = await anilistService.getMangaById(id);
        if (!data) {
            res.status(404).json({ error: 'Manga not found' });
            return;
        }
        res.json(data);
    } catch (error) {
        console.error('Error in manga by ID route:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Batch covers (keep for compatibility)
router.post('/batch-covers', async (req, res) => {
    try {
        const { malIds } = req.body;

        if (!malIds || !Array.isArray(malIds)) {
            res.status(400).json({ error: 'Invalid malIds provided' });
            return;
        }

        const data = await anilistService.getCoverImages(malIds);
        res.json(data);
    } catch (error) {
        console.error('Error in batch-covers route:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Legacy POST search (keep for compatibility with spotlight resolution)
router.post('/search', async (req, res) => {
    try {
        const { query } = req.body;
        if (!query) {
            res.status(400).json({ error: 'Query is required' });
            return;
        }

        const data = await anilistService.searchAnime(query, 1, 5);
        res.json(data.media || []);
    } catch (error) {
        console.error('Error in search route:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get airing schedule for a time range
router.get('/schedule', async (req, res) => {
    try {
        // Default to current day (start of day to end of day in UTC)
        const now = Math.floor(Date.now() / 1000);
        const startOfDay = now - (now % 86400); // Start of current UTC day

        const start = req.query.start ? parseInt(req.query.start as string) : startOfDay;
        const end = req.query.end ? parseInt(req.query.end as string) : startOfDay + 86400;

        const data = await anilistService.getAiringSchedule(start, end);
        res.json(data);
    } catch (error) {
        console.error('Error in schedule route:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get list of genres
router.get('/genres', (req, res) => {
    try {
        const genres = anilistService.getGenres();
        res.json(genres);
    } catch (error) {
        console.error('Error in genres route:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get anime by genre
router.get('/genre/:name', async (req, res) => {
    try {
        const genre = req.params.name;
        const page = req.query.page ? parseInt(req.query.page as string) : 1;
        const perPage = req.query.limit ? parseInt(req.query.limit as string) : 24;

        const data = await anilistService.getAnimeByGenre(genre, page, perPage);
        res.json(data);
    } catch (error) {
        console.error('Error in genre route:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get manga by genre
router.get('/manga/genre/:name', async (req, res) => {
    try {
        const genre = req.params.name;
        const page = req.query.page ? parseInt(req.query.page as string) : 1;
        const perPage = req.query.limit ? parseInt(req.query.limit as string) : 24;

        const data = await anilistService.getMangaByGenre(genre, page, perPage);
        res.json(data);
    } catch (error) {
        console.error('Error in manga genre route:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get random anime
router.get('/random', async (req, res) => {
    try {
        const data = await anilistService.getRandomAnime();
        res.json(data);
    } catch (error) {
        console.error('Error in random anime route:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get random manga
router.get('/random-manga', async (req, res) => {
    try {
        const data = await anilistService.getRandomManga();
        res.json(data);
    } catch (error) {
        console.error('Error in random manga route:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;



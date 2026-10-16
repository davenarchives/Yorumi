import { Router } from 'express';
import { animeQuery, streambertAnimeService } from './anime.service';
import { anilistService } from '../anilist/anilist.service';
import { animeVideoSources } from './video-sources';
import { animeMappingService } from './anime-mapping.service';

const router = Router();

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 60;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

router.use((req, res, next) => {
    const now = Date.now();
    const key = req.ip || 'unknown';
    const entry = rateLimitMap.get(key);

    if (!entry || entry.resetAt <= now) {
        rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
        next();
        return;
    }

    entry.count += 1;
    if (entry.count > RATE_LIMIT_MAX) {
        res.status(429).json({ error: 'Rate limit exceeded' });
        return;
    }

    next();
});

router.get('/metadata', async (req, res) => {
    try {
        const tmdbId = Number(req.query.tmdbId);
        const anilistId = Number(req.query.anilistId || req.query.id);
        const malId = Number(req.query.malId);
        const format = req.query.format ? String(req.query.format).toUpperCase() : undefined;

        let metadata: any = null;

        if (Number.isFinite(tmdbId) && tmdbId > 0) {
            metadata = await streambertAnimeService.getMetadata(Math.floor(tmdbId), format).catch(() => null);
        } else if (Number.isFinite(malId) && malId > 0) {
            metadata = await anilistService.getAnimeByMalId(Math.floor(malId)).catch(() => null);
        } else if (Number.isFinite(anilistId) && anilistId > 0) {
            // AniList IDs identify season-sized anime entries. Returning TMDB's
            // show-level payload here replaces that identity and can turn a
            // 25-episode sequel entry into a combined 50-episode series.
            metadata = await anilistService.getAnimeById(Math.floor(anilistId)).catch(() => null);

            // Keep TMDB as supplementary metadata without allowing it to
            // overwrite canonical title, episode, relation, or status fields.
            if (metadata) {
                const tmdbMetadata = await streambertAnimeService
                    .getMetadataFromAniListId(Math.floor(anilistId), format)
                    .catch(() => null);
                const resolvedTmdbId = Number(tmdbMetadata?.tmdbId || 0);
                if (resolvedTmdbId > 0) {
                    metadata = {
                        ...metadata,
                        tmdbId: resolvedTmdbId,
                        bannerImage: metadata.bannerImage || tmdbMetadata.bannerImage,
                    };
                }
            }
        }

        if (!metadata && req.query.title) {
            metadata = await streambertAnimeService.findMetadataByTitle(String(req.query.title), format).catch(() => null);
        }

        if (!metadata) {
            res.status(404).json({ error: 'Anime not found' });
            return;
        }

        res.set('Cache-Control', 'public, max-age=300, s-maxage=86400, stale-while-revalidate=86400');
        res.json(metadata);
    } catch (error: any) {
        res.status(500).json({ error: error?.message || 'Failed to fetch anime metadata' });
    }
});

router.get('/search', async (req, res) => {
    try {
        const filters = streambertAnimeService.parseSearchFilters(req.query);
        if (!filters.query && !filters.season && !filters.seasonYear) {
            res.status(400).json({ error: 'Query parameter query is required unless filters are provided' });
            return;
        }

        const result = await streambertAnimeService.search(filters);
        res.set('Cache-Control', 'public, max-age=120, s-maxage=300, stale-while-revalidate=600');
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error?.message || 'Failed to search anime' });
    }
});

router.get('/episodes', async (req, res) => {
    try {
        const tmdbId = Number(req.query.tmdbId || req.query.id);
        if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
            res.status(400).json({ error: 'Query parameter id is required' });
            return;
        }

        const result = await streambertAnimeService.getEpisodes(Math.floor(tmdbId));
        if (!result) {
            res.status(404).json({ error: 'Anime not found' });
            return;
        }

        res.set('Cache-Control', 'public, max-age=300, s-maxage=86400, stale-while-revalidate=86400');
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error?.message || 'Failed to fetch anime episodes' });
    }
});

router.get('/episode/:episodeId', async (req, res) => {
    try {
        const tmdbId = Number(req.query.tmdbId || req.query.id);
        if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
            res.status(400).json({ error: 'Query parameter id is required' });
            return;
        }

        const result = await streambertAnimeService.getEpisode(Math.floor(tmdbId), req.params.episodeId);
        if (!result) {
            res.status(404).json({ error: 'Episode not found' });
            return;
        }

        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error?.message || 'Failed to fetch anime episode' });
    }
});

router.get('/stream', async (req, res) => {
    try {
        const tmdbId = Number(req.query.tmdbId || req.query.id);
        const episode = Number(req.query.episode || 1);
        const source = String(req.query.source || 'vidsrc');
        const nocache = req.query.nocache === '1' || req.query.nocache === 'true';
        if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
            res.status(400).json({ error: 'Query parameter id is required' });
            return;
        }
        if (!Number.isFinite(episode) || episode <= 0) {
            res.status(400).json({ error: 'Query parameter episode must be a positive number' });
            return;
        }

        const title = req.query.title ? String(req.query.title) : undefined;
        const result = await animeVideoSources.getStream(Math.floor(tmdbId), episode, source, { title, tmdbId: Math.floor(tmdbId) }, nocache);
        if (!result) {
            res.status(404).json({ error: 'No playable stream found' });
            return;
        }

        res.set('Cache-Control', 'public, max-age=60, s-maxage=3600, stale-while-revalidate=3600');
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error?.message || 'Failed to resolve anime stream' });
    }
});

router.get('/trending', async (req, res) => {
    try {
        const page = animeQuery.toPositiveInt(req.query.page, 1, 500);
        const perPage = animeQuery.toPositiveInt(req.query.perPage || req.query.limit, 10, 50);
        const result = await streambertAnimeService.trending(page, perPage);
        res.set('Cache-Control', 'public, max-age=120, s-maxage=300, stale-while-revalidate=600');
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch trending anime' });
    }
});

router.get('/popular', async (req, res) => {
    try {
        const page = animeQuery.toPositiveInt(req.query.page, 1, 500);
        const perPage = animeQuery.toPositiveInt(req.query.perPage || req.query.limit, 10, 50);
        const result = await streambertAnimeService.popular(page, perPage);
        res.set('Cache-Control', 'public, max-age=120, s-maxage=300, stale-while-revalidate=600');
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch popular anime' });
    }
});

router.get('/seasonal', async (req, res) => {
    try {
        const now = new Date();
        const month = now.getMonth() + 1;
        const defaultSeason = month <= 3 ? 'WINTER' : month <= 6 ? 'SPRING' : month <= 9 ? 'SUMMER' : 'FALL';
        const season = String(req.query.season || defaultSeason).toUpperCase();
        const year = animeQuery.toPositiveInt(req.query.year || req.query.seasonYear, now.getFullYear(), 3000);
        const page = animeQuery.toPositiveInt(req.query.page, 1, 500);
        const perPage = animeQuery.toPositiveInt(req.query.perPage || req.query.limit, 10, 50);
        const result = await streambertAnimeService.seasonal(season, year, page, perPage);
        res.set('Cache-Control', 'public, max-age=120, s-maxage=300, stale-while-revalidate=600');
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch seasonal anime' });
    }
});

router.get('/mappings', async (req, res) => {
    try {
        const anilistId = Number(req.query.anilistId);
        const tmdbId = Number(req.query.tmdbId);
        const mediaType = String(req.query.mediaType || 'tv').toLowerCase();

        let mappings;
        if (Number.isInteger(anilistId) && anilistId > 0) {
            const mapping = await animeMappingService.getByAniListId(anilistId);
            mappings = mapping ? [mapping] : [];
        } else if (Number.isInteger(tmdbId) && tmdbId > 0) {
            mappings = mediaType === 'movie'
                ? await animeMappingService.getByTmdbMovieId(tmdbId)
                : await animeMappingService.getByTmdbShowId(tmdbId);
        } else {
            res.status(400).json({ error: 'anilistId or tmdbId is required' });
            return;
        }

        res.set('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
        res.json({ mappings });
    } catch (error: any) {
        console.error('[anime-mapping] Resolution failed', error);
        res.status(503).json({ error: error?.message || 'Anime mapping dataset unavailable', mappings: [] });
    }
});

router.get('/genre/:genre', async (req, res) => {
    try {
        const page = animeQuery.toPositiveInt(req.query.page, 1, 500);
        const perPage = animeQuery.toPositiveInt(req.query.perPage || req.query.limit, 24, 50);
        const result = await streambertAnimeService.genre(req.params.genre, page, perPage);
        res.set('Cache-Control', 'public, max-age=300, s-maxage=1800, stale-while-revalidate=3600');
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error?.message || 'Failed to fetch anime genre' });
    }
});

let animeHomeFastMemoryCache: { data: any; timestamp: number } | null = null;
const ANIME_HOME_FAST_TTL_MS = 2 * 60 * 1000;

router.get('/home-fast', async (_req, res) => {
    try {
        if (animeHomeFastMemoryCache && Date.now() - animeHomeFastMemoryCache.timestamp < ANIME_HOME_FAST_TTL_MS) {
            res.set('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=300');
            res.json(animeHomeFastMemoryCache.data);
            return;
        }

        const now = new Date();
        const month = now.getMonth() + 1;
        const season = month <= 3 ? 'WINTER' : month <= 6 ? 'SPRING' : month <= 9 ? 'SUMMER' : 'FALL';
        const year = now.getFullYear();

        const [trending, seasonal, popular] = await Promise.all([
            streambertAnimeService.trending(1, 30).catch(() => ({ media: [] })),
            streambertAnimeService.seasonal(season, year, 1, 24).catch(() => ({ media: [] })),
            streambertAnimeService.popular(1, 24).catch(() => ({ media: [] })),
        ]);

        const trendingMedia = trending.media || [];
        const seasonalMedia = seasonal.media || [];
        const popularMedia = popular.media || [];
        const payload = {
            spotlight: trendingMedia.slice(0, 8),
            latestEpisodes: [],
            trending: { ...trending, media: trendingMedia },
            seasonal: { ...seasonal, media: seasonalMedia },
            monthly: { ...popular, media: popularMedia },
            topAnime: { ...popular, media: popularMedia },
            topTen: {
                day: trendingMedia.slice(0, 10),
                week: seasonalMedia.slice(0, 10),
                month: popularMedia.slice(0, 10),
                allTime: popularMedia.slice(0, 10),
            },
            generatedAt: Date.now(),
        };

        animeHomeFastMemoryCache = { data: payload, timestamp: Date.now() };
        res.set('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=300');
        res.json(payload);
    } catch (error) {
        console.error('Error in anime home-fast route:', error);
        res.status(500).json({ error: 'Failed to fetch home bundle' });
    }
});

export default router;

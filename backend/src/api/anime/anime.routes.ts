import { Router } from 'express';
import { animeQuery, streambertAnimeService } from './anime.service';
import { animeVideoSources } from './video-sources';

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
        const tmdbId = Number(req.query.tmdbId || req.query.id);
        if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
            res.status(400).json({ error: 'Query parameter id is required' });
            return;
        }

        const format = req.query.format ? String(req.query.format).toUpperCase() : undefined;
        const metadata = await streambertAnimeService.getMetadata(Math.floor(tmdbId), format);
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
    const page = animeQuery.toPositiveInt(req.query.page, 1, 500);
    const perPage = animeQuery.toPositiveInt(req.query.perPage || req.query.limit, 10, 50);
    const result = await streambertAnimeService.trending(page, perPage);
    res.json(result);
});

router.get('/popular', async (req, res) => {
    const page = animeQuery.toPositiveInt(req.query.page, 1, 500);
    const perPage = animeQuery.toPositiveInt(req.query.perPage || req.query.limit, 10, 50);
    const result = await streambertAnimeService.popular(page, perPage);
    res.json(result);
});

router.get('/seasonal', async (req, res) => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const defaultSeason = month <= 3 ? 'WINTER' : month <= 6 ? 'SPRING' : month <= 9 ? 'SUMMER' : 'FALL';
    const season = String(req.query.season || defaultSeason).toUpperCase();
    const year = animeQuery.toPositiveInt(req.query.year || req.query.seasonYear, now.getFullYear(), 3000);
    const page = animeQuery.toPositiveInt(req.query.page, 1, 500);
    const perPage = animeQuery.toPositiveInt(req.query.perPage || req.query.limit, 10, 50);
    const result = await streambertAnimeService.seasonal(season, year, page, perPage);
    res.json(result);
});

router.get('/home-fast', async (_req, res) => {
    try {
        const now = new Date();
        const month = now.getMonth() + 1;
        const season = month <= 3 ? 'WINTER' : month <= 6 ? 'SPRING' : month <= 9 ? 'SUMMER' : 'FALL';
        const year = now.getFullYear();

        const [trending, seasonal, popular] = await Promise.all([
            streambertAnimeService.trending(1, 10).catch(() => ({ media: [] })),
            streambertAnimeService.seasonal(season, year, 1, 10).catch(() => ({ media: [] })),
            streambertAnimeService.popular(1, 18).catch(() => ({ media: [] })),
        ]);

        const payload = {
            spotlight: trending.media.slice(0, 8),
            latestEpisodes: [], // Scraper updates can be skipped or added later
            trending: trending,
            seasonal: seasonal,
            monthly: popular,
            topAnime: popular,
            topTen: {
                day: trending.media,
                week: seasonal.media,
                month: popular.media,
            },
            generatedAt: Date.now(),
        };

        res.set('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=300');
        res.json(payload);
    } catch (error) {
        console.error('Error in anime home-fast route:', error);
        res.status(500).json({ error: 'Failed to fetch home bundle' });
    }
});

export default router;

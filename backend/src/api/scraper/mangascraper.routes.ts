import { Router, Request, Response } from 'express';
import * as mangaService from './manga.service';

const router = Router();

/**
 * Search for manga (Unified)
 * GET /api/manga/search?q=query
 */
router.get('/search', async (req: Request, res: Response) => {
    try {
        const query = req.query.q as string;

        if (!query) {
            res.status(400).json({ error: 'Query parameter "q" is required' });
            return;
        }

        const results = await mangaService.searchManga(query);
        res.json({ data: results });
    } catch (error) {
        console.error('Manga search error:', error);
        res.status(500).json({ error: 'Failed to search manga' });
    }
});

/**
 * Get manga details (Unified)
 * GET /api/manga/details/:mangaId
 */
router.get('/details/:mangaId', async (req: Request, res: Response) => {
    try {
        const { mangaId } = req.params;

        if (!mangaId) {
            res.status(400).json({ error: 'mangaId is required' });
            return;
        }

        const includeChapters = ['1', 'true', 'yes'].includes(String(req.query.includeChapters || '').toLowerCase());

        if (includeChapters) {
            const payload = await mangaService.getMangaDetailsWithChapters(mangaId);
            res.set('Cache-Control', payload.scraperId && payload.chapters.length > 0
                ? 'public, max-age=60, s-maxage=180, stale-while-revalidate=600'
                : 'no-store');
            res.json({
                data: payload.details,
                chapters: payload.chapters,
                scraperId: payload.scraperId,
            });
            return;
        }

        const details = await mangaService.getMangaDetails(mangaId);
        res.set('Cache-Control', 'public, max-age=60, s-maxage=180, stale-while-revalidate=600');
        res.json({ data: details });
    } catch (error) {
        console.error('Manga details error:', error);
        res.status(500).json({ error: 'Failed to fetch manga details' });
    }
});

/**
 * Get chapter list for a manga (Unified)
 * GET /api/manga/chapters/:mangaId
 */
router.get('/chapters/:mangaId', async (req: Request, res: Response) => {
    try {
        const { mangaId } = req.params;

        if (!mangaId) {
            res.status(400).json({ error: 'mangaId is required' });
            return;
        }

        const chapters = await mangaService.getChapterList(mangaId);
        res.json({ chapters: chapters });
    } catch (error) {
        console.error('Chapters list error:', error);
        res.status(500).json({ error: 'Failed to fetch chapter list' });
    }
});

/**
 * Get pages for a chapter (Unified)
 * GET /api/manga/pages?url=chapterUrl
 */
router.get('/pages', async (req: Request, res: Response) => {
    try {
        const chapterUrl = req.query.url as string;

        if (!chapterUrl) {
            res.status(400).json({ error: 'Query parameter "url" is required' });
            return;
        }

        const pages = await mangaService.getChapterPages(chapterUrl);
        res.json({ pages: pages });
    } catch (error) {
        console.error('Chapter pages error:', error);
        res.status(500).json({ error: 'Failed to fetch chapter pages' });
    }
});

/**
 * Prefetch chapters (Cache Warming)
 * POST /api/manga/prefetch
 * Body: { urls: string[] }
 */
router.post('/prefetch', async (req: Request, res: Response) => {
    try {
        const { urls } = req.body;
        if (!urls || !Array.isArray(urls)) {
            return res.status(400).json({ error: 'Invalid URLs array' });
        }

        const result = await mangaService.prefetchChapters(urls);
        res.json(result);
    } catch (error) {
        console.error('Prefetch error:', error);
        res.status(500).json({ error: 'Failed to prefetch chapters' });
    }
});

/**
 * Get hot updates (MangaKatana)
 * GET /api/manga/hot-updates
 */
router.get('/hot-updates', async (req: Request, res: Response) => {
    try {
        const updates = await mangaService.getHotUpdates();
        res.json({ data: updates });
    } catch (error) {
        console.error('Hot updates error:', error);
        res.status(500).json({ error: 'Failed to fetch hot updates' });
    }
});

/**
 * Get Enriched Spotlight (AniList + MangaKatana Chapters)
 * GET /api/manga/spotlight
 */
router.get('/spotlight', async (req: Request, res: Response) => {
    try {
        const spotlight = await mangaService.getEnrichedSpotlight();
        res.json({ data: spotlight });
    } catch (error) {
        console.error('Spotlight error:', error);
        res.status(500).json({ error: 'Failed to fetch spotlight' });
    }
});

/**
 * Get latest manga (MangaKatana /latest)
 */
router.get('/latest', async (req: Request, res: Response) => {
    try {
        const page = req.query.page ? parseInt(req.query.page as string) : 1;
        const results = await mangaService.getLatestManga(page);
        res.json({ data: results.data, pagination: { total_pages: results.totalPages } });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch latest manga' });
    }
});

/**
 * Get new manga (MangaKatana /new-manga)
 */
router.get('/new-manga', async (req: Request, res: Response) => {
    try {
        const page = req.query.page ? parseInt(req.query.page as string) : 1;
        const results = await mangaService.getNewManga(page);
        res.json({ data: results.data, pagination: { total_pages: results.totalPages } });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch new manga' });
    }
});

/**
 * Get manga directory (MangaKatana /manga)
 */
router.get('/directory', async (req: Request, res: Response) => {
    try {
        const page = req.query.page ? parseInt(req.query.page as string) : 1;
        const results = await mangaService.getMangaDirectory(page);
        res.json({ data: results.data, pagination: { total_pages: results.totalPages } });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch manga directory' });
    }
});

export default router;

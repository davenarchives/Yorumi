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

        const details = await mangaService.getMangaDetails(mangaId);
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

export default router;

import { Router, Request, Response } from 'express';
import * as mangakatana from '../../scraper/mangakatana';

const router = Router();

/**
 * Search for manga
 * GET /api/manga/search?q=query
 */
router.get('/search', async (req: Request, res: Response) => {
    try {
        const query = req.query.q as string;

        if (!query) {
            res.status(400).json({ error: 'Query parameter "q" is required' });
            return;
        }

        const results = await mangakatana.searchManga(query);
        res.json({ data: results });
    } catch (error) {
        console.error('Manga search error:', error);
        res.status(500).json({ error: 'Failed to search manga' });
    }
});

/**
 * Get manga details
 * GET /api/manga/details/:mangaId
 */
router.get('/details/:mangaId', async (req: Request, res: Response) => {
    try {
        const { mangaId } = req.params;

        if (!mangaId) {
            res.status(400).json({ error: 'mangaId is required' });
            return;
        }

        const details = await mangakatana.getMangaDetails(mangaId);
        res.json({ data: details });
    } catch (error) {
        console.error('Manga details error:', error);
        res.status(500).json({ error: 'Failed to fetch manga details' });
    }
});

/**
 * Get chapter list for a manga
 * GET /api/manga/chapters/:mangaId
 */
router.get('/chapters/:mangaId', async (req: Request, res: Response) => {
    try {
        const { mangaId } = req.params;

        if (!mangaId) {
            res.status(400).json({ error: 'mangaId is required' });
            return;
        }

        const chapters = await mangakatana.getChapterList(mangaId);
        res.json({ data: chapters });
    } catch (error) {
        console.error('Chapters list error:', error);
        res.status(500).json({ error: 'Failed to fetch chapter list' });
    }
});

/**
 * Get pages for a chapter
 * GET /api/manga/pages?url=chapterUrl
 */
router.get('/pages', async (req: Request, res: Response) => {
    try {
        const chapterUrl = req.query.url as string;

        if (!chapterUrl) {
            res.status(400).json({ error: 'Query parameter "url" is required' });
            return;
        }

        const pages = await mangakatana.getChapterPages(chapterUrl);
        res.json({ data: pages });
    } catch (error) {
        console.error('Chapter pages error:', error);
        res.status(500).json({ error: 'Failed to fetch chapter pages' });
    }
});

export default router;

import { Router, Request, Response } from 'express';
import * as jikanService from './jikan.service';

const router = Router();

router.get('/search', async (req: Request, res: Response) => {
    try {
        const query = req.query.q as string;
        const page = req.query.page ? parseInt(req.query.page as string) : 1;
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 24;

        if (!query) {
            res.status(400).json({ error: 'Query parameter "q" is required' });
            return;
        }

        const data = await jikanService.searchAnime(query, page, limit);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/anime/:id', async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            res.status(400).json({ error: 'Invalid ID' });
            return;
        }

        const data = await jikanService.getAnimeById(id);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/manga/:id', async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            res.status(400).json({ error: 'Invalid ID' });
            return;
        }

        const data = await jikanService.getMangaById(id);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/top', async (req: Request, res: Response) => {
    try {
        const page = req.query.page ? parseInt(req.query.page as string) : 1;
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 24;
        const data = await jikanService.getTopAnime(page, limit);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/top/manga', async (req: Request, res: Response) => {
    try {
        const page = req.query.page ? parseInt(req.query.page as string) : 1;
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 24;
        const data = await jikanService.getTopManga(page, limit);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/search/manga', async (req: Request, res: Response) => {
    try {
        const query = req.query.q as string;
        const page = req.query.page ? parseInt(req.query.page as string) : 1;
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 24;

        if (!query) {
            res.status(400).json({ error: 'Query parameter "q" is required' });
            return;
        }

        const data = await jikanService.searchManga(query, page, limit);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;

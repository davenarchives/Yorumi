import { Router, Request, Response } from 'express';
import * as jikanService from '../services/jikanService';

const router = Router();

router.get('/search', async (req: Request, res: Response) => {
    try {
        const query = req.query.q as string;
        const page = req.query.page ? parseInt(req.query.page as string) : 1;

        if (!query) {
            res.status(400).json({ error: 'Query parameter "q" is required' });
            return;
        }

        const data = await jikanService.searchAnime(query, page);
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

router.get('/top', async (req: Request, res: Response) => {
    try {
        const page = req.query.page ? parseInt(req.query.page as string) : 1;
        const data = await jikanService.getTopAnime(page);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;

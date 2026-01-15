import { Router } from 'express';
import { jikanService } from './jikan.service';

const router = Router();

router.get('/episodes/:malId', async (req, res) => {
    try {
        const malId = parseInt(req.params.malId);
        if (isNaN(malId)) {
            return res.status(400).json({ error: 'Invalid MAL ID' });
        }

        const episodes = await jikanService.getAnimeEpisodes(malId);
        res.json(episodes);
    } catch (error) {
        console.error('Error in Jikan route:', error);
        res.status(500).json({ error: 'Failed to fetch Jikan episodes' });
    }
});

export default router;

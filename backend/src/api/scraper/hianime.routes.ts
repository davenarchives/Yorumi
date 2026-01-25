import { Router } from 'express';
import { HiAnimeScraper } from './hianime.service';
import { anilistService } from '../anilist/anilist.service';
import { redis } from '../mapping/mapper';

const router = Router();
const scraper = new HiAnimeScraper();

router.get('/spotlight', async (req, res) => {
    try {
        const result = await scraper.getEnrichedSpotlight();
        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch spotlight anime' });
    }
});

router.get('/az-list/:letter', async (req, res) => {
    try {
        const letter = req.params.letter;
        const page = req.query.page ? parseInt(req.query.page as string) : 1;
        const data = await scraper.getAZList(letter, page);
        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch A-Z list' });
    }
});

export default router;

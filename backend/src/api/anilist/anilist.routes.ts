import { Router } from 'express';
import { anilistService } from './anilist.service';

const router = Router();

// Get top/popular anime
router.get('/top', async (req, res) => {
    try {
        const page = req.query.page ? parseInt(req.query.page as string) : 1;
        const perPage = req.query.limit ? parseInt(req.query.limit as string) : 24;

        const data = await anilistService.getTopAnime(page, perPage);
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

// Get top/popular manga (by SCORE)
router.get('/top/manga', async (req, res) => {
    try {
        const page = req.query.page ? parseInt(req.query.page as string) : 1;
        const perPage = req.query.limit ? parseInt(req.query.limit as string) : 24;

        const data = await anilistService.getTopManga(page, perPage);
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

        const data = await anilistService.getPopularManga(page, perPage);
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

        const data = await anilistService.getPopularManhwa(page, perPage);
        res.json(data);
    } catch (error) {
        console.error('Error in top manhwa route:', error);
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

        const data = await anilistService.getTrendingManga(page, perPage);
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

// Get anime by ID
router.get('/anime/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            res.status(400).json({ error: 'Invalid ID' });
            return;
        }

        const data = await anilistService.getAnimeById(id);
        if (!data) {
            res.status(404).json({ error: 'Anime not found' });
            return;
        }
        res.json(data);
    } catch (error) {
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

export default router;



import { Router } from 'express';
import { lnService } from './ln.service';

const router = Router();

// Search novels across sources
router.get('/search', async (req, res) => {
    try {
        const query = String(req.query.q || '').trim();
        if (!query) {
            return res.status(400).json({ success: false, error: 'Query parameter q is required' });
        }
        const results = await lnService.searchNovels(query);
        return res.json({ success: true, data: results });
    } catch (error: any) {
        console.error('[LN Routes] Search error:', error);
        return res.status(500).json({ success: false, error: error?.message || 'Search failed' });
    }
});

// Resolve AniList title candidates to scraper ID
router.post('/resolve', async (req, res) => {
    try {
        const titles = req.body?.titles;
        if (!Array.isArray(titles) || titles.length === 0) {
            return res.status(400).json({ success: false, error: 'Array of titles is required' });
        }
        const scraperId = await lnService.resolveNovel(titles);
        return res.json({ success: true, scraperId });
    } catch (error: any) {
        console.error('[LN Routes] Resolve error:', error);
        return res.status(500).json({ success: false, error: error?.message || 'Resolution failed' });
    }
});

// Get novel details and chapter list
router.get('/details/:id(*)', async (req, res) => {
    try {
        const id = req.params.id;
        if (!id) {
            return res.status(400).json({ success: false, error: 'Novel ID is required' });
        }
        const details = await lnService.getNovelDetails(id);
        if (!details) {
            return res.status(404).json({ success: false, error: 'Novel details not found' });
        }
        return res.json({ success: true, data: details });
    } catch (error: any) {
        console.error('[LN Routes] Details error:', error);
        return res.status(500).json({ success: false, error: error?.message || 'Failed to fetch details' });
    }
});

// Read chapter content
router.get('/read/:chapterId(*)', async (req, res) => {
    try {
        const chapterId = req.params.chapterId;
        if (!chapterId) {
            return res.status(400).json({ success: false, error: 'Chapter ID is required' });
        }
        const content = await lnService.getChapterContent(chapterId);
        if (!content) {
            return res.status(404).json({ success: false, error: 'Chapter content not found' });
        }
        return res.json({ success: true, data: content });
    } catch (error: any) {
        console.error('[LN Routes] Read error:', error);
        return res.status(500).json({ success: false, error: error?.message || 'Failed to fetch chapter' });
    }
});

export default router;

import { Router } from 'express';
import { HiAnimeScraper } from './hianime.service';
import { anilistService } from '../anilist/anilist.service';

const router = Router();
const scraper = new HiAnimeScraper();

router.get('/spotlight', async (req, res) => {
    try {
        const spotlightItems = await scraper.getSpotlightAnime();
        const enrichedItems = [];

        // Enrich with AniList data (sequentially to respect rate limits)
        for (const item of spotlightItems) {
            try {
                // Search AniList by title
                const searchResult = await anilistService.searchAnime(item.title, 1, 1);
                const anilistMedia = searchResult?.media?.[0];

                if (anilistMedia) {
                    enrichedItems.push({
                        ...item,
                        id: anilistMedia.id,         // AniList ID
                        mal_id: anilistMedia.idMal,  // MAL ID (used for routing)
                        anilist: anilistMedia        // Full AniList object if needed
                    });
                } else {
                    // Keep item even if not found in AniList? 
                    // Maybe skip or keep with generated ID?
                    // Better to keep so we show the high-res image even if clicking is broken?
                    // No, clicking must work. If no AniList ID, we can't route to /anime/:id easily.
                    // We'll skip for now to ensure quality.
                    console.warn(`Could not find AniList match for: ${item.title}`);
                }
            } catch (err) {
                console.error(`Failed to enrich item: ${item.title}`, err);
            }
        }

        res.json({ spotlight: enrichedItems });
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

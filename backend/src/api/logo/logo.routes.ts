import { Router } from 'express';
import { getAnimeLogo } from './fanart.service';

const router = Router();

/**
 * GET /api/logo/:anilistId
 * Fetch anime logo by AniList ID
 */
router.get('/:anilistId', async (req, res) => {
    try {
        const anilistId = parseInt(req.params.anilistId);

        if (isNaN(anilistId)) {
            return res.status(400).json({
                error: 'Invalid AniList ID',
                logo: null,
                source: 'fallback'
            });
        }

        const result = await getAnimeLogo(anilistId);

        res.json(result);
    } catch (error) {
        console.error('[Logo API] Error:', error);
        res.status(500).json({
            error: 'Failed to fetch logo',
            logo: null,
            source: 'fallback',
            cached: false
        });
    }
});

export default router;

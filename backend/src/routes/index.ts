import { Router } from 'express';
import animeRoutes from '../api/anime/anime.routes';
import anilistRoutes from '../api/anilist/anilist.routes';
import yumiChatRoutes from '../api/chat/yumi.routes';
import imageRoutes from '../api/image/image.routes';
import importRoutes from '../api/import/import.routes';
import logoRoutes from '../api/logo/logo.routes';
import legacyMangaRoutes from '../api/scraper/mangascraper.routes';
import lnRoutes from '../api/scraper/lnscraper.routes';
import legacyScraperRoutes from '../api/scraper/scraper.routes';
import userRoutes from '../api/user/user.routes';
import avatarRoutes from '../modules/avatar/avatar.routes';
import mappingRoutes from '../modules/mapping/mapping.routes';

const router = Router();

router.get('/', (_req, res) => {
    res.json({
        success: true,
        data: {
            message: 'Yorumi API is running',
            endpoints: {
                scraper: '/api/scraper',
                animePaheSearch: '/api/scraper/search/animepahe?q=naruto',
            },
        },
    });
});

router.use('/anilist', anilistRoutes);
router.use('/anime', animeRoutes);
router.use('/chat', yumiChatRoutes);
router.use('/scraper', legacyScraperRoutes);
router.use('/manga', legacyMangaRoutes);
router.use('/ln', lnRoutes);
router.use('/logo', logoRoutes);
router.use('/image', imageRoutes);
router.use('/import', importRoutes);
router.use('/user', userRoutes);
router.use('/mapping', mappingRoutes);
router.use('/avatars', avatarRoutes);
export default router;

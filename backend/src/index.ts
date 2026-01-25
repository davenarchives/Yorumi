import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import scraperRoutes from './api/scraper/scraper.routes';
import mangaScraperRoutes from './api/scraper/mangascraper.routes';
import anilistRoutes from './api/anilist/anilist.routes';
import hianimeRoutes from './api/scraper/hianime.routes';
import { HiAnimeScraper } from './api/scraper/hianime.service';
import logoRoutes from './api/logo/logo.routes';

const app = express();
const port = process.env.PORT || 3001;

// Background Jobs
const hianimeScraper = new HiAnimeScraper();

const runBackgroundJobs = async () => {
    // 1. Warm Spotlight Cache
    console.log('🔥 Warming Spotlight Cache...');
    hianimeScraper.getEnrichedSpotlight()
        .then(() => console.log('✅ Spotlight Cache Warm'))
        .catch(err => console.error('❌ Failed to warm spotlight cache:', err));
};

// Start jobs immediately
runBackgroundJobs();

// Refresh Spotlight every 12 hours
setInterval(() => {
    console.log('⏰ Running Scheduled Spotlight Update...');
    hianimeScraper.getEnrichedSpotlight();
}, 12 * 60 * 60 * 1000);

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/anilist', anilistRoutes);
app.use('/api/scraper', scraperRoutes);
app.use('/api/manga', mangaScraperRoutes);
app.use('/api/hianime', hianimeRoutes);
app.use('/api/logo', logoRoutes);

import userRoutes from './api/user/user.routes';
app.use('/api/user', userRoutes);

import { mappingService } from './api/mapping/mapping.service';
import { getAniListId } from './api/mapping/mapper';

// Mapping Routes
app.get('/api/mapping/:id', async (req, res) => {
    const mapping = await mappingService.getMapping(req.params.id);
    if (mapping) {
        res.json(mapping);
    } else {
        res.status(404).json({ message: 'Mapping not found' });
    }
});

app.post('/api/mapping', async (req, res) => {
    const { anilistId, scraperId, title } = req.body;
    if (!anilistId || !scraperId) {
        return res.status(400).json({ message: 'Missing anilistId or scraperId' });
    }
    const success = await mappingService.saveMapping(anilistId, scraperId, title);
    if (success) {
        res.json({ success: true });
    } else {
        res.status(500).json({ message: 'Failed to save mapping' });
    }
});

app.delete('/api/mapping/:id', async (req, res) => {
    const success = await mappingService.deleteMapping(req.params.id);
    if (success) {
        res.json({ success: true, deleted: req.params.id });
    } else {
        res.status(500).json({ message: 'Failed to delete mapping' });
    }
});

app.post('/api/mapping/identify', async (req, res) => {
    const { slug, title } = req.body;
    if (!slug || !title) {
        return res.status(400).json({ message: 'Missing slug or title' });
    }
    const anilistId = await getAniListId(slug, title);
    if (anilistId) {
        res.json({ anilistId });
    } else {
        res.status(404).json({ message: 'AniList ID not found' });
    }
});

// Serve avatars
import path from 'path';
import fs from 'fs';

const avatarsDir = path.join(__dirname, '../avatars');
app.use('/avatars', express.static(avatarsDir));

// Helper to get all files recursively
const getFilesRecursively = (dir: string): string[] => {
    let results: string[] = [];
    const list = fs.readdirSync(dir);
    list.forEach((file) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            results = results.concat(getFilesRecursively(filePath));
        } else {
            // Only add image files
            if (/\.(png|jpg|jpeg|gif|webp)$/i.test(file)) {
                results.push(path.relative(avatarsDir, filePath).replace(/\\/g, '/'));
            }
        }
    });
    return results;
};

app.get('/api/avatars/random', (req, res) => {
    try {
        const files = getFilesRecursively(avatarsDir);
        if (files.length === 0) {
            return res.status(404).json({ message: 'No avatars found' });
        }
        const randomFile = files[Math.floor(Math.random() * files.length)];
        const protocol = req.protocol;
        const host = req.get('host');
        const fullUrl = `${protocol}://${host}/avatars/${randomFile}`;
        res.json({ url: fullUrl });
    } catch (error) {
        console.error('Error getting random avatar:', error);
        res.status(500).json({ message: 'Failed to get random avatar' });
    }
});


app.get('/', (req, res) => {
    res.send('Yorumi Backend is running');
});

import { warmSpotlightCache } from './api/scraper/manga.service';
import { warmupAnimeDatabase } from './api/logo/fanart.service';

if (process.env.NODE_ENV !== 'production' || process.env.IS_ELECTRON) {
    app.listen(port, () => {
        console.log(`Server is running on http://localhost:${port}`);
        // Pre-warm caches
        warmSpotlightCache();
        warmupAnimeDatabase();
    });
}

export default app;

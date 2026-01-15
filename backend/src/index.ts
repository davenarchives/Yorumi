import express from 'express';
import cors from 'cors';
import scraperRoutes from './api/scraper/scraper.routes';
import mangaScraperRoutes from './api/scraper/mangascraper.routes';
import anilistRoutes from './api/anilist/anilist.routes';
import hianimeRoutes from './api/scraper/hianime.routes';
import jikanRoutes from './api/jikan/jikan.routes';

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/anilist', anilistRoutes);
app.use('/api/scraper', scraperRoutes);
app.use('/api/manga', mangaScraperRoutes);
app.use('/api/hianime', hianimeRoutes);
app.use('/api/jikan', jikanRoutes);

app.get('/', (req, res) => {
    res.send('Yorumi Backend is running');
});

if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`Server is running on http://localhost:${port}`);
    });
}

export default app;

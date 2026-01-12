import express from 'express';
import cors from 'cors';
import jikanRoutes from './api/jikan/jikan.routes';
import scraperRoutes from './api/scraper/scraper.routes';
import mangaScraperRoutes from './api/scraper/mangascraper.routes';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/jikan', jikanRoutes);
app.use('/api/scraper', scraperRoutes);
app.use('/api/manga', mangaScraperRoutes);

app.get('/', (req, res) => {
    res.send('Yorumi Backend is running');
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

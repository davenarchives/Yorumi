import app from './app';
import { warmSpotlightCache } from './api/scraper/manga.service';
import { startScraperWarmer } from './api/scraper/scraper-warmer';
import { logger } from './core/logger';

const port = process.env.PORT || 3001;
const vercelEnv = String(process.env.VERCEL || '').trim().toLowerCase();
const shouldRunStandaloneServer = vercelEnv !== '1' && vercelEnv !== 'true';

if (shouldRunStandaloneServer) {
    const startServer = async () => {
        logger.info('Starting Yorumi backend server');

        const server = app.listen(port, () => {
            logger.info(`Server is running on http://localhost:${port}`);
        });

        server.on('error', (err: any) => {
            if (err.code === 'EADDRINUSE') {
                logger.warn(`Port ${port} is already in use. Yorumi backend may already be running.`);
            } else {
                logger.error('Backend server error:', err);
            }
        });

        startScraperWarmer();

        try {
            await warmSpotlightCache();
        } catch (error) {
            logger.warn('Secondary cache warming failed', error);
        }
    };

    startServer();
}

export default app;

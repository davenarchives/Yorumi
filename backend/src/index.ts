import app from './app';
import { warmSpotlightCache } from './api/scraper/manga.service';
import { startScraperWarmer } from './api/scraper/scraper-warmer';
import { logger } from './core/logger';
import fs from 'node:fs';
import path from 'node:path';

const port = process.env.PORT || 3001;
const vercelEnv = String(process.env.VERCEL || '').trim().toLowerCase();
const shouldRunStandaloneServer = vercelEnv !== '1' && vercelEnv !== 'true';

const cleanupIncompleteElectronDownloads = () => {
    const configuredUserDataDir = String(process.env.YORUMI_USER_DATA_DIR || '').trim();
    if (!configuredUserDataDir) return;

    const userDataDir = path.resolve(configuredUserDataDir);
    const downloadsDir = path.resolve(userDataDir, 'downloads');
    if (!downloadsDir.startsWith(`${userDataDir}${path.sep}`) || !fs.existsSync(downloadsDir)) return;

    const visit = (directory: string) => {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const entryPath = path.resolve(directory, entry.name);
            if (!entryPath.startsWith(`${downloadsDir}${path.sep}`)) continue;
            if (entry.isDirectory()) {
                visit(entryPath);
            } else if (entry.isFile() && /\.tmp(?:\.ts)?$/i.test(entry.name)) {
                fs.unlinkSync(entryPath);
            }
        }
    };

    try {
        visit(downloadsDir);
    } catch (error) {
        logger.warn('Failed to clean incomplete Electron downloads', error);
    }
};

if (shouldRunStandaloneServer) {
    const startServer = async () => {
        cleanupIncompleteElectronDownloads();
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

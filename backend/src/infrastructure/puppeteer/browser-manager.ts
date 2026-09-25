import type { Browser } from 'puppeteer-core';
import { logger } from '../../core/logger';
import fs from 'fs';

let browserInstance: Browser | null = null;
let browserLaunchPromise: Promise<Browser> | null = null;

const launchBrowser = async (): Promise<Browser> => {
    const isServerless = process.env.VERCEL === '1' || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

    if (isServerless) {
        logger.info('Launching shared serverless Chromium instance');

        const chromiumModule = await import('@sparticuz/chromium') as Record<string, unknown>;
        const puppeteerModule = await import('puppeteer-core') as Record<string, unknown>;
        const chromium = (chromiumModule.default || chromiumModule) as any;
        const puppeteer = (puppeteerModule.default || puppeteerModule) as any;

        return puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
        }) as Promise<Browser>;
    }

    logger.info('Launching shared local Puppeteer instance');

    // Keep these specifiers literal so esbuild can discover and include the
    // scraper runtime in the standalone backend bundle used by Electron.
    // Computed imports work in development because backend/node_modules is
    // present, but fail in packaged apps where node_modules is intentionally
    // excluded.
    const localPuppeteerModule = await import('puppeteer-extra') as Record<string, unknown>;
    const stealthPluginModule = await import('puppeteer-extra-plugin-stealth') as Record<string, unknown>;
    const localPuppeteer = (localPuppeteerModule.default || localPuppeteerModule) as any;
    const StealthPlugin = (stealthPluginModule.default || stealthPluginModule) as any;

    localPuppeteer.use(StealthPlugin());

    const getSystemBrowserPath = () => {
        if (process.platform === 'win32') {
            const paths = [
                'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
                'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
                'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
            ];
            for (const p of paths) {
                if (fs.existsSync(p)) return p;
            }
        } else if (process.platform === 'darwin') {
            return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
        } else if (process.platform === 'linux') {
            return '/usr/bin/google-chrome';
        }
        return undefined;
    };

    return localPuppeteer.launch({
        headless: true,
        executablePath: getSystemBrowserPath(),
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
        ],
    }) as Promise<Browser>;
};

const attachLifecycleHandlers = (browser: Browser) => {
    browser.on('disconnected', () => {
        browserInstance = null;
        browserLaunchPromise = null;
        logger.warn('Shared browser instance disconnected');
    });
};

export const getManagedBrowser = async (): Promise<Browser> => {
    if (browserInstance?.isConnected()) {
        return browserInstance;
    }

    if (!browserLaunchPromise) {
        browserLaunchPromise = launchBrowser()
            .then((browser) => {
                browserInstance = browser;
                attachLifecycleHandlers(browser);
                return browser;
            })
            .finally(() => {
                browserLaunchPromise = null;
            });
    }

    return browserLaunchPromise;
};

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

    const localPuppeteerPackage = 'puppeteer-extra';
    const stealthPluginPackage = 'puppeteer-extra-plugin-stealth';
    const localPuppeteerModule = await import(localPuppeteerPackage) as Record<string, unknown>;
    const stealthPluginModule = await import(stealthPluginPackage) as Record<string, unknown>;
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

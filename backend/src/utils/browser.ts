import { Browser } from 'puppeteer-core';

export const getBrowserInstance = async (): Promise<Browser> => {
    let browser: Browser;

    // Check if we are running locally or on Vercel
    const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

    if (isProduction) {
        console.log('Launching Serverless Chromium...');

        // Use dynamic imports to work in both ESM/CJS and avoiding explicit require
        const chromiumModule = await import('@sparticuz/chromium') as any;
        const puppeteerModule = await import('puppeteer-core') as any;

        // Handle default exports depending on bundler/module type
        const chromium = chromiumModule.default || chromiumModule;
        const puppeteer = puppeteerModule.default || puppeteerModule;

        browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
        }) as unknown as Browser;
    } else {
        console.log('Launching Local Puppeteer...');
        // Dynamic import to avoid bundling puppeteer in production
        const localPuppeteerModule = await import('puppeteer') as any;
        const localPuppeteer = localPuppeteerModule.default || localPuppeteerModule;

        browser = await localPuppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        }) as unknown as Browser;
    }

    return browser;
};

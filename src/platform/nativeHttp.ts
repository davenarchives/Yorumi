import { CapacitorHttp } from '@capacitor/core';
import { isNativeMobile } from './runtime';
import { createLocalMediaProxyUrl } from './localMediaProxy';

const DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.7',
};

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
let novelBinRequestQueue: Promise<void> = Promise.resolve();
let lastNovelBinRequestAt = 0;

const scheduleNativeRequest = async <T>(url: string, request: () => Promise<T>): Promise<T> => {
    if (!new URL(url).hostname.endsWith('novel-bin.com')) return request();

    const previous = novelBinRequestQueue;
    let release!: () => void;
    novelBinRequestQueue = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
        const delay = Math.max(0, 650 - (Date.now() - lastNovelBinRequestAt));
        if (delay) await sleep(delay);
        lastNovelBinRequestAt = Date.now();
        return await request();
    } finally {
        release();
    }
};

export const getText = async (url: string, headers: Record<string, string> = {}) => {
    if (isNativeMobile()) {
        try {
            let response;
            for (let attempt = 0; attempt < 3; attempt += 1) {
                response = await scheduleNativeRequest(url, () => CapacitorHttp.get({
                    url,
                    headers: { ...DEFAULT_HEADERS, ...headers },
                    connectTimeout: 15_000,
                    readTimeout: 20_000,
                    responseType: 'text',
                }));

                if (response.status !== 429) break;
                await sleep(1_500 * (attempt + 1));
            }

            if (response && response.status >= 200 && response.status < 300) {
                if (typeof response.data === 'string') return response.data;
                if (response.data && typeof response.data === 'object') {
                    const wrappedText = (response.data as { data?: unknown; content?: unknown }).data
                        ?? (response.data as { content?: unknown }).content;
                    if (typeof wrappedText === 'string') return wrappedText;
                }
                return String(response.data || '');
            }
            if (response?.status === 429) {
                throw new Error(`Native HTTP 429 for ${url}`);
            }
        } catch (error) {
            if (error instanceof Error && error.message.includes('HTTP 429')) throw error;
            console.warn(`[Native HTTP] Direct request failed for ${url}; retrying through local proxy.`, error);
        }

        const proxiedUrl = await createLocalMediaProxyUrl(url, headers.Referer || headers.referer || '');
        const proxiedResponse = await fetch(proxiedUrl, { cache: 'no-store' });
        if (!proxiedResponse.ok) throw new Error(`Native proxy HTTP ${proxiedResponse.status} for ${url}`);
        return proxiedResponse.text();
    }

    const response = await fetch(url, { headers: { ...DEFAULT_HEADERS, ...headers } });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return response.text();
};

export const getJson = async <T>(url: string, headers: Record<string, string> = {}): Promise<T> => {
    if (isNativeMobile()) {
        const response = await CapacitorHttp.get({
            url,
            headers: { ...DEFAULT_HEADERS, ...headers, Accept: 'application/json' },
            connectTimeout: 15_000,
            readTimeout: 20_000,
            responseType: 'json',
        });

        if (response.status < 200 || response.status >= 300) {
            throw new Error(`Native HTTP ${response.status} for ${url}`);
        }

        return (typeof response.data === 'string' ? JSON.parse(response.data) : response.data) as T;
    }

    const response = await fetch(url, {
        headers: { ...DEFAULT_HEADERS, ...headers, Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return response.json() as Promise<T>;
};

export const postJson = async <T>(url: string, data: unknown, headers: Record<string, string> = {}): Promise<T> => {
    const requestHeaders = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...headers,
    };

    if (isNativeMobile()) {
        const response = await CapacitorHttp.post({
            url,
            data,
            headers: requestHeaders,
            connectTimeout: 15_000,
            readTimeout: 20_000,
            responseType: 'json',
        });

        if (response.status < 200 || response.status >= 300) {
            throw new Error(`Native HTTP ${response.status} for ${url}`);
        }
        return response.data as T;
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return response.json() as Promise<T>;
};

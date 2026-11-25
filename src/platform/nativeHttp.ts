import { CapacitorHttp } from '@capacitor/core';
import { isNativeMobile, isTauri } from './runtime';
import { createLocalMediaProxyUrl } from './localMediaProxy';

const DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.7',
};

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
let novelBinRequestQueue: Promise<void> = Promise.resolve();
let lastNovelBinRequestAt = 0;

const isNovelBinUrl = (url: string) => {
    try {
        return new URL(url).hostname.endsWith('novel-bin.com');
    } catch {
        return false;
    }
};

const isNovelBinAjaxUrl = (url: string) => url.includes('/ajax/');

// Desktop (Tauri) requests go through a Rust command: no CORS, full header control.
const tauriFetchText = async (url: string, headers: Record<string, string>): Promise<string> => {
    const { invoke } = await import('@tauri-apps/api/core');
    const isNovelBin = isNovelBinUrl(url);
    const isAjax = isNovelBinAjaxUrl(url);
    const maxAttempts = isNovelBin ? 2 : 1;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (isNovelBin && !isAjax) {
            await waitForNovelBinRequestSlot(900);
        }
        try {
            return await invoke<string>('http_fetch_text', { url, headers });
        } catch (error) {
            const msg = String(error || '');
            if (attempt < maxAttempts - 1 && msg.includes('429')) {
                await sleep(1_400);
                continue;
            }
            throw error;
        }
    }
    throw new Error(`Tauri HTTP exhausted for ${url}`);
};

const tauriFetchPost = async (url: string, data: unknown, headers: Record<string, string>): Promise<string> => {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<string>('http_fetch_post', {
        url,
        body: typeof data === 'string' ? data : JSON.stringify(data),
        headers,
    });
};

const waitForNovelBinRequestSlot = async (minIntervalMs = 1_100) => {
    const previous = novelBinRequestQueue;
    let release!: () => void;
    novelBinRequestQueue = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
        const delay = Math.max(0, minIntervalMs - (Date.now() - lastNovelBinRequestAt));
        if (delay) await sleep(delay);
        lastNovelBinRequestAt = Date.now();
    } finally {
        release();
    }
};

const nativeGetWithRetry = async (
    url: string,
    headers: Record<string, string>,
    responseType: 'text' | 'json',
) => {
    const isNovelBin = isNovelBinUrl(url);
    const isAjax = isNovelBinAjaxUrl(url);
    const maxAttempts = isNovelBin ? 2 : 1;
    let response: Awaited<ReturnType<typeof CapacitorHttp.get>> | undefined;
    let lastError: unknown;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (isNovelBin && !isAjax) await waitForNovelBinRequestSlot(1_100);
        try {
            response = await CapacitorHttp.get({
                url,
                headers: { ...DEFAULT_HEADERS, ...headers },
                connectTimeout: isNovelBin ? 8_000 : 15_000,
                readTimeout: isNovelBin ? 12_000 : 20_000,
                responseType,
            });
        } catch (error) {
            lastError = error;
            if (attempt === maxAttempts - 1) throw error;
            continue;
        }

        if (response.status !== 429 || attempt === maxAttempts - 1) break;
        await sleep(1_400);
    }

    if (!response && lastError) throw lastError;
    if (!response) throw new Error(`Native HTTP returned no response for ${url}`);
    return response;
};

export const getText = async (url: string, headers: Record<string, string> = {}) => {
    if (isNativeMobile()) {
        try {
            const response = await nativeGetWithRetry(url, headers, 'text');

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

    if (isTauri()) {
        return tauriFetchText(url, headers);
    }

    const response = await fetch(url, { headers: { ...DEFAULT_HEADERS, ...headers } });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return response.text();
};

export const getJson = async <T>(url: string, headers: Record<string, string> = {}): Promise<T> => {
    if (isNativeMobile()) {
        const response = await nativeGetWithRetry(url, { ...headers, Accept: 'application/json' }, 'json');

        if (response.status < 200 || response.status >= 300) {
            throw new Error(`Native HTTP ${response.status} for ${url}`);
        }

        return (typeof response.data === 'string' ? JSON.parse(response.data) : response.data) as T;
    }

    if (isTauri()) {
        const rawText = await tauriFetchText(url, { ...headers, Accept: 'application/json' });
        return JSON.parse(rawText) as T;
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

    if (isTauri()) {
        try {
            const rawText = await tauriFetchPost(url, data, requestHeaders);
            return JSON.parse(rawText) as T;
        } catch (error) {
            console.warn(`[Native HTTP] Tauri POST failed for ${url}; falling back to fetch.`, error);
        }
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return response.json() as Promise<T>;
};

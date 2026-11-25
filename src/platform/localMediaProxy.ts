import { registerPlugin } from '@capacitor/core';
import { isNativeMobile, isTauri } from './runtime';

type LocalMediaProxyPlugin = {
    createUrl(options: { url: string; referer?: string }): Promise<{ url: string }>;
};

const proxy = registerPlugin<LocalMediaProxyPlugin>('LocalMediaProxy');

export const createLocalMediaProxyUrl = async (url: string, referer = '') => {
    if (isTauri()) {
        const encodedUrl = encodeURIComponent(url);
        const encodedReferer = referer ? `&referer=${encodeURIComponent(referer)}` : '';
        // Windows and Android map custom schemes to an HTTP localhost origin.
        const prefix = /Windows|Android/i.test(navigator.userAgent)
            ? 'http://yorumi-media.localhost/stream'
            : 'yorumi-media://localhost/stream';
        return `${prefix}?url=${encodedUrl}${encodedReferer}`;
    }

    if (!isNativeMobile()) return url;
    try {
        return (await proxy.createUrl({ url, referer })).url;
    } catch (error) {
        // The native server can remain alive while the Capacitor bridge is
        // briefly unavailable during Vite/HMR reloads. Its URL contract is
        // stable, so keep playback usable instead of discarding the stream.
        console.warn('[LocalMediaProxy] Native URL creation failed; using loopback URL directly.', error);
        return `http://127.0.0.1:18765/proxy?url=${encodeURIComponent(url)}&referer=${encodeURIComponent(referer)}`;
    }
};

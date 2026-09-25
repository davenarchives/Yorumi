import { registerPlugin } from '@capacitor/core';
import { isNativeMobile } from './runtime';

type LocalMediaProxyPlugin = {
    createUrl(options: { url: string; referer?: string }): Promise<{ url: string }>;
};

const proxy = registerPlugin<LocalMediaProxyPlugin>('LocalMediaProxy');

export const createLocalMediaProxyUrl = async (url: string, referer = '') => {
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

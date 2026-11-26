import { useEffect, useState } from 'react';
import { isNativeMobile } from '../platform/runtime';

declare global {
    interface Window {
        __YORUMI_ONLINE__?: boolean;
    }
}

const listeners = new Set<(online: boolean) => void>();

function broadcastOnlineState(online: boolean) {
    if (typeof window !== 'undefined') {
        window.__YORUMI_ONLINE__ = online;
    }
    listeners.forEach((fn) => fn(online));
}

export function getCurrentOnlineStatus(): boolean {
    if (typeof window !== 'undefined' && typeof window.__YORUMI_ONLINE__ === 'boolean') {
        return window.__YORUMI_ONLINE__;
    }
    return typeof navigator === 'undefined' ? true : navigator.onLine;
}

let inflightProbe: Promise<boolean> | null = null;

/**
 * Lightweight connectivity check using Google's global 204 endpoint.
 * Used when retrying from offline or confirming reconnects.
 */
export async function probeOnlineStatus(): Promise<boolean> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        broadcastOnlineState(false);
        return false;
    }
    if (inflightProbe) return inflightProbe;

    inflightProbe = (async () => {
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), 3500);
        try {
            await fetch('https://connectivitycheck.gstatic.com/generate_204', {
                method: 'GET',
                mode: 'no-cors',
                cache: 'no-store',
                signal: controller.signal,
            });
            broadcastOnlineState(true);
            return true;
        } catch {
            broadcastOnlineState(false);
            return false;
        } finally {
            window.clearTimeout(timer);
            inflightProbe = null;
        }
    })();

    return inflightProbe;
}

export function useOnlineStatus(): boolean {
    const [isOnline, setIsOnline] = useState<boolean>(() => getCurrentOnlineStatus());

    useEffect(() => {
        listeners.add(setIsOnline);

        const handleOnline = () => {
            broadcastOnlineState(true);
        };
        const handleOffline = () => {
            broadcastOnlineState(false);
        };
        const handleNativeNetwork = (event: Event) => {
            const custom = event as CustomEvent<{ online?: boolean }>;
            if (typeof custom.detail?.online === 'boolean') {
                broadcastOnlineState(custom.detail.online);
            }
        };

        setIsOnline(getCurrentOnlineStatus());

        // On Desktop (non-Android), run one initial probe only to catch virtual adapters when offline
        if (!isNativeMobile()) {
            void probeOnlineStatus();
        }

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        window.addEventListener('yorumi-network-change', handleNativeNetwork);

        return () => {
            listeners.delete(setIsOnline);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('yorumi-network-change', handleNativeNetwork);
        };
    }, []);

    // While offline, auto-check every 4s so reconnecting Wi-Fi recovers automatically
    useEffect(() => {
        if (isOnline) return;
        const interval = window.setInterval(() => {
            void probeOnlineStatus();
        }, 4000);
        return () => window.clearInterval(interval);
    }, [isOnline]);

    return isOnline;
}

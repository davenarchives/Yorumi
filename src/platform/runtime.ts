export type YorumiPlatform = 'android' | 'ios' | 'tauri' | 'web';

type CapacitorBridge = {
    getPlatform?: () => string;
    isNativePlatform?: () => boolean;
};

const getCapacitorBridge = (): CapacitorBridge | undefined => {
    if (typeof window === 'undefined') return undefined;
    return (window as Window & { Capacitor?: CapacitorBridge }).Capacitor;
};

export const isTauri = () => {
    if (typeof window === 'undefined') return false;
    const win = window as Window & { __TAURI_INTERNALS__?: unknown; __TAURI__?: unknown };
    return Boolean(win.__TAURI_INTERNALS__ || win.__TAURI__);
};

export const getRuntimePlatform = (): YorumiPlatform => {
    if (typeof window === 'undefined') return 'web';

    if (isTauri()) {
        if (typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)) {
            return 'android';
        }
        if (typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent)) {
            return 'ios';
        }
        return 'tauri';
    }

    const capacitor = getCapacitorBridge();
    if (capacitor?.isNativePlatform?.()) {
        return capacitor.getPlatform?.() === 'ios' ? 'ios' : 'android';
    }

    return 'web';
};

export const isNativeMobile = () => {
    const platform = getRuntimePlatform();
    return platform === 'android' || platform === 'ios';
};

export const isNativeDesktop = () => {
    const platform = getRuntimePlatform();
    return platform === 'tauri';
};



// Tauri exposes one platform identity on both desktop and mobile.
export const isMobileShell = () => isNativeMobile() || (
    isTauri() && typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
);

export type YorumiPlatform = 'android' | 'ios' | 'electron' | 'web';

type CapacitorBridge = {
    getPlatform?: () => string;
    isNativePlatform?: () => boolean;
};

const getCapacitorBridge = (): CapacitorBridge | undefined => {
    if (typeof window === 'undefined') return undefined;
    return (window as Window & { Capacitor?: CapacitorBridge }).Capacitor;
};

export const getRuntimePlatform = (): YorumiPlatform => {
    if (typeof window === 'undefined') return 'web';

    const capacitor = getCapacitorBridge();
    if (capacitor?.isNativePlatform?.()) {
        return capacitor.getPlatform?.() === 'ios' ? 'ios' : 'android';
    }

    if (window.location.protocol === 'file:' || Boolean(window.electronAPI)) {
        return 'electron';
    }

    return 'web';
};

export const isNativeMobile = () => {
    const platform = getRuntimePlatform();
    return platform === 'android' || platform === 'ios';
};

export const isElectron = () => getRuntimePlatform() === 'electron';


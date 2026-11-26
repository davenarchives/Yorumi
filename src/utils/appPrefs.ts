import { useCallback, useEffect, useState } from 'react';

export const DOWNLOADED_ONLY_KEY = 'yorumi_downloaded_only_v1';
export const INCOGNITO_MODE_KEY = 'yorumi_incognito_mode_v1';
export const PREFS_UPDATED_EVENT = 'yorumi-prefs-updated';

const readBool = (key: string): boolean => {
    try {
        return localStorage.getItem(key) === 'true';
    } catch {
        return false;
    }
};

const writeBool = (key: string, value: boolean) => {
    try {
        localStorage.setItem(key, value ? 'true' : 'false');
    } catch {
        // Best effort
    }
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(PREFS_UPDATED_EVENT));
    }
};

export const isDownloadedOnlyMode = (): boolean => readBool(DOWNLOADED_ONLY_KEY);
export const setDownloadedOnlyMode = (enabled: boolean): void => writeBool(DOWNLOADED_ONLY_KEY, enabled);

export const isIncognitoMode = (): boolean => readBool(INCOGNITO_MODE_KEY);
export const setIncognitoMode = (enabled: boolean): void => writeBool(INCOGNITO_MODE_KEY, enabled);

export function useAppPrefs() {
    const [downloadedOnly, setDownloadedOnlyState] = useState<boolean>(isDownloadedOnlyMode);
    const [incognitoMode, setIncognitoModeState] = useState<boolean>(isIncognitoMode);

    useEffect(() => {
        const sync = () => {
            setDownloadedOnlyState(isDownloadedOnlyMode());
            setIncognitoModeState(isIncognitoMode());
        };
        window.addEventListener(PREFS_UPDATED_EVENT, sync);
        window.addEventListener('storage', sync);
        return () => {
            window.removeEventListener(PREFS_UPDATED_EVENT, sync);
            window.removeEventListener('storage', sync);
        };
    }, []);

    const setDownloadedOnly = useCallback((enabled: boolean) => {
        setDownloadedOnlyState(enabled);
        setDownloadedOnlyMode(enabled);
    }, []);

    const setIncognitoModePref = useCallback((enabled: boolean) => {
        setIncognitoModeState(enabled);
        setIncognitoMode(enabled);
    }, []);

    return {
        downloadedOnly,
        setDownloadedOnly,
        incognitoMode,
        setIncognitoMode: setIncognitoModePref,
    };
}

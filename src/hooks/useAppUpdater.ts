import { useCallback, useEffect, useState } from 'react';
import { isNativeMobile, isTauri } from '../platform/runtime';

interface GithubReleaseAsset {
    name: string;
    browser_download_url: string;
}

interface GithubRelease {
    tag_name?: string;
    name?: string;
    body?: string;
    html_url?: string;
    draft?: boolean;
    prerelease?: boolean;
    assets?: GithubReleaseAsset[];
}

export interface AppUpdateState {
    updateAvailable: boolean;
    currentVersion: string;
    latestVersion: string;
    releaseNotes: string;
    releaseUrl: string;
    downloadUrl: string | null;
    assetName: string | null;
    status: 'idle' | 'downloading' | 'installing' | 'error';
    progress: number;
    error: string | null;
    isChecking: boolean;
    lastCheckedAt: number | null;
    checkForUpdates: () => Promise<boolean>;
    installUpdate: () => Promise<void>;
    openReleasePage: () => Promise<void>;
}

const RELEASES_API_URL = 'https://api.github.com/repos/davenarchives/Yorumi/releases/latest';
const RELEASES_FALLBACK_URL = 'https://github.com/davenarchives/Yorumi/releases/latest';
const FALLBACK_VERSION = '5.0.0';
const CHECK_INTERVAL_MS = 30 * 60 * 1000;

const parseSemver = (raw: string): [number, number, number] => {
    const cleaned = raw.trim().replace(/^v/i, '').split('-')[0] || '0.0.0';
    const [major = 0, minor = 0, patch = 0] = cleaned.split('.').map((n) => Number.parseInt(n, 10) || 0);
    return [major, minor, patch];
};

const isNewerVersion = (latest: string, current: string): boolean => {
    const [lMaj, lMin, lPat] = parseSemver(latest);
    const [cMaj, cMin, cPat] = parseSemver(current);
    if (lMaj !== cMaj) return lMaj > cMaj;
    if (lMin !== cMin) return lMin > cMin;
    return lPat > cPat;
};

const pickPlatformAsset = (assets: GithubReleaseAsset[]): GithubReleaseAsset | null => {
    if (!assets.length) return null;
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
    const isAndroid = ua.includes('android');
    const isMac = ua.includes('mac');
    const isLinux = ua.includes('linux') && !isAndroid;

    if (isAndroid) {
        return assets.find((a) => /\.apk$/i.test(a.name)) || null;
    }
    if (isMac) {
        return assets.find((a) => /\.dmg$/i.test(a.name)) || null;
    }
    if (isLinux) {
        return assets.find((a) => /\.appimage$/i.test(a.name))
            || assets.find((a) => /\.deb$/i.test(a.name))
            || null;
    }
    // Windows: prefer NSIS .exe setup (supports silent /S update) over .msi
    return (
        assets.find((a) => /setup\.exe$/i.test(a.name))
        || assets.find((a) => /\.exe$/i.test(a.name) && !/portable/i.test(a.name))
        || assets.find((a) => /\.msi$/i.test(a.name))
        || null
    );
};

export function useAppUpdater(): AppUpdateState {
    const [currentVersion, setCurrentVersion] = useState(FALLBACK_VERSION);
    const [latestVersion, setLatestVersion] = useState('');
    const [releaseNotes, setReleaseNotes] = useState('');
    const [releaseUrl, setReleaseUrl] = useState(RELEASES_FALLBACK_URL);
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
    const [assetName, setAssetName] = useState<string | null>(null);
    const [status, setStatus] = useState<'idle' | 'downloading' | 'installing' | 'error'>('idle');
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [isChecking, setIsChecking] = useState(false);
    const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);

    const checkForUpdates = useCallback(async (): Promise<boolean> => {
        setIsChecking(true);
        try {
            let version = FALLBACK_VERSION;
            if (isTauri()) {
                try {
                    const { getVersion } = await import('@tauri-apps/api/app');
                    version = await getVersion();
                } catch {
                    // Use fallback version
                }
            } else if (isNativeMobile()) {
                try {
                    const { App: CapacitorApp } = await import('@capacitor/app');
                    const info = await CapacitorApp.getInfo();
                    if (info?.version) version = info.version;
                } catch {
                    // Use fallback version
                }
            }
            setCurrentVersion(version);

            const res = await fetch(RELEASES_API_URL, {
                headers: { Accept: 'application/vnd.github+json' },
            });
            if (!res.ok) return false;
            const release = (await res.json()) as GithubRelease;
            setLastCheckedAt(Date.now());
            if (release.draft || release.prerelease || !release.tag_name) return false;

            const tag = release.tag_name.replace(/^v/i, '');
            if (!isNewerVersion(tag, version)) {
                setLatestVersion(tag);
                return false;
            }

            const asset = pickPlatformAsset(release.assets || []);
            setLatestVersion(tag);
            setReleaseNotes((release.body || '').trim());
            setReleaseUrl(release.html_url || RELEASES_FALLBACK_URL);
            setDownloadUrl(asset?.browser_download_url || null);
            setAssetName(asset?.name || null);
            return true;
        } catch {
            // Silent fail when offline or rate-limited
            return false;
        } finally {
            setIsChecking(false);
        }
    }, []);

    useEffect(() => {
        const initialTimer = window.setTimeout(() => {
            void checkForUpdates();
        }, 3000);
        const interval = window.setInterval(() => {
            void checkForUpdates();
        }, CHECK_INTERVAL_MS);
        return () => {
            window.clearTimeout(initialTimer);
            window.clearInterval(interval);
        };
    }, [checkForUpdates]);

    useEffect(() => {
        if (!isTauri()) return;
        let unlisten: (() => void) | undefined;
        let active = true;
        void import('@tauri-apps/api/event').then(({ listen }) => {
            void listen<{ percent?: number }>('update-download-progress', (event) => {
                if (!active) return;
                const pct = Number(event.payload?.percent ?? 0);
                setProgress(Math.max(0, Math.min(100, pct)));
                if (pct >= 100) {
                    setStatus('installing');
                }
            }).then((fn) => {
                if (active) unlisten = fn;
                else fn();
            });
        });
        return () => {
            active = false;
            unlisten?.();
        };
    }, []);

    const openReleasePage = useCallback(async () => {
        const target = releaseUrl || RELEASES_FALLBACK_URL;
        if (isTauri()) {
            try {
                const { openUrl } = await import('@tauri-apps/plugin-opener');
                await openUrl(target);
                return;
            } catch {
                // Fallback below
            }
        }
        window.open(target, '_blank', 'noopener,noreferrer');
    }, [releaseUrl]);

    const installUpdate = useCallback(async () => {
        if (status === 'downloading' || status === 'installing') return;
        if (isNativeMobile() && downloadUrl) {
            window.open(downloadUrl, '_blank', 'noopener,noreferrer');
            return;
        }
        if (!isTauri() || !downloadUrl || !assetName) {
            await openReleasePage();
            return;
        }
        setStatus('downloading');
        setProgress(0);
        setError(null);
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('install_desktop_update', { url: downloadUrl, filename: assetName });
            setStatus('installing');
        } catch (err) {
            setStatus('error');
            setError(err instanceof Error ? err.message : String(err));
        }
    }, [assetName, downloadUrl, openReleasePage, status]);

    return {
        updateAvailable: Boolean(latestVersion && isNewerVersion(latestVersion, currentVersion)),
        currentVersion,
        latestVersion,
        releaseNotes,
        releaseUrl,
        downloadUrl,
        assetName,
        status,
        progress,
        error,
        isChecking,
        lastCheckedAt,
        checkForUpdates,
        installUpdate,
        openReleasePage,
    };
}

import { setLocalStorageWithCleanup } from '../utils/localStorageQuota';

const PREFIX = 'yorumi_offline_v1:';
const memoryCache = new Map<string, any>();

export function isOffline(): boolean {
    return typeof navigator !== 'undefined' && !navigator.onLine;
}

export function getOfflineData<T>(key: string): T | null {
    const fullKey = `${PREFIX}${key}`;
    if (memoryCache.has(fullKey)) {
        return memoryCache.get(fullKey) as T;
    }
    try {
        const raw = localStorage.getItem(fullKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        memoryCache.set(fullKey, parsed);
        return parsed as T;
    } catch {
        return null;
    }
}

export function saveOfflineData<T>(key: string, data: T): void {
    if (!data) return;
    const fullKey = `${PREFIX}${key}`;
    memoryCache.set(fullKey, data);
    try {
        setLocalStorageWithCleanup(fullKey, JSON.stringify(data));
    } catch (e) {
        console.warn(`[OfflineCache] Storage quota full for ${key}:`, e);
    }
}

export async function fetchWithOfflineFallback<T>(
    key: string,
    fetcher: () => Promise<T>,
    isEmpty?: (data: T) => boolean
): Promise<T> {
    const offlineCached = getOfflineData<T>(key);

    // If offline, return cache immediately if available
    if (isOffline() && offlineCached) {
        return offlineCached;
    }

    try {
        const data = await fetcher();
        const empty = isEmpty ? isEmpty(data) : (!data || (Array.isArray(data) && data.length === 0));
        if (!empty) {
            saveOfflineData(key, data);
            return data;
        }
        if (offlineCached) return offlineCached;
        return data;
    } catch (error) {
        console.warn(`[OfflineCache] Fetch failed for ${key}, using offline cache:`, error);
        if (offlineCached) {
            return offlineCached;
        }
        throw error;
    }
}

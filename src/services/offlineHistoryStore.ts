// Durable IndexedDB mirror for watch/read/search history so history persists
// reliably offline (including after localStorage quota pressure or WebView eviction).

const IDB_NAME = 'yorumi_offline_history_v1';
const IDB_STORE = 'kv';
const IDB_VERSION = 1;

export const OFFLINE_HISTORY_KEYS = [
    'yorumi_continue_watching',
    'yorumi_continue_reading',
    'yorumi_ln_continue_reading_v1',
    'yorumi_episode_history',
    'yorumi_chapter_history',
    'yorumi_anime_watch_time',
    'yorumi_anime_watch_time_total',
    'yorumi_activity_history',
    'yorumi_activity_seen',
    'yorumi_recent_searches',
    'yorumi_recent_searches_global_v1',
] as const;

export const OFFLINE_HISTORY_RESTORED_EVENT = 'yorumi-offline-history-restored';

const OFFLINE_HISTORY_KEY_SET = new Set<string>(OFFLINE_HISTORY_KEYS);

export const isOfflineHistoryKey = (key: string): boolean => {
    if (OFFLINE_HISTORY_KEY_SET.has(key)) return true;
    for (const base of OFFLINE_HISTORY_KEYS) {
        if (key.startsWith(`${base}_`)) return true;
    }
    return false;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openHistoryDb(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
            reject(new Error('IndexedDB unavailable'));
            return;
        }
        const req = indexedDB.open(IDB_NAME, IDB_VERSION);
        req.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(IDB_STORE)) {
                db.createObjectStore(IDB_STORE);
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => {
            dbPromise = null;
            reject(req.error);
        };
    });

    return dbPromise;
}

export function persistOfflineHistoryKey(key: string, value: string): void {
    if (!key) return;
    void openHistoryDb()
        .then(
            (db) =>
                new Promise<void>((resolve, reject) => {
                    const tx = db.transaction(IDB_STORE, 'readwrite');
                    const store = tx.objectStore(IDB_STORE);
                    const req = store.put(value, key);
                    req.onsuccess = () => resolve();
                    req.onerror = () => reject(req.error);
                }),
        )
        .catch(() => {
            // Best-effort IndexedDB backup; localStorage remains primary synchronous store.
        });
}

export function deleteOfflineHistoryKey(key: string): void {
    if (!key) return;
    void openHistoryDb()
        .then(
            (db) =>
                new Promise<void>((resolve, reject) => {
                    const tx = db.transaction(IDB_STORE, 'readwrite');
                    const store = tx.objectStore(IDB_STORE);
                    const req = store.delete(key);
                    req.onsuccess = () => resolve();
                    req.onerror = () => reject(req.error);
                }),
        )
        .catch(() => {
            // Best effort
        });
}

const isEffectivelyEmpty = (raw: string | null): boolean => {
    if (!raw) return true;
    const trimmed = raw.trim();
    return trimmed === '' || trimmed === '[]' || trimmed === '{}';
};

let didHydrate = false;

/**
 * Restores any history keys missing from localStorage out of IndexedDB,
 * and seeds IndexedDB with existing localStorage history on first boot.
 */
export async function hydrateOfflineHistoryFromIdb(): Promise<void> {
    if (didHydrate || typeof window === 'undefined' || typeof localStorage === 'undefined') {
        return;
    }
    didHydrate = true;

    try {
        const db = await openHistoryDb();
        const idbEntries = await new Promise<Array<{ key: string; value: string }>>((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, 'readonly');
            const store = tx.objectStore(IDB_STORE);
            const results: Array<{ key: string; value: string }> = [];
            const req = store.openCursor();
            req.onsuccess = () => {
                const cursor = req.result;
                if (cursor) {
                    if (typeof cursor.key === 'string' && typeof cursor.value === 'string') {
                        results.push({ key: cursor.key, value: cursor.value });
                    }
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
            req.onerror = () => reject(req.error);
        });

        const idbMap = new Map<string, string>(idbEntries.map((e) => [e.key, e.value]));
        let restoredAny = false;

        // 1. Restore any key present in IndexedDB that is missing/empty in localStorage
        for (const [key, idbVal] of idbMap.entries()) {
            if (isEffectivelyEmpty(idbVal)) continue;
            let localVal: string | null = null;
            try {
                localVal = localStorage.getItem(key);
            } catch {
                localVal = null;
            }
            if (isEffectivelyEmpty(localVal)) {
                try {
                    localStorage.setItem(key, idbVal);
                } catch {
                    // Even if localStorage is full, notify storageMemoryCache via event
                }
                window.dispatchEvent(
                    new CustomEvent(OFFLINE_HISTORY_RESTORED_EVENT, {
                        detail: { key, value: idbVal },
                    }),
                );
                restoredAny = true;
            }
        }

        // 2. Seed IndexedDB from existing localStorage history keys not yet mirrored
        for (const key of OFFLINE_HISTORY_KEYS) {
            if (idbMap.has(key)) continue;
            try {
                const localVal = localStorage.getItem(key);
                if (!isEffectivelyEmpty(localVal) && localVal) {
                    persistOfflineHistoryKey(key, localVal);
                }
            } catch {
                // Ignore read errors
            }
        }

        if (restoredAny) {
            window.dispatchEvent(new CustomEvent('yorumi-storage-updated'));
        }
    } catch {
        // IndexedDB unavailable; fall back to localStorage only
    }
}

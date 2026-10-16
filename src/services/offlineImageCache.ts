// Offline Image Cache using CacheStorage and IndexedDB fallback
const CACHE_NAME = 'yorumi_images_cache_v1';
const IDB_NAME = 'yorumi_offline_image_store_v1';
const IDB_STORE = 'images';
const IDB_VERSION = 1;

let idbPromise: Promise<IDBDatabase> | null = null;
const memoryBlobUrlMap = new Map<string, string>();

function getIdb(): Promise<IDBDatabase> {
    if (idbPromise) return idbPromise;

    idbPromise = new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
            reject(new Error('IndexedDB not supported'));
            return;
        }

        const request = indexedDB.open(IDB_NAME, IDB_VERSION);
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(IDB_STORE)) {
                db.createObjectStore(IDB_STORE);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });

    return idbPromise;
}

export function isOfflineEnv(): boolean {
    return typeof navigator !== 'undefined' && !navigator.onLine;
}

export async function cacheImage(url: string): Promise<string> {
    const rawUrl = String(url || '').trim();
    if (!rawUrl || rawUrl.startsWith('data:') || rawUrl.startsWith('blob:')) {
        return rawUrl;
    }

    if (memoryBlobUrlMap.has(rawUrl)) {
        return memoryBlobUrlMap.get(rawUrl)!;
    }

    try {
        const response = await fetch(rawUrl, { mode: 'cors' }).catch(() => null);
        if (!response || !response.ok) return rawUrl;

        const blob = await response.blob();
        if (!blob || blob.size === 0) return rawUrl;

        // 1. Try CacheStorage
        if (typeof window !== 'undefined' && 'caches' in window) {
            try {
                const cache = await window.caches.open(CACHE_NAME);
                const cacheResponse = new Response(blob, {
                    headers: { 'Content-Type': blob.type || 'image/jpeg' },
                });
                await cache.put(rawUrl, cacheResponse);
            } catch {
                // Continue to IndexedDB
            }
        }

        // 2. Try IndexedDB
        try {
            const db = await getIdb();
            await new Promise<void>((resolve, reject) => {
                const tx = db.transaction(IDB_STORE, 'readwrite');
                const store = tx.objectStore(IDB_STORE);
                const req = store.put(blob, rawUrl);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        } catch {
            // Memory URL fallback
        }

        const objectUrl = URL.createObjectURL(blob);
        memoryBlobUrlMap.set(rawUrl, objectUrl);
        return objectUrl;
    } catch {
        return rawUrl;
    }
}

export async function getCachedImage(url: string): Promise<string | null> {
    const rawUrl = String(url || '').trim();
    if (!rawUrl) return null;
    if (rawUrl.startsWith('data:') || rawUrl.startsWith('blob:')) return rawUrl;

    if (memoryBlobUrlMap.has(rawUrl)) {
        return memoryBlobUrlMap.get(rawUrl)!;
    }

    // 1. Check CacheStorage
    if (typeof window !== 'undefined' && 'caches' in window) {
        try {
            const cache = await window.caches.open(CACHE_NAME);
            const matched = await cache.match(rawUrl);
            if (matched) {
                const blob = await matched.blob();
                if (blob && blob.size > 0) {
                    const objectUrl = URL.createObjectURL(blob);
                    memoryBlobUrlMap.set(rawUrl, objectUrl);
                    return objectUrl;
                }
            }
        } catch {
            // Check IndexedDB
        }
    }

    // 2. Check IndexedDB
    try {
        const db = await getIdb();
        const blob = await new Promise<Blob | undefined>((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, 'readonly');
            const store = tx.objectStore(IDB_STORE);
            const req = store.get(rawUrl);
            req.onsuccess = () => resolve(req.result as Blob | undefined);
            req.onerror = () => reject(req.error);
        });

        if (blob && blob.size > 0) {
            const objectUrl = URL.createObjectURL(blob);
            memoryBlobUrlMap.set(rawUrl, objectUrl);
            return objectUrl;
        }
    } catch {
        // Not found
    }

    return null;
}

export async function prefetchImages(urls: (string | undefined | null)[]): Promise<void> {
    const validUrls = [...new Set(urls.map((u) => String(u || '').trim()).filter(Boolean))];
    const unvisited = validUrls.filter((u) => !memoryBlobUrlMap.has(u) && !u.startsWith('data:') && !u.startsWith('blob:'));

    const BATCH_SIZE = 4;
    for (let i = 0; i < unvisited.length; i += BATCH_SIZE) {
        const batch = unvisited.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map((url) => cacheImage(url).catch(() => url)));
    }
}

export function generateTitlePlaceholder(title: string): string {
    const safeTitle = (title || 'Media')
        .replace(/[<>&"]/g, '')
        .slice(0, 32);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#18181b"/>
      <stop offset="100%" stop-color="#09090b"/>
    </linearGradient>
  </defs>
  <rect width="300" height="450" fill="url(#g)"/>
  <circle cx="150" cy="190" r="44" fill="#27272a"/>
  <path d="M142 176 L164 190 L142 204 Z" fill="#3DB4F2"/>
  <text x="150" y="270" fill="#a1a1aa" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="600" text-anchor="middle">
    ${safeTitle}
  </text>
  <text x="150" y="295" fill="#52525b" font-family="system-ui, -apple-system, sans-serif" font-size="11" text-anchor="middle">
    Offline Cached
  </text>
</svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

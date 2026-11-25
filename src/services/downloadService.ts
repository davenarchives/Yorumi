// In-app IndexedDB storage and downloader for offline anime playback
import type { SubtitleTrack, StreamLink } from '../types/stream';
import { API_BASE, API_ORIGIN, USES_LOCAL_SOURCES } from '../config/api';
import { getText } from '../platform/nativeHttp';
import { convertSubtitleTextToVtt, normalizeSubtitleTracks } from '../utils/subtitles';
import { cacheImage, getCachedImage, prefetchImages } from './offlineImageCache';
import {
    deleteNativeDownload,
    downloadToNativeStorage,
    isAndroidDownloadStorageAvailable,
    setNativeDownloadPaused,
} from '../platform/nativeDownloadStorage';
import { isTauri } from '../platform/runtime';
import { tauriBridge } from '../platform/tauri/tauriBridge';

export interface DownloadedEpisode {
    id: string; // Format: `${animeId}_ep_${episodeNumber}`
    animeId: string;
    animeTitle: string;
    animeImage: string;
    episodeNumber: number;
    episodeTitle?: string;
    quality?: string;
    audio?: 'sub' | 'dub';
    fileSize?: number; // Size in bytes
    downloadedAt: number;
    videoBlob?: Blob;
    filePath?: string;
    subtitles?: SubtitleTrack[];
    isHls?: boolean;
    duration?: number;
    hlsSegments?: OfflineHlsSegment[];
}

export interface OfflineHlsSegment {
    offset: number;
    size: number;
    duration: number;
}

export interface ActiveDownloadProgress {
    animeId: string;
    episodeNumber: number;
    progress: number; // 0 to 100
    status: 'queued' | 'downloading' | 'paused' | 'completed' | 'error' | 'saving';
    receivedBytes: number;
    totalBytes: number;
    error?: string;
}

type DownloadControl = {
    paused: boolean;
    waiters: Set<() => void>;
    latestProgress: ActiveDownloadProgress;
    onProgress?: (progress: ActiveDownloadProgress) => void;
};

const downloadControls = new Map<string, DownloadControl>();

const getControlKey = (animeId: string | number, episodeNumber: string | number) =>
    `${String(animeId).trim()}_ep_${Number(episodeNumber)}`;

const waitUntilResumed = async (control?: DownloadControl) => {
    if (!control?.paused) return;
    await new Promise<void>((resolve) => control.waiters.add(resolve));
};

const DB_NAME = 'yorumi_downloads_v1';
const STORE_NAME = 'episodes';
const DB_VERSION = 1;
const OFFLINE_SUBTITLES_KEY = 'yorumi_offline_subtitles_v1';
const OFFLINE_ANIME_META_KEY = 'yorumi_offline_anime_meta_v1';

export interface OfflineEpisodeMeta {
    title?: string;
    thumbnail?: string;
    overview?: string;
    airDate?: string;
}

export interface OfflineAnimeMetadata {
    id: string;
    anilistId?: number;
    malId?: number;
    tmdbId?: number;
    title: string;
    title_english?: string;
    poster?: string;
    banner?: string;
    backdrop?: string;
    synopsis?: string;
    score?: number;
    year?: number;
    rating?: string;
    status?: string;
    type?: string;
    episodes?: number | null;
    genres?: string[];
    episodeThumbs?: Record<number, OfflineEpisodeMeta>;
    updatedAt: number;
}

const normalizeOfflineMetaTitle = (value?: string): string =>
    String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

const readOfflineAnimeMetaMap = (): Record<string, OfflineAnimeMetadata> => {
    try {
        const raw = localStorage.getItem(OFFLINE_ANIME_META_KEY);
        return raw ? (JSON.parse(raw) as Record<string, OfflineAnimeMetadata>) : {};
    } catch {
        return {};
    }
};

const writeOfflineAnimeMetaMap = (map: Record<string, OfflineAnimeMetadata>) => {
    try {
        // Cap stored entries at 80 most-recent to keep localStorage lightweight
        const entries = Object.entries(map)
            .sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0))
            .slice(0, 80);
        localStorage.setItem(OFFLINE_ANIME_META_KEY, JSON.stringify(Object.fromEntries(entries)));
    } catch {
        // Ignore storage quota errors
    }
};

const dataUriToBlobUrl = (url: string): string => {
    if (!/^data:/i.test(url)) return url;
    try {
        const commaIdx = url.indexOf(',');
        if (commaIdx < 0) return url;
        const header = url.slice(5, commaIdx);
        const payload = url.slice(commaIdx + 1);
        const isBase64 = /;base64/i.test(header);
        const mime = header.split(';')[0] || 'text/vtt';
        const decoded = isBase64 ? atob(payload) : decodeURIComponent(payload);
        const blob = new Blob([decoded], { type: mime });
        return URL.createObjectURL(blob);
    } catch {
        return url;
    }
};

const readOfflineSubtitleMap = (): Record<string, SubtitleTrack[]> => {
    try {
        const raw = localStorage.getItem(OFFLINE_SUBTITLES_KEY);
        return raw ? (JSON.parse(raw) as Record<string, SubtitleTrack[]>) : {};
    } catch {
        return {};
    }
};

const saveOfflineSubtitlesForKey = (key: string, subtitles?: SubtitleTrack[]) => {
    if (!key || !subtitles || subtitles.length === 0) return;
    const map = readOfflineSubtitleMap();
    map[key] = subtitles;
    try {
        localStorage.setItem(OFFLINE_SUBTITLES_KEY, JSON.stringify(map));
        return;
    } catch {
        // Quota exceeded: retry with primary subtitle track only for this episode
        try {
            map[key] = [subtitles[0]];
            localStorage.setItem(OFFLINE_SUBTITLES_KEY, JSON.stringify(map));
            return;
        } catch {
            // Still full: evict oldest keys until it fits
            const keys = Object.keys(map).filter((k) => k !== key);
            for (const oldKey of keys) {
                delete map[oldKey];
                try {
                    localStorage.setItem(OFFLINE_SUBTITLES_KEY, JSON.stringify(map));
                    return;
                } catch {
                    // keep pruning
                }
            }
        }
    }
};

const getOfflineSubtitlesForKey = (key: string): SubtitleTrack[] | undefined => {
    if (!key) return undefined;
    const map = readOfflineSubtitleMap();
    return map[key];
};

const deleteOfflineSubtitlesForKey = (key: string) => {
    if (!key) return;
    try {
        const map = readOfflineSubtitleMap();
        if (key in map) {
            delete map[key];
            localStorage.setItem(OFFLINE_SUBTITLES_KEY, JSON.stringify(map));
        }
    } catch {
        // Ignore storage errors
    }
};

const buildTauriLocalFileUrl = (filePath: string): string => {
    const isWindows = typeof navigator !== 'undefined' && /windows/i.test(navigator.userAgent);
    const origin = isWindows ? 'http://yorumi-media.localhost' : 'yorumi-media://localhost';
    return `${origin}/local-file?path=${encodeURIComponent(filePath)}`;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
            reject(new Error('IndexedDB is not supported in this environment'));
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('animeId', 'animeId', { unique: false });
                store.createIndex('downloadedAt', 'downloadedAt', { unique: false });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });

    return dbPromise;
}

export function formatFileSize(bytes?: number): string {
    if (!bytes || bytes <= 0) return 'Offline';
    if (bytes < 1024 * 1024) {
        return `${Math.round(bytes / 1024)} KB`;
    }
    const mb = bytes / (1024 * 1024);
    return mb >= 10 ? `${Math.round(mb)} MB` : `${mb.toFixed(1)} MB`;
}

export function resolveHlsUrl(baseUrl: string, relativeOrAbsolute: string): string {
    const trimmed = String(relativeOrAbsolute || '').trim();
    if (!trimmed) return '';

    if (trimmed.startsWith('/api/scraper/proxy?')) {
        return `${API_ORIGIN}${trimmed}`;
    }

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return trimmed;
    }

    if (baseUrl.includes('/api/scraper/proxy?') || isLocalMediaProxyUrl(baseUrl)) {
        try {
            const parsed = new URL(baseUrl, typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001');
            const targetUrl = parsed.searchParams.get('url');
            if (targetUrl) {
                const resolvedTarget = new URL(trimmed, targetUrl).href;
                parsed.searchParams.set('url', resolvedTarget);
                if (baseUrl.startsWith('/')) {
                    return `${parsed.pathname}${parsed.search}`;
                }
                return parsed.href;
            }
        } catch {
            // fallback
        }
    }

    try {
        return new URL(trimmed, baseUrl).href;
    } catch {
        return trimmed;
    }
}

function isLocalMediaProxyUrl(rawUrl: string): boolean {
    try {
        const parsed = new URL(rawUrl);
        if (parsed.protocol === 'yorumi-media:' || parsed.hostname === 'yorumi-media.localhost') {
            return true;
        }
        return parsed.port === '18765' && (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost');
    } catch {
        return false;
    }
}

function getDownloadIdVariants(value: unknown): Set<string> {
    const raw = String(value ?? '').trim().toLowerCase();
    const variants = new Set<string>();
    if (!raw) return variants;
    variants.add(raw);
    const stripped = raw
        .replace(/^(al|anilist|mal|tmdb)-/i, '')
        .replace(/^s:/i, '')
        .replace(/^scraper-/i, '')
        .trim();
    if (stripped) variants.add(stripped);
    if (/^\d+$/.test(stripped)) {
        variants.add(`al-${stripped}`);
        variants.add(`mal-${stripped}`);
        variants.add(`tmdb-${stripped}`);
    }
    return variants;
}

export function isDownloadAnimeIdMatch(
    downloadedAnimeId: unknown,
    targetAnimeId: unknown,
    anilistId?: unknown
): boolean {
    const dVariants = getDownloadIdVariants(downloadedAnimeId);
    if (dVariants.size === 0) return false;
    const tVariants = new Set<string>();
    getDownloadIdVariants(targetAnimeId).forEach((v) => tVariants.add(v));
    getDownloadIdVariants(anilistId).forEach((v) => tVariants.add(v));
    for (const v of dVariants) {
        if (tVariants.has(v)) return true;
    }
    return false;
}

function hasUsableDownloadedMedia(downloaded: DownloadedEpisode): boolean {
    if (downloaded.videoBlob) return downloaded.videoBlob.size > 0;
    if (!downloaded.filePath) return false;
    if (/\.tmp(?:\.ts)?$/i.test(downloaded.filePath)) {
        downloaded.filePath = downloaded.filePath.replace(/\.tmp(?:\.ts)?$/i, '.mp4');
    }
    return downloaded.fileSize === undefined || downloaded.fileSize > 0;
}

async function persistSubtitleTracks(subtitles?: SubtitleTrack[], referer?: string): Promise<SubtitleTrack[] | undefined> {
    // Keep English first plus up to 11 other languages so offline downloads support the language dropdown
    const normalizedSubtitles = normalizeSubtitleTracks(subtitles).slice(0, 12);
    if (!normalizedSubtitles.length) return undefined;
    const settled = await Promise.all(normalizedSubtitles.map(async (subtitle) => {
        try {
            if (/^data:/i.test(subtitle.url)) return subtitle;
            const unwrapped = unwrapNativeStreamTarget(subtitle.url, referer);
            const targetSubUrl = unwrapped.url || subtitle.url;
            const targetReferer = unwrapped.referer || referer;
            let text = '';
            if (USES_LOCAL_SOURCES && /^https?:\/\//i.test(targetSubUrl) && !isLocalMediaProxyUrl(targetSubUrl)) {
                try {
                    const headers = targetReferer ? { Referer: targetReferer } : undefined;
                    text = await getText(targetSubUrl, headers);
                } catch {
                    text = '';
                }
            }
            if (!text.trim()) {
                try {
                    const response = await fetch(getFetchableUrl(subtitle.url));
                    if (response.ok) {
                        text = await response.text();
                    }
                } catch {
                    text = '';
                }
            }
            if (!text.trim() && isTauri() && /^https?:\/\//i.test(targetSubUrl)) {
                try {
                    const isWindows = typeof navigator !== 'undefined' && /windows/i.test(navigator.userAgent);
                    const origin = isWindows ? 'http://yorumi-media.localhost' : 'yorumi-media://localhost';
                    const proxied = `${origin}/stream?url=${encodeURIComponent(targetSubUrl)}${targetReferer ? `&referer=${encodeURIComponent(targetReferer)}` : ''}`;
                    const response = await fetch(proxied);
                    if (response.ok) {
                        text = await response.text();
                    }
                } catch {
                    text = '';
                }
            }
            const vttText = convertSubtitleTextToVtt(text);
            if (!vttText) return null;
            return { ...subtitle, url: `data:text/vtt;charset=utf-8,${encodeURIComponent(vttText)}` };
        } catch (err) {
            console.warn('Skipping failed subtitle track during download:', subtitle.url, err);
            return null;
        }
    }));
    const valid = settled.filter((track): track is SubtitleTrack => track !== null);
    return valid.length ? valid : undefined;
}

function createOfflineHlsPlaylist(
    mediaUrl: string,
    fileSize: number,
    duration: number,
    storedSegments?: OfflineHlsSegment[]
): string {
    const packetSize = 188;
    const preferredChunkSize = 8 * 1024 * 1024;
    const chunkSize = Math.floor(preferredChunkSize / packetSize) * packetSize;
    const safeFileSize = Math.max(1, fileSize);
    const safeDuration = Math.max(1, duration);
    const hasStoredSegments = Boolean(storedSegments?.length) && storedSegments!.every((segment, index) => {
        const previous = storedSegments![index - 1];
        const expectedOffset = previous ? previous.offset + previous.size : 0;
        return Number.isFinite(segment.offset)
            && Number.isFinite(segment.size)
            && Number.isFinite(segment.duration)
            && segment.offset === expectedOffset
            && segment.size > 0
            && segment.duration >= 0
            && segment.offset + segment.size <= safeFileSize;
    }) && storedSegments![storedSegments!.length - 1].offset
        + storedSegments![storedSegments!.length - 1].size === safeFileSize;
    const playlistSegments = hasStoredSegments
        ? storedSegments!
        : Array.from({ length: Math.ceil(safeFileSize / chunkSize) }, (_, index) => {
            const offset = index * chunkSize;
            const size = Math.min(chunkSize, safeFileSize - offset);
            return { offset, size, duration: safeDuration * (size / safeFileSize) };
        });
    const fallbackDuration = safeDuration / Math.max(1, playlistSegments.length);
    const targetDuration = Math.max(...playlistSegments.map((segment) => segment.duration || fallbackDuration));
    const lines = [
        '#EXTM3U',
        '#EXT-X-VERSION:4',
        `#EXT-X-TARGETDURATION:${Math.max(1, Math.ceil(targetDuration))}`,
        '#EXT-X-MEDIA-SEQUENCE:0',
        '#EXT-X-PLAYLIST-TYPE:VOD',
    ];

    for (const segment of playlistSegments) {
        lines.push(`#EXTINF:${(segment.duration || fallbackDuration).toFixed(3)},`);
        lines.push(`#EXT-X-BYTERANGE:${segment.size}@${segment.offset}`);
        lines.push(mediaUrl);
    }
    lines.push('#EXT-X-ENDLIST');
    return lines.join('\n');
}

async function purgeLegacyAndroidHlsDownloads(items: DownloadedEpisode[]): Promise<DownloadedEpisode[]> {
    if (!isAndroidDownloadStorageAvailable()) return items;
    const staleItems = items.filter((item) => item.filePath && item.isHls && !item.hlsSegments?.length);
    if (!staleItems.length) return items;

    await Promise.all(staleItems.map((item) => deleteNativeDownload(item.filePath).catch((error) => {
        console.warn('Failed to remove an incompatible Android HLS download:', error);
    })));

    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        staleItems.forEach((item) => store.delete(item.id));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
    return items.filter((item) => !staleItems.some((stale) => stale.id === item.id));
}

function getFetchableUrl(rawUrl: string): string {
    if (!rawUrl) return '';
    if (rawUrl.startsWith('/')) {
        return `${API_ORIGIN}${rawUrl}`;
    }
    if (isLocalMediaProxyUrl(rawUrl) || USES_LOCAL_SOURCES) {
        return rawUrl;
    }
    if (rawUrl.startsWith('http') && !rawUrl.includes('localhost:3001') && !rawUrl.includes('127.0.0.1:3001') && !rawUrl.startsWith(API_ORIGIN)) {
        return `${API_BASE}/scraper/proxy?url=${encodeURIComponent(rawUrl)}`;
    }
    return rawUrl;
}

function unwrapNativeStreamTarget(rawUrl: string, explicitReferer?: string): { url: string; referer?: string } {
    if (rawUrl && (isLocalMediaProxyUrl(rawUrl) || rawUrl.includes('/api/scraper/proxy?'))) {
        try {
            const parsed = new URL(rawUrl, 'http://127.0.0.1:18765');
            const target = parsed.searchParams.get('url');
            const proxyReferer = parsed.searchParams.get('referer') || undefined;
            if (target && /^https?:\/\//i.test(target)) {
                return { url: target, referer: explicitReferer || proxyReferer };
            }
        } catch {
            // keep original
        }
    }
    return { url: rawUrl, referer: explicitReferer };
}

async function isMpegTsBlob(blob: Blob): Promise<boolean> {
    if (!blob || blob.size < 188) return false;
    try {
        const slice = blob.slice(0, Math.min(blob.size, 189));
        const buffer = await slice.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        return bytes[0] === 0x47 && (bytes.length < 189 || bytes[188] === 0x47);
    } catch {
        return false;
    }
}

async function downloadHlsStream(
    playlistUrl: string,
    onProgress?: (receivedBytes: number, progress: number) => void,
    control?: DownloadControl
): Promise<{ blob: Blob; totalBytes: number; duration: number }> {
    let currentUrl = playlistUrl;
    let text = '';
    let lines: string[] = [];
    let maxRedirects = 5;

    while (maxRedirects-- > 0) {
        await waitUntilResumed(control);
        const fetchUrl = getFetchableUrl(currentUrl);
        const res = await fetch(fetchUrl);
        if (!res.ok) throw new Error(`Failed to fetch HLS playlist (${res.status})`);
        text = await res.text();
        lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

        if (text.includes('#EXT-X-STREAM-INF')) {
            let bestVariantUrl = '';
            let bestBandwidth = -1;
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (line.startsWith('#EXT-X-STREAM-INF:')) {
                    const bwMatch = line.match(/BANDWIDTH=(\d+)/i);
                    const bw = bwMatch ? parseInt(bwMatch[1], 10) : 0;
                    const nextLine = lines[i + 1];
                    if (nextLine && !nextLine.startsWith('#')) {
                        if (bw > bestBandwidth) {
                            bestBandwidth = bw;
                            bestVariantUrl = nextLine;
                        }
                    }
                }
            }
            if (!bestVariantUrl) {
                const fallbackLine = lines.find((l) => !l.startsWith('#') && (l.includes('.m3u8') || l.includes('/')));
                if (fallbackLine) bestVariantUrl = fallbackLine;
            }
            if (bestVariantUrl) {
                currentUrl = resolveHlsUrl(currentUrl, bestVariantUrl);
                continue;
            }
        }
        break;
    }

    let totalDuration = 0;
    lines.forEach((line) => {
        if (line.startsWith('#EXTINF:')) {
            const match = line.match(/#EXTINF:([\d.]+)/);
            if (match && match[1]) {
                totalDuration += parseFloat(match[1]);
            }
        }
    });

    const segmentUrls = lines
        .filter((l) => !l.startsWith('#'))
        .map((l) => resolveHlsUrl(currentUrl, l));

    if (segmentUrls.length === 0) {
        throw new Error('No video segments found in HLS playlist');
    }

    const totalSegments = segmentUrls.length;
    const segmentBuffers: ArrayBuffer[] = new Array(totalSegments);
    let downloadedCount = 0;
    let totalBytes = 0;

    const BATCH_SIZE = 4;
    for (let i = 0; i < totalSegments; i += BATCH_SIZE) {
        await waitUntilResumed(control);
        const batchIndices = Array.from({ length: Math.min(BATCH_SIZE, totalSegments - i) }, (_, k) => i + k);
        await Promise.all(
            batchIndices.map(async (idx) => {
                await waitUntilResumed(control);
                const url = segmentUrls[idx];
                const segFetchUrl = getFetchableUrl(url);
                const sRes = await fetch(segFetchUrl);
                if (!sRes.ok) throw new Error(`Failed segment ${idx + 1}/${totalSegments}`);
                const buf = await sRes.arrayBuffer();
                segmentBuffers[idx] = buf;
                downloadedCount++;
                totalBytes += buf.byteLength;
                const progress = Math.min(99, Math.round((downloadedCount / totalSegments) * 100));
                onProgress?.(totalBytes, progress);
            })
        );
    }

    const videoBlob = new Blob(segmentBuffers, { type: 'video/mp4' });
    return { blob: videoBlob, totalBytes: videoBlob.size, duration: totalDuration };
}

export function cleanDownloadTitle(title?: string): string {
    return String(title || '')
        .replace(/\.{2,}|…/g, '')
        .replace(/[^a-zA-Z0-9\s]/g, ' ')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

export function isDownloadTitleMatch(t1?: string, t2?: string): boolean {
    const c1 = cleanDownloadTitle(t1);
    const c2 = cleanDownloadTitle(t2);
    if (!c1 || !c2) return false;
    if (c1 === c2) return true;
    if (c1.length >= 4 && c2.includes(c1)) return true;
    if (c2.length >= 4 && c1.includes(c2)) return true;
    return false;
}

export const downloadService = {
    setDownloadPaused(animeId: string | number, episodeNumber: string | number, paused: boolean): boolean {
        const operationId = getControlKey(animeId, episodeNumber);
        void setNativeDownloadPaused(operationId, paused);
        const control = downloadControls.get(operationId);
        if (!control) return false;
        control.paused = paused;
        const nextProgress: ActiveDownloadProgress = {
            ...control.latestProgress,
            status: paused ? 'paused' : 'downloading',
        };
        control.latestProgress = nextProgress;
        control.onProgress?.(nextProgress);
        if (!paused) {
            control.waiters.forEach((resolve) => resolve());
            control.waiters.clear();
        }
        return true;
    },

    getEpisodeKey(animeId: string, episodeNumber: number, _title?: string): string {
        const strId = String(animeId || '').trim();
        return `${strId}_ep_${episodeNumber}`;
    },

    getLegacyEpisodeKey(animeId: string, episodeNumber: number, title?: string): string {
        const source = (title || animeId || 'anime').trim();
        const slug = source
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        return `${slug}-e${episodeNumber}`;
    },

    async getDownloads(): Promise<DownloadedEpisode[]> {
        let items: DownloadedEpisode[] = [];

        if (isTauri()) {
            try {
                const local = await tauriBridge.getLocalDownloads();
                items = (local || [])
                    .filter((item) => hasUsableDownloadedMedia(item))
                    .map((item) => {
                        if (item.subtitles && item.subtitles.length > 0) return item;
                        const savedSubs =
                            getOfflineSubtitlesForKey(item.id)
                            || getOfflineSubtitlesForKey(`${item.animeId}_ep_${item.episodeNumber}`);
                        return savedSubs?.length ? { ...item, subtitles: savedSubs } : item;
                    });
            } catch (error) {
                console.error('Failed to get Tauri downloads:', error);
            }
        }

        try {
            const db = await getDB();
            const storedItems = await new Promise<DownloadedEpisode[]>((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const req = store.getAll();
                req.onsuccess = () => resolve((req.result || []) as DownloadedEpisode[]);
                req.onerror = () => reject(req.error);
            });
            const idbItems = await purgeLegacyAndroidHlsDownloads(storedItems);
            if (idbItems.length > 0) {
                const existingIds = new Set(items.map((i) => i.id));
                idbItems.forEach((item) => {
                    if (!existingIds.has(item.id) && hasUsableDownloadedMedia(item)) {
                        items.push(item);
                    }
                });
            }
        } catch (error) {
            console.error('Failed to get IndexedDB downloads:', error);
        }

        items.sort((a, b) => b.downloadedAt - a.downloadedAt);

        // Preload/cache offline posters in background when online
        if (typeof navigator !== 'undefined' && navigator.onLine) {
            prefetchImages(items.map((i) => i.animeImage)).catch(() => undefined);
        }

        // Return items with cached offline poster URLs when available
        const withCachedImages = await Promise.all(
            items.map(async (item) => {
                const cached = await getCachedImage(item.animeImage).catch(() => null);
                return cached ? { ...item, animeImage: cached } : item;
            })
        );

        return withCachedImages;
    },

    async getDownload(
        animeId: string | number,
        episodeNumber: number | string,
        title?: string,
        anilistId?: number | string,
        alternateEpNumbers?: (number | string | undefined)[]
    ): Promise<DownloadedEpisode | null> {
        const strAnimeId = String(animeId || '');

        if (isTauri()) {
            try {
                const match = await tauriBridge.getLocalDownload({
                    animeId: strAnimeId,
                    episodeNumber: Number(episodeNumber),
                });
                if (match && hasUsableDownloadedMedia(match)) {
                    if (!match.subtitles || match.subtitles.length === 0) {
                        const savedSubs =
                            getOfflineSubtitlesForKey(match.id)
                            || getOfflineSubtitlesForKey(`${match.animeId}_ep_${match.episodeNumber}`);
                        if (savedSubs?.length) {
                            return { ...match, subtitles: savedSubs };
                        }
                    }
                    return match;
                }
            } catch (error) {
                console.error('Failed to get Tauri download:', error);
            }
        }

        try {
            const downloads = await this.getDownloads();
            if (!downloads || downloads.length === 0) return null;

            const epNums = [episodeNumber, ...(alternateEpNumbers || [])]
                .map((n) => Number(n))
                .filter((n) => Number.isFinite(n) && n > 0);
            const targetId = strAnimeId.trim().toLowerCase();
            const anilistStr = anilistId ? String(anilistId).trim().toLowerCase() : '';

            // 1. Direct key match
            const key = this.getEpisodeKey(strAnimeId, Number(episodeNumber), title);
            const legacySlugKey = this.getLegacyEpisodeKey(strAnimeId, Number(episodeNumber), title);
            const legacyKey = `${strAnimeId.trim()}_ep_${episodeNumber}`;
            const direct = downloads.find(
                (d) => d.id === key || d.id === legacyKey || d.id === legacySlugKey || (epNums.includes(Number(d.episodeNumber)) && String(d.animeId).trim().toLowerCase() === targetId)
            );
            if (direct) return direct;

            // 2. Strict ID, Anilist ID, or Clean Title match + Ep match
            const match = downloads.find((d) => {
                if (!epNums.includes(Number(d.episodeNumber))) return false;
                const dAnimeId = String(d.animeId || '').trim().toLowerCase();
                const dKey = String(d.id || '').toLowerCase();

                const idMatch = Boolean(targetId && (isDownloadAnimeIdMatch(dAnimeId, targetId, anilistStr) || dKey.startsWith(`${targetId}_ep_`)));
                const anilistMatch = Boolean(anilistStr && (dAnimeId === anilistStr || dKey.startsWith(`${anilistStr}_ep_`)));
                const titleMatch = Boolean(title && isDownloadTitleMatch(d.animeTitle, title));

                return idMatch || anilistMatch || titleMatch;
            });

            return match || null;
        } catch (error) {
            console.error('Failed to get download:', error);
            return null;
        }
    },

    async getOfflineStream(downloaded: DownloadedEpisode): Promise<StreamLink> {
        let streamUrl = '';
        let isHls = false;

        if (downloaded?.filePath) {
            let actualPath = downloaded.filePath;
            if (/\.tmp(?:\.ts)?$/i.test(actualPath)) {
                actualPath = actualPath.replace(/\.tmp(?:\.ts)?$/i, '.mp4');
            }
            const rawFileUrl = isTauri()
                ? buildTauriLocalFileUrl(actualPath)
                : isAndroidDownloadStorageAvailable()
                ? `http://127.0.0.1:18765/file?path=${encodeURIComponent(actualPath)}`
                : `${API_BASE}/scraper/local-file?path=${encodeURIComponent(actualPath)}`;
            const isTs = downloaded.isHls !== undefined ? downloaded.isHls : actualPath.endsWith('.ts');

            if (isTs) {
                isHls = true;
                const duration = downloaded.duration || (downloaded.fileSize ? Math.max(300, Math.round((downloaded.fileSize * 8) / 1_600_000)) : 1400);
                const playlistText = createOfflineHlsPlaylist(rawFileUrl, downloaded.fileSize || 1, duration, downloaded.hlsSegments);
                const playlistBlob = new Blob([playlistText], { type: 'application/x-mpegurl' });
                streamUrl = URL.createObjectURL(playlistBlob);
            } else {
                isHls = false;
                streamUrl = rawFileUrl;
            }
        } else if (downloaded?.videoBlob && downloaded.videoBlob.size > 0) {
            try {
                const rawBlobUrl = URL.createObjectURL(downloaded.videoBlob);
                const isTs = (await isMpegTsBlob(downloaded.videoBlob)) || Boolean(downloaded.isHls);

                if (isTs) {
                    isHls = true;
                    const duration = downloaded.duration || (downloaded.fileSize ? Math.max(300, Math.round((downloaded.fileSize * 8) / 1_600_000)) : 1400);
                    const playlistText = createOfflineHlsPlaylist(rawBlobUrl, downloaded.videoBlob.size, duration);
                    const playlistBlob = new Blob([playlistText], { type: 'application/x-mpegurl' });
                    streamUrl = URL.createObjectURL(playlistBlob);
                } else {
                    isHls = false;
                    streamUrl = rawBlobUrl;
                }
            } catch (e) {
                console.error('Failed creating blob URL for download:', e);
            }
        }

        const playableSubtitles = (downloaded.subtitles || []).map((track) => ({
            ...track,
            url: dataUriToBlobUrl(track.url),
        }));

        return {
            quality: downloaded.quality || 'HD (Offline)',
            audio: downloaded.audio || 'sub',
            url: streamUrl,
            directUrl: streamUrl,
            isHls,
            subtitles: playableSubtitles,
            duration: downloaded.duration || (downloaded.fileSize ? Math.max(300, Math.round((downloaded.fileSize * 8) / 1_600_000)) : undefined),
            provider: 'Offline Storage',
            server: 'offline',
        };
    },

    saveOfflineAnimeMetadata(meta: Omit<OfflineAnimeMetadata, 'updatedAt'>): void {
        const key = String(meta.id || meta.anilistId || normalizeOfflineMetaTitle(meta.title)).trim();
        if (!key || !meta.title) return;
        const map = readOfflineAnimeMetaMap();
        const existing = map[key];
        const mergedThumbs: Record<number, OfflineEpisodeMeta> = {
            ...(existing?.episodeThumbs || {}),
            ...(meta.episodeThumbs || {}),
        };
        const next: OfflineAnimeMetadata = {
            ...(existing || {}),
            ...meta,
            id: key,
            synopsis: meta.synopsis?.trim() ? meta.synopsis : existing?.synopsis,
            poster: meta.poster || existing?.poster,
            banner: meta.banner || existing?.banner,
            backdrop: meta.backdrop || existing?.backdrop,
            score: meta.score && meta.score > 0 ? meta.score : existing?.score,
            year: meta.year || existing?.year,
            rating: meta.rating || existing?.rating,
            genres: meta.genres?.length ? meta.genres : existing?.genres,
            episodes: meta.episodes || existing?.episodes || null,
            episodeThumbs: mergedThumbs,
            updatedAt: Date.now(),
        };
        map[key] = next;
        writeOfflineAnimeMetaMap(map);

        if (typeof navigator !== 'undefined' && navigator.onLine) {
            const thumbUrls = Object.values(mergedThumbs)
                .map((ep) => ep.thumbnail)
                .filter((u): u is string => Boolean(u))
                .slice(0, 30);
            void prefetchImages([next.poster, next.banner, next.backdrop, ...thumbUrls]).catch(() => undefined);
        }
    },

    saveOfflineEpisodeThumbnail(animeId: string, animeTitle: string, episodeNumber: number, epMeta: OfflineEpisodeMeta): void {
        const key = String(animeId || normalizeOfflineMetaTitle(animeTitle)).trim();
        if (!key || !episodeNumber) return;
        const map = readOfflineAnimeMetaMap();
        const existing = map[key];
        const mergedThumbs: Record<number, OfflineEpisodeMeta> = {
            ...(existing?.episodeThumbs || {}),
            [episodeNumber]: {
                ...(existing?.episodeThumbs?.[episodeNumber] || {}),
                ...epMeta,
            },
        };
        map[key] = {
            ...(existing || { id: key, title: animeTitle }),
            episodeThumbs: mergedThumbs,
            updatedAt: Date.now(),
        };
        writeOfflineAnimeMetaMap(map);
        if (epMeta.thumbnail && typeof navigator !== 'undefined' && navigator.onLine) {
            void cacheImage(epMeta.thumbnail).catch(() => undefined);
        }
    },

    getOfflineAnimeMetadata(animeId?: string | number, title?: string, anilistId?: string | number): OfflineAnimeMetadata | null {
        const map = readOfflineAnimeMetaMap();
        const directKey = animeId ? String(animeId).trim() : '';
        if (directKey && map[directKey]) return map[directKey];
        const anilistKey = anilistId ? String(anilistId).trim() : '';
        if (anilistKey && map[anilistKey]) return map[anilistKey];
        const normTitle = normalizeOfflineMetaTitle(title);
        for (const entry of Object.values(map)) {
            if (directKey && isDownloadAnimeIdMatch(entry.id, directKey, anilistKey)) return entry;
            if (anilistKey && entry.anilistId && String(entry.anilistId) === anilistKey) return entry;
            if (normTitle && (normalizeOfflineMetaTitle(entry.title) === normTitle || normalizeOfflineMetaTitle(entry.title_english) === normTitle)) {
                return entry;
            }
        }
        return null;
    },

    async isEpisodeDownloaded(animeId: string, episodeNumber: number, title?: string, anilistId?: number | string): Promise<boolean> {
        const ep = await this.getDownload(animeId, episodeNumber, title, anilistId);
        return Boolean(ep && ((ep.filePath && (ep.fileSize || 0) > 0) || (ep.videoBlob && ep.videoBlob.size > 0)));
    },

    async saveDownload(episode: DownloadedEpisode): Promise<void> {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.put(episode);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    },

    async deleteDownload(animeId: string, episodeNumber: number, title?: string, anilistId?: number | string): Promise<boolean> {
        if (isTauri()) {
            deleteOfflineSubtitlesForKey(`${animeId}_ep_${episodeNumber}`);
            try {
                await tauriBridge.deleteLocalDownload({
                    animeId: String(animeId),
                    episodeNumber: Number(episodeNumber),
                });
            } catch (error) {
                console.error('Failed to delete Tauri download:', error);
            }
        }

        try {
            const db = await getDB();
            const target = await this.getDownload(animeId, episodeNumber, title, anilistId);
            const keyToDelete = target ? target.id : this.getEpisodeKey(animeId, episodeNumber);
            if (target?.filePath) await deleteNativeDownload(target.filePath);

            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                const req = store.delete(keyToDelete);
                req.onsuccess = () => resolve(true);
                req.onerror = () => reject(req.error);
            });
        } catch (error) {
            console.error('Failed to delete download:', error);
            return false;
        }
    },

    openDownloadsFolder(category: 'Anime' | 'Manga' | 'LightNovels' = 'Anime'): boolean {
        if (isTauri()) {
            tauriBridge.openDownloadsFolder(category);
            return true;
        }

        return false;
    },

    async downloadStream(
        params: {
            animeId: string;
            animeTitle: string;
            animeImage: string;
            episodeNumber: number;
            episodeTitle?: string;
            streamUrl: string;
            referer?: string;
            isHls?: boolean;
            quality?: string;
            audio?: 'sub' | 'dub';
            subtitles?: SubtitleTrack[];
        },
        onProgress?: (progress: ActiveDownloadProgress) => void
    ): Promise<DownloadedEpisode> {
        // Pre-cache anime poster for offline mode
        if (params.animeImage) {
            cacheImage(params.animeImage).catch(() => undefined);
        }

        const nativeTarget = unwrapNativeStreamTarget(params.streamUrl, params.referer);
        const offlineSubtitles = await persistSubtitleTracks(params.subtitles, nativeTarget.referer);
        const downloadableParams = { ...params, subtitles: offlineSubtitles };

        if (isTauri()) {
            const targetId = String(params.animeId).trim();
            const epNum = Number(params.episodeNumber);
            const subKey = `${targetId}_ep_${epNum}`;
            if (offlineSubtitles && offlineSubtitles.length > 0) {
                saveOfflineSubtitlesForKey(subKey, offlineSubtitles);
            }

            const unlistenRef: { current: (() => void) | null } = { current: null };
            try {
                await new Promise<void>((resolve, reject) => {
                    let settled = false;
                    const finishResolve = () => {
                        if (!settled) {
                            settled = true;
                            resolve();
                        }
                    };
                    const finishReject = (err: Error) => {
                        if (!settled) {
                            settled = true;
                            reject(err);
                        }
                    };

                    void tauriBridge.onDownloadProgress((p: ActiveDownloadProgress) => {
                        if (!p) return;
                        const matchesEp = Number(p.episodeNumber) === epNum;
                        const pId = String(p.animeId || '').trim().toLowerCase();
                        const matchesAnime = !pId || !targetId || isDownloadAnimeIdMatch(pId, targetId);
                        if (!matchesEp || !matchesAnime) return;

                        onProgress?.(p);
                        if (p.status === 'completed') {
                            finishResolve();
                        } else if (p.status === 'error') {
                            finishReject(new Error(p.error || 'Download failed'));
                        }
                    }).then(async (fn) => {
                        unlistenRef.current = fn;
                        if (settled) {
                            fn();
                            return;
                        }
                        try {
                            const started = await tauriBridge.startDownload({
                                animeId: targetId,
                                animeTitle: params.animeTitle,
                                animeImage: params.animeImage,
                                episodeNumber: epNum,
                                episodeTitle: params.episodeTitle,
                                streamUrl: nativeTarget.url,
                                referer: nativeTarget.referer,
                                quality: params.quality,
                                audio: params.audio,
                            });
                            if (!started) {
                                finishReject(new Error('Failed to start native desktop download'));
                            }
                        } catch (err) {
                            finishReject(err instanceof Error ? err : new Error(String(err)));
                        }
                    }).catch((err) => {
                        finishReject(err instanceof Error ? err : new Error(String(err)));
                    });
                });

                const downloaded = await tauriBridge.getLocalDownload({
                    animeId: targetId,
                    episodeNumber: epNum,
                });
                window.dispatchEvent(new CustomEvent('yorumi-downloads-updated'));
                if (downloaded) {
                    return offlineSubtitles?.length
                        ? { ...downloaded, subtitles: offlineSubtitles }
                        : downloaded;
                }
                throw new Error('Download completed but file record was not found');
            } finally {
                unlistenRef.current?.();
            }
        }

        const { animeId, animeTitle, animeImage, episodeNumber, episodeTitle, streamUrl, quality, audio } = downloadableParams;
        const key = this.getEpisodeKey(animeId, episodeNumber);
        const control: DownloadControl = {
            paused: false,
            waiters: new Set(),
            latestProgress: {
                animeId,
                episodeNumber,
                progress: 0,
                status: 'downloading',
                receivedBytes: 0,
                totalBytes: 0,
            },
            onProgress,
        };
        downloadControls.set(key, control);

        const reportProgress = (progress: ActiveDownloadProgress) => {
            control.latestProgress = progress;
            onProgress?.(progress);
        };

        if (isAndroidDownloadStorageAvailable()) {
            try {
                const isHls = params.isHls === true || nativeTarget.url.includes('.m3u8') || nativeTarget.url.includes('m3u8');
                const extension = 'mp4';
                const nativeResult = await downloadToNativeStorage({
                    operationId: key,
                    url: nativeTarget.url,
                    referer: nativeTarget.referer,
                    relativePath: `Anime/${animeId}/${animeTitle} - Episode ${episodeNumber}.${extension}`,
                    hls: isHls,
                    maxHeight: Number(quality?.match(/(\d{3,4})p?/i)?.[1]) || 720,
                }, (progress) => {
                    reportProgress({
                        animeId,
                        episodeNumber,
                        progress: progress.progress,
                        status: 'downloading',
                        receivedBytes: progress.receivedBytes,
                        totalBytes: progress.totalBytes,
                    });
                });

                reportProgress({
                    animeId,
                    episodeNumber,
                    progress: 99,
                    status: 'saving',
                    receivedBytes: nativeResult.fileSize,
                    totalBytes: nativeResult.fileSize,
                });
                const downloadedItem: DownloadedEpisode = {
                    id: key,
                    animeId,
                    animeTitle,
                    animeImage,
                    episodeNumber,
                    episodeTitle,
                    quality: quality || 'HD',
                    audio: audio || 'sub',
                    fileSize: nativeResult.fileSize,
                    downloadedAt: Date.now(),
                    filePath: nativeResult.filePath,
                    subtitles: offlineSubtitles,
                    isHls: false,
                    duration: nativeResult.duration,
                    hlsSegments: nativeResult.hlsSegments,
                };
                await this.saveDownload(downloadedItem);
                reportProgress({
                    animeId,
                    episodeNumber,
                    progress: 100,
                    status: 'completed',
                    receivedBytes: nativeResult.fileSize,
                    totalBytes: nativeResult.fileSize,
                });
                return downloadedItem;
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Native download failed';
                reportProgress({
                    animeId,
                    episodeNumber,
                    progress: 0,
                    status: 'error',
                    receivedBytes: 0,
                    totalBytes: 0,
                    error: message,
                });
                throw error;
            } finally {
                downloadControls.delete(key);
            }
        }

        try {
            let videoBlob: Blob;
            let finalSize = 0;
            let hlsDuration = 0;

            const isHls = params.isHls === true || streamUrl.includes('.m3u8') || streamUrl.includes('m3u8');

            if (isHls) {
                const result = await downloadHlsStream(streamUrl, (bytes, progress) => {
                    reportProgress({
                        animeId,
                        episodeNumber,
                        progress,
                        status: 'downloading',
                        receivedBytes: bytes,
                        totalBytes: bytes,
                    });
                }, control);
                videoBlob = result.blob;
                finalSize = result.totalBytes;
                hlsDuration = result.duration;
            } else {
                const response = await fetch(streamUrl);
                if (!response.ok) {
                    throw new Error(`Failed to fetch video: ${response.status} ${response.statusText}`);
                }

                const contentLengthHeader = response.headers.get('Content-Length');
                const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;
                let receivedBytes = 0;

                const reader = response.body?.getReader();
                const chunks: BlobPart[] = [];

                if (reader) {
                    while (true) {
                        await waitUntilResumed(control);
                        const { done, value } = await reader.read();
                        if (done) break;

                        if (value) {
                            chunks.push(value);
                            receivedBytes += value.length;
                            const progress = totalBytes > 0
                                ? Math.min(99, Math.round((receivedBytes / totalBytes) * 100))
                                : Math.min(99, Math.round(receivedBytes / (1024 * 1024 * 300) * 100));

                            reportProgress({
                                animeId,
                                episodeNumber,
                                progress,
                                status: 'downloading',
                                receivedBytes,
                                totalBytes: totalBytes || receivedBytes,
                            });
                        }
                    }
                } else {
                    const blob = await response.blob();
                    receivedBytes = blob.size;
                    chunks.push(blob);
                }

                const contentType = response.headers.get('Content-Type') || 'video/mp4';
                videoBlob = new Blob(chunks, { type: contentType });
                finalSize = videoBlob.size;
            }

            reportProgress({
                animeId,
                episodeNumber,
                progress: 99,
                status: 'saving',
                receivedBytes: finalSize,
                totalBytes: finalSize,
            });

            const downloadedItem: DownloadedEpisode = {
                id: key,
                animeId,
                animeTitle,
                animeImage,
                episodeNumber,
                episodeTitle,
                quality: quality || 'HD',
                audio: audio || 'sub',
                fileSize: finalSize,
                downloadedAt: Date.now(),
                videoBlob,
                subtitles: offlineSubtitles,
                isHls,
                duration: isHls ? hlsDuration : undefined,
            };

            await this.saveDownload(downloadedItem);

            reportProgress({
                animeId,
                episodeNumber,
                progress: 100,
                status: 'completed',
                receivedBytes: finalSize,
                totalBytes: finalSize,
            });

            return downloadedItem;
        } catch (error: unknown) {
            const errMessage = error instanceof Error ? error.message : 'Download failed';
            reportProgress({
                animeId,
                episodeNumber,
                progress: 0,
                status: 'error',
                receivedBytes: 0,
                totalBytes: 0,
                error: errMessage,
            });
            throw error;
        } finally {
            downloadControls.delete(key);
        }
    }
};

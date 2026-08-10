// In-app IndexedDB storage and downloader for offline anime playback
import type { SubtitleTrack, StreamLink } from '../types/stream';
import { API_BASE, API_ORIGIN } from '../config/api';

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
}

export interface ActiveDownloadProgress {
    animeId: string;
    episodeNumber: number;
    progress: number; // 0 to 100
    status: 'downloading' | 'completed' | 'error' | 'saving';
    receivedBytes: number;
    totalBytes: number;
    error?: string;
}

const DB_NAME = 'yorumi_downloads_v1';
const STORE_NAME = 'episodes';
const DB_VERSION = 1;

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

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return trimmed;
    }

    if (baseUrl.includes('/api/scraper/proxy?')) {
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

function getFetchableUrl(rawUrl: string): string {
    if (!rawUrl) return '';
    if (rawUrl.startsWith('/')) {
        return `${API_ORIGIN}${rawUrl}`;
    }
    if (rawUrl.startsWith('http') && !rawUrl.includes('localhost:3001') && !rawUrl.includes('127.0.0.1:3001') && !rawUrl.startsWith(API_ORIGIN)) {
        return `${API_BASE}/scraper/proxy?url=${encodeURIComponent(rawUrl)}`;
    }
    return rawUrl;
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
    onProgress?: (receivedBytes: number, progress: number) => void
): Promise<{ blob: Blob; totalBytes: number; duration: number }> {
    let currentUrl = playlistUrl;
    let text = '';
    let lines: string[] = [];
    let maxRedirects = 5;

    while (maxRedirects-- > 0) {
        const fetchUrl = getFetchableUrl(currentUrl);
        const res = await fetch(fetchUrl);
        if (!res.ok) throw new Error(`Failed to fetch HLS playlist (${res.status})`);
        text = await res.text();
        lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

        // Check if master playlist containing variant URLs
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
        const batchIndices = Array.from({ length: Math.min(BATCH_SIZE, totalSegments - i) }, (_, k) => i + k);
        await Promise.all(
            batchIndices.map(async (idx) => {
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
        const isElectron = typeof window !== 'undefined' && Boolean(window.electronAPI?.getLocalDownloads);
        if (isElectron && window.electronAPI) {
            try {
                const items = await window.electronAPI.getLocalDownloads();
                return items || [];
            } catch (error) {
                console.error('Failed to get Electron downloads:', error);
                return [];
            }
        }

        try {
            const db = await getDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const req = store.getAll();
                req.onsuccess = () => {
                    const results = (req.result || []) as DownloadedEpisode[];
                    results.sort((a, b) => b.downloadedAt - a.downloadedAt);
                    resolve(results);
                };
                req.onerror = () => reject(req.error);
            });
        } catch (error) {
            console.error('Failed to get downloads:', error);
            return [];
        }
    },

    async getDownload(
        animeId: string | number,
        episodeNumber: number | string,
        title?: string,
        anilistId?: number | string,
        alternateEpNumbers?: (number | string | undefined)[]
    ): Promise<DownloadedEpisode | null> {
        const strAnimeId = String(animeId || '');
        const isElectron = typeof window !== 'undefined' && Boolean(window.electronAPI?.getLocalDownload);
        if (isElectron && window.electronAPI) {
            try {
                const match = await window.electronAPI.getLocalDownload({
                    animeId: strAnimeId,
                    episodeNumber: Number(episodeNumber),
                    title,
                    anilistId,
                    alternateEpNumbers,
                });
                if (match) return match;
            } catch (error) {
                console.error('Failed to get Electron download:', error);
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

                const idMatch = Boolean(targetId && (dAnimeId === targetId || dAnimeId.includes(targetId) || targetId.includes(dAnimeId) || dKey.startsWith(`${targetId}_ep_`)));
                const anilistMatch = Boolean(anilistStr && (dAnimeId === anilistStr || dKey.startsWith(`${anilistStr}_ep_`)));
                const isNum = (s: string) => /^\d+$/.test(s.trim());
                const isDifferentSeries = Boolean(isNum(dAnimeId) && isNum(anilistStr || targetId) && dAnimeId !== (anilistStr || targetId));
                const titleMatch = Boolean(title && !isDifferentSeries && isDownloadTitleMatch(d.animeTitle, title));

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
            const rawFileUrl = `${API_BASE}/scraper/local-file?path=${encodeURIComponent(downloaded.filePath)}`;
            const isTs = downloaded.isHls !== undefined ? downloaded.isHls : downloaded.filePath.endsWith('.ts');

            if (isTs) {
                isHls = true;
                const duration = downloaded.duration || (downloaded.fileSize ? Math.max(300, Math.round((downloaded.fileSize * 8) / 1_600_000)) : 1400);
                const playlistText = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:${Math.ceil(duration)}
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:${duration.toFixed(3)},
${rawFileUrl}
#EXT-X-ENDLIST`;
                const playlistBlob = new Blob([playlistText], { type: 'application/x-mpegurl' });
                streamUrl = URL.createObjectURL(playlistBlob);
            } else {
                isHls = false;
                streamUrl = rawFileUrl;
            }
        } else if (downloaded?.videoBlob && downloaded.videoBlob.size > 0) {
            try {
                const rawBlobUrl = URL.createObjectURL(downloaded.videoBlob);
                const isTs = downloaded.isHls !== undefined
                    ? downloaded.isHls
                    : await isMpegTsBlob(downloaded.videoBlob);

                if (isTs) {
                    isHls = true;
                    const duration = downloaded.duration || (downloaded.fileSize ? Math.max(300, Math.round((downloaded.fileSize * 8) / 1_600_000)) : 1400);
                    const playlistText = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:${Math.ceil(duration)}
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:${duration.toFixed(3)},
${rawBlobUrl}
#EXT-X-ENDLIST`;
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

        return {
            quality: downloaded.quality || 'HD (Offline)',
            audio: downloaded.audio || 'sub',
            url: streamUrl,
            directUrl: streamUrl,
            isHls,
            isEmbed: false,
            provider: 'Offline Storage',
            server: 'anidb',
            subtitles: downloaded.subtitles,
            duration: downloaded.duration,
        };
    },

    async saveDownload(item: DownloadedEpisode): Promise<void> {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.put(item);
            req.onsuccess = () => {
                window.dispatchEvent(new CustomEvent('yorumi-downloads-updated'));
                resolve();
            };
            req.onerror = () => reject(req.error);
        });
    },

    async deleteDownload(animeId: string, episodeNumber: number): Promise<void> {
        const isElectron = typeof window !== 'undefined' && Boolean(window.electronAPI?.deleteLocalDownload);
        if (isElectron && window.electronAPI) {
            try {
                await window.electronAPI.deleteLocalDownload({ animeId, episodeNumber });
                window.dispatchEvent(new CustomEvent('yorumi-downloads-updated'));
                return;
            } catch (error) {
                console.error('Failed to delete Electron download:', error);
            }
        }

        const key = this.getEpisodeKey(animeId, episodeNumber);
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.delete(key);
            req.onsuccess = () => {
                window.dispatchEvent(new CustomEvent('yorumi-downloads-updated'));
                resolve();
            };
            req.onerror = () => reject(req.error);
        });
    },

    async openDownloadsFolder(): Promise<boolean> {
        const isElectron = typeof window !== 'undefined' && Boolean(window.electronAPI?.openDownloadsFolder);
        if (isElectron && window.electronAPI) {
            try {
                return await window.electronAPI.openDownloadsFolder();
            } catch (error) {
                console.error('Failed to open downloads folder:', error);
            }
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
            quality?: string;
            audio?: 'sub' | 'dub';
            subtitles?: SubtitleTrack[];
        },
        onProgress?: (progress: ActiveDownloadProgress) => void
    ): Promise<DownloadedEpisode> {
        const isElectron = typeof window !== 'undefined' && Boolean(window.electronAPI?.downloadEpisodeChunked);
        if (isElectron && window.electronAPI) {
            let unsubscribe: ((event: unknown, progress: ActiveDownloadProgress) => void) | null = null;
            if (onProgress && window.electronAPI.onDownloadProgress) {
                unsubscribe = window.electronAPI.onDownloadProgress((p: ActiveDownloadProgress) => {
                    if (!p) return;
                    const matchesEp = Number(p.episodeNumber) === Number(params.episodeNumber);
                    const pId = String(p.animeId || '').trim().toLowerCase();
                    const targetId = String(params.animeId || '').trim().toLowerCase();
                    if (matchesEp && (pId === targetId || !pId || !targetId || pId.includes(targetId) || targetId.includes(pId))) {
                        onProgress(p);
                    }
                });
            }
            try {
                const downloaded = await window.electronAPI.downloadEpisodeChunked(params);
                window.dispatchEvent(new CustomEvent('yorumi-downloads-updated'));
                return downloaded;
            } finally {
                if (unsubscribe && window.electronAPI.offDownloadProgress) {
                    window.electronAPI.offDownloadProgress(unsubscribe);
                }
            }
        }

        const { animeId, animeTitle, animeImage, episodeNumber, episodeTitle, streamUrl, quality, audio, subtitles } = params;
        const key = this.getEpisodeKey(animeId, episodeNumber);

        try {
            let videoBlob: Blob;
            let finalSize = 0;
            let hlsDuration = 0;

            const isHls = streamUrl.includes('.m3u8') || streamUrl.includes('m3u8');

            if (isHls) {
                const result = await downloadHlsStream(streamUrl, (bytes, progress) => {
                    onProgress?.({
                        animeId,
                        episodeNumber,
                        progress,
                        status: 'downloading',
                        receivedBytes: bytes,
                        totalBytes: bytes,
                    });
                });
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
                        const { done, value } = await reader.read();
                        if (done) break;

                        if (value) {
                            chunks.push(value);
                            receivedBytes += value.length;
                            const progress = totalBytes > 0
                                ? Math.min(99, Math.round((receivedBytes / totalBytes) * 100))
                                : Math.min(99, Math.round(receivedBytes / (1024 * 1024 * 300) * 100));

                            onProgress?.({
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

            onProgress?.({
                animeId,
                episodeNumber,
                progress: 99,
                status: 'saving',
                receivedBytes: finalSize,
                totalBytes: finalSize,
            });

            // Pre-fetch subtitles for offline availability if present
            let offlineSubtitles: SubtitleTrack[] | undefined = subtitles;
            if (subtitles && subtitles.length > 0) {
                try {
                    offlineSubtitles = await Promise.all(
                        subtitles.map(async (sub) => {
                            try {
                                const subUrl = getFetchableUrl(sub.url);
                                const subRes = await fetch(subUrl);
                                if (subRes.ok) {
                                    const subText = await subRes.text();
                                    const subBlob = new Blob([subText], { type: 'text/vtt' });
                                    return { ...sub, url: URL.createObjectURL(subBlob) };
                                }
                            } catch (e) {
                                console.warn('Failed to pre-fetch subtitle for offline download:', e);
                            }
                            return sub;
                        })
                    );
                } catch {
                    offlineSubtitles = subtitles;
                }
            }

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

            onProgress?.({
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
            onProgress?.({
                animeId,
                episodeNumber,
                progress: 0,
                status: 'error',
                receivedBytes: 0,
                totalBytes: 0,
                error: errMessage,
            });
            throw error;
        }
    }
};

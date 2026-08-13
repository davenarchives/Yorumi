// IndexedDB storage and downloader for offline Manga chapters
import type { MangaPage, MangaChapter } from '../types/manga';
import { mangaService } from './mangaService';
import { API_BASE, API_ORIGIN } from '../config/api';

export interface DownloadedMangaPage {
    pageNumber: number;
    imageUrl: string;
    blob?: Blob;
    dataUrl?: string;
}

export interface DownloadedMangaChapter {
    id: string; // Format: `${mangaId}_ch_${chapterId}`
    mangaId: string;
    mangaTitle: string;
    mangaImage: string;
    chapterId: string;
    chapterTitle: string;
    chapterNumber?: number | string;
    chapterUrl: string;
    pages: DownloadedMangaPage[];
    totalPages: number;
    downloadedAt: number;
    fileSize?: number;
}

export interface ActiveMangaDownloadProgress {
    mangaId: string;
    chapterId: string;
    chapterTitle: string;
    progress: number; // 0 to 100
    status: 'downloading' | 'completed' | 'error';
    downloadedPages: number;
    totalPages: number;
    error?: string;
}

const DB_NAME = 'yorumi_manga_downloads_v1';
const STORE_NAME = 'chapters';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
            reject(new Error('IndexedDB is not supported'));
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('mangaId', 'mangaId', { unique: false });
                store.createIndex('downloadedAt', 'downloadedAt', { unique: false });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });

    return dbPromise;
}

function getProxiedImageUrl(rawUrl: string): string {
    if (!rawUrl) return '';
    if (rawUrl.startsWith('data:') || rawUrl.startsWith('blob:')) return rawUrl;
    if (rawUrl.startsWith('/')) {
        return `${API_ORIGIN}${rawUrl}`;
    }
    if (rawUrl.startsWith('http') && !rawUrl.includes('localhost:3001') && !rawUrl.includes('127.0.0.1:3001') && !rawUrl.startsWith(API_ORIGIN)) {
        return `${API_BASE}/scraper/proxy?url=${encodeURIComponent(rawUrl)}`;
    }
    return rawUrl;
}

export const mangaDownloadService = {
    getChapterKey(mangaId: string | number, chapterId: string | number): string {
        const m = String(mangaId || '').trim();
        const c = String(chapterId || '').trim();
        return `${m}_ch_${c}`;
    },

    async getDownloads(): Promise<DownloadedMangaChapter[]> {
        try {
            const db = await getDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const req = store.getAll();
                req.onsuccess = () => resolve((req.result as DownloadedMangaChapter[]) || []);
                req.onerror = () => reject(req.error);
            });
        } catch {
            return [];
        }
    },

    async getChapter(mangaId: string | number, chapterId: string | number): Promise<DownloadedMangaChapter | undefined> {
        try {
            const db = await getDB();
            const key = this.getChapterKey(mangaId, chapterId);
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const req = store.get(key);
                req.onsuccess = () => resolve(req.result as DownloadedMangaChapter | undefined);
                req.onerror = () => reject(req.error);
            });
        } catch {
            return undefined;
        }
    },

    async isChapterDownloaded(mangaId: string | number, chapterId: string | number): Promise<boolean> {
        const ch = await this.getChapter(mangaId, chapterId);
        return Boolean(ch && ch.pages && ch.pages.length > 0);
    },

    async downloadChapter(
        params: {
            mangaId: string | number;
            mangaTitle: string;
            mangaImage: string;
            chapter: MangaChapter;
        },
        onProgress?: (progress: ActiveMangaDownloadProgress) => void
    ): Promise<DownloadedMangaChapter> {
        const key = this.getChapterKey(params.mangaId, params.chapter.id);
        const chapterNumMatch = params.chapter.title.match(/Chapter\s+(\d+[.]?\d*)/i);
        const chapterNum = chapterNumMatch ? chapterNumMatch[1] : undefined;

        onProgress?.({
            mangaId: String(params.mangaId),
            chapterId: String(params.chapter.id),
            chapterTitle: params.chapter.title,
            progress: 5,
            status: 'downloading',
            downloadedPages: 0,
            totalPages: 0,
        });

        // 1. Fetch chapter pages
        const resData = await mangaService.getChapterPages(params.chapter.url);
        const rawPages: MangaPage[] = Array.isArray(resData) ? resData : resData?.pages || [];
        if (!rawPages || rawPages.length === 0) {
            throw new Error('No pages found in chapter');
        }

        const totalPages = rawPages.length;
        const downloadedPages: DownloadedMangaPage[] = [];
        let totalBytes = 0;

        // 2. Fetch page images in small parallel batches
        const BATCH_SIZE = 4;
        for (let i = 0; i < totalPages; i += BATCH_SIZE) {
            const batch = rawPages.slice(i, i + BATCH_SIZE);
            await Promise.all(
                batch.map(async (page: MangaPage, bIdx: number) => {
                    const pageIndex = i + bIdx;
                    try {
                        const proxiedUrl = getProxiedImageUrl(page.imageUrl);
                        const res = await fetch(proxiedUrl);
                        if (!res.ok) throw new Error(`Failed to fetch page ${page.pageNumber}`);
                        const blob = await res.blob();
                        totalBytes += blob.size;

                        // Create local object URL for offline display
                        const blobUrl = URL.createObjectURL(blob);
                        downloadedPages[pageIndex] = {
                            pageNumber: page.pageNumber,
                            imageUrl: blobUrl,
                            blob: blob,
                        };
                    } catch {
                        // Fallback to original image URL if fetch fails
                        downloadedPages[pageIndex] = {
                            pageNumber: page.pageNumber,
                            imageUrl: page.imageUrl,
                        };
                    }
                })
            );

            const progressPct = Math.min(95, Math.round(((i + batch.length) / totalPages) * 90) + 5);
            onProgress?.({
                mangaId: String(params.mangaId),
                chapterId: String(params.chapter.id),
                chapterTitle: params.chapter.title,
                progress: progressPct,
                status: 'downloading',
                downloadedPages: Math.min(totalPages, i + batch.length),
                totalPages,
            });
        }

        // 3. Save to IndexedDB
        const chapterRecord: DownloadedMangaChapter = {
            id: key,
            mangaId: String(params.mangaId),
            mangaTitle: params.mangaTitle,
            mangaImage: params.mangaImage,
            chapterId: String(params.chapter.id),
            chapterTitle: params.chapter.title,
            chapterNumber: chapterNum,
            chapterUrl: params.chapter.url,
            pages: downloadedPages,
            totalPages,
            downloadedAt: Date.now(),
            fileSize: totalBytes,
        };

        const db = await getDB();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.put(chapterRecord);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });

        // 4. Save to physical disk in Electron if available
        if (typeof window !== 'undefined' && window.electronAPI?.saveMangaDisk) {
            try {
                const diskPages = await Promise.all(
                    downloadedPages.map(async (p, idx) => {
                        let blob = p.blob;
                        if (!blob && p.imageUrl) {
                            try {
                                const proxied = getProxiedImageUrl(p.imageUrl);
                                const res = await fetch(proxied);
                                if (res.ok) blob = await res.blob();
                            } catch {}
                        }
                        if (!blob) return null;
                        try {
                            const buffer = await blob.arrayBuffer();
                            const type = blob.type || '';
                            let ext = '.jpg';
                            if (type.includes('png')) ext = '.png';
                            else if (type.includes('webp')) ext = '.webp';
                            return { pageNumber: p.pageNumber || (idx + 1), buffer, ext };
                        } catch {
                            return null;
                        }
                    })
                );
                const validDiskPages = diskPages.filter(Boolean) as { pageNumber: number; buffer: ArrayBuffer; ext?: string }[];
                if (validDiskPages.length > 0) {
                    await window.electronAPI.saveMangaDisk({
                        mangaTitle: params.mangaTitle,
                        chapterTitle: params.chapter.title,
                        pages: validDiskPages,
                    });
                }
            } catch (err) {
                console.error('Failed saving manga chapter to physical disk:', err);
            }
        }

        onProgress?.({
            mangaId: String(params.mangaId),
            chapterId: String(params.chapter.id),
            chapterTitle: params.chapter.title,
            progress: 100,
            status: 'completed',
            downloadedPages: totalPages,
            totalPages,
        });

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('yorumi-manga-downloads-updated'));
        }

        return chapterRecord;
    },

    async syncExistingDownloadsToDisk(): Promise<void> {
        if (typeof window === 'undefined' || !window.electronAPI?.saveMangaDisk) return;
        try {
            const downloads = await this.getDownloads();
            for (const item of downloads) {
                if (!item.pages || item.pages.length === 0) continue;
                const diskPages = await Promise.all(
                    item.pages.map(async (p, idx) => {
                        let blob = p.blob;
                        if (!blob && p.imageUrl) {
                            try {
                                const proxied = getProxiedImageUrl(p.imageUrl);
                                const res = await fetch(proxied);
                                if (res.ok) blob = await res.blob();
                            } catch {}
                        }
                        if (!blob) return null;
                        try {
                            const buffer = await blob.arrayBuffer();
                            const type = blob.type || '';
                            let ext = '.jpg';
                            if (type.includes('png')) ext = '.png';
                            else if (type.includes('webp')) ext = '.webp';
                            return { pageNumber: p.pageNumber || (idx + 1), buffer, ext };
                        } catch {
                            return null;
                        }
                    })
                );
                const validPages = diskPages.filter(Boolean) as { pageNumber: number; buffer: ArrayBuffer; ext?: string }[];
                if (validPages.length > 0) {
                    await window.electronAPI.saveMangaDisk({
                        mangaTitle: item.mangaTitle,
                        chapterTitle: item.chapterTitle,
                        pages: validPages,
                    });
                }
            }
        } catch (err) {
            console.error('Failed syncing manga downloads to disk:', err);
        }
    },

    async deleteDownload(mangaId: string | number, chapterId: string | number): Promise<void> {
        try {
            const db = await getDB();
            const key = this.getChapterKey(mangaId, chapterId);
            const chapter = await this.getChapter(mangaId, chapterId);

            if (chapter && typeof window !== 'undefined' && window.electronAPI?.deleteMangaDisk) {
                try {
                    await window.electronAPI.deleteMangaDisk({
                        mangaTitle: chapter.mangaTitle,
                        chapterTitle: chapter.chapterTitle,
                    });
                } catch {}
            }

            await new Promise<void>((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                const req = store.delete(key);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });

            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('yorumi-manga-downloads-updated'));
            }
        } catch (error) {
            console.error('Failed to delete manga chapter download:', error);
        }
    },
};

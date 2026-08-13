// IndexedDB storage and downloader for offline Light Novel chapters
import type { LNChapter, LNChapterContent } from '../types/ln';
import { lnService } from './lnService';

export interface DownloadedLNChapter {
    id: string; // Format: `${novelId}_ch_${chapterId}`
    novelId: string;
    novelTitle: string;
    novelImage: string;
    chapterId: string;
    chapterTitle: string;
    chapterNumber?: number | string;
    content: string;
    prevChapterId?: string;
    nextChapterId?: string;
    downloadedAt: number;
    wordCount?: number;
}

export interface ActiveLNDownloadProgress {
    novelId: string;
    chapterId: string;
    chapterTitle: string;
    progress: number; // 0 to 100
    status: 'downloading' | 'completed' | 'error';
    error?: string;
}

const DB_NAME = 'yorumi_ln_downloads_v1';
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
                store.createIndex('novelId', 'novelId', { unique: false });
                store.createIndex('downloadedAt', 'downloadedAt', { unique: false });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });

    return dbPromise;
}

export const lnDownloadService = {
    getChapterKey(novelId: string | number, chapterId: string | number): string {
        const n = String(novelId || '').trim();
        const c = String(chapterId || '').trim();
        return `${n}_ch_${c}`;
    },

    async getDownloads(): Promise<DownloadedLNChapter[]> {
        try {
            const db = await getDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const req = store.getAll();
                req.onsuccess = () => resolve((req.result as DownloadedLNChapter[]) || []);
                req.onerror = () => reject(req.error);
            });
        } catch {
            return [];
        }
    },

    async getChapter(novelId: string | number, chapterId: string | number): Promise<DownloadedLNChapter | undefined> {
        try {
            const db = await getDB();
            const key = this.getChapterKey(novelId, chapterId);
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const req = store.get(key);
                req.onsuccess = () => resolve(req.result as DownloadedLNChapter | undefined);
                req.onerror = () => reject(req.error);
            });
        } catch {
            return undefined;
        }
    },

    async isChapterDownloaded(novelId: string | number, chapterId: string | number): Promise<boolean> {
        const ch = await this.getChapter(novelId, chapterId);
        return Boolean(ch && ch.content);
    },

    async downloadChapter(
        params: {
            novelId: string | number;
            novelTitle: string;
            novelImage: string;
            chapter: LNChapter;
        },
        onProgress?: (progress: ActiveLNDownloadProgress) => void
    ): Promise<DownloadedLNChapter> {
        const key = this.getChapterKey(params.novelId, params.chapter.id);

        onProgress?.({
            novelId: String(params.novelId),
            chapterId: String(params.chapter.id),
            chapterTitle: params.chapter.title,
            progress: 20,
            status: 'downloading',
        });

        // 1. Fetch chapter text content
        const data: LNChapterContent | null = await lnService.getChapterContent(params.chapter.id);
        if (!data || !data.content) {
            throw new Error('Failed to retrieve chapter content');
        }

        onProgress?.({
            novelId: String(params.novelId),
            chapterId: String(params.chapter.id),
            chapterTitle: params.chapter.title,
            progress: 75,
            status: 'downloading',
        });

        // Calculate approximate word count
        const textOnly = data.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        const wordCount = textOnly ? textOnly.split(' ').length : 0;

        // 2. Save to IndexedDB
        const chapterRecord: DownloadedLNChapter = {
            id: key,
            novelId: String(params.novelId),
            novelTitle: params.novelTitle,
            novelImage: params.novelImage,
            chapterId: String(params.chapter.id),
            chapterTitle: data.title || params.chapter.title,
            chapterNumber: data.chapterNumber || params.chapter.number,
            content: data.content,
            prevChapterId: data.prevChapterId || undefined,
            nextChapterId: data.nextChapterId || undefined,
            downloadedAt: Date.now(),
            wordCount,
        };

        const db = await getDB();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.put(chapterRecord);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });

        // 3. Save to physical disk in Electron if available
        if (typeof window !== 'undefined' && window.electronAPI?.saveLNDisk) {
            try {
                await window.electronAPI.saveLNDisk({
                    novelTitle: params.novelTitle,
                    chapterTitle: data.title || params.chapter.title,
                    content: textOnly,
                });
            } catch (err) {
                console.error('Failed saving LN chapter to physical disk:', err);
            }
        }

        onProgress?.({
            novelId: String(params.novelId),
            chapterId: String(params.chapter.id),
            chapterTitle: params.chapter.title,
            progress: 100,
            status: 'completed',
        });

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('yorumi-ln-downloads-updated'));
        }

        return chapterRecord;
    },

    async syncExistingDownloadsToDisk(): Promise<void> {
        if (typeof window === 'undefined' || !window.electronAPI?.saveLNDisk) return;
        try {
            const downloads = await this.getDownloads();
            for (const item of downloads) {
                if (!item.content) continue;
                const textOnly = item.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                await window.electronAPI.saveLNDisk({
                    novelTitle: item.novelTitle,
                    chapterTitle: item.chapterTitle,
                    content: textOnly,
                });
            }
        } catch (err) {
            console.error('Failed syncing LN downloads to disk:', err);
        }
    },

    async deleteDownload(novelId: string | number, chapterId: string | number): Promise<void> {
        try {
            const db = await getDB();
            const key = this.getChapterKey(novelId, chapterId);
            const chapter = await this.getChapter(novelId, chapterId);

            if (chapter && typeof window !== 'undefined' && window.electronAPI?.deleteLNDisk) {
                try {
                    await window.electronAPI.deleteLNDisk({
                        novelTitle: chapter.novelTitle,
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
                window.dispatchEvent(new CustomEvent('yorumi-ln-downloads-updated'));
            }
        } catch (error) {
            console.error('Failed to delete LN chapter download:', error);
        }
    },
};

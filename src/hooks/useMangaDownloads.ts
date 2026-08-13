import { useState, useEffect, useCallback } from 'react';
import {
    mangaDownloadService,
    type DownloadedMangaChapter,
    type ActiveMangaDownloadProgress,
} from '../services/mangaDownloadService';
import type { MangaChapter } from '../types/manga';

const activeMangaDownloadsMap = new Map<string, ActiveMangaDownloadProgress>();
const listeners = new Set<() => void>();

function notifyListeners() {
    listeners.forEach((fn) => fn());
}

export function useMangaDownloads() {
    const [downloads, setDownloads] = useState<DownloadedMangaChapter[]>([]);
    const [activeDownloads, setActiveDownloads] = useState<Map<string, ActiveMangaDownloadProgress>>(
        new Map(activeMangaDownloadsMap)
    );
    const [loading, setLoading] = useState(true);

    const loadDownloads = useCallback(async () => {
        try {
            const list = await mangaDownloadService.getDownloads();
            setDownloads(list);
        } catch (err) {
            console.error('Failed to load manga downloads:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadDownloads();
        mangaDownloadService.syncExistingDownloadsToDisk();

        const handleUpdate = () => {
            loadDownloads();
        };

        const handleGlobalProgress = () => {
            setActiveDownloads(new Map(activeMangaDownloadsMap));
        };

        listeners.add(handleGlobalProgress);
        window.addEventListener('yorumi-manga-downloads-updated', handleUpdate);

        return () => {
            listeners.delete(handleGlobalProgress);
            window.removeEventListener('yorumi-manga-downloads-updated', handleUpdate);
        };
    }, [loadDownloads]);

    const isChapterDownloaded = useCallback(
        (mangaId: string | number | undefined, chapterId: string | number | undefined): boolean => {
            if (!downloads || downloads.length === 0 || !mangaId || !chapterId) return false;
            const targetKey = mangaDownloadService.getChapterKey(mangaId, chapterId);
            return downloads.some((d) => d.id === targetKey || (String(d.mangaId) === String(mangaId) && String(d.chapterId) === String(chapterId)));
        },
        [downloads]
    );

    const getDownloadProgress = useCallback(
        (mangaId: string | number | undefined, chapterId: string | number | undefined): ActiveMangaDownloadProgress | undefined => {
            if (!mangaId || !chapterId) return undefined;
            const targetKey = mangaDownloadService.getChapterKey(mangaId, chapterId);
            return activeDownloads.get(targetKey);
        },
        [activeDownloads]
    );

    const startDownload = useCallback(
        async (params: {
            mangaId: string | number;
            mangaTitle: string;
            mangaImage: string;
            chapter: MangaChapter;
        }) => {
            const key = mangaDownloadService.getChapterKey(params.mangaId, params.chapter.id);

            const initialProg: ActiveMangaDownloadProgress = {
                mangaId: String(params.mangaId),
                chapterId: String(params.chapter.id),
                chapterTitle: params.chapter.title,
                progress: 0,
                status: 'downloading',
                downloadedPages: 0,
                totalPages: 0,
            };
            activeMangaDownloadsMap.set(key, initialProg);
            notifyListeners();

            try {
                const downloaded = await mangaDownloadService.downloadChapter(params, (progress) => {
                    activeMangaDownloadsMap.set(key, progress);
                    notifyListeners();
                });

                setTimeout(() => {
                    activeMangaDownloadsMap.delete(key);
                    notifyListeners();
                }, 1500);

                return downloaded;
            } catch (error) {
                console.error(`Manga chapter download failed for ${params.chapter.title}:`, error);
                setTimeout(() => {
                    activeMangaDownloadsMap.delete(key);
                    notifyListeners();
                }, 3000);
                throw error;
            }
        },
        []
    );

    const downloadAll = useCallback(
        async (
            manga: { id: string | number; title: string; image?: string },
            chapters: MangaChapter[]
        ) => {
            const unDownloadedChapters = chapters.filter(
                (ch) => !isChapterDownloaded(manga.id, ch.id) && !getDownloadProgress(manga.id, ch.id)
            );

            if (unDownloadedChapters.length === 0) return;

            // Set all active states immediately
            unDownloadedChapters.forEach((ch) => {
                const key = mangaDownloadService.getChapterKey(manga.id, ch.id);
                activeMangaDownloadsMap.set(key, {
                    mangaId: String(manga.id),
                    chapterId: String(ch.id),
                    chapterTitle: ch.title,
                    progress: 2,
                    status: 'downloading',
                    downloadedPages: 0,
                    totalPages: 0,
                });
            });
            notifyListeners();

            // Download in parallel batches
            await Promise.allSettled(
                unDownloadedChapters.map((ch) =>
                    startDownload({
                        mangaId: manga.id,
                        mangaTitle: manga.title,
                        mangaImage: manga.image || '',
                        chapter: ch,
                    })
                )
            );
        },
        [isChapterDownloaded, getDownloadProgress, startDownload]
    );

    const deleteDownload = useCallback(async (mangaId: string | number, chapterId: string | number) => {
        try {
            await mangaDownloadService.deleteDownload(mangaId, chapterId);
        } catch (error) {
            console.error('Failed to delete manga chapter download:', error);
        }
    }, []);

    return {
        downloads,
        loading,
        isChapterDownloaded,
        getDownloadProgress,
        startDownload,
        downloadAll,
        deleteDownload,
        refreshDownloads: loadDownloads,
    };
}

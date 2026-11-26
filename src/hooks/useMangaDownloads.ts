import { useState, useEffect, useCallback } from 'react';
import {
    mangaDownloadService,
    type DownloadedMangaChapter,
    type ActiveMangaDownloadProgress,
} from '../services/mangaDownloadService';
import type { MangaChapter } from '../types/manga';
import {
    completeDownloadNotification,
    failDownloadNotification,
    showDownloadNotification,
    updateDownloadNotification,
} from '../platform/downloadNotification';

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
        void mangaDownloadService.syncExistingDownloadsToDisk();

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
            silentNotification?: boolean;
        }) => {
            const key = mangaDownloadService.getChapterKey(params.mangaId, params.chapter.id);

            const initialProg: ActiveMangaDownloadProgress = {
                mangaId: String(params.mangaId),
                mangaTitle: params.mangaTitle,
                chapterId: String(params.chapter.id),
                chapterTitle: params.chapter.title,
                progress: 0,
                status: 'downloading',
                downloadedPages: 0,
                totalPages: 0,
            };
            activeMangaDownloadsMap.set(key, initialProg);
            notifyListeners();

            const notificationBase = {
                mediaType: 'manga' as const,
                animeId: String(params.mangaId),
                episodeNumber: 0,
                animeTitle: params.mangaTitle,
                episodeTitle: params.chapter.title,
            };
            if (!params.silentNotification) {
                void showDownloadNotification({ ...notificationBase, progress: 1 });
            }

            try {
                const downloaded = await mangaDownloadService.downloadChapter(params, (progress) => {
                    activeMangaDownloadsMap.set(key, { ...progress, mangaTitle: params.mangaTitle });
                    notifyListeners();
                    if (!params.silentNotification && progress.status === 'downloading') {
                        void updateDownloadNotification({ ...notificationBase, progress: Math.max(1, progress.progress) });
                    }
                });

                if (!params.silentNotification) {
                    void completeDownloadNotification({ ...notificationBase, progress: 100 });
                }

                setTimeout(() => {
                    activeMangaDownloadsMap.delete(key);
                    notifyListeners();
                }, 1500);

                return downloaded;
            } catch (error) {
                console.error(`Manga chapter download failed for ${params.chapter.title}:`, error);
                if (!params.silentNotification) {
                    void failDownloadNotification({
                        ...notificationBase,
                        progress: 0,
                        message: error instanceof Error ? error.message : 'Download failed',
                    });
                }
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
                    mangaTitle: manga.title,
                    chapterId: String(ch.id),
                    chapterTitle: ch.title,
                    progress: 2,
                    status: 'downloading',
                    downloadedPages: 0,
                    totalPages: 0,
                });
            });
            notifyListeners();

            const total = unDownloadedChapters.length;
            let completed = 0;
            const batchNotifBase = {
                mediaType: 'manga' as const,
                animeId: String(manga.id),
                episodeNumber: 0,
                animeTitle: manga.title,
            };
            void showDownloadNotification({
                ...batchNotifBase,
                episodeTitle: total === 1 ? unDownloadedChapters[0].title : `${unDownloadedChapters[0].title} (0/${total})`,
                progress: 1,
            });

            // Keep scraper/image traffic bounded so large series do not
            // overwhelm the source or the native loopback proxy.
            const concurrency = 2;
            for (let i = 0; i < unDownloadedChapters.length; i += concurrency) {
                const batch = unDownloadedChapters.slice(i, i + concurrency);
                await Promise.allSettled(
                    batch.map(async (ch) => {
                        await startDownload({
                            mangaId: manga.id,
                            mangaTitle: manga.title,
                            mangaImage: manga.image || '',
                            chapter: ch,
                            silentNotification: true,
                        });
                        completed += 1;
                        const pct = Math.min(99, Math.round((completed / total) * 100));
                        void updateDownloadNotification({
                            ...batchNotifBase,
                            episodeTitle: total === 1 ? ch.title : `${ch.title} (${completed}/${total})`,
                            progress: Math.max(1, pct),
                        });
                    })
                );
            }

            if (completed > 0) {
                void completeDownloadNotification({
                    ...batchNotifBase,
                    episodeTitle: completed === 1 ? unDownloadedChapters[0].title : `${completed} chapters`,
                    progress: 100,
                });
            } else {
                void failDownloadNotification({
                    ...batchNotifBase,
                    episodeTitle: total === 1 ? unDownloadedChapters[0].title : `${total} chapters`,
                    progress: 0,
                    message: 'Download failed',
                });
            }
        },
        [isChapterDownloaded, getDownloadProgress, startDownload]
    );

    const cancelDownload = useCallback((mangaId: string | number, chapterId: string | number) => {
        const key = mangaDownloadService.getChapterKey(mangaId, chapterId);
        activeMangaDownloadsMap.delete(key);
        notifyListeners();
    }, []);

    const deleteDownload = useCallback(async (mangaId: string | number, chapterId: string | number) => {
        try {
            await mangaDownloadService.deleteDownload(mangaId, chapterId);
        } catch (error) {
            console.error('Failed to delete manga chapter download:', error);
        }
    }, []);

    return {
        downloads,
        activeDownloads,
        loading,
        isChapterDownloaded,
        getDownloadProgress,
        startDownload,
        cancelDownload,
        downloadAll,
        deleteDownload,
        refreshDownloads: loadDownloads,
    };
}

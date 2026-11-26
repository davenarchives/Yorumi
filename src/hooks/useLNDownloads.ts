import { useState, useEffect, useCallback } from 'react';
import {
    lnDownloadService,
    type DownloadedLNChapter,
    type ActiveLNDownloadProgress,
} from '../services/lnDownloadService';
import type { LNChapter } from '../types/ln';
import {
    completeDownloadNotification,
    failDownloadNotification,
    showDownloadNotification,
    updateDownloadNotification,
} from '../platform/downloadNotification';

const activeLNDownloadsMap = new Map<string, ActiveLNDownloadProgress>();
const listeners = new Set<() => void>();

function notifyListeners() {
    listeners.forEach((fn) => fn());
}

export function useLNDownloads() {
    const [downloads, setDownloads] = useState<DownloadedLNChapter[]>([]);
    const [activeDownloads, setActiveDownloads] = useState<Map<string, ActiveLNDownloadProgress>>(
        new Map(activeLNDownloadsMap)
    );
    const [loading, setLoading] = useState(true);

    const loadDownloads = useCallback(async () => {
        try {
            const list = await lnDownloadService.getDownloads();
            setDownloads(list);
        } catch (err) {
            console.error('Failed to load LN downloads:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadDownloads();
        void lnDownloadService.syncExistingDownloadsToDisk();

        const handleUpdate = () => {
            loadDownloads();
        };

        const handleGlobalProgress = () => {
            setActiveDownloads(new Map(activeLNDownloadsMap));
        };

        listeners.add(handleGlobalProgress);
        window.addEventListener('yorumi-ln-downloads-updated', handleUpdate);

        return () => {
            listeners.delete(handleGlobalProgress);
            window.removeEventListener('yorumi-ln-downloads-updated', handleUpdate);
        };
    }, [loadDownloads]);

    const isChapterDownloaded = useCallback(
        (novelId: string | number | undefined, chapterId: string | number | undefined): boolean => {
            if (!downloads || downloads.length === 0 || !novelId || !chapterId) return false;
            const targetKey = lnDownloadService.getChapterKey(novelId, chapterId);
            return downloads.some((d) => d.id === targetKey || (String(d.novelId) === String(novelId) && String(d.chapterId) === String(chapterId)));
        },
        [downloads]
    );

    const getDownloadProgress = useCallback(
        (novelId: string | number | undefined, chapterId: string | number | undefined): ActiveLNDownloadProgress | undefined => {
            if (!novelId || !chapterId) return undefined;
            const targetKey = lnDownloadService.getChapterKey(novelId, chapterId);
            return activeDownloads.get(targetKey);
        },
        [activeDownloads]
    );

    const startDownload = useCallback(
        async (params: {
            novelId: string | number;
            novelTitle: string;
            novelImage: string;
            chapter: LNChapter;
            silentNotification?: boolean;
        }) => {
            const key = lnDownloadService.getChapterKey(params.novelId, params.chapter.id);

            const initialProg: ActiveLNDownloadProgress = {
                novelId: String(params.novelId),
                novelTitle: params.novelTitle,
                chapterId: String(params.chapter.id),
                chapterTitle: params.chapter.title,
                progress: 0,
                status: 'downloading',
            };
            activeLNDownloadsMap.set(key, initialProg);
            notifyListeners();

            const notificationBase = {
                mediaType: 'ln' as const,
                animeId: String(params.novelId),
                episodeNumber: 0,
                animeTitle: params.novelTitle,
                episodeTitle: params.chapter.title,
            };
            if (!params.silentNotification) {
                void showDownloadNotification({ ...notificationBase, progress: 1 });
            }

            try {
                const downloaded = await lnDownloadService.downloadChapter(params, (progress) => {
                    activeLNDownloadsMap.set(key, { ...progress, novelTitle: params.novelTitle });
                    notifyListeners();
                    if (!params.silentNotification && progress.status === 'downloading') {
                        void updateDownloadNotification({ ...notificationBase, progress: Math.max(1, progress.progress) });
                    }
                });

                if (!params.silentNotification) {
                    void completeDownloadNotification({ ...notificationBase, progress: 100 });
                }

                setTimeout(() => {
                    activeLNDownloadsMap.delete(key);
                    notifyListeners();
                }, 1500);

                return downloaded;
            } catch (error) {
                console.error(`LN chapter download failed for ${params.chapter.title}:`, error);
                if (!params.silentNotification) {
                    void failDownloadNotification({
                        ...notificationBase,
                        progress: 0,
                        message: error instanceof Error ? error.message : 'Download failed',
                    });
                }
                setTimeout(() => {
                    activeLNDownloadsMap.delete(key);
                    notifyListeners();
                }, 3000);
                throw error;
            }
        },
        []
    );

    const downloadAll = useCallback(
        async (
            novel: { id: string | number; title: string; image?: string },
            chapters: LNChapter[]
        ) => {
            const unDownloadedChapters = chapters.filter(
                (ch) => !isChapterDownloaded(novel.id, ch.id) && !getDownloadProgress(novel.id, ch.id)
            );

            if (unDownloadedChapters.length === 0) return;

            // Set all active states immediately
            unDownloadedChapters.forEach((ch) => {
                const key = lnDownloadService.getChapterKey(novel.id, ch.id);
                activeLNDownloadsMap.set(key, {
                    novelId: String(novel.id),
                    novelTitle: novel.title,
                    chapterId: String(ch.id),
                    chapterTitle: ch.title,
                    progress: 10,
                    status: 'downloading',
                });
            });
            notifyListeners();

            const total = unDownloadedChapters.length;
            let completed = 0;
            const batchNotifBase = {
                mediaType: 'ln' as const,
                animeId: String(novel.id),
                episodeNumber: 0,
                animeTitle: novel.title,
            };
            void showDownloadNotification({
                ...batchNotifBase,
                episodeTitle: total === 1 ? unDownloadedChapters[0].title : `${unDownloadedChapters[0].title} (0/${total})`,
                progress: 1,
            });

            // Novel sources rate-limit aggressively; a small queue keeps
            // bulk downloads reliable while still allowing some concurrency.
            const concurrency = 2;
            for (let i = 0; i < unDownloadedChapters.length; i += concurrency) {
                const batch = unDownloadedChapters.slice(i, i + concurrency);
                await Promise.allSettled(
                    batch.map(async (ch) => {
                        await startDownload({
                            novelId: novel.id,
                            novelTitle: novel.title,
                            novelImage: novel.image || '',
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

    const cancelDownload = useCallback((novelId: string | number, chapterId: string | number) => {
        const key = lnDownloadService.getChapterKey(novelId, chapterId);
        activeLNDownloadsMap.delete(key);
        notifyListeners();
    }, []);

    const deleteDownload = useCallback(async (novelId: string | number, chapterId: string | number) => {
        try {
            await lnDownloadService.deleteDownload(novelId, chapterId);
        } catch (error) {
            console.error('Failed to delete LN chapter download:', error);
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

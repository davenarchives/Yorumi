import { useState, useEffect, useCallback } from 'react';
import {
    lnDownloadService,
    type DownloadedLNChapter,
    type ActiveLNDownloadProgress,
} from '../services/lnDownloadService';
import type { LNChapter } from '../types/ln';

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
        lnDownloadService.syncExistingDownloadsToDisk();

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
        }) => {
            const key = lnDownloadService.getChapterKey(params.novelId, params.chapter.id);

            const initialProg: ActiveLNDownloadProgress = {
                novelId: String(params.novelId),
                chapterId: String(params.chapter.id),
                chapterTitle: params.chapter.title,
                progress: 0,
                status: 'downloading',
            };
            activeLNDownloadsMap.set(key, initialProg);
            notifyListeners();

            try {
                const downloaded = await lnDownloadService.downloadChapter(params, (progress) => {
                    activeLNDownloadsMap.set(key, progress);
                    notifyListeners();
                });

                setTimeout(() => {
                    activeLNDownloadsMap.delete(key);
                    notifyListeners();
                }, 1500);

                return downloaded;
            } catch (error) {
                console.error(`LN chapter download failed for ${params.chapter.title}:`, error);
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
                    chapterId: String(ch.id),
                    chapterTitle: ch.title,
                    progress: 10,
                    status: 'downloading',
                });
            });
            notifyListeners();

            // Download in parallel batches
            await Promise.allSettled(
                unDownloadedChapters.map((ch) =>
                    startDownload({
                        novelId: novel.id,
                        novelTitle: novel.title,
                        novelImage: novel.image || '',
                        chapter: ch,
                    })
                )
            );
        },
        [isChapterDownloaded, getDownloadProgress, startDownload]
    );

    const deleteDownload = useCallback(async (novelId: string | number, chapterId: string | number) => {
        try {
            await lnDownloadService.deleteDownload(novelId, chapterId);
        } catch (error) {
            console.error('Failed to delete LN chapter download:', error);
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

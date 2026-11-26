import { useState, useEffect, useCallback } from 'react';
import { cacheImage } from '../services/offlineImageCache';
import { storage, type ReadProgress } from '../utils/storage';
import { useActivityHistory } from './useActivityHistory';

interface Manga {
    id?: number | string;
    mal_id: number | string;
    scraper_id?: string;
    title: string;
    status?: string;
    chapters?: number | null;
    images: {
        jpg: {
            image_url?: string;
            large_image_url: string;
        };
    };
}

interface Chapter {
    id: string;
    chapter: string; // "1" or "10.5"
    title?: string;
}

export function useContinueReading() {
    const { recordActivity } = useActivityHistory();
    const [continueReadingList, setContinueReadingList] = useState<ReadProgress[]>(() => storage.getContinueReading());

    const reload = useCallback(() => {
        setContinueReadingList(storage.getContinueReading());
    }, []);

    // Subscribe to local storage updates
    useEffect(() => {
        window.addEventListener('yorumi-storage-updated', reload);
        return () => window.removeEventListener('yorumi-storage-updated', reload);
    }, [reload]);

    const saveProgress = useCallback(async (manga: Manga, chapter: Chapter) => {
        const mangaId = String(manga.scraper_id || manga.id || manga.mal_id);

        const progress: ReadProgress = {
            mangaId,
            chapterId: chapter.id,
            chapterNumber: chapter.chapter,
            timestamp: Date.now(),
            lastRead: Date.now(),
            mangaTitle: manga.title,
            mangaImage: manga.images.jpg.large_image_url,
            mangaPoster: manga.images.jpg.image_url || manga.images.jpg.large_image_url,
            totalCount: typeof manga.chapters === 'number' && manga.chapters > 0 ? manga.chapters : undefined,
            mediaStatus: manga.status
        };

        storage.saveReadingProgress(progress);

        if (typeof navigator === 'undefined' || navigator.onLine) {
            const posterToCache = progress.mangaPoster || progress.mangaImage;
            if (posterToCache) {
                void cacheImage(posterToCache).catch(() => undefined);
            }
        }

        try {
            await recordActivity(`manga:${mangaId}:ch:${progress.chapterNumber}`);
        } catch (error) {
            console.error("Failed to record read activity:", error);
        }
    }, [recordActivity]);

    const removeFromHistory = useCallback(async (mangaId: string) => {
        storage.removeFromContinueReading(mangaId.toString());
    }, []);

    return {
        continueReadingList,
        saveProgress,
        removeFromHistory
    };
}

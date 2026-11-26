import { useState, useEffect } from 'react';
import { useActivityHistory } from './useActivityHistory';
import { isIncognitoMode } from '../utils/appPrefs';
import { cacheImage } from '../services/offlineImageCache';
import { persistOfflineHistoryKey } from '../services/offlineHistoryStore';

export interface LNReadingProgress {
    novelId: string | number;
    novelTitle: string;
    coverImage: string;
    chapterId: string;
    chapterNumber: number;
    chapterTitle: string;
    updatedAt: string;
}

const STORAGE_KEY = 'yorumi_ln_continue_reading_v1';
const STORAGE_EVENT = 'yorumi-storage-updated';

const readLNProgress = (): LNReadingProgress[] => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

export function useContinueLNReading() {
    const { recordActivity } = useActivityHistory();
    const [continueReadingList, setContinueReadingList] = useState<LNReadingProgress[]>(readLNProgress);

    useEffect(() => {
        const reload = () => setContinueReadingList(readLNProgress());
        window.addEventListener(STORAGE_EVENT, reload);
        return () => window.removeEventListener(STORAGE_EVENT, reload);
    }, []);

    const saveLNProgress = (progress: Omit<LNReadingProgress, 'updatedAt'>) => {
        if (isIncognitoMode()) return;
        try {
            const item: LNReadingProgress = {
                ...progress,
                updatedAt: new Date().toISOString(),
            };
            setContinueReadingList((prev) => {
                const filtered = prev.filter((p) => String(p.novelId) !== String(progress.novelId));
                const updated = [item, ...filtered].slice(0, 200);
                const serialized = JSON.stringify(updated);
                persistOfflineHistoryKey(STORAGE_KEY, serialized);
                try {
                    localStorage.setItem(STORAGE_KEY, serialized);
                } catch {
                    // IndexedDB mirror still holds durable copy
                }
                window.dispatchEvent(new CustomEvent(STORAGE_EVENT));
                return updated;
            });
            if ((typeof navigator === 'undefined' || navigator.onLine) && progress.coverImage) {
                void cacheImage(progress.coverImage).catch(() => undefined);
            }
            void recordActivity(`ln:${progress.novelId}:ch:${progress.chapterNumber}`).catch(() => undefined);
        } catch (e) {
            console.error('Failed to save LN reading progress:', e);
        }
    };

    const removeLNProgress = (novelId: string | number) => {
        try {
            setContinueReadingList((prev) => {
                const updated = prev.filter((p) => String(p.novelId) !== String(novelId));
                const serialized = JSON.stringify(updated);
                persistOfflineHistoryKey(STORAGE_KEY, serialized);
                try {
                    localStorage.setItem(STORAGE_KEY, serialized);
                } catch {
                    // Best effort
                }
                window.dispatchEvent(new CustomEvent(STORAGE_EVENT));
                return updated;
            });
        } catch (e) {
            console.error('Failed to remove LN reading progress:', e);
        }
    };

    return {
        continueReadingList,
        saveLNProgress,
        removeLNProgress,
    };
}

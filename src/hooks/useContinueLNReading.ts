import { useState, useEffect } from 'react';

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

export function useContinueLNReading() {
    const [continueReadingList, setContinueReadingList] = useState<LNReadingProgress[]>(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    });

    const saveLNProgress = (progress: Omit<LNReadingProgress, 'updatedAt'>) => {
        try {
            const item: LNReadingProgress = {
                ...progress,
                updatedAt: new Date().toISOString(),
            };
            setContinueReadingList((prev) => {
                const filtered = prev.filter((p) => String(p.novelId) !== String(progress.novelId));
                const updated = [item, ...filtered];
                localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
                return updated;
            });
        } catch (e) {
            console.error('Failed to save LN reading progress:', e);
        }
    };

    const removeLNProgress = (novelId: string | number) => {
        try {
            setContinueReadingList((prev) => {
                const updated = prev.filter((p) => String(p.novelId) !== String(novelId));
                localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
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

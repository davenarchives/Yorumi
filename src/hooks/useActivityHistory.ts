import { useCallback, useEffect, useState } from 'react';
import { persistOfflineHistoryKey } from '../services/offlineHistoryStore';

export interface ActivityData {
    [dateString: string]: number;
}

const ACTIVITY_KEY = 'yorumi_activity_history';
const ACTIVITY_SEEN_KEY = 'yorumi_activity_seen';
const STORAGE_EVENT = 'yorumi-storage-updated';

const readJson = <T,>(key: string, fallback: T): T => {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) as T : fallback;
    } catch {
        return fallback;
    }
};

const writeJson = (key: string, value: unknown) => {
    const serialized = JSON.stringify(value);
    persistOfflineHistoryKey(key, serialized);
    try {
        localStorage.setItem(key, serialized);
    } catch {
        // IndexedDB mirror retains offline copy
    }
    window.dispatchEvent(new CustomEvent(STORAGE_EVENT));
};

export function useActivityHistory() {
    const [activityData, setActivityData] = useState<ActivityData>(() => readJson<ActivityData>(ACTIVITY_KEY, {}));
    const [loading] = useState(false);

    const reload = useCallback(() => {
        setActivityData(readJson<ActivityData>(ACTIVITY_KEY, {}));
    }, []);

    useEffect(() => {
        window.addEventListener(STORAGE_EVENT, reload);
        return () => window.removeEventListener(STORAGE_EVENT, reload);
    }, [reload]);

    const recordActivity = useCallback(async (activityKey?: string) => {
        const date = new Date();
        const dateString = [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, '0'),
            String(date.getDate()).padStart(2, '0')
        ].join('-');

        const normalizedKey = activityKey?.replace(/\//g, '_');
        const seen = readJson<Record<string, string>>(ACTIVITY_SEEN_KEY, {});
        if (normalizedKey && seen[normalizedKey]) return;

        const history = readJson<ActivityData>(ACTIVITY_KEY, {});
        writeJson(ACTIVITY_KEY, {
            ...history,
            [dateString]: Number(history[dateString] || 0) + 1
        });

        if (normalizedKey) {
            writeJson(ACTIVITY_SEEN_KEY, {
                ...seen,
                [normalizedKey]: dateString
            });
        }
    }, []);

    return {
        activityData,
        recordActivity,
        loading
    };
}

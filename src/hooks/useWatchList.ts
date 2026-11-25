import { useState, useEffect, useCallback } from 'react';
import { storage, type WatchListItem } from '../utils/storage';

export function useWatchList() {
    const [watchList, setWatchList] = useState<WatchListItem[]>(() => storage.getWatchList());
    const [loading] = useState(false);

    const reload = useCallback(() => {
        setWatchList(storage.getWatchList());
    }, []);

    useEffect(() => {
        window.addEventListener('yorumi-storage-updated', reload);
        return () => window.removeEventListener('yorumi-storage-updated', reload);
    }, [reload]);

    const addToWatchList = useCallback((item: Omit<WatchListItem, 'addedAt'>) => {
        storage.addToWatchList(item, item.status || 'watching');
    }, []);

    const removeFromWatchList = useCallback((id: string) => {
        storage.removeFromWatchList(id);
    }, []);

    const isInWatchList = useCallback((id: string) => {
        const normalizedId = String(id || '').trim();
        if (!normalizedId) return false;
        return watchList.some(item => item.id === normalizedId);
    }, [watchList]);

    return {
        watchList,
        loading,
        addToWatchList,
        removeFromWatchList,
        isInWatchList
    };
}

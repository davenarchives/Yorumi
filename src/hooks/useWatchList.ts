import { useState, useEffect, useCallback } from 'react';
import { doc, setDoc, deleteDoc, onSnapshot, collection, query, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import type { WatchListItem } from '../utils/storage';

export function useWatchList() {
    const { user } = useAuth();
    const [watchList, setWatchList] = useState<WatchListItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setWatchList([]);
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, 'users', user.uid, 'watchList'),
            orderBy('addedAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => doc.data() as WatchListItem);
            setWatchList(data);
            setLoading(false);
        }, (error) => {
            console.error("Failed to subscribe to watch list:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const addToWatchList = useCallback(async (item: Omit<WatchListItem, 'addedAt'>) => {
        if (!user) return;

        const newItem: WatchListItem = {
            ...item,
            addedAt: Date.now()
        };

        try {
            await setDoc(doc(db, 'users', user.uid, 'watchList', item.id), newItem);
        } catch (error) {
            console.error("Failed to add to watch list:", error);
        }
    }, [user]);

    const removeFromWatchList = useCallback(async (id: string) => {
        if (!user) return;

        try {
            await deleteDoc(doc(db, 'users', user.uid, 'watchList', id));
        } catch (error) {
            console.error("Failed to remove from watch list:", error);
        }
    }, [user]);

    const isInWatchList = useCallback((id: string) => {
        return watchList.some(item => item.id === id);
    }, [watchList]);

    return {
        watchList,
        loading,
        addToWatchList,
        removeFromWatchList,
        isInWatchList
    };
}

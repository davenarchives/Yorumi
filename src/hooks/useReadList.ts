import { useState, useEffect, useCallback } from 'react';
import { doc, setDoc, deleteDoc, onSnapshot, collection, query, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import type { ReadListItem } from '../utils/storage';

export function useReadList() {
    const { user } = useAuth();
    const [readList, setReadList] = useState<ReadListItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setReadList([]);
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, 'users', user.uid, 'readList'),
            orderBy('addedAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => doc.data() as ReadListItem);
            setReadList(data);
            setLoading(false);
        }, (error) => {
            console.error("Failed to subscribe to read list:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const addToReadList = useCallback(async (item: Omit<ReadListItem, 'addedAt'>) => {
        if (!user) return;

        const newItem: ReadListItem = {
            ...item,
            addedAt: Date.now()
        };

        try {
            await setDoc(doc(db, 'users', user.uid, 'readList', item.id), newItem);
        } catch (error) {
            console.error("Failed to add to read list:", error);
        }
    }, [user]);

    const removeFromReadList = useCallback(async (id: string) => {
        if (!user) return;

        try {
            await deleteDoc(doc(db, 'users', user.uid, 'readList', id));
        } catch (error) {
            console.error("Failed to remove from read list:", error);
        }
    }, [user]);

    const isInReadList = useCallback((id: string) => {
        return readList.some(item => item.id === id);
    }, [readList]);

    return {
        readList,
        loading,
        addToReadList,
        removeFromReadList,
        isInReadList
    };
}

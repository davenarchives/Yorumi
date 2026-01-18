import { useState, useEffect, useCallback } from 'react';
import { doc, setDoc, onSnapshot, collection, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import type { Anime, Episode } from '../types/anime';
import { type WatchProgress } from '../utils/storage';

export function useContinueWatching() {
    const { user } = useAuth();
    const [continueWatchingList, setContinueWatchingList] = useState<WatchProgress[]>([]);

    // Subscribe to Firestore updates
    useEffect(() => {
        if (!user) {
            setContinueWatchingList([]);
            return;
        }

        const q = query(
            collection(db, 'users', user.uid, 'continueWatching'),
            orderBy('lastWatched', 'desc'),
            limit(20)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => doc.data() as WatchProgress);
            setContinueWatchingList(data);
        }, (error) => {
            console.error("Failed to subscribe to continue watching:", error);
        });

        return () => unsubscribe();
    }, [user]);

    const saveProgress = useCallback(async (anime: Anime, episode: Episode) => {
        if (!user) return; // Only save if logged in

        const image = anime.anilist_banner_image || anime.images.jpg.large_image_url;

        const progress: WatchProgress = {
            animeId: anime.mal_id.toString(),
            episodeId: episode.session || (episode as any).id || '',
            episodeNumber: typeof episode.episodeNumber === 'string' ? parseFloat(episode.episodeNumber) : episode.episodeNumber,
            timestamp: Date.now(), // For video position if we track it
            lastWatched: Date.now(), // For sorting
            animeTitle: anime.title,
            animeImage: image
        };

        try {
            await setDoc(doc(db, 'users', user.uid, 'continueWatching', anime.mal_id.toString()), progress);
        } catch (error) {
            console.error("Failed to save progress to Firestore:", error);
        }
    }, [user]);

    const removeFromHistory = useCallback(async () => {
        // Implementation for removing would go here (deleteDoc)
        // Leaving properly typed stub for now as storage version had it.
    }, []);

    return {
        continueWatchingList,
        saveProgress,
        removeFromHistory
    };
}

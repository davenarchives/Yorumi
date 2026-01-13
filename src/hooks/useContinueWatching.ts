import { useState, useEffect, useCallback } from 'react';
import type { Anime, Episode } from '../types/anime';

export interface ContinueWatchingItem {
    mal_id: number;
    title: string;
    image: string;
    episodeNumber: number;
    episodeTitle?: string;
    episodeId: string;
    timestamp: number;
    totalEpisodes?: number;
}

const STORAGE_KEY = 'yorumi_continue_watching';
const MAX_ITEMS = 20;

export function useContinueWatching() {
    const [continueWatchingList, setContinueWatchingList] = useState<ContinueWatchingItem[]>([]);

    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                setContinueWatchingList(JSON.parse(stored));
            } catch (e) {
                console.error('Failed to parse continue watching list', e);
            }
        }
    }, []);

    const saveProgress = useCallback((anime: Anime, episode: Episode) => {
        setContinueWatchingList(prev => {
            // Remove existing entry for this anime if it exists
            const filtered = prev.filter(item => item.mal_id !== anime.mal_id);

            // Try to find episode thumbnail
            let image = anime.anilist_banner_image || anime.images.jpg.large_image_url;

            // If we can map episode number to metadata index (rough approximation or search)
            // But relying on banner is safer for now if metadata isn't reliable.
            // User asked for "coverImage", let's prioritize banner for landscape.

            const episodeTitle = episode.title || `Episode ${episode.episodeNumber}`;

            const newItem: ContinueWatchingItem = {
                mal_id: anime.mal_id,
                title: anime.title,
                image: image,
                episodeNumber: typeof episode.episodeNumber === 'string' ? parseFloat(episode.episodeNumber) : episode.episodeNumber,
                episodeTitle: episodeTitle,
                episodeId: episode.session || (episode as any).id || '',
                timestamp: Date.now(),
                totalEpisodes: anime.episodes || undefined
            };

            // Add new item to the front
            const newList = [newItem, ...filtered].slice(0, MAX_ITEMS);

            localStorage.setItem(STORAGE_KEY, JSON.stringify(newList));
            return newList;
        });
    }, []);

    const removeFromHistory = useCallback((mal_id: number) => {
        setContinueWatchingList(prev => {
            const newList = prev.filter(item => item.mal_id !== mal_id);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newList));
            return newList;
        });
    }, []);

    return {
        continueWatchingList,
        saveProgress,
        removeFromHistory
    };
}

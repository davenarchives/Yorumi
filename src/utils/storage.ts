export interface WatchProgress {
    animeId: string;
    episodeId: string;
    episodeNumber: number;
    timestamp: number;
    lastWatched: number;
    animeTitle: string;
    animeImage: string;
}

export interface ReadProgress {
    mangaId: string;
    chapterId: string;
    chapterNumber: string; // Chapters can be 10.5
    timestamp: number;
    lastRead: number;
    mangaTitle: string;
    mangaImage: string;
}

export interface WatchListItem {
    id: string;
    title: string;
    image: string;
    addedAt: number;
    status: 'watching' | 'completed' | 'plan_to_watch';
}

export interface ReadListItem {
    id: string;
    title: string;
    image: string;
    addedAt: number;
    status: 'reading' | 'completed' | 'plan_to_read';
}

const STORAGE_KEYS = {
    CONTINUE_WATCHING: 'yorumi_continue_watching',
    WATCH_LIST: 'yorumi_watch_list',
    READ_LIST: 'yorumi_read_list'
};

export const storage = {
    // Continue Watching
    saveProgress: (progress: Omit<WatchProgress, 'lastWatched'>) => {
        try {
            const current = storage.getContinueWatching();
            const updated = [
                { ...progress, lastWatched: Date.now() },
                ...current.filter(item => item.animeId !== progress.animeId)
            ].slice(0, 20); // Keep last 20

            localStorage.setItem(STORAGE_KEYS.CONTINUE_WATCHING, JSON.stringify(updated));
        } catch (error) {
            console.error('Failed to save progress:', error);
        }
    },

    getContinueWatching: (): WatchProgress[] => {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.CONTINUE_WATCHING);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Failed to get continue watching:', error);
            return [];
        }
    },

    // Watch List
    addToWatchList: (item: Omit<WatchListItem, 'addedAt' | 'status'>, status: WatchListItem['status'] = 'watching') => {
        try {
            const current = storage.getWatchList();
            if (current.some(i => i.id === item.id)) return; // Already in list

            const updated = [
                { ...item, status, addedAt: Date.now() },
                ...current
            ];

            localStorage.setItem(STORAGE_KEYS.WATCH_LIST, JSON.stringify(updated));
        } catch (error) {
            console.error('Failed to add to watch list:', error);
        }
    },

    removeFromWatchList: (animeId: string) => {
        try {
            const current = storage.getWatchList();
            const updated = current.filter(item => item.id !== animeId);
            localStorage.setItem(STORAGE_KEYS.WATCH_LIST, JSON.stringify(updated));
        } catch (error) {
            console.error('Failed to remove from watch list:', error);
        }
    },

    getWatchList: (): WatchListItem[] => {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.WATCH_LIST);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Failed to get watch list:', error);
            return [];
        }
    },

    isInWatchList: (animeId: string): boolean => {
        const list = storage.getWatchList();
        return list.some(item => item.id === animeId);
    },

    // Read List
    addToReadList: (item: Omit<ReadListItem, 'addedAt' | 'status'>, status: ReadListItem['status'] = 'reading') => {
        try {
            const current = storage.getReadList();
            if (current.some(i => i.id === item.id)) return;

            const updated = [
                { ...item, status, addedAt: Date.now() },
                ...current
            ];

            localStorage.setItem(STORAGE_KEYS.READ_LIST, JSON.stringify(updated));
        } catch (error) {
            console.error('Failed to add to read list:', error);
        }
    },

    removeFromReadList: (mangaId: string) => {
        try {
            const current = storage.getReadList();
            const updated = current.filter(item => item.id !== mangaId);
            localStorage.setItem(STORAGE_KEYS.READ_LIST, JSON.stringify(updated));
        } catch (error) {
            console.error('Failed to remove from read list:', error);
        }
    },

    getReadList: (): ReadListItem[] => {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.READ_LIST);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Failed to get read list:', error);
            return [];
        }
    },

    isInReadList: (mangaId: string): boolean => {
        const list = storage.getReadList();
        return list.some(item => item.id === mangaId);
    }
};

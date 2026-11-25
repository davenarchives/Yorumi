import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { ActiveDownloadProgress, DownloadedEpisode } from '../../services/downloadService';

export interface TauriAnimeSearchResult {
    id: string;
    title: string;
    url: string;
    poster?: string;
    status?: string;
    type?: string;
    episodes?: number;
    sub?: number;
    dub?: number;
    year?: string;
    score?: string;
    session: string;
}

export interface TauriEpisode {
    id: string;
    episodeNumber: number;
    url: string;
    title?: string;
    duration?: string;
    date?: string;
    snapshot?: string;
    session: string;
    isSubbed?: boolean;
    isDubbed?: boolean;
    isFiller?: boolean;
}

export interface TauriStreamLink {
    quality: string;
    audio: string;
    provider?: string;
    server?: string;
    url: string;
    directUrl?: string;
    referer?: string;
    cookie?: string;
    audioLanguage?: string;
    isHls: boolean;
    subtitles?: Array<{ url: string; lang: string; default: boolean }>;
}

export interface TauriMangaSearchResult {
    id: string;
    title: string;
    url: string;
    cover?: string;
    latestChapter?: string;
    genres: string[];
    status?: string;
}

export interface TauriMangaChapter {
    id: string;
    chapterNumber: number;
    title: string;
    releaseDate?: string;
}

export interface TauriChapterPage {
    pageNumber: number;
    imageUrl: string;
}

export interface TauriNovelSearchResult {
    id: string;
    title: string;
    url: string;
    cover?: string;
    author?: string;
    latestChapter?: string;
}

export interface TauriNovelChapter {
    id: string;
    chapterNumber: number;
    title: string;
}

export interface TauriNovelChapterContent {
    id: string;
    novelId: string;
    title: string;
    chapterNumber: number;
    content: string;
    prevChapterId?: string | null;
    nextChapterId?: string | null;
}

export interface TauriWatchProgress {
    animeId: string;
    episodeId: string;
    episodeNumber: number;
    animeTitle?: string;
    animeImage?: string;
    positionSeconds?: number;
    durationSeconds?: number;
    lastWatched: number;
}

export interface TauriReadProgress {
    mangaId: string;
    chapterId: string;
    chapterNumber: string;
    mangaTitle?: string;
    mangaImage?: string;
    pageNumber?: number;
    lastRead: number;
}

export interface TauriLibraryEntry {
    id: string;
    mediaType: string;
    anilistId?: string;
    malId?: string;
    scraperId?: string;
    title: string;
    image?: string;
    status: string;
    score?: number;
    currentProgress?: number;
    totalCount?: number;
    genres: string[];
    addedAt: number;
    updatedAt: number;
}

export interface TauriBridgeAPI {
    isAvailable: () => boolean;
    getLocalDownloads: () => Promise<DownloadedEpisode[]>;
    getLocalDownload: (args: { animeId: string; episodeNumber: number }) => Promise<DownloadedEpisode | null>;
    deleteLocalDownload: (args: { animeId: string; episodeNumber: number }) => Promise<boolean>;
    startDownload: (args: {
        animeId: string;
        animeTitle: string;
        animeImage?: string;
        episodeNumber: number;
        episodeTitle?: string;
        streamUrl: string;
        referer?: string;
        quality?: string;
        audio?: string;
    }) => Promise<string>;
    openDownloadsFolder: (category?: 'Anime' | 'Manga' | 'LightNovels') => Promise<boolean>;
    onDownloadProgress: (cb: (progress: ActiveDownloadProgress) => void) => Promise<UnlistenFn>;
    // Scraper & Content APIs
    searchAnime: (query: string) => Promise<TauriAnimeSearchResult[]>;
    getAnimeEpisodes: (animeId: string) => Promise<TauriEpisode[]>;
    getAnimeStreams: (episodeId: string, server?: string) => Promise<TauriStreamLink[]>;
    searchManga: (query: string) => Promise<TauriMangaSearchResult[]>;
    getMangaChapters: (mangaId: string) => Promise<TauriMangaChapter[]>;
    getMangaPages: (chapterIdOrUrl: string) => Promise<TauriChapterPage[]>;
    searchNovels: (query: string) => Promise<TauriNovelSearchResult[]>;
    getNovelChapters: (novelId: string) => Promise<TauriNovelChapter[]>;
    getNovelContent: (chapterIdOrUrl: string) => Promise<TauriNovelChapterContent | null>;
    anilistGetTrending: (page?: number, perPage?: number) => Promise<any>;
    anilistGetPopular: (page?: number, perPage?: number) => Promise<any>;
    anilistSearch: (query: string, page?: number, perPage?: number) => Promise<any>;
    anilistGetMedia: (id: number) => Promise<any>;
    // SQLite Persistence APIs
    dbSaveWatchProgress: (progress: TauriWatchProgress) => Promise<boolean>;
    dbGetContinueWatching: (limit?: number) => Promise<TauriWatchProgress[]>;
    dbGetAnimeHistory: (animeId: string) => Promise<string[]>;
    dbSaveReadProgress: (progress: TauriReadProgress) => Promise<boolean>;
    dbGetContinueReading: (limit?: number) => Promise<TauriReadProgress[]>;
    dbGetMangaHistory: (mangaId: string) => Promise<string[]>;
    dbSaveLibraryEntry: (entry: TauriLibraryEntry) => Promise<boolean>;
    dbGetLibraryEntries: (mediaType?: string, status?: string) => Promise<TauriLibraryEntry[]>;
    dbRemoveLibraryEntry: (id: string) => Promise<boolean>;
    dbGetSetting: (key: string) => Promise<string | null>;
    dbSetSetting: (key: string, value: string) => Promise<boolean>;
}

export const isTauriEnvironment = (): boolean => {
    return typeof window !== 'undefined' && Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
};

export const tauriBridge: TauriBridgeAPI = {
    isAvailable: isTauriEnvironment,

    getLocalDownloads: async () => {
        if (!isTauriEnvironment()) return [];
        try {
            return await invoke<DownloadedEpisode[]>('get_local_downloads');
        } catch (e) {
            console.error('[TauriBridge] getLocalDownloads failed:', e);
            return [];
        }
    },

    getLocalDownload: async (args) => {
        if (!isTauriEnvironment()) return null;
        try {
            return await invoke<DownloadedEpisode | null>('get_local_download', args);
        } catch (e) {
            console.error('[TauriBridge] getLocalDownload failed:', e);
            return null;
        }
    },

    deleteLocalDownload: async (args) => {
        if (!isTauriEnvironment()) return false;
        try {
            return await invoke<boolean>('delete_local_download', args);
        } catch (e) {
            console.error('[TauriBridge] deleteLocalDownload failed:', e);
            return false;
        }
    },

    openDownloadsFolder: async (category) => {
        if (!isTauriEnvironment()) return false;
        try {
            return await invoke<boolean>('open_downloads_folder', { category });
        } catch (e) {
            console.error('[TauriBridge] openDownloadsFolder failed:', e);
            return false;
        }
    },

    startDownload: async (args) => {
        if (!isTauriEnvironment()) return '';
        try {
            return await invoke<string>('start_download', args);
        } catch (e) {
            console.error('[TauriBridge] startDownload failed:', e);
            return '';
        }
    },

    onDownloadProgress: async (cb) => {
        return listen<ActiveDownloadProgress>('download-progress', (event) => {
            cb(event.payload);
        });
    },

    // Scraper & Content Implementations
    searchAnime: async (query: string) => {
        if (!isTauriEnvironment()) return [];
        try {
            return await invoke<TauriAnimeSearchResult[]>('search_anime', { query });
        } catch (e) {
            console.error('[TauriBridge] searchAnime failed:', e);
            return [];
        }
    },

    getAnimeEpisodes: async (animeId: string) => {
        if (!isTauriEnvironment()) return [];
        try {
            return await invoke<TauriEpisode[]>('get_anime_episodes', { animeId });
        } catch (e) {
            console.error('[TauriBridge] getAnimeEpisodes failed:', e);
            return [];
        }
    },

    getAnimeStreams: async (episodeId: string, server?: string) => {
        if (!isTauriEnvironment()) return [];
        try {
            return await invoke<TauriStreamLink[]>('get_anime_streams', { episodeId, server });
        } catch (e) {
            console.error('[TauriBridge] getAnimeStreams failed:', e);
            return [];
        }
    },

    searchManga: async (query: string) => {
        if (!isTauriEnvironment()) return [];
        try {
            return await invoke<TauriMangaSearchResult[]>('search_manga', { query });
        } catch (e) {
            console.error('[TauriBridge] searchManga failed:', e);
            return [];
        }
    },

    getMangaChapters: async (mangaId: string) => {
        if (!isTauriEnvironment()) return [];
        try {
            return await invoke<TauriMangaChapter[]>('get_manga_chapters', { mangaId });
        } catch (e) {
            console.error('[TauriBridge] getMangaChapters failed:', e);
            return [];
        }
    },

    getMangaPages: async (chapterIdOrUrl: string) => {
        if (!isTauriEnvironment()) return [];
        try {
            return await invoke<TauriChapterPage[]>('get_manga_pages', { chapterIdOrUrl });
        } catch (e) {
            console.error('[TauriBridge] getMangaPages failed:', e);
            return [];
        }
    },

    searchNovels: async (query: string) => {
        if (!isTauriEnvironment()) return [];
        try {
            return await invoke<TauriNovelSearchResult[]>('search_novels', { query });
        } catch (e) {
            console.error('[TauriBridge] searchNovels failed:', e);
            return [];
        }
    },

    getNovelChapters: async (novelId: string) => {
        if (!isTauriEnvironment()) return [];
        try {
            return await invoke<TauriNovelChapter[]>('get_novel_chapters', { novelId });
        } catch (e) {
            console.error('[TauriBridge] getNovelChapters failed:', e);
            return [];
        }
    },

    getNovelContent: async (chapterIdOrUrl: string) => {
        if (!isTauriEnvironment()) return null;
        try {
            return await invoke<TauriNovelChapterContent>('get_novel_content', { chapterIdOrUrl });
        } catch (e) {
            console.error('[TauriBridge] getNovelContent failed:', e);
            return null;
        }
    },

    anilistGetTrending: async (page?: number, perPage?: number) => {
        if (!isTauriEnvironment()) return null;
        try {
            return await invoke('anilist_get_trending', { page, perPage });
        } catch (e) {
            console.error('[TauriBridge] anilistGetTrending failed:', e);
            return null;
        }
    },

    anilistGetPopular: async (page?: number, perPage?: number) => {
        if (!isTauriEnvironment()) return null;
        try {
            return await invoke('anilist_get_popular', { page, perPage });
        } catch (e) {
            console.error('[TauriBridge] anilistGetPopular failed:', e);
            return null;
        }
    },

    anilistSearch: async (query: string, page?: number, perPage?: number) => {
        if (!isTauriEnvironment()) return null;
        try {
            return await invoke('anilist_search', { query, page, perPage });
        } catch (e) {
            console.error('[TauriBridge] anilistSearch failed:', e);
            return null;
        }
    },

    anilistGetMedia: async (id: number) => {
        if (!isTauriEnvironment()) return null;
        try {
            return await invoke('anilist_get_media', { id });
        } catch (e) {
            console.error('[TauriBridge] anilistGetMedia failed:', e);
            return null;
        }
    },

    // SQLite Persistence Implementations
    dbSaveWatchProgress: async (progress: TauriWatchProgress) => {
        if (!isTauriEnvironment()) return false;
        try {
            await invoke('db_save_watch_progress', { progress });
            return true;
        } catch (e) {
            console.error('[TauriBridge] dbSaveWatchProgress failed:', e);
            return false;
        }
    },

    dbGetContinueWatching: async (limit?: number) => {
        if (!isTauriEnvironment()) return [];
        try {
            return await invoke<TauriWatchProgress[]>('db_get_continue_watching', { limit });
        } catch (e) {
            console.error('[TauriBridge] dbGetContinueWatching failed:', e);
            return [];
        }
    },

    dbGetAnimeHistory: async (animeId: string) => {
        if (!isTauriEnvironment()) return [];
        try {
            return await invoke<string[]>('db_get_anime_history', { animeId });
        } catch (e) {
            console.error('[TauriBridge] dbGetAnimeHistory failed:', e);
            return [];
        }
    },

    dbSaveReadProgress: async (progress: TauriReadProgress) => {
        if (!isTauriEnvironment()) return false;
        try {
            await invoke('db_save_read_progress', { progress });
            return true;
        } catch (e) {
            console.error('[TauriBridge] dbSaveReadProgress failed:', e);
            return false;
        }
    },

    dbGetContinueReading: async (limit?: number) => {
        if (!isTauriEnvironment()) return [];
        try {
            return await invoke<TauriReadProgress[]>('db_get_continue_reading', { limit });
        } catch (e) {
            console.error('[TauriBridge] dbGetContinueReading failed:', e);
            return [];
        }
    },

    dbGetMangaHistory: async (mangaId: string) => {
        if (!isTauriEnvironment()) return [];
        try {
            return await invoke<string[]>('db_get_manga_history', { mangaId });
        } catch (e) {
            console.error('[TauriBridge] dbGetMangaHistory failed:', e);
            return [];
        }
    },

    dbSaveLibraryEntry: async (entry: TauriLibraryEntry) => {
        if (!isTauriEnvironment()) return false;
        try {
            await invoke('db_save_library_entry', { entry });
            return true;
        } catch (e) {
            console.error('[TauriBridge] dbSaveLibraryEntry failed:', e);
            return false;
        }
    },

    dbGetLibraryEntries: async (mediaType?: string, status?: string) => {
        if (!isTauriEnvironment()) return [];
        try {
            return await invoke<TauriLibraryEntry[]>('db_get_library_entries', { mediaType, status });
        } catch (e) {
            console.error('[TauriBridge] dbGetLibraryEntries failed:', e);
            return [];
        }
    },

    dbRemoveLibraryEntry: async (id: string) => {
        if (!isTauriEnvironment()) return false;
        try {
            await invoke('db_remove_library_entry', { id });
            return true;
        } catch (e) {
            console.error('[TauriBridge] dbRemoveLibraryEntry failed:', e);
            return false;
        }
    },

    dbGetSetting: async (key: string) => {
        if (!isTauriEnvironment()) return null;
        try {
            return await invoke<string | null>('db_get_setting', { key });
        } catch (e) {
            console.error('[TauriBridge] dbGetSetting failed:', e);
            return null;
        }
    },

    dbSetSetting: async (key: string, value: string) => {
        if (!isTauriEnvironment()) return false;
        try {
            await invoke('db_set_setting', { key, value });
            return true;
        } catch (e) {
            console.error('[TauriBridge] dbSetSetting failed:', e);
            return false;
        }
    },
};

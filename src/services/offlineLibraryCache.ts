import type { Manga, MangaChapter } from '../types/manga';
import type { LightNovel, LNChapter } from '../types/ln';
import type { Anime } from '../types/anime';

const MANGA_CHAPTERS_KEY = 'yorumi_offline_manga_chapters_v1';
const LN_CHAPTERS_KEY = 'yorumi_offline_ln_chapters_v1';
const MANGA_META_KEY = 'yorumi_offline_manga_meta_v1';
const LN_META_KEY = 'yorumi_offline_ln_meta_v1';
const ANIME_META_KEY = 'yorumi_offline_anime_meta_lib_v1';
const ANIME_EP_COUNTS_KEY = 'yorumi_offline_anime_ep_counts_v1';
const ANIME_EPISODES_KEY = 'yorumi_offline_anime_episodes_v1';
const MAX_CACHED_SERIES = 150;

export interface CachedAnimeEpisode {
    episodeNumber: number;
    playbackEpisodeNumber?: number;
    title: string;
    overview?: string;
    thumbnail?: string;
    snapshot?: string;
    airDate?: string | null;
    duration?: string;
    tmdbSeason?: number;
    tmdbEpisode?: number;
}

interface CachedSeriesEntry<T> {
    updatedAt: number;
    items: T[];
}

interface CachedMetaEntry<T> {
    updatedAt: number;
    data: T;
}

let mangaMemoryMap: Record<string, CachedSeriesEntry<MangaChapter>> | null = null;
let lnMemoryMap: Record<string, CachedSeriesEntry<LNChapter>> | null = null;
let mangaMetaMemoryMap: Record<string, CachedMetaEntry<Manga>> | null = null;
let lnMetaMemoryMap: Record<string, CachedMetaEntry<LightNovel>> | null = null;
let animeMetaMemoryMap: Record<string, CachedMetaEntry<Anime>> | null = null;
let animeEpisodesMemoryMap: Record<string, CachedSeriesEntry<CachedAnimeEpisode>> | null = null;
let animeCountMemoryMap: Record<string, number> | null = null;

function readMap<T>(storageKey: string): Record<string, CachedSeriesEntry<T>> {
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as Record<string, CachedSeriesEntry<T>>;
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function writeMap<T>(storageKey: string, map: Record<string, CachedSeriesEntry<T>>): Record<string, CachedSeriesEntry<T>> {
    const entries = Object.entries(map);
    let nextMap = map;
    if (entries.length > MAX_CACHED_SERIES) {
        const sorted = entries.sort((a, b) => (b[1]?.updatedAt || 0) - (a[1]?.updatedAt || 0));
        nextMap = Object.fromEntries(sorted.slice(0, MAX_CACHED_SERIES));
    }
    try {
        localStorage.setItem(storageKey, JSON.stringify(nextMap));
    } catch {
        try {
            const sorted = Object.entries(nextMap).sort((a, b) => (b[1]?.updatedAt || 0) - (a[1]?.updatedAt || 0));
            const pruned = Object.fromEntries(sorted.slice(0, Math.max(10, Math.floor(sorted.length / 2))));
            localStorage.setItem(storageKey, JSON.stringify(pruned));
            nextMap = pruned;
        } catch {
            // Ignore storage quota failures
        }
    }
    return nextMap;
}

const INVALID_KEYS = new Set(['', '0', 'null', 'undefined', 'nan', 'false']);

const normalizeKey = (id: string | number | undefined | null): string => {
    const cleaned = String(id ?? '').trim().toLowerCase();
    return INVALID_KEYS.has(cleaned) ? '' : cleaned;
};

function sanitizeRecord<V>(storageKey: string, map: Record<string, V>): Record<string, V> {
    let removed = false;
    for (const bad of INVALID_KEYS) {
        if (bad in map) {
            delete map[bad];
            removed = true;
        }
    }
    if (removed) {
        try {
            localStorage.setItem(storageKey, JSON.stringify(map));
        } catch {
            // Ignore storage errors
        }
    }
    return map;
}

const getMangaMap = (): Record<string, CachedSeriesEntry<MangaChapter>> => {
    if (!mangaMemoryMap) {
        mangaMemoryMap = sanitizeRecord(MANGA_CHAPTERS_KEY, readMap<MangaChapter>(MANGA_CHAPTERS_KEY));
    }
    return mangaMemoryMap;
};

const getLNMap = (): Record<string, CachedSeriesEntry<LNChapter>> => {
    if (!lnMemoryMap) {
        lnMemoryMap = sanitizeRecord(LN_CHAPTERS_KEY, readMap<LNChapter>(LN_CHAPTERS_KEY));
    }
    return lnMemoryMap;
};

function readMetaMap<T>(storageKey: string): Record<string, CachedMetaEntry<T>> {
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as Record<string, CachedMetaEntry<T>>;
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function writeMetaMap<T>(storageKey: string, map: Record<string, CachedMetaEntry<T>>): Record<string, CachedMetaEntry<T>> {
    const entries = Object.entries(map);
    let nextMap = map;
    if (entries.length > MAX_CACHED_SERIES) {
        const sorted = entries.sort((a, b) => (b[1]?.updatedAt || 0) - (a[1]?.updatedAt || 0));
        nextMap = Object.fromEntries(sorted.slice(0, MAX_CACHED_SERIES));
    }
    try {
        localStorage.setItem(storageKey, JSON.stringify(nextMap));
    } catch {
        try {
            const sorted = Object.entries(nextMap).sort((a, b) => (b[1]?.updatedAt || 0) - (a[1]?.updatedAt || 0));
            const pruned = Object.fromEntries(sorted.slice(0, Math.max(10, Math.floor(sorted.length / 2))));
            localStorage.setItem(storageKey, JSON.stringify(pruned));
            nextMap = pruned;
        } catch {
            // Ignore quota errors
        }
    }
    return nextMap;
}

const getMangaMetaMap = (): Record<string, CachedMetaEntry<Manga>> => {
    if (!mangaMetaMemoryMap) {
        mangaMetaMemoryMap = sanitizeRecord(MANGA_META_KEY, readMetaMap<Manga>(MANGA_META_KEY));
    }
    return mangaMetaMemoryMap;
};

const getLNMetaMap = (): Record<string, CachedMetaEntry<LightNovel>> => {
    if (!lnMetaMemoryMap) {
        lnMetaMemoryMap = sanitizeRecord(LN_META_KEY, readMetaMap<LightNovel>(LN_META_KEY));
    }
    return lnMetaMemoryMap;
};

const getAnimeMetaMap = (): Record<string, CachedMetaEntry<Anime>> => {
    if (!animeMetaMemoryMap) {
        animeMetaMemoryMap = sanitizeRecord(ANIME_META_KEY, readMetaMap<Anime>(ANIME_META_KEY));
    }
    return animeMetaMemoryMap;
};

const getAnimeEpisodesMap = (): Record<string, CachedSeriesEntry<CachedAnimeEpisode>> => {
    if (!animeEpisodesMemoryMap) {
        animeEpisodesMemoryMap = sanitizeRecord(ANIME_EPISODES_KEY, readMap<CachedAnimeEpisode>(ANIME_EPISODES_KEY));
    }
    return animeEpisodesMemoryMap;
};

const getAnimeCountMap = (): Record<string, number> => {
    if (!animeCountMemoryMap) {
        try {
            const raw = localStorage.getItem(ANIME_EP_COUNTS_KEY);
            const parsed = raw ? (JSON.parse(raw) as Record<string, number>) : {};
            animeCountMemoryMap = sanitizeRecord(
                ANIME_EP_COUNTS_KEY,
                parsed && typeof parsed === 'object' ? parsed : {}
            );
        } catch {
            animeCountMemoryMap = {};
        }
    }
    return animeCountMemoryMap;
};

export const offlineLibraryCache = {
    saveMangaMeta(keys: Array<string | number | undefined | null>, manga: Manga | null | undefined): void {
        if (!manga || !manga.title) return;
        const map = { ...getMangaMetaMap() };
        const now = Date.now();
        let wrote = false;
        for (const rawKey of keys) {
            const key = normalizeKey(rawKey);
            if (!key) continue;
            const prev = map[key]?.data;
            map[key] = {
                updatedAt: now,
                data: {
                    ...(prev || {}),
                    ...manga,
                    synopsis: manga.synopsis || prev?.synopsis,
                    genres: manga.genres?.length ? manga.genres : prev?.genres,
                    authors: manga.authors?.length ? manga.authors : prev?.authors,
                    bannerImage: manga.bannerImage || prev?.bannerImage,
                    images: manga.images?.jpg?.large_image_url || manga.images?.jpg?.image_url ? manga.images : prev?.images || manga.images,
                },
            };
            wrote = true;
        }
        if (wrote) {
            mangaMetaMemoryMap = writeMetaMap(MANGA_META_KEY, map);
        }
    },

    getMangaMeta(keys: Array<string | number | undefined | null>): Manga | null {
        const map = getMangaMetaMap();
        for (const rawKey of keys) {
            const key = normalizeKey(rawKey);
            if (key && map[key]?.data) {
                return map[key].data;
            }
        }
        return null;
    },

    saveLNMeta(keys: Array<string | number | undefined | null>, ln: LightNovel | null | undefined): void {
        if (!ln || !ln.title) return;
        const map = { ...getLNMetaMap() };
        const now = Date.now();
        let wrote = false;
        for (const rawKey of keys) {
            const key = normalizeKey(rawKey);
            if (!key) continue;
            const prev = map[key]?.data;
            map[key] = {
                updatedAt: now,
                data: {
                    ...(prev || {}),
                    ...ln,
                    synopsis: ln.synopsis || prev?.synopsis,
                    genres: ln.genres?.length ? ln.genres : prev?.genres,
                    author: (ln.author && ln.author !== 'Unknown Author') ? ln.author : prev?.author || ln.author,
                    bannerImage: ln.bannerImage || prev?.bannerImage,
                    images: ln.images?.jpg?.large_image_url || ln.images?.jpg?.image_url ? ln.images : prev?.images || ln.images,
                },
            };
            wrote = true;
        }
        if (wrote) {
            lnMetaMemoryMap = writeMetaMap(LN_META_KEY, map);
        }
    },

    getLNMeta(keys: Array<string | number | undefined | null>): LightNovel | null {
        const map = getLNMetaMap();
        for (const rawKey of keys) {
            const key = normalizeKey(rawKey);
            if (key && map[key]?.data) {
                return map[key].data;
            }
        }
        return null;
    },

    saveAnimeMeta(keys: Array<string | number | undefined | null>, anime: Anime | null | undefined): void {
        if (!anime || !anime.title) return;
        const map = { ...getAnimeMetaMap() };
        const now = Date.now();
        let wrote = false;
        for (const rawKey of keys) {
            const key = normalizeKey(rawKey);
            if (!key) continue;
            const prev = map[key]?.data;
            map[key] = {
                updatedAt: now,
                data: {
                    ...(prev || {}),
                    ...anime,
                    synopsis: anime.synopsis || prev?.synopsis,
                    genres: anime.genres?.length ? anime.genres : prev?.genres,
                },
            };
            wrote = true;
        }
        if (wrote) {
            animeMetaMemoryMap = writeMetaMap(ANIME_META_KEY, map);
        }
    },

    getAnimeMeta(keys: Array<string | number | undefined | null>): Anime | null {
        const map = getAnimeMetaMap();
        for (const rawKey of keys) {
            const key = normalizeKey(rawKey);
            if (key && map[key]?.data) {
                return map[key].data;
            }
        }
        return null;
    },

    saveMangaChapters(keys: Array<string | number | undefined | null>, chapters: MangaChapter[]): void {
        if (!Array.isArray(chapters) || chapters.length === 0) return;
        const map = { ...getMangaMap() };
        const now = Date.now();
        const compact = chapters.map((ch) => ({
            id: ch.id,
            title: ch.title,
            url: ch.url,
            uploadDate: ch.uploadDate,
        }));
        let wrote = false;
        for (const rawKey of keys) {
            const key = normalizeKey(rawKey);
            if (!key) continue;
            map[key] = { updatedAt: now, items: compact };
            wrote = true;
        }
        if (wrote) {
            mangaMemoryMap = writeMap(MANGA_CHAPTERS_KEY, map);
        }
    },

    getMangaChapters(keys: Array<string | number | undefined | null>): MangaChapter[] {
        const map = getMangaMap();
        for (const rawKey of keys) {
            const key = normalizeKey(rawKey);
            if (key && map[key]?.items?.length) {
                return map[key].items;
            }
        }
        return [];
    },

    saveLNChapters(keys: Array<string | number | undefined | null>, chapters: LNChapter[]): void {
        if (!Array.isArray(chapters) || chapters.length === 0) return;
        const map = { ...getLNMap() };
        const now = Date.now();
        const compact = chapters.map((ch) => ({
            id: ch.id,
            number: ch.number,
            title: ch.title,
            url: ch.url,
        }));
        let wrote = false;
        for (const rawKey of keys) {
            const key = normalizeKey(rawKey);
            if (!key) continue;
            map[key] = { updatedAt: now, items: compact };
            wrote = true;
        }
        if (wrote) {
            lnMemoryMap = writeMap(LN_CHAPTERS_KEY, map);
        }
    },

    getLNChapters(keys: Array<string | number | undefined | null>): LNChapter[] {
        const map = getLNMap();
        for (const rawKey of keys) {
            const key = normalizeKey(rawKey);
            if (key && map[key]?.items?.length) {
                return map[key].items;
            }
        }
        return [];
    },

    saveAnimeEpisodeCount(keys: Array<string | number | undefined | null>, count: number): void {
        const safeCount = Math.floor(Number(count) || 0);
        if (safeCount <= 0) return;
        const map = { ...getAnimeCountMap() };
        let wrote = false;
        for (const rawKey of keys) {
            const key = normalizeKey(rawKey);
            if (!key) continue;
            if (map[key] !== safeCount) {
                map[key] = safeCount;
                wrote = true;
            }
        }
        if (wrote) {
            animeCountMemoryMap = map;
            try {
                localStorage.setItem(ANIME_EP_COUNTS_KEY, JSON.stringify(map));
            } catch {
                // Ignore storage quota failures
            }
        }
    },

    getAnimeEpisodeCount(keys: Array<string | number | undefined | null>): number {
        const map = getAnimeCountMap();
        let best = 0;
        for (const rawKey of keys) {
            const key = normalizeKey(rawKey);
            if (key && map[key] && map[key] > best) {
                best = map[key];
            }
        }
        return best;
    },

    saveAnimeEpisodes(keys: Array<string | number | undefined | null>, episodes: CachedAnimeEpisode[]): void {
        if (!Array.isArray(episodes) || episodes.length === 0) return;
        const currentMap = getAnimeEpisodesMap();
        const compact: CachedAnimeEpisode[] = episodes.map((ep) => ({
            episodeNumber: Number(ep.episodeNumber || 0),
            playbackEpisodeNumber: ep.playbackEpisodeNumber,
            title: ep.title,
            overview: ep.overview,
            thumbnail: ep.thumbnail,
            snapshot: ep.snapshot,
            airDate: ep.airDate,
            duration: ep.duration,
            tmdbSeason: ep.tmdbSeason,
            tmdbEpisode: ep.tmdbEpisode,
        }));
        const first = compact[0];
        const last = compact[compact.length - 1];
        let changed = false;
        const map = { ...currentMap };
        const now = Date.now();
        for (const rawKey of keys) {
            const key = normalizeKey(rawKey);
            if (!key) continue;
            const prev = currentMap[key]?.items;
            const same = prev &&
                prev.length === compact.length &&
                prev[0]?.title === first?.title &&
                prev[0]?.thumbnail === first?.thumbnail &&
                prev[0]?.overview === first?.overview &&
                prev[prev.length - 1]?.title === last?.title &&
                prev[prev.length - 1]?.thumbnail === last?.thumbnail;
            if (!same) {
                map[key] = { updatedAt: now, items: compact };
                changed = true;
            }
        }
        if (changed) {
            animeEpisodesMemoryMap = writeMap(ANIME_EPISODES_KEY, map);
        }
    },

    getAnimeEpisodes(keys: Array<string | number | undefined | null>): CachedAnimeEpisode[] {
        const map = getAnimeEpisodesMap();
        for (const rawKey of keys) {
            const key = normalizeKey(rawKey);
            if (key && map[key]?.items?.length) {
                return map[key].items;
            }
        }
        return [];
    },
};

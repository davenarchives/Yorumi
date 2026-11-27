import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { postJson } from '../platform/nativeHttp';
import { getRuntimePlatform } from '../platform/runtime';
import { notifyEpisodeUpdate, type DownloadMediaType } from '../platform/downloadNotification';
import { useWatchList } from './useWatchList';
import { useContinueWatching } from './useContinueWatching';
import { useReadList } from './useReadList';
import { useContinueReading } from './useContinueReading';
import { useLNReadList } from './useLNReadList';
import { useContinueLNReading } from './useContinueLNReading';
import { parseAnimeRouteId } from '../utils/animeNavigation';
import { offlineLibraryCache } from '../services/offlineLibraryCache';

export interface WatchlistEpisodeNotification {
    id: string;
    mediaType: DownloadMediaType;
    seenKey: string;
    entryId: string;
    routePath: string;
    anilistId: number;
    title: string;
    image: string;
    latestEpisode: number;
    watchedEpisode: number;
    nextEpisode?: number;
    nextAiringAt?: number;
    unread: boolean;
}

type AniListAiringMedia = {
    id: number;
    title?: { english?: string; romaji?: string };
    coverImage?: { large?: string };
    status?: string;
    episodes?: number | null;
    nextAiringEpisode?: {
        episode: number;
        airingAt: number;
        timeUntilAiring: number;
    } | null;
};

type AniListReadingMedia = {
    id: number;
    format?: string;
    title?: { english?: string; romaji?: string };
    coverImage?: { large?: string };
    status?: string;
    chapters?: number | null;
};

const READ_STORAGE_KEY = 'yorumi_notif_seen_v1';
const PUSHED_STORAGE_KEY = 'yorumi_notif_pushed_v1';
const CACHE_STORAGE_KEY = 'yorumi_notif_cache_v2';
const CACHE_TTL_MS = 5 * 60 * 1000;
const POLL_INTERVAL_MS = 15 * 60 * 1000;

const readPushedMap = (): Record<string, number> => {
    try {
        const parsed = JSON.parse(localStorage.getItem(PUSHED_STORAGE_KEY) || '{}');
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
};

const writePushedMap = (map: Record<string, number>) => {
    try {
        localStorage.setItem(PUSHED_STORAGE_KEY, JSON.stringify(map));
    } catch {
        // Best effort
    }
};

const readSeenMap = (): Record<string, number> => {
    try {
        const parsed = JSON.parse(localStorage.getItem(READ_STORAGE_KEY) || '{}');
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
};

const writeSeenMap = (map: Record<string, number>) => {
    try {
        localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(map));
    } catch {
        // Best effort
    }
};

const extractAnilistId = (rawId: unknown, anilistId?: unknown): number => {
    const direct = Number(anilistId);
    if (Number.isFinite(direct) && direct > 0) return direct;
    const parsed = parseAnimeRouteId(rawId);
    if (parsed?.source === 'anilist') {
        const num = Number(parsed.id);
        if (Number.isFinite(num) && num > 0) return num;
    }
    const str = String(rawId || '').trim();
    if (/^\d+$/.test(str)) return Number(str);
    return 0;
};

const parseChapterNum = (raw: unknown): number => {
    if (typeof raw === 'number' && Number.isFinite(raw)) return Math.floor(raw);
    const match = String(raw || '').match(/(\d+(?:\.\d+)?)/);
    return match ? Math.floor(Number(match[1])) : 0;
};

export function useWatchlistNotifications() {
    const { watchList } = useWatchList();
    const { continueWatchingList } = useContinueWatching();
    const { readList } = useReadList();
    const { continueReadingList } = useContinueReading();
    const { readList: lnReadList } = useLNReadList();
    const { continueReadingList: continueLNList } = useContinueLNReading();

    const [mediaList, setMediaList] = useState<AniListAiringMedia[]>(() => {
        try {
            const cached = JSON.parse(localStorage.getItem(CACHE_STORAGE_KEY) || 'null') as {
                timestamp: number;
                media: AniListAiringMedia[];
                reading?: AniListReadingMedia[];
            } | null;
            if (cached && Array.isArray(cached.media) && Date.now() - cached.timestamp < 60 * 60 * 1000) {
                return cached.media;
            }
        } catch {
            // Ignore cache errors
        }
        return [];
    });

    const [readingMediaList, setReadingMediaList] = useState<AniListReadingMedia[]>(() => {
        try {
            const cached = JSON.parse(localStorage.getItem(CACHE_STORAGE_KEY) || 'null') as {
                timestamp: number;
                reading?: AniListReadingMedia[];
            } | null;
            if (cached && Array.isArray(cached.reading) && Date.now() - cached.timestamp < 60 * 60 * 1000) {
                return cached.reading;
            }
        } catch {
            // Ignore cache errors
        }
        return [];
    });

    const [seenMap, setSeenMap] = useState<Record<string, number>>(() => readSeenMap());
    const [loading, setLoading] = useState(false);
    const lastFetchedKeyRef = useRef<string>('');
    const lastFetchedAtRef = useRef<number>(0);

    const watchlistAnilistIds = useMemo(() => {
        const ids = new Set<number>();
        for (const item of watchList) {
            if (item.status === 'dropped' || item.status === 'completed') continue;
            const id = extractAnilistId(item.id, item.anilistId);
            if (id > 0) ids.add(id);
            if (ids.size >= 30) break;
        }
        return [...ids].sort((a, b) => a - b);
    }, [watchList]);

    const readingAnilistIds = useMemo(() => {
        const ids = new Set<number>();
        for (const item of readList) {
            if (item.status === 'dropped' || item.status === 'completed') continue;
            const id = extractAnilistId(item.id);
            if (id > 0) ids.add(id);
            if (ids.size >= 30) break;
        }
        for (const item of lnReadList) {
            const id = extractAnilistId(item.id);
            if (id > 0) ids.add(id);
            if (ids.size >= 40) break;
        }
        return [...ids].sort((a, b) => a - b);
    }, [readList, lnReadList]);

    const idsKey = `${watchlistAnilistIds.join(',')}|${readingAnilistIds.join(',')}`;

    const refresh = useCallback(async (force = false) => {
        if (watchlistAnilistIds.length === 0 && readingAnilistIds.length === 0) {
            setMediaList([]);
            setReadingMediaList([]);
            return;
        }
        const now = Date.now();
        if (!force && lastFetchedKeyRef.current === idsKey && now - lastFetchedAtRef.current < CACHE_TTL_MS) {
            return;
        }

        setLoading(true);
        try {
            const requests: Array<Promise<void>> = [];
            let nextAnimeMedia = mediaList;
            let nextReadingMedia = readingMediaList;

            if (watchlistAnilistIds.length > 0) {
                const animeQuery = `
                    query WatchlistAiring($ids: [Int]) {
                        Page(page: 1, perPage: 30) {
                            media(id_in: $ids, type: ANIME) {
                                id
                                title { english romaji }
                                coverImage { large }
                                status
                                episodes
                                nextAiringEpisode {
                                    episode
                                    airingAt
                                    timeUntilAiring
                                }
                            }
                        }
                    }
                `;
                requests.push(
                    postJson<{ data?: { Page?: { media?: AniListAiringMedia[] } } }>(
                        'https://graphql.anilist.co',
                        { query: animeQuery, variables: { ids: watchlistAnilistIds } }
                    ).then((res) => {
                        nextAnimeMedia = res?.data?.Page?.media || [];
                    })
                );
            } else {
                nextAnimeMedia = [];
            }

            if (readingAnilistIds.length > 0) {
                const readingQuery = `
                    query ReadingUpdates($ids: [Int]) {
                        Page(page: 1, perPage: 40) {
                            media(id_in: $ids, type: MANGA) {
                                id
                                format
                                title { english romaji }
                                coverImage { large }
                                status
                                chapters
                            }
                        }
                    }
                `;
                requests.push(
                    postJson<{ data?: { Page?: { media?: AniListReadingMedia[] } } }>(
                        'https://graphql.anilist.co',
                        { query: readingQuery, variables: { ids: readingAnilistIds } }
                    ).then((res) => {
                        nextReadingMedia = res?.data?.Page?.media || [];
                    })
                );
            } else {
                nextReadingMedia = [];
            }

            await Promise.allSettled(requests);
            lastFetchedKeyRef.current = idsKey;
            lastFetchedAtRef.current = Date.now();
            setMediaList(nextAnimeMedia);
            setReadingMediaList(nextReadingMedia);
            try {
                localStorage.setItem(
                    CACHE_STORAGE_KEY,
                    JSON.stringify({ timestamp: Date.now(), media: nextAnimeMedia, reading: nextReadingMedia })
                );
            } catch {
                // Ignore quota
            }
        } catch (err) {
            console.warn('[WatchlistNotifications] AniList refresh failed:', err);
        } finally {
            setLoading(false);
        }
    }, [idsKey, watchlistAnilistIds, readingAnilistIds]);

    useEffect(() => {
        void refresh(false);
        const timer = window.setInterval(() => {
            void refresh(true);
        }, POLL_INTERVAL_MS);
        return () => window.clearInterval(timer);
    }, [refresh]);

    const notifications = useMemo<WatchlistEpisodeNotification[]>(() => {
        const items: WatchlistEpisodeNotification[] = [];

        // 1. Anime episode updates
        for (const media of mediaList) {
            const latestEpisode = media.nextAiringEpisode
                ? media.nextAiringEpisode.episode - 1
                : media.status === 'RELEASING'
                ? Number(media.episodes || 0)
                : 0;
            if (latestEpisode <= 0) continue;

            const title = media.title?.english || media.title?.romaji || 'Anime';
            const normTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '');
            const progress = continueWatchingList.find((entry) => {
                const entryId = extractAnilistId(entry.animeId);
                if (entryId > 0 && entryId === media.id) return true;
                return entry.animeTitle?.toLowerCase().replace(/[^a-z0-9]+/g, '') === normTitle;
            });
            const watchedEpisode = Number(progress?.episodeNumber || 0);
            if (watchedEpisode >= latestEpisode) continue;

            const seenKey = String(media.id);
            const seenEp = Math.max(Number(seenMap[seenKey] || 0), Number(seenMap[`anime:${media.id}`] || 0));
            items.push({
                id: `anime-${media.id}-ep-${latestEpisode}`,
                mediaType: 'anime',
                seenKey,
                entryId: `al-${media.id}`,
                routePath: `/anime/details/al-${media.id}`,
                anilistId: media.id,
                title,
                image: media.coverImage?.large || '',
                latestEpisode,
                watchedEpisode,
                nextEpisode: media.nextAiringEpisode?.episode,
                nextAiringAt: media.nextAiringEpisode?.airingAt,
                unread: seenEp < latestEpisode,
            });
        }

        const readingById = new Map(readingMediaList.map((m) => [m.id, m]));

        // 2. Manga chapter updates
        for (const entry of readList) {
            if (entry.status === 'dropped' || entry.status === 'completed') continue;
            const anilistId = extractAnilistId(entry.id);
            const remote = anilistId > 0 ? readingById.get(anilistId) : undefined;
            const cachedChapters = offlineLibraryCache.getMangaChapters([entry.id, anilistId > 0 ? anilistId : undefined]);
            const highestCached = cachedChapters.reduce((max, ch) => Math.max(max, parseChapterNum(ch.number ?? ch.title)), 0);
            const latestChapter = Math.max(
                Number(remote?.chapters || 0),
                highestCached
            );
            if (latestChapter <= 0) continue;

            const title = remote?.title?.english || remote?.title?.romaji || entry.title || 'Manga';
            const normTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '');
            const progress = continueReadingList.find((c) => {
                if (String(c.mangaId) === String(entry.id)) return true;
                return c.mangaTitle?.toLowerCase().replace(/[^a-z0-9]+/g, '') === normTitle;
            });
            const readChapter = parseChapterNum(progress?.chapterNumber);
            if (readChapter <= 0 || readChapter >= latestChapter) continue;

            const seenKey = `manga:${entry.id}`;
            const seenCh = Number(seenMap[seenKey] || 0);
            items.push({
                id: `manga-${entry.id}-ch-${latestChapter}`,
                mediaType: 'manga',
                seenKey,
                entryId: String(entry.id),
                routePath: `/manga/details/${encodeURIComponent(String(entry.id))}`,
                anilistId,
                title,
                image: remote?.coverImage?.large || entry.image || '',
                latestEpisode: latestChapter,
                watchedEpisode: readChapter,
                unread: seenCh < latestChapter,
            });
        }

        // 3. Light Novel chapter updates
        for (const entry of lnReadList) {
            const anilistId = extractAnilistId(entry.id);
            const remote = anilistId > 0 ? readingById.get(anilistId) : undefined;
            const cachedChapters = offlineLibraryCache.getLNChapters([entry.id, anilistId > 0 ? anilistId : undefined]);
            const highestCached = cachedChapters.reduce((max, ch) => Math.max(max, parseChapterNum(ch.number ?? ch.title)), 0);
            const latestChapter = Math.max(
                Number(remote?.chapters || 0),
                highestCached
            );
            if (latestChapter <= 0) continue;

            const title = remote?.title?.english || remote?.title?.romaji || entry.title || 'Light Novel';
            const normTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '');
            const progress = continueLNList.find((c) => {
                if (String(c.novelId) === String(entry.id)) return true;
                return c.novelTitle?.toLowerCase().replace(/[^a-z0-9]+/g, '') === normTitle;
            });
            const readChapter = parseChapterNum(progress?.chapterNumber);
            if (readChapter <= 0 || readChapter >= latestChapter) continue;

            const seenKey = `ln:${entry.id}`;
            const seenCh = Number(seenMap[seenKey] || 0);
            items.push({
                id: `ln-${entry.id}-ch-${latestChapter}`,
                mediaType: 'ln',
                seenKey,
                entryId: String(entry.id),
                routePath: `/ln/details/${encodeURIComponent(String(entry.id))}`,
                anilistId,
                title,
                image: remote?.coverImage?.large || entry.image || '',
                latestEpisode: latestChapter,
                watchedEpisode: readChapter,
                unread: seenCh < latestChapter,
            });
        }

        return items.sort((a, b) => {
            if (a.unread !== b.unread) return a.unread ? -1 : 1;
            return (a.nextAiringAt || Infinity) - (b.nextAiringAt || Infinity);
        });
    }, [continueWatchingList, continueReadingList, continueLNList, mediaList, readingMediaList, readList, lnReadList, seenMap]);

    const unreadCount = useMemo(
        () => notifications.filter((n) => n.unread).length,
        [notifications]
    );

    // Automatically push native Android notifications for newly detected unread episodes & chapters
    useEffect(() => {
        if (getRuntimePlatform() !== 'android') return;
        const unreadItems = notifications.filter((n) => n.unread);
        if (unreadItems.length === 0) return;

        const pushed = readPushedMap();
        const toPush = unreadItems.filter(
            (item) => Number(pushed[item.seenKey] || 0) < item.latestEpisode
        );
        if (toPush.length === 0) return;

        const nextPushed = { ...pushed };
        toPush.forEach((item) => {
            nextPushed[item.seenKey] = item.latestEpisode;
        });
        writePushedMap(nextPushed);

        const first = toPush[0];
        const firstUnit = first.mediaType === 'anime' ? 'Ep' : 'Ch';
        const summaryText =
            toPush.length > 1
                ? `${toPush.length} new updates available`
                : `${first.title} · ${firstUnit} ${first.latestEpisode}`;

        toPush.forEach((item) => {
            void notifyEpisodeUpdate({
                mediaType: item.mediaType,
                entryId: item.entryId,
                title: item.title,
                episodeNumber: item.latestEpisode,
                watchedEpisode: item.watchedEpisode,
                unreadCount: toPush.length,
                summaryText,
            }).catch(() => undefined);
        });
    }, [notifications]);

    const markAsRead = useCallback((keyOrAnilistId: number | string, episodeNumber: number) => {
        const key = String(keyOrAnilistId);
        setSeenMap((prev) => {
            const next = { ...prev, [key]: Math.max(Number(prev[key] || 0), episodeNumber) };
            writeSeenMap(next);
            return next;
        });
    }, []);

    const markAllRead = useCallback(() => {
        setSeenMap((prev) => {
            const next = { ...prev };
            notifications.forEach((n) => {
                next[n.seenKey] = Math.max(Number(next[n.seenKey] || 0), n.latestEpisode);
            });
            writeSeenMap(next);
            return next;
        });
    }, [notifications]);

    return {
        notifications,
        unreadCount,
        loading,
        refresh: () => void refresh(true),
        markAsRead,
        markAllRead,
    };
}

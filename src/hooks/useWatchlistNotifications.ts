import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { postJson } from '../platform/nativeHttp';
import { getRuntimePlatform } from '../platform/runtime';
import { notifyEpisodeUpdate } from '../platform/downloadNotification';
import { useWatchList } from './useWatchList';
import { useContinueWatching } from './useContinueWatching';
import { parseAnimeRouteId } from '../utils/animeNavigation';

export interface WatchlistEpisodeNotification {
    id: string;
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

const READ_STORAGE_KEY = 'yorumi_notif_seen_v1';
const PUSHED_STORAGE_KEY = 'yorumi_notif_pushed_v1';
const CACHE_STORAGE_KEY = 'yorumi_notif_cache_v1';
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

export function useWatchlistNotifications() {
    const { watchList } = useWatchList();
    const { continueWatchingList } = useContinueWatching();
    const [mediaList, setMediaList] = useState<AniListAiringMedia[]>(() => {
        try {
            const cached = JSON.parse(localStorage.getItem(CACHE_STORAGE_KEY) || 'null') as {
                timestamp: number;
                media: AniListAiringMedia[];
            } | null;
            if (cached && Array.isArray(cached.media) && Date.now() - cached.timestamp < 60 * 60 * 1000) {
                return cached.media;
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

    const idsKey = watchlistAnilistIds.join(',');

    const refresh = useCallback(async (force = false) => {
        if (watchlistAnilistIds.length === 0) {
            setMediaList([]);
            return;
        }
        const now = Date.now();
        if (!force && lastFetchedKeyRef.current === idsKey && now - lastFetchedAtRef.current < CACHE_TTL_MS) {
            return;
        }

        setLoading(true);
        try {
            const query = `
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
            const res = await postJson<{ data?: { Page?: { media?: AniListAiringMedia[] } } }>(
                'https://graphql.anilist.co',
                { query, variables: { ids: watchlistAnilistIds } }
            );
            const media = res?.data?.Page?.media || [];
            lastFetchedKeyRef.current = idsKey;
            lastFetchedAtRef.current = Date.now();
            setMediaList(media);
            try {
                localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify({ timestamp: Date.now(), media }));
            } catch {
                // Ignore quota
            }
        } catch (err) {
            console.warn('[WatchlistNotifications] AniList refresh failed:', err);
        } finally {
            setLoading(false);
        }
    }, [idsKey, watchlistAnilistIds]);

    useEffect(() => {
        void refresh(false);
        const timer = window.setInterval(() => {
            void refresh(true);
        }, POLL_INTERVAL_MS);
        return () => window.clearInterval(timer);
    }, [refresh]);

    const notifications = useMemo<WatchlistEpisodeNotification[]>(() => {
        const items: WatchlistEpisodeNotification[] = [];
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

            const seenEp = Number(seenMap[String(media.id)] || 0);
            items.push({
                id: `${media.id}-ep-${latestEpisode}`,
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
        return items.sort((a, b) => {
            if (a.unread !== b.unread) return a.unread ? -1 : 1;
            return (a.nextAiringAt || Infinity) - (b.nextAiringAt || Infinity);
        });
    }, [continueWatchingList, mediaList, seenMap]);

    const unreadCount = useMemo(
        () => notifications.filter((n) => n.unread).length,
        [notifications]
    );

    // Automatically push native Android notifications for newly detected unread episodes
    useEffect(() => {
        if (getRuntimePlatform() !== 'android') return;
        const unreadItems = notifications.filter((n) => n.unread);
        if (unreadItems.length === 0) return;

        const pushed = readPushedMap();
        const toPush = unreadItems.filter(
            (item) => Number(pushed[String(item.anilistId)] || 0) < item.latestEpisode
        );
        if (toPush.length === 0) return;

        const nextPushed = { ...pushed };
        toPush.forEach((item) => {
            nextPushed[String(item.anilistId)] = item.latestEpisode;
        });
        writePushedMap(nextPushed);

        const summaryText =
            toPush.length > 1
                ? `${toPush.length} new episodes available`
                : `${toPush[0].title} · Ep ${toPush[0].latestEpisode}`;

        toPush.forEach((item) => {
            void notifyEpisodeUpdate({
                entryId: `al-${item.anilistId}`,
                title: item.title,
                episodeNumber: item.latestEpisode,
                watchedEpisode: item.watchedEpisode,
                unreadCount: toPush.length,
                summaryText,
            }).catch(() => undefined);
        });
    }, [notifications]);

    const markAsRead = useCallback((anilistId: number, episodeNumber: number) => {
        setSeenMap((prev) => {
            const next = { ...prev, [String(anilistId)]: Math.max(Number(prev[String(anilistId)] || 0), episodeNumber) };
            writeSeenMap(next);
            return next;
        });
    }, []);

    const markAllRead = useCallback(() => {
        setSeenMap((prev) => {
            const next = { ...prev };
            notifications.forEach((n) => {
                next[String(n.anilistId)] = Math.max(Number(next[String(n.anilistId)] || 0), n.latestEpisode);
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

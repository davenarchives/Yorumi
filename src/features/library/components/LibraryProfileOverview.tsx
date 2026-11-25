import { useEffect, useMemo, useState } from 'react';
import { useActivityHistory } from '../../../hooks/useActivityHistory';
import { storage, type ReadListItem, type ReadProgress, type WatchListItem, type WatchProgress } from '../../../utils/storage';
import type { LNReadingProgress } from '../../../hooks/useContinueLNReading';
import type { LNReadListItem } from '../../../types/ln';
import type { Anime } from '../../../types/anime';
import { getDisplayImageUrl } from '../../../utils/image';
import { tmdbService } from '../../../services/tmdbService';
import type { PublicUserProfile } from '../../../services/userService';

interface DiscordUserProfile {
    id: string;
    username: string;
    handle?: string;
    avatar?: string;
}

interface LibraryProfileOverviewProps {
    continueWatchingList: WatchProgress[];
    continueReadingList: ReadProgress[];
    continueLNList: LNReadingProgress[];
    watchList: WatchListItem[];
    readList: ReadListItem[];
    lnReadList: LNReadListItem[];
    publicProfileOverride?: PublicUserProfile;
}

const DISCORD_SESSION_KEY = 'yorumi_discord_chat_session_v1';
const FIRST_SEEN_KEY = 'yorumi_profile_first_seen_v1';
const ESTIMATED_EPISODE_SECONDS = 24 * 60;
const ESTIMATED_MANGA_CHAPTER_SECONDS = 5 * 60;
const ESTIMATED_LN_CHAPTER_SECONDS = 12 * 60;
const WEEKS_TO_SHOW = 26;

const formatHoursLabel = (seconds: number): string => {
    if (!Number.isFinite(seconds) || seconds <= 0) return '0.0h';
    const hours = seconds / 3600;
    if (hours < 0.1) return '<0.1h';
    return `${hours.toFixed(1)}h`;
};

const readDiscordUser = (): DiscordUserProfile | null => {
    try {
        const raw = localStorage.getItem(DISCORD_SESSION_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { user?: DiscordUserProfile };
        return parsed?.user?.username ? parsed.user : null;
    } catch {
        return null;
    }
};

const toDateKey = (date: Date): string => [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
].join('-');

const toDateKeyFromMs = (ms?: number | string): string | null => {
    if (!ms) return null;
    const numeric = typeof ms === 'number' ? ms : Date.parse(ms);
    if (!Number.isFinite(numeric) || numeric <= 0) return null;
    return toDateKey(new Date(numeric));
};

const formatMonthYear = (ms: number): string =>
    new Date(ms).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

const formatTooltipDate = (date: Date): string =>
    date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

const getOrCreateFirstSeen = (candidates: number[]): number => {
    const validCandidates = candidates.filter((v) => Number.isFinite(v) && v > 0);
    let stored = 0;
    try {
        const raw = Number(localStorage.getItem(FIRST_SEEN_KEY) || 0);
        if (Number.isFinite(raw) && raw > 0) stored = raw;
    } catch {
        // Ignore storage errors
    }
    const earliest = validCandidates.length > 0
        ? Math.min(...validCandidates, stored || Infinity)
        : (stored || Date.now());
    if (!stored || earliest < stored) {
        try {
            localStorage.setItem(FIRST_SEEN_KEY, String(earliest));
        } catch {
            // Ignore storage errors
        }
    }
    return earliest;
};

export default function LibraryProfileOverview({
    continueWatchingList,
    continueReadingList,
    continueLNList,
    watchList,
    readList,
    lnReadList,
    publicProfileOverride,
}: LibraryProfileOverviewProps) {
    const { activityData: localActivityData } = useActivityHistory();
    const [localDiscordUser, setLocalDiscordUser] = useState<DiscordUserProfile | null>(readDiscordUser);
    const [storageTick, setStorageTick] = useState(0);
    const [mobileExpandedCard, setMobileExpandedCard] = useState<'activity' | 'genres'>('activity');

    const discordUser = useMemo<DiscordUserProfile | null>(() => {
        if (publicProfileOverride) {
            return {
                id: publicProfileOverride.uid,
                username: publicProfileOverride.displayName || 'Yorumi User',
                avatar: publicProfileOverride.avatar || undefined,
            };
        }
        return localDiscordUser;
    }, [localDiscordUser, publicProfileOverride]);

    const activityData = useMemo(
        () => (publicProfileOverride ? (publicProfileOverride.activityHistory || {}) : localActivityData),
        [localActivityData, publicProfileOverride],
    );

    useEffect(() => {
        if (publicProfileOverride) return;
        const onSessionChange = () => setLocalDiscordUser(readDiscordUser());
        const onStorageUpdated = () => setStorageTick((t) => t + 1);
        window.addEventListener('yorumi-discord-session-updated', onSessionChange);
        window.addEventListener('storage', onSessionChange);
        window.addEventListener('yorumi-storage-updated', onStorageUpdated);
        return () => {
            window.removeEventListener('yorumi-discord-session-updated', onSessionChange);
            window.removeEventListener('storage', onSessionChange);
            window.removeEventListener('yorumi-storage-updated', onStorageUpdated);
        };
    }, [publicProfileOverride]);

    // Backfill missing genres for existing watched anime via one batched AniList query so Top Genres always populates
    useEffect(() => {
        if (publicProfileOverride) return;
        const cache = storage.getAnimeGenreCache();
        const anilistIds = new Set<number>();
        const malIds = new Set<number>();
        const idMapByAnilist = new Map<number, string[]>();
        const idMapByMal = new Map<number, string[]>();

        const register = (rawId: string, anilistId?: number | string, malId?: number | string) => {
            const keys = [rawId, anilistId ? String(anilistId) : '', malId ? String(malId) : ''].filter(Boolean);
            if (keys.some((k) => cache[k]?.length)) return;
            const alNum = Number(anilistId);
            const malNum = Number(malId || (/^\d+$/.test(rawId) ? rawId : 0));
            if (Number.isFinite(alNum) && alNum > 0) {
                anilistIds.add(alNum);
                idMapByAnilist.set(alNum, [...(idMapByAnilist.get(alNum) || []), ...keys]);
            } else if (Number.isFinite(malNum) && malNum > 0) {
                malIds.add(malNum);
                idMapByMal.set(malNum, [...(idMapByMal.get(malNum) || []), ...keys]);
            }
        };

        continueWatchingList.forEach((item) => register(String(item.animeId), item.anilistId, item.malId));
        watchList.forEach((item) => {
            if (item.genres && item.genres.length > 0) return;
            register(String(item.id), item.anilistId, item.malId);
        });

        if (anilistIds.size === 0 && malIds.size === 0) return;

        let cancelled = false;
        const fetchBatch = async (varName: 'id_in' | 'idMal_in', ids: number[], map: Map<number, string[]>) => {
            if (ids.length === 0) return false;
            const res = await fetch('https://graphql.anilist.co', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({
                    query: `query ($ids: [Int]) { Page(perPage: 50) { media(${varName}: $ids, type: ANIME) { id idMal genres } } }`,
                    variables: { ids: ids.slice(0, 50) },
                }),
            });
            if (!res.ok) return false;
            const json = (await res.json()) as {
                data?: { Page?: { media?: Array<{ id?: number; idMal?: number; genres?: string[] }> } };
            };
            const list = json?.data?.Page?.media || [];
            const nextCache = { ...storage.getAnimeGenreCache() };
            let savedAny = false;
            for (const media of list) {
                const genres = (media.genres || []).filter(Boolean);
                if (genres.length === 0) continue;
                const lookupKey = varName === 'id_in' ? media.id : media.idMal;
                const targetKeys = new Set<string>([
                    ...(lookupKey ? map.get(lookupKey) || [] : []),
                    ...(media.id ? [String(media.id)] : []),
                    ...(media.idMal ? [String(media.idMal)] : []),
                ]);
                targetKeys.forEach((k) => {
                    nextCache[k] = genres;
                    savedAny = true;
                });
            }
            if (savedAny) {
                storage.setAnimeGenreCache(nextCache);
            }
            return savedAny;
        };

        void Promise.all([
            fetchBatch('id_in', Array.from(anilistIds), idMapByAnilist).catch(() => false),
            fetchBatch('idMal_in', Array.from(malIds), idMapByMal).catch(() => false),
        ]).then((results) => {
            if (!cancelled && results.some(Boolean)) {
                setStorageTick((t) => t + 1);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [continueWatchingList, publicProfileOverride, watchList]);

    // Fullscreen backdrop source based on most recently watched anime (matching DetailsHero TMDB resolution)
    const bannerSource = useMemo(() => {
        const recentAnime = [...continueWatchingList].sort(
            (a, b) => (b.lastWatched || b.timestamp || 0) - (a.lastWatched || a.timestamp || 0)
        )[0];
        if (recentAnime) {
            const poster = recentAnime.animePoster || recentAnime.animeImage || recentAnime.episodeThumbnail || '';
            const animeLookup: Partial<Anime> = {
                id: recentAnime.anilistId || (Number.isFinite(Number(recentAnime.animeId)) ? Number(recentAnime.animeId) : 0),
                mal_id: recentAnime.malId || 0,
                title: recentAnime.animeTitle,
                title_english: recentAnime.animeTitle,
                anilist_banner_image: recentAnime.animeImage || undefined,
                images: { jpg: { image_url: poster, large_image_url: poster } },
            };
            return {
                key: `anime:${recentAnime.anilistId || recentAnime.animeId}:${recentAnime.animeTitle}`,
                animeLookup: animeLookup as Anime,
                poster,
                fallbackBackdrop: recentAnime.animeImage || recentAnime.episodeThumbnail || poster,
                title: recentAnime.animeTitle,
            };
        }
        const recentWatchlist = [...watchList].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))[0];
        if (recentWatchlist?.image) {
            const animeLookup: Partial<Anime> = {
                id: Number(recentWatchlist.anilistId || recentWatchlist.id) || 0,
                mal_id: Number(recentWatchlist.malId || 0),
                title: recentWatchlist.title,
                title_english: recentWatchlist.title,
                images: { jpg: { image_url: recentWatchlist.image, large_image_url: recentWatchlist.image } },
            };
            return {
                key: `watchlist:${recentWatchlist.anilistId || recentWatchlist.id}:${recentWatchlist.title}`,
                animeLookup: animeLookup as Anime,
                poster: recentWatchlist.image,
                fallbackBackdrop: recentWatchlist.image,
                title: recentWatchlist.title,
            };
        }
        const recentManga = [...continueReadingList].sort(
            (a, b) => (b.lastRead || b.timestamp || 0) - (a.lastRead || a.timestamp || 0)
        )[0];
        if (recentManga) {
            const img = recentManga.mangaImage || recentManga.mangaPoster || '';
            if (img) {
                return {
                    key: `manga:${recentManga.mangaId}`,
                    animeLookup: null,
                    poster: recentManga.mangaPoster || img,
                    fallbackBackdrop: img,
                    title: recentManga.mangaTitle,
                };
            }
        }
        const recentLN = continueLNList[0];
        if (recentLN?.coverImage) {
            return {
                key: `ln:${recentLN.novelId}`,
                animeLookup: null,
                poster: recentLN.coverImage,
                fallbackBackdrop: recentLN.coverImage,
                title: recentLN.novelTitle,
            };
        }
        return null;
    }, [continueLNList, continueReadingList, continueWatchingList, watchList]);

    const [resolvedTmdbBackdrop, setResolvedTmdbBackdrop] = useState<{ key: string; url: string | null }>({
        key: '',
        url: null,
    });

    useEffect(() => {
        if (!bannerSource?.animeLookup) return;
        let cancelled = false;
        void tmdbService.getBackdropForAnime(bannerSource.animeLookup, 'original').then((backdrop) => {
            if (!cancelled && backdrop) {
                setResolvedTmdbBackdrop({ key: bannerSource.key, url: backdrop });
            }
        });
        return () => {
            cancelled = true;
        };
    }, [bannerSource]);

    const cachedOriginal = bannerSource?.animeLookup
        ? tmdbService.getCachedBackdropForAnime(bannerSource.animeLookup, 'original')
        : null;
    const cachedPreview = bannerSource?.animeLookup
        ? tmdbService.getCachedBackdropForAnime(bannerSource.animeLookup, 'w780')
        : null;
    const tmdbBackdrop = (bannerSource && resolvedTmdbBackdrop.key === bannerSource.key ? resolvedTmdbBackdrop.url : null) || cachedOriginal;
    const rawPrimaryBackdrop = tmdbBackdrop || bannerSource?.fallbackBackdrop || cachedPreview || bannerSource?.poster || '';
    const primaryBackdrop = rawPrimaryBackdrop ? getDisplayImageUrl(rawPrimaryBackdrop) : '';
    const previewBackdrop = cachedPreview ? getDisplayImageUrl(cachedPreview) : null;
    const mobilePoster = bannerSource?.poster ? getDisplayImageUrl(bannerSource.poster) : '';

    // Summary counts & joined date (watched anime, read manga, read LN)
    const { watchedAnimeCount, readMangaCount, readLNCount, watchlistCount, joinedLabel } = useMemo(() => {
        void storageTick;
        const episodeHistory = publicProfileOverride ? (publicProfileOverride.episodeHistory || {}) : storage.getEpisodeHistory();
        const chapterHistory = publicProfileOverride ? (publicProfileOverride.chapterHistory || {}) : storage.getChapterHistory();

        const animeKeys = new Set<string>();
        continueWatchingList.forEach((item) => {
            animeKeys.add(`a:${(item.animeTitle || item.animeId).toLowerCase().trim()}`);
        });
        watchList.forEach((item) => {
            if (item.status === 'completed' || item.status === 'watching' || (item.currentProgress || 0) > 0) {
                animeKeys.add(`a:${(item.title || item.id).toLowerCase().trim()}`);
            }
        });
        if (animeKeys.size === 0) {
            Object.entries(episodeHistory).forEach(([id, eps]) => {
                if (eps.length > 0) animeKeys.add(`a:${id.toLowerCase().trim()}`);
            });
        }

        const mangaKeys = new Set<string>();
        continueReadingList.forEach((item) => {
            mangaKeys.add(`m:${String(item.mangaTitle || item.mangaId).toLowerCase().trim()}`);
        });
        readList.forEach((item) => {
            if (item.status === 'completed' || item.status === 'reading' || (item.currentProgress || 0) > 0) {
                mangaKeys.add(`m:${String(item.title || item.id).toLowerCase().trim()}`);
            }
        });
        if (mangaKeys.size === 0) {
            Object.entries(chapterHistory).forEach(([id, chs]) => {
                if (chs.length > 0) mangaKeys.add(`m:${id.toLowerCase().trim()}`);
            });
        }

        const lnKeys = new Set<string>();
        continueLNList.forEach((item) => {
            lnKeys.add(`ln:${String(item.novelTitle || item.novelId).toLowerCase().trim()}`);
        });

        const timestamps: number[] = [];
        continueWatchingList.forEach((i) => {
            if (i.lastWatched) timestamps.push(i.lastWatched);
            if (i.timestamp) timestamps.push(i.timestamp);
        });
        watchList.forEach((i) => { if (i.addedAt) timestamps.push(i.addedAt); });
        continueReadingList.forEach((i) => { if (i.lastRead || i.timestamp) timestamps.push(i.lastRead || i.timestamp); });
        readList.forEach((i) => { if (i.addedAt) timestamps.push(i.addedAt); });
        continueLNList.forEach((i) => {
            const parsed = Date.parse(i.updatedAt);
            if (Number.isFinite(parsed)) timestamps.push(parsed);
        });
        Object.keys(activityData).forEach((dateKey) => {
            const parsed = Date.parse(`${dateKey}T00:00:00`);
            if (Number.isFinite(parsed)) timestamps.push(parsed);
        });

        const earliest = publicProfileOverride
            ? (() => {
                const parsedCreation = publicProfileOverride.creationTime ? Date.parse(publicProfileOverride.creationTime) : NaN;
                const valid = timestamps.filter((v) => Number.isFinite(v) && v > 0);
                if (Number.isFinite(parsedCreation) && parsedCreation > 0) {
                    return valid.length > 0 ? Math.min(parsedCreation, ...valid) : parsedCreation;
                }
                return valid.length > 0 ? Math.min(...valid) : Date.now();
            })()
            : getOrCreateFirstSeen(timestamps);
        return {
            watchedAnimeCount: animeKeys.size,
            readMangaCount: mangaKeys.size,
            readLNCount: lnKeys.size,
            watchlistCount: watchList.length + readList.length + lnReadList.length,
            joinedLabel: formatMonthYear(earliest),
        };
    }, [activityData, continueLNList, continueReadingList, continueWatchingList, lnReadList, publicProfileOverride, readList, storageTick, watchList]);

    // Activity heatmap (last 26 weeks, Mon–Sun)
    const { weeks, monthLabels, activeDays, streakDays } = useMemo(() => {
        const merged: Record<string, number> = { ...activityData };
        const backfillCounts: Record<string, number> = {};
        const bumpBackfill = (key: string | null) => {
            if (!key) return;
            backfillCounts[key] = (backfillCounts[key] || 0) + 1;
        };

        // Backfill activity from watched anime, read manga, and read LN timestamps
        continueWatchingList.forEach((item) => {
            bumpBackfill(toDateKeyFromMs(item.lastWatched || item.timestamp));
        });
        continueReadingList.forEach((item) => {
            bumpBackfill(toDateKeyFromMs(item.lastRead || item.timestamp));
        });
        continueLNList.forEach((item) => {
            bumpBackfill(toDateKeyFromMs(item.updatedAt));
        });
        Object.entries(backfillCounts).forEach(([dateKey, count]) => {
            merged[dateKey] = Math.max(merged[dateKey] || 0, count);
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        // Monday-based weekday index (0 = Mon .. 6 = Sun)
        const todayMonIdx = (today.getDay() + 6) % 7;
        const endOfWeek = new Date(today);
        endOfWeek.setDate(today.getDate() + (6 - todayMonIdx));

        const start = new Date(endOfWeek);
        start.setDate(endOfWeek.getDate() - (WEEKS_TO_SHOW * 7 - 1));

        const grid: Array<Array<{ key: string; date: Date; count: number; isFuture: boolean }>> = [];
        const months: Array<{ col: number; label: string }> = [];
        let lastMonth = -1;

        for (let w = 0; w < WEEKS_TO_SHOW; w += 1) {
            const col: Array<{ key: string; date: Date; count: number; isFuture: boolean }> = [];
            for (let d = 0; d < 7; d += 1) {
                const cellDate = new Date(start);
                cellDate.setDate(start.getDate() + w * 7 + d);
                const key = toDateKey(cellDate);
                const isFuture = cellDate.getTime() > today.getTime();
                col.push({
                    key,
                    date: cellDate,
                    count: isFuture ? 0 : (merged[key] || 0),
                    isFuture,
                });
            }
            const firstOfCol = col[0].date;
            if (firstOfCol.getMonth() !== lastMonth) {
                const prev = months[months.length - 1];
                if (!prev || w - prev.col >= 3) {
                    months.push({
                        col: w,
                        label: firstOfCol.toLocaleDateString(undefined, { month: 'short' }),
                    });
                }
                lastMonth = firstOfCol.getMonth();
            }
            grid.push(col);
        }

        const activeDayCount = Object.values(merged).filter((count) => count > 0).length;

        // Current streak (allowing today or yesterday as the active anchor)
        let streak = 0;
        const cursor = new Date(today);
        if ((merged[toDateKey(cursor)] || 0) === 0) {
            cursor.setDate(cursor.getDate() - 1);
        }
        while ((merged[toDateKey(cursor)] || 0) > 0) {
            streak += 1;
            cursor.setDate(cursor.getDate() - 1);
        }

        return {
            weeks: grid,
            monthLabels: months,
            activeDays: activeDayCount,
            streakDays: streak,
        };
    }, [activityData, continueLNList, continueReadingList, continueWatchingList, watchList]);

    // Top genres & total hours (Anime + Manga + Light Novel)
    const { topGenres, totalSeconds } = useMemo(() => {
        void storageTick;
        const animeWatchTime = publicProfileOverride ? (publicProfileOverride.animeWatchTime || {}) : storage.getAnimeWatchTime();
        const episodeHistory = publicProfileOverride ? (publicProfileOverride.episodeHistory || {}) : storage.getEpisodeHistory();
        const chapterHistory = publicProfileOverride ? (publicProfileOverride.chapterHistory || {}) : storage.getChapterHistory();
        const animeGenreCache = publicProfileOverride ? (publicProfileOverride.animeGenreCache || {}) : storage.getAnimeGenreCache();
        const mangaGenreCache = publicProfileOverride ? (publicProfileOverride.mangaGenreCache || {}) : storage.getMangaGenreCache();

        const getEstimatedSecondsForAnime = (
            candidateIds: Array<string | number | undefined>,
            fallbackEpCount = 0,
            positionSeconds = 0,
        ): number => {
            const ids = candidateIds
                .map((v) => (v !== undefined && v !== null ? String(v).trim() : ''))
                .filter(Boolean);
            let recorded = 0;
            let watchedEps = 0;
            for (const id of ids) {
                recorded = Math.max(recorded, Number(animeWatchTime[id] || 0));
                watchedEps = Math.max(watchedEps, episodeHistory[id]?.length || 0);
            }
            if (recorded > 0) {
                return Math.max(recorded, positionSeconds || 0);
            }
            if (watchedEps > 0) {
                return Math.max(watchedEps * ESTIMATED_EPISODE_SECONDS, positionSeconds || 0);
            }
            if (fallbackEpCount > 0) {
                return Math.max(fallbackEpCount * ESTIMATED_EPISODE_SECONDS, positionSeconds || 0);
            }
            return positionSeconds || 0;
        };

        const getEstimatedSecondsForManga = (
            candidateIds: Array<string | number | undefined>,
            fallbackChapterCount = 0,
        ): number => {
            const ids = candidateIds
                .map((v) => (v !== undefined && v !== null ? String(v).trim() : ''))
                .filter(Boolean);
            let readChapters = 0;
            for (const id of ids) {
                readChapters = Math.max(readChapters, chapterHistory[id]?.length || 0);
            }
            const chapters = Math.max(readChapters, fallbackChapterCount);
            return chapters > 0 ? chapters * ESTIMATED_MANGA_CHAPTER_SECONDS : 0;
        };

        const resolveGenresFromCache = (
            cache: Record<string, string[]>,
            candidateIds: Array<string | number | undefined>,
        ): string[] => {
            for (const rawId of candidateIds) {
                if (rawId === undefined || rawId === null) continue;
                const id = String(rawId).trim();
                if (id && cache[id]?.length) return cache[id];
            }
            return [];
        };

        const titleGenres = new Map<string, { genres: string[]; seconds: number }>();
        const allTitleSeconds = new Map<string, number>();

        const recordTitleSeconds = (key: string, seconds: number) => {
            if (seconds <= 0) return;
            allTitleSeconds.set(key, Math.max(allTitleSeconds.get(key) || 0, seconds));
        };

        watchList.forEach((item) => {
            const id = String(item.id);
            const key = `a:${(item.title || id).toLowerCase().trim()}`;
            const genres = (item.genres && item.genres.length > 0)
                ? item.genres
                : resolveGenresFromCache(animeGenreCache, [id, item.anilistId, item.malId, item.scraperId]);
            const seconds = getEstimatedSecondsForAnime(
                [id, item.anilistId, item.malId, item.scraperId],
                item.currentProgress || 0,
            );
            recordTitleSeconds(key, seconds);
            if (genres.length > 0) {
                const prev = titleGenres.get(key);
                titleGenres.set(key, {
                    genres: prev?.genres.length ? prev.genres : genres,
                    seconds: Math.max(prev?.seconds || 0, seconds),
                });
            }
        });

        continueWatchingList.forEach((item) => {
            const id = String(item.animeId);
            const key = `a:${(item.animeTitle || id).toLowerCase().trim()}`;
            const prev = titleGenres.get(key);
            const genres = prev?.genres.length
                ? prev.genres
                : resolveGenresFromCache(animeGenreCache, [id, item.anilistId, item.malId]);
            const seconds = Math.max(
                prev?.seconds || 0,
                getEstimatedSecondsForAnime(
                    [id, item.anilistId, item.malId],
                    0,
                    item.positionSeconds || 0,
                ),
            );
            recordTitleSeconds(key, seconds);
            if (genres.length > 0) {
                titleGenres.set(key, { genres, seconds });
            }
        });

        readList.forEach((item) => {
            const id = String(item.id);
            const key = `m:${(item.title || id).toLowerCase().trim()}`;
            const genres = (item.genres && item.genres.length > 0)
                ? item.genres
                : resolveGenresFromCache(mangaGenreCache, [id, item.anilistId, item.malId, item.scraperId]);
            const seconds = getEstimatedSecondsForManga(
                [id, item.anilistId, item.malId, item.scraperId],
                item.currentProgress || 0,
            );
            recordTitleSeconds(key, seconds);
            if (genres.length > 0) {
                const prev = titleGenres.get(key);
                titleGenres.set(key, {
                    genres: prev?.genres.length ? prev.genres : genres,
                    seconds: Math.max(prev?.seconds || 0, seconds),
                });
            }
        });

        continueReadingList.forEach((item) => {
            const id = String(item.mangaId);
            const key = `m:${(item.mangaTitle || id).toLowerCase().trim()}`;
            const prev = titleGenres.get(key);
            const genres = prev?.genres.length
                ? prev.genres
                : resolveGenresFromCache(mangaGenreCache, [id]);
            const seconds = Math.max(
                prev?.seconds || 0,
                getEstimatedSecondsForManga([id], 1),
            );
            recordTitleSeconds(key, seconds);
            if (genres.length > 0) {
                titleGenres.set(key, { genres, seconds });
            }
        });

        lnReadList.forEach((item) => {
            const id = String(item.id);
            const key = `ln:${(item.title || id).toLowerCase().trim()}`;
            if (item.genres && item.genres.length > 0) {
                const prev = titleGenres.get(key);
                titleGenres.set(key, {
                    genres: prev?.genres.length ? prev.genres : item.genres,
                    seconds: prev?.seconds || 0,
                });
            }
        });

        continueLNList.forEach((item) => {
            const id = String(item.novelId);
            const key = `ln:${(item.novelTitle || id).toLowerCase().trim()}`;
            const prev = titleGenres.get(key);
            const seconds = Math.max(prev?.seconds || 0, ESTIMATED_LN_CHAPTER_SECONDS);
            recordTitleSeconds(key, seconds);
            if (prev?.genres.length) {
                titleGenres.set(key, { genres: prev.genres, seconds });
            }
        });

        // Compute total hours across all watched anime + read manga + read LN
        const trackedTotalSeconds = publicProfileOverride
            ? Number(publicProfileOverride.animeWatchTimeTotalSeconds || 0)
            : storage.getAnimeWatchTimeTotalSeconds();
        const summedTitleSeconds = Array.from(allTitleSeconds.values()).reduce((sum, s) => sum + s, 0);
        const estimatedTotalSeconds = Math.max(trackedTotalSeconds, summedTitleSeconds);

        const genreMap = new Map<string, { name: string; titles: number; seconds: number }>();
        titleGenres.forEach(({ genres, seconds }) => {
            const uniqueGenres = Array.from(new Set(genres.map((g) => g.trim()).filter(Boolean)));
            uniqueGenres.forEach((genre) => {
                const current = genreMap.get(genre) || { name: genre, titles: 0, seconds: 0 };
                current.titles += 1;
                current.seconds += seconds;
                genreMap.set(genre, current);
            });
        });

        const sorted = [...genreMap.values()]
            .sort((a, b) => (b.titles - a.titles) || (b.seconds - a.seconds))
            .slice(0, 5);

        return {
            topGenres: sorted,
            totalSeconds: estimatedTotalSeconds,
        };
    }, [continueLNList, continueReadingList, continueWatchingList, lnReadList, publicProfileOverride, readList, storageTick, watchList]);

    const maxGenreMetric = useMemo(() => {
        if (topGenres.length === 0) return 1;
        return Math.max(...topGenres.map((g) => g.titles), 1);
    }, [topGenres]);

    const displayName = discordUser?.username || 'Your Library';
    const avatarInitial = displayName.charAt(0).toUpperCase() || 'Y';

    const getCellColorClass = (count: number, isFuture: boolean) => {
        if (isFuture) return 'bg-transparent';
        if (count <= 0) return 'bg-white/[0.05]';
        if (count === 1) return 'bg-white/30';
        if (count === 2) return 'bg-white/55';
        if (count === 3) return 'bg-white/80';
        return 'bg-white';
    };

    return (
        <>
            {/* Fullscreen DetailsHero-style backdrop behind the entire top viewport */}
            <div
                className="pointer-events-none absolute inset-x-0 top-0 z-0 h-screen min-h-[640px] w-full select-none"
                style={{
                    maskImage: 'linear-gradient(to bottom, #000 0%, #000 35%, rgba(0,0,0,0.75) 58%, rgba(0,0,0,0.32) 74%, rgba(0,0,0,0.08) 88%, transparent 100%)',
                    WebkitMaskImage: 'linear-gradient(to bottom, #000 0%, #000 35%, rgba(0,0,0,0.75) 58%, rgba(0,0,0,0.32) 74%, rgba(0,0,0,0.08) 88%, transparent 100%)',
                }}
            >
                {mobilePoster ? (
                    <div
                        className="md:hidden absolute inset-0 bg-cover bg-top bg-no-repeat"
                        style={{ backgroundImage: `url(${mobilePoster})` }}
                    />
                ) : null}

                {previewBackdrop && previewBackdrop !== primaryBackdrop && (
                    <div
                        className="hidden md:block absolute inset-0 bg-cover bg-center bg-no-repeat"
                        style={{ backgroundImage: `url(${previewBackdrop})` }}
                    />
                )}

                {primaryBackdrop ? (
                    <div
                        className="hidden md:block absolute inset-0 bg-cover bg-center bg-no-repeat"
                        style={{ backgroundImage: `url(${primaryBackdrop})` }}
                    />
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-b from-white/[0.06] via-[#0d0e12] to-[#0a0a0a]" />
                )}

                {/* Exact DetailsHero / SpotlightHero vignette overlays */}
                <div className="absolute inset-y-0 left-0 w-full md:w-[65%] bg-gradient-to-r from-[#070707]/90 via-[#070707]/50 to-transparent z-10 pointer-events-none" />
                <div className="absolute inset-x-0 top-0 h-[22%] bg-gradient-to-b from-black/60 to-transparent z-10 pointer-events-none" />
                <div className="absolute inset-y-0 right-0 w-[15%] bg-gradient-to-l from-black/45 to-transparent z-10 pointer-events-none" />
            </div>

            <section className="relative z-10 w-full">
                {/* Profile Identity Overlay (hidden when signed out, preserving clean hero spacing) */}
                <div className="w-full max-w-7xl mx-auto px-4 md:px-14 pt-[calc(max(env(safe-area-inset-top,0px),16px)+3.5rem)] md:pt-28 pb-5 md:pb-8">
                    {discordUser ? (
                        <div className="flex items-center gap-4 md:gap-5">
                            <div className="relative h-16 w-16 md:h-20 md:w-20 shrink-0 overflow-hidden rounded-full bg-zinc-900">
                                {discordUser.avatar ? (
                                    <img
                                        src={discordUser.avatar}
                                        alt={displayName}
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-700 via-zinc-800 to-zinc-950 text-2xl md:text-3xl font-bold text-white">
                                        {avatarInitial}
                                    </div>
                                )}
                            </div>
                            <div className="min-w-0">
                                <h1 className="truncate text-2xl md:text-3xl font-bold tracking-tight text-white">
                                    {displayName}
                                </h1>
                                <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs md:text-sm text-zinc-200/90">
                                    <span>Joined {joinedLabel}</span>
                                    <span className="text-zinc-400">·</span>
                                    <span>{watchedAnimeCount} anime</span>
                                    <span className="text-zinc-400">·</span>
                                    <span>{readMangaCount} manga</span>
                                    <span className="text-zinc-400">·</span>
                                    <span>{readLNCount} LN</span>
                                    <span className="text-zinc-400">·</span>
                                    <span>{watchlistCount} in lists</span>
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="h-2 md:h-20" aria-hidden="true" />
                    )}
                </div>

                {/* Activity + Top Genres Cards (tap-to-expand split row on mobile, 2-column grid on desktop) */}
                <div className="w-full max-w-7xl mx-auto px-3.5 sm:px-4 md:px-14 pt-1 pb-4 md:pb-6">
                    <div className="flex h-[196px] md:h-auto items-stretch gap-2.5 md:grid md:grid-cols-2 md:gap-5">
                        {/* Activity Heatmap Card */}
                        <div
                            role={mobileExpandedCard !== 'activity' ? 'button' : undefined}
                            tabIndex={mobileExpandedCard !== 'activity' ? 0 : undefined}
                            onClick={() => {
                                if (mobileExpandedCard !== 'activity') setMobileExpandedCard('activity');
                            }}
                            onKeyDown={(e) => {
                                if (mobileExpandedCard !== 'activity' && (e.key === 'Enter' || e.key === ' ')) {
                                    e.preventDefault();
                                    setMobileExpandedCard('activity');
                                }
                            }}
                            className={`rounded-2xl bg-[#0c0d11]/70 backdrop-blur-xl transition-all duration-300 ease-out flex flex-col overflow-hidden md:flex-none md:w-auto md:p-6 ${
                                mobileExpandedCard === 'activity'
                                    ? 'flex-1 min-w-0 p-3.5 sm:p-4'
                                    : 'w-[72px] shrink-0 p-2.5 cursor-pointer hover:bg-[#0c0d11]/85 active:scale-[0.98] md:cursor-default md:hover:bg-[#0c0d11]/70 md:active:scale-100'
                            }`}
                        >
                            {/* Mobile Collapsed Activity Strip */}
                            {mobileExpandedCard !== 'activity' && (
                                <div className="flex flex-1 flex-col items-center justify-between py-1 text-center md:hidden">
                                    <span className="text-[11px] font-bold tracking-tight text-white">Activity</span>
                                    <div className="grid grid-cols-3 gap-[3px] my-2">
                                        {weeks
                                            .flat()
                                            .filter((cell) => !cell.isFuture)
                                            .slice(-9)
                                            .map((cell) => (
                                                <span
                                                    key={cell.key}
                                                    className={`h-2.5 w-2.5 rounded-[2px] ${getCellColorClass(cell.count, false)}`}
                                                />
                                            ))}
                                    </div>
                                    <div className="flex flex-col items-center leading-tight">
                                        <span className="text-xs font-bold text-white tabular-nums">{activeDays}d</span>
                                        <span className="text-[9px] text-zinc-400">active</span>
                                    </div>
                                </div>
                            )}

                            {/* Expanded Activity Content (always visible on md+, visible when selected on mobile) */}
                            <div className={`${mobileExpandedCard === 'activity' ? 'flex' : 'hidden md:flex'} flex-1 flex-col`}>
                                <div className="mb-2.5 md:mb-4 flex flex-col sm:flex-row sm:items-baseline gap-y-0.5 sm:gap-x-4">
                                    <h2 className="text-sm sm:text-base font-bold tracking-tight text-white">Activity</h2>
                                    <div className="flex flex-wrap items-baseline gap-x-2 sm:gap-x-3.5 gap-y-0.5 text-[10px] sm:text-xs leading-tight">
                                        <span>
                                            <span className="font-bold text-white tabular-nums">{watchedAnimeCount}</span>{' '}
                                            <span className="text-zinc-400">anime</span>
                                        </span>
                                        <span>
                                            <span className="font-bold text-white tabular-nums">{readMangaCount}</span>{' '}
                                            <span className="text-zinc-400">manga</span>
                                        </span>
                                        <span>
                                            <span className="font-bold text-white tabular-nums">{readLNCount}</span>{' '}
                                            <span className="text-zinc-400">LN</span>
                                        </span>
                                        <span>
                                            <span className="font-bold text-white tabular-nums">{activeDays}</span>{' '}
                                            <span className="text-zinc-400 sm:hidden">active</span>
                                            <span className="text-zinc-400 hidden sm:inline">active days</span>
                                        </span>
                                        <span className="hidden sm:inline">
                                            <span className="font-bold text-white tabular-nums">{streakDays}</span>{' '}
                                            <span className="text-zinc-400">day streak</span>
                                        </span>
                                    </div>
                                </div>

                                {/* Heatmap Grid: 14-week crisp 1:1 squares on mobile expanded card, full 26 weeks on sm+ */}
                                <div className="w-full flex-1 flex flex-col justify-center">
                                    {/* Mobile 14-week square heatmap */}
                                    <div className="sm:hidden w-full">
                                        <div className="mb-1 flex items-center pl-5">
                                            <div className="grid flex-1 gap-[3px]" style={{ gridTemplateColumns: 'repeat(14, minmax(0, 1fr))' }}>
                                                {weeks.slice(-14).map((_, idx) => {
                                                    const origCol = weeks.length - 14 + idx;
                                                    const label = monthLabels.find((m) => m.col === origCol)?.label;
                                                    return (
                                                        <span
                                                            key={origCol}
                                                            className="text-[8px] font-medium text-zinc-500 leading-none overflow-visible whitespace-nowrap"
                                                        >
                                                            {label || ''}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        <div className="flex gap-1.5 items-stretch">
                                            <div className="flex flex-col justify-between w-3.5 shrink-0 py-[1px] text-[8px] font-medium text-zinc-500 leading-none">
                                                <span>M</span>
                                                <span>W</span>
                                                <span>F</span>
                                                <span className="opacity-0">S</span>
                                            </div>
                                            <div className="grid flex-1 gap-[3px]" style={{ gridTemplateColumns: 'repeat(14, minmax(0, 1fr))' }}>
                                                {weeks.slice(-14).map((col, colIdx) => (
                                                    <div key={colIdx} className="flex flex-col gap-[3px]">
                                                        {col.map((cell) => (
                                                            <div
                                                                key={cell.key}
                                                                title={
                                                                    cell.isFuture
                                                                        ? undefined
                                                                        : `${formatTooltipDate(cell.date)} · ${cell.count} ${cell.count === 1 ? 'activity' : 'activities'}`
                                                                }
                                                                className={`aspect-square w-full rounded-[2px] transition-colors ${getCellColorClass(cell.count, cell.isFuture)}`}
                                                            />
                                                        ))}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Tablet / Desktop full 26-week heatmap */}
                                    <div className="hidden sm:block w-full overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                        <div className="w-full md:min-w-[440px]">
                                            <div className="mb-1.5 flex items-center pl-8">
                                                <div
                                                    className="grid flex-1 gap-[4px]"
                                                    style={{ gridTemplateColumns: `repeat(${WEEKS_TO_SHOW}, minmax(0, 1fr))` }}
                                                >
                                                    {weeks.map((_, colIdx) => {
                                                        const label = monthLabels.find((m) => m.col === colIdx)?.label;
                                                        return (
                                                            <span
                                                                key={colIdx}
                                                                className="text-[10px] font-medium text-zinc-500 leading-none overflow-visible whitespace-nowrap"
                                                            >
                                                                {label || ''}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            <div className="flex gap-2">
                                                <div className="grid grid-rows-7 gap-[4px] w-6 shrink-0 text-[10px] font-medium text-zinc-500">
                                                    <span className="flex items-center">Mon</span>
                                                    <span />
                                                    <span className="flex items-center">Wed</span>
                                                    <span />
                                                    <span className="flex items-center">Fri</span>
                                                    <span />
                                                    <span />
                                                </div>
                                                <div
                                                    className="grid flex-1 gap-[4px]"
                                                    style={{ gridTemplateColumns: `repeat(${WEEKS_TO_SHOW}, minmax(0, 1fr))` }}
                                                >
                                                    {weeks.map((col, colIdx) => (
                                                        <div key={colIdx} className="flex flex-col gap-[4px]">
                                                            {col.map((cell) => (
                                                                <div
                                                                    key={cell.key}
                                                                    title={
                                                                        cell.isFuture
                                                                            ? undefined
                                                                            : `${formatTooltipDate(cell.date)} · ${cell.count} ${cell.count === 1 ? 'activity' : 'activities'}`
                                                                    }
                                                                    className={`aspect-square w-full rounded-[3px] transition-colors ${getCellColorClass(cell.count, cell.isFuture)}`}
                                                                />
                                                            ))}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Top Genres Card */}
                        <div
                            role={mobileExpandedCard !== 'genres' ? 'button' : undefined}
                            tabIndex={mobileExpandedCard !== 'genres' ? 0 : undefined}
                            onClick={() => {
                                if (mobileExpandedCard !== 'genres') setMobileExpandedCard('genres');
                            }}
                            onKeyDown={(e) => {
                                if (mobileExpandedCard !== 'genres' && (e.key === 'Enter' || e.key === ' ')) {
                                    e.preventDefault();
                                    setMobileExpandedCard('genres');
                                }
                            }}
                            className={`rounded-2xl bg-[#0c0d11]/70 backdrop-blur-xl transition-all duration-300 ease-out flex flex-col overflow-hidden md:flex-none md:w-auto md:p-6 ${
                                mobileExpandedCard === 'genres'
                                    ? 'flex-1 min-w-0 p-3.5 sm:p-4'
                                    : 'w-[72px] shrink-0 p-2.5 cursor-pointer hover:bg-[#0c0d11]/85 active:scale-[0.98] md:cursor-default md:hover:bg-[#0c0d11]/70 md:active:scale-100'
                            }`}
                        >
                            {/* Mobile Collapsed Top Genres Strip */}
                            {mobileExpandedCard !== 'genres' && (
                                <div className="flex flex-1 flex-col items-center justify-between py-1 text-center md:hidden">
                                    <span className="text-[11px] font-bold tracking-tight text-white">Genres</span>
                                    <div className="flex flex-col gap-1.5 w-full px-1 my-2">
                                        <span className="h-1 w-full rounded-full bg-zinc-200/90" />
                                        <span className="h-1 w-4/5 rounded-full bg-zinc-200/70" />
                                        <span className="h-1 w-3/5 rounded-full bg-zinc-200/50" />
                                        <span className="h-1 w-2/5 rounded-full bg-zinc-200/35" />
                                    </div>
                                    <div className="flex flex-col items-center leading-tight w-full">
                                        <span className="text-xs font-bold text-white tabular-nums">
                                            {formatHoursLabel(totalSeconds)}
                                        </span>
                                        <span className="text-[9px] text-zinc-400 truncate max-w-full">
                                            {topGenres[0]?.name || 'hours'}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Expanded Top Genres Content (always visible on md+, visible when selected on mobile) */}
                            <div className={`${mobileExpandedCard === 'genres' ? 'flex' : 'hidden md:flex'} flex-1 flex-col`}>
                                <div className="mb-2.5 md:mb-3 flex items-baseline justify-between gap-2 sm:gap-3">
                                    <div className="flex items-baseline gap-2 min-w-0">
                                        <h2 className="text-sm sm:text-base font-bold tracking-tight text-white truncate">Top genres</h2>
                                        <span className="text-xs sm:text-sm font-medium text-zinc-400 tabular-nums shrink-0">
                                            {formatHoursLabel(totalSeconds)}
                                        </span>
                                    </div>
                                    {topGenres.length > 0 && (
                                        <div className="flex items-center gap-2.5 sm:gap-4 text-[10px] sm:text-[11px] font-medium text-zinc-500">
                                            <span className="w-6 sm:w-8 text-right">Titles</span>
                                            <span className="w-9 sm:w-12 text-right">Hours</span>
                                        </div>
                                    )}
                                </div>

                                {topGenres.length > 0 ? (
                                    <div className="flex flex-1 flex-col justify-center space-y-2 sm:space-y-3">
                                        {topGenres.map((genre) => {
                                            const pct = Math.max(8, Math.round((genre.titles / maxGenreMetric) * 100));
                                            return (
                                                <div key={genre.name} className="flex items-center gap-2 sm:gap-3">
                                                    <span className="w-16 sm:w-28 shrink-0 truncate text-[11px] sm:text-[13px] font-semibold text-zinc-100">
                                                        {genre.name}
                                                    </span>
                                                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                                                        <div
                                                            className="h-full rounded-full bg-zinc-200 transition-all duration-500"
                                                            style={{ width: `${pct}%` }}
                                                        />
                                                    </div>
                                                    <div className="flex shrink-0 items-center gap-2.5 sm:gap-4 tabular-nums">
                                                        <span className="w-6 sm:w-8 text-right text-[11px] sm:text-[13px] font-semibold text-zinc-100">
                                                            {genre.titles}
                                                        </span>
                                                        <span className="w-9 sm:w-12 text-right text-[11px] sm:text-[13px] font-medium text-zinc-400">
                                                            {formatHoursLabel(genre.seconds)}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="flex flex-1 items-center justify-center py-6 sm:py-8 text-center text-xs text-zinc-500 px-2">
                                        Watch or add titles to see your top genres.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
        </section>
        </>
    );
}

import { useState, useEffect, useCallback, useMemo } from 'react';
import { episodeMetadataService, type AnimeMetadataPayload } from '../services/episodeMetadataService';
import { storage, type WatchProgress } from '../utils/storage';
import { useActivityHistory } from './useActivityHistory';
import type { Anime, Episode } from '../types/anime';

interface PlaybackProgress {
    positionSeconds?: number;
    durationSeconds?: number;
}

export function useContinueWatching() {
    const { recordActivity } = useActivityHistory();
    const [continueWatchingList, setContinueWatchingList] = useState<WatchProgress[]>(() => storage.getContinueWatching());
    const [episodeMetadata, setEpisodeMetadata] = useState<Record<string, AnimeMetadataPayload>>({});

    useEffect(() => {
        let active = true;
        for (const item of continueWatchingList) {
            const legacyMalId = !item.anilistId && !item.malId && /^\d+$/.test(item.animeId) ? Number(item.animeId) : undefined;
            const anilistId = item.anilistId;
            const malId = item.malId || legacyMalId;
            if (!anilistId && !malId) continue;
            const key = `${item.animeId}:${item.episodeNumber}`;
            void episodeMetadataService.getEpisodeMetadata(anilistId, malId).then((data) => {
                if (active && data) setEpisodeMetadata((current) => ({ ...current, [key]: data }));
            });
        }
        return () => { active = false; };
    }, [continueWatchingList]);

    const enrichedContinueWatchingList = useMemo(() => continueWatchingList.map((item) => {
        const metadata = episodeMetadata[`${item.animeId}:${item.episodeNumber}`];
        const meta = metadata?.episodes.get(item.episodeNumber) || metadata?.absoluteEpisodes.get(item.episodeNumber);
        return {
            ...item,
            anilistId: item.anilistId || metadata?.anilistId,
            malId: item.malId || metadata?.malId,
            episodeThumbnail: meta?.thumbnail || item.episodeThumbnail,
            seasonNumber: item.seasonNumber ?? meta?.seasonNumber,
            seasonEpisodeNumber: item.seasonEpisodeNumber ?? meta?.episodeNumber,
        };
    }), [continueWatchingList, episodeMetadata]);

    const reload = useCallback(() => {
        setContinueWatchingList(storage.getContinueWatching());
    }, []);

    useEffect(() => {
        window.addEventListener('yorumi-storage-updated', reload);
        return () => window.removeEventListener('yorumi-storage-updated', reload);
    }, [reload]);

    const saveProgress = useCallback(async (anime: Anime, episode: Episode, playback?: PlaybackProgress) => {
        const image = anime.anilist_banner_image || anime.images?.jpg?.large_image_url || '';
        const poster = anime.images?.jpg?.image_url || anime.images?.jpg?.large_image_url || '';

        const parseEpisodeNumber = (value: unknown): number => {
            if (typeof value === 'number' && Number.isFinite(value)) return value;
            const raw = String(value ?? '').trim();
            const direct = Number(raw);
            if (Number.isFinite(direct)) return direct;
            const match = raw.match(/(\d+(?:\.\d+)?)/);
            return match ? Number(match[1]) : 0;
        };

        const validId = anime.mal_id || anime.id;
        if (!validId) return;

        const normalizedPosition = Number.isFinite(playback?.positionSeconds)
            ? Math.max(0, Math.floor(Number(playback?.positionSeconds)))
            : undefined;
        const normalizedDuration = Number.isFinite(playback?.durationSeconds)
            ? Math.max(0, Math.floor(Number(playback?.durationSeconds)))
            : undefined;

        const progress: WatchProgress = {
            animeId: validId.toString(),
            episodeId: episode.session || ('id' in episode ? String((episode as { id?: string | number }).id || '') : ''),
            episodeNumber: parseEpisodeNumber(episode.episodeNumber),
            timestamp: Date.now(),
            lastWatched: Date.now(),
            animeTitle: anime.title,
            animeImage: image,
            animePoster: poster,
            episodeThumbnail: episode.thumbnail || episode.snapshot,
            seasonNumber: episode.tmdbSeason,
            seasonEpisodeNumber: episode.tmdbEpisode,
            anilistId: anime.id || undefined,
            malId: anime.mal_id || undefined,
            totalCount: typeof anime.episodes === 'number' && anime.episodes > 0 ? anime.episodes : undefined,
            mediaStatus: anime.status,
            positionSeconds: normalizedPosition,
            durationSeconds: normalizedDuration
        };

        // storage.saveProgress syncs to the cloud document field automatically
        storage.saveProgress(progress);

        const genreNames = (anime.genres || [])
            .map((g) => (typeof g === 'string' ? g : g?.name))
            .filter((name): name is string => Boolean(name && name.trim()));
        if (genreNames.length > 0) {
            const nextCache = { ...storage.getAnimeGenreCache() };
            nextCache[validId.toString()] = genreNames;
            if (anime.id && String(anime.id) !== validId.toString()) {
                nextCache[String(anime.id)] = genreNames;
            }
            storage.setAnimeGenreCache(nextCache);
        }

        try {
            await recordActivity(`anime:${validId}:ep:${progress.episodeNumber}`);
        } catch (error) {
            console.error('Failed to record activity:', error);
        }
    }, [recordActivity]);

    const removeFromHistory = useCallback(async (malId: number | string) => {
        storage.removeFromContinueWatching(malId.toString());
    }, []);

    return {
        continueWatchingList: enrichedContinueWatchingList,
        saveProgress,
        removeFromHistory
    };
}

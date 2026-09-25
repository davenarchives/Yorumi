import { useState, useRef, useCallback, useMemo, useEffect } from 'react';

import type { Episode } from '../types/anime';
import type { StreamLink } from '../types/stream';
import { animeService } from '../services/animeService';
import { getStreamData, getMappedQuality } from '../utils/streamUtils';
import { downloadService, isDownloadTitleMatch } from '../services/downloadService';
import { isNativeMobile } from '../platform/runtime';

const getSourceKey = (stream: StreamLink) => {
    const server = String(stream.server || '').trim().toLowerCase();
    const provider = String(stream.provider || '').trim().toLowerCase();
    if (server) return server;
    if (provider) return provider;
    if (stream.isHls) return 'hls';
    return 'embed';
};

const getSourceLabel = (stream: StreamLink) => {
    const key = getSourceKey(stream);
    if (key === 'frieren' || key === 'hianime') return 'Frieren';
    if (key === 'stark' || key === 'start' || key === 'anikoto') return 'Stark';
    if (key === 'fern' || key === 'animegg') return 'Fern';
    if (key === 'himmel' || key === 'reanime') return 'Himmel';
    if (key === 'native') return 'Native HLS';
    if (key === 'kwik') return 'Kwik';
    if (key === 'hls') return 'HLS';
    if (key === 'embed') return 'Embed';
    if (key === 'anineko') return 'AniNeko';
    if (key === 'anidb') return 'AniDB';
    if (key === 'allmanga') return 'AllManga';
    return key
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, (match) => match.toUpperCase());
};

type StreamLookupMetadata = {
    titlesKey?: string;
    year?: string | number;
    format?: string;
    anilistId?: number;
    malId?: number;
};

export type StreamServerKey = 'frieren' | 'stark' | 'fern' | 'himmel';

export const STREAM_SERVER_OPTIONS: Array<{ key: StreamServerKey; label: string }> = [
    { key: 'frieren', label: 'Frieren' },
    { key: 'stark', label: 'Stark' },
    { key: 'fern', label: 'Fern' },
    { key: 'himmel', label: 'Himmel' },
];

export const normalizeServerKey = (key: string): StreamServerKey => {
    const k = String(key || '').toLowerCase().trim();
    if (k === 'frieren' || k === 'hianime' || k === 'kickassanime' || k === 'kaa' || k === 'kissanime' || k === 'auto') return 'frieren';
    if (k === 'stark' || k === 'start' || k === 'anikoto') return 'stark';
    if (k === 'fern' || k === 'animegg') return 'fern';
    if (k === 'himmel' || k === 'reanime') return 'himmel';
    return 'frieren';
};


export function useStreams(scraperSession: string | null, animeTitle?: string, animeMetadata?: StreamLookupMetadata) {
    const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(null);
    const [allStreams, setAllStreams] = useState<StreamLink[]>([]);
    const [selectedStreamIndex, setSelectedStreamIndex] = useState<number>(0);
    const [isAutoQuality, setIsAutoQuality] = useState(true);
    const [selectedAudio, setSelectedAudio] = useState<'sub' | 'dub'>('sub');
    const [selectedServer, setSelectedServer] = useState<StreamServerKey>('frieren');
    const [showQualityMenu, setShowQualityMenu] = useState(false);
    const [streamLoading, setStreamLoading] = useState(false);
    const [serverSwitchLoading, setServerSwitchLoading] = useState(false);
    const streamCache = useRef(new Map<string, Promise<StreamLink[]>>());
    const activeLoadRequestRef = useRef(0);
    const previousServerRef = useRef<StreamServerKey>('frieren');
    const preferredAudioRef = useRef<'sub' | 'dub'>('sub');

    const normalizeDirectScraperSession = (value: unknown) => {
        const normalized = String(value || '')
            .trim()
            .replace(/^s:/i, '')
            .replace(/^https?:\/\/[^/]+/i, '')
            .replace(/^\/+/, '')
            .replace(/^watch\//i, '');
        return normalized;
    };

    const metadataYear = animeMetadata?.year;
    const metadataFormat = animeMetadata?.format;
    const metadataTitlesKey = animeMetadata?.titlesKey || '';

    // Canonical cache key for a (server, episode) pair.
    // Must be consistent across ensureStreamDataForServer, loadStream, bustEpisodeCache, handleServerChange.
    const getEpisodeCacheKey = useCallback((server: StreamServerKey, episode: Episode) => {
        const epKey = String(episode.session || episode.episodeNumber || episode._tmdbAbsolute || 'ep');
        const isMovieLookup = String(metadataFormat || '').toUpperCase() === 'MOVIE';
        const metadataKey = isMovieLookup
            ? [
                animeTitle,
                metadataTitlesKey,
                metadataYear,
                metadataFormat,
            ]
                .map((value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''))
                .filter(Boolean)
                .join(':')
            : '';
        return `${server}:${epKey}${metadataKey ? `:${metadataKey}` : ''}`;
    }, [animeTitle, metadataTitlesKey, metadataYear, metadataFormat]);

    const normalizeAudio = (value: string) => {
        const lower = String(value || '').trim().toLowerCase();
        if (!lower) return 'sub';
        if (/(^|\b)(dub|eng|english)(\b|$)/.test(lower)) return 'dub';
        return 'sub';
    };
    const scoreStream = useCallback((stream: StreamLink) => {
        const isOffline = stream.provider === 'Offline Storage' ||
            stream.server === 'offline' ||
            Boolean(stream.url?.startsWith('blob:')) ||
            Boolean(stream.url?.includes('/api/scraper/local-file'));
        if (isOffline) {
            return 100_000_000;
        }

        const quality = parseInt(String(stream.quality || '0'), 10) || 0;
        const url = String(stream.url || '');
        const directUrl = String(stream.directUrl || '');
        const hasDirectUrl = Boolean(directUrl);
        const isHls = Boolean(stream.isHls) || url.includes('.m3u8') || directUrl.includes('.m3u8');
        const isIframeLike = /vidsrc|vidstream|megacloud|embed|kwik/i.test(url) || !isHls;

        return (isHls ? 1_000_000 : 0)
            + (hasDirectUrl ? 100_000 : 0)
            - (isIframeLike ? 1_000_000 : 0)
            + quality;
    }, []);

    const ensureStreamDataForServer = useCallback((episode: Episode, server: StreamServerKey): Promise<StreamLink[]> => {
        const activeSession = normalizeDirectScraperSession(scraperSession);
        const effectiveSession = activeSession || server;
        if (!effectiveSession && !animeTitle) return Promise.resolve([]);

        const cacheKey = getEpisodeCacheKey(server, episode);
        if (!streamCache.current.has(cacheKey)) {
            const promise = (async () => {
                const targetId = animeMetadata?.anilistId ? String(animeMetadata.anilistId) : (scraperSession || animeTitle || '');
                const epNum = Number(episode.episodeNumber || (episode as any).playbackEpisodeNumber || (episode as any)._tmdbAbsolute || 1);
                const altEpNums = [
                    episode.episodeNumber,
                    (episode as any).playbackEpisodeNumber,
                    (episode as any)._tmdbAbsolute
                ];

                let offlineStream: StreamLink | null = null;
                try {
                    let offline = await downloadService.getDownload(targetId, epNum, animeTitle, animeMetadata?.anilistId, altEpNums);
                    if (!offline) {
                        const allDownloads = await downloadService.getDownloads();
                        const epNums = altEpNums.map(n => Number(n)).filter(n => Number.isFinite(n) && n > 0);
                        const anilistStr = animeMetadata?.anilistId ? String(animeMetadata.anilistId).trim().toLowerCase() : '';
                        const targetStr = targetId.trim().toLowerCase();

                        offline = allDownloads.find((d) => {
                            const dEp = Number(d.episodeNumber);
                            if (!epNums.includes(dEp)) return false;
                            const dAnimeId = String(d.animeId || '').trim().toLowerCase();
                            const dKey = String(d.id || '').toLowerCase();

                            if (d.id === episode.session) return true;
                            if (targetStr && (dAnimeId === targetStr || dKey.startsWith(`${targetStr}_ep_`))) return true;
                            if (anilistStr && (dAnimeId === anilistStr || dKey.startsWith(`${anilistStr}_ep_`))) return true;
                            if (animeTitle && isDownloadTitleMatch(d.animeTitle, animeTitle)) {
                                const isNum = (s: string) => /^\d+$/.test(s.trim());
                                if (isNum(anilistStr) && isNum(dAnimeId) && dAnimeId !== anilistStr) return false;
                                return true;
                            }
                            return false;
                        }) || null;
                    }
                    const hasOfflineMedia = Boolean(
                        (offline?.filePath && (offline.fileSize || 0) > 0) ||
                        (offline?.videoBlob && offline.videoBlob.size > 0)
                    );
                    if (offline && hasOfflineMedia) {
                        const resolved = await downloadService.getOfflineStream(offline);
                        if (resolved?.url) {
                            offlineStream = resolved;
                        }
                    }
                } catch (e) {
                    console.warn('Error checking offline download:', e);
                }

                if (offlineStream) {
                    return [offlineStream];
                }

                if (!navigator.onLine) {
                    return [];
                }

                try {
                    const data = await getStreamData(episode, effectiveSession, {
                        provider: server,
                        title: animeTitle,
                        titles: metadataTitlesKey ? metadataTitlesKey.split('|') : undefined,
                        year: metadataYear,
                        format: metadataFormat,
                        anilistId: animeMetadata?.anilistId,
                        malId: animeMetadata?.malId,
                    });
                    if (!Array.isArray(data) || data.length === 0) {
                        streamCache.current.delete(cacheKey);
                        return [];
                    }
                    return data;
                } catch (error) {
                    console.error('Error fetching stream:', error);
                    streamCache.current.delete(cacheKey);
                    return [];
                }
            })();
            streamCache.current.set(cacheKey, promise);
        }
        return streamCache.current.get(cacheKey)!;
    }, [scraperSession, animeTitle, metadataTitlesKey, metadataYear, metadataFormat, animeMetadata?.anilistId, animeMetadata?.malId, getEpisodeCacheKey]);


    const ensureStreamData = useCallback((episode: Episode): Promise<StreamLink[]> => {
        return ensureStreamDataForServer(episode, selectedServer);
    }, [ensureStreamDataForServer, selectedServer]);

    const resolveStreamDataWithFallback = useCallback(async (episode: Episode, server: StreamServerKey, preferredAudio: 'sub' | 'dub' = preferredAudioRef.current) => {
        const primary = await ensureStreamDataForServer(episode, server);
        if (primary && primary.length > 0 && primary.some((s) => normalizeAudio(s.audio) === preferredAudio)) {
            return { server, data: primary };
        }
        const fallbackServers = STREAM_SERVER_OPTIONS
            .map((s) => s.key)
            .filter((k) => k !== server);
        for (const fallback of fallbackServers) {
            try {
                const fallbackData = await ensureStreamDataForServer(episode, fallback);
                if (fallbackData && fallbackData.length > 0 && fallbackData.some((s) => normalizeAudio(s.audio) === preferredAudio)) {
                    return { server: fallback, data: fallbackData };
                }
            } catch {
                // continue to next fallback
            }
        }
        if (primary && primary.length > 0) {
            return { server, data: primary };
        }
        for (const fallback of fallbackServers) {
            try {
                const fallbackData = await ensureStreamDataForServer(episode, fallback);
                if (fallbackData && fallbackData.length > 0) {
                    return { server: fallback, data: fallbackData };
                }
            } catch {
                // continue to next fallback
            }
        }
        return { server, data: [] };
    }, [ensureStreamDataForServer]);

    const prefetchStream = useCallback((episode: Episode) => {
        if (scraperSession || animeTitle) ensureStreamData(episode);
    }, [scraperSession, animeTitle, ensureStreamData]);

    // Silently prefetch the other server's stream so switching is instant
    const prefetchAlternateServer = useCallback((episode: Episode) => {
        if (isNativeMobile()) return;
        const alternateServers: StreamServerKey[] = STREAM_SERVER_OPTIONS
            .map(s => s.key)
            .filter(k => k !== selectedServer);
        alternateServers.forEach(server => {
            ensureStreamDataForServer(episode, server);
        });
    }, [selectedServer, ensureStreamDataForServer]);

    const availableAudios = useMemo(() => {
        const set = new Set<'sub' | 'dub'>();
        allStreams.forEach((s) => set.add(normalizeAudio(s.audio)));
        if (set.size === 0) set.add('sub');
        return [...set];
    }, [allStreams]);

    const availableSources = useMemo(() => {
        const map = new Map<string, string>();
        const audioStreams = allStreams.filter((s) => normalizeAudio(s.audio) === selectedAudio);
        const sourceStreams = audioStreams.length > 0 ? audioStreams : allStreams;

        sourceStreams.forEach((stream) => {
            const key = getSourceKey(stream);
            if (!map.has(key)) map.set(key, getSourceLabel(stream));
        });

        return [
            { key: 'auto', label: 'Auto' },
            ...Array.from(map.entries()).map(([key, label]) => ({ key, label })),
        ];
    }, [allStreams, selectedAudio]);

    const filterStreams = useCallback((raw: StreamLink[], audio: 'sub' | 'dub') => {
        const next = raw.filter((s) => normalizeAudio(s.audio) === audio);
        const sorted = [...next].sort((a, b) => scoreStream(b) - scoreStream(a));
        const dedupedBySourceQuality = new Map<string, StreamLink>();

        sorted.forEach((stream) => {
            const qualityKey = getMappedQuality(String(stream.quality || '0'));
            const key = `${getSourceKey(stream)}:${qualityKey}`;
            if (!dedupedBySourceQuality.has(key)) {
                dedupedBySourceQuality.set(key, stream);
            }
        });

        return Array.from(dedupedBySourceQuality.values());
    }, [scoreStream]);

    const streams = useMemo(() => {
        if (allStreams.length === 0) return [];
        return filterStreams(allStreams, selectedAudio);
    }, [allStreams, selectedAudio, filterStreams]);

    const currentStream = streams[selectedStreamIndex] || null;

    const loadStream = useCallback(async (episode: Episode, isServerSwitch = false) => {
        const requestId = activeLoadRequestRef.current + 1;
        activeLoadRequestRef.current = requestId;

        const isEpisodeSwitch = !isServerSwitch;

        if (isEpisodeSwitch) {
            preferredAudioRef.current = 'sub';
            setStreamLoading(true);
            // Evict stale cache for the OLD episode and ALL prefetched alternate servers
            // so we never accidentally serve data from the wrong episode.
            streamCache.current.clear();
            setCurrentEpisode(episode);
            setAllStreams([]);
            setSelectedStreamIndex(0);
            // Proactively prefetch all other server streams in background so switching is instant (desktop only).
            if (!isNativeMobile()) {
                STREAM_SERVER_OPTIONS.forEach(({ key }) => {
                    if (key !== selectedServer) {
                        ensureStreamDataForServer(episode, key);
                    }
                });
            }
        } else {
            // Server switch: check if we already have cached data for instant swap.
            const cacheKey = getEpisodeCacheKey(selectedServer, episode);
            const cachedPromise = streamCache.current.get(cacheKey);

            if (cachedPromise) {
                // Cache exists (prefetched). Try to resolve it immediately.
                // If it's already settled, this will be instant.
                setServerSwitchLoading(true);
                try {
                    const cachedData = await cachedPromise;
                    if (activeLoadRequestRef.current !== requestId) return;
                    if (cachedData.length > 0) {
                        const nextAudio = cachedData.some((s) => normalizeAudio(s.audio) === preferredAudioRef.current)
                            ? preferredAudioRef.current
                            : (cachedData.some((s) => normalizeAudio(s.audio) === 'sub') ? 'sub' : 'dub');

                        const actualProvider = String(cachedData[0].provider || cachedData[0].server || '').trim().toLowerCase();
                        const mappedServer = normalizeServerKey(actualProvider);
                        if (mappedServer && mappedServer !== selectedServer) {
                            previousServerRef.current = mappedServer;
                            setSelectedServer(mappedServer);
                        }

                        setSelectedAudio(nextAudio);
                        setAllStreams(cachedData);
                        setSelectedStreamIndex(0);
                        setIsAutoQuality(true);
                        setCurrentEpisode(episode);
                    } else {
                        // Cached but empty — evict and fall through to fresh fetch
                        streamCache.current.delete(cacheKey);
                        setAllStreams([]);
                        setSelectedStreamIndex(0);
                        setCurrentEpisode(episode);
                    }
                } catch {
                    streamCache.current.delete(cacheKey);
                    setAllStreams([]);
                    setSelectedStreamIndex(0);
                    setCurrentEpisode(episode);
                } finally {
                    if (activeLoadRequestRef.current === requestId) {
                        setServerSwitchLoading(false);
                        setStreamLoading(false);
                    }
                }
                return;
            }

            // No cache — clear old streams and show loading while we fetch fresh
            setStreamLoading(true);
            setCurrentEpisode(episode);
            setAllStreams([]);
            setSelectedStreamIndex(0);
        }

        try {
            const resolved = await resolveStreamDataWithFallback(episode, selectedServer, preferredAudioRef.current);
            const streamData = resolved.data;
            if (activeLoadRequestRef.current !== requestId) {
                return;
            }
            if (streamData.length > 0) {
                const mappedServer = normalizeServerKey(resolved.server);
                if (mappedServer !== selectedServer) {
                    previousServerRef.current = mappedServer;
                    setSelectedServer(mappedServer);
                }
                const nextAudio = streamData.some((s) => normalizeAudio(s.audio) === preferredAudioRef.current)
                    ? preferredAudioRef.current
                    : (streamData.some((s) => normalizeAudio(s.audio) === 'sub') ? 'sub' : 'dub');
                setSelectedAudio(nextAudio);
                setAllStreams(streamData);
                setSelectedStreamIndex(0);
                setIsAutoQuality(true);
            } else {
                streamCache.current.delete(getEpisodeCacheKey(selectedServer, episode));
                setAllStreams([]);
            }
        } catch (e) {
            if (activeLoadRequestRef.current !== requestId) {
                return;
            }
            console.error('Failed to load stream:', e);
            streamCache.current.delete(getEpisodeCacheKey(selectedServer, episode));
            setAllStreams([]);
        } finally {
            if (activeLoadRequestRef.current === requestId) {
                setStreamLoading(false);
                setServerSwitchLoading(false);
            }
        }
    }, [
        ensureStreamDataForServer,
        filterStreams,
        selectedServer,
        resolveStreamDataWithFallback,
        getEpisodeCacheKey,
    ]);

    useEffect(() => {
        if (previousServerRef.current === selectedServer) return;
        previousServerRef.current = selectedServer;
        if (!currentEpisode) return;
        loadStream(currentEpisode, true);
    }, [selectedServer, currentEpisode, loadStream]);

    // Auto-prefetch alternate server streams when a stream resolves successfully
    useEffect(() => {
        if (!currentEpisode || allStreams.length === 0) return;
        prefetchAlternateServer(currentEpisode);
    }, [currentEpisode, allStreams.length, prefetchAlternateServer]);

    const handleQualityChange = useCallback((index: number) => {
        setSelectedStreamIndex(index);
        setIsAutoQuality(false);
        setShowQualityMenu(false);
    }, []);

    const setAutoQuality = useCallback(() => {
        setSelectedStreamIndex(0);
        setIsAutoQuality(true);
        setShowQualityMenu(false);
    }, []);

    const tryNextStream = useCallback(() => {
        if (streams.length > 0 && selectedStreamIndex < streams.length - 1) {
            setSelectedStreamIndex((idx) => Math.min(idx + 1, streams.length - 1));
            setIsAutoQuality(false);
            return true;
        }

        return false;
    }, [streams.length, selectedStreamIndex]);

    // Clear all stream state when switching anime
    const clearStreams = useCallback(() => {
        activeLoadRequestRef.current += 1;
        setCurrentEpisode(null);
        setAllStreams([]);
        setSelectedStreamIndex(0);
        setSelectedAudio('sub');
        preferredAudioRef.current = 'sub';
        setSelectedServer('frieren');
        setStreamLoading(false);
        setServerSwitchLoading(false);
        streamCache.current.clear();
    }, []);

    const bustEpisodeCache = useCallback((session: string) => {
        const normalizedSession = String(session || '').trim();
        if (!normalizedSession) return;

        streamCache.current.delete(normalizedSession);
        streamCache.current.delete(`${selectedServer}:${normalizedSession}`);
        for (const key of streamCache.current.keys()) {
            if (
                key.endsWith(`:${normalizedSession}`) ||
                key.includes(`:${normalizedSession}:`)
            ) {
                streamCache.current.delete(key);
            }
        }

        const activeSession = normalizeDirectScraperSession(scraperSession);
        if (activeSession) {
            animeService.invalidateStreamCache(activeSession, normalizedSession, selectedServer);
        }
    }, [scraperSession, selectedServer]);

    const handleServerChange = useCallback((server: StreamServerKey) => {
        if (server === selectedServer) return;
        setSelectedServer(server);
        setSelectedStreamIndex(0);
        setIsAutoQuality(true);
        setShowQualityMenu(false);
        if (currentEpisode) {
            streamCache.current.delete(getEpisodeCacheKey(server, currentEpisode));
        }
    }, [currentEpisode, selectedServer, getEpisodeCacheKey]);

    const handleAudioChange = useCallback((audio: 'sub' | 'dub') => {
        preferredAudioRef.current = audio;
        if (!availableAudios.includes(audio)) {
            if (currentEpisode) {
                const activeSession = normalizeDirectScraperSession(scraperSession);
                streamCache.current.clear();
                if (activeSession) animeService.invalidateStreamCache(activeSession);
                loadStream(currentEpisode, true);
            }
            return;
        }
        setSelectedAudio(audio);
        setSelectedStreamIndex(0);
        setIsAutoQuality(true);
        setShowQualityMenu(false);
    }, [availableAudios, currentEpisode, scraperSession, selectedServer, getEpisodeCacheKey, loadStream]);

    return {
        // State
        currentEpisode,
        streams,
        hasResolvedStreams: allStreams.length > 0,
        selectedStreamIndex,
        isAutoQuality,
        selectedAudio,
        selectedServer,
        serverOptions: STREAM_SERVER_OPTIONS,
        availableAudios,
        availableSources,
        showQualityMenu,
        currentStream,
        streamLoading,
        serverSwitchLoading,

        // Actions
        loadStream,
        prefetchStream,
        handleQualityChange,
        setAutoQuality,
        handleServerChange,
        setShowQualityMenu,
        setSelectedAudio: handleAudioChange,
        tryNextStream,
        getMappedQuality,
        clearStreams,
        bustEpisodeCache,
    };
}

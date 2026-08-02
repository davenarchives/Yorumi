import { useState, useRef, useCallback, useMemo, useEffect } from 'react';

import type { Episode } from '../types/anime';
import type { StreamLink } from '../types/stream';
import { animeService } from '../services/animeService';
import { getStreamData, getMappedQuality } from '../utils/streamUtils';

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
    if (key === 'native') return 'Native HLS';
    if (key === 'kwik') return 'Kwik';
    if (key === 'hls') return 'HLS';
    if (key === 'embed') return 'Embed';
    if (key === 'anineko') return 'AniNeko';
    if (key === 'reanime') return 'ReAnime';
    if (key === 'animegg') return 'AnimeGG';
    if (key === 'vidsrc') return 'VidSrc';
    if (key === 'vidking') return 'VidKing';
    if (key === 'videasy') return 'Videasy';
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
};

export type StreamServerKey = 'allmanga' | 'anineko' | 'anikoto' | 'vidsrc' | 'vidking' | 'videasy';

const STREAM_SERVER_OPTIONS: Array<{ key: StreamServerKey; label: string }> = [
    { key: 'allmanga', label: 'AllManga' },
    { key: 'anineko', label: 'AniNeko' },
    { key: 'anikoto', label: 'Anikoto' },
    { key: 'vidsrc', label: 'VidSrc' },
    { key: 'vidking', label: 'VidKing' },
    { key: 'videasy', label: 'Videasy' },
];

const ALLMANGA_FALLBACK_SERVERS: StreamServerKey[] = ['vidsrc', 'vidking', 'videasy'];

export function useStreams(scraperSession: string | null, animeTitle?: string, animeMetadata?: StreamLookupMetadata) {
    const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(null);
    const [allStreams, setAllStreams] = useState<StreamLink[]>([]);
    const [streams, setStreams] = useState<StreamLink[]>([]);
    const [selectedStreamIndex, setSelectedStreamIndex] = useState<number>(0);
    const [isAutoQuality, setIsAutoQuality] = useState(true);
    const [selectedAudio, setSelectedAudio] = useState<'sub' | 'dub'>('sub');
    const [selectedServer, setSelectedServer] = useState<StreamServerKey>('allmanga');
    const [showQualityMenu, setShowQualityMenu] = useState(false);
    const [streamLoading, setStreamLoading] = useState(false);
    const [serverSwitchLoading, setServerSwitchLoading] = useState(false);
    const streamCache = useRef(new Map<string, Promise<StreamLink[]>>());
    const activeLoadRequestRef = useRef(0);
    const previousServerRef = useRef<StreamServerKey>('allmanga');

    const currentStream = streams[selectedStreamIndex] || null;
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
        // Fallback to provider name as a pseudo-session if activeSession is empty,
        // since the backend can resolve streams using just the anime title now.
        const effectiveSession = activeSession || server;
        if (!effectiveSession && !animeTitle) return Promise.resolve([]);
        const cacheKey = getEpisodeCacheKey(server, episode);
        if (!streamCache.current.has(cacheKey)) {
            const promise = getStreamData(episode, effectiveSession, {
                provider: server,
                title: animeTitle,
                titles: metadataTitlesKey ? metadataTitlesKey.split('|') : undefined,
                year: metadataYear,
                format: metadataFormat,
                anilistId: animeMetadata?.anilistId,
            })
                .then((data) => {
                    if (!Array.isArray(data) || data.length === 0) {
                        streamCache.current.delete(cacheKey);
                        return [];
                    }
                    return data;
                })
                .catch(e => {
                    console.error('Failed to load stream', e);
                    streamCache.current.delete(cacheKey);
                    return [];
                });
            streamCache.current.set(cacheKey, promise);
        }
        return streamCache.current.get(cacheKey)!;
    }, [scraperSession, animeTitle, metadataTitlesKey, metadataYear, metadataFormat, animeMetadata?.anilistId, getEpisodeCacheKey]);


    const ensureStreamData = useCallback((episode: Episode): Promise<StreamLink[]> => {
        return ensureStreamDataForServer(episode, selectedServer);
    }, [ensureStreamDataForServer, selectedServer]);

    const resolveStreamDataWithFallback = useCallback(async (episode: Episode, server: StreamServerKey) => {
        const primary = await ensureStreamDataForServer(episode, server);
        if (primary.length > 0 || server !== 'allmanga') {
            return { server, data: primary };
        }

        for (const fallbackServer of ALLMANGA_FALLBACK_SERVERS) {
            const data = await ensureStreamDataForServer(episode, fallbackServer);
            if (data.length > 0) return { server: fallbackServer, data };
        }

        return { server, data: primary };
    }, [ensureStreamDataForServer]);

    const prefetchStream = useCallback((episode: Episode) => {
        if (scraperSession || animeTitle) ensureStreamData(episode);
    }, [scraperSession, animeTitle, ensureStreamData]);

    // Silently prefetch the other server's stream so switching is instant
    const prefetchAlternateServer = useCallback((episode: Episode) => {
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
        let next = raw.filter((s) => normalizeAudio(s.audio) === audio);
        if (next.length === 0) next = raw;
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

    useEffect(() => {
        if (allStreams.length === 0) {
            setStreams([]);
            return;
        }
        const nextStreams = filterStreams(allStreams, selectedAudio);
        setStreams(nextStreams);
        setSelectedStreamIndex(0);
        setIsAutoQuality(true);
    }, [allStreams, selectedAudio, filterStreams]);

    const loadStream = useCallback(async (episode: Episode, isServerSwitch = false) => {
        const requestId = activeLoadRequestRef.current + 1;
        activeLoadRequestRef.current = requestId;

        const isEpisodeSwitch = !isServerSwitch;

        if (isEpisodeSwitch) {
            setStreamLoading(true);
            // Evict stale cache for the OLD episode and ALL prefetched alternate servers
            // so we never accidentally serve data from the wrong episode.
            streamCache.current.clear();
            setCurrentEpisode(episode);
            setAllStreams([]);
            setStreams([]);
            setSelectedStreamIndex(0);
            // Proactively prefetch all other server streams in background so switching is instant.
            STREAM_SERVER_OPTIONS.forEach(({ key }) => {
                if (key !== selectedServer) {
                    ensureStreamDataForServer(episode, key);
                }
            });
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
                        const nextAudio = cachedData.some((s) => normalizeAudio(s.audio) === selectedAudio)
                            ? selectedAudio
                            : (cachedData.some((s) => normalizeAudio(s.audio) === 'sub') ? 'sub' : 'dub');
                        const nextStreams = filterStreams(cachedData, nextAudio);

                        const actualProvider = String(cachedData[0].provider || cachedData[0].server || '').trim().toLowerCase();
                        const isValidServer = STREAM_SERVER_OPTIONS.some(s => s.key === actualProvider);
                        if (actualProvider && actualProvider !== selectedServer && isValidServer) {
                            previousServerRef.current = actualProvider as StreamServerKey;
                            setSelectedServer(actualProvider as StreamServerKey);
                        }

                        setSelectedAudio(nextAudio);
                        setAllStreams(cachedData);
                        setStreams(nextStreams);
                        setSelectedStreamIndex(0);
                        setIsAutoQuality(true);
                        setCurrentEpisode(episode);
                    } else {
                        // Cached but empty — evict and fall through to fresh fetch
                        streamCache.current.delete(cacheKey);
                        setAllStreams([]);
                        setStreams([]);
                        setSelectedStreamIndex(0);
                        setCurrentEpisode(episode);
                    }
                } catch {
                    streamCache.current.delete(cacheKey);
                    setAllStreams([]);
                    setStreams([]);
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
            setStreams([]);
            setSelectedStreamIndex(0);
        }

        try {
            const resolved = await resolveStreamDataWithFallback(episode, selectedServer);
            const streamData = resolved.data;
            if (activeLoadRequestRef.current !== requestId) {
                return;
            }
            if (streamData.length > 0) {
                const nextAudio = streamData.some((s) => normalizeAudio(s.audio) === selectedAudio)
                    ? selectedAudio
                    : (streamData.some((s) => normalizeAudio(s.audio) === 'sub') ? 'sub' : 'dub');
                const nextStreams = filterStreams(streamData, nextAudio);

                if (resolved.server !== selectedServer) {
                    previousServerRef.current = resolved.server;
                    setSelectedServer(resolved.server);
                }

                const actualProvider = String(streamData[0].provider || streamData[0].server || '').trim().toLowerCase();
                const isValidServer = STREAM_SERVER_OPTIONS.some(s => s.key === actualProvider);
                if (actualProvider && actualProvider !== resolved.server && isValidServer) {
                    previousServerRef.current = actualProvider as StreamServerKey;
                    setSelectedServer(actualProvider as StreamServerKey);
                }

                setSelectedAudio(nextAudio);
                setAllStreams(streamData);
                setStreams(nextStreams);
                setSelectedStreamIndex(0);
                setIsAutoQuality(true);
            } else {
                streamCache.current.delete(getEpisodeCacheKey(selectedServer, episode));
                setAllStreams([]);
                setStreams([]);
            }
        } catch (e) {
            if (activeLoadRequestRef.current !== requestId) {
                return;
            }
            console.error('Failed to load stream', e);
        } finally {
            if (activeLoadRequestRef.current === requestId) {
                setStreamLoading(false);
                setServerSwitchLoading(false);
            }
        }
    }, [ensureStreamDataForServer, resolveStreamDataWithFallback, selectedServer, selectedAudio, filterStreams, getEpisodeCacheKey]);

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

        const alternateAudio: 'sub' | 'dub' = selectedAudio === 'sub' ? 'dub' : 'sub';
        if (availableAudios.includes(alternateAudio)) {
            setSelectedAudio(alternateAudio);
            setSelectedStreamIndex(0);
            setIsAutoQuality(true);
            return true;
        }

        return false;
    }, [streams.length, selectedStreamIndex, selectedAudio, availableAudios]);

    // Clear all stream state when switching anime
    const clearStreams = useCallback(() => {
        activeLoadRequestRef.current += 1;
        setCurrentEpisode(null);
        setAllStreams([]);
        setStreams([]);
        setSelectedStreamIndex(0);
        setSelectedAudio('sub');
        setSelectedServer('allmanga');
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
        const shouldForceReload = server === selectedServer;
        setSelectedServer(server);
        setSelectedStreamIndex(0);
        setIsAutoQuality(true);
        setShowQualityMenu(false);
        if (shouldForceReload && currentEpisode) {
            streamCache.current.delete(getEpisodeCacheKey(server, currentEpisode));
            loadStream(currentEpisode);
        }
    }, [currentEpisode, loadStream, selectedServer, getEpisodeCacheKey]);


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
        setSelectedAudio,
        tryNextStream,
        getMappedQuality,
        clearStreams,
        bustEpisodeCache,
    };
}

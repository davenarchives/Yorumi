import { useState, useRef, useEffect } from 'react';
import Hls from 'hls.js';
import type { Episode } from '../types/anime';
import type { StreamLink } from '../types/stream';
import { getStreamData, getMappedQuality } from '../utils/streamUtils';

export function useStreams(scraperSession: string | null) {
    const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(null);
    const [streams, setStreams] = useState<StreamLink[]>([]);
    const [selectedStreamIndex, setSelectedStreamIndex] = useState<number>(0);
    const [isAutoQuality, setIsAutoQuality] = useState(true);
    const [showQualityMenu, setShowQualityMenu] = useState(false);
    const [streamLoading, setStreamLoading] = useState(false);
    const [playerMode, setPlayerMode] = useState<'hls' | 'embed'>('embed');

    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);
    const streamCache = useRef(new Map<string, Promise<StreamLink[]>>());

    const currentStream = streams[selectedStreamIndex] || null;

    // Setup HLS player
    useEffect(() => {
        if (currentStream?.directUrl && playerMode === 'hls' && videoRef.current) {
            if (Hls.isSupported()) {
                if (hlsRef.current) hlsRef.current.destroy();
                const hls = new Hls({
                    capLevelToPlayerSize: true,
                    enableWorker: true,
                    lowLatencyMode: true,
                    backBufferLength: 90
                });
                hls.loadSource(currentStream.directUrl);
                hls.attachMedia(videoRef.current);
                hlsRef.current = hls;
            } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
                videoRef.current.src = currentStream.directUrl;
            }
        }

        return () => {
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
        };
    }, [currentStream, playerMode]);

    const ensureStreamData = (episode: Episode): Promise<StreamLink[]> => {
        if (!scraperSession) return Promise.resolve([]);
        if (!streamCache.current.has(episode.session)) {
            const promise = getStreamData(episode, scraperSession)
                .catch(e => {
                    console.error('Failed to load stream', e);
                    streamCache.current.delete(episode.session);
                    return [];
                });
            streamCache.current.set(episode.session, promise);
        }
        return streamCache.current.get(episode.session)!;
    };

    const prefetchStream = (episode: Episode) => {
        if (scraperSession) ensureStreamData(episode);
    };

    const loadStream = async (episode: Episode) => {
        setCurrentEpisode(episode);
        setStreamLoading(true);
        setStreams([]);

        try {
            const streamData = await ensureStreamData(episode);
            if (streamData.length > 0) {
                setStreams(streamData);
                setSelectedStreamIndex(0);
                setIsAutoQuality(true);
            }
        } catch (e) {
            console.error('Failed to load stream', e);
        } finally {
            setStreamLoading(false);
        }
    };

    const handleQualityChange = (index: number) => {
        setSelectedStreamIndex(index);
        setIsAutoQuality(false);
        setShowQualityMenu(false);
    };

    const setAutoQuality = () => {
        setSelectedStreamIndex(0);
        setIsAutoQuality(true);
        setShowQualityMenu(false);
    };

    // Clear all stream state when switching anime
    const clearStreams = () => {
        setCurrentEpisode(null);
        setStreams([]);
        setSelectedStreamIndex(0);
        setStreamLoading(false);
        streamCache.current.clear();
    };

    return {
        // State
        currentEpisode,
        streams,
        selectedStreamIndex,
        isAutoQuality,
        showQualityMenu,
        currentStream,
        streamLoading,
        playerMode,
        videoRef,
        hlsRef,

        // Actions
        loadStream,
        prefetchStream,
        handleQualityChange,
        setAutoQuality,
        setShowQualityMenu,
        setPlayerMode,
        getMappedQuality,
        clearStreams,
    };
}

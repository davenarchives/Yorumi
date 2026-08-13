import React, { useEffect, useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { usePersistentPlayer } from '../../../player/context/PersistentPlayerContext';
import { usePlayer } from '../../../player/hooks/usePlayer';
import type { Episode } from '../../../../types/anime';

interface DetailsVideoPlayerProps {
    animeId: string;
    animeTitle?: string;
    onClose: () => void;
    isWatched?: boolean;
    onMarkWatched?: () => void;
    isResolvingEpisode?: boolean;
    fallbackEpisode?: Episode | null;
    prevEpisode?: any;
    nextEpisode?: any;
}

export default function DetailsVideoPlayer({ animeId, animeTitle, onClose, isWatched, onMarkWatched, isResolvingEpisode = false, fallbackEpisode = null, prevEpisode = null, nextEpisode = null }: DetailsVideoPlayerProps) {
    const location = useLocation();
    const [, setSearchParams] = useSearchParams();
    const { registerPlayer, setInlinePlayerElement } = usePersistentPlayer();
    const getEpisodeNavigationState = () => ({
        ...(location.state && typeof location.state === 'object' ? location.state as Record<string, unknown> : {}),
        preventScrollTop: true,
    });

    const goToPrevEp = () => {
        if (!prevEpisode) return;
        const num = prevEpisode._tmdbAbsolute || prevEpisode.playbackEpisodeNumber || prevEpisode.episodeNumber;
        if (num) setSearchParams({ ep: String(num) }, { state: getEpisodeNavigationState() });
    };

    const goToNextEp = () => {
        if (!nextEpisode) return;
        const num = nextEpisode._tmdbAbsolute || nextEpisode.playbackEpisodeNumber || nextEpisode.episodeNumber;
        if (num) setSearchParams({ ep: String(num) }, { state: getEpisodeNavigationState() });
    };

    const {
        currentEpisode,
        currentStream,
        streams,
        error,
        epNum,
        cleanCurrentTitle,
        resumeAtSeconds,
        streamLoading,
        serverSwitchLoading,
        streamExhausted,
        skipTimestampsLoading,
        isExpanded,
        isAutoQuality,
        autoNextEnabled,
        autoSkipEnabled,
        selectedAudio,
        selectedServer,
        serverOptions,
        availableAudios,
        selectedStreamIndex,
        skipTimestamps,
        handlePrevEp,
        handleNextEp,
        handleQualityChange,
        setAutoQuality,
        setAutoNextEnabled,
        setAutoSkipEnabled,
        setSelectedServer,
        handleServerChange,
        setSelectedAudio,
        canPrevEpisode,
        canNextEpisode,
        setIsPlayerReady,
        handlePlaybackProgress,
        handleStreamError,
        toggleExpand,
    } = usePlayer(animeId, animeTitle, fallbackEpisode);

    const playerProps = useMemo(() => ({
        streamUrl: currentStream?.url,
        episodeSession: currentEpisode?.session ?? epNum,
        isHls: currentStream?.isHls,
        isEmbed: currentStream?.isEmbed,
        subtitles: currentStream?.subtitles,
        isLoading: streamLoading || (isResolvingEpisode && !currentEpisode),
        isServerSwitching: serverSwitchLoading,
        streamExhausted,
        skipTimestampsLoading,
        hasPlayableSource: currentEpisode
            ? Boolean(currentStream?.url) || streamLoading
            : !isResolvingEpisode,
        onLoad: () => setIsPlayerReady(true),
        onError: handleStreamError,
        onProgress: handlePlaybackProgress,
        startAtSeconds: resumeAtSeconds,
        onNextEpisode: canNextEpisode ? handleNextEp : undefined,
        onPrevEpisode: canPrevEpisode ? handlePrevEp : undefined,
        hasNextEpisode: canNextEpisode,
        autoNextEnabled,
        onAutoNextChange: setAutoNextEnabled,
        autoSkipEnabled,
        onAutoSkipChange: setAutoSkipEnabled,
        skipTimestamps,
        selectedAudio,
        availableAudios,
        onAudioChange: setSelectedAudio,
        streams,
        selectedStreamIndex,
        isAutoQuality,
        onQualityChange: handleQualityChange,
        onSetAutoQuality: setAutoQuality,
        selectedServer,
        serverOptions,
        onServerChange: handleServerChange,
        isWide: isExpanded,
        onToggleWide: toggleExpand,
        animeId,
        animeTitle,
        animeImage: currentEpisode?.snapshot || fallbackEpisode?.snapshot || '',
        episodeNumber: Number(epNum || currentEpisode?.episodeNumber || 1),
        episodeTitle: cleanCurrentTitle || currentEpisode?.title,
    }), [
        animeId,
        animeTitle,
        availableAudios,
        autoNextEnabled,
        autoSkipEnabled,
        canNextEpisode,
        canPrevEpisode,
        cleanCurrentTitle,
        currentEpisode,
        currentStream,
        epNum,
        fallbackEpisode,
        handleNextEp,
        handlePlaybackProgress,
        handlePrevEp,
        handleQualityChange,
        handleServerChange,
        handleStreamError,
        isAutoQuality,
        isExpanded,
        isResolvingEpisode,
        resumeAtSeconds,
        selectedAudio,
        selectedServer,
        serverOptions,
        selectedStreamIndex,
        setAutoQuality,
        setAutoNextEnabled,
        setAutoSkipEnabled,
        setIsPlayerReady,
        setSelectedAudio,
        setSelectedServer,
        skipTimestamps,
        skipTimestampsLoading,
        streamExhausted,
        streamLoading,
        serverSwitchLoading,
        streams,
        toggleExpand,
    ]);

    const watchState = useMemo(() => ({
        ...(location.state && typeof location.state === 'object' ? (location.state as Record<string, unknown>) : {}),
        preventScrollTop: true,
        anime: (location.state as any)?.anime || ({
            id: animeId,
            title: animeTitle,
            images: { jpg: { large_image_url: playerProps.animeImage || '', image_url: playerProps.animeImage || '' } }
        }),
    }), [location.state, animeId, animeTitle, playerProps.animeImage]);

    useEffect(() => {
        if (error) return;
        registerPlayer(playerProps, `${location.pathname}${location.search}`, watchState);
    }, [error, location.pathname, location.search, playerProps, registerPlayer, watchState]);

    const displayTitle = (() => {
        const rawEpTitle = (cleanCurrentTitle || currentEpisode?.title || '').trim();
        const isGeneric = !rawEpTitle || /^episode\s+\d+$/i.test(rawEpTitle) || /^untitled$/i.test(rawEpTitle);
        
        if (!isGeneric) {
            return rawEpTitle;
        }
        return `Episode ${epNum}`;
    })();

    if (error) {
        return (
            <div className="w-full h-48 bg-white/5 rounded-2xl flex items-center justify-center">
                <span className="text-red-400">{error}</span>
            </div>
        );
    }

    return (
        <div id="details-video-player" className="w-full mt-8 mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                    <span className="px-4 py-1.5 bg-yorumi-accent text-black text-sm font-black rounded flex-shrink-0">
                        E{epNum}
                    </span>
                    <div className="flex flex-col">
                        <h2 className="text-xl font-bold text-white truncate max-w-xl">
                            {displayTitle}
                        </h2>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => {
                            if (onMarkWatched) onMarkWatched();
                        }}
                        className={`px-4 py-2 border rounded-lg text-sm transition-colors flex items-center gap-2 ${
                            isWatched 
                                ? 'bg-green-500/20 border-green-500/50 text-green-400 hover:bg-green-500/30' 
                                : 'border-white/20 text-white hover:bg-white/10'
                        }`}
                    >
                        {isWatched && (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                        {isWatched ? 'Watched' : 'Mark Watched'}
                    </button>
                    <button 
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        title="Close Player"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Video Container Layout */}
            <div className="relative w-full flex items-center justify-center mt-4 py-4 md:py-8 overflow-visible">
                {prevEpisode && (
                    <div 
                        className="absolute -left-4 md:-left-12 lg:-left-20 xl:-left-24 z-10 w-[85%] aspect-video cursor-pointer overflow-hidden group/prev rounded-3xl opacity-60 hover:opacity-100 transition-all duration-300"
                        onClick={goToPrevEp}
                        title={`Previous: ${prevEpisode.title}`}
                    >
                        <div 
                            className="absolute inset-0 bg-cover bg-center transition-all duration-300"
                            style={{ backgroundImage: `url(${prevEpisode.thumbnail || prevEpisode.snapshot})` }}
                        />
                        <div className="absolute inset-0 bg-black/60 group-hover/prev:bg-black/20 transition-all duration-300" />
                        <div className="absolute inset-0 flex items-center justify-start pl-2 md:pl-4 lg:pl-6">
                            <svg className="w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 text-white opacity-0 group-hover/prev:opacity-100 transition-all transform -translate-x-4 group-hover/prev:translate-x-0 duration-300 drop-shadow-2xl" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                            </svg>
                        </div>
                    </div>
                )}

                {/* Next Episode Background (Right) */}
                {nextEpisode && (
                    <div 
                        className="absolute -right-4 md:-right-12 lg:-right-20 xl:-right-24 z-10 w-[85%] aspect-video cursor-pointer overflow-hidden group/next rounded-3xl opacity-60 hover:opacity-100 transition-all duration-300"
                        onClick={goToNextEp}
                        title={`Next: ${nextEpisode.title}`}
                    >
                        <div 
                            className="absolute inset-0 bg-cover bg-center transition-all duration-300"
                            style={{ backgroundImage: `url(${nextEpisode.thumbnail || nextEpisode.snapshot})` }}
                        />
                        <div className="absolute inset-0 bg-black/60 group-hover/next:bg-black/20 transition-all duration-300" />
                        <div className="absolute inset-0 flex items-center justify-end pr-2 md:pr-4 lg:pr-6">
                            <svg className="w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 text-white opacity-0 group-hover/next:opacity-100 transition-all transform translate-x-4 group-hover/next:translate-x-0 duration-300 drop-shadow-2xl" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                    </div>
                )}

                {/* Main Video */}
                <div className="relative z-20 w-full aspect-video rounded-2xl overflow-hidden bg-black transition-all duration-300">
                    <div ref={setInlinePlayerElement} className="w-full h-full bg-black" />
                </div>
            </div>
        </div>
    );
}

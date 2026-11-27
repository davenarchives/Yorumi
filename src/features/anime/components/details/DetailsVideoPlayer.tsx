import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePersistentPlayer } from '../../../player/context/PersistentPlayerContext';
import { usePlayer } from '../../../player/hooks/usePlayer';
import type { Anime, Episode } from '../../../../types/anime';
import { isMobileShell } from '../../../../platform/runtime';
import { ArrowLeft, ListVideo, X } from 'lucide-react';
import { animeService } from '../../../../services/animeService';

interface DetailsVideoPlayerProps {
    animeId: string;
    animeTitle?: string;
    anime?: Anime;
    onClose: () => void;
    isWatched?: boolean;
    onMarkWatched?: () => void;
    isResolvingEpisode?: boolean;
    seasonNumber?: number;
    fallbackEpisode?: Episode | null;
    episodes?: Episode[];
    onEpisodeSelect?: (episode: Episode) => void;
}

export default function DetailsVideoPlayer({ animeId, animeTitle, anime, onClose, isWatched, onMarkWatched, isResolvingEpisode = false, seasonNumber, fallbackEpisode = null, episodes = [], onEpisodeSelect }: DetailsVideoPlayerProps) {
    const location = useLocation();
    const navigate = useNavigate();
    const { registerPlayer, setInlinePlayerElement } = usePersistentPlayer();
    const [showEpisodes, setShowEpisodes] = useState(false);
    const [similarAnime, setSimilarAnime] = useState<Array<{ id: number | string; title: string; cover: string }>>([]);
    const [loadingSimilar, setLoadingSimilar] = useState(false);

    useEffect(() => {
        let isCancelled = false;
        if (!anime) return;

        // 1. Build set of forbidden IDs (current anime + all franchise relations like sequels/prequels/spin-offs)
        const forbiddenIds = new Set<string>();
        if (anime.id) forbiddenIds.add(String(anime.id));
        if (anime.mal_id) forbiddenIds.add(String(anime.mal_id));
        (anime.relations?.edges || []).forEach((edge) => {
            if (edge.node?.id) forbiddenIds.add(String(edge.node.id));
            if (edge.node?.idMal) forbiddenIds.add(String(edge.node.idMal));
        });

        // 2. Build forbidden title keywords to prevent any sequels/spin-offs from slipping through
        // E.g. "Sousou no Frieren", "One Piece", "Naruto", "Attack on Titan"
        const rawTitle = (anime.title_english || anime.title || anime.title_romaji || '').toLowerCase();
        const cleanBaseTitle = rawTitle
            .replace(/^(the|a)\s+/i, '')
            .replace(/[:\-–—].*$/, '')
            .replace(/\s+(season\s+\d+|part\s+\d+|\d+(?:st|nd|rd|th)\s+season).*$/i, '')
            .trim();
        const forbiddenWords = cleanBaseTitle.length >= 3
            ? cleanBaseTitle.split(/\s+/).filter(w => w.length >= 3)
            : [];

        const isSequelOrRelation = (candId: string | number, candTitle: string) => {
            if (forbiddenIds.has(String(candId))) return true;
            const lowTitle = candTitle.toLowerCase();
            if (forbiddenWords.length > 0 && forbiddenWords.some(w => lowTitle.includes(w))) {
                return true;
            }
            return false;
        };

        const run = async () => {
            setLoadingSimilar(true);
            const results: Array<{ id: number | string; title: string; cover: string }> = [];
            const seenIds = new Set<string>();

            // Priority 1: AniList media recommendations (curated similar genre recommendations)
            const recNodes = anime.recommendations?.nodes || anime.recommendations?.edges?.map(e => e.node) || [];
            for (const rec of recNodes) {
                const item = rec?.mediaRecommendation;
                if (!item || !item.id) continue;
                const itemIdStr = String(item.id);
                if (seenIds.has(itemIdStr)) continue;
                const title = item.title?.english || item.title?.romaji || item.title?.native || 'Unknown';
                if (isSequelOrRelation(item.id, title)) continue;
                if (['MANGA', 'NOVEL', 'ONE_SHOT'].includes(String(item.format || '').toUpperCase())) continue;
                const cover = item.coverImage?.extraLarge || item.coverImage?.large || '';
                seenIds.add(itemIdStr);
                results.push({ id: item.id, title, cover });
            }

            // Priority 2: Fetch by matching primary genre if recommendations are sparse (< 10)
            if (results.length < 10) {
                const genres = (anime.genres || []).map((g: any) => typeof g === 'string' ? g : g.name).filter(Boolean);
                const primaryGenre = genres[0] || 'Action';
                try {
                    const genreRes = await animeService.getAnimeByGenre(primaryGenre, 1, 24);
                    if (!isCancelled && genreRes?.data) {
                        for (const item of genreRes.data) {
                            if (!item || !item.id) continue;
                            const itemIdStr = String(item.id);
                            if (seenIds.has(itemIdStr)) continue;
                            const title = item.title_english || item.title || item.title_romaji || 'Unknown';
                            if (isSequelOrRelation(item.id, title)) continue;
                            const cover = item.images?.jpg?.large_image_url || item.images?.jpg?.image_url || (item as any).anilist_cover_image || '';
                            seenIds.add(itemIdStr);
                            results.push({ id: item.id, title, cover });
                            if (results.length >= 18) break;
                        }
                    }
                } catch {
                    // Ignore genre fetch error
                }
            }

            if (!isCancelled) {
                setSimilarAnime(results);
                setLoadingSimilar(false);
            }
        };

        void run();
        return () => { isCancelled = true; };
    }, [anime]);

    useEffect(() => {
        if (!isMobileShell()) return;
        const previousBodyOverflow = document.body.style.overflow;
        const previousHtmlOverflow = document.documentElement.style.overflow;
        const previousOverscroll = document.body.style.overscrollBehavior;
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overscrollBehavior = 'none';
        return () => {
            document.body.style.overflow = previousBodyOverflow;
            document.documentElement.style.overflow = previousHtmlOverflow;
            document.body.style.overscrollBehavior = previousOverscroll;
        };
    }, []);
    const {
        currentEpisode,
        currentStream,
        streams,
        error,
        epNum,
        episodeDurationSeconds,
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
    } = usePlayer(animeId, animeTitle, fallbackEpisode, anime);

    const playerProps = useMemo(() => ({
        streamUrl: currentStream?.url,
        episodeSession: currentEpisode?.session ?? epNum,
        isHls: currentStream?.isHls,
        isEmbed: currentStream?.isEmbed,
        subtitles: currentStream?.subtitles,
        isLoading: streamLoading || (!currentStream && !streamExhausted),
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
        expectedDurationSeconds: episodeDurationSeconds,
        mobilePageLayout: isMobileShell(),
        onClose,
        onShowEpisodes: () => setShowEpisodes(true),
        seasonNumber: seasonNumber || fallbackEpisode?.tmdbSeason || currentEpisode?.tmdbSeason || 1,
        episodes,
        onEpisodeSelect,
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
        episodeDurationSeconds,
        episodes,
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
        onClose,
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
        seasonNumber,
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
            <div className="relative flex h-48 w-full items-center justify-center rounded-2xl bg-white/5">
                <button type="button" onClick={onClose} className="absolute left-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-black/60 text-white" aria-label="Close player">
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <span className="text-red-400">{error}</span>
            </div>
        );
    }

    const cleanEpTitle = cleanCurrentTitle || fallbackEpisode?.title || currentEpisode?.title;
    const displaySeason = seasonNumber || fallbackEpisode?.tmdbSeason || currentEpisode?.tmdbSeason || 1;
    const displayEpisode = fallbackEpisode?.episodeNumber || currentEpisode?.episodeNumber || epNum;

    if (isMobileShell()) {
        return createPortal((
            <div id="details-video-player" className="fixed inset-0 z-[2147483620] flex flex-col overflow-hidden overscroll-none bg-black text-white" style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                    <div className="relative aspect-video w-full bg-black">
                        <div ref={setInlinePlayerElement} className="absolute inset-0 bg-black" />
                    </div>
                    {/* Metadata directly below video matching reference */}
                    <div className="bg-black px-4 pt-3 pb-2">
                        <h1 className="text-xl sm:text-2xl font-black leading-tight text-white line-clamp-2 overflow-hidden text-ellipsis">
                            {animeTitle || 'Anime'}
                        </h1>
                        <p className="mt-1 text-sm sm:text-base font-semibold text-white/70 line-clamp-1">
                            S{displaySeason} E{displayEpisode}{cleanEpTitle && !/^episode\s+\d+(?:\.\d+)?$/i.test(cleanEpTitle.trim()) && <> {"\u00b7"} {cleanEpTitle}</>}
                        </p>
                    </div>
                    {/* More Like This section with 2-row max aligned cards */}
                    <section className="px-4 py-5">
                        <h2 className="mb-3 text-lg font-bold text-white">More Like This</h2>
                        <div className="flex items-start gap-3 overflow-x-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {similarAnime.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => navigate(`/anime/details/al-${item.id}`)}
                                    className="flex w-[42vw] max-w-[170px] shrink-0 flex-col items-stretch self-start text-left group"
                                >
                                    <div className="relative aspect-[2/3] w-full overflow-hidden rounded-[16px] bg-zinc-900 shadow-md">
                                        <img
                                            src={item.cover}
                                            alt={item.title}
                                            className="h-full w-full object-cover transition-transform duration-300 group-active:scale-95"
                                            loading="lazy"
                                        />
                                    </div>
                                    <div className="mt-2 h-[2.5rem] min-h-[2.5rem] overflow-hidden">
                                        <span className="line-clamp-2 text-xs sm:text-sm font-bold leading-snug text-white/90 overflow-hidden text-ellipsis">
                                            {item.title}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                        {!loadingSimilar && similarAnime.length === 0 && (
                            <p className="text-sm text-white/60">No recommendations available.</p>
                        )}
                    </section>
                </div>

                {showEpisodes && createPortal((
                    <div className="fixed inset-0 z-[2147483647] flex flex-col bg-black/60 backdrop-blur-xl" onClick={() => setShowEpisodes(false)}>
                        <div className="flex h-full min-h-0 flex-col px-4 pb-8" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }} onClick={(event) => event.stopPropagation()}>
                            <div className="flex shrink-0 items-center justify-between">
                                <h3 className="text-xl font-bold">Episodes</h3>
                                <button type="button" onClick={() => setShowEpisodes(false)} className="grid h-10 w-10 place-items-center rounded-full border border-white/20"><X className="h-5 w-5" /></button>
                            </div>
                            <div className="flex min-h-0 flex-1 items-center">
                                <div className="flex w-full snap-x gap-3 overflow-x-auto py-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                    {episodes.map((episode) => {
                                        const number = String(episode._tmdbAbsolute || episode.episodeNumber || 1);
                                        const active = number === String(epNum);
                                        return (
                                            <button key={episode.session || number} type="button" onClick={() => { onEpisodeSelect?.(episode); setShowEpisodes(false); }} className={`relative w-[215px] shrink-0 snap-center overflow-hidden rounded-2xl border-2 bg-[#161616] text-left ${active ? 'border-white' : 'border-transparent'}`}>
                                                <div className="aspect-video bg-zinc-900"><img src={episode.snapshot || (episode as any).thumbnail || playerProps.animeImage} alt="" className="h-full w-full object-cover" /></div>
                                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/75 to-transparent px-3 pb-3 pt-8 text-sm font-semibold"><span className="mr-2 text-zinc-400">E{episode.episodeNumber}</span>{episode.title}</div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                ), document.body)}
            </div>
        ), document.body);
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
                {/* Main Video */}
                <div className="yorumi-details-player-frame relative z-20 w-full aspect-video rounded-2xl overflow-hidden bg-black transition-all duration-300">
                    <div ref={setInlinePlayerElement} className="yorumi-player-mount w-full h-full bg-black" />
                </div>
            </div>
        </div>
    );
}

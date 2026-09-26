import { memo, useState, useCallback, useEffect, useMemo } from 'react';
import { ArrowDown, ArrowUp, CircleCheckBig, Download, Loader2, FolderOpen } from 'lucide-react';
import type { Episode, Anime } from '../../../../types/anime';
import type { StreamLink } from '../../../../types/stream';
import { getEpisodeWatchKey, getPlaybackEpisodeNumber } from '../../../../utils/episodeWatchKey';
import { useDownloads } from '../../../../hooks/useDownloads';
import { downloadService } from '../../../../services/downloadService';
import { getStreamData } from '../../../../utils/streamUtils';
import ChapterViewToggle from '../../../../components/ui/ChapterViewToggle';

export type NormalizedEpisode = Episode & {
    title: string;
    overview?: string;
    thumbnail?: string;
    airDate?: string | null;
    tmdbSeason?: number;
    tmdbEpisode?: number;
    playbackEpisodeNumber?: number;
};

export interface SeasonChip {
    id: number;
    label: string;
    title: string;
    isActive: boolean;
    source?: 'anilist' | 'tmdb';
    tmdbSeasonNumber?: number;
    offset?: number;
    count?: number;
    anime?: Anime;
    anilistId?: number;
    isVirtual?: boolean;
}

const hasExplicitReleaseUnit = (value: string) =>
    /\bseason\s*\d+\b|\b\d+(?:st|nd|rd|th)\s*season\b|\bcour\s*\d+\b|\b\d+(?:st|nd|rd|th)\s*cour\b|\bpart\s*\d+\b|\b\d+(?:st|nd|rd|th)\s*part\b/i.test(value);

const getCompactSeasonLabel = (season: SeasonChip, baseSeasonId: number | undefined, animeTitle: string) => {
    if (season.source === 'tmdb' && season.tmdbSeasonNumber) {
        if (/^one\s+piece\b/i.test(animeTitle.trim())) {
            const arcTitle = String(season.title || '')
                .replace(/^season\s*\d+\s*[:\-–—]\s*/i, '')
                .trim();
            if (arcTitle && !/^season\s*\d+$/i.test(arcTitle)) return arcTitle;
        }
        return `Season ${season.tmdbSeasonNumber}`;
    }

    const title = String(season.title || season.label || '').trim();
    const seasonMatch = title.match(/\bseason\s*(\d+)\b/i) || title.match(/\b(\d+)(?:st|nd|rd|th)\s*season\b/i);
    const courMatch = title.match(/\bcour\s*(\d+)\b/i) || title.match(/\b(\d+)(?:st|nd|rd|th)\s*cour\b/i);
    const partMatch = title.match(/\bpart\s*(\d+)\b/i) || title.match(/\b(\d+)(?:st|nd|rd|th)\s*part\b/i);
    const explicitUnits = [
        seasonMatch ? `Season ${seasonMatch[1]}` : '',
        courMatch ? `Cour ${courMatch[1]}` : '',
        partMatch ? `Part ${partMatch[1]}` : '',
    ].filter(Boolean);

    if (explicitUnits.length > 0) return explicitUnits.join(' ');
    if (season.id === baseSeasonId) return 'Season 1';

    const subtitleSeparator = title.search(/[:：]/);
    if (subtitleSeparator >= 0) {
        const subtitle = title.slice(subtitleSeparator + 1).trim();
        if (subtitle) return subtitle;
    }

    return title || season.label;
};

function EpisodeThumbnail({ src, fallback, label, priority = false }: { src?: string; fallback?: string; label: string; priority?: boolean }) {
    const [failed, setFailed] = useState(false);
    const [useFallback, setUseFallback] = useState(false);
    const [loaded, setLoaded] = useState(false);

    const displaySrc = useFallback ? fallback : (src || fallback);

    if (!displaySrc || failed) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-white/[0.03] text-gray-600 font-bold text-sm">
                {label}
            </div>
        );
    }

    const showSeparateFallback = Boolean(fallback && displaySrc !== fallback);

    return (
        <div className="relative h-full w-full bg-white/[0.03]">
            {showSeparateFallback && (
                <img src={fallback} alt="" className="absolute inset-0 h-full w-full object-cover" aria-hidden="true" />
            )}
            <img
                src={displaySrc}
                alt=""
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${showSeparateFallback && !loaded ? 'opacity-0' : 'opacity-100'}`}
                loading={priority ? 'eager' : 'lazy'}
                fetchPriority={priority ? 'high' : 'auto'}
                decoding="async"
                onLoad={() => setLoaded(true)}
                onError={() => {
                    if (!useFallback && fallback && displaySrc !== fallback) {
                        setUseFallback(true);
                    } else {
                        setFailed(true);
                    }
                }}
            />
        </div>
    );
}

interface DetailsEpisodeGridProps {
    episodes: NormalizedEpisode[];
    watchedEpisodes: Set<string>;
    activeEpParam: string | null;
    seasonChips?: SeasonChip[];
    isLoading?: boolean;
    skeletonCount?: number;
    fallbackCoverImage?: string;
    animeId?: string;
    animeTitle?: string;
    animeImage?: string;
    scraperSession?: string;
    anilistId?: number;
    onSeasonClick?: (season: SeasonChip) => void;
    onEpisodeClick: (ep: NormalizedEpisode) => void;
    isMovie?: boolean;
}

type EpisodeCardProps = {
    episode: NormalizedEpisode;
    isWatched: boolean;
    isActive: boolean;
    fallbackCoverImage?: string;
    animeId?: string;
    animeTitle?: string;
    animeImage?: string;
    scraperSession?: string;
    anilistId?: number;
    onEpisodeClick: (ep: NormalizedEpisode) => void;
    onDownload: (ep: NormalizedEpisode) => void;
    onDeleteDownload: (epNum: number) => void;
    isDownloaded: boolean;
    downloadProgress?: number;
    isDownloading: boolean;
    isResolvingDownload: boolean;
    hideEpisodeNumber?: boolean;
    prioritizeThumbnail?: boolean;
};

function isEpisodeUnreleased(airDate?: string | null): boolean {
    if (!airDate) return false;
    const time = new Date(airDate).getTime();
    return Number.isFinite(time) && time > Date.now();
}

const EpisodeCard = memo(function EpisodeCard({
    episode,
    isWatched,
    isActive,
    fallbackCoverImage,
    onEpisodeClick,
    onDownload,
    onDeleteDownload,
    isDownloaded,
    downloadProgress = 0,
    isDownloading,
    isResolvingDownload,
    hideEpisodeNumber = false,
    prioritizeThumbnail = false,
}: EpisodeCardProps) {
    const cleanTitle = episode.title ? episode.title.split('<note-split>')[0].trim() : '';
    const displayTitle = cleanTitle || `Episode ${episode.episodeNumber}`;
    const isUnreleased = isEpisodeUnreleased(episode.airDate);
    const thumbnail = isUnreleased ? fallbackCoverImage : (episode.thumbnail || episode.snapshot || fallbackCoverImage);
    const epNum = getPlaybackEpisodeNumber(episode) || Number(episode.episodeNumber || 1);

    return (
        <div
            key={episode.session || episode.episodeNumber}
            onClick={() => {
                if (!isUnreleased) onEpisodeClick(episode);
            }}
            className={`relative flex items-stretch text-left bg-transparent md:bg-[#141414] rounded-none md:rounded-lg overflow-hidden transition-all duration-200 group h-[116px] md:h-[104px]
                ${isActive ? 'ring-1 ring-blue-400 bg-[#1a1a1a]' : isWatched ? 'bg-green-500/5 hover:bg-green-500/10' : 'hover:bg-[#1a1a1a]'}
                ${isUnreleased ? 'opacity-60 cursor-not-allowed' : 'hover:scale-[1.02] cursor-pointer'}`}
            title={displayTitle}
        >
            <div className="ml-3 w-[38%] max-w-28 aspect-[4/3] self-center shrink-0 relative bg-[#0a0a0a] rounded-xl overflow-hidden">
                <EpisodeThumbnail key={`${thumbnail || ''}:${fallbackCoverImage || ''}`} src={thumbnail} fallback={fallbackCoverImage} label={`E${episode.episodeNumber}`} priority={prioritizeThumbnail} />
                {isActive ? (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[1px]">
                        <div className="flex items-center gap-1.5 text-white font-bold text-xs tracking-wider">
                            <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                            PLAYING
                        </div>
                    </div>
                ) : isUnreleased ? (
                    <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-1 text-gray-400">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                    </div>
                ) : (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg className="w-8 h-8 text-white fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                )}
            </div>
            <div className="flex-1 py-3 pl-4 pr-1 md:p-3 flex flex-col justify-center md:justify-between min-w-0">
                <div>
                    <div className="flex justify-between items-center w-full gap-2">
                        <span className={`font-bold text-[15px] md:text-xs md:uppercase md:tracking-wider truncate ${isWatched ? 'text-green-500' : 'text-white md:text-blue-300'}`}>{hideEpisodeNumber ? '' : `${episode.episodeNumber}. `}{isUnreleased ? 'Unreleased' : displayTitle}</span>
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            {!isUnreleased && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (isDownloaded) {
                                            onDeleteDownload(epNum);
                                        } else if (!isDownloading && !isResolvingDownload) {
                                            onDownload(episode);
                                        }
                                    }}
                                    disabled={isDownloading || isResolvingDownload}
                                    className={`p-1 rounded-md transition-all ${
                                        isDownloaded
                                            ? 'text-emerald-400 hover:bg-red-500/20 hover:text-red-400'
                                            : isDownloading || isResolvingDownload
                                            ? 'text-yorumi-accent hover:bg-white/10'
                                            : 'text-gray-400 hover:text-white hover:bg-white/10 opacity-70 group-hover:opacity-100'
                                    }`}
                                    title={
                                        isDownloaded
                                            ? 'Downloaded for offline (Click to delete)'
                                            : isDownloading
                                            ? `Downloading ${downloadProgress}%`
                                            : isResolvingDownload
                                            ? 'Resolving stream...'
                                            : 'Download episode'
                                    }
                                >
                                    {isResolvingDownload ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-yorumi-accent" />
                                    ) : isDownloading ? (
                                        <div className="flex items-center gap-1 text-[10px] font-bold text-yorumi-accent">
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            <span>{downloadProgress}%</span>
                                        </div>
                                    ) : isDownloaded ? (
                                        <CircleCheckBig className="w-3.5 h-3.5 text-emerald-400" />
                                    ) : (
                                        <Download className="w-3.5 h-3.5" />
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                    <span className={`hidden md:block font-semibold text-xs line-clamp-3 mt-0.5 leading-snug ${isWatched ? 'text-green-50' : 'text-white'}`}>{isUnreleased ? 'Unreleased' : displayTitle}</span>
                    {episode.overview && <p className="md:hidden mt-1 text-[13px] leading-[1.35] text-zinc-500 line-clamp-2">{episode.overview}</p>}
                </div>

                {isDownloading && (
                    <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden mt-1">
                        <div
                            className="bg-yorumi-accent h-full transition-all duration-300 rounded-full"
                            style={{ width: `${Math.max(5, downloadProgress)}%` }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
});

const EpisodeCardSkeleton = () => (
    <div className="flex items-stretch bg-[#141414] rounded-lg overflow-hidden animate-pulse h-[104px]">
        <div className="w-28 sm:w-32 shrink-0 bg-white/10" />
        <div className="flex-1 p-3 flex flex-col justify-start min-w-0">
            <div className="flex justify-between items-center w-full mb-1.5">
                <div className="h-3 w-10 bg-white/20 rounded" />
            </div>
            <div className="space-y-1.5">
                <div className="h-3.5 w-[90%] bg-white/10 rounded" />
                <div className="h-3.5 w-[60%] bg-white/10 rounded" />
            </div>
        </div>
    </div>
);

export default function DetailsEpisodeGrid({
    episodes,
    watchedEpisodes,
    activeEpParam,
    seasonChips = [],
    isLoading = false,
    skeletonCount = 12,
    fallbackCoverImage,
    animeId = '',
    animeTitle = '',
    animeImage = '',
    scraperSession = '',
    anilistId,
    onSeasonClick,
    onEpisodeClick,
    isMovie = false,
}: DetailsEpisodeGridProps) {
    const { isEpisodeDownloaded, getDownloadProgress, startDownload, deleteDownload } = useDownloads();
    const [resolvingEpisodes, setResolvingEpisodes] = useState<Set<number>>(new Set());
    const [descending, setDescending] = useState(false);
    const [mobileGrid, setMobileGrid] = useState(false);
    const isElectron = typeof window !== 'undefined' && Boolean(window.electronAPI?.openDownloadsFolder);

    const handleDownloadEpisode = useCallback(
        async (ep: NormalizedEpisode) => {
            const epNum = getPlaybackEpisodeNumber(ep) || Number(ep.episodeNumber || 1);
            if (!animeId || !epNum) return;

            setResolvingEpisodes((prev) => new Set(prev).add(epNum));
            try {
                // Try resolving stream across providers: frieren -> stark -> fern -> himmel -> auto
                const providers = ['frieren', 'stark', 'fern', 'himmel', 'auto'];
                let bestStream: StreamLink | undefined;

                for (const provider of providers) {
                    try {
                        const streams = await getStreamData(ep, scraperSession || animeTitle, {
                            title: animeTitle,
                            anilistId,
                            provider,
                        });

                        const candidate = streams.find(
                            (s) => (s.directUrl || s.url) && !s.isEmbed && (s.isHls || (s.url && (s.url.includes('.m3u8') || s.url.includes('.mp4') || s.url.includes('/api/scraper/proxy'))))
                        ) || streams.find((s) => (s.directUrl || s.url) && !s.isEmbed) || streams.find((s) => s.directUrl || s.url);

                        if (candidate?.url || candidate?.directUrl) {
                            bestStream = candidate;
                            break;
                        }
                    } catch {
                        // continue to next provider
                    }
                }

                if (!bestStream?.url && !bestStream?.directUrl) {
                    throw new Error('No downloadable stream source found for this episode');
                }

                const streamDownloadUrl = bestStream.directUrl || bestStream.url;

                await startDownload({
                    animeId,
                    animeTitle: animeTitle || 'Anime',
                    animeImage: animeImage || fallbackCoverImage || '',
                    episodeNumber: epNum,
                    episodeTitle: ep.title,
                    streamUrl: streamDownloadUrl,
                    isHls: bestStream.isHls,
                    quality: bestStream.quality,
                    audio: (bestStream.audio === 'dub' ? 'dub' : 'sub') as 'sub' | 'dub',
                    subtitles: bestStream.subtitles,
                });
            } catch (err) {
                console.error(`Failed to download episode ${epNum}:`, err);
            } finally {
                setResolvingEpisodes((prev) => {
                    const next = new Set(prev);
                    next.delete(epNum);
                    return next;
                });
            }
        },
        [animeId, animeTitle, animeImage, fallbackCoverImage, scraperSession, anilistId, startDownload]
    );

    const handleDownloadAll = useCallback(async () => {
        const releasedEpisodes = episodes.filter((ep) => {
            const isUnreleased = isEpisodeUnreleased(ep.airDate);
            const epNum = getPlaybackEpisodeNumber(ep) || Number(ep.episodeNumber || 1);
            const activeNumbers = [ep.episodeNumber, ep.playbackEpisodeNumber, ep._tmdbAbsolute];
            const downloaded = isEpisodeDownloaded(animeId, epNum, animeTitle, anilistId, activeNumbers);
            const progress = getDownloadProgress(animeId, epNum, anilistId, activeNumbers, animeTitle);
            const isDownloading = progress?.status === 'downloading' || progress?.status === 'saving';
            const isResolving = resolvingEpisodes.has(epNum);
            return !isUnreleased && !downloaded && !isDownloading && !isResolving;
        });

        if (releasedEpisodes.length === 0) return;

        // Mark all episodes as resolving immediately so all cards reflect loading state simultaneously
        const epNums = releasedEpisodes
            .map((ep) => getPlaybackEpisodeNumber(ep) || Number(ep.episodeNumber || 1))
            .filter(Boolean);

        setResolvingEpisodes((prev) => {
            const next = new Set(prev);
            epNums.forEach((n) => next.add(n));
            return next;
        });

        // Trigger all episode downloads in parallel
        await Promise.allSettled(releasedEpisodes.map((ep) => handleDownloadEpisode(ep)));
    }, [
        episodes,
        animeId,
        animeTitle,
        anilistId,
        isEpisodeDownloaded,
        getDownloadProgress,
        resolvingEpisodes,
        handleDownloadEpisode,
    ]);

    const handleOpenFolder = useCallback(() => {
        downloadService.openDownloadsFolder('Anime');
    }, []);

    useEffect(() => {
        const toggleSort = () => setDescending((value) => !value);
        const toggleView = () => setMobileGrid((value) => !value);
        const downloadAll = () => { void handleDownloadAll(); };
        window.addEventListener('yorumi:anime:toggle-sort', toggleSort);
        window.addEventListener('yorumi:anime:toggle-view', toggleView);
        window.addEventListener('yorumi:anime:download-all', downloadAll);
        return () => {
            window.removeEventListener('yorumi:anime:toggle-sort', toggleSort);
            window.removeEventListener('yorumi:anime:toggle-view', toggleView);
            window.removeEventListener('yorumi:anime:download-all', downloadAll);
        };
    }, [handleDownloadAll]);

    const displayedEpisodes = useMemo(
        () => descending ? [...episodes].reverse() : episodes,
        [descending, episodes]
    );
    const baseSeasonId = [...seasonChips]
        .filter((season) => season.source !== 'tmdb' && !hasExplicitReleaseUnit(String(season.title || season.label || '')))
        .sort((a, b) => {
            const aYear = Number(a.anime?.year || a.anime?.aired?.from?.slice(0, 4) || 9999);
            const bYear = Number(b.anime?.year || b.anime?.aired?.from?.slice(0, 4) || 9999);
            return aYear - bYear;
        })[0]?.id;

    return (
        <div className="pt-2 mt-2 md:mt-0">
            {!isMovie && <div className="flex flex-wrap items-center justify-between gap-3 mb-4 md:mb-6">
                <div className="flex items-center gap-4 flex-1">
                    <h3 className="text-[22px] md:text-xl font-semibold md:font-black text-white md:uppercase md:tracking-wider whitespace-nowrap">
                        Episodes {episodes.length > 0 && <span className="text-sm font-bold text-gray-500">({episodes.length})</span>}
                    </h3>
                    <div className="flex-1 h-px bg-white/10" />
                </div>
                {episodes.length > 0 && (
                    <div className="hidden items-center gap-2 md:flex">
                        <button
                            type="button"
                            onClick={() => setDescending((value) => !value)}
                            className="grid h-10 w-10 place-items-center text-gray-400 transition-colors hover:text-white"
                            title={descending ? 'Newest first' : 'Oldest first'}
                            aria-label={descending ? 'Sort episodes newest first' : 'Sort episodes oldest first'}
                        >
                            {descending ? <ArrowDown className="h-5 w-5" /> : <ArrowUp className="h-5 w-5" />}
                        </button>
                        <ChapterViewToggle viewMode={mobileGrid ? 'grid' : 'list'} onViewModeChange={(mode) => setMobileGrid(mode === 'grid')} />
                        {isElectron && (
                            <button
                                type="button"
                                onClick={handleOpenFolder}
                                className="grid h-10 w-10 place-items-center text-gray-400 transition-colors hover:text-yorumi-accent"
                                title="Open downloaded files on your computer"
                                aria-label="Open downloads folder"
                            >
                                <FolderOpen className="h-5 w-5" />
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handleDownloadAll}
                            className="hidden h-10 w-10 place-items-center text-gray-400 transition-colors hover:text-blue-400 md:grid"
                            title="Download all released episodes"
                            aria-label="Download all released episodes"
                        >
                            <Download className="h-5 w-5" />
                        </button>
                    </div>
                )}
            </div>}

            {seasonChips.length > 1 && (
                <div className="mb-4 md:mb-6 flex overflow-x-auto md:flex-wrap items-center gap-2 md:gap-3 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {seasonChips.map((season) => (
                        <button
                            key={season.id}
                            type="button"
                            onClick={() => onSeasonClick?.(season)}
                            disabled={season.isActive}
                            title={season.title}
                            aria-current={season.isActive ? 'page' : undefined}
                            className={`shrink-0 min-h-10 rounded-xl md:rounded-full px-4 md:px-5 text-sm font-bold transition-all ${
                                season.isActive
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white/[0.07] text-gray-300 hover:bg-white/[0.11] hover:text-white'
                            } disabled:cursor-default`}
                        >
                            {getCompactSeasonLabel(season, baseSeasonId, animeTitle)}
                        </button>
                    ))}
                </div>
            )}

            <div>
                <div className={`grid ${mobileGrid ? 'grid-cols-5 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10' : 'grid-cols-1 gap-1 sm:grid-cols-2 md:grid-cols-3 md:gap-4 lg:grid-cols-4'}`}>
                    {isLoading ? (
                        Array.from({ length: skeletonCount }).map((_, index) => <EpisodeCardSkeleton key={`episode-skeleton-${index}`} />)
                    ) : episodes.length > 0 ? (
                        displayedEpisodes.map((ep, index) => {
                            const epNum = Number(ep.episodeNumber || ep.playbackEpisodeNumber || 1);
                            const watchedKey = getEpisodeWatchKey(ep);
                            const isWatched = watchedEpisodes.has(watchedKey);
                            const activeNumbers = [
                                String(ep.episodeNumber),
                                ep.playbackEpisodeNumber ? String(ep.playbackEpisodeNumber) : '',
                                ep._tmdbAbsolute ? String(ep._tmdbAbsolute) : '',
                            ].filter(Boolean);
                            const isActive = Boolean(activeEpParam && activeNumbers.includes(activeEpParam));

                            const isDownloaded = isEpisodeDownloaded(
                                animeId,
                                epNum,
                                animeTitle,
                                anilistId,
                                [ep.episodeNumber, ep.playbackEpisodeNumber, ep._tmdbAbsolute]
                            );
                            const progressInfo = getDownloadProgress(
                                animeId,
                                epNum,
                                anilistId,
                                [ep.episodeNumber, ep.playbackEpisodeNumber, ep._tmdbAbsolute],
                                animeTitle
                            );
                            const isDownloading = progressInfo?.status === 'downloading' || progressInfo?.status === 'saving';
                            const isResolving = resolvingEpisodes.has(epNum) && !isDownloading && !isDownloaded;

                            if (mobileGrid) {
                                return (
                                    <button
                                        key={`${ep.tmdbSeason || 'ep'}-${ep.tmdbEpisode || ep.episodeNumber}-${ep.playbackEpisodeNumber || ''}`}
                                        type="button"
                                        onClick={() => onEpisodeClick(ep)}
                                        className={`aspect-square rounded-lg border text-sm font-bold transition-colors active:scale-95 ${isActive ? 'border-blue-400 bg-blue-500/20 text-blue-300' : isWatched ? 'border-white/5 bg-green-500/10 text-green-400' : 'border-white/5 bg-[#1a1a1a] text-gray-200'}`}
                                        title={ep.title || `Episode ${epNum}`}
                                    >
                                        {epNum}
                                    </button>
                                );
                            }

                            return (
                                <EpisodeCard
                                    key={`${ep.tmdbSeason || 'ep'}-${ep.tmdbEpisode || ep.episodeNumber}-${ep.playbackEpisodeNumber || ''}`}
                                    episode={ep}
                                    isWatched={isWatched}
                                    isActive={isActive}
                                    fallbackCoverImage={fallbackCoverImage}
                                    animeId={animeId}
                                    animeTitle={animeTitle}
                                    animeImage={animeImage}
                                    scraperSession={scraperSession}
                                    anilistId={anilistId}
                                    onEpisodeClick={onEpisodeClick}
                                    onDownload={handleDownloadEpisode}
                                    onDeleteDownload={(num) => deleteDownload(animeId, num)}
                                    isDownloaded={isDownloaded}
                                    downloadProgress={progressInfo?.progress || 0}
                                    isDownloading={isDownloading}
                                    isResolvingDownload={isResolving}
                                    hideEpisodeNumber={isMovie}
                                    prioritizeThumbnail={index < 16}
                                />
                            );
                        })
                    ) : (
                        <div className="col-span-full text-gray-500 text-center py-4">No episodes found.</div>
                    )}
                </div>
            </div>
        </div>
    );
}

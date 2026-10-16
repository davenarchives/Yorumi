import { memo, useState, useCallback, useEffect, useMemo } from 'react';
import { AlertCircle, ArrowDown, ArrowUp, Download, FolderOpen } from 'lucide-react';
import type { Episode, Anime } from '../../../../types/anime';
import type { StreamLink } from '../../../../types/stream';
import { getDownloadEpisodeNumbers, getEpisodeWatchKey, getPlaybackEpisodeNumber } from '../../../../utils/episodeWatchKey';
import { useDownloads } from '../../../../hooks/useDownloads';
import { downloadService } from '../../../../services/downloadService';
import { getStreamData } from '../../../../utils/streamUtils';
import ChapterViewToggle from '../../../../components/ui/ChapterViewToggle';
import { filterReleasedEpisodes } from '../../../../utils/animeAiring';
import type { AnimeEpisodeSegment } from '../../../../utils/animeEpisodeMapping';
import { hasSeasonNavigation } from '../../../../utils/seasonNavigation';
import DownloadStateIcon from '../../../../components/ui/DownloadStateIcon';

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
    source?: 'anilist' | 'tmdb' | 'mapping';
    tmdbSeasonNumber?: number;
    offset?: number;
    count?: number;
    anime?: Anime;
    anilistId?: number;
    isVirtual?: boolean;
    segments?: AnimeEpisodeSegment[];
}

const getCompactSeasonLabel = (season: SeasonChip, _animeTitle: string) => {
    if (season.source === 'mapping') return season.label;
    if (season.source === 'tmdb' && season.tmdbSeasonNumber) {
        const arcTitle = String(season.title || '')
                .replace(/^season\s*\d+\s*[:\-–—]\s*/i, '')
                .trim();
        if (arcTitle && !/^season\s*\d+$/i.test(arcTitle)) return arcTitle;
        return `Season ${season.tmdbSeasonNumber}`;
    }

    if (/^season\s+\d+/i.test(String(season.label || '').trim())) {
        return season.label;
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
    downloadError?: string;
    hideEpisodeNumber?: boolean;
    prioritizeThumbnail?: boolean;
};


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
    downloadError,
    hideEpisodeNumber = false,
    prioritizeThumbnail = false,
}: EpisodeCardProps) {
    const cleanTitle = episode.title ? episode.title.split('<note-split>')[0].trim() : '';
    const displayTitle = cleanTitle || `Episode ${episode.episodeNumber}`;
    const thumbnail = episode.thumbnail || episode.snapshot || fallbackCoverImage;
    const epNum = getPlaybackEpisodeNumber(episode) || Number(episode.episodeNumber || 1);

    return (
        <div
            key={episode.session || episode.episodeNumber}
            onClick={() => {
                onEpisodeClick(episode);
            }}
            className={`yorumi-episode-card relative flex items-stretch text-left bg-transparent md:bg-[#141414] rounded-none md:rounded-lg overflow-hidden transition-all duration-200 group h-[116px] md:h-[104px]
                ${isActive ? 'ring-1 ring-blue-400 bg-[#1a1a1a]' : isWatched ? 'bg-green-500/5 hover:bg-green-500/10' : 'hover:bg-[#1a1a1a]'}
                hover:scale-[1.02] cursor-pointer`}
            title={displayTitle}
        >
            <div className="yorumi-episode-thumbnail ml-3 w-[38%] max-w-28 aspect-[4/3] self-center shrink-0 relative bg-[#0a0a0a] rounded-xl overflow-hidden">
                <EpisodeThumbnail key={`${thumbnail || ''}:${fallbackCoverImage || ''}`} src={thumbnail} fallback={fallbackCoverImage} label={`E${episode.episodeNumber}`} priority={prioritizeThumbnail} />
                {isActive ? (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[1px]">
                        <div className="flex items-center gap-1.5 text-white font-bold text-xs tracking-wider">
                            <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                            PLAYING
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
                        <span className={`font-bold text-[15px] md:text-xs md:uppercase md:tracking-wider truncate ${isWatched ? 'text-green-500' : 'text-white md:text-blue-300'}`}>{hideEpisodeNumber ? '' : `${episode.episodeNumber}. `}{displayTitle}</span>
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
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
                                    downloadError
                                        ? 'text-red-400 bg-red-500/10'
                                        : isDownloaded
                                        ? 'text-zinc-400 hover:bg-red-500/20 hover:text-red-400'
                                        : isDownloading || isResolvingDownload
                                        ? 'text-gray-400 hover:bg-white/10'
                                        : 'text-gray-400 hover:text-white hover:bg-white/10 opacity-70 group-hover:opacity-100'
                                }`}
                                title={
                                    downloadError
                                        ? downloadError
                                        : isDownloaded
                                        ? 'Downloaded for offline (Click to delete)'
                                        : isDownloading
                                        ? `Downloading ${downloadProgress}%`
                                        : isResolvingDownload
                                        ? 'Resolving stream...'
                                        : 'Download episode'
                                }
                            >
                                {downloadError ? (
                                    <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                                ) : isResolvingDownload ? (
                                    <DownloadStateIcon state="downloading" progress={1} className="h-[26px] w-[26px]" />
                                ) : isDownloading ? (
                                    <DownloadStateIcon
                                        state="downloading"
                                        progress={Math.max(1, downloadProgress)}
                                        className="h-[26px] w-[26px]"
                                    />
                                ) : isDownloaded ? (
                                    <DownloadStateIcon state="downloaded" className="h-[26px] w-[26px]" />
                                ) : (
                                    <DownloadStateIcon state="available" className="h-[26px] w-[26px]" />
                                )}
                            </button>
                        </div>
                    </div>
                    {episode.overview && <p className="mt-1 text-[13px] leading-[1.35] text-zinc-500 line-clamp-2 md:text-xs md:leading-snug">{episode.overview}</p>}
                </div>
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
    const [downloadErrors, setDownloadErrors] = useState<Map<number, string>>(new Map());
    const [descending, setDescending] = useState(false);
    const [mobileGrid, setMobileGrid] = useState(false);
    const isElectron = typeof window !== 'undefined' && Boolean(window.electronAPI?.openDownloadsFolder);

    const handleDownloadEpisode = useCallback(
        async (ep: NormalizedEpisode) => {
            const epNum = getPlaybackEpisodeNumber(ep) || Number(ep.episodeNumber || 1);
            if (!animeId || !epNum) return;

            setDownloadErrors((prev) => {
                const next = new Map(prev);
                next.delete(epNum);
                return next;
            });
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

                // `url` is the backend/native proxy URL carrying the source's
                // referer and cookie context. The raw directUrl commonly
                // returns 403 when fetched by the downloader (for example,
                // HiAnime/Frieren CDN streams), even though playback works.
                const streamDownloadUrl = String(bestStream.url || bestStream.directUrl || '');

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
                const message = err instanceof Error ? err.message : 'Download failed';
                setDownloadErrors((prev) => new Map(prev).set(epNum, message));
                window.setTimeout(() => {
                    setDownloadErrors((prev) => {
                        if (prev.get(epNum) !== message) return prev;
                        const next = new Map(prev);
                        next.delete(epNum);
                        return next;
                    });
                }, 10_000);
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

    const releasedEpisodes = useMemo(
        () => filterReleasedEpisodes(episodes),
        [episodes]
    );

    const handleDownloadAll = useCallback(async () => {
        const episodesToDownload = releasedEpisodes.filter((ep) => {
            const epNum = getPlaybackEpisodeNumber(ep) || Number(ep.episodeNumber || 1);
            const activeNumbers = getDownloadEpisodeNumbers(ep);
            const downloaded = isEpisodeDownloaded(animeId, epNum, animeTitle, anilistId, activeNumbers);
            const progress = getDownloadProgress(animeId, epNum, anilistId, activeNumbers, animeTitle);
            const isDownloading = progress?.status === 'queued' || progress?.status === 'downloading' || progress?.status === 'paused' || progress?.status === 'saving';
            const isResolving = resolvingEpisodes.has(epNum);
            return !downloaded && !isDownloading && !isResolving;
        });

        if (episodesToDownload.length === 0) return;

        // Mark all episodes as resolving immediately so all cards reflect loading state simultaneously
        const epNums = episodesToDownload
            .map((ep) => getPlaybackEpisodeNumber(ep) || Number(ep.episodeNumber || 1))
            .filter(Boolean);

        setResolvingEpisodes((prev) => {
            const next = new Set(prev);
            epNums.forEach((n) => next.add(n));
            return next;
        });

        // Stream resolution and HLS downloads share a scraper/proxy. Keep the
        // queue bounded instead of starting an entire season at once.
        const concurrency = 2;
        for (let i = 0; i < episodesToDownload.length; i += concurrency) {
            await Promise.allSettled(
                episodesToDownload.slice(i, i + concurrency).map((ep) => handleDownloadEpisode(ep))
            );
        }
    }, [
        releasedEpisodes,
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
        () => descending ? [...releasedEpisodes].reverse() : releasedEpisodes,
        [descending, releasedEpisodes]
    );
    return (
        <div className="pt-2 mt-2 md:mt-0">
            {!isMovie && <div className="flex flex-wrap items-center justify-between gap-3 mb-4 md:mb-6">
                <div className="flex items-center gap-4 flex-1">
                    <h3 className="text-[22px] md:text-xl font-semibold md:font-black text-white md:uppercase md:tracking-wider whitespace-nowrap">
                        Episodes {releasedEpisodes.length > 0 && <span className="text-sm font-bold text-gray-500">({releasedEpisodes.length})</span>}
                    </h3>
                    <div className="flex-1 h-px bg-white/10" />
                </div>
                {releasedEpisodes.length > 0 && (
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
                        <ChapterViewToggle viewMode={mobileGrid ? 'grid' : 'list'} onViewModeChange={(mode) => setMobileGrid(mode === 'grid')} activeClassName="text-blue-400" />
                        {isElectron && (
                            <button
                                type="button"
                                onClick={handleOpenFolder}
                                className="grid h-10 w-10 place-items-center text-gray-400 transition-colors hover:text-blue-400"
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

            {hasSeasonNavigation(seasonChips) && (
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
                            {getCompactSeasonLabel(season, animeTitle)}
                        </button>
                    ))}
                </div>
            )}

            <div>
                <div className={`grid ${mobileGrid ? 'grid-cols-5 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10' : 'grid-cols-1 gap-1 sm:grid-cols-2 md:grid-cols-3 md:gap-4 lg:grid-cols-4'}`}>
                    {isLoading ? (
                        Array.from({ length: skeletonCount }).map((_, index) => <EpisodeCardSkeleton key={`episode-skeleton-${index}`} />)
                    ) : releasedEpisodes.length > 0 ? (
                        displayedEpisodes.map((ep, index) => {
                            const epNum = getPlaybackEpisodeNumber(ep) || Number(ep.episodeNumber || 1);
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
                                getDownloadEpisodeNumbers(ep)
                            );
                            const progressInfo = getDownloadProgress(
                                animeId,
                                epNum,
                                anilistId,
                                getDownloadEpisodeNumbers(ep),
                                animeTitle
                            );
                            const isDownloading = progressInfo?.status === 'queued' || progressInfo?.status === 'downloading' || progressInfo?.status === 'paused' || progressInfo?.status === 'saving';
                            const downloadError = downloadErrors.get(epNum)
                                || (progressInfo?.status === 'error' ? progressInfo.error || 'Download failed' : undefined);
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
                                    downloadError={downloadError}
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

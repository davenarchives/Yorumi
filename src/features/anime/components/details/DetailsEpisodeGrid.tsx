import { memo, useState, useCallback } from 'react';
import { CircleCheckBig, Download, Loader2, FolderOpen } from 'lucide-react';
import type { Episode, Anime } from '../../../../types/anime';
import type { StreamLink } from '../../../../types/stream';
import { getEpisodeWatchKey, getPlaybackEpisodeNumber } from '../../../../utils/episodeWatchKey';
import { useDownloads } from '../../../../hooks/useDownloads';
import { downloadService } from '../../../../services/downloadService';
import { getStreamData } from '../../../../utils/streamUtils';

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

function EpisodeThumbnail({ src, label }: { src?: string; label: string }) {
    const [failed, setFailed] = useState(false);

    if (!src || failed) {
        return (
            <div className="w-full h-full flex items-center justify-center text-gray-700 font-bold text-lg">
                {label}
            </div>
        );
    }

    return (
        <img
            src={src}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setFailed(true)}
        />
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
}: EpisodeCardProps) {
    const cleanTitle = episode.title ? episode.title.split('<note-split>')[0].trim() : '';
    const displayTitle = cleanTitle || `Episode ${episode.episodeNumber}`;
    const isUnreleased = isEpisodeUnreleased(episode.airDate);
    const thumbnail = isUnreleased ? fallbackCoverImage : (episode.thumbnail || episode.snapshot);
    const epNum = getPlaybackEpisodeNumber(episode) || Number(episode.episodeNumber || 1);

    return (
        <div
            key={episode.session || episode.episodeNumber}
            onClick={() => {
                if (!isUnreleased) onEpisodeClick(episode);
            }}
            className={`relative flex items-stretch text-left bg-[#141414] rounded-lg overflow-hidden transition-all duration-200 group h-[104px]
                ${isActive ? 'ring-1 ring-blue-400 bg-[#1a1a1a]' : isWatched ? 'ring-1 ring-green-500/30 bg-green-500/5 hover:bg-green-500/10' : 'hover:bg-[#1a1a1a]'}
                ${isUnreleased ? 'opacity-60 cursor-not-allowed' : 'hover:scale-[1.02] cursor-pointer'}`}
            title={displayTitle}
        >
            <div className="w-28 sm:w-32 aspect-video shrink-0 relative bg-[#0a0a0a]">
                <EpisodeThumbnail src={thumbnail} label={`E${episode.episodeNumber}`} />
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
            <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                <div>
                    <div className="flex justify-between items-center w-full">
                        <span className={`font-black text-xs uppercase tracking-wider ${isWatched ? 'text-green-500' : 'text-blue-300'}`}>E{episode.episodeNumber}</span>
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
                    <span className={`font-semibold text-sm line-clamp-2 mt-0.5 leading-snug ${isWatched ? 'text-green-50' : 'text-white'}`}>{isUnreleased ? 'Unreleased' : displayTitle}</span>
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
}: DetailsEpisodeGridProps) {
    const { isEpisodeDownloaded, getDownloadProgress, startDownload, deleteDownload } = useDownloads();
    const [resolvingEpisodes, setResolvingEpisodes] = useState<Set<number>>(new Set());
    const isElectron = typeof window !== 'undefined' && Boolean(window.electronAPI?.openDownloadsFolder);

    const handleDownloadEpisode = useCallback(
        async (ep: NormalizedEpisode) => {
            const epNum = getPlaybackEpisodeNumber(ep) || Number(ep.episodeNumber || 1);
            if (!animeId || !epNum) return;

            setResolvingEpisodes((prev) => new Set(prev).add(epNum));
            try {
                // Try resolving stream across providers: anidb -> auto -> videasy -> vidsrc -> vidking
                const providers = ['anidb', 'auto', 'videasy', 'vidsrc', 'vidking'];
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
            return !isUnreleased && !isEpisodeDownloaded(
                animeId,
                epNum,
                animeTitle,
                anilistId,
                [ep.episodeNumber, ep.playbackEpisodeNumber, ep._tmdbAbsolute]
            );
        });

        for (const ep of releasedEpisodes) {
            await handleDownloadEpisode(ep);
        }
    }, [episodes, animeId, animeTitle, anilistId, isEpisodeDownloaded, handleDownloadEpisode]);

    const handleOpenFolder = useCallback(() => {
        downloadService.openDownloadsFolder();
    }, []);

    return (
        <div className="pt-2">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4 flex-1">
                    <h3 className="text-xl font-black text-white uppercase tracking-wider whitespace-nowrap">
                        Episodes {episodes.length > 0 && <span className="text-sm font-bold text-gray-500">({episodes.length})</span>}
                    </h3>
                    <div className="flex-1 h-px bg-white/10" />
                </div>
                {episodes.length > 0 && (
                    <div className="flex items-center gap-2">
                        {isElectron && (
                            <button
                                type="button"
                                onClick={handleOpenFolder}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-300 hover:text-white transition-colors border border-white/5"
                                title="Open downloaded files on your computer"
                            >
                                <FolderOpen className="w-3.5 h-3.5 text-yorumi-accent" />
                                <span>Downloads Folder</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handleDownloadAll}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-300 hover:text-white transition-colors border border-white/5"
                            title="Download all released episodes"
                        >
                            <Download className="w-3.5 h-3.5 text-blue-400" />
                            <span>Download All</span>
                        </button>
                    </div>
                )}
            </div>

            {seasonChips.length > 1 && (
                <div className="mb-6 flex flex-wrap items-center gap-3">
                    {seasonChips.map((season) => (
                        <button
                            key={season.id}
                            type="button"
                            onClick={() => onSeasonClick?.(season)}
                            disabled={season.isActive}
                            title={season.title}
                            aria-current={season.isActive ? 'page' : undefined}
                            className={`min-h-10 rounded-full border px-5 text-sm font-bold transition-all ${
                                season.isActive
                                    ? 'border-blue-400 bg-blue-600 text-white'
                                    : 'border-white/10 bg-white/[0.07] text-gray-300 hover:border-white/25 hover:bg-white/[0.11] hover:text-white'
                            } disabled:cursor-default`}
                        >
                            {season.label}
                        </button>
                    ))}
                </div>
            )}

            <div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {isLoading ? (
                        Array.from({ length: skeletonCount }).map((_, index) => <EpisodeCardSkeleton key={`episode-skeleton-${index}`} />)
                    ) : episodes.length > 0 ? (
                        episodes.map((ep) => {
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

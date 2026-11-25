import { memo, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { AlertCircle, ArrowUpDown, Check, ChevronDown, Download, FolderOpen, Play } from 'lucide-react';
import type { Episode, Anime } from '../../../../types/anime';
import type { StreamLink } from '../../../../types/stream';
import { getPreferredStreamServer, STREAM_SERVER_OPTIONS } from '../../../../hooks/useStreams';
import { getDownloadEpisodeNumbers, getEpisodeWatchKey, getPlaybackEpisodeNumber } from '../../../../utils/episodeWatchKey';
import { useDownloads } from '../../../../hooks/useDownloads';
import { downloadService } from '../../../../services/downloadService';
import { getCachedImage } from '../../../../services/offlineImageCache';
import { getStreamData } from '../../../../utils/streamUtils';
import { filterReleasedEpisodes } from '../../../../utils/animeAiring';
import type { AnimeEpisodeSegment } from '../../../../utils/animeEpisodeMapping';
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

const formatEpisodeAirDate = (airDate?: string | null): string | null => {
    if (!airDate) return null;
    const parsed = new Date(airDate);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
};

const formatEpisodeDuration = (epDuration?: string, animeDuration?: string, isMovie?: boolean): string => {
    const raw = epDuration || animeDuration || '';
    const match = raw.match(/(\d+)\s*(?:min|m\b)/i) || raw.match(/^(\d+)$/);
    if (match) {
        return `${match[1]} min`;
    }
    return isMovie ? '110 min' : '24 min';
};

function EpisodeThumbnail({ src, fallback, priority = false }: { src?: string; fallback?: string; priority?: boolean }) {
    const [failed, setFailed] = useState(false);
    const [useFallback, setUseFallback] = useState(false);
    const [loaded, setLoaded] = useState(false);

    const [cachedSrc, setCachedSrc] = useState<string | null>(null);
    const displaySrc = cachedSrc || (useFallback ? fallback : (src || fallback));

    useEffect(() => {
        setCachedSrc(null);
    }, [src, fallback]);

    if (!displaySrc || failed) {
        return <div className="h-full w-full bg-[#0d0d0d]" />;
    }

    const showSeparateFallback = Boolean(fallback && !cachedSrc && displaySrc !== fallback);

    return (
        <div className="relative h-full w-full bg-[#0d0d0d]">
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
                    if (!cachedSrc && displaySrc) {
                        void getCachedImage(displaySrc).then(async (hit) => {
                            if (hit && hit !== displaySrc) {
                                setCachedSrc(hit);
                                return;
                            }
                            if (fallback && fallback !== displaySrc) {
                                const fallbackHit = await getCachedImage(fallback);
                                if (fallbackHit) {
                                    setCachedSrc(fallbackHit);
                                    return;
                                }
                                if (!useFallback) {
                                    setUseFallback(true);
                                    return;
                                }
                            }
                            setFailed(true);
                        });
                    } else if (!useFallback && fallback && displaySrc !== fallback) {
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
    animeDuration?: string;
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
    isHighlighted: boolean;
    fallbackCoverImage?: string;
    animeDuration?: string;
    onEpisodeClick: (ep: NormalizedEpisode) => void;
    onDownload: (ep: NormalizedEpisode) => void;
    onDeleteDownload: (epNum: number) => void;
    isDownloaded: boolean;
    downloadProgress?: number;
    isDownloading: boolean;
    isResolvingDownload: boolean;
    downloadError?: string;
    hideEpisodeNumber?: boolean;
    isMovie?: boolean;
    prioritizeThumbnail?: boolean;
};

const EpisodeCard = memo(function EpisodeCard({
    episode,
    isWatched,
    isActive,
    isHighlighted,
    fallbackCoverImage,
    animeDuration,
    onEpisodeClick,
    onDownload,
    onDeleteDownload,
    isDownloaded,
    downloadProgress = 0,
    isDownloading,
    isResolvingDownload,
    downloadError,
    hideEpisodeNumber = false,
    isMovie = false,
    prioritizeThumbnail = false,
}: EpisodeCardProps) {
    const cleanTitle = episode.title ? episode.title.split('<note-split>')[0].trim() : '';
    const displayTitle = cleanTitle || `Episode ${episode.episodeNumber}`;
    const thumbnail = episode.thumbnail || episode.snapshot || fallbackCoverImage;
    const epNum = getPlaybackEpisodeNumber(episode) || Number(episode.episodeNumber || 1);
    const formattedDate = formatEpisodeAirDate(episode.airDate);
    const formattedDuration = formatEpisodeDuration(episode.duration, animeDuration, isMovie);

    return (
        <div
            key={episode.session || episode.episodeNumber}
            onClick={() => onEpisodeClick(episode)}
            className="yorumi-episode-card group relative flex flex-row items-start gap-3 text-left cursor-pointer select-none sm:flex-col sm:gap-0"
            title={displayTitle}
        >
            {/* 16:9 Landscape Thumbnail Box */}
            <div
                className={`relative aspect-video w-[42%] shrink-0 sm:w-full overflow-hidden rounded-[10px] sm:rounded-[14px] bg-[#0d0d0d] transition-transform duration-200 group-hover:scale-[1.015] ${
                    isHighlighted ? 'ring-2 ring-white' : ''
                }`}
            >
                <EpisodeThumbnail
                    key={`${thumbnail || ''}:${fallbackCoverImage || ''}`}
                    src={thumbnail}
                    fallback={fallbackCoverImage}
                    priority={prioritizeThumbnail}
                />

                {/* Top-Left Episode Number Pill */}
                {!hideEpisodeNumber && (
                    <div className="pointer-events-none absolute top-2.5 left-2.5 z-10 inline-flex h-[24px] min-w-[26px] items-center justify-center rounded-full bg-black/75 px-2 text-[12px] font-extrabold leading-none text-white">
                        {episode.episodeNumber}
                    </div>
                )}

                {/* Top-Right Watched & Desktop Download Controls */}
                <div
                    className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5"
                    onClick={(e) => e.stopPropagation()}
                >
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
                        className={`hidden sm:flex h-6 w-6 items-center justify-center bg-transparent transition-opacity border-0 outline-none focus:outline-none cursor-pointer ${
                            downloadError
                                ? 'text-red-400 opacity-100'
                                : isDownloaded || isDownloading || isResolvingDownload
                                ? 'text-white opacity-100'
                                : 'text-white/90 opacity-0 group-hover:opacity-100 hover:text-white'
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
                            <AlertCircle className="h-6 w-6 text-red-400" />
                        ) : isResolvingDownload ? (
                            <DownloadStateIcon state="downloading" progress={1} className="h-6 w-6" />
                        ) : isDownloading ? (
                            <DownloadStateIcon state="downloading" progress={Math.max(1, downloadProgress)} className="h-6 w-6" />
                        ) : isDownloaded ? (
                            <DownloadStateIcon state="downloaded" className="h-6 w-6" />
                        ) : (
                            <DownloadStateIcon state="available" className="h-6 w-6" />
                        )}
                    </button>

                    {/* Top-Right Watched Circle (shown on thumbnail for both mobile & desktop) */}
                    <div
                        className={`pointer-events-none flex h-6 w-6 items-center justify-center rounded-full transition-colors ${
                            isWatched
                                ? 'bg-emerald-500 text-black'
                                : 'bg-black/65 text-transparent'
                        }`}
                    >
                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                    </div>
                </div>

                {/* Playing / Hover Overlay */}
                {isActive ? (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/55">
                        <div className="flex items-center gap-1.5 text-xs font-extrabold tracking-wider text-white">
                            <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                            Now Playing
                        </div>
                    </div>
                ) : (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/70 text-white">
                            <svg className="h-5 w-5 fill-current translate-x-0.5" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                            </svg>
                        </div>
                    </div>
                )}
            </div>

            {/* Episode Title + Air Date & Duration */}
            <div className="min-w-0 flex-1 sm:mt-2.5 flex flex-col">
                <h4
                    className={`line-clamp-2 pr-8 sm:pr-0 text-[15px] font-extrabold leading-[1.3] transition-colors ${
                        isWatched ? 'text-white/70' : 'text-white group-hover:text-white/90'
                    }`}
                >
                    {displayTitle}
                </h4>
                <div className="mt-1 flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap text-[12px] sm:text-[13px] font-semibold text-white/50">
                    {formattedDate && <span className="shrink-0">{formattedDate}</span>}
                    <span className="shrink-0">{formattedDuration}</span>
                </div>
            </div>
            {/* Mobile Right-Side Download Button */}
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
                className={`absolute right-0 top-0 z-10 flex h-8 w-8 items-center justify-center rounded-full sm:hidden bg-transparent border-0 outline-none focus:outline-none active:scale-90 transition-transform ${
                    downloadError
                        ? 'text-red-400'
                        : isDownloaded || isDownloading || isResolvingDownload
                        ? 'text-white'
                        : 'text-white/80'
                }`}
                aria-label={
                    downloadError
                        ? downloadError
                        : isDownloaded
                        ? 'Downloaded for offline (Tap to delete)'
                        : isDownloading
                        ? `Downloading ${downloadProgress}%`
                        : isResolvingDownload
                        ? 'Resolving stream...'
                        : 'Download episode'
                }
            >
                {downloadError ? (
                    <AlertCircle className="h-5 w-5 text-red-400" />
                ) : isResolvingDownload ? (
                    <DownloadStateIcon state="downloading" progress={1} className="h-5 w-5" />
                ) : isDownloading ? (
                    <DownloadStateIcon state="downloading" progress={Math.max(1, downloadProgress)} className="h-5 w-5" />
                ) : isDownloaded ? (
                    <DownloadStateIcon state="downloaded" className="h-5 w-5" />
                ) : (
                    <DownloadStateIcon state="available" className="h-5 w-5" />
                )}
            </button>
        </div>
    );
});

const EpisodeCardSkeleton = () => (
    <div className="flex flex-col animate-pulse">
        <div className="aspect-video w-full rounded-[14px] bg-white/[0.06]" />
        <div className="mt-2.5 h-4 w-3/4 rounded bg-white/[0.08]" />
        <div className="mt-1.5 h-3.5 w-1/2 rounded bg-white/[0.05]" />
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
    animeDuration,
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
    const [episodeSearch, setEpisodeSearch] = useState('');
    const [seasonMenuOpen, setSeasonMenuOpen] = useState(false);
    const seasonMenuRef = useRef<HTMLDivElement | null>(null);
    const isDesktopApp = typeof window !== 'undefined' && Boolean('__TAURI_INTERNALS__' in window);

    useEffect(() => {
        if (!seasonMenuOpen) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (seasonMenuRef.current && !seasonMenuRef.current.contains(event.target as Node)) {
                setSeasonMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [seasonMenuOpen]);

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
                const preferredProvider = getPreferredStreamServer();
                const providers = [
                    preferredProvider,
                    ...STREAM_SERVER_OPTIONS.map(({ key }) => key).filter((key) => key !== preferredProvider),
                ];

                const pickBestDownloadCandidate = (streams: StreamLink[]): StreamLink | undefined => {
                    const playable = streams.filter((s) => (s.directUrl || s.url) && !s.isEmbed);
                    const downloadable = playable.filter(
                        (s) => s.isHls || Boolean(s.url && (s.url.includes('.m3u8') || s.url.includes('.mp4') || s.url.includes('/api/scraper/proxy')))
                    );
                    // Prefer the first downloadable stream with subtitles when available
                    return (
                        downloadable.find((s) => s.subtitles && s.subtitles.length > 0)
                        || downloadable[0]
                        || playable.find((s) => s.subtitles && s.subtitles.length > 0)
                        || playable[0]
                        || streams.find((s) => s.directUrl || s.url)
                    );
                };

                // Race all servers in parallel: immediately pick the first server that returns soft subtitles,
                // or give sibling servers a short 2.5s window if the first responder has no subtitles.
                const bestStream = await new Promise<StreamLink | undefined>((resolve) => {
                    let settled = false;
                    let remaining = providers.length;
                    let fallbackCandidate: StreamLink | undefined;
                    let subWaitTimer: number | null = null;
                    const finish = (choice: StreamLink | undefined) => {
                        if (settled) return;
                        settled = true;
                        if (subWaitTimer !== null) window.clearTimeout(subWaitTimer);
                        resolve(choice);
                    };
                    if (remaining === 0) {
                        finish(undefined);
                        return;
                    }
                    providers.forEach((provider) => {
                        void getStreamData(ep, scraperSession || animeTitle, {
                            title: animeTitle,
                            anilistId,
                            provider,
                        })
                            .then((streams) => {
                                const candidate = pickBestDownloadCandidate(streams || []);
                                if (!settled && (candidate?.url || candidate?.directUrl)) {
                                    if (candidate.subtitles && candidate.subtitles.length > 0) {
                                        finish(candidate);
                                        return;
                                    }
                                    if (!fallbackCandidate) {
                                        fallbackCandidate = candidate;
                                        subWaitTimer = window.setTimeout(() => {
                                            finish(fallbackCandidate);
                                        }, 2500);
                                    }
                                }
                                remaining -= 1;
                                if (!settled && remaining <= 0) {
                                    finish(fallbackCandidate);
                                }
                            })
                            .catch(() => {
                                remaining -= 1;
                                if (!settled && remaining <= 0) {
                                    finish(fallbackCandidate);
                                }
                            });
                    });
                });

                if (!bestStream?.url && !bestStream?.directUrl) {
                    throw new Error('No downloadable stream source found for this episode');
                }

                // Persist episode thumbnail & title for offline viewing
                downloadService.saveOfflineEpisodeThumbnail(animeId, animeTitle || 'Anime', epNum, {
                    title: ep.title,
                    thumbnail: ep.thumbnail || ep.snapshot || fallbackCoverImage,
                    overview: ep.overview,
                    airDate: ep.airDate || undefined,
                });

                const streamDownloadUrl = String(bestStream.directUrl || bestStream.url || '');

                await startDownload({
                    animeId,
                    animeTitle: animeTitle || 'Anime',
                    animeImage: animeImage || fallbackCoverImage || '',
                    episodeNumber: epNum,
                    episodeTitle: ep.title,
                    streamUrl: streamDownloadUrl,
                    referer: bestStream.referer,
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

    const watchedCount = useMemo(() => {
        return releasedEpisodes.reduce((acc, ep) => {
            const key = getEpisodeWatchKey(ep);
            return watchedEpisodes.has(key) ? acc + 1 : acc;
        }, 0);
    }, [releasedEpisodes, watchedEpisodes]);

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

        const epNums = episodesToDownload
            .map((ep) => getPlaybackEpisodeNumber(ep) || Number(ep.episodeNumber || 1))
            .filter(Boolean);

        setResolvingEpisodes((prev) => {
            const next = new Set(prev);
            epNums.forEach((n) => next.add(n));
            return next;
        });

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

    const displayedEpisodes = useMemo(() => {
        const ordered = descending ? [...releasedEpisodes].reverse() : releasedEpisodes;
        const query = episodeSearch.trim().toLowerCase();
        if (!query) return ordered;
        return ordered.filter((ep) => {
            const epNum = String(ep.episodeNumber || '');
            const title = String(ep.title || '').toLowerCase();
            return epNum.includes(query) || title.includes(query);
        });
    }, [descending, episodeSearch, releasedEpisodes]);

    const activeSeasonChip = useMemo(
        () => seasonChips.find((chip) => chip.isActive) || seasonChips[0] || null,
        [seasonChips]
    );
    const compactSeasonLabel = activeSeasonChip ? getCompactSeasonLabel(activeSeasonChip, animeTitle) : '';
    const activeSeasonLabel = seasonChips.length <= 1 && !/\b(?:season|cour|part)\s*\d+\b/i.test(compactSeasonLabel)
        ? `Season ${activeSeasonChip?.tmdbSeasonNumber || 1}`
        : compactSeasonLabel || 'Season 1';

    return (
        <div className="pt-1">
            {/* Episode Toolbar: Season Dropdown + Search Episodes + Oldest/Newest Sort + Watched Count */}
            {!isMovie && (
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex w-full flex-wrap items-center gap-2.5 sm:w-auto">
                        {/* Season Dropdown Pill */}
                        <div ref={seasonMenuRef} className="relative w-full sm:w-auto">
                            {seasonChips.length > 1 ? <button
                                type="button"
                                onClick={() => setSeasonMenuOpen((prev) => !prev)}
                                className={`flex h-10 w-full sm:w-auto items-center justify-between gap-2 rounded-full bg-white/[0.10] px-4 text-[14px] font-bold text-white transition-colors border-0 outline-none focus:outline-none ${
                                    seasonChips.length > 1 ? 'hover:bg-white/[0.15] cursor-pointer' : 'cursor-default'
                                }`}
                            >
                                <span className="max-w-[180px] truncate">{activeSeasonLabel}</span>
                                <ChevronDown
                                    className={`h-4 w-4 text-white/75 transition-transform duration-200 ${
                                        seasonMenuOpen ? 'rotate-180' : ''
                                    }`}
                                />
                            </button> : (
                                <span className="flex h-10 items-center px-4 text-[14px] font-bold text-white">
                                    {activeSeasonLabel}
                                </span>
                            )}

                            {seasonMenuOpen && seasonChips.length > 1 && (
                                <div className="absolute left-0 top-full z-30 mt-2 max-h-72 min-w-[200px] overflow-y-auto rounded-2xl bg-[#161616] p-1.5 shadow-2xl">
                                    {seasonChips.map((season) => (
                                        <button
                                            key={season.id}
                                            type="button"
                                            onClick={() => {
                                                setSeasonMenuOpen(false);
                                                onSeasonClick?.(season);
                                            }}
                                            className={`flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-left text-[13.5px] font-bold transition-colors border-0 outline-none focus:outline-none cursor-pointer ${
                                                season.isActive
                                                    ? 'bg-white/[0.14] text-white'
                                                    : 'text-white/75 hover:bg-white/[0.08] hover:text-white'
                                            }`}
                                        >
                                            <span className="truncate">{getCompactSeasonLabel(season, animeTitle)}</span>
                                            {season.isActive && <Check className="h-4 w-4 shrink-0 text-white" />}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Search Episodes Pill Input */}
                        <input
                            type="text"
                            value={episodeSearch}
                            onChange={(e) => setEpisodeSearch(e.target.value)}
                            placeholder="Search episodes"
                            className="h-10 min-w-0 flex-1 sm:flex-none sm:w-60 md:w-64 rounded-full bg-white/[0.10] px-4 text-[14px] font-semibold text-white placeholder-white/50 transition-colors focus:bg-white/[0.15] border-0 outline-none focus:outline-none"
                        />

                        {/* Sort Oldest / Newest Pill */}
                        <button
                            type="button"
                            onClick={() => setDescending((value) => !value)}
                            className="flex h-10 items-center gap-1.5 rounded-full bg-white/[0.10] px-4 text-[14px] font-bold text-white transition-colors hover:bg-white/[0.15] border-0 outline-none focus:outline-none cursor-pointer"
                            title={descending ? 'Sorted newest first' : 'Sorted oldest first'}
                        >
                            <ArrowUpDown className="h-3.5 w-3.5 text-white/80" />
                            <span>{descending ? 'Newest' : 'Oldest'}</span>
                        </button>

                        {/* Download All & Desktop Folder Actions */}
                        {releasedEpisodes.length > 0 && (
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleDownloadAll}
                                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.10] text-white/80 transition-colors hover:bg-white/[0.15] hover:text-white border-0 outline-none focus:outline-none cursor-pointer"
                                    title="Download all released episodes"
                                    aria-label="Download all released episodes"
                                >
                                    <Download className="h-4 w-4" />
                                </button>
                                {isDesktopApp && (
                                    <button
                                        type="button"
                                        onClick={handleOpenFolder}
                                        className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.10] text-white/80 transition-colors hover:bg-white/[0.15] hover:text-white border-0 outline-none focus:outline-none cursor-pointer"
                                        title="Open downloads folder"
                                        aria-label="Open downloads folder"
                                    >
                                        <FolderOpen className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right Watched Counter */}
                    {releasedEpisodes.length > 0 && (
                        <div className="text-[14px] font-bold text-white/75">
                            {watchedCount}/{releasedEpisodes.length} watched
                        </div>
                    )}
                </div>
            )}

            {/* Episode Cards Grid */}
            <div>
                <div
                    className={`grid ${
                        mobileGrid
                            ? 'grid-cols-5 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10'
                            : 'grid-cols-1 gap-x-5 gap-y-4 sm:gap-y-7 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
                    }`}
                >
                    {isLoading ? (
                        Array.from({ length: skeletonCount }).map((_, index) => (
                            <EpisodeCardSkeleton key={`episode-skeleton-${index}`} />
                        ))
                    ) : displayedEpisodes.length > 0 ? (
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
                            const isHighlighted = isActive || (!activeEpParam && index === 0);

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
                            const isDownloading =
                                progressInfo?.status === 'queued' ||
                                progressInfo?.status === 'downloading' ||
                                progressInfo?.status === 'paused' ||
                                progressInfo?.status === 'saving';
                            const downloadError =
                                downloadErrors.get(epNum) ||
                                (progressInfo?.status === 'error' ? progressInfo.error || 'Download failed' : undefined);
                            const isResolving = resolvingEpisodes.has(epNum) && !isDownloading && !isDownloaded;

                            if (mobileGrid) {
                                return (
                                    <button
                                        key={`${ep.tmdbSeason || 'ep'}-${ep.tmdbEpisode || ep.episodeNumber}-${ep.playbackEpisodeNumber || ''}`}
                                        type="button"
                                        onClick={() => onEpisodeClick(ep)}
                                        className={`aspect-square rounded-lg text-sm font-bold transition-colors active:scale-95 border-0 outline-none focus:outline-none ${
                                            isActive
                                                ? 'bg-white text-black'
                                                : isWatched
                                                ? 'bg-emerald-500/20 text-emerald-300'
                                                : 'bg-[#1a1a1a] text-gray-200'
                                        }`}
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
                                    isHighlighted={isHighlighted}
                                    fallbackCoverImage={fallbackCoverImage}
                                    animeDuration={animeDuration}
                                    onEpisodeClick={onEpisodeClick}
                                    onDownload={handleDownloadEpisode}
                                    onDeleteDownload={(num) => deleteDownload(animeId, num)}
                                    isDownloaded={isDownloaded}
                                    downloadProgress={progressInfo?.progress || 0}
                                    isDownloading={isDownloading}
                                    isResolvingDownload={isResolving}
                                    downloadError={downloadError}
                                    hideEpisodeNumber={isMovie}
                                    isMovie={isMovie}
                                    prioritizeThumbnail={index < 12}
                                />
                            );
                        })
                    ) : (
                        <div className="col-span-full py-8 text-center text-sm font-semibold text-white/50">
                            No episodes found.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

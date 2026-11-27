import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import type { ExploreAnimeItem } from '../../../services/exploreService';
import { episodeMetadataService, type EpisodeMeta } from '../../../services/episodeMetadataService';
import { useContinueWatching } from '../../../hooks/useContinueWatching';
import { storage } from '../../../utils/storage';
import { isAnimeAiring, isAnimeReleased, isEpisodeUnreleased } from '../../../utils/animeAiring';
import type { Anime, Episode } from '../../../types/anime';

interface ExploreEpisodesDrawerProps {
    anime: ExploreAnimeItem | null;
    isOpen: boolean;
    onClose: () => void;
}

export default function ExploreEpisodesDrawer({ anime, isOpen, onClose }: ExploreEpisodesDrawerProps) {
    const navigate = useNavigate();
    const { saveProgress, continueWatchingList } = useContinueWatching();

    const [episodesMeta, setEpisodesMeta] = useState<Map<number, EpisodeMeta> | null>(null);
    const [loading, setLoading] = useState(false);
    const [displayLimit, setDisplayLimit] = useState(50);
    const [watchedEpisodeNumbers, setWatchedEpisodeNumbers] = useState<Set<number>>(() => new Set());
    const [dragY, setDragY] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const dragStartYRef = useRef<number | null>(null);
    const dragStartTimeRef = useRef<number>(0);

    // Match Android system navigation bar color and hide mobile navbar while open
    useEffect(() => {
        const nativeBridge = (window as unknown as {
            YorumiNative?: { setNavigationBarColor?: (hex: string) => void };
        }).YorumiNative;

        if (!isOpen || !anime) {
            setDragY(0);
            setIsDragging(false);
            document.documentElement.classList.remove('explore-episodes-open');
            document.body.classList.remove('explore-episodes-open');
            window.dispatchEvent(new CustomEvent('yorumi-explore-episodes-toggle', { detail: { open: false } }));
            nativeBridge?.setNavigationBarColor?.('#000000');
            return;
        }

        document.documentElement.classList.add('explore-episodes-open');
        document.body.classList.add('explore-episodes-open');
        window.dispatchEvent(new CustomEvent('yorumi-explore-episodes-toggle', { detail: { open: true } }));
        nativeBridge?.setNavigationBarColor?.('#121318');
        return () => {
            document.documentElement.classList.remove('explore-episodes-open');
            document.body.classList.remove('explore-episodes-open');
            window.dispatchEvent(new CustomEvent('yorumi-explore-episodes-toggle', { detail: { open: false } }));
            nativeBridge?.setNavigationBarColor?.('#000000');
        };
    }, [isOpen, anime]);

    const handleDragStart = (clientY: number) => {
        dragStartYRef.current = clientY;
        dragStartTimeRef.current = Date.now();
        setIsDragging(true);
    };

    const handleDragMove = (clientY: number) => {
        if (dragStartYRef.current === null) return;
        const delta = Math.max(0, clientY - dragStartYRef.current);
        setDragY(delta);
    };

    const handleDragEnd = () => {
        if (dragStartYRef.current === null) return;
        const elapsed = Math.max(1, Date.now() - dragStartTimeRef.current);
        const velocity = dragY / elapsed;
        dragStartYRef.current = null;
        setIsDragging(false);

        if (dragY > 110 || velocity > 0.55) {
            setDragY(0);
            onClose();
        } else {
            setDragY(0);
        }
    };

    const isUpcomingOrUnreleased = useMemo(() => {
        if (!anime) return true;
        const status = String(anime.status || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
        if (status === 'NOT_YET_RELEASED' || status === 'UPCOMING') return true;
        if (anime.seasonYear && anime.seasonYear > new Date().getFullYear()) return true;
        return !isAnimeReleased(anime as unknown as Parameters<typeof isAnimeReleased>[0]);
    }, [anime]);

    const totalEpisodes = useMemo(() => {
        if (!anime || isUpcomingOrUnreleased) return 0;

        const isAiring = isAnimeAiring(anime.status);
        if (isAiring) {
            // For currently airing series, cap by nextAiringEpisode if available
            const nextEp = anime.nextAiringEpisode?.episode;
            if (typeof nextEp === 'number' && nextEp > 1) {
                return nextEp - 1;
            }
            if (typeof nextEp === 'number' && nextEp === 1) {
                return 0;
            }
            // Or cap by latest released episode from metadata with confirmed release
            if (episodesMeta && episodesMeta.size > 0) {
                let maxReleased = 0;
                episodesMeta.forEach((meta, num) => {
                    if (!isEpisodeUnreleased(meta.airDate)) {
                        maxReleased = Math.max(maxReleased, num);
                    }
                });
                if (maxReleased > 0) return maxReleased;
            }
        }

        if (typeof anime.episodesCount === 'number' && anime.episodesCount > 0) {
            return anime.episodesCount;
        }
        if (episodesMeta && episodesMeta.size > 0) {
            return episodesMeta.size;
        }
        return 12;
    }, [anime, episodesMeta, isUpcomingOrUnreleased]);

    // Read watched episodes from storage for this anime
    const getWatchedEpisodeNumbers = useCallback((): Set<number> => {
        if (!anime) return new Set();
        const watchedNums = new Set<number>();
        const history = storage.getEpisodeHistory();
        const candidateIds = [
            String(anime.idMal || ''),
            String(anime.id || ''),
            `al-${anime.id}`,
        ].filter(Boolean);

        for (const id of candidateIds) {
            const list = history[id];
            if (Array.isArray(list)) {
                for (const item of list) {
                    const raw = String(item).trim();
                    const epMatch = raw.match(/(?:ep:|e|^)(\d+)$/i);
                    if (epMatch) {
                        const parsed = Number(epMatch[1]);
                        if (parsed > 0) watchedNums.add(parsed);
                    }
                }
            }
        }
        return watchedNums;
    }, [anime]);

    // Keep watched episodes synced with storage events
    useEffect(() => {
        setWatchedEpisodeNumbers(getWatchedEpisodeNumbers());
        const handleStorageUpdated = () => {
            setWatchedEpisodeNumbers(getWatchedEpisodeNumbers());
        };
        window.addEventListener('yorumi-storage-updated', handleStorageUpdated);
        return () => window.removeEventListener('yorumi-storage-updated', handleStorageUpdated);
    }, [getWatchedEpisodeNumbers]);

    // Find active progress from continue watching for this anime
    const continueItem = useMemo(() => {
        if (!anime) return null;
        return (
            continueWatchingList.find((item) => {
                if (item.anilistId && item.anilistId === anime.id) return true;
                if (item.malId && anime.idMal && item.malId === anime.idMal) return true;
                if (
                    item.animeId === String(anime.id) ||
                    item.animeId === String(anime.idMal) ||
                    item.animeId === `al-${anime.id}`
                ) {
                    return true;
                }
                return false;
            }) || null
        );
    }, [anime, continueWatchingList]);

    // Fetch episode metadata when focused anime changes
    useEffect(() => {
        if (!isOpen || !anime) {
            setEpisodesMeta(null);
            setDisplayLimit(50);
            return;
        }

        let isCancelled = false;
        setLoading(true);
        setDisplayLimit(50);

        const fetchMeta = async () => {
            try {
                const result = await episodeMetadataService.getEpisodeMetadata(anime.id, anime.idMal);
                if (!isCancelled && result?.episodes) {
                    setEpisodesMeta(result.episodes);
                }
            } catch (err) {
                console.warn('[ExploreEpisodesDrawer] Failed to load episode meta:', err);
            } finally {
                if (!isCancelled) setLoading(false);
            }
        };

        void fetchMeta();

        return () => {
            isCancelled = true;
        };
    }, [isOpen, anime?.id, anime?.idMal]);

    const displayedEpisodes = useMemo(() => {
        if (!anime || isUpcomingOrUnreleased) return [];
        const isAiring = isAnimeAiring(anime.status);
        const nextAiring = anime.nextAiringEpisode?.episode || 0;
        const count = Math.min(totalEpisodes, displayLimit);

        const list = [];
        for (let i = 0; i < count; i++) {
            const epNum = i + 1;

            // Never render unreleased future episodes for currently airing anime
            if (isAiring && nextAiring > 0 && epNum >= nextAiring) {
                break;
            }

            const meta = episodesMeta?.get(epNum);
            if (isAiring && isEpisodeUnreleased(meta?.airDate)) {
                break;
            }

            // Find matching streaming episode if meta title is generic or missing
            const streamingEp =
                anime.streamingEpisodes?.find((se) => {
                    const match = se.title?.match(/(?:Episode|Ep\.?)\s*(\d+)/i);
                    return match ? Number(match[1]) === epNum : false;
                }) || anime.streamingEpisodes?.[i];

            let title =
                meta?.title && !/^episode\s+\d+$/i.test(meta.title.trim())
                    ? meta.title
                    : '';

            if (!title && streamingEp?.title) {
                const clean = streamingEp.title
                    .replace(/^(?:Episode|Ep\.?)\s*\d+\s*[-–—:]\s*/i, '')
                    .trim();
                if (clean && !/^episode\s+\d+$/i.test(clean)) {
                    title = clean;
                }
            }

            if (!title) {
                title = `Episode ${epNum}`;
            }

            const thumbnail =
                meta?.thumbnail ||
                streamingEp?.thumbnail ||
                anime.bannerImage ||
                anime.coverImage;

            list.push({
                episodeNumber: epNum,
                title,
                thumbnail,
                duration: meta?.runtime ? `${meta.runtime} min` : `${anime.duration || 24} min`,
            });
        }

        return list;
    }, [anime, episodesMeta, totalEpisodes, displayLimit, isUpcomingOrUnreleased]);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollHeight - scrollTop - clientHeight < 250 && displayLimit < totalEpisodes) {
            setDisplayLimit((prev) => Math.min(totalEpisodes, prev + 50));
        }
    };

    const handleEpisodeClick = (epNum: number, epTitle: string, epThumbnail: string) => {
        if (!anime || isUpcomingOrUnreleased || !epNum) return;
        const durationMins = anime.duration || 24;

        const animeObj = {
            id: anime.id,
            mal_id: anime.idMal,
            title: anime.title,
            title_english: anime.titleEnglish,
            title_romaji: anime.titleRomaji,
            images: {
                jpg: {
                    image_url: anime.coverImage,
                    large_image_url: anime.bannerImage || anime.coverImage,
                },
            },
            score: anime.averageScore ? anime.averageScore / 10 : 0,
            status: anime.status || 'FINISHED',
            type: 'TV',
            episodes: anime.episodesCount,
            duration: `${durationMins} min`,
            synopsis: anime.synopsis,
        } as unknown as Anime;

        const episodeObj = {
            episodeNumber: String(epNum),
            title: epTitle,
            thumbnail: epThumbnail,
            session: `ep-${epNum}`,
        } as unknown as Episode;

        // Immediately register in Continue Watching & activity history
        void saveProgress(animeObj, episodeObj, {
            positionSeconds: 0,
            durationSeconds: durationMins * 60,
        });

        // Navigate to Details page with episode playback query
        const routeId = `al-${anime.id}`;
        navigate(`/anime/details/${routeId}?ep=${epNum}`, {
            state: {
                anime: animeObj,
            },
        });
    };

    if (!isOpen || !anime) return null;

    const drawerContent = (
        <>
            {/* Mobile Backdrop Overlay (transparent tap-to-dismiss, no gradient/dimming) */}
            <div
                onClick={onClose}
                className="fixed inset-0 bg-transparent z-[2147483610] md:hidden"
                aria-hidden="true"
            />

            <aside
                aria-label="Episodes Panel"
                style={{
                    transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
                    transition: isDragging ? 'none' : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
                }}
                className="fixed inset-x-0 bottom-0 z-[2147483620] h-[74vh] max-h-[86vh] rounded-t-[28px] border-t border-white/10 md:rounded-none md:border-t-0 md:border-l md:border-white/10 md:static md:inset-auto md:w-[420px] lg:w-[440px] md:h-full md:max-h-none md:shrink-0 md:z-auto bg-[#121318] flex flex-col shadow-none animate-in slide-in-from-bottom md:slide-in-from-right duration-250 select-none overflow-hidden"
            >
                {/* Draggable Handle + Header */}
                <div
                    className="touch-none shrink-0 bg-[#121318] border-b border-white/[0.08]"
                    onPointerDown={(e) => {
                        if (window.innerWidth >= 768) return;
                        e.currentTarget.setPointerCapture(e.pointerId);
                        handleDragStart(e.clientY);
                    }}
                    onPointerMove={(e) => handleDragMove(e.clientY)}
                    onPointerUp={handleDragEnd}
                    onPointerCancel={handleDragEnd}
                >
                    {/* Drag Indicator Pill (Mobile only) */}
                    <div className="w-10 h-1 rounded-full bg-white/25 mx-auto mt-2.5 mb-1 md:hidden" />

                    {/* Header: Clean title with total count */}
                    <div
                    className="flex items-center justify-between px-5 py-3 md:py-4"
                    style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 1rem)' }}
                >
                        <div className="flex items-center gap-2.5">
                            <h2 className="text-[17px] font-extrabold text-white tracking-tight">Episodes</h2>
                            {displayedEpisodes.length > 0 && (
                                <span className="text-[12px] font-bold text-white/50 bg-white/[0.08] px-2.5 py-0.5 rounded-full tabular-nums">
                                    {displayedEpisodes.length}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Episode List with details page card styling and scroll */}
                <div
                    onScroll={handleScroll}
                    className="flex-1 overflow-y-auto p-3.5 space-y-2.5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:pb-3.5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
                >
                {loading && episodesMeta === null ? (
                    <div className="flex flex-col items-center justify-center h-48 text-neutral-400 gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
                        <span className="text-xs font-semibold text-neutral-300">Loading episodes...</span>
                    </div>
                ) : displayedEpisodes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-neutral-400 gap-2 px-6 text-center">
                        <span className="text-sm font-semibold text-neutral-300">No episodes available yet</span>
                        <span className="text-xs text-neutral-500">Episodes will appear here once released.</span>
                    </div>
                ) : (
                    displayedEpisodes.map((ep) => {
                        const isWatched = watchedEpisodeNumbers.has(ep.episodeNumber);
                        const isNowPlaying = Boolean(
                            continueItem && continueItem.episodeNumber === ep.episodeNumber
                        );
                        const progressPercent =
                            isNowPlaying &&
                            continueItem?.positionSeconds &&
                            continueItem?.durationSeconds
                                ? Math.min(
                                      100,
                                      Math.round(
                                          (continueItem.positionSeconds /
                                              continueItem.durationSeconds) *
                                              100
                                      )
                                  )
                                : 0;

                        return (
                            <button
                                key={ep.episodeNumber}
                                type="button"
                                onClick={() =>
                                    handleEpisodeClick(ep.episodeNumber, ep.title, ep.thumbnail)
                                }
                                className={`w-full text-left p-3 rounded-2xl flex items-center gap-3.5 sm:gap-4 transition-all duration-200 group border-0 outline-none cursor-pointer ${
                                    isNowPlaying
                                        ? 'bg-white/[0.12] ring-1 ring-white/10 shadow-lg'
                                        : 'bg-transparent hover:bg-white/[0.05] active:bg-white/[0.08]'
                                }`}
                            >
                                {/* 16:9 Thumbnail Box */}
                                <div className="w-32 sm:w-36 aspect-video rounded-xl overflow-hidden bg-neutral-900 shrink-0 relative shadow-md">
                                    <img
                                        src={ep.thumbnail}
                                        alt={ep.title}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        loading="lazy"
                                    />

                                    {/* Bottom Progress Bar if in-progress */}
                                    {progressPercent > 0 && (
                                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/60">
                                            <div
                                                className="h-full bg-rose-500 rounded-r-full"
                                                style={{ width: `${progressPercent}%` }}
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Right Column: Title and Subtitle */}
                                <div className="flex-1 min-w-0 pr-1">
                                    <h3
                                        className={`font-extrabold text-[14.5px] sm:text-[15.5px] leading-snug line-clamp-2 transition-colors ${
                                            isWatched
                                                ? 'text-white/70'
                                                : 'text-white group-hover:text-neutral-100'
                                        }`}
                                    >
                                        {ep.episodeNumber}. {ep.title}
                                    </h3>
                                    <div className="mt-1 flex items-center gap-2 text-[12.5px] sm:text-[13px]">
                                        {isNowPlaying && (
                                            <span className="font-bold text-white">Now playing</span>
                                        )}
                                        <span className="text-neutral-400 font-medium">
                                            {ep.duration}
                                        </span>
                                    </div>
                                </div>
                            </button>
                        );
                    })
                )}
            </div>
        </aside>
    </>
    );

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    if (isMobile && typeof document !== 'undefined') {
        return createPortal(drawerContent, document.body);
    }
    return drawerContent;
}

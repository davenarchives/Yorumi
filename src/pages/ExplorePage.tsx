import { useEffect, useLayoutEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
    Heart,
    Bookmark,
    ChevronUp,
    ChevronDown,
    Volume2,
    VolumeX,
    Plus,
    Check,
    ExternalLink,
    Play,
    Pause,
    RotateCcw,
    RotateCw,
    Maximize2,
    Minimize2,
    ChevronLeft,
    FastForward,
} from 'lucide-react';
import { useWatchList } from '../hooks/useWatchList';
import { useFavoriteAnime } from '../hooks/useFavoriteAnime';
import { getRuntimePlatform, isMobileShell } from '../platform/runtime';
import { enterLandscapePlayerMode, exitLandscapePlayerMode } from '../platform/immersiveMode';
import ExploreSkeleton from '../features/explore/components/ExploreSkeleton';
import { isAnimeReleased } from '../utils/animeAiring';
import ExploreEpisodesDrawer from '../features/explore/components/ExploreEpisodesDrawer';
import { useExploreFeed } from '../features/explore/recommendation/useExploreFeed';
import type { ExploreCandidate } from '../features/explore/recommendation/types';
import AnimeDetailsPage from './AnimeDetailsPage';
import { resetMobileShellShift, shiftMobileShell } from '../utils/screenShift';
import type { Anime } from '../types/anime';

const buildExploreDetailsAnime = (anime: ExploreCandidate): Partial<Anime> => ({
    id: anime.id,
    mal_id: anime.idMal,
    title: anime.title,
    title_english: anime.titleEnglish,
    title_romaji: anime.titleRomaji,
    images: { jpg: { large_image_url: anime.coverImage, image_url: anime.coverImage } },
    anilist_cover_image: anime.coverImage,
    anilist_banner_image: anime.bannerImage || anime.coverImage,
    score: anime.averageScore ? anime.averageScore / 10 : 0,
    status: anime.status || 'FINISHED',
    type: 'TV',
    episodes: anime.episodesCount,
    year: anime.seasonYear,
    genres: (anime.genres || []).map((name) => ({ mal_id: 0, name })),
    studios: (anime.studios || []).map((name) => ({ mal_id: 0, name })),
    synopsis: anime.synopsis,
});

export function isAnimeUpcomingOrUnreleased(anime: Partial<ExploreCandidate> | null | undefined): boolean {
    if (!anime) return true;
    const status = String(anime.status || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
    if (status === 'NOT_YET_RELEASED' || status === 'UPCOMING') return true;
    if (anime.seasonYear && anime.seasonYear > new Date().getFullYear()) return true;
    return !isAnimeReleased(anime as unknown as Parameters<typeof isAnimeReleased>[0]);
}

function getTruncatedSynopsis(text: string, maxLength = 95): string {
    if (!text || text.length <= maxLength) return text;
    const slice = text.slice(0, maxLength);
    const lastSpace = slice.lastIndexOf(' ');
    return (lastSpace > 50 ? slice.slice(0, lastSpace) : slice).trim();
}

export default function ExplorePage() {
    const navigate = useNavigate();
    const {
        feed,
        loading,
        sessionVersion,
        loadMore,
        refreshFeed,
        logInteraction,
        markNotInterested,
        excludeUnplayableTrailer,
        handleSlideChange,
    } = useExploreFeed();

    const [activeIndex, setActiveIndex] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [playingTrailers, setPlayingTrailers] = useState<Set<number>>(() => new Set());
    const [failedTrailers, setFailedTrailers] = useState<Set<number>>(() => new Set());
    const [expandedSynopsisIds, setExpandedSynopsisIds] = useState<Set<number>>(() => new Set());
    const [selectedAnimeForEpisodes, setSelectedAnimeForEpisodes] = useState<ExploreCandidate | null>(null);
    const [fullscreenAnimeId, setFullscreenAnimeId] = useState<number | null>(null);
    const [showFullscreenControls, setShowFullscreenControls] = useState(true);
    const [trailerProgress, setTrailerProgress] = useState<{ current: number; duration: number }>({ current: 0, duration: 0 });
    const [isFastForwarding, setIsFastForwarding] = useState(false);
    const [heartBursts, setHeartBursts] = useState<Array<{ id: number; x: number; y: number; rotate: number }>>([]);
    const [peekAnime, setPeekAnime] = useState<ExploreCandidate | null>(null);
    const [isDetailsSheetOpen, setIsDetailsSheetOpen] = useState(false);

    const { isInWatchList, addToWatchList, removeFromWatchList } = useWatchList();
    const { isFavorite, addFavorite, removeFavorite } = useFavoriteAnime();
    const [likedAnimeIds, setLikedAnimeIds] = useState<Set<string>>(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('yorumi_explore_liked_anime') || '[]');
            return new Set(Array.isArray(saved) ? saved.map(String) : []);
        } catch {
            return new Set();
        }
    });

    const toggleLike = useCallback((anime: ExploreCandidate) => {
        const key = String(anime.id);
        setLikedAnimeIds((prev) => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
                logInteraction({
                    animeId: anime.id,
                    type: 'like',
                    genres: anime.genres,
                    studios: anime.studios,
                    timestamp: Date.now(),
                });
            }
            try {
                localStorage.setItem('yorumi_explore_liked_anime', JSON.stringify([...next]));
            } catch {
                // Best effort persistence
            }
            return next;
        });
    }, [logInteraction]);

    const likeAnime = useCallback((anime: ExploreCandidate) => {
        const key = String(anime.id);
        setLikedAnimeIds((prev) => {
            if (prev.has(key)) return prev;
            const next = new Set(prev);
            next.add(key);
            logInteraction({
                animeId: anime.id,
                type: 'like',
                genres: anime.genres,
                studios: anime.studios,
                timestamp: Date.now(),
            });
            try {
                localStorage.setItem('yorumi_explore_liked_anime', JSON.stringify([...next]));
            } catch {
                // Best effort persistence
            }
            return next;
        });
    }, [logInteraction]);

    const containerRef = useRef<HTMLDivElement>(null);
    const cardRefs = useRef<(HTMLElement | null)[]>([]);
    const iframeRefs = useRef<Map<number, HTMLIFrameElement>>(new Map());
    const isPausedRef = useRef(false);
    const isDetailsSheetOpenRef = useRef(false);
    const isMutedRef = useRef(false);
    const visualIndexRef = useRef(0);
    const scrollSettleTimerRef = useRef<number | null>(null);
    const prewarmedTrailersRef = useRef<Set<number>>(new Set());
    const playingTrailersRef = useRef<Set<number>>(new Set());
    const trailerWatchdogsRef = useRef<Map<number, number>>(new Map());
    const lastResetVideoIdRef = useRef<number | null>(null);
    const lastLoopTimeRef = useRef<number>(0);
    const lastActiveIdRef = useRef<number | null>(null);
    const isScrubbingRef = useRef(false);
    const lastSeekDispatchRef = useRef(0);
    const holdTimerRef = useRef<number | null>(null);
    const holdActivatedRef = useRef(false);
    const holdPointerStartRef = useRef<{ x: number; y: number } | null>(null);
    const pointerMovedRef = useRef(false);
    const suppressClickRef = useRef(false);
    const lastTapRef = useRef<{ time: number; animeId: number | null }>({ time: 0, animeId: null });
    const singleTapTimerRef = useRef<number | null>(null);
    const heartBurstIdRef = useRef(0);
    const swipeLockRef = useRef<'none' | 'horizontal' | 'vertical'>('none');
    const swipeStartTimeRef = useRef<number>(0);
    const swipeOffsetRef = useRef<number>(0);
    const swipeTargetAnimeRef = useRef<ExploreCandidate | null>(null);
    const swipeCardElRef = useRef<HTMLElement | null>(null);
    const peekPanelRef = useRef<HTMLDivElement | null>(null);

    useLayoutEffect(() => {
        document.documentElement.classList.add('explore-open');
        window.scrollTo(0, 0);
        return () => document.documentElement.classList.remove('explore-open');
    }, []);

    useLayoutEffect(() => {
        if (!sessionVersion) return;
        containerRef.current?.scrollTo({ top: 0, behavior: 'instant' });
        visualIndexRef.current = 0;
        prewarmedTrailersRef.current.clear();
        lastResetVideoIdRef.current = null;
        setActiveIndex(0);
        setIsPaused(false);
        isPausedRef.current = false;
        setFailedTrailers(new Set());
        setPlayingTrailers(new Set());
        setExpandedSynopsisIds(new Set());
    }, [sessionVersion]);

    useEffect(() => {
        isPausedRef.current = isPaused;
    }, [isPaused]);

    useEffect(() => {
        isMutedRef.current = isMuted;
    }, [isMuted]);

    useEffect(() => {
        playingTrailersRef.current = playingTrailers;
    }, [playingTrailers]);

    const wasFullscreenRef = useRef(false);
    useEffect(() => {
        const isFullscreen = fullscreenAnimeId !== null;
        document.body.classList.toggle('yorumi-explore-fullscreen', isFullscreen);
        if (!isFullscreen) {
            if (wasFullscreenRef.current) {
                wasFullscreenRef.current = false;
                void exitLandscapePlayerMode();
            }
            if (document.fullscreenElement) {
                void document.exitFullscreen?.().catch(() => undefined);
            }
            return;
        }

        wasFullscreenRef.current = true;
        void enterLandscapePlayerMode();
        if (!isMobileShell() && !document.fullscreenElement) {
            void document.documentElement.requestFullscreen?.().catch(() => undefined);
        }

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setFullscreenAnimeId(null);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            document.body.classList.remove('yorumi-explore-fullscreen');
            if (wasFullscreenRef.current) {
                wasFullscreenRef.current = false;
                void exitLandscapePlayerMode();
            }
            if (document.fullscreenElement) {
                void document.exitFullscreen?.().catch(() => undefined);
            }
        };
    }, [fullscreenAnimeId]);

    useEffect(() => {
        if (fullscreenAnimeId === null || isPaused || !showFullscreenControls) return;
        const timer = window.setTimeout(() => setShowFullscreenControls(false), 3000);
        return () => window.clearTimeout(timer);
    }, [fullscreenAnimeId, isPaused, showFullscreenControls]);

    const seekBy = useCallback((deltaSeconds: number) => {
        const currentAnime = feed[activeIndex];
        if (!currentAnime) return;
        const iframe = iframeRefs.current.get(currentAnime.id);
        const nextTime = Math.max(
            0,
            Math.min(
                trailerProgress.duration > 0 ? trailerProgress.duration : Number.MAX_SAFE_INTEGER,
                trailerProgress.current + deltaSeconds
            )
        );
        iframe?.contentWindow?.postMessage(
            JSON.stringify({ event: 'command', func: 'seekTo', args: [nextTime, true] }),
            '*'
        );
        setTrailerProgress((prev) => ({ ...prev, current: nextTime }));
        setShowFullscreenControls(true);
    }, [activeIndex, feed, trailerProgress.current, trailerProgress.duration]);

    const formatTrailerTime = (seconds: number): string => {
        if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    const clearTrailerWatchdog = useCallback((animeId: number) => {
        const timer = trailerWatchdogsRef.current.get(animeId);
        if (timer !== undefined) {
            window.clearTimeout(timer);
            trailerWatchdogsRef.current.delete(animeId);
        }
    }, []);

    const handleUnplayableTrailer = useCallback((animeId: number) => {
        clearTrailerWatchdog(animeId);
        prewarmedTrailersRef.current.delete(animeId);
        setFailedTrailers((prev) => (prev.has(animeId) ? prev : new Set(prev).add(animeId)));
        setPlayingTrailers((prev) => {
            if (!prev.has(animeId)) return prev;
            const next = new Set(prev);
            next.delete(animeId);
            return next;
        });

        const idx = feed.findIndex((item) => item.id === animeId);
        const anime = idx !== -1 ? feed[idx] : undefined;
        // Remove from feed when it's the active or upcoming preloaded slide (never shift scroll position for slides above activeIndex)
        const shouldRemoveFromFeed = idx === -1 || idx >= activeIndex;
        excludeUnplayableTrailer(animeId, anime?.trailer?.id, shouldRemoveFromFeed);

        if (feed.length - 1 - activeIndex <= 4) {
            void loadMore();
        }
    }, [activeIndex, clearTrailerWatchdog, excludeUnplayableTrailer, feed, loadMore]);

    const armTrailerWatchdog = useCallback((animeId: number, delayMs: number) => {
        clearTrailerWatchdog(animeId);
        if (typeof navigator !== 'undefined' && !navigator.onLine) return;
        const timer = window.setTimeout(() => {
            trailerWatchdogsRef.current.delete(animeId);
            if (typeof navigator !== 'undefined' && !navigator.onLine) return;
            if (!iframeRefs.current.has(animeId)) return;
            if (playingTrailersRef.current.has(animeId) || prewarmedTrailersRef.current.has(animeId)) return;
            // Don't drop active slide if user manually paused it
            if (feed[activeIndex]?.id === animeId && isPausedRef.current) return;
            handleUnplayableTrailer(animeId);
        }, delayMs);
        trailerWatchdogsRef.current.set(animeId, timer);
    }, [activeIndex, clearTrailerWatchdog, feed, handleUnplayableTrailer]);

    useEffect(() => {
        const watchdogs = trailerWatchdogsRef.current;
        return () => {
            watchdogs.forEach((timer) => window.clearTimeout(timer));
            watchdogs.clear();
        };
    }, []);

    // Immediately switch YouTube playback via refs (zero React re-render during touch scroll/snap)
    const activateTrailerImmediate = useCallback((targetIndex: number) => {
        const targetAnime = feed[targetIndex];
        if (!targetAnime) return;
        const targetId = targetAnime.id;
        const nextId = feed[targetIndex + 1]?.id ?? null;

        iframeRefs.current.forEach((frame, id) => {
            const win = frame.contentWindow;
            if (!win) return;
            const send = (func: string, args: unknown[] = []) =>
                win.postMessage(JSON.stringify({ event: 'command', func, args }), '*');

            if (id === targetId) {
                // Jump straight to 0:00 while already playing silently — starts from beginning with ZERO pause/play icon!
                if (lastResetVideoIdRef.current !== id) {
                    lastResetVideoIdRef.current = id;
                    send('seekTo', [0, true]);
                }
                send(isMutedRef.current ? 'mute' : 'unMute');
                send('setPlaybackRate', [1]);
                // Only call playVideo if not already playing silently (avoids YouTube flashing its center play/pause icon)
                if (!playingTrailersRef.current.has(id)) {
                    send('playVideo');
                }
            } else if (id === nextId) {
                // Keep the next slide playing silently so it slides in live with ZERO pause/play overlay icon
                send('mute');
            } else {
                send('mute');
                send('pauseVideo');
                playingTrailersRef.current.delete(id);
            }
        });
    }, [feed]);

    // Scroll to a specific slide index smoothly
    const scrollToIndex = useCallback((index: number) => {
        if (index < 0 || index >= feed.length) return;
        const container = containerRef.current;
        if (!container) return;

        if (scrollSettleTimerRef.current !== null) {
            window.clearTimeout(scrollSettleTimerRef.current);
            scrollSettleTimerRef.current = null;
        }
        visualIndexRef.current = index;
        isPausedRef.current = false;
        setIsPaused(false);
        activateTrailerImmediate(index);
        container.scrollTo({
            top: index * container.clientHeight,
            behavior: 'smooth',
        });
        handleSlideChange(index);
        setActiveIndex(index);
    }, [activateTrailerImmediate, feed.length, handleSlideChange]);

    // Handle scroll snap index detection with zero-jank ref playback switching + settled state commit
    const handleScroll = useCallback(() => {
        const container = containerRef.current;
        if (!container) return;

        const containerHeight = container.clientHeight;
        if (containerHeight <= 0) return;
        const scrollTop = container.scrollTop;
        const newIndex = Math.max(0, Math.min(feed.length - 1, Math.round(scrollTop / containerHeight)));

        // Switch video playback immediately the instant we cross 50% (pure postMessage, no re-render)
        if (newIndex !== visualIndexRef.current) {
            visualIndexRef.current = newIndex;
            isPausedRef.current = false;
            activateTrailerImmediate(newIndex);
        }

        // Commit React state + mount next preloaded iframe once scroll snap settles
        if (scrollSettleTimerRef.current !== null) {
            window.clearTimeout(scrollSettleTimerRef.current);
        }
        scrollSettleTimerRef.current = window.setTimeout(() => {
            scrollSettleTimerRef.current = null;
            const settledIndex = Math.max(
                0,
                Math.min(feed.length - 1, Math.round((container.scrollTop || 0) / containerHeight))
            );
            visualIndexRef.current = settledIndex;
            setActiveIndex((prev) => {
                if (prev !== settledIndex) {
                    isPausedRef.current = false;
                    setIsPaused(false);
                    handleSlideChange(settledIndex);
                }
                return settledIndex;
            });
            if (settledIndex >= feed.length - 3) {
                void loadMore();
            }
        }, 120);
    }, [activateTrailerImmediate, feed.length, handleSlideChange, loadMore]);

    // Native scrollend listener for instant settle commit on modern Android WebView / Chromium
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const onScrollEnd = () => {
            if (scrollSettleTimerRef.current !== null) {
                window.clearTimeout(scrollSettleTimerRef.current);
                scrollSettleTimerRef.current = null;
            }
            const containerHeight = container.clientHeight;
            if (containerHeight <= 0 || feed.length === 0) return;
            const settledIndex = Math.max(
                0,
                Math.min(feed.length - 1, Math.round(container.scrollTop / containerHeight))
            );
            const exactTop = settledIndex * containerHeight;
            if (Math.abs(container.scrollTop - exactTop) > 4) {
                container.scrollTo({ top: exactTop, behavior: 'instant' });
            }
            visualIndexRef.current = settledIndex;
            setActiveIndex((prev) => {
                if (prev !== settledIndex) {
                    isPausedRef.current = false;
                    setIsPaused(false);
                    handleSlideChange(settledIndex);
                }
                return settledIndex;
            });
            if (settledIndex >= feed.length - 3) {
                void loadMore();
            }
        };
        container.addEventListener('scrollend', onScrollEnd);
        return () => {
            container.removeEventListener('scrollend', onScrollEnd);
            if (scrollSettleTimerRef.current !== null) {
                window.clearTimeout(scrollSettleTimerRef.current);
                scrollSettleTimerRef.current = null;
            }
        };
    }, [feed.length, handleSlideChange, loadMore]);

    // Reset pause state synchronously when changing slides.
    useLayoutEffect(() => {
        isPausedRef.current = false;
        setIsPaused(false);
        setSelectedAnimeForEpisodes((prev) => {
            if (!prev) return null;
            const activeAnime = feed[activeIndex];
            if (!activeAnime || isAnimeUpcomingOrUnreleased(activeAnime)) {
                return null;
            }
            return activeAnime;
        });
    }, [activeIndex, feed]);

    const togglePlayPause = useCallback(() => {
        const currentAnime = feed[activeIndex];
        if (!currentAnime) return;
        const iframe = iframeRefs.current.get(currentAnime.id);

        setIsPaused((prev) => {
            const nextState = !prev;
            const command = nextState ? 'pauseVideo' : 'playVideo';
            if (iframe?.contentWindow) {
                iframe.contentWindow.postMessage(
                    JSON.stringify({ event: 'command', func: command, args: [] }),
                    '*'
                );
            }
            return nextState;
        });
    }, [activeIndex, feed]);

    const toggleMute = useCallback(() => {
        setIsMuted((prev) => {
            const nextMuted = !prev;
            const currentAnime = feed[activeIndex];
            if (currentAnime) {
                const iframe = iframeRefs.current.get(currentAnime.id);
                if (iframe?.contentWindow) {
                    const command = nextMuted ? 'mute' : 'unMute';
                    iframe.contentWindow.postMessage(
                        JSON.stringify({ event: 'command', func: command, args: [] }),
                        '*'
                    );
                }
            }
            return nextMuted;
        });
    }, [activeIndex, feed]);

    const setActivePlaybackRate = useCallback((rate: number) => {
        const currentAnime = feed[activeIndex];
        if (!currentAnime) return;
        const iframe = iframeRefs.current.get(currentAnime.id);
        if (iframe?.contentWindow) {
            iframe.contentWindow.postMessage(
                JSON.stringify({ event: 'command', func: 'setPlaybackRate', args: [rate] }),
                '*'
            );
        }
    }, [activeIndex, feed]);

    const clearHoldTimer = useCallback(() => {
        if (holdTimerRef.current !== null) {
            window.clearTimeout(holdTimerRef.current);
            holdTimerRef.current = null;
        }
    }, []);

    const stopFastForward = useCallback((shouldSuppressClick = false) => {
        clearHoldTimer();
        holdPointerStartRef.current = null;
        if (holdActivatedRef.current) {
            holdActivatedRef.current = false;
            if (shouldSuppressClick) {
                suppressClickRef.current = true;
            }
            setIsFastForwarding(false);
            setActivePlaybackRate(1);
        }
    }, [clearHoldTimer, setActivePlaybackRate]);

    const spawnHeartBurst = useCallback((x: number, y: number) => {
        const id = ++heartBurstIdRef.current;
        const rotate = Math.round((Math.random() - 0.5) * 32);
        setHeartBursts((prev) => [...prev, { id, x, y, rotate }]);
        window.setTimeout(() => {
            setHeartBursts((prev) => prev.filter((item) => item.id !== id));
        }, 720);
    }, []);

    const applySwipeTransform = useCallback((offsetPx: number, dragging: boolean) => {
        const peekEl = peekPanelRef.current;
        const transition = dragging ? 'none' : 'transform 230ms cubic-bezier(0.22, 1, 0.36, 1)';
        // Move the ENTIRE screen (Explore content + bottom navbar + top icons) together as one unified screen
        shiftMobileShell(offsetPx, dragging, 230);
        if (peekEl) {
            const vw = typeof window !== 'undefined' ? window.innerWidth : 400;
            peekEl.style.transition = transition;
            peekEl.style.transform = `translateX(${vw + offsetPx}px)`;
        }
    }, []);

    useEffect(() => {
        isDetailsSheetOpenRef.current = isDetailsSheetOpen;
        if (isDetailsSheetOpen) {
            iframeRefs.current.forEach((frame, id) => {
                frame.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'mute', args: [] }), '*');
                frame.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), '*');
                playingTrailersRef.current.delete(id);
            });
        }
    }, [isDetailsSheetOpen]);

    const closeDetailsSheet = useCallback(() => {
        const vw = typeof window !== 'undefined' ? window.innerWidth : 400;
        const peekEl = peekPanelRef.current;
        shiftMobileShell(0, false, 230);
        if (peekEl) {
            peekEl.style.transition = 'transform 230ms cubic-bezier(0.22, 1, 0.36, 1)';
            peekEl.style.transform = `translate3d(${vw}px, 0, 0)`;
        }
        isDetailsSheetOpenRef.current = false;
        setIsDetailsSheetOpen(false);
        const currentAnime = feed[visualIndexRef.current] || feed[activeIndex];
        if (currentAnime && !isPausedRef.current) {
            const win = iframeRefs.current.get(currentAnime.id)?.contentWindow;
            win?.postMessage(JSON.stringify({ event: 'command', func: isMutedRef.current ? 'mute' : 'unMute', args: [] }), '*');
            win?.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*');
        }
        window.setTimeout(() => {
            resetMobileShellShift();
            setPeekAnime(null);
        }, 240);
    }, [activeIndex, feed]);

    useEffect(() => {
        const win = window as Window & { __yorumiCloseExploreDetails?: (() => void) | null };
        if (isDetailsSheetOpen) {
            win.__yorumiCloseExploreDetails = closeDetailsSheet;
        } else if (win.__yorumiCloseExploreDetails === closeDetailsSheet) {
            win.__yorumiCloseExploreDetails = null;
        }
        return () => {
            if (win.__yorumiCloseExploreDetails === closeDetailsSheet) {
                win.__yorumiCloseExploreDetails = null;
            }
        };
    }, [isDetailsSheetOpen, closeDetailsSheet]);

    useEffect(() => () => resetMobileShellShift(), []);

    const handleSlidePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>, anime?: ExploreCandidate) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        clearHoldTimer();
        holdActivatedRef.current = false;
        pointerMovedRef.current = false;
        suppressClickRef.current = false;
        holdPointerStartRef.current = { x: e.clientX, y: e.clientY };
        swipeLockRef.current = 'none';
        swipeStartTimeRef.current = Date.now();
        swipeOffsetRef.current = 0;
        swipeTargetAnimeRef.current = anime || null;
        swipeCardElRef.current = (e.currentTarget.closest('section') as HTMLElement | null) || null;

        holdTimerRef.current = window.setTimeout(() => {
            if (pointerMovedRef.current || isPausedRef.current || swipeLockRef.current !== 'none') return;
            if (singleTapTimerRef.current !== null) {
                window.clearTimeout(singleTapTimerRef.current);
                singleTapTimerRef.current = null;
            }
            holdActivatedRef.current = true;
            setIsFastForwarding(true);
            setActivePlaybackRate(2);
        }, 350);
    }, [clearHoldTimer, setActivePlaybackRate]);

    const handleSlidePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        const start = holdPointerStartRef.current;
        if (!start) return;
        const rawDx = e.clientX - start.x;
        const rawDy = e.clientY - start.y;
        const dx = Math.abs(rawDx);
        const dy = Math.abs(rawDy);
        if (dx > 10 || dy > 10) {
            pointerMovedRef.current = true;
            if (!holdActivatedRef.current) {
                clearHoldTimer();
            }
        }

        // Touch horizontal drag is handled by the non-passive touchmove listener below for 1:1 zero-cancel dragging
        if (e.pointerType === 'touch') return;

        if (swipeLockRef.current === 'none' && (dx > 10 || dy > 10)) {
            if (rawDx < -10 && dx > dy * 1.15 && !holdActivatedRef.current && swipeTargetAnimeRef.current) {
                swipeLockRef.current = 'horizontal';
                setPeekAnime(swipeTargetAnimeRef.current);
            } else {
                swipeLockRef.current = 'vertical';
            }
        }

        if (swipeLockRef.current === 'horizontal') {
            const maxSlide = typeof window !== 'undefined' ? window.innerWidth : 400;
            const clamped = Math.min(0, Math.max(-maxSlide, rawDx));
            swipeOffsetRef.current = clamped;
            applySwipeTransform(clamped, true);
        }
    }, [applySwipeTransform, clearHoldTimer]);

    const handleSlidePointerEnd = useCallback((_onSwipeToDetails?: (anime: ExploreCandidate) => void) => {
        if (swipeLockRef.current === 'horizontal') {
            const target = swipeTargetAnimeRef.current;
            const offset = swipeOffsetRef.current;
            const elapsed = Math.max(1, Date.now() - swipeStartTimeRef.current);
            const velocity = Math.abs(offset) / elapsed;
            swipeLockRef.current = 'none';
            swipeTargetAnimeRef.current = null;
            suppressClickRef.current = true;
            holdPointerStartRef.current = null;
            clearHoldTimer();

            if (target && (Math.abs(offset) >= 85 || (Math.abs(offset) >= 40 && velocity > 0.45))) {
                const maxSlide = typeof window !== 'undefined' ? window.innerWidth : 400;
                swipeOffsetRef.current = -maxSlide;
                applySwipeTransform(-maxSlide, false);
                isDetailsSheetOpenRef.current = true;
                setIsDetailsSheetOpen(true);
                // Pause & mute ALL mounted trailers while viewing the details sheet
                iframeRefs.current.forEach((frame, id) => {
                    frame.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'mute', args: [] }), '*');
                    frame.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), '*');
                    playingTrailersRef.current.delete(id);
                });
                logInteraction({
                    animeId: target.id,
                    type: 'details_open',
                    genres: target.genres,
                    studios: target.studios,
                    timestamp: Date.now(),
                });
                return;
            }

            swipeOffsetRef.current = 0;
            applySwipeTransform(0, false);
            window.setTimeout(() => {
                resetMobileShellShift();
                setPeekAnime(null);
            }, 235);
            return;
        }

        swipeLockRef.current = 'none';
        swipeTargetAnimeRef.current = null;
        stopFastForward(true);
    }, [applySwipeTransform, clearHoldTimer, logInteraction, stopFastForward]);

    // Non-passive touch listener on the feed container so horizontal swipe-to-details drags 1:1 with finger
    // (holding in-between, dragging back/forth) without Android WebView cancelling the gesture.
    useEffect(() => {
        const el = containerRef.current;
        if (!el || !isMobileShell()) return;

        let touchStartX = 0;
        let touchStartY = 0;
        let tracking = false;

        const onTouchStart = (e: TouchEvent) => {
            if (window.innerWidth >= 768 || e.touches.length !== 1 || fullscreenAnimeId !== null || isDetailsSheetOpen) {
                tracking = false;
                return;
            }
            const t = e.touches[0];
            touchStartX = t.clientX;
            touchStartY = t.clientY;
            tracking = true;
            swipeLockRef.current = 'none';
            swipeStartTimeRef.current = Date.now();
            swipeOffsetRef.current = 0;
            const currentAnime = feed[visualIndexRef.current] || feed[activeIndex] || null;
            swipeTargetAnimeRef.current = currentAnime;
        };

        const onTouchMove = (e: TouchEvent) => {
            if (!tracking || e.touches.length !== 1) return;
            const t = e.touches[0];
            const rawDx = t.clientX - touchStartX;
            const rawDy = t.clientY - touchStartY;
            const dx = Math.abs(rawDx);
            const dy = Math.abs(rawDy);

            if (swipeLockRef.current === 'none' && (dx > 8 || dy > 8)) {
                if (rawDx < -8 && dx > dy * 1.1 && !holdActivatedRef.current && swipeTargetAnimeRef.current) {
                    swipeLockRef.current = 'horizontal';
                    clearHoldTimer();
                    setPeekAnime(swipeTargetAnimeRef.current);
                } else {
                    swipeLockRef.current = 'vertical';
                }
            }

            if (swipeLockRef.current === 'horizontal') {
                if (e.cancelable) e.preventDefault();
                const maxSlide = window.innerWidth || 400;
                const clamped = Math.min(0, Math.max(-maxSlide, rawDx));
                swipeOffsetRef.current = clamped;
                applySwipeTransform(clamped, true);
            }
        };

        const onTouchEnd = () => {
            if (!tracking) return;
            tracking = false;
            if (swipeLockRef.current === 'horizontal') {
                handleSlidePointerEnd();
            }
        };

        el.addEventListener('touchstart', onTouchStart, { passive: true });
        el.addEventListener('touchmove', onTouchMove, { passive: false });
        el.addEventListener('touchend', onTouchEnd, { passive: true });
        el.addEventListener('touchcancel', onTouchEnd, { passive: true });
        return () => {
            el.removeEventListener('touchstart', onTouchStart);
            el.removeEventListener('touchmove', onTouchMove);
            el.removeEventListener('touchend', onTouchEnd);
            el.removeEventListener('touchcancel', onTouchEnd);
        };
    }, [activeIndex, applySwipeTransform, clearHoldTimer, feed, fullscreenAnimeId, handleSlidePointerEnd, isDetailsSheetOpen]);

    const handleSlideTap = useCallback((e: React.MouseEvent<HTMLDivElement>, anime: ExploreCandidate, isFullscreenMode: boolean) => {
        e.stopPropagation();
        if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
        }
        if (pointerMovedRef.current) {
            pointerMovedRef.current = false;
            return;
        }

        if (isFullscreenMode) {
            setShowFullscreenControls((prev) => !prev);
            return;
        }

        const now = Date.now();
        const isDoubleTap =
            lastTapRef.current.animeId === anime.id &&
            now - lastTapRef.current.time <= 260;

        if (isDoubleTap) {
            if (singleTapTimerRef.current !== null) {
                window.clearTimeout(singleTapTimerRef.current);
                singleTapTimerRef.current = null;
            }
            lastTapRef.current = { time: 0, animeId: null };
            const rect = e.currentTarget.getBoundingClientRect();
            spawnHeartBurst(e.clientX - rect.left, e.clientY - rect.top);
            likeAnime(anime);
            return;
        }

        lastTapRef.current = { time: now, animeId: anime.id };
        if (singleTapTimerRef.current !== null) {
            window.clearTimeout(singleTapTimerRef.current);
        }
        singleTapTimerRef.current = window.setTimeout(() => {
            singleTapTimerRef.current = null;
            togglePlayPause();
        }, 260);
    }, [likeAnime, spawnHeartBurst, togglePlayPause]);

    useEffect(() => {
        stopFastForward(false);
        if (singleTapTimerRef.current !== null) {
            window.clearTimeout(singleTapTimerRef.current);
            singleTapTimerRef.current = null;
        }
        lastTapRef.current = { time: 0, animeId: null };
    }, [activeIndex, stopFastForward]);

    useEffect(() => {
        return () => {
            clearHoldTimer();
            if (singleTapTimerRef.current !== null) {
                window.clearTimeout(singleTapTimerRef.current);
                singleTapTimerRef.current = null;
            }
        };
    }, [clearHoldTimer]);

    // Keep the next slide playing silently so it slides in live without YouTube's pause/play icon.
    useEffect(() => {
        const activeId = feed[activeIndex]?.id ?? null;
        const nextId = feed[activeIndex + 1]?.id ?? null;
        const slideChanged = activeId !== null && activeId !== lastActiveIdRef.current;
        if (slideChanged) {
            lastActiveIdRef.current = activeId;
            setTrailerProgress({ current: 0, duration: 0 });
        }

        iframeRefs.current.forEach((frame, id) => {
            const active = activeId === id;
            const isNext = nextId === id;
            const send = (func: string, args: unknown[] = []) => frame.contentWindow?.postMessage(
                JSON.stringify({ event: 'command', func, args }), '*'
            );
            send(active && !isMuted ? 'unMute' : 'mute');
            send('setPlaybackRate', [1]);
            if (active) {
                prewarmedTrailersRef.current.delete(id);
                if (slideChanged && lastResetVideoIdRef.current !== id) {
                    lastResetVideoIdRef.current = id;
                    send('seekTo', [0, true]);
                }
                if (!isPausedRef.current && !playingTrailersRef.current.has(id)) {
                    send('playVideo');
                }
            } else if (isNext) {
                // Keep next slide playing silently (no pauseVideo -> no center || icon!)
                if (!playingTrailersRef.current.has(id)) {
                    send('playVideo');
                }
            } else {
                send('pauseVideo');
                playingTrailersRef.current.delete(id);
            }
        });
    }, [activeIndex, feed, isMuted]);

    useEffect(() => {
        const nearby = new Set(feed.slice(Math.max(0, activeIndex - 1), activeIndex + 3).map(item => item.id));
        setPlayingTrailers(prev => new Set([...prev].filter(id => nearby.has(id))));
        for (const id of Array.from(prewarmedTrailersRef.current)) {
            if (!nearby.has(id)) prewarmedTrailersRef.current.delete(id);
        }
    }, [activeIndex, feed]);

    // Lightweight handshake with active YouTube player until playback starts
    useEffect(() => {
        const currentAnime = feed[activeIndex];
        if (!currentAnime) return;

        const pingPlayer = () => {
            if (isDetailsSheetOpenRef.current) return;
            const activeFrame = iframeRefs.current.get(currentAnime.id);
            if (!activeFrame?.contentWindow) return;
            activeFrame.contentWindow.postMessage(JSON.stringify({ event: 'listening' }), '*');
            if (!playingTrailersRef.current.has(currentAnime.id) && !isPausedRef.current) {
                activeFrame.contentWindow.postMessage(
                    JSON.stringify({ event: 'command', func: 'addEventListener', args: ['onStateChange'] }),
                    '*'
                );
                activeFrame.contentWindow.postMessage(
                    JSON.stringify({ event: 'command', func: 'addEventListener', args: ['onError'] }),
                    '*'
                );
                activeFrame.contentWindow.postMessage(
                    JSON.stringify({ event: 'command', func: isMuted ? 'mute' : 'unMute', args: [] }),
                    '*'
                );
                activeFrame.contentWindow.postMessage(
                    JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
                    '*'
                );
            }
        };

        pingPlayer();
        const interval = setInterval(pingPlayer, 1500);
        return () => clearInterval(interval);
    }, [activeIndex, feed, isMuted]);

    // Seamless TikTok-style auto-looping without replay screen or native playlist buttons
    useEffect(() => {
        const handleWindowMessage = (event: MessageEvent) => {
            try {
                if (event.origin && !event.origin.includes('youtube') && !event.origin.includes('yorumi.cloud')) return;

                const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
                if (!data) return;

                const playerEntry = Array.from(iframeRefs.current.entries()).find(([, frame]) => frame.contentWindow === event.source);
                if (!playerEntry) return;
                const [playerId] = playerEntry;
                const playerState = data?.event === 'onStateChange' ? (data.info ?? data.data) : data?.info?.playerState;
                const activeVisualIndex = visualIndexRef.current;
                const activeVisualId = feed[activeVisualIndex]?.id ?? feed[activeIndex]?.id;
                const nextVisualId = feed[activeVisualIndex + 1]?.id ?? feed[activeIndex + 1]?.id;
                if (data?.event === 'onReady') {
                    const frame = iframeRefs.current.get(playerId);
                    if (playerId === activeVisualId) {
                        frame?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: isMutedRef.current ? 'mute' : 'unMute', args: [] }), '*');
                        if (!isPausedRef.current && !playingTrailersRef.current.has(playerId)) {
                            frame?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*');
                        }
                    } else if (playerId === nextVisualId) {
                        // Keep next slide muted & playing silently so YouTube never shows its center pause/play icon
                        frame?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'mute', args: [] }), '*');
                    } else {
                        frame?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'mute', args: [] }), '*');
                        frame?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), '*');
                    }
                }
                if (data?.event === 'onError' || (data?.event === 'infoDelivery' && (data?.info?.errorCode || data?.info?.videoData?.errorCode))) {
                    handleUnplayableTrailer(playerId);
                    return;
                }
                if (playerState === 3 || playerState === '3') {
                    // Actively buffering on slow network: extend watchdog grace window once
                    if (trailerWatchdogsRef.current.has(playerId)) {
                        armTrailerWatchdog(playerId, 7500);
                    }
                }
                if (playerState === 2 || playerState === '2') {
                    playingTrailersRef.current.delete(playerId);
                    setPlayingTrailers(prev => {
                        if (!prev.has(playerId)) return prev;
                        const next = new Set(prev);
                        next.delete(playerId);
                        return next;
                    });
                }
                if (playerState === 1 || playerState === '1') {
                    clearTrailerWatchdog(playerId);
                    if (isDetailsSheetOpenRef.current) {
                        const frame = iframeRefs.current.get(playerId);
                        frame?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'mute', args: [] }), '*');
                        frame?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), '*');
                        playingTrailersRef.current.delete(playerId);
                        return;
                    }
                    playingTrailersRef.current.add(playerId);
                    setPlayingTrailers(prev => prev.has(playerId) ? prev : new Set(prev).add(playerId));
                    const frame = iframeRefs.current.get(playerId);
                    if (playerId === nextVisualId) {
                        // Next slide is live & playing silently — keep muted, do NOT pause (prevents center || icon)
                        prewarmedTrailersRef.current.add(playerId);
                        frame?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'mute', args: [] }), '*');
                    } else if (playerId !== activeVisualId) {
                        frame?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'mute', args: [] }), '*');
                        frame?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), '*');
                    }
                }
                const currentAnime = feed[activeIndex];
                if (!currentAnime) return;
                const currentFrame = iframeRefs.current.get(currentAnime.id);
                if (!currentFrame || !currentFrame.contentWindow) return;

                if (event.source && event.source !== currentFrame.contentWindow) return;

                if (data?.event === 'infoDelivery' && data.info) {
                    const nextCurrent = !isScrubbingRef.current && typeof data.info.currentTime === 'number'
                        ? data.info.currentTime
                        : undefined;
                    const nextDuration = typeof data.info.duration === 'number' ? data.info.duration : undefined;
                    if (nextCurrent !== undefined || nextDuration !== undefined) {
                        setTrailerProgress((prev) => ({
                            current: nextCurrent ?? prev.current,
                            duration: nextDuration ?? prev.duration,
                        }));
                    }
                }

                let shouldLoop = false;

                // 1. YouTube player state 0 = ENDED (from onStateChange or infoDelivery)
                if (data?.event === 'onStateChange' && (data.info === 0 || data.data === 0)) {
                    shouldLoop = true;
                } else if (data?.event === 'infoDelivery' && (data.info?.playerState === 0 || data.info?.playerState === '0')) {
                    shouldLoop = true;
                } else if (data?.info?.playerState === 0 || data?.info?.playerState === '0') {
                    shouldLoop = true;
                }

                // 2. Proactive loop near end (within 0.4s of end) to loop seamlessly like TikTok before YouTube shows replay screen
                if (
                    typeof data?.info?.duration === 'number' &&
                    typeof data?.info?.currentTime === 'number' &&
                    data.info.duration > 2 &&
                    data.info.duration - data.info.currentTime <= 0.45
                ) {
                    shouldLoop = true;
                }

                if (shouldLoop && !isPausedRef.current) {
                    const now = Date.now();
                    if (now - lastLoopTimeRef.current > 1200) {
                        lastLoopTimeRef.current = now;
                        logInteraction({
                            animeId: currentAnime.id,
                            type: 'trailer_complete',
                            genres: currentAnime.genres,
                            studios: currentAnime.studios,
                            timestamp: now,
                        });

                        // Rewind to 0 and play immediately
                        currentFrame.contentWindow.postMessage(
                            JSON.stringify({ event: 'command', func: 'seekTo', args: [0, true] }),
                            '*'
                        );
                        currentFrame.contentWindow.postMessage(
                            JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
                            '*'
                        );
                    }
                }
            } catch {
                // Ignore non-json or unrelated window messages
            }
        };

        window.addEventListener('message', handleWindowMessage);
        return () => window.removeEventListener('message', handleWindowMessage);
    }, [activeIndex, armTrailerWatchdog, clearTrailerWatchdog, feed, handleUnplayableTrailer, isMuted, logInteraction, scrollToIndex]);

    // Keyboard navigation (ArrowUp, ArrowDown, Space, M, R)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            if (e.code === 'Space') {
                e.preventDefault();
                togglePlayPause();
            } else if (e.key === 'ArrowDown' || e.key === 'j') {
                e.preventDefault();
                scrollToIndex(activeIndex + 1);
            } else if (e.key === 'ArrowUp' || e.key === 'k') {
                e.preventDefault();
                scrollToIndex(activeIndex - 1);
            } else if (e.key === 'm') {
                e.preventDefault();
                toggleMute();
            } else if (e.key === 'r') {
                e.preventDefault();
                void refreshFeed();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeIndex, refreshFeed, scrollToIndex, toggleMute, togglePlayPause]);

    const navigateToAnime = useCallback((anime: ExploreCandidate) => {
        logInteraction({
            animeId: anime.id,
            type: 'details_open',
            genres: anime.genres,
            studios: anime.studios,
            timestamp: Date.now(),
        });

        navigate(`/anime/details/al-${anime.id}`, {
            state: {
                anime: {
                    id: anime.id,
                    mal_id: anime.idMal,
                    title: anime.title,
                    title_english: anime.titleEnglish,
                    title_romaji: anime.titleRomaji,
                    images: { jpg: { large_image_url: anime.coverImage, image_url: anime.coverImage } },
                    score: anime.averageScore ? anime.averageScore / 10 : 0,
                    status: anime.status || 'FINISHED',
                    type: 'TV',
                    episodes: anime.episodesCount,
                    synopsis: anime.synopsis,
                },
            },
        });
    }, [logInteraction, navigate]);

    const isDrawerOpen = Boolean(selectedAnimeForEpisodes);

    return (
        <div className={`explore-feed relative w-full ${isMobileShell() ? 'h-[100dvh]' : 'h-[calc(100vh-2rem)]'} flex overflow-hidden bg-black select-none`}>
            {/* Main Video Feed Area - Expands Fullscreen Edge-to-Edge with Zero Dead Space */}
            <div className="relative h-full flex-1 min-w-0 overflow-hidden">
                {feed.length === 0 ? (
                    loading ? (
                        <ExploreSkeleton />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-4 px-6 text-center bg-black text-white">
                            <p className="text-base font-semibold text-white/90">Couldn&apos;t load Explore feed.</p>
                            <p className="text-xs text-white/55 max-w-xs">
                                Check your connection and try again.
                            </p>
                            <button
                                type="button"
                                onClick={() => void refreshFeed()}
                                className="px-5 py-2.5 rounded-full bg-white text-black text-sm font-bold hover:bg-white/90 active:scale-95 transition-all"
                            >
                                Try again
                            </button>
                        </div>
                    )
                ) : (
                /* Scroll Container — native 60fps snap physics without CSS scroll-smooth fighting touch flings */
                <div
                    ref={containerRef}
                    onScroll={handleScroll}
                    className="w-full h-full overflow-x-hidden overflow-y-scroll snap-y snap-mandatory overscroll-y-contain no-scrollbar"
                    style={{ scrollSnapType: 'y mandatory', WebkitOverflowScrolling: 'touch' }}
                >
                    {feed.map((anime, index) => {
                        const isActive = index === activeIndex;
                        // Keep adjacent trailers mounted & pre-buffered (prev, active, next on mobile; prev..+2 on desktop) for instant TikTok-style playback
                        const preloadTrailer = (isMobileShell() ? index >= activeIndex - 1 && index <= activeIndex + 1 : index >= activeIndex - 1 && index <= activeIndex + 2) && anime.trailer && !failedTrailers.has(anime.id);
                        const animeIdStr = String(anime.id);
                        const inWatchlist = isInWatchList(animeIdStr);
                        const favorited = isFavorite(animeIdStr);
                        const isLiked = likedAnimeIds.has(animeIdStr);

                        const toggleWatchlist = () => {
                            if (inWatchlist) {
                                removeFromWatchList(animeIdStr);
                            } else {
                                logInteraction({
                                    animeId: anime.id,
                                    type: 'watchlist',
                                    genres: anime.genres,
                                    studios: anime.studios,
                                    timestamp: Date.now(),
                                });
                                addToWatchList({
                                    id: animeIdStr,
                                    anilistId: animeIdStr,
                                    malId: anime.idMal ? String(anime.idMal) : undefined,
                                    title: anime.title,
                                    image: anime.coverImage,
                                    status: 'plan_to_watch',
                                    score: anime.averageScore ? anime.averageScore / 10 : 0,
                                    mediaStatus: anime.status || 'FINISHED',
                                    type: 'TV',
                                    totalCount: anime.episodesCount,
                                    genres: anime.genres,
                                    synopsis: anime.synopsis,
                                });
                            }
                        };

                        const isFullscreen = isActive && fullscreenAnimeId === anime.id;

                        return (
                            <section
                                key={`${anime.id}-${index}`}
                                ref={(el) => { cardRefs.current[index] = el; }}
                                aria-label={anime.title}
                                className="w-full h-full snap-start snap-always relative overflow-hidden bg-black flex items-center justify-center shrink-0 will-change-transform after:absolute after:inset-x-0 after:bottom-0 after:h-1 after:bg-black after:z-40 after:pointer-events-none"
                            >
                                {preloadTrailer && (
                                    <div
                                        className={
                                            isFullscreen
                                                ? 'fixed inset-0 w-full h-full z-[2147483647] bg-black flex items-center justify-center overflow-hidden'
                                                : 'w-full -mt-12 md:mt-0 flex flex-col items-center md:contents'
                                        }
                                    >
                                        <div
                                            className={
                                                isFullscreen
                                                    ? 'relative w-full h-full overflow-hidden flex items-center justify-center bg-black'
                                                    : 'relative w-full aspect-video overflow-hidden bg-black flex items-center justify-center md:absolute md:inset-0 md:aspect-auto md:h-full'
                                            }
                                        >
                                            <iframe
                                                ref={(el) => {
                                                    if (el) {
                                                        iframeRefs.current.set(anime.id, el);
                                                    } else {
                                                        iframeRefs.current.delete(anime.id);
                                                        clearTrailerWatchdog(anime.id);
                                                    }
                                                }}
                                                onLoad={(e) => {
                                                    const win = e.currentTarget.contentWindow;
                                                    win?.postMessage(JSON.stringify({ event: 'listening' }), '*');
                                                    for (const event of ['onReady', 'onStateChange', 'onError']) {
                                                        win?.postMessage(JSON.stringify({ event: 'command', func: 'addEventListener', args: [event] }), '*');
                                                    }
                                                    const activeVisualIndex = visualIndexRef.current;
                                                    const activeVisualId = feed[activeVisualIndex]?.id ?? feed[activeIndex]?.id;
                                                    const nextVisualId = feed[activeVisualIndex + 1]?.id ?? feed[activeIndex + 1]?.id;
                                                    const isVisualActive = anime.id === activeVisualId;
                                                    if (isVisualActive && !isPausedRef.current) {
                                                        win?.postMessage(JSON.stringify({ event: 'command', func: isMutedRef.current ? 'mute' : 'unMute', args: [] }), '*');
                                                    } else if (anime.id === nextVisualId) {
                                                        // Already autoplay=1&mute=1 — leave playing silently so YouTube never shows center || / ▶ bezel
                                                        win?.postMessage(JSON.stringify({ event: 'command', func: 'mute', args: [] }), '*');
                                                    } else {
                                                        win?.postMessage(JSON.stringify({ event: 'command', func: 'mute', args: [] }), '*');
                                                        win?.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), '*');
                                                    }
                                                    // Auto-remove region-blocked / dead trailers that never start playing
                                                    armTrailerWatchdog(anime.id, isVisualActive ? 5500 : 7500);
                                                }}
                                                src={
                                                    getRuntimePlatform() === 'ios'
                                                        ? `https://yorumi.cloud/embed.html?v=${encodeURIComponent(anime.trailer!.id)}`
                                                        : `https://www.youtube-nocookie.com/embed/${anime.trailer!.id}?autoplay=1&mute=1&controls=0&playsinline=1&rel=0&modestbranding=1&showinfo=0&disablekb=1&fs=0&iv_load_policy=3&cc_load_policy=0&enablejsapi=1${/^https?:\/\//i.test(window.location.origin) ? `&origin=${encodeURIComponent(window.location.origin)}` : ''}&vq=hd1080`
                                                }
                                                title={anime.title}
                                                className={
                                                    isFullscreen
                                                        ? 'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[152%] h-[176%] pointer-events-none select-none opacity-100'
                                                        : 'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[152%] h-[176%] md:w-[120vw] md:h-[67.5vw] md:min-h-[120%] md:min-w-[213.4vh] object-cover pointer-events-none select-none opacity-100'
                                                }
                                                allow="autoplay; encrypted-media; picture-in-picture"
                                            />
                                            {isActive && isFullscreen && (
                                                <>
                                                    <div
                                                        onPointerDown={(e) => handleSlidePointerDown(e)}
                                                        onPointerMove={handleSlidePointerMove}
                                                        onPointerUp={() => handleSlidePointerEnd()}
                                                        onPointerCancel={() => handleSlidePointerEnd()}
                                                        onContextMenu={(e) => e.preventDefault()}
                                                        onClick={(e) => handleSlideTap(e, anime, true)}
                                                        className="absolute inset-0 z-10 cursor-pointer select-none"
                                                        aria-label="Toggle controls"
                                                    />
                                                    {isFastForwarding && (
                                                        <div className="pointer-events-none absolute left-1/2 top-4 z-[100] flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/10 bg-black/75 px-4 py-2 text-sm font-bold text-white shadow-xl backdrop-blur-sm">
                                                            <span>2x</span>
                                                            <FastForward className="h-4 w-4 fill-current" strokeWidth={2.5} />
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                            {/* Normal 16:9 mobile mode: centered bare Play icon when paused (no container) */}
                                            {!isFullscreen && isActive && isPaused && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        togglePlayPause();
                                                    }}
                                                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 p-2 text-white/95 drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)] active:scale-90 transition-transform focus:outline-none md:hidden"
                                                    aria-label="Play trailer"
                                                >
                                                    <Play className="w-12 h-12 fill-current" />
                                                </button>
                                            )}
                                        </div>

                                        {/* TikTok-style Full screen pill button directly below 16:9 trailer on mobile (always rendered so video never shifts on settle) */}
                                        {!isFullscreen && (
                                            <div className="mt-4 flex justify-center md:hidden relative z-30">
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setShowFullscreenControls(true);
                                                        setFullscreenAnimeId(anime.id);
                                                    }}
                                                    className="inline-flex items-center gap-2 rounded-full bg-white/15 hover:bg-white/25 active:scale-95 px-4 py-2 text-[13px] font-semibold text-white border border-white/15 shadow-lg transition-all focus:outline-none"
                                                    aria-label="Full screen"
                                                >
                                                    <Maximize2 size={14} />
                                                    <span>Full screen</span>
                                                </button>
                                            </div>
                                        )}

                                        {/* Fullscreen Landscape Custom Controls */}
                                        {isFullscreen && (showFullscreenControls || isPaused) && (
                                            <>
                                                <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent px-4 py-3">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setFullscreenAnimeId(null);
                                                        }}
                                                        className="flex min-w-0 items-center gap-2 text-white hover:text-white/80 focus:outline-none"
                                                        aria-label="Exit full screen"
                                                    >
                                                        <ChevronLeft size={24} className="shrink-0" />
                                                        <span className="truncate text-sm sm:text-base font-bold">{anime.title}</span>
                                                    </button>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleMute();
                                                            }}
                                                            className="w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center focus:outline-none"
                                                            aria-label={isMuted ? 'Unmute' : 'Mute'}
                                                        >
                                                            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setFullscreenAnimeId(null);
                                                            }}
                                                            className="w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center focus:outline-none"
                                                            aria-label="Exit full screen"
                                                        >
                                                            <Minimize2 size={18} />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Custom Centered Video Controls (Rewind 10s, Play/Pause, Forward 10s) */}
                                                <div className="absolute inset-0 z-30 flex items-center justify-center gap-9 pointer-events-none">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            seekBy(-10);
                                                        }}
                                                        className="pointer-events-auto relative flex h-12 w-12 items-center justify-center rounded-full text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] active:scale-90 transition-transform focus:outline-none"
                                                        aria-label="Rewind 10 seconds"
                                                    >
                                                        <RotateCcw className="h-7 w-7 stroke-[2]" />
                                                        <span className="absolute text-[9px] font-extrabold mt-0.5">10</span>
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            togglePlayPause();
                                                            setShowFullscreenControls(true);
                                                        }}
                                                        className="pointer-events-auto p-2 text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)] active:scale-90 transition-transform focus:outline-none"
                                                        aria-label={isPaused ? 'Play' : 'Pause'}
                                                    >
                                                        {isPaused ? (
                                                            <Play className="h-12 w-12 fill-current" />
                                                        ) : (
                                                            <Pause className="h-12 w-12 fill-current" />
                                                        )}
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            seekBy(10);
                                                        }}
                                                        className="pointer-events-auto relative flex h-12 w-12 items-center justify-center rounded-full text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] active:scale-90 transition-transform focus:outline-none"
                                                        aria-label="Forward 10 seconds"
                                                    >
                                                        <RotateCw className="h-7 w-7 stroke-[2]" />
                                                        <span className="absolute text-[9px] font-extrabold mt-0.5">10</span>
                                                    </button>
                                                </div>

                                                {/* Bottom Fullscreen Progress & Quick Actions */}
                                                <div className="absolute inset-x-0 bottom-0 z-30 flex flex-col gap-2 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-5 pb-3 pt-4">
                                                    {trailerProgress.duration > 0 && (
                                                        <div className="flex items-center gap-3 text-xs font-medium text-white/90">
                                                            <span className="tabular-nums">
                                                                {formatTrailerTime(trailerProgress.current)} / {formatTrailerTime(trailerProgress.duration)}
                                                            </span>
                                                            <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
                                                                <div
                                                                    className="h-full bg-white transition-[width] duration-200"
                                                                    style={{
                                                                        width: `${Math.min(100, Math.max(0, (trailerProgress.current / trailerProgress.duration) * 100))}%`,
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div className="flex items-center justify-between gap-4">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleWatchlist();
                                                            }}
                                                            className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-semibold text-white focus:outline-none"
                                                        >
                                                            {inWatchlist ? <Check size={14} /> : <Plus size={14} />}
                                                            <span>{inWatchlist ? 'In Watchlist' : 'Watchlist'}</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setFullscreenAnimeId(null);
                                                                navigateToAnime(anime);
                                                            }}
                                                            className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-semibold text-white focus:outline-none"
                                                        >
                                                            <span>Details</span>
                                                            <ExternalLink size={13} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                                {(isActive || index === activeIndex + 1 || index === activeIndex - 1) && !isFullscreen && (
                                    <>
                                        {/* Full-screen gesture surface (above, on, and below video): tap play/pause, double-tap like, hold 2x, swipe left for details */}
                                        <div
                                            onPointerDown={(e) => handleSlidePointerDown(e, anime)}
                                            onPointerMove={handleSlidePointerMove}
                                            onPointerUp={() => handleSlidePointerEnd(navigateToAnime)}
                                            onPointerCancel={() => handleSlidePointerEnd()}
                                            onPointerLeave={(e) => {
                                                if (e.pointerType === 'mouse') {
                                                    handleSlidePointerEnd(navigateToAnime);
                                                }
                                            }}
                                            onContextMenu={(e) => e.preventDefault()}
                                            onClick={(e) => handleSlideTap(e, anime, false)}
                                            className="absolute inset-0 z-10 cursor-pointer touch-pan-y select-none"
                                            aria-label={isPaused ? 'Resume video' : 'Pause video'}
                                        />

                                        {/* 2x Speed Indicator Pill (matching anime player) */}
                                        {isActive && isFastForwarding && (
                                            <div className="pointer-events-none absolute left-1/2 top-[calc(max(env(safe-area-inset-top,0px),16px)+0.5rem)] md:top-5 z-[100] flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/10 bg-black/75 px-4 py-2 text-sm font-bold text-white shadow-xl backdrop-blur-sm">
                                                <span>2x</span>
                                                <FastForward className="h-4 w-4 fill-current" strokeWidth={2.5} />
                                            </div>
                                        )}

                                        {/* Double-tap Heart Burst Animation */}
                                        {isActive && heartBursts.map((burst) => (
                                            <div
                                                key={burst.id}
                                                className="pointer-events-none absolute z-[95]"
                                                style={{
                                                    left: burst.x,
                                                    top: burst.y,
                                                    transform: `translate(-50%, -50%) rotate(${burst.rotate}deg)`,
                                                }}
                                            >
                                                <Heart className="h-24 w-24 fill-rose-500 text-rose-500 drop-shadow-[0_6px_24px_rgba(244,63,94,0.75)] yorumi-explore-heart-pop" />
                                            </div>
                                        ))}
                                    </>
                                )}

                                {/* Top Right Controls: Refresh Session & Sound (desktop & tablet landscape) */}
                                <div
                                    className="hidden md:flex absolute top-4 right-5 md:right-8 z-30 items-center gap-2"
                                    style={isMobileShell() ? { top: 'calc(max(env(safe-area-inset-top, 0px), 16px) + 0.5rem)' } : undefined}
                                >
                                    <button
                                        type="button"
                                        onClick={() => {
                                            void refreshFeed();
                                        }}
                                        className="w-10 h-10 rounded-full bg-black/60 hover:bg-black/85 backdrop-blur-md text-white flex items-center justify-center transition-colors shadow-xl focus:outline-none"
                                        title="Generate Fresh Feed (R)"
                                    >
                                        <RotateCcw size={17} />
                                    </button>

                                    <button
                                        type="button"
                                        onClick={toggleMute}
                                        className="w-10 h-10 rounded-full bg-black/60 hover:bg-black/85 backdrop-blur-md text-white flex items-center justify-center transition-colors shadow-xl focus:outline-none"
                                        title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
                                    >
                                        {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                                    </button>
                                </div>

                                {/* Bottom Overlay: Anime Profile & 1-Row Synopsis (hidden during fullscreen) */}
                                {!isFullscreen && (
                                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/95 via-black/60 to-transparent px-4 sm:px-8 md:px-12 pt-6 pb-5 sm:pb-8 md:pb-8 pr-20 md:pr-32">
                                    {/* Mobile: Clean Text Title */}
                                    <div className="md:hidden">
                                        <h2
                                            onClick={() => navigateToAnime(anime)}
                                            className="pointer-events-auto inline-block max-w-full text-white font-extrabold text-lg sm:text-xl hover:underline cursor-pointer truncate drop-shadow-lg"
                                            title={anime.title}
                                        >
                                            {anime.title}
                                        </h2>
                                    </div>

                                    {/* Desktop: Profile Avatar (Main Character) + Title + +Watchlist Button */}
                                    <div className="hidden md:flex items-center gap-3">
                                        <div
                                            onClick={() => navigateToAnime(anime)}
                                            className="pointer-events-auto w-12 h-12 rounded-full border-2 border-white/30 overflow-hidden cursor-pointer shrink-0 shadow-xl hover:scale-105 transition-transform bg-neutral-900"
                                            title={anime.characterName ? `${anime.characterName} • ${anime.title}` : anime.title}
                                        >
                                            <img
                                                src={anime.characterImage || anime.coverImage}
                                                alt={anime.characterName || anime.title}
                                                className="w-full h-full object-cover object-top"
                                            />
                                        </div>

                                        <div className="flex items-center gap-3 min-w-0">
                                            <h2
                                                onClick={() => navigateToAnime(anime)}
                                                className="pointer-events-auto text-white font-extrabold text-xl md:text-2xl hover:underline cursor-pointer truncate max-w-[420px] md:max-w-[620px] drop-shadow-lg"
                                                title={anime.title}
                                            >
                                                {anime.title}
                                            </h2>

                                            <button
                                                type="button"
                                                onClick={toggleWatchlist}
                                                className={`pointer-events-auto shrink-0 text-xs sm:text-sm font-bold px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full flex items-center gap-1.5 transition-all shadow-lg active:scale-95 ${
                                                    inWatchlist
                                                        ? 'bg-white/20 text-white hover:bg-white/30'
                                                        : 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/30'
                                                }`}
                                            >
                                                {inWatchlist ? <Check size={14} /> : <Plus size={14} />}
                                                <span>{inWatchlist ? 'Added' : 'Watchlist'}</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Row 2: TikTok-style Caption with #genre hashtags & more/less toggle */}
                                    {(() => {
                                        const isExpanded = expandedSynopsisIds.has(anime.id);
                                        const hashtags = (anime.genres || []).map((g) =>
                                            '#' + g.replace(/[^a-zA-Z0-9]/g, '')
                                        );
                                        const rawSynopsis = (anime.synopsis || '').trim();
                                        const needsTruncation = rawSynopsis.length > 95 || hashtags.length > 0;
                                        const shortText = needsTruncation ? getTruncatedSynopsis(rawSynopsis, 95) : rawSynopsis;

                                        return (
                                            <div className="pointer-events-auto mt-2 text-xs sm:text-sm text-neutral-200 max-w-[500px] sm:max-w-[700px] md:max-w-[900px] drop-shadow select-none leading-relaxed">
                                                {isExpanded ? (
                                                    <div className="max-h-36 sm:max-h-48 overflow-y-auto pr-2 no-scrollbar">
                                                        <span>{rawSynopsis}</span>
                                                        {hashtags.length > 0 && (
                                                            <span className="font-semibold text-white/90 ml-1.5 inline-block">
                                                                {hashtags.map((tag) => (
                                                                    <span key={tag} className="mr-1.5 hover:underline cursor-pointer">
                                                                        {tag}
                                                                    </span>
                                                                ))}
                                                            </span>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setExpandedSynopsisIds((prev) => {
                                                                    const next = new Set(prev);
                                                                    next.delete(anime.id);
                                                                    return next;
                                                                });
                                                            }}
                                                            className="font-bold text-white hover:text-neutral-300 ml-1.5 inline-block cursor-pointer focus:outline-none"
                                                        >
                                                            less
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (needsTruncation) {
                                                                setExpandedSynopsisIds((prev) => new Set(prev).add(anime.id));
                                                            } else {
                                                                navigateToAnime(anime);
                                                            }
                                                        }}
                                                        className="cursor-pointer"
                                                    >
                                                        <span>{shortText}</span>
                                                        {needsTruncation && (
                                                            <>
                                                                <span className="text-neutral-400">... </span>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setExpandedSynopsisIds((prev) => new Set(prev).add(anime.id));
                                                                    }}
                                                                    className="font-bold text-white hover:text-neutral-300 ml-1 inline-block cursor-pointer focus:outline-none"
                                                                >
                                                                    more
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                                )}

                                {/* Right Side Vertical Action Bar (TikTok Style) */}
                                {!isFullscreen && (
                                <div className="absolute right-3 sm:right-6 md:right-8 bottom-9 md:bottom-12 z-30 flex flex-col items-center gap-3.5 sm:gap-5">
                                    {/* Up Button - Hidden on mobile */}
                                    <button
                                        type="button"
                                        onClick={() => scrollToIndex(index - 1)}
                                        disabled={index === 0}
                                        className="hidden md:flex w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md text-white items-center justify-center disabled:opacity-20 disabled:pointer-events-none transition-all shadow-xl active:scale-90 focus:outline-none"
                                        title="Previous anime (Up)"
                                    >
                                        <ChevronUp size={26} className="stroke-[2.5]" />
                                    </button>

                                    {/* Down Button - Hidden on mobile */}
                                    <button
                                        type="button"
                                        onClick={() => scrollToIndex(index + 1)}
                                        disabled={index === feed.length - 1}
                                        className="hidden md:flex w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md text-white items-center justify-center disabled:opacity-20 disabled:pointer-events-none transition-all shadow-xl active:scale-90 focus:outline-none mb-1"
                                        title="Next anime (Down)"
                                    >
                                        <ChevronDown size={26} className="stroke-[2.5]" />
                                    </button>

                                    {/* Profile Avatar (Main Character) with + Watchlist Badge - Mobile TikTok style upper to Heart */}
                                    <div className="relative flex md:hidden flex-col items-center mb-1.5">
                                        <button
                                            type="button"
                                            onClick={() => navigateToAnime(anime)}
                                            className="w-12 h-12 rounded-full border-2 border-white/90 overflow-hidden cursor-pointer shadow-xl active:scale-95 transition-transform bg-neutral-900 focus:outline-none"
                                            title={anime.characterName ? `${anime.characterName} • View Details` : `${anime.title} • View Details`}
                                        >
                                            <img
                                                src={anime.characterImage || anime.coverImage}
                                                alt={anime.characterName || anime.title}
                                                className="w-full h-full object-cover object-top"
                                            />
                                        </button>

                                        {/* Overlapping + Badge at bottom edge */}
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleWatchlist();
                                            }}
                                            className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-90 focus:outline-none ${
                                                inWatchlist
                                                    ? 'bg-white text-black ring-1 ring-black/20'
                                                    : 'bg-rose-500 text-white hover:bg-rose-600'
                                            }`}
                                            title={inWatchlist ? 'In Watchlist (Tap to remove)' : 'Add to Watchlist'}
                                        >
                                            {inWatchlist ? (
                                                <Check size={11} className="stroke-[3.5]" />
                                            ) : (
                                                <Plus size={12} className="stroke-[3.5]" />
                                            )}
                                        </button>
                                    </div>

                                    {/* Heart / Like Button (Explore Like only, separate from Favorites) */}
                                    <button
                                        type="button"
                                        onClick={() => toggleLike(anime)}
                                        className="flex flex-col items-center gap-1 text-white group focus:outline-none"
                                        title={isLiked ? 'Unlike' : 'Like'}
                                    >
                                        <div className="transition-transform duration-150 group-hover:scale-110 group-active:scale-90">
                                            <Heart
                                                size={34}
                                                className={`transition-colors ${
                                                    isLiked
                                                        ? 'fill-rose-500 text-rose-500'
                                                        : 'fill-white text-white group-hover:fill-white/85 group-hover:text-white/85'
                                                }`}
                                            />
                                        </div>
                                        <span className="text-[12.5px] font-extrabold text-white tracking-tight">
                                            {(() => {
                                                const baseCount = anime.ratingsCount ?? anime.popularity ?? 0;
                                                const displayCount = baseCount + (isLiked ? 1 : 0);
                                                if (displayCount <= 0) return 'Like';
                                                if (displayCount >= 1_000_000) {
                                                    return `${(Math.floor(displayCount / 100_000) / 10).toFixed(1).replace(/\.0$/, '')}M`;
                                                }
                                                if (displayCount >= 10_000) {
                                                    return `${(Math.floor(displayCount / 100) / 10).toFixed(1)}K`;
                                                }
                                                return displayCount.toLocaleString();
                                            })()}
                                        </span>
                                    </button>

                                    {/* Episodes Button ("Eps") - Hidden if anime is not yet released or upcoming */}
                                    {!isAnimeUpcomingOrUnreleased(anime) && (
                                        <button
                                            type="button"
                                            onClick={() => setSelectedAnimeForEpisodes((prev) => (prev?.id === anime.id ? null : anime))}
                                            className="flex flex-col items-center gap-1 text-white group focus:outline-none"
                                            title="View Episodes"
                                        >
                                            <div className="transition-transform duration-150 group-hover:scale-110 group-active:scale-90">
                                                <svg
                                                    width="33"
                                                    height="33"
                                                    viewBox="0 0 24 24"
                                                    fill="currentColor"
                                                    aria-hidden="true"
                                                    className={`transition-colors ${
                                                        isDrawerOpen && selectedAnimeForEpisodes?.id === anime.id
                                                            ? 'text-rose-500'
                                                            : 'text-white group-hover:text-white/85'
                                                    }`}
                                                >
                                                    <path d="M8.71 2.29a1 1 0 0 0-1.42 1.42L9.59 6H5a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V9a3 3 0 0 0-3-3h-4.59l2.3-2.29a1 1 0 1 0-1.42-1.42L12 5.59 8.71 2.29ZM10 10.75a.75.75 0 0 1 1.14-.64l4.5 2.75a.75.75 0 0 1 0 1.28l-4.5 2.75A.75.75 0 0 1 10 16.25v-5.5Z" />
                                                </svg>
                                            </div>
                                            <span className="text-[12.5px] font-extrabold text-white tracking-tight">
                                                {anime.episodesCount || 'Eps'}
                                            </span>
                                        </button>
                                    )}

                                    {/* Favorite / Bookmark Button */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (favorited) {
                                                void removeFavorite(animeIdStr);
                                            } else {
                                                logInteraction({
                                                    animeId: anime.id,
                                                    type: 'watchlist',
                                                    genres: anime.genres,
                                                    studios: anime.studios,
                                                    timestamp: Date.now(),
                                                });
                                                void addFavorite({
                                                    id: animeIdStr,
                                                    title: anime.title,
                                                    image: anime.coverImage,
                                                    synopsis: anime.synopsis,
                                                });
                                            }
                                        }}
                                        className="flex flex-col items-center gap-1 text-white group focus:outline-none"
                                        title={favorited ? 'Remove from Favorites' : 'Add to Favorites'}
                                    >
                                        <div className="transition-transform duration-150 group-hover:scale-110 group-active:scale-90">
                                            <Bookmark
                                                size={33}
                                                className={`transition-colors ${
                                                    favorited
                                                        ? 'fill-amber-400 text-amber-400'
                                                        : 'fill-white text-white group-hover:fill-white/85 group-hover:text-white/85'
                                                }`}
                                            />
                                        </div>
                                        <span className="text-[12.5px] font-extrabold text-white tracking-tight">
                                            {favorited ? 'Favorited' : 'Favorite'}
                                        </span>
                                    </button>

                                    {/* Hide / Not Interested Button */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            markNotInterested(anime);
                                        }}
                                        className="flex flex-col items-center gap-1 text-white group focus:outline-none"
                                        title="Hide / Not Interested"
                                    >
                                        <div className="transition-transform duration-150 group-hover:scale-110 group-active:scale-90">
                                            <svg
                                                width="32"
                                                height="32"
                                                viewBox="0 0 24 24"
                                                fill="currentColor"
                                                aria-hidden="true"
                                                className="text-white group-hover:text-rose-400 transition-colors"
                                            >
                                                <path d="M3.53 2.47a.75.75 0 0 0-1.06 1.06l18 18a.75.75 0 1 0 1.06-1.06l-2.6-2.6A12.4 12.4 0 0 0 22.86 12c-1.7-3.95-5.73-7-10.86-7-1.69 0-3.28.34-4.73.95L3.53 2.47ZM12 8.25c2.07 0 3.75 1.68 3.75 3.75 0 .64-.16 1.24-.44 1.76l-5.07-5.07c.52-.28 1.12-.44 1.76-.44ZM1.14 12c1.7 3.95 5.73 7 10.86 7 1.46 0 2.86-.25 4.14-.71l-1.94-1.94a5.25 5.25 0 0 1-7.55-7.55L4.34 6.49A12.47 12.47 0 0 0 1.14 12Z" />
                                            </svg>
                                        </div>
                                        <span className="text-[12.5px] font-extrabold text-white tracking-tight">
                                            Hide
                                        </span>
                                    </button>

                                    {/* Details Button - Hidden on mobile since avatar navigates to details */}
                                    <button
                                        type="button"
                                        onClick={() => navigateToAnime(anime)}
                                        className="hidden md:flex flex-col items-center gap-1 text-white group focus:outline-none"
                                        title="View Full Details"
                                    >
                                        <div className="transition-transform duration-150 group-hover:scale-110 group-active:scale-90">
                                            <svg
                                                width="31"
                                                height="31"
                                                viewBox="0 0 24 24"
                                                fill="currentColor"
                                                aria-hidden="true"
                                                className="text-white group-hover:text-white/85 transition-colors"
                                            >
                                                <path fillRule="evenodd" clipRule="evenodd" d="M5 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H5Zm5.5 4a1 1 0 1 0 0 2h3.09l-5.3 5.29a1 1 0 1 0 1.42 1.42L15 10.41v3.09a1 1 0 1 0 2 0V8a1 1 0 0 0-1-1h-5.5Z" />
                                            </svg>
                                        </div>
                                        <span className="text-[12.5px] font-extrabold text-white tracking-tight">
                                            Details
                                        </span>
                                    </button>
                                </div>
                                )}

                            </section>
                        );
                    })}
                </div>
                )}
            </div>

            {/* Right Side Episodes Drawer Panel (matching TikTok desktop comments panel) */}
            <ExploreEpisodesDrawer
                anime={selectedAnimeForEpisodes}
                isOpen={isDrawerOpen}
                onClose={() => setSelectedAnimeForEpisodes(null)}
            />

            {/* Mobile Bottom Progress Bar (portaled to document.body so it sits ON TOP of the navbar border line without clipping) */}
            {typeof document !== 'undefined' &&
                fullscreenAnimeId === null &&
                isPaused &&
                feed[activeIndex] &&
                createPortal(
                    <div
                        onPointerDown={(e) => {
                            e.stopPropagation();
                            if (trailerProgress.duration <= 0) return;
                            isScrubbingRef.current = true;
                            e.currentTarget.setPointerCapture(e.pointerId);
                            const rect = e.currentTarget.getBoundingClientRect();
                            const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
                            const targetSec = ratio * trailerProgress.duration;
                            setTrailerProgress((prev) => ({ ...prev, current: targetSec }));
                            iframeRefs.current.get(feed[activeIndex].id)?.contentWindow?.postMessage(
                                JSON.stringify({ event: 'command', func: 'seekTo', args: [targetSec, true] }),
                                '*'
                            );
                            lastSeekDispatchRef.current = Date.now();
                        }}
                        onPointerMove={(e) => {
                            if (!isScrubbingRef.current || trailerProgress.duration <= 0) return;
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
                            const targetSec = ratio * trailerProgress.duration;
                            setTrailerProgress((prev) => ({ ...prev, current: targetSec }));
                            const now = Date.now();
                            if (now - lastSeekDispatchRef.current > 80) {
                                lastSeekDispatchRef.current = now;
                                iframeRefs.current.get(feed[activeIndex].id)?.contentWindow?.postMessage(
                                    JSON.stringify({ event: 'command', func: 'seekTo', args: [targetSec, false] }),
                                    '*'
                                );
                            }
                        }}
                        onPointerUp={(e) => {
                            if (!isScrubbingRef.current) return;
                            e.stopPropagation();
                            isScrubbingRef.current = false;
                            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                                e.currentTarget.releasePointerCapture(e.pointerId);
                            }
                            if (trailerProgress.duration <= 0) return;
                            const rect = e.currentTarget.getBoundingClientRect();
                            const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
                            const targetSec = ratio * trailerProgress.duration;
                            setTrailerProgress((prev) => ({ ...prev, current: targetSec }));
                            iframeRefs.current.get(feed[activeIndex].id)?.contentWindow?.postMessage(
                                JSON.stringify({ event: 'command', func: 'seekTo', args: [targetSec, true] }),
                                '*'
                            );
                        }}
                        onPointerCancel={() => {
                            isScrubbingRef.current = false;
                        }}
                        className="md:hidden fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom,0px)-1.5px)] z-[2147483605] px-2 pt-5 pb-0 cursor-pointer touch-none"
                    >
                        <div className="relative w-full h-[3px] rounded-full bg-white/25">
                            <div
                                className="relative h-full rounded-full bg-white"
                                style={{
                                    width: `${
                                        trailerProgress.duration > 0
                                            ? Math.min(100, Math.max(0, (trailerProgress.current / trailerProgress.duration) * 100))
                                            : 0
                                    }%`,
                                }}
                            >
                                <span className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_6px_rgba(0,0,0,0.8)]" />
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

            {/* Real AnimeDetailsPage sliding seamlessly from the right while swiping left — identical UI even mid-drag */}
            {peekAnime && createPortal(
                <div
                    ref={peekPanelRef}
                    className={`fixed inset-0 z-[2147483610] bg-[#070707] text-white will-change-transform md:hidden ${
                        isDetailsSheetOpen ? 'overflow-y-auto pointer-events-auto' : 'overflow-hidden pointer-events-none'
                    }`}
                    style={{
                        transform: isDetailsSheetOpen
                            ? 'translate3d(0px, 0, 0)'
                            : `translate3d(${(typeof window !== 'undefined' ? window.innerWidth : 400) + swipeOffsetRef.current}px, 0, 0)`,
                    }}
                >
                    <AnimeDetailsPage
                        embeddedId={`al-${peekAnime.id}`}
                        embeddedAnime={buildExploreDetailsAnime(peekAnime)}
                        deferFetch={!isDetailsSheetOpen}
                        onBack={closeDetailsSheet}
                    />
                </div>,
                document.body
            )}
        </div>
    );
}

import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import type { ExploreCandidate, ExploreInteractionEvent, ExploreSession } from './types';
import { candidatePoolService } from './candidatePoolService';
import { recommendationEngine } from './recommendationEngine';
import { userProfileService } from './userProfileService';

export function useExploreFeed() {
    const location = useLocation();
    const [feed, setFeed] = useState<ExploreCandidate[]>([]);
    const [sessionVersion, setSessionVersion] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    const sessionRef = useRef<ExploreSession | null>(null);
    const candidatePoolRef = useRef<ExploreCandidate[]>([]);
    const sessionRequestIdRef = useRef(0);
    const activeIndexRef = useRef(0);
    const slideStartTimeRef = useRef<number>(Date.now());
    const isPausedRef = useRef(false);

    /**
     * Initializes a brand-new, freshly randomized session and feed.
     */
    const initFreshSession = useCallback(async () => {
        const requestId = ++sessionRequestIdRef.current;

        // Instant synchronous hydration from preloaded / cached pool so trailers start immediately
        const preloaded = candidatePoolService.peekCachedPool();
        if (preloaded.length > 0) {
            const trailerPool = preloaded.filter((item) => item.trailer?.id);
            const sessionPool = trailerPool.length > 0 ? trailerPool : preloaded;
            candidatePoolRef.current = sessionPool;
            const newSession = recommendationEngine.createSession();
            sessionRef.current = newSession;
            const { items, hasMore: more } = recommendationEngine.getNextBatch(newSession, sessionPool, 25);
            setFeed(items);
            setSessionVersion((version) => version + 1);
            setHasMore(more);
            setLoading(false);
            activeIndexRef.current = 0;
            slideStartTimeRef.current = Date.now();
            return;
        }

        setLoading(true);

        try {
            // Retrieve or fetch full diverse candidate pool
            const pool = await candidatePoolService.getCandidatePool();
            if (requestId !== sessionRequestIdRef.current) return; // Stale request cancelled

            // A video feed should start on an item that has a playable trailer.
            const trailerPool = pool.filter((item) => item.trailer?.id);
            const sessionPool = trailerPool.length > 0 ? trailerPool : pool;
            candidatePoolRef.current = sessionPool;

            // Create new unique session with fresh seed and exposure checks
            const newSession = recommendationEngine.createSession();
            sessionRef.current = newSession;

            // Generate initial batch of 25 anime
            const { items, hasMore: more } = recommendationEngine.getNextBatch(newSession, sessionPool, 25);
            if (requestId !== sessionRequestIdRef.current) return;

            setFeed(items);
            setSessionVersion((version) => version + 1);
            setHasMore(more);
            activeIndexRef.current = 0;
            slideStartTimeRef.current = Date.now();
        } catch (err) {
            console.error('[useExploreFeed] Failed to generate explore session:', err);
        } finally {
            if (requestId === sessionRequestIdRef.current) {
                setLoading(false);
            }
        }
    }, []);

    /**
     * Detects genuine page-entry: Every time location.key changes (navigating to Explore from
     * Details, Library, Search, etc.) or on initial mount, initialize a fresh feed.
     */
    useEffect(() => {
        void initFreshSession();
    }, [location.key, initFreshSession]);

    /**
     * Listen for manual refresh requests (e.g. clicking Explore icon in sidebar while already on /explore)
     */
    useEffect(() => {
        const handleRefresh = () => {
            void initFreshSession();
        };

        window.addEventListener('yorumi-explore-refresh', handleRefresh);
        return () => window.removeEventListener('yorumi-explore-refresh', handleRefresh);
    }, [initFreshSession]);

    /**
     * Loads the next batch for the ACTIVE session (pagination without reshuffling existing items).
     */
    const loadMore = useCallback(async () => {
        const session = sessionRef.current;
        if (!session || loadingMore || !hasMore) return;

        setLoadingMore(true);
        try {
            const pool = candidatePoolRef.current.length > 0
                ? candidatePoolRef.current
                : await candidatePoolService.getCandidatePool();

            const { items: nextItems, hasMore: more } = recommendationEngine.getNextBatch(
                session,
                pool,
                15
            );

            if (nextItems.length > 0) {
                setFeed((prev) => {
                    const existingIds = new Set(prev.map((i) => i.id));
                    const filtered = nextItems.filter((i) => !existingIds.has(i.id));
                    return [...prev, ...filtered];
                });
            }
            setHasMore(more);
        } catch (err) {
            console.warn('[useExploreFeed] Failed to load more recommendations:', err);
        } finally {
            setLoadingMore(false);
        }
    }, [hasMore, loadingMore]);

    /**
     * Explicit interaction logger (watchlist, like, details, not_interested).
     */
    const logInteraction = useCallback((event: ExploreInteractionEvent) => {
        userProfileService.recordInteraction(event);
    }, []);

    /**
     * Mark an anime as "Not Interested" (excludes ID permanently and removes it from feed).
     */
    const markNotInterested = useCallback((anime: ExploreCandidate) => {
        logInteraction({
            animeId: anime.id,
            type: 'not_interested',
            genres: anime.genres,
            studios: anime.studios,
            timestamp: Date.now(),
        });

        setFeed((prev) => prev.filter((item) => item.id !== anime.id));
    }, [logInteraction]);

    /**
     * Track dwell/playback time when moving between anime slides.
     */
    const handleSlideChange = useCallback((newIndex: number) => {
        const previousIndex = activeIndexRef.current;
        const now = Date.now();
        const elapsedSec = (now - slideStartTimeRef.current) / 1000;

        const previousAnime = feed[previousIndex];
        if (previousAnime && !isPausedRef.current) {
            // If skipped in under 3.5 seconds, record quick_skip
            if (elapsedSec < 3.5) {
                logInteraction({
                    animeId: previousAnime.id,
                    type: 'quick_skip',
                    genres: previousAnime.genres,
                    studios: previousAnime.studios,
                    timestamp: now,
                    durationWatchedSec: elapsedSec,
                });
            } else if (elapsedSec > 25) {
                // If watched over 25 seconds of the trailer, record strong engagement
                logInteraction({
                    animeId: previousAnime.id,
                    type: 'watch_70',
                    genres: previousAnime.genres,
                    studios: previousAnime.studios,
                    timestamp: now,
                    durationWatchedSec: elapsedSec,
                });
            }
        }

        activeIndexRef.current = newIndex;
        slideStartTimeRef.current = now;
    }, [feed, logInteraction]);

    return {
        feed,
        sessionVersion,
        loading,
        loadingMore,
        hasMore,
        loadMore,
        refreshFeed: initFreshSession,
        logInteraction,
        markNotInterested,
        handleSlideChange,
    };
}


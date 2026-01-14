import { useState, useEffect, useRef } from 'react';
import type { Anime, Episode } from '../types/anime';
import { animeService } from '../services/animeService';
import { useContinueWatching } from './useContinueWatching';


export function useAnime() {
    const { continueWatchingList, saveProgress, removeFromHistory } = useContinueWatching();
    const [topAnime, setTopAnime] = useState<Anime[]>([]);
    const [spotlightAnime, setSpotlightAnime] = useState<Anime[]>([]);
    const [trendingAnime, setTrendingAnime] = useState<Anime[]>([]);
    const [popularSeason, setPopularSeason] = useState<Anime[]>([]);
    const [selectedAnime, setSelectedAnime] = useState<Anime | null>(null);
    const [showAnimeDetails, setShowAnimeDetails] = useState(false);
    const [showWatchModal, setShowWatchModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [trendingLoading, setTrendingLoading] = useState(true);
    const [popularSeasonLoading, setPopularSeasonLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [lastVisiblePage, setLastVisiblePage] = useState(1);
    const [error, setError] = useState<string | null>(null);

    const [episodes, setEpisodes] = useState<Episode[]>([]);
    const [scraperSession, setScraperSession] = useState<string | null>(null);
    const [epLoading, setEpLoading] = useState(false);
    const [episodeSearchQuery, setEpisodeSearchQuery] = useState('');

    // View All State
    const [viewAllAnime, setViewAllAnime] = useState<Anime[]>([]);
    const [viewAllLoading, setViewAllLoading] = useState(false);
    const [viewAllPagination, setViewAllPagination] = useState({
        last_visible_page: 1,
        current_page: 1,
        has_next_page: false
    });



    const scraperSessionCache = useRef(new Map<number, string>());
    const episodesCache = useRef(new Map<string, Episode[]>());

    // Fetch top anime and spotlight
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // 1. Fetch HiAnime spotlight titles and resolve via AniList
                try {
                    const { titles } = await animeService.getHiAnimeSpotlightTitles();
                    if (titles && titles.length > 0) {
                        const resolvedAnime: Anime[] = [];
                        const limitedTitles = titles.slice(0, 8);

                        for (const title of limitedTitles) {
                            try {
                                const searchRes = await animeService.searchAnilist(title);
                                if (searchRes && searchRes.length > 0) {
                                    const aniItem = searchRes[0];
                                    const mappedAnime: Anime = {
                                        mal_id: aniItem.idMal || aniItem.id,
                                        title: aniItem.title.english || aniItem.title.romaji || aniItem.title.native,
                                        images: {
                                            jpg: {
                                                image_url: aniItem.coverImage.large,
                                                large_image_url: aniItem.coverImage.extraLarge
                                            }
                                        },
                                        synopsis: aniItem.description?.replace(/<[^>]*>/g, '') || '',
                                        type: aniItem.format,
                                        episodes: aniItem.episodes,
                                        score: aniItem.averageScore ? aniItem.averageScore / 10 : 0,
                                        status: aniItem.status,
                                        duration: aniItem.duration ? `${aniItem.duration} min` : 'Unknown',
                                        rating: 'Unknown',
                                        genres: aniItem.genres?.map((g: string) => ({ name: g, mal_id: 0 })) || [],
                                        anilist_banner_image: aniItem.bannerImage,
                                        anilist_cover_image: aniItem.coverImage.extraLarge || aniItem.coverImage.large,
                                        latestEpisode: aniItem.nextAiringEpisode ? aniItem.nextAiringEpisode.episode - 1 : undefined
                                    };
                                    resolvedAnime.push(mappedAnime);
                                }
                            } catch (e) {
                                console.error(`Failed to resolve spotlight: ${title}`, e);
                            }
                        }
                        setSpotlightAnime(resolvedAnime);
                    }
                } catch (e) {
                    console.error("Failed to fetch HiAnime spotlight", e);
                }

                // 2. Fetch Top Anime from AniList
                const data = await animeService.getTopAnime(currentPage);
                if (data?.data) {
                    setTopAnime(data.data);
                    setLastVisiblePage(data.pagination?.last_visible_page || 1);
                }
            } catch (err) {
                console.error("Failed to fetch anime", err);
                setError('Failed to fetch anime. Please try again later.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [currentPage]);

    // Fetch Trending Anime (Carousel - Limit 10)
    useEffect(() => {
        const fetchTrending = async () => {
            setTrendingLoading(true);
            try {
                // Fetch limit 10 for carousel
                const trendingData = await animeService.getTrendingAnime(1, 10);
                if (trendingData?.data) {
                    setTrendingAnime(trendingData.data);
                }
            } catch (err) {
                console.error("Failed to fetch trending anime", err);
            } finally {
                setTrendingLoading(false);
            }
        };
        fetchTrending();
    }, []);

    // Fetch Popular This Season (Carousel - Limit 10)
    useEffect(() => {
        const fetchPopularSeason = async () => {
            setPopularSeasonLoading(true);
            try {
                // Fetch limit 10 for carousel
                const popularData = await animeService.getPopularThisSeason(1, 10);
                if (popularData?.data) {
                    setPopularSeason(popularData.data);
                }
            } catch (err) {
                console.error("Failed to fetch popular season anime", err);
            } finally {
                setPopularSeasonLoading(false);
            }
        };

        fetchPopularSeason();
    }, []);

    const [viewMode, setViewMode] = useState<'default' | 'trending' | 'seasonal' | 'continue_watching'>('default');

    // View All Fetcher
    const fetchViewAll = async (type: 'trending' | 'seasonal' | 'continue_watching', page: number) => {
        if (type === 'continue_watching') return; // Local data, no fetch needed

        setViewAllLoading(true);
        try {
            let data;
            if (type === 'trending') {
                data = await animeService.getTrendingAnime(page, 18);
            } else {
                data = await animeService.getPopularThisSeason(page, 18);
            }

            if (data?.data) {
                setViewAllAnime(data.data);
                if (data.pagination) {
                    setViewAllPagination(data.pagination);
                }
            }
        } catch (error) {
            console.error(`Failed to fetch view all ${type}`, error);
        } finally {
            setViewAllLoading(false);
        }
    };

    const openViewAll = (type: 'trending' | 'seasonal' | 'continue_watching') => {
        // Push state only if we are not already in that mode (to avoid double pushes if clicked multiple times, though UI hides it)
        // Actually, we should push to ensure back works.
        window.history.pushState({ modal: 'view_all', type }, '', `#view/${type}`);
        setViewMode(type);
        fetchViewAll(type, 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const closeViewAll = () => {
        if (viewMode !== 'default') {
            window.history.back();
        }
    };

    const changeViewAllPage = (page: number) => {
        if (viewMode !== 'default') {
            fetchViewAll(viewMode, page);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const handleAnimeClick = async (anime: Anime) => {
        setSelectedAnime(anime);
        setShowAnimeDetails(true);

        try {
            // Fetch full details from AniList
            // Use AniList ID if available for robust lookup, otherwise fallback to MAL ID
            const detailsId = anime.id || anime.mal_id;
            const data = await animeService.getAnimeDetails(detailsId);
            if (data?.data) {
                setSelectedAnime(data.data);
            }
        } catch (err) {
            console.error('Failed to fetch anime details', err);
        }

        // Start loading episodes in background for preview
        preloadEpisodes(anime);
    };

    // Internal helper to resolve session and cache episodes without setting state
    const resolveAndCacheEpisodes = async (anime: Anime): Promise<{ session: string | null, eps: Episode[] }> => {
        // Check session cache first
        let session: string | null = null;
        if (scraperSessionCache.current.has(anime.mal_id)) {
            session = scraperSessionCache.current.get(anime.mal_id)!;
        } else {
            // 1. Construct search queries (Title, English, Synonyms)
            const queries = new Set<string>();
            if (anime.title) queries.add(anime.title);
            if (anime.title_english) queries.add(anime.title_english);
            if (anime.synonyms) anime.synonyms.forEach(s => queries.add(s));

            // Limit to top 4 unique queries to avoid spamming
            const queryList = Array.from(queries).slice(0, 4);

            // 2. Run searches in parallel
            try {
                const results = await Promise.all(
                    queryList.map(q => animeService.searchScraper(q).then(res => res || []).catch(() => []))
                );

                const allCandidates = results.flat();

                // 3. Find Best Match
                if (allCandidates.length > 0) {
                    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '');
                    const extractNumbers = (s: string) => (s.match(/\d+/g) || []).map(Number);

                    let bestMatch = null;
                    let maxScore = -1;

                    const targetNumbers = extractNumbers(anime.title + (anime.title_english || ''));

                    for (const candidate of allCandidates) {
                        let score = 0;
                        const candTitle = normalize(candidate.title);

                        // Check against all anime titles/synonyms
                        // Fuzzy Token Overlap
                        const cleanTokens = (str: string) => new Set(str.split(/\s+/).filter(t => t.length > 2));
                        const cTokens = cleanTokens(candTitle);

                        let maxOverlap = 0;

                        for (const q of queries) {
                            const qTokens = cleanTokens(normalize(q));
                            let matches = 0;
                            qTokens.forEach(t => {
                                if (cTokens.has(t)) matches++;
                            });

                            const overlap = qTokens.size > 0 ? matches / qTokens.size : 0;
                            if (overlap > maxOverlap) maxOverlap = overlap;
                        }

                        if (maxOverlap >= 0.75) {
                            score += 15;
                        } else if (maxOverlap >= 0.5) {
                            score += 5;
                        }

                        for (const q of queries) {
                            const queryNorm = normalize(q);
                            if (candTitle.includes(queryNorm) || queryNorm.includes(candTitle)) {
                                score += 5;
                                break;
                            }
                        }

                        // CRITICAL: Number Check (Season matching)
                        const candNumbers = extractNumbers(candidate.title);
                        if (targetNumbers.length > 0) {
                            if (candNumbers.length === 0) {
                                score -= 5;
                            } else {
                                const hasOverlap = targetNumbers.some(n => candNumbers.includes(n));
                                if (!hasOverlap) {
                                    score -= 20; // Heavy penalty for number mismatch
                                }
                            }
                        }

                        if (score > maxScore) {
                            maxScore = score;
                            bestMatch = candidate;
                        }
                    }

                    if (bestMatch && maxScore > -10) {
                        session = bestMatch.session;
                        if (session) scraperSessionCache.current.set(anime.mal_id, session);
                    } else if (allCandidates.length > 0) {
                        // Fallback
                        session = allCandidates[0].session;
                    }
                }
            } catch (e) {
                console.error("Error resolving scraper session", e);
            }
        }

        if (session) {
            if (episodesCache.current.has(session)) {
                return { session, eps: episodesCache.current.get(session)! };
            } else {
                try {
                    const epData = await animeService.getEpisodes(session);
                    const newEpisodes = epData?.episodes || epData?.ep_details || (Array.isArray(epData) ? epData : []);
                    if (newEpisodes.length > 0) {
                        episodesCache.current.set(session, newEpisodes);
                        return { session, eps: newEpisodes };
                    } else {
                        // Invalidate session if no episodes found, so we try searching again next time
                        scraperSessionCache.current.delete(anime.mal_id);
                    }
                } catch (e) {
                    console.error("Error fetching episodes", e);
                    scraperSessionCache.current.delete(anime.mal_id);
                }
            }
        }

        return { session, eps: [] };
    };

    // Preload episodes for details modal preview (Updates State)
    const preloadEpisodes = async (anime: Anime) => {
        // Optimization: Check cache synchronously first to prevent flash
        if (scraperSessionCache.current.has(anime.mal_id)) {
            const session = scraperSessionCache.current.get(anime.mal_id)!;
            if (episodesCache.current.has(session)) {
                setEpisodes(episodesCache.current.get(session)!);
                setScraperSession(session);
                return;
            }
        }

        setEpLoading(true);
        setEpisodes([]);
        setScraperSession(null);

        try {
            const { session, eps } = await resolveAndCacheEpisodes(anime);
            if (session) setScraperSession(session);
            if (eps.length > 0) setEpisodes(eps);
        } catch (e) {
            console.error('Failed to preload episodes', e);
        } finally {
            setEpLoading(false);
        }
    };

    // Prefetch episodes in background (Does NOT update state unless logic requires, mostly populates cache)
    const prefetchEpisodes = async (anime: Anime) => {
        // Prevent redundant prefetches if already cached
        if (scraperSessionCache.current.has(anime.mal_id)) {
            const session = scraperSessionCache.current.get(anime.mal_id)!;
            if (episodesCache.current.has(session)) return; // Already fully cached
        }

        // Run silently
        resolveAndCacheEpisodes(anime).catch(err => console.error("Prefetch error", err));
    };

    const startWatching = async () => {
        if (!selectedAnime) return;

        // Episodes are already preloaded from handleAnimeClick, just switch modals
        setShowAnimeDetails(false);
        setShowWatchModal(true);

        // If episodes aren't loaded yet (edge case), load them now
        if (episodes.length === 0 && !epLoading && !scraperSession) {
            preloadEpisodes(selectedAnime);
        }
    };

    // Handle browser back button for modals and view all
    useEffect(() => {
        const onPopState = (event: PopStateEvent) => {
            const state = event.state;

            // If we're going back from watch modal, re-show details modal
            if (showWatchModal && state?.modal === 'details') {
                setShowWatchModal(false);
                setShowAnimeDetails(true);
                // Episodes are already loaded, no need to reload
                return;
            }

            // Otherwise handle closing modals normally
            if (showWatchModal) {
                setShowWatchModal(false);
                setShowAnimeDetails(false);
                setSelectedAnime(null);
                setEpisodes([]);
                setEpisodeSearchQuery('');
            } else if (showAnimeDetails) {
                setShowAnimeDetails(false);
                setSelectedAnime(null);
            } else if (viewMode !== 'default') {
                setViewMode('default');
                setViewAllAnime([]);
            }
        };

        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, [showWatchModal, showAnimeDetails, viewMode]);

    const closeDetails = () => {
        if (showAnimeDetails) window.history.back();
    };

    const closeWatch = () => {
        if (showWatchModal) window.history.back();
    };

    // Close all modals without affecting history (used when search starts)
    const closeAllModals = () => {
        if (showWatchModal || showAnimeDetails) {
            setShowWatchModal(false);
            setShowAnimeDetails(false);
            setSelectedAnime(null);
            setEpisodes([]);
            setEpisodeSearchQuery('');
            // Clear the hash without adding to history
            window.history.replaceState(null, '', window.location.pathname);
        }
    };

    const handleAnimeClickWithHistory = async (anime: Anime) => {
        window.history.pushState({ modal: 'details', id: anime.mal_id }, '', `#anime/${anime.mal_id}`);
        await handleAnimeClick(anime);
    };

    // Watch anime directly (for Watch Now buttons on cards/hero)
    const watchAnime = async (anime: Anime) => {
        setSelectedAnime(anime);
        setShowAnimeDetails(false);
        setShowWatchModal(true);
        window.history.pushState({ modal: 'watch' }, '', `#watch/${anime.mal_id}`);

        // Preload episodes
        preloadEpisodes(anime);
    };

    const startWatchingWithHistory = () => {
        window.history.pushState({ modal: 'watch' }, '', `#watch/${selectedAnime?.mal_id}`);
        startWatching();
    };

    const changePage = (page: number) => {
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Prefetch page (Top Anime)
    const prefetchPage = async (page: number) => {
        if (page < 1 || page > lastVisiblePage) return;
        try {
            // Just calling getTopAnime will cache it
            await animeService.getTopAnime(page);
        } catch (e) {
            console.error("Prefetch page error", e);
        }
    };

    return {
        // State
        topAnime,
        selectedAnime,
        showAnimeDetails,
        showWatchModal,
        episodes,
        scraperSession,
        epLoading,
        episodeSearchQuery,
        loading,
        currentPage,
        lastVisiblePage,
        error,

        // Actions
        setEpisodeSearchQuery,
        handleAnimeClick: handleAnimeClickWithHistory,
        startWatching: startWatchingWithHistory,
        watchAnime,
        closeDetails,
        closeWatch,
        closeAllModals,
        changePage,
        spotlightAnime,
        trendingAnime,
        trendingLoading,
        popularSeason,
        popularSeasonLoading,

        // View All Exports
        viewAllAnime,
        viewAllLoading,
        viewAllPagination,
        viewMode,
        openViewAll,
        closeViewAll,
        changeViewAllPage,

        // Continue Watching
        continueWatchingList,
        saveProgress,
        removeFromHistory,

        // Prefetching
        prefetchEpisodes,
        prefetchPage
    };
}


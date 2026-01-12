import { useState, useEffect, useRef } from 'react';
import type { Anime, Episode } from '../types/anime';
import { animeService } from '../services/animeService';


export function useAnime() {
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

    const [viewMode, setViewMode] = useState<'default' | 'trending' | 'seasonal'>('default');

    // View All Fetcher
    const fetchViewAll = async (type: 'trending' | 'seasonal', page: number) => {
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

    const openViewAll = (type: 'trending' | 'seasonal') => {
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
            const data = await animeService.getAnimeDetails(anime.mal_id);
            if (data?.data) {
                setSelectedAnime(data.data);
            }
        } catch (err) {
            console.error('Failed to fetch anime details', err);
        }

        // Start loading episodes in background for preview
        preloadEpisodes(anime);
    };

    // Preload episodes for details modal preview
    const preloadEpisodes = async (anime: Anime) => {
        setEpLoading(true);
        setEpisodes([]);
        setScraperSession(null);

        try {
            const resolveScraperSession = async () => {
                if (scraperSessionCache.current.has(anime.mal_id)) {
                    return scraperSessionCache.current.get(anime.mal_id)!;
                }
                const searchData = await animeService.searchScraper(anime.title);
                if (searchData?.length > 0) {
                    const session = searchData[0].session;
                    scraperSessionCache.current.set(anime.mal_id, session);
                    return session;
                }
                return null;
            };

            const session = await resolveScraperSession();
            if (session) {
                setScraperSession(session);
                if (episodesCache.current.has(session)) {
                    setEpisodes(episodesCache.current.get(session)!);
                } else {
                    const epData = await animeService.getEpisodes(session);
                    const newEpisodes = epData?.episodes || epData?.ep_details || (Array.isArray(epData) ? epData : []);
                    if (newEpisodes.length > 0) {
                        episodesCache.current.set(session, newEpisodes);
                        setEpisodes(newEpisodes);
                    }
                }
            }
        } catch (e) {
            console.error('Failed to preload episodes', e);
        } finally {
            setEpLoading(false);
        }
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
        const onPopState = () => {
            if (showWatchModal) {
                setShowWatchModal(false);
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

    const handleAnimeClickWithHistory = async (anime: Anime) => {
        window.history.pushState({ modal: 'details', id: anime.mal_id }, '', `#anime/${anime.mal_id}`);
        await handleAnimeClick(anime);
    };

    const startWatchingWithHistory = () => {
        window.history.pushState({ modal: 'watch' }, '', `#watch/${selectedAnime?.mal_id}`);
        startWatching();
    };

    const changePage = (page: number) => {
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
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
        closeDetails,
        closeWatch,
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
        changeViewAllPage
    };
}


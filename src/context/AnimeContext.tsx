import { createContext, useContext, useState, useRef, useEffect, type ReactNode } from 'react';
import type { Anime, Episode } from '../types/anime';
import { animeService } from '../services/animeService';
import { useContinueWatching } from '../hooks/useContinueWatching';

interface AnimeContextType {
    // State
    topAnime: Anime[];
    spotlightAnime: Anime[];
    trendingAnime: Anime[];
    popularSeason: Anime[];
    selectedAnime: Anime | null;
    showAnimeDetails: boolean;
    showWatchModal: boolean;
    episodes: Episode[];
    scraperSession: string | null;
    epLoading: boolean;
    detailsLoading: boolean;
    loading: boolean;
    trendingLoading: boolean;
    popularSeasonLoading: boolean;
    currentPage: number;
    lastVisiblePage: number;
    error: string | null;
    episodeSearchQuery: string;

    // View All State
    viewAllAnime: Anime[];
    viewAllLoading: boolean;
    viewAllPagination: {
        last_visible_page: number;
        current_page: number;
        has_next_page: boolean;
    };
    viewMode: 'default' | 'trending' | 'seasonal' | 'continue_watching' | 'popular';

    // Actions
    setEpisodeSearchQuery: (query: string) => void;
    handleAnimeClick: (anime: Anime) => Promise<void>;
    startWatching: () => void;
    watchAnime: (anime: Anime) => void;
    closeDetails: () => void;
    closeWatch: () => void;
    closeAllModals: () => void;
    changePage: (page: number) => void;
    openViewAll: (type: 'trending' | 'seasonal' | 'continue_watching' | 'popular') => void;
    closeViewAll: () => void;
    changeViewAllPage: (page: number) => void;
    prefetchEpisodes: (anime: Anime) => void;
    prefetchPage: (page: number) => void;
    fetchHomeData: () => Promise<void>;

    // Continue Watching
    continueWatchingList: any[];
    saveProgress: (anime: Anime, episode: any) => void;
    removeFromHistory: (malId: number) => void;
}

const AnimeContext = createContext<AnimeContextType | undefined>(undefined);

export function AnimeProvider({ children }: { children: ReactNode }) {
    const { continueWatchingList, saveProgress, removeFromHistory } = useContinueWatching();

    // Data State
    const [topAnime, setTopAnime] = useState<Anime[]>([]);
    const [spotlightAnime, setSpotlightAnime] = useState<Anime[]>([]);
    const [trendingAnime, setTrendingAnime] = useState<Anime[]>([]);
    const [popularSeason, setPopularSeason] = useState<Anime[]>([]);
    const [selectedAnime, setSelectedAnime] = useState<Anime | null>(null);

    // UI State (Modals - Kept for compatibility but might not be used in page router mainly)
    const [showAnimeDetails, setShowAnimeDetails] = useState(false);
    const [showWatchModal, setShowWatchModal] = useState(false);

    // Loading States
    const [loading, setLoading] = useState(true);
    const [trendingLoading, setTrendingLoading] = useState(true);
    const [popularSeasonLoading, setPopularSeasonLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [lastVisiblePage, setLastVisiblePage] = useState(1);

    // Episode State
    const [episodes, setEpisodes] = useState<Episode[]>([]);
    const [scraperSession, setScraperSession] = useState<string | null>(null);
    const [epLoading, setEpLoading] = useState(false);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [episodeSearchQuery, setEpisodeSearchQuery] = useState('');

    // View All State
    const [viewMode, setViewMode] = useState<'default' | 'trending' | 'seasonal' | 'continue_watching'>('default');
    const [viewAllAnime, setViewAllAnime] = useState<Anime[]>([]);
    const [viewAllLoading, setViewAllLoading] = useState(false);
    const [viewAllPagination, setViewAllPagination] = useState({
        last_visible_page: 1,
        current_page: 1,
        has_next_page: false
    });

    // Caches
    const scraperSessionCache = useRef(new Map<number, string>());
    const episodesCache = useRef(new Map<string, Episode[]>());

    // --- Actions ---

    const fetchHomeData = async () => {
        const fetchSpotlight = async () => {
            if (spotlightAnime.length > 0) return;
            try {
                const { titles } = await animeService.getHiAnimeSpotlightTitles();
                if (titles && titles.length > 0) {
                    const limitedTitles = titles.slice(0, 6);

                    // Parallelize the search for each title
                    const results = await Promise.all(
                        limitedTitles.map(async (title: string) => {
                            try {
                                const searchRes = await animeService.searchAnilist(title);
                                if (searchRes && searchRes.length > 0) {
                                    const aniItem = searchRes[0];
                                    return {
                                        mal_id: aniItem.idMal || aniItem.id,
                                        title: aniItem.title.english || aniItem.title.romaji || aniItem.title.native,
                                        images: {
                                            jpg: { image_url: aniItem.coverImage.large, large_image_url: aniItem.coverImage.extraLarge }
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
                                    } as Anime;
                                }
                            } catch (e) {
                                return null;
                            }
                            return null;
                        })
                    );

                    const resolvedAnime = results.filter((item): item is Anime => item !== null);
                    if (resolvedAnime.length > 0) setSpotlightAnime(resolvedAnime);
                }
            } catch (e) {
                console.error("Failed to fetch HiAnime spotlight", e);
            }
        };

        const fetchTrending = async () => {
            if (trendingAnime.length > 0) return;
            setTrendingLoading(true);
            try {
                const tData = await animeService.getTrendingAnime(1, 10);
                if (tData?.data) setTrendingAnime(tData.data);
            } catch (e) { console.error(e); }
            finally { setTrendingLoading(false); }
        };

        const fetchPopular = async () => {
            if (popularSeason.length > 0) return;
            setPopularSeasonLoading(true);
            try {
                const pData = await animeService.getPopularThisSeason(1, 10);
                if (pData?.data) setPopularSeason(pData.data);
            } catch (e) { console.error(e); }
            finally { setPopularSeasonLoading(false); }
        };

        // Execute all fetches in parallel
        await Promise.all([
            fetchSpotlight(),
            fetchTrending(),
            fetchPopular()
        ]);
    };

    // --- Pagination Effect ---
    // Re-fetch Top Anime when page changes
    useEffect(() => {
        const fetchPageData = async () => {
            setLoading(true);
            try {
                // If we already have data for page 1 and it's the initial load, maybe skip?
                // But simplified: just fetch.
                const data = await animeService.getTopAnime(currentPage);
                if (data?.data) {
                    setTopAnime(data.data);
                    setLastVisiblePage(data.pagination?.last_visible_page || 1);
                }
            } catch (err) {
                console.error("Failed to fetch top anime page", currentPage, err);
                setError('Failed to fetch anime.');
            } finally {
                setLoading(false);
            }
        };

        fetchPageData();
    }, [currentPage]);

    // --- Helpers ---

    const resolveAndCacheEpisodes = async (anime: Anime): Promise<{ session: string | null, eps: Episode[] }> => {
        let session: string | null = null;

        // Helper to normalize strings for comparison
        const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');

        // Helper to extract season number
        const getSeason = (title: string) => {
            const match = title.match(/season\s*(\d+)|(\d+)(st|nd|rd|th)\s*season/i);
            return match ? parseInt(match[1] || match[2]) : 1;
        };

        // Helper to score closeness
        const getScore = (candidate: any, target: Anime) => {
            let score = 0;
            const canTitle = candidate.title || '';
            const tgtTitle = target.title || '';

            // 1. Text Similarity (Simple includes check + length proximity)
            if (normalize(canTitle).includes(normalize(tgtTitle)) || normalize(tgtTitle).includes(normalize(canTitle))) {
                score += 10;
            }

            // 2. Season Matching
            const targetSeason = getSeason(tgtTitle) || (target.season ? 1 : 1); // Default to 1 if not specified
            const candidateSeason = getSeason(canTitle);

            // Explicit Season Mismatch is a huge penalty
            if (candidateSeason === targetSeason) {
                score += 50; // Strong match for correct season
            } else {
                // Mismatch case
                if (targetSeason > 1 && candidateSeason === 1 && !canTitle.toLowerCase().includes('season')) {
                    // Target is Season 2+, candidate looks like implicit Season 1
                    // Check for subtitle/year rescue
                    let isYearMatch = false;
                    if (candidate.year && target.year) {
                        const yearDiff = Math.abs(parseInt(candidate.year) - target.year);
                        if (yearDiff <= 1) isYearMatch = true;
                    }

                    if (isYearMatch) {
                        score += 30; // Rescue! It's likely the correct season with a subtitle
                    } else {
                        score -= 50; // Penalty
                    }
                } else if (candidateSeason !== targetSeason) {
                    // Explicit mismatch (e.g. Season 2 vs Season 3)
                    score -= 50;
                }
            }

            // 3. Year Matching
            if (candidate.year && target.year) {
                const yearDiff = Math.abs(parseInt(candidate.year) - target.year);
                if (yearDiff <= 1) score += 5;
                else if (yearDiff > 2) score -= 10; // Large gap implies different series/remake
            }

            // 4. Type Matching
            if (candidate.type && target.type) {
                if (candidate.type.toLowerCase() === target.type.toLowerCase()) score += 3;
            }

            return score;
        };

        if (scraperSessionCache.current.has(anime.mal_id)) {
            session = scraperSessionCache.current.get(anime.mal_id)!;
        } else {
            const queries = new Set<string>();
            if (anime.title) queries.add(anime.title);
            if (anime.title_english) queries.add(anime.title_english);
            // Limit synonyms to avoid too many requests
            if (anime.synonyms) anime.synonyms.slice(0, 2).forEach(s => queries.add(s));

            const queryList = Array.from(queries).slice(0, 3); // Max 3 queries

            try {
                // Fetch all candidates from all queries
                const results = await Promise.all(
                    queryList.map(q => animeService.searchScraper(q).then(res => res || []).catch(() => []))
                );

                // Flatten and deduplicate by session ID
                const allCandidates = Array.from(new Map(
                    results.flat().map((c: any) => [c.session, c])
                ).values());

                if (allCandidates.length > 0) {
                    // Find Best Match
                    let bestMatch = null;
                    let maxScore = -100;

                    for (const candidate of allCandidates) {
                        const score = getScore(candidate, anime);
                        if (score > maxScore) {
                            maxScore = score;
                            bestMatch = candidate;
                        }
                    }

                    if (bestMatch && maxScore > 0) { // Threshold for acceptance
                        session = bestMatch.session;
                        scraperSessionCache.current.set(anime.mal_id, bestMatch.session);
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

                    // Enrich with metadata titles if available
                    if (newEpisodes.length > 0) {
                        // 1. Try AniList Metadata first (Fast, already in memory)
                        if (anime.episodeMetadata?.length) {
                            newEpisodes.forEach((ep: Episode) => {
                                if (!ep.title || ep.title === 'Untitled' || !ep.title.trim()) {
                                    const epNum = parseFloat(ep.episodeNumber);
                                    if (!isNaN(epNum)) {
                                        const meta = anime.episodeMetadata?.find(m => {
                                            const match = m.title?.match(/Episode\s+(\d+)/i);
                                            return match && parseFloat(match[1]) === epNum;
                                        });
                                        if (meta) {
                                            const cleanMatch = meta.title.match(/Episode\s+\d+\s*[-:]?\s*(.*)/i);
                                            if (cleanMatch && cleanMatch[1]) ep.title = cleanMatch[1];
                                            else ep.title = meta.title;
                                        }
                                    }
                                }
                            });
                        }

                        // 2. Check if we still have untitled episodes and fallback to Jikan (Slower, network request)
                        const hasUntitled = newEpisodes.some((ep: Episode) => !ep.title || ep.title === 'Untitled');
                        if (hasUntitled) {
                            try {
                                // Only fetch if we have a MAL ID
                                if (anime.mal_id) {
                                    const jikanEps = await animeService.getJikanEpisodes(anime.mal_id);
                                    if (jikanEps && jikanEps.length > 0) {
                                        newEpisodes.forEach((ep: Episode) => {
                                            if (!ep.title || ep.title === 'Untitled' || !ep.title.trim()) {
                                                const epNum = parseFloat(ep.episodeNumber);
                                                // Match against Jikan's 'episode_id' which typically is the episode number
                                                const jikanEp = jikanEps.find((j: any) => j.episode_id === epNum);
                                                if (jikanEp && jikanEp.title) {
                                                    ep.title = jikanEp.title;
                                                }
                                            }
                                        });
                                    }
                                }
                            } catch (e) {
                                console.error("Failed to fetch Jikan fallback", e);
                            }
                        }
                    }

                    if (newEpisodes.length > 0) {
                        episodesCache.current.set(session, newEpisodes);
                        return { session, eps: newEpisodes };
                    }
                } catch (e) {
                    scraperSessionCache.current.delete(anime.mal_id);
                }
            }
        }
        return { session, eps: [] };
    };

    const preloadEpisodes = async (anime: Anime) => {
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

    // --- Actions ---

    const handleAnimeClick = async (anime: Anime) => {
        let currentAnime = anime;

        // Only set optimistic state if we have a valid anime object (with images)
        if (anime.images) {
            setSelectedAnime(currentAnime);
        }

        setDetailsLoading(true); // Start loading details

        try {
            const detailsId = anime.id || anime.mal_id;
            const data = await animeService.getAnimeDetails(detailsId);
            if (data?.data) {
                currentAnime = data.data;
                setSelectedAnime(currentAnime);
            }
        } catch (err) {
            console.error('Failed to fetch details', err);
        } finally {
            setDetailsLoading(false); // Stop loading regardless of success
        }

        preloadEpisodes(currentAnime);
    };

    const startWatching = () => {
        setShowAnimeDetails(false);
        setShowWatchModal(true);
        if (episodes.length === 0 && !epLoading && !scraperSession && selectedAnime) {
            preloadEpisodes(selectedAnime);
        }
    };

    const watchAnime = (anime: Anime) => {
        setSelectedAnime(anime);
        setShowAnimeDetails(false);
        setShowWatchModal(true);
        preloadEpisodes(anime);
    };

    const closeDetails = () => {
        setShowAnimeDetails(false);
        // Clean up or navigate back if needed?
        // With Router, the user uses browser back. 
        // This might act as a "clear selection"
        setSelectedAnime(null);
    };

    const closeWatch = () => {
        setShowWatchModal(false);
        // Return to details? 
        setShowAnimeDetails(true);
    };

    const closeAllModals = () => {
        setShowWatchModal(false);
        setShowAnimeDetails(false);
        setSelectedAnime(null);
        setEpisodes([]);
    };

    const changePage = (page: number) => {
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const prefetchEpisodes = (anime: Anime) => {
        resolveAndCacheEpisodes(anime).catch(console.error);
    };

    const prefetchPage = (page: number) => {
        if (page <= lastVisiblePage) {
            animeService.getTopAnime(page);
        }
    };

    // View All Logic
    const fetchViewAll = async (type: 'trending' | 'seasonal' | 'continue_watching' | 'popular', page: number) => {
        if (type === 'continue_watching') return;

        setViewAllLoading(true);
        try {
            let data;
            if (type === 'trending') data = await animeService.getTrendingAnime(page, 18);
            else if (type === 'seasonal') data = await animeService.getPopularThisSeason(page, 18);
            else if (type === 'popular') data = await animeService.getTopAnime(page); // Re-use getTopAnime for "View All" pagination

            if (data?.data) {
                setViewAllAnime(data.data);
                if (data.pagination) setViewAllPagination(data.pagination);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setViewAllLoading(false);
        }
    };

    const openViewAll = (type: any) => {
        setViewMode(type);
        // If continue_watching, data is already local, no fetch needed
        if (type !== 'continue_watching') {
            fetchViewAll(type, 1);
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const closeViewAll = () => {
        setViewMode('default');
        setViewAllAnime([]);
    };

    const changeViewAllPage = (page: number) => {
        fetchViewAll(viewMode as any, page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <AnimeContext.Provider value={{
            topAnime, spotlightAnime, trendingAnime, popularSeason, selectedAnime,
            showAnimeDetails, showWatchModal, episodes, scraperSession, epLoading,
            detailsLoading, loading, trendingLoading, popularSeasonLoading, currentPage, lastVisiblePage,
            error, episodeSearchQuery, viewAllAnime, viewAllLoading, viewAllPagination,
            viewMode, setEpisodeSearchQuery, handleAnimeClick, startWatching,
            watchAnime, closeDetails, closeWatch, closeAllModals, changePage,
            openViewAll, closeViewAll, changeViewAllPage, prefetchEpisodes, prefetchPage,
            continueWatchingList, saveProgress, removeFromHistory, fetchHomeData
        }}>
            {children}
        </AnimeContext.Provider>
    );
}

export const useAnime = () => {
    const context = useContext(AnimeContext);
    if (context === undefined) {
        throw new Error('useAnime must be used within an AnimeProvider');
    }
    return context;
};

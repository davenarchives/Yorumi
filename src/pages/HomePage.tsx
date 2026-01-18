import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import AnimeCard from '../components/AnimeCard';
import Pagination from '../components/Pagination';
import LoadingSpinner from '../components/LoadingSpinner';
import TrendingNow from '../components/TrendingNow';
import PopularSeason from '../components/PopularSeason';
import Carousel from '../components/Carousel';
import SpotlightHero from '../components/SpotlightHero';
import EstimatedSchedule from '../components/EstimatedSchedule';
import Genres from '../components/Genres';
import { useAnime } from '../hooks/useAnime';
import type { Anime } from '../types/anime';

export default function HomePage() {
    const navigate = useNavigate();
    const anime = useAnime();

    useEffect(() => {
        anime.fetchHomeData();
    }, []);

    // Navigation Handlers
    const handleAnimeClick = (item: Anime) => {
        const animeId = item.id || item.mal_id;
        navigate(`/anime/${animeId}`, { state: { anime: item } });
    };

    const handleWatchClick = (item: Anime, episodeNumber?: number) => {
        const url = episodeNumber ? `/watch/${item.mal_id}?ep=${episodeNumber}` : `/watch/${item.mal_id}`;
        navigate(url, { state: { anime: item } });
    };



    // Scroll to top on mount
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [anime.currentPage]);

    // View All / Continue Watching Handlers
    // Note: These views might be better as sub-routes like /trending or /popular
    // But for now, we can keep the conditional rendering WITHIN HomePage if we want,
    // OR make them separate pages.
    // Given the "proper routes" goal, /trending, /seasonal should probably be routes.
    // But let's stick to the existing "View Mode" internal state for now to minimize scope creep,
    // as the user mainly asked for Detail/Watch pages.
    // We can refactor ViewAll to routes later if needed.

    if (anime.loading && anime.currentPage === 1) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <LoadingSpinner size="lg" text="Loading Anime..." />
            </div>
        );
    }

    if (anime.error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center text-red-500">
                <p className="text-xl mb-4">{anime.error}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-red-500/10 border border-red-500 rounded hover:bg-red-500/20"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen pb-20">
            {/* Spotlight Hero - Only on default view & page 1 */}
            {anime.viewMode === 'default' && anime.currentPage === 1 && (
                <SpotlightHero
                    animeList={anime.spotlightAnime}
                    onAnimeClick={handleAnimeClick}
                    onWatchClick={handleWatchClick}
                />
            )}

            <div className={`container mx-auto px-4 z-10 relative ${!(anime.viewMode === 'default' && anime.currentPage === 1) ? 'pt-24' : 'mt-8'
                }`}>

                {/* View Mode: Continue Watching */}
                {anime.viewMode === 'continue_watching' ? (
                    <div className="pb-12 min-h-screen">
                        <div className="flex items-center gap-4 mb-8">
                            <button
                                onClick={anime.closeViewAll}
                                className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5 text-white" />
                            </button>
                            <h2 className="text-2xl font-black text-white tracking-wide uppercase">Continue Watching</h2>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                            {anime.continueWatchingList.map((item) => (
                                <div
                                    key={item.animeId}
                                    className="relative group cursor-pointer"
                                    onClick={() => handleWatchClick({ mal_id: parseInt(item.animeId) } as Anime, item.episodeNumber)}
                                >
                                    <div className="relative aspect-video rounded-lg overflow-hidden mb-3 shadow-lg border border-white/5 transition-colors">
                                        <img
                                            src={item.animeImage}
                                            alt={item.animeTitle}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform shadow-xl">
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white ml-1">
                                                    <path fillRule="evenodd" d="M4.5 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                        </div>
                                        <div className="absolute top-2 left-2 bg-black/60 backdrop-blur text-white text-[10px] font-bold px-1.5 py-0.5 rounded border border-white/10">
                                            EP {item.episodeNumber}
                                        </div>
                                    </div>
                                    <div className="px-1">
                                        <h4 className="text-sm font-bold text-gray-200 truncate group-hover:text-yorumi-accent transition-colors">
                                            {item.animeTitle}
                                        </h4>
                                        <p className="text-xs text-gray-500 truncate mt-0.5">
                                            {item.episodeTitle || `Episode ${item.episodeNumber}`}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : anime.viewMode === 'trending' ? (
                    /* View Mode: Trending */
                    <div className="pb-12 min-h-screen">
                        <div className="flex items-center gap-4 mb-8">
                            <button
                                onClick={anime.closeViewAll}
                                className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5 text-white" />
                            </button>
                            <h2 className="text-2xl font-black text-white tracking-wide uppercase">Trending Now</h2>
                        </div>
                        {anime.viewAllLoading ? (
                            <div className="flex items-center justify-center py-20">
                                <LoadingSpinner size="lg" text="Loading..." />
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                                    {anime.viewAllAnime.map((item) => (
                                        <AnimeCard
                                            key={item.mal_id}
                                            anime={item}
                                            onClick={() => handleAnimeClick(item)}
                                        />
                                    ))}
                                </div>
                                <Pagination
                                    currentPage={anime.viewAllPagination.current_page}
                                    lastPage={anime.viewAllPagination.last_visible_page}
                                    onPageChange={anime.changeViewAllPage}
                                    isLoading={anime.viewAllLoading}
                                />
                            </>
                        )}
                    </div>
                ) : anime.viewMode === 'seasonal' ? (
                    /* View Mode: Seasonal */
                    <div className="pb-12 min-h-screen">
                        <div className="flex items-center gap-4 mb-8">
                            <button
                                onClick={anime.closeViewAll}
                                className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5 text-white" />
                            </button>
                            <h2 className="text-2xl font-black text-white tracking-wide uppercase">Popular This Season</h2>
                        </div>
                        {anime.viewAllLoading ? (
                            <div className="flex items-center justify-center py-20">
                                <LoadingSpinner size="lg" text="Loading..." />
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                                    {anime.viewAllAnime.map((item) => (
                                        <AnimeCard
                                            key={item.mal_id}
                                            anime={item}
                                            onClick={() => handleAnimeClick(item)}
                                        />
                                    ))}
                                </div>
                                <Pagination
                                    currentPage={anime.viewAllPagination.current_page}
                                    lastPage={anime.viewAllPagination.last_visible_page}
                                    onPageChange={anime.changeViewAllPage}
                                    isLoading={anime.viewAllLoading}
                                />
                            </>
                        )}
                    </div>
                ) : anime.viewMode === 'popular' ? (
                    /* View Mode: All-Time Popular */
                    <div className="pb-12 min-h-screen">
                        <div className="flex items-center gap-4 mb-8">
                            <button
                                onClick={anime.closeViewAll}
                                className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5 text-white" />
                            </button>
                            <h2 className="text-2xl font-black text-white tracking-wide uppercase">All-Time Popular</h2>
                        </div>
                        {anime.viewAllLoading ? (
                            <div className="flex items-center justify-center py-20">
                                <LoadingSpinner size="lg" text="Loading..." />
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                                    {anime.viewAllAnime.map((item) => (
                                        <AnimeCard
                                            key={item.mal_id}
                                            anime={item}
                                            onClick={() => handleAnimeClick(item)}
                                        />
                                    ))}
                                </div>
                                <Pagination
                                    currentPage={anime.viewAllPagination.current_page}
                                    lastPage={anime.viewAllPagination.last_visible_page}
                                    onPageChange={anime.changeViewAllPage}
                                    isLoading={anime.viewAllLoading}
                                />
                            </>
                        )}
                    </div>
                ) : (
                    /* Default Dashboard View */
                    <>
                        {/* Continue Watching Carousel */}
                        {anime.continueWatchingList.length > 0 && anime.currentPage === 1 && (
                            <Carousel
                                title="Continue Watching"
                                variant="landscape"
                                onViewAll={() => anime.openViewAll('continue_watching')}
                            >
                                {anime.continueWatchingList.map((item) => (
                                    <div
                                        key={item.animeId}
                                        className="relative group h-full flex-[0_0_240px] sm:flex-[0_0_280px] md:flex-[0_0_320px]"
                                        onClick={() => handleWatchClick({ mal_id: parseInt(item.animeId) } as Anime, item.episodeNumber)}
                                    >
                                        {/* ... (Same carousel card content as App.tsx) ... */}
                                        <div className="relative aspect-video rounded-lg overflow-hidden mb-3 shadow-lg border border-white/5 transition-colors cursor-pointer">
                                            <img
                                                src={item.animeImage}
                                                alt={item.animeTitle}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                            />
                                            <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                                <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform shadow-xl">
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white ml-1">
                                                        <path fillRule="evenodd" d="M4.5 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" clipRule="evenodd" />
                                                    </svg>
                                                </div>
                                            </div>
                                            <div className="absolute top-2 left-2 bg-black/60 backdrop-blur text-white text-[10px] font-bold px-1.5 py-0.5 rounded border border-white/10">
                                                EP {item.episodeNumber}
                                            </div>
                                        </div>
                                        <div className="px-1">
                                            <h4 className="text-sm font-bold text-gray-200 truncate group-hover:text-yorumi-accent transition-colors">
                                                {item.animeTitle}
                                            </h4>
                                            <p className="text-xs text-gray-500 truncate mt-0.5">
                                                {item.episodeTitle || `Episode ${item.episodeNumber}`}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </Carousel>
                        )}

                        {/* Trending & Popular Carousels */}
                        {anime.currentPage === 1 && (
                            <>
                                <TrendingNow
                                    animeList={anime.trendingAnime}
                                    onAnimeClick={handleAnimeClick}
                                    onWatchClick={handleWatchClick}
                                    onViewAll={() => anime.openViewAll('trending')}
                                />

                                <PopularSeason
                                    animeList={anime.popularSeason}
                                    onAnimeClick={handleAnimeClick}
                                    onWatchClick={handleWatchClick}
                                    onViewAll={() => anime.openViewAll('seasonal')}
                                />

                                {/* Top Anime Grid (Preview) */}
                                <div className="flex items-center justify-between mb-6 pt-4">
                                    <h2 className="text-xl font-bold border-l-4 border-yorumi-accent pl-3 text-white">All-Time Popular</h2>
                                    <button
                                        onClick={() => anime.openViewAll('popular')}
                                        className="text-sm font-bold text-yorumi-accent hover:text-white transition-colors"
                                    >
                                        View All &gt;
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 mb-8">
                                    {anime.topAnime.slice(0, 12).map((item) => (
                                        <AnimeCard
                                            key={item.mal_id}
                                            anime={item}
                                            onClick={() => handleAnimeClick(item)}
                                            onWatchClick={() => handleWatchClick(item)}
                                        />
                                    ))}
                                </div>

                                {/* Schedule and Genres Section */}
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
                                    <div className="lg:col-span-2">
                                        <EstimatedSchedule onAnimeClick={(id) => navigate(`/anime/${id}`)} />
                                    </div>
                                    <div>
                                        <Genres onGenreClick={(genre) => navigate(`/genre/${encodeURIComponent(genre)}`)} />
                                    </div>
                                </div>
                            </>
                        )}


                    </>
                )}
            </div>
        </div>
    );
}

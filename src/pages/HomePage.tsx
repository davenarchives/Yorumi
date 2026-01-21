import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useAnime } from '../hooks/useAnime';
import { slugify } from '../utils/slugify';
import type { Anime } from '../types/anime';

// Feature Components
import AnimeDashboard from '../features/anime/components/AnimeDashboard';
import AnimeGridPage from '../features/anime/components/AnimeGridPage';
import ContinueWatching from '../features/anime/components/ContinueWatching';

export default function HomePage() {
    const navigate = useNavigate();
    const anime = useAnime();

    useEffect(() => {
        anime.fetchHomeData();
    }, []);

    // Navigation Handlers
    const handleAnimeClick = (item: Anime) => {
        const animeId = item.id || item.mal_id;
        navigate(`/anime/details/${animeId}`, { state: { anime: item } });
    };

    const handleWatchClick = (item: Anime, episodeNumber?: number) => {
        const title = slugify(item.title || item.title_english || 'anime');
        const id = item.mal_id || item.id;
        const url = episodeNumber
            ? `/anime/watch/${title}/${id}?ep=${episodeNumber}`
            : `/anime/watch/${title}/${id}`;
        navigate(url, { state: { anime: item } });
    };

    // Scroll to top on mount
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [anime.currentPage]);

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

    // View Switching
    if (anime.viewMode === 'continue_watching') {
        return (
            <div className="container mx-auto px-4 pt-24 pb-12 z-10 relative">
                <ContinueWatching
                    items={anime.continueWatchingList}
                    variant="page"
                    onWatchClick={handleWatchClick}
                    onRemove={anime.removeFromHistory}
                    onBack={anime.closeViewAll}
                />
            </div>
        );
    }

    if (anime.viewMode === 'trending') {
        return (
            <AnimeGridPage
                title="Trending Now"
                animeList={anime.viewAllAnime}
                isLoading={anime.viewAllLoading}
                pagination={anime.viewAllPagination}
                onPageChange={anime.changeViewAllPage}
                onBack={anime.closeViewAll}
                onAnimeClick={handleAnimeClick}
            />
        );
    }

    if (anime.viewMode === 'seasonal') {
        return (
            <AnimeGridPage
                title="Popular This Season"
                animeList={anime.viewAllAnime}
                isLoading={anime.viewAllLoading}
                pagination={anime.viewAllPagination}
                onPageChange={anime.changeViewAllPage}
                onBack={anime.closeViewAll}
                onAnimeClick={handleAnimeClick}
            />
        );
    }

    if (anime.viewMode === 'popular') {
        return (
            <AnimeGridPage
                title="All-Time Popular"
                animeList={anime.viewAllAnime}
                isLoading={anime.viewAllLoading}
                pagination={anime.viewAllPagination}
                onPageChange={anime.changeViewAllPage}
                onBack={anime.closeViewAll}
                onAnimeClick={handleAnimeClick}
            />
        );
    }

    // Default Dashboard
    return (
        <div className="min-h-screen pb-20">
            <AnimeDashboard
                spotlightAnime={anime.spotlightAnime}
                continueWatchingList={anime.continueWatchingList}
                trendingAnime={anime.trendingAnime}
                popularSeason={anime.popularSeason}
                topAnime={anime.topAnime}
                onAnimeClick={handleAnimeClick}
                onWatchClick={handleWatchClick}
                onViewAll={anime.openViewAll}
                onRemoveFromHistory={anime.removeFromHistory}
            />
        </div>
    );
}

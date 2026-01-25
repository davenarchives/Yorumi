import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import Pagination from '../components/ui/Pagination';

// Feature Components
import MangaSpotlight from '../features/manga/components/MangaSpotlight';
import PopularManhwa from '../features/manga/components/PopularManhwa';
import AllTimePopularManga from '../features/manga/components/AllTimePopularManga';
import Top100Manga from '../features/manga/components/Top100Manga';
import LatestMangaUpdates from '../features/manga/components/LatestMangaUpdates';
import MangaCard from '../features/manga/components/MangaCard';
import Genres from '../features/anime/components/Genres';
import { useManga } from '../hooks/useManga';
import type { Manga } from '../types/manga';

export default function MangaPage() {
    const navigate = useNavigate();
    const manga = useManga();



    const handleSpotlightClick = (mangaId: string, autoRead?: boolean) => {
        navigate(`/manga/details/${mangaId}`, { state: { autoRead } });
    };

    const handleMangaClick = (item: Manga) => {
        navigate(`/manga/details/${item.id || item.mal_id}`);
    };

    // Get the title for View All based on viewMode
    const getViewAllTitle = () => {
        switch (manga.viewMode) {
            case 'popular_manhwa': return 'Popular Manhwa';
            case 'all_time_popular': return 'All Time Popular';
            case 'top_100': return 'Top 100 Manga';
            default: return '';
        }
    };

    // View All Mode - Shows full grid with pagination
    if (manga.viewMode !== 'default') {
        return (
            <div className="container mx-auto px-4 pt-24 pb-12 min-h-screen">
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={manga.closeViewAll}
                        className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-white" />
                    </button>
                    <h2 className="text-2xl font-black text-white tracking-wide uppercase">{getViewAllTitle()}</h2>
                </div>

                {manga.viewAllLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <LoadingSpinner size="lg" text="Loading..." />
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                            {manga.viewAllManga.map((item) => (
                                <MangaCard
                                    key={item.id || item.mal_id}
                                    manga={item}
                                    onClick={() => handleMangaClick(item)}
                                />
                            ))}
                        </div>

                        <Pagination
                            currentPage={manga.viewAllPagination.currentPage}
                            lastPage={manga.viewAllPagination.lastPage}
                            onPageChange={manga.changeViewAllPage}
                            isLoading={manga.viewAllLoading}
                        />
                    </>
                )}
            </div>
        );
    }

    // Default Mode - Shows carousels
    return (
        <div className="min-h-screen pb-20">
            {/* Spotlight Hero Section */}
            <MangaSpotlight onMangaClick={handleSpotlightClick} />

            {/* Popular Manhwa Carousel */}
            <PopularManhwa
                onMangaClick={handleSpotlightClick}
                onViewAll={() => manga.openViewAll('popular_manhwa')}
            />

            {/* All Time Popular Manga Carousel */}
            <AllTimePopularManga
                onMangaClick={handleSpotlightClick}
                onViewAll={() => manga.openViewAll('all_time_popular')}
            />

            {/* Top 100 Manga Carousel (replaces Manga Catalog grid) */}
            <Top100Manga
                onMangaClick={handleSpotlightClick}
                onViewAll={() => manga.openViewAll('top_100')}
            />

            {/* Latest Updates & Genres Section */}
            <div className="container mx-auto px-4 mt-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Latest Updates (Left - 2/3) */}
                <div className="lg:col-span-2">
                    <LatestMangaUpdates
                        onMangaClick={handleSpotlightClick}
                    />
                </div>

                {/* Genres (Right - 1/3) */}
                <div>
                    <Genres onGenreClick={(genre) => navigate(`/manga/genre/${encodeURIComponent(genre)}`)} theme="manga" />
                </div>
            </div>
        </div>
    );
}

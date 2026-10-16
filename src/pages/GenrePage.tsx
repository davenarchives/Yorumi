import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import AnimeCard from '../features/anime/components/AnimeCard';
import Pagination from '../components/ui/Pagination';
import AnimeCardSkeleton from '../features/anime/components/AnimeCardSkeleton';
import { buildAnimeDetailsPath } from '../utils/animeNavigation';
import type { Anime } from '../types/anime';
import { animeService } from '../services/animeService';

export default function GenrePage() {
    const { name } = useParams<{ name: string }>();
    const navigate = useNavigate();
    const [animeList, setAnimeList] = useState<Anime[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);

    const genreName = decodeURIComponent(name || '');

    useEffect(() => {
        const fetchAnimeByGenre = async () => {
            setLoading(true);
            try {
                const result = await animeService.getAnimeByGenre(genreName, currentPage, 24);
                setAnimeList(result.data || []);
                setLastPage(result.pagination?.last_visible_page || 1);
            } catch (error) {
                console.error('Failed to fetch genre anime:', error);
            } finally {
                setLoading(false);
            }
        };

        if (genreName) {
            fetchAnimeByGenre();
        }
    }, [genreName, currentPage]);

    const handleAnimeClick = (item: Anime) => {
        const path = buildAnimeDetailsPath(item);
        if (path) navigate(path, { state: { anime: item } });
    };

    const handleWatchClick = (item: Anime) => {
        const path = buildAnimeDetailsPath(item, { episode: 1 });
        if (path) navigate(path, { state: { anime: item } });
    };

    return (
        <div className="min-h-screen pb-20 pt-24">
            <div className="container mx-auto px-4">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-white" />
                    </button>
                    <h1 className="text-2xl font-black text-white tracking-wide">
                        <span className="text-yorumi-accent">{genreName}</span> Anime
                    </h1>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 mb-8">
                        {Array.from({ length: 12 }).map((_, i) => (
                            <AnimeCardSkeleton key={i} />
                        ))}
                    </div>
                ) : animeList.length === 0 ? (
                    <div className="text-center text-gray-500 py-20">
                        No anime found for this genre
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 mb-8">
                            {animeList.map((item) => (
                                <AnimeCard
                                    key={item.mal_id}
                                    anime={item}
                                    onClick={() => handleAnimeClick(item)}
                                    onWatchClick={() => handleWatchClick(item)}
                                />
                            ))}
                        </div>

                        <Pagination
                            currentPage={currentPage}
                            lastPage={lastPage}
                            onPageChange={setCurrentPage}
                        />
                    </>
                )}
            </div>
        </div>
    );
}

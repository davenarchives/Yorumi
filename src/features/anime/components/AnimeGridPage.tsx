import { ArrowLeft } from 'lucide-react';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import Pagination from '../../../components/ui/Pagination';
import AnimeCard from './AnimeCard';
import type { Anime } from '../../../types/anime';

interface AnimeGridPageProps {
    title: string;
    animeList: Anime[];
    isLoading: boolean;
    pagination: {
        current_page: number;
        last_visible_page: number;
        has_next_page: boolean;
    };
    onPageChange: (page: number) => void;
    onBack: () => void;
    onAnimeClick: (anime: Anime) => void;
}

export default function AnimeGridPage({
    title,
    animeList,
    isLoading,
    pagination,
    onPageChange,
    onBack,
    onAnimeClick
}: AnimeGridPageProps) {
    return (
        <div className="pb-12 min-h-screen pt-24 container mx-auto px-4 animate-in fade-in duration-300">
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={onBack}
                    className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 text-white" />
                </button>
                <h2 className="text-2xl font-black text-white tracking-wide uppercase">{title}</h2>
            </div>
            {isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <LoadingSpinner size="lg" text="Loading..." />
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                        {animeList.map((item) => (
                            <AnimeCard
                                key={item.mal_id}
                                anime={item}
                                onClick={() => onAnimeClick(item)}
                            />
                        ))}
                    </div>
                    {pagination && (
                        <Pagination
                            currentPage={pagination.current_page}
                            lastPage={pagination.last_visible_page}
                            onPageChange={onPageChange}
                        />
                    )}
                </>
            )}
        </div>
    );
}

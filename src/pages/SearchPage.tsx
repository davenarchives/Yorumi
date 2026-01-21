import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useSearch } from '../hooks/useSearch';
import AnimeCard from '../features/anime/components/AnimeCard';
import MangaCard from '../features/manga/components/MangaCard';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import type { Anime } from '../types/anime';
import type { Manga } from '../types/manga';

export default function SearchPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const query = searchParams.get('q') || '';
    const type = (searchParams.get('type') as 'anime' | 'manga') || 'anime';

    const {
        searchQuery,
        setSearchQuery,
        searchResults,
        searchLoading,
        loadMore,
        searchPagination,
        executeSearch
    } = useSearch(type);

    // Sync URL query with Hook
    useEffect(() => {
        if (query && query !== searchQuery) {
            if (query && query !== searchQuery) {
                setSearchQuery(query);
                executeSearch(query, 1, false);
            }
        }
    }, [query]);

    // Handle Infinite Scroll (Simplified for now, or copy IntersectionObserver logic)
    // For MVP refactor, let's just show a "Load More" button or rely on original hook if it auto-fetches.
    // Original App.tsx used an IntersectionObserver on a sentinel. We should copy that.

    return (
        <div className="container mx-auto px-4 py-24 min-h-screen">
            <h2 className="text-2xl font-bold text-white mb-6">Search Results for "{query}"</h2>

            {searchLoading && searchResults.length === 0 ? (
                <div className="flex justify-center"><LoadingSpinner size="lg" /></div>
            ) : searchResults.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                    {type === 'anime' ? (
                        (searchResults as Anime[]).map(item => (
                            <AnimeCard
                                key={item.mal_id}
                                anime={item}
                                onClick={() => navigate(`/anime/details/${item.mal_id}`, { state: { anime: item } })}
                            />
                        ))
                    ) : (
                        (searchResults as Manga[]).map(item => (
                            <MangaCard
                                key={item.id || item.mal_id}
                                manga={item}
                                onClick={() => navigate(`/manga/details/${item.id || item.mal_id}`, { state: { manga: item } })}
                            />
                        ))
                    )}
                </div>
            ) : (
                <div className="text-gray-400 text-center text-xl">No results found.</div>
            )}

            {/* Load More Button */}
            {searchResults.length > 0 && searchPagination.has_next_page && (
                <div className="flex justify-center mt-12 pb-12">
                    <button
                        onClick={loadMore}
                        disabled={searchLoading}
                        className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-full text-white font-bold transition-colors disabled:opacity-50"
                    >
                        {searchLoading ? 'Loading...' : 'Load More'}
                    </button>
                </div>
            )}
        </div>
    );
}

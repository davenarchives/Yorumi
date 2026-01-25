import { useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useSearch } from '../hooks/useSearch';
import AnimeCard from '../features/anime/components/AnimeCard';
import MangaCard from '../features/manga/components/MangaCard';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import Pagination from '../components/ui/Pagination';
import type { Anime } from '../types/anime';
import type { Manga } from '../types/manga';

export default function SearchPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const query = searchParams.get('q') || '';
    const type = (searchParams.get('type') as 'anime' | 'manga') || 'anime';

    // Derived state for UI
    const alphabets = ['All', '#', '0-9', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];
    const isAZListQuery = alphabets.includes(query);
    const activeLetter = query;

    const {
        searchQuery,
        setSearchQuery,
        searchResults,
        searchLoading,
        searchPagination,
        executeSearch
    } = useSearch(type, undefined, isAZListQuery);

    // Sync URL query with Hook
    useEffect(() => {
        if (query !== searchQuery) {
            setSearchQuery(query);
            executeSearch(query, 1, false);
        }
    }, [query]);
    const accentColor = type === 'manga' ? 'text-yorumi-manga' : 'text-yorumi-accent';
    const activeBg = type === 'manga' ? 'bg-yorumi-manga' : 'bg-yorumi-accent';

    return (
        <div className="container mx-auto px-4 pt-24 pb-12 min-h-screen">
            {/* Breadcrumbs */}
            <div className="text-sm text-gray-400 mb-6 flex items-center gap-2">
                <Link to="/" className="hover:text-white transition-colors">Home</Link>
                <span>•</span>
                <span className="text-white">A-Z List</span>
            </div>

            {/* Header */}
            <h1 className={`text-2xl md:text-3xl font-bold mb-6 ${accentColor}`}>
                Sort By Letters
            </h1>

            {/* Alphabet Navigation */}
            <div className="flex flex-wrap gap-2 mb-12">
                {alphabets.map((abc) => {
                    const isActive = activeLetter === abc;

                    return (
                        <button
                            key={abc}
                            onClick={() => {
                                const newQ = abc;
                                navigate(`/search?q=${encodeURIComponent(newQ)}&type=${type}`);
                            }}
                            className={`
                                min-w-[40px] h-10 px-3 rounded-lg text-sm font-bold flex items-center justify-center transition-all duration-200
                                ${isActive
                                    ? `${activeBg} text-white shadow-lg shadow-${type === 'manga' ? 'yorumi-manga' : 'yorumi-accent'}/20`
                                    : 'bg-[#1a1a2e] text-gray-400 hover:bg-[#2a2a4e] hover:text-white'
                                }
                            `}
                        >
                            {abc}
                        </button>
                    );
                })}
            </div>

            {/* Results Header (Optional, if we want to show count or query) */}
            {query && (
                <h2 className="text-xl font-bold text-white mb-6">
                    Results for <span className={`${accentColor}`}>"{query}"</span>
                </h2>
            )}

            {/* Grid */}
            {searchLoading && searchResults.length === 0 ? (
                <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
            ) : searchResults.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                    {type === 'anime' ? (
                        (searchResults as Anime[]).map(item => (
                            <AnimeCard
                                key={item.id || item.scraperId || item.mal_id}
                                anime={item}
                                onClick={() => {
                                    if (item.scraperId) {
                                        navigate(`/anime/details/s:${item.scraperId}`, { state: { anime: item } });
                                    } else {
                                        navigate(`/anime/details/${item.mal_id}`, { state: { anime: item } });
                                    }
                                }}
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
                <div className="text-gray-400 text-center text-xl py-20 bg-[#1a1a2e] rounded-xl">
                    No results found for "{query}".
                </div>
            )}

            {/* Pagination */}
            {searchResults.length > 0 && (
                <Pagination
                    currentPage={searchPagination.current_page}
                    lastPage={searchPagination.last_visible_page}
                    onPageChange={(page) => executeSearch(searchQuery, page)}
                    accentColor={accentColor}
                />
            )}
        </div>
    );
}

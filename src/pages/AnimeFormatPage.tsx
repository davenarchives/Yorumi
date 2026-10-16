import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { animeService } from '../services/animeService';
import type { Anime } from '../types/anime';
import AnimeCard from '../features/anime/components/AnimeCard';
import AnimeCardSkeleton from '../features/anime/components/AnimeCardSkeleton';
import Pagination from '../components/ui/Pagination';
import { useAnime } from '../hooks/useAnime';
import { buildAnimeDetailsPath } from '../utils/animeNavigation';

const FORMAT_CONFIG: Record<string, { label: string; anilistFormat: string | undefined }> = {
    popular:  { label: 'Most Popular', anilistFormat: undefined },
    movies:   { label: 'Movies',     anilistFormat: 'MOVIE'   },
    tv:       { label: 'TV Series',  anilistFormat: 'TV'      },
    ova:      { label: 'OVAs',       anilistFormat: 'OVA'     },
    ona:      { label: 'ONAs',       anilistFormat: 'ONA'     },
    specials: { label: 'Specials',   anilistFormat: 'SPECIAL' },
};

export default function AnimeFormatPage() {
    const location = useLocation();
    const format = location.pathname.split('/').pop() || '';
    const navigate = useNavigate();
    const { prefetchEpisodes } = useAnime();

    const config = FORMAT_CONFIG[format];

    const [animeList, setAnimeList] = useState<Anime[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);

    const fetchData = useCallback(async (page: number) => {
        if (!config) return;

        // Instant paint from cache for faster navigation.
        const cached = animeService.peekTopAnime(page, config.anilistFormat);
        if (cached?.data?.length) {
            setAnimeList(cached.data);
            setLastPage(cached?.pagination?.last_visible_page ?? 1);
            setIsLoading(false);
        } else {
            setIsLoading(true);
        }

        try {
            const result = await animeService.getTopAnime(page, config.anilistFormat);
            setAnimeList(result?.data ?? []);
            setLastPage(result?.pagination?.last_visible_page ?? 1);

            const nextPage = page + 1;
            if ((result?.pagination?.last_visible_page ?? 1) >= nextPage) {
                animeService.getTopAnime(nextPage, config.anilistFormat).catch(() => undefined);
            }
        } catch (e) {
            console.error('AnimeFormatPage fetch error:', e);
        } finally {
            setIsLoading(false);
        }
    }, [config]);

    useEffect(() => {
        setCurrentPage(1);
        fetchData(1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [format, fetchData]);

    useEffect(() => {
        if (!config) return;

        const nextPage = currentPage + 1;
        if (nextPage <= lastPage) {
            animeService.getTopAnime(nextPage, config.anilistFormat).catch(() => undefined);
        }
    }, [config, currentPage, lastPage]);

    const handlePageChange = (page: number) => {
        if (page === currentPage) return;

        const cached = animeService.peekTopAnime(page, config.anilistFormat);
        setCurrentPage(page);
        if (!cached?.data?.length) {
            setIsLoading(true);
        }
        fetchData(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleAnimeClick = (item: Anime) => {
        const path = buildAnimeDetailsPath(item);
        if (!path) return;
        navigate(path, { state: { anime: item } });
    };

    const handleWatchClick = (item: Anime) => {
        const path = buildAnimeDetailsPath(item, { episode: 1 });
        if (!path) return;
        navigate(path, { state: { anime: item } });
    };

    if (!config) {
        return (
            <div className="min-h-screen flex items-center justify-center text-white/60">
                Unknown format.
            </div>
        );
    }

    return (
        <div className="min-h-screen pb-20 pt-24">
            <div className="container mx-auto px-4">
                {/* Header */}
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-1 h-7 bg-yorumi-accent rounded-full" />
                    <h1 className="text-2xl font-black text-white tracking-wide uppercase">
                        {config.label}
                    </h1>
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
                        {Array.from({ length: 12 }).map((_, i) => (
                            <AnimeCardSkeleton key={i} />
                        ))}
                    </div>
                ) : animeList.length === 0 ? (
                    <div className="flex items-center justify-center py-32 text-white/50">
                        No results found.
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
                            {animeList.map((item) => (
                                <AnimeCard
                                    key={item.mal_id || item.id}
                                    anime={item}
                                    onClick={() => handleAnimeClick(item)}
                                    onWatchClick={() => handleWatchClick(item)}
                                    onMouseEnter={() => prefetchEpisodes(item)}
                                />
                            ))}
                        </div>

                        <Pagination
                            currentPage={currentPage}
                            lastPage={lastPage}
                            onPageChange={handlePageChange}
                        />
                    </>
                )}
            </div>
        </div>
    );
}

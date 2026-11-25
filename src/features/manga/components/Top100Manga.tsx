import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { mangaService } from '../../../services/mangaService';
import type { Manga } from '../../../types/manga';
import MangaCard from './MangaCard';
import MangaCardSkeleton from './MangaCardSkeleton';
import { getMangaDetailsRouteId } from '../../../utils/mangaNavigation';

interface Top100MangaProps {
    onMangaClick: (mangaId: string, autoRead?: boolean, manga?: Manga) => void;
}

const PAGE_SIZE = 12;

const Top100Manga: React.FC<Top100MangaProps> = ({ onMangaClick }) => {
    const navigate = useNavigate();
    const cachedTop = mangaService.peekTopManga(1);
    const [mangaList, setMangaList] = useState<Manga[]>(cachedTop?.data || []);
    const [loading, setLoading] = useState(!(cachedTop?.data?.length));
    const [pageIndex, setPageIndex] = useState(0);

    useEffect(() => {
        let mounted = true;
        const fetchManga = async () => {
            try {
                const fullTop = await mangaService.getTop100Manga();
                if (mounted && fullTop && fullTop.length > 0) {
                    setMangaList(fullTop);
                    setLoading(false);
                    return;
                }
                const fallback = (await mangaService.getHomeSections()).top;
                if (mounted && fallback && fallback.length > 0) {
                    setMangaList(fallback);
                }
            } catch (err) {
                console.error('Failed to fetch top 100 manga', err);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        void fetchManga();
        return () => {
            mounted = false;
        };
    }, []);

    const totalPages = Math.max(1, Math.ceil(mangaList.length / PAGE_SIZE));
    const safePage = Math.min(pageIndex, totalPages - 1);
    const startIdx = safePage * PAGE_SIZE;
    const visibleManga = mangaList.slice(startIdx, startIdx + PAGE_SIZE);
    const canPrev = safePage > 0;
    const canNext = safePage < totalPages - 1;

    if (loading) {
        return (
            <section className="mb-10 animate-pulse">
                <div className="flex items-center justify-between mb-6">
                    <div className="h-7 w-44 rounded bg-white/10" />
                    <div className="h-6 w-28 rounded bg-white/10" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                    {Array.from({ length: PAGE_SIZE }).map((_, idx) => (
                        <MangaCardSkeleton key={idx} />
                    ))}
                </div>
            </section>
        );
    }
    if (mangaList.length === 0) return null;

    return (
        <section className="mb-10">
            {/* Header */}
            <div className="mb-4 flex items-center justify-between gap-4">
                <h2 className="text-[20px] sm:text-[22px] font-extrabold text-white tracking-tight">Top 100 Manga</h2>
                <div className="flex items-center gap-3 shrink-0">
                    <button
                        type="button"
                        onClick={() => navigate('/manga/top-100')}
                        className="inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-white/80 hover:text-white transition-colors cursor-pointer"
                    >
                        <span>View all</span>
                        <ChevronRight className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            disabled={!canPrev}
                            onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08] hover:bg-white/[0.18] text-white transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-default disabled:hover:bg-white/[0.08]"
                            aria-label="Previous page"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            disabled={!canNext}
                            onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08] hover:bg-white/[0.18] text-white transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-default disabled:hover:bg-white/[0.08]"
                            aria-label="Next page"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* 3-Row Paged Grid Layout */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {visibleManga.map((manga, index) => (
                    <div
                        key={manga.id || manga.mal_id}
                        className="relative group cursor-pointer"
                    >
                        <MangaCard
                            manga={manga as unknown as Manga}
                            rank={startIdx + index + 1}
                            onClick={(mangaObj) => onMangaClick(getMangaDetailsRouteId(mangaObj), false, mangaObj)}
                            disableTilt
                        />
                    </div>
                ))}
            </div>
        </section>
    );
};

export default Top100Manga;

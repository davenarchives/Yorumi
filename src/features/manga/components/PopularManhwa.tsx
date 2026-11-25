import React, { useState, useEffect, useCallback } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { mangaService } from '../../../services/mangaService';
import type { Manga } from '../../../types/manga';
import MangaCard from './MangaCard';
import MangaCardSkeleton from './MangaCardSkeleton';
import { getMangaDetailsRouteId } from '../../../utils/mangaNavigation';

interface PopularManhwaProps {
    onMangaClick: (mangaId: string, autoRead?: boolean, manga?: Manga) => void;

}

const PopularManhwa: React.FC<PopularManhwaProps> = ({ onMangaClick }) => {
    const cachedManhwa = mangaService.peekPopularManhwa(1);
    const [manhwaList, setManhwaList] = useState<Manga[]>(cachedManhwa?.data || []);
    const [loading, setLoading] = useState(!(cachedManhwa?.data?.length));
    const [emblaRef, emblaApi] = useEmblaCarousel({
        align: 'start',
        containScroll: 'trimSnaps',
        dragFree: true
    });

    useEffect(() => {
        const fetchManhwa = async () => {
            try {
                const data = (await mangaService.getHomeSections()).manhwa;
                if (data) {
                    setManhwaList(data.slice(0, 10));
                    setLoading(false);
                }
            } catch (err) {
                console.error('Failed to fetch popular manhwa', err);
            } finally {
                setLoading(false);
            }
        };

        fetchManhwa();
    }, []);

    const scrollPrev = useCallback(() => emblaApi && emblaApi.scrollPrev(), [emblaApi]);
    const scrollNext = useCallback(() => emblaApi && emblaApi.scrollNext(), [emblaApi]);

    if (loading) {
        return (
            <section className="mb-10 animate-pulse">
                <div className="flex items-center justify-between mb-4">
                    <div className="h-8 w-56 rounded bg-white/10" />
                    <div className="h-6 w-20 rounded bg-white/10" />
                </div>
                <div className="flex gap-3 sm:gap-4 overflow-hidden">
                    {Array.from({ length: 6 }).map((_, idx) => (
                        <div key={idx} className="flex-[0_0_148px] sm:flex-[0_0_175px] md:flex-[0_0_290px] lg:flex-[0_0_300px]">
                            <MangaCardSkeleton />
                        </div>
                    ))}
                </div>
            </section>
        );
    }
    if (manhwaList.length === 0) return null;

    return (
        <section className="mb-10">
            <div className="mb-4 flex items-center justify-between gap-4">
                <h2 className="text-[20px] sm:text-[22px] font-extrabold text-white tracking-tight">Popular Manhwa</h2>

                <div className="flex items-center gap-4">
                    <div className="flex gap-2">
                        <button
                            onClick={scrollPrev}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08] hover:bg-white/[0.18] transition-colors"
                            aria-label="Previous"
                        >
                            <ChevronLeft className="w-4 h-4 text-gray-300" />
                        </button>
                        <button
                            onClick={scrollNext}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08] hover:bg-white/[0.18] transition-colors"
                            aria-label="Next"
                        >
                            <ChevronRight className="w-4 h-4 text-gray-300" />
                        </button>
                    </div>


                </div>
            </div>

            <div className="relative">
                <div className="flex gap-4">
                    {/* Carousel Container */}
                    <div className="flex-1 overflow-hidden" ref={emblaRef}>
                        <div className="flex gap-3 sm:gap-4">
                            {manhwaList.slice(0, 10).map((manga) => (
                                <div
                                    key={manga.id || manga.mal_id}
                                    className="flex-[0_0_148px] sm:flex-[0_0_175px] md:flex-[0_0_290px] lg:flex-[0_0_300px]"
                                >
                                    <MangaCard
                                        manga={manga as unknown as Manga}
                                        onClick={(mangaObj) => onMangaClick(getMangaDetailsRouteId(mangaObj), false, mangaObj)}
                                        disableTilt
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default PopularManhwa;

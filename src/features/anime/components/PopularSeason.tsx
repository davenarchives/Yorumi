import React from 'react';
import type { Anime } from '../../../types/anime';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import useEmblaCarousel from 'embla-carousel-react';
import AnimeCardSkeleton from './AnimeCardSkeleton';
import AnimeCard from './AnimeCard';
import MediaSectionHeader from '../../../components/ui/MediaSectionHeader';

interface PopularSeasonProps {
    animeList: Anime[];
    isLoading?: boolean;
    onAnimeClick: (anime: Anime) => void;
    onWatchClick?: (anime: Anime) => void;

    onMouseEnter?: (anime: Anime) => void;
    title?: string;
    sectionNumber?: number;
}

const PopularSeason: React.FC<PopularSeasonProps> = ({ animeList, isLoading = false, onAnimeClick, onWatchClick, onMouseEnter, title = "Popular This Season", sectionNumber = 3 }) => {
    const [emblaRef, emblaApi] = useEmblaCarousel({
        align: 'center',
        containScroll: 'trimSnaps',
        dragFree: true
    });

    const scrollPrev = () => emblaApi && emblaApi.scrollPrev();
    const scrollNext = () => emblaApi && emblaApi.scrollNext();

    if (isLoading) {
        return (
            <section className="relative z-20 mt-4 mb-12">
                <div className="flex items-center justify-between mb-4">
                    <div className="h-7 w-56 bg-white/10 rounded animate-pulse" />
                    <div className="flex items-center gap-4">
                        <div className="flex gap-2">
                            <div className="h-8 w-8 rounded-full bg-white/5 border border-white/5 animate-pulse" />
                            <div className="h-8 w-8 rounded-full bg-white/5 border border-white/5 animate-pulse" />
                        </div>
                        <div className="h-4 w-14 bg-white/10 rounded animate-pulse" />
                    </div>
                </div>

                <div className="flex gap-4 overflow-hidden">
                    {Array.from({ length: 6 }).map((_, index) => (
                        <div
                            key={`popular-season-skeleton-${index}`}
                            className="flex-[0_0_140px] md:flex-[0_0_180px] lg:flex-[0_0_200px]"
                        >
                            <AnimeCardSkeleton />
                        </div>
                    ))}
                </div>
            </section>
        );
    }

    if (!animeList || animeList.length === 0) return null;

    return (
        <section className="relative z-20 mt-4 mb-12">
            <MediaSectionHeader index={sectionNumber} title={title} actions={
                    <>
                        <button
                            onClick={scrollPrev}
                            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors border border-white/5"
                            aria-label="Previous"
                        >
                            <ChevronLeft className="w-4 h-4 text-gray-300" />
                        </button>
                        <button
                            onClick={scrollNext}
                            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors border border-white/5"
                            aria-label="Next"
                        >
                            <ChevronRight className="w-4 h-4 text-gray-300" />
                        </button>
                    </>
            } />

            <div className="relative">
                <div className="flex gap-4">
                    {/* Carousel Container */}
                    <div className="flex-1 overflow-hidden" ref={emblaRef}>
                        <div className="flex gap-4">
                            {animeList.map((anime) => (
                                <div
                                    key={anime.mal_id}
                                    className="flex-[0_0_140px] md:flex-[0_0_180px] lg:flex-[0_0_200px]"
                                >
                                    <AnimeCard
                                        anime={anime}
                                        onClick={() => onAnimeClick(anime)}
                                        onWatchClick={() => onWatchClick?.(anime)}
                                        onMouseEnter={() => onMouseEnter?.(anime)}
                                        disableTilt
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Navigation Buttons - Removed from side */}
                </div>
            </div>
        </section>
    );
};

export default PopularSeason;

import React from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Anime } from '../../../types/anime';
import AnimeLandscapeCard, { AnimeLandscapeCardSkeleton } from './AnimeLandscapeCard';

interface AnimeLandscapeCarouselProps {
    title: string;
    animeList: Anime[];
    isLoading?: boolean;
    columns?: 3 | 4;
    showRanking?: boolean;
    seeAllLabel?: string;
    onAnimeClick: (anime: Anime) => void;
    onWatchClick?: (anime: Anime) => void;
    onMouseEnter?: (anime: Anime) => void;
    onSeeAll?: () => void;
}

const AnimeLandscapeCarousel: React.FC<AnimeLandscapeCarouselProps> = ({
    title,
    animeList,
    isLoading = false,
    columns = 3,
    showRanking = false,
    seeAllLabel = 'See all',
    onAnimeClick,
    onWatchClick,
    onMouseEnter,
    onSeeAll,
}) => {
    const [emblaRef, emblaApi] = useEmblaCarousel({
        align: 'start',
        containScroll: 'trimSnaps',
        dragFree: true,
    });

    const scrollPrev = () => emblaApi?.scrollPrev();
    const scrollNext = () => emblaApi?.scrollNext();

    const itemWidthClass =
        columns === 4
            ? 'flex-[0_0_148px] sm:flex-[0_0_175px] md:flex-[0_0_295px] lg:flex-[0_0_305px]'
            : 'flex-[0_0_148px] sm:flex-[0_0_175px] md:flex-[0_0_290px] lg:flex-[0_0_300px]';

    if (isLoading) {
        return (
            <section className="relative z-20 mb-7 md:mb-10 last:mb-2">
                <div className="flex items-center justify-between mb-4">
                    <div className="h-7 w-40 bg-white/10 rounded-md animate-pulse" />
                    <div className="flex gap-2">
                        <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />
                        <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />
                    </div>
                </div>
                <div className="flex gap-3 sm:gap-4 md:gap-5 overflow-hidden">
                    {Array.from({ length: columns + 1 }).map((_, idx) => (
                        <div key={idx} className={itemWidthClass}>
                            <AnimeLandscapeCardSkeleton />
                        </div>
                    ))}
                </div>
            </section>
        );
    }

    if (!animeList || animeList.length === 0) return null;

    return (
        <section className="relative z-20 mb-7 md:mb-10 last:mb-2">
            <div className="flex items-center justify-between gap-4 mb-4">
                <h2 className="text-[20px] sm:text-[22px] font-extrabold text-white tracking-tight">
                    {title}
                </h2>
                <div className="flex items-center gap-3 shrink-0">
                    {onSeeAll && (
                        <button
                            type="button"
                            onClick={onSeeAll}
                            className="inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-white/80 hover:text-white transition-colors mr-1 cursor-pointer"
                        >
                            <span>{seeAllLabel}</span>
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    )}
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={scrollPrev}
                            aria-label={`Previous ${title}`}
                            className="w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/[0.18] border-0 outline-none focus:outline-none flex items-center justify-center text-white/85 hover:text-white transition-all cursor-pointer"
                        >
                            <ChevronLeft className="w-4 h-4 stroke-[2.2]" />
                        </button>
                        <button
                            type="button"
                            onClick={scrollNext}
                            aria-label={`Next ${title}`}
                            className="w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/[0.18] border-0 outline-none focus:outline-none flex items-center justify-center text-white/85 hover:text-white transition-all cursor-pointer"
                        >
                            <ChevronRight className="w-4 h-4 stroke-[2.2]" />
                        </button>
                    </div>
                </div>
            </div>

            <div className="relative overflow-visible">
                <div className="overflow-hidden -mx-3 px-3 py-3 -my-1" ref={emblaRef}>
                    <div className="flex gap-3 sm:gap-4 md:gap-5">
                        {animeList.map((anime, index) => (
                            <div
                                key={`${anime.scraperId || anime.id || anime.mal_id || anime.title}-${index}`}
                                className={itemWidthClass}
                            >
                                <AnimeLandscapeCard
                                    anime={anime}
                                    rank={showRanking ? index + 1 : undefined}
                                    onClick={onAnimeClick}
                                    onWatchClick={onWatchClick}
                                    onMouseEnter={onMouseEnter}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default AnimeLandscapeCarousel;


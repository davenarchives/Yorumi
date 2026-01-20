import React, { useCallback } from 'react';
import useEmblaCarousel from 'embla-carousel-react';

interface CarouselProps {
    title?: string;
    viewAllLink?: string;
    children: React.ReactNode;
    variant?: 'portrait' | 'landscape';
    onViewAll?: () => void;
}

const Carousel: React.FC<CarouselProps> = ({ title, viewAllLink, children, variant = 'portrait', onViewAll }) => {
    const [emblaRef, emblaApi] = useEmblaCarousel({
        loop: false,
        align: 'center',
        slidesToScroll: 'auto',
        containScroll: 'trimSnaps'
    });

    const scrollPrev = useCallback(() => {
        if (emblaApi) emblaApi.scrollPrev();
    }, [emblaApi]);

    const scrollNext = useCallback(() => {
        if (emblaApi) emblaApi.scrollNext();
    }, [emblaApi]);

    const itemCount = React.Children.count(children);
    const showControls = itemCount >= 4;

    return (
        <div className="mb-12 group/carousel relative">
            {/* Header */}
            {title && (
                <div className="flex justify-between items-end mb-4 px-2">
                    <h2 className="text-xl font-bold text-white tracking-wide border-l-4 border-yorumi-accent pl-3">
                        {title}
                    </h2>
                    {showControls && (viewAllLink || onViewAll) && (
                        <span
                            onClick={onViewAll}
                            className="text-xs font-semibold text-gray-400 hover:text-yorumi-accent cursor-pointer transition-colors tracking-wider"
                        >
                            View All
                        </span>
                    )}
                </div>
            )}

            {/* Navigation Buttons - Only visible if 4+ items */}
            {showControls && (
                <>
                    <button
                        onClick={scrollPrev}
                        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-20 bg-yorumi-bg/90 p-3 rounded-full shadow-xl shadow-black/50 transition-all duration-300 hover:bg-yorumi-accent hover:text-yorumi-bg text-white hover:scale-110 opacity-0 group-hover/carousel:opacity-100"
                        aria-label="Previous Slide"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
                    </button>

                    <button
                        onClick={scrollNext}
                        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-20 bg-yorumi-bg/90 p-3 rounded-full shadow-xl shadow-black/50 transition-all duration-300 hover:bg-yorumi-accent hover:text-yorumi-bg text-white hover:scale-110 opacity-0 group-hover/carousel:opacity-100"
                        aria-label="Next Slide"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
                    </button>
                </>
            )}

            {/* Carousel Viewport */}
            <div className="overflow-hidden px-4" ref={emblaRef}>
                <div className="flex gap-4 touch-pan-y">
                    {/* Slides need to be wrapped to maintain gap */}
                    {React.Children.map(children, (child) => (
                        <div className={`${variant === 'landscape'
                            ? 'flex-[0_0_70%] sm:flex-[0_0_50%] md:flex-[0_0_40%] lg:flex-[0_0_30%] xl:flex-[0_0_25%]'
                            : 'flex-[0_0_45%] sm:flex-[0_0_30%] md:flex-[0_0_24%] lg:flex-[0_0_18%] xl:flex-[0_0_16%]'} min-w-0`}>
                            {child}
                        </div>
                    ))}
                </div>
            </div>

            {/* Gradient Edges for overflow cue */}
        </div>
    );
};

export default Carousel;

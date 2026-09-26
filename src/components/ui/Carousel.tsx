import React, { useCallback } from 'react';
import useEmblaCarousel from 'embla-carousel-react';

interface CarouselProps {
    title?: string;
    children: React.ReactNode;
    variant?: 'portrait' | 'landscape';
    gridColumns?: 4 | 6;
}

const Carousel: React.FC<CarouselProps> = ({ title, children, variant = 'portrait', gridColumns }) => {
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
                <div className="flex items-center gap-4 mb-6">
                    <h2 className="text-xl md:text-2xl font-black text-white tracking-wide uppercase whitespace-nowrap">
                        {title}
                    </h2>
                    <div className="flex-1 h-px bg-white/10" />
                </div>
            )}

            {/* Navigation Buttons - Only visible if 4+ items */}
            {showControls && !gridColumns && (
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
            {gridColumns ? (
                <div className={`grid gap-x-4 gap-y-8 ${gridColumns === 4 ? 'grid-cols-4' : 'grid-cols-6'}`}>
                    {React.Children.map(children, (child) => (
                        <div className="min-w-0">{child}</div>
                    ))}
                </div>
            ) : (
                <div className="overflow-hidden" ref={emblaRef}>
                    <div className="flex gap-4 touch-pan-y">
                    {/* Slides need to be wrapped to maintain gap */}
                    {React.Children.map(children, (child) => (
                        <div className={`${variant === 'landscape'
                            ? 'flex-[0_0_60%] sm:flex-[0_0_45%] md:flex-[0_0_35%] lg:flex-[0_0_25%] xl:flex-[0_0_20%]'
                            : 'flex-[0_0_40%] sm:flex-[0_0_25%] md:flex-[0_0_20%] lg:flex-[0_0_15%] xl:flex-[0_0_13%]'} min-w-0`}>
                            {child}
                        </div>
                    ))}
                    </div>
                </div>
            )}

            {/* Gradient Edges for overflow cue */}
        </div>
    );
};

export default Carousel;

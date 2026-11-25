import SpotlightMetadata, { type SpotlightMetadataDetail } from '../../../components/ui/SpotlightMetadata';
import { useCallback, useEffect, useRef, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';
import { getDisplayImageUrl } from '../../../utils/image';

export interface ReadingSpotlightItem {
    key: string;
    title: string;
    cover: string;
    banner?: string;
    synopsis?: string;
    details: SpotlightMetadataDetail[];
    rating?: number | null;
    format?: string;
}

interface ReadingSpotlightProps {
    theme: 'manga' | 'ln';
    items: ReadingSpotlightItem[];
    onSelect: (index: number) => void;
    onRead: (index: number) => void;
    onDetails: (index: number) => void;
    onBackdropChange?: (url: string) => void;
}

const isDesktopViewport = (): boolean =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(min-width: 768px)').matches
        : true;

const getSlideDistance = (a: number, b: number, total: number): number => {
    const diff = Math.abs(a - b);
    return Math.min(diff, total - diff);
};

export default function ReadingSpotlight({ theme, items, onSelect, onRead, onDetails, onBackdropChange }: ReadingSpotlightProps) {
    const autoplayRef = useRef(Autoplay({ delay: 5000, stopOnInteraction: false, stopOnMouseEnter: true }));
    const [emblaRef, emblaApi] = useEmblaCarousel(
        { loop: true, duration: 20, skipSnaps: false, dragThreshold: 4 },
        [autoplayRef.current]
    );
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [settledIndex, setSettledIndex] = useState(0);
    const [isDesktop] = useState(isDesktopViewport);
    const onSelectRef = useRef(onSelect);
    useEffect(() => {
        onSelectRef.current = onSelect;
    }, [onSelect]);

    const select = useCallback(() => {
        if (!emblaApi) return;
        setSelectedIndex(emblaApi.selectedScrollSnap());
    }, [emblaApi]);

    // Parent notifications run after the swipe animation settles to avoid mid-swipe re-renders.
    const settle = useCallback(() => {
        if (!emblaApi) return;
        const snap = emblaApi.selectedScrollSnap();
        setSettledIndex(snap);
        onSelectRef.current(snap);
    }, [emblaApi]);

    useEffect(() => {
        if (!emblaApi) return;
        select();
        settle();
        emblaApi.on('select', select);
        emblaApi.on('settle', settle);
        return () => {
            emblaApi.off('select', select);
            emblaApi.off('settle', settle);
        };
    }, [emblaApi, select, settle]);

    const active = items[selectedIndex] || items[0];
    const cover = getDisplayImageUrl(active?.cover);
    const settledItem = items[settledIndex] || items[0];
    const settledBackground = getDisplayImageUrl(settledItem?.banner || settledItem?.cover);

    useEffect(() => {
        // Ambient page bloom is desktop-only; skip parent re-renders on mobile.
        if (isDesktop && settledBackground) onBackdropChange?.(settledBackground);
    }, [settledBackground, onBackdropChange, isDesktop]);

    if (!active) return null;

    return (
        <div className="media-spotlight relative w-full h-[58svh] min-h-[400px] max-h-[490px] md:min-h-[640px] md:h-[100svh] md:max-h-none group bg-transparent mb-0">
            {/* Embla Swipe Track with 1:1 finger-tracked slide artwork */}
            <div
                ref={emblaRef}
                className="spotlight-track-mask absolute inset-0 z-0 overflow-hidden select-none touch-pan-y"
            >
                <div className="flex h-full touch-pan-y will-change-transform [transform:translateZ(0)]">
                    {items.map((item, idx) => {
                        const isNearby = getSlideDistance(idx, selectedIndex, items.length) <= 1;
                        const itemCover = isNearby ? getDisplayImageUrl(item.cover) : '';
                        const itemBg = isNearby ? getDisplayImageUrl(item.banner || item.cover) : '';
                        return (
                            <div key={item.key} className="relative h-full min-w-full flex-[0_0_100%] overflow-hidden bg-[#070707]">
                                {/* Desktop blurred backdrop */}
                                {isDesktop && (itemBg || itemCover) && (
                                    <img
                                        src={itemBg || itemCover}
                                        alt=""
                                        aria-hidden="true"
                                        draggable={false}
                                        decoding="async"
                                        loading="eager"
                                        className="hidden md:block h-full w-full scale-105 object-cover object-center blur-sm select-none pointer-events-none"
                                    />
                                )}
                                {/* Mobile crisp poster without blur */}
                                {!isDesktop && (itemCover || itemBg) && (
                                    <img
                                        src={itemCover || itemBg}
                                        alt=""
                                        aria-hidden="true"
                                        draggable={false}
                                        decoding="async"
                                        loading="eager"
                                        className="md:hidden h-full w-full object-cover object-top select-none pointer-events-none"
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Stationary Vignettes & Mobile Gradient Scrim (masked on desktop so bottom fades seamlessly) */}
            <div className="spotlight-track-mask absolute inset-0 z-10 pointer-events-none select-none">
                <div className="absolute inset-y-0 left-0 hidden md:block md:w-[65%] bg-gradient-to-r from-[#070707]/90 via-[#070707]/50 to-transparent" />
                <div className="absolute inset-x-0 top-0 h-[22%] bg-gradient-to-b from-black/60 to-transparent" />
                <div className="absolute inset-y-0 right-0 w-[15%] bg-gradient-to-l from-black/45 to-transparent" />
                {/* Mobile bottom-to-top gradient scrim for clear metadata & action legibility */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#070707] via-[#070707]/40 to-transparent md:hidden" />
            </div>

            {/* Desktop Floating Book Cover Stacks */}
            <div className="absolute right-[13%] top-1/2 z-10 hidden aspect-[2/3] w-48 max-w-[20vw] -translate-y-1/2 md:block lg:w-60 xl:w-[264px]">
                {items.length > 1 && (() => {
                    const previous = (selectedIndex - 1 + items.length) % items.length;
                    return (
                        <button
                            type="button"
                            onClick={() => emblaApi?.scrollTo(previous)}
                            aria-label={`Show ${items[previous].title}`}
                            className="absolute inset-0 origin-bottom -translate-x-[40%] -translate-y-5 rotate-[-8deg] scale-90 overflow-hidden rounded-xl brightness-[0.6] transition-all hover:brightness-90"
                        >
                            <img src={getDisplayImageUrl(items[previous].cover)} alt="" className="h-full w-full object-cover" />
                        </button>
                    );
                })()}
                {items.length > 2 && (() => {
                    const next = (selectedIndex + 1) % items.length;
                    return (
                        <button
                            type="button"
                            onClick={() => emblaApi?.scrollTo(next)}
                            aria-label={`Show ${items[next].title}`}
                            className="absolute inset-0 origin-bottom translate-x-[40%] -translate-y-5 rotate-[8deg] scale-90 overflow-hidden rounded-xl brightness-[0.6] transition-all hover:brightness-90"
                        >
                            <img src={getDisplayImageUrl(items[next].cover)} alt="" className="h-full w-full object-cover" />
                        </button>
                    );
                })()}
                <button
                    type="button"
                    onClick={() => onDetails(selectedIndex)}
                    aria-label={`View ${active.title} details`}
                    className="absolute inset-0 z-10 overflow-hidden rounded-xl shadow-2xl transition-transform duration-300 hover:-translate-y-2"
                >
                    <img src={cover} alt="" className="h-full w-full object-cover" />
                </button>
            </div>

            {/* Spotlight Foreground Content */}
            <div className="absolute inset-0 z-20 flex flex-col justify-end px-4 sm:px-10 md:px-14 lg:px-16 pb-6 sm:pb-12 md:pb-14 pointer-events-none">
                <div className="w-full flex items-end justify-between gap-8">
                    {/* Left Column: Title, Metadata Row, Synopsis (pointer-events-none so swipes pass through), Stationary Pill Action Buttons */}
                    <div className="w-full max-w-2xl md:max-w-[740px] lg:max-w-[820px] pointer-events-none">
                        <div className="flex flex-col items-center text-center md:items-start md:text-left">
                            {/* Title (outer z-20 layer so it stays pure white above scrims/masks) */}
                            <h1 className="mb-3 md:mb-4 max-w-[340px] sm:max-w-[500px] md:max-w-[740px] text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black leading-tight tracking-tight text-white drop-shadow-xl line-clamp-2">
                                {active.title}
                            </h1>

                            {/* Metadata Row: Circular Score Ring • Author • Format */}
                            <div className="flex justify-center md:justify-start mb-3">
                                <SpotlightMetadata
                                    score={active.rating}
                                    details={active.details}
                                    chip={active.format || (theme === 'manga' ? 'Manga' : 'Light Novel')}
                                />
                            </div>

                            {/* Synopsis */}
                            <p className="text-white text-base sm:text-lg md:text-[20px] lg:text-[21px] font-semibold line-clamp-2 md:line-clamp-3 max-w-xl md:max-w-[740px] lg:max-w-[780px] leading-[1.42] mb-5 md:mb-8">
                                {active.synopsis || 'No synopsis available.'}
                            </p>
                        </div>

                        {/* Large Pill Action Buttons: Read & Details (stationary) */}
                        <div className="flex w-full items-center gap-3 sm:gap-5 md:w-auto pointer-events-auto">
                            <button
                                type="button"
                                onClick={() => onRead(selectedIndex)}
                                className={`h-12 sm:h-14 md:h-[58px] min-w-0 flex-1 sm:min-w-[170px] md:min-w-[190px] md:flex-none px-5 md:px-10 rounded-full bg-white hover:bg-white/90 text-black md:text-white font-bold flex items-center justify-center gap-2.5 hover:scale-105 active:scale-95 transition-all duration-200 text-base sm:text-lg md:text-[20px] ${
                                    theme === 'manga'
                                        ? 'md:bg-yorumi-manga md:hover:bg-yorumi-manga/90'
                                        : 'md:bg-yorumi-ln md:hover:bg-yorumi-ln/90 md:!text-black'
                                }`}
                            >
                                <BookOpen className="w-5 h-5 md:w-[22px] md:h-[22px]" />
                                <span>Read</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => onDetails(selectedIndex)}
                                className="h-12 sm:h-14 md:h-[58px] min-w-0 flex-1 sm:min-w-[170px] md:min-w-[190px] md:flex-none px-5 md:px-10 rounded-full bg-white/[0.12] hover:bg-white/[0.2] border-0 outline-none focus:outline-none text-white font-bold flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-200 text-base sm:text-lg md:text-[20px]"
                            >
                                <span>Details</span>
                            </button>
                        </div>

                        {/* Mobile Carousel Indicator Dots */}
                        <div className="mt-5 flex justify-center gap-2 md:hidden pointer-events-auto" aria-label="Spotlight slides">
                            {items.slice(0, 8).map((item, idx) => (
                                <button
                                    key={`${item.key}-${idx}`}
                                    type="button"
                                    onClick={() => emblaApi?.scrollTo(idx)}
                                    aria-label={`Go to slide ${idx + 1}`}
                                    aria-current={idx === selectedIndex ? 'true' : undefined}
                                    className={`h-2.5 w-2.5 rounded-full ${idx === selectedIndex ? 'bg-white' : 'bg-white/30'}`}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Desktop Carousel Navigation Controls (< [====] • • • • >) */}
                    <div className="hidden sm:flex items-center gap-3 pointer-events-auto shrink-0 mb-2">
                        <button
                            type="button"
                            onClick={() => emblaApi?.scrollPrev()}
                            aria-label="Previous slide"
                            className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 border-0 outline-none focus:outline-none text-white flex items-center justify-center transition-all"
                        >
                            <ChevronLeft className="w-4 h-4 stroke-[2.4]" />
                        </button>

                        <div className="flex items-center gap-2.5 px-1">
                            {items.slice(0, 8).map((_, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => emblaApi?.scrollTo(idx)}
                                    aria-label={`Go to slide ${idx + 1}`}
                                    className={`h-2.5 rounded-full border-0 outline-none focus:outline-none transition-all duration-300 ${
                                        idx === selectedIndex
                                            ? `w-9 ${theme === 'manga' ? 'bg-yorumi-manga' : 'bg-yorumi-ln'}`
                                            : 'w-2.5 bg-white/25 hover:bg-white/50'
                                    }`}
                                />
                            ))}
                        </div>

                        <button
                            type="button"
                            onClick={() => emblaApi?.scrollNext()}
                            aria-label="Next slide"
                            className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 border-0 outline-none focus:outline-none text-white flex items-center justify-center transition-all"
                        >
                            <ChevronRight className="w-4 h-4 stroke-[2.4]" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

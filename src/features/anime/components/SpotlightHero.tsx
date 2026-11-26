import SpotlightMetadata from '../../../components/ui/SpotlightMetadata';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Anime } from '../../../types/anime';
import AnimeLogoImage, { preloadSpotlightLogos } from '../../../components/anime/AnimeLogoImage';
import SpotlightSkeleton from './SpotlightSkeleton';
import { useTitleLanguage } from '../../../context/TitleLanguageContext';
import { getDisplayTitle } from '../../../utils/titleLanguage';
import { getDisplayImageUrl } from '../../../utils/image';
import { animeService } from '../../../services/animeService';
import { tmdbService } from '../../../services/tmdbService';

interface SpotlightHeroProps {
    animeList: Anime[];
    isLoading?: boolean;
    onAnimeClick: (anime: Anime) => void;
    onWatchClick: (anime: Anime) => void;
    onAnimeHover?: (anime: Anime) => void;
    onBackdropChange?: (backdropUrl: string) => void;
}

type AnimeWithCoverCandidates = Anime & {
    backgroundCover?: string;
    background_cover?: string;
    backdrop?: string;
    backdropImage?: string;
    banner?: string;
    bannerImage?: string;
    coverImage?: {
        extraLarge?: string;
        large?: string;
        medium?: string;
    };
    image?: string;
    poster?: string;
    thumbnail?: string;
    isAdult?: boolean;
};

const getAnimeKey = (anime: Anime): string => {
    return String(anime.id || anime.mal_id || anime.scraperId || anime.title || '');
};

const getAnimeCoverImage = (anime: Anime): string => {
    const candidate = anime as AnimeWithCoverCandidates;

    return (
        candidate.images?.jpg?.large_image_url ||
        candidate.images?.jpg?.image_url ||
        candidate.anilist_cover_image ||
        candidate.coverImage?.extraLarge ||
        candidate.coverImage?.large ||
        candidate.coverImage?.medium ||
        candidate.poster ||
        candidate.image ||
        candidate.thumbnail ||
        ''
    );
};

const getAnimeBackgroundCover = (anime: Anime, fallbackImage: string): string => {
    const candidate = anime as AnimeWithCoverCandidates;

    return (
        candidate.backgroundCover ||
        candidate.background_cover ||
        candidate.backdrop ||
        candidate.backdropImage ||
        candidate.bannerImage ||
        candidate.banner ||
        candidate.anilist_banner_image ||
        fallbackImage
    );
};

const getContentRating = (anime: AnimeWithCoverCandidates): string => {
    if (anime.rating) {
        const r = String(anime.rating).toUpperCase();
        if (r.includes('17') || r.includes('R')) return 'TV-MA';
        if (r.includes('13') || r.includes('PG')) return 'TV-14';
        return anime.rating;
    }
    if (anime.isAdult) return 'TV-MA';
    if (anime.type === 'Movie') return 'PG-13';
    return 'TV-14';
};

const getPrimaryGenre = (anime: Anime): string => {
    if (anime.genres && anime.genres.length > 0) {
        const animationGenre = anime.genres.find((g) => g.name.toLowerCase() === 'animation');
        if (animationGenre) return animationGenre.name;
    }
    return 'Animation';
};

const getNormalizedScore = (score?: number): number => {
    if (!score || score <= 0) return 8.5;
    return score > 10 ? Number((score / 10).toFixed(1)) : Number(score.toFixed(1));
};

const getAnimeYear = (anime: Anime): string => {
    if (anime.year) return String(anime.year);
    if (anime.aired?.from) {
        const parsed = new Date(anime.aired.from).getFullYear();
        if (!isNaN(parsed)) return String(parsed);
    }
    return '1999';
};

const isDesktopViewport = (): boolean =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(min-width: 768px)').matches
        : true;

/** Loop-aware distance between two slide indices. */
const getSlideDistance = (a: number, b: number, total: number): number => {
    const diff = Math.abs(a - b);
    return Math.min(diff, total - diff);
};

const SpotlightHero: React.FC<SpotlightHeroProps> = ({
    animeList,
    isLoading = false,
    onAnimeClick,
    onWatchClick,
    onAnimeHover,
    onBackdropChange,
}) => {
    const { language } = useTitleLanguage();
    const autoplayRef = useRef(Autoplay({ delay: 6000, stopOnInteraction: false, stopOnMouseEnter: true }));
    const [emblaRef, emblaApi] = useEmblaCarousel(
        {
            loop: true,
            duration: 20,
            skipSnaps: false,
            dragThreshold: 4,
        },
        [autoplayRef.current]
    );
    const [isDesktop] = useState(isDesktopViewport);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [settledIndex, setSettledIndex] = useState(0);
    const [detailsById, setDetailsById] = useState<Record<string, Anime>>({});
    const [tmdbBackdrops, setTmdbBackdrops] = useState<Record<string, string>>({});

    useEffect(() => {
        if (animeList.length === 0) return;
        void preloadSpotlightLogos(animeList);
        if (!isDesktop) return;

        let cancelled = false;
        const spotlightSlice = animeList.slice(0, 8);

        void (async () => {
            const entries = await Promise.all(
                spotlightSlice.map(async (anime) => {
                    const key = getAnimeKey(anime);
                    if (!key) return null;
                    const backdropUrl = await tmdbService
                        .getBackdropForAnime(anime, isDesktop ? 'original' : 'w1280')
                        .catch(() => null);
                    return backdropUrl ? ([key, backdropUrl] as const) : null;
                })
            );
            if (cancelled) return;
            const resolved: Record<string, string> = {};
            for (const entry of entries) {
                if (entry) resolved[entry[0]] = entry[1];
            }
            if (Object.keys(resolved).length > 0) {
                setTmdbBackdrops((prev) => ({ ...resolved, ...prev }));
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [animeList, isDesktop]);

    const onSelect = useCallback(() => {
        if (!emblaApi) return;
        setSelectedIndex(emblaApi.selectedScrollSnap());
    }, [emblaApi]);

    // Heavy side-effects (prefetching, details fetch, ambient backdrop) only run once the
    // carousel has fully settled so they never compete with the swipe animation frames.
    const onSettle = useCallback(() => {
        if (!emblaApi) return;
        const snap = emblaApi.selectedScrollSnap();
        setSettledIndex(snap);
    }, [emblaApi]);

    useEffect(() => {
        if (!emblaApi) return;
        const frameId = window.requestAnimationFrame(() => {
            onSelect();
            onSettle();
        });
        emblaApi.on('select', onSelect);
        emblaApi.on('settle', onSettle);
        return () => {
            window.cancelAnimationFrame(frameId);
            emblaApi.off('select', onSelect);
            emblaApi.off('settle', onSettle);
        };
    }, [emblaApi, onSelect, onSettle]);

    const onAnimeHoverRef = useRef(onAnimeHover);
    useEffect(() => {
        onAnimeHoverRef.current = onAnimeHover;
    }, [onAnimeHover]);

    useEffect(() => {
        const activeAnime = animeList[settledIndex];
        if (!activeAnime) return;
        const timer = window.setTimeout(() => onAnimeHoverRef.current?.(activeAnime), 400);
        return () => window.clearTimeout(timer);
    }, [animeList, settledIndex]);

    useEffect(() => {
        const activeAnime = animeList[settledIndex];
        const id = activeAnime?.id || activeAnime?.mal_id;
        const key = String(id || '');
        if (!id || detailsById[key] || (activeAnime.genres?.length && activeAnime.studios?.length && activeAnime.duration)) return;

        let cancelled = false;
        void animeService.getAnimeDetailsFast(id, activeAnime.type).then(({ data }) => {
            if (!cancelled && data) {
                setDetailsById((current) => ({ ...current, [key]: data }));
            }
        }).catch(() => undefined);
        return () => { cancelled = true; };
    }, [animeList, detailsById, settledIndex]);

    const handleNext = useCallback(() => {
        if (emblaApi) emblaApi.scrollNext();
    }, [emblaApi]);

    const handlePrev = useCallback(() => {
        if (emblaApi) emblaApi.scrollPrev();
    }, [emblaApi]);

    const scrollTo = useCallback((index: number) => {
        if (emblaApi) emblaApi.scrollTo(index);
    }, [emblaApi]);

    useEffect(() => {
        // Ambient page bloom is desktop-only; skip parent re-renders on mobile.
        if (!isDesktop) return;
        const anime = animeList[settledIndex];
        if (!anime) return;
        const key = getAnimeKey(anime);
        const details = detailsById[String(anime.id || anime.mal_id || '')];
        const merged = details ? { ...details, ...anime } : anime;
        const backdrop = tmdbBackdrops[key] || getAnimeBackgroundCover(merged, getAnimeCoverImage(merged));
        if (backdrop) onBackdropChange?.(getDisplayImageUrl(backdrop));
    }, [animeList, settledIndex, detailsById, tmdbBackdrops, onBackdropChange, isDesktop]);

    if (isLoading || animeList.length === 0) {
        return <SpotlightSkeleton />;
    }

    const activeRaw = animeList[selectedIndex];
    const details = detailsById[String(activeRaw?.id || activeRaw?.mal_id || '')];
    const activeAnime = details
        ? {
            ...details,
            ...activeRaw,
            genres: activeRaw.genres?.length ? activeRaw.genres : details.genres,
            studios: activeRaw.studios?.length ? activeRaw.studios : details.studios,
            duration: activeRaw.duration || details.duration,
        }
        : activeRaw;

    const activeKey = getAnimeKey(activeRaw);
    const displayTitle = getDisplayTitle(activeAnime as unknown as Record<string, unknown>, language);
    const displayBackground = getDisplayImageUrl(
        tmdbBackdrops[activeKey] || getAnimeBackgroundCover(activeAnime, getAnimeCoverImage(activeAnime))
    );
    const numericScore = getNormalizedScore(activeAnime.score);
    const releaseYear = getAnimeYear(activeAnime);
    const primaryGenre = getPrimaryGenre(activeAnime);
    const contentRating = getContentRating(activeAnime as AnimeWithCoverCandidates);

    return (
        <div className="media-spotlight relative w-full h-[58svh] min-h-[400px] max-h-[490px] md:min-h-[640px] md:h-[100svh] md:max-h-none group bg-transparent mb-0">
            {/* Embla Swipe Track with 1:1 finger-tracked slide artwork */}
            <div
                className="spotlight-track-mask absolute inset-0 z-0 overflow-hidden select-none touch-pan-y"
                ref={emblaRef}
            >
                <div className="flex h-full touch-pan-y will-change-transform [transform:translateZ(0)]">
                    {animeList.map((anime, index) => {
                        const isNearby = getSlideDistance(index, selectedIndex, animeList.length) <= 1;
                        const key = getAnimeKey(anime);
                        const slideDetails = detailsById[String(anime.id || anime.mal_id || '')];
                        const mergedSlide = slideDetails ? { ...slideDetails, ...anime } : anime;
                        const slideCover = getAnimeCoverImage(mergedSlide);
                        const slideBg = isNearby
                            ? getDisplayImageUrl(
                                isDesktop
                                    ? (tmdbBackdrops[key] || getAnimeBackgroundCover(mergedSlide, slideCover))
                                    : (slideCover || getAnimeBackgroundCover(mergedSlide, ''))
                            )
                            : '';
                        return (
                            <div
                                key={`${anime.scraperId || anime.id || anime.mal_id || anime.title}-${index}`}
                                className="relative min-w-full h-full flex-[0_0_100%] overflow-hidden bg-[#070707]"
                            >
                                {slideBg && (
                                    <img
                                        src={slideBg}
                                        alt=""
                                        aria-hidden="true"
                                        draggable={false}
                                        decoding="async"
                                        loading="eager"
                                        className="h-full w-full object-cover object-top md:object-center select-none pointer-events-none"
                                    />
                                )}
                                {!isDesktop && (
                                    <div className="absolute inset-0 bg-gradient-to-t from-[#070707] via-[#070707]/45 to-transparent pointer-events-none" />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Stationary Vignettes & Mobile Gradient Scrim (masked on desktop so bottom fades seamlessly) */}
            <div className="spotlight-track-mask absolute inset-0 z-10 pointer-events-none select-none">
                {/* Soft left vignette matching Figma reference */}
                <div className="absolute inset-y-0 left-0 hidden md:block md:w-[65%] bg-gradient-to-r from-[#070707]/90 via-[#070707]/50 to-transparent" />

                {/* Subtle top & right edge vignettes */}
                <div className="absolute inset-x-0 top-0 h-[22%] bg-gradient-to-b from-black/60 to-transparent" />
                <div className="absolute inset-y-0 right-0 w-[15%] bg-gradient-to-l from-black/45 to-transparent" />
                {/* Mobile bottom-to-top gradient scrim for clear metadata & action legibility */}
                
            </div>

            {/* Spotlight Foreground Content */}
            <div className="absolute inset-0 z-20 flex flex-col justify-end px-4 sm:px-10 md:px-14 lg:px-16 pb-6 sm:pb-12 md:pb-14 pointer-events-none">
                <div className="w-full flex items-end justify-between gap-8">
                    {/* Left Column: Logo, Metadata Row, Bigger Synopsis (pointer-events-none so swipes pass through to Embla), Interactive Buttons & Dots */}
                    <div className="w-full max-w-2xl md:max-w-[740px] lg:max-w-[820px] pointer-events-none">
                        <div className="mb-3 md:mb-5 flex h-[132px] items-end justify-center md:h-[200px] md:w-full md:max-w-[500px] lg:max-w-[540px] md:justify-start">
                            <AnimeLogoImage
                                key={activeKey}
                                tmdbId={activeAnime.id || activeAnime.mal_id}
                                title={displayTitle}
                                year={activeAnime.year}
                                episodes={activeAnime.latestEpisode || activeAnime.episodes}
                                format={activeAnime.type}
                                anime={activeAnime}
                                preferLogo
                                className="w-[82%] max-w-[320px] md:w-full md:max-w-none object-contain object-center md:object-left drop-shadow-[0_4px_20px_rgba(0,0,0,0.65)]"
                                size="large"
                                style={{ maxHeight: isDesktop ? '200px' : '132px' }}
                            />
                        </div>
                        <div className="flex h-[112px] flex-col items-center text-center md:h-auto md:items-start md:text-left">
                            {/* Metadata Row: Circular Score Ring • Year • Animation • TV-14 */}
                            <div className="flex justify-center md:justify-start"><SpotlightMetadata score={numericScore} details={[releaseYear, primaryGenre]} chip={contentRating} /></div>

                            {/* Larger, Crisper Synopsis matching Figma */}
                            <p className="text-white text-base sm:text-lg md:text-[20px] lg:text-[21px] font-semibold line-clamp-2 md:line-clamp-3 max-w-xl md:max-w-[740px] lg:max-w-[780px] leading-[1.42] mb-5 md:mb-8">
                                {activeAnime.synopsis || 'No synopsis available.'}
                            </p>
                        </div>
                                {/* Large Pill Action Buttons: Play & Details */}
                                <div className="flex w-full items-center gap-3 sm:gap-5 md:w-auto pointer-events-auto">
                                    <button
                                        type="button"
                                        onClick={() => onWatchClick({
                                            ...activeAnime,
                                            anilist_banner_image: displayBackground || activeAnime.anilist_banner_image,
                                        })}
                                        className="h-12 sm:h-14 md:h-[58px] min-w-0 flex-1 sm:min-w-[170px] md:min-w-[190px] md:flex-none px-5 md:px-10 rounded-full bg-white hover:bg-white/90 text-black md:bg-[#0596ff] md:hover:bg-[#1aa3ff] md:text-white font-bold flex items-center justify-center gap-2.5 hover:scale-105 active:scale-95 transition-all duration-200 text-base sm:text-lg md:text-[20px]"
                                    >
                                        <svg
                                            className="w-5 h-5 md:w-[22px] md:h-[22px]"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2.2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <polygon points="6 3 20 12 6 21 6 3" />
                                        </svg>
                                        <span>Play</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onAnimeClick({
                                            ...activeAnime,
                                            anilist_banner_image: displayBackground || activeAnime.anilist_banner_image,
                                        })}
                                        className="h-12 sm:h-14 md:h-[58px] min-w-0 flex-1 sm:min-w-[170px] md:min-w-[190px] md:flex-none px-5 md:px-10 rounded-full bg-white/[0.12] hover:bg-white/[0.2] border-0 outline-none focus:outline-none text-white font-bold flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-200 text-base sm:text-lg md:text-[20px]"
                                    >
                                        <span>Details</span>
                                    </button>
                                </div>
                        <div className="mt-5 flex justify-center gap-2 md:hidden pointer-events-auto" aria-label="Spotlight slides">
                            {animeList.slice(0, 8).map((anime, idx) => (
                                <button key={`${getAnimeKey(anime)}-${idx}`} type="button" onClick={() => scrollTo(idx)} aria-label={`Go to slide ${idx + 1}`} aria-current={idx === selectedIndex ? 'true' : undefined} className={`h-2.5 w-2.5 rounded-full ${idx === selectedIndex ? 'bg-white' : 'bg-white/30'}`} />
                            ))}
                        </div>
                    </div>

                    {/* Right Column: Unboxed Floating Carousel Controls (<  [====] • • • • • •  >) */}
                    <div className="hidden sm:flex items-center gap-3 pointer-events-auto shrink-0 mb-2">
                        <button
                            type="button"
                            onClick={handlePrev}
                            aria-label="Previous slide"
                            className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 border-0 outline-none focus:outline-none text-white flex items-center justify-center transition-all"
                        >
                            <ChevronLeft className="w-4 h-4 stroke-[2.4]" />
                        </button>

                        <div className="flex items-center gap-2.5 px-1">
                            {animeList.slice(0, 8).map((_, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => scrollTo(idx)}
                                    aria-label={`Go to slide ${idx + 1}`}
                                    className={`h-2.5 rounded-full border-0 outline-none focus:outline-none transition-all duration-300 ${idx === selectedIndex
                                        ? 'w-9 bg-[#0596ff]'
                                        : 'w-2.5 bg-white/25 hover:bg-white/50'
                                        }`}
                                />
                            ))}
                        </div>

                        <button
                            type="button"
                            onClick={handleNext}
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
};

export default SpotlightHero;

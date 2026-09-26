import React, { useState, useEffect, useCallback } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import type { Anime } from '../../../types/anime';
import AnimeLogoImage, { preloadSpotlightLogos } from '../../../components/anime/AnimeLogoImage';
import SpotlightSkeleton from './SpotlightSkeleton';
import { useTitleLanguage } from '../../../context/TitleLanguageContext';
import { getDisplayTitle } from '../../../utils/titleLanguage';
import { getDisplayImageUrl } from '../../../utils/image';
import { AnimatePresence, m } from 'framer-motion';
import CCIcon from '../../../components/ui/CCIcon';
import { animeService } from '../../../services/animeService';

interface SpotlightHeroProps {
    animeList: Anime[];
    isLoading?: boolean;
    onAnimeClick: (anime: Anime) => void;
    onWatchClick: (anime: Anime) => void;
    onAnimeHover?: (anime: Anime) => void;
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

const SpotlightCover: React.FC<{ thumbnail: string; title: string }> = ({ thumbnail, title }) => {
    const cardRef = React.useRef<HTMLDivElement>(null);
    const [rotation, setRotation] = React.useState({ x: 0, y: 0 });
    const [glare, setGlare] = React.useState({ x: 50, y: 50, opacity: 0 });
    const [isHovered, setIsHovered] = React.useState(false);

    const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
        if (!cardRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        setRotation({
            x: ((y - centerY) / centerY) * -10,
            y: ((x - centerX) / centerX) * 10,
        });
        setGlare({
            x: (x / rect.width) * 100,
            y: (y / rect.height) * 100,
            opacity: 1,
        });
    };

    const handleMouseLeave = () => {
        setRotation({ x: 0, y: 0 });
        setGlare((current) => ({ ...current, opacity: 0 }));
        setIsHovered(false);
    };

    return (
        <div
            ref={cardRef}
            className={`hidden md:block w-56 lg:w-64 shrink-0 rounded-xl relative perspective-1000 transition-transform duration-500 ease-out ${isHovered ? 'rotate-0' : 'rotate-3'}`}
            style={{ perspective: '1000px' }}
            onMouseEnter={(event) => {
                setIsHovered(true);
                handleMouseMove(event);
            }}
            onMouseLeave={handleMouseLeave}
            onMouseMove={handleMouseMove}
        >
            <div
                className="relative h-full w-full overflow-hidden rounded-xl border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.6)] transition-all duration-75 ease-out"
                style={{
                    transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) scale3d(${isHovered ? 1.02 : 1}, ${isHovered ? 1.02 : 1}, 1)`,
                    transformStyle: 'preserve-3d',
                }}
            >
                <div
                    className="pointer-events-none absolute inset-0 z-30 mix-blend-overlay transition-opacity duration-300"
                    style={{
                        background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,0.4) 0%, transparent 80%)`,
                        opacity: glare.opacity,
                    }}
                />
                <img src={thumbnail} alt={title} className="h-auto w-full object-cover" />
            </div>
        </div>
    );
};

const SpotlightHero: React.FC<SpotlightHeroProps> = ({ animeList, isLoading = false, onAnimeClick, onWatchClick, onAnimeHover }) => {
    const { language } = useTitleLanguage();
    // Embla Carousel hook
    const [emblaRef, emblaApi] = useEmblaCarousel({
        loop: true,
        duration: 20
    }, [
        Autoplay({ delay: 5000, stopOnInteraction: false, stopOnMouseEnter: true })
    ]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [detailsById, setDetailsById] = useState<Record<string, Anime>>({});

    useEffect(() => {
        if (animeList.length > 0) void preloadSpotlightLogos(animeList);
    }, [animeList]);

    // Update selected index when slide changes
    const onSelect = useCallback(() => {
        if (!emblaApi) return;
        setSelectedIndex(emblaApi.selectedScrollSnap());
    }, [emblaApi]);

    // Attach event listener
    useEffect(() => {
        if (!emblaApi) return;
        const frameId = window.requestAnimationFrame(onSelect);
        emblaApi.on('select', onSelect);
        return () => {
            window.cancelAnimationFrame(frameId);
            emblaApi.off('select', onSelect);
        };
    }, [emblaApi, onSelect]);

    useEffect(() => {
        const activeAnime = animeList[selectedIndex];
        if (activeAnime) {
            onAnimeHover?.(activeAnime);
        }
    }, [animeList, onAnimeHover, selectedIndex]);

    useEffect(() => {
        const activeAnime = animeList[selectedIndex];
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
    }, [animeList, detailsById, selectedIndex]);

    const handleNext = useCallback(() => {
        if (emblaApi) emblaApi.scrollNext();
    }, [emblaApi]);

    const handlePrev = useCallback(() => {
        if (emblaApi) emblaApi.scrollPrev();
    }, [emblaApi]);

    const scrollTo = useCallback((index: number) => {
        if (emblaApi) emblaApi.scrollTo(index);
    }, [emblaApi]);

    // Keep the hero's space reserved until spotlight data is available.
    if (isLoading || animeList.length === 0) {
        return <SpotlightSkeleton />;
    }

    return (
        <div className="media-spotlight relative w-full h-[58vh] md:h-[60vh] min-h-[440px] md:min-h-[480px] group bg-[#0a0a0a] overflow-hidden mb-8">
            {/* Background Crossfade */}
            <div className="absolute inset-0 z-0 select-none overflow-hidden">
                <AnimatePresence>
                    {animeList[selectedIndex] && (() => {
                        const anime = animeList[selectedIndex];
                        const coverImage = getAnimeCoverImage(anime);
                        const backgroundCover = getAnimeBackgroundCover(anime, coverImage);
                        const isPosterFallback = backgroundCover === coverImage && !(anime as any).anilist_banner_image && !(anime as any).bannerImage && !(anime as any).backdrop;
                        const displayBackground = getDisplayImageUrl(backgroundCover);
                        const displayPoster = getDisplayImageUrl(coverImage);
                        return (
                            <React.Fragment key={`bg-${selectedIndex}`}>
                                <m.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.45 }}
                                    className="absolute inset-0 bg-cover bg-center bg-no-repeat md:hidden"
                                    style={{ backgroundImage: displayPoster ? `url(${displayPoster})` : 'none' }}
                                />
                                <m.div
                                    initial={{ scale: 1.05, opacity: 0 }}
                                    animate={{ scale: 1, opacity: isPosterFallback ? 0.5 : 0.7 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.8 }}
                                    className={`absolute inset-0 hidden bg-cover bg-center bg-no-repeat md:block ${isPosterFallback ? 'blur-xl scale-110' : ''}`}
                                    style={{ backgroundImage: displayBackground ? `url(${displayBackground})` : 'none' }}
                                />
                            </React.Fragment>
                        );
                    })()}
                </AnimatePresence>
                <div className="absolute inset-x-0 bottom-0 h-[60%] bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/80 to-transparent z-0 pointer-events-none" />
                <div className="absolute inset-0 hidden bg-gradient-to-r from-[#0a0a0a] via-[#0a0a0a]/80 to-transparent pointer-events-none z-0 md:block" />
            </div>

            {/* Embla Viewport (Invisible Swipe Catcher) */}
            <div className="absolute inset-0 overflow-hidden z-0" ref={emblaRef}>
                <div className="flex h-full touch-pan-y">
                    {animeList.map((anime, index) => (
                        <div
                            key={`${anime.scraperId || anime.id || anime.mal_id || anime.title}-${index}`}
                            className="relative min-w-full h-full flex-[0_0_100%]"
                        />
                    ))}
                </div>
            </div>

            {/* Fixed Overlay Content */}
            <div className="absolute inset-0 z-10 hidden pointer-events-none md:block">
                <AnimatePresence>
                    {animeList[selectedIndex] && (() => {
                        const activeAnime = animeList[selectedIndex];
                        const displayTitle = getDisplayTitle(activeAnime as unknown as Record<string, unknown>, language);
                        const coverImage = getDisplayImageUrl(getAnimeCoverImage(activeAnime));

                        return (
                            <m.div
                                key={selectedIndex}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.4, ease: "easeInOut" }}
                                className="absolute inset-0 flex flex-col md:flex-row gap-12 items-center w-full max-w-7xl mx-auto px-5 md:px-14 mt-12"
                            >
                                {/* Text Info (Left) */}
                                <div className="flex-1 pointer-events-auto w-full max-w-2xl flex flex-col justify-end h-[360px] md:h-[380px]">
                                    {/* Top Section: Mobile Cover & Title */}
                                    <div className="w-full mb-4">
                                        <div className="flex items-center gap-3 mb-3">
                                            {coverImage && (
                                                <div className="hidden h-24 w-16 rounded-md overflow-hidden shadow-lg shadow-black/50 border border-white/10 flex-shrink-0 relative">
                                                    <img
                                                        src={coverImage}
                                                        alt={displayTitle}
                                                        className="w-full h-full object-cover"
                                                    />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-start">
                                            <AnimeLogoImage
                                                tmdbId={activeAnime.id || activeAnime.mal_id}
                                                title={displayTitle}
                                                year={activeAnime.year}
                                                episodes={activeAnime.latestEpisode || activeAnime.episodes}
                                                format={activeAnime.type}
                                                anime={activeAnime}
                                                preferLogo
                                                className="drop-shadow-2xl"
                                                size="medium"
                                            />
                                        </div>
                                    </div>

                                    {/* Middle Section: Chips */}
                                    <div className="spotlight-meta w-full flex items-center flex-wrap gap-4 text-white select-none mb-4">
                                        {activeAnime.score > 0 && (
                                            <span className="flex items-center justify-center gap-1.5 bg-white/10 px-3 h-8 rounded-lg backdrop-blur-sm text-sm font-bold">
                                                <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" /></svg>
                                                {activeAnime.score.toFixed(1)}
                                            </span>
                                        )}
                                        {activeAnime.scraperId?.startsWith('vault-anime') && activeAnime.rating ? (
                                            <span className="flex items-center justify-center gap-1.5 bg-white/10 px-3 h-8 rounded-lg backdrop-blur-sm text-sm font-bold uppercase">
                                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
                                                {activeAnime.rating}
                                            </span>
                                        ) : (activeAnime.latestEpisode || activeAnime.episodes) ? (
                                            <span className="flex items-center justify-center gap-1.5 bg-[#22c55e] text-white px-3 h-8 rounded-lg backdrop-blur-sm text-sm font-bold">
                                                <CCIcon className="w-3.5 h-3.5" />
                                                {activeAnime.latestEpisode || activeAnime.episodes}
                                            </span>
                                        ) : (
                                            <span className="flex items-center justify-center gap-1.5 bg-white/10 px-3 h-8 rounded-lg backdrop-blur-sm text-sm font-bold">
                                                <span className={`w-2 h-2 rounded-full ${String(activeAnime.status || '').toUpperCase() === 'RELEASING' || String(activeAnime.status || '').toLowerCase() === 'airing' ? 'bg-green-500' : 'bg-gray-500'}`}></span>
                                                {activeAnime.status || 'Unknown'}
                                            </span>
                                        )}
                                        <span className="flex items-center justify-center px-3 h-8 rounded-lg bg-yorumi-accent/20 text-yorumi-accent text-sm font-bold border border-yorumi-accent/50 uppercase backdrop-blur-sm">
                                            {activeAnime.type || 'Anime'}
                                        </span>
                                    </div>

                                    {/* Bottom Section: Synopsis & Buttons */}
                                    <div className="w-full mb-6">
                                        <p className="text-gray-300 text-sm md:text-base line-clamp-3 max-w-xl leading-relaxed">
                                            {activeAnime.synopsis || "No synopsis available."}
                                        </p>
                                    </div>

                                    <div className="spotlight-actions w-full flex gap-4">
                                        <button
                                            onMouseEnter={() => onAnimeHover?.(activeAnime)}
                                            onFocus={() => onAnimeHover?.(activeAnime)}
                                            onClick={() => onWatchClick(activeAnime)}
                                            className="bg-yorumi-accent text-yorumi-bg px-5 py-2.5 rounded-lg font-bold hover:bg-white transition-all duration-300 flex items-center gap-2 shadow-[0_0_15px_rgba(61,180,242,0.3)] hover:shadow-[0_0_25px_rgba(61,180,242,0.5)] text-sm md:text-base"
                                        >
                                            <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                            Watch Now
                                        </button>
                                        <button
                                            onMouseEnter={() => onAnimeHover?.(activeAnime)}
                                            onFocus={() => onAnimeHover?.(activeAnime)}
                                            onClick={() => onAnimeClick(activeAnime)}
                                            className="bg-white/10 backdrop-blur-md border border-white/20 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-white/20 transition-all duration-300 flex items-center gap-2 text-sm md:text-base"
                                        >
                                            Detail <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                        </button>
                                    </div>
                                </div>

                                {/* Coverflow Images (Right - Portrait) */}
                                <div className="ml-auto lg:mr-12 xl:mr-20 pointer-events-none relative w-56 lg:w-64 h-[336px] lg:h-[384px] group">
                                    {/* Previous Card */}
                                    {animeList.length > 1 && (
                                        <div 
                                            onClick={() => scrollTo((selectedIndex - 1 + animeList.length) % animeList.length)}
                                            className="absolute inset-0 hidden md:block pointer-events-auto cursor-pointer z-0"
                                        >
                                            <div 
                                                className="w-full h-full origin-bottom transition-transform duration-500 ease-out [transform:translateX(-40%)_translateY(-20px)_scale(0.9)_rotate(-8deg)] group-hover:[transform:translateX(-45%)_translateY(-20px)_scale(0.92)_rotate(-6deg)]"
                                            >
                                                <div className="w-full h-full rounded-xl overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] border border-white/10 brightness-[0.6] transition-all duration-300">
                                                    <img src={getAnimeCoverImage(animeList[(selectedIndex - 1 + animeList.length) % animeList.length])} className="w-full h-full object-cover" alt="" />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* Next Card */}
                                    {animeList.length > 2 && (
                                        <div 
                                            onClick={() => scrollTo((selectedIndex + 1) % animeList.length)}
                                            className="absolute inset-0 hidden md:block pointer-events-auto cursor-pointer z-0"
                                        >
                                            <div 
                                                className="w-full h-full origin-bottom transition-transform duration-500 ease-out [transform:translateX(40%)_translateY(-20px)_scale(0.9)_rotate(8deg)] group-hover:[transform:translateX(45%)_translateY(-20px)_scale(0.92)_rotate(6deg)]"
                                            >
                                                <div className="w-full h-full rounded-xl overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] border border-white/10 brightness-[0.6] transition-all duration-300">
                                                    <img src={getAnimeCoverImage(animeList[(selectedIndex + 1) % animeList.length])} className="w-full h-full object-cover" alt="" />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Active Card */}
                                    <div className="absolute inset-0 z-10 pointer-events-auto">
                                        {coverImage && <SpotlightCover thumbnail={coverImage} title={displayTitle} />}
                                    </div>
                                </div>
                            </m.div>
                        );
                    })()}
                </AnimatePresence>
            </div>



            {animeList[selectedIndex] && (() => {
                const activeAnime = animeList[selectedIndex];
                const details = detailsById[String(activeAnime.id || activeAnime.mal_id || '')];
                const displayAnime = details ? { ...details, ...activeAnime, genres: activeAnime.genres?.length ? activeAnime.genres : details.genres, studios: activeAnime.studios?.length ? activeAnime.studios : details.studios, duration: activeAnime.duration || details.duration } : activeAnime;
                const displayTitle = getDisplayTitle(displayAnime as unknown as Record<string, unknown>, language);
                const episodeCount = displayAnime.latestEpisode || displayAnime.episodes;
                const nextAiring = displayAnime.nextAiringEpisode;
                const airingSeconds = Math.max(0, Number(nextAiring?.timeUntilAiring || 0));
                const airingCountdown = airingSeconds >= 86400
                    ? `${Math.ceil(airingSeconds / 86400)}D`
                    : airingSeconds >= 3600
                        ? `${Math.ceil(airingSeconds / 3600)}H`
                        : airingSeconds > 0 ? `${Math.ceil(airingSeconds / 60)}M` : '';
                const rating = displayAnime.score > 0
                    ? Math.round(displayAnime.score <= 10 ? displayAnime.score * 10 : displayAnime.score)
                    : null;
                const duration = String(displayAnime.duration || '').match(/\d+/)?.[0];
                return (
                    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between px-4 pb-4 md:hidden" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.25rem)' }}>
                        <div className="flex items-start justify-between">
                            <div className="rounded-full bg-black/55 px-3 py-2 text-sm font-bold text-white">{nextAiring?.episode ? `EP ${nextAiring.episode}${airingCountdown ? ` ${airingCountdown}` : ''}` : episodeCount ? `EP ${episodeCount}` : (displayAnime.status || 'ANIME')}</div>
                            <div className="rounded-full bg-black/55 px-4 py-2 text-sm font-bold text-white">{selectedIndex + 1} <span className="text-white/50">/ {animeList.length}</span></div>
                        </div>
                        <div className="translate-y-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-white">
                                <span className="rounded-full border border-white/15 bg-black/45 px-3 py-1.5">{displayAnime.type || 'TV'}</span>
                                {episodeCount && <span className="flex items-center gap-1 rounded-full border border-white/15 bg-black/45 px-3 py-1.5"><CCIcon className="h-3.5 w-3.5" /> {episodeCount}</span>}
                                {rating && <span className="rounded-full border border-white/15 bg-black/45 px-3 py-1.5">☆ {rating}</span>}
                                {duration && <span className="rounded-full border border-white/15 bg-black/45 px-3 py-1.5">◷ {duration} mins</span>}
                            </div>
                            <AnimeLogoImage
                                tmdbId={displayAnime.id || displayAnime.mal_id}
                                title={displayTitle}
                                year={displayAnime.year}
                                episodes={episodeCount}
                                format={displayAnime.type}
                                anime={displayAnime}
                                preferLogo
                                className="max-w-[95%] drop-shadow-lg"
                                size="small"
                            />
                            <div className="flex flex-wrap gap-2 text-xs font-medium text-white">
                                {(displayAnime.genres || []).slice(0, 3).map((genre) => <span key={genre.name} className="rounded-full border border-white/20 bg-black/45 px-3 py-1.5">{genre.name}</span>)}
                                {displayAnime.studios?.[0]?.name && <span className="rounded-full border border-white/20 bg-black/45 px-3 py-1.5">{displayAnime.studios[0].name}</span>}
                            </div>
                            <div className="pointer-events-auto flex gap-2 pt-1">
                                <button type="button" onClick={() => onWatchClick(activeAnime)} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-yorumi-accent px-3 text-sm font-bold text-black shadow-[0_0_16px_rgba(61,180,242,0.3)]">▶ Watch Now</button>
                                <button type="button" onClick={() => onAnimeClick(activeAnime)} className="flex h-10 min-w-[112px] items-center justify-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 text-sm font-bold text-white">Detail <span aria-hidden="true">›</span></button>
                            </div>
                        </div>
                    </div>
                );
            })()}
            {/* Dots Indicator */}
            <div className="absolute z-20 hidden gap-2 right-4 top-1/2 -translate-y-1/2 flex-col md:flex md:flex-row md:bottom-6 md:left-1/2 md:-translate-x-1/2 md:top-auto md:right-auto md:translate-y-0">
                {animeList.map((_, idx) => (
                    <button
                        key={idx}
                        onClick={() => scrollTo(idx)}
                        className={`w-2 h-2 rounded-full transition-all duration-300 ${idx === selectedIndex ? 'bg-yorumi-accent md:w-6 h-6 md:h-2' : 'bg-white/30 hover:bg-white/50'
                            }`}
                        aria-label={`Go to slide ${idx + 1}`}
                    />
                ))}
            </div>
        </div>
    );
};

export default SpotlightHero;

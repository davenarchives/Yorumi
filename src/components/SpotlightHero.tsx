import React, { useState, useEffect, useCallback } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import type { Anime } from '../types/anime';

interface SpotlightHeroProps {
    animeList: Anime[];
    onAnimeClick: (anime: Anime) => void;
    onWatchClick: (anime: Anime) => void;
}

const SpotlightHero: React.FC<SpotlightHeroProps> = ({ animeList, onAnimeClick, onWatchClick }) => {
    // Embla Carousel hook with Autoplay
    const [emblaRef, emblaApi] = useEmblaCarousel({
        loop: true,
        duration: 20
    }, [
        Autoplay({ delay: 5000, stopOnInteraction: false, stopOnMouseEnter: false })
    ]);
    const [selectedIndex, setSelectedIndex] = useState(0);

    // Update selected index when slide changes
    const onSelect = useCallback(() => {
        if (!emblaApi) return;
        setSelectedIndex(emblaApi.selectedScrollSnap());
    }, [emblaApi]);

    // Attach event listener
    useEffect(() => {
        if (!emblaApi) return;
        onSelect();
        emblaApi.on('select', onSelect);
        return () => {
            emblaApi.off('select', onSelect);
        };
    }, [emblaApi, onSelect]);

    const handleNext = useCallback(() => {
        if (emblaApi) emblaApi.scrollNext();
    }, [emblaApi]);

    const handlePrev = useCallback(() => {
        if (emblaApi) emblaApi.scrollPrev();
    }, [emblaApi]);

    const scrollTo = useCallback((index: number) => {
        if (emblaApi) emblaApi.scrollTo(index);
    }, [emblaApi]);

    if (animeList.length === 0) return null;

    return (
        <div
            className="relative w-full h-[75vh] min-h-[400px] group bg-[#0a0a0a] overflow-hidden"
        >
            {/* Embla Viewport */}
            <div className="absolute inset-0 overflow-hidden" ref={emblaRef}>
                <div className="flex h-full touch-pan-y">
                    {animeList.map((anime, index) => {
                        // Logic to choose the best landscape image
                        // Logic to choose the best landscape image
                        // User reported "weird" images, likely due to using portrait covers as background
                        // We prioritize AniList Banner. If missing, we use other landscape options.
                        // We avoid using 'anilist_cover_image' (portrait) for the hero background directly.
                        const landscapeImage = anime.anilist_banner_image ??
                            anime.trailer?.thumbnail ??
                            // Fallback to standard images if no banner/trailer available
                            anime.images?.jpg?.large_image_url ??
                            anime.images?.jpg?.image_url;

                        return (
                            <div key={anime.mal_id} className="relative min-w-full h-full flex-[0_0_100%]">
                                {/* Background Image */}
                                <div className="absolute inset-0 z-0 select-none">
                                    <div
                                        className="absolute right-0 top-0 w-full md:w-[60%] h-full bg-no-repeat bg-cover bg-center"
                                        style={{
                                            backgroundImage: `url(${landscapeImage})`,
                                            maskImage: 'linear-gradient(90deg, transparent 0%, black 20%, black 100%)',
                                            WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, black 20%, black 100%)'
                                        }}
                                    />
                                    {/* Overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] via-[#0a0a0a]/70 to-transparent pointer-events-none" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent pointer-events-none" />
                                </div>

                                {/* Content */}
                                <div className="absolute inset-0 flex items-center px-4 md:px-14 pt-20 md:pt-48 pb-20 md:pb-14 z-10 pointer-events-none">
                                    <div className="w-full md:w-2/3 lg:w-1/2 pointer-events-auto pr-0 md:pr-4 select-text flex flex-col justify-center h-full">
                                        <div className="text-[#d886ff] font-bold tracking-wider text-sm md:text-base mb-2 md:mb-3 select-none flex items-center gap-3">
                                            #{index + 1} Spotlight
                                        </div>
                                        {/* Dynamic font size based on title length to ensure it fits and isn't truncated */}
                                        <h1 className={`${anime.title.length > 50 ? 'text-xl md:text-2xl lg:text-3xl' :
                                            anime.title.length > 30 ? 'text-2xl md:text-3xl lg:text-4xl' :
                                                'text-3xl md:text-4xl lg:text-5xl'
                                            } font-black text-white mb-3 md:mb-4 leading-[1.1] drop-shadow-lg select-none line-clamp-2 md:line-clamp-3`}>
                                            {anime.title}
                                        </h1>

                                        <div className="flex items-center flex-wrap gap-x-4 gap-y-2 text-xs md:text-sm text-white mb-4 md:mb-8 font-medium select-none">
                                            <span className="flex items-center gap-1.5">
                                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                                {anime.type || 'TV'}
                                            </span>
                                            <span className="flex items-center gap-1.5">
                                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                {anime.duration?.replace(' per ep', '').replace('min', ' min') || '24 min'}
                                            </span>
                                            <span className="flex items-center gap-1.5">
                                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                {anime.aired?.string?.split(',')[1]?.trim() || anime.year || 'Jan 9, 2026'}
                                            </span>

                                            <div className="flex gap-2 ml-1 items-center">
                                                {/* HD Badge */}
                                                <span className="bg-[#d886ff] text-yorumi-bg px-2.5 py-1 rounded text-xs font-bold">HD</span>

                                                {/* CC / Episodes Badge - show latestEpisode for ongoing, episodes for completed */}
                                                {(anime.latestEpisode || anime.episodes) && (
                                                    <span className="bg-[#22c55e] text-white px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1">
                                                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 4H5a2 2 0 00-2 2v12a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v2H6V9h5v2zm7 0h-1.5v-.5h-2v3h2V13H18v2h-5V9h5v2z" /></svg>
                                                        {anime.latestEpisode || anime.episodes}
                                                    </span>
                                                )}

                                                {/* Score/Rating Badge */}
                                                {anime.score > 0 && (
                                                    <span className="bg-[#facc15] text-black px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1">
                                                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" /></svg>
                                                        {anime.score.toFixed(1)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <p className="text-gray-300 mb-6 md:mb-10 line-clamp-3 md:line-clamp-4 text-sm md:text-base leading-relaxed max-w-xl pr-0 md:pr-12 select-none">
                                            {anime.synopsis || "No synopsis available."}
                                        </p>

                                        {/* Buttons - In flow */}
                                        <div className="flex gap-4 pointer-events-auto z-20">
                                            <button
                                                onClick={() => onWatchClick(anime)}
                                                className="bg-yorumi-accent text-yorumi-bg px-6 md:px-8 py-3 md:py-3.5 rounded-full font-bold hover:bg-white transition-all duration-300 transform hover:scale-105 flex items-center gap-3 shadow-[0_0_20px_rgba(253,200,73,0.3)] hover:shadow-[0_0_30px_rgba(253,200,73,0.6)] text-sm md:text-base"
                                            >
                                                <div className="bg-yorumi-bg text-white rounded-full p-1.5 -ml-2">
                                                    <svg className="w-3 h-3 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                                </div>
                                                Watch Now
                                            </button>
                                            <button
                                                onClick={() => onAnimeClick(anime)}
                                                className="bg-white/10 backdrop-blur-md border border-white/20 text-white px-6 md:px-8 py-3 md:py-3.5 rounded-full font-bold hover:bg-white/20 transition-all duration-300 flex items-center gap-2 text-sm md:text-base"
                                            >
                                                Detail <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Navigation Buttons (Bottom Right) */}
            <div className="absolute bottom-8 right-8 z-20 flex gap-2">
                <button
                    onClick={handlePrev}
                    className="p-3 bg-black/60 hover:bg-yorumi-accent hover:text-yorumi-bg text-white rounded-lg border border-white/10 transition-all backdrop-blur-md"
                    aria-label="Previous Slide"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <button
                    onClick={handleNext}
                    className="p-3 bg-black/60 hover:bg-yorumi-accent hover:text-yorumi-bg text-white rounded-lg border border-white/10 transition-all backdrop-blur-md"
                    aria-label="Next Slide"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
            </div>

            {/* Dots Indicator */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
                {animeList.map((_, idx) => (
                    <button
                        key={idx}
                        onClick={() => scrollTo(idx)}
                        className={`w-2 h-2 rounded-full transition-all duration-300 ${idx === selectedIndex ? 'bg-yorumi-accent w-6' : 'bg-white/30 hover:bg-white/50'
                            }`}
                        aria-label={`Go to slide ${idx + 1}`}
                    />
                ))}
            </div>
        </div>
    );
};

export default SpotlightHero;

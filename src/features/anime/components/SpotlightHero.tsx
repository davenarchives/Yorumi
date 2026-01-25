import React, { useState, useEffect, useCallback } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import type { Anime } from '../../../types/anime';
import AnimeLogoImage from '../../../components/anime/AnimeLogoImage';

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
            className="relative w-full h-[55vh] md:h-[75vh] min-h-[500px] md:min-h-[600px] group bg-yorumi-bg overflow-hidden"
        >
            {/* Embla Viewport */}
            <div className="absolute inset-0 overflow-hidden" ref={emblaRef}>
                <div className="flex h-full touch-pan-y">
                    {animeList.map((anime, index) => {
                        // Logic to choose the best landscape image
                        const landscapeImage = anime.anilist_banner_image ??
                            anime.trailer?.thumbnail ??
                            anime.images?.jpg?.large_image_url ??
                            anime.images?.jpg?.image_url;

                        // Use portrait for cover card
                        const portraitImage = anime.images?.jpg?.large_image_url ?? anime.images?.jpg?.image_url;

                        return (
                            <div key={anime.mal_id} className="relative min-w-full h-full flex-[0_0_100%]">
                                {/* Background Image */}
                                <div className="absolute inset-0 z-0 select-none">
                                    <div
                                        className="absolute right-0 top-0 w-full md:w-[70%] h-full bg-no-repeat bg-cover bg-center md:opacity-80"
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
                                <div className="absolute inset-0 flex items-center px-4 md:px-14 z-10 pointer-events-none">
                                    <div className="flex flex-col md:flex-row gap-8 md:gap-16 items-center w-full max-w-7xl mx-auto pt-16 md:pt-0">

                                        {/* Left Column: Text Info */}
                                        <div className="flex-1 pointer-events-auto max-w-2xl w-full min-w-0">
                                            <div className="text-yorumi-accent font-bold tracking-wider text-sm md:text-base mb-2 md:mb-3 select-none flex items-center gap-3">
                                                <div className="md:hidden h-16 w-12 rounded overflow-hidden shadow-lg border border-white/10 flex-shrink-0 relative">
                                                    <img src={portraitImage} alt="" className="w-full h-full object-cover" />
                                                </div>
                                                #{index + 1} Spotlight
                                            </div>

                                            {/* Logo */}
                                            <div className={`${anime.title.length > 50 ? 'max-h-12 md:max-h-16' :
                                                anime.title.length > 30 ? 'max-h-16 md:max-h-20' :
                                                    'max-h-20 md:max-h-24'
                                                } mb-8 md:mb-12 flex items-start overflow-visible`}>
                                                <AnimeLogoImage
                                                    anilistId={anime.id || anime.mal_id}
                                                    title={anime.title}
                                                    className="drop-shadow-2xl max-h-full origin-left object-contain"
                                                    size="medium"
                                                />
                                            </div>

                                            <div className="flex items-center flex-wrap gap-x-4 gap-y-2 text-xs md:text-sm text-white mb-4 md:mb-6 font-medium select-none">
                                                <div className="flex items-center gap-4 bg-black/40 px-4 py-2 rounded-full border border-white/5 backdrop-blur-sm">
                                                    <span className="flex items-center gap-1.5">
                                                        <svg className="w-4 h-4 text-yorumi-accent" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                                        {anime.type || 'TV'}
                                                    </span>
                                                    <span className="w-px h-3 bg-white/20"></span>
                                                    <span className="flex items-center gap-1.5">
                                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                        {anime.duration?.replace(' per ep', '').replace('min', ' min') || '24 min'}
                                                    </span>
                                                    <span className="w-px h-3 bg-white/20"></span>
                                                    <span className="flex items-center gap-1.5">
                                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                        {anime.aired?.string?.split(',')[1]?.trim() || anime.year || '2025'}
                                                    </span>
                                                </div>

                                                <div className="flex gap-2 ml-1 items-center">
                                                    <span className="bg-yorumi-accent text-yorumi-bg px-2.5 py-1 rounded text-xs font-bold">HD</span>
                                                    {(anime.latestEpisode || anime.episodes) && (
                                                        <span className="bg-[#22c55e] text-white px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1">
                                                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 4H5a2 2 0 00-2 2v12a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v2H6V9h5v2zm7 0h-1.5v-.5h-2v3h2V13H18v2h-5V9h5v2z" /></svg>
                                                            {anime.latestEpisode || anime.episodes}
                                                        </span>
                                                    )}
                                                    {anime.score > 0 && (
                                                        <span className="bg-[#facc15] text-black px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1">
                                                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" /></svg>
                                                            {anime.score.toFixed(1)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <p className="text-gray-300 mb-6 md:mb-10 line-clamp-3 text-sm md:text-base leading-relaxed max-w-xl pr-0 md:pr-4 select-none">
                                                {anime.synopsis || "No synopsis available."}
                                            </p>

                                            <div className="flex gap-4 pointer-events-auto z-20">
                                                <button
                                                    onClick={() => onWatchClick(anime)}
                                                    className="bg-yorumi-accent text-yorumi-bg px-6 md:px-8 py-3 md:py-3.5 rounded-full font-bold hover:bg-white transition-all duration-300 transform hover:scale-105 flex items-center gap-3 shadow-[0_0_20px_rgba(61,180,242,0.3)] hover:shadow-[0_0_30px_rgba(61,180,242,0.6)] text-sm md:text-base"
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
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Navigation Buttons */}
            <div className="absolute bottom-8 right-8 z-20 hidden md:flex gap-2">
                <button
                    onClick={handlePrev}
                    className="p-2 bg-black/60 hover:bg-yorumi-accent hover:text-yorumi-bg text-white rounded-lg border border-white/10 transition-all backdrop-blur-md"
                    aria-label="Previous Slide"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <button
                    onClick={handleNext}
                    className="p-2 bg-black/60 hover:bg-yorumi-accent hover:text-yorumi-bg text-white rounded-lg border border-white/10 transition-all backdrop-blur-md"
                    aria-label="Next Slide"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
            </div>

            {/* Dots Indicator */}
            <div className="absolute z-20 flex gap-2 right-4 top-1/2 -translate-y-1/2 flex-col md:flex-row md:bottom-6 md:left-1/2 md:-translate-x-1/2 md:top-auto md:right-auto md:translate-y-0">
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

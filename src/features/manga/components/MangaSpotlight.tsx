import React, { useState, useEffect, useCallback } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { mangaService } from '../../../services/mangaService';
import type { Manga } from '../../../types/manga';
import AnimeLogoImage from '../../../components/anime/AnimeLogoImage';
import { useTitleLanguage } from '../../../context/TitleLanguageContext';
import { getDisplayTitle } from '../../../utils/titleLanguage';
import { AnimatePresence, m } from 'framer-motion';

interface MangaSpotlightProps {
    onMangaClick: (mangaId: string, autoRead?: boolean, manga?: Manga) => void;
}

// 3D Tilt Component for Spotlight Cover
const SpotlightCover: React.FC<{ thumbnail: string; title: string }> = ({ thumbnail, title }) => {
    const cardRef = React.useRef<HTMLDivElement>(null);
    const [rotation, setRotation] = React.useState({ x: 0, y: 0 });
    const [glare, setGlare] = React.useState({ x: 50, y: 50, opacity: 0 });
    const [isHovered, setIsHovered] = React.useState(false);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!cardRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        // Calculate rotation (max 10 degrees for this larger image)
        const rotateX = ((y - centerY) / centerY) * -10;
        const rotateY = ((x - centerX) / centerX) * 10;

        setRotation({ x: rotateX, y: rotateY });
        setGlare({
            x: (x / rect.width) * 100,
            y: (y / rect.height) * 100,
            opacity: 1
        });
    };

    const handleMouseLeave = () => {
        setRotation({ x: 0, y: 0 });
        setGlare(prev => ({ ...prev, opacity: 0 }));
        setIsHovered(false);
    };

    return (
        <div
            ref={cardRef}
            // Add initial rotation (rotate-3) that is removed on hover
            className={`hidden md:block w-56 lg:w-64 shrink-0 rounded-xl relative perspective-1000 transition-transform duration-500 ease-out ${isHovered ? 'rotate-0' : 'rotate-3'}`}
            style={{ perspective: '1000px' }}
            onMouseEnter={(e) => {
                setIsHovered(true);
                handleMouseMove(e);
            }}
            onMouseLeave={handleMouseLeave}
            onMouseMove={handleMouseMove}
        >
            <div
                className="w-full h-full rounded-xl overflow-hidden transition-all duration-75 ease-out"
                style={{
                    transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) scale3d(${isHovered ? 1.02 : 1}, ${isHovered ? 1.02 : 1}, 1)`,
                    transformStyle: 'preserve-3d',
                }}
            >
                {/* Glare Overlay */}
                <div
                    className="absolute inset-0 z-30 pointer-events-none mix-blend-overlay transition-opacity duration-300"
                    style={{
                        background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,0.4) 0%, transparent 80%)`,
                        opacity: glare.opacity
                    }}
                />
                <img
                    src={thumbnail}
                    alt={title}
                    className="w-full h-auto object-cover"
                />
            </div>
        </div>
    );
};

const MangaSpotlight: React.FC<MangaSpotlightProps> = ({ onMangaClick }) => {
    const { language } = useTitleLanguage();
    const cachedSpotlight = mangaService.peekEnrichedSpotlight();
    const [mangas, setMangas] = useState<Manga[]>(cachedSpotlight?.data || []);
    const [loading, setLoading] = useState(!(cachedSpotlight?.data?.length));

    // Embla Carousel hook with Autoplay
    const [emblaRef, emblaApi] = useEmblaCarousel({
        loop: true,
        duration: 20
    }, [
        Autoplay({ delay: 5000, stopOnInteraction: false, stopOnMouseEnter: true })
    ]);
    const [selectedIndex, setSelectedIndex] = useState(0);

    const onSelect = useCallback(() => {
        if (!emblaApi) return;
        setSelectedIndex(emblaApi.selectedScrollSnap());
    }, [emblaApi]);

    useEffect(() => {
        const fetchTrendingManga = async () => {
            try {
                // Use enriched spotlight data (AniList + MangaKatana chapters)
                const { data } = await mangaService.getEnrichedSpotlight();
                if (data) {
                    setMangas(data);
                }
            } catch (err) {
                console.error('Failed to fetch trending manga for spotlight', err);
            } finally {
                setLoading(false);
            }
        };

        fetchTrendingManga();
    }, []);

    useEffect(() => {
        if (!emblaApi) return;
        onSelect();
        emblaApi.on('select', onSelect);
        return () => {
            emblaApi.off('select', onSelect);
        };
    }, [emblaApi, onSelect]);

    const scrollTo = useCallback((index: number) => {
        if (emblaApi) emblaApi.scrollTo(index);
    }, [emblaApi]);

    if (loading) {
        return (
            <div className="relative w-full h-[50vh] md:h-[60vh] min-h-[400px] md:min-h-[480px] overflow-hidden mb-8 bg-[#0a0a0a] animate-pulse">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0a0a]/60 to-[#0a0a0a]" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] via-[#0a0a0a]/80 to-transparent" />

                <div className="absolute inset-0 flex items-center px-8 md:px-14 z-10">
                    <div className="flex flex-col md:flex-row gap-12 items-center w-full max-w-7xl mx-auto mt-12">
                        <div className="flex-1 w-full max-w-2xl">
                            <div className="h-5 w-32 rounded bg-white/10 mb-4" />
                            <div className="h-10 md:h-14 w-4/5 rounded bg-white/10 mb-4" />
                            <div className="h-10 md:h-14 w-3/5 rounded bg-white/10 mb-8" />

                            <div className="flex gap-3 mb-6">
                                <div className="h-8 w-24 rounded-lg bg-white/10" />
                                <div className="h-8 w-28 rounded-lg bg-white/10" />
                                <div className="h-8 w-20 rounded-lg bg-white/10" />
                            </div>

                            <div className="space-y-2 mb-8">
                                <div className="h-4 w-full rounded bg-white/10" />
                                <div className="h-4 w-11/12 rounded bg-white/10" />
                                <div className="h-4 w-4/5 rounded bg-white/10" />
                            </div>

                            <div className="flex gap-4">
                                <div className="h-12 w-40 rounded-full bg-white/10" />
                                <div className="h-12 w-32 rounded-full bg-white/10" />
                            </div>
                        </div>

                        <div className="hidden md:block w-56 lg:w-64 h-[360px] rounded-xl bg-white/10" />
                    </div>
                </div>

                <div className="absolute bottom-6 right-6 flex gap-2">
                    <div className="w-8 h-8 rounded-lg bg-white/10" />
                    <div className="w-8 h-8 rounded-lg bg-white/10" />
                </div>

                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 md:hidden">
                    {Array.from({ length: 5 }).map((_, idx) => (
                        <div key={`manga-spotlight-dot-mobile-${idx}`} className="w-2 h-2 rounded-full bg-white/20" />
                    ))}
                </div>

                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 hidden md:flex gap-2">
                    {Array.from({ length: 5 }).map((_, idx) => (
                        <div
                            key={`manga-spotlight-dot-desktop-${idx}`}
                            className={`h-2 rounded-full ${idx === 0 ? 'w-6 bg-white/30' : 'w-2 bg-white/20'}`}
                        />
                    ))}
                </div>
            </div>
        );
    }

    if (mangas.length === 0) return null;

    return (
        <div className="relative w-full h-[50vh] md:h-[60vh] min-h-[400px] md:min-h-[480px] group bg-[#0a0a0a] overflow-hidden mb-8">
            {/* Embla Viewport */}
            <div className="absolute inset-0 overflow-hidden" ref={emblaRef}>
                <div className="flex h-full touch-pan-y">
                    {mangas.map((manga, index) => {
                        return (
                        <div key={manga.id || manga.mal_id || index} className="relative min-w-full h-full flex-[0_0_100%]">
                            {/* Background Image */}
                            <div className="absolute inset-0 z-0 select-none overflow-hidden">
                                <m.div
                                    initial={{ scale: 1.05, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 0.6 }}
                                    transition={{ duration: 0.8 }}
                                    className="absolute inset-0 bg-no-repeat bg-cover bg-center md:blur-lg md:scale-110"
                                    style={{
                                        backgroundImage: `url(${manga.images.jpg.large_image_url})`,
                                    }}
                                />
                                <div className="absolute inset-0 bg-black/60 md:bg-black/40" />
                                {/* Gradient Overlay */}
                                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0a0a]/60 to-[#0a0a0a]" />
                                <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] via-[#0a0a0a]/80 to-transparent pointer-events-none" />
                            </div>
                        </div>
                        );
                    })}
                </div>
            </div>

            {/* Fixed Overlay Content */}
            <div className="absolute inset-0 flex items-center z-10 pointer-events-none">
                <AnimatePresence>
                    {mangas[selectedIndex] && (() => {
                        const activeManga = mangas[selectedIndex];
                        const displayTitle = getDisplayTitle(activeManga as unknown as Record<string, unknown>, language);
                        return (
                            <m.div
                                key={selectedIndex}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.4, ease: "easeInOut" }}
                                className="absolute inset-0 flex flex-col md:flex-row gap-12 items-center w-full max-w-7xl mx-auto px-8 md:px-14 mt-12"
                            >
                                {/* Text Info (Left) */}
                                <div className="flex-1 pointer-events-auto w-full max-w-2xl flex flex-col justify-end h-[360px] md:h-[380px]">
                                    {/* Top Section: Mobile Cover & Title */}
                                    <div className="w-full mb-4">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="md:hidden h-24 w-16 rounded-md overflow-hidden flex-shrink-0 relative">
                                                <img
                                                    src={activeManga.images.jpg.large_image_url}
                                                    alt={displayTitle}
                                                    className="w-full h-full object-cover"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                            </div>
                                        </div>
                                        <div className="flex items-start">
                                            <AnimeLogoImage
                                                tmdbId={parseInt((activeManga.id || activeManga.mal_id || '0').toString())}
                                                title={displayTitle}
                                                className="drop-shadow-2xl"
                                                size="medium"
                                            />
                                        </div>
                                    </div>

                                    {/* Middle Section: Chips */}
                                    <div className="w-full flex items-center flex-wrap gap-4 text-white select-none mb-4">
                                        {/* Author Chip */}
                                        {activeManga.authors?.[0]?.name && activeManga.authors[0].name !== 'Unknown' && (
                                            <span className="flex items-center justify-center gap-1.5 bg-white/10 px-3 h-8 rounded-lg backdrop-blur-sm text-sm font-bold">
                                                <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                                {activeManga.authors[0].name}
                                            </span>
                                        )}

                                        {/* Latest Chapter Chip */}
                                        {(activeManga.chapters || activeManga.volumes) && (
                                            <span className="flex items-center justify-center gap-1.5 bg-[#22c55e] text-white px-3 h-8 rounded-lg backdrop-blur-sm text-sm font-bold">
                                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 4H5a2 2 0 00-2 2v12a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v2H6V9h5v2zm7 0h-1.5v-.5h-2v3h2V13H18v2h-5V9h5v2z" /></svg>
                                                Chapter {activeManga.chapters || activeManga.volumes}
                                            </span>
                                        )}

                                        {/* Type/Origin Chip */}
                                        <span className="flex items-center justify-center px-3 h-8 rounded-lg bg-yorumi-manga/20 text-yorumi-manga text-sm font-bold border border-yorumi-manga/50 uppercase backdrop-blur-sm">
                                            {activeManga.countryOfOrigin === 'KR'
                                                ? 'Manhwa'
                                                : activeManga.countryOfOrigin === 'CN'
                                                    ? 'Manhua'
                                                    : (activeManga.type || 'Manga')
                                            }
                                        </span>
                                    </div>

                                    {/* Bottom Section: Synopsis & Buttons */}
                                    <div className="w-full mb-6">
                                        <p className="text-gray-300 text-sm md:text-base line-clamp-3 max-w-xl leading-relaxed">
                                            {activeManga.synopsis}
                                        </p>
                                    </div>

                                    <div className="w-full flex gap-4">
                                        <button
                                            onClick={() => onMangaClick((activeManga.id || activeManga.mal_id).toString(), true, activeManga)}
                                            className="bg-yorumi-manga text-white px-5 py-2.5 rounded-lg font-bold hover:bg-white hover:text-yorumi-bg transition-all duration-300 flex items-center gap-2 shadow-[0_0_15px_rgba(192,132,252,0.3)] hover:shadow-[0_0_25px_rgba(192,132,252,0.5)] text-sm md:text-base"
                                        >
                                            <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                            Read Now
                                        </button>
                                        <button
                                            onClick={() => onMangaClick((activeManga.id || activeManga.mal_id).toString(), false, activeManga)}
                                            className="bg-white/10 backdrop-blur-md border border-white/20 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-white/20 transition-all duration-300 flex items-center gap-2 text-sm md:text-base"
                                        >
                                            Detail <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                        </button>
                                    </div>
                                </div>

                                {/* Coverflow Images (Right - Portrait) */}
                                <div className="ml-auto lg:mr-12 xl:mr-20 pointer-events-none relative w-56 lg:w-64 h-[336px] lg:h-[384px] group">
                                    {/* Previous Card */}
                                    {mangas.length > 1 && (
                                        <div 
                                            onClick={() => scrollTo((selectedIndex - 1 + mangas.length) % mangas.length)}
                                            className="absolute inset-0 hidden md:block pointer-events-auto cursor-pointer z-0"
                                        >
                                            <div 
                                                className="w-full h-full origin-bottom transition-transform duration-500 ease-out [transform:translateX(-40%)_translateY(-20px)_scale(0.9)_rotate(-8deg)] group-hover:[transform:translateX(-45%)_translateY(-20px)_scale(0.92)_rotate(-6deg)]"
                                            >
                                                <div className="w-full h-full rounded-xl overflow-hidden brightness-[0.6] transition-all duration-300">
                                                    <img src={mangas[(selectedIndex - 1 + mangas.length) % mangas.length].images.jpg.large_image_url} className="w-full h-full object-cover" alt="" />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Active Card */}
                                    <div className="absolute inset-0 z-10 pointer-events-auto transition-transform duration-500 ease-out group-hover:-translate-y-4">
                                        {activeManga.images?.jpg?.large_image_url && <SpotlightCover thumbnail={activeManga.images.jpg.large_image_url} title={displayTitle} />}
                                    </div>

                                    {/* Next Card */}
                                    {mangas.length > 2 && (
                                        <div 
                                            onClick={() => scrollTo((selectedIndex + 1) % mangas.length)}
                                            className="absolute inset-0 hidden md:block pointer-events-auto cursor-pointer z-0"
                                        >
                                            <div 
                                                className="w-full h-full origin-bottom transition-transform duration-500 ease-out [transform:translateX(40%)_translateY(-20px)_scale(0.9)_rotate(8deg)] group-hover:[transform:translateX(45%)_translateY(-20px)_scale(0.92)_rotate(6deg)]"
                                            >
                                                <div className="w-full h-full rounded-xl overflow-hidden brightness-[0.6] transition-all duration-300">
                                                    <img src={mangas[(selectedIndex + 1) % mangas.length].images.jpg.large_image_url} className="w-full h-full object-cover" alt="" />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </m.div>
                        );
                    })()}
                </AnimatePresence>
            </div>



            {/* Dots Indicator */}
            <div className="absolute z-20 flex gap-2 right-4 top-1/2 -translate-y-1/2 flex-col md:flex-row md:bottom-6 md:left-1/2 md:-translate-x-1/2 md:top-auto md:right-auto md:translate-y-0">
                {mangas.map((_, idx) => (
                    <button
                        key={idx}
                        onClick={() => scrollTo(idx)}
                        className={`w-2 h-2 rounded-full transition-all duration-300 ${idx === selectedIndex ? 'bg-yorumi-manga md:w-6 h-6 md:h-2' : 'bg-white/30 hover:bg-white/50'
                            }`}
                        aria-label={`Go to slide ${idx + 1}`}
                    />
                ))}
            </div>
        </div>
    );
};

export default MangaSpotlight;

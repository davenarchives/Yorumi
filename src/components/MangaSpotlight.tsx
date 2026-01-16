import React, { useState, useEffect, useCallback } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { mangaService } from '../services/mangaService';
import type { Manga } from '../types/manga';

interface MangaSpotlightProps {
    onMangaClick: (mangaId: string) => void;
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
                className="w-full h-full rounded-xl overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.6)] border border-white/10 transition-all duration-75 ease-out"
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
    const [mangas, setMangas] = useState<Manga[]>([]);
    const [loading, setLoading] = useState(true);

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
                // Use getTrendingManga for trending data (TRENDING_DESC)
                const { data } = await mangaService.getTrendingManga(1);
                if (data) {
                    // Take top 8 for spotlight
                    setMangas(data.slice(0, 8));
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

    const handleNext = useCallback(() => {
        if (emblaApi) emblaApi.scrollNext();
    }, [emblaApi]);

    const handlePrev = useCallback(() => {
        if (emblaApi) emblaApi.scrollPrev();
    }, [emblaApi]);

    const scrollTo = useCallback((index: number) => {
        if (emblaApi) emblaApi.scrollTo(index);
    }, [emblaApi]);

    if (loading) {
        return <div className="w-full h-[75vh] bg-[#0a0a0a] animate-pulse" />;
    }

    if (mangas.length === 0) return null;

    return (
        <div className="relative w-full h-[75vh] min-h-[600px] group bg-[#0a0a0a] overflow-hidden mb-8">
            {/* Embla Viewport */}
            <div className="absolute inset-0 overflow-hidden" ref={emblaRef}>
                <div className="flex h-full touch-pan-y">
                    {mangas.map((manga, index) => (
                        <div key={manga.mal_id || index} className="relative min-w-full h-full flex-[0_0_100%]">
                            {/* Background Image (Blurred) */}
                            <div className="absolute inset-0 z-0 select-none overflow-hidden">
                                <div
                                    className="absolute inset-0 bg-no-repeat bg-cover bg-center blur-2xl scale-110 opacity-60"
                                    style={{
                                        backgroundImage: `url(${manga.images.jpg.large_image_url})`,
                                    }}
                                />
                                <div className="absolute inset-0 bg-black/40" />
                                {/* Gradient Overlay */}
                                <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] via-[#0a0a0a]/80 to-transparent" />
                                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent" />
                            </div>

                            {/* Content */}
                            <div className="absolute inset-0 flex items-center px-8 md:px-14 z-10 pointer-events-none">
                                <div className="flex flex-col md:flex-row gap-12 items-center w-full max-w-7xl mx-auto mt-12">

                                    {/* Text Info (Left) */}
                                    <div className="flex-1 pointer-events-auto max-w-2xl">
                                        <div className="text-[#d886ff] font-bold tracking-wider text-base mb-3 uppercase select-none">
                                            #{index + 1} Trending
                                        </div>
                                        <h1 className={`${manga.title.length > 50 ? 'text-xl md:text-2xl lg:text-3xl' :
                                            manga.title.length > 30 ? 'text-2xl md:text-3xl lg:text-4xl' :
                                                'text-2xl md:text-4xl lg:text-5xl'
                                            } font-black text-white mb-4 leading-[1.1] drop-shadow-lg select-none line-clamp-2`}>
                                            {manga.title}
                                        </h1>

                                        <div className="flex items-center flex-wrap gap-4 text-sm text-white mb-6 font-medium select-none">
                                            <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg backdrop-blur-sm">
                                                <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" /></svg>
                                                {manga.score.toFixed(1)}
                                            </span>

                                            <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg backdrop-blur-sm">
                                                <span className={`w-2 h-2 rounded-full ${manga.status === 'Publishing' ? 'bg-green-500' : 'bg-gray-500'}`}></span>
                                                {manga.chapters ? `${manga.chapters} Chapters` : manga.status}
                                            </span>

                                            <span className="bg-yorumi-accent/20 text-yorumi-accent px-3 py-1.5 rounded-lg text-xs font-bold border border-yorumi-accent/50">
                                                {manga.type || 'Manga'}
                                            </span>
                                        </div>

                                        <p className="text-gray-300 text-sm md:text-base line-clamp-3 mb-8 max-w-xl leading-relaxed">
                                            {manga.synopsis}
                                        </p>

                                        <div className="flex gap-4">
                                            <button
                                                onClick={() => onMangaClick(manga.mal_id.toString())}
                                                className="bg-yorumi-accent text-yorumi-bg px-8 py-3.5 rounded-full font-bold hover:bg-white transition-all duration-300 transform hover:scale-105 flex items-center gap-3 shadow-[0_0_20px_rgba(253,200,73,0.3)] hover:shadow-[0_0_30px_rgba(253,200,73,0.6)]"
                                            >
                                                <div className="bg-yorumi-bg text-white rounded-full p-1.5 -ml-2">
                                                    <svg className="w-3 h-3 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                                </div>
                                                Read Now
                                            </button>
                                            <button
                                                onClick={() => onMangaClick(manga.mal_id.toString())}
                                                className="bg-white/10 backdrop-blur-md border border-white/20 text-white px-8 py-3.5 rounded-full font-bold hover:bg-white/20 transition-all duration-300 flex items-center gap-2"
                                            >
                                                Detail <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Cover Image (Right - Portrait) */}
                                    <div className="ml-auto lg:mr-12 xl:mr-20">
                                        <SpotlightCover thumbnail={manga.images.jpg.large_image_url} title={manga.title} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
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
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2 items-center">
                {mangas.map((_, idx) => (
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

export default MangaSpotlight;

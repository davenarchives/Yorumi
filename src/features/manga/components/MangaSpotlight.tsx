import React, { useState, useEffect, useCallback } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { mangaService } from '../../../services/mangaService';
import type { Manga } from '../../../types/manga';
import AnimeLogoImage from '../../../components/anime/AnimeLogoImage';
import { useTitleLanguage } from '../../../context/TitleLanguageContext';
import { getDisplayTitle } from '../../../utils/titleLanguage';
import { AnimatePresence, m } from 'framer-motion';
import CCIcon from '../../../components/ui/CCIcon';
import SpotlightSkeleton from '../../anime/components/SpotlightSkeleton';

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
    const [detailsById, setDetailsById] = useState<Record<string, Manga>>({});

    // Embla Carousel hook with Autoplay
    const [emblaRef, emblaApi] = useEmblaCarousel({
        loop: true,
        duration: 20
    }, [
        Autoplay({ delay: 5000, stopOnInteraction: false, stopOnMouseEnter: true })
    ]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const activeMangaId = String(mangas[selectedIndex]?.id || mangas[selectedIndex]?.mal_id || mangas[selectedIndex]?.scraper_id || '');

    const onSelect = useCallback(() => {
        if (!emblaApi) return;
        setSelectedIndex(emblaApi.selectedScrollSnap());
    }, [emblaApi]);

    useEffect(() => {
        let cancelled = false;
        const fetchTrendingManga = async () => {
            try {
                const { data } = await mangaService.getEnrichedSpotlight();
                if (data?.length) {
                    setMangas(data);
                    setLoading(false);
                    void mangaService.enrichVisibleManga(data, (enriched, index) => {
                        if (cancelled) return;
                        setMangas((current) => current.map((item, itemIndex) => itemIndex === index ? enriched : item));
                    });
                }
            } catch (err) {
                console.error('Failed to fetch trending manga for spotlight', err);
            } finally {
                setLoading(false);
            }
        };

        fetchTrendingManga();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        if (!emblaApi) return;
        onSelect();
        emblaApi.on('select', onSelect);
        return () => {
            emblaApi.off('select', onSelect);
        };
    }, [emblaApi, onSelect]);

    useEffect(() => {
        const activeManga = mangas[selectedIndex];
        const id = activeManga?.id || activeManga?.mal_id || activeManga?.scraper_id;
        const key = String(id || '');
        if (!id || detailsById[key]) return;

        let cancelled = false;
        void mangaService.getUnifiedMangaDetails(id).then((details) => {
            if (!cancelled && details) setDetailsById((current) => ({ ...current, [key]: details as Manga }));
        }).catch(() => undefined);
        return () => { cancelled = true; };
        // Progressive chapter hydration replaces Manga objects in-place. Keying
        // this effect by ID prevents those updates from restarting this request.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeMangaId]);

    const scrollTo = useCallback((index: number) => {
        if (emblaApi) emblaApi.scrollTo(index);
    }, [emblaApi]);

    if (loading) {
        return <SpotlightSkeleton variant="manga" />;
    }

    if (mangas.length === 0) return null;

    return (
        <div className="media-spotlight relative w-full h-[58vh] md:h-[60vh] min-h-[440px] md:min-h-[480px] group bg-[#0a0a0a] overflow-hidden mb-8">
            {/* Embla Viewport */}
            <div className="absolute inset-0 overflow-hidden" ref={emblaRef}>
                <div className="flex h-full touch-pan-y">
                    {mangas.map((manga, index) => {
                        const hydrated = detailsById[String(manga.id || manga.mal_id || manga.scraper_id || '')];
                        const cover = hydrated?.images?.jpg?.large_image_url
                            || hydrated?.images?.jpg?.image_url
                            || manga.images?.jpg?.large_image_url
                            || manga.images?.jpg?.image_url
                            || '';
                        return (
                        <div key={manga.id || manga.mal_id || index} className="relative min-w-full h-full flex-[0_0_100%]">
                            {/* Background Image */}
                            <div className="absolute inset-0 z-0 select-none overflow-hidden">
                                <m.div
                                    initial={{ scale: 1.05, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 0.6 }}
                                    transition={{ duration: 0.8 }}
                                    className="absolute inset-0 bg-no-repeat bg-cover bg-center"
                                    style={{
                                        backgroundImage: cover ? `url(${cover})` : undefined,
                                    }}
                                />
                                <div className="absolute inset-0 hidden bg-black/40 md:block" />
                                {/* Gradient Overlay */}
                                <div className="absolute inset-x-0 bottom-0 h-[60%] bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/80 to-transparent" />
                                <div className="absolute inset-0 hidden bg-gradient-to-r from-[#0a0a0a] via-[#0a0a0a]/80 to-transparent pointer-events-none md:block" />
                            </div>
                        </div>
                        );
                    })}
                </div>
            </div>

            {/* Fixed Overlay Content */}
            <div className="absolute inset-0 z-10 hidden items-center pointer-events-none md:flex">
                <AnimatePresence>
                    {mangas[selectedIndex] && (() => {
                        const activeManga = mangas[selectedIndex];
                        const details = detailsById[String(activeManga.id || activeManga.mal_id || activeManga.scraper_id || '')];
                        const displayManga = details ? {
                            ...activeManga,
                            ...details,
                            title: activeManga.title || details.title,
                            images: details.images || activeManga.images,
                        } : activeManga;
                        const navigationId = String(displayManga.scraper_id || displayManga.id || displayManga.mal_id);
                        const displayTitle = getDisplayTitle(displayManga as unknown as Record<string, unknown>, language);
                        const displayCover = displayManga.images?.jpg?.large_image_url || displayManga.images?.jpg?.image_url || '';
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
                                            <div className="hidden h-24 w-16 rounded-md overflow-hidden flex-shrink-0 relative">
                                                <img
                                                    src={displayCover}
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
                                    <div className="spotlight-meta w-full flex items-center flex-wrap gap-4 text-white select-none mb-4">
                                        {/* Author Chip */}
                                        {activeManga.authors?.[0]?.name && activeManga.authors[0].name !== 'Unknown' && (
                                            <span className="flex items-center justify-center gap-1.5 bg-white/10 px-3 h-8 rounded-lg text-sm font-bold">
                                                <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                                {activeManga.authors[0].name}
                                            </span>
                                        )}

                                        {/* Latest Chapter Chip */}
                                        {(activeManga.chapters || activeManga.volumes) && (
                                            <span className="flex items-center justify-center gap-1.5 bg-[#22c55e] text-white px-3 h-8 rounded-lg text-sm font-bold">
                                                <CCIcon className="w-3.5 h-3.5" />
                                                Chapter {activeManga.chapters || activeManga.volumes}
                                            </span>
                                        )}

                                        {/* Type/Origin Chip */}
                                        <span className="flex items-center justify-center px-3 h-8 rounded-lg bg-yorumi-manga/20 text-yorumi-manga text-sm font-bold border border-yorumi-manga/50 uppercase">
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

                                    <div className="spotlight-actions w-full flex gap-4">
                                        <button
                                            onClick={() => onMangaClick(navigationId, true, displayManga)}
                                            className="bg-yorumi-manga text-white px-5 py-2.5 rounded-lg font-bold hover:bg-white hover:text-yorumi-bg transition-all duration-300 flex items-center gap-2 shadow-[0_0_15px_rgba(192,132,252,0.3)] hover:shadow-[0_0_25px_rgba(192,132,252,0.5)] text-sm md:text-base"
                                        >
                                            <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                            Read Now
                                        </button>
                                        <button
                                            onClick={() => onMangaClick(navigationId, false, displayManga)}
                                            className="bg-white/10 border border-white/20 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-white/20 transition-all duration-300 flex items-center gap-2 text-sm md:text-base"
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
                                                    <img src={mangas[(selectedIndex - 1 + mangas.length) % mangas.length].images?.jpg?.large_image_url || mangas[(selectedIndex - 1 + mangas.length) % mangas.length].images?.jpg?.image_url} className="w-full h-full object-cover" alt="" />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Active Card */}
                                    <div className="absolute inset-0 z-10 pointer-events-auto transition-transform duration-500 ease-out group-hover:-translate-y-4">
                                        {displayCover && <SpotlightCover thumbnail={displayCover} title={displayTitle} />}
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
                                                    <img src={mangas[(selectedIndex + 1) % mangas.length].images?.jpg?.large_image_url || mangas[(selectedIndex + 1) % mangas.length].images?.jpg?.image_url} className="w-full h-full object-cover" alt="" />
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



            {mangas[selectedIndex] && (() => {
                const activeManga = mangas[selectedIndex];
                const details = detailsById[String(activeManga.id || activeManga.mal_id || activeManga.scraper_id || '')];
                const displayManga = details ? { ...activeManga, ...details, title: activeManga.title || details.title, images: details.images || activeManga.images, chapters: details.chapters || activeManga.chapters, authors: details.authors?.length ? details.authors : activeManga.authors, author: details.author || activeManga.author, genres: details.genres?.length ? details.genres : activeManga.genres } : activeManga;
                const navigationId = String(displayManga.scraper_id || displayManga.id || displayManga.mal_id);
                const displayTitle = getDisplayTitle(displayManga as unknown as Record<string, unknown>, language);
                const chapterCount = displayManga.chapters || displayManga.volumes;
                const author = displayManga.authors?.[0]?.name || displayManga.author;
                const rating = displayManga.score && displayManga.score > 0 ? displayManga.score.toFixed(1) : null;
                return (
                    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between px-4 pb-4 md:hidden" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.25rem)' }}>
                        <div className="flex items-start justify-between">
                            <div className="rounded-full bg-black/55 px-3 py-2 text-sm font-bold text-white">{chapterCount ? `CH ${chapterCount}` : (activeManga.type || 'MANGA')}</div>
                            <div className="rounded-full bg-black/55 px-4 py-2 text-sm font-bold text-white">{selectedIndex + 1} <span className="text-white/50">/ {mangas.length}</span></div>
                        </div>
                        <div className="space-y-3 pb-1">
                            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-white">
                                {chapterCount && <span className="flex items-center gap-1 rounded-full border border-white/15 bg-black/45 px-3 py-1.5"><CCIcon className="h-3.5 w-3.5" /> {chapterCount}</span>}
                                {rating && <span className="rounded-full border border-white/15 bg-black/45 px-3 py-1.5">☆ {rating}</span>}
                                {author && <span className="rounded-full border border-white/15 bg-black/45 px-3 py-1.5">{author}</span>}
                            </div>
                            <h2 className="max-w-[95%] text-[27px] font-extrabold leading-[1.16] tracking-tight text-white drop-shadow-lg">{displayTitle}</h2>
                            <div className="flex flex-wrap gap-2 text-xs font-medium text-white">
                                {(displayManga.genres || []).slice(0, 3).map((genre) => <span key={genre.name} className="rounded-full border border-white/15 bg-black/45 px-3 py-1.5">{genre.name}</span>)}
                            </div>
                            <div className="pointer-events-auto flex gap-2 pt-1">
                                <button type="button" onClick={() => onMangaClick(navigationId, true, displayManga)} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-yorumi-manga px-3 text-sm font-bold text-white shadow-[0_0_16px_rgba(168,85,247,0.3)]">▶ Read Now</button>
                                <button type="button" onClick={() => onMangaClick(navigationId, false, displayManga)} className="flex h-10 min-w-[112px] items-center justify-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 text-sm font-bold text-white">Detail <span aria-hidden="true">›</span></button>
                            </div>
                        </div>
                    </div>
                );
            })()}
            {/* Dots Indicator */}
            <div className="absolute z-20 hidden md:flex gap-2 right-4 top-1/2 -translate-y-1/2 flex-col md:flex-row md:bottom-6 md:left-1/2 md:-translate-x-1/2 md:top-auto md:right-auto md:translate-y-0">
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

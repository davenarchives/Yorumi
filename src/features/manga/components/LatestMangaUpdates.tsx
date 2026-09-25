import React, { useState, useEffect, useCallback } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import MangaCard from './MangaCard';
import { mangaService } from '../../../services/mangaService';
import type { Manga } from '../../../types/manga';

interface HotUpdate {
    id: string;
    title: string;
    chapter: string;
    thumbnail: string;
    url: string;
}

interface LatestMangaUpdatesProps {
    onMangaClick?: (mangaId: string, autoRead?: boolean, manga?: Manga) => void;
}

export default function LatestMangaUpdates({ onMangaClick }: LatestMangaUpdatesProps) {
    const [updates, setUpdates] = useState<HotUpdate[]>([]);
    const [loading, setLoading] = useState(true);
    const [emblaRef, emblaApi] = useEmblaCarousel({
        align: 'center',
        containScroll: 'trimSnaps',
        dragFree: true
    });

    const fetchUpdates = async () => {
        setLoading(true);
        try {
            const data = await mangaService.getHotUpdates();
            if (data && Array.isArray(data)) {
                setUpdates(data);
            } else {
                setUpdates([]);
            }
        } catch (err) {
            console.error('[LatestMangaUpdates] Failed to fetch hot updates:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUpdates();
    }, []);

    const scrollPrev = useCallback(() => emblaApi && emblaApi.scrollPrev(), [emblaApi]);
    const scrollNext = useCallback(() => emblaApi && emblaApi.scrollNext(), [emblaApi]);

    if (loading) {
        return (
            <section className="mb-12 animate-pulse">
                <div className="flex items-center justify-between mb-4">
                    <div className="h-8 w-56 rounded bg-white/10" />
                    <div className="h-6 w-20 rounded bg-white/10" />
                </div>
                <div className="flex gap-4 overflow-hidden">
                    {Array.from({ length: 6 }).map((_, idx) => (
                        <div key={idx} className="flex-[0_0_140px] md:flex-[0_0_210px] lg:flex-[0_0_230px]">
                            <div className="aspect-[2/3] rounded-lg bg-white/10 mb-3" />
                            <div className="h-4 w-4/5 rounded bg-white/10" />
                            <div className="h-4 w-3/5 rounded bg-white/10 mt-2" />
                        </div>
                    ))}
                </div>
            </section>
        );
    }

    if (updates.length === 0) return null;

    return (
        <section className="mb-12">
            <div className="flex items-center gap-4 mb-6">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide uppercase leading-none whitespace-nowrap">Latest Updates</h2>
                <div className="flex-1 h-px bg-white/10" />

                <div className="flex items-center gap-4">
                    <div className="flex gap-2">
                        <button
                            onClick={scrollPrev}
                            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors border border-white/5"
                            aria-label="Previous"
                        >
                            <ChevronLeft className="w-4 h-4 text-gray-300" />
                        </button>
                        <button
                            onClick={scrollNext}
                            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors border border-white/5"
                            aria-label="Next"
                        >
                            <ChevronRight className="w-4 h-4 text-gray-300" />
                        </button>
                    </div>
                </div>
            </div>

            <div className="relative">
                <div className="flex gap-4">
                    {/* Carousel Container */}
                    <div className="flex-1 overflow-hidden" ref={emblaRef}>
                        <div className="flex gap-4">
                            {updates.map((manga) => {
                                const fakeManga = {
                                    mal_id: manga.id,
                                    id: manga.id,
                                    title: manga.title,
                                    title_english: manga.title,
                                    title_romaji: manga.title,
                                    images: { jpg: { large_image_url: manga.thumbnail, image_url: manga.thumbnail } },
                                    chapters: manga.chapter ? parseInt(manga.chapter.replace(/\D/g, '')) || undefined : undefined,
                                    type: 'Manga',
                                    status: 'Unknown',
                                    score: 0,
                                    genres: []
                                } as unknown as Manga;
                                
                                return (
                                    <div
                                        key={manga.id}
                                        className="flex-[0_0_140px] md:flex-[0_0_210px] lg:flex-[0_0_230px]"
                                    >
                                        <MangaCard
                                            manga={fakeManga}
                                            onClick={(mangaObj) => onMangaClick?.(manga.id, false, mangaObj)}
                                            disableTilt
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

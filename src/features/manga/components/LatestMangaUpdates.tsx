import React, { useState, useEffect, useCallback } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import MangaCard from './MangaCard';
import MangaCardSkeleton from './MangaCardSkeleton';
import { mangaService } from '../../../services/mangaService';
import type { Manga } from '../../../types/manga';
import {
    cleanMangaHotTitle,
    enhanceMangaPosterMeta,
    peekEnhancedMangaMeta,
    type EnhancedMangaPosterMeta,
} from '../../../utils/mangaPosterCache';

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

let cachedHotUpdates: HotUpdate[] = [];

export default function LatestMangaUpdates({ onMangaClick }: LatestMangaUpdatesProps) {
    const [updates, setUpdates] = useState<HotUpdate[]>(cachedHotUpdates);
    const [loading, setLoading] = useState(cachedHotUpdates.length === 0);
    const [enhancedByTitle, setEnhancedByTitle] = useState<Record<string, EnhancedMangaPosterMeta>>({});
    const [emblaRef, emblaApi] = useEmblaCarousel({
        align: 'start',
        containScroll: 'trimSnaps',
        dragFree: true
    });

    const fetchUpdates = async () => {
        if (cachedHotUpdates.length === 0) setLoading(true);
        try {
            const data = await mangaService.getHotUpdates();
            if (data && Array.isArray(data)) {
                cachedHotUpdates = data;
                setUpdates(data);
            } else if (cachedHotUpdates.length === 0) {
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

    useEffect(() => {
        if (!updates.length) return;
        let cancelled = false;

        void (async () => {
            for (const item of updates) {
                if (cancelled) break;
                const cleanTitle = cleanMangaHotTitle(item.title);
                if (!cleanTitle) continue;

                const cached = peekEnhancedMangaMeta(cleanTitle);
                if (cached) {
                    if (!cancelled) {
                        setEnhancedByTitle((prev) => ({ ...prev, [item.id]: cached }));
                    }
                    continue;
                }

                const enhanced = await enhanceMangaPosterMeta(cleanTitle);
                if (enhanced && !cancelled) {
                    setEnhancedByTitle((prev) => ({ ...prev, [item.id]: enhanced }));
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [updates]);

    const scrollPrev = useCallback(() => emblaApi && emblaApi.scrollPrev(), [emblaApi]);
    const scrollNext = useCallback(() => emblaApi && emblaApi.scrollNext(), [emblaApi]);

    if (loading) {
        return (
            <section className="mb-10 animate-pulse">
                <div className="flex items-center justify-between mb-4">
                    <div className="h-8 w-56 rounded bg-white/10" />
                    <div className="h-6 w-20 rounded bg-white/10" />
                </div>
                <div className="flex gap-3 sm:gap-4 overflow-hidden">
                    {Array.from({ length: 6 }).map((_, idx) => (
                        <div key={idx} className="flex-[0_0_148px] sm:flex-[0_0_175px] md:flex-[0_0_290px] lg:flex-[0_0_300px]">
                            <MangaCardSkeleton />
                        </div>
                    ))}
                </div>
            </section>
        );
    }

    if (updates.length === 0) return null;

    return (
        <section className="mb-10">
            <div className="mb-4 flex items-center justify-between gap-4">
                <h2 className="text-[20px] sm:text-[22px] font-extrabold text-white tracking-tight">Latest Updates</h2>

                <div className="flex items-center gap-4">
                    <div className="flex gap-2">
                        <button
                            onClick={scrollPrev}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08] hover:bg-white/[0.18] transition-colors"
                            aria-label="Previous"
                        >
                            <ChevronLeft className="w-4 h-4 text-gray-300" />
                        </button>
                        <button
                            onClick={scrollNext}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08] hover:bg-white/[0.18] transition-colors"
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
                        <div className="flex gap-3 sm:gap-4">
                            {updates.map((manga) => {
                                const cleanTitle = cleanMangaHotTitle(manga.title);
                                const enhanced = enhancedByTitle[manga.id] || peekEnhancedMangaMeta(cleanTitle) || undefined;
                                const coverUrl = enhanced?.coverUrl || manga.thumbnail;
                                const bannerUrl = enhanced?.bannerUrl || coverUrl;

                                const fakeManga = {
                                    mal_id: manga.id,
                                    id: manga.id,
                                    title: manga.title,
                                    title_english: manga.title,
                                    title_romaji: manga.title,
                                    images: { jpg: { large_image_url: coverUrl, image_url: coverUrl } },
                                    bannerImage: bannerUrl,
                                    chapters: manga.chapter ? Number.parseFloat(manga.chapter.match(/\d+(?:\.\d+)?/)?.[0] || '') || undefined : undefined,
                                    type: enhanced?.type || 'Manga',
                                    status: 'Unknown',
                                    score: enhanced?.score || 0,
                                    genres: []
                                } as unknown as Manga;
                                
                                return (
                                    <div
                                        key={manga.id}
                                        className="flex-[0_0_148px] sm:flex-[0_0_175px] md:flex-[0_0_290px] lg:flex-[0_0_300px]"
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

import React, { useState, useEffect, useCallback } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { lnService } from '../../../services/lnService';
import type { LightNovel } from '../../../types/ln';
import LNCard from './LNCard';
import MangaCardSkeleton from '../../manga/components/MangaCardSkeleton';

interface AllTimePopularLNProps {
    onLNClick: (id: string, autoRead?: boolean, lnData?: LightNovel) => void;
}

export default function AllTimePopularLN({ onLNClick }: AllTimePopularLNProps) {
    const initialLns = lnService.peekPopular(1);
    const [lns, setLns] = useState<LightNovel[]>(initialLns);
    const [loading, setLoading] = useState(initialLns.length === 0);
    const [emblaRef, emblaApi] = useEmblaCarousel({
        align: 'start',
        containScroll: 'trimSnaps',
        dragFree: true,
    });

    useEffect(() => {
        let mounted = true;
        lnService.getPopular()
            .then((data) => {
                if (mounted) {
                    setLns(data);
                    setLoading(false);
                }
            })
            .catch(() => {
                if (mounted) setLoading(false);
            });
        return () => {
            mounted = false;
        };
    }, []);

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

    if (lns.length === 0) return null;

    return (
        <section className="mb-10">
            <div className="mb-4 flex items-center justify-between gap-4">
                <h2 className="text-[20px] sm:text-[22px] font-extrabold text-white tracking-tight">
                    All Time Popular
                </h2>

                <div className="flex items-center gap-4">
                    <div className="flex gap-2">
                        <button
                            onClick={scrollPrev}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08] hover:bg-white/[0.18] transition-colors cursor-pointer"
                            aria-label="Previous"
                        >
                            <ChevronLeft className="w-4 h-4 text-gray-300" />
                        </button>
                        <button
                            onClick={scrollNext}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08] hover:bg-white/[0.18] transition-colors cursor-pointer"
                            aria-label="Next"
                        >
                            <ChevronRight className="w-4 h-4 text-gray-300" />
                        </button>
                    </div>
                </div>
            </div>

            <div className="relative">
                <div className="flex gap-4">
                    <div className="flex-1 overflow-hidden" ref={emblaRef}>
                        <div className="flex gap-3 sm:gap-4">
                            {lns.map((ln) => (
                                <div
                                    key={ln.id}
                                    className="flex-[0_0_148px] sm:flex-[0_0_175px] md:flex-[0_0_290px] lg:flex-[0_0_300px]"
                                >
                                    <LNCard
                                        ln={ln}
                                        onClick={(selectedLN) => onLNClick(String(selectedLN.id), false, selectedLN)}
                                        disableTilt
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

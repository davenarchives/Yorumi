import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { lnService } from '../../../services/lnService';
import type { LightNovel } from '../../../types/ln';
import LNCard from './LNCard';
import MangaCardSkeleton from '../../manga/components/MangaCardSkeleton';

interface Top100LNProps {
    onLNClick: (id: string, autoRead?: boolean, lnData?: LightNovel) => void;
}

const PAGE_SIZE = 12;

export default function Top100LN({ onLNClick }: Top100LNProps) {
    const navigate = useNavigate();
    const initialLns = lnService.peekTop100(1);
    const [lns, setLns] = useState<LightNovel[]>(initialLns);
    const [loading, setLoading] = useState(initialLns.length === 0);
    const [pageIndex, setPageIndex] = useState(0);

    useEffect(() => {
        let mounted = true;
        lnService.getTop100Full()
            .then((data) => {
                if (mounted && data.length > 0) {
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

    const totalPages = Math.max(1, Math.ceil(lns.length / PAGE_SIZE));
    const safePage = Math.min(pageIndex, totalPages - 1);
    const startIdx = safePage * PAGE_SIZE;
    const visibleLns = lns.slice(startIdx, startIdx + PAGE_SIZE);
    const canPrev = safePage > 0;
    const canNext = safePage < totalPages - 1;

    if (loading) {
        return (
            <section className="mb-10 animate-pulse">
                <div className="flex items-center justify-between mb-6">
                    <div className="h-7 w-44 rounded bg-white/10" />
                    <div className="h-6 w-28 rounded bg-white/10" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                    {Array.from({ length: PAGE_SIZE }).map((_, idx) => (
                        <MangaCardSkeleton key={idx} />
                    ))}
                </div>
            </section>
        );
    }

    if (lns.length === 0) return null;

    return (
        <section className="mb-10">
            {/* Header */}
            <div className="mb-4 flex items-center justify-between gap-4">
                <h2 className="text-[20px] sm:text-[22px] font-extrabold text-white tracking-tight">
                    Top 100 Light Novels
                </h2>
                <div className="flex items-center gap-3 shrink-0">
                    <button
                        type="button"
                        onClick={() => navigate('/ln/top-100')}
                        className="inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-white/80 hover:text-white transition-colors cursor-pointer"
                    >
                        <span>View all</span>
                        <ChevronRight className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            disabled={!canPrev}
                            onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08] hover:bg-white/[0.18] text-white transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-default disabled:hover:bg-white/[0.08]"
                            aria-label="Previous page"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            disabled={!canNext}
                            onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08] hover:bg-white/[0.18] text-white transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-default disabled:hover:bg-white/[0.08]"
                            aria-label="Next page"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* 3-Row Paged Grid Layout */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {visibleLns.map((ln, index) => (
                    <div
                        key={ln.id}
                        className="relative group cursor-pointer"
                    >
                        <LNCard
                            ln={ln}
                            rank={startIdx + index + 1}
                            showRanking
                            onClick={(selectedLN) => onLNClick(String(selectedLN.id), false, selectedLN)}
                            disableTilt
                        />
                    </div>
                ))}
            </div>
        </section>
    );
}

import React, { useState, useEffect } from 'react';
import { lnService } from '../../../services/lnService';
import type { LightNovel } from '../../../types/ln';
import LNCard from './LNCard';

interface Top100LNProps {
    onLNClick: (id: string, autoRead?: boolean, lnData?: LightNovel) => void;
}

export default function Top100LN({ onLNClick }: Top100LNProps) {
    const [lns, setLns] = useState<LightNovel[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        lnService.getTop100()
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

    if (loading) {
        return (
            <section className="mb-12 animate-pulse">
                <div className="flex items-center justify-between mb-6">
                    <div className="h-7 w-44 rounded bg-white/10" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {Array.from({ length: 12 }).map((_, idx) => (
                        <div key={idx}>
                            <div className="aspect-[2/3] rounded-lg bg-white/10 mb-2" />
                            <div className="h-4 w-4/5 rounded bg-white/10" />
                            <div className="h-4 w-3/5 rounded bg-white/10 mt-2" />
                        </div>
                    ))}
                </div>
            </section>
        );
    }

    if (lns.length === 0) return null;

    return (
        <section className="mb-12">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide uppercase leading-none whitespace-nowrap">
                    Top 100 Light Novels
                </h2>
                <div className="flex-1 h-px bg-white/10" />
            </div>

            {/* Grid Layout */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {lns.map((ln) => (
                    <div
                        key={ln.id}
                        className="relative group cursor-pointer"
                    >
                        <LNCard
                            ln={ln}
                            onClick={(selectedLN) => onLNClick(String(selectedLN.id), false, selectedLN)}
                            disableTilt
                        />
                    </div>
                ))}
            </div>
        </section>
    );
}

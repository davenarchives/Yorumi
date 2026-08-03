import React, { useState, useEffect } from 'react';
import { lnService } from '../../../services/lnService';
import type { LightNovel } from '../../../types/ln';
import { Trophy } from 'lucide-react';
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
            <div className="mb-10">
                <h2 className="text-xl font-bold text-white mb-4">TOP RATED</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-64 bg-[#141414] rounded-xl animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    if (lns.length === 0) return null;

    return (
        <div className="mb-10" data-hover-boundary>
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-extrabold text-white tracking-wide uppercase flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-400" />
                    Top Rated Light Novels
                </h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {lns.map((ln, index) => (
                    <LNCard
                        key={ln.id}
                        ln={ln}
                        rank={index + 1}
                        onClick={(selectedLN) => onLNClick(String(selectedLN.id), false, selectedLN)}
                    />
                ))}
            </div>
        </div>
    );
}

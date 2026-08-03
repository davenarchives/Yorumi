import React, { useState, useEffect } from 'react';
import { lnService } from '../../../services/lnService';
import type { LightNovel } from '../../../types/ln';
import LNCard from './LNCard';

interface LatestLNUpdatesProps {
    onLNClick: (id: string, autoRead?: boolean, lnData?: LightNovel) => void;
}

export default function LatestLNUpdates({ onLNClick }: LatestLNUpdatesProps) {
    const [lns, setLns] = useState<LightNovel[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        lnService.getLatestUpdates()
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
                <h2 className="text-xl font-bold text-white mb-4">LATEST UPDATES</h2>
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
                    <span className="w-2 h-6 bg-amber-400 rounded-full" />
                    Latest Updates
                </h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {lns.map((ln) => (
                    <LNCard
                        key={ln.id}
                        ln={ln}
                        onClick={(selectedLN) => onLNClick(String(selectedLN.id), false, selectedLN)}
                    />
                ))}
            </div>
        </div>
    );
}

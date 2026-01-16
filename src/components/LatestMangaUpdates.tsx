import { useState, useEffect } from 'react';
import { mangaService } from '../services/mangaService';

interface HotUpdate {
    id: string;
    title: string;
    chapter: string;
    thumbnail: string;
    url: string;
}

interface LatestMangaUpdatesProps {
    onMangaClick?: (mangaId: string) => void;
}

export default function LatestMangaUpdates({ onMangaClick }: LatestMangaUpdatesProps) {
    const [updates, setUpdates] = useState<HotUpdate[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUpdates = async () => {
            try {
                const { data } = await mangaService.getHotUpdates();
                if (data) {
                    setUpdates(data);
                }
            } catch (error) {
                console.error('Failed to fetch hot updates:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchUpdates();
    }, []);

    if (loading) {
        return (
            <div className="bg-[#1a1a2e] rounded-xl p-6 h-full min-h-[400px]">
                <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#ff6b9d]"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-[#1a1a2e] rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-[#ff6b9d] uppercase tracking-wide">Latest Updates</h2>
                <div className="flex gap-2">
                    <span className="text-xs text-gray-400 bg-[#0a0a0a] px-3 py-1.5 rounded-lg border border-white/5">
                        MangaKatana
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {updates.slice(0, 16).map((manga) => (
                    <div
                        key={manga.id}
                        className="group flex gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer border border-transparent hover:border-white/5"
                        onClick={() => onMangaClick?.(manga.id)}
                    >
                        {/* Thumbnail */}
                        <div className="relative w-16 h-24 flex-shrink-0 rounded-md overflow-hidden shadow-sm">
                            <img
                                src={manga.thumbnail}
                                alt={manga.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                loading="lazy"
                            />
                        </div>

                        {/* Info */}
                        <div className="flex flex-col justify-center min-w-0">
                            <h3 className="text-sm font-bold text-white leading-tight mb-1 truncate group-hover:text-yorumi-accent transition-colors">
                                {manga.title}
                            </h3>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-[10px] text-gray-400 bg-white/5 px-1.5 py-0.5 rounded">Manga</span>
                            </div>

                            <div className="flex items-center gap-1.5 text-xs text-[#22c55e] font-medium">
                                <span className="bg-[#22c55e]/10 px-2 py-0.5 rounded flex items-center gap-1">
                                    {manga.chapter}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

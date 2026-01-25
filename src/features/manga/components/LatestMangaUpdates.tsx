import { useState, useEffect } from 'react';
import { mangaService } from '../../../services/mangaService';

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
    const [error, setError] = useState<string | null>(null);
    const [showAll, setShowAll] = useState(false);

    const fetchUpdates = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await mangaService.getHotUpdates();
            if (data && Array.isArray(data)) {
                setUpdates(data);
            } else {
                setUpdates([]);
            }
        } catch (err) {
            console.error('[LatestMangaUpdates] Failed to fetch hot updates:', err);
            setError('Failed to load updates');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUpdates();
    }, []);

    if (loading) {
        return (
            <div className="bg-[#1a1a2e] rounded-xl p-6 h-full min-h-[400px]">
                <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-yorumi-manga"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-[#1a1a2e] rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-yorumi-manga uppercase tracking-wide">Latest Updates</h2>
                </div>
                <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                    <p className="mb-4">{error}</p>
                    <button
                        onClick={fetchUpdates}
                        className="px-4 py-2 bg-yorumi-manga text-white rounded-lg hover:bg-yorumi-manga/80 transition-colors"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if (updates.length === 0) {
        return (
            <div className="bg-[#1a1a2e] rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-yorumi-manga uppercase tracking-wide">Latest Updates</h2>
                </div>
                <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                    <p className="mb-4">No updates available</p>
                    <button
                        onClick={fetchUpdates}
                        className="px-4 py-2 bg-yorumi-manga/20 text-yorumi-manga rounded-lg hover:bg-yorumi-manga/30 transition-colors"
                    >
                        Refresh
                    </button>
                </div>
            </div>
        );
    }

    // Sort of arbitrary logic for "original" tag, but making it look like the standard type tag
    // If we don't have real data, we might just stick to "Manga" or "Comics" but styled differently.
    // The user asked to "revert the Comics tag to its original one". 
    // In previous context, it might have been just "Manga" or cleaner.
    // I will use a cleaner style similar to the dashboard cards.

    // 3 columns * 3 rows = 9 items initially
    const displayedUpdates = showAll ? updates : updates.slice(0, 9);

    return (
        <div className="bg-[#1a1a2e] rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-yorumi-manga uppercase tracking-wide">Latest Updates</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayedUpdates.map((manga) => (
                    <div
                        key={manga.id}
                        className="group flex gap-4 p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer border border-transparent hover:border-white/5"
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
                            <h3 className="text-sm font-bold text-white leading-tight mb-2 truncate group-hover:text-yorumi-manga transition-colors">
                                {manga.title}
                            </h3>

                            {/* Reverted Tag Style (assuming this is likely what was desired, simple gray text) */}
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs text-gray-500 font-medium">Comics</span>
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

            {/* View All Button (Bottom Alternative if preferred, but Top is standard for Dashboard) */}
            {updates.length > 9 && !showAll && (
                <button
                    onClick={() => setShowAll(true)}
                    className="w-full mt-6 py-2 text-sm text-gray-400 hover:text-white transition-colors border-t border-white/5"
                >
                    Show more
                </button>
            )}
            {updates.length > 9 && showAll && (
                <button
                    onClick={() => setShowAll(false)}
                    className="w-full mt-6 py-2 text-sm text-gray-400 hover:text-white transition-colors border-t border-white/5"
                >
                    Show less
                </button>
            )}
        </div>
    );
}

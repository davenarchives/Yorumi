import { useState } from 'react';
import type { Episode } from '../../../../types/anime';

interface DetailsEpisodeGridProps {
    episodes: Episode[];
    watchedEpisodes: Set<number>;
    onEpisodeClick: (ep: Episode) => void;
}

export default function DetailsEpisodeGrid({ episodes, watchedEpisodes, onEpisodeClick }: DetailsEpisodeGridProps) {
    const ITEMS_PER_PAGE = 30;
    const [page, setPage] = useState(1);
    const totalPages = Math.ceil(episodes.length / ITEMS_PER_PAGE);

    const currentEpisodes = episodes.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    if (episodes.length === 0) {
        return <div className="text-gray-500 text-center py-4">No episodes found.</div>;
    }

    return (
        <div className="py-6 border-t border-white/10 mt-6">
            <h3 className="text-xl font-bold text-white mb-4">Episodes</h3>
            <div className="mt-6">
                <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
                    {currentEpisodes.map((ep) => {
                        const cleanTitle = ep.title && ep.title.trim().toLowerCase() !== 'untitled' ? ep.title : null;
                        const displayTitle = cleanTitle || `Episode ${ep.episodeNumber}`;
                        const isWatched = watchedEpisodes.has(parseFloat(ep.episodeNumber));
                        return (
                            <button
                                key={ep.session || ep.episodeNumber}
                                onClick={() => onEpisodeClick(ep)}
                                className={`aspect-square flex items-center justify-center rounded transition-all duration-200 relative group 
                                    ${isWatched ? 'bg-white/5 text-gray-600 opacity-50' : 'bg-white/10 text-gray-300 hover:bg-yorumi-accent hover:text-black'} 
                                    hover:scale-105 hover:shadow-lg hover:shadow-yorumi-accent/20 cursor-pointer border border-white/5 hover:border-yorumi-accent`}
                                title={displayTitle}
                            >
                                <span className="text-sm font-bold">{ep.episodeNumber}</span>
                            </button>
                        );
                    })}
                </div>

                {totalPages > 1 && (
                    <div className="flex flex-col items-center gap-4 mt-6">
                        <div className="flex flex-wrap justify-center gap-2">
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                                <button
                                    key={p}
                                    onClick={() => setPage(p)}
                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-colors flex-shrink-0
                                        ${page === p ? 'bg-yorumi-500 text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20'}`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

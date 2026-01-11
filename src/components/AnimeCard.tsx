import React from 'react';

interface Anime {
    mal_id: number;
    title: string;
    images: {
        jpg: {
            image_url: string;
            large_image_url: string;
        };
    };
    score: number;
    rank?: number;
    status: string;
    type: string;
    episodes: number | null;
}

interface AnimeCardProps {
    anime: Anime;
    onClick: (anime: Anime) => void;
}

const AnimeCard: React.FC<AnimeCardProps> = ({ anime, onClick }) => {
    return (
        <div onClick={() => onClick(anime)} className="group relative bg-[#1a1a1a] rounded-lg overflow-hidden transition-transform duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/50 cursor-pointer">
            {/* Image Container */}
            <div className="relative aspect-[2/3] overflow-hidden">
                <img
                    src={anime.images.jpg.large_image_url || anime.images.jpg.image_url}
                    alt={anime.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                {/* Hover Overlay Content */}
                <div className="absolute bottom-0 left-0 p-4 w-full translate-y-4 group-hover:translate-y-0 transition-transform duration-300 opacity-0 group-hover:opacity-100">
                    <button className="w-full py-2 bg-white text-black font-semibold rounded-md hover:bg-gray-200 transition-colors">
                        View Details
                    </button>
                </div>
            </div>

            {/* Info Container */}
            <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{anime.type || 'TV'}</span>
                    {anime.rank && <span className="text-xs font-bold text-[#facc15] tracking-wider">RANK #{anime.rank}</span>}
                </div>

                <h3 className="text-white font-semibold text-sm line-clamp-2 mb-3 h-10 leading-tight" title={anime.title}>
                    {anime.title}
                </h3>

                <div className="flex justify-between items-center text-xs text-gray-400">
                    <span className={`px-2 py-1 rounded-sm ${anime.status === 'Currently Airing' ? 'bg-green-900/30 text-green-400' : 'bg-gray-800'} font-medium uppercase tracking-wide`}>
                        {anime.episodes ? `${anime.episodes} EPISODES` : 'EPISODES TBA'}
                    </span>
                    <div className="flex items-center gap-1 text-white font-medium">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-[#facc15]">
                            <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                        </svg>
                        {anime.score}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnimeCard;

import React from 'react';
import type { Anime } from '../types/anime';

interface AnimeCardProps {
    anime: Anime;
    onClick: (anime: Anime) => void;
    onWatchClick?: (anime: Anime) => void;
    onMouseEnter?: (anime: Anime) => void;
}

const AnimeCard: React.FC<AnimeCardProps> = ({ anime, onClick, onWatchClick, onMouseEnter }) => {
    const cardRef = React.useRef<HTMLDivElement>(null);
    const [rotation, setRotation] = React.useState({ x: 0, y: 0 });
    const [glare, setGlare] = React.useState({ x: 50, y: 50, opacity: 0 });
    const [isHovered, setIsHovered] = React.useState(false);

    // Get episode count - prefer latestEpisode for ongoing anime
    const isUnreleased = anime.status === 'NOT_YET_RELEASED';
    const episodeCount = isUnreleased ? null : (anime.latestEpisode || anime.episodes);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!cardRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        // Calculate rotation (max 12 degrees)
        const rotateX = ((y - centerY) / centerY) * -12;
        const rotateY = ((x - centerX) / centerX) * 12;

        setRotation({ x: rotateX, y: rotateY });
        setGlare({
            x: (x / rect.width) * 100,
            y: (y / rect.height) * 100,
            opacity: 1
        });

        onMouseEnter?.(anime);
    };

    const handleMouseLeave = () => {
        setRotation({ x: 0, y: 0 });
        setGlare(prev => ({ ...prev, opacity: 0 }));
        setIsHovered(false);
    };

    return (
        <div
            ref={cardRef}
            className="select-none cursor-pointer group relative"
            style={{ perspective: '1000px' }}
            onClick={() => onClick(anime)}
            onMouseEnter={(e) => {
                setIsHovered(true);
                handleMouseMove(e);
            }}
            onMouseLeave={handleMouseLeave}
            onMouseMove={handleMouseMove}
        >
            {/* Image Container with 3D Transform */}
            <div
                className="relative aspect-[2/3] rounded-lg overflow-hidden mb-3 shadow-lg ring-0 outline-none transition-all duration-75 ease-out"
                style={{
                    transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) scale3d(${isHovered ? 1.05 : 1}, ${isHovered ? 1.05 : 1}, 1)`,
                    transformStyle: 'preserve-3d',
                    boxShadow: isHovered
                        ? '0 20px 40px -5px rgba(0,0,0,0.4), 0 10px 20px -5px rgba(0,0,0,0.2)'
                        : 'none'
                }}
            >
                {/* Glare Overlay */}
                <div
                    className="absolute inset-0 z-30 pointer-events-none mix-blend-overlay transition-opacity duration-300"
                    style={{
                        background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,0.3) 0%, transparent 80%)`,
                        opacity: glare.opacity
                    }}
                />

                <img
                    src={anime.images.jpg.large_image_url || anime.images.jpg.image_url}
                    alt={anime.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                />

                {/* Default Badges - Always Visible */}
                {/* Top Right: Star Rating */}
                {anime.score > 0 && (
                    <div className="absolute top-2 right-2 group-hover:opacity-0 transition-opacity duration-300 z-10">
                        <span className="bg-[#facc15] text-black px-2 py-1 rounded text-xs font-bold flex items-center gap-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" /></svg>
                            {anime.score.toFixed(1)}
                        </span>
                    </div>
                )}

                {/* Bottom Left: TV + EP - Always Visible */}
                <div className="absolute bottom-2 left-2 flex gap-1.5 group-hover:opacity-0 transition-opacity duration-300 z-10">
                    <span className="bg-white/20 backdrop-blur-sm text-white px-2 py-1 rounded text-xs font-bold">
                        {anime.type || 'TV'}
                    </span>
                    {episodeCount && (
                        <span className="bg-[#22c55e] text-white px-2 py-1 rounded text-xs font-bold flex items-center gap-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M19 4H5a2 2 0 00-2 2v12a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v2H6V9h5v2zm7 0h-1.5v-.5h-2v3h2V13H18v2h-5V9h5v2z" /></svg>
                            {episodeCount}
                        </span>
                    )}
                </div>

                {/* Hover Overlay - Full Info Card */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/90 to-black/70 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3 z-20">
                    {/* HD Badge - Top Right on Hover */}
                    <div className="absolute top-2 right-2 translate-z-10">
                        <span className="bg-[#d886ff] text-black px-2 py-1 rounded text-xs font-bold">HD</span>
                    </div>

                    {/* Title */}
                    <h3 className="text-sm font-bold text-white mb-1 line-clamp-2 leading-tight translate-z-10">
                        {anime.title}
                    </h3>

                    {/* Rating + Info Row */}
                    <div className="flex items-center gap-1.5 mb-2 flex-wrap translate-z-10">
                        {anime.score > 0 && (
                            <span className="text-[#facc15] text-xs font-bold flex items-center gap-0.5">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" /></svg>
                                {anime.score.toFixed(1)}
                            </span>
                        )}
                        <span className="bg-[#d886ff] text-black px-1.5 py-0.5 rounded text-[10px] font-bold">HD</span>
                        {episodeCount && (
                            <span className="text-gray-300 text-[10px] font-medium">{episodeCount} eps</span>
                        )}
                        <span className="text-gray-400 text-[10px]">{anime.type || 'TV'}</span>
                    </div>

                    {/* Synopsis */}
                    <p className="text-gray-400 text-[10px] line-clamp-2 mb-2 leading-relaxed translate-z-10">
                        {anime.synopsis || 'No description available.'}
                    </p>

                    {/* Status */}
                    <div className="flex items-center gap-1 mb-2 translate-z-10">
                        <span className="text-gray-500 text-[10px]">Status:</span>
                        <span className="text-white text-[10px] font-medium">
                            {anime.status === 'RELEASING' ? 'Ongoing' : anime.status === 'FINISHED' ? 'Complete' : anime.status || 'Unknown'}
                        </span>
                    </div>

                    {/* Genres */}
                    {anime.genres && anime.genres.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3 translate-z-10">
                            {anime.genres.slice(0, 3).map((genre, idx) => (
                                <span key={idx} className="border border-gray-600 text-gray-300 px-1.5 py-0.5 rounded text-[9px]">
                                    {genre.name}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Buttons - Watch first, Detail second */}
                    <div className="flex gap-2 translate-z-20">
                        <button
                            onClick={(e) => { e.stopPropagation(); onWatchClick ? onWatchClick(anime) : onClick(anime); }}
                            className="flex-1 flex items-center justify-center gap-1 bg-[#d886ff] hover:bg-[#c06ae0] text-black py-1.5 rounded text-[9px] font-bold transition-colors shadow-lg"
                        >
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                            WATCH
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onClick(anime); }}
                            className="flex-1 flex items-center justify-center gap-1 bg-white/10 hover:bg-white/20 text-white py-1.5 rounded text-[9px] font-medium transition-colors border border-white/20"
                        >
                            <span className="w-2 h-2 bg-white rounded-full"></span>
                            DETAIL
                        </button>
                        <button className="flex items-center justify-center bg-white/10 hover:bg-white/20 text-white p-1.5 rounded transition-colors">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Title Below Card */}
            <h3 className="text-sm font-semibold text-gray-100 line-clamp-2 leading-tight group-hover:text-yorumi-accent transition-colors">
                {anime.title}
            </h3>
        </div>
    );
};

export default AnimeCard;

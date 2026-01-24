import { Play, Plus, Check } from 'lucide-react';
import type { Anime } from '../../../../types/anime';
import AnimeLogoImage from '../../../../components/anime/AnimeLogoImage';

interface DetailsInfoProps {
    anime: Anime;
    episodesCount: number;
    inList: boolean;
    onWatch: () => void;
    onToggleList: () => void;
    children?: React.ReactNode;
}

export default function DetailsInfo({ anime, episodesCount, inList, onWatch, onToggleList, children }: DetailsInfoProps) {
    // ... helper ...
    const getLatestEpisode = () => {
        if (anime.status === 'NOT_YET_RELEASED') return null;
        if (anime.latestEpisode) return anime.latestEpisode;
        if (episodesCount > 0) return episodesCount;
        if (anime.episodes) return anime.episodes;
        return null;
    };

    return (
        <div className="flex flex-col md:flex-row gap-6 md:gap-8">
            {/* Portrait Image */}
            <div className="flex-shrink-0 mx-auto md:mx-0 w-48 sm:w-64 md:w-72">
                <div className="rounded-xl overflow-hidden shadow-2xl shadow-black/50 aspect-[2/3]">
                    <img
                        src={anime.images.jpg.large_image_url}
                        alt={anime.title}
                        className="w-full h-full object-cover"
                    />
                </div>
            </div>

            {/* Details */}
            <div className="flex-1 pt-2 md:pt-8 text-center md:text-left space-y-4">
                <AnimeLogoImage
                    anilistId={anime.id || anime.mal_id}
                    title={anime.title}
                    className="mx-auto md:mx-0"
                    size="large"
                />

                {/* Badges ... (rest same) ... */}
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-sm">
                    {anime.score > 0 && (
                        <span className="bg-[#facc15] text-black px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                            {anime.score}
                        </span>
                    )}
                    {getLatestEpisode() && (
                        <span className="bg-[#22c55e] text-white px-2.5 py-1 rounded text-xs font-bold">
                            {getLatestEpisode()} eps
                        </span>
                    )}
                    <span className="px-2.5 py-1 bg-white/10 rounded text-gray-300 text-xs">
                        {anime.type}
                    </span>
                </div>

                {/* Actions ... (rest same) ... */}
                <div className="flex flex-row items-center justify-center md:justify-start gap-3 md:gap-4 py-2 w-full md:w-auto px-4 md:px-0">
                    <button
                        onClick={onWatch}
                        className="h-10 md:h-12 px-4 md:px-8 bg-[#facc15] hover:bg-[#ffe066] text-black text-base md:text-lg font-bold rounded-full transition-transform active:scale-95 flex items-center justify-center gap-2 md:gap-3 shadow-lg shadow-yellow-500/20 flex-1 md:flex-none"
                    >
                        <Play className="w-4 h-4 md:w-5 md:h-5 fill-current" />
                        <span className="whitespace-nowrap">Watch Now</span>
                    </button>
                    <button
                        onClick={onToggleList}
                        className={`h-10 md:h-12 px-4 md:px-8 text-base md:text-lg font-bold rounded-full transition-all border flex items-center justify-center gap-2 flex-1 md:flex-none ${inList
                            ? 'bg-yorumi-accent text-black border-yorumi-accent hover:bg-yorumi-accent/90'
                            : 'bg-white/10 hover:bg-white/20 text-white border-white/10'
                            }`}
                    >
                        {inList ? (
                            <>
                                <Check className="w-4 h-4 md:w-5 md:h-5" />
                                <span className="whitespace-nowrap">In List</span>
                            </>
                        ) : (
                            <>
                                <Plus className="w-4 h-4 md:w-5 md:h-5" />
                                <span className="whitespace-nowrap">Add to List</span>
                            </>
                        )}
                    </button>
                </div>

                {/* Children for layout extension (Tabs, etc) */}
                <div className="pt-4 space-y-4">
                    {children}
                </div>
            </div>
        </div>
    );
}

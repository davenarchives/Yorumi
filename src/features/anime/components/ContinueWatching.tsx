import { ArrowLeft, X } from 'lucide-react';
import Carousel from '../../../components/ui/Carousel';
import type { Anime } from '../../../types/anime';

interface ContinueWatchingItem {
    animeId: string;
    animeTitle: string;
    animeImage: string;
    episodeNumber: number;
    episodeTitle?: string;
    session?: string;
}

interface ContinueWatchingProps {
    items: ContinueWatchingItem[];
    variant?: 'dashboard' | 'page';
    onWatchClick: (anime: Anime, episodeNumber: number) => void;
    onRemove: (animeId: number) => void;
    onViewAll?: () => void;
    onBack?: () => void;
}

export default function ContinueWatching({
    items,
    variant = 'dashboard',
    onWatchClick,
    onRemove,
    onViewAll,
    onBack
}: ContinueWatchingProps) {
    if (items.length === 0) return null;

    if (variant === 'page') {
        return (
            <div className="pb-12 min-h-screen">
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={onBack}
                        className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-white" />
                    </button>
                    <h2 className="text-2xl font-black text-white tracking-wide uppercase">Continue Watching</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                    {items.map((item) => (
                        <div
                            key={item.animeId}
                            className="relative group cursor-pointer"
                            onClick={() => onWatchClick({ mal_id: parseInt(item.animeId) } as Anime, item.episodeNumber)}
                        >
                            <div className="relative aspect-video rounded-lg overflow-hidden mb-3 shadow-lg border border-white/5 transition-colors">
                                <img
                                    src={item.animeImage}
                                    alt={item.animeTitle}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                />
                                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                    <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform shadow-xl">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white ml-1">
                                            <path fillRule="evenodd" d="M4.5 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                </div>
                                <div className="absolute top-2 left-2 bg-black/60 backdrop-blur text-white text-[10px] font-bold px-1.5 py-0.5 rounded border border-white/10">
                                    EP {item.episodeNumber}
                                </div>
                            </div>
                            <div className="px-1">
                                <h4 className="text-sm font-bold text-gray-200 truncate group-hover:text-yorumi-accent transition-colors">
                                    {item.animeTitle}
                                </h4>
                                <p className="text-xs text-gray-500 truncate mt-0.5">
                                    {item.episodeTitle || `Episode ${item.episodeNumber}`}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Dashboard (Carousel) Variant
    return (
        <Carousel
            title="Continue Watching"
            variant="landscape"
            onViewAll={onViewAll}
        >
            {items.map((item) => (
                <div
                    key={item.animeId}
                    className="relative group h-full flex-[0_0_240px] sm:flex-[0_0_280px] md:flex-[0_0_320px]"
                    onClick={() => onWatchClick({ mal_id: parseInt(item.animeId) } as Anime, item.episodeNumber)}
                >
                    <div className="relative aspect-video rounded-lg overflow-hidden mb-3 shadow-lg border border-white/5 transition-colors cursor-pointer">
                        <img
                            src={item.animeImage}
                            alt={item.animeTitle}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform shadow-xl">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white ml-1">
                                    <path fillRule="evenodd" d="M4.5 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" clipRule="evenodd" />
                                </svg>
                            </div>
                        </div>
                        <div className="absolute top-2 left-2 bg-black/60 backdrop-blur text-white text-[10px] font-bold px-1.5 py-0.5 rounded border border-white/10">
                            EP {item.episodeNumber}
                        </div>
                        {/* Remove Button */}
                        <button
                            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 backdrop-blur hover:bg-red-500/80 text-white/80 hover:text-white transition-all opacity-0 group-hover:opacity-100 z-10"
                            onClick={(e) => {
                                e.stopPropagation();
                                onRemove(parseInt(item.animeId));
                            }}
                            title="Remove from history"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <div className="px-1">
                        <h4 className="text-sm font-bold text-gray-200 truncate group-hover:text-yorumi-accent transition-colors">
                            {item.animeTitle}
                        </h4>
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                            {item.episodeTitle || `Episode ${item.episodeNumber}`}
                        </p>
                    </div>
                </div>
            ))}
        </Carousel>
    );
}

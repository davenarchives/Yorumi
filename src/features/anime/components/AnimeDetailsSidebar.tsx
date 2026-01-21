import { useNavigate } from "react-router-dom";

interface AnimeDetailsSidebarProps {
    anime: any; // Using any to match previous implementation's loose typing
    currentId: string;
}

export default function AnimeDetailsSidebar({ anime, currentId }: AnimeDetailsSidebarProps) {
    const navigate = useNavigate();

    const handleNavigate = () => {
        // Use currentId from params or fall back to anime id
        const targetId = currentId || anime.id || anime.mal_id;
        navigate(`/anime/${targetId}`);
    };

    return (
        <aside className="w-full md:w-[350px] shrink-0 h-auto md:h-full overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] border-t md:border-t-0 md:border-l border-white/10 bg-black/20 order-3 md:order-3">
            <div className="p-6 flex flex-col gap-6">
                {/* Poster - Clickable */}
                <div
                    className="aspect-[2/3] w-full rounded-xl overflow-hidden shadow-2xl relative group cursor-pointer"
                    onClick={handleNavigate}
                >
                    <img
                        src={anime.main_picture?.large || anime.main_picture?.medium || anime.images?.jpg?.large_image_url}
                        alt={anime.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-sm font-medium bg-black/60 px-3 py-1.5 rounded-full">
                            View Details
                        </span>
                    </div>
                </div>

                {/* Info */}
                <div className="space-y-4">
                    <div
                        className="cursor-pointer group"
                        onClick={handleNavigate}
                    >
                        <h2 className="text-xl font-bold leading-tight text-white group-hover:text-yorumi-accent transition-colors">
                            {anime.title}
                        </h2>
                        <p className="text-sm text-gray-500 mt-1 uppercase tracking-wider font-medium">
                            {anime.title_english || anime.alternative_titles?.en}
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <div className="px-2 py-0.5 bg-white/10 text-white text-xs font-bold rounded">TV</div>
                        <div className="px-2 py-0.5 bg-yellow-400 text-black text-xs font-bold rounded flex items-center gap-1">
                            ★ {anime.score || anime.mean}
                        </div>
                        <div className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-bold rounded">HD</div>
                    </div>

                    <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm pt-2">
                        <div className="flex flex-col">
                            <span className="text-gray-500 text-xs uppercase font-bold tracking-wider mb-0.5">Aired</span>
                            <span className="text-gray-300 font-medium">{anime.start_season?.year || anime.year || '?'}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-gray-500 text-xs uppercase font-bold tracking-wider mb-0.5">Premiered</span>
                            <span className="text-gray-300 font-medium">{anime.season || 'Fall 2004'}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-gray-500 text-xs uppercase font-bold tracking-wider mb-0.5">Status</span>
                            <span className="text-gray-300 font-medium">{anime.status}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-gray-500 text-xs uppercase font-bold tracking-wider mb-0.5">Genres</span>
                            <span className="text-gray-300 font-medium line-clamp-1">
                                {anime.genres?.map((g: any) => g.name).join(', ')}
                            </span>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-white/10">
                        <p className="text-sm text-gray-400 leading-relaxed">
                            {anime.synopsis}
                        </p>
                    </div>
                </div>
            </div>
        </aside>
    );
}

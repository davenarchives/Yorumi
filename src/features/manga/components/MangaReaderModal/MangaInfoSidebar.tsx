import { Link } from 'react-router-dom';
import { Calendar, PenTool } from 'lucide-react';
import type { Manga } from '../../../../types/manga';

interface MangaInfoSidebarProps {
    manga: Manga;
    showDetails: boolean;
    isHeaderVisible: boolean;
    onClose: () => void;
}

export default function MangaInfoSidebar({
    manga,
    showDetails,
    isHeaderVisible,
    onClose,
}: MangaInfoSidebarProps) {
    return (
        <aside className={`
            absolute md:static inset-y-0 right-0 z-40
            w-[300px] md:w-[350px] shrink-0 h-full overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] 
            bg-[#111] md:bg-black/20 md:border-l border-l border-white/10
            transition-all duration-300 ease-in-out
            ${showDetails ? 'translate-x-0' : 'translate-x-full md:hidden'}
            ${isHeaderVisible ? 'pt-14' : 'pt-0'}
        `}>
            <div className="p-6 flex flex-col gap-6">
                {/* Poster */}
                <Link
                    to={`/manga/${manga.id || manga.mal_id}`}
                    onClick={onClose}
                    className="block aspect-[2/3] w-full rounded-xl overflow-hidden shadow-2xl border border-white/5 relative group cursor-pointer"
                >
                    <img
                        src={manga.images.jpg.large_image_url}
                        alt={manga.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="bg-yorumi-manga text-white font-bold px-4 py-2 rounded-full transform translate-y-4 group-hover:translate-y-0 transition-all duration-300">
                            View Details
                        </span>
                    </div>

                    <div className="absolute bottom-4 left-4 right-4">
                        <div className="flex flex-wrap gap-2 mb-2">
                            <span className="px-2 py-0.5 bg-yorumi-manga text-white text-xs font-bold rounded">
                                ★ {manga.score}
                            </span>
                            <span className={`px-2 py-0.5 text-white text-xs font-bold rounded ${manga.countryOfOrigin === 'KR' ? 'bg-yorumi-manga' :
                                manga.countryOfOrigin === 'CN' ? 'bg-red-600' : 'bg-white/20'
                                }`}>
                                {manga.countryOfOrigin === 'KR' ? 'Manhwa' : manga.countryOfOrigin === 'CN' ? 'Manhua' : 'Manga'}
                            </span>
                        </div>
                    </div>
                </Link>

                {/* Info */}
                <div className="space-y-6">
                    <div>
                        <Link
                            to={`/manga/${manga.id || manga.mal_id}`}
                            onClick={onClose}
                            className="hover:text-yorumi-manga transition-colors block"
                        >
                            <h2 className="text-xl font-bold leading-tight text-white mb-2">
                                {manga.title}
                            </h2>
                        </Link>
                        <p className="text-sm text-gray-500 font-medium">
                            {manga.type} • {manga.status}
                        </p>
                    </div>

                    {/* Grid Stats */}
                    <div className="grid grid-cols-2 gap-4 text-sm bg-white/5 p-4 rounded-xl border border-white/5">
                        <div className="flex flex-col gap-1">
                            <span className="text-gray-500 text-xs uppercase font-bold tracking-wider flex items-center gap-1">
                                <Calendar className="w-3 h-3" /> Published
                            </span>
                            <span className="text-gray-200 font-medium">
                                {manga.published?.string || 'Unknown'}
                            </span>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-gray-500 text-xs uppercase font-bold tracking-wider flex items-center gap-1">
                                <PenTool className="w-3 h-3" /> Authors
                            </span>
                            <span className="text-gray-200 font-medium line-clamp-1">
                                {manga.authors?.[0]?.name || 'Unknown'}
                            </span>
                        </div>
                    </div>

                    {/* Genres */}
                    <div>
                        <span className="text-gray-500 text-xs uppercase font-bold tracking-wider mb-2 block">Genres</span>
                        <div className="flex flex-wrap gap-2">
                            {manga.genres?.map(g => (
                                <span key={g.mal_id} className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/5 rounded text-xs text-gray-300 transition-colors cursor-default">
                                    {g.name}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="pt-4 border-t border-white/10">
                        <span className="text-gray-500 text-xs uppercase font-bold tracking-wider mb-2 block">Synopsis</span>
                        <p className="text-sm text-gray-400 leading-relaxed">
                            {manga.synopsis}
                        </p>
                    </div>
                </div>
            </div>
        </aside>
    );
}

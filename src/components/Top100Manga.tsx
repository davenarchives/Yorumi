import React, { useState, useEffect } from 'react';
import { mangaService } from '../services/mangaService';
import type { Manga } from '../types/manga';

interface Top100MangaProps {
    onMangaClick: (mangaId: string) => void;
    onViewAll?: () => void;
}

const Top100Manga: React.FC<Top100MangaProps> = ({ onMangaClick, onViewAll }) => {
    const [mangaList, setMangaList] = useState<Manga[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchManga = async () => {
            try {
                const { data } = await mangaService.getTopManga(1);
                if (data) {
                    setMangaList(data);
                }
            } catch (err) {
                console.error('Failed to fetch top 100 manga', err);
            } finally {
                setLoading(false);
            }
        };

        fetchManga();
    }, []);

    if (loading) return null;
    if (mangaList.length === 0) return null;

    return (
        <section className="container mx-auto px-4 relative z-20 mt-4 mb-12">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <div className="w-1 h-6 bg-yorumi-accent rounded-full"></div>
                    <h2 className="text-xl font-bold text-white">Top 100 Manga</h2>
                </div>

                {onViewAll && (
                    <button
                        onClick={onViewAll}
                        className="text-sm font-bold text-yorumi-accent hover:text-white transition-colors"
                    >
                        View All &gt;
                    </button>
                )}
            </div>

            {/* Grid Layout */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {mangaList.slice(0, 12).map((manga, index) => (
                    <div
                        key={manga.id || manga.mal_id}
                        className="select-none cursor-pointer group relative"
                        onClick={() => onMangaClick((manga.id || manga.mal_id).toString())}
                    >
                        {/* Image Container */}
                        <div className="relative aspect-[2/3] rounded-lg overflow-hidden mb-2 shadow-lg ring-0 outline-none group-hover:shadow-purple-500/20 transition-all duration-300">
                            <img
                                src={manga.images.jpg.large_image_url}
                                alt={manga.title}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 group-hover:blur-[2px]"
                                loading="lazy"
                            />

                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 sm:flex hidden flex-col justify-end p-4">
                                <div className="translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                                    <h3 className="text-sm font-bold text-white leading-tight mb-1 line-clamp-2">
                                        {manga.title}
                                    </h3>

                                    <div className="flex items-center flex-wrap gap-2 text-[10px] text-gray-300 mb-2">
                                        <div className="flex items-center gap-1 text-yellow-400 font-bold">
                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" /></svg>
                                            {manga.score?.toFixed(1) || 'N/A'}
                                        </div>
                                        <span className="bg-white/20 px-1.5 py-px rounded text-[9px] font-bold">HD</span>
                                        <span>{(manga.chapters || manga.volumes) ? `${manga.chapters || manga.volumes} ch` : '? ch'}</span>
                                        <span className="uppercase text-gray-400">{manga.type}</span>
                                    </div>

                                    <p className="text-[10px] text-gray-400 line-clamp-3 mb-3 leading-relaxed">
                                        {manga.synopsis || 'No synopsis available.'}
                                    </p>

                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-white font-bold text-[10px] uppercase">
                                            {manga.status}
                                        </span>
                                    </div>

                                    {/* Genre Pills - limited to 2 */}
                                    {manga.genres && manga.genres.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mb-3">
                                            {manga.genres.slice(0, 2).map(g => (
                                                <span key={g.mal_id} className="text-[9px] px-1.5 py-0.5 bg-white/10 border border-white/10 rounded-full text-gray-300">
                                                    {g.name}
                                                </span>
                                            ))}
                                            {manga.genres.length > 2 && (
                                                <span className="text-[9px] px-1.5 py-0.5 bg-white/10 border border-white/10 rounded-full text-gray-300">
                                                    +{manga.genres.length - 2}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex items-center gap-2 mt-2">
                                        <button className="flex-1 bg-yorumi-accent hover:bg-yorumi-accent/90 text-black text-[10px] font-bold py-1.5 rounded flex items-center justify-center gap-1 transition-colors">
                                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                                            READ
                                        </button>
                                        <button className="flex-1 bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold py-1.5 rounded flex items-center justify-center gap-1 transition-colors">
                                            DETAIL
                                        </button>
                                        <button className="w-7 h-7 bg-white/10 hover:bg-white/20 rounded flex items-center justify-center text-white transition-colors">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Ranking Badge - Top Left (Visible when not hovered or on mobile) */}
                            <div className="absolute top-2 left-2 z-10 group-hover:opacity-0 transition-opacity duration-200">
                                <span className="bg-black/80 text-white px-2 py-0.5 rounded text-[10px] font-bold">
                                    #{index + 1}
                                </span>
                            </div>

                            {/* Score Badge - Top Right (Visible when not hovered or on mobile) */}
                            {manga.score > 0 && (
                                <div className="absolute top-2 right-2 group-hover:opacity-0 transition-opacity duration-200">
                                    <span className="bg-[#facc15] text-black px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5">
                                        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" /></svg>
                                        {manga.score.toFixed(1)}
                                    </span>
                                </div>
                            )}

                            {/* Bottom Left Info (Visible when not hovered or on mobile) */}
                            <div className="absolute bottom-2 left-2 flex gap-1 group-hover:opacity-0 transition-opacity duration-200">
                                <span className="bg-white/20 backdrop-blur-sm text-white px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">
                                    {manga.countryOfOrigin === 'KR' ? 'Manhwa' : manga.countryOfOrigin === 'CN' ? 'Manhua' : (manga.type || 'Manga')}
                                </span>
                                {(manga.chapters || manga.volumes) ? (
                                    <span className="bg-[#22c55e] text-white px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5">
                                        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 4H5a2 2 0 00-2 2v12a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v2H6V9h5v2zm7 0h-1.5v-.5h-2v3h2V13H18v2h-5V9h5v2z" /></svg>
                                        {manga.chapters || manga.volumes}
                                    </span>
                                ) : (
                                    <span className="bg-white/20 backdrop-blur-sm text-white px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
                                        <span className={`w-1 h-1 rounded-full ${manga.status === 'RELEASING' || manga.status === 'Publishing' ? 'bg-green-500' : 'bg-gray-500'}`}></span>
                                        <span className="uppercase text-[9px]">{manga.status === 'RELEASING' ? 'Ongoing' : manga.status}</span>
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Title Below Card (Visible only on mobile or when not hovered if we want) */}
                        <h3 className="text-xs font-semibold text-gray-100 line-clamp-2 leading-tight group-hover:text-yorumi-accent transition-colors sm:group-hover:opacity-0 duration-200">
                            {manga.title}
                        </h3>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default Top100Manga;

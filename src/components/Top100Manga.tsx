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
                        key={manga.mal_id}
                        className="select-none cursor-pointer group relative"
                        onClick={() => onMangaClick(manga.mal_id.toString())}
                    >
                        {/* Image Container */}
                        <div className="relative aspect-[2/3] rounded-lg overflow-hidden mb-2 shadow-lg ring-0 outline-none">
                            <img
                                src={manga.images.jpg.large_image_url}
                                alt={manga.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                loading="lazy"
                            />

                            {/* Ranking Badge - Top Left */}
                            <div className="absolute top-2 left-2 z-10">
                                <span className="bg-black/80 text-white px-2 py-0.5 rounded text-[10px] font-bold">
                                    #{index + 1}
                                </span>
                            </div>

                            {/* Score Badge - Top Right */}
                            {manga.score > 0 && (
                                <div className="absolute top-2 right-2">
                                    <span className="bg-[#facc15] text-black px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5">
                                        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" /></svg>
                                        {manga.score.toFixed(1)}
                                    </span>
                                </div>
                            )}

                            {/* Bottom Left: Type + Chapters */}
                            <div className="absolute bottom-2 left-2 flex gap-1">
                                <span className="bg-white/20 backdrop-blur-sm text-white px-1.5 py-0.5 rounded text-[10px] font-bold">
                                    {manga.type || 'Manga'}
                                </span>
                                {manga.chapters && (
                                    <span className="bg-[#22c55e] text-white px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5">
                                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                        </svg>
                                        {manga.chapters}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Title Below Card */}
                        <h3 className="text-xs font-semibold text-gray-100 line-clamp-2 leading-tight group-hover:text-yorumi-accent transition-colors">
                            {manga.title}
                        </h3>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default Top100Manga;

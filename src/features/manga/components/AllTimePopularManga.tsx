import React, { useState, useEffect } from 'react';
import { mangaService } from '../../../services/mangaService';
import type { Manga } from '../../../types/manga';
import MangaCard from './MangaCard';
import MangaCardSkeleton from './MangaCardSkeleton';
import { getMangaDetailsRouteId } from '../../../utils/mangaNavigation';

interface AllTimePopularMangaProps {
    onMangaClick: (mangaId: string, autoRead?: boolean, manga?: Manga) => void;

}

const AllTimePopularManga: React.FC<AllTimePopularMangaProps> = ({ onMangaClick }) => {
    const cachedPopular = mangaService.peekPopularManga(1);
    const [mangaList, setMangaList] = useState<Manga[]>(cachedPopular?.data || []);
    const [loading, setLoading] = useState(!(cachedPopular?.data?.length));

    useEffect(() => {
        const fetchManga = async () => {
            try {
                // Use getPopularManga for all-time popularity (POPULARITY_DESC)
                const data = (await mangaService.getHomeSections()).popular;
                if (data) {
                    setMangaList(data.slice(0, 12));
                    setLoading(false);
                }
            } catch (err) {
                console.error('Failed to fetch all-time popular manga', err);
            } finally {
                setLoading(false);
            }
        };

        fetchManga();
    }, []);


    if (loading) {
        return (
            <section className="mb-10 animate-pulse">
                <div className="flex items-center justify-between mb-6">
                    <div className="h-7 w-44 rounded bg-white/10" />
                    <div className="h-6 w-20 rounded bg-white/10" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                    {Array.from({ length: 12 }).map((_, idx) => (
                        <MangaCardSkeleton key={idx} />
                    ))}
                </div>
            </section>
        );
    }
    if (mangaList.length === 0) return null;

    return (
        <section className="mb-10">
            {/* Header */}
            <div className="mb-4 flex items-center justify-between gap-4">
                <h2 className="text-[20px] sm:text-[22px] font-extrabold text-white tracking-tight">All Time Popular</h2>
            </div>

            {/* Grid Layout */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {mangaList.slice(0, 12).map((manga) => (
                    <div
                        key={manga.id || manga.mal_id}
                        className="relative group cursor-pointer"
                    >
                        <MangaCard
                            manga={manga as unknown as Manga}
                            onClick={(mangaObj) => onMangaClick(getMangaDetailsRouteId(mangaObj), false, mangaObj)}
                            disableTilt
                        />
                    </div>
                ))}
            </div>
        </section>
    );
};

export default AllTimePopularManga;

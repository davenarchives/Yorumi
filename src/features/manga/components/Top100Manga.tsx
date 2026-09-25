import React, { useState, useEffect } from 'react';
import { mangaService } from '../../../services/mangaService';
import type { Manga } from '../../../types/manga';
import MangaCard from './MangaCard';

interface Top100MangaProps {
    onMangaClick: (mangaId: string, autoRead?: boolean, manga?: Manga) => void;

}

const Top100Manga: React.FC<Top100MangaProps> = ({ onMangaClick }) => {
    const cachedTop = mangaService.peekTopManga(1);
    const [mangaList, setMangaList] = useState<Manga[]>(cachedTop?.data || []);
    const [loading, setLoading] = useState(!(cachedTop?.data?.length));

    useEffect(() => {
        let cancelled = false;
        const fetchManga = async () => {
            try {
                const { data } = await mangaService.getTopManga(1);
                if (data) {
                    const visible = data.slice(0, 12);
                    setMangaList(visible);
                    setLoading(false);
                    void mangaService.enrichVisibleManga(visible, (enriched, index) => {
                        if (cancelled) return;
                        setMangaList((current) => current.map((item, itemIndex) => itemIndex === index ? enriched : item));
                    });
                }
            } catch (err) {
                console.error('Failed to fetch top 100 manga', err);
            } finally {
                setLoading(false);
            }
        };

        fetchManga();
        return () => { cancelled = true; };
    }, []);

    if (loading) {
        return (
            <section className="mb-12 animate-pulse">
                <div className="flex items-center justify-between mb-6">
                    <div className="h-7 w-44 rounded bg-white/10" />
                    <div className="h-6 w-20 rounded bg-white/10" />
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {Array.from({ length: 12 }).map((_, idx) => (
                        <div key={idx}>
                            <div className="aspect-[2/3] rounded-lg bg-white/10 mb-2" />
                            <div className="h-4 w-4/5 rounded bg-white/10" />
                            <div className="h-4 w-3/5 rounded bg-white/10 mt-2" />
                        </div>
                    ))}
                </div>
            </section>
        );
    }
    if (mangaList.length === 0) return null;

    return (
        <section className="mb-12">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide uppercase leading-none whitespace-nowrap">Top 100 Manga</h2>
                <div className="flex-1 h-px bg-white/10" />
            </div>

            {/* Grid Layout */}
            <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {mangaList.slice(0, 12).map((manga, index) => (
                    <div
                        key={manga.id || manga.mal_id}
                        className="relative group cursor-pointer"
                    >
                        <MangaCard
                            manga={manga as unknown as Manga}
                            onClick={(mangaObj) => onMangaClick((mangaObj.scraper_id || mangaObj.id || mangaObj.mal_id).toString(), false, mangaObj)}
                            disableTilt
                        />
                    </div>
                ))}
            </div>
        </section>
    );
};

export default Top100Manga;

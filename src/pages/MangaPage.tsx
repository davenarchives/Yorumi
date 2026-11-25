import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Feature Components
import MangaSpotlight from '../features/manga/components/MangaSpotlight';
import PopularManhwa from '../features/manga/components/PopularManhwa';
import AllTimePopularManga from '../features/manga/components/AllTimePopularManga';
import Top100Manga from '../features/manga/components/Top100Manga';
import LatestMangaUpdates from '../features/manga/components/LatestMangaUpdates';
import type { Manga } from '../types/manga';
import { getMangaDetailsRouteId } from '../utils/mangaNavigation';

export default function MangaPage() {
    const navigate = useNavigate();
    const [backdrop, setBackdrop] = useState('');


    const handleSpotlightClick = (mangaId: string, autoRead?: boolean, mangaData?: Manga) => {
        const routeId = getMangaDetailsRouteId(mangaData) || mangaId;
        navigate(`/manga/details/${encodeURIComponent(routeId)}`, { state: { autoRead, manga: mangaData } });
    };



    // Default Mode - Shows carousels
    return (
        <div className="media-home-perf relative min-h-screen overflow-hidden bg-[#070707] pb-4 md:pb-20">
            {backdrop && <div className="pointer-events-none absolute inset-0 overflow-hidden hidden md:block" aria-hidden="true">
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${backdrop})`, filter: 'blur(100px) saturate(2.4) brightness(1.05)', transform: 'scale(1.2)', opacity: 0.35 }} />
                <div className="absolute inset-0 bg-[#070707]/65" />
            </div>}
            {/* Spotlight Hero Section */}
            <MangaSpotlight onBackdropChange={setBackdrop} onMangaClick={handleSpotlightClick} />

            <div className="reading-home-sections relative z-10 mx-auto mt-3 md:-mt-6 w-full max-w-[1440px] px-4 sm:px-10 md:px-14 lg:px-16">

                {/* Latest Updates Carousel */}
                <LatestMangaUpdates
                    onMangaClick={handleSpotlightClick}
                />

                {/* Popular Manhwa Carousel */}
                <PopularManhwa
                    onMangaClick={handleSpotlightClick}

                />

                {/* All Time Popular Manga Carousel */}
                <AllTimePopularManga
                    onMangaClick={handleSpotlightClick}

                />

                {/* Top 100 Manga Carousel (replaces Manga Catalog grid) */}
                <Top100Manga
                    onMangaClick={handleSpotlightClick}

                />
            </div>
        </div>
    );
}

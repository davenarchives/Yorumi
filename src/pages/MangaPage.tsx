import { useNavigate } from 'react-router-dom';

// Feature Components
import MangaSpotlight from '../features/manga/components/MangaSpotlight';
import PopularManhwa from '../features/manga/components/PopularManhwa';
import AllTimePopularManga from '../features/manga/components/AllTimePopularManga';
import Top100Manga from '../features/manga/components/Top100Manga';
import LatestMangaUpdates from '../features/manga/components/LatestMangaUpdates';
import type { Manga } from '../types/manga';

export default function MangaPage() {
    const navigate = useNavigate();


    const handleSpotlightClick = (mangaId: string, autoRead?: boolean, mangaData?: Manga) => {
        navigate(`/manga/details/${mangaId}`, { state: { autoRead, manga: mangaData } });
    };



    // Default Mode - Shows carousels
    return (
        <div className="min-h-screen pb-20">
            {/* Spotlight Hero Section */}
            <MangaSpotlight onMangaClick={handleSpotlightClick} />

            <div className="numbered-media-sections w-full max-w-7xl mx-auto px-4 md:px-14 z-10 relative mt-8">

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

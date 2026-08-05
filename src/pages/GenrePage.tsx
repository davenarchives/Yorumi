import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import AnimeCard from '../features/anime/components/AnimeCard';
import Pagination from '../components/ui/Pagination';
import AnimeCardSkeleton from '../features/anime/components/AnimeCardSkeleton';
import { slugify } from '../utils/slugify';
import type { Anime } from '../types/anime';
import { API_BASE } from '../config/api';
import { parseStudios } from '../services/animeService';

// Helper to map AniList response to our Anime interface format
const mapAnilistToAnime = (item: any): Anime => ({
    mal_id: item.idMal || item.id,
    id: item.id,
    title: item.title?.english || item.title?.romaji || 'Unknown',
    title_japanese: item.title?.native,
    title_english: item.title?.english,
    title_romaji: item.title?.romaji,
    images: {
        jpg: {
            image_url: item.coverImage?.large || '',
            large_image_url: item.coverImage?.extraLarge || item.coverImage?.large || ''
        }
    },
    synopsis: item.description?.replace(/<[^>]*>/g, '') || '',
    score: item.averageScore ? item.averageScore / 10 : 0,
    episodes: item.episodes,
    nextAiringEpisode: item.nextAiringEpisode ? {
        episode: item.nextAiringEpisode.episode,
        timeUntilAiring: item.nextAiringEpisode.timeUntilAiring ?? (item.nextAiringEpisode.airingAt ? item.nextAiringEpisode.airingAt - Math.floor(Date.now() / 1000) : 0)
    } : undefined,
    latestEpisode: item.nextAiringEpisode?.episode ? item.nextAiringEpisode.episode - 1 : undefined,
    status: item.status,
    type: item.format,
    genres: item.genres || [],
    year: item.seasonYear || item.startDate?.year,
    anilist_banner_image: item.bannerImage,
    anilist_cover_image: item.coverImage?.extraLarge || item.coverImage?.large,
    duration: item.duration ? `${item.duration} min` : undefined,
    studios: parseStudios(item.studios),
    trailer: item.trailer,
});

export default function GenrePage() {
    const { name } = useParams<{ name: string }>();
    const navigate = useNavigate();
    const [animeList, setAnimeList] = useState<Anime[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);

    const genreName = decodeURIComponent(name || '');

    useEffect(() => {
        const fetchAnimeByGenre = async () => {
            setLoading(true);
            try {
                const res = await fetch(`${API_BASE}/anilist/genre/${encodeURIComponent(genreName)}?page=${currentPage}&limit=24`);
                if (!res.ok) throw new Error('Failed to fetch');
                const data = await res.json();

                const mapped = data.media?.map(mapAnilistToAnime) || [];
                setAnimeList(mapped);
                setLastPage(data.pageInfo?.lastPage || 1);
            } catch (error) {
                console.error('Failed to fetch genre anime:', error);
            } finally {
                setLoading(false);
            }
        };

        if (genreName) {
            fetchAnimeByGenre();
        }
    }, [genreName, currentPage]);

    const handleAnimeClick = (item: Anime) => {
        navigate(`/anime/details/${item.mal_id}`, { state: { anime: item } });
    };

    const handleWatchClick = (item: Anime) => {
        const title = slugify(item.title || item.title_english || 'anime');
        navigate(`/anime/details/${item.mal_id}?ep=1`, { state: { anime: item } });
    };

    return (
        <div className="min-h-screen pb-20 pt-24">
            <div className="container mx-auto px-4">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-white" />
                    </button>
                    <h1 className="text-2xl font-black text-white tracking-wide">
                        <span className="text-yorumi-accent">{genreName}</span> Anime
                    </h1>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 mb-8">
                        {Array.from({ length: 12 }).map((_, i) => (
                            <AnimeCardSkeleton key={i} />
                        ))}
                    </div>
                ) : animeList.length === 0 ? (
                    <div className="text-center text-gray-500 py-20">
                        No anime found for this genre
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 mb-8">
                            {animeList.map((item) => (
                                <AnimeCard
                                    key={item.mal_id}
                                    anime={item}
                                    onClick={() => handleAnimeClick(item)}
                                    onWatchClick={() => handleWatchClick(item)}
                                />
                            ))}
                        </div>

                        <Pagination
                            currentPage={currentPage}
                            lastPage={lastPage}
                            onPageChange={setCurrentPage}
                        />
                    </>
                )}
            </div>
        </div>
    );
}

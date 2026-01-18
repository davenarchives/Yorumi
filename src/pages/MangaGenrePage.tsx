import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import MangaCard from '../components/MangaCard';
import Pagination from '../components/Pagination';
import LoadingSpinner from '../components/LoadingSpinner';
import type { Manga } from '../types/manga';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Helper to map AniList response to our Manga interface format
const mapAnilistToManga = (item: any): Manga => ({
    mal_id: item.idMal || item.id,
    id: item.id,
    title: item.title?.english || item.title?.romaji || 'Unknown',
    title_english: item.title?.english,
    title_romaji: item.title?.romaji,
    title_native: item.title?.native,
    images: {
        jpg: {
            image_url: item.coverImage?.large || '',
            large_image_url: item.coverImage?.extraLarge || item.coverImage?.large || ''
        }
    },
    synopsis: item.description?.replace(/<[^>]*>/g, '') || '',
    type: item.format,
    chapters: item.chapters,
    volumes: item.volumes,
    score: item.averageScore ? item.averageScore / 10 : 0,
    status: item.status,
    genres: item.genres?.map((g: string) => ({ name: g, mal_id: 0 })) || [],
    countryOfOrigin: item.countryOfOrigin,
});

export default function MangaGenrePage() {
    const { name } = useParams<{ name: string }>();
    const navigate = useNavigate();
    const [mangaList, setMangaList] = useState<Manga[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);

    const genreName = decodeURIComponent(name || '');

    useEffect(() => {
        const fetchMangaByGenre = async () => {
            setLoading(true);
            try {
                const res = await fetch(`${API_BASE}/anilist/manga/genre/${encodeURIComponent(genreName)}?page=${currentPage}&limit=24`);
                if (!res.ok) throw new Error('Failed to fetch');
                const data = await res.json();

                const mapped = data.media?.map(mapAnilistToManga) || [];
                setMangaList(mapped);
                setLastPage(data.pageInfo?.lastPage || 1);
            } catch (error) {
                console.error('Failed to fetch genre manga:', error);
            } finally {
                setLoading(false);
            }
        };

        if (genreName) {
            fetchMangaByGenre();
        }
    }, [genreName, currentPage]);

    const handleMangaClick = (item: Manga) => {
        navigate(`/manga/${item.mal_id}`, { state: { manga: item } });
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
                        <span className="text-yorumi-accent">{genreName}</span> Manga
                    </h1>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <LoadingSpinner size="lg" text={`Loading ${genreName} manga...`} />
                    </div>
                ) : mangaList.length === 0 ? (
                    <div className="text-center text-gray-500 py-20">
                        No manga found for this genre
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 mb-8">
                            {mangaList.map((item) => (
                                <MangaCard
                                    key={item.mal_id}
                                    manga={item}
                                    onClick={() => handleMangaClick(item)}
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

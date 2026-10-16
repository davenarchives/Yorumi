import { ArrowLeft, Heart } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AnimeCard from '../features/anime/components/AnimeCard';
import { useFavoriteAnime } from '../hooks/useFavoriteAnime';
import { animeService } from '../services/animeService';
import { buildAnimeRouteId, parseAnimeRouteId } from '../utils/animeNavigation';

export default function FavoriteAnimePage() {
    const navigate = useNavigate();
    const { favorites, loading, removeFavorite } = useFavoriteAnime();
    const [synopsisById, setSynopsisById] = useState<Record<string, string>>({});

    useEffect(() => {
        let cancelled = false;

        const loadMissingSynopsis = async () => {
            const missingIds = favorites
                .filter((item) => !item.synopsis && !synopsisById[item.id])
                .map((item) => item.id);

            if (missingIds.length === 0) return;

            const updates: Record<string, string> = {};
            await Promise.all(
                missingIds.map(async (id) => {
                    try {
                        const res = await animeService.getAnimeDetails(id);
                        updates[id] = res?.data?.synopsis || '';
                    } catch {
                        updates[id] = '';
                    }
                })
            );

            if (!cancelled && Object.keys(updates).length > 0) {
                setSynopsisById((prev) => ({ ...prev, ...updates }));
            }
        };

        loadMissingSynopsis();
        return () => { cancelled = true; };
    }, [favorites, synopsisById]);

    return (
        <div className="min-h-screen bg-[#07090d] pt-24 pb-12">
            <div className="max-w-[1400px] mx-auto px-4 md:px-8">
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={() => navigate('/profile?tab=anime-overview')}
                        className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-white" />
                    </button>
                    <h1 className="text-2xl font-black text-white tracking-wide uppercase">Favorite Animes</h1>
                </div>

                {loading ? (
                    <div className="text-gray-400">Loading favorites...</div>
                ) : favorites.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
                        <Heart className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-400">No favorite anime yet.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
                        {favorites.map((item) => {
                            const routeRef = parseAnimeRouteId(item.id);
                            const routeId = routeRef ? buildAnimeRouteId(routeRef) : '';
                            const animeData: any = {
                                id: routeRef?.source === 'anilist' ? Number(routeRef.id) : 0,
                                mal_id: routeRef?.source === 'mal' ? Number(routeRef.id) : 0,
                                tmdbId: routeRef?.source === 'tmdb' ? Number(routeRef.id) : undefined,
                                scraperId: routeRef?.source === 'scraper' ? String(routeRef.id) : undefined,
                                source: routeRef?.source,
                                title: item.title,
                                images: { jpg: { large_image_url: item.image, image_url: item.image } },
                                score: 0,
                                type: 'TV',
                                status: 'UNKNOWN',
                                episodes: null,
                                genres: [],
                                synopsis: item.synopsis || synopsisById[item.id] || ''
                            };

                            return (
                                <AnimeCard
                                    key={item.id}
                                    anime={animeData}
                                    onClick={() => routeId && navigate(`/anime/details/${routeId}`, { state: { anime: animeData } })}
                                    onWatchClick={() => {
                                        if (routeId) navigate(`/anime/details/${routeId}?ep=1`, { state: { anime: animeData } });
                                    }}
                                    inList={true}
                                    onToggleList={() => removeFavorite(item.id)}
                                    disableTilt
                                />
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

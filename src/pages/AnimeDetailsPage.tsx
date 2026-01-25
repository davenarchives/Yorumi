import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAnime } from '../hooks/useAnime';
import { useWatchList } from '../hooks/useWatchList';
import { slugify } from '../utils/slugify';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import type { Anime } from '../types/anime';

// Feature Components
import DetailsHero from '../features/anime/components/details/DetailsHero';
import DetailsInfo from '../features/anime/components/details/DetailsInfo';
import DetailsEpisodeGrid from '../features/anime/components/details/DetailsEpisodeGrid';
import DetailsCharacters from '../features/anime/components/details/DetailsCharacters';
import DetailsTrailers from '../features/anime/components/details/DetailsTrailers';
import DetailsRelations from '../features/anime/components/details/DetailsRelations';

export default function AnimeDetailsPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const animeHook = useAnime();

    // We need to sync the URL ID with the hook's selectedAnime
    useEffect(() => {
        // Scroll to top on mount
        window.scrollTo({ top: 0, behavior: 'instant' });

        if (location.state?.anime) {
            // Instant load from navigation state
            animeHook.handleAnimeClick(location.state.anime);
        } else if (id) {
            // Deep link / Refresh - fetch using ID
            if (id.startsWith('s:')) {
                // Scraper ID
                animeHook.handleAnimeClick({
                    mal_id: 0,
                    id: 0,
                    scraperId: id.substring(2),
                    title: '', // Title unknown on deep link, might fail identification if not mapped
                    images: { jpg: { image_url: '', large_image_url: '' } } // Placeholder
                } as Anime);
            } else {
                animeHook.handleAnimeClick({ mal_id: parseInt(id) } as Anime);
            }
        }
    }, [id, location.state]);

    const { selectedAnime, episodes, epLoading, detailsLoading, error, watchedEpisodes } = animeHook;
    const { isInWatchList, addToWatchList, removeFromWatchList } = useWatchList();
    const [activeTab, setActiveTab] = useState<'summary' | 'relations'>('summary');

    // Derived state for button, but useWatchList is reactive so we can just use isInWatchList(id)
    const animeId = selectedAnime ? (selectedAnime.id || selectedAnime.mal_id).toString() : '';
    const inList = isInWatchList(animeId);

    const handleToggleList = () => {
        if (!selectedAnime || !animeId) return;

        if (inList) {
            removeFromWatchList(animeId);
        } else {
            addToWatchList({
                id: animeId,
                title: selectedAnime.title,
                image: selectedAnime.images.jpg.large_image_url,
                score: selectedAnime.score,
                type: selectedAnime.type,
                totalCount: selectedAnime.episodes || episodes.length,
                genres: selectedAnime.genres?.map(g => g.name),
                mediaStatus: selectedAnime.status,
                synopsis: selectedAnime.synopsis,
                status: 'watching'
            });
        }
    };

    if (error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center text-red-500 gap-4">
                <p className="text-xl font-bold">Error loading anime</p>
                <p className="text-sm text-gray-400">{error}</p>
                <button
                    onClick={() => navigate('/')}
                    className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
                >
                    Go Home
                </button>
            </div>
        );
    }

    if (!selectedAnime) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <LoadingSpinner size="lg" text="Loading Details..." />
            </div>
        );
    }

    const isUnreleased = selectedAnime.status === 'NOT_YET_RELEASED';

    return (
        <div className="min-h-screen bg-[#0a0a0a] pb-20 fade-in animate-in duration-300">
            {/* Banner Section */}
            <DetailsHero
                anime={selectedAnime}
                onBack={() => {
                    if (location.state?.fromRandom) {
                        navigate('/', { replace: true });
                    } else {
                        navigate(-1);
                    }
                }}
            />

            {/* Content Section */}
            <div className="container mx-auto px-4 md:px-6 -mt-24 md:-mt-32 relative z-10">
                <DetailsInfo
                    anime={selectedAnime}
                    episodesCount={episodes.length}
                    inList={inList}
                    onWatch={() => {
                        const title = slugify(selectedAnime.title || selectedAnime.title_english || 'anime');
                        navigate(`/anime/watch/${title}/${id}`);
                    }}
                    onToggleList={handleToggleList}
                >
                    {/* Tabs */}
                    <div className="flex items-center gap-8 border-b border-white/10 mb-6 mt-4">
                        <button
                            onClick={() => setActiveTab('summary')}
                            className={`pb-3 text-lg font-bold transition-colors relative ${activeTab === 'summary' ? 'text-white' : 'text-gray-500 hover:text-white'}`}
                        >
                            Summary
                            {activeTab === 'summary' && <div className="absolute bottom-0 inset-x-0 h-0.5 bg-yorumi-accent" />}
                        </button>
                        <button
                            onClick={() => setActiveTab('relations')}
                            className={`pb-3 text-lg font-bold transition-colors relative ${activeTab === 'relations' ? 'text-white' : 'text-gray-500 hover:text-white'}`}
                        >
                            Relations
                            {activeTab === 'relations' && <div className="absolute bottom-0 inset-x-0 h-0.5 bg-yorumi-accent" />}
                        </button>
                    </div>

                    <div className="">
                        {activeTab === 'summary' && (
                            <>
                                <p className="text-gray-300 text-base leading-relaxed max-w-3xl">
                                    {selectedAnime.synopsis || 'No synopsis.'}
                                </p>
                            </>
                        )}
                    </div>

                    {activeTab === 'summary' && (
                        <>
                            {/* Episodes Section */}
                            {!isUnreleased && (
                                epLoading ? (
                                    <div className="py-8 flex justify-center"><LoadingSpinner size="md" /></div>
                                ) : (
                                    <DetailsEpisodeGrid
                                        episodes={episodes}
                                        watchedEpisodes={watchedEpisodes}
                                        onEpisodeClick={(ep) => {
                                            const title = slugify(selectedAnime.title || selectedAnime.title_english || 'anime');
                                            navigate(`/anime/watch/${title}/${id}?ep=${ep.episodeNumber}`);
                                        }}
                                    />
                                )
                            )}

                            {/* Characters Section */}
                            {detailsLoading ? (
                                <div className="py-6 border-t border-white/10 mt-6">
                                    <h3 className="text-xl font-bold text-white mb-4">Characters & Voice Actors</h3>
                                    <div className="flex justify-center py-8">
                                        <LoadingSpinner size="md" text="Loading Characters..." />
                                    </div>
                                </div>
                            ) : (
                                <DetailsCharacters characters={selectedAnime.characters} />
                            )}

                            {/* Trailers Section */}
                            {detailsLoading ? (
                                <div className="py-6 border-t border-white/10 mt-6">
                                    <h3 className="text-xl font-bold text-white mb-4">Trailers & PVs</h3>
                                    <div className="flex justify-center py-8">
                                        <LoadingSpinner size="md" />
                                    </div>
                                </div>
                            ) : (
                                <DetailsTrailers trailer={selectedAnime.trailer} />
                            )}
                        </>
                    )}

                    {activeTab === 'relations' && (
                        <div className="mt-6">
                            <DetailsRelations
                                relations={selectedAnime.relations}
                                onAnimeClick={(id) => navigate(`/anime/details/${id}`)}
                            />
                        </div>
                    )}
                </DetailsInfo>
            </div>
        </div>
    );
}

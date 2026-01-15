import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAnime } from '../hooks/useAnime'; // We might reuse this for episode prefetching
import LoadingSpinner from '../components/LoadingSpinner';
import AnimeCard from '../components/AnimeCard';
import type { Anime, Episode } from '../types/anime';

// Episode Grid (reused from Modal)
const EpisodeList = ({ episodes, onEpisodeClick }: { episodes: Episode[], onEpisodeClick: (ep: Episode) => void }) => {
    const ITEMS_PER_PAGE = 30;
    const [page, setPage] = useState(1);
    const totalPages = Math.ceil(episodes.length / ITEMS_PER_PAGE);

    const currentEpisodes = episodes.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    return (
        <div className="mt-6">
            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
                {currentEpisodes.map((ep) => (
                    <button
                        key={ep.session || ep.episodeNumber}
                        onClick={() => onEpisodeClick(ep)}
                        className="aspect-square flex items-center justify-center rounded transition-all duration-200 relative group bg-white/10 hover:bg-yorumi-accent hover:text-black hover:scale-105 hover:shadow-lg hover:shadow-yorumi-accent/20 text-gray-300 cursor-pointer border border-white/5 hover:border-yorumi-accent"
                        title={ep.title || `Episode ${ep.episodeNumber}`}
                    >
                        <span className="text-sm font-bold">{ep.episodeNumber}</span>
                    </button>
                ))}
            </div>

            {totalPages > 1 && (
                <div className="flex flex-col items-center gap-4 mt-6">
                    <div className="flex flex-wrap justify-center gap-2">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                            <button
                                key={p}
                                onClick={() => setPage(p)}
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-colors flex-shrink-0
                                    ${page === p ? 'bg-yorumi-500 text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20'}`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default function AnimeDetailsPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    // Using useAnime hook here might be overkill if we just want one anime, 
    // but useAnime has logic for fetching episodes and prefetching.
    // However, useAnime is optimized for the global app state.
    // A fresh instance here will work for this page's lifecycle.
    const animeHook = useAnime();

    const location = useLocation();

    // We need to sync the URL ID with the hook's selectedAnime
    useEffect(() => {
        // Scroll to top on mount
        window.scrollTo({ top: 0, behavior: 'instant' });

        if (location.state?.anime) {
            // Instant load from navigation state
            animeHook.handleAnimeClick(location.state.anime);
        } else if (id) {
            // Deep link / Refresh - fetch using ID
            animeHook.handleAnimeClick({ mal_id: parseInt(id) } as Anime);
        }
    }, [id, location.state]);

    const { selectedAnime, episodes, epLoading, detailsLoading, error } = animeHook;
    const [activeTab, setActiveTab] = useState<'summary' | 'relations'>('summary');

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

    const bannerImage = selectedAnime.anilist_banner_image || selectedAnime.images.jpg.large_image_url;

    // Helper for latest episode
    const getLatestEpisode = () => {
        if (selectedAnime.latestEpisode) return selectedAnime.latestEpisode;
        if (episodes.length > 0) return episodes.length;
        if (selectedAnime.episodes) return selectedAnime.episodes;
        return null;
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] pb-20 fade-in animate-in duration-300">
            {/* Banner Section */}
            <div className="relative h-[50vh] w-full">
                <div className="absolute inset-0">
                    <img
                        src={bannerImage}
                        alt={selectedAnime.title}
                        className={`w-full h-full object-cover ${!selectedAnime.anilist_banner_image ? 'blur-xl opacity-50 scale-110' : ''}`}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/60 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#0a0a0a] to-transparent" />
                </div>

                <button
                    onClick={() => navigate(-1)}
                    className="absolute top-24 left-6 z-50 p-3 bg-black/50 hover:bg-white/20 rounded-full backdrop-blur-sm transition-colors text-white"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>
            </div>

            {/* Content Section */}
            <div className="container mx-auto px-6 -mt-32 relative z-10">
                <div className="flex flex-col md:flex-row gap-8">
                    {/* Portrait Image */}
                    <div className="flex-shrink-0 mx-auto md:mx-0 w-64 md:w-72">
                        <div className="rounded-xl overflow-hidden shadow-2xl shadow-black/50">
                            <img
                                src={selectedAnime.images.jpg.large_image_url}
                                alt={selectedAnime.title}
                                className="w-full h-full object-cover aspect-[2/3]"
                            />
                        </div>
                    </div>

                    {/* Details */}
                    <div className="flex-1 pt-4 md:pt-8 text-center md:text-left space-y-4">
                        <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-white leading-tight">
                            {selectedAnime.title}
                        </h1>

                        {/* Badges */}
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-sm">
                            <span className="bg-[#facc15] text-black px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1">
                                {selectedAnime.score}
                            </span>
                            {getLatestEpisode() && (
                                <span className="bg-[#22c55e] text-white px-2.5 py-1 rounded text-xs font-bold">
                                    {getLatestEpisode()} eps
                                </span>
                            )}
                            <span className="px-2.5 py-1 bg-white/10 rounded text-gray-300 text-xs">
                                {selectedAnime.type}
                            </span>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-4 py-2">
                            <button
                                onClick={() => navigate(`/watch/${id}`)}
                                className="h-12 px-8 bg-[#facc15] hover:bg-[#ffe066] text-black text-lg font-bold rounded-full transition-transform active:scale-95 flex items-center gap-3 shadow-lg shadow-yellow-500/20"
                            >
                                Watch Now
                            </button>
                            <button className="h-12 px-8 bg-white/10 hover:bg-white/20 text-white text-lg font-bold rounded-full transition-colors border border-white/10">
                                Add to List
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex items-center gap-8 border-b border-white/10 mb-6">
                            <button
                                onClick={() => setActiveTab('summary')}
                                className={`pb-3 text-lg font-bold transition-colors relative ${activeTab === 'summary' ? 'text-white' : 'text-gray-500 hover:text-white'}`}
                            >
                                Summary
                                {activeTab === 'summary' && <div className="absolute bottom-0 inset-x-0 h-0.5 bg-pink-500" />}
                            </button>
                            <button
                                onClick={() => setActiveTab('relations')}
                                className={`pb-3 text-lg font-bold transition-colors relative ${activeTab === 'relations' ? 'text-white' : 'text-gray-500 hover:text-white'}`}
                            >
                                Relations
                                {activeTab === 'relations' && <div className="absolute bottom-0 inset-x-0 h-0.5 bg-pink-500" />}
                            </button>
                        </div>

                        {activeTab === 'summary' && (
                            <>
                                <p className="text-gray-300 text-base leading-relaxed max-w-3xl">
                                    {selectedAnime.synopsis || 'No synopsis.'}
                                </p>

                                <div className="py-6 border-t border-white/10 mt-6">
                                    <h3 className="text-xl font-bold text-white mb-4">Episodes</h3>
                                    {epLoading ? (
                                        <div className="py-8 flex justify-center"><LoadingSpinner size="md" /></div>
                                    ) : episodes.length > 0 ? (
                                        <EpisodeList
                                            episodes={episodes}
                                            onEpisodeClick={(ep) => navigate(`/watch/${id}?ep=${ep.episodeNumber}`)}
                                        />
                                    ) : (
                                        <div className="text-gray-500 text-center py-4">No episodes found.</div>
                                    )}
                                </div>

                                {/* Characters Section */}
                                {detailsLoading ? (
                                    <div className="py-6 border-t border-white/10 mt-6">
                                        <h3 className="text-xl font-bold text-white mb-4">Characters & Voice Actors</h3>
                                        <div className="flex justify-center py-8">
                                            <LoadingSpinner size="md" text="Loading Characters..." />
                                        </div>
                                    </div>
                                ) : selectedAnime.characters && selectedAnime.characters.edges.length > 0 && (
                                    <div className="py-6 border-t border-white/10 mt-6">
                                        <h3 className="text-xl font-bold text-white mb-4">Characters & Voice Actors</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {selectedAnime.characters.edges.slice(0, 9).map((char, idx) => {
                                                const va = char.voiceActors.find(v => v.languageV2 === 'Japanese') || char.voiceActors[0];
                                                return (
                                                    <div key={idx} className="flex bg-[#1a1a1a] rounded-lg overflow-hidden border border-white/5 hover:bg-[#252525] transition-colors">
                                                        {/* Character */}
                                                        <div className="flex flex-1">
                                                            <img
                                                                src={char.node.image.large}
                                                                alt={char.node.name.full}
                                                                className="w-16 h-24 object-cover"
                                                            />
                                                            <div className="p-2 flex flex-col justify-center min-w-0">
                                                                <p className="text-sm font-bold text-gray-200 line-clamp-2">{char.node.name.full}</p>
                                                                <p className="text-xs text-gray-500 uppercase">{char.role}</p>
                                                            </div>
                                                        </div>

                                                        {/* Voice Actor */}
                                                        {va && (
                                                            <div className="flex flex-1 flex-row-reverse text-right">
                                                                <img
                                                                    src={va.image.large}
                                                                    alt={va.name.full}
                                                                    className="w-16 h-24 object-cover"
                                                                />
                                                                <div className="p-2 flex flex-col justify-center min-w-0">
                                                                    <p className="text-sm font-bold text-gray-200 line-clamp-2">{va.name.full}</p>
                                                                    <p className="text-xs text-gray-500 uppercase">{va.languageV2 || 'Japanese'}</p>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Trailers Section */}
                                {detailsLoading ? (
                                    <div className="py-6 border-t border-white/10 mt-6 md:col-span-2 lg:col-span-3">
                                        <h3 className="text-xl font-bold text-white mb-4">Trailers & PVs</h3>
                                        <div className="flex justify-center py-8">
                                            <LoadingSpinner size="md" />
                                        </div>
                                    </div>
                                ) : selectedAnime.trailer && (
                                    <div className="py-6 border-t border-white/10 mt-6">
                                        <h3 className="text-xl font-bold text-white mb-4">Trailers & PVs</h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                                            <a
                                                href={`https://www.youtube.com/watch?v=${selectedAnime.trailer.id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="group relative aspect-video bg-black rounded-lg overflow-hidden border border-white/10 hover:border-yorumi-accent transition-colors block"
                                            >
                                                <img
                                                    src={selectedAnime.trailer.thumbnail}
                                                    alt="Trailer"
                                                    className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
                                                />
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                                                        <div className="w-0 h-0 border-t-[8px] border-t-transparent border-l-[12px] border-l-white border-b-[8px] border-b-transparent ml-1" />
                                                    </div>
                                                </div>
                                                <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                                                    <p className="text-sm font-bold text-white">Official Trailer</p>
                                                </div>
                                            </a>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Relations Tab Logic ... (Simplified for this file, can copy from Modal if needed) */}
                        {activeTab === 'relations' && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                {selectedAnime.relations?.edges.map(edge => (
                                    <AnimeCard
                                        key={edge.node.id}
                                        anime={{
                                            mal_id: edge.node.id,
                                            title: edge.node.title.romaji,
                                            images: { jpg: { large_image_url: edge.node.coverImage.large, image_url: edge.node.coverImage.large } },
                                            score: 0
                                        } as any}
                                        onClick={() => navigate(`/anime/${edge.node.id}`)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

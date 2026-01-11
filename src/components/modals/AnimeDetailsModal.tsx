import type { Anime } from '../../types/anime';

interface AnimeDetailsModalProps {
    isOpen: boolean;
    anime: Anime;
    onClose: () => void;
    onWatchNow: () => void;
}

export default function AnimeDetailsModal({ isOpen, anime, onClose, onWatchNow }: AnimeDetailsModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md">
            <div className="w-full max-w-6xl h-[90vh] bg-[#1a1a1a] rounded-lg overflow-hidden flex flex-col m-4">
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                    <div>
                        <h1 className="text-3xl font-bold">{anime.title}</h1>
                        {anime.title_japanese && (
                            <p className="text-sm text-gray-400 mt-1">{anime.title_japanese}</p>
                        )}
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="flex gap-8">
                        <div className="w-64 flex-shrink-0">
                            <img src={anime.images.jpg.large_image_url} alt={anime.title} className="w-full rounded-lg shadow-2xl" />
                            <button
                                onClick={onWatchNow}
                                className="w-full mt-4 py-3 bg-[#facc15] hover:bg-[#fbbf24] text-black font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                    <path fillRule="evenodd" d="M4.5 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" clipRule="evenodd" />
                                </svg>
                                Watch Now
                            </button>
                        </div>
                        <div className="flex-1 space-y-6">
                            <div className="flex flex-wrap gap-2">
                                <span className="px-3 py-1 bg-white/10 rounded text-sm">{anime.type}</span>
                                {anime.rating && <span className="px-3 py-1 bg-purple-900/30 text-purple-400 rounded text-sm">{anime.rating}</span>}
                                {anime.episodes && <span className="px-3 py-1 bg-blue-900/30 text-blue-400 rounded text-sm">{anime.episodes} Episodes</span>}
                                <span className="px-3 py-1 bg-[#facc15] text-black font-bold rounded text-sm flex items-center gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                        <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                                    </svg>
                                    {anime.score}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                {anime.aired?.string && (
                                    <div>
                                        <h4 className="text-xs text-gray-500 uppercase mb-1">Aired</h4>
                                        <p className="text-sm">{anime.aired.string}</p>
                                    </div>
                                )}
                                {anime.season && (
                                    <div>
                                        <h4 className="text-xs text-gray-500 uppercase mb-1">Premiered</h4>
                                        <p className="text-sm capitalize">{anime.season} {anime.year}</p>
                                    </div>
                                )}
                                {anime.duration && (
                                    <div>
                                        <h4 className="text-xs text-gray-500 uppercase mb-1">Duration</h4>
                                        <p className="text-sm">{anime.duration}</p>
                                    </div>
                                )}
                                <div>
                                    <h4 className="text-xs text-gray-500 uppercase mb-1">Status</h4>
                                    <p className={`text-sm ${anime.status === 'Currently Airing' ? 'text-green-400' : ''}`}>{anime.status}</p>
                                </div>
                            </div>
                            {anime.genres && anime.genres.length > 0 && (
                                <div>
                                    <h4 className="text-xs text-gray-500 uppercase mb-2">Genres</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {anime.genres.map(genre => (
                                            <span key={genre.mal_id} className="px-3 py-1 bg-white/5 hover:bg-white/10 rounded text-sm transition-colors cursor-pointer">
                                                {genre.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {anime.studios && anime.studios.length > 0 && (
                                <div>
                                    <h4 className="text-xs text-gray-500 uppercase mb-1">Studios</h4>
                                    <p className="text-sm">{anime.studios.map(s => s.name).join(', ')}</p>
                                </div>
                            )}
                            {anime.producers && anime.producers.length > 0 && (
                                <div>
                                    <h4 className="text-xs text-gray-500 uppercase mb-1">Producers</h4>
                                    <p className="text-sm text-gray-400">{anime.producers.map(p => p.name).join(', ')}</p>
                                </div>
                            )}
                            <div>
                                <h4 className="text-xs text-gray-500 uppercase mb-2">Synopsis</h4>
                                <p className="text-sm text-gray-300 leading-relaxed">{anime.synopsis || 'No synopsis available.'}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

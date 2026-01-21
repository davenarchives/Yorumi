import type { Anime } from '../../../../types/anime';

interface DetailsTrailersProps {
    trailer: Anime['trailer'];
}

export default function DetailsTrailers({ trailer }: DetailsTrailersProps) {
    if (!trailer) return null;

    return (
        <div className="py-6 border-t border-white/10 mt-6">
            <h3 className="text-xl font-bold text-white mb-4">Trailers & PVs</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                <a
                    href={`https://www.youtube.com/watch?v=${trailer.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative aspect-video bg-black rounded-lg overflow-hidden border border-white/10 hover:border-yorumi-accent transition-colors block"
                >
                    <img
                        src={trailer.thumbnail}
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
    );
}

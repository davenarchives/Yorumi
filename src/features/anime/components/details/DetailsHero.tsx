import { ArrowLeft } from 'lucide-react';
import type { Anime } from '../../../../types/anime';

interface DetailsHeroProps {
    anime: Anime;
    onBack: () => void;
}

export default function DetailsHero({ anime, onBack }: DetailsHeroProps) {
    const bannerImage = anime.anilist_banner_image || anime.images.jpg.large_image_url;

    return (
        <div className="relative h-[40vh] md:h-[50vh] w-full">
            <div className="absolute inset-0">
                <img
                    src={bannerImage}
                    alt={anime.title}
                    className={`w-full h-full object-cover ${!anime.anilist_banner_image ? 'blur-xl opacity-50 scale-110' : ''}`}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/60 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#0a0a0a] to-transparent" />
            </div>

            <button
                onClick={onBack}
                className="absolute top-20 md:top-24 left-4 md:left-6 z-50 p-3 bg-black/50 hover:bg-white/20 rounded-full backdrop-blur-sm transition-colors text-white"
            >
                <ArrowLeft className="w-6 h-6" />
            </button>
        </div>
    );
}

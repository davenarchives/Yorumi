import React from 'react';
import { AnimatePresence, m } from 'framer-motion';
import type { Anime } from '../../../../types/anime';
import { useTitleLanguage } from '../../../../context/TitleLanguageContext';
import { getDisplayTitle } from '../../../../utils/titleLanguage';

interface DetailsHeroProps {
    anime: Anime;
    breadcrumbParent?: string;
}

export default function DetailsHero({ anime }: DetailsHeroProps) {
    const { language } = useTitleLanguage();
    const bannerImage = anime.anilist_banner_image
        || anime.images?.jpg?.large_image_url
        || anime.images?.jpg?.image_url
        || '';
    const displayTitle = getDisplayTitle(anime as unknown as Record<string, unknown>, language);

    return (
        <div className="relative h-[30vh] md:h-[40vh] w-full overflow-hidden">
            <div className="absolute inset-0 select-none">
                <AnimatePresence mode="popLayout">
                    <m.img
                        key={anime.id || anime.mal_id || bannerImage}
                        src={bannerImage}
                        alt={displayTitle}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5 }}
                        className={`w-full h-full object-cover absolute inset-0 ${!anime.anilist_banner_image ? 'blur-xl opacity-50 scale-110' : ''}`}
                        loading="eager"
                        decoding="async"
                        fetchPriority="high"
                    />
                </AnimatePresence>
                <div className="absolute inset-x-0 bottom-0 h-[60%] bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/60 to-transparent z-10 pointer-events-none" />
            </div>
        </div>
    );
}

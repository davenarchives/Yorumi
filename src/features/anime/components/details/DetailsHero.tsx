import { useEffect, useState } from 'react';
import type { Anime } from '../../../../types/anime';
import { getDisplayImageUrl } from '../../../../utils/image';
import { tmdbService } from '../../../../services/tmdbService';

interface DetailsHeroProps {
    anime: Anime;
    breadcrumbParent?: string;
}

export default function DetailsHero({ anime }: DetailsHeroProps) {
    const poster = anime.images?.jpg?.large_image_url
        || anime.images?.jpg?.image_url
        || anime.anilist_cover_image
        || '';

    const cachedOriginal = tmdbService.getCachedBackdropForAnime(anime, 'original');
    const cachedPreview = tmdbService.getCachedBackdropForAnime(anime, 'w780');

    const [resolvedTmdbState, setResolvedTmdbState] = useState<{ key: string; url: string | null }>({
        key: '',
        url: null,
    });

    const animeKey = `${anime.id || ''}:${anime.mal_id || ''}:${anime.tmdbId || ''}:${anime.title || ''}`;

    useEffect(() => {
        let cancelled = false;
        void tmdbService.getBackdropForAnime(anime, 'original').then((backdrop) => {
            if (!cancelled && backdrop) {
                setResolvedTmdbState({ key: animeKey, url: backdrop });
            }
        });
        return () => {
            cancelled = true;
        };
    }, [anime, animeKey]);

    const tmdbBackdrop = (resolvedTmdbState.key === animeKey ? resolvedTmdbState.url : null) || cachedOriginal;
    const rawPrimaryBackdrop = tmdbBackdrop || anime.anilist_banner_image || cachedPreview || poster;
    const primaryBackdrop = getDisplayImageUrl(rawPrimaryBackdrop);
    const previewBackdrop = cachedPreview ? getDisplayImageUrl(cachedPreview) : null;

    return (
        <div 
            className="pointer-events-none absolute inset-x-0 top-0 z-0 h-screen min-h-[640px] w-full select-none"
            style={{
                maskImage: 'linear-gradient(to bottom, #000 0%, #000 35%, rgba(0,0,0,0.75) 58%, rgba(0,0,0,0.32) 74%, rgba(0,0,0,0.08) 88%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to bottom, #000 0%, #000 35%, rgba(0,0,0,0.75) 58%, rgba(0,0,0,0.32) 74%, rgba(0,0,0,0.08) 88%, transparent 100%)',
            }}
        >
            {/* Mobile crisp portrait poster backdrop */}
            {poster ? (
                <div
                    className="md:hidden absolute inset-0 bg-cover bg-top bg-no-repeat"
                    style={{ backgroundImage: `url(${getDisplayImageUrl(poster)})` }}
                />
            ) : null}

            {/* Desktop instant cached w780 preview layer from home cards so transition has zero flicker */}
            {previewBackdrop && previewBackdrop !== primaryBackdrop && (
                <div
                    className="hidden md:block absolute inset-0 bg-cover bg-center bg-no-repeat"
                    style={{ backgroundImage: `url(${previewBackdrop})` }}
                />
            )}

            {primaryBackdrop ? (
                <div
                    className="hidden md:block absolute inset-0 bg-cover bg-center bg-no-repeat"
                    style={{ backgroundImage: `url(${primaryBackdrop})` }}
                />
            ) : null}

            {/* Exact same vignette overlays as SpotlightHero for a pixel-identical seamless transition */}
            <div className="absolute inset-y-0 left-0 w-full md:w-[65%] bg-gradient-to-r from-[#070707]/90 via-[#070707]/50 to-transparent z-10 pointer-events-none" />
            <div className="absolute inset-x-0 top-0 h-[22%] bg-gradient-to-b from-black/60 to-transparent z-10 pointer-events-none" />
            <div className="absolute inset-y-0 right-0 w-[15%] bg-gradient-to-l from-black/45 to-transparent z-10 pointer-events-none" />
        </div>
    );
}

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Plus, Check } from 'lucide-react';
import type { Anime } from '../../../types/anime';
import AnimeLogoImage from '../../../components/anime/AnimeLogoImage';
import { useTitleLanguage } from '../../../context/TitleLanguageContext';
import { getDisplayTitle } from '../../../utils/titleLanguage';
import { getDisplayImageUrl } from '../../../utils/image';
import { getAnimeWatchlistId } from '../../../utils/animeNavigation';
import { tmdbService } from '../../../services/tmdbService';
import { useWatchList } from '../../../hooks/useWatchList';
import RankBadge from '../../../components/ui/RankBadge';

interface AnimeLandscapeCardProps {
    anime: Anime;
    onClick: (anime: Anime) => void;
    onWatchClick?: (anime: Anime) => void;
    onMouseEnter?: (anime: Anime) => void;
    rank?: number;
}

const backdropMemoryCache = new Map<string, string>();
const backdropInFlight = new Map<string, Promise<string | null>>();

const getAnimeKey = (anime: Anime): string =>
    String(anime.id || anime.mal_id || anime.tmdbId || anime.scraperId || anime.title || '');

const formatAiringBadge = (anime: Anime): string | null => {
    const nextEp = anime.nextAiringEpisode;
    if (nextEp && Number(nextEp.episode) > 0) {
        const epNum = Number(nextEp.episode);
        const seconds = Number(nextEp.timeUntilAiring || 0);
        if (seconds > 0) {
            const days = Math.floor(seconds / 86400);
            if (days >= 1) {
                return `E${epNum} in ${days}d`;
            }
            const hours = Math.max(1, Math.floor(seconds / 3600));
            return `E${epNum} in ${hours}h`;
        }
        return `E${epNum} soon`;
    }

    const status = String(anime.status || '').toUpperCase();
    const latestEp = Number(anime.latestEpisode || 0);
    if (status === 'RELEASING') {
        if (latestEp > 0) return `E${latestEp} out`;
        return 'New episode';
    }

    return null;
};

const getNormalizedScore = (score?: number): number | null => {
    if (!score || score <= 0) return null;
    return score > 10 ? Number((score / 10).toFixed(1)) : Number(score.toFixed(1));
};

const getAnimeYear = (anime: Anime): string => {
    if (anime.year) return String(anime.year);
    if (anime.aired?.from) {
        const parsed = new Date(anime.aired.from).getFullYear();
        if (!Number.isNaN(parsed) && parsed > 1900) return String(parsed);
    }
    return '2026';
};

const getFormatLabel = (type?: string): string => {
    const upper = String(type || 'TV').toUpperCase();
    if (upper === 'MOVIE') return 'Movie';
    if (upper === 'OVA' || upper === 'ONA' || upper === 'SPECIAL') return upper;
    return 'Series';
};

const buildTopLeftNotchGeometry = (badgeText: string) => {
    const w = Math.round(Math.max(76, badgeText.length * 7.2 + 24));
    const h = 30;
    const r = 12;
    const totalW = w + r;
    const totalH = h + r;
    // Extend top and left outward (x=-4, y=-4) so subpixel anti-aliasing / fractional scaling never leaks a top border line
    const path = `M -4 -4 H ${totalW} V 0 A ${r} ${r} 0 0 0 ${w} ${r} V ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} H ${r} A ${r} ${r} 0 0 0 0 ${totalH} H -4 V -4 Z`;

    return {
        width: w,
        height: h,
        totalW,
        totalH,
        path,
    };
};

export const AnimeLandscapeCardSkeleton: React.FC = () => (
    <div className="relative animate-pulse select-none">
        {/* Portrait on mobile (2:3), Landscape on desktop (16:9) */}
        <div className="relative aspect-[2/3] md:aspect-video w-full overflow-hidden rounded-[16px] bg-white/[0.06] border border-white/5" />

        {/* Title & Metadata below the image */}
        <div className="mt-2.5 pr-1">
            <div className="h-4 w-4/5 rounded bg-white/10" />
            <div className="mt-2 flex items-center gap-2">
                <div className="h-3.5 w-10 rounded bg-white/10" />
                <div className="h-1.5 w-1.5 rounded-full bg-white/20" />
                <div className="h-3.5 w-12 rounded bg-white/10" />
                <div className="h-1.5 w-1.5 rounded-full bg-white/20" />
                <div className="h-3.5 w-10 rounded bg-white/10" />
            </div>
        </div>
    </div>
);

const isMobileViewport = (): boolean =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(max-width: 767px)').matches
        : false;

const AnimeLandscapeCard: React.FC<AnimeLandscapeCardProps> = ({
    anime,
    onClick,
    onMouseEnter,
    rank,
}) => {
    const { language } = useTitleLanguage();
    const { isInWatchList, addToWatchList, removeFromWatchList } = useWatchList();
    const key = getAnimeKey(anime);
    const cardRef = useRef<HTMLDivElement>(null);
    const [isMobile] = useState(isMobileViewport);
    const [isInView, setIsInView] = useState(() => isMobile || !key || backdropMemoryCache.has(key));
    const [tmdbBackdrop, setTmdbBackdrop] = useState<string | null>(() => {
        if (!key) return null;
        return backdropMemoryCache.get(key) || tmdbService.getCachedBackdropForAnime(anime, 'w780') || null;
    });

    const animeIdStr = getAnimeWatchlistId(anime);
    const inWatchList = isInWatchList(animeIdStr);

    useEffect(() => {
        if (isInView) return;
        const el = cardRef.current;
        if (!el || typeof IntersectionObserver === 'undefined') return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting) {
                    setIsInView(true);
                    observer.disconnect();
                }
            },
            { rootMargin: '250px' }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [isInView]);

    useEffect(() => {
        if (isMobile || !key || !isInView || backdropMemoryCache.has(key)) return;

        let cancelled = false;
        let promise = backdropInFlight.get(key);
        if (!promise) {
            promise = tmdbService.getBackdropForAnime(anime, 'w780').catch(() => null);
            backdropInFlight.set(key, promise);
        }

        void promise.then((url) => {
            backdropInFlight.delete(key);
            if (url) {
                backdropMemoryCache.set(key, url);
                if (!cancelled) {
                    setTmdbBackdrop(url);
                }
            }
        });

        return () => {
            cancelled = true;
        };
    }, [anime, isInView, isMobile, key]);

    const displayTitle = getDisplayTitle(anime as unknown as Record<string, unknown>, language);
    const resolvedBackdrop =
        tmdbBackdrop ||
        (key ? backdropMemoryCache.get(key) || null : null) ||
        tmdbService.getCachedBackdropForAnime(anime, 'w780');
    // Desktop landscape cards must never fall back to AniList portrait posters
    const fallbackBanner =
        anime.anilist_banner_image ||
        anime.episodeMetadata?.[0]?.thumbnail ||
        '';
    const rawLandscapeImage = resolvedBackdrop || fallbackBanner;
    const imageUrl = rawLandscapeImage ? getDisplayImageUrl(rawLandscapeImage) : '';
    const posterUrl =
        anime.images?.jpg?.large_image_url ||
        anime.images?.jpg?.image_url ||
        anime.anilist_cover_image ||
        imageUrl;

    const airingBadge = rank !== undefined ? null : formatAiringBadge(anime);
    const score = getNormalizedScore(anime.score);
    const year = getAnimeYear(anime);
    const formatLabel = getFormatLabel(anime.type);

    const rawId = useId();
    const maskId = useMemo(() => `notch-mask-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`, [rawId]);
    const notch = useMemo(
        () => (airingBadge ? buildTopLeftNotchGeometry(airingBadge) : null),
        [airingBadge]
    );

    const handleToggleWatchlist = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!animeIdStr) return;
        if (inWatchList) {
            removeFromWatchList(animeIdStr);
        } else {
            addToWatchList({
                id: animeIdStr,
                anilistId: anime.id ? String(anime.id) : undefined,
                malId: anime.mal_id ? String(anime.mal_id) : undefined,
                title: displayTitle,
                image: posterUrl || imageUrl,
                score: anime.score,
                type: anime.type,
                status: 'watching',
            });
        }
    };

    return (
        <div
            ref={cardRef}
            className="relative group cursor-pointer select-none outline-none"
            onClick={() => onClick(anime)}
            onMouseEnter={() => onMouseEnter?.(anime)}
        >
            {/* Outer Wrapper: 2:3 portrait on mobile, 16:9 landscape on desktop */}
            <div className="relative aspect-[2/3] md:aspect-video w-full">
                {/* SVG Mask Definition for seamless inverted cutout notch */}
                {airingBadge && notch && (
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
                        <defs>
                            <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1000">
                                <rect width="1000" height="1000" fill="white" />
                                <path d={notch.path} fill="black" />
                            </mask>
                        </defs>
                    </svg>
                )}

                {/* Image Container with seamless cutout notch and rounded corners */}
                <div
                    className="relative w-full h-full rounded-[16px] overflow-hidden bg-[#14151c]"
                    style={
                        airingBadge && notch
                            ? {
                                  maskImage: `url(#${maskId})`,
                                  WebkitMaskImage: `url(#${maskId})`,
                              }
                            : undefined
                    }
                >
                    {/* Mobile portrait poster */}
                    {posterUrl && (
                        <img
                            src={getDisplayImageUrl(posterUrl)}
                            alt={displayTitle}
                            className="md:hidden w-full h-full object-cover"
                            loading="lazy"
                            decoding="async"
                        />
                    )}
                    {/* Desktop landscape banner */}
                    {!isMobile && (imageUrl ? (
                        <img
                            src={imageUrl}
                            alt={displayTitle}
                            className="hidden md:block w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300 ease-out"
                            loading="lazy"
                            decoding="async"
                        />
                    ) : (
                        <div className="hidden md:block w-full h-full bg-white/5" />
                    ))}

                    {/* Bottom Anime Logo Overlay (desktop landscape cards only) */}
                    {!isMobile && isInView && (
                        <div className="absolute bottom-2.5 left-2.5 right-4 z-10 pointer-events-none flex items-end">
                            <AnimeLogoImage
                                tmdbId={anime.id || anime.mal_id}
                                title={displayTitle}
                                year={anime.year}
                                episodes={anime.latestEpisode || anime.episodes}
                                format={anime.type}
                                anime={anime}
                                preferLogo
                                hideFallbackText
                                size="medium"
                                className="max-w-[85%] object-contain object-left drop-shadow-md"
                                style={{ maxHeight: '48px' }}
                            />
                        </div>
                    )}
                </div>

                {/* Top-Left Pastel Rank Badge */}
                {rank !== undefined && (
                    <RankBadge
                        rank={rank}
                        className="absolute -top-2 -left-2 z-30 pointer-events-none"
                    />
                )}

                {/* Top-Left Inverted Cutout Notch Badge */}
                {airingBadge && notch && (
                    <div className="absolute top-0 left-0 z-20 pointer-events-none">
                        <div
                            style={{ width: `${notch.width}px`, height: `${notch.height}px` }}
                            className="flex items-center justify-center pr-1 pb-0.5 text-white text-[11.5px] font-extrabold tracking-tight"
                        >
                            {airingBadge}
                        </div>
                    </div>
                )}

                {/* Top-Right Floating Action Button: Add to Watchlist (+) — hover-only on desktop */}
                <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1.5 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity duration-200">
                    <button
                        type="button"
                        onClick={handleToggleWatchlist}
                        aria-label={inWatchList ? 'Remove from Watchlist' : 'Add to Watchlist'}
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full backdrop-blur-md flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer border ${
                            inWatchList
                                ? 'bg-[#0596ff] text-white border-transparent'
                                : 'bg-black/60 hover:bg-black/80 text-white border-white/10'
                        }`}
                    >
                        {inWatchList ? (
                            <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3]" />
                        ) : (
                            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
                        )}
                    </button>
                </div>
            </div>

            {/* Title & Metadata below the image */}
            <div className="mt-2.5 pr-1">
                <h3 className="text-[15px] font-bold text-white leading-snug line-clamp-2 group-hover:text-[#0596ff] transition-colors">
                    {displayTitle}
                </h3>
                <div className="mt-1 flex items-center gap-1.5 text-[12.5px] font-semibold text-white/60">
                    {score !== null && (
                        <>
                            <span className="inline-flex items-center gap-1 text-white/80">
                                <svg className="w-3.5 h-3.5 text-white/75 fill-current -mt-0.5" viewBox="0 0 24 24">
                                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                                </svg>
                                {score.toFixed(1)}
                            </span>
                            <span>&middot;</span>
                        </>
                    )}
                    <span>{formatLabel}</span>
                    <span>&middot;</span>
                    <span>{year}</span>
                </div>
            </div>
        </div>
    );
};

export default AnimeLandscapeCard;

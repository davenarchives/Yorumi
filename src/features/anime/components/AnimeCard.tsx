import React from 'react';
import { m } from 'framer-motion';
import type { Anime } from '../../../types/anime';
import { useTitleLanguage } from '../../../context/TitleLanguageContext';
import { getDisplayTitle } from '../../../utils/titleLanguage';
import { getDisplayImageUrl } from '../../../utils/image';
import { cardItemVariants, pressMotion } from '../../../utils/motion';
import { animeService, parseStudios } from '../../../services/animeService';
import { getDisplayMetaLabel, isAnimeAiring } from '../../../utils/animeAiring';
import CCIcon from '../../../components/ui/CCIcon';

interface AnimeCardProps {
    anime: Anime;
    onClick: (anime: Anime) => void;
    onWatchClick?: (anime: Anime) => void;
    onMouseEnter?: (anime: Anime) => void;
    inList?: boolean;
    onToggleList?: (anime: Anime) => void;
    disableTilt?: boolean;
}

const AnimeCard: React.FC<AnimeCardProps> = ({
    anime,
    onClick,
    onMouseEnter,
    inList,
    onToggleList,
    disableTilt = false
}) => {
    const { language } = useTitleLanguage();
    const cardRef = React.useRef<HTMLDivElement>(null);
    const [rotation, setRotation] = React.useState({ x: 0, y: 0 });
    const [glare, setGlare] = React.useState({ x: 50, y: 50, opacity: 0 });
    const [isHovered, setIsHovered] = React.useState(false);
    const [popupSide, setPopupSide] = React.useState<'left' | 'right'>('right');
    const [hydratedAnime, setHydratedAnime] = React.useState<Anime | null>(null);
    const hydrateInFlight = React.useRef(false);
    const hydrateAttempted = React.useRef(false);
    const tooltipAnime = hydratedAnime ? mergeAnimeDetails(anime, hydratedAnime) : anime;

    const isUnreleased = tooltipAnime.status === 'NOT_YET_RELEASED';
    const episodeCount = isUnreleased ? null : (tooltipAnime.latestEpisode || tooltipAnime.episodes);
    const totalEpisodeCount = Number(tooltipAnime.episodes || 0) > 0 ? Number(tooltipAnime.episodes) : null;
    const displayTitle = getDisplayTitle(anime as unknown as Record<string, unknown>, language);
    const posterUrl = getDisplayImageUrl(anime.images.jpg.large_image_url || anime.images.jpg.image_url);
    const cardStudios = parseStudios(tooltipAnime.studios || (tooltipAnime as any).anilist?.studios);
    const cardProducers = parseStudios(tooltipAnime.producers || (tooltipAnime as any).anilist?.producers);
    const studioName = getCreditName(cardStudios?.[0]) || getCreditName(cardProducers?.[0]) || 'Studio TBA';
    const displayType = formatDisplayType(tooltipAnime.type);
    const primaryMetaLabel = getDisplayMetaLabel(tooltipAnime);
    const displayEpisodeCount = totalEpisodeCount || Number(tooltipAnime.latestEpisode || 0) || null;
    const episodeCountLabel = displayEpisodeCount
        ? `${displayEpisodeCount} episode${displayEpisodeCount === 1 ? '' : 's'}`
        : null;
    const formatLine = [
        displayType,
        episodeCountLabel,
    ].filter(Boolean);

    const updatePopupSide = React.useCallback(() => {
        if (typeof window === 'undefined' || !cardRef.current) {
            setPopupSide('right');
            return;
        }

        const rect = cardRef.current.getBoundingClientRect();
        const boundary = cardRef.current.closest('[data-hover-boundary]');
        const boundaryRect = boundary instanceof HTMLElement
            ? boundary.getBoundingClientRect()
            : { right: window.innerWidth - 16 };
        const availableRight = Math.min(window.innerWidth - 16, boundaryRect.right);
        const popupWidth = 280;
        const gap = 16;

        setPopupSide(rect.right + gap + popupWidth > availableRight ? 'left' : 'right');
    }, []);

    const hydrateTooltipDetails = React.useCallback(() => {
        if (hydrateInFlight.current || hydrateAttempted.current || !needsTooltipHydration(tooltipAnime)) return;

        const query = tooltipAnime.title_english || tooltipAnime.title_romaji || tooltipAnime.title || tooltipAnime.title_japanese;
        const directId = getAniListDetailsId(tooltipAnime);
        if (!directId && !query) return;

        hydrateInFlight.current = true;
        hydrateAttempted.current = true;

        (async () => {
            let details: Anime | null = null;

            if (directId) {
                const fast = await animeService.getAnimeDetailsFast(directId, tooltipAnime.type).catch(() => null);
                details = fast?.data || null;
            }

            if (!details && query) {
                const search = await animeService.searchAnime(String(query), 1, 6).catch(() => ({ data: [] as Anime[] }));
                const bestMatch = pickBestHydrationMatch(tooltipAnime, search.data || []);
                if (bestMatch?.id) {
                    const fast = await animeService.getAnimeDetailsFast(bestMatch.id, bestMatch.type || tooltipAnime.type).catch(() => null);
                    details = fast?.data || bestMatch;
                } else {
                    details = bestMatch || null;
                }
            }

            if (details) {
                setHydratedAnime(details);
            }
        })().finally(() => {
            hydrateInFlight.current = false;
        });
    }, [tooltipAnime]);

    React.useEffect(() => {
        setHydratedAnime(null);
        hydrateInFlight.current = false;
        hydrateAttempted.current = false;
    }, [anime.id, anime.mal_id, anime.scraperId, anime.title]);

    React.useEffect(() => {
        if (!isHovered) return;

        updatePopupSide();
        window.addEventListener('resize', updatePopupSide);

        return () => {
            window.removeEventListener('resize', updatePopupSide);
        };
    }, [isHovered, updatePopupSide]);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (disableTilt) {
            return;
        }
        if (!cardRef.current) return;

        const rect = cardRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = ((y - centerY) / centerY) * -12;
        const rotateY = ((x - centerX) / centerX) * 12;

        setRotation({ x: rotateX, y: rotateY });
        setGlare({
            x: (x / rect.width) * 100,
            y: (y / rect.height) * 100,
            opacity: 1
        });
    };

    const handleMouseLeave = () => {
        setIsHovered(false);

        if (disableTilt) {
            return;
        }

        setRotation({ x: 0, y: 0 });
        setGlare(prev => ({ ...prev, opacity: 0 }));
    };

    return (
        <m.div
            ref={cardRef}
            variants={cardItemVariants}
            initial="initial"
            animate="animate"
            whileTap={pressMotion}
            className="select-none cursor-pointer group relative z-0 hover:z-50"
            style={{ perspective: '1000px' }}
            onClick={() => onClick(anime)}
            onMouseEnter={(e) => {
                setIsHovered(true);
                updatePopupSide();
                onMouseEnter?.(anime);
                hydrateTooltipDetails();
                handleMouseMove(e);
            }}
            onMouseLeave={handleMouseLeave}
            onMouseMove={handleMouseMove}
        >
            <div
                className="relative aspect-[2/3] rounded-lg overflow-visible mb-3 shadow-lg ring-0 outline-none transition-all duration-75 ease-out"
                style={{
                    transform: disableTilt
                        ? 'none'
                        : `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) scale3d(${isHovered ? 1.05 : 1}, ${isHovered ? 1.05 : 1}, 1)`,
                    transformStyle: 'preserve-3d',
                    boxShadow: isHovered
                        ? '0 20px 40px -5px rgba(0,0,0,0.4), 0 10px 20px -5px rgba(0,0,0,0.2)'
                        : 'none'
                }}
            >
                <div className="relative h-full w-full overflow-hidden rounded-lg">
                    <div
                        className="absolute inset-0 z-30 pointer-events-none mix-blend-overlay transition-opacity duration-300"
                        style={{
                            background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,0.3) 0%, transparent 80%)`,
                            opacity: disableTilt ? 0 : glare.opacity
                        }}
                    />

                    <img
                        src={posterUrl}
                        alt={displayTitle}
                        className="w-full h-full object-cover"
                        loading="lazy"
                    />

                    <div className="absolute bottom-2 left-2 flex gap-1.5 z-10">
                        <span className="bg-white/20 backdrop-blur-sm text-white px-2 py-1 rounded text-xs font-bold">
                            {anime.type || 'TV'}
                        </span>
                        {episodeCount && (
                            <span className="bg-[#22c55e] text-white px-2 py-1 rounded text-xs font-bold flex items-center gap-1">
                                <CCIcon className="w-3 h-3" />
                                {episodeCount}
                            </span>
                        )}
                    </div>

                    {onToggleList && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleList(anime);
                            }}
                            className={`absolute bottom-2 right-2 z-10 flex h-10 w-10 items-center justify-center rounded-full transition-colors ${inList ? 'bg-yorumi-accent text-black hover:bg-yorumi-accent/80' : 'bg-[#1c2433]/90 text-white hover:bg-[#2b364a]'}`}
                            title={inList ? 'Remove from List' : 'Add to List'}
                        >
                            {inList ? (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                </svg>
                            )}
                        </button>
                    )}
                </div>

                {isHovered && (
                    <div className={`pointer-events-none absolute top-2 z-[60] hidden w-[280px] rounded-2xl bg-[#14233a] p-4 text-white shadow-[0_18px_40px_rgba(0,0,0,0.45)] lg:block ${popupSide === 'left' ? 'right-[calc(100%+16px)]' : 'left-[calc(100%+16px)]'}`}>
                        <div
                            className="absolute top-7 h-3 w-3 bg-[#14233a]"
                            style={popupSide === 'left'
                                ? { right: -8, clipPath: 'polygon(0 0, 100% 50%, 0 100%)' }
                                : { left: -8, clipPath: 'polygon(100% 0, 0 50%, 100% 100%)' }}
                        />

                        <div className="space-y-3">
                            <p className="truncate text-sm font-extrabold tracking-wide text-[#b9ddff]">
                                {primaryMetaLabel}
                            </p>

                            <p className="text-sm font-bold text-yorumi-accent line-clamp-1">
                                {studioName}
                            </p>

                            {formatLine.length > 0 && (
                                <p className="text-sm font-semibold text-[#9ed7ff]">
                                    {formatLine.map((item, index) => (
                                        <React.Fragment key={item}>
                                            {index > 0 && <span className="mx-1">&bull;</span>}
                                            {item}
                                        </React.Fragment>
                                    ))}
                                </p>
                            )}

                            {tooltipAnime.genres && tooltipAnime.genres.length > 0 && (
                                <div className="flex flex-wrap gap-2 pt-1">
                                    {tooltipAnime.genres.slice(0, 3).map((genre, index) => (
                                        <span key={`${getGenreName(genre)}-${index}`} className="rounded-full bg-yorumi-accent px-3 py-1 text-[11px] font-extrabold lowercase tracking-wide text-[#061523]">
                                            {getGenreName(genre)}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <h3 className="text-sm font-semibold text-gray-100 line-clamp-2 leading-tight group-hover:text-yorumi-accent transition-colors">
                {displayTitle}
            </h3>
        </m.div>
    );
};

function formatTimeUntil(seconds: number) {
    if (!Number.isFinite(seconds) || seconds <= 0) {
        return 'soon';
    }

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);

    if (days > 0) {
        return `in ${days} day${days === 1 ? '' : 's'}`;
    }

    if (hours > 0) {
        return `in ${hours} hour${hours === 1 ? '' : 's'}`;
    }

    const minutes = Math.max(1, Math.floor((seconds % 3600) / 60));
    return `in ${minutes} minute${minutes === 1 ? '' : 's'}`;
}

function getYearFromAired(value?: string) {
    const year = Number.parseInt(String(value || '').slice(0, 4), 10);
    return Number.isFinite(year) && year > 0 ? year : null;
}

function formatSeasonYearLabel(season?: string, year?: number | null) {
    const seasonName = season ? capitalize(season) : '';
    if (seasonName && year) return `${seasonName} ${year}`;
    if (year) return String(year);
    return seasonName;
}

function getGenreName(genre: NonNullable<Anime['genres']>[number] | string) {
    return typeof genre === 'string' ? genre : genre.name;
}

function getCreditName(credit?: any) {
    if (!credit) return '';
    if (typeof credit === 'string') return credit.trim();
    if (typeof credit === 'object') {
        if (credit.name) return String(credit.name).trim();
        if (credit.node?.name) return String(credit.node.name).trim();
    }
    return '';
}

function formatDisplayType(value?: string | null) {
    if (!value) return 'TV Show';
    if (value === 'TV') return 'TV Show';
    if (value === 'MOVIE') return 'Movie';
    return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function getStatusLabel(value?: string | null) {
    if (!value) return 'Details unavailable';

    switch (value) {
        case 'RELEASING':
            return 'Airing now';
        case 'FINISHED':
            return 'Completed';
        case 'NOT_YET_RELEASED':
            return 'Not yet released';
        default:
            return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
    }
}

function hasGenreChips(item: Anime) {
    return Array.isArray(item.genres) && item.genres.length > 0;
}

function hasStudioCredit(item: Anime) {
    const studios = parseStudios(item.studios || (item as any).anilist?.studios);
    const producers = parseStudios(item.producers || (item as any).anilist?.producers);
    return Boolean(getCreditName(studios?.[0]) || getCreditName(producers?.[0]));
}

function hasEpisodeTotal(item: Anime) {
    return Number(item.episodes || 0) > 0 || Number(item.latestEpisode || 0) > 0;
}

function needsTooltipHydration(item: Anime) {
    const needsAiringDetails = isAnimeAiring(item.status) && !item.nextAiringEpisode;
    return !hasGenreChips(item) || !hasStudioCredit(item) || !hasEpisodeTotal(item) || needsAiringDetails;
}

function getAniListDetailsId(item: Anime) {
    const id = Number(item.id || 0);
    return Number.isFinite(id) && id > 0 ? id : null;
}

function normalizeTitle(value: unknown) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function pickBestHydrationMatch(target: Anime, candidates: Anime[]) {
    const targetTitles = [
        target.title,
        target.title_english,
        target.title_romaji,
        target.title_japanese,
        ...(target.synonyms || []),
    ].map(normalizeTitle).filter(Boolean);

    if (targetTitles.length === 0) return null;

    const targetEpisodes = Number(target.episodes || target.latestEpisode || 0);
    const targetType = normalizeTitle(target.type);

    return candidates
        .filter((candidate) => Boolean(candidate.id || candidate.mal_id))
        .map((candidate) => {
            const candidateTitles = [
                candidate.title,
                candidate.title_english,
                candidate.title_romaji,
                candidate.title_japanese,
                ...(candidate.synonyms || []),
            ].map(normalizeTitle).filter(Boolean);

            let score = 0;
            candidateTitles.forEach((candidateTitle) => {
                targetTitles.forEach((targetTitle) => {
                    if (candidateTitle === targetTitle) {
                        score = Math.max(score, 100);
                    } else if (candidateTitle.includes(targetTitle) || targetTitle.includes(candidateTitle)) {
                        score = Math.max(score, 70);
                    }
                });
            });

            const candidateEpisodes = Number(candidate.episodes || candidate.latestEpisode || 0);
            if (targetEpisodes > 0 && candidateEpisodes > 0) {
                score += Math.max(0, 20 - Math.abs(candidateEpisodes - targetEpisodes));
            }

            if (targetType && normalizeTitle(candidate.type) === targetType) {
                score += 5;
            }

            return { candidate, score };
        })
        .sort((a, b) => b.score - a.score)
        .find((entry) => entry.score >= 60)?.candidate || null;
}

function mergeAnimeDetails(base: Anime, details: Anime): Anime {
    return {
        ...base,
        ...details,
        title: base.title || details.title,
        title_english: details.title_english || base.title_english,
        title_romaji: details.title_romaji || base.title_romaji,
        title_japanese: details.title_japanese || base.title_japanese,
        synonyms: details.synonyms?.length ? details.synonyms : base.synonyms,
        images: base.images || details.images,
        anilist_cover_image: base.anilist_cover_image || details.anilist_cover_image,
        anilist_banner_image: details.anilist_banner_image || base.anilist_banner_image,
        scraperId: base.scraperId || details.scraperId,
        episodeMetadata: base.episodeMetadata?.length ? base.episodeMetadata : details.episodeMetadata,
        genres: (details.genres && details.genres.length > 0) ? details.genres : base.genres,
        studios: (details.studios && details.studios.length > 0) ? details.studios : base.studios,
        producers: (details.producers && details.producers.length > 0) ? details.producers : base.producers,
        episodes: details.episodes ?? base.episodes,
        latestEpisode: details.latestEpisode ?? base.latestEpisode,
        nextAiringEpisode: details.nextAiringEpisode || base.nextAiringEpisode,
        status: details.status || base.status,
        type: details.type || base.type,
        year: details.year || base.year,
        season: details.season || base.season,
        aired: details.aired || base.aired,
    };
}

function capitalize(value: string) {
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

export default AnimeCard;

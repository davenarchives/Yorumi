import { useEffect, useState } from 'react';
import { Play, Plus, Check, Calendar, Heart, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Anime } from '../../../../types/anime';
import { useTitleLanguage } from '../../../../context/TitleLanguageContext';
import { getDisplayTitle } from '../../../../utils/titleLanguage';
import { isAnimeAiring, getAiringLabel } from '../../../../utils/animeAiring';
import { handleImageError } from '../../../../utils/image';
import { postJson } from '../../../../platform/nativeHttp';
import AnimeLogoImage from '../../../../components/anime/AnimeLogoImage';
import AnimeLandscapeCarousel from '../AnimeLandscapeCarousel';
import { SHOW_EPISODES_TAB_EVENT } from '../../../player/playerEvents';

interface DetailsInfoProps {
    anime: Anime;
    seasonsCount?: number;
    isLoading?: boolean;
    inList: boolean;
    inFavorites?: boolean;
    onWatch: () => void;
    onToggleList: () => void;
    onToggleFavorite?: () => void;
    onBack: () => void;
    statusPicker?: React.ReactNode;
    children?: React.ReactNode;
}

function ScoreRing({ score }: { score: number }) {
    const clamped = Math.max(0, Math.min(10, score));
    const radius = 15;
    const circumference = 2 * Math.PI * radius;
    const dashOffset = circumference * (1 - clamped / 10);

    return (
        <div className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center">
            <svg className="h-9 w-9 -rotate-90" viewBox="0 0 36 36">
                <circle
                    cx="18"
                    cy="18"
                    r={radius}
                    fill="rgba(0, 0, 0, 0.35)"
                    stroke="rgba(255, 255, 255, 0.16)"
                    strokeWidth="2.5"
                />
                <circle
                    cx="18"
                    cy="18"
                    r={radius}
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                />
            </svg>
            <span className="absolute text-[11.5px] font-extrabold tracking-tight text-white">
                {clamped.toFixed(1)}
            </span>
        </div>
    );
}

const getCompactAgeBadge = (rating?: string): string => {
    if (!rating) return '12';
    const r = rating.toUpperCase();
    if (r.includes('R+') || r.includes('RX') || r.includes('18')) return '18';
    if (r.includes('R - 17') || r.includes('R-17') || r.includes('TV-MA') || r.includes('17')) return '16';
    if (r.includes('PG-13') || r.includes('TV-14') || r.includes('13')) return '12';
    if (r.includes('PG')) return 'PG';
    if (r.includes('G')) return 'G';
    return '12';
};

const formatDetailedAiringCountdown = (anime: Anime): string | null => {
    const next = anime.nextAiringEpisode;
    if (next && Number(next.episode) > 0 && Number(next.timeUntilAiring) > 0) {
        const totalSeconds = Number(next.timeUntilAiring);
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        if (days > 0) {
            return `E${next.episode} in ${days}d ${hours}h`;
        }
        if (hours > 0) {
            const mins = Math.floor((totalSeconds % 3600) / 60);
            return `E${next.episode} in ${hours}h ${mins}m`;
        }
        return `E${next.episode} soon`;
    }
    if (isAnimeAiring(anime.status)) {
        return getAiringLabel(anime);
    }
    return null;
};

type DetailsTab = 'episodes' | 'cast' | 'related';

type AniListSimilarNode = {
    id: number;
    idMal?: number | null;
    title?: { english?: string | null; romaji?: string | null; native?: string | null };
    coverImage?: { extraLarge?: string | null; large?: string | null };
    bannerImage?: string | null;
    format?: string | null;
    status?: string | null;
    episodes?: number | null;
    seasonYear?: number | null;
    startDate?: { year?: number | null };
    averageScore?: number | null;
    genres?: string[] | null;
    isAdult?: boolean | null;
};

type AniListSimilarResponse = {
    data?: {
        Media?: {
            recommendations?: {
                nodes?: Array<{ mediaRecommendation?: AniListSimilarNode | null } | null>;
            };
        } | null;
        Page?: {
            media?: AniListSimilarNode[] | null;
        } | null;
    };
};

const similarAnimeCache = new Map<string, Anime[]>();
const ANILIST_SIMILAR_FIELDS = `
    id idMal
    title { english romaji native }
    coverImage { extraLarge large }
    bannerImage format status episodes seasonYear
    startDate { year }
    averageScore genres isAdult
`;

const normalizeFranchiseBase = (value?: string | null): string =>
    String(value || '')
        .toLowerCase()
        .replace(/\b(season\s*\d+|part\s*\d+|\d+(?:st|nd|rd|th)\s*season|final\s*season|the\s*movie|movie\s*\d*|ova|ona|specials?)\b/gi, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

const mapAniListNodeToAnime = (node: AniListSimilarNode): Anime => {
    const cover = node.coverImage?.extraLarge || node.coverImage?.large || '';
    return {
        id: node.id,
        mal_id: node.idMal || 0,
        source: 'anilist',
        title: node.title?.english || node.title?.romaji || node.title?.native || 'Unknown',
        title_english: node.title?.english || undefined,
        title_romaji: node.title?.romaji || undefined,
        title_japanese: node.title?.native || undefined,
        images: { jpg: { image_url: cover, large_image_url: cover } },
        anilist_cover_image: cover,
        anilist_banner_image: node.bannerImage || undefined,
        score: node.averageScore ? node.averageScore / 10 : 0,
        status: node.status || '',
        type: node.format || 'TV',
        episodes: node.episodes ?? null,
        year: node.seasonYear || node.startDate?.year || undefined,
        genres: (node.genres || []).map((name) => ({ name, mal_id: 0 })),
    } as Anime;
};

async function fetchSimilarGenreAnime(anime: Anime): Promise<Anime[]> {
    const anilistId = Number(anime.id || 0);
    const genreNames = (anime.genres || []).map((g) => g.name).filter(Boolean).slice(0, 4);
    const cacheKey = `${anilistId || anime.title}:${genreNames.join(',')}`;
    const cached = similarAnimeCache.get(cacheKey);
    if (cached) return cached;

    const excludedIds = new Set<number>();
    if (anilistId > 0) excludedIds.add(anilistId);
    (anime.relations?.edges || []).forEach((edge) => {
        if (edge?.node?.id) excludedIds.add(Number(edge.node.id));
    });

    const franchiseBases = new Set(
        [anime.title, anime.title_english, anime.title_romaji]
            .map((t) => normalizeFranchiseBase(t))
            .filter((t) => t.length >= 4)
    );

    const isSameFranchise = (node: AniListSimilarNode): boolean => {
        if (excludedIds.has(node.id)) return true;
        const candidates = [node.title?.english, node.title?.romaji]
            .map((t) => normalizeFranchiseBase(t))
            .filter((t) => t.length >= 4);
        for (const base of franchiseBases) {
            for (const cand of candidates) {
                if (cand === base || cand.startsWith(`${base} `) || base.startsWith(`${cand} `)) {
                    return true;
                }
            }
        }
        return false;
    };

    const collected: AniListSimilarNode[] = [];
    const seen = new Set<number>(excludedIds);
    const pushNode = (node?: AniListSimilarNode | null) => {
        if (!node?.id || node.isAdult || seen.has(node.id)) return;
        const fmt = String(node.format || '').toUpperCase();
        if (fmt === 'MANGA' || fmt === 'NOVEL' || fmt === 'ONE_SHOT' || fmt === 'MUSIC') return;
        if (isSameFranchise(node)) return;
        seen.add(node.id);
        collected.push(node);
    };

    try {
        if (anilistId > 0) {
            const recRes = await postJson<AniListSimilarResponse>('https://graphql.anilist.co', {
                query: `query ($id: Int!) { Media(id: $id, type: ANIME) { recommendations(perPage: 25, sort: RATING_DESC) { nodes { mediaRecommendation { ${ANILIST_SIMILAR_FIELDS} } } } } }`,
                variables: { id: anilistId },
            });
            (recRes?.data?.Media?.recommendations?.nodes || []).forEach((n) => pushNode(n?.mediaRecommendation));
        }
    } catch {
        // Fall through to genre-based recommendations
    }

    // Top up with close-genre matches if needed
    if (collected.length < 12 && genreNames.length > 0) {
        try {
            const genreRes = await postJson<AniListSimilarResponse>('https://graphql.anilist.co', {
                query: `query ($genres: [String!]) { Page(page: 1, perPage: 24) { media(type: ANIME, genre_in: $genres, sort: [SCORE_DESC, POPULARITY_DESC], isAdult: false) { ${ANILIST_SIMILAR_FIELDS} } } }`,
                variables: { genres: genreNames },
            });
            const genreSet = new Set(genreNames.map((g) => g.toLowerCase()));
            const genreCandidates = (genreRes?.data?.Page?.media || [])
                .filter((node): node is AniListSimilarNode => Boolean(node?.id))
                .sort((a, b) => {
                    const overlapA = (a.genres || []).filter((g) => genreSet.has(g.toLowerCase())).length;
                    const overlapB = (b.genres || []).filter((g) => genreSet.has(g.toLowerCase())).length;
                    if (overlapB !== overlapA) return overlapB - overlapA;
                    return (b.averageScore || 0) - (a.averageScore || 0);
                });
            genreCandidates.forEach((node) => pushNode(node));
        } catch {
            // Keep whatever recommendations we already collected
        }
    }

    const mapped = collected.slice(0, 16).map(mapAniListNodeToAnime);
    similarAnimeCache.set(cacheKey, mapped);
    return mapped;
}

export default function DetailsInfo({
    anime,
    seasonsCount = 1,
    isLoading = false,
    inList,
    inFavorites = false,
    onWatch,
    onToggleList,
    onToggleFavorite,
    onBack,
    statusPicker,
    children,
}: DetailsInfoProps) {
    const navigate = useNavigate();
    const { language } = useTitleLanguage();
    const [synopsisExpanded, setSynopsisExpanded] = useState(false);
    const [activeTab, setActiveTab] = useState<DetailsTab>('episodes');

    useEffect(() => {
        const showEpisodes = () => setActiveTab('episodes');
        window.addEventListener(SHOW_EPISODES_TAB_EVENT, showEpisodes);
        return () => window.removeEventListener(SHOW_EPISODES_TAB_EVENT, showEpisodes);
    }, []);
    const displayTitle = getDisplayTitle(anime as unknown as Record<string, unknown>, language);

    const year = anime.year || (anime.aired?.from ? new Date(anime.aired.from).getFullYear() : null);
    const isMovie = String(anime.type || '').toUpperCase() === 'MOVIE';
    const seasonOrFormatLabel = isMovie
        ? 'Movie'
        : seasonsCount > 1
            ? `${seasonsCount} seasons`
            : '1 season';

    const cleanSynopsis = (anime.synopsis || 'No synopsis available.')
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    const isLongSynopsis = cleanSynopsis.length > 185;
    const displayedSynopsis = !synopsisExpanded && isLongSynopsis
        ? `${cleanSynopsis.slice(0, 185).trimEnd()}...`
        : cleanSynopsis;

    const airingBadge = formatDetailedAiringCountdown(anime);
    const genres = (anime.genres || []).slice(0, 3);
    const posterUrl = anime.images?.jpg?.large_image_url
        || anime.images?.jpg?.image_url
        || anime.anilist_cover_image
        || '';

    const characters = anime.characters?.edges || [];
    const similarRequestKey = `${anime.id || anime.title}:${(anime.genres || []).map((g) => g.name).join(',')}`;
    const [similarState, setSimilarState] = useState<{ key: string; items: Anime[]; loading: boolean }>({
        key: '',
        items: [],
        loading: false,
    });

    useEffect(() => {
        if (activeTab !== 'related') return;
        if (similarState.key === similarRequestKey && !similarState.loading) return;
        let cancelled = false;
        setSimilarState((prev) => ({ key: similarRequestKey, items: prev.key === similarRequestKey ? prev.items : [], loading: true }));
        void fetchSimilarGenreAnime(anime).then((items) => {
            if (!cancelled) {
                setSimilarState({ key: similarRequestKey, items, loading: false });
            }
        }).catch(() => {
            if (!cancelled) {
                setSimilarState({ key: similarRequestKey, items: [], loading: false });
            }
        });
        return () => {
            cancelled = true;
        };
    }, [activeTab, anime, similarRequestKey, similarState.key, similarState.loading]);

    const similarAnime = similarState.key === similarRequestKey ? similarState.items : [];
    const similarLoading = similarState.key === similarRequestKey && similarState.loading;

    return (
        <div className="flex flex-col gap-7">
            {/* Hero Poster + Details Row */}
            <div className="flex flex-col sm:flex-row items-start gap-5 sm:gap-7 md:gap-9">
                {/* Portrait Poster with Bottom Logo Overlay (always pinned to top so expanding synopsis never moves it) */}
                <div className="relative invisible sm:visible w-32 sm:w-40 md:w-[190px] lg:w-[205px] aspect-[2/3] shrink-0 self-start">
                    <div className="relative h-full w-full overflow-hidden rounded-[16px] bg-[#121212] shadow-2xl shadow-black/70">
                        <img
                            key={anime.id || anime.mal_id || posterUrl}
                            src={posterUrl}
                            alt={displayTitle}
                            className="absolute inset-0 h-full w-full object-cover"
                            onError={(e) => handleImageError(e, displayTitle)}
                        />
                        <div
                            className="pointer-events-none absolute inset-x-0 bottom-0 h-[44%]"
                            style={{
                                background:
                                    'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.52) 55%, rgba(0,0,0,0.88) 100%)',
                            }}
                        />
                        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 flex items-end justify-center">
                            <AnimeLogoImage
                                anime={anime}
                                title={displayTitle}
                                size="small"
                                preferLogo
                                hideFallbackText
                                style={{ maxHeight: '42px' }}
                                className="!items-center max-w-[82%] object-contain object-center"
                            />
                        </div>
                    </div>
                </div>

                {/* Right Metadata + Synopsis + Actions */}
                <div className="flex min-w-0 flex-1 flex-col gap-3 pt-1 text-left">
                    {/* Anime Clearlogo or Title Fallback (compact height matching reference Details view) */}
                    <div className="max-w-md">
                        <AnimeLogoImage
                            anime={anime}
                            title={displayTitle}
                            size="small"
                            preferLogo
                            style={{ maxHeight: '72px' }}
                            className="max-w-[200px] sm:max-w-[230px] md:max-w-[250px] object-contain object-left"
                        />
                    </div>

                    {/* Score Ring • Year • Seasons • Age Rating */}
                    <div className="flex flex-wrap items-center gap-2.5 text-[14px] md:text-[15px] font-bold text-white/90">
                        {Number(anime.score) > 0 && (
                            <>
                                <ScoreRing score={Number(anime.score)} />
                                <span className="text-white/50">•</span>
                            </>
                        )}
                        {year && (
                            <>
                                <span>{year}</span>
                                <span className="text-white/50">•</span>
                            </>
                        )}
                        <span>{seasonOrFormatLabel}</span>
                        <span className="text-white/50">•</span>
                        <span className="rounded-[5px] bg-[#eb6b1c] px-2 py-0.5 text-[12px] font-extrabold leading-tight text-white">
                            {getCompactAgeBadge(anime.rating)}
                        </span>
                    </div>

                    {/* Synopsis with inline "more" / "less" */}
                    <div className="max-w-2xl text-[14px] md:text-[15.5px] font-medium leading-[1.55] text-white/90">
                        <p className="inline">{displayedSynopsis}</p>
                        {isLongSynopsis && (
                            <button
                                type="button"
                                onClick={() => setSynopsisExpanded((prev) => !prev)}
                                className="ml-1.5 inline font-extrabold text-white hover:underline border-0 outline-none focus:outline-none cursor-pointer"
                            >
                                {synopsisExpanded ? 'less' : 'more'}
                            </button>
                        )}
                    </div>

                    {/* Airing Countdown Pill + Genre Pills */}
                    {(airingBadge || genres.length > 0) && (
                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                            {airingBadge && (
                                <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.12] px-3.5 py-1.5 text-[13px] font-bold text-white">
                                    <Calendar className="h-3.5 w-3.5 text-white/80" />
                                    <span>{airingBadge}</span>
                                </span>
                            )}
                            {genres.map((genre) => (
                                <span
                                    key={genre.name}
                                    className="inline-flex items-center rounded-full bg-white/[0.12] px-3.5 py-1.5 text-[13px] font-bold text-white/90"
                                >
                                    {genre.name}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Action Buttons Row */}
                    <div className="flex flex-wrap items-center gap-2.5 pt-1">
                        <button
                            type="button"
                            onClick={onWatch}
                            disabled={isLoading}
                            className="flex h-11 items-center gap-2.5 rounded-full bg-white px-7 text-[15px] font-extrabold text-black transition-all hover:bg-white/90 active:scale-95 disabled:opacity-60 border-0 outline-none focus:outline-none cursor-pointer"
                        >
                            <Play className="h-4 w-4 fill-black text-black" />
                            <span>Play</span>
                        </button>

                        <div className="relative">
                            <button
                                type="button"
                                onClick={onToggleList}
                                disabled={isLoading}
                                className={`flex h-11 items-center gap-2 rounded-full px-5 text-[14.5px] font-bold transition-colors border-0 outline-none focus:outline-none cursor-pointer ${
                                    inList
                                        ? 'bg-white/[0.22] text-white hover:bg-white/[0.28]'
                                        : 'bg-white/[0.12] text-white hover:bg-white/[0.18]'
                                }`}
                            >
                                {inList ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                <span>Watchlist</span>
                            </button>
                            {statusPicker}
                        </div>

                        {onToggleFavorite && (
                            <button
                                type="button"
                                onClick={onToggleFavorite}
                                title={inFavorites ? 'Remove from favorites' : 'Add to favorites'}
                                aria-label={inFavorites ? 'Remove from favorites' : 'Add to favorites'}
                                className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors border-0 outline-none focus:outline-none cursor-pointer ${
                                    inFavorites
                                        ? 'bg-rose-500/25 text-rose-400 hover:bg-rose-500/35'
                                        : 'bg-white/[0.12] text-white hover:bg-white/[0.18]'
                                }`}
                            >
                                <Heart className={`h-4 w-4 ${inFavorites ? 'fill-current' : ''}`} />
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={onBack}
                            title="Go back"
                            aria-label="Go back"
                            className="hidden sm:flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.12] text-white transition-colors hover:bg-white/[0.18] border-0 outline-none focus:outline-none cursor-pointer"
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Section Tabs Row */}
            <div className="flex items-center gap-7 pt-2">
                {(
                    [
                        { key: 'episodes', label: 'Episodes' },
                        { key: 'cast', label: 'Cast' },
                        { key: 'related', label: 'More like this' },
                    ] as const
                ).map((tab) => {
                    const isActive = activeTab === tab.key;
                    return (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setActiveTab(tab.key)}
                            className={`text-[15px] font-extrabold transition-colors border-0 outline-none focus:outline-none cursor-pointer ${
                                isActive ? 'text-white' : 'text-white/50 hover:text-white/85'
                            }`}
                        >
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab Content */}
            <div className="w-full">
                <div className={activeTab === 'episodes' ? 'block' : 'hidden'}>
                    {children}
                </div>

                {activeTab === 'cast' && (
                    <div className="pt-2">
                        {characters.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {characters.slice(0, 16).map((edge, idx) => {
                                    const char = edge.node;
                                    const va = edge.voiceActors?.[0];
                                    return (
                                        <div
                                            key={`${char.id}-${idx}`}
                                            className="flex items-center justify-between gap-3 rounded-[14px] bg-white/[0.06] p-3"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                {char.image?.large ? (
                                                    <img
                                                        src={char.image.large}
                                                        alt={char.name?.full}
                                                        className="h-14 w-14 shrink-0 rounded-full object-cover bg-[#181818]"
                                                        loading="lazy"
                                                    />
                                                ) : (
                                                    <div className="h-14 w-14 shrink-0 rounded-full bg-[#161a29] flex flex-col items-center justify-center text-[10px] font-extrabold text-[#3b82f6] tracking-tight leading-tight select-none">
                                                        <span>NO</span>
                                                        <span>IMAGE</span>
                                                    </div>
                                                )}
                                                <div className="min-w-0">
                                                    <div className="truncate text-sm font-bold text-white">
                                                        {char.name?.full}
                                                    </div>
                                                    <div className="text-xs font-semibold text-white/50 capitalize">
                                                        {String(edge.role || 'Character').toLowerCase()}
                                                    </div>
                                                </div>
                                            </div>
                                            {va && (
                                                <div className="flex items-center gap-2.5 min-w-0 text-right">
                                                    <div className="min-w-0 hidden sm:block">
                                                        <div className="truncate text-xs font-bold text-white/90">
                                                            {va.name?.full}
                                                        </div>
                                                        <div className="text-[11px] font-semibold text-white/45">
                                                            {va.languageV2 || 'Japanese'}
                                                        </div>
                                                    </div>
                                                    {va.image?.large ? (
                                                        <img
                                                            src={va.image.large}
                                                            alt={va.name?.full}
                                                            className="h-12 w-12 shrink-0 rounded-full object-cover bg-[#181818]"
                                                            loading="lazy"
                                                        />
                                                    ) : (
                                                        <div className="h-12 w-12 shrink-0 rounded-full bg-[#161a29] flex flex-col items-center justify-center text-[9px] font-extrabold text-[#3b82f6] tracking-tight leading-tight select-none">
                                                            <span>NO</span>
                                                            <span>IMAGE</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="py-8 text-sm font-semibold text-white/50">No cast information available.</p>
                        )}
                    </div>
                )}

                {activeTab === 'related' && (
                    <div className="pt-2">
                        {similarLoading && similarAnime.length === 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-2 animate-pulse">
                                {Array.from({ length: 4 }).map((_, idx) => (
                                    <div key={idx} className="space-y-2">
                                        <div className="aspect-video w-full rounded-xl bg-white/10" />
                                        <div className="h-4 w-3/4 rounded bg-white/10" />
                                    </div>
                                ))}
                            </div>
                        ) : similarAnime.length > 0 ? (
                            <AnimeLandscapeCarousel
                                title="More like this"
                                animeList={similarAnime}
                                columns={4}
                                onAnimeClick={(item) => {
                                    if (item.id) navigate(`/anime/details/al-${item.id}`);
                                }}
                            />
                        ) : (
                            <p className="py-8 text-sm font-semibold text-white/50">No similar titles available.</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

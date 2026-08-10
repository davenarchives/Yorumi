import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAnime } from '../hooks/useAnime';
import { useWatchList } from '../hooks/useWatchList';
import { useFavoriteAnime } from '../hooks/useFavoriteAnime';
import { useDownloads } from '../hooks/useDownloads';
import { isDownloadTitleMatch } from '../services/downloadService';
import type { Anime, Episode } from '../types/anime';
import type { WatchListItem } from '../utils/storage';
import { animeService } from '../services/animeService';
import { tmdbService, type TmdbSeason, type TmdbEpisode } from '../services/tmdbService';
import { setLocalStorageWithCleanup } from '../utils/localStorageQuota';
import { getEpisodeWatchKey, getPlaybackEpisodeNumber } from '../utils/episodeWatchKey';
// Feature Components
import DetailsHero from '../features/anime/components/details/DetailsHero';
import DetailsInfo from '../features/anime/components/details/DetailsInfo';
import DetailsEpisodeGrid, { type NormalizedEpisode, type SeasonChip } from '../features/anime/components/details/DetailsEpisodeGrid';
import DetailsVideoPlayer from '../features/anime/components/details/DetailsVideoPlayer';

const isMovieAnime = (anime: Partial<Anime> | null | undefined) =>
    String(anime?.type || '').toUpperCase() === 'MOVIE';

const buildInstantEpisodes = (anime: Anime | null, maxEpisodes?: number): NormalizedEpisode[] => {
    if (!anime) return [];

    const metadata = Array.isArray(anime.episodeMetadata) ? anime.episodeMetadata : [];
    const metadataEpisodes = metadata.map((item, index): NormalizedEpisode => {
        const match = item.title?.match(/Episode\s+(\d+(?:\.\d+)?)/i);
        const episodeNumber = match?.[1] || String(index + 1);
        let title = item.title?.replace(/^Episode\s+\d+(?:\.\d+)?\s*[-:]?\s*/i, '').trim() || `Episode ${episodeNumber}`;
        title = title.split('<note-split>')[0].trim();

        return {
            session: `instant:${episodeNumber}`,
            episodeNumber,
            title,
            thumbnail: item.thumbnail,
            snapshot: item.thumbnail,
            playbackEpisodeNumber: Number(episodeNumber),
        };
    });
    if (isMovieAnime(anime)) {
        const movieMeta = metadataEpisodes[0] || {};
        return [{
            session: movieMeta.session || `movie:1`,
            episodeNumber: '1',
            title: anime.title_english || anime.title || anime.title_romaji || anime.title_japanese || 'Movie',
            thumbnail: movieMeta.thumbnail || anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || anime.anilist_cover_image,
            snapshot: movieMeta.snapshot || anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || anime.anilist_cover_image,
            playbackEpisodeNumber: 1,
        }];
    }

    const latestEpisode = Number(anime.latestEpisode || 0);
    const totalEpisodes = Number(anime.episodes || 0);
    const rawCount = Math.max(
        metadataEpisodes.length,
        Number.isFinite(latestEpisode) ? latestEpisode : 0,
        Number.isFinite(totalEpisodes) ? totalEpisodes : 0
    );
    // If a maxEpisodes cap is provided (e.g. current season's episode count), respect it
    // to prevent placeholder episodes from bleeding across multi-season shows during async TMDB resolution.
    const expectedCount = Math.min(
        1500,
        maxEpisodes && maxEpisodes > 0 ? Math.min(rawCount, maxEpisodes) : rawCount
    );

    if (expectedCount <= 0) return metadataEpisodes;

    const byEpisodeNumber = new Map(metadataEpisodes.map((episode) => [episode.episodeNumber, episode]));
    return Array.from({ length: expectedCount }, (_, index) => {
        const episodeNumber = String(index + 1);
        return byEpisodeNumber.get(episodeNumber) || {
            session: isMovieAnime(anime) ? `movie:${episodeNumber}` : `instant:${episodeNumber}`,
            episodeNumber,
            title: isMovieAnime(anime)
                ? anime.title_english || anime.title || anime.title_romaji || anime.title_japanese || 'Movie'
                : `Episode ${episodeNumber}`,
            thumbnail: isMovieAnime(anime)
                ? anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || anime.anilist_cover_image
                : undefined,
            snapshot: isMovieAnime(anime)
                ? anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || anime.anilist_cover_image
                : undefined,
            playbackEpisodeNumber: index + 1,
        };
    });
};

const normalizeScraperEpisodes = (items: Episode[]): NormalizedEpisode[] =>
    items.map((episode) => {
        const episodeNumber = String(episode.episodeNumber || '').trim() || '1';
        let title = episode.title && episode.title.trim().toLowerCase() !== 'untitled'
            ? episode.title.trim()
            : `Episode ${episodeNumber}`;
        title = title.split('<note-split>')[0].trim();
        const playbackEpisodeNumber = Number(episode._tmdbAbsolute || episodeNumber);

        return {
            ...episode,
            episodeNumber,
            title,
            thumbnail: episode.snapshot,
            playbackEpisodeNumber: Number.isFinite(playbackEpisodeNumber) && playbackEpisodeNumber > 0
                ? playbackEpisodeNumber
                : Number(episodeNumber),
        };
    });

type RelationNode = NonNullable<Anime['relations']>['edges'][number]['node'];

const ANILIST_SEASON_CHAIN_CACHE_PREFIX = 'yorumi_anilist_season_chain_v1';
const ANILIST_SEASON_CHAIN_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

type SeasonChainCachePayload = {
    timestamp: number;
    items: Anime[];
};

const getSeasonTitle = (item: Partial<Anime>) =>
    item.title_english || item.title || item.title_romaji || item.title_japanese || 'Unknown';

const getExplicitSeasonNumber = (item: Partial<Anime>) => {
    const title = getSeasonTitle(item);
    const match =
        title.match(/\bseason\s*(\d+)\b/i) ||
        title.match(/\b(\d+)(st|nd|rd|th)\s*season\b/i);
    return match ? Number(match[1]) : 0;
};

const getExplicitUnitNumber = (item: Partial<Anime>, unit: 'cour' | 'part') => {
    const title = getSeasonTitle(item);
    const match =
        title.match(new RegExp(`\\b${unit}\\s*(\\d+)\\b`, 'i')) ||
        title.match(new RegExp(`\\b(\\d+)(st|nd|rd|th)\\s*${unit}\\b`, 'i'));
    return match ? Number(match[1]) : 0;
};

const hasReleaseUnit = (item: Partial<Anime>, unit: 'cour' | 'part') =>
    new RegExp(`\\b${unit}\\b`, 'i').test(getSeasonTitle(item));

const isMainSeriesSeason = (item: Partial<Anime>) => {
    const format = String(item.type || '').toUpperCase();
    return format === 'TV' || format === 'TV_SHORT' || format === 'ONA';
};

const getSeasonSortDate = (item: Partial<Anime>) => {
    const year = Number(item.year || item.aired?.from?.slice(0, 4) || 0);
    const month = Number(item.aired?.from?.slice(5, 7) || 0);
    return { year: year > 0 ? year : 9999, month };
};

const getMeaningfulTmdbSeasonLabel = (season: TmdbSeason) => {
    const fallbackName = `Season ${season.season_number}`;
    const name = String(season.name || '').trim();
    if (!name || /^season\s*\d+$/i.test(name)) return fallbackName;
    return name;
};

const mapRelationNodeToAnime = (node: RelationNode): Anime => {
    const year = Number(node.seasonYear || node.startDate?.year || 0);
    const month = Number(node.startDate?.month || 0);
    const day = Number(node.startDate?.day || 0);
    const from = year > 0
        ? `${year}-${String(month || 1).padStart(2, '0')}-${String(day || 1).padStart(2, '0')}`
        : undefined;

    return {
        mal_id: node.id,
        id: node.id,
        title: node.title.english || node.title.romaji || node.title.native || 'Unknown',
        title_english: node.title.english,
        title_romaji: node.title.romaji,
        title_japanese: node.title.native,
        images: {
            jpg: {
                image_url: node.coverImage.large,
                large_image_url: node.coverImage.large,
            },
        },
        score: 0,
        status: node.status || 'Unknown',
        type: node.format,
        episodes: node.episodes ?? null,
        year: year || undefined,
        season: node.season?.toLowerCase(),
        aired: {
            from,
            string: year ? String(year) : undefined,
        },
    };
};

const getRelatedSeasonCandidates = (anime: Anime) =>
    (anime.relations?.edges || [])
        .filter((edge) => {
            const relation = String(edge.relationType || '').toUpperCase();
            const format = String(edge.node.format || '').toUpperCase();
            return (relation === 'PREQUEL' || relation === 'SEQUEL') && (format === 'TV' || format === 'TV_SHORT' || format === 'ONA');
        })
        .map((edge) => mapRelationNodeToAnime(edge.node));

const getSeasonChainCacheKey = (animeId: number) => `${ANILIST_SEASON_CHAIN_CACHE_PREFIX}:${animeId}`;

const readSeasonChainCache = (animeId: number): Anime[] | null => {
    if (!animeId) return null;

    try {
        const raw = localStorage.getItem(getSeasonChainCacheKey(animeId));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as SeasonChainCachePayload;
        if (!parsed?.timestamp || !Array.isArray(parsed.items)) return null;
        if (Date.now() - parsed.timestamp > ANILIST_SEASON_CHAIN_CACHE_TTL) {
            localStorage.removeItem(getSeasonChainCacheKey(animeId));
            return null;
        }

        return parsed.items.filter((item) => Number(item.id || 0) > 0 && isMainSeriesSeason(item));
    } catch {
        return null;
    }
};

const writeSeasonChainCache = (items: Anime[]) => {
    const validItems = items.filter((item) => Number(item.id || 0) > 0 && isMainSeriesSeason(item));
    if (validItems.length === 0) return;

    const payload = JSON.stringify({ timestamp: Date.now(), items: validItems } satisfies SeasonChainCachePayload);
    validItems.forEach((item) => {
        const id = Number(item.id || 0);
        if (id > 0) {
            setLocalStorageWithCleanup(getSeasonChainCacheKey(id), payload);
        }
    });
};

const buildSeasonChips = (items: Anime[], activeId: number): SeasonChip[] => {
    const deduped = Array.from(
        items.reduce((map, item) => {
            const id = Number(item.id || 0);
            if (id > 0 && isMainSeriesSeason(item) && !map.has(id)) {
                map.set(id, item);
            }
            return map;
        }, new Map<number, Anime>()).values()
    );

    const ordered = deduped.sort((a, b) => {
        const aSeason = getExplicitSeasonNumber(a);
        const bSeason = getExplicitSeasonNumber(b);
        if (aSeason > 0 && bSeason > 0 && aSeason !== bSeason) return aSeason - bSeason;

        const aDate = getSeasonSortDate(a);
        const bDate = getSeasonSortDate(b);
        if (aDate.year !== bDate.year) return aDate.year - bDate.year;
        if (aDate.month !== bDate.month) return aDate.month - bDate.month;

        return getSeasonTitle(a).localeCompare(getSeasonTitle(b));
    });

    let currentSeason = 0;
    let offset = 0;

    return ordered.map((item, index) => {
        const explicitSeason = getExplicitSeasonNumber(item);
        const courNumber = getExplicitUnitNumber(item, 'cour');
        const partNumber = getExplicitUnitNumber(item, 'part');
        const isCour = hasReleaseUnit(item, 'cour');
        const isPart = hasReleaseUnit(item, 'part');
        const isContinuationUnit = isCour || isPart;

        if (explicitSeason > 0) {
            currentSeason = explicitSeason;
        } else if (index === 0) {
            currentSeason = 1;
        } else if (!isContinuationUnit) {
            currentSeason += 1;
        }

        const suffix = [
            isCour ? `Cour ${courNumber || 1}` : '',
            isPart ? `Part ${partNumber || 1}` : '',
        ].filter(Boolean).join(' ');
        const id = Number(item.id || 0);

        const count = item.episodes || 12; // Fallback to 12 if AniList doesn't know
        const currentOffset = offset;
        offset += count;

        return {
            id,
            label: `Season ${currentSeason}${suffix ? ` ${suffix}` : ''}`,
            title: getSeasonTitle(item),
            isActive: id === activeId,
            source: 'anilist',
            offset: currentOffset,
            count,
            anime: item
        };
    });
};

const buildTmdbSeasonChips = (tmdbSeasons: TmdbSeason[], activeSeasonNumber: number | null): SeasonChip[] => {
    const tmdbOrdered = [...tmdbSeasons]
        .filter((season) => Number(season.season_number) > 0)
        .sort((a, b) => Number(a.season_number) - Number(b.season_number));

    let currentOffset = 0;

    return tmdbOrdered.map((season): SeasonChip => {
        const count = season.episode_count || 0;
        const offset = currentOffset;
        currentOffset += count;
        const fallbackName = `Season ${season.season_number}`;
        const label = getMeaningfulTmdbSeasonLabel(season);

        return {
            id: season.id || season.season_number,
            label,
            title: season.name || fallbackName,
            isActive: season.season_number === activeSeasonNumber,
            source: 'tmdb',
            tmdbSeasonNumber: season.season_number,
            offset,
            count
        };
    });
};

const readRouteSeasonChips = (value: unknown, activeId: number): SeasonChip[] => {
    if (!Array.isArray(value)) return [];

    return value
        .map((item): SeasonChip | null => {
            if (!item || typeof item !== 'object') return null;
            const record = item as Partial<SeasonChip>;
            const id = Number(record.id || 0);
            const label = String(record.label || '').trim();
            if (!id || !label) return null;

            return {
                id,
                label,
                title: String(record.title || label),
                isActive: id === activeId,
                source: record.source === 'tmdb' ? 'tmdb' : 'anilist',
                tmdbSeasonNumber: record.tmdbSeasonNumber,
                anime: record.anime as Anime,
                anilistId: record.anilistId,
                offset: record.offset,
                count: record.count,
            };
        })
        .filter((item): item is SeasonChip => Boolean(item));
};

export default function AnimeDetailsPage() {
    const { id } = useParams<{ id: string }>();
    return <AnimeDetailsPageContent />;
}

function AnimeDetailsPageContent() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [searchParams, setSearchParams] = useSearchParams();
    const location = useLocation();
    const animeHook = useAnime();
    const { selectedAnime, episodes, epLoading, episodesResolved, episodesBackgroundLoading, detailsLoading, error, watchedEpisodes, toggleEpisodeComplete } = animeHook;
    const { downloads } = useDownloads();
    const handleAnimeClickRef = useRef(animeHook.handleAnimeClick);
    const breadcrumbParent = typeof location.state?.breadcrumbParent === 'string'
        ? location.state.breadcrumbParent
        : undefined;
    const toPositiveNumber = (value: unknown): number => {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    };
    const isAnimePaheSession = (value: unknown) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || '').trim());
    const updateSearchParams = (params: Record<string, string>) => {
        setSearchParams(params, { state: location.state });
    };
    const getTmdbRouteId = (anime: Partial<Anime> | null | undefined) => {
        const tmdbAnime = anime as (Partial<Anime> & { tmdbId?: unknown; tmdb_id?: unknown }) | null | undefined;
        const tmdbId = toPositiveNumber(tmdbAnime?.tmdbId ?? tmdbAnime?.tmdb_id);
        return tmdbId ? `tmdb-${tmdbId}` : '';
    };

    useEffect(() => {
        handleAnimeClickRef.current = animeHook.handleAnimeClick;
    }, [animeHook.handleAnimeClick]);

    // We need to sync the URL ID with the hook's selectedAnime
    useEffect(() => {
        // Scroll to top on mount unless explicitly prevented (e.g. season navigation or expanding mini player)
        if (!location.state?.preventScrollTop) {
            window.scrollTo({ top: 0, behavior: 'auto' });
        } else if (searchParams.get('ep')) {
            scrollToPlayer();
        }

        if (!id) return;
        if (id.startsWith('vault-anime:')) return;

        const routeAnime = (location.state?.anime && typeof location.state.anime === 'object')
            ? { ...(location.state.anime as Anime) }
            : null;

        if (id.startsWith('tmdb-')) {
            const tmdbId = id.substring(5).trim();
            if (!tmdbId) {
                navigate('/', { replace: true });
                return;
            }
            const seededTmdbId = Number.parseInt(tmdbId, 10);
            
            if (routeAnime && routeAnime.title) {
                handleAnimeClickRef.current({
                    ...routeAnime,
                    id: 0,
                    mal_id: 0,
                    tmdbId: seededTmdbId
                } as unknown as Anime);
            } else {
                // If opened in new tab, try to fetch TMDB details to get the title
                tmdbService.getTvDetailsForAnime({ tmdbId: seededTmdbId } as unknown as Anime)
                    .then((details) => {
                        if (details?.name || details?.original_name) {
                            handleAnimeClickRef.current({
                                title: details.name || details.original_name || 'Unknown',
                                id: 0,
                                mal_id: 0,
                                tmdbId: seededTmdbId,
                                year: details.first_air_date ? Number.parseInt(details.first_air_date.substring(0, 4), 10) : undefined,
                                images: { jpg: { image_url: '', large_image_url: '' } }
                            } as unknown as Anime);
                        } else {
                            navigate('/', { replace: true });
                        }
                    })
                    .catch(() => {
                        navigate('/', { replace: true });
                    });
            }
            return;
        }

        if (id.startsWith('s:')) {
            const scraperSession = id.substring(2).trim();
            if (!scraperSession) {
                navigate('/', { replace: true });
                return;
            }
            const fallbackTitle = routeAnime?.title || scraperSession.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();

            handleAnimeClickRef.current({
                ...(routeAnime || {}),
                id: routeAnime?.id || 0,
                mal_id: routeAnime?.mal_id || 0,
                scraperId: scraperSession,
                title: fallbackTitle,
                images: routeAnime?.images || { jpg: { image_url: '', large_image_url: '' } }
            } as Anime);
            return;
        }

        const parsedId = Number.parseInt(id, 10);
        if (Number.isFinite(parsedId) && parsedId > 0) {
            const seededAnilistId = toPositiveNumber(routeAnime?.id) || parsedId;
            const seededMalId = toPositiveNumber(routeAnime?.mal_id) || parsedId;
            handleAnimeClickRef.current({
                ...(routeAnime || {}),
                id: seededAnilistId,
                mal_id: seededMalId
            } as Anime);
        } else if (routeAnime || location.state?.fromDownloads || id) {
            const fallbackTitle = routeAnime?.title || location.state?.animeTitle || id.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
            handleAnimeClickRef.current({
                ...(routeAnime || {}),
                id: routeAnime?.id || 0,
                mal_id: routeAnime?.mal_id || 0,
                scraperId: id,
                title: fallbackTitle,
                images: routeAnime?.images || { jpg: { image_url: '', large_image_url: '' } }
            } as Anime);
        } else {
            navigate('/', { replace: true });
        }
    }, [id, location.state, navigate]);

    const { isInWatchList, addToWatchList, removeFromWatchList } = useWatchList();
    const { isFavorite, addFavorite, removeFavorite } = useFavoriteAnime();
    const activeSeasonId = Number(selectedAnime?.id || 0);
    const initialSeasonChips = useMemo(
        () => selectedAnime ? buildSeasonChips([selectedAnime, ...getRelatedSeasonCandidates(selectedAnime)], activeSeasonId) : [],
        [activeSeasonId, selectedAnime]
    );
    const instantEpisodes = useMemo(() => {
        // Determine the cap for placeholder episodes based on the active season chip.
        // This prevents merged episodes across seasons while TMDB resolves asynchronously.
        // We use initialSeasonChips (synchronously available) to find the active chip's count.
        const activeInitialChip = initialSeasonChips.find((chip) => chip.id === activeSeasonId);
        const instantMaxEpisodes = activeInitialChip && activeInitialChip.count && initialSeasonChips.length > 1
            ? activeInitialChip.count
            : undefined;
        return buildInstantEpisodes(selectedAnime, instantMaxEpisodes);
    }, [selectedAnime, initialSeasonChips, activeSeasonId]);
    const routeSeasonChips = useMemo(
        () => readRouteSeasonChips(location.state?.seasonChips, activeSeasonId),
        [activeSeasonId, location.state]
    );
    const [resolvedSeasonChips, setResolvedSeasonChips] = useState<{ activeId: number; chips: SeasonChip[] } | null>(null);
    const [tmdbSeasonChips, setTmdbSeasonChips] = useState<{ activeId: number; tmdbId: number; chips: SeasonChip[] } | null>(null);
    const [tmdbDetailsState, setTmdbDetailsState] = useState<{ activeId: number; tmdbId: number; seasons: TmdbSeason[] } | null>(null);
    const selectedExplicitSeason = selectedAnime ? getExplicitSeasonNumber(selectedAnime) : 0;
    const hasCompleteRouteSeasonChips =
        routeSeasonChips.some((season) => season.source === 'tmdb') &&
        routeSeasonChips.some((season) => season.id === activeSeasonId) &&
        (selectedExplicitSeason <= 0 || routeSeasonChips.length >= selectedExplicitSeason);
    const hasIncompleteInitialSeasonChips =
        selectedExplicitSeason > 1 &&
        initialSeasonChips.length > 1 &&
        initialSeasonChips.length < selectedExplicitSeason;
    const resolvedChips = resolvedSeasonChips?.activeId === activeSeasonId ? resolvedSeasonChips.chips : [];
    const tmdbChips = tmdbSeasonChips?.activeId === activeSeasonId ? tmdbSeasonChips.chips : [];
    const tmdbDetails = tmdbDetailsState?.activeId === activeSeasonId ? tmdbDetailsState : null;
    const hasMultipleTmdbSeasons = (tmdbDetails?.seasons.length || 0) > 1;
    const virtualSeasonChips = !hasMultipleTmdbSeasons && (tmdbDetails?.seasons.length || 0) === 1 && resolvedChips.length > 1
        ? resolvedChips.map((chip) => ({
            ...chip,
            source: 'anilist' as const,
            isVirtual: true,
            tmdbSeasonNumber: 1,
            isActive: chip.id === activeSeasonId,
        }))
        : [];

    const seasonChips = hasMultipleTmdbSeasons && tmdbChips.length > 0
        ? tmdbChips
        : virtualSeasonChips.length > 0
            ? virtualSeasonChips
            : resolvedChips.length > 0
                ? resolvedChips
                : hasCompleteRouteSeasonChips
                    ? routeSeasonChips
                    : hasIncompleteInitialSeasonChips
                        ? initialSeasonChips
                        : initialSeasonChips;

    const [tmdbEpisodesState, setTmdbEpisodesState] = useState<{ key: string; episodes: TmdbEpisode[]; loading: boolean }>({
        key: '',
        episodes: [],
        loading: false,
    });
    const [selectedTmdbSeason, setSelectedTmdbSeason] = useState<{ activeId: number; seasonNumber: number } | null>(null);
    const selectedTmdbSeasonNumber = selectedTmdbSeason?.activeId === activeSeasonId
        ? selectedTmdbSeason.seasonNumber
        : null;

    const fallbackTmdbSeasonNumber = virtualSeasonChips.length > 0
        ? 1
        : tmdbChips.find(c => c.tmdbSeasonNumber === selectedExplicitSeason)?.tmdbSeasonNumber
            ?? tmdbChips[0]?.tmdbSeasonNumber;

    const activeTmdbSeasonNumber = virtualSeasonChips.length > 0
        ? 1
        : selectedTmdbSeasonNumber
        ?? seasonChips.find(c => c.isActive && c.source === 'tmdb')?.tmdbSeasonNumber
        ?? fallbackTmdbSeasonNumber;

    const displayChips = seasonChips.map((chip) => {
        if (chip.source === 'tmdb') {
            return { ...chip, isActive: chip.tmdbSeasonNumber === activeTmdbSeasonNumber };
        }
        return chip;
    });
    const activeDisplayChip = displayChips.find((chip) => chip.isActive);
    const requestedTmdbSeasonNumber = activeDisplayChip?.tmdbSeasonNumber ?? activeTmdbSeasonNumber ?? null;

    const tmdbEpisodesKey = tmdbDetails?.tmdbId && requestedTmdbSeasonNumber
        ? `${tmdbDetails.tmdbId}:${requestedTmdbSeasonNumber}`
        : '';
    const cachedTmdbEpisodes = tmdbDetails?.tmdbId && requestedTmdbSeasonNumber
        ? tmdbService.getCachedTvSeasonEpisodes(tmdbDetails.tmdbId, requestedTmdbSeasonNumber)
        : null;
    const tmdbEpisodes = tmdbEpisodesState.key === tmdbEpisodesKey
        ? tmdbEpisodesState.episodes
        : (cachedTmdbEpisodes || []);
    const tmdbEpisodesLoading = Boolean(tmdbEpisodesKey) && !cachedTmdbEpisodes && (
        tmdbEpisodesState.key !== tmdbEpisodesKey || tmdbEpisodesState.loading
    );

    useEffect(() => {
        const tmdbId = tmdbDetails?.tmdbId;
        const seasonNumber = requestedTmdbSeasonNumber;
        if (!tmdbId || !seasonNumber) return;

        let cancelled = false;
        tmdbService.getTvSeasonEpisodes(tmdbId, seasonNumber)
            .then((episodesResult) => {
                if (!cancelled) setTmdbEpisodesState({ key: tmdbEpisodesKey, episodes: episodesResult, loading: false });
            })
            .finally(() => {
                if (!cancelled) {
                    setTmdbEpisodesState((current) => current.key === tmdbEpisodesKey
                        ? { ...current, loading: false }
                        : current
                    );
                }
            });

        return () => {
            cancelled = true;
        };
    }, [requestedTmdbSeasonNumber, tmdbDetails?.tmdbId, tmdbEpisodesKey]);

    useEffect(() => {
        if (!selectedAnime) return;

        let cancelled = false;
        const activeId = activeSeasonId;
        const initialCandidates = [selectedAnime, ...getRelatedSeasonCandidates(selectedAnime)];
        const routeState = (location.state && typeof location.state === 'object')
            ? location.state as {
                tmdbId?: unknown;
                tmdbDetails?: { tmdbId?: unknown; seasons?: TmdbSeason[] };
                anime?: { tmdbId?: unknown; tmdb_id?: unknown };
            }
            : null;

        if (!activeId || !isMainSeriesSeason(selectedAnime)) {
            return () => {
                cancelled = true;
            };
        }

        const applyTmdbDetails = (tmdbId: number, seasons: TmdbSeason[]) => {
            const validSeasons = seasons.filter((season) => Number(season.season_number) > 0);
            if (!tmdbId || validSeasons.length === 0) return false;

            setTmdbDetailsState({
                activeId,
                tmdbId,
                seasons: validSeasons,
            });
            setTmdbSeasonChips({
                activeId,
                tmdbId,
                chips: buildTmdbSeasonChips(validSeasons, null),
            });
            return validSeasons.length > 1;
        };

        const loadSeasonMetadata = async () => {
            const seededTmdbId = toPositiveNumber(
                routeState?.tmdbId
                ?? routeState?.tmdbDetails?.tmdbId
                ?? routeState?.anime?.tmdbId
                ?? routeState?.anime?.tmdb_id
            );
            const routeTmdbSeasons = Array.isArray(routeState?.tmdbDetails?.seasons)
                ? routeState.tmdbDetails.seasons
                : [];

            if (seededTmdbId && routeTmdbSeasons.length > 0 && !cancelled) {
                const hasRealTmdbSeasons = applyTmdbDetails(seededTmdbId, routeTmdbSeasons);
                if (hasRealTmdbSeasons) {
                    setResolvedSeasonChips({ activeId, chips: initialSeasonChips });
                    return;
                }
            }

            const tmdbLookupAnime = seededTmdbId
                ? ({ ...selectedAnime, tmdbId: seededTmdbId } as Anime & { tmdbId: number })
                : selectedAnime;
            const tmdbDetailsResult = await tmdbService.getTvDetailsForAnime(tmdbLookupAnime).catch(() => null);
            const tmdbSeasons = (tmdbDetailsResult?.seasons || []).filter((season) => Number(season.season_number) > 0);

            if (!cancelled && tmdbDetailsResult?.id && tmdbSeasons.length > 0) {
                const hasRealTmdbSeasons = applyTmdbDetails(tmdbDetailsResult.id, tmdbSeasons);
                if (hasRealTmdbSeasons) {
                    setResolvedSeasonChips({ activeId, chips: initialSeasonChips });
                    return;
                }
            }

            const cachedChain = readSeasonChainCache(activeId);
            if (cachedChain?.length) {
                if (!cancelled) {
                    setResolvedSeasonChips({
                        activeId,
                        chips: buildSeasonChips(cachedChain, activeId),
                    });
                }
                return;
            }

            const queue = [activeId];
            const seen = new Set<number>();
            const collected = new Map<number, Anime>();

            const collect = (item: Anime) => {
                const id = Number(item.id || 0);
                if (id > 0 && isMainSeriesSeason(item) && !collected.has(id)) {
                    collected.set(id, item);
                }
            };

            while (queue.length > 0 && seen.size < 12) {
                const currentId = queue.shift();
                if (!currentId || seen.has(currentId)) continue;
                seen.add(currentId);

                const cachedDetails = animeService.peekAnimeDetailsCache(currentId) as { data?: Anime | null } | null;
                const currentAnime = currentId === activeId && selectedAnime.relations?.edges?.length
                    ? selectedAnime
                    : cachedDetails?.data
                        || ((await animeService.getAnimeDetails(currentId, currentId === activeId ? selectedAnime?.type : undefined).catch(() => ({ data: null })))?.data || (currentId === activeId ? selectedAnime : null));

                if (!currentAnime) continue;
                collect(currentAnime);

                getRelatedSeasonCandidates(currentAnime).forEach((candidate) => {
                    collect(candidate);
                    const candidateId = Number(candidate.id || 0);
                    if (candidateId > 0 && !seen.has(candidateId) && !queue.includes(candidateId)) {
                        queue.push(candidateId);
                    }
                });
            }

            if (!cancelled) {
                const collectedItems = Array.from(collected.values());
                writeSeasonChainCache(collectedItems);

                setResolvedSeasonChips({
                    activeId,
                    chips: buildSeasonChips(collectedItems, activeId),
                });
            }
        };

        loadSeasonMetadata().catch(() => {
            if (!cancelled) {
                setResolvedSeasonChips({
                    activeId,
                    chips: buildSeasonChips(initialCandidates, activeId),
                });
            }
        });

        return () => {
            cancelled = true;
        };
    }, [activeSeasonId, initialSeasonChips, location.state, selectedAnime]);

    // Derived state for button, but useWatchList is reactive so we can just use isInWatchList(id)
    const animeId = selectedAnime
        ? (
            isAnimePaheSession(selectedAnime.scraperId)
                ? selectedAnime.scraperId
                : (isMovieAnime(selectedAnime) && getTmdbRouteId(selectedAnime))
                    || selectedAnime.id
                    || selectedAnime.mal_id
                    || getTmdbRouteId(selectedAnime)
        )?.toString() || ''
        : '';
    const inList = isInWatchList(animeId);
    const inFavorites = isFavorite(animeId);

    const addSelectedAnimeToWatchList = (status: WatchListItem['status']) => {
        if (!selectedAnime || !animeId) return;

        addToWatchList({
            id: animeId,
            anilistId: selectedAnime.id ? String(selectedAnime.id) : undefined,
            malId: selectedAnime.mal_id ? String(selectedAnime.mal_id) : undefined,
            scraperId: isAnimePaheSession(selectedAnime.scraperId) ? selectedAnime.scraperId : undefined,
            title: selectedAnime.title,
            image: selectedAnime.images.jpg.large_image_url,
            score: selectedAnime.score,
            type: selectedAnime.type,
            totalCount: selectedAnime.episodes || episodes.length,
            genres: selectedAnime.genres?.map(g => g.name),
            mediaStatus: selectedAnime.status,
            synopsis: selectedAnime.synopsis,
            status
        });
    };

    const handleToggleList = () => {
        if (!selectedAnime || !animeId) return;

        if (inList) {
            removeFromWatchList(animeId);
            return;
        }

        addSelectedAnimeToWatchList('watching');
    };

    const handleToggleFavorite = () => {
        if (!selectedAnime || !animeId) return;

        if (inFavorites) {
            removeFavorite(animeId);
        } else {
            addFavorite({
                id: animeId,
                title: selectedAnime.title,
                image: selectedAnime.images.jpg.large_image_url,
                synopsis: selectedAnime.synopsis || ''
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
        return <DetailsPageSkeleton />;
    }

    const hasResolvedTitle = Boolean(
        selectedAnime.title?.trim() ||
        selectedAnime.title_english?.trim() ||
        selectedAnime.title_romaji?.trim() ||
        selectedAnime.title_japanese?.trim()
    );
    const hasResolvedArtwork = Boolean(
        selectedAnime.images?.jpg?.large_image_url?.trim() ||
        selectedAnime.images?.jpg?.image_url?.trim() ||
        selectedAnime.anilist_banner_image?.trim()
    );
    const shouldShowPrimarySkeleton =
        (detailsLoading && (!hasResolvedTitle || !hasResolvedArtwork)) ||
        (!hasResolvedTitle && !hasResolvedArtwork);

    if (shouldShowPrimarySkeleton) {
        return <DetailsPageSkeleton />;
    }

    const isUnreleased = selectedAnime.status === 'NOT_YET_RELEASED';
    const activeEpParam = searchParams.get('ep');
    const isMovie = isMovieAnime(selectedAnime);
    
    const handleSeasonChipClick = (season: SeasonChip) => {
        if (season.isActive) return;
        
        if (season.source === 'tmdb' && season.tmdbSeasonNumber && (!season.anilistId || season.anilistId === activeSeasonId)) {
            setSelectedTmdbSeason({ activeId: activeSeasonId, seasonNumber: season.tmdbSeasonNumber });
            updateSearchParams({}); // Clear active episode when switching TMDB seasons
            return;
        }

        const targetId = season.anilistId || season.id;
        navigate(`/anime/details/${targetId}`, {
            state: {
                anime: season.anime,
                preventScrollTop: true,
                tmdbId: tmdbDetails?.tmdbId,
                tmdbDetails: tmdbDetails ? { tmdbId: tmdbDetails.tmdbId, seasons: tmdbDetails.seasons } : undefined,
                seasonChips: seasonChips.map((chip) => ({
                    ...chip,
                    isActive: chip.id === season.id,
                })),
            },
        });
    };
    const scrollToPlayer = () => {
        setTimeout(() => {
            const playerEl = document.getElementById('details-video-player');
            if (playerEl) {
                const y = playerEl.getBoundingClientRect().top + window.scrollY - 32;
                window.scrollTo({ top: y, behavior: 'smooth' });
            } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }, 50);
    };

    const activeChip = activeDisplayChip;
    const hasTmdbMetadataSource = Boolean(tmdbDetails?.tmdbId && requestedTmdbSeasonNumber);
    const tmdbEpisodesForDisplay = activeChip?.isVirtual && activeChip.offset !== undefined && activeChip.count !== undefined
        ? tmdbEpisodes.slice(activeChip.offset, activeChip.offset + activeChip.count)
        : tmdbEpisodes;
    const firstTmdbEpNumber = tmdbEpisodesForDisplay[0]?.episode_number || 1;
    const isTmdbAbsoluteNumbering = firstTmdbEpNumber > 1 && (activeChip?.offset || 0) > 0 && firstTmdbEpNumber >= (activeChip?.offset || 0) * 0.5;

    const tmdbInstantEpisodes: NormalizedEpisode[] = tmdbEpisodesForDisplay.map((episode, index) => {
        const displayNumber = activeChip?.isVirtual ? index + 1 : episode.episode_number;
        const absoluteEpisodeNumber = activeChip?.isVirtual || isTmdbAbsoluteNumbering
            ? episode.episode_number
            : (activeChip?.offset || 0) + episode.episode_number;
        const playbackEpisodeNumber = absoluteEpisodeNumber;
        const thumbnail = tmdbService.imgUrl(episode.still_path, 'original');

        return {
            session: `tmdb:${tmdbDetails?.tmdbId || 'unknown'}:${requestedTmdbSeasonNumber || 1}:${displayNumber}`,
            episodeNumber: String(displayNumber),
            title: episode.name || `Episode ${displayNumber}`,
            overview: episode.overview,
            thumbnail,
            snapshot: thumbnail,
            airDate: episode.air_date,
            tmdbSeason: episode.season_number || requestedTmdbSeasonNumber || undefined,
            tmdbEpisode: episode.episode_number,
            _tmdbAbsolute: absoluteEpisodeNumber,
            playbackEpisodeNumber,
        };
    });
    const baseScraperEpisodes = normalizeScraperEpisodes(episodes.length > 0 ? episodes : instantEpisodes);

    // When multiple season chips are visible and TMDB hasn't provided episode metadata yet,
    // cap scraper episodes to this anime's own episode count (latestEpisode or episodes from AniList).
    // This prevents merged S1+S2 episodes (e.g. 25 total) from showing before TMDB resolves.
    const scraperEpisodeCap = !hasTmdbMetadataSource && displayChips.length > 1
        ? Math.max(Number(selectedAnime.episodes || 0), Number(selectedAnime.latestEpisode || 0))
        : 0;
    const cappedBaseScraperEpisodes = scraperEpisodeCap > 0 && baseScraperEpisodes.length > scraperEpisodeCap
        ? baseScraperEpisodes.slice(0, scraperEpisodeCap)
        : baseScraperEpisodes;

    let visibleEpisodes = tmdbInstantEpisodes.length > 0
        ? tmdbInstantEpisodes
        : hasTmdbMetadataSource
            ? []
            : cappedBaseScraperEpisodes;

    const currentAnimeId = String(selectedAnime?.mal_id || selectedAnime?.id || id || '').trim();
    const currentAnimeTitle = (selectedAnime?.title || selectedAnime?.title_english || selectedAnime?.title_romaji || location.state?.animeTitle || '').trim().toLowerCase();

    const isDifferentNumericId = (idA?: string, idB?: string): boolean => {
        const a = String(idA || '').trim();
        const b = String(idB || '').trim();
        if (!a || !b) return false;
        return /^\d+$/.test(a) && /^\d+$/.test(b) && a !== b;
    };

    const matchingDownloads = downloads.filter((d) => {
        if (currentAnimeId && String(d.animeId).trim() === currentAnimeId) return true;
        if (currentAnimeTitle && isDownloadTitleMatch(d.animeTitle, currentAnimeTitle)) {
            // Only reject if BOTH IDs are numeric and different (e.g. S1 numeric ID vs S2 numeric ID).
            // Do NOT reject slug IDs vs numeric IDs for the same show.
            if (isDifferentNumericId(d.animeId, currentAnimeId)) return false;
            return true;
        }
        if (location.state?.downloadId && d.id === location.state.downloadId) return true;
        return false;
    });

    const isFromDownloads = Boolean(location.state?.fromDownloads);

    if ((!navigator.onLine || isFromDownloads) && matchingDownloads.length > 0) {
        const downloadedEpisodeSet = new Set(matchingDownloads.map((d) => Number(d.episodeNumber)));
        
        const filtered = visibleEpisodes.filter((ep) => {
            // Revert Fix 3 — use the original single-field match.
            // The cross-season bleed is now fixed upstream in matchingDownloads.
            const epNum = Number(ep.episodeNumber || ep.playbackEpisodeNumber);
            return downloadedEpisodeSet.has(epNum);
        });

        if (filtered.length > 0) {
            visibleEpisodes = filtered;
        } else if (matchingDownloads.length > 0) {
            visibleEpisodes = matchingDownloads.map((d): NormalizedEpisode => ({
                session: d.id,
                episodeNumber: String(d.episodeNumber),
                title: d.episodeTitle || `Episode ${d.episodeNumber}`,
                thumbnail: d.animeImage,
                snapshot: d.animeImage,
                playbackEpisodeNumber: Number(d.episodeNumber),
            }));
        }

        // Sort ascending by episode number (1, 2, 3...)
        visibleEpisodes.sort((a, b) => {
            const numA = Number(a.episodeNumber || a.playbackEpisodeNumber || 0);
            const numB = Number(b.episodeNumber || b.playbackEpisodeNumber || 0);
            return numA - numB;
        });
    }

    const hasEpisodes = visibleEpisodes.length > 0;
    const isTmdbEpisodesResolving = hasTmdbMetadataSource && tmdbEpisodesLoading && !hasEpisodes;
    const isEpisodesResolving = isTmdbEpisodesResolving || (!hasTmdbMetadataSource && !hasEpisodes && (!episodesResolved || epLoading || detailsLoading || episodesBackgroundLoading));
    const activeVisibleEpisode = activeEpParam
        ? visibleEpisodes.find((episode) => {
            const playbackEpisodeNumber = Number(episode.playbackEpisodeNumber || episode._tmdbAbsolute || episode.episodeNumber);
            return (
                String(episode.episodeNumber) === activeEpParam ||
                (Number.isFinite(playbackEpisodeNumber) && String(playbackEpisodeNumber) === activeEpParam)
            );
        }) || null
        : null;

    const activeIndex = activeVisibleEpisode ? visibleEpisodes.indexOf(activeVisibleEpisode) : -1;
    const prevVisibleEpisode = activeIndex > 0 ? visibleEpisodes[activeIndex - 1] : null;
    const nextVisibleEpisode = activeIndex >= 0 && activeIndex < visibleEpisodes.length - 1 ? visibleEpisodes[activeIndex + 1] : null;
    const activePlayableEpisode = activeEpParam
        ? episodes.find((episode) => {
            const playbackEpisodeNumber = Number(episode._tmdbAbsolute || episode.episodeNumber);
            return (
                String(episode.episodeNumber) === activeEpParam ||
                (Number.isFinite(playbackEpisodeNumber) && String(playbackEpisodeNumber) === activeEpParam)
            );
        })
        : null;
    const activeEpisodeWatchKey = getEpisodeWatchKey(activeVisibleEpisode || activePlayableEpisode);
    const isPlayerResolvingEpisode = Boolean(activeEpParam) && (
        epLoading ||
        detailsLoading ||
        (!hasTmdbMetadataSource && episodesBackgroundLoading) ||
        (!hasTmdbMetadataSource && !episodesResolved) ||
        (!activePlayableEpisode && !activeVisibleEpisode && hasEpisodes)
    );
    const expectedEpisodeCount = activeChip?.count || Number(selectedAnime.episodes || 0);
    const episodeSkeletonCount = Math.min(
        20,
        Math.max(10, Number.isFinite(expectedEpisodeCount) && expectedEpisodeCount > 0 ? expectedEpisodeCount : 10)
    );

    return (
        <div className="min-h-screen bg-[#0a0a0a] pb-20 fade-in animate-in duration-300">
            {/* Banner Section */}
            <DetailsHero anime={selectedAnime} breadcrumbParent={breadcrumbParent} />

            {/* Content Section */}
            <div className="max-w-7xl mx-auto px-8 md:px-14 -mt-24 md:-mt-32 relative z-10">
                <DetailsInfo
                    anime={selectedAnime}
                    episodesCount={isMovie ? 0 : visibleEpisodes.length}
                    isLoading={isEpisodesResolving}
                    inList={inList}
                    inFavorites={inFavorites}
                    onWatch={() => {
                        updateSearchParams({ ep: '1' });
                        scrollToPlayer();
                    }}
                    onToggleList={handleToggleList}
                    onToggleFavorite={handleToggleFavorite}
                >
                    {activeEpParam && animeId ? (
                        <DetailsVideoPlayer 
                            animeId={animeId} 
                            animeTitle={selectedAnime.title} 
                            onClose={() => updateSearchParams({})}
                            isWatched={Boolean(activeEpisodeWatchKey && watchedEpisodes.has(activeEpisodeWatchKey))}
                            isResolvingEpisode={isPlayerResolvingEpisode}
                            fallbackEpisode={activeVisibleEpisode}
                            prevEpisode={prevVisibleEpisode}
                            nextEpisode={nextVisibleEpisode}
                            onMarkWatched={() => {
                                if (activeEpisodeWatchKey) toggleEpisodeComplete(activeEpisodeWatchKey);
                            }}
                        />
                    ) : null}

                    {!isUnreleased && !isMovie && (
                        <DetailsEpisodeGrid
                            episodes={visibleEpisodes}
                            watchedEpisodes={watchedEpisodes}
                            activeEpParam={activeEpParam}
                            seasonChips={displayChips}
                            isLoading={isEpisodesResolving}
                            skeletonCount={episodeSkeletonCount}
                            fallbackCoverImage={selectedAnime.images?.jpg?.large_image_url || selectedAnime.images?.jpg?.image_url || selectedAnime.anilist_cover_image || ''}
                            animeId={animeId}
                            animeTitle={selectedAnime.title}
                            animeImage={selectedAnime.images?.jpg?.large_image_url || selectedAnime.images?.jpg?.image_url || selectedAnime.anilist_cover_image || ''}
                            scraperSession={selectedAnime.title}
                            anilistId={selectedAnime.id}
                            onSeasonClick={handleSeasonChipClick}
                            onEpisodeClick={(ep) => {
                                const playbackEpisodeNumber = getPlaybackEpisodeNumber(ep);
                                updateSearchParams({ ep: String(playbackEpisodeNumber) });
                                scrollToPlayer();
                            }}
                        />
                    )}


                </DetailsInfo>
            </div>
        </div>
    );
}

function DetailsPageSkeleton() {
    return (
        <div className="min-h-screen bg-[#0a0a0a] animate-pulse">
            <div className="w-full h-[50vh] md:h-[65vh] bg-white/5" />
            <div className="max-w-7xl mx-auto px-8 md:px-14 -mt-24 md:-mt-32 relative z-10 flex flex-col md:flex-row gap-8">
                <div className="w-48 md:w-64 aspect-[2/3] rounded-xl bg-white/10" />
                <div className="flex-1 mt-4 md:mt-32 flex flex-col gap-4">
                    <div className="h-8 w-2/3 bg-white/10 rounded" />
                    <div className="h-4 w-1/3 bg-white/10 rounded" />
                    <div className="h-20 w-full bg-white/10 rounded mt-4" />
                </div>
            </div>
        </div>
    );
}

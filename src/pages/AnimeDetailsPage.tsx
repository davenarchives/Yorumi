import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAnime } from '../hooks/useAnime';
import { useWatchList } from '../hooks/useWatchList';
import { useFavoriteAnime } from '../hooks/useFavoriteAnime';
import { useDownloads } from '../hooks/useDownloads';
import { isDownloadTitleMatch, isDownloadAnimeIdMatch } from '../services/downloadService';
import type { Anime, Episode } from '../types/anime';
import type { WatchListItem } from '../utils/storage';
import { animeService } from '../services/animeService';
import { tmdbService, type TmdbSeason, type TmdbEpisode } from '../services/tmdbService';
import { episodeMetadataService, type AnimeMetadataPayload } from '../services/episodeMetadataService';
import { animeMappingService, type CanonicalAnimeMapping } from '../services/animeMappingService';
import { isNativeMobile } from '../platform/runtime';
import { setLocalStorageWithCleanup } from '../utils/localStorageQuota';
import { getEpisodeWatchKey, getPlaybackEpisodeNumber } from '../utils/episodeWatchKey';
import { isPrimaryAnimeMapping, mapTmdbMetadataToLocalEpisodes } from '../utils/animeEpisodeMapping';
import { buildAnimeRouteId, getCanonicalAnimeKey, getDirectScraperRouteId, parseAnimeRouteId, type AnimeRouteRef } from '../utils/animeNavigation';
import { buildAnimeSeasonLabels, getMeaningfulTmdbSeasonLabel } from '../utils/animeSeasonLabels';
import {
    compareAnimeFranchiseEntries,
    getAnimeFranchiseSortDate,
    getAnimeFranchiseTitle,
    isAnimeFranchiseEntry,
} from '../utils/animeFranchise';
// Feature Components
import DetailsHero from '../features/anime/components/details/DetailsHero';
import DetailsInfo from '../features/anime/components/details/DetailsInfo';
import DetailsEpisodeGrid, { type NormalizedEpisode, type SeasonChip } from '../features/anime/components/details/DetailsEpisodeGrid';
import DetailsVideoPlayer from '../features/anime/components/details/DetailsVideoPlayer';
import { filterReleasedEpisodes, isAnimeAiring } from '../utils/animeAiring';
import { ArrowLeft, ArrowUpDown, Grid2X2, Download } from 'lucide-react';

const isMovieAnime = (anime: Partial<Anime> | null | undefined) =>
    String(anime?.type || '').toUpperCase() === 'MOVIE';

const buildInstantEpisodes = (
    anime: Anime | null,
    maxEpisodes?: number,
    episodeMetaPayload?: AnimeMetadataPayload | null
): NormalizedEpisode[] => {
    if (!anime) return [];

    const fallbackCoverImage = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || anime.anilist_cover_image;
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
            thumbnail: item.thumbnail || fallbackCoverImage,
            snapshot: item.thumbnail || fallbackCoverImage,
            playbackEpisodeNumber: Number(episodeNumber),
        };
    });
    if (isMovieAnime(anime)) {
        const movieMeta = metadataEpisodes[0] || {};
        return [{
            session: movieMeta.session || `movie:1`,
            episodeNumber: '1',
            title: anime.title_english || anime.title || anime.title_romaji || anime.title_japanese || 'Movie',
            thumbnail: movieMeta.thumbnail || fallbackCoverImage,
            snapshot: movieMeta.snapshot || fallbackCoverImage,
            playbackEpisodeNumber: 1,
        }];
    }

    const latestEpisode = Number(anime.latestEpisode || 0);
    const totalEpisodes = Number(anime.episodes || 0);
    const metaEpisodesCount = episodeMetaPayload?.episodes.size || 0;
    const isAiring = isAnimeAiring(anime.status);
    const airingCap = isAiring && Number.isFinite(latestEpisode) && latestEpisode > 0 ? latestEpisode : undefined;
    const rawCount = Math.max(
        metadataEpisodes.length,
        metaEpisodesCount,
        Number.isFinite(latestEpisode) ? latestEpisode : 0,
        airingCap ? latestEpisode : (Number.isFinite(totalEpisodes) ? totalEpisodes : 0)
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
        const epNum = index + 1;
        const existing = byEpisodeNumber.get(episodeNumber);
        const meta = episodeMetaPayload?.episodes.get(epNum)
            || episodeMetaPayload?.absoluteEpisodes.get(epNum);

        const title = (existing?.title && !/^episode\s+\d+$/i.test(existing.title))
            ? existing.title
            : (meta?.title || (isMovieAnime(anime) ? (anime.title_english || anime.title || 'Movie') : `Episode ${episodeNumber}`));

        const thumbnail = existing?.thumbnail || meta?.thumbnail || fallbackCoverImage;
        const snapshot = existing?.snapshot || meta?.thumbnail || fallbackCoverImage;

        return {
            session: isMovieAnime(anime) ? `movie:${episodeNumber}` : `instant:${episodeNumber}`,
            episodeNumber,
            title,
            thumbnail,
            snapshot,
            overview: existing?.overview || meta?.overview,
            airDate: existing?.airDate || meta?.airDate,
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
type RecursiveRelationNode = RelationNode & {
    relations?: {
        edges: Array<{
            relationType: string;
            node: RecursiveRelationNode;
        }>;
    };
};

const ANILIST_SEASON_CHAIN_CACHE_PREFIX = 'yorumi_anilist_season_chain_v14';
const ANILIST_SEASON_CHAIN_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

type SeasonChainCachePayload = {
    timestamp: number;
    items: Anime[];
};

const getSeasonTitle = getAnimeFranchiseTitle;

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

const mapRelationNodeToAnime = (node: RecursiveRelationNode): Anime => {
    const year = Number(node.seasonYear || node.startDate?.year || 0);
    const month = Number(node.startDate?.month || 0);
    const day = Number(node.startDate?.day || 0);
    const from = year > 0
        ? `${year}-${String(month || 1).padStart(2, '0')}-${String(day || 1).padStart(2, '0')}`
        : undefined;

    return {
        mal_id: node.idMal || 0,
        id: node.id,
        title: node.title.english || node.title.romaji || node.title.native || 'Unknown',
        title_english: node.title.english,
        title_romaji: node.title.romaji,
        title_japanese: node.title.native,
        images: {
            jpg: {
                image_url: node.coverImage.large,
                large_image_url: node.coverImage.extraLarge || node.coverImage.large,
            },
        },
        anilist_banner_image: node.bannerImage,
        anilist_cover_image: node.coverImage.extraLarge || node.coverImage.large,
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
        relations: node.relations as Anime['relations'],
    };
};

const getRelatedSeasonCandidates = (anime: Anime) => {
    const candidates: Anime[] = [];
    const visited = new Set<number>([Number(anime.id || 0)]);
    const pending = [...(anime.relations?.edges || [])] as Array<{
        relationType: string;
        node: RecursiveRelationNode;
    }>;

    while (pending.length > 0) {
        const edge = pending.shift();
        if (!edge?.node) continue;

            const relation = String(edge.relationType || '').toUpperCase();
        const isMainTimeline = relation === 'PREQUEL' || relation === 'SEQUEL';
        if (!isMainTimeline) continue;

        const nodeId = Number(edge.node.id || 0);
        if (!nodeId || visited.has(nodeId)) continue;
        visited.add(nodeId);

        const candidate = mapRelationNodeToAnime(edge.node);
        if (isAnimeFranchiseEntry(candidate)) candidates.push(candidate);
        if (isMainTimeline) pending.push(...(edge.node.relations?.edges || []));
    }

    return candidates;
};

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

        const valid = parsed.items.filter(isAnimeFranchiseEntry);
        return valid.length > 1 ? valid : null;
    } catch {
        return null;
    }
};

const writeSeasonChainCache = (items: Anime[]) => {
    const validItems = items.filter(isAnimeFranchiseEntry);
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
            const tmdbId = Number((item as any).tmdbId || (item as any).tmdb_id || 0);
            const normTitle = getSeasonTitle(item).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

            const exists = Array.from(map.values()).some((existing) => {
                const existingId = Number(existing.id || 0);
                const existingTmdbId = Number((existing as any).tmdbId || (existing as any).tmdb_id || 0);
                const existingTitle = getSeasonTitle(existing).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

                if (id > 0 && existingId > 0 && id === existingId) return true;
                if (tmdbId > 0 && existingTmdbId > 0 && tmdbId === existingTmdbId) return true;
                if (normTitle && existingTitle && normTitle === existingTitle) return true;
                return false;
            });

            if (id > 0 && isAnimeFranchiseEntry(item) && !exists) {
                map.set(id, item);
            }
            return map;
        }, new Map<number, Anime>()).values()
    );

    const ordered = deduped.sort(compareAnimeFranchiseEntries);

    let currentSeason = 0;
    let offset = 0;
    const logicalLabels = buildAnimeSeasonLabels(ordered.map(getSeasonTitle));

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

        const label = logicalLabels[index] || `Season ${currentSeason}${suffix ? ` ${suffix}` : ''}`;

        const id = Number(item.id || 0);
        const count = item.episodes || 12;
        const currentOffset = offset;
        offset += count;

        return {
            id,
            anilistId: id,
            label,
            title: getSeasonTitle(item),
            isActive: id === activeId,
            source: 'anilist',
            offset: currentOffset,
            count,
            anime: item,
            tmdbSeasonNumber: explicitSeason || currentSeason,
        };
    });
};

const getSeasonChipOrder = (chip: SeasonChip) => {
    const label = `${chip.label || ''} ${chip.title || ''}`;
    const labelSeason = label.match(/\bseason\s*(\d+)\b/i)?.[1]
        || label.match(/\b(\d+)(?:st|nd|rd|th)\s*season\b/i)?.[1];
    const explicitSeason = getExplicitSeasonNumber(chip.anime || {} as Anime);
    const season = Number(labelSeason || chip.tmdbSeasonNumber || explicitSeason || 0);
    return season > 0 ? season : Number.MAX_SAFE_INTEGER;
};

const compareSeasonChips = (left: SeasonChip, right: SeasonChip) => {
    if (left.anime || right.anime) {
        const leftDate = getAnimeFranchiseSortDate(left.anime || {});
        const rightDate = getAnimeFranchiseSortDate(right.anime || {});
        if (leftDate.year !== rightDate.year) return leftDate.year - rightDate.year;
        if (leftDate.month !== rightDate.month) return leftDate.month - rightDate.month;
        if (leftDate.day !== rightDate.day) return leftDate.day - rightDate.day;
    }
    const seasonDifference = getSeasonChipOrder(left) - getSeasonChipOrder(right);
    if (seasonDifference !== 0) return seasonDifference;
    return String(left.label || left.title).localeCompare(String(right.label || right.title), undefined, { numeric: true });
};

const isTmdbSeasonUnreleased = (season: TmdbSeason) => {
    if ((season.episode_count ?? 0) === 0) return true;
    if (season.air_date) {
        const time = new Date(season.air_date).getTime();
        if (Number.isFinite(time) && time > Date.now()) return true;
    }
    return false;
};

const buildTmdbSeasonChips = (tmdbSeasons: TmdbSeason[], activeSeasonNumber: number | null): SeasonChip[] => {
    const tmdbOrdered = [...tmdbSeasons]
        .filter((season) => Number(season.season_number) > 0 && !isTmdbSeasonUnreleased(season))
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

const doesAnimeMatchRouteRef = (anime: Partial<Anime> | null | undefined, ref: AnimeRouteRef): boolean => {
    if (!anime) return false;
    const record = anime as Partial<Anime> & { tmdbId?: unknown; tmdb_id?: unknown; anilistId?: unknown };
    if (ref.source === 'anilist') {
        const targetId = Number(ref.id);
        if (Number(record.id || 0) === targetId || Number(record.anilistId || 0) === targetId) return true;
    }
    if (ref.source === 'mal' && Number(record.mal_id || 0) === Number(ref.id)) return true;
    if (ref.source === 'tmdb' && Number(record.tmdbId ?? record.tmdb_id ?? 0) === Number(ref.id)) return true;
    const routeScraperId = buildAnimeRouteId(ref);
    if (Boolean(routeScraperId) && getDirectScraperRouteId(record.scraperId) === routeScraperId) return true;
    const cleanRefId = String(ref.id || '').replace(/^s:/i, '').toLowerCase().trim();
    const cleanRecordId = String(record.scraperId || record.id || '').replace(/^s:/i, '').toLowerCase().trim();
    if (cleanRefId && cleanRecordId && cleanRefId === cleanRecordId) return true;

    // Title matching (normalized to handle hyphens vs spaces and punctuation)
    const normRef = cleanRefId.replace(/[^a-z0-9]+/g, ' ').trim();
    const normTitle = String(record.title || record.title_english || record.title_romaji || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (normRef && normTitle && (normRef === normTitle || normRef.includes(normTitle) || normTitle.includes(normRef))) return true;

    return false;
};

export default function AnimeDetailsPage() {
    const { id } = useParams<{ id: string }>();
    // React Router reuses this route component when only :id changes. Key the
    // stateful details tree by title identity so season chips, artwork, mapping
    // state and metadata from the previous title are destroyed immediately.
    return <AnimeDetailsPageContent key={id || 'unknown-anime'} />;
}

function AnimeDetailsPageContent() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [compactToolbar, setCompactToolbar] = useState(false);

    const handleBack = useCallback(() => {
        navigate('/', { replace: true });
    }, [navigate]);

    const [searchParams, setSearchParams] = useSearchParams();
    const location = useLocation();
    const animeHook = useAnime();
    const { selectedAnime, episodes, episodesAnimeKey, epLoading, episodesResolved, episodesBackgroundLoading, detailsLoading, error, watchedEpisodes, toggleEpisodeComplete } = animeHook;
    const { downloads } = useDownloads();
    const handleAnimeClickRef = useRef(animeHook.handleAnimeClick);
    const loadedDetailsRouteRef = useRef<string | null>(null);
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
        const next = new URLSearchParams(searchParams);
        next.delete('ep');
        next.delete('t');
        Object.entries(params).forEach(([key, value]) => next.set(key, value));
        setSearchParams(next, { state: location.state });
    };
    const getTmdbRouteId = (anime: Partial<Anime> | null | undefined) => {
        const tmdbAnime = anime as (Partial<Anime> & { tmdbId?: unknown; tmdb_id?: unknown }) | null | undefined;
        const tmdbId = toPositiveNumber(tmdbAnime?.tmdbId ?? tmdbAnime?.tmdb_id);
        return tmdbId ? `tmdb-${tmdbId}` : '';
    };

    useEffect(() => {
        handleAnimeClickRef.current = animeHook.handleAnimeClick;
    }, [animeHook.handleAnimeClick]);

    useEffect(() => {
        const onScroll = () => setCompactToolbar(window.scrollY > 96);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

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
        if (loadedDetailsRouteRef.current === id) return;
        loadedDetailsRouteRef.current = id;

        const routeAnime = (location.state?.anime && typeof location.state.anime === 'object')
            ? { ...(location.state.anime as Anime) }
            : null;

        const routeRef = parseAnimeRouteId(id);
        if (!routeRef) {
            navigate('/', { replace: true });
            return;
        }

        if (/^\d+$/.test(id)) {
            const canonicalId = buildAnimeRouteId(routeRef);
            const query = searchParams.toString();
            navigate(`/anime/details/${canonicalId}${query ? `?${query}` : ''}`, {
                replace: true,
                state: location.state,
            });
            return;
        }

        if (routeRef.source === 'tmdb') {
            const seededTmdbId = Number(routeRef.id);
            if (!seededTmdbId) {
                navigate('/', { replace: true });
                return;
            }
            
            if (routeAnime && routeAnime.title) {
                const anilistId = toPositiveNumber(routeAnime.id);
                const malId = toPositiveNumber(routeAnime.mal_id);
                handleAnimeClickRef.current({
                    ...routeAnime,
                    id: anilistId,
                    mal_id: malId,
                    tmdbId: seededTmdbId,
                    source: anilistId > 0 ? 'anilist' : 'tmdb',
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

        if (routeRef.source === 'scraper') {
            const scraperSession = String(routeRef.id).trim();
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

        const parsedId = Number(routeRef.id);
        if (routeRef.source === 'anilist' && Number.isFinite(parsedId) && parsedId > 0) {
            const isMatchingRouteAnime = routeAnime && Number(routeAnime.id) === parsedId;
            const animeToLoad = isMatchingRouteAnime
                ? { ...routeAnime, id: parsedId, source: 'anilist' as const }
                : ({ id: parsedId, mal_id: 0, source: 'anilist' } as Anime);
            handleAnimeClickRef.current(animeToLoad as Anime);
        } else if (routeRef.source === 'mal' && Number.isFinite(parsedId) && parsedId > 0) {
            const isMatchingRouteAnime = routeAnime && Number(routeAnime.mal_id) === parsedId;
            handleAnimeClickRef.current({
                ...(isMatchingRouteAnime ? routeAnime : {}),
                id: isMatchingRouteAnime ? routeAnime?.id : 0,
                mal_id: parsedId,
                source: 'mal',
                title: routeAnime?.title || `MAL ${parsedId}`,
                images: routeAnime?.images || { jpg: { image_url: '', large_image_url: '' } },
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
    }, [id, location.state, navigate, searchParams]);

    const { isInWatchList, addToWatchList, removeFromWatchList } = useWatchList();
    const { isFavorite, addFavorite, removeFavorite } = useFavoriteAnime();
    const tmdbRouteId = id?.startsWith('tmdb-') ? Number.parseInt(id.substring(5), 10) : 0;
    const parsedRouteId = tmdbRouteId || Number.parseInt(id || '', 10);
    const selectedAnimeId = Number(selectedAnime?.id || 0);
    const requestedSeasonId = Number.parseInt(searchParams.get('season') || '', 10);
    const activeSeasonId = (Number.isFinite(requestedSeasonId) && requestedSeasonId > 0 ? requestedSeasonId : 0)
        || tmdbRouteId
        || (Number.isFinite(selectedAnimeId) && selectedAnimeId > 0 ? selectedAnimeId : 0)
        || (Number.isFinite(parsedRouteId) && parsedRouteId > 0 ? parsedRouteId : 0);
    const selectedTmdbId = toPositiveNumber(
        (selectedAnime as (Anime & { tmdbId?: unknown; tmdb_id?: unknown }) | null)?.tmdbId
        ?? (selectedAnime as (Anime & { tmdbId?: unknown; tmdb_id?: unknown }) | null)?.tmdb_id
    );
    const requestedMappingId = Number.parseInt(searchParams.get('map') || '', 10);
    const hasRequestedAniListSeason = Number.isFinite(requestedSeasonId) && requestedSeasonId > 0;
    const hasMismatchedTmdbRoute = tmdbRouteId > 0 && !hasRequestedAniListSeason && selectedTmdbId !== tmdbRouteId;

    useEffect(() => {
        if (!id || !selectedAnime?.id) return;
        const currentRef = parseAnimeRouteId(id);
        if (!currentRef || currentRef.source === 'anilist') return;
        // The details page stays mounted across routes, so selectedAnime can still
        // belong to the previously viewed title for one render. Never canonicalize
        // the new route onto an anime that doesn't match it.
        if (!doesAnimeMatchRouteRef(selectedAnime, currentRef)) return;

        const canonicalRouteId = buildAnimeRouteId({ source: 'anilist', id: selectedAnime.id });
        const query = searchParams.toString();
        navigate(`/anime/details/${canonicalRouteId}${query ? `?${query}` : ''}`, {
            replace: true,
            state: {
                ...location.state,
                anime: selectedAnime,
                preventScrollTop: true,
            },
        });
    }, [id, location.state, navigate, searchParams, selectedAnime]);
    const initialSeasonChips = useMemo(
        () => selectedAnime && !hasMismatchedTmdbRoute
            ? buildSeasonChips([selectedAnime, ...getRelatedSeasonCandidates(selectedAnime)], activeSeasonId)
            : [],
        [activeSeasonId, hasMismatchedTmdbRoute, selectedAnime]
    );
    const [mappingState, setMappingState] = useState<{
        key: string;
        mappings: CanonicalAnimeMapping[];
    }>({ key: '', mappings: [] });
    const mappingLookupKey = selectedTmdbId > 0
        ? `tmdb:${selectedTmdbId}`
        : selectedAnimeId > 0
            ? `anilist:${selectedAnimeId}`
            : '';

    useEffect(() => {
        if (!mappingLookupKey) {
            return;
        }

        let cancelled = false;

        const request = selectedTmdbId > 0
            ? animeMappingService.getByTmdbId(selectedTmdbId)
            : animeMappingService.getByAniListId(selectedAnimeId).then(async (mapping) => {
                if (!mapping) return [];
                if (mapping.tmdbShowId) {
                    const siblings = await animeMappingService.getByTmdbId(mapping.tmdbShowId);
                    return siblings.length > 0 ? siblings : [mapping];
                }
                return [mapping];
            });

        request.then((mappings) => {
            if (!cancelled) {
                setMappingState({ key: mappingLookupKey, mappings });
            }
        });
        return () => {
            cancelled = true;
        };
    }, [mappingLookupKey, selectedAnimeId, selectedTmdbId]);

    const activeMappings = mappingState.key === mappingLookupKey ? mappingState.mappings : [];
    const verifiedMappings = useMemo(() => activeMappings.filter((mapping) =>
        mapping.status === 'verified' && isPrimaryAnimeMapping(mapping.segments, mapping.tmdbMovieId)
    ), [activeMappings]);
    const orderedVerifiedMappings = useMemo(() => [...verifiedMappings].sort((left, right) => {
        const leftSpecial = left.segments.length > 0 && left.segments.every((segment) => segment.tmdbSeason === 0);
        const rightSpecial = right.segments.length > 0 && right.segments.every((segment) => segment.tmdbSeason === 0);
        if (leftSpecial !== rightSpecial) return leftSpecial ? 1 : -1;
        const leftSegment = left.segments[0];
        const rightSegment = right.segments[0];
        return (leftSegment?.tmdbSeason || 0) - (rightSegment?.tmdbSeason || 0)
            || (leftSegment?.tmdbEpisodeStart || 0) - (rightSegment?.tmdbEpisodeStart || 0)
            || left.anilistId - right.anilistId;
    }), [verifiedMappings]);
    const mappingSeasonChips = useMemo(() => orderedVerifiedMappings.map((mapping, index): SeasonChip => {
        const count = mapping.segments.reduce((max, segment) => Math.max(max, segment.localEpisodeEnd), 0)
            || (isMovieAnime(selectedAnime) ? 1 : 0);
        const isSpecial = mapping.segments.length > 0 && mapping.segments.every((segment) => segment.tmdbSeason === 0);
        const regularSeasonNumber = orderedVerifiedMappings
            .slice(0, index + 1)
            .filter((candidate) => !candidate.segments.length || candidate.segments.some((segment) => segment.tmdbSeason > 0))
            .length;
        const activeMappingId = requestedMappingId > 0
            ? requestedMappingId
            : (selectedAnimeId > 0 && orderedVerifiedMappings.some((candidate) => candidate.anilistId === selectedAnimeId)
                ? selectedAnimeId
                : orderedVerifiedMappings[0]?.anilistId);
        return {
            id: mapping.anilistId,
            anilistId: mapping.anilistId,
            label: isSpecial
                ? 'Specials'
                : orderedVerifiedMappings.length > 1
                    ? `Season ${regularSeasonNumber}`
                    : (selectedAnime?.title || 'Series'),
            title: selectedAnime?.title || `Anime ${mapping.anilistId}`,
            isActive: mapping.anilistId === activeMappingId,
            source: 'mapping',
            count,
            segments: mapping.segments,
            tmdbSeasonNumber: mapping.segments[0]?.tmdbSeason,
        };
    }), [orderedVerifiedMappings, requestedMappingId, selectedAnime, selectedAnimeId]);

    const [episodeMeta, setEpisodeMeta] = useState<AnimeMetadataPayload | null>(() => {
        const targetId = (Number.isFinite(requestedSeasonId) && requestedSeasonId > 0 ? requestedSeasonId : 0)
            || (selectedAnimeId > 0 ? selectedAnimeId : 0);
        return targetId > 0
            ? episodeMetadataService.getCachedEpisodeMetadata(targetId, Number(selectedAnime?.mal_id || 0))
            : null;
    });

    const instantEpisodes = useMemo(() => {
        // Determine the cap for placeholder episodes based on the active season chip.
        // This prevents merged episodes across seasons while TMDB resolves asynchronously.
        // We use initialSeasonChips (synchronously available) to find the active chip's count.
        const activeInitialChip = initialSeasonChips.find((chip) => chip.id === activeSeasonId);
        const instantMaxEpisodes = activeInitialChip && activeInitialChip.count && initialSeasonChips.length > 1
            ? activeInitialChip.count
            : undefined;
        return buildInstantEpisodes(selectedAnime, instantMaxEpisodes, episodeMeta);
    }, [selectedAnime, initialSeasonChips, activeSeasonId, episodeMeta]);
    const routeSeasonChips = useMemo(
        () => readRouteSeasonChips(location.state?.seasonChips, activeSeasonId),
        [activeSeasonId, location.state]
    );
    const [resolvedSeasonChips, setResolvedSeasonChips] = useState<{ activeId: number; chips: SeasonChip[] } | null>(null);
    const [tmdbSeasonChips, setTmdbSeasonChips] = useState<{ activeId: number; tmdbId: number; chips: SeasonChip[] } | null>(null);
    const [tmdbDetailsState, setTmdbDetailsState] = useState<{ activeId: number; tmdbId: number; seasons: TmdbSeason[] } | null>(null);
    const selectedExplicitSeason = selectedAnime ? getExplicitSeasonNumber(selectedAnime) : 0;
    const resolvedChips = useMemo(
        () => resolvedSeasonChips?.activeId === activeSeasonId ? resolvedSeasonChips.chips : [],
        [activeSeasonId, resolvedSeasonChips]
    );
    const tmdbChips = tmdbSeasonChips?.activeId === activeSeasonId ? tmdbSeasonChips.chips : [];
    const tmdbDetails = tmdbDetailsState?.activeId === activeSeasonId ? tmdbDetailsState : null;
    const routeAniListChips = useMemo(
        () => routeSeasonChips.filter((chip) => chip.source === 'anilist'),
        [routeSeasonChips]
    );
    const hasMultipleTmdbSeasons = (tmdbDetails?.seasons.length || 0) > 1;

    const seasonChips = (() => {
        if (hasMismatchedTmdbRoute) return [];
        if (resolvedChips.length > 1) return resolvedChips;
        if (initialSeasonChips.length > 1) return initialSeasonChips;
        if (routeAniListChips.length > 1) return routeAniListChips;
        if (hasMultipleTmdbSeasons && tmdbChips.length > 0) return tmdbChips;
        if (resolvedChips.length > 0) return resolvedChips;
        if (initialSeasonChips.length > 0) return initialSeasonChips;
        if (routeAniListChips.length > 0) return routeAniListChips;
        return initialSeasonChips;
    })();

    useEffect(() => {
        if (!id) return;
        const routeRef = parseAnimeRouteId(id);
        if (!routeRef || routeRef.source !== 'anilist') return;

        const requestedSeason = Number.parseInt(searchParams.get('season') || '', 10);
        if (Number.isFinite(requestedSeason) && requestedSeason > 0 && requestedSeason !== Number(routeRef.id)) {
            const nextParams = new URLSearchParams(searchParams);
            nextParams.delete('season');
            const query = nextParams.toString();
            navigate(`/anime/details/${buildAnimeRouteId({ source: 'anilist', id: requestedSeason })}${query ? `?${query}` : ''}`, {
                replace: true,
                state: location.state,
            });
        }
    }, [id, location.state, navigate, searchParams]);

    const [tmdbEpisodesState, setTmdbEpisodesState] = useState<{ key: string; episodes: TmdbEpisode[]; loading: boolean }>({
        key: '',
        episodes: [],
        loading: false,
    });
    const [selectedTmdbSeason, setSelectedTmdbSeason] = useState<{ activeId: number; seasonNumber: number } | null>(null);
    const selectedTmdbSeasonNumber = selectedTmdbSeason?.activeId === activeSeasonId
        ? selectedTmdbSeason.seasonNumber
        : null;

    const requestedRelationSeasonNumber = (() => {
        if (!(Number.isFinite(requestedSeasonId) && requestedSeasonId > 0)) return 0;
        const orderedRelations = (resolvedChips.length > 1 ? resolvedChips : initialSeasonChips)
            .filter((chip) => chip.source === 'anilist');
        const relationIndex = orderedRelations.findIndex((chip) =>
            Number(chip.anilistId || chip.id) === requestedSeasonId
        );
        if (relationIndex < 0) return 0;
        return getExplicitSeasonNumber(orderedRelations[relationIndex].anime || {}) || relationIndex + 1;
    })();

    const mappedSelectedTmdbSeasonNumber = orderedVerifiedMappings
        .find((mapping) => mapping.anilistId === (requestedMappingId || selectedAnimeId))
        ?.segments.find((segment) => segment.tmdbSeason > 0)?.tmdbSeason;
    const fallbackTmdbSeasonNumber = tmdbChips.find(c => c.tmdbSeasonNumber === mappedSelectedTmdbSeasonNumber)?.tmdbSeasonNumber
            ?? tmdbChips.find(c => c.tmdbSeasonNumber === requestedRelationSeasonNumber)?.tmdbSeasonNumber
            ?? tmdbChips.find(c => c.tmdbSeasonNumber === selectedExplicitSeason)?.tmdbSeasonNumber
            ?? tmdbChips[0]?.tmdbSeasonNumber;

    const activeTmdbSeasonNumber = selectedTmdbSeasonNumber
        ?? seasonChips.find(c => c.isActive && c.source === 'tmdb')?.tmdbSeasonNumber
        ?? fallbackTmdbSeasonNumber;

    const normalizeSeasonIdentity = (value: unknown) => String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
    const selectedSeasonTitles = new Set([
        selectedAnime?.title,
        selectedAnime?.title_english,
        selectedAnime?.title_romaji,
        selectedAnime?.title_japanese,
    ].map(normalizeSeasonIdentity).filter(Boolean));
    const selectedAniListId = Number(selectedAnime?.id || 0);
    const matchedAniListChip = seasonChips.find((chip) =>
        chip.source === 'anilist' && (
            Number(chip.id || 0) === activeSeasonId ||
            Number(chip.anilistId || 0) === activeSeasonId
        )
    ) || seasonChips.find((chip) =>
        selectedAniListId > 0 && chip.source === 'anilist' && (
            Number(chip.id || 0) === selectedAniListId ||
            Number(chip.anilistId || 0) === selectedAniListId
        )
    ) || seasonChips.find((chip) =>
        chip.source === 'anilist' && selectedSeasonTitles.has(normalizeSeasonIdentity(chip.title))
    );

    const displayChips = seasonChips
        .filter((chip) => {
            if (chip.source === 'tmdb' && (chip.count ?? 0) === 0) return false;
            return true;
        })
        .map((chip) => {
            if (chip.source === 'tmdb') {
                return { ...chip, isActive: chip.tmdbSeasonNumber === activeTmdbSeasonNumber };
            }
            if (chip.source === 'mapping') {
                const activeMappingId = requestedMappingId > 0
                    ? requestedMappingId
                    : mappingSeasonChips.find((candidate) => candidate.isActive)?.id;
                return { ...chip, isActive: chip.id === activeMappingId };
            }
            return { ...chip, isActive: chip.id === matchedAniListChip?.id };
        })
        .sort(compareSeasonChips);
    const activeDisplayChip = displayChips.find((chip) => chip.isActive);
    const activeMappingChip = mappingSeasonChips.find((chip) =>
        Number(chip.anilistId || chip.id) === Number(activeDisplayChip?.anilistId || activeDisplayChip?.id || 0)
    );
    const requestedTmdbSeasonNumber = activeMappingChip
        ? null
        : activeDisplayChip?.tmdbSeasonNumber ?? activeTmdbSeasonNumber ?? null;

    const activeMappingSegmentsSource = activeMappingChip?.segments;
    const activeMappingSegments = useMemo(
        () => activeMappingSegmentsSource || [],
        [activeMappingSegmentsSource]
    );
    const mappedTmdbEpisodesKey = tmdbDetails?.tmdbId && activeMappingSegments.length > 0
        ? `${tmdbDetails.tmdbId}:${activeDisplayChip?.id}:${activeMappingSegments.map((segment) => `${segment.tmdbSeason}.${segment.tmdbEpisodeStart}-${segment.tmdbEpisodeEnd}`).join(',')}`
        : '';
    const [mappedTmdbEpisodesState, setMappedTmdbEpisodesState] = useState<{
        key: string;
        episodes: ReturnType<typeof mapTmdbMetadataToLocalEpisodes>;
        loading: boolean;
    }>({ key: '', episodes: [], loading: false });

    useEffect(() => {
        const tmdbId = tmdbDetails?.tmdbId;
        if (!tmdbId || !mappedTmdbEpisodesKey || activeMappingSegments.length === 0) return;

        let cancelled = false;
        const seasonNumbers = [...new Set(activeMappingSegments.map((segment) => segment.tmdbSeason))];
        Promise.all(seasonNumbers.map(async (seasonNumber) => [
            seasonNumber,
            await tmdbService.getTvSeasonEpisodes(tmdbId, seasonNumber),
        ] as const)).then((seasonEntries) => {
            if (cancelled) return;
            const episodesBySeason = new Map<number, TmdbEpisode[]>(seasonEntries);
            setMappedTmdbEpisodesState({
                key: mappedTmdbEpisodesKey,
                episodes: mapTmdbMetadataToLocalEpisodes(activeMappingSegments, episodesBySeason),
                loading: false,
            });
        }).catch(() => {
            if (!cancelled) {
                setMappedTmdbEpisodesState({ key: mappedTmdbEpisodesKey, episodes: [], loading: false });
            }
        });

        return () => {
            cancelled = true;
        };
    }, [activeMappingSegments, mappedTmdbEpisodesKey, tmdbDetails?.tmdbId]);

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
        if (!selectedAnime || hasMismatchedTmdbRoute) return;

        let cancelled = false;
        const activeId = activeSeasonId;
        const initialCandidates = [selectedAnime, ...getRelatedSeasonCandidates(selectedAnime)];
        const routeState = (location.state && typeof location.state === 'object')
            ? location.state as {
                tmdbId?: unknown;
                tmdbDetails?: { tmdbId?: unknown; seasons?: TmdbSeason[] };
                anime?: { tmdbId?: unknown; tmdb_id?: unknown };
            }
            : undefined;
        const seededTmdbId = toPositiveNumber(
            tmdbRouteId
            || routeState?.tmdbId
            || routeState?.tmdbDetails?.tmdbId
            || routeState?.anime?.tmdbId
            || routeState?.anime?.tmdb_id
        );

        if (!activeId && !seededTmdbId) {
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
            const hasRequestedAniListSeason = Number.isFinite(requestedSeasonId) && requestedSeasonId > 0;
            const effectiveTmdbId = (hasRequestedAniListSeason ? episodeMeta?.tmdbId : 0) || seededTmdbId || episodeMeta?.tmdbId || toPositiveNumber(
                (selectedAnime as Anime & { tmdbId?: unknown }).tmdbId
                || tmdbRouteId
                || routeState?.tmdbId
                || routeState?.tmdbDetails?.tmdbId
                || routeState?.anime?.tmdbId
                || routeState?.anime?.tmdb_id
            );
            const routeTmdbSeasons = Array.isArray(routeState?.tmdbDetails?.seasons)
                ? routeState.tmdbDetails.seasons
                : [];

            if (effectiveTmdbId && routeTmdbSeasons.length > 0 && !cancelled) {
                const hasRealTmdbSeasons = applyTmdbDetails(effectiveTmdbId, routeTmdbSeasons);
                if (hasRealTmdbSeasons) {
                    setResolvedSeasonChips({ activeId, chips: [] });
                }
            }

            const tmdbLookupAnime = effectiveTmdbId
                ? ({ ...selectedAnime, tmdbId: effectiveTmdbId } as Anime & { tmdbId: number })
                : selectedAnime;
            const tmdbDetailsResult = await tmdbService.getTvDetailsForAnime(tmdbLookupAnime).catch(() => null);
            const tmdbSeasons = (tmdbDetailsResult?.seasons || []).filter((season) => Number(season.season_number) > 0);

            if (!cancelled && (tmdbDetailsResult?.id || effectiveTmdbId) && tmdbSeasons.length > 0) {
                const hasRealTmdbSeasons = applyTmdbDetails(tmdbDetailsResult?.id || effectiveTmdbId, tmdbSeasons);
                if (hasRealTmdbSeasons) {
                    setResolvedSeasonChips({ activeId, chips: [] });
                }
            }

            // Wait for AniBridge before enriching its season list. AniList is still
            // queried once (and cached) because sequels may be separate TMDB shows
            // and therefore absent from the current TMDB mapping response.
            if (!cancelled && mappingLookupKey && mappingState.key !== mappingLookupKey) {
                return;
            }

            // Some anime sequels are separate TMDB records instead of numbered
            // seasons. Resolve that relationship with one cached AniList query.
            const cachedChain = readSeasonChainCache(Number(selectedAnime.id || 0));
            const chainRoot = cachedChain
                ? null
                : await animeService.getAnimeSeasonChain(selectedAnime).catch(() => null);
            const chainCandidates = cachedChain
                || (chainRoot?.seasonChain?.length
                    ? chainRoot.seasonChain
                    : chainRoot
                        ? [chainRoot, ...getRelatedSeasonCandidates(chainRoot)]
                        : initialCandidates);
            const chainChips = buildSeasonChips(chainCandidates, activeId);
            if (!cancelled && chainChips.length > 1) {
                writeSeasonChainCache(chainCandidates);
                setResolvedSeasonChips({ activeId, chips: chainChips });
            }

            const currentRouteRef = parseAnimeRouteId(id);
            const isTmdbRouteOrSource = selectedAnime.source === 'tmdb' || currentRouteRef?.source === 'tmdb';

            if (!cancelled && mappingSeasonChips.length === 0 && isTmdbRouteOrSource && chainCandidates.length > 0 && chainCandidates[0]?.id) {
                const matchedCandidate = chainCandidates.find(c => {
                    return normalizeSeasonIdentity(c.title) === normalizeSeasonIdentity(selectedAnime.title)
                        || normalizeSeasonIdentity(c.title_english) === normalizeSeasonIdentity(selectedAnime.title_english)
                        || normalizeSeasonIdentity(c.title_romaji) === normalizeSeasonIdentity(selectedAnime.title_romaji);
                }) || chainCandidates[0];

                if (matchedCandidate && Number(matchedCandidate.id) > 0) {
                    const hydratedCandidate: Anime = {
                        ...matchedCandidate,
                        tmdbId: effectiveTmdbId || (matchedCandidate as (Anime & { tmdbId?: number })).tmdbId || selectedTmdbId,
                    };
                    handleAnimeClickRef.current(hydratedCandidate);
                    const query = searchParams.toString();
                    navigate(`/anime/details/al-${hydratedCandidate.id}${query ? `?${query}` : ''}`, {
                        replace: true,
                        state: {
                            ...location.state,
                            anime: hydratedCandidate,
                            preventScrollTop: true,
                            seasonChips: chainChips.length > 1 ? chainChips.map((c) => ({
                                ...c,
                                isActive: Number(c.anilistId || c.id) === hydratedCandidate.id,
                            })) : undefined,
                        },
                    });
                    return;
                }
            }
            if (!cancelled && chainChips.length > 1) {
                return;
            }

            // Legacy fallback only: use already-loaded relation data without issuing
            // additional AniList requests. It never blocks TMDB season rendering.
            if (!cancelled && initialCandidates.length > 1) {
                setResolvedSeasonChips({
                    activeId,
                    chips: buildSeasonChips(initialCandidates, activeId),
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
    }, [activeSeasonId, hasMismatchedTmdbRoute, initialSeasonChips, location.state, mappingLookupKey, mappingSeasonChips.length, mappingState.key, requestedSeasonId, selectedAnime, episodeMeta?.tmdbId]);

    const requestedSeasonChip = seasonChips.find((chip) =>
        chip.source === 'anilist' && Number(chip.anilistId || chip.id) === requestedSeasonId
    );
    const activeAniListSeasonId = requestedSeasonChip
        ? Number(requestedSeasonChip.anilistId || requestedSeasonChip.id)
        : seasonChips.length > 1 && matchedAniListChip
            ? Number(matchedAniListChip.anilistId || matchedAniListChip.id || 0)
            : 0;
    const activeSeasonSeed = seasonChips.find((chip) =>
        chip.source === 'anilist' && Number(chip.anilistId || chip.id) === activeAniListSeasonId
    )?.anime || null;
    const [activeSeasonAnimeState, setActiveSeasonAnimeState] = useState<{ id: number; anime: Anime } | null>(null);

    useEffect(() => {
        if (!activeAniListSeasonId) {
            setActiveSeasonAnimeState(null);
            return;
        }

        let cancelled = false;
        if (activeSeasonSeed) {
            setActiveSeasonAnimeState({ id: activeAniListSeasonId, anime: activeSeasonSeed });
        }

        animeService.getAniListSeasonDetails(activeAniListSeasonId)
            .then((anime) => {
                if (!cancelled && anime) {
                    setActiveSeasonAnimeState({ id: activeAniListSeasonId, anime });
                }
            });

        return () => {
            cancelled = true;
        };
    }, [activeAniListSeasonId, activeSeasonSeed]);

    const activeSeasonAnime = activeSeasonAnimeState?.id === activeAniListSeasonId
        ? activeSeasonAnimeState.anime
        : activeSeasonSeed;
    const actionAnime = activeSeasonAnime || selectedAnime;

    useEffect(() => {
        const targetId = activeAniListSeasonId
            || (Number.isFinite(requestedSeasonId) && requestedSeasonId > 0 ? requestedSeasonId : 0)
            || (matchedAniListChip ? Number(matchedAniListChip.anilistId || matchedAniListChip.id || 0) : 0)
            || (selectedAnimeId > 0 ? selectedAnimeId : 0);
        const malId = targetId === selectedAnimeId ? Number(selectedAnime?.mal_id || 0) : 0;
        if (!targetId && !malId) {
            setEpisodeMeta(null);
            return;
        }

        const cached = episodeMetadataService.getCachedEpisodeMetadata(targetId, malId);
        setEpisodeMeta(cached);

        let cancelled = false;

        episodeMetadataService.getEpisodeMetadata(targetId, malId).then((meta) => {
            if (!cancelled && meta) {
                setEpisodeMeta(meta);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [activeAniListSeasonId, matchedAniListChip, requestedSeasonId, selectedAnimeId, selectedAnime?.mal_id]);

    // Derived state for button, but useWatchList is reactive so we can just use isInWatchList(id)
    const animeId = actionAnime
        ? (
            isAnimePaheSession(actionAnime.scraperId)
                ? actionAnime.scraperId
                : ((actionAnime.source === 'tmdb' || tmdbRouteId > 0) && getTmdbRouteId(actionAnime))
                    || actionAnime.id
                    || actionAnime.mal_id
                    || getTmdbRouteId(actionAnime)
        )?.toString() || ''
        : '';
    // Playback must follow the active season identity. Reusing the previously
    // selected series here can preserve its stream when episode numbers match.
    const playbackAnimeId = animeId;
    const inList = isInWatchList(animeId);
    const inFavorites = isFavorite(animeId);

    const addSelectedAnimeToWatchList = (status: WatchListItem['status']) => {
        if (!actionAnime || !animeId) return;

        addToWatchList({
            id: animeId,
            anilistId: actionAnime.id ? String(actionAnime.id) : undefined,
            malId: actionAnime.mal_id ? String(actionAnime.mal_id) : undefined,
            scraperId: isAnimePaheSession(actionAnime.scraperId) ? actionAnime.scraperId : undefined,
            title: actionAnime.title,
            image: actionAnime.images.jpg.large_image_url,
            score: actionAnime.score,
            type: actionAnime.type,
            totalCount: actionAnime.episodes || episodes.length,
            genres: actionAnime.genres?.map(g => g.name),
            mediaStatus: actionAnime.status,
            synopsis: actionAnime.synopsis,
            status
        });
    };

    const handleToggleList = () => {
        if (!actionAnime || !animeId) return;

        if (inList) {
            removeFromWatchList(animeId);
            return;
        }

        addSelectedAnimeToWatchList('watching');
    };

    const handleToggleFavorite = () => {
        if (!actionAnime || !animeId) return;

        if (inFavorites) {
            removeFavorite(animeId);
        } else {
            addFavorite({
                id: animeId,
                title: actionAnime.title,
                image: actionAnime.images.jpg.large_image_url,
                synopsis: actionAnime.synopsis || ''
            });
        }
    };

    const currentRouteRef = id ? parseAnimeRouteId(id) : null;
    const isVaultAnimeRoute = Boolean(id?.startsWith('vault-anime:'));

    const isDifferentNumericId = (idA?: string, idB?: string): boolean => {
        const a = String(idA || '').trim();
        const b = String(idB || '').trim();
        if (!a || !b) return false;
        return /^\d+$/.test(a) && /^\d+$/.test(b) && a !== b;
    };

    const targetRouteStr = id ? String(id).trim() : '';
    const stateAnime = location.state?.anime as Partial<Anime> | undefined;
    const lookupTitle = (selectedAnime?.title || selectedAnime?.title_english || stateAnime?.title || location.state?.animeTitle || '').trim().toLowerCase();

    const matchingDownloads = useMemo(() => {
        return downloads.filter((d) => {
            if (targetRouteStr && isDownloadAnimeIdMatch(d.animeId, targetRouteStr, currentRouteRef?.id)) return true;
            if (lookupTitle && isDownloadTitleMatch(d.animeTitle, lookupTitle)) {
                if (isDifferentNumericId(d.animeId, targetRouteStr)) return false;
                return true;
            }
            if (location.state?.downloadId && d.id === location.state.downloadId) return true;
            return false;
        });
    }, [downloads, targetRouteStr, currentRouteRef?.id, lookupTitle, location.state?.downloadId]);

    const isFromDownloads = Boolean(location.state?.fromDownloads);
    const hasOfflineDownloads = (!navigator.onLine || isFromDownloads) && matchingDownloads.length > 0;

    const downloadFallbackAnime = useMemo<Anime | null>(() => {
        if (matchingDownloads.length > 0) {
            const first = matchingDownloads[0];
            return {
                id: Number(first.animeId) || 0,
                mal_id: 0,
                title: first.animeTitle,
                title_english: first.animeTitle,
                images: {
                    jpg: {
                        image_url: first.animeImage,
                        large_image_url: first.animeImage,
                    },
                },
                episodes: matchingDownloads.length,
                status: 'Completed',
                synopsis: 'Offline Downloaded Series',
            } as Anime;
        }
        if (stateAnime && stateAnime.title) {
            return stateAnime as Anime;
        }
        return null;
    }, [matchingDownloads, stateAnime]);

    const stateAnimeMatch = stateAnime && currentRouteRef && doesAnimeMatchRouteRef(stateAnime, currentRouteRef)
        ? (stateAnime as Anime)
        : (stateAnime?.title ? (stateAnime as Anime) : null);

    const activeSelectedAnime = (selectedAnime && currentRouteRef && doesAnimeMatchRouteRef(selectedAnime, currentRouteRef) ? selectedAnime : null)
        || stateAnimeMatch
        || (hasOfflineDownloads ? downloadFallbackAnime : null)
        || selectedAnime;

    // The page remains mounted while search navigation changes the route. Never
    // paint the prior title's hero/poster while the new title is resolving.
    if (!activeSelectedAnime || (!isVaultAnimeRoute && !hasOfflineDownloads && (!currentRouteRef || !doesAnimeMatchRouteRef(activeSelectedAnime, currentRouteRef)))) {
        return <DetailsPageSkeleton />;
    }

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

    const displayAnime = activeSeasonAnime || activeSelectedAnime || selectedAnime;

    const hasResolvedTitle = Boolean(
        displayAnime.title?.trim() ||
        displayAnime.title_english?.trim() ||
        displayAnime.title_romaji?.trim() ||
        displayAnime.title_japanese?.trim()
    );
    const hasResolvedArtwork = Boolean(
        displayAnime.images?.jpg?.large_image_url?.trim() ||
        displayAnime.images?.jpg?.image_url?.trim() ||
        displayAnime.anilist_banner_image?.trim()
    );
    const hasResolvedDescription = Boolean(
        displayAnime.synopsis?.trim()
    );
    const shouldShowPrimarySkeleton = !hasOfflineDownloads &&
        (!hasResolvedTitle && !hasResolvedArtwork);

    if (shouldShowPrimarySkeleton) {
        return <DetailsPageSkeleton />;
    }

    const isUnreleased = displayAnime.status === 'NOT_YET_RELEASED';
    const activeEpParam = searchParams.get('ep');
    const isMovie = isMovieAnime(displayAnime);
    
    const handleSeasonChipClick = async (season: SeasonChip) => {
        if (season.isActive) return;

        if (season.source === 'mapping') {
            const targetId = Number(season.anilistId || season.id);
            if (!targetId) return;
            const fallbackBaseAnime = selectedAnime || activeSelectedAnime;
            const seasonAnime = season.anime
                || (fallbackBaseAnime && Number(fallbackBaseAnime.id || 0) === targetId ? fallbackBaseAnime : null)
                || await animeService.getAniListSeasonDetails(targetId).catch(() => null);
            const canonicalTitle = seasonAnime?.title_english
                || seasonAnime?.title
                || season.title
                || season.label;
            const baseAnime = seasonAnime || fallbackBaseAnime;
            const targetAnime: Anime = {
                ...(baseAnime || {}),
                id: targetId,
                mal_id: Number(seasonAnime?.mal_id || 0),
                source: 'anilist',
                tmdbId: selectedTmdbId || Number((seasonAnime as (Anime & { tmdbId?: number }) | null)?.tmdbId || 0) || undefined,
                mappingId: targetId,
                scraperId: undefined,
                title: canonicalTitle,
                title_english: seasonAnime?.title_english || canonicalTitle,
                images: baseAnime?.images || { jpg: { image_url: '', large_image_url: '' } },
                episodes: Number(season.count || 0) || baseAnime?.episodes || null,
            } as Anime;
            handleAnimeClickRef.current(targetAnime);
            const nextParams = new URLSearchParams(searchParams);
            nextParams.delete('ep');
            nextParams.delete('t');
            nextParams.delete('season');
            nextParams.set('map', String(season.id));
            const destinationId = buildAnimeRouteId({ source: 'anilist', id: targetId });
            navigate(`/anime/details/${destinationId}${nextParams.size ? `?${nextParams}` : ''}`, {
                state: {
                    ...location.state,
                    anime: targetAnime,
                    preventScrollTop: true,
                    seasonChips: seasonChips.map((chip) => ({
                        ...chip,
                        isActive: Number(chip.anilistId || chip.id) === targetId,
                    })),
                },
            });
            return;
        }
        
        if (season.source === 'tmdb') {
            setSelectedTmdbSeason({ activeId: activeSeasonId, seasonNumber: season.tmdbSeasonNumber || season.id });
            updateSearchParams({}); // Clear active episode when switching TMDB seasons
            return;
        }

        const targetId = season.anilistId || season.id;
        if (!targetId || targetId <= 0) return;
        const targetAnime = season.anime || ({
            id: targetId,
            mal_id: 0,
            source: 'anilist',
            title: season.title,
            images: { jpg: { image_url: '', large_image_url: '' } },
        } as Anime);

        // The selected franchise entry owns a different scraper session and
        // episode list; retaining the previous series mixes their totals/media.
        handleAnimeClickRef.current(targetAnime);

        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('ep');
        nextParams.delete('t');
        nextParams.delete('season');
        nextParams.delete('map');

        const destinationId = buildAnimeRouteId({ source: 'anilist', id: targetId });
        navigate(`/anime/details/${destinationId}${nextParams.size ? `?${nextParams}` : ''}`, {
            state: {
                ...location.state,
                anime: targetAnime,
                preventScrollTop: true,
                seasonChips: seasonChips.map((chip) => ({
                    ...chip,
                    isActive: Number(chip.anilistId || chip.id) === targetId,
                })),
            },
        });
    };

    const activeChip = activeDisplayChip;
    const activeMappingIndex = activeMappingChip
        ? mappingSeasonChips.findIndex((chip) => chip.id === activeMappingChip.id)
        : -1;
    const mappingPlaybackOffset = activeMappingIndex >= 0 && activeMappingSegments.length > 0
        ? Math.max(0, Math.min(...activeMappingSegments.map((segment) =>
            segment.tmdbEpisodeStart - segment.localEpisodeStart
        )))
        : 0;
    const activeMappingEpisodeCount = Number(activeMappingChip?.count || activeChip?.count || 0);
    const hasCombinedMappingSession = mappingPlaybackOffset > 0 && activeMappingEpisodeCount > 0 &&
        episodes.length >= mappingPlaybackOffset + activeMappingEpisodeCount;
    const mappingProviderOffset = hasCombinedMappingSession ? mappingPlaybackOffset : 0;
    const mappedTmdbEpisodes = mappedTmdbEpisodesState.key === mappedTmdbEpisodesKey
        ? mappedTmdbEpisodesState.episodes
        : [];
    const mappedTmdbEpisodesLoading = Boolean(mappedTmdbEpisodesKey) && (
        mappedTmdbEpisodesState.key !== mappedTmdbEpisodesKey || mappedTmdbEpisodesState.loading
    );
    const hasCompleteMappedTmdbEpisodes = activeMappingEpisodeCount <= 0
        || mappedTmdbEpisodes.length >= activeMappingEpisodeCount;
    const hasTmdbMetadataSource = Boolean(tmdbDetails?.tmdbId && (
        requestedTmdbSeasonNumber || activeMappingSegments.length > 0
    ));
    const tmdbEpisodesForDisplay = activeChip?.isVirtual && activeChip.offset !== undefined && activeChip.count !== undefined
        ? tmdbEpisodes.slice(activeChip.offset, activeChip.offset + activeChip.count)
        : tmdbEpisodes;
    const firstTmdbEpNumber = tmdbEpisodesForDisplay[0]?.episode_number || 1;
    const isTmdbAbsoluteNumbering = firstTmdbEpNumber > 1 && (activeChip?.offset || 0) > 0 && firstTmdbEpNumber >= (activeChip?.offset || 0) * 0.5;

    const tmdbInstantEpisodes: NormalizedEpisode[] = tmdbEpisodesForDisplay.map((episode, index) => {
        const displayNumber = activeChip?.isVirtual ? index + 1 : episode.episode_number;
        const isSeparateAniListSeason = activeChip?.source === 'anilist' && displayChips.length > 1;
        const absoluteEpisodeNumber = activeChip?.isVirtual || isTmdbAbsoluteNumbering || isSeparateAniListSeason
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
    const mappedTmdbInstantEpisodes: NormalizedEpisode[] = mappedTmdbEpisodes.map((mapped) => {
        const thumbnail = tmdbService.imgUrl(mapped.metadata.still_path, 'original');
        return {
            session: `tmdb-map:${tmdbDetails?.tmdbId || 'unknown'}:${mapped.tmdbSeason}:${mapped.tmdbEpisode}`,
            episodeNumber: String(mapped.localEpisode),
            title: mapped.metadata.name || `Episode ${mapped.localEpisode}`,
            overview: mapped.metadata.overview,
            thumbnail,
            snapshot: thumbnail,
            airDate: mapped.metadata.air_date,
            tmdbSeason: mapped.tmdbSeason,
            tmdbEpisode: mapped.tmdbEpisode,
            playbackEpisodeNumber: mappingProviderOffset + mapped.localEpisode,
        };
    });
    const effectiveSelectedAnime = selectedAnime || activeSelectedAnime;
    const selectedEpisodeOwnerKey = effectiveSelectedAnime ? getCanonicalAnimeKey(effectiveSelectedAnime) : '';
    const selectedMappingId = Number(effectiveSelectedAnime?.mappingId || 0);
    const selectedEpisodeRequestKey = selectedEpisodeOwnerKey && selectedMappingId > 0
        ? `${selectedEpisodeOwnerKey}:mapping:${selectedMappingId}`
        : selectedEpisodeOwnerKey;
    const expectedEpisodeOwnerKey = activeAniListSeasonId > 0
        ? getCanonicalAnimeKey({ id: activeAniListSeasonId, source: 'anilist' })
        : (requestedSeasonId > 0
            ? getCanonicalAnimeKey({ id: requestedSeasonId, source: 'anilist' })
            : selectedEpisodeRequestKey);
    const episodesBelongToActiveSeason = Boolean(
        expectedEpisodeOwnerKey && episodesAnimeKey === expectedEpisodeOwnerKey
    );
    const activeInstantEpisodes = activeAniListSeasonId > 0
        ? buildInstantEpisodes(displayAnime, Number(activeChip?.count || displayAnime.episodes || 0) || undefined, episodeMeta)
        : instantEpisodes;
    const baseScraperEpisodes = normalizeScraperEpisodes(
        episodesBelongToActiveSeason && episodes.length > 0 ? episodes : activeInstantEpisodes
    );

    // When active chip is an AniList season or multiple season chips are visible,
    // cap scraper episodes to this anime's own episode count (from AniList metadata).
    const scraperEpisodeCap = Number(activeChip?.count || 0) || Number(displayAnime.episodes || 0) || Number(displayAnime.latestEpisode || 0);
    const mappedBaseScraperEpisodes = activeChip?.source === 'mapping' && scraperEpisodeCap > 0 && hasCombinedMappingSession
        ? baseScraperEpisodes
            .slice(mappingPlaybackOffset, mappingPlaybackOffset + scraperEpisodeCap)
            .map((episode, index) => ({
                ...episode,
                episodeNumber: String(index + 1),
                playbackEpisodeNumber: Number(episode.playbackEpisodeNumber || episode._tmdbAbsolute || mappingPlaybackOffset + index + 1),
            }))
        : baseScraperEpisodes;
    const cappedBaseScraperEpisodes = scraperEpisodeCap > 0 && mappedBaseScraperEpisodes.length > scraperEpisodeCap
        ? mappedBaseScraperEpisodes.slice(0, scraperEpisodeCap)
        : mappedBaseScraperEpisodes;

    const usingTmdbEpisodes = Boolean(
        hasTmdbMetadataSource &&
        (activeChip?.source === 'mapping' ? mappedTmdbInstantEpisodes.length > 0 : tmdbInstantEpisodes.length > 0) &&
        (activeChip?.source !== 'mapping' || hasCompleteMappedTmdbEpisodes) &&
        (activeChip?.source === 'mapping' || !episodesBelongToActiveSeason || episodes.length === 0 || activeChip?.source === 'tmdb' || activeChip?.isVirtual)
    );
    let visibleEpisodes = usingTmdbEpisodes
        ? (activeChip?.source === 'mapping' ? mappedTmdbInstantEpisodes : tmdbInstantEpisodes)
        : cappedBaseScraperEpisodes;

    const tmdbEpisodeFallbacks = new Map(
        (activeChip?.source === 'mapping' ? mappedTmdbInstantEpisodes : tmdbInstantEpisodes)
            .map((episode) => [Number(episode.episodeNumber), episode])
    );

    const fallbackCover = activeChip?.anime?.images?.jpg?.large_image_url
        || activeChip?.anime?.images?.jpg?.image_url
        || displayAnime.images?.jpg?.large_image_url
        || displayAnime.images?.jpg?.image_url
        || displayAnime.anilist_cover_image
        || '';
    visibleEpisodes = visibleEpisodes.map((ep, idx) => {
        const epNum = Number(ep.episodeNumber) || (idx + 1);
        const absEpNum = ep.playbackEpisodeNumber || ep._tmdbAbsolute || epNum;
        const tmdbFallback = tmdbEpisodeFallbacks.get(epNum);
        const isTmdbSeasonEpisode = usingTmdbEpisodes;
        const meta = isTmdbSeasonEpisode
            ? episodeMeta?.absoluteEpisodes.get(absEpNum)
            : episodeMeta?.episodes.get(epNum)
                || episodeMeta?.absoluteEpisodes.get(absEpNum)
                || episodeMeta?.episodes.get(absEpNum);

        const isGenericTitle = !ep.title ||
            ep.title.trim().toLowerCase() === 'untitled' ||
            /^episode\s+\d+(?:\.\d+)?$/i.test(ep.title.trim()) ||
            ep.title.trim() === String(epNum);

        const title = isGenericTitle && (meta?.title || tmdbFallback?.title)
            ? (meta?.title || tmdbFallback?.title || `Episode ${ep.episodeNumber}`)
            : (ep.title || meta?.title || `Episode ${ep.episodeNumber}`);

        // When AniZip metadata is available, prefer AniZip screencaps or anime poster.
        // Scraper snapshots are low-quality with burned-in subtitles — skip them.
        // Only use scraper thumbnails as last resort when AniZip data hasn't loaded.
        const isHighQualitySrc = ep.thumbnail && (
            ep.thumbnail.includes('image.tmdb.org') || ep.thumbnail.includes('artworks.thetvdb.com')
        );
        const thumbnail = (isTmdbSeasonEpisode && isHighQualitySrc ? ep.thumbnail : null)
            || meta?.thumbnail
            || (isHighQualitySrc ? ep.thumbnail : null)
            || tmdbFallback?.thumbnail
            || tmdbFallback?.snapshot
            || ep.thumbnail
            || ep.snapshot
            || fallbackCover;
        const snapshot = thumbnail;
        const overview = ep.overview || meta?.overview || tmdbFallback?.overview;
        const airDate = ep.airDate || meta?.airDate || tmdbFallback?.airDate;

        return {
            ...ep,
            title,
            thumbnail,
            snapshot,
            overview,
            airDate,
        };
    });

    visibleEpisodes = filterReleasedEpisodes(visibleEpisodes, {
        status: displayAnime.status,
        latestEpisode: displayAnime.latestEpisode,
        nextAiringEpisodeNumber: displayAnime.nextAiringEpisode?.episode,
    });

    // anime identifier and title for download checks handled above

// matchingDownloads and isFromDownloads defined above

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
    const isTmdbEpisodesResolving = hasTmdbMetadataSource && (
        activeChip?.source === 'mapping' ? mappedTmdbEpisodesLoading : tmdbEpisodesLoading
    ) && !hasEpisodes;
    const isActiveSeasonEpisodesResolving = Boolean(
        expectedEpisodeOwnerKey &&
        !episodesBelongToActiveSeason &&
        (epLoading || detailsLoading || episodesBackgroundLoading || !episodesResolved)
    );
    const isEpisodesResolving = !hasOfflineDownloads && (isTmdbEpisodesResolving || isActiveSeasonEpisodesResolving || (!hasTmdbMetadataSource && !hasEpisodes && (!episodesResolved || epLoading || detailsLoading || episodesBackgroundLoading)));
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
    const expectedEpisodeCount = activeChip?.count || Number(displayAnime.episodes || 0);
    const episodeSkeletonCount = Math.min(
        20,
        Math.max(10, Number.isFinite(expectedEpisodeCount) && expectedEpisodeCount > 0 ? expectedEpisodeCount : 10)
    );

    return (
        <div className="anime-details-page relative z-[2] min-h-screen bg-[#0a0a0a] pb-20 fade-in animate-in duration-300">
            {!searchParams.get('ep') && <div
                className={`fixed inset-x-0 top-0 z-40 md:hidden border-b transition-colors duration-300 ${compactToolbar ? 'border-purple-400/15 bg-[#24202b]/95 backdrop-blur-xl' : 'border-transparent bg-transparent'}`}
                style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
            >
                <div className="flex h-14 items-center gap-3 px-4">
                    <button type="button" onClick={handleBack} className="grid h-10 w-10 shrink-0 place-items-center text-white/90" aria-label="Go back">
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div className={`min-w-0 flex-1 truncate text-[20px] font-semibold text-white/90 transition-opacity duration-300 ${compactToolbar ? 'opacity-100' : 'opacity-0'}`}>
                        {displayAnime.title_english || displayAnime.title}
                    </div>
                    <button type="button" onClick={() => window.dispatchEvent(new Event('yorumi:anime:toggle-sort'))} className="grid h-10 w-10 shrink-0 place-items-center text-white/85" aria-label="Reverse episode order">
                        <ArrowUpDown className="h-5 w-5" />
                    </button>
                    <button type="button" onClick={() => window.dispatchEvent(new Event('yorumi:anime:toggle-view'))} className="grid h-10 w-10 shrink-0 place-items-center text-white/85" aria-label="Toggle episode view">
                        <Grid2X2 className="h-5 w-5" />
                    </button>
                    <button type="button" onClick={() => window.dispatchEvent(new Event('yorumi:anime:download-all'))} className="grid h-10 w-10 shrink-0 place-items-center text-white/85" aria-label="Download episodes">
                        <Download className="h-5 w-5" />
                    </button>
                </div>
            </div>}
            {/* Banner Section */}
            <DetailsHero anime={displayAnime} breadcrumbParent={breadcrumbParent} />

            {/* Content Section */}
            <div className="max-w-7xl mx-auto px-4 sm:px-8 md:px-14 -mt-20 md:-mt-32 relative z-10">
                <DetailsInfo
                    anime={displayAnime}
                    episodesCount={activeChip?.source === 'anilist' && Number(displayAnime.episodes || 0) > 0
                        ? Number(displayAnime.episodes)
                        : visibleEpisodes.length}
                    isLoading={isEpisodesResolving}
                    inList={inList}
                    inFavorites={inFavorites}
                    onWatch={() => {
                        updateSearchParams({ ep: '1' });
                        if (!isNativeMobile()) scrollToPlayer();
                    }}
                    onToggleList={handleToggleList}
                    onToggleFavorite={handleToggleFavorite}
                    onBack={handleBack}
                >
                    {activeEpParam && playbackAnimeId ? (
                        <DetailsVideoPlayer 
                            animeId={playbackAnimeId}
                            animeTitle={displayAnime.title}
                            onClose={() => updateSearchParams({})}
                            isWatched={Boolean(activeEpisodeWatchKey && watchedEpisodes.has(activeEpisodeWatchKey))}
                            isResolvingEpisode={isPlayerResolvingEpisode}
                            fallbackEpisode={activeVisibleEpisode}
                            prevEpisode={prevVisibleEpisode}
                            nextEpisode={nextVisibleEpisode}
                            episodes={visibleEpisodes}
                            onEpisodeSelect={(episode) => {
                                updateSearchParams({ ep: String(getPlaybackEpisodeNumber(episode)) });
                            }}
                            onMarkWatched={() => {
                                if (activeEpisodeWatchKey) toggleEpisodeComplete(activeEpisodeWatchKey);
                            }}
                        />
                    ) : null}

                    {!isUnreleased && (
                        <DetailsEpisodeGrid
                            episodes={visibleEpisodes}
                            watchedEpisodes={watchedEpisodes}
                            activeEpParam={activeEpParam}
                            seasonChips={displayChips}
                            isLoading={isEpisodesResolving}
                            skeletonCount={episodeSkeletonCount}
                            fallbackCoverImage={displayAnime.images?.jpg?.large_image_url || displayAnime.images?.jpg?.image_url || displayAnime.anilist_cover_image || ''}
                            animeId={animeId}
                            animeTitle={displayAnime.title}
                            animeImage={displayAnime.images?.jpg?.large_image_url || displayAnime.images?.jpg?.image_url || displayAnime.anilist_cover_image || ''}
                            scraperSession={displayAnime.title}
                            anilistId={displayAnime.id}
                            isMovie={isMovie}
                            onSeasonClick={handleSeasonChipClick}
                            onEpisodeClick={(ep) => {
                                const playbackEpisodeNumber = getPlaybackEpisodeNumber(ep);
                                updateSearchParams({ ep: String(playbackEpisodeNumber) });
                                if (!isNativeMobile()) scrollToPlayer();
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

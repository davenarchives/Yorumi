import { createContext, useContext, useState, useRef, useEffect, type ReactNode } from 'react';
import type { Anime, Episode } from '../types/anime';
import { animeService } from '../services/animeService';
import { useContinueWatching } from '../hooks/useContinueWatching';
import { normalizeEpisodeHistoryKey, storage, type EpisodeHistoryKey } from '../utils/storage';
import { preloadLogos } from '../components/anime/AnimeLogoImage';
import { useAuth } from './AuthContext';
import { getDisplayImageUrl } from '../utils/image';
import { isSupportedScraperSessionId } from '../utils/animeNavigation';
import { setLocalStorageWithCleanup } from '../utils/localStorageQuota';

interface AnimeContextType {
    // State
    topAnime: Anime[];
    spotlightAnime: Anime[];
    latestUpdates: Anime[];
    trendingAnime: Anime[];
    popularSeason: Anime[];
    popularMonth: Anime[];
    topTenToday: Anime[];
    topTenWeek: Anime[];
    topTenMonth: Anime[];
    selectedAnime: Anime | null;
    showAnimeDetails: boolean;
    showWatchModal: boolean;
    episodes: Episode[];
    scraperSession: string | null;
    epLoading: boolean;
    episodesResolved: boolean;
    episodesBackgroundLoading: boolean;
    detailsLoading: boolean;
    loading: boolean;
    spotlightLoading: boolean;
    latestUpdatesLoading: boolean;
    trendingLoading: boolean;
    popularSeasonLoading: boolean;
    popularMonthLoading: boolean;
    topTenLoading: boolean;
    currentPage: number;
    lastVisiblePage: number;
    error: string | null;
    episodeSearchQuery: string;

    // View All State
    viewAllAnime: Anime[];
    viewAllLoading: boolean;
    viewAllPagination: {
        last_visible_page: number;
        current_page: number;
        has_next_page: boolean;
    };
    viewMode: 'default' | 'latest' | 'trending' | 'seasonal' | 'continue_watching' | 'popular';

    // Actions
    setEpisodeSearchQuery: (query: string) => void;
    handleAnimeClick: (anime: Anime) => Promise<void>;
    startWatching: () => void;
    watchAnime: (anime: Anime) => void;
    closeDetails: () => void;
    closeWatch: () => void;
    closeAllModals: () => void;
    changePage: (page: number) => void;
    openViewAll: (type: 'latest' | 'trending' | 'seasonal' | 'continue_watching' | 'popular') => void;
    closeViewAll: () => void;
    changeViewAllPage: (page: number) => void;
    loadMoreViewAll: () => void;
    prefetchEpisodes: (anime: Anime) => void;
    prefetchPage: (page: number) => void;
    fetchHomeData: () => Promise<void>;

    // Continue Watching
    continueWatchingList: any[];
    saveProgress: (
        anime: Anime,
        episode: any,
        playback?: { positionSeconds?: number; durationSeconds?: number }
    ) => void;
    removeFromHistory: (malId: number | string) => void;

    // Episode Tracking
    watchedEpisodes: Set<EpisodeHistoryKey>;
    markEpisodeComplete: (episodeKey: number | string) => void;
    unmarkEpisodeComplete: (episodeKey: number | string) => void;
    toggleEpisodeComplete: (episodeKey: number | string) => void;
}

const AnimeContext = createContext<AnimeContextType | undefined>(undefined);

export function AnimeProvider({ children }: { children: ReactNode }) {
    const { continueWatchingList, saveProgress, removeFromHistory } = useContinueWatching();
    const { user } = useAuth();

    // Cache reader (defined early so useState initializers can use it)
    const HOME_CACHE_PREFIX = 'yorumi_home_cache_v28';
    const HOME_LATEST_MIN_ITEMS = 10;
    const readHomeCache = <T,>(key: string, ttlMs: number): T | null => {
        try {
            const raw = localStorage.getItem(`${HOME_CACHE_PREFIX}:${key}`);
            if (!raw) return null;
            const parsed = JSON.parse(raw) as { timestamp: number; data: T };
            if (!parsed || typeof parsed.timestamp !== 'number') return null;
            if (Date.now() - parsed.timestamp > ttlMs) return null;
            return parsed.data;
        } catch {
            return null;
        }
    };

    // TTL constants for cache hydration
    const HOME_TTL_TOPTEN = 10 * 60 * 1000;
    const HOME_TTL_SPOTLIGHT = 10 * 60 * 1000;
    const HOME_TTL_LATEST = 10 * 60 * 1000;
    const HOME_TTL_TRENDING = 10 * 60 * 1000;
    const HOME_TTL_SEASON = 10 * 60 * 1000;
    const HOME_TTL_MONTH = 10 * 60 * 1000;

    // Synchronous cache hydration for instant first render
    const cachedTopTenInit = readHomeCache<{ day: Anime[]; week: Anime[]; month: Anime[] }>('top-ten', HOME_TTL_TOPTEN);
    const cachedSpotlightInit = readHomeCache<Anime[]>('spotlight', HOME_TTL_SPOTLIGHT);
    const cachedLatestInit = readHomeCache<Anime[]>('latest-updates', HOME_TTL_LATEST);
    const cachedTrendingInit = readHomeCache<Anime[]>('trending', HOME_TTL_TRENDING);
    const cachedSeasonInit = readHomeCache<Anime[]>('popular-season', HOME_TTL_SEASON);
    const cachedMonthInit = readHomeCache<Anime[]>('popular-month', HOME_TTL_MONTH);

    // Data State — pre-filled from cache when available
    const [topAnime, setTopAnime] = useState<Anime[]>([]);
    const [spotlightAnime, setSpotlightAnime] = useState<Anime[]>(cachedSpotlightInit ?? []);
    const [latestUpdates, setLatestUpdates] = useState<Anime[]>(cachedLatestInit ?? []);
    const [trendingAnime, setTrendingAnime] = useState<Anime[]>(cachedTrendingInit ?? []);
    const [popularSeason, setPopularSeason] = useState<Anime[]>(cachedSeasonInit ?? []);
    const [popularMonth, setPopularMonth] = useState<Anime[]>(cachedMonthInit ?? []);
    const [topTenToday, setTopTenToday] = useState<Anime[]>(cachedTopTenInit?.day ?? []);
    const [topTenWeek, setTopTenWeek] = useState<Anime[]>(cachedTopTenInit?.week ?? []);
    const [topTenMonth, setTopTenMonth] = useState<Anime[]>(cachedTopTenInit?.month ?? []);
    const [selectedAnime, setSelectedAnime] = useState<Anime | null>(null);
    const [watchedEpisodes, setWatchedEpisodes] = useState<Set<EpisodeHistoryKey>>(new Set());

    // UI State (Modals - Kept for compatibility but might not be used in page router mainly)
    const [showAnimeDetails, setShowAnimeDetails] = useState(false);
    const [showWatchModal, setShowWatchModal] = useState(false);

    // Loading States — false when cache provided data
    const [loading, setLoading] = useState(true);
    const [spotlightLoading, setSpotlightLoading] = useState(!cachedSpotlightInit?.length);
    const [latestUpdatesLoading, setLatestUpdatesLoading] = useState(!cachedLatestInit?.length);
    const [trendingLoading, setTrendingLoading] = useState(!cachedTrendingInit?.length);
    const [popularSeasonLoading, setPopularSeasonLoading] = useState(!cachedSeasonInit?.length);
    const [popularMonthLoading, setPopularMonthLoading] = useState(!cachedMonthInit?.length);
    const [topTenLoading, setTopTenLoading] = useState(
        !(cachedTopTenInit?.day?.length && cachedTopTenInit?.week?.length && cachedTopTenInit?.month?.length)
    );
    const [error, setError] = useState<string | null>(null);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [lastVisiblePage, setLastVisiblePage] = useState(1);

    // Episode State
    const [episodes, setEpisodes] = useState<Episode[]>([]);
    const [scraperSession, setScraperSession] = useState<string | null>(null);
    const [epLoading, setEpLoading] = useState(false);
    const [episodesResolved, setEpisodesResolved] = useState(false);
    const [episodesBackgroundLoading, setEpisodesBackgroundLoading] = useState(false);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [episodeSearchQuery, setEpisodeSearchQuery] = useState('');

    // View All State
    const [viewMode, setViewMode] = useState<'default' | 'latest' | 'trending' | 'seasonal' | 'continue_watching' | 'popular'>('default');
    const [viewAllAnime, setViewAllAnime] = useState<Anime[]>([]);
    const [viewAllLoading, setViewAllLoading] = useState(false);
    const [viewAllPagination, setViewAllPagination] = useState({
        last_visible_page: 1,
        current_page: 1,
        has_next_page: false
    });
    const viewAllFetchInFlightRef = useRef(false);

    const normalizeScraperId = (value: unknown): string => {
        const raw = String(value ?? '').trim();
        if (!raw) return '';
        const normalized = raw
            .replace(/^s:/i, '')
            .replace(/^https?:\/\/[^/]+/i, '')
            .replace(/^\/+/, '')
            .replace(/^watch\//i, '')
            .trim();
        if (!normalized) return '';
        return /^\d+$/.test(normalized) ? '' : normalized;
    };
    const toPositiveNumber = (value: unknown): number => {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    };
    const getPreferredDetailsId = (target: Partial<Anime> | null | undefined): string | number | undefined => {
        const anilistId = toPositiveNumber(target?.id);
        if (anilistId > 0) return anilistId;

        const malId = toPositiveNumber(target?.mal_id);
        if (malId > 0) return malId;

        const scraperId = normalizeScraperId(target?.scraperId);
        return scraperId ? `s:${scraperId}` : undefined;
    };
    const extractDirectScraperSession = (value: unknown): string => normalizeScraperId(value);
    const getAnimeCacheKey = (target: Anime): string | null => {
        const aid = Number(target?.id);
        if (Number.isFinite(aid) && aid > 0) return `anilist:${aid}`;
        const mal = Number(target?.mal_id);
        if (Number.isFinite(mal) && mal > 0) return `mal:${mal}`;
        const sid = normalizeScraperId(target?.scraperId);
        if (sid) return `scraper:${sid}`;
        return null;
    };
    const normalizeEpisodeNumber = (value: unknown, fallbackIndex: number): string => {
        if (typeof value === 'number' && Number.isFinite(value)) return String(value);
        const raw = String(value ?? '').trim();
        if (!raw) return String(fallbackIndex + 1);
        const direct = Number(raw);
        if (Number.isFinite(direct)) return String(direct);
        const match = raw.match(/(\d+(?:\.\d+)?)/);
        return match ? String(Number(match[1])) : String(fallbackIndex + 1);
    };
    const normalizeEpisodeSession = (value: unknown): string => {
        const raw = String(value ?? '').trim();
        if (!raw) return '';

        let decoded = raw;
        try {
            decoded = decodeURIComponent(decoded);
        } catch {
            // keep raw
        }
        try {
            decoded = decodeURIComponent(decoded);
        } catch {
            // already decoded
        }

        const pairMatch = decoded.match(/([^?#]+)\?ep=([^&#]+)/i);
        if (pairMatch?.[1] && pairMatch?.[2]) {
            const base = pairMatch[1].trim().replace(/\/+$/, '');
            const ep = pairMatch[2].trim();
            return `${base}?ep=${ep}`;
        }

        const stripped = decoded.split('#')[0].split('?')[0].trim();
        const noTrailingSlash = stripped.replace(/\/+$/, '');
        if (!noTrailingSlash) return raw;
        const lastSegment = noTrailingSlash.split('/').pop() || noTrailingSlash;
        return lastSegment.trim() || raw;
    };
    const normalizeEpisodesList = (input: unknown[]): Episode[] => {
        if (!Array.isArray(input)) return [];
        const seen = new Set<string>();
        const normalized: Episode[] = [];
        const parseSortableEpisodeNumber = (value: string): number => {
            const parsed = Number(value);
            if (Number.isFinite(parsed)) return parsed;
            const match = String(value).match(/(\d+(?:\.\d+)?)/);
            return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
        };

        input.forEach((item: any, index) => {
            const rawSession =
                item?.session ??
                item?.episodeId ??
                item?.id ??
                item?.ep_id ??
                item?.slug ??
                item?.url ??
                item?.link;
            const session = normalizeEpisodeSession(rawSession);
            if (!session || seen.has(session)) return;

            const episodeNumber = normalizeEpisodeNumber(
                item?.episodeNumber ?? item?.number ?? item?.episode ?? item?.ep,
                index
            );
            if (!episodeNumber) return;

            normalized.push({
                session,
                episodeNumber,
                title: typeof item?.title === 'string'
                    ? item.title
                    : (typeof item?.name === 'string' ? item.name : undefined),
                duration: typeof item?.duration === 'string'
                    ? item.duration
                    : (typeof item?.duration === 'number' ? String(item.duration) : undefined),
                snapshot: typeof item?.snapshot === 'string'
                    ? getDisplayImageUrl(item.snapshot)
                    : undefined,
            });
            seen.add(session);
        });

        return normalized.sort((a, b) => {
            const episodeDiff = parseSortableEpisodeNumber(a.episodeNumber) - parseSortableEpisodeNumber(b.episodeNumber);
            if (episodeDiff !== 0) return episodeDiff;
            return a.session.localeCompare(b.session);
        });
    };
    const writeHomeCache = (key: string, data: unknown) => {
        try {
            setLocalStorageWithCleanup(
                `${HOME_CACHE_PREFIX}:${key}`,
                JSON.stringify({ timestamp: Date.now(), data })
            );
        } catch {
            // Ignore localStorage quota errors.
        }
    };

    // SessionStorage-backed episode cache (survives in-app navigation)
    const EPISODE_CACHE_PREFIX = 'yorumi_ep_cache_v4';
    const readEpisodeSessionCache = (animeKey: string): { session: string; episodes: Episode[] } | null => {
        try {
            const raw = sessionStorage.getItem(`${EPISODE_CACHE_PREFIX}:${animeKey}`);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed?.session || !Array.isArray(parsed?.episodes) || parsed.episodes.length === 0) return null;
            const session = extractDirectScraperSession(parsed.session);
            if (!session) {
                sessionStorage.removeItem(`${EPISODE_CACHE_PREFIX}:${animeKey}`);
                return null;
            }
            // Expire after 30 minutes
            if (typeof parsed.timestamp === 'number' && Date.now() - parsed.timestamp > 30 * 60 * 1000) return null;
            return { session, episodes: parsed.episodes };
        } catch {
            return null;
        }
    };
    const writeEpisodeSessionCache = (animeKey: string, session: string, episodes: Episode[]) => {
        const normalizedSession = extractDirectScraperSession(session);
        if (!normalizedSession) return;
        try {
            sessionStorage.setItem(
                `${EPISODE_CACHE_PREFIX}:${animeKey}`,
                JSON.stringify({ session: normalizedSession, episodes, timestamp: Date.now() })
            );
        } catch {
            // Ignore sessionStorage quota errors
        }
    };

    const getExpectedEpisodeCount = (anime: Anime) => {
        const latestEpisode = Number(anime.latestEpisode || 0);
        if (latestEpisode > 0) return latestEpisode;

        const status = String(anime.status || '').toUpperCase();
        if (status === 'RELEASING' || status === 'NOT_YET_RELEASED') return 0;

        return Number(anime.episodes || 0);
    };

    const getAnimeSeasonNumber = (anime: Partial<Anime> | null | undefined) => {
        const titles = [
            anime?.title,
            anime?.title_english,
            anime?.title_romaji,
            anime?.title_japanese,
        ]
            .map((value) => String(value || '').trim())
            .filter(Boolean);

        for (const title of titles) {
            const match =
                title.match(/\bseason\s*(\d+)\b/i) ||
                title.match(/\b(\d+)(st|nd|rd|th)\s*season\b/i);
            const value = Number(match?.[1] || '');
            if (Number.isFinite(value) && value > 0) return value;
        }

        return 1;
    };

    const trimEpisodesForAnime = (anime: Anime, episodeList: Episode[]) => {
        const expectedEpisodes = getExpectedEpisodeCount(anime);
        if (expectedEpisodes <= 0) {
            if (String(anime.type || '').toUpperCase() !== 'MOVIE') return [];
            return episodeList.slice(0, 1).map((episode) => ({
                ...episode,
                episodeNumber: '1',
                _tmdbAbsolute: Number(episode._tmdbAbsolute || episode.episodeNumber || 1),
            }));
        }
        if (episodeList.length <= expectedEpisodes) return episodeList;

        const seasonNumber = getAnimeSeasonNumber(anime);
        if (seasonNumber <= 1) {
            return episodeList.slice(0, expectedEpisodes);
        }

        const parsedNumbers = episodeList
            .map((episode) => {
                const parsed = Number(episode.episodeNumber);
                return Number.isFinite(parsed) ? parsed : NaN;
            })
            .filter((value) => Number.isFinite(value));
        
        const maxEpisodeNumber = parsedNumbers.length > 0 ? Math.max(...parsedNumbers) : 0;
        const minEpisodeNumber = parsedNumbers.length > 0 ? Math.min(...parsedNumbers) : 0;

        // If the scraper gave us a massive continuous list (e.g., 1-50) for a franchise,
        // or if it strictly starts at a high absolute number (e.g., 26-50),
        // then we are dealing with absolute numbering and should slice the latest window.
        // BUT if it's just a small list (e.g., 1-12) and we are Season 2, it probably 
        // accidentally mapped to Season 1's session. We should NOT slice from the end.
        const isContinuousList = episodeList.length > expectedEpisodes * 1.5;
        const isAbsoluteChunk = minEpisodeNumber > 1 && maxEpisodeNumber > expectedEpisodes;

        let sliced: Episode[];
        if (isContinuousList || isAbsoluteChunk) {
            sliced = episodeList.slice(-expectedEpisodes);
        } else {
            sliced = episodeList.slice(0, expectedEpisodes);
        }

        return sliced.map((ep, i) => ({
            ...ep,
            _tmdbAbsolute: Number(ep.episodeNumber),
            episodeNumber: String(i + 1),
        }));
    };

    const hasEnoughEpisodes = (anime: Anime, episodeList: Episode[]) => {
        if (!Array.isArray(episodeList) || episodeList.length === 0) return false;
        const expectedEpisodes = getExpectedEpisodeCount(anime);
        if (expectedEpisodes > 0 && episodeList.length < expectedEpisodes) return false;
        return true;
    };

    const hasRenderablePrimaryDetails = (target: Partial<Anime> | null | undefined) => {
        if (!target) return false;
        const title = [
            target.title,
            target.title_english,
            target.title_romaji,
            target.title_japanese,
        ]
            .map((value) => String(value || '').trim())
            .find(Boolean);
        const artwork = [
            target.images?.jpg?.large_image_url,
            target.images?.jpg?.image_url,
            target.anilist_banner_image,
            target.anilist_cover_image,
        ]
            .map((value) => String(value || '').trim())
            .find(Boolean);

        return Boolean(title || artwork);
    };

    const preserveFreshnessHint = (target: Anime, hint: Partial<Anime> | null | undefined): Anime => {
        if (!hint) return target;
        const nextAnime = { ...target } as Anime & { tmdbId?: unknown; tmdb_id?: unknown };
        const hintWithTmdb = hint as Partial<Anime> & { tmdbId?: unknown; tmdb_id?: unknown };
        const hintedTmdbId = Number(hintWithTmdb.tmdbId ?? hintWithTmdb.tmdb_id);
        if (Number.isFinite(hintedTmdbId) && hintedTmdbId > 0) {
            nextAnime.tmdbId = hintedTmdbId;
        }

        if (String(hint.type || '').toUpperCase() === 'MOVIE') {
            nextAnime.type = 'MOVIE';
            if (!nextAnime.episodes || Number(nextAnime.episodes) <= 0) {
                nextAnime.episodes = 1;
            }
        }

        const hintedLatest = Number(hint.latestEpisode || 0);
        const currentLatest = Number(nextAnime.latestEpisode || 0);
        if (hintedLatest > currentLatest) {
            nextAnime.latestEpisode = hintedLatest;
        }

        const hintedScraperId = extractDirectScraperSession(hint.scraperId);
        if (isSupportedScraperSessionId(hintedScraperId)) {
            nextAnime.scraperId = hintedScraperId;
        }

        return nextAnime;
    };

    const hydrateFastDetails = (fastData: any, fallbackAnime: Anime): Anime => {
        const hydratedAnime = (fastData?.data ? { ...fallbackAnime, ...fastData.data } : { ...fallbackAnime }) as Anime;
        const fastSession = String(fastData?.scraperSession || '').trim();
        if (isSupportedScraperSessionId(fastSession)) {
            hydratedAnime.scraperId = fastSession;
        }
        return preserveFreshnessHint(hydratedAnime, fallbackAnime);
    };

    const applyHydratedEpisodes = (targetAnime: Anime, fastData: any) => {
        if (!Array.isArray(fastData?.episodes) || fastData.episodes.length === 0) return false;
        const session = extractDirectScraperSession(fastData?.scraperSession);
        if (!isSupportedScraperSessionId(session)) return false;

        const normalizedFastEpisodes = normalizeEpisodesList(fastData.episodes);
        const nextEpisodes = trimEpisodesForAnime(targetAnime, normalizedFastEpisodes);
        if (nextEpisodes.length === 0) return false;
        if (!hasEnoughEpisodes(targetAnime, nextEpisodes)) return false;

        setEpisodes(nextEpisodes);
        setScraperSession(session);
        if (hasEnoughEpisodes(targetAnime, nextEpisodes)) {
            episodesCache.current.set(session, nextEpisodes);
        }
        const resolvedKey = getAnimeCacheKey(targetAnime);
        if (resolvedKey) {
            scraperSessionCache.current.set(resolvedKey, session);
            if (hasEnoughEpisodes(targetAnime, nextEpisodes)) {
                writeEpisodeSessionCache(resolvedKey, session, nextEpisodes);
            }
        }
        setEpLoading(false);
        setEpisodesResolved(true);
        return true;
    };

    // Caches
    const scraperSessionCache = useRef(new Map<string, string>());
    const episodesCache = useRef(new Map<string, Episode[]>());
    const episodePreloadInFlight = useRef(new Map<string, Promise<{ session: string | null; eps: Episode[] }>>());
    const detailsRequestIdRef = useRef(0);
    const USE_PERSISTED_MAPPING_CACHE = true;

    // --- Actions ---

    const fetchHomeData = async () => {
        const HOME_TTL = {
            spotlight: 10 * 60 * 1000,
            latestUpdates: 10 * 60 * 1000,
            trending: 10 * 60 * 1000,
            popularSeason: 10 * 60 * 1000,
            popularMonth: 10 * 60 * 1000,
            topTen: 10 * 60 * 1000,
        };

        const applyFastHomeData = (fast: any): boolean => {
            let applied = false;
            if (Array.isArray(fast?.spotlightAnime) && fast.spotlightAnime.length > 0) {
                setSpotlightAnime(fast.spotlightAnime);
                setSpotlightLoading(false);
                writeHomeCache('spotlight', fast.spotlightAnime);
                preloadLogos(fast.spotlightAnime.map((a: Anime) => a.id || a.mal_id).filter(Boolean));
                applied = true;
            }
            if (Array.isArray(fast?.latestUpdates) && fast.latestUpdates.length > 0) {
                setLatestUpdates(fast.latestUpdates);
                setLatestUpdatesLoading(false);
                if (fast.latestUpdates.length >= HOME_LATEST_MIN_ITEMS) {
                    writeHomeCache('latest-updates', fast.latestUpdates);
                }
                preloadLogos(fast.latestUpdates.map((a: Anime) => a.id || a.mal_id).filter(Boolean));
                applied = true;
            }
            if (Array.isArray(fast?.trendingAnime) && fast.trendingAnime.length > 0) {
                setTrendingAnime(fast.trendingAnime);
                setTrendingLoading(false);
                writeHomeCache('trending', fast.trendingAnime);
                applied = true;
            }
            if (Array.isArray(fast?.popularSeason) && fast.popularSeason.length > 0) {
                setPopularSeason(fast.popularSeason);
                setPopularSeasonLoading(false);
                writeHomeCache('popular-season', fast.popularSeason);
                applied = true;
            }
            if (Array.isArray(fast?.popularMonth) && fast.popularMonth.length > 0) {
                setPopularMonth(fast.popularMonth);
                setPopularMonthLoading(false);
                writeHomeCache('popular-month', fast.popularMonth);
                applied = true;
            }
            if (Array.isArray(fast?.topTenToday) && Array.isArray(fast?.topTenWeek) && Array.isArray(fast?.topTenMonth)) {
                setTopTenToday(fast.topTenToday);
                setTopTenWeek(fast.topTenWeek);
                setTopTenMonth(fast.topTenMonth);
                setTopTenLoading(false);
                writeHomeCache('top-ten', {
                    day: fast.topTenToday,
                    week: fast.topTenWeek,
                    month: fast.topTenMonth
                });
                applied = true;
            }
            if (Array.isArray(fast?.topAnime) && fast.topAnime.length > 0) {
                setTopAnime(fast.topAnime);
                setLastVisiblePage(fast.topAnimePagination?.last_visible_page || 1);
                setLoading(false);
                applied = true;
            }
            return applied;
        };

        // Instant hydrate from local cache first (never block initial render).
        const cachedSpotlight = readHomeCache<Anime[]>('spotlight', HOME_TTL.spotlight);
        if (cachedSpotlight?.length) {
            setSpotlightAnime(cachedSpotlight);
            setSpotlightLoading(false);
            preloadLogos(cachedSpotlight.map((a: Anime) => a.id || a.mal_id).filter(Boolean));
        }
        const cachedLatest = readHomeCache<Anime[]>('latest-updates', HOME_TTL.latestUpdates);
        if (cachedLatest?.length) {
            setLatestUpdates(cachedLatest);
            setLatestUpdatesLoading(false);
            preloadLogos(cachedLatest.map((a: Anime) => a.id || a.mal_id).filter(Boolean));
        }
        const cachedTrending = readHomeCache<Anime[]>('trending', HOME_TTL.trending);
        if (cachedTrending?.length) {
            setTrendingAnime(cachedTrending);
            setTrendingLoading(false);
        }
        const cachedSeason = readHomeCache<Anime[]>('popular-season', HOME_TTL.popularSeason);
        if (cachedSeason?.length) {
            setPopularSeason(cachedSeason);
            setPopularSeasonLoading(false);
        }
        const cachedMonth = readHomeCache<Anime[]>('popular-month', HOME_TTL.popularMonth);
        if (cachedMonth?.length) {
            setPopularMonth(cachedMonth);
            setPopularMonthLoading(false);
        }
        const cachedTopTen = readHomeCache<{ day: Anime[]; week: Anime[]; month: Anime[] }>('top-ten', HOME_TTL.topTen);
        if (cachedTopTen?.day?.length && cachedTopTen?.week?.length && cachedTopTen?.month?.length) {
            setTopTenToday(cachedTopTen.day);
            setTopTenWeek(cachedTopTen.week);
            setTopTenMonth(cachedTopTen.month);
            setTopTenLoading(false);
        }

        const hasAnimeItems = (items: Anime[] | undefined | null) => Array.isArray(items) && items.length > 0;
        const hasTopTenItems = (fast: any) =>
            Array.isArray(fast?.topTenToday) && fast.topTenToday.length > 0
            && Array.isArray(fast?.topTenWeek) && fast.topTenWeek.length > 0
            && Array.isArray(fast?.topTenMonth) && fast.topTenMonth.length > 0;

        // Try fast bundle with a short budget; don't stall fallback path.
        const fastBundlePromise = animeService.getHomeFastData()
            .then((fast) => {
                applyFastHomeData(fast);
                return fast;
            })
            .catch((error) => {
                console.warn('[AnimeContext] Fast home bundle unavailable, using fallback fetches', error);
                return null;
            });
        const fastBundle = await Promise.race<any | null>([
            fastBundlePromise,
            new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 300)),
        ]);

        const fetchSpotlight = async () => {
            if (spotlightAnime.length > 0) {
                setSpotlightLoading(false);
                return;
            }

            const cached = readHomeCache<Anime[]>('spotlight', HOME_TTL.spotlight);
            if (cached && cached.length > 0) {
                setSpotlightAnime(cached);
                setSpotlightLoading(false);
                preloadLogos(cached.map((a: Anime) => a.id || a.mal_id).filter(Boolean));
            } else {
                setSpotlightLoading(true);
            }

            try {
                const retryDelays = [0, 1000, 2500];
                for (const delay of retryDelays) {
                    if (delay > 0) {
                        await new Promise((resolve) => window.setTimeout(resolve, delay));
                    }

                    try {
                        const { data } = await animeService.getSpotlightAnime();
                        if (data && data.length > 0) {
                            setSpotlightAnime(data);
                            writeHomeCache('spotlight', data);
                            preloadLogos(data.map((a: Anime) => a.id || a.mal_id).filter(Boolean));
                            return;
                        }
                    } catch (e) {
                        if (delay === retryDelays[retryDelays.length - 1]) {
                            console.error('Failed to fetch spotlight', e);
                        }
                    }
                }
            } finally {
                setSpotlightLoading(false);
            }
        };

        const fetchTrending = async () => {
            if (trendingAnime.length > 0) return;
            const cached = readHomeCache<Anime[]>('trending', HOME_TTL.trending);
            if (cached && cached.length > 0) {
                setTrendingAnime(cached);
                setTrendingLoading(false);
                preloadLogos(cached.map((a: Anime) => a.id || a.mal_id).filter(Boolean));
            } else {
                setTrendingLoading(true);
            }
            try {
                const tData = await animeService.getTrendingAnime(1, 24);
                if (tData?.data) {
                    setTrendingAnime(tData.data);
                    writeHomeCache('trending', tData.data);
                    preloadLogos(tData.data.map((a: Anime) => a.id || a.mal_id).filter(Boolean));
                }
            } catch (e) { console.error(e); }
            finally { setTrendingLoading(false); }
        };

        const fetchLatestUpdates = async () => {
            const hasEnoughLatest = latestUpdates.length >= HOME_LATEST_MIN_ITEMS;
            const cached = readHomeCache<Anime[]>('latest-updates', HOME_TTL.latestUpdates);
            if (!hasEnoughLatest && cached && cached.length >= HOME_LATEST_MIN_ITEMS) {
                setLatestUpdates(cached);
                setLatestUpdatesLoading(false);
                preloadLogos(cached.map((a: Anime) => a.id || a.mal_id).filter(Boolean));
            } else if (!hasEnoughLatest) {
                setLatestUpdatesLoading(true);
            }
            try {
                const latestData = await animeService.getLatestUpdates();
                if (latestData?.data) {
                    setLatestUpdates(latestData.data);
                    if (latestData.data.length >= HOME_LATEST_MIN_ITEMS) {
                        writeHomeCache('latest-updates', latestData.data);
                    }
                    preloadLogos(latestData.data.map((a: Anime) => a.id || a.mal_id).filter(Boolean));
                }
            } catch (e) { console.error(e); }
            finally { setLatestUpdatesLoading(false); }
        };

        const fetchPopular = async () => {
            if (popularSeason.length > 0) return;
            const cached = readHomeCache<Anime[]>('popular-season', HOME_TTL.popularSeason);
            if (cached && cached.length > 0) {
                setPopularSeason(cached);
                setPopularSeasonLoading(false);
            } else {
                setPopularSeasonLoading(true);
            }
            try {
                const pData = await animeService.getPopularThisSeason(1, 24);
                if (pData?.data) {
                    setPopularSeason(pData.data);
                    writeHomeCache('popular-season', pData.data);
                }
            } catch (e) { console.error(e); }
            finally { setPopularSeasonLoading(false); }
        };

        const fetchPopularMonth = async () => {
            if (popularMonth.length > 0) return;
            const cached = readHomeCache<Anime[]>('popular-month', HOME_TTL.popularMonth);
            if (cached && cached.length > 0) {
                setPopularMonth(cached);
                setPopularMonthLoading(false);
            } else {
                setPopularMonthLoading(true);
            }
            try {
                const pData = await animeService.getPopularThisMonth(1, 24);
                if (pData?.data) {
                    setPopularMonth(pData.data);
                    writeHomeCache('popular-month', pData.data);
                }
            } catch (e) { console.error(e); }
            finally { setPopularMonthLoading(false); }
        };

        const fetchTopTen = async () => {
            if (topTenToday.length >= 10 && topTenWeek.length >= 10 && topTenMonth.length >= 10) return;
            const cached = readHomeCache<{ day: Anime[]; week: Anime[]; month: Anime[] }>('top-ten', HOME_TTL.topTen);
            if (cached && cached.day?.length && cached.week?.length && cached.month?.length) {
                setTopTenToday(cached.day);
                setTopTenWeek(cached.week);
                setTopTenMonth(cached.month);
                setTopTenLoading(false);
            } else {
                setTopTenLoading(true);
            }
            try {
                const [day, week, month] = await Promise.all([
                    animeService.getTrendingAnime(1, 24),
                    animeService.getPopularThisSeason(1, 24),
                    animeService.getPopularThisMonth(1, 24)
                ]);
                if (day?.data) setTopTenToday(day.data);
                if (week?.data) setTopTenWeek(week.data);
                if (month?.data) setTopTenMonth(month.data);
                if (day?.data && week?.data && month?.data) {
                    writeHomeCache('top-ten', { day: day.data, week: week.data, month: month.data });
                }
            } catch (e) { console.error(e); }
            finally { setTopTenLoading(false); }
        };

        const tasks: Promise<void>[] = [];

        if (!hasAnimeItems(fastBundle?.spotlightAnime)) {
            tasks.push(fetchSpotlight());
        }
        tasks.push(fetchLatestUpdates());
        if (!hasAnimeItems(fastBundle?.trendingAnime)) {
            tasks.push(fetchTrending());
        }
        if (!hasAnimeItems(fastBundle?.popularSeason)) {
            tasks.push(fetchPopular());
        }
        if (!hasAnimeItems(fastBundle?.popularMonth)) {
            tasks.push(fetchPopularMonth());
        }
        if (!hasTopTenItems(fastBundle)) {
            tasks.push(fetchTopTen());
        }

        await Promise.all(tasks);
    };

    // --- Pagination Effect ---
    // Re-fetch Top Anime when page changes
    useEffect(() => {
        const fetchPageData = async () => {
            const cached = animeService.peekTopAnime(currentPage);
            if (cached?.data?.length) {
                setTopAnime(cached.data);
                setLastVisiblePage(cached.pagination?.last_visible_page || 1);
                setLoading(false);
                return;
            }
            setLoading(true);
            try {
                // Skip if we already have data (prevents redundant fetches on provider re-mounts)
                if (topAnime.length > 0 && currentPage === 1) {
                    setLoading(false);
                    return;
                }
                const data = await animeService.getTopAnime(currentPage);
                if (data?.data) {
                    setTopAnime(data.data);
                    setLastVisiblePage(data.pagination?.last_visible_page || 1);
                }
            } catch (err) {
                console.error("Failed to fetch top anime page", currentPage, err);
                // Intentionally NOT setting global error here.
                // A failure in fetching background top anime should not crash the player/details pages.
            } finally {
                setLoading(false);
            }
        };

        fetchPageData();
    }, [currentPage]);

    // --- Helpers ---

    const resolveAndCacheEpisodes = async (anime: Anime): Promise<{ session: string | null, eps: Episode[] }> => {
        let session: string | null = null;
        let sessionFromCache = false;
        const cacheKey = getAnimeCacheKey(anime);
        const mappingKey =
            (() => {
                const aid = Number(anime?.id);
                if (Number.isFinite(aid) && aid > 0) return aid;
                const mal = Number(anime?.mal_id);
                return Number.isFinite(mal) && mal > 0 ? mal : null;
            })();
        // Strict normalize for exact-ish comparisons.
        const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
        // Loose normalize for cross-source title variants (e.g. with/without "Season 3", "Part 1").
        const normalizeLoose = (str: string) => normalize(
            str
                .replace(/\bseason\s*\d+\b/gi, ' ')
                .replace(/\bpart\s*\d+\b/gi, ' ')
                .replace(/\b\d+(st|nd|rd|th)\s*season\b/gi, ' ')
                .replace(/\bshimet?s?u\s*kaiyuu\b/gi, ' ')
                .replace(/\bculling\s*game(s)?\b/gi, 'cullinggame')
        );

        // Helper to extract season number
        const getSeason = (title: string) => {
            const match =
                title.match(/season\s*(\d+)|(\d+)(st|nd|rd|th)\s*season/i) ||
                title.trim().match(/(?:^|\s)([2-9])$/i);
            return match ? parseInt(match[1] || match[2]) : 1;
        };

        // Helper to score closeness
        const getScore = (candidate: any, target: Anime) => {
            let score = 0;
            const canTitle = candidate.title || '';
            const targetTitles = buildScraperQueries(target);

            // 1. Text Similarity (strict + loose variant checks)
            const canNorm = normalize(canTitle);
            const canLoose = normalizeLoose(canTitle);
            const matchedTitle = targetTitles.find((title) => {
                const tgtNorm = normalize(title);
                const tgtLoose = normalizeLoose(title);
                return (
                    canNorm.includes(tgtNorm) || tgtNorm.includes(canNorm) ||
                    canLoose.includes(tgtLoose) || tgtLoose.includes(canLoose)
                );
            });
            if (matchedTitle) {
                score += 10;
            } else {
                return -100;
            }

            // 2. Season Matching
            const targetSeason = getSeason(matchedTitle) || (target.season ? 1 : 1); // Default to 1 if not specified
            const candidateSeason = getSeason(canTitle);

            // Explicit Season Mismatch is a huge penalty
            if (candidateSeason === targetSeason) {
                score += 50; // Strong match for correct season
            } else {
                // Mismatch case
                if (targetSeason > 1 && candidateSeason === 1 && !canTitle.toLowerCase().includes('season')) {
                    // Target is Season 2+, candidate looks like implicit Season 1
                    // Check for subtitle/year rescue
                    let isYearMatch = false;
                    if (candidate.year && target.year) {
                        const yearDiff = Math.abs(parseInt(candidate.year) - target.year);
                        if (yearDiff <= 1) isYearMatch = true;
                    }

                    if (isYearMatch) {
                        score += 30; // Rescue! It's likely the correct season with a subtitle
                    } else {
                        score -= 50; // Penalty
                    }
                } else if (candidateSeason !== targetSeason) {
                    // Explicit mismatch (e.g. Season 2 vs Season 3)
                    score -= 50;
                }
            }

            // 3. Year Matching
            if (candidate.year && target.year) {
                const yearDiff = Math.abs(parseInt(candidate.year) - target.year);
                if (yearDiff <= 1) score += 5;
                else if (yearDiff > 2) score -= 10; // Large gap implies different series/remake
            }

            // 4. Type Matching
            if (candidate.type && target.type) {
                if (candidate.type.toLowerCase() === target.type.toLowerCase()) score += 3;
            }

            // 5. Episode-count proximity (helps avoid cross-title false mappings)
            const targetEpisodes = Number(target.episodes || 0);
            const candidateEpisodes = Number(candidate.episodes || 0);
            if (targetEpisodes > 0 && candidateEpisodes > 0) {
                const diff = Math.abs(candidateEpisodes - targetEpisodes);
                if (diff === 0) score += 30;
                else if (diff <= 1) score += 20;
                else if (diff <= 3) score += 8;
                else score -= 25;
            }

            return score;
        };

        const isStrictCandidate = (candidate: any, target: Anime) => {
            const canTitle = String(candidate?.title || '').trim();
            const targetTitles = buildScraperQueries(target);
            if (!canTitle || targetTitles.length === 0) return false;

            const canNorm = normalize(canTitle);
            const canLoose = normalizeLoose(canTitle);
            const matchedTitle = targetTitles.find((title) => {
                const tgtNorm = normalize(title);
                const tgtLoose = normalizeLoose(title);
                return (
                    canNorm.includes(tgtNorm) ||
                    tgtNorm.includes(canNorm) ||
                    canLoose.includes(tgtLoose) ||
                    tgtLoose.includes(canLoose)
                );
            });
            if (!matchedTitle) return false;

            const targetSeason = getSeason(matchedTitle);
            const candidateSeason = getSeason(canTitle);
            const seasonMatch =
                targetSeason <= 1 ||
                candidateSeason === targetSeason;
            if (!seasonMatch) return false;

            const targetEpisodes = Number(target?.episodes || 0);
            const candidateEpisodes = Number(candidate?.episodes || candidate?.sub || 0);
            if (targetEpisodes > 0 && candidateEpisodes > 0 && Math.abs(candidateEpisodes - targetEpisodes) > 3) {
                return false;
            }

            return true;
        };

        const buildScraperQueries = (target: Anime): string[] => {
            const queries = new Set<string>();
            const add = (value: unknown) => {
                const raw = String(value ?? '').replace(/\s+/g, ' ').trim();
                if (raw) queries.add(raw);
            };
            const addSeasonAliases = (value: unknown) => {
                const raw = String(value ?? '').replace(/\s+/g, ' ').trim();
                if (!raw) return;
                add(raw);

                const seasonMatch = raw.match(/\bseason\s*(\d+)\b/i) || raw.match(/\b(\d+)(st|nd|rd|th)\s*season\b/i);
                if (seasonMatch?.[1]) {
                    const seasonNumber = Number(seasonMatch[1]);
                    const ordinal =
                        seasonNumber % 100 >= 11 && seasonNumber % 100 <= 13
                            ? `${seasonNumber}th`
                            : `${seasonNumber}${(['th', 'st', 'nd', 'rd'][seasonNumber % 10] || 'th')}`;
                    add(raw.replace(/\bseason\s*\d+\b/ig, `${ordinal} Season`));
                    add(raw.replace(/\b\d+(st|nd|rd|th)\s*season\b/ig, `Season ${seasonNumber}`));
                }

                add(raw.replace(/:\s*[^:]+$/, '').trim());
                add(raw.replace(/\bpart\s*\d+\b/ig, '').replace(/\s+/g, ' ').trim());
            };

            addSeasonAliases(target.title);
            addSeasonAliases(target.title_english);
            addSeasonAliases(target.title_romaji);
            addSeasonAliases(target.title_japanese);
            (target.synonyms || []).slice(0, 6).forEach(addSeasonAliases);

            return Array.from(queries).slice(0, 8);
        };

        const resolveSessionBySearch = async (): Promise<string | null> => {
            const queryList = buildScraperQueries(anime);

            try {
                const candidateMap = new Map<string, any>();
                const rankCandidates = () => {
                    const allCandidates = Array.from(candidateMap.values())
                        .filter((candidate: any) => isSupportedScraperSessionId(candidate?.session));

                    const strictCandidates = allCandidates.filter((candidate) => isStrictCandidate(candidate, anime));
                    const hasStrictMatches = strictCandidates.length > 0;
                    const candidatePool = hasStrictMatches ? strictCandidates : allCandidates;
                    const targetEpisodes = Number(anime.episodes || 0);
                    const ranked = candidatePool
                        .map((candidate) => ({
                            candidate,
                            score: getScore(candidate, anime),
                            diff: (targetEpisodes > 0 && Number(candidate?.episodes || 0) > 0)
                                ? Math.abs(Number(candidate.episodes) - targetEpisodes)
                                : Number.MAX_SAFE_INTEGER,
                            canSeason: getSeason(candidate?.title || ''),
                            tgtSeason: getSeason(anime.title || '')
                        }))
                        // Strictly filter out candidates that are clearly an earlier season, 
                        // unless it looks like a combined super-season
                        .filter((entry) => {
                            if (entry.tgtSeason > 1 && entry.canSeason < entry.tgtSeason) {
                                const cEps = Number(entry.candidate?.episodes || 0);
                                if (cEps > 0 && cEps > (targetEpisodes || 12) * 1.5) {
                                    return true; // Might be a combined session
                                }
                                return false; // Reject S1 session for S2 anime
                            }
                            return true;
                        })
                        .sort((a, b) => {
                            if (b.score !== a.score) return b.score - a.score;
                            return a.diff - b.diff;
                        });

                    const best = hasStrictMatches && ranked.length > 0
                        ? ranked[0]
                        : (
                            ranked.find((entry) => {
                                if (entry.score <= 0) return false;
                                if (targetEpisodes <= 0) return true;
                                const cEps = Number(entry.candidate?.episodes || 0);
                                if (cEps <= 0) return true;
                                return cEps <= targetEpisodes + 1;
                            }) || ranked.find((entry) => entry.score > 0)
                        );

                    return { best, ranked };
                };

                for (let index = 0; index < queryList.length; index += 3) {
                    const results = await Promise.all(
                        queryList.slice(index, index + 3).map(q => animeService.searchAllManga(q).then(res => res || []).catch(() => []))
                    );

                    results.flat().forEach((candidate: any) => {
                        const session = String(candidate?.session || '').trim();
                        if (isSupportedScraperSessionId(session) && !candidateMap.has(session)) {
                            candidateMap.set(session, candidate);
                        }
                    });

                    const { best } = rankCandidates();
                    if (best?.candidate && best.score >= 80) {
                        if (cacheKey) scraperSessionCache.current.set(cacheKey, best.candidate.session);
                        if (USE_PERSISTED_MAPPING_CACHE && mappingKey !== null) {
                            animeService.saveAnimeMapping(mappingKey, best.candidate.session).catch(console.error);
                        }
                        return best.candidate.session;
                    }
                }

                const { best } = rankCandidates();

                if (best?.candidate) {
                    if (cacheKey) scraperSessionCache.current.set(cacheKey, best.candidate.session);
                    if (USE_PERSISTED_MAPPING_CACHE && mappingKey !== null) {
                        animeService.saveAnimeMapping(mappingKey, best.candidate.session).catch(console.error);
                    }
                    return best.candidate.session;
                }
            } catch (e) {
                console.error("Error resolving scraper session", e);
            }
            return null;
        };

        // Fast path: when scraperId is already known, avoid extra mapping/search calls.
        const directScraperSession = extractDirectScraperSession(anime.scraperId);
        if (directScraperSession && isSupportedScraperSessionId(directScraperSession)) {
            session = directScraperSession;
            if (cacheKey) {
                scraperSessionCache.current.set(cacheKey, session);
            }
            sessionFromCache = true;
        }

        if (!session && cacheKey && scraperSessionCache.current.has(cacheKey)) {
            const cachedSession = extractDirectScraperSession(scraperSessionCache.current.get(cacheKey));
            if (cachedSession && isSupportedScraperSessionId(cachedSession)) {
                session = cachedSession;
                sessionFromCache = true;
            } else {
                scraperSessionCache.current.delete(cacheKey);
            }
        } else if (!session) {
            // 0. Try to get from Firebase Mapping Cache
            if (USE_PERSISTED_MAPPING_CACHE && mappingKey !== null) {
                try {
                    const persistedMapping = await animeService.getAnimeMapping(mappingKey);
                    const cachedSession = extractDirectScraperSession(persistedMapping);
                    if (cachedSession && isSupportedScraperSessionId(cachedSession)) {
                        session = cachedSession;
                        sessionFromCache = true;
                        if (cacheKey) scraperSessionCache.current.set(cacheKey, cachedSession);
                    } else if (persistedMapping) {
                        animeService.clearAnimeMapping(mappingKey).catch(() => undefined);
                    }
                } catch (e) {
                    console.warn("[AnimeContext] Failed to check mapping cache", e);
                }
            }

        }

        if (!session) {
            session = await resolveSessionBySearch();
        }

        if (session) {
            if (episodesCache.current.has(session)) {
                const cachedEpisodes = episodesCache.current.get(session)!;
                if (hasEnoughEpisodes(anime, cachedEpisodes)) {
                    return { session, eps: cachedEpisodes };
                }
                episodesCache.current.delete(session);
                if (cacheKey) {
                    try {
                        sessionStorage.removeItem(`${EPISODE_CACHE_PREFIX}:${cacheKey}`);
                    } catch {
                        // Ignore sessionStorage errors
                    }
                }
            }

            try {
                const epData = await animeService.getEpisodes(session, {
                    expectedEpisodes: getExpectedEpisodeCount(anime),
                });
                const rawEpisodes = epData?.episodes || epData?.ep_details || (Array.isArray(epData) ? epData : []);
                const normalizedEpisodes = normalizeEpisodesList(rawEpisodes);
                const newEpisodes = trimEpisodesForAnime(anime, normalizedEpisodes);

                // Cached/older mappings can occasionally resolve to a valid session with no episode payload.
                // Re-resolve once via search before giving up, so users don't need a manual page reload.
                if (newEpisodes.length === 0 && sessionFromCache) {
                    if (extractDirectScraperSession(anime.scraperId) === session) {
                        delete (anime as Partial<Anime>).scraperId;
                    }
                    if (cacheKey) scraperSessionCache.current.delete(cacheKey);
                    if (USE_PERSISTED_MAPPING_CACHE && mappingKey !== null) {
                        animeService.clearAnimeMapping(mappingKey).catch(() => undefined);
                    }
                    const remappedSession = await resolveSessionBySearch();
                    if (remappedSession && remappedSession !== session) {
                        const remappedData = await animeService.getEpisodes(remappedSession, {
                            expectedEpisodes: getExpectedEpisodeCount(anime),
                        });
                        const remappedRawEpisodes = remappedData?.episodes || remappedData?.ep_details || (Array.isArray(remappedData) ? remappedData : []);
                        const remappedNormalizedEpisodes = normalizeEpisodesList(remappedRawEpisodes);
                        const remappedEpisodes = trimEpisodesForAnime(anime, remappedNormalizedEpisodes);
                        if (remappedEpisodes.length > 0) {
                            if (hasEnoughEpisodes(anime, remappedEpisodes)) {
                                episodesCache.current.set(remappedSession, remappedEpisodes);
                                if (cacheKey) writeEpisodeSessionCache(cacheKey, remappedSession, remappedEpisodes);
                            }
                            return { session: remappedSession, eps: remappedEpisodes };
                        }
                    }
                    return { session: null, eps: [] };
                }

                // Enrich with metadata titles if available
                if (newEpisodes.length > 0) {
                    // 1. Try AniList Metadata first (Fast, already in memory)
                    if (anime.episodeMetadata?.length) {
                        const metaList = anime.episodeMetadata;
                        newEpisodes.forEach((ep: Episode) => {
                            if (!ep.title || ep.title === 'Untitled' || !ep.title.trim()) {
                                const epNum = parseFloat(ep.episodeNumber);
                                if (!isNaN(epNum)) {
                                    // Strategy A: Regex match "Episode X"
                                    let meta = metaList.find(m => {
                                        const match = m.title?.match(/Episode\s+(\d+)/i);
                                        return match && parseFloat(match[1]) === epNum;
                                    });

                                    // Strategy B: Array Index Fallback (assuming metadata is compliant and ordered)
                                    // AniList streamingEpisodes are usually ordered 1..N
                                    if (!meta && metaList[epNum - 1]) {
                                        meta = metaList[epNum - 1];
                                    }

                                    if (meta && meta.title) {
                                        // Clean up "Episode X - Title" format
                                        const cleanMatch = meta.title.match(/Episode\s+\d+\s*[-:]?\s*(.*)/i);
                                        if (cleanMatch && cleanMatch[1] && cleanMatch[1].trim()) {
                                            ep.title = cleanMatch[1].trim();
                                        } else {
                                            // Use full title if no prefix found or prefix is everything
                                            ep.title = meta.title;
                                        }
                                    }
                                }
                            }
                        });
                    }


                }

                if (newEpisodes.length > 0) {
                    // Gate persistent caching on having "enough" episodes, but ALWAYS
                    // return whatever episodes the scraper found. For ongoing anime,
                    // AniList often reports the planned total (e.g. 12) while only 1-2
                    // episodes have aired. Previously this discarded partial results,
                    // showing "No episodes found" for currently-airing shows.
                    if (hasEnoughEpisodes(anime, newEpisodes)) {
                        episodesCache.current.set(session, newEpisodes);
                        // Persist to sessionStorage for instant back-navigation
                        if (cacheKey) writeEpisodeSessionCache(cacheKey, session, newEpisodes);
                    }
                    return { session, eps: newEpisodes };
                }
            } catch (e) {
                if (cacheKey) scraperSessionCache.current.delete(cacheKey);
            }
        }
        return { session, eps: [] };
    };

    const preloadEpisodes = async (
        anime: Anime,
        options?: { resetState?: boolean; requestId?: number; isStale?: () => boolean }
    ) => {
        const isStale = options?.isStale || (() => false);
        const cacheKey = getAnimeCacheKey(anime);
        if (cacheKey && scraperSessionCache.current.has(cacheKey)) {
            const session = extractDirectScraperSession(scraperSessionCache.current.get(cacheKey));
            if (!session) {
                scraperSessionCache.current.delete(cacheKey);
            } else if (episodesCache.current.has(session)) {
                const cachedEpisodes = episodesCache.current.get(session)!;
                if (!hasEnoughEpisodes(anime, cachedEpisodes)) {
                    episodesCache.current.delete(session);
                } else {
                    if (isStale()) return;
                    setEpisodes(cachedEpisodes);
                    setScraperSession(session);
                    setEpLoading(false);
                    setEpisodesResolved(true);
                    return;
                }
            }
        }

        // Fallback: check sessionStorage for episodes cached during this browser session
        if (cacheKey) {
            const sessionCached = readEpisodeSessionCache(cacheKey);
            if (sessionCached) {
                if (!isSupportedScraperSessionId(sessionCached.session) || !hasEnoughEpisodes(anime, sessionCached.episodes)) {
                    try {
                        sessionStorage.removeItem(`${EPISODE_CACHE_PREFIX}:${cacheKey}`);
                    } catch {
                        // Ignore sessionStorage errors
                    }
                } else {
                    if (isStale()) return;
                    scraperSessionCache.current.set(cacheKey, sessionCached.session);
                    episodesCache.current.set(sessionCached.session, sessionCached.episodes);
                    setEpisodes(sessionCached.episodes);
                    setScraperSession(sessionCached.session);
                    setEpLoading(false);
                    setEpisodesResolved(true);
                    return;
                }
            }
        }

        const inFlightKey = cacheKey || `temp:${String(anime.scraperId || anime.id || anime.mal_id || anime.title || '')}`;
        if (episodePreloadInFlight.current.has(inFlightKey)) {
            const { session, eps } = await episodePreloadInFlight.current.get(inFlightKey)!;
            if (isStale()) return;
            if (session) setScraperSession(session);
            if (eps.length > 0) {
                setEpisodes(eps);
                setEpLoading(false);
                setEpisodesResolved(true);
                return;
            }

            // If an early seed preload finishes empty, retry once with the
            // current anime payload before surfacing "No episodes found."
            setEpLoading(true);
            setEpisodesResolved(false);
            try {
                const { session: retrySession, eps: retryEpisodes } = await resolveAndCacheEpisodes(anime);
                if (isStale()) return;
                if (retrySession) setScraperSession(retrySession);
                setEpisodes(retryEpisodes);
            } catch (e) {
                console.error('Failed to retry episode preload', e);
            } finally {
                if (isStale()) return;
                setEpLoading(false);
                setEpisodesResolved(true);
            }
            return;
        }

        if (isStale()) return;
        setEpLoading(true);
        setEpisodesResolved(false);
        if (options?.resetState !== false) {
            setEpisodes([]);
            setScraperSession(null);
        }

        try {
            const task = resolveAndCacheEpisodes(anime)
                .finally(() => {
                    episodePreloadInFlight.current.delete(inFlightKey);
                });
            episodePreloadInFlight.current.set(inFlightKey, task);
            const { session, eps } = await task;
            if (isStale()) return;
            if (session) setScraperSession(session);
            setEpisodes(eps);
        } catch (e) {
            console.error('Failed to preload episodes', e);
        } finally {
            if (isStale()) return;
            setEpLoading(false);
            setEpisodesResolved(true);
        }
    };



    // --- Episode Tracking ---
    const getCanonicalAnimeHistoryId = (anime: Anime | null) => {
        if (!anime) return '';
        const malId = String(anime.mal_id || '').trim();
        const anilistId = String(anime.id || '').trim();
        return malId || anilistId;
    };

    const normalizeEpisodeHistoryForAnime = (anime: Anime | null) => {
        if (!anime) return;

        const canonicalId = getCanonicalAnimeHistoryId(anime);
        const malId = String(anime.mal_id || '').trim();
        const anilistId = String(anime.id || '').trim();
        const aliasIds = Array.from(new Set([malId, anilistId].filter(Boolean)));

        if (!canonicalId || aliasIds.length <= 1) return;

        const history = storage.getEpisodeHistory();
        const mergedEpisodes = Array.from(new Set(
            aliasIds.flatMap((id) => history[id] || [])
        )).sort();

        const hadAliasData = aliasIds.some((id) => id !== canonicalId && Array.isArray(history[id]) && history[id].length > 0);
        if (!hadAliasData) return;

        const nextHistory = { ...history, [canonicalId]: mergedEpisodes };
        aliasIds.forEach((id) => {
            if (id !== canonicalId) {
                delete nextHistory[id];
            }
        });

        storage.setEpisodeHistory(nextHistory);
    };

    const refreshWatchedEpisodes = () => {
        if (!selectedAnime) {
            setWatchedEpisodes(new Set());
            return;
        }

        const canonicalId = getCanonicalAnimeHistoryId(selectedAnime);
        const history = canonicalId ? storage.getWatchedEpisodes(canonicalId) : [];
        setWatchedEpisodes(new Set(history));
    };

    useEffect(() => {
        normalizeEpisodeHistoryForAnime(selectedAnime);
        refreshWatchedEpisodes();
    }, [selectedAnime, user?.uid]);

    useEffect(() => {
        const handleStorageUpdated = () => refreshWatchedEpisodes();
        window.addEventListener('yorumi-storage-updated', handleStorageUpdated);
        return () => window.removeEventListener('yorumi-storage-updated', handleStorageUpdated);
    }, [selectedAnime, user?.uid]);

    const markEpisodeComplete = (episodeKey: number | string) => {
        if (!selectedAnime) return;
        const normalizedKey = normalizeEpisodeHistoryKey(episodeKey);
        if (!normalizedKey) return;
        const canonicalId = getCanonicalAnimeHistoryId(selectedAnime);
        if (canonicalId) {
            storage.markEpisodeAsWatched(canonicalId, normalizedKey);
        }

        setWatchedEpisodes(prev => new Set(prev).add(normalizedKey));
    };

    const unmarkEpisodeComplete = (episodeKey: number | string) => {
        if (!selectedAnime) return;
        const normalizedKey = normalizeEpisodeHistoryKey(episodeKey);
        if (!normalizedKey) return;
        const canonicalId = getCanonicalAnimeHistoryId(selectedAnime);
        if (canonicalId) {
            storage.unmarkEpisodeAsWatched(canonicalId, normalizedKey);
        }

        setWatchedEpisodes(prev => {
            const next = new Set(prev);
            next.delete(normalizedKey);
            return next;
        });
    };

    const toggleEpisodeComplete = (episodeKey: number | string) => {
        const normalizedKey = normalizeEpisodeHistoryKey(episodeKey);
        if (!normalizedKey) return;
        if (watchedEpisodes.has(normalizedKey)) {
            unmarkEpisodeComplete(normalizedKey);
        } else {
            markEpisodeComplete(normalizedKey);
        }
    };

    // --- Actions ---

    const handleAnimeClick = async (anime: Anime) => {
        const requestId = ++detailsRequestIdRef.current;
        const isStaleRequest = () => requestId !== detailsRequestIdRef.current;
        let currentAnime = anime;

        let detailsId: string | number | undefined = getPreferredDetailsId(anime);

        const cachedDetails = detailsId ? animeService.peekAnimeDetailsCache(detailsId) : null;
        const cachedFast = detailsId ? animeService.peekAnimeDetailsFastCache(detailsId) : null;
        const hydratedAnime = hydrateFastDetails(cachedFast, (cachedDetails?.data || anime) as Anime);

        if (hasRenderablePrimaryDetails(hydratedAnime) || cachedDetails?.data || cachedFast?.data) {
            setSelectedAnime(hydratedAnime);
        } else {
            setSelectedAnime(null);
        }

        const hydratedEpisodesApplied = applyHydratedEpisodes(hydratedAnime, cachedFast);
        if (!hydratedEpisodesApplied) {
            setEpisodes([]);
            setScraperSession(null);
            setEpLoading(true);
            setEpisodesResolved(false);
        }
        setEpisodesBackgroundLoading(false);

        setWatchedEpisodes(new Set());
        setError(null);
        setDetailsLoading(!(cachedDetails?.data || cachedFast?.data || hasRenderablePrimaryDetails(anime)));

        const shouldPreloadEpisodesImmediately = !hydratedEpisodesApplied && Boolean(
            isSupportedScraperSessionId(extractDirectScraperSession(anime.scraperId)) ||
            String(anime.title || '').trim() ||
            (Number.isFinite(Number(anime.id)) && Number(anime.id) > 0) ||
            (Number.isFinite(Number(anime.mal_id)) && Number(anime.mal_id) > 0)
        );
        if (shouldPreloadEpisodesImmediately) {
            preloadEpisodes(anime, { resetState: false, requestId, isStale: isStaleRequest }).catch(() => undefined);
        }

        try {
            detailsId = getPreferredDetailsId(anime);
            if (!detailsId && !anime.title) throw new Error('Could not identify anime ID');

            let fastPromiseSettled = false;
            const fastPromise = detailsId ? animeService.getAnimeDetailsFast(detailsId, currentAnime?.type)
                .catch(() => null)
                .finally(() => {
                    fastPromiseSettled = true;
                    if (!isStaleRequest()) {
                        setEpisodesBackgroundLoading(false);
                    }
                }) : Promise.resolve(null).finally(() => { fastPromiseSettled = true; });
            const cachedFastResult = cachedFast
                ? Promise.resolve(cachedFast)
                : Promise.race<any>([
                    fastPromise,
                    new Promise((resolve) => window.setTimeout(() => resolve(null), 80)),
                ]);

            const initialFastResult = await cachedFastResult;
            let episodesApplied = false;
            if (initialFastResult && !isStaleRequest()) {
                currentAnime = hydrateFastDetails(initialFastResult, currentAnime);
                setSelectedAnime(currentAnime);
                episodesApplied = applyHydratedEpisodes(currentAnime, initialFastResult);
            }
            if (!initialFastResult && !fastPromiseSettled && !isStaleRequest()) {
                setEpisodesBackgroundLoading(true);
            }

            const detailsData = detailsId ? await animeService.getAnimeDetails(detailsId, currentAnime?.type) : null;
            if (isStaleRequest()) return;

            if (detailsData?.data) {
                currentAnime = preserveFreshnessHint(detailsData.data, currentAnime);
                if (detailsId && String(detailsId).startsWith('s:')) {
                    if ((detailsData.data as any).scraperId) currentAnime.scraperId = (detailsData.data as any).scraperId;
                }
                currentAnime = preserveFreshnessHint(currentAnime, anime);
                setSelectedAnime(currentAnime);
            } else {
                let found = false;
                if (anime.title) {
                    try {
                        const search = await animeService.searchAnime(anime.title, 1);
                        if (search?.data && search.data.length > 0) {
                            let bestMatch = search.data[0];
                            if (anime.year) {
                                const matched = search.data.find((a: any) => Math.abs(Number(a.year || 0) - Number(anime.year)) <= 1);
                                if (matched) bestMatch = matched;
                            }
                            currentAnime = bestMatch;
                            
                            const fullDetailsId = getPreferredDetailsId(currentAnime);
                            if (fullDetailsId) {
                                const fullDetailsData = await animeService.getAnimeDetails(fullDetailsId, currentAnime?.type).catch(() => null);
                                if (fullDetailsData?.data) {
                                    currentAnime = preserveFreshnessHint(fullDetailsData.data, currentAnime);
                                }
                            }
                            
                            currentAnime = preserveFreshnessHint(currentAnime, anime);
                            setSelectedAnime(currentAnime);
                            found = true;
                        }
                    } catch (e) {
                        console.error('Fallback search failed', e);
                    }
                }
                if (!found && !anime.images) {
                    throw new Error('Anime not found');
                }
            }

            if (isStaleRequest()) return;
            setDetailsLoading(false);

            if (!episodesApplied && !isStaleRequest()) {
                preloadEpisodes(currentAnime, { resetState: false, requestId, isStale: isStaleRequest }).catch(() => undefined);
            }

            fastPromise.then((fast) => {
                if (!fast || isStaleRequest()) return;
                currentAnime = hydrateFastDetails(fast, currentAnime);
                setSelectedAnime(currentAnime);
                applyHydratedEpisodes(currentAnime, fast);
            }).catch(() => undefined);
        } catch (err) {
            if (isStaleRequest()) return;
            console.error('Failed to fetch details', err);
            setError('Failed to load anime details');
            setDetailsLoading(false);
            setEpisodesBackgroundLoading(false);
            if (!anime.images) {
                setEpLoading(false);
                setEpisodesResolved(true);
            } else {
                preloadEpisodes(currentAnime, { resetState: false, requestId, isStale: isStaleRequest }).catch(() => undefined);
            }
        }
    };

    const startWatching = () => {
        setShowAnimeDetails(false);
        setShowWatchModal(true);
        if (episodes.length === 0 && !epLoading && !scraperSession && selectedAnime) {
            preloadEpisodes(selectedAnime);
        }
    };

    const watchAnime = (anime: Anime) => {
        setSelectedAnime(anime);
        setShowAnimeDetails(false);
        setShowWatchModal(true);
        preloadEpisodes(anime);
    };

    const closeDetails = () => {
        setShowAnimeDetails(false);
        // Clean up or navigate back if needed?
        // With Router, the user uses browser back. 
        // This might act as a "clear selection"
        setSelectedAnime(null);
    };

    const closeWatch = () => {
        setShowWatchModal(false);
        // Return to details? 
        setShowAnimeDetails(true);
    };

    const closeAllModals = () => {
        setShowWatchModal(false);
        setShowAnimeDetails(false);
        setSelectedAnime(null);
        setEpisodes([]);
    };

    const changePage = (page: number) => {
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const prefetchEpisodes = (anime: Anime) => {
        if (anime.scraperId && isSupportedScraperSessionId(extractDirectScraperSession(anime.scraperId))) {
            resolveAndCacheEpisodes(anime).catch(console.error);
            return;
        }

        const detailsId = anime.id || anime.mal_id;
        if (detailsId) {
            animeService.getAnimeDetailsFast(detailsId, anime?.type).catch(() => undefined);
        }
    };

    const prefetchPage = (page: number) => {
        if (page <= lastVisiblePage) {
            animeService.getTopAnime(page);
        }
    };

    // View All Logic
    const fetchViewAll = async (type: 'latest' | 'trending' | 'seasonal' | 'continue_watching' | 'popular', page: number, append = false) => {
        if (type === 'continue_watching') return;

        if (viewAllFetchInFlightRef.current) return;
        viewAllFetchInFlightRef.current = true;
        setViewAllPagination((prev) => ({
            ...prev,
            current_page: page,
            has_next_page: page < prev.last_visible_page ? true : prev.has_next_page,
        }));
        setViewAllLoading(true);
        try {
            let data;
            if (type === 'latest') data = await animeService.getLatestUpdatesPage(page);
            else if (type === 'trending') data = await animeService.getTrendingAnime(page, 18);
            else if (type === 'seasonal') data = await animeService.getPopularThisSeason(page, 18);
            else if (type === 'popular') data = await animeService.getTopAnime(page); // Re-use getTopAnime for "View All" pagination

            if (data?.data) {
                const resolvedItems = Array.isArray(data.data) ? data.data : [];
                setViewAllAnime((prev) => append ? [...prev, ...resolvedItems] : resolvedItems);
                if (append && resolvedItems.length === 0) {
                    setViewAllPagination((prev) => ({ ...prev, has_next_page: false }));
                    return;
                }
                if (data.pagination) {
                    setViewAllPagination(data.pagination);
                } else {
                    setViewAllPagination({
                        last_visible_page: 1,
                        current_page: page,
                        has_next_page: false
                    });
                }
            }
        } catch (error) {
            console.error(error);
            if (append) {
                setViewAllPagination((prev) => ({ ...prev, has_next_page: false }));
            }
        } finally {
            viewAllFetchInFlightRef.current = false;
            setViewAllLoading(false);
        }
    };

    const openViewAll = (type: any) => {
        setViewMode(type);
        setViewAllAnime([]);
        setViewAllPagination({
            last_visible_page: 1,
            current_page: 1,
            has_next_page: false
        });
        // If continue_watching, data is already local, no fetch needed
        if (type !== 'continue_watching') {
            fetchViewAll(type, 1);
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const closeViewAll = () => {
        setViewMode('default');
        setViewAllAnime([]);
    };

    const changeViewAllPage = (page: number) => {
        fetchViewAll(viewMode as any, page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const loadMoreViewAll = () => {
        if (viewMode !== 'latest' || viewAllLoading || !viewAllPagination.has_next_page) return;
        fetchViewAll('latest', viewAllPagination.current_page + 1, true);
    };

    return (
        <AnimeContext.Provider value={{
            topAnime, spotlightAnime, latestUpdates, trendingAnime, popularSeason, popularMonth, topTenToday, topTenWeek, topTenMonth, selectedAnime,
            showAnimeDetails, showWatchModal, episodes, scraperSession, epLoading, episodesResolved,
            episodesBackgroundLoading,
            detailsLoading, loading, spotlightLoading, latestUpdatesLoading, trendingLoading, popularSeasonLoading, popularMonthLoading, topTenLoading, currentPage, lastVisiblePage,
            error, episodeSearchQuery, viewAllAnime, viewAllLoading, viewAllPagination,
            viewMode, setEpisodeSearchQuery, handleAnimeClick, startWatching,
            watchAnime, closeDetails, closeWatch, closeAllModals, changePage,
            openViewAll, closeViewAll, changeViewAllPage, loadMoreViewAll, prefetchEpisodes, prefetchPage,
            continueWatchingList, saveProgress, removeFromHistory, fetchHomeData,
            watchedEpisodes, markEpisodeComplete, unmarkEpisodeComplete, toggleEpisodeComplete
        }}>
            {children}
        </AnimeContext.Provider>
    );
}

export const useAnime = () => {
    const context = useContext(AnimeContext);
    if (context === undefined) {
        throw new Error('useAnime must be used within an AnimeProvider');
    }
    return context;
};


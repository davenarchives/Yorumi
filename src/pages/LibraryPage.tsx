import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Tv, BookOpen, BookText, Play, ChevronDown, Search, SlidersHorizontal, MoreVertical, ArrowUp, Check, Plus, FolderInput, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useContinueReading } from '../hooks/useContinueReading';
import { useContinueWatching } from '../hooks/useContinueWatching';
import { useContinueLNReading } from '../hooks/useContinueLNReading';
import { useReadList } from '../hooks/useReadList';
import { useWatchList } from '../hooks/useWatchList';
import { useLNReadList } from '../hooks/useLNReadList';
import { useFavoriteAnime } from '../hooks/useFavoriteAnime';
import { useFavoriteManga } from '../hooks/useFavoriteManga';
import { useFavoriteLN } from '../hooks/useFavoriteLN';
import { useDownloads } from '../hooks/useDownloads';
import { downloadService } from '../services/downloadService';
import { useMangaDownloads } from '../hooks/useMangaDownloads';
import { useLNDownloads } from '../hooks/useLNDownloads';
import { handleImageError } from '../utils/image';
import { getAnimeDetailsRouteId, parseAnimeRouteId, buildAnimeRouteId } from '../utils/animeNavigation';
import type { WatchListItem } from '../utils/storage';
import type { PublicUserProfile } from '../services/userService';
import LibraryProfileOverview from '../features/library/components/LibraryProfileOverview';

export type LibraryTab = 'anime' | 'manga' | 'ln';

type MobileLibraryItem = {
    id: string;
    title: string;
    image: string;
    count?: number;
    route: string;
    state?: Record<string, unknown>;
    downloaded?: boolean;
    started?: boolean;
    completed?: boolean;
    watchlisted?: boolean;
    favorited?: boolean;
    updatedAt?: number;
};

const WATCHLIST_CATEGORY_ID = '__watchlist__';
const FAVORITES_CATEGORY_ID = '__favorites__';

type LibraryFilter = 'downloaded' | 'started' | 'completed';
type LibrarySort = 'alphabetical' | 'count' | 'recent';
type LibraryDisplay = 'compact' | 'comfortable' | 'cover' | 'list';
type LibraryCategory = { id: string; name: string; itemIds: string[] };
type LibraryCategories = Record<LibraryTab, LibraryCategory[]>;

const STORAGE_KEY = 'yorumi_library_tab';
const LIBRARY_CATEGORIES_KEY = 'yorumi_library_categories_v1';
const LIBRARY_DISPLAY_KEY = 'yorumi_library_display_v1';
const LIBRARY_ITEMS_PER_ROW_KEY = 'yorumi_library_items_per_row_v1';

const EMPTY_LIBRARY_CATEGORIES: LibraryCategories = { anime: [], manga: [], ln: [] };

const MOBILE_LIBRARY_TAB_LABELS: Record<LibraryTab, string> = {
    anime: 'Anime',
    manga: 'Manga',
    ln: 'LN',
};

const LIBRARY_TAB_LABELS: Record<LibraryTab, string> = {
    anime: 'Anime',
    manga: 'Manga',
    ln: 'Light Novel',
};

const normalizeLibraryTitle = (title: string) => title
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const getAnimeRouteId = (item: WatchListItem) => {
    const scraperId = item.scraperId;
    if (String(scraperId || '').startsWith('vault') || item.type === 'Vault Video') {
        return scraperId || `vault-anime:hanime:${item.id}`;
    }
    const computed = getAnimeDetailsRouteId({
        id: item.anilistId || item.id,
        mal_id: item.malId,
        scraperId: item.scraperId,
    });
    if (computed && !computed.startsWith('s:')) return computed;
    const rawId = String(item.anilistId || item.id || '').trim();
    const parsed = parseAnimeRouteId(rawId);
    if (parsed && parsed.source !== 'scraper') return buildAnimeRouteId(parsed);
    if (scraperId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(scraperId.replace(/^s:/, ''))) {
        return `s:${scraperId.replace(/^s:/, '')}`;
    }
    if (computed) return computed;
    if (parsed) return buildAnimeRouteId(parsed);
    return rawId || '';
};

const normalizeStoredAnimeRouteId = (value: unknown) => {
    const parsed = parseAnimeRouteId(value);
    return parsed ? buildAnimeRouteId(parsed) : '';
};

const getStoredAnilistId = (value: unknown) => {
    const parsed = parseAnimeRouteId(value);
    return parsed?.source === 'anilist' ? Number(parsed.id) : 0;
};

export default function LibraryPage({ readOnlyProfile }: { readOnlyProfile?: PublicUserProfile } = {}) {
    const isReadOnly = Boolean(readOnlyProfile);
    const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine);
    const [isMobileTabMenuOpen, setIsMobileTabMenuOpen] = useState(false);
    const [isLibraryActionsOpen, setIsLibraryActionsOpen] = useState(false);
    const [isLibraryOptionsOpen, setIsLibraryOptionsOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
    const [isMoveEntriesToCategoryOpen, setIsMoveEntriesToCategoryOpen] = useState(false);
    const [isDeleteCategoryOpen, setIsDeleteCategoryOpen] = useState(false);
    const [moveTargetCategoryId, setMoveTargetCategoryId] = useState('');
    const [moveCategoryItemIds, setMoveCategoryItemIds] = useState<Set<string>>(new Set());
    const [optionsTab, setOptionsTab] = useState<'filter' | 'sort' | 'display'>('filter');
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilters, setActiveFilters] = useState<Set<LibraryFilter>>(new Set());
    const [sortBy, setSortBy] = useState<LibrarySort>('recent');
    const [sortAscending, setSortAscending] = useState(false);
    const [activeCategoryId, setActiveCategoryId] = useState('all');
    const [categoryName, setCategoryName] = useState('');
    const [categoryItemIds, setCategoryItemIds] = useState<Set<string>>(new Set());
    const [categories, setCategories] = useState<LibraryCategories>(() => {
        try {
            const saved = JSON.parse(localStorage.getItem(LIBRARY_CATEGORIES_KEY) || 'null') as LibraryCategories | null;
            if (saved?.anime && saved?.manga && saved?.ln) return saved;
        } catch {
            // Ignore invalid or unavailable local storage.
        }
        return EMPTY_LIBRARY_CATEGORIES;
    });
    const [displayMode, setDisplayMode] = useState<LibraryDisplay>(() => {
        try {
            const saved = localStorage.getItem(LIBRARY_DISPLAY_KEY);
            if (saved === 'compact' || saved === 'comfortable' || saved === 'cover' || saved === 'list') return saved;
        } catch {
            // Ignore storage access errors.
        }
        return 'compact';
    });
    const [itemsPerRow, setItemsPerRow] = useState<number>(() => {
        try {
            const saved = localStorage.getItem(LIBRARY_ITEMS_PER_ROW_KEY);
            const parsed = Number(saved);
            if (parsed >= 2 && parsed <= 8) return parsed;
        } catch {
            // Ignore storage access errors.
        }
        return typeof window !== 'undefined' && window.innerWidth >= 768 ? 6 : 2;
    });

    const mobileTabMenuRef = useRef<HTMLDivElement>(null);
    const libraryActionsRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const searchContainerRef = useRef<HTMLDivElement>(null);
    const [activeTab, setActiveTab] = useState<LibraryTab>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved === 'anime' || saved === 'manga' || saved === 'ln') return saved;
        } catch {
            // Ignore storage access errors
        }
        return 'anime';
    });

    const handleTabChange = (tab: LibraryTab) => {
        setActiveTab(tab);
        setActiveCategoryId('all');
        setSearchQuery('');
        if (!isReadOnly) {
            try {
                localStorage.setItem(STORAGE_KEY, tab);
            } catch {
                // Ignore storage quota errors
            }
        }
    };

    const updateDisplayMode = (mode: LibraryDisplay) => {
        setDisplayMode(mode);
        if (mode !== 'list') {
            const defaultCols = typeof window !== 'undefined' && window.innerWidth >= 768 ? 6 : 2;
            setItemsPerRow(defaultCols);
            try {
                localStorage.setItem(LIBRARY_ITEMS_PER_ROW_KEY, String(defaultCols));
            } catch {
                // Ignore storage access errors.
            }
        }
        try {
            localStorage.setItem(LIBRARY_DISPLAY_KEY, mode);
        } catch {
            // Ignore storage access errors.
        }
    };

    const saveMoveEntries = () => {
        if (!moveTargetCategoryId) return;
        const next = {
            ...categories,
            [activeTab]: categories[activeTab].map((cat) =>
                cat.id === moveTargetCategoryId
                    ? { ...cat, itemIds: [...moveCategoryItemIds] }
                    : cat
            ),
        };
        setCategories(next);
        setIsMoveEntriesToCategoryOpen(false);
        try {
            localStorage.setItem(LIBRARY_CATEGORIES_KEY, JSON.stringify(next));
        } catch {
            // Ignore storage access errors.
        }
    };

    const { continueWatchingList: localContinueWatchingList, removeFromHistory: removeWatchingHistory } = useContinueWatching();
    const { continueReadingList: localContinueReadingList, removeFromHistory: removeReadingHistory } = useContinueReading();
    const { continueReadingList: localContinueLNList, removeLNProgress } = useContinueLNReading();
    const { watchList: localWatchList, removeFromWatchList } = useWatchList();
    const { readList: localReadList, removeFromReadList } = useReadList();
    const { readList: localLNReadList, toggleLNReadList } = useLNReadList();
    const { favorites: localFavoriteAnime, removeFavorite: removeFavoriteAnime } = useFavoriteAnime();
    const { favorites: localFavoriteManga, removeFavorite: removeFavoriteManga } = useFavoriteManga();
    const { favorites: localFavoriteLN, removeFavorite: removeFavoriteLN } = useFavoriteLN();
    const { downloads: localDownloads, deleteDownload } = useDownloads();
    const { downloads: localMangaDownloads, deleteDownload: deleteMangaDownload } = useMangaDownloads();
    const { downloads: localLNDownloads, deleteDownload: deleteLNDownload } = useLNDownloads();
    const navigate = useNavigate();

    const continueWatchingList: typeof localContinueWatchingList = readOnlyProfile ? readOnlyProfile.continueWatching : localContinueWatchingList;
    const continueReadingList: typeof localContinueReadingList = readOnlyProfile ? readOnlyProfile.continueReading : localContinueReadingList;
    const continueLNList: typeof localContinueLNList = readOnlyProfile ? (readOnlyProfile.continueLN || []) : localContinueLNList;
    const watchList: typeof localWatchList = readOnlyProfile ? readOnlyProfile.watchList : localWatchList;
    const readList: typeof localReadList = readOnlyProfile ? readOnlyProfile.readList : localReadList;
    const lnReadList: typeof localLNReadList = readOnlyProfile ? (readOnlyProfile.lnReadList || []) : localLNReadList;
    const favoriteAnime: typeof localFavoriteAnime = readOnlyProfile ? readOnlyProfile.favoriteAnime : localFavoriteAnime;
    const favoriteManga: typeof localFavoriteManga = readOnlyProfile ? readOnlyProfile.favoriteManga : localFavoriteManga;
    const favoriteLN: typeof localFavoriteLN = readOnlyProfile ? (readOnlyProfile.favoriteLN || []) : localFavoriteLN;
    const downloads: typeof localDownloads = readOnlyProfile ? [] : localDownloads;
    const mangaDownloads: typeof localMangaDownloads = readOnlyProfile ? [] : localMangaDownloads;
    const lnDownloads: typeof localLNDownloads = readOnlyProfile ? [] : localLNDownloads;
    const activeCategories: LibraryCategories = readOnlyProfile
        ? {
            anime: readOnlyProfile.libraryCategories?.anime || [],
            manga: readOnlyProfile.libraryCategories?.manga || [],
            ln: readOnlyProfile.libraryCategories?.ln || [],
        }
        : categories;

    useEffect(() => {
        const updateNetworkStatus = () => setIsOffline(!navigator.onLine);
        window.addEventListener('online', updateNetworkStatus);
        window.addEventListener('offline', updateNetworkStatus);
        return () => {
            window.removeEventListener('online', updateNetworkStatus);
            window.removeEventListener('offline', updateNetworkStatus);
        };
    }, []);

    useEffect(() => {
        if (!isMobileTabMenuOpen) return;

        const closeOnOutsidePointer = (event: PointerEvent) => {
            if (!mobileTabMenuRef.current?.contains(event.target as Node)) {
                setIsMobileTabMenuOpen(false);
            }
        };
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setIsMobileTabMenuOpen(false);
        };

        document.addEventListener('pointerdown', closeOnOutsidePointer);
        document.addEventListener('keydown', closeOnEscape);
        return () => {
            document.removeEventListener('pointerdown', closeOnOutsidePointer);
            document.removeEventListener('keydown', closeOnEscape);
        };
    }, [isMobileTabMenuOpen]);

    useEffect(() => {
        if (!isLibraryActionsOpen) return;

        const closeOnOutsidePointer = (event: PointerEvent) => {
            if (!libraryActionsRef.current?.contains(event.target as Node)) {
                setIsLibraryActionsOpen(false);
            }
        };
        document.addEventListener('pointerdown', closeOnOutsidePointer);
        return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
    }, [isLibraryActionsOpen]);

    useEffect(() => {
        if (!isSearchOpen) return;

        const closeOnOutsidePointer = (event: PointerEvent) => {
            const isClickInsideSearch = (event.target as Element)?.closest?.('[data-library-search]');
            if (!isClickInsideSearch) {
                setIsSearchOpen(false);
                const clickedInteractive = (event.target as Element)?.closest?.('button, a');
                if (!clickedInteractive) {
                    setSearchQuery('');
                }
            }
        };
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setSearchQuery('');
                setIsSearchOpen(false);
            }
        };

        document.addEventListener('pointerdown', closeOnOutsidePointer);
        document.addEventListener('keydown', closeOnEscape);
        return () => {
            document.removeEventListener('pointerdown', closeOnOutsidePointer);
            document.removeEventListener('keydown', closeOnEscape);
        };
    }, [isSearchOpen]);

    useEffect(() => {
        const hasOpenLibraryModal = isLibraryOptionsOpen || isAddCategoryOpen || isMoveEntriesToCategoryOpen;
        document.body.classList.toggle('yorumi-library-modal-open', hasOpenLibraryModal);
        return () => document.body.classList.remove('yorumi-library-modal-open');
    }, [isAddCategoryOpen, isLibraryOptionsOpen, isMoveEntriesToCategoryOpen]);

    const filteredWatching = useMemo(() => {
        const entries = new Map<string, (typeof continueWatchingList)[number]>();
        continueWatchingList.forEach((item) => {
            const key = normalizeLibraryTitle(item.animeTitle) || String(item.animeId);
            const current = entries.get(key);
            if (!current || (item.lastWatched || item.timestamp || 0) > (current.lastWatched || current.timestamp || 0)) {
                entries.set(key, item);
            }
        });
        return [...entries.values()].sort((a, b) => (b.lastWatched || b.timestamp || 0) - (a.lastWatched || a.timestamp || 0));
    }, [continueWatchingList]);
    const filteredReading = useMemo(() => continueReadingList, [continueReadingList]);
    const filteredLN = useMemo(() => continueLNList, [continueLNList]);
    const filteredWatchList = useMemo(() => {
        const entries = new Map<string, (typeof watchList)[number]>();
        watchList.forEach((item) => {
            const key = normalizeLibraryTitle(item.title) || String(item.id);
            const current = entries.get(key);
            if (!current || item.addedAt > current.addedAt) entries.set(key, item);
        });
        return [...entries.values()].sort((a, b) => b.addedAt - a.addedAt);
    }, [watchList]);
    const filteredReadList = useMemo(() => readList, [readList]);
    const filteredLNList = useMemo(() => lnReadList, [lnReadList]);

    const mobileLibraryItems = useMemo<MobileLibraryItem[]>(() => {
        const items = new Map<string, MobileLibraryItem>();
        if (activeTab === 'anime') {
            filteredWatchList.forEach((item) => {
                const progress = filteredWatching.find((entry) => String(entry.animeId) === String(item.id) || entry.animeTitle?.toLowerCase() === item.title.toLowerCase());
                const routeId = getAnimeRouteId(item);
                const finalRouteId = routeId || String(item.id || item.anilistId || '');
                const parsedRouteRef = parseAnimeRouteId(finalRouteId);
                const rawId = String(item.anilistId || item.id || '').trim();
                const parsedId = Number.parseInt(rawId, 10);
                const hasNumericId = Number.isFinite(parsedId) && /^\d+$/.test(rawId);
                const malId = Number.parseInt(String(item.malId || '0'), 10) || (parsedRouteRef?.source === 'mal' ? Number(parsedRouteRef.id) : 0);
                const anilistId = parsedRouteRef?.source === 'anilist' ? Number(parsedRouteRef.id) : (hasNumericId ? parsedId : 0);
                const tmdbId = parsedRouteRef?.source === 'tmdb' ? Number(parsedRouteRef.id) : undefined;
                const scraperId = String(item.scraperId || '').trim() || (parsedRouteRef?.source === 'scraper' ? String(parsedRouteRef.id) : (!hasNumericId ? rawId : undefined));

                items.set(String(item.id), {
                    id: String(item.id),
                    title: item.title,
                    image: item.image,
                    count: item.totalCount || progress?.totalCount || progress?.episodeNumber,
                    route: `/anime/details/${encodeURIComponent(finalRouteId)}`,
                    state: {
                        anime: {
                            id: anilistId,
                            mal_id: malId,
                            tmdbId,
                            scraperId,
                            source: parsedRouteRef?.source,
                            title: item.title,
                            title_english: item.title,
                            images: { jpg: { image_url: item.image, large_image_url: item.image } },
                            episodes: item.totalCount || progress?.totalCount || null,
                            status: item.mediaStatus || 'UNKNOWN',
                            type: item.type || 'TV',
                            score: item.score || 0,
                            synopsis: item.synopsis || '',
                            genres: item.genres?.map((name) => ({ name, mal_id: 0 })) || []
                        }
                    },
                });
            });
            filteredWatching.forEach((item) => {
                if ([...items.values()].some((entry) => entry.title.toLowerCase() === item.animeTitle.toLowerCase())) return;
                const rawId = String(item.animeId || '').trim();
                const parsedRef = parseAnimeRouteId(rawId);
                const routeId = parsedRef ? buildAnimeRouteId(parsedRef) : rawId;
                const finalRouteId = routeId || rawId;
                const parsedId = Number.parseInt(rawId, 10);
                const hasNumericId = Number.isFinite(parsedId) && /^\d+$/.test(rawId);
                const anilistId = parsedRef?.source === 'anilist' ? Number(parsedRef.id) : (hasNumericId ? parsedId : 0);
                const malId = parsedRef?.source === 'mal' ? Number(parsedRef.id) : 0;
                const tmdbId = parsedRef?.source === 'tmdb' ? Number(parsedRef.id) : undefined;
                const scraperId = parsedRef?.source === 'scraper' ? String(parsedRef.id) : (!hasNumericId ? rawId : undefined);

                items.set(String(item.animeId), {
                    id: String(item.animeId),
                    title: item.animeTitle,
                    image: item.animePoster || item.animeImage,
                    count: item.totalCount || item.episodeNumber,
                    route: `/anime/details/${encodeURIComponent(finalRouteId)}`,
                    state: {
                        anime: {
                            id: anilistId,
                            mal_id: malId,
                            tmdbId,
                            scraperId,
                            source: parsedRef?.source,
                            title: item.animeTitle,
                            title_english: item.animeTitle,
                            images: { jpg: { image_url: item.animePoster || item.animeImage, large_image_url: item.animePoster || item.animeImage } },
                            episodes: item.totalCount || null,
                            status: item.mediaStatus || 'UNKNOWN',
                            type: 'TV',
                            score: 0,
                            synopsis: '',
                            genres: []
                        }
                    }
                });
            });
            const animeDownloadGroups = new Map<string, typeof downloads>();
            downloads.forEach((download) => {
                const key = String(download.animeId || download.animeTitle).trim();
                animeDownloadGroups.set(key, [...(animeDownloadGroups.get(key) || []), download]);
            });
            animeDownloadGroups.forEach((group, key) => {
                const first = group[0];
                if (!first) return;
                const existing = items.get(key) || [...items.values()].find((item) => item.title.toLowerCase() === first.animeTitle.toLowerCase());
                const existingAnime = existing?.state?.anime as Record<string, unknown> | undefined;
                const offlineMeta = downloadService.getOfflineAnimeMetadata(key, first.animeTitle, getStoredAnilistId(key) || undefined);
                const bestImage = existing?.image || offlineMeta?.poster || first.animeImage;
                items.set(existing?.id || key, {
                    ...(existing || {}),
                    id: existing?.id || key,
                    title: offlineMeta?.title || first.animeTitle,
                    image: bestImage,
                    count: isOffline ? group.length : existing?.count,
                    route: existing?.route || `/anime/details/${encodeURIComponent(normalizeStoredAnimeRouteId(key) || key)}`,
                    state: {
                        ...(existing?.state || {}),
                        fromDownloads: isOffline,
                        animeTitle: offlineMeta?.title || first.animeTitle,
                        downloadedEpisodes: group,
                        anime: {
                            ...(existingAnime || {}),
                            id: existingAnime?.id || offlineMeta?.anilistId || getStoredAnilistId(key),
                            mal_id: existingAnime?.mal_id || offlineMeta?.malId || 0,
                            tmdbId: existingAnime?.tmdbId || offlineMeta?.tmdbId,
                            title: offlineMeta?.title || first.animeTitle,
                            title_english: offlineMeta?.title_english || first.animeTitle,
                            synopsis: (existingAnime?.synopsis as string) || offlineMeta?.synopsis || '',
                            score: (existingAnime?.score as number) || offlineMeta?.score || 0,
                            year: (existingAnime?.year as number) || offlineMeta?.year,
                            rating: (existingAnime?.rating as string) || offlineMeta?.rating,
                            status: (existingAnime?.status as string) || offlineMeta?.status,
                            type: (existingAnime?.type as string) || offlineMeta?.type || 'TV',
                            episodes: (existingAnime?.episodes as number) || offlineMeta?.episodes || group.length,
                            genres: (existingAnime?.genres as Array<{ name: string; mal_id: number }>)?.length
                                ? existingAnime?.genres
                                : (offlineMeta?.genres || []).map((name) => ({ name, mal_id: 0 })),
                            anilist_banner_image: (existingAnime?.anilist_banner_image as string) || offlineMeta?.banner || offlineMeta?.backdrop,
                            images: { jpg: { image_url: bestImage, large_image_url: bestImage } },
                        },
                    },
                });
            });
        } else if (activeTab === 'manga') {
            filteredReadList.forEach((item) => {
                const progress = filteredReading.find((entry) => String(entry.mangaId) === String(item.id) || entry.mangaTitle?.toLowerCase() === item.title.toLowerCase());
                const routeId = String(item.scraperId || '').startsWith('vault') ? item.scraperId : item.id;
                items.set(String(item.id), { id: String(item.id), title: item.title, image: item.image, count: item.totalCount || progress?.totalCount || Number(progress?.chapterNumber), route: `/manga/details/${encodeURIComponent(String(routeId))}`, state: { manga: { id: item.id, mal_id: item.malId || item.id, scraper_id: item.scraperId, title: item.title, title_english: item.title, images: { jpg: { image_url: item.image, large_image_url: item.image } }, chapters: item.totalCount || progress?.totalCount || null, status: item.mediaStatus, type: item.type || 'Manga', score: item.score || 0, synopsis: item.synopsis, genres: item.genres?.map((name) => ({ name, mal_id: 0 })) || [] } } });
            });
            filteredReading.forEach((item) => {
                if ([...items.values()].some((entry) => entry.title.toLowerCase() === item.mangaTitle.toLowerCase())) return;
                items.set(String(item.mangaId), { id: String(item.mangaId), title: item.mangaTitle, image: item.mangaPoster || item.mangaImage, count: item.totalCount || Number(item.chapterNumber), route: `/manga/details/${encodeURIComponent(item.mangaId)}`, state: { manga: { id: item.mangaId, mal_id: item.mangaId, scraper_id: item.mangaId, title: item.mangaTitle, title_english: item.mangaTitle, images: { jpg: { image_url: item.mangaPoster || item.mangaImage, large_image_url: item.mangaPoster || item.mangaImage } }, chapters: item.totalCount || null, status: item.mediaStatus, type: 'Manga', score: 0 } } });
            });
            const mangaDownloadGroups = new Map<string, typeof mangaDownloads>();
            mangaDownloads.forEach((download) => {
                const key = String(download.mangaId || download.mangaTitle).trim();
                mangaDownloadGroups.set(key, [...(mangaDownloadGroups.get(key) || []), download]);
            });
            mangaDownloadGroups.forEach((group, key) => {
                const first = group[0];
                if (!first) return;
                const existing = items.get(key) || [...items.values()].find((item) => item.title.toLowerCase() === first.mangaTitle.toLowerCase());
                const existingManga = existing?.state?.manga as Record<string, unknown> | undefined;
                items.set(existing?.id || key, {
                    ...(existing || {}), id: existing?.id || key, title: first.mangaTitle, image: existing?.image || first.mangaImage,
                    count: isOffline ? group.length : existing?.count, route: existing?.route || `/manga/details/${encodeURIComponent(key)}`,
                    state: { ...(existing?.state || {}), fromDownloads: isOffline, downloadedChapters: group, manga: { ...(existingManga || {}), id: existingManga?.id || key, mal_id: existingManga?.mal_id || key, scraper_id: existingManga?.scraper_id || key, title: first.mangaTitle, title_english: first.mangaTitle, images: { jpg: { image_url: existing?.image || first.mangaImage, large_image_url: existing?.image || first.mangaImage } } } },
                });
            });
        } else {
            filteredLNList.forEach((item) => {
                const progress = filteredLN.find((entry) => String(entry.novelId) === String(item.id));
                items.set(String(item.id), { id: String(item.id), title: item.title, image: item.image, count: item.totalCount || progress?.chapterNumber, route: `/ln/details/${encodeURIComponent(String(item.id))}`, state: { ln: { id: item.id, mal_id: item.id, title: item.title, title_english: item.title, images: { jpg: { image_url: item.image, large_image_url: item.image } }, chapters: item.totalCount || null, status: item.mediaStatus, type: item.type || 'NOVEL', score: item.score || 0, synopsis: item.synopsis, genres: item.genres?.map((name) => ({ name, mal_id: 0 })) || [] } } });
            });
            filteredLN.forEach((item) => {
                if ([...items.values()].some((entry) => entry.title.toLowerCase() === item.novelTitle.toLowerCase())) return;
                items.set(String(item.novelId), { id: String(item.novelId), title: item.novelTitle, image: item.coverImage, count: item.chapterNumber, route: `/ln/details/${encodeURIComponent(String(item.novelId))}`, state: { ln: { id: item.novelId, mal_id: item.novelId, scraper_id: String(item.novelId).includes(':') ? item.novelId : undefined, title: item.novelTitle, title_english: item.novelTitle, images: { jpg: { image_url: item.coverImage, large_image_url: item.coverImage } }, type: 'NOVEL', score: 0 } } });
            });
            const lnDownloadGroups = new Map<string, typeof lnDownloads>();
            lnDownloads.forEach((download) => {
                const key = String(download.novelId || download.novelTitle).trim();
                lnDownloadGroups.set(key, [...(lnDownloadGroups.get(key) || []), download]);
            });
            lnDownloadGroups.forEach((group, key) => {
                const first = group[0];
                if (!first) return;
                const existing = items.get(key) || [...items.values()].find((item) => item.title.toLowerCase() === first.novelTitle.toLowerCase());
                const existingLN = existing?.state?.ln as Record<string, unknown> | undefined;
                items.set(existing?.id || key, {
                    ...(existing || {}), id: existing?.id || key, title: first.novelTitle, image: existing?.image || first.novelImage,
                    count: isOffline ? group.length : existing?.count, route: existing?.route || `/ln/details/${encodeURIComponent(key)}`,
                    state: { ...(existing?.state || {}), fromDownloads: isOffline, downloadedChapters: group, ln: { ...(existingLN || {}), id: existingLN?.id || key, mal_id: existingLN?.mal_id || key, scraper_id: existingLN?.scraper_id || key, title: first.novelTitle, title_english: first.novelTitle, images: { jpg: { image_url: existing?.image || first.novelImage, large_image_url: existing?.image || first.novelImage } }, type: 'NOVEL' } },
                });
            });
        }
        if (activeTab === 'anime') {
            favoriteAnime.forEach((fav) => {
                const key = String(fav.id);
                const normalizedTitle = normalizeLibraryTitle(fav.title);
                const exists = [...items.values()].some((entry) => entry.id === key || normalizeLibraryTitle(entry.title) === normalizedTitle);
                if (exists) return;
                const parsedRouteRef = parseAnimeRouteId(key);
                const finalRouteId = parsedRouteRef ? buildAnimeRouteId(parsedRouteRef) : key;
                const parsedId = Number.parseInt(key, 10);
                const hasNumericId = Number.isFinite(parsedId) && /^\d+$/.test(key);
                items.set(key, {
                    id: key,
                    title: fav.title,
                    image: fav.image,
                    route: `/anime/details/${encodeURIComponent(finalRouteId)}`,
                    state: {
                        anime: {
                            id: hasNumericId ? parsedId : 0,
                            mal_id: 0,
                            title: fav.title,
                            title_english: fav.title,
                            images: { jpg: { image_url: fav.image, large_image_url: fav.image } },
                            synopsis: fav.synopsis || '',
                            type: 'TV',
                        },
                    },
                });
            });
        } else if (activeTab === 'manga') {
            favoriteManga.forEach((fav) => {
                const key = String(fav.id);
                const normalizedTitle = normalizeLibraryTitle(fav.title);
                const exists = [...items.values()].some((entry) => entry.id === key || normalizeLibraryTitle(entry.title) === normalizedTitle);
                if (exists) return;
                items.set(key, {
                    id: key,
                    title: fav.title,
                    image: fav.image,
                    route: `/manga/details/${encodeURIComponent(key)}`,
                    state: {
                        manga: {
                            id: key,
                            mal_id: key,
                            title: fav.title,
                            title_english: fav.title,
                            images: { jpg: { image_url: fav.image, large_image_url: fav.image } },
                        },
                    },
                });
            });
        } else {
            favoriteLN.forEach((fav) => {
                const key = String(fav.id);
                const normalizedTitle = normalizeLibraryTitle(fav.title);
                const exists = [...items.values()].some((entry) => entry.id === key || normalizeLibraryTitle(entry.title) === normalizedTitle);
                if (exists) return;
                items.set(key, {
                    id: key,
                    title: fav.title,
                    image: fav.image,
                    route: `/ln/details/${encodeURIComponent(key)}`,
                    state: {
                        ln: {
                            id: key,
                            mal_id: key,
                            title: fav.title,
                            title_english: fav.title,
                            images: { jpg: { image_url: fav.image, large_image_url: fav.image } },
                            type: 'NOVEL',
                        },
                    },
                });
            });
        }
        return [...items.values()].map((item) => {
            const normalizedTitle = normalizeLibraryTitle(item.title);
            if (activeTab === 'anime') {
                const progress = filteredWatching.find((entry) => String(entry.animeId) === item.id || normalizeLibraryTitle(entry.animeTitle) === normalizedTitle);
                const bookmark = filteredWatchList.find((entry) => String(entry.id) === item.id || normalizeLibraryTitle(entry.title) === normalizedTitle);
                const fav = favoriteAnime.find((entry) => String(entry.id) === item.id || normalizeLibraryTitle(entry.title) === normalizedTitle);
                return {
                    ...item,
                    downloaded: downloads.some((entry) => String(entry.animeId) === item.id || normalizeLibraryTitle(entry.animeTitle) === normalizedTitle),
                    started: Boolean(progress),
                    completed: bookmark?.status === 'completed',
                    watchlisted: Boolean(bookmark),
                    favorited: Boolean(fav),
                    updatedAt: progress?.lastWatched || progress?.timestamp || bookmark?.addedAt || fav?.addedAt || 0,
                };
            }
            if (activeTab === 'manga') {
                const progress = filteredReading.find((entry) => String(entry.mangaId) === item.id || normalizeLibraryTitle(entry.mangaTitle) === normalizedTitle);
                const bookmark = filteredReadList.find((entry) => String(entry.id) === item.id || normalizeLibraryTitle(entry.title) === normalizedTitle);
                const fav = favoriteManga.find((entry) => String(entry.id) === item.id || normalizeLibraryTitle(entry.title) === normalizedTitle);
                return {
                    ...item,
                    downloaded: mangaDownloads.some((entry) => String(entry.mangaId) === item.id || normalizeLibraryTitle(entry.mangaTitle) === normalizedTitle),
                    started: Boolean(progress),
                    completed: bookmark?.status === 'completed',
                    watchlisted: Boolean(bookmark),
                    favorited: Boolean(fav),
                    updatedAt: progress?.lastRead || progress?.timestamp || bookmark?.addedAt || fav?.addedAt || 0,
                };
            }

            const progress = filteredLN.find((entry) => String(entry.novelId) === item.id || normalizeLibraryTitle(entry.novelTitle) === normalizedTitle);
            const bookmark = filteredLNList.find((entry) => String(entry.id) === item.id || normalizeLibraryTitle(entry.title) === normalizedTitle);
            const fav = favoriteLN.find((entry) => String(entry.id) === item.id || normalizeLibraryTitle(entry.title) === normalizedTitle);
            return {
                ...item,
                downloaded: lnDownloads.some((entry) => String(entry.novelId) === item.id || normalizeLibraryTitle(entry.novelTitle) === normalizedTitle),
                started: Boolean(progress),
                completed: /completed|finished/i.test(bookmark?.mediaStatus || ''),
                watchlisted: Boolean(bookmark),
                favorited: Boolean(fav),
                updatedAt: progress ? Date.parse(progress.updatedAt) || 0 : Date.parse(bookmark?.addedAt || '') || fav?.addedAt || 0,
            };
        });
    }, [activeTab, downloads, favoriteAnime, favoriteLN, favoriteManga, filteredLN, filteredLNList, filteredReadList, filteredReading, filteredWatchList, filteredWatching, isOffline, lnDownloads, mangaDownloads]);

    const hasWatchlist = useMemo(
        () => mobileLibraryItems.some((item) => item.watchlisted),
        [mobileLibraryItems]
    );
    const hasFavorites = useMemo(
        () => mobileLibraryItems.some((item) => item.favorited),
        [mobileLibraryItems]
    );

    useEffect(() => {
        if (activeCategoryId === WATCHLIST_CATEGORY_ID && !hasWatchlist) {
            setActiveCategoryId('all');
        } else if (activeCategoryId === FAVORITES_CATEGORY_ID && !hasFavorites) {
            setActiveCategoryId('all');
        }
    }, [activeCategoryId, hasFavorites, hasWatchlist]);

    const visibleMobileLibraryItems = useMemo(() => {
        const isWatchlistCategory = activeCategoryId === WATCHLIST_CATEGORY_ID;
        const isFavoritesCategory = activeCategoryId === FAVORITES_CATEGORY_ID;
        const isBuiltInCategory = isWatchlistCategory || isFavoritesCategory;
        const category = isBuiltInCategory ? null : activeCategories[activeTab].find((entry) => entry.id === activeCategoryId);
        const categoryIds = category ? new Set(category.itemIds) : null;
        const query = normalizeLibraryTitle(searchQuery);
        const filtered = mobileLibraryItems.filter((item) => {
            if (isWatchlistCategory && !item.watchlisted) return false;
            if (isFavoritesCategory && !item.favorited) return false;
            if (categoryIds && !categoryIds.has(item.id)) return false;
            if (query && !normalizeLibraryTitle(item.title).includes(query)) return false;
            for (const filter of activeFilters) {
                if (filter === 'downloaded' && !item.downloaded) return false;
                if (filter === 'started' && !item.started) return false;
                if (filter === 'completed' && !item.completed) return false;
            }
            return true;
        });

        return filtered.sort((a, b) => {
            let comparison = 0;
            if (sortBy === 'alphabetical') comparison = a.title.localeCompare(b.title);
            if (sortBy === 'count') comparison = (a.count || 0) - (b.count || 0);
            if (sortBy === 'recent') comparison = (a.updatedAt || 0) - (b.updatedAt || 0);
            return sortAscending ? comparison : -comparison;
        });
    }, [activeCategories, activeCategoryId, activeFilters, activeTab, mobileLibraryItems, searchQuery, sortAscending, sortBy]);

    const saveCategory = () => {
        const name = categoryName.trim();
        if (!name) return;
        const category: LibraryCategory = {
            id: `${Date.now()}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
            name,
            itemIds: [...categoryItemIds],
        };
        const next = { ...categories, [activeTab]: [...categories[activeTab], category] };
        setCategories(next);
        setActiveCategoryId(category.id);
        setCategoryName('');
        setCategoryItemIds(new Set());
        setIsAddCategoryOpen(false);
        try {
            localStorage.setItem(LIBRARY_CATEGORIES_KEY, JSON.stringify(next));
        } catch {
            // Ignore storage access errors.
        }
    };

    const deleteCategory = (categoryId: string) => {
        const next = {
            ...categories,
            [activeTab]: categories[activeTab].filter((entry) => entry.id !== categoryId),
        };
        setCategories(next);
        if (activeCategoryId === categoryId) {
            setActiveCategoryId('all');
        }
        try {
            localStorage.setItem(LIBRARY_CATEGORIES_KEY, JSON.stringify(next));
        } catch {
            // Ignore storage access errors.
        }
    };

    const deleteLibraryEntry = (event: React.MouseEvent, item: MobileLibraryItem) => {
        event.stopPropagation();
        event.preventDefault();
        const normalizedTitle = normalizeLibraryTitle(item.title);
        const matchesIdOrTitle = (idVal: unknown, titleVal?: string) =>
            String(idVal) === item.id || (Boolean(titleVal) && normalizeLibraryTitle(titleVal!) === normalizedTitle);

        if (activeCategoryId === WATCHLIST_CATEGORY_ID) {
            if (activeTab === 'anime') {
                watchList.filter((e) => matchesIdOrTitle(e.id, e.title)).forEach((e) => removeFromWatchList(String(e.id)));
            } else if (activeTab === 'manga') {
                readList.filter((e) => matchesIdOrTitle(e.id, e.title)).forEach((e) => removeFromReadList(String(e.id)));
            } else {
                lnReadList.filter((e) => matchesIdOrTitle(e.id, e.title)).forEach((e) => toggleLNReadList(e));
            }
            return;
        }

        if (activeCategoryId === FAVORITES_CATEGORY_ID) {
            if (activeTab === 'anime') {
                favoriteAnime.filter((e) => matchesIdOrTitle(e.id, e.title)).forEach((e) => void removeFavoriteAnime(e.id));
            } else if (activeTab === 'manga') {
                favoriteManga.filter((e) => matchesIdOrTitle(e.id, e.title)).forEach((e) => void removeFavoriteManga(e.id));
            } else {
                favoriteLN.filter((e) => matchesIdOrTitle(e.id, e.title)).forEach((e) => void removeFavoriteLN(e.id));
            }
            return;
        }

        if (activeCategoryId !== 'all') {
            const next = {
                ...categories,
                [activeTab]: categories[activeTab].map((cat) =>
                    cat.id === activeCategoryId
                        ? { ...cat, itemIds: cat.itemIds.filter((entryId) => entryId !== item.id) }
                        : cat
                ),
            };
            setCategories(next);
            try {
                localStorage.setItem(LIBRARY_CATEGORIES_KEY, JSON.stringify(next));
            } catch {
                // Ignore storage access errors.
            }
            return;
        }

        if (activeTab === 'anime') {
            watchList.filter((e) => matchesIdOrTitle(e.id, e.title)).forEach((e) => removeFromWatchList(String(e.id)));
            continueWatchingList.filter((e) => matchesIdOrTitle(e.animeId, e.animeTitle)).forEach((e) => removeWatchingHistory(e.animeId));
            favoriteAnime.filter((e) => matchesIdOrTitle(e.id, e.title)).forEach((e) => void removeFavoriteAnime(e.id));
            downloads.filter((e) => matchesIdOrTitle(e.animeId, e.animeTitle)).forEach((e) => void deleteDownload(e.animeId, e.episodeNumber));
        } else if (activeTab === 'manga') {
            readList.filter((e) => matchesIdOrTitle(e.id, e.title)).forEach((e) => removeFromReadList(String(e.id)));
            continueReadingList.filter((e) => matchesIdOrTitle(e.mangaId, e.mangaTitle)).forEach((e) => removeReadingHistory(e.mangaId));
            favoriteManga.filter((e) => matchesIdOrTitle(e.id, e.title)).forEach((e) => void removeFavoriteManga(e.id));
            mangaDownloads.filter((e) => matchesIdOrTitle(e.mangaId, e.mangaTitle)).forEach((e) => void deleteMangaDownload(e.mangaId, e.chapterId));
        } else {
            lnReadList.filter((e) => matchesIdOrTitle(e.id, e.title)).forEach((e) => toggleLNReadList(e));
            continueLNList.filter((e) => matchesIdOrTitle(e.novelId, e.novelTitle)).forEach((e) => removeLNProgress(e.novelId));
            favoriteLN.filter((e) => matchesIdOrTitle(e.id, e.title)).forEach((e) => void removeFavoriteLN(e.id));
            lnDownloads.filter((e) => matchesIdOrTitle(e.novelId, e.novelTitle)).forEach((e) => void deleteLNDownload(e.novelId, e.chapterId));
        }

        const nextCategories = {
            ...categories,
            [activeTab]: categories[activeTab].map((cat) => ({
                ...cat,
                itemIds: cat.itemIds.filter((entryId) => entryId !== item.id),
            })),
        };
        setCategories(nextCategories);
        try {
            localStorage.setItem(LIBRARY_CATEGORIES_KEY, JSON.stringify(nextCategories));
        } catch {
            // Ignore storage access errors.
        }
    };

    const openRandomEntry = () => {
        if (visibleMobileLibraryItems.length === 0) return;
        const item = visibleMobileLibraryItems[Math.floor(Math.random() * visibleMobileLibraryItems.length)];
        navigate(item.route, { state: item.state });
    };

    return (
        <div className="relative min-h-screen bg-[#0a0a0a] pt-0 pb-24 md:pt-0">
            {/* Profile Banner + Activity & Top Genres Overview */}
            <LibraryProfileOverview
                continueWatchingList={filteredWatching}
                continueReadingList={filteredReading}
                continueLNList={filteredLN}
                watchList={filteredWatchList}
                readList={filteredReadList}
                lnReadList={filteredLNList}
                publicProfileOverride={readOnlyProfile}
            />

            {/* Single-row transparent Library toolbar matching DetailsPage style */}
            <div className="relative z-20 w-full pt-1 pb-2 mb-4 md:mb-6">
                <div className="w-full max-w-7xl mx-auto px-3.5 sm:px-4 md:px-14">
                    <div className="flex items-center justify-between gap-2 md:gap-4">
                        {/* Left: Media Switcher + Inline Categories (unified segmented pill on mobile & desktop) */}
                        <div className="flex items-center gap-2 md:gap-5 min-w-0 flex-1">
                            <div className="flex h-8 md:h-9 items-center bg-black/45 backdrop-blur-md rounded-full p-0.5 md:p-1 gap-0.5 shrink-0">
                                {(Object.keys(LIBRARY_TAB_LABELS) as LibraryTab[]).map((tab) => {
                                    const Icon = tab === 'anime' ? Tv : tab === 'manga' ? BookOpen : BookText;
                                    return (
                                        <button
                                            key={tab}
                                            type="button"
                                            onClick={() => handleTabChange(tab)}
                                            className={`flex h-full items-center gap-1 md:gap-1.5 px-2 sm:px-2.5 md:px-3.5 rounded-full text-[11px] sm:text-xs md:text-[13px] whitespace-nowrap transition-all cursor-pointer ${
                                                activeTab === tab
                                                    ? 'bg-white text-black font-semibold'
                                                    : 'text-white/75 hover:text-white hover:bg-white/10 font-medium'
                                            }`}
                                        >
                                            <Icon className="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0" />
                                            <span className="md:hidden">{MOBILE_LIBRARY_TAB_LABELS[tab]}</span>
                                            <span className="hidden md:inline">{LIBRARY_TAB_LABELS[tab]}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Divider */}
                            <span className="hidden md:block h-4 w-px bg-white/20 shrink-0" />

                            {/* Desktop Inline Categories */}
                            <div className="hidden md:flex items-center gap-5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                <button
                                    type="button"
                                    onClick={() => setActiveCategoryId('all')}
                                    className={`relative shrink-0 py-1.5 text-[13px] transition-colors cursor-pointer ${
                                        activeCategoryId === 'all' ? 'text-white font-semibold' : 'text-white/70 hover:text-white font-medium'
                                    }`}
                                >
                                    All
                                    {activeCategoryId === 'all' && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-white" />}
                                </button>
                                {hasWatchlist && (
                                    <button
                                        type="button"
                                        onClick={() => setActiveCategoryId(WATCHLIST_CATEGORY_ID)}
                                        className={`relative shrink-0 py-1.5 text-[13px] transition-colors cursor-pointer ${
                                            activeCategoryId === WATCHLIST_CATEGORY_ID ? 'text-white font-semibold' : 'text-white/70 hover:text-white font-medium'
                                        }`}
                                    >
                                        {activeTab === 'anime' ? 'Watchlist' : 'Read list'}
                                        {activeCategoryId === WATCHLIST_CATEGORY_ID && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-white" />}
                                    </button>
                                )}
                                {hasFavorites && (
                                    <button
                                        type="button"
                                        onClick={() => setActiveCategoryId(FAVORITES_CATEGORY_ID)}
                                        className={`relative shrink-0 py-1.5 text-[13px] transition-colors cursor-pointer ${
                                            activeCategoryId === FAVORITES_CATEGORY_ID ? 'text-white font-semibold' : 'text-white/70 hover:text-white font-medium'
                                        }`}
                                    >
                                        Favorites
                                        {activeCategoryId === FAVORITES_CATEGORY_ID && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-white" />}
                                    </button>
                                )}
                                {activeCategories[activeTab].map((category) => (
                                    <button
                                        key={category.id}
                                        type="button"
                                        onClick={() => setActiveCategoryId(category.id)}
                                        className={`relative shrink-0 py-1.5 text-[13px] transition-colors cursor-pointer ${
                                            activeCategoryId === category.id ? 'text-white font-semibold' : 'text-white/70 hover:text-white font-medium'
                                        }`}
                                    >
                                        {category.name}
                                        {activeCategoryId === category.id && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-white" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Right side controls: Search, Category actions, Options, More */}
                        <div className="flex items-center gap-1 md:gap-1.5 shrink-0">
                            {/* Mobile Search Toggle Button */}
                            <button
                                type="button"
                                data-library-search="true"
                                onClick={() => {
                                    setIsSearchOpen((open) => {
                                        const next = !open;
                                        if (!next) setSearchQuery('');
                                        return next;
                                    });
                                }}
                                className={`grid h-8 w-8 place-items-center rounded-full bg-black/45 backdrop-blur-md transition-colors md:hidden ${
                                    isSearchOpen || searchQuery ? 'text-white' : 'text-white/85 hover:text-white'
                                }`}
                                aria-label="Search library"
                            >
                                <Search className="h-3.5 w-3.5" />
                            </button>

                            {/* Desktop Expanding Search Input (swapped before + New category) */}
                            <div
                                ref={searchContainerRef}
                                data-library-search="true"
                                className={`hidden md:flex items-center rounded-full bg-black/40 backdrop-blur-md transition-all duration-300 ease-out overflow-hidden ${
                                    isSearchOpen
                                        ? 'w-56 lg:w-64 pr-1'
                                        : 'w-9'
                                }`}
                            >
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!isSearchOpen) {
                                            setIsSearchOpen(true);
                                            setTimeout(() => searchInputRef.current?.focus(), 50);
                                        }
                                    }}
                                    className={`grid h-9 w-9 shrink-0 place-items-center transition-colors cursor-pointer ${
                                        isSearchOpen ? 'text-white/80 cursor-default' : 'text-white/90 hover:text-white'
                                    }`}
                                    aria-label="Search library"
                                >
                                    <Search className="h-4 w-4" />
                                </button>
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    value={searchQuery}
                                    onChange={(event) => setSearchQuery(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Escape') {
                                            setSearchQuery('');
                                            setIsSearchOpen(false);
                                        }
                                    }}
                                    placeholder={`Search ${MOBILE_LIBRARY_TAB_LABELS[activeTab]}…`}
                                    className={`h-8 w-full bg-transparent px-1 text-sm text-white placeholder:text-white/55 outline-none transition-opacity duration-200 ${
                                        isSearchOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                                    }`}
                                    tabIndex={isSearchOpen ? 0 : -1}
                                />
                                {isSearchOpen && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearchQuery('');
                                            setIsSearchOpen(false);
                                        }}
                                        className="grid h-7 w-7 shrink-0 place-items-center text-white/75 hover:text-white cursor-pointer"
                                        aria-label="Close search"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>

                            {!isReadOnly && activeCategoryId !== 'all' && activeCategoryId !== WATCHLIST_CATEGORY_ID && activeCategoryId !== FAVORITES_CATEGORY_ID && (
                                <button
                                    type="button"
                                    onClick={() => setIsDeleteCategoryOpen(true)}
                                    className="hidden md:flex h-9 items-center gap-1.5 rounded-full bg-black/40 hover:bg-black/55 backdrop-blur-md px-3.5 text-[13px] font-medium text-red-400 transition-colors cursor-pointer"
                                    title="Delete category"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    <span>Delete</span>
                                </button>
                            )}

                            {!isReadOnly && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCategoryItemIds(new Set());
                                        setIsAddCategoryOpen(true);
                                    }}
                                    className="hidden md:flex h-9 items-center gap-1.5 rounded-full bg-black/40 hover:bg-black/55 backdrop-blur-md px-3.5 text-[13px] font-medium text-white/95 hover:text-white transition-colors cursor-pointer"
                                    title="New category"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    <span>New category</span>
                                </button>
                            )}

                            {/* Filter, Sort & Display Options */}
                            <button
                                type="button"
                                onClick={() => setIsLibraryOptionsOpen(true)}
                                className={`relative grid h-8 w-8 md:h-9 md:w-9 place-items-center rounded-full bg-black/45 md:bg-black/40 hover:bg-black/55 backdrop-blur-md transition-colors cursor-pointer ${
                                    activeFilters.size > 0 ? 'text-white' : 'text-white/90 hover:text-white'
                                }`}
                                aria-label="Filter, sort, and display options"
                            >
                                <SlidersHorizontal className="h-3.5 w-3.5 md:h-[18px] md:w-[18px]" />
                                {activeFilters.size > 0 && (
                                    <span className="absolute -right-0.5 -top-0.5 grid h-4 w-4 place-items-center rounded-full bg-white text-[10px] font-bold text-black">
                                        {activeFilters.size}
                                    </span>
                                )}
                            </button>

                            {/* More Actions Dropdown */}
                            <div ref={libraryActionsRef} className="relative">
                                <button
                                    type="button"
                                    onClick={() => setIsLibraryActionsOpen((open) => !open)}
                                    className="grid h-8 w-8 md:h-9 md:w-9 place-items-center rounded-full bg-black/45 md:bg-black/40 hover:bg-black/55 backdrop-blur-md text-white/90 transition-colors hover:text-white cursor-pointer"
                                    aria-label="Library actions"
                                    aria-expanded={isLibraryActionsOpen}
                                >
                                    <MoreVertical className="h-3.5 w-3.5 md:h-[18px] md:w-[18px]" />
                                </button>
                                {isLibraryActionsOpen && (
                                    <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-52 overflow-hidden rounded-lg border border-white/10 bg-[#0d0e12]/85 backdrop-blur-2xl py-1.5 shadow-2xl shadow-black/80">
                                        {!isReadOnly && (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setCategoryItemIds(new Set());
                                                        setIsAddCategoryOpen(true);
                                                        setIsLibraryActionsOpen(false);
                                                    }}
                                                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-zinc-100 transition-colors hover:bg-white/10"
                                                >
                                                    <Plus className="h-4 w-4" />
                                                    Add category
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={categories[activeTab].length === 0}
                                                    onClick={() => {
                                                        const firstCat = categories[activeTab][0];
                                                        setMoveTargetCategoryId(firstCat?.id ?? '');
                                                        setMoveCategoryItemIds(new Set(firstCat?.itemIds ?? []));
                                                        setIsMoveEntriesToCategoryOpen(true);
                                                        setIsLibraryActionsOpen(false);
                                                    }}
                                                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-zinc-100 transition-colors hover:bg-white/10 disabled:text-zinc-600 disabled:hover:bg-transparent"
                                                >
                                                    <FolderInput className="h-4 w-4" />
                                                    Move to category
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={categories[activeTab].length === 0}
                                                    onClick={() => {
                                                        setIsDeleteCategoryOpen(true);
                                                        setIsLibraryActionsOpen(false);
                                                    }}
                                                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-red-400 transition-colors hover:bg-white/10 disabled:text-zinc-600 disabled:hover:bg-transparent"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                    Delete category
                                                </button>
                                            </>
                                        )}
                                        <button
                                            type="button"
                                            disabled={visibleMobileLibraryItems.length === 0}
                                            onClick={() => {
                                                openRandomEntry();
                                                setIsLibraryActionsOpen(false);
                                            }}
                                            className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-zinc-100 transition-colors hover:bg-white/10 disabled:text-zinc-600 disabled:hover:bg-transparent"
                                        >
                                            <Play className="h-4 w-4" />
                                            Open random entry
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Mobile Search Bar */}
                    {isSearchOpen && (
                        <div data-library-search="true" className="relative mt-3 md:hidden">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                            <input
                                autoFocus
                                type="search"
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Escape') {
                                        setSearchQuery('');
                                        setIsSearchOpen(false);
                                    }
                                }}
                                placeholder={`Search ${MOBILE_LIBRARY_TAB_LABELS[activeTab]}…`}
                                className="h-10 w-full rounded-xl border border-white/10 bg-[#171717] pl-10 pr-10 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-white/25"
                            />
                            {searchQuery ? (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                                    aria-label="Clear search"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setIsSearchOpen(false)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                                    aria-label="Close search"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    )}

                    {/* Mobile Categories Bar */}
                    <div className="mt-3 flex md:hidden items-center justify-between gap-3">
                        <div className="flex gap-5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            <button
                                type="button"
                                onClick={() => setActiveCategoryId('all')}
                                className={`relative shrink-0 pb-1.5 text-sm font-semibold transition-colors ${
                                    activeCategoryId === 'all' ? 'text-white' : 'text-zinc-400'
                                }`}
                            >
                                All
                                {activeCategoryId === 'all' && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-white" />}
                            </button>
                            {hasWatchlist && (
                                <button
                                    type="button"
                                    onClick={() => setActiveCategoryId(WATCHLIST_CATEGORY_ID)}
                                    className={`relative shrink-0 pb-1.5 text-sm font-semibold transition-colors ${
                                        activeCategoryId === WATCHLIST_CATEGORY_ID ? 'text-white' : 'text-zinc-400'
                                    }`}
                                >
                                    {activeTab === 'anime' ? 'Watchlist' : 'Read list'}
                                    {activeCategoryId === WATCHLIST_CATEGORY_ID && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-white" />}
                                </button>
                            )}
                            {hasFavorites && (
                                <button
                                    type="button"
                                    onClick={() => setActiveCategoryId(FAVORITES_CATEGORY_ID)}
                                    className={`relative shrink-0 pb-1.5 text-sm font-semibold transition-colors ${
                                        activeCategoryId === FAVORITES_CATEGORY_ID ? 'text-white' : 'text-zinc-400'
                                    }`}
                                >
                                    Favorites
                                    {activeCategoryId === FAVORITES_CATEGORY_ID && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-white" />}
                                </button>
                            )}
                            {activeCategories[activeTab].map((category) => (
                                <button
                                    key={category.id}
                                    type="button"
                                    onClick={() => setActiveCategoryId(category.id)}
                                    className={`relative shrink-0 pb-1.5 text-sm font-semibold transition-colors ${
                                        activeCategoryId === category.id ? 'text-white' : 'text-zinc-400'
                                    }`}
                                >
                                    {category.name}
                                    {activeCategoryId === category.id && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-white" />}
                                </button>
                            ))}
                        </div>
                        {!isReadOnly && (
                            <div className="flex items-center gap-2 shrink-0 pb-1">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCategoryItemIds(new Set());
                                        setIsAddCategoryOpen(true);
                                    }}
                                    className="flex h-7 items-center gap-1 rounded-full bg-black/45 backdrop-blur-md px-2.5 text-xs font-medium text-white/90 active:bg-white/15"
                                    title="New category"
                                    aria-label="New category"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    <span>New</span>
                                </button>
                                {activeCategoryId !== 'all' && activeCategoryId !== WATCHLIST_CATEGORY_ID && activeCategoryId !== FAVORITES_CATEGORY_ID && (
                                    <button
                                        type="button"
                                        onClick={() => setIsDeleteCategoryOpen(true)}
                                        className="flex h-7 w-7 items-center justify-center rounded-full bg-black/45 backdrop-blur-md text-red-400 active:bg-red-500/20"
                                        title="Delete category"
                                        aria-label="Delete category"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="w-full max-w-7xl mx-auto px-4 md:px-14 relative z-10">
                {/* Library Items Grid / List */}
                <div
                    className={`grid items-start pb-12 ${
                        displayMode === 'list'
                            ? 'grid-cols-1 md:grid-cols-2 gap-2.5 md:gap-3.5'
                            : displayMode === 'comfortable'
                            ? 'gap-3 md:gap-4 lg:gap-5'
                            : 'gap-2.5 md:gap-4 lg:gap-5'
                    }`}
                    style={displayMode === 'list' ? undefined : {
                        gridTemplateColumns: `repeat(${itemsPerRow}, minmax(0, 1fr))`
                    }}
                >
                    {visibleMobileLibraryItems.map((item) => (
                        <div
                            key={`${activeTab}-${item.id}`}
                            role="button"
                            tabIndex={0}
                            onClick={() => navigate(item.route, { state: item.state })}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    navigate(item.route, { state: item.state });
                                }
                            }}
                            className={`relative min-w-0 text-left transition-all duration-200 group cursor-pointer ${
                                displayMode === 'list'
                                    ? 'flex items-center gap-3.5 rounded-2xl bg-white/[0.035] hover:bg-white/[0.08] border border-white/5 hover:border-white/15 p-2.5 shadow-sm'
                                    : 'hover:scale-[1.02]'
                            }`}
                        >
                            {/* Cover image */}
                            <div className={`relative shrink-0 overflow-hidden rounded-xl bg-white/5 border border-white/5 shadow-md group-hover:shadow-2xl transition-all ${
                                displayMode === 'list' ? 'h-20 w-14' : 'aspect-[2/3] w-full'
                            }`}>
                                {item.image && (
                                    <img
                                        src={item.image}
                                        alt={item.title}
                                        onError={(e) => handleImageError(e, item.title)}
                                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        loading="lazy"
                                    />
                                )}
                                {/* Gradient: compact only (title overlaid inside card) */}
                                {displayMode === 'compact' && (
                                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black via-black/75 to-transparent" />
                                )}
                                {/* Episode/chapter count badge (grid views only, hidden in list mode) */}
                                {displayMode !== 'list' && item.count && item.count > 0 && (
                                    <span className="absolute left-2 top-2 rounded-md bg-black/75 backdrop-blur px-2 py-0.5 text-[11px] font-bold text-white shadow">
                                        {item.count}
                                    </span>
                                )}
                                {/* Hover delete button (grid views) */}
                                {!isReadOnly && displayMode !== 'list' && (
                                    <button
                                        type="button"
                                        onClick={(e) => deleteLibraryEntry(e, item)}
                                        title={
                                            activeCategoryId === WATCHLIST_CATEGORY_ID
                                                ? activeTab === 'anime' ? 'Remove from Watchlist' : 'Remove from Read list'
                                                : activeCategoryId === FAVORITES_CATEGORY_ID
                                                ? 'Remove from Favorites'
                                                : activeCategoryId !== 'all'
                                                ? 'Remove from category'
                                                : 'Delete from Library'
                                        }
                                        aria-label={`Delete ${item.title}`}
                                        className="absolute right-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-black/75 text-white/90 hover:bg-black hover:text-white opacity-80 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 transition-opacity duration-150 cursor-pointer"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                                {/* Cover only hover indicator */}
                                {displayMode === 'cover' && (
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center shadow-lg">
                                            {activeTab === 'anime' ? (
                                                <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                                            ) : (
                                                <BookOpen className="w-5 h-5 text-white" />
                                            )}
                                        </div>
                                    </div>
                                )}
                                {/* Title inside card: compact only */}
                                {displayMode === 'compact' && (
                                    <h2 className="absolute inset-x-0 bottom-0 p-2.5 text-sm font-semibold leading-snug text-white drop-shadow-md">
                                        <span className="line-clamp-2 overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                                            {item.title}
                                        </span>
                                    </h2>
                                )}
                            </div>
                            {/* Title below card: comfortable only */}
                            {displayMode === 'comfortable' && (
                                <div className="mt-2.5 px-0.5">
                                    <h2 className="text-sm font-semibold leading-snug text-white/95 line-clamp-2 group-hover:text-yorumi-accent transition-colors">
                                        {item.title}
                                    </h2>
                                    {item.count && item.count > 0 ? (
                                        <p className="mt-0.5 text-xs text-zinc-400">
                                            {item.count} {activeTab === 'anime' ? (item.count === 1 ? 'episode' : 'episodes') : (item.count === 1 ? 'chapter' : 'chapters')}
                                        </p>
                                    ) : null}
                                </div>
                            )}
                            {/* Title beside thumbnail: list only */}
                            {displayMode === 'list' && (
                                <>
                                    <div className="min-w-0 flex-1">
                                        <h2 className="truncate text-sm font-semibold text-white group-hover:text-yorumi-accent transition-colors">
                                            {item.title}
                                        </h2>
                                        {(Boolean(item.count && item.count > 0) || item.downloaded || item.completed) && (
                                            <div className="mt-1 flex items-center gap-2 text-xs text-zinc-400">
                                                {item.count && item.count > 0 ? (
                                                    <span>
                                                        {item.count} {activeTab === 'anime' ? (item.count === 1 ? 'episode' : 'episodes') : (item.count === 1 ? 'chapter' : 'chapters')}
                                                    </span>
                                                ) : null}
                                                {item.downloaded && (
                                                    <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                                                        Downloaded
                                                    </span>
                                                )}
                                                {item.completed && (
                                                    <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-sky-400">
                                                        Completed
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    {!isReadOnly && (
                                        <button
                                            type="button"
                                            onClick={(e) => deleteLibraryEntry(e, item)}
                                            title={
                                                activeCategoryId === WATCHLIST_CATEGORY_ID
                                                    ? activeTab === 'anime' ? 'Remove from Watchlist' : 'Remove from Read list'
                                                    : activeCategoryId === FAVORITES_CATEGORY_ID
                                                    ? 'Remove from Favorites'
                                                    : activeCategoryId !== 'all'
                                                    ? 'Remove from category'
                                                    : 'Delete from Library'
                                            }
                                            aria-label={`Delete ${item.title}`}
                                            className="mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/75 text-white/90 hover:bg-black hover:text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-150 cursor-pointer"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    ))}
                    {visibleMobileLibraryItems.length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
                            <p className="text-sm text-zinc-400">Nothing matches this library view.</p>
                            {(searchQuery || activeFilters.size > 0 || activeCategoryId !== 'all') && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchQuery('');
                                        setActiveFilters(new Set());
                                        setActiveCategoryId('all');
                                    }}
                                    className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 transition-colors"
                                >
                                    Reset filters
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {isLibraryOptionsOpen && (
                <div className="fixed inset-0 z-[80] flex items-end md:items-center md:justify-center" role="dialog" aria-modal="true" aria-label="Library options">
                    <button type="button" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsLibraryOptionsOpen(false)} aria-label="Close library options" />
                    <div className="relative z-10 flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-[#0d0e12]/80 backdrop-blur-2xl pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] shadow-2xl shadow-black/80 md:max-w-md md:rounded-lg">
                        <div className="flex items-center justify-between border-b border-white/15 px-4 pt-1">
                            <div className="grid grid-cols-3 flex-1">
                                {(['filter', 'sort', 'display'] as const).map((tab) => (
                                    <button
                                        key={tab}
                                        type="button"
                                        onClick={() => setOptionsTab(tab)}
                                        className={`relative py-4 text-sm font-semibold capitalize transition-colors ${optionsTab === tab ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
                                    >
                                        {tab}
                                        {optionsTab === tab && <span className="absolute inset-x-6 bottom-0 h-0.5 rounded-full bg-white" />}
                                    </button>
                                ))}
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsLibraryOptionsOpen(false)}
                                className="grid h-9 w-9 place-items-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
                                aria-label="Close"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="max-h-[65vh] overflow-y-auto px-6 py-4">
                            {optionsTab === 'filter' && (
                                <div className="space-y-1">
                                    {([
                                        ['downloaded', 'Downloaded'],
                                        ['started', 'Started'],
                                        ['completed', 'Completed'],
                                    ] as Array<[LibraryFilter, string]>).map(([key, label]) => (
                                        <label key={key} className="flex min-h-12 items-center gap-4 text-base text-zinc-100 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={activeFilters.has(key)}
                                                onChange={() => setActiveFilters((current) => {
                                                    const next = new Set(current);
                                                    if (next.has(key)) next.delete(key);
                                                    else next.add(key);
                                                    return next;
                                                })}
                                                className="h-5 w-5 rounded border-2 border-zinc-400 bg-transparent accent-zinc-100 cursor-pointer"
                                            />
                                            {label}
                                        </label>
                                    ))}
                                </div>
                            )}

                            {optionsTab === 'sort' && (
                                <div className="space-y-1">
                                    {([
                                        ['alphabetical', 'Alphabetically'],
                                        ['count', activeTab === 'anime' ? 'Total episodes' : 'Total chapters'],
                                        ['recent', activeTab === 'anime' ? 'Last seen' : 'Last read'],
                                    ] as Array<[LibrarySort, string]>).map(([key, label]) => (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => {
                                                if (sortBy === key) setSortAscending((value) => !value);
                                                else {
                                                    setSortBy(key);
                                                    setSortAscending(key === 'alphabetical');
                                                }
                                            }}
                                            className={`flex min-h-12 w-full items-center gap-4 text-left text-base ${sortBy === key ? 'text-white' : 'text-zinc-300'}`}
                                        >
                                            <span className="grid w-5 place-items-center">
                                                {sortBy === key && <ArrowUp className={`h-5 w-5 transition-transform ${sortAscending ? '' : 'rotate-180'}`} />}
                                            </span>
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {optionsTab === 'display' && (
                                <div>
                                    <h3 className="mb-3 text-sm font-semibold text-zinc-300">Display mode</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {([
                                            ['compact', 'Compact grid'],
                                            ['comfortable', 'Comfortable grid'],
                                            ['cover', 'Cover-only grid'],
                                            ['list', 'List'],
                                        ] as Array<[LibraryDisplay, string]>).map(([key, label]) => (
                                            <button
                                                key={key}
                                                type="button"
                                                onClick={() => updateDisplayMode(key)}
                                                className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${displayMode === key ? 'border-transparent bg-white/15 text-white' : 'border-zinc-500 text-zinc-200 hover:border-zinc-300'}`}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>

                                    {displayMode !== 'list' && (
                                        <div className="mt-6 border-t border-white/10 pt-4">
                                            <div className="mb-2 flex items-center justify-between">
                                                <h3 className="text-sm font-semibold text-zinc-300">Items per row</h3>
                                                <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs font-bold text-white">{itemsPerRow}</span>
                                            </div>
                                            <input
                                                type="range"
                                                min={2}
                                                max={8}
                                                step={1}
                                                value={itemsPerRow}
                                                onChange={(event) => {
                                                    const next = Number(event.target.value);
                                                    setItemsPerRow(next);
                                                    try {
                                                        localStorage.setItem(LIBRARY_ITEMS_PER_ROW_KEY, String(next));
                                                    } catch {
                                                        // Ignore storage access errors.
                                                    }
                                                }}
                                                className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-zinc-700 accent-white"
                                            />
                                            <div className="mt-1 flex justify-between text-[11px] font-medium text-zinc-400">
                                                <span>2</span>
                                                <span>3</span>
                                                <span>4</span>
                                                <span>5</span>
                                                <span>6</span>
                                                <span>7</span>
                                                <span>8</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {isAddCategoryOpen && (
                <div className="fixed inset-0 z-[90] flex items-end bg-black/60 backdrop-blur-sm md:items-center md:justify-center" role="dialog" aria-modal="true" aria-label="Add library category">
                    <button type="button" className="absolute inset-0" onClick={() => setIsAddCategoryOpen(false)} aria-label="Close add category dialog" />
                    <div className="relative z-10 flex max-h-[82vh] w-full flex-col rounded-t-[28px] border border-white/10 bg-[#0d0e12]/80 backdrop-blur-2xl shadow-2xl shadow-black/80 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] md:max-w-lg md:rounded-lg">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-white">Add category</h2>
                            <button type="button" onClick={() => setIsAddCategoryOpen(false)} className="grid h-9 w-9 place-items-center text-zinc-400 hover:text-white transition-colors" aria-label="Close">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="flex items-center gap-2.5">
                            <input
                                autoFocus
                                value={categoryName}
                                onChange={(event) => setCategoryName(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        saveCategory();
                                    }
                                }}
                                placeholder="Category name"
                                className="h-12 min-w-0 flex-1 rounded-xl border border-white/15 bg-black/20 px-3.5 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-white/35 transition-colors"
                            />
                            <button
                                type="button"
                                disabled={!categoryName.trim()}
                                onClick={saveCategory}
                                className="flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold whitespace-nowrap text-black transition-colors hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-500"
                            >
                                <Check className="h-4 w-4" />
                                <span>Save category</span>
                            </button>
                        </div>
                        <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-zinc-500">Choose entries</p>
                        <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-white/10">
                            {mobileLibraryItems.map((item) => (
                                <label key={item.id} className="flex min-h-12 items-center gap-3 border-b border-white/5 px-3 last:border-0 cursor-pointer hover:bg-white/[0.02] transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={categoryItemIds.has(item.id)}
                                        onChange={() => setCategoryItemIds((current) => {
                                            const next = new Set(current);
                                            if (next.has(item.id)) next.delete(item.id);
                                            else next.add(item.id);
                                            return next;
                                        })}
                                        className="h-5 w-5 accent-white cursor-pointer"
                                    />
                                    <span className="min-w-0 flex-1 truncate text-sm text-zinc-100">{item.title}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {isMoveEntriesToCategoryOpen && (
                <div className="fixed inset-0 z-[90] flex items-end bg-black/60 backdrop-blur-sm md:items-center md:justify-center" role="dialog" aria-modal="true" aria-label="Move entries to category">
                    <button type="button" className="absolute inset-0" onClick={() => setIsMoveEntriesToCategoryOpen(false)} aria-label="Close move entries dialog" />
                    <div className="relative z-10 flex max-h-[82vh] w-full flex-col rounded-t-[28px] border border-white/10 bg-[#0d0e12]/80 backdrop-blur-2xl shadow-2xl shadow-black/80 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] md:max-w-lg md:rounded-lg">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-white">Move to category</h2>
                            <button type="button" onClick={() => setIsMoveEntriesToCategoryOpen(false)} className="grid h-9 w-9 place-items-center text-zinc-400" aria-label="Close">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        {/* Category selector */}
                        <div className="mb-4 flex gap-2 flex-wrap">
                            {categories[activeTab].map((cat) => (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => {
                                        setMoveTargetCategoryId(cat.id);
                                        setMoveCategoryItemIds(new Set(cat.itemIds));
                                    }}
                                    className={`rounded-xl border px-3 py-1.5 text-sm font-semibold transition-colors ${
                                        moveTargetCategoryId === cat.id
                                            ? 'border-transparent bg-white/15 text-white'
                                            : 'border-zinc-600 text-zinc-400'
                                    }`}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Entries in this category</p>
                        <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-white/10">
                            {mobileLibraryItems.map((item) => (
                                <label key={item.id} className="flex min-h-12 items-center gap-3 border-b border-white/5 px-3 last:border-0">
                                    <input
                                        type="checkbox"
                                        checked={moveCategoryItemIds.has(item.id)}
                                        onChange={() => setMoveCategoryItemIds((current) => {
                                            const next = new Set(current);
                                            if (next.has(item.id)) next.delete(item.id);
                                            else next.add(item.id);
                                            return next;
                                        })}
                                        className="h-5 w-5 accent-white"
                                    />
                                    <span className="min-w-0 flex-1 truncate text-sm text-zinc-100">{item.title}</span>
                                </label>
                            ))}
                        </div>
                        <button
                            type="button"
                            disabled={!moveTargetCategoryId}
                            onClick={saveMoveEntries}
                            className="mt-5 flex h-11 items-center justify-center gap-2 rounded-xl bg-white font-semibold text-black disabled:bg-zinc-700 disabled:text-zinc-500"
                        >
                            <Check className="h-4 w-4" />
                            Save
                        </button>
                    </div>
                </div>
            )}

            {isDeleteCategoryOpen && (
                <div className="fixed inset-0 z-[90] flex items-end bg-black/60 backdrop-blur-sm md:items-center md:justify-center" role="dialog" aria-modal="true" aria-label="Delete category">
                    <button type="button" className="absolute inset-0" onClick={() => setIsDeleteCategoryOpen(false)} aria-label="Close delete category dialog" />
                    <div className="relative z-10 flex max-h-[82vh] w-full flex-col rounded-t-[28px] border border-white/10 bg-[#0d0e12]/80 backdrop-blur-2xl shadow-2xl shadow-black/80 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] md:max-w-md md:rounded-lg">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-white">Delete category</h2>
                            <button type="button" onClick={() => setIsDeleteCategoryOpen(false)} className="grid h-9 w-9 place-items-center text-zinc-400 hover:text-white transition-colors" aria-label="Close">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <p className="mb-4 text-xs text-zinc-400">
                            Choose a category to delete. Entries inside the category will remain in your library.
                        </p>

                        <div className="min-h-0 flex-1 overflow-y-auto space-y-2 mb-4">
                            {categories[activeTab].map((cat) => (
                                <div
                                    key={cat.id}
                                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5"
                                >
                                    <div className="min-w-0 flex-1 pr-2">
                                        <p className="truncate text-sm font-semibold text-white">{cat.name}</p>
                                        <p className="text-xs text-zinc-500">{cat.itemIds.length} {cat.itemIds.length === 1 ? 'entry' : 'entries'}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            deleteCategory(cat.id);
                                            if (categories[activeTab].length <= 1) {
                                                setIsDeleteCategoryOpen(false);
                                            }
                                        }}
                                        className="flex items-center gap-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 px-3 py-1.5 text-xs font-semibold text-red-400 transition-colors"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        Delete
                                    </button>
                                </div>
                            ))}
                            {categories[activeTab].length === 0 && (
                                <p className="py-6 text-center text-sm text-zinc-500">No custom categories to delete.</p>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={() => setIsDeleteCategoryOpen(false)}
                            className="flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 font-semibold text-white hover:bg-white/10 transition-colors"
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

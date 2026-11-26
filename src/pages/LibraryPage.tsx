import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Tv, BookOpen, BookText, Play, Search, SlidersHorizontal, MoreVertical, ArrowUp, Check, Plus, FolderInput, Trash2, CheckCheck, Download } from 'lucide-react';
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
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { handleImageError } from '../utils/image';
import { getAnimeDetailsRouteId, parseAnimeRouteId, buildAnimeRouteId } from '../utils/animeNavigation';
import { storage, type WatchListItem } from '../utils/storage';
import { useAppPrefs } from '../utils/appPrefs';
import { cacheImage, getCachedImage, prefetchImages } from '../services/offlineImageCache';
import { offlineLibraryCache } from '../services/offlineLibraryCache';
import { mangaService } from '../services/mangaService';
import { lnService } from '../services/lnService';
import BatchDownloadMenu, { selectItemsForBatchDownload, type BatchDownloadMode } from '../components/shared/BatchDownloadMenu';
import type { PublicUserProfile } from '../services/userService';
import LibraryProfileOverview from '../features/library/components/LibraryProfileOverview';

export type LibraryTab = 'anime' | 'manga' | 'ln';

type MobileLibraryItem = {
    id: string;
    title: string;
    image: string;
    count?: number;
    totalCount?: number;
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
    const isOnline = useOnlineStatus();
    const isOffline = !isOnline;
    const { downloadedOnly, setDownloadedOnly } = useAppPrefs();
    const [isMobileTabMenuOpen, setIsMobileTabMenuOpen] = useState(false);
    const [isLibraryActionsOpen, setIsLibraryActionsOpen] = useState(false);
    const [isLibraryOptionsOpen, setIsLibraryOptionsOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
    const [isMoveEntriesToCategoryOpen, setIsMoveEntriesToCategoryOpen] = useState(false);
    const [isDeleteCategoryOpen, setIsDeleteCategoryOpen] = useState(false);
    const [moveTargetCategoryId, setMoveTargetCategoryId] = useState('');
    const [moveCategoryItemIds, setMoveCategoryItemIds] = useState<Set<string>>(new Set());
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isSelectionDownloadOpen, setIsSelectionDownloadOpen] = useState(false);
    const [historyTick, setHistoryTick] = useState(0);
    const [cachedPosters, setCachedPosters] = useState<Record<string, string>>({});
    const longPressTimerRef = useRef<number | null>(null);
    const longPressStartRef = useRef<{ x: number; y: number } | null>(null);
    const longPressTriggeredRef = useRef(false);
    const [optionsTab, setOptionsTab] = useState<'filter' | 'sort' | 'display'>('filter');
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilters, setActiveFilters] = useState<Set<LibraryFilter>>(new Set());
    const [sortBy, setSortBy] = useState<LibrarySort>('recent');
    const [sortAscending, setSortAscending] = useState(false);
    const [activeCategoryIdState, setActiveCategoryId] = useState('all');
    const [prevSelectionScope, setPrevSelectionScope] = useState('');
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
    const { downloads: localMangaDownloads, deleteDownload: deleteMangaDownload, downloadAll: downloadAllManga } = useMangaDownloads();
    const { downloads: localLNDownloads, deleteDownload: deleteLNDownload, downloadAll: downloadAllLN } = useLNDownloads();
    const navigate = useNavigate();

    const continueWatchingList: typeof localContinueWatchingList = readOnlyProfile ? readOnlyProfile.continueWatching : localContinueWatchingList;
    const continueReadingList: typeof localContinueReadingList = readOnlyProfile ? readOnlyProfile.continueReading : localContinueReadingList;
    const continueLNList = useMemo<typeof localContinueLNList>(
        () => (readOnlyProfile ? (readOnlyProfile.continueLN || []) : localContinueLNList),
        [readOnlyProfile, localContinueLNList]
    );
    const watchList: typeof localWatchList = readOnlyProfile ? readOnlyProfile.watchList : localWatchList;
    const readList: typeof localReadList = readOnlyProfile ? readOnlyProfile.readList : localReadList;
    const lnReadList = useMemo<typeof localLNReadList>(
        () => (readOnlyProfile ? (readOnlyProfile.lnReadList || []) : localLNReadList),
        [readOnlyProfile, localLNReadList]
    );
    const favoriteAnime: typeof localFavoriteAnime = readOnlyProfile ? readOnlyProfile.favoriteAnime : localFavoriteAnime;
    const favoriteManga: typeof localFavoriteManga = readOnlyProfile ? readOnlyProfile.favoriteManga : localFavoriteManga;
    const favoriteLN = useMemo<typeof localFavoriteLN>(
        () => (readOnlyProfile ? (readOnlyProfile.favoriteLN || []) : localFavoriteLN),
        [readOnlyProfile, localFavoriteLN]
    );
    const downloads = useMemo<typeof localDownloads>(
        () => (readOnlyProfile ? [] : localDownloads),
        [readOnlyProfile, localDownloads]
    );
    const mangaDownloads = useMemo<typeof localMangaDownloads>(
        () => (readOnlyProfile ? [] : localMangaDownloads),
        [readOnlyProfile, localMangaDownloads]
    );
    const lnDownloads = useMemo<typeof localLNDownloads>(
        () => (readOnlyProfile ? [] : localLNDownloads),
        [readOnlyProfile, localLNDownloads]
    );
    const activeCategories = useMemo<LibraryCategories>(
        () =>
            readOnlyProfile
                ? {
                    anime: readOnlyProfile.libraryCategories?.anime || [],
                    manga: readOnlyProfile.libraryCategories?.manga || [],
                    ln: readOnlyProfile.libraryCategories?.ln || [],
                }
                : categories,
        [readOnlyProfile, categories]
    );

    // Offline status is managed reactively by useOnlineStatus()
    const selectionScope = `${activeTab}:${activeCategoryIdState}`;
    if (selectionScope !== prevSelectionScope) {
        setPrevSelectionScope(selectionScope);
        if (selectedIds.size > 0) setSelectedIds(new Set());
        if (isSelectionDownloadOpen) setIsSelectionDownloadOpen(false);
    }

    const isSelectionMode = selectedIds.size > 0;

    useEffect(() => {
        const onStorageUpdated = () => setHistoryTick((t) => t + 1);
        window.addEventListener('yorumi-storage-updated', onStorageUpdated);
        return () => window.removeEventListener('yorumi-storage-updated', onStorageUpdated);
    }, []);

    useEffect(() => {
        if (!isSelectionMode) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setSelectedIds(new Set());
                setIsSelectionDownloadOpen(false);
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [isSelectionMode]);

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
        document.body.classList.toggle('yorumi-library-selection-mode', isSelectionMode);
        return () => {
            document.body.classList.remove('yorumi-library-modal-open');
            document.body.classList.remove('yorumi-library-selection-mode');
        };
    }, [isAddCategoryOpen, isLibraryOptionsOpen, isMoveEntriesToCategoryOpen, isSelectionMode]);

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
        void historyTick;
        const episodeHistory = storage.getEpisodeHistory();
        const chapterHistory = storage.getChapterHistory();

        return [...items.values()].map((item) => {
            const normalizedTitle = normalizeLibraryTitle(item.title);
            if (activeTab === 'anime') {
                const progress = filteredWatching.find((entry) => String(entry.animeId) === item.id || normalizeLibraryTitle(entry.animeTitle) === normalizedTitle);
                const bookmark = filteredWatchList.find((entry) => String(entry.id) === item.id || normalizeLibraryTitle(entry.title) === normalizedTitle);
                const fav = favoriteAnime.find((entry) => String(entry.id) === item.id || normalizeLibraryTitle(entry.title) === normalizedTitle);
                const animeState = item.state?.anime as { episodes?: number | null; id?: number; mal_id?: number; scraperId?: string } | undefined;
                const cachedAnimeEpCount = offlineLibraryCache.getAnimeEpisodeCount([
                    item.id,
                    bookmark?.anilistId,
                    bookmark?.malId,
                    bookmark?.scraperId,
                    animeState?.id,
                    animeState?.mal_id,
                    animeState?.scraperId,
                ]);
                const total = cachedAnimeEpCount > 0
                    ? cachedAnimeEpCount
                    : Math.max(
                        Number(bookmark?.totalCount || 0),
                        Number(progress?.totalCount || 0),
                        Number(animeState?.episodes || 0),
                        Number(item.count || 0),
                    );
                const candidateHistoryKeys = [
                    item.id,
                    bookmark?.anilistId ? String(bookmark.anilistId) : '',
                    bookmark?.malId ? String(bookmark.malId) : '',
                    bookmark?.scraperId || '',
                    animeState?.id ? String(animeState.id) : '',
                    animeState?.mal_id ? String(animeState.mal_id) : '',
                    animeState?.scraperId || '',
                    progress?.animeId ? String(progress.animeId) : '',
                ].filter(Boolean);
                const watchedFromHistory = candidateHistoryKeys.reduce(
                    (max, key) => Math.max(max, episodeHistory[key]?.length || 0),
                    0,
                );
                const watchedCount = bookmark?.status === 'completed'
                    ? total
                    : watchedFromHistory > 0
                        ? watchedFromHistory
                        : Number(progress?.episodeNumber || 0);
                const unreadCount = total > 0 ? Math.max(0, total - Math.floor(watchedCount)) : 0;
                return {
                    ...item,
                    count: unreadCount,
                    totalCount: total,
                    downloaded: downloads.some((entry) => String(entry.animeId) === item.id || normalizeLibraryTitle(entry.animeTitle) === normalizedTitle),
                    started: Boolean(progress) || watchedCount > 0,
                    completed: bookmark?.status === 'completed' || (total > 0 && unreadCount === 0),
                    watchlisted: Boolean(bookmark),
                    favorited: Boolean(fav),
                    updatedAt: progress?.lastWatched || progress?.timestamp || bookmark?.addedAt || fav?.addedAt || 0,
                };
            }
            if (activeTab === 'manga') {
                const progress = filteredReading.find((entry) => String(entry.mangaId) === item.id || normalizeLibraryTitle(entry.mangaTitle) === normalizedTitle);
                const bookmark = filteredReadList.find((entry) => String(entry.id) === item.id || normalizeLibraryTitle(entry.title) === normalizedTitle);
                const fav = favoriteManga.find((entry) => String(entry.id) === item.id || normalizeLibraryTitle(entry.title) === normalizedTitle);
                const mangaState = item.state?.manga as { id?: string | number; mal_id?: string | number; scraper_id?: string } | undefined;
                const candidateKeys = [
                    item.id,
                    bookmark?.scraperId || '',
                    bookmark?.malId ? String(bookmark.malId) : '',
                    mangaState?.id ? String(mangaState.id) : '',
                    mangaState?.mal_id ? String(mangaState.mal_id) : '',
                    mangaState?.scraper_id || '',
                    progress?.mangaId ? String(progress.mangaId) : '',
                ].filter(Boolean);
                const cachedChapters = offlineLibraryCache.getMangaChapters(candidateKeys);
                const total = cachedChapters.length > 0
                    ? cachedChapters.length
                    : Math.max(
                        Number(bookmark?.totalCount || 0),
                        Number(progress?.totalCount || 0),
                        Number(item.count || 0),
                    );
                const readFromHistory = candidateKeys.reduce(
                    (max, key) => Math.max(max, chapterHistory[key]?.length || 0),
                    0,
                );
                const progressChapter = Number.parseFloat(String(progress?.chapterNumber || 0)) || 0;
                const readCount = bookmark?.status === 'completed'
                    ? total
                    : readFromHistory > 0
                        ? readFromHistory
                        : Math.floor(progressChapter);
                const unreadCount = total > 0 ? Math.max(0, total - readCount) : 0;
                return {
                    ...item,
                    count: unreadCount,
                    totalCount: total,
                    downloaded: mangaDownloads.some((entry) => String(entry.mangaId) === item.id || normalizeLibraryTitle(entry.mangaTitle) === normalizedTitle),
                    started: Boolean(progress) || readCount > 0,
                    completed: bookmark?.status === 'completed' || (total > 0 && unreadCount === 0),
                    watchlisted: Boolean(bookmark),
                    favorited: Boolean(fav),
                    updatedAt: progress?.lastRead || progress?.timestamp || bookmark?.addedAt || fav?.addedAt || 0,
                };
            }

            const progress = filteredLN.find((entry) => String(entry.novelId) === item.id || normalizeLibraryTitle(entry.novelTitle) === normalizedTitle);
            const bookmark = filteredLNList.find((entry) => String(entry.id) === item.id || normalizeLibraryTitle(entry.title) === normalizedTitle);
            const fav = favoriteLN.find((entry) => String(entry.id) === item.id || normalizeLibraryTitle(entry.title) === normalizedTitle);
            const lnState = item.state?.ln as { id?: string | number; mal_id?: string | number; scraper_id?: string } | undefined;
            const lnKeys = [
                item.id,
                lnState?.id ? String(lnState.id) : '',
                lnState?.mal_id ? String(lnState.mal_id) : '',
                lnState?.scraper_id || '',
                progress?.novelId ? String(progress.novelId) : '',
            ].filter(Boolean);
            const cachedLNChapters = offlineLibraryCache.getLNChapters(lnKeys);
            const total = cachedLNChapters.length > 0
                ? cachedLNChapters.length
                : Math.max(
                    Number(bookmark?.totalCount || 0),
                    Number(item.count || 0),
                );
            const readFromHistory = lnKeys.reduce(
                (max, key) => Math.max(max, chapterHistory[key]?.length || 0),
                0,
            );
            const progressChapter = Number(progress?.chapterNumber || 0) || 0;
            const readCount = readFromHistory > 0 ? readFromHistory : Math.floor(progressChapter);
            const unreadCount = total > 0 ? Math.max(0, total - readCount) : 0;
            return {
                ...item,
                count: unreadCount,
                totalCount: total,
                downloaded: lnDownloads.some((entry) => String(entry.novelId) === item.id || normalizeLibraryTitle(entry.novelTitle) === normalizedTitle),
                started: Boolean(progress) || readCount > 0,
                completed: /completed|finished/i.test(bookmark?.mediaStatus || '') || (total > 0 && unreadCount === 0),
                watchlisted: Boolean(bookmark),
                favorited: Boolean(fav),
                updatedAt: progress ? Date.parse(progress.updatedAt) || 0 : Date.parse(bookmark?.addedAt || '') || fav?.addedAt || 0,
            };
        });
    }, [activeTab, downloads, favoriteAnime, favoriteLN, favoriteManga, filteredLN, filteredLNList, filteredReadList, filteredReading, filteredWatchList, filteredWatching, historyTick, isOffline, lnDownloads, mangaDownloads]);

    // Collect ALL poster URLs across Anime, Manga, and Light Novel tabs so going offline
    // from any tab still has every Library poster cached locally (desktop & mobile)
    const allLibraryPosterUrls = useMemo(() => {
        const urls = new Set<string>();
        const add = (u?: string | null) => {
            const clean = String(u || '').trim();
            if (clean) urls.add(clean);
        };
        watchList.forEach((i) => add(i.image));
        continueWatchingList.forEach((i) => { add(i.animePoster); add(i.animeImage); });
        favoriteAnime.forEach((i) => add(i.image));
        downloads.forEach((i) => add(i.animeImage));
        readList.forEach((i) => add(i.image));
        continueReadingList.forEach((i) => { add(i.mangaPoster); add(i.mangaImage); });
        favoriteManga.forEach((i) => add(i.image));
        mangaDownloads.forEach((i) => add(i.mangaImage));
        lnReadList.forEach((i) => add(i.image));
        continueLNList.forEach((i) => add(i.coverImage));
        favoriteLN.forEach((i) => add(i.image));
        lnDownloads.forEach((i) => add(i.novelImage));
        return Array.from(urls);
    }, [
        watchList, continueWatchingList, favoriteAnime, downloads,
        readList, continueReadingList, favoriteManga, mangaDownloads,
        lnReadList, continueLNList, favoriteLN, lnDownloads,
    ]);

    // Save & hydrate all Library posters locally for full offline availability (Mihon-style)
    useEffect(() => {
        const visibleUrls = Array.from(new Set(mobileLibraryItems.map((item) => item.image).filter(Boolean)));
        if (allLibraryPosterUrls.length === 0 && visibleUrls.length === 0) return;
        let cancelled = false;

        const hydrateCached = async () => {
            const entries = await Promise.all(
                visibleUrls.map(async (url) => {
                    const cached = await getCachedImage(url);
                    return cached ? ([url, cached] as const) : null;
                })
            );
            if (cancelled) return;
            const updates: Record<string, string> = {};
            for (const entry of entries) {
                if (entry) updates[entry[0]] = entry[1];
            }
            if (Object.keys(updates).length > 0) {
                setCachedPosters((prev) => ({ ...prev, ...updates }));
            }
        };

        void hydrateCached().then(async () => {
            if (!cancelled && isOnline && allLibraryPosterUrls.length > 0) {
                // Prioritize currently visible tab posters first, then warm the other tabs
                const visibleSet = new Set(visibleUrls);
                const ordered = [
                    ...visibleUrls,
                    ...allLibraryPosterUrls.filter((u) => !visibleSet.has(u)),
                ];
                await prefetchImages(ordered);
                if (!cancelled) {
                    await hydrateCached();
                }
            }
        });

        return () => {
            cancelled = true;
        };
    }, [isOnline, mobileLibraryItems, allLibraryPosterUrls]);

    // Background-cache Manga & Light Novel metadata + chapter lists for all Library entries while online
    useEffect(() => {
        if (!isOnline || isReadOnly) return;
        let cancelled = false;

        const mangaEntries = new Map<string, { id: string; title: string; scraperId?: string }>();
        const addManga = (id: string | number | undefined, title: string, scraperId?: string) => {
            const key = String(id || '').trim();
            if (!key || mangaEntries.has(key)) return;
            mangaEntries.set(key, { id: key, title, scraperId });
        };
        readList.forEach((m) => addManga(m.id || m.malId || m.anilistId, m.title, m.scraperId));
        continueReadingList.forEach((m) => addManga(m.mangaId, m.mangaTitle));
        favoriteManga.forEach((m) => addManga(m.id, m.title));

        const lnEntries = new Map<string, { id: string; title: string }>();
        const addLN = (id: string | number | undefined, title: string) => {
            const key = String(id || '').trim();
            if (!key || lnEntries.has(key)) return;
            lnEntries.set(key, { id: key, title });
        };
        lnReadList.forEach((n) => addLN(n.id, n.title));
        continueLNList.forEach((n) => addLN(n.novelId, n.novelTitle));
        favoriteLN.forEach((n) => addLN(n.id, n.title));

        const warmOfflineLibrary = async () => {
            // 1. Warm Manga metadata + chapters (sequential to stay gentle on scrapers)
            for (const entry of mangaEntries.values()) {
                if (cancelled) return;
                const keys = [entry.id, entry.scraperId];
                const hasMeta = Boolean(offlineLibraryCache.getMangaMeta(keys)?.synopsis);
                const hasChapters = offlineLibraryCache.getMangaChapters(keys).length > 0;
                if (hasMeta && hasChapters) continue;

                try {
                    if (!hasMeta && /^\d+$/.test(entry.id)) {
                        const res = await mangaService.getMangaDetails(entry.id).catch(() => null);
                        if (!cancelled && res?.data) {
                            offlineLibraryCache.saveMangaMeta([entry.id, res.data.id, res.data.mal_id, entry.scraperId], res.data);
                            const cover = res.data.images?.jpg?.large_image_url || res.data.images?.jpg?.image_url;
                            if (cover) void cacheImage(cover).catch(() => undefined);
                            if (res.data.bannerImage) void cacheImage(res.data.bannerImage).catch(() => undefined);
                        }
                    }
                    if (!hasChapters && !cancelled) {
                        let scraperId = entry.scraperId || (entry.id.includes(':') ? entry.id : '');
                        if (!scraperId && entry.title) {
                            const search = await mangaService.searchMangaScraper(entry.title, 1, 5).catch(() => null);
                            const first = Array.isArray(search) ? search[0] : (search as { data?: Array<{ id?: string; scraper_id?: string }> } | null)?.data?.[0];
                            if (first?.scraper_id || first?.id) scraperId = String(first.scraper_id || first.id);
                        }
                        if (scraperId && !cancelled) {
                            const chRes = await mangaService.getChapters(scraperId).catch(() => null);
                            if (!cancelled && chRes?.chapters?.length) {
                                offlineLibraryCache.saveMangaChapters([entry.id, scraperId], chRes.chapters);
                            }
                        }
                    }
                } catch {
                    // Best-effort offline warming
                }
            }

            // 2. Warm Light Novel metadata + chapters
            for (const entry of lnEntries.values()) {
                if (cancelled) return;
                const keys = [entry.id];
                const hasMeta = Boolean(offlineLibraryCache.getLNMeta(keys)?.synopsis);
                const hasChapters = offlineLibraryCache.getLNChapters(keys).length > 0;
                if (hasMeta && hasChapters) continue;

                try {
                    let details = offlineLibraryCache.getLNMeta(keys);
                    if (!hasMeta) {
                        details = await lnService.getDetails(entry.id).catch(() => null);
                        if (!cancelled && details) {
                            offlineLibraryCache.saveLNMeta([entry.id, details.id, details.scraper_id], details);
                            const cover = details.images?.jpg?.large_image_url || details.images?.jpg?.image_url;
                            if (cover) void cacheImage(cover).catch(() => undefined);
                            if (details.bannerImage) void cacheImage(details.bannerImage).catch(() => undefined);
                        }
                    }
                    if (!hasChapters && !cancelled) {
                        let scraperId = details?.scraper_id || (entry.id.includes(':') ? entry.id : '');
                        if (!scraperId && entry.title) {
                            const resolved = await lnService.resolveScraperId([entry.title]).catch(() => null);
                            if (resolved) scraperId = resolved;
                        }
                        if (scraperId && !cancelled) {
                            const chRes = await lnService.getScraperNovelDetails(scraperId, false, true).catch(() => null);
                            if (!cancelled && chRes?.chapters?.length) {
                                offlineLibraryCache.saveLNChapters([entry.id, details?.id, scraperId], chRes.chapters);
                            }
                        }
                    }
                } catch {
                    // Best-effort offline warming
                }
            }
        };

        const timer = window.setTimeout(() => {
            void warmOfflineLibrary();
        }, 1200);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [isOnline, isReadOnly, readList, continueReadingList, favoriteManga, lnReadList, continueLNList, favoriteLN]);

    // Backfill & sync released episode counts for Anime Library cards via one batched AniList query when online
    useEffect(() => {
        if (!isOnline || activeTab !== 'anime' || isReadOnly) return;
        const missingIds = new Set<number>();
        const keyMap = new Map<number, string[]>();
        mobileLibraryItems.forEach((item) => {
            const animeState = item.state?.anime as { id?: number; mal_id?: number; scraperId?: string } | undefined;
            const alreadyCached = offlineLibraryCache.getAnimeEpisodeCount([item.id, animeState?.id, animeState?.mal_id, animeState?.scraperId]);
            if (alreadyCached > 0) return;
            const alId = Number(animeState?.id || (/^\d+$/.test(item.id) ? item.id : 0));
            if (Number.isFinite(alId) && alId > 0) {
                missingIds.add(alId);
                keyMap.set(alId, [...(keyMap.get(alId) || []), item.id, String(alId)]);
            }
        });
        if (missingIds.size === 0) return;
        let cancelled = false;
        void fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
                query: 'query ($ids: [Int]) { Page(perPage: 50) { media(id_in: $ids, type: ANIME) { id idMal episodes nextAiringEpisode { episode } } } }',
                variables: { ids: Array.from(missingIds).slice(0, 50) },
            }),
        })
            .then((res) => (res.ok ? res.json() : null))
            .then((json: { data?: { Page?: { media?: Array<{ id?: number; idMal?: number; episodes?: number | null; nextAiringEpisode?: { episode?: number } | null }> } } } | null) => {
                if (cancelled || !json?.data?.Page?.media) return;
                let updated = false;
                for (const media of json.data.Page.media) {
                    const epCount = media.nextAiringEpisode?.episode
                        ? Math.max(0, media.nextAiringEpisode.episode - 1)
                        : Number(media.episodes || 0);
                    if (epCount > 0 && media.id) {
                        const keys = [...(keyMap.get(media.id) || []), String(media.id), media.idMal ? String(media.idMal) : ''];
                        offlineLibraryCache.saveAnimeEpisodeCount(keys, epCount);
                        updated = true;
                    }
                }
                if (updated && !cancelled) {
                    setHistoryTick((t) => t + 1);
                }
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [activeTab, isOnline, isReadOnly, mobileLibraryItems]);

    const hasWatchlist = useMemo(
        () => mobileLibraryItems.some((item) => item.watchlisted),
        [mobileLibraryItems]
    );
    const hasFavorites = useMemo(
        () => mobileLibraryItems.some((item) => item.favorited),
        [mobileLibraryItems]
    );

    const activeCategoryId =
        (activeCategoryIdState === WATCHLIST_CATEGORY_ID && !hasWatchlist) ||
        (activeCategoryIdState === FAVORITES_CATEGORY_ID && !hasFavorites)
            ? 'all'
            : activeCategoryIdState;

    const visibleMobileLibraryItems = useMemo(() => {
        const isWatchlistCategory = activeCategoryId === WATCHLIST_CATEGORY_ID;
        const isFavoritesCategory = activeCategoryId === FAVORITES_CATEGORY_ID;
        const isBuiltInCategory = isWatchlistCategory || isFavoritesCategory;
        const category = isBuiltInCategory ? null : activeCategories[activeTab].find((entry) => entry.id === activeCategoryId);
        const categoryIds = category ? new Set(category.itemIds) : null;
        const query = normalizeLibraryTitle(searchQuery);
        const filtered = mobileLibraryItems.filter((item) => {
            if (downloadedOnly && !item.downloaded) return false;
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
    }, [activeCategories, activeCategoryId, activeFilters, activeTab, downloadedOnly, mobileLibraryItems, searchQuery, sortAscending, sortBy]);

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

    const removeLibraryEntry = (item: MobileLibraryItem) => {
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

    const selectedItems = useMemo(
        () => visibleMobileLibraryItems.filter((item) => selectedIds.has(item.id)),
        [selectedIds, visibleMobileLibraryItems]
    );

    const clearSelection = () => {
        setSelectedIds(new Set());
        setIsSelectionDownloadOpen(false);
    };

    const toggleSelectItem = (itemId: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(itemId)) next.delete(itemId);
            else next.add(itemId);
            return next;
        });
    };

    const handleSelectAll = () => {
        setSelectedIds(new Set(visibleMobileLibraryItems.map((item) => item.id)));
    };

    const handleInvertSelection = () => {
        setSelectedIds((prev) => {
            const next = new Set<string>();
            visibleMobileLibraryItems.forEach((item) => {
                if (!prev.has(item.id)) next.add(item.id);
            });
            return next;
        });
    };

    const cancelLongPress = () => {
        if (longPressTimerRef.current !== null) {
            window.clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
        longPressStartRef.current = null;
    };

    const isMobileScreen = () => typeof window !== 'undefined' && window.innerWidth < 768;

    const startLongPress = (clientX: number, clientY: number, itemId: string) => {
        if (isReadOnly || !isMobileScreen()) return;
        cancelLongPress();
        longPressTriggeredRef.current = false;
        longPressStartRef.current = { x: clientX, y: clientY };
        longPressTimerRef.current = window.setTimeout(() => {
            longPressTriggeredRef.current = true;
            longPressTimerRef.current = null;
            if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
                navigator.vibrate(20);
            }
            setSelectedIds((prev) => {
                const next = new Set(prev);
                next.add(itemId);
                return next;
            });
        }, 320);
    };

    const moveLongPress = (clientX: number, clientY: number) => {
        if (!longPressStartRef.current) return;
        const dx = Math.abs(clientX - longPressStartRef.current.x);
        const dy = Math.abs(clientY - longPressStartRef.current.y);
        if (dx > 12 || dy > 12) {
            cancelLongPress();
        }
    };

    const handleCardTouchStart = (event: React.TouchEvent, itemId: string) => {
        const touch = event.touches[0];
        if (!touch) return;
        startLongPress(touch.clientX, touch.clientY, itemId);
    };

    const handleCardTouchMove = (event: React.TouchEvent) => {
        const touch = event.touches[0];
        if (!touch) return;
        moveLongPress(touch.clientX, touch.clientY);
    };

    const handleCardClick = (item: MobileLibraryItem) => {
        if (longPressTriggeredRef.current) {
            longPressTriggeredRef.current = false;
            return;
        }
        if (isSelectionMode) {
            toggleSelectItem(item.id);
            return;
        }
        navigate(item.route, { state: item.state });
    };

    const handleOpenMoveSelectedCategory = () => {
        const currentTabCategories = categories[activeTab];
        if (currentTabCategories.length > 0) {
            const target = currentTabCategories[0];
            setMoveTargetCategoryId(target.id);
            const merged = new Set(target.itemIds);
            selectedIds.forEach((id) => merged.add(id));
            setMoveCategoryItemIds(merged);
            setIsMoveEntriesToCategoryOpen(true);
        } else {
            setCategoryItemIds(new Set(selectedIds));
            setIsAddCategoryOpen(true);
        }
        clearSelection();
    };

    const handleMarkSelectedRead = () => {
        if (selectedItems.length === 0) return;
        if (activeTab === 'anime') {
            const list = storage.getWatchList();
            const history = storage.getEpisodeHistory();
            let listChanged = false;
            selectedItems.forEach((item) => {
                const normalizedTitle = normalizeLibraryTitle(item.title);
                const animeState = item.state?.anime as { id?: number; mal_id?: number; scraperId?: string } | undefined;
                const total = Math.max(1, Number(item.totalCount || 0));
                const idx = list.findIndex((e) => String(e.id) === item.id || normalizeLibraryTitle(e.title) === normalizedTitle);
                const bookmark = idx >= 0 ? list[idx] : undefined;
                if (idx >= 0) {
                    list[idx] = { ...list[idx], status: 'completed', currentProgress: total };
                    listChanged = true;
                }
                const keys = Array.from(new Set([
                    item.id,
                    bookmark?.anilistId ? String(bookmark.anilistId) : '',
                    bookmark?.malId ? String(bookmark.malId) : '',
                    bookmark?.scraperId || '',
                    animeState?.id ? String(animeState.id) : '',
                    animeState?.mal_id ? String(animeState.mal_id) : '',
                    animeState?.scraperId || '',
                ].filter(Boolean)));
                const allEps = Array.from({ length: total }, (_, i) => String(i + 1));
                keys.forEach((key) => {
                    history[key] = allEps;
                });
            });
            if (listChanged) storage.setWatchList(list);
            storage.setEpisodeHistory(history);
        } else if (activeTab === 'manga') {
            const list = storage.getReadList();
            const history = storage.getChapterHistory();
            let listChanged = false;
            selectedItems.forEach((item) => {
                const normalizedTitle = normalizeLibraryTitle(item.title);
                const mangaState = item.state?.manga as { id?: string | number; mal_id?: string | number; scraper_id?: string } | undefined;
                const idx = list.findIndex((e) => String(e.id) === item.id || normalizeLibraryTitle(e.title) === normalizedTitle);
                const bookmark = idx >= 0 ? list[idx] : undefined;
                const keys = Array.from(new Set([
                    item.id,
                    bookmark?.malId ? String(bookmark.malId) : '',
                    bookmark?.scraperId || '',
                    mangaState?.id ? String(mangaState.id) : '',
                    mangaState?.mal_id ? String(mangaState.mal_id) : '',
                    mangaState?.scraper_id || '',
                ].filter(Boolean)));
                const cachedChapters = offlineLibraryCache.getMangaChapters(keys);
                const total = Math.max(cachedChapters.length, Number(item.totalCount || 0));
                if (idx >= 0) {
                    list[idx] = { ...list[idx], status: 'completed', currentProgress: total || list[idx].currentProgress };
                    listChanged = true;
                }
                const chapterIds = cachedChapters.length > 0
                    ? cachedChapters.map((ch) => ch.id)
                    : total > 0
                        ? Array.from({ length: total }, (_, i) => `ch-${i + 1}`)
                        : [];
                if (chapterIds.length > 0) {
                    keys.forEach((key) => {
                        history[key] = chapterIds;
                    });
                }
            });
            if (listChanged) storage.setReadList(list);
            storage.setChapterHistory(history);
        } else {
            const history = storage.getChapterHistory();
            selectedItems.forEach((item) => {
                const lnState = item.state?.ln as { id?: string | number; mal_id?: string | number; scraper_id?: string } | undefined;
                const keys = Array.from(new Set([
                    item.id,
                    lnState?.id ? String(lnState.id) : '',
                    lnState?.mal_id ? String(lnState.mal_id) : '',
                    lnState?.scraper_id || '',
                ].filter(Boolean)));
                const cachedChapters = offlineLibraryCache.getLNChapters(keys);
                const total = Math.max(cachedChapters.length, Number(item.totalCount || 0));
                const chapterIds = cachedChapters.length > 0
                    ? cachedChapters.map((ch) => ch.id)
                    : total > 0
                        ? Array.from({ length: total }, (_, i) => `ln-ch-${i + 1}`)
                        : [];
                if (chapterIds.length > 0) {
                    keys.forEach((key) => {
                        history[key] = chapterIds;
                    });
                }
            });
            storage.setChapterHistory(history);
        }
        setHistoryTick((t) => t + 1);
        clearSelection();
    };

    const handleMarkSelectedUnread = () => {
        if (selectedItems.length === 0) return;
        if (activeTab === 'anime') {
            const list = storage.getWatchList();
            const history = storage.getEpisodeHistory();
            const cw = storage.getContinueWatching();
            let listChanged = false;
            let cwChanged = false;
            selectedItems.forEach((item) => {
                const normalizedTitle = normalizeLibraryTitle(item.title);
                const animeState = item.state?.anime as { id?: number; mal_id?: number; scraperId?: string } | undefined;
                const idx = list.findIndex((e) => String(e.id) === item.id || normalizeLibraryTitle(e.title) === normalizedTitle);
                const bookmark = idx >= 0 ? list[idx] : undefined;
                if (idx >= 0) {
                    list[idx] = { ...list[idx], status: 'plan_to_watch', currentProgress: 0 };
                    listChanged = true;
                }
                const keys = [
                    item.id,
                    bookmark?.anilistId ? String(bookmark.anilistId) : '',
                    bookmark?.malId ? String(bookmark.malId) : '',
                    bookmark?.scraperId || '',
                    animeState?.id ? String(animeState.id) : '',
                    animeState?.mal_id ? String(animeState.mal_id) : '',
                    animeState?.scraperId || '',
                ].filter(Boolean);
                keys.forEach((key) => { delete history[key]; });
                cw.forEach((entry, i) => {
                    if (String(entry.animeId) === item.id || normalizeLibraryTitle(entry.animeTitle) === normalizedTitle) {
                        cw[i] = { ...entry, episodeNumber: 0, positionSeconds: 0 };
                        cwChanged = true;
                    }
                });
            });
            if (listChanged) storage.setWatchList(list);
            if (cwChanged) storage.setContinueWatching(cw);
            storage.setEpisodeHistory(history);
        } else if (activeTab === 'manga') {
            const list = storage.getReadList();
            const history = storage.getChapterHistory();
            const cr = storage.getContinueReading();
            let listChanged = false;
            let crChanged = false;
            selectedItems.forEach((item) => {
                const normalizedTitle = normalizeLibraryTitle(item.title);
                const mangaState = item.state?.manga as { id?: string | number; mal_id?: string | number; scraper_id?: string } | undefined;
                const idx = list.findIndex((e) => String(e.id) === item.id || normalizeLibraryTitle(e.title) === normalizedTitle);
                const bookmark = idx >= 0 ? list[idx] : undefined;
                if (idx >= 0) {
                    list[idx] = { ...list[idx], status: 'plan_to_read', currentProgress: 0 };
                    listChanged = true;
                }
                const keys = [
                    item.id,
                    bookmark?.malId ? String(bookmark.malId) : '',
                    bookmark?.scraperId || '',
                    mangaState?.id ? String(mangaState.id) : '',
                    mangaState?.mal_id ? String(mangaState.mal_id) : '',
                    mangaState?.scraper_id || '',
                ].filter(Boolean);
                keys.forEach((key) => { delete history[key]; });
                cr.forEach((entry, i) => {
                    if (String(entry.mangaId) === item.id || normalizeLibraryTitle(entry.mangaTitle) === normalizedTitle) {
                        cr[i] = { ...entry, chapterNumber: '0' };
                        crChanged = true;
                    }
                });
            });
            if (listChanged) storage.setReadList(list);
            if (crChanged) storage.setContinueReading(cr);
            storage.setChapterHistory(history);
        } else {
            const history = storage.getChapterHistory();
            selectedItems.forEach((item) => {
                const lnState = item.state?.ln as { id?: string | number; mal_id?: string | number; scraper_id?: string } | undefined;
                const keys = [
                    item.id,
                    lnState?.id ? String(lnState.id) : '',
                    lnState?.mal_id ? String(lnState.mal_id) : '',
                    lnState?.scraper_id || '',
                ].filter(Boolean);
                keys.forEach((key) => { delete history[key]; });
            });
            storage.setChapterHistory(history);
        }
        setHistoryTick((t) => t + 1);
        clearSelection();
    };

    const handleDownloadSelected = (mode: BatchDownloadMode) => {
        if (selectedItems.length === 0) return;
        const chapterHistory = storage.getChapterHistory();

        if (activeTab === 'manga') {
            selectedItems.forEach((item) => {
                const bookmark = filteredReadList.find((e) => String(e.id) === item.id);
                const cachedChapters = offlineLibraryCache.getMangaChapters([item.id, bookmark?.scraperId, bookmark?.malId]);
                if (cachedChapters.length === 0) return;
                const readSet = new Set(chapterHistory[item.id] || []);
                const downloadedSet = new Set(
                    mangaDownloads
                        .filter((d) => String(d.mangaId) === item.id || normalizeLibraryTitle(d.mangaTitle) === normalizeLibraryTitle(item.title))
                        .map((d) => d.chapterId)
                );
                const ascending = [...cachedChapters].reverse();
                const unreadUndownloaded = ascending.filter((ch) => !readSet.has(ch.id) && !downloadedSet.has(ch.id));
                const chosen = selectItemsForBatchDownload(unreadUndownloaded, mode);
                if (chosen.length > 0) {
                    void downloadAllManga({ id: item.id, title: item.title, image: item.image }, chosen);
                }
            });
        } else if (activeTab === 'ln') {
            selectedItems.forEach((item) => {
                const cachedChapters = offlineLibraryCache.getLNChapters([item.id]);
                if (cachedChapters.length === 0) return;
                const readSet = new Set(chapterHistory[item.id] || []);
                const downloadedSet = new Set(
                    lnDownloads
                        .filter((d) => String(d.novelId) === item.id || normalizeLibraryTitle(d.novelTitle) === normalizeLibraryTitle(item.title))
                        .map((d) => d.chapterId)
                );
                const unreadUndownloaded = cachedChapters.filter((ch) => !readSet.has(ch.id) && !downloadedSet.has(ch.id));
                const chosen = selectItemsForBatchDownload(unreadUndownloaded, mode);
                if (chosen.length > 0) {
                    void downloadAllLN({ id: item.id, title: item.title, image: item.image }, chosen);
                }
            });
        } else {
            const first = selectedItems[0];
            if (first) {
                navigate(first.route, { state: first.state });
            }
        }
        clearSelection();
    };

    const handleRemoveSelected = () => {
        selectedItems.forEach((item) => removeLibraryEntry(item));
        clearSelection();
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
                favoriteAnime={favoriteAnime}
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
                    {visibleMobileLibraryItems.map((item) => {
                        const isSelected = selectedIds.has(item.id);
                        const displayImage = (item.image && cachedPosters[item.image]) || item.image;
                        return (
                        <div
                            key={`${activeTab}-${item.id}`}
                            role="button"
                            tabIndex={0}
                            onClick={() => handleCardClick(item)}
                            onTouchStart={(e) => handleCardTouchStart(e, item.id)}
                            onTouchMove={handleCardTouchMove}
                            onTouchEnd={cancelLongPress}
                            onTouchCancel={cancelLongPress}
                            onContextMenu={(e) => {
                                if (isReadOnly || !isMobileScreen()) return;
                                e.preventDefault();
                                cancelLongPress();
                                longPressTriggeredRef.current = false;
                                setSelectedIds((prev) => {
                                    const next = new Set(prev);
                                    next.add(item.id);
                                    return next;
                                });
                            }}
                            style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    handleCardClick(item);
                                }
                            }}
                            className={`relative min-w-0 select-none touch-manipulation text-left transition-all duration-200 group cursor-pointer ${
                                displayMode === 'list'
                                    ? `flex items-center gap-3.5 rounded-2xl border p-2.5 shadow-sm ${
                                        isSelected
                                            ? 'bg-white/15 border-white ring-2 ring-white/80'
                                            : 'bg-white/[0.035] hover:bg-white/[0.08] border-white/5 hover:border-white/15'
                                    }`
                                    : isSelected
                                    ? 'scale-[0.98]'
                                    : 'hover:scale-[1.02]'
                            }`}
                        >
                            {/* Cover image */}
                            <div className={`relative shrink-0 overflow-hidden rounded-xl bg-white/5 shadow-md group-hover:shadow-2xl transition-all ${
                                displayMode === 'list' ? 'h-20 w-14 border border-white/5' : `aspect-[2/3] w-full ${
                                    isSelected
                                        ? 'ring-2 ring-white border border-white'
                                        : 'border border-white/5'
                                }`
                            }`}>
                                {displayImage && (
                                    <img
                                        src={displayImage}
                                        alt={item.title}
                                        draggable={false}
                                        onError={(e) => handleImageError(e, item.title)}
                                        className="pointer-events-none h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        loading="lazy"
                                    />
                                )}
                                {/* Selection tint overlay */}
                                {isSelected && displayMode !== 'list' && (
                                    <div className="pointer-events-none absolute inset-0 bg-white/15" />
                                )}
                                {/* Gradient: compact only (title overlaid inside card) */}
                                {displayMode === 'compact' && (
                                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black via-black/75 to-transparent" />
                                )}
                                {/* Unread / unwatched count badge (grid views only, hidden when 0 or in list mode) */}
                                {displayMode !== 'list' && item.count && item.count > 0 ? (
                                    <span className={`absolute left-2 top-2 rounded-md px-2 py-0.5 text-[11px] font-bold shadow ${
                                        isSelected
                                            ? 'bg-white text-black'
                                            : 'bg-black/75 backdrop-blur text-white'
                                    }`}>
                                        {item.count}
                                    </span>
                                ) : null}
                                {/* Desktop-only hover delete button (mobile uses Mihon long-press multi-select) */}
                                {!isReadOnly && displayMode !== 'list' && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            removeLibraryEntry(item);
                                        }}
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
                                        className="hidden md:flex absolute right-2 top-2 z-20 h-7 w-7 items-center justify-center rounded-full bg-black/75 text-white/90 hover:bg-black hover:text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-150 cursor-pointer"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                                {/* Cover only hover indicator */}
                                {displayMode === 'cover' && !isSelectionMode && (
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
                                            {item.count} {activeTab === 'anime' ? 'unwatched' : 'unread'}
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
                                                        {item.count} {activeTab === 'anime' ? 'unwatched' : 'unread'}
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
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                e.preventDefault();
                                                removeLibraryEntry(item);
                                            }}
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
                                            className="hidden md:flex mr-1 h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/75 text-white/90 hover:bg-black hover:text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-150 cursor-pointer"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                        );
                    })}
                    {visibleMobileLibraryItems.length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
                            {downloadedOnly && !searchQuery && activeFilters.size === 0 && activeCategoryId === 'all' ? (
                                <>
                                    <Download className="mb-3 h-9 w-9 text-zinc-500" />
                                    <p className="text-base font-semibold text-white">Downloaded only is enabled</p>
                                    <p className="mt-1 max-w-xs text-xs text-zinc-400">
                                        No downloaded {LIBRARY_TAB_LABELS[activeTab].toLowerCase()} entries yet.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setDownloadedOnly(false)}
                                        className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 transition-colors"
                                    >
                                        Turn off Downloaded only
                                    </button>
                                </>
                            ) : isOffline && activeTab === 'anime' && !searchQuery && activeFilters.size === 0 && activeCategoryId === 'all' ? (
                                <>
                                    <Download className="mb-3 h-9 w-9 text-zinc-500" />
                                    <p className="text-base font-semibold text-white">No downloaded anime</p>
                                    <p className="mt-1 max-w-xs text-xs text-zinc-400">
                                        Episodes you download while online will appear here for offline viewing.
                                    </p>
                                </>
                            ) : (
                                <>
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
                                </>
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

            {/* Mobile-Only Selection Bars (solid black matching mobile navbar, portaled to body) */}
            {isSelectionMode && typeof document !== 'undefined' && createPortal(
                <>
                    <div
                        className="md:hidden fixed inset-x-0 top-0 z-[2147483610] border-b border-white/15 bg-black"
                        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)' }}
                    >
                        <div className="flex h-14 items-center justify-between px-4">
                            <div className="flex items-center gap-4">
                                <button
                                    type="button"
                                    onClick={clearSelection}
                                    className="grid h-10 w-10 place-items-center text-white/90 active:text-white transition-colors"
                                    aria-label="Clear selection"
                                >
                                    <X className="h-5 w-5" strokeWidth={2} />
                                </button>
                                <span className="text-[19px] font-semibold text-white">{selectedIds.size}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={handleSelectAll}
                                    className="grid h-10 w-10 place-items-center text-white/85 active:text-white transition-colors"
                                    title="Select all"
                                    aria-label="Select all"
                                >
                                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M5 3a2 2 0 0 0-2 2" />
                                        <path d="M19 3a2 2 0 0 1 2 2" />
                                        <path d="M21 19a2 2 0 0 1-2 2" />
                                        <path d="M5 21a2 2 0 0 1-2-2" />
                                        <path d="M9 3h1" />
                                        <path d="M14 3h1" />
                                        <path d="M9 21h1" />
                                        <path d="M14 21h1" />
                                        <path d="M3 9v1" />
                                        <path d="M3 14v1" />
                                        <path d="M21 9v1" />
                                        <path d="M21 14v1" />
                                        <rect x="8" y="8" width="8" height="8" rx="1" />
                                    </svg>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleInvertSelection}
                                    className="grid h-10 w-10 place-items-center text-white/85 active:text-white transition-colors"
                                    title="Invert selection"
                                    aria-label="Invert selection"
                                >
                                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M4 9v10a1 1 0 0 0 1 1h10" />
                                        <path d="M10 4h1" />
                                        <path d="M15 4h1" />
                                        <path d="M20 4a1 1 0 0 1 1 1" />
                                        <path d="M21 9v1" />
                                        <path d="M21 14v1" />
                                        <path d="M9 4a1 1 0 0 0-1 1" />
                                        <path d="M8 9v1" />
                                        <path d="M8 14v1" />
                                        <path d="M10 16h1" />
                                        <path d="M15 16h1" />
                                        <path d="M20 16a1 1 0 0 0 1-1" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>

                    <nav
                        className="md:hidden fixed inset-x-0 bottom-0 z-[2147483610] border-t border-white/15 bg-black pb-[env(safe-area-inset-bottom,0px)]"
                        aria-label="Selection actions"
                    >
                        <div className="flex h-16 items-center justify-around">
                            <button
                                type="button"
                                onClick={handleOpenMoveSelectedCategory}
                                className="flex h-full min-w-0 flex-1 items-center justify-center text-white/85 active:text-white touch-manipulation"
                                aria-label="Set categories"
                            >
                                <FolderInput className="h-5 w-5 shrink-0" strokeWidth={2} />
                            </button>
                            <button
                                type="button"
                                onClick={handleMarkSelectedRead}
                                className="flex h-full min-w-0 flex-1 items-center justify-center text-white/85 active:text-white touch-manipulation"
                                aria-label={activeTab === 'anime' ? 'Mark as watched' : 'Mark as read'}
                            >
                                <CheckCheck className="h-5 w-5 shrink-0" strokeWidth={2} />
                            </button>
                            <button
                                type="button"
                                onClick={handleMarkSelectedUnread}
                                className="flex h-full min-w-0 flex-1 items-center justify-center text-white/85 active:text-white touch-manipulation"
                                aria-label={activeTab === 'anime' ? 'Mark as unwatched' : 'Mark as unread'}
                            >
                                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 6 7 17l-5-5" />
                                    <path d="m22 10-7.5 7.5L13 16" />
                                    <path d="m3 3 18 18" />
                                </svg>
                            </button>
                            <div className="relative flex h-full min-w-0 flex-1 items-center justify-center">
                                <button
                                    type="button"
                                    onClick={() => setIsSelectionDownloadOpen((open) => !open)}
                                    className={`flex h-full w-full items-center justify-center touch-manipulation ${
                                        isSelectionDownloadOpen ? 'text-white' : 'text-white/85 active:text-white'
                                    }`}
                                    aria-label="Download"
                                >
                                    <Download className="h-5 w-5 shrink-0" strokeWidth={2} />
                                </button>
                                <BatchDownloadMenu
                                    isOpen={isSelectionDownloadOpen}
                                    onClose={() => setIsSelectionDownloadOpen(false)}
                                    unit={activeTab === 'anime' ? 'episode' : 'chapter'}
                                    placement="top-right"
                                    onSelect={handleDownloadSelected}
                                />
                            </div>
                            <button
                                type="button"
                                onClick={handleRemoveSelected}
                                className="flex h-full min-w-0 flex-1 items-center justify-center text-red-400 active:text-red-300 touch-manipulation"
                                aria-label="Delete"
                            >
                                <Trash2 className="h-5 w-5 shrink-0" strokeWidth={2} />
                            </button>
                        </div>
                    </nav>
                </>,
                document.body
            )}
        </div>
    );
}

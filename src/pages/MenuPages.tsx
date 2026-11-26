import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Bell,
    BookOpen,
    BookText,
    CheckCheck,
    Code2,
    Download,
    ExternalLink,
    Globe,
    RefreshCw,
    Search,
    ShieldAlert,
    Tag,
    Trash2,
    Tv,
    Upload,
    X,
} from 'lucide-react';
import { useAppPrefs } from '../utils/appPrefs';
import { useDownloads } from '../hooks/useDownloads';
import { useMangaDownloads } from '../hooks/useMangaDownloads';
import { useLNDownloads } from '../hooks/useLNDownloads';
import { useContinueWatching } from '../hooks/useContinueWatching';
import { useContinueReading } from '../hooks/useContinueReading';
import { useContinueLNReading } from '../hooks/useContinueLNReading';
import { useWatchList } from '../hooks/useWatchList';
import { useReadList } from '../hooks/useReadList';
import { useLNReadList } from '../hooks/useLNReadList';
import { useTitleLanguage } from '../context/TitleLanguageContext';
import { useWatchlistNotifications } from '../hooks/useWatchlistNotifications';
import { storage } from '../utils/storage';
import { getAnimeDetailsRouteId } from '../utils/animeNavigation';
import {
    clearOfflineImageCache,
    generateTitlePlaceholder,
    getCachedImage,
    prefetchImages,
} from '../services/offlineImageCache';
import { deleteOfflineHistoryKey, persistOfflineHistoryKey } from '../services/offlineHistoryStore';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { cloudSyncService } from '../services/cloudSyncService';
import { Browser } from '@capacitor/browser';
import { isNativeMobile, isTauri } from '../platform/runtime';
import GlobalChatDrawer from '../components/shared/GlobalChatDrawer';
import { DiscordBrandIcon } from '../components/shared/DiscordInviteModal';

const APP_VERSION = '5.0.5';
const RECENT_SEARCHES_KEY = 'yorumi_recent_searches_global_v1';
const DISCORD_SESSION_KEY = 'yorumi_discord_chat_session_v1';
const DEFAULT_BRIDGE_URL = 'https://yorumibot-1.onrender.com';

interface StoredDiscordSession {
    token: string;
    user: {
        id: string;
        username: string;
        avatar?: string;
    };
}

const readStoredDiscordSession = (): StoredDiscordSession | null => {
    try {
        const raw = localStorage.getItem(DISCORD_SESSION_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as StoredDiscordSession;
        return parsed?.token && parsed?.user?.username ? parsed : null;
    } catch {
        return null;
    }
};

const getDiscordBridgeUrl = () => {
    const envUrl = (import.meta.env.VITE_DISCORD_CHAT_BRIDGE_URL as string | undefined)?.trim();
    return (envUrl || DEFAULT_BRIDGE_URL).replace(/\/+$/, '');
};

const openDiscordAuthUrl = async (url: string) => {
    if (isTauri()) {
        try {
            const { openUrl } = await import('@tauri-apps/plugin-opener');
            await openUrl(url);
            return;
        } catch {
            // Fall through
        }
    }
    if (isNativeMobile()) {
        try {
            await Browser.open({ url });
            return;
        } catch {
            // Fall through
        }
    }
    window.open(url, '_blank', 'noopener,noreferrer');
};
const BACKUP_KEYS = [
    'yorumi_watch_list',
    'yorumi_read_list',
    'yorumi_ln_read_list_v1',
    'yorumi_continue_watching',
    'yorumi_continue_reading',
    'yorumi_ln_continue_reading_v1',
    'yorumi_episode_history',
    'yorumi_chapter_history',
    'yorumi_library_categories_v1',
    'yorumi_title_language',
] as const;

const formatBytes = (bytes: number): string => {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let idx = 0;
    while (value >= 1024 && idx < units.length - 1) {
        value /= 1024;
        idx += 1;
    }
    return `${value.toFixed(idx >= 2 ? 1 : 0)} ${units[idx]}`;
};

const readSearchHistory = (): string[] => {
    try {
        const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed)
            ? parsed.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
            : [];
    } catch {
        return [];
    }
};

const formatDateGroupLabel = (timestampMs?: number): string => {
    if (!timestampMs || !Number.isFinite(timestampMs)) return 'Earlier';
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
    if (timestampMs >= startOfToday) return 'Today';
    if (timestampMs >= startOfYesterday) return 'Yesterday';
    const d = new Date(timestampMs);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const year = String(d.getFullYear()).slice(-2);
    return `${month}/${day}/${year}`;
};

const formatTimeShort = (timestampMs?: number): string => {
    if (!timestampMs || !Number.isFinite(timestampMs)) return '';
    try {
        return new Date(timestampMs).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch {
        return '';
    }
};

function MenuPageShell({
    title,
    badge,
    rightAction,
    children,
}: {
    title: string;
    badge?: number | string;
    rightAction?: ReactNode;
    children: ReactNode;
}) {
    const navigate = useNavigate();
    const { downloadedOnly } = useAppPrefs();
    const hasTopBanner = downloadedOnly;

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white pb-10">
            <header
                className="sticky z-30 flex items-center gap-3 border-b border-white/[0.08] bg-[#0a0a0a] px-3 pb-3"
                style={{
                    top: hasTopBanner ? 'var(--yorumi-mode-banner-height, 0px)' : '0px',
                    paddingTop: hasTopBanner ? '10px' : 'calc(max(env(safe-area-inset-top, 0px), 14px) + 6px)',
                }}
            >
                <button
                    type="button"
                    onClick={() => navigate(-1)}
                    aria-label="Go back"
                    className="flex h-10 w-10 items-center justify-center rounded-full text-white active:bg-white/10"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <h1 className="truncate text-[19px] font-bold tracking-tight text-white">{title}</h1>
                    {badge !== undefined && badge !== 0 && (
                        <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold text-white">
                            {badge}
                        </span>
                    )}
                </div>
                {rightAction}
            </header>
            <div className="mx-auto w-full max-w-2xl">{children}</div>
        </div>
    );
}

/* ============================================================================
 * 0. Updates Page (Watchlist Episode Updates)
 * ========================================================================== */
export function UpdatesPage() {
    const navigate = useNavigate();
    const {
        notifications,
        unreadCount,
        loading,
        refresh,
        markAsRead,
        markAllRead,
    } = useWatchlistNotifications();

    return (
        <MenuPageShell
            title="Updates"
            badge={unreadCount}
            rightAction={
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={refresh}
                        aria-label="Refresh updates"
                        className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-200 active:bg-white/10"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    {unreadCount > 0 && (
                        <button
                            type="button"
                            onClick={markAllRead}
                            aria-label="Mark all read"
                            className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-200 active:bg-white/10"
                        >
                            <CheckCheck className="h-5 w-5" />
                        </button>
                    )}
                </div>
            }
        >
            {notifications.length === 0 ? (
                <EmptyPageState
                    icon={Bell}
                    title={loading ? 'Checking for new episodes…' : 'You’re all caught up'}
                    subtitle="New episodes from airing anime in your watchlist will show up here."
                />
            ) : (
                <div className="divide-y divide-white/[0.06] px-4 py-2">
                    {notifications.map((notif) => (
                        <button
                            key={notif.id}
                            type="button"
                            onClick={() => {
                                markAsRead(notif.anilistId, notif.latestEpisode);
                                navigate(`/anime/details/al-${notif.anilistId}`);
                            }}
                            className="flex w-full items-center gap-3.5 py-3 text-left active:opacity-80"
                        >
                            <div className="h-[72px] w-[52px] shrink-0 overflow-hidden rounded-md bg-zinc-900">
                                {notif.image && (
                                    <img
                                        src={notif.image}
                                        alt={notif.title}
                                        loading="lazy"
                                        className="h-full w-full object-cover"
                                    />
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    {notif.unread && (
                                        <span className="h-2 w-2 shrink-0 rounded-full bg-yorumi-accent" />
                                    )}
                                    <p className="line-clamp-2 text-[15px] font-semibold leading-snug text-white">
                                        {notif.title}
                                    </p>
                                </div>
                                <p className="mt-1 text-[13px] font-medium text-yorumi-accent">
                                    Episode {notif.latestEpisode} is out
                                    {notif.watchedEpisode > 0 ? ` · Watched Ep ${notif.watchedEpisode}` : ''}
                                </p>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </MenuPageShell>
    );
}

/* ============================================================================
 * 1. Download Queue Page (Tabbed: Anime / Manga / LN, full title + ep/ch + status)
 * ========================================================================== */
type QueueTab = 'anime' | 'manga' | 'ln';

type QueueRowItem = {
    key: string;
    seriesTitle: string;
    itemLabel: string;
    statusText: string;
    progress: number;
    isDownloading: boolean;
    onCancel: () => void;
};

export function DownloadQueuePage() {
    const { activeDownloads: activeAnimeDownloads, cancelDownload: cancelAnimeDownload } = useDownloads();
    const { activeDownloads: activeMangaDownloads, cancelDownload: cancelMangaDownload } = useMangaDownloads();
    const { activeDownloads: activeLNDownloads, cancelDownload: cancelLNDownload } = useLNDownloads();
    const [activeTab, setActiveTab] = useState<QueueTab>('anime');

    const { animeItems, mangaItems, lnItems } = useMemo(() => {
        const animeList: QueueRowItem[] = [];
        const seenAnime = new Set<string>();
        activeAnimeDownloads.forEach((prog) => {
            const dedupeKey = `${prog.animeId}:${prog.episodeNumber}`;
            if (seenAnime.has(dedupeKey)) return;
            seenAnime.add(dedupeKey);
            const pct = Math.max(0, Math.min(100, Math.round(prog.progress || 0)));
            const statusText =
                prog.status === 'error'
                    ? (prog.error || 'Failed')
                    : prog.status === 'queued'
                        ? 'Queued'
                        : prog.status === 'saving'
                            ? 'Saving…'
                            : prog.status === 'paused'
                                ? `Paused · ${pct}%`
                                : `Downloading… ${pct}%`;
            const epLabel =
                prog.episodeTitle && !/^episode\s+\d+$/i.test(prog.episodeTitle.trim())
                    ? `Episode ${prog.episodeNumber} · ${prog.episodeTitle}`
                    : `Episode ${prog.episodeNumber}`;
            animeList.push({
                key: `anime-${dedupeKey}`,
                seriesTitle: prog.animeTitle || 'Anime',
                itemLabel: epLabel,
                statusText,
                progress: pct,
                isDownloading: prog.status === 'downloading' || prog.status === 'saving',
                onCancel: () => cancelAnimeDownload(prog.animeId, prog.episodeNumber, prog.animeTitle),
            });
        });

        const mangaList: QueueRowItem[] = [];
        activeMangaDownloads.forEach((prog, key) => {
            const pct = Math.max(0, Math.min(100, Math.round(prog.progress || 0)));
            const statusText =
                prog.status === 'error'
                    ? (prog.error || 'Failed')
                    : prog.totalPages > 0
                        ? `Downloading… ${prog.downloadedPages}/${prog.totalPages}`
                        : `Downloading… ${pct}%`;
            mangaList.push({
                key: `manga-${key}`,
                seriesTitle: prog.mangaTitle || 'Manga',
                itemLabel: prog.chapterTitle || 'Chapter',
                statusText,
                progress: pct,
                isDownloading: prog.status === 'downloading',
                onCancel: () => cancelMangaDownload(prog.mangaId, prog.chapterId),
            });
        });

        const lnList: QueueRowItem[] = [];
        activeLNDownloads.forEach((prog, key) => {
            const pct = Math.max(0, Math.min(100, Math.round(prog.progress || 0)));
            lnList.push({
                key: `ln-${key}`,
                seriesTitle: prog.novelTitle || 'Light Novel',
                itemLabel: prog.chapterTitle || 'Chapter',
                statusText: prog.status === 'error' ? (prog.error || 'Failed') : `Downloading… ${pct}%`,
                progress: pct,
                isDownloading: prog.status === 'downloading',
                onCancel: () => cancelLNDownload(prog.novelId, prog.chapterId),
            });
        });

        return { animeItems: animeList, mangaItems: mangaList, lnItems: lnList };
    }, [
        activeAnimeDownloads,
        activeMangaDownloads,
        activeLNDownloads,
        cancelAnimeDownload,
        cancelMangaDownload,
        cancelLNDownload,
    ]);

    const totalCount = animeItems.length + mangaItems.length + lnItems.length;
    const currentItems = activeTab === 'anime' ? animeItems : activeTab === 'manga' ? mangaItems : lnItems;

    // Auto-select first non-empty tab on initial open if Anime is empty
    useEffect(() => {
        if (activeTab === 'anime' && animeItems.length === 0) {
            if (mangaItems.length > 0) setActiveTab('manga');
            else if (lnItems.length > 0) setActiveTab('ln');
        }
    }, [activeTab, animeItems.length, mangaItems.length, lnItems.length]);

    const handleCancelAll = () => {
        currentItems.forEach((item) => item.onCancel());
    };

    const tabs: Array<{ id: QueueTab; label: string; count: number }> = [
        { id: 'anime', label: 'Anime', count: animeItems.length },
        { id: 'manga', label: 'Manga', count: mangaItems.length },
        { id: 'ln', label: 'LN', count: lnItems.length },
    ];

    return (
        <MenuPageShell
            title="Download queue"
            badge={totalCount}
            rightAction={
                currentItems.length > 0 ? (
                    <button
                        type="button"
                        onClick={handleCancelAll}
                        aria-label="Cancel all in tab"
                        title="Cancel all"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-300 active:bg-white/10"
                    >
                        <Trash2 className="h-5 w-5" />
                    </button>
                ) : undefined
            }
        >
            {/* Media Tabs: Anime / Manga / LN */}
            <div className="grid grid-cols-3 border-b border-white/[0.08] bg-[#0a0a0a]">
                {tabs.map((tab) => {
                    const isSelected = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`relative flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors ${
                                isSelected ? 'text-yorumi-accent' : 'text-zinc-400'
                            }`}
                        >
                            <span>{tab.label}</span>
                            <span
                                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                    isSelected
                                        ? 'bg-yorumi-accent/20 text-yorumi-accent'
                                        : 'bg-white/10 text-zinc-400'
                                }`}
                            >
                                {tab.count}
                            </span>
                            {isSelected && (
                                <span className="absolute inset-x-4 bottom-0 h-[2.5px] rounded-full bg-yorumi-accent" />
                            )}
                        </button>
                    );
                })}
            </div>

            {currentItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
                    <Download className="mb-3 h-10 w-10 text-zinc-600" />
                    <p className="text-base font-semibold text-white">No active downloads</p>
                    <p className="mt-1 max-w-xs text-xs text-zinc-400">
                        Episodes and chapters downloading in the background will show up here.
                    </p>
                </div>
            ) : (
                <div className="divide-y divide-white/[0.06] px-4 py-2">
                    {currentItems.map((item) => (
                        <div key={item.key} className="flex items-center gap-3 py-3.5">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-baseline justify-between gap-2">
                                    <p className="truncate text-[15px] font-medium text-white">
                                        {item.seriesTitle}
                                    </p>
                                    <span className="shrink-0 text-[12px] font-medium text-zinc-400">
                                        {item.statusText}
                                    </span>
                                </div>
                                <p className="mt-0.5 truncate text-[13px] text-zinc-400">
                                    {item.itemLabel}
                                </p>
                                <div className="mt-2.5 h-[3px] w-full overflow-hidden rounded-full bg-white/15">
                                    <div
                                        className="h-full rounded-full bg-yorumi-accent transition-all duration-200"
                                        style={{ width: `${Math.max(item.isDownloading ? 4 : 0, item.progress)}%` }}
                                    />
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={item.onCancel}
                                aria-label="Cancel download"
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-400 active:bg-white/10 active:text-white"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </MenuPageShell>
    );
}

/* ============================================================================
 * 2. History Page (Date-grouped vertical list with poster, Ep/Ch - time, delete)
 * ========================================================================== */
type HistoryTab = 'anime' | 'manga' | 'ln' | 'search';

type HistoryEntry = {
    key: string;
    title: string;
    image: string;
    unitLabel: string;
    timestamp: number;
    onOpen: () => void;
    onRemove: () => void;
};

export function HistoryPage() {
    const navigate = useNavigate();
    const isOnline = useOnlineStatus();
    const [tab, setTab] = useState<HistoryTab>('anime');
    const [showSearch, setShowSearch] = useState(false);
    const [filterText, setFilterText] = useState('');
    const [searchHistory, setSearchHistory] = useState<string[]>(readSearchHistory);
    const [cachedPosters, setCachedPosters] = useState<Record<string, string>>({});

    const { continueWatchingList, removeFromHistory: removeAnimeHistory } = useContinueWatching();
    const { continueReadingList, removeFromHistory: removeMangaHistory } = useContinueReading();
    const { continueReadingList: continueLNList, removeLNProgress } = useContinueLNReading();

    // Keep search history synced when offline IndexedDB hydration completes
    useEffect(() => {
        const reloadSearch = () => setSearchHistory(readSearchHistory());
        window.addEventListener('yorumi-storage-updated', reloadSearch);
        return () => window.removeEventListener('yorumi-storage-updated', reloadSearch);
    }, []);

    const normalizedFilter = filterText.trim().toLowerCase();

    const entries = useMemo<HistoryEntry[]>(() => {
        if (tab === 'anime') {
            return continueWatchingList
                .filter((i) => !normalizedFilter || i.animeTitle.toLowerCase().includes(normalizedFilter))
                .map((item) => {
                    const routeId = getAnimeDetailsRouteId({
                        id: item.anilistId || item.animeId,
                        mal_id: item.malId,
                    });
                    return {
                        key: `anime-${item.animeId}-${item.episodeNumber}`,
                        title: item.animeTitle,
                        image: item.animePoster || item.animeImage,
                        unitLabel: `Ep. ${item.episodeNumber}`,
                        timestamp: item.lastWatched || item.timestamp || 0,
                        onOpen: () => navigate(`/anime/details/${routeId}?ep=${item.episodeNumber}`),
                        onRemove: () => removeAnimeHistory(item.animeId),
                    };
                });
        }
        if (tab === 'manga') {
            return continueReadingList
                .filter((i) => !normalizedFilter || i.mangaTitle.toLowerCase().includes(normalizedFilter))
                .map((item) => ({
                    key: `manga-${item.mangaId}-${item.chapterId}`,
                    title: item.mangaTitle,
                    image: item.mangaPoster || item.mangaImage,
                    unitLabel: `Ch. ${item.chapterNumber}`,
                    timestamp: item.lastRead || item.timestamp || 0,
                    onOpen: () => navigate(`/manga/details/${item.mangaId}`),
                    onRemove: () => removeMangaHistory(item.mangaId),
                }));
        }
        if (tab === 'ln') {
            return continueLNList
                .filter((i) => !normalizedFilter || i.novelTitle.toLowerCase().includes(normalizedFilter))
                .map((item) => ({
                    key: `ln-${item.novelId}-${item.chapterId}`,
                    title: item.novelTitle,
                    image: item.coverImage,
                    unitLabel: `Ch. ${item.chapterNumber}`,
                    timestamp: item.updatedAt ? new Date(item.updatedAt).getTime() : 0,
                    onOpen: () => navigate(`/ln/details/${item.novelId}`),
                    onRemove: () => removeLNProgress(item.novelId),
                }));
        }
        return [];
    }, [
        tab,
        normalizedFilter,
        continueWatchingList,
        continueReadingList,
        continueLNList,
        navigate,
        removeAnimeHistory,
        removeMangaHistory,
        removeLNProgress,
    ]);

    // Resolve cached offline posters for History items and prefetch missing ones while online
    useEffect(() => {
        let cancelled = false;
        const urls = Array.from(new Set(entries.map((item) => item.image).filter(Boolean)));
        if (urls.length === 0) return;

        void (async () => {
            const resolved: Record<string, string> = {};
            const missing: string[] = [];
            await Promise.all(
                urls.map(async (url) => {
                    const cached = await getCachedImage(url).catch(() => null);
                    if (cached) {
                        resolved[url] = cached;
                    } else {
                        missing.push(url);
                    }
                }),
            );
            if (!cancelled && Object.keys(resolved).length > 0) {
                setCachedPosters((prev) => ({ ...prev, ...resolved }));
            }
            if (!cancelled && isOnline && missing.length > 0) {
                await prefetchImages(missing.slice(0, 30));
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [entries, isOnline]);

    const groupedEntries = useMemo(() => {
        const sorted = [...entries].sort((a, b) => b.timestamp - a.timestamp);
        const groups: Array<{ label: string; items: HistoryEntry[] }> = [];
        for (const item of sorted) {
            const label = formatDateGroupLabel(item.timestamp);
            const last = groups[groups.length - 1];
            if (last && last.label === label) {
                last.items.push(item);
            } else {
                groups.push({ label, items: [item] });
            }
        }
        return groups;
    }, [entries]);

    const filteredSearchHistory = useMemo(
        () => searchHistory.filter((term) => !normalizedFilter || term.toLowerCase().includes(normalizedFilter)),
        [searchHistory, normalizedFilter]
    );

    const handleClearCurrentTab = () => {
        if (tab === 'anime') {
            continueWatchingList.forEach((i) => removeAnimeHistory(i.animeId));
        } else if (tab === 'manga') {
            continueReadingList.forEach((i) => removeMangaHistory(i.mangaId));
        } else if (tab === 'ln') {
            continueLNList.forEach((i) => removeLNProgress(i.novelId));
        } else {
            deleteOfflineHistoryKey(RECENT_SEARCHES_KEY);
            try {
                localStorage.removeItem(RECENT_SEARCHES_KEY);
                localStorage.removeItem('yorumi_recent_searches_anime');
                localStorage.removeItem('yorumi_recent_searches_manga');
                localStorage.removeItem('yorumi_recent_searches_ln');
            } catch {
                // Best effort
            }
            setSearchHistory([]);
        }
    };

    const handleRemoveSearchTerm = (term: string) => {
        const next = searchHistory.filter((t) => t !== term);
        setSearchHistory(next);
        const serialized = JSON.stringify(next);
        persistOfflineHistoryKey(RECENT_SEARCHES_KEY, serialized);
        try {
            localStorage.setItem(RECENT_SEARCHES_KEY, serialized);
        } catch {
            // Best effort
        }
    };

    return (
        <MenuPageShell
            title="History"
            rightAction={
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => {
                            setShowSearch((prev) => {
                                if (prev) setFilterText('');
                                return !prev;
                            });
                        }}
                        aria-label="Filter history"
                        className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-200 active:bg-white/10"
                    >
                        <Search className="h-5 w-5" />
                    </button>
                    <button
                        type="button"
                        onClick={handleClearCurrentTab}
                        aria-label="Clear history"
                        className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-300 active:bg-white/10"
                    >
                        <Trash2 className="h-5 w-5" />
                    </button>
                </div>
            }
        >
            {showSearch && (
                <div className="px-4 pt-3">
                    <div className="flex items-center gap-2 rounded-xl bg-[#181818] px-3 py-2">
                        <Search className="h-4 w-4 text-zinc-400" />
                        <input
                            type="text"
                            value={filterText}
                            onChange={(e) => setFilterText(e.target.value)}
                            placeholder="Search history..."
                            autoFocus
                            className="w-full bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none"
                        />
                        {filterText && (
                            <button type="button" onClick={() => setFilterText('')} className="text-zinc-400">
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Category Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto px-4 py-3">
                {([
                    { id: 'anime', label: 'Anime' },
                    { id: 'manga', label: 'Manga' },
                    { id: 'ln', label: 'Light Novels' },
                    { id: 'search', label: 'Search' },
                ] as const).map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => setTab(item.id)}
                        className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                            tab === item.id
                                ? 'bg-white text-black'
                                : 'bg-[#1a1a1a] text-zinc-300'
                        }`}
                    >
                        {item.label}
                    </button>
                ))}
            </div>

            {tab === 'search' ? (
                filteredSearchHistory.length === 0 ? (
                    <EmptyPageState icon={Search} title="No search history" subtitle="Your recent searches will appear here." />
                ) : (
                    <div className="divide-y divide-white/[0.06] px-4">
                        {filteredSearchHistory.map((term) => (
                            <div key={term} className="flex items-center justify-between py-3">
                                <button
                                    type="button"
                                    onClick={() => navigate(`/search?q=${encodeURIComponent(term)}`)}
                                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                                >
                                    <Search className="h-4 w-4 shrink-0 text-zinc-500" />
                                    <span className="truncate text-sm text-white">{term}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleRemoveSearchTerm(term)}
                                    aria-label={`Remove ${term}`}
                                    className="p-2 text-zinc-500 active:text-white"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )
            ) : groupedEntries.length === 0 ? (
                <EmptyPageState
                    icon={tab === 'anime' ? Tv : tab === 'manga' ? BookOpen : BookText}
                    title={`No ${tab === 'ln' ? 'light novel' : tab} history`}
                    subtitle="Items you watch or read will show up here."
                />
            ) : (
                <div className="space-y-5 px-4 pb-6 pt-1">
                    {groupedEntries.map((group) => (
                        <section key={group.label}>
                            <h2 className="mb-3 text-sm font-semibold text-zinc-300">{group.label}</h2>
                            <div className="space-y-3.5">
                                {group.items.map((item) => {
                                    const timeStr = formatTimeShort(item.timestamp);
                                    return (
                                        <div key={item.key} className="flex items-center gap-3.5">
                                            <button
                                                type="button"
                                                onClick={item.onOpen}
                                                className="flex min-w-0 flex-1 items-center gap-3.5 text-left active:opacity-80"
                                            >
                                                <div className="h-[76px] w-[54px] shrink-0 overflow-hidden rounded-md bg-zinc-900">
                                                    {item.image ? (
                                                        <img
                                                            src={
                                                                cachedPosters[item.image] ||
                                                                (isOnline ? item.image : generateTitlePlaceholder(item.title))
                                                            }
                                                            alt={item.title}
                                                            loading="lazy"
                                                            onError={(e) => {
                                                                const img = e.currentTarget;
                                                                if (img.dataset.fallbackApplied) return;
                                                                img.dataset.fallbackApplied = '1';
                                                                img.src = generateTitlePlaceholder(item.title);
                                                            }}
                                                            className="h-full w-full object-cover"
                                                        />
                                                    ) : (
                                                        <img
                                                            src={generateTitlePlaceholder(item.title)}
                                                            alt={item.title}
                                                            className="h-full w-full object-cover"
                                                        />
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="line-clamp-2 text-[15px] font-semibold leading-snug text-white">
                                                        {item.title}
                                                    </p>
                                                    <p className="mt-1 text-[13px] text-zinc-400">
                                                        {item.unitLabel}
                                                        {timeStr ? ` - ${timeStr}` : ''}
                                                    </p>
                                                </div>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={item.onRemove}
                                                aria-label={`Remove ${item.title} from history`}
                                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-zinc-300 active:bg-white/10 active:text-red-400"
                                            >
                                                <Trash2 className="h-[18px] w-[18px]" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    ))}
                </div>
            )}
        </MenuPageShell>
    );
}

/* ============================================================================
 * 3. Statistics Page
 * ========================================================================== */
export function StatisticsPage() {
    const { watchList } = useWatchList();
    const { readList } = useReadList();
    const { readList: lnReadList } = useLNReadList();
    const { downloads: animeDownloads } = useDownloads();
    const { downloads: mangaDownloads } = useMangaDownloads();
    const { downloads: lnDownloads } = useLNDownloads();

    const stats = useMemo(() => {
        const totalWatchSeconds = storage.getAnimeWatchTimeTotalSeconds();
        const totalHours = Math.floor(totalWatchSeconds / 3600);
        const totalMins = Math.floor((totalWatchSeconds % 3600) / 60);
        const watchedEpisodesCount = Object.values(storage.getEpisodeHistory()).reduce((sum, list) => sum + list.length, 0);
        const readChaptersCount = Object.values(storage.getChapterHistory()).reduce((sum, list) => sum + list.length, 0);

        const genreCounts = new Map<string, number>();
        const addGenres = (genres?: string[]) => {
            if (!Array.isArray(genres)) return;
            genres.forEach((g) => {
                const clean = String(g || '').trim();
                if (!clean) return;
                genreCounts.set(clean, (genreCounts.get(clean) || 0) + 1);
            });
        };
        watchList.forEach((i) => addGenres(i.genres));
        readList.forEach((i) => addGenres(i.genres));
        Object.values(storage.getAnimeGenreCache()).forEach(addGenres);
        Object.values(storage.getMangaGenreCache()).forEach(addGenres);

        const topGenres = [...genreCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8);

        return {
            totalHours,
            totalMins,
            watchedEpisodesCount,
            readChaptersCount,
            topGenres,
            maxGenreCount: topGenres[0]?.[1] || 1,
        };
    }, [watchList, readList]);

    return (
        <MenuPageShell title="Statistics">
            <div className="space-y-4 p-4">
                <div className="grid grid-cols-2 gap-3">
                    <StatBox
                        label="Watch time"
                        value={stats.totalHours > 0 ? `${stats.totalHours}h ${stats.totalMins}m` : `${stats.totalMins}m`}
                    />
                    <StatBox label="Episodes watched" value={String(stats.watchedEpisodesCount)} />
                    <StatBox label="Chapters read" value={String(stats.readChaptersCount)} />
                    <StatBox
                        label="Total downloaded"
                        value={String(animeDownloads.length + mangaDownloads.length + lnDownloads.length)}
                    />
                </div>

                <div className="rounded-2xl border border-white/[0.08] bg-[#141414] p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                        Library breakdown
                    </p>
                    <div className="space-y-2.5 text-sm">
                        <div className="flex justify-between">
                            <span className="text-zinc-300">Anime</span>
                            <span className="font-semibold text-white">{watchList.length}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-zinc-300">Manga</span>
                            <span className="font-semibold text-white">{readList.length}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-zinc-300">Light Novels</span>
                            <span className="font-semibold text-white">{lnReadList.length}</span>
                        </div>
                    </div>
                </div>

                {stats.topGenres.length > 0 && (
                    <div className="rounded-2xl border border-white/[0.08] bg-[#141414] p-4">
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                            Top genres
                        </p>
                        <div className="space-y-3">
                            {stats.topGenres.map(([genre, count]) => (
                                <div key={genre}>
                                    <div className="mb-1 flex justify-between text-xs">
                                        <span className="text-zinc-200">{genre}</span>
                                        <span className="text-zinc-400">{count}</span>
                                    </div>
                                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                                        <div
                                            className="h-full rounded-full bg-yorumi-accent"
                                            style={{ width: `${Math.round((count / stats.maxGenreCount) * 100)}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </MenuPageShell>
    );
}

/* ============================================================================
 * 4. Data and Storage Page
 * ========================================================================== */
export function DataStoragePage() {
    const { downloads: animeDownloads } = useDownloads();
    const { downloads: mangaDownloads } = useMangaDownloads();
    const { downloads: lnDownloads } = useLNDownloads();
    const [storageEstimate, setStorageEstimate] = useState<{ usage: number; quota: number } | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [discordSession, setDiscordSession] = useState<StoredDiscordSession | null>(readStoredDiscordSession);
    const [signingInDiscord, setSigningInDiscord] = useState(false);
    const [syncingNow, setSyncingNow] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const authPollRef = useRef<number | null>(null);

    useEffect(() => {
        const syncSession = () => setDiscordSession(readStoredDiscordSession());
        window.addEventListener('yorumi-discord-session-updated', syncSession);
        return () => {
            window.removeEventListener('yorumi-discord-session-updated', syncSession);
            if (authPollRef.current) window.clearInterval(authPollRef.current);
        };
    }, []);

    useEffect(() => {
        if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
            void navigator.storage.estimate().then((est) => {
                setStorageEstimate({
                    usage: Number(est.usage || 0),
                    quota: Number(est.quota || 0),
                });
            }).catch(() => setStorageEstimate(null));
        }
    }, []);

    const showNotice = (msg: string) => {
        setNotice(msg);
        window.setTimeout(() => setNotice(null), 3000);
    };

    const handleDiscordSignIn = async () => {
        if (signingInDiscord) {
            if (authPollRef.current) window.clearInterval(authPollRef.current);
            authPollRef.current = null;
            setSigningInDiscord(false);
            return;
        }
        const bridgeUrl = getDiscordBridgeUrl();
        setSigningInDiscord(true);
        const state = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
        await openDiscordAuthUrl(`${bridgeUrl}/auth/discord/login?state=${encodeURIComponent(state)}`);

        if (authPollRef.current) window.clearInterval(authPollRef.current);
        let attempts = 0;
        authPollRef.current = window.setInterval(async () => {
            attempts += 1;
            if (attempts > 80) {
                if (authPollRef.current) window.clearInterval(authPollRef.current);
                authPollRef.current = null;
                setSigningInDiscord(false);
                return;
            }
            try {
                const res = await fetch(`${bridgeUrl}/auth/discord/poll?state=${encodeURIComponent(state)}`);
                if (!res.ok) return;
                const data = (await res.json()) as { ready?: boolean; token?: string; user?: StoredDiscordSession['user'] };
                if (data.ready && data.token && data.user) {
                    if (authPollRef.current) window.clearInterval(authPollRef.current);
                    authPollRef.current = null;
                    const nextSession: StoredDiscordSession = { token: data.token, user: data.user };
                    setDiscordSession(nextSession);
                    try {
                        localStorage.setItem(DISCORD_SESSION_KEY, JSON.stringify(nextSession));
                        window.dispatchEvent(new CustomEvent('yorumi-discord-session-updated'));
                    } catch {
                        // Best effort
                    }
                    setSigningInDiscord(false);
                    showNotice(`Signed in as ${data.user.username} — syncing library…`);
                }
            } catch {
                // Keep polling
            }
        }, 1500);
    };

    const handleDiscordSignOut = () => {
        setDiscordSession(null);
        try {
            localStorage.removeItem(DISCORD_SESSION_KEY);
            window.dispatchEvent(new CustomEvent('yorumi-discord-session-updated'));
        } catch {
            // Best effort
        }
        showNotice('Signed out of Discord cloud sync');
    };

    const handleSyncNow = async () => {
        setSyncingNow(true);
        try {
            await cloudSyncService.pullAndMerge();
            await cloudSyncService.pushNow();
            showNotice('Library synced');
        } catch {
            showNotice('Sync failed — check your connection');
        } finally {
            setSyncingNow(false);
        }
    };

    const handleExportBackup = () => {
        try {
            const dataMap: Record<string, string> = {};
            BACKUP_KEYS.forEach((key) => {
                const val = localStorage.getItem(key);
                if (val !== null) dataMap[key] = val;
            });
            const payload = {
                version: APP_VERSION,
                exportedAt: new Date().toISOString(),
                data: dataMap,
            };
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `yorumi-backup-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            showNotice('Backup exported');
        } catch {
            showNotice('Failed to export backup');
        }
    };

    const handleImportBackup = async (file: File | null) => {
        if (!file) return;
        try {
            const text = await file.text();
            const parsed = JSON.parse(text) as { data?: Record<string, string> };
            if (!parsed || typeof parsed.data !== 'object' || !parsed.data) {
                showNotice('Invalid backup file');
                return;
            }
            let restored = 0;
            Object.entries(parsed.data).forEach(([key, value]) => {
                if (typeof value === 'string' && key.startsWith('yorumi_')) {
                    localStorage.setItem(key, value);
                    restored += 1;
                }
            });
            storage.invalidateMemoryCache();
            window.dispatchEvent(new CustomEvent('yorumi-storage-updated'));
            showNotice(`Restored ${restored} data groups`);
        } catch {
            showNotice('Failed to restore backup');
        }
    };

    const handleClearCache = async () => {
        await clearOfflineImageCache();
        try {
            localStorage.removeItem('yorumi_offline_library_cache_v1');
            localStorage.removeItem('yorumi_notif_cache_v1');
        } catch {
            // Best effort
        }
        showNotice('Image & metadata cache cleared');
    };

    return (
        <MenuPageShell title="Data and storage">
            <div className="space-y-4 p-4">
                {notice && (
                    <div className="rounded-xl bg-yorumi-accent/15 px-3.5 py-2.5 text-xs font-semibold text-yorumi-accent">
                        {notice}
                    </div>
                )}

                {/* Discord Cloud Sync Card */}
                <div className="rounded-2xl border border-white/[0.08] bg-[#141414] p-4">
                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#5865F2]/20 text-[#818cf8]">
                            <DiscordBrandIcon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-white">Discord Cloud Sync</p>
                            <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                                Log in with Discord to automatically sync your library, watch & read progress, favorites, and categories between PC and Android, and vice-versa.
                            </p>
                        </div>
                    </div>

                    {discordSession ? (
                        <div className="mt-3.5 space-y-2.5 border-t border-white/[0.06] pt-3">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-zinc-400">Signed in as</span>
                                <span className="font-semibold text-white">{discordSession.user.username}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => void handleSyncNow()}
                                    disabled={syncingNow}
                                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-yorumi-accent py-2.5 text-xs font-semibold text-black active:opacity-85 disabled:opacity-60"
                                >
                                    <RefreshCw className={`h-3.5 w-3.5 ${syncingNow ? 'animate-spin' : ''}`} />
                                    {syncingNow ? 'Syncing…' : 'Sync now'}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDiscordSignOut}
                                    className="rounded-xl bg-white/10 px-3.5 py-2.5 text-xs font-semibold text-zinc-200 active:bg-white/15"
                                >
                                    Sign out
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => void handleDiscordSignIn()}
                            className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#5865F2] py-2.5 text-xs font-semibold text-white active:opacity-90"
                        >
                            <DiscordBrandIcon className="h-4 w-4" />
                            {signingInDiscord ? 'Waiting for Discord… (Tap to cancel)' : 'Log in with Discord'}
                        </button>
                    )}
                </div>

                <div className="rounded-2xl border border-white/[0.08] bg-[#141414] p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Storage overview</p>
                    <div className="mt-3 space-y-2.5 text-sm">
                        {storageEstimate && (
                            <div className="flex justify-between">
                                <span className="text-zinc-300">App storage used</span>
                                <span className="font-semibold text-white">{formatBytes(storageEstimate.usage)}</span>
                            </div>
                        )}
                        <div className="flex justify-between">
                            <span className="text-zinc-300">Downloaded anime</span>
                            <span className="font-semibold text-white">{animeDownloads.length} ep</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-zinc-300">Downloaded manga</span>
                            <span className="font-semibold text-white">{mangaDownloads.length} ch</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-zinc-300">Downloaded LN</span>
                            <span className="font-semibold text-white">{lnDownloads.length} ch</span>
                        </div>
                    </div>
                </div>

                <div className="space-y-2.5">
                    <button
                        type="button"
                        onClick={handleExportBackup}
                        className="flex w-full items-center gap-3.5 rounded-2xl bg-[#141414] px-4 py-4 text-left active:bg-white/10"
                    >
                        <Download className="h-5 w-5 text-zinc-300" />
                        <div>
                            <p className="text-sm font-semibold text-white">Create backup</p>
                            <p className="text-xs text-zinc-400">Export library & history as JSON</p>
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex w-full items-center gap-3.5 rounded-2xl bg-[#141414] px-4 py-4 text-left active:bg-white/10"
                    >
                        <Upload className="h-5 w-5 text-zinc-300" />
                        <div>
                            <p className="text-sm font-semibold text-white">Restore backup</p>
                            <p className="text-xs text-zinc-400">Import a Yorumi JSON backup</p>
                        </div>
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="application/json,.json"
                        className="hidden"
                        onChange={(e) => {
                            void handleImportBackup(e.target.files?.[0] || null);
                            e.target.value = '';
                        }}
                    />

                    <button
                        type="button"
                        onClick={() => void handleClearCache()}
                        className="flex w-full items-center gap-3.5 rounded-2xl bg-[#141414] px-4 py-4 text-left active:bg-white/10"
                    >
                        <Trash2 className="h-5 w-5 text-zinc-300" />
                        <div>
                            <p className="text-sm font-semibold text-white">Clear image & metadata cache</p>
                            <p className="text-xs text-zinc-400">Keeps your downloads and library</p>
                        </div>
                    </button>
                </div>
            </div>
        </MenuPageShell>
    );
}

/* ============================================================================
 * 5. Global Chat Dedicated Page
 * ========================================================================== */
export function GlobalChatPage() {
    const navigate = useNavigate();
    return <GlobalChatDrawer isOpen asPage onClose={() => navigate(-1)} />;
}

/* ============================================================================
 * 6. Settings Page
 * ========================================================================== */
export function SettingsPage() {
    const { language, setLanguage } = useTitleLanguage();
    const { downloadedOnly, setDownloadedOnly, incognitoMode, setIncognitoMode } = useAppPrefs();
    const { refresh: refreshUpdates } = useWatchlistNotifications();
    const [notice, setNotice] = useState<string | null>(null);

    return (
        <MenuPageShell title="Settings">
            <div className="space-y-4 p-4">
                {notice && (
                    <div className="rounded-xl bg-yorumi-accent/15 px-3.5 py-2.5 text-xs font-semibold text-yorumi-accent">
                        {notice}
                    </div>
                )}

                <div className="rounded-2xl border border-white/[0.08] bg-[#141414] p-4">
                    <p className="text-sm font-semibold text-white">Title language</p>
                    <p className="mt-0.5 text-xs text-zinc-400">
                        Choose how anime and manga titles are displayed
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => setLanguage('eng')}
                            className={`rounded-xl py-2.5 text-xs font-semibold transition-colors ${
                                language === 'eng' ? 'bg-yorumi-accent text-black' : 'bg-white/5 text-zinc-300'
                            }`}
                        >
                            English
                        </button>
                        <button
                            type="button"
                            onClick={() => setLanguage('jpy')}
                            className={`rounded-xl py-2.5 text-xs font-semibold transition-colors ${
                                language === 'jpy' ? 'bg-yorumi-accent text-black' : 'bg-white/5 text-zinc-300'
                            }`}
                        >
                            Romaji (JPY)
                        </button>
                    </div>
                </div>

                <div className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#141414]">
                    <button
                        type="button"
                        onClick={() => setDownloadedOnly(!downloadedOnly)}
                        className="flex w-full items-center justify-between px-4 py-3.5 text-left"
                    >
                        <div>
                            <p className="text-sm font-semibold text-white">Downloaded only</p>
                            <p className="text-xs text-zinc-400">Filters all entries in your library</p>
                        </div>
                        <SwitchPill checked={downloadedOnly} />
                    </button>
                    <button
                        type="button"
                        onClick={() => setIncognitoMode(!incognitoMode)}
                        className="flex w-full items-center justify-between px-4 py-3.5 text-left"
                    >
                        <div>
                            <p className="text-sm font-semibold text-white">Incognito mode</p>
                            <p className="text-xs text-zinc-400">Pauses watch, read & search history</p>
                        </div>
                        <SwitchPill checked={incognitoMode} />
                    </button>
                </div>

                <div className="rounded-2xl border border-white/[0.08] bg-[#141414] p-4">
                    <p className="text-sm font-semibold text-white">Episode update notifications</p>
                    <p className="mt-0.5 text-xs text-zinc-400">
                        New episodes from your watchlist are sent as Android push notifications.
                    </p>
                    <button
                        type="button"
                        onClick={() => {
                            refreshUpdates();
                            setNotice('Checking watchlist for new episodes…');
                            window.setTimeout(() => setNotice(null), 3000);
                        }}
                        className="mt-3 flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-2 text-xs font-semibold text-white active:bg-white/15"
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Check for new episodes now
                    </button>
                </div>
            </div>
        </MenuPageShell>
    );
}

/* ============================================================================
 * 7. About Page (from README.md)
 * ========================================================================== */
const ABOUT_FEATURES = [
    {
        title: 'HD Anime Streaming',
        detail: 'HLS playback, sub/dub switching, quality selection, auto-tracking, intro/outro skip, and 2× speed long-press.',
    },
    {
        title: 'Explore Trailer Feed',
        detail: 'Vertical anime trailer discovery with personalized recommendations and tap/hold gestures.',
    },
    {
        title: 'Manga & Light Novel Readers',
        detail: 'Vertical strip or paged manga reading alongside customizable light & web novel typography.',
    },
    {
        title: 'Offline Downloads',
        detail: 'Download anime episodes, manga chapters, and light novel chapters to enjoy without Wi-Fi.',
    },
    {
        title: 'Discord Cloud Sync & Global Chat',
        detail: 'Sync progress, library categories, favorites, and stats across Windows, macOS, Linux, and Android.',
    },
];

export function AboutPage() {
    const [updateStatus, setUpdateStatus] = useState<string | null>(null);
    const [checkingUpdate, setCheckingUpdate] = useState(false);

    const handleCheckUpdates = async () => {
        setCheckingUpdate(true);
        setUpdateStatus(null);
        try {
            const res = await fetch('https://api.github.com/repos/davenarchives/Yorumi/releases/latest');
            if (!res.ok) throw new Error('Unable to check');
            const data = await res.json() as { tag_name?: string };
            const latest = String(data.tag_name || '').replace(/^v/i, '').trim();
            if (!latest || latest === APP_VERSION) {
                setUpdateStatus(`You're up to date (v${APP_VERSION})`);
            } else {
                setUpdateStatus(`New version available: v${latest}`);
            }
        } catch {
            setUpdateStatus(`Current version: v${APP_VERSION}`);
        } finally {
            setCheckingUpdate(false);
        }
    };

    return (
        <MenuPageShell title="About">
            <div className="space-y-4 p-4">
                {/* Clean Open Hero Brand Section (no container, no kanji) */}
                <div className="flex flex-col items-center px-5 pt-4 pb-2 text-center">
                    <img
                        src="/yorumi-logo-mark.png"
                        alt="Yorumi"
                        className="mb-3 h-16 w-16 object-contain"
                    />
                    <p className="text-2xl font-bold tracking-tight text-white">Yorumi</p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-yorumi-accent">
                        Anime · Manga · Light Novels
                    </p>
                    <p className="mt-2.5 max-w-xs text-xs leading-relaxed text-zinc-400">
                        Your all-in-one cross-platform companion for Windows, macOS, Linux, and Android.
                    </p>
                    <span className="mt-3 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-zinc-200">
                        Version {APP_VERSION} · Free & Open Source
                    </span>
                </div>

                {/* Actions & Links (consistent left icons on every row) */}
                <div className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#141414]">
                    <button
                        type="button"
                        onClick={() => void handleCheckUpdates()}
                        disabled={checkingUpdate}
                        className="flex w-full items-center justify-between px-4 py-3.5 text-left active:bg-white/10 disabled:opacity-60"
                    >
                        <div className="flex items-center gap-3.5">
                            <RefreshCw className={`h-[18px] w-[18px] shrink-0 text-zinc-400 ${checkingUpdate ? 'animate-spin' : ''}`} />
                            <div>
                                <p className="text-sm font-semibold text-white">Check for updates</p>
                                <p className="mt-0.5 text-xs text-yorumi-accent">
                                    {updateStatus || `Installed: v${APP_VERSION}`}
                                </p>
                            </div>
                        </div>
                        <ExternalLink className="h-4 w-4 opacity-0" aria-hidden="true" />
                    </button>

                    <a
                        href="https://yorumi.cloud"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex w-full items-center justify-between px-4 py-3.5 text-left active:bg-white/10"
                    >
                        <div className="flex items-center gap-3.5">
                            <Globe className="h-[18px] w-[18px] shrink-0 text-zinc-400" />
                            <div>
                                <p className="text-sm font-semibold text-white">Website</p>
                                <p className="text-xs text-zinc-400">yorumi.cloud</p>
                            </div>
                        </div>
                        <ExternalLink className="h-4 w-4 shrink-0 text-zinc-500" />
                    </a>

                    <a
                        href="https://github.com/davenarchives/Yorumi"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex w-full items-center justify-between px-4 py-3.5 text-left active:bg-white/10"
                    >
                        <div className="flex items-center gap-3.5">
                            <Code2 className="h-[18px] w-[18px] shrink-0 text-zinc-400" />
                            <div>
                                <p className="text-sm font-semibold text-white">GitHub Repository</p>
                                <p className="text-xs text-zinc-400">davenarchives/Yorumi</p>
                            </div>
                        </div>
                        <ExternalLink className="h-4 w-4 shrink-0 text-zinc-500" />
                    </a>

                    <a
                        href="https://github.com/davenarchives/Yorumi/releases"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex w-full items-center justify-between px-4 py-3.5 text-left active:bg-white/10"
                    >
                        <div className="flex items-center gap-3.5">
                            <Tag className="h-[18px] w-[18px] shrink-0 text-zinc-400" />
                            <div>
                                <p className="text-sm font-semibold text-white">Releases & Changelog</p>
                                <p className="text-xs text-zinc-400">Latest desktop & Android builds</p>
                            </div>
                        </div>
                        <ExternalLink className="h-4 w-4 shrink-0 text-zinc-500" />
                    </a>

                    <a
                        href="https://discord.gg/3xzCQvfanb"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex w-full items-center justify-between px-4 py-3.5 text-left active:bg-white/10"
                    >
                        <div className="flex items-center gap-3.5">
                            <DiscordBrandIcon className="h-[18px] w-[18px] shrink-0 text-zinc-400" />
                            <div>
                                <p className="text-sm font-semibold text-white">Discord Community</p>
                                <p className="text-xs text-zinc-400">Support, updates & feedback</p>
                            </div>
                        </div>
                        <ExternalLink className="h-4 w-4 shrink-0 text-zinc-500" />
                    </a>
                </div>

                {/* Features from README */}
                <div className="rounded-2xl border border-white/[0.08] bg-[#141414] p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                        Highlights
                    </p>
                    <div className="space-y-3">
                        {ABOUT_FEATURES.map((feat) => (
                            <div key={feat.title}>
                                <p className="text-sm font-semibold text-white">{feat.title}</p>
                                <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">{feat.detail}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Disclaimer from README */}
                <div className="rounded-2xl border border-white/[0.08] bg-[#141414] p-4">
                    <div className="flex items-center gap-2 text-zinc-300">
                        <ShieldAlert className="h-4 w-4 text-amber-400" />
                        <p className="text-xs font-semibold uppercase tracking-wider">Disclaimer</p>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                        Yorumi does not host, store, or distribute any copyrighted media files. All content is fetched in real time from publicly available third-party sources. This project is free, open-source, and strictly for educational purposes.
                    </p>
                </div>
            </div>
        </MenuPageShell>
    );
}

function StatBox({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-2xl border border-white/[0.08] bg-[#141414] p-4">
            <p className="text-xs font-medium text-zinc-400">{label}</p>
            <p className="mt-1 text-xl font-bold text-white">{value}</p>
        </div>
    );
}

function SwitchPill({ checked }: { checked: boolean }) {
    return (
        <span
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ${
                checked ? 'border-yorumi-accent bg-yorumi-accent' : 'border-white/25 bg-[#262626]'
            }`}
        >
            <span
                className={`inline-block h-4 w-4 rounded-full transition-transform ${
                    checked ? 'translate-x-5 bg-black' : 'translate-x-1 bg-zinc-400'
                }`}
            />
        </span>
    );
}

function EmptyPageState({
    icon: Icon,
    title,
    subtitle,
}: {
    icon: React.ElementType;
    title: string;
    subtitle: string;
}) {
    return (
        <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
            <Icon className="mb-3 h-9 w-9 text-zinc-600" />
            <p className="text-sm font-semibold text-white">{title}</p>
            <p className="mt-1 text-xs text-zinc-400">{subtitle}</p>
        </div>
    );
}

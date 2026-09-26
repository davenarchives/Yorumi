import { useEffect, useMemo, useState } from 'react';
import { X, Tv, BookOpen, BookText, Play, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Carousel from '../components/ui/Carousel';
import ContinueWatching from '../features/anime/components/ContinueWatching';
import MangaContinueReading from '../features/manga/components/MangaContinueReading';
import LNContinueReading from '../features/ln/components/LNContinueReading';
import { useContinueReading } from '../hooks/useContinueReading';
import { useContinueWatching } from '../hooks/useContinueWatching';
import { useContinueLNReading } from '../hooks/useContinueLNReading';
import { useReadList } from '../hooks/useReadList';
import { useWatchList } from '../hooks/useWatchList';
import { useLNReadList } from '../hooks/useLNReadList';
import { useDownloads } from '../hooks/useDownloads';
import { useMangaDownloads } from '../hooks/useMangaDownloads';
import { useLNDownloads } from '../hooks/useLNDownloads';
import { formatFileSize } from '../services/downloadService';
import { slugify } from '../utils/slugify';
import type { WatchListItem } from '../utils/storage';

export type LibraryTab = 'anime' | 'manga' | 'ln';

type MobileLibraryItem = {
    id: string;
    title: string;
    image: string;
    count?: number;
    route: string;
    state?: Record<string, unknown>;
};

const STORAGE_KEY = 'yorumi_library_tab';

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
    if (scraperId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(scraperId.replace(/^s:/, ''))) {
        return `s:${scraperId.replace(/^s:/, '')}`;
    }
    return String(item.anilistId || item.id);
};

export default function LibraryPage() {
    const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine);
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
        try {
            localStorage.setItem(STORAGE_KEY, tab);
        } catch {
            // Ignore storage quota errors
        }
    };

    const { continueWatchingList, removeFromHistory: removeWatchingHistory } = useContinueWatching();
    const { continueReadingList, removeFromHistory: removeReadingHistory } = useContinueReading();
    const { continueReadingList: continueLNList, removeLNProgress } = useContinueLNReading();
    const { watchList, removeFromWatchList } = useWatchList();
    const { readList, removeFromReadList } = useReadList();
    const { readList: lnReadList, toggleLNReadList } = useLNReadList();
    const { downloads, deleteDownload } = useDownloads();
    const { downloads: mangaDownloads, deleteDownload: deleteMangaDownload } = useMangaDownloads();
    const { downloads: lnDownloads, deleteDownload: deleteLNDownload } = useLNDownloads();
    const navigate = useNavigate();

    useEffect(() => {
        const updateNetworkStatus = () => setIsOffline(!navigator.onLine);
        window.addEventListener('online', updateNetworkStatus);
        window.addEventListener('offline', updateNetworkStatus);
        return () => {
            window.removeEventListener('online', updateNetworkStatus);
            window.removeEventListener('offline', updateNetworkStatus);
        };
    }, []);

    const filteredWatching = useMemo(() => {
        if (isOffline) return [];
        const entries = new Map<string, (typeof continueWatchingList)[number]>();
        continueWatchingList.forEach((item) => {
            const key = normalizeLibraryTitle(item.animeTitle) || String(item.animeId);
            const current = entries.get(key);
            if (!current || (item.lastWatched || item.timestamp || 0) > (current.lastWatched || current.timestamp || 0)) {
                entries.set(key, item);
            }
        });
        return [...entries.values()].sort((a, b) => (b.lastWatched || b.timestamp || 0) - (a.lastWatched || a.timestamp || 0));
    }, [continueWatchingList, isOffline]);
    const filteredReading = useMemo(() => isOffline ? [] : continueReadingList, [continueReadingList, isOffline]);
    const filteredLN = useMemo(() => isOffline ? [] : continueLNList, [continueLNList, isOffline]);
    const filteredWatchList = useMemo(() => {
        if (isOffline) return [];
        const entries = new Map<string, (typeof watchList)[number]>();
        watchList.forEach((item) => {
            const key = normalizeLibraryTitle(item.title) || String(item.id);
            const current = entries.get(key);
            if (!current || item.addedAt > current.addedAt) entries.set(key, item);
        });
        return [...entries.values()].sort((a, b) => b.addedAt - a.addedAt);
    }, [isOffline, watchList]);
    const filteredReadList = useMemo(() => isOffline ? [] : readList, [isOffline, readList]);
    const filteredLNList = useMemo(() => isOffline ? [] : lnReadList, [isOffline, lnReadList]);

    const mobileLibraryItems = useMemo<MobileLibraryItem[]>(() => {
        const items = new Map<string, MobileLibraryItem>();
        if (activeTab === 'anime') {
            filteredWatchList.forEach((item) => {
                const progress = filteredWatching.find((entry) => String(entry.animeId) === String(item.id) || entry.animeTitle?.toLowerCase() === item.title.toLowerCase());
                const routeId = getAnimeRouteId(item);
                items.set(String(item.id), {
                    id: String(item.id), title: item.title, image: item.image,
                    count: item.totalCount || progress?.totalCount || progress?.episodeNumber,
                    route: `/anime/details/${encodeURIComponent(routeId)}`,
                    state: { anime: { id: Number(item.anilistId || item.id) || 0, mal_id: Number(item.malId || item.id) || 0, scraperId: item.scraperId, title: item.title, title_english: item.title, images: { jpg: { image_url: item.image, large_image_url: item.image } }, episodes: item.totalCount || progress?.totalCount || null, status: item.mediaStatus, type: item.type || 'TV', score: item.score || 0, synopsis: item.synopsis, genres: item.genres?.map((name) => ({ name, mal_id: 0 })) || [] } },
                });
            });
            filteredWatching.forEach((item) => {
                if ([...items.values()].some((entry) => entry.title.toLowerCase() === item.animeTitle.toLowerCase())) return;
                items.set(String(item.animeId), { id: String(item.animeId), title: item.animeTitle, image: item.animePoster || item.animeImage, count: item.totalCount || item.episodeNumber, route: `/anime/details/${encodeURIComponent(item.animeId)}`, state: { anime: { id: Number(item.animeId) || 0, mal_id: Number(item.animeId) || 0, title: item.animeTitle, title_english: item.animeTitle, images: { jpg: { image_url: item.animePoster || item.animeImage, large_image_url: item.animePoster || item.animeImage } }, episodes: item.totalCount || null, status: item.mediaStatus, type: 'TV', score: 0 } } });
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
                items.set(existing?.id || key, {
                    ...(existing || {}), id: existing?.id || key, title: first.animeTitle, image: existing?.image || first.animeImage,
                    count: isOffline ? group.length : existing?.count, route: existing?.route || `/anime/details/${encodeURIComponent(key)}`,
                    state: { ...(existing?.state || {}), fromDownloads: isOffline, animeTitle: first.animeTitle, downloadedEpisodes: group, anime: { ...(existingAnime || {}), id: existingAnime?.id || Number(key) || 0, mal_id: existingAnime?.mal_id || Number(key) || 0, title: first.animeTitle, title_english: first.animeTitle, images: { jpg: { image_url: existing?.image || first.animeImage, large_image_url: existing?.image || first.animeImage } } } },
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
        return [...items.values()];
    }, [activeTab, downloads, filteredLN, filteredLNList, filteredReadList, filteredReading, filteredWatchList, filteredWatching, isOffline, lnDownloads, mangaDownloads]);

    return (
        <div className="min-h-screen bg-[#0a0a0a] pt-0 pb-24 md:pt-12">
            <div className="w-full max-w-7xl mx-auto px-3 md:px-14 relative">
                {/* Header with Title, Horizontal Line, and Media Selector Toggle */}
                <div className="sticky top-0 z-30 -mx-3 mb-8 border-b border-white/5 bg-[#0a0a0a]/95 px-3 pb-3 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] backdrop-blur-xl md:static md:mx-0 md:border-b-0 md:bg-transparent md:px-0 md:pb-0 md:pt-0 md:backdrop-blur-none">
                    <div className="flex items-center gap-4 mb-2">
                        <h1 className="text-2xl font-bold uppercase tracking-wider text-white whitespace-nowrap">
                            MY LIBRARY
                        </h1>
                        <div className="flex-1 h-px bg-white/10" />
                        <div className="flex items-center bg-[#141414] border border-white/10 rounded-xl p-1 gap-1 shrink-0">
                            <button
                                type="button"
                                onClick={() => handleTabChange('anime')}
                                className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
                                    activeTab === 'anime'
                                        ? 'bg-yorumi-accent text-black shadow-md'
                                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                                title="Anime Library"
                            >
                                <Tv className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => handleTabChange('manga')}
                                className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
                                    activeTab === 'manga'
                                        ? 'bg-yorumi-manga text-white shadow-md'
                                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                                title="Manga Library"
                            >
                                <BookOpen className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => handleTabChange('ln')}
                                className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
                                    activeTab === 'ln'
                                        ? 'bg-emerald-500 text-black shadow-md'
                                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                                title="Light Novels Library"
                            >
                                <BookText className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                    <p className="text-xs text-gray-400">
                        {activeTab === 'anime' && 'Watch history, progress, and saved anime'}
                        {activeTab === 'manga' && 'Reading history and bookmarked manga'}
                        {activeTab === 'ln' && 'Reading progress and saved light novels'}
                    </p>
                </div>

                {/* Tab Contents */}
                <div className="grid grid-cols-2 gap-3 pb-12 md:hidden">
                    {mobileLibraryItems.map((item) => (
                        <button key={`${activeTab}-${item.id}`} type="button" onClick={() => navigate(item.route, { state: item.state })} className="min-w-0 text-left">
                            <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-white/5">
                                {item.image && <img src={item.image} alt={item.title} className="h-full w-full object-cover" loading="lazy" />}
                                <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black via-black/65 to-transparent" />
                                {item.count && item.count > 0 ? (
                                    <span className="absolute left-1.5 top-1.5 rounded bg-zinc-200/90 px-1.5 py-0.5 text-xs font-medium text-zinc-800">
                                        {item.count}
                                    </span>
                                ) : null}
                                <h2 className="absolute inset-x-0 bottom-0 line-clamp-2 px-2 pb-2 text-sm font-medium leading-5 text-white drop-shadow-lg">
                                    {item.title}
                                </h2>
                            </div>
                        </button>
                    ))}
                    {mobileLibraryItems.length === 0 && (
                        <p className="col-span-2 py-20 text-center text-sm text-white/45">Nothing saved here yet.</p>
                    )}
                </div>

                <div className="hidden pb-12 md:block">
                    {/* Anime Tab */}
                    {activeTab === 'anime' && (
                        <div className="space-y-8">
                            {filteredWatching.length === 0 && filteredWatchList.length === 0 && downloads.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-24 rounded-2xl border border-dashed border-white/10 text-gray-500 bg-white/5">
                                    <Tv className="w-10 h-10 text-gray-600 mb-3" />
                                    <p className="text-base font-semibold text-white/80">No anime in your library yet</p>
                                    <p className="text-xs text-gray-400 mt-1">Start watching anime, add shows to your watchlist, or download episodes to see them here.</p>
                                </div>
                            ) : (
                                <>
                                    <ContinueWatching
                                        title={`Continue Watching (${filteredWatching.length})`}
                                        gridColumns={4}
                                        items={filteredWatching}
                                        onRemove={(animeId) => {
                                            const selected = filteredWatching.find((item) => String(item.animeId) === String(animeId));
                                            const selectedTitle = selected ? normalizeLibraryTitle(selected.animeTitle) : '';
                                            const matches = selectedTitle
                                                ? continueWatchingList.filter((item) => normalizeLibraryTitle(item.animeTitle) === selectedTitle)
                                                : continueWatchingList.filter((item) => String(item.animeId) === String(animeId));
                                            matches.forEach((item) => void removeWatchingHistory(item.animeId));
                                        }}
                                        onWatchClick={(anime, episodeNumber, startSeconds) => {
                                            const routeId = anime.scraperId || anime.id || anime.mal_id;
                                            const resume = Number.isFinite(startSeconds) ? Math.max(0, Math.floor(startSeconds || 0)) : 0;
                                            navigate(`/anime/details/${routeId}?ep=${episodeNumber}${resume > 0 ? `&t=${resume}` : ''}`);
                                        }}
                                    />

                                    {filteredWatchList.length > 0 && (
                                        <Carousel title={`Watchlist (${filteredWatchList.length})`} variant="portrait" gridColumns={4}>
                                            {filteredWatchList.map((item) => (
                                                <div
                                                    key={item.id}
                                                    className="relative group h-full cursor-pointer"
                                                    onClick={() => {
                                                        const progress = filteredWatching.find(
                                                            (w) => String(w.animeId) === String(item.id) ||
                                                                (item.title && w.animeTitle?.toLowerCase() === item.title.toLowerCase())
                                                        );
                                                        if (progress) {
                                                            const routeId = progress.animeId || getAnimeRouteId(item);
                                                            const resume = Number.isFinite(progress.positionSeconds) ? Math.max(0, Math.floor(progress.positionSeconds || 0)) : 0;
                                                            navigate(`/anime/details/${routeId}?ep=${progress.episodeNumber}${resume > 0 ? `&t=${resume}` : ''}`);
                                                        } else {
                                                            const routeId = getAnimeRouteId(item);
                                                            navigate(`/anime/details/${routeId}`);
                                                        }
                                                    }}
                                                >
                                                    <div className="relative aspect-[3/4] rounded-xl overflow-hidden mb-3 shadow-lg border border-white/5 transition-colors cursor-pointer">
                                                        {item.image && <img src={item.image} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />}
                                                        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center" />
                                                        <button
                                                            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 backdrop-blur hover:bg-red-500/80 text-white/80 hover:text-white transition-all opacity-0 group-hover:opacity-100 z-10"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const titleKey = normalizeLibraryTitle(item.title);
                                                                watchList
                                                                    .filter((entry) => normalizeLibraryTitle(entry.title) === titleKey)
                                                                    .forEach((entry) => removeFromWatchList(entry.id));
                                                            }}
                                                            title="Remove from watchlist"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                    <div className="px-1">
                                                        <h4 className="text-sm font-bold text-white/90 truncate group-hover:text-yorumi-accent transition-colors">{item.title}</h4>
                                                    </div>
                                                </div>
                                            ))}
                                        </Carousel>
                                    )}

                                    {downloads.length > 0 && (
                                        <Carousel title={`Downloads (${downloads.length})`} variant="portrait" gridColumns={4}>
                                            {(() => {
                                                const map = new Map<string, { animeId: string; animeTitle: string; animeImage: string; items: typeof downloads; totalSize: number }>();
                                                downloads.forEach((item) => {
                                                    const key = normalizeLibraryTitle(item.animeTitle) || String(item.animeId || '').trim();
                                                    if (!map.has(key)) {
                                                        map.set(key, {
                                                            animeId: item.animeId,
                                                            animeTitle: item.animeTitle,
                                                            animeImage: item.animeImage,
                                                            items: [],
                                                            totalSize: 0,
                                                        });
                                                    }
                                                    const group = map.get(key)!;
                                                    group.items.push(item);
                                                    group.totalSize += item.fileSize || 0;
                                                });

                                                return Array.from(map.values()).map((group) => {
                                                    const totalSizeStr = formatFileSize(group.totalSize);
                                                    return (
                                                        <div
                                                            key={group.animeId}
                                                            className="relative group h-full cursor-pointer"
                                                            onClick={() => {
                                                                navigate(`/anime/details/${encodeURIComponent(group.animeId)}`, {
                                                                    state: {
                                                                        fromDownloads: true,
                                                                        animeTitle: group.animeTitle,
                                                                        downloadedEpisodes: group.items,
                                                                        anime: {
                                                                            id: Number(group.animeId) || 0,
                                                                            mal_id: Number(group.animeId) || 0,
                                                                            title: group.animeTitle,
                                                                            images: {
                                                                                jpg: {
                                                                                    image_url: group.animeImage,
                                                                                    large_image_url: group.animeImage,
                                                                                },
                                                                            },
                                                                        },
                                                                    },
                                                                });
                                                            }}
                                                        >
                                                            <div className="relative aspect-[3/4] rounded-xl overflow-hidden mb-3 shadow-lg border border-white/5 transition-colors cursor-pointer">
                                                                {group.animeImage && (
                                                                    <img
                                                                        src={group.animeImage}
                                                                        alt={group.animeTitle}
                                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                                    />
                                                                )}
                                                                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                                                    <div className="w-10 h-10 rounded-full bg-yorumi-accent/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg transform scale-90 group-hover:scale-100 duration-200">
                                                                        <Play className="w-4 h-4 text-black fill-black ml-0.5" />
                                                                    </div>
                                                                </div>
                                                                <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
                                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-500/90 text-black backdrop-blur">
                                                                        {group.items.length} {group.items.length === 1 ? 'EPISODE' : 'EPISODES'}
                                                                    </span>
                                                                    {totalSizeStr && (
                                                                        <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-black/70 text-white/90 backdrop-blur">
                                                                            {totalSizeStr}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <button
                                                                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 backdrop-blur hover:bg-red-500/80 text-white/80 hover:text-white transition-all opacity-0 group-hover:opacity-100 z-10"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        group.items.forEach((ep) => deleteDownload(ep.animeId, ep.episodeNumber));
                                                                    }}
                                                                    title="Delete all downloads for this anime"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                            <div className="px-1">
                                                                <h4 className="text-sm font-bold text-white/90 truncate group-hover:text-yorumi-accent transition-colors">
                                                                    {group.animeTitle}
                                                                </h4>
                                                                <p className="text-xs text-gray-400 font-medium truncate mt-0.5">
                                                                    {group.items.length} {group.items.length === 1 ? 'Episode' : 'Episodes'} • Offline
                                                                </p>
                                                            </div>
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </Carousel>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* Manga Tab */}
                    {activeTab === 'manga' && (
                        <div className="space-y-8">
                            {filteredReading.length === 0 && filteredReadList.length === 0 && mangaDownloads.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-24 rounded-2xl border border-dashed border-white/10 text-gray-500 bg-white/5">
                                    <BookOpen className="w-10 h-10 text-gray-600 mb-3" />
                                    <p className="text-base font-semibold text-white/80">No manga in your library yet</p>
                                    <p className="text-xs text-gray-400 mt-1">Start reading manga, bookmark titles, or download chapters to see them here.</p>
                                </div>
                            ) : (
                                <>
                                    <MangaContinueReading
                                        title={`Continue Reading (${filteredReading.length})`}
                                        gridColumns={6}
                                        items={filteredReading}
                                        onRemove={removeReadingHistory}
                                        onReadClick={(mangaId, mangaTitle, chapterNumber) => {
                                            const title = slugify(mangaTitle || 'manga');
                                            navigate(`/manga/read/${title}/${mangaId}/c${chapterNumber}`);
                                        }}
                                    />

                                    {filteredReadList.length > 0 && (
                                        <Carousel title={`Manga Readlist (${filteredReadList.length})`} variant="portrait" gridColumns={6}>
                                            {filteredReadList.map((item) => (
                                                <div
                                                    key={item.id}
                                                    className="relative group h-full cursor-pointer"
                                                    onClick={() => {
                                                        const mangaRouteId = String(item.scraperId || '').startsWith('vault') ? item.scraperId : item.id;
                                                        navigate(`/manga/details/${encodeURIComponent(String(mangaRouteId))}`, {
                                                            state: { manga: { id: item.id, mal_id: item.malId || item.id, scraper_id: item.scraperId, title: item.title, title_english: item.title, images: { jpg: { image_url: item.image, large_image_url: item.image } }, chapters: item.totalCount, status: item.mediaStatus, type: item.type || 'Manga', score: item.score || 0, synopsis: item.synopsis, genres: item.genres?.map((name) => ({ name, mal_id: 0 })) || [] } },
                                                        });
                                                    }}
                                                >
                                                    <div className="relative aspect-[3/4] rounded-xl overflow-hidden mb-3 shadow-lg border border-white/5 transition-colors cursor-pointer">
                                                        {item.image && <img src={item.image} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />}
                                                        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center" />
                                                        <button
                                                            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 backdrop-blur hover:bg-red-500/80 text-white/80 hover:text-white transition-all opacity-0 group-hover:opacity-100 z-10"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                removeFromReadList(item.id);
                                                            }}
                                                            title="Remove from readlist"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                    <div className="px-1">
                                                        <h4 className="text-sm font-bold text-white/90 truncate group-hover:text-yorumi-manga transition-colors">{item.title}</h4>
                                                    </div>
                                                </div>
                                            ))}
                                        </Carousel>
                                    )}

                                    {mangaDownloads.length > 0 && (
                                        <Carousel title={`Downloads (${mangaDownloads.length})`} variant="portrait" gridColumns={6}>
                                            {(() => {
                                                const map = new Map<string, { mangaId: string; mangaTitle: string; mangaImage: string; items: typeof mangaDownloads }>();
                                                mangaDownloads.forEach((item) => {
                                                    const key = String(item.mangaId || item.mangaTitle || '').trim();
                                                    if (!map.has(key)) {
                                                        map.set(key, {
                                                            mangaId: item.mangaId,
                                                            mangaTitle: item.mangaTitle,
                                                            mangaImage: item.mangaImage,
                                                            items: [],
                                                        });
                                                    }
                                                    const group = map.get(key)!;
                                                    group.items.push(item);
                                                });

                                                return Array.from(map.values()).map((group) => (
                                                    <div
                                                        key={group.mangaId}
                                                        className="relative group h-full cursor-pointer"
                                                        onClick={() => {
                                                            navigate(`/manga/details/${encodeURIComponent(group.mangaId)}`, {
                                                                state: {
                                                                    fromDownloads: true,
                                                                    mangaTitle: group.mangaTitle,
                                                                    downloadedChapters: group.items,
                                                                    manga: {
                                                                        id: group.mangaId,
                                                                        mal_id: group.mangaId,
                                                                        scraper_id: group.mangaId,
                                                                        title: group.mangaTitle,
                                                                        images: {
                                                                            jpg: {
                                                                                image_url: group.mangaImage,
                                                                                large_image_url: group.mangaImage,
                                                                            },
                                                                        },
                                                                    },
                                                                },
                                                            });
                                                        }}
                                                    >
                                                        <div className="relative aspect-[3/4] rounded-xl overflow-hidden mb-3 shadow-lg border border-white/5 transition-colors cursor-pointer">
                                                            {group.mangaImage && (
                                                                <img
                                                                    src={group.mangaImage}
                                                                    alt={group.mangaTitle}
                                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                                />
                                                            )}
                                                            <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                                                <div className="w-10 h-10 rounded-full bg-yorumi-manga/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg transform scale-90 group-hover:scale-100 duration-200">
                                                                    <BookOpen className="w-4 h-4 text-white ml-0.5" />
                                                                </div>
                                                            </div>
                                                            <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
                                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-yorumi-manga text-white backdrop-blur">
                                                                    {group.items.length} {group.items.length === 1 ? 'CHAPTER' : 'CHAPTERS'}
                                                                </span>
                                                            </div>
                                                            <button
                                                                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 backdrop-blur hover:bg-red-500/80 text-white/80 hover:text-white transition-all opacity-0 group-hover:opacity-100 z-10"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    group.items.forEach((ch) => deleteMangaDownload(group.mangaId, ch.chapterId));
                                                                }}
                                                                title="Delete all downloads for this manga"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                        <div className="px-1">
                                                            <h4 className="text-sm font-bold text-white/90 truncate group-hover:text-yorumi-manga transition-colors">
                                                                {group.mangaTitle}
                                                            </h4>
                                                            <p className="text-xs text-gray-400 font-medium truncate mt-0.5">
                                                                {group.items.length} {group.items.length === 1 ? 'Chapter' : 'Chapters'} • Offline
                                                            </p>
                                                        </div>
                                                    </div>
                                                ));
                                            })()}
                                        </Carousel>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* Light Novels Tab */}
                    {activeTab === 'ln' && (
                        <div className="space-y-8">
                            {filteredLN.length === 0 && filteredLNList.length === 0 && lnDownloads.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-24 rounded-2xl border border-dashed border-white/10 text-gray-500 bg-white/5">
                                    <BookText className="w-10 h-10 text-gray-600 mb-3" />
                                    <p className="text-base font-semibold text-white/80">No light novels in your library yet</p>
                                    <p className="text-xs text-gray-400 mt-1">Start reading light novels, bookmark them, or download chapters to see them here.</p>
                                </div>
                            ) : (
                                <>
                                    <LNContinueReading
                                        title={`Continue Reading Light Novels (${filteredLN.length})`}
                                        gridColumns={6}
                                        items={filteredLN}
                                        onRemove={removeLNProgress}
                                        onReadClick={(novelId, novelTitle, chapterId) => {
                                            const title = slugify(novelTitle || 'novel');
                                            navigate(`/ln/read/${title}/${novelId}/${encodeURIComponent(chapterId)}`);
                                        }}
                                    />

                                    {filteredLNList.length > 0 && (
                                        <Carousel title={`Novellist (${filteredLNList.length})`} variant="portrait" gridColumns={6}>
                                            {filteredLNList.map((item) => (
                                                <div
                                                    key={item.id}
                                                    className="relative group h-full cursor-pointer"
                                                    onClick={() => {
                                                        navigate(`/ln/details/${encodeURIComponent(String(item.id))}`, {
                                                            state: { ln: { id: item.id, mal_id: item.id, title: item.title, title_english: item.title, images: { jpg: { image_url: item.image, large_image_url: item.image } }, chapters: item.totalCount, status: item.mediaStatus, type: item.type || 'NOVEL', score: item.score || 0, synopsis: item.synopsis, genres: item.genres?.map((name) => ({ name, mal_id: 0 })) || [] } },
                                                        });
                                                    }}
                                                >
                                                    <div className="relative aspect-[3/4] rounded-xl overflow-hidden mb-3 shadow-lg border border-white/5 transition-colors cursor-pointer">
                                                        {item.image && <img src={item.image} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />}
                                                        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center" />
                                                        <button
                                                            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 backdrop-blur hover:bg-red-500/80 text-white/80 hover:text-white transition-all opacity-0 group-hover:opacity-100 z-10"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleLNReadList(item);
                                                            }}
                                                            title="Remove from novellist"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                    <div className="px-1">
                                                        <h4 className="text-sm font-bold text-white/90 truncate group-hover:text-amber-400 transition-colors">{item.title}</h4>
                                                    </div>
                                                </div>
                                            ))}
                                        </Carousel>
                                    )}

                                    {lnDownloads.length > 0 && (
                                        <Carousel title={`Downloads (${lnDownloads.length})`} variant="portrait" gridColumns={6}>
                                            {(() => {
                                                const map = new Map<string, { novelId: string; novelTitle: string; novelImage: string; items: typeof lnDownloads }>();
                                                lnDownloads.forEach((item) => {
                                                    const key = String(item.novelId || item.novelTitle || '').trim();
                                                    if (!map.has(key)) {
                                                        map.set(key, {
                                                            novelId: item.novelId,
                                                            novelTitle: item.novelTitle,
                                                            novelImage: item.novelImage,
                                                            items: [],
                                                        });
                                                    }
                                                    const group = map.get(key)!;
                                                    group.items.push(item);
                                                });

                                                return Array.from(map.values()).map((group) => (
                                                    <div
                                                        key={group.novelId}
                                                        className="relative group h-full cursor-pointer"
                                                        onClick={() => {
                                                            navigate(`/ln/details/${encodeURIComponent(group.novelId)}`, {
                                                                state: {
                                                                    fromDownloads: true,
                                                                    novelTitle: group.novelTitle,
                                                                    downloadedChapters: group.items,
                                                                    ln: {
                                                                        id: group.novelId,
                                                                        mal_id: group.novelId,
                                                                        scraper_id: group.novelId,
                                                                        title: group.novelTitle,
                                                                        images: {
                                                                            jpg: {
                                                                                image_url: group.novelImage,
                                                                                large_image_url: group.novelImage,
                                                                            },
                                                                        },
                                                                    },
                                                                },
                                                            });
                                                        }}
                                                    >
                                                        <div className="relative aspect-[3/4] rounded-xl overflow-hidden mb-3 shadow-lg border border-white/5 transition-colors cursor-pointer">
                                                            {group.novelImage && (
                                                                <img
                                                                    src={group.novelImage}
                                                                    alt={group.novelTitle}
                                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                                />
                                                            )}
                                                            <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                                                <div className="w-10 h-10 rounded-full bg-amber-400/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg transform scale-90 group-hover:scale-100 duration-200">
                                                                    <BookText className="w-4 h-4 text-black ml-0.5" />
                                                                </div>
                                                            </div>
                                                            <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
                                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-400 text-black backdrop-blur">
                                                                    {group.items.length} {group.items.length === 1 ? 'CHAPTER' : 'CHAPTERS'}
                                                                </span>
                                                            </div>
                                                            <button
                                                                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 backdrop-blur hover:bg-red-500/80 text-white/80 hover:text-white transition-all opacity-0 group-hover:opacity-100 z-10"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    group.items.forEach((ch) => deleteLNDownload(group.novelId, ch.chapterId));
                                                                }}
                                                                title="Delete all downloads for this novel"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                        <div className="px-1">
                                                            <h4 className="text-sm font-bold text-white/90 truncate group-hover:text-amber-400 transition-colors">
                                                                {group.novelTitle}
                                                            </h4>
                                                            <p className="text-xs text-gray-400 font-medium truncate mt-0.5">
                                                                {group.items.length} {group.items.length === 1 ? 'Chapter' : 'Chapters'} • Offline
                                                            </p>
                                                        </div>
                                                    </div>
                                                ));
                                            })()}
                                        </Carousel>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

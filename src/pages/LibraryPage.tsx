import { useState } from 'react';
import { X, Tv, BookOpen, BookText, Play, Trash2, Download } from 'lucide-react';
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
import { formatFileSize } from '../services/downloadService';
import { slugify } from '../utils/slugify';
import type { WatchListItem } from '../utils/storage';

export type LibraryTab = 'anime' | 'manga' | 'ln';

const STORAGE_KEY = 'yorumi_library_tab';

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
    const navigate = useNavigate();

    const filteredWatching = continueWatchingList;
    const filteredReading = continueReadingList;
    const filteredLN = continueLNList;
    const filteredWatchList = watchList;
    const filteredReadList = readList;
    const filteredLNList = lnReadList;

    return (
        <div className="min-h-screen bg-[#0a0a0a] pt-12 pb-24">
            <div className="w-full max-w-7xl mx-auto px-8 md:px-14 relative">
                {/* Header with Title, Horizontal Line, and Media Selector Toggle */}
                <div className="mb-8">
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
                <div className="pb-12">
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
                                        items={filteredWatching}
                                        onRemove={removeWatchingHistory}
                                        onWatchClick={(anime, episodeNumber, startSeconds) => {
                                            const title = slugify(anime.title || 'anime');
                                            const routeId = anime.scraperId || anime.id || anime.mal_id;
                                            const resume = Number.isFinite(startSeconds) ? Math.max(0, Math.floor(startSeconds || 0)) : 0;
                                            navigate(`/anime/details/${routeId}?ep=${episodeNumber}${resume > 0 ? `&t=${resume}` : ''}`);
                                        }}
                                    />

                                    {filteredWatchList.length > 0 && (
                                        <Carousel title={`Watchlist (${filteredWatchList.length})`} variant="portrait">
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
                                                            const title = slugify(progress.animeTitle || item.title || 'anime');
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
                                                                removeFromWatchList(item.id);
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
                                        <Carousel title={`Downloads (${downloads.length})`} variant="portrait">
                                            {(() => {
                                                const map = new Map<string, { animeId: string; animeTitle: string; animeImage: string; items: typeof downloads; totalSize: number }>();
                                                downloads.forEach((item) => {
                                                    const key = String(item.animeId || item.animeTitle || '').trim();
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
                            {filteredReading.length === 0 && filteredReadList.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-24 rounded-2xl border border-dashed border-white/10 text-gray-500 bg-white/5">
                                    <BookOpen className="w-10 h-10 text-gray-600 mb-3" />
                                    <p className="text-base font-semibold text-white/80">No manga in your library yet</p>
                                    <p className="text-xs text-gray-400 mt-1">Start reading manga or bookmark titles to see them here.</p>
                                </div>
                            ) : (
                                <>
                                    <MangaContinueReading
                                        title={`Continue Reading (${filteredReading.length})`}
                                        items={filteredReading}
                                        onRemove={removeReadingHistory}
                                        onReadClick={(mangaId, mangaTitle, chapterNumber) => {
                                            const title = slugify(mangaTitle || 'manga');
                                            navigate(`/manga/read/${title}/${mangaId}/c${chapterNumber}`);
                                        }}
                                    />

                                    {filteredReadList.length > 0 && (
                                        <Carousel title={`Manga Readlist (${filteredReadList.length})`} variant="portrait">
                                            {filteredReadList.map((item) => (
                                                <div
                                                    key={item.id}
                                                    className="relative group h-full cursor-pointer"
                                                    onClick={() => {
                                                        const progress = filteredReading.find(
                                                            (p) => String(p.mangaId) === String(item.id) ||
                                                                (item.title && p.mangaTitle?.toLowerCase() === item.title.toLowerCase())
                                                        );
                                                        if (progress) {
                                                            const title = slugify(progress.mangaTitle || item.title || 'manga');
                                                            navigate(`/manga/read/${title}/${progress.mangaId}/c${progress.chapterNumber}`);
                                                        } else {
                                                            const mangaRouteId = String(item.scraperId || '').startsWith('vault') ? item.scraperId : item.id;
                                                            navigate(`/manga/details/${mangaRouteId}`);
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
                                </>
                            )}
                        </div>
                    )}

                    {/* Light Novels Tab */}
                    {activeTab === 'ln' && (
                        <div className="space-y-8">
                            {filteredLN.length === 0 && filteredLNList.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-24 rounded-2xl border border-dashed border-white/10 text-gray-500 bg-white/5">
                                    <BookText className="w-10 h-10 text-gray-600 mb-3" />
                                    <p className="text-base font-semibold text-white/80">No light novels in your library yet</p>
                                    <p className="text-xs text-gray-400 mt-1">Start reading light novels or bookmark them to see them here.</p>
                                </div>
                            ) : (
                                <>
                                    <LNContinueReading
                                        title={`Continue Reading Light Novels (${filteredLN.length})`}
                                        items={filteredLN}
                                        onRemove={removeLNProgress}
                                        onReadClick={(novelId, novelTitle, chapterId) => {
                                            const title = slugify(novelTitle || 'novel');
                                            navigate(`/ln/read/${title}/${novelId}/${encodeURIComponent(chapterId)}`);
                                        }}
                                    />

                                    {filteredLNList.length > 0 && (
                                        <Carousel title={`Novellist (${filteredLNList.length})`} variant="portrait">
                                            {filteredLNList.map((item) => (
                                                <div
                                                    key={item.id}
                                                    className="relative group h-full cursor-pointer"
                                                    onClick={() => {
                                                        const progress = filteredLN.find(
                                                            (p) => String(p.novelId) === String(item.id) ||
                                                                (item.title && p.novelTitle?.toLowerCase() === item.title.toLowerCase())
                                                        );
                                                        if (progress) {
                                                            const title = slugify(progress.novelTitle || item.title || 'novel');
                                                            navigate(`/ln/read/${title}/${progress.novelId}/${encodeURIComponent(progress.chapterId)}`);
                                                        } else {
                                                            navigate(`/ln/details/${item.id}`);
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
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

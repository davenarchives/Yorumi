import { supportsReadingExports } from '../platform/tauri/readingExports';
import { getPrimaryMangaAuthor } from '../utils/mangaAuthor';
import { useCallback, useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Play, Download, FolderOpen, ArrowLeft, ArrowUpDown, Grid2X2, List } from 'lucide-react';
import { useManga } from '../hooks/useManga';
import { useReadList } from '../hooks/useReadList';
import { useFavoriteManga } from '../hooks/useFavoriteManga';
import { useContinueReading } from '../hooks/useContinueReading';
import { useMangaDownloads } from '../hooks/useMangaDownloads';
import { downloadService } from '../services/downloadService';
import { slugify } from '../utils/slugify';
import type { Manga, MangaChapter } from '../types/manga';
import type { Anime } from '../types/anime';
import DetailsCharacters from '../features/anime/components/details/DetailsCharacters';
import { useTitleLanguage } from '../context/TitleLanguageContext';
import { getDisplayTitle } from '../utils/titleLanguage';
import type { ReadListItem } from '../utils/storage';
import { useChapterViewMode, type ChapterViewMode } from '../components/ui/ChapterViewToggle';
import DownloadActionButton from '../components/ui/DownloadActionButton';
import ReadingDetailsHero from '../features/reading/components/ReadingDetailsHero';
import MoreLikeReading from '../features/reading/components/MoreLikeReading';
import { offlineLibraryCache } from '../services/offlineLibraryCache';
import BatchDownloadMenu, { selectItemsForBatchDownload, type BatchDownloadMode } from '../components/shared/BatchDownloadMenu';

const normalizeMangaRouteId = (value: unknown) =>
    String(value || '')
        .trim()
        .replace(/^mk:/i, '');

type MangaChapterWithCredits = MangaChapter & {
    scanlator?: string;
};

// Chapter Grid for Details Page
const ChapterList = ({
    chapters,
    readChapters,
    onChapterClick,
    viewMode = 'list',
    onViewModeChange,
    manga,
    headerActions,
}: {
    chapters: MangaChapter[],
    readChapters: Set<string>,
    onChapterClick: (ch: MangaChapter) => void,
    viewMode?: ChapterViewMode,
    onViewModeChange?: (mode: ChapterViewMode) => void,
    manga?: Manga | null,
    headerActions?: React.ReactNode,
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
    const { isChapterDownloaded, getDownloadProgress, startDownload, cancelDownload, deleteDownload } = useMangaDownloads();

    const mangaId = manga?.id || manga?.mal_id || '';
    const mangaTitle = manga?.title || 'Manga';
    const mangaImage = manga?.images?.jpg?.large_image_url || manga?.images?.jpg?.image_url || '';

    // Filter by search query
    const filteredChapters = chapters.filter(ch => 
        ch.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Sort chapters
    // Assuming original chapters are newest-first (desc)
    const sortedChapters = [...filteredChapters];
    if (sortOrder === 'asc') {
        sortedChapters.reverse();
    }

    const currentChapters = sortedChapters;

    useEffect(() => {
        const toggleSort = () => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
        const toggleView = () => onViewModeChange?.(viewMode === 'list' ? 'grid' : 'list');
        window.addEventListener('yorumi:manga:toggle-sort', toggleSort);
        window.addEventListener('yorumi:manga:toggle-view', toggleView);
        return () => {
            window.removeEventListener('yorumi:manga:toggle-sort', toggleSort);
            window.removeEventListener('yorumi:manga:toggle-view', toggleView);
        };
    }, [onViewModeChange, viewMode]);

    return (
        <div className="mt-4 sm:mt-6 bg-transparent p-0">
            <div className="mb-4 flex items-center gap-4 md:hidden">
                <h3 className="whitespace-nowrap text-[22px] font-semibold text-white">
                    Chapters <span className="text-sm font-bold text-gray-500">({chapters.length})</span>
                </h3>
                <div className="h-px flex-1 bg-white/10" />
            </div>
            {/* Uniform Toolbar matching DetailsEpisodeGrid */}
            <div className="hidden md:flex flex-wrap items-center justify-between gap-3 mb-6">
                <div className="flex flex-wrap items-center gap-2.5">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search chapters"
                        className="h-10 min-w-0 w-60 md:w-64 rounded-full bg-white/[0.10] px-4 text-[14px] font-semibold text-white placeholder-white/50 transition-colors focus:bg-white/[0.15] border-0 outline-none focus:outline-none"
                    />
                    <button
                        type="button"
                        onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                        className="flex h-10 items-center gap-1.5 rounded-full bg-white/[0.10] px-4 text-[14px] font-bold text-white transition-colors hover:bg-white/[0.15] border-0 outline-none focus:outline-none cursor-pointer"
                        title={sortOrder === 'desc' ? 'Sorted newest first' : 'Sorted oldest first'}
                    >
                        <ArrowUpDown className="h-3.5 w-3.5 text-white/80" />
                        <span>{sortOrder === 'desc' ? 'Newest' : 'Oldest'}</span>
                    </button>
                    {onViewModeChange && (
                        <button
                            type="button"
                            onClick={() => onViewModeChange(viewMode === 'list' ? 'grid' : 'list')}
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.10] text-white/80 transition-colors hover:bg-white/[0.15] hover:text-white border-0 outline-none focus:outline-none cursor-pointer"
                            title={viewMode === 'list' ? 'Switch to grid view' : 'Switch to list view'}
                            aria-label={viewMode === 'list' ? 'Switch to grid view' : 'Switch to list view'}
                        >
                            {viewMode === 'list' ? <Grid2X2 className="h-4 w-4" /> : <List className="h-4 w-4" />}
                        </button>
                    )}
                    {headerActions}
                </div>
                <span className="text-[13.5px] font-bold text-white/75">
                    {chapters.filter((ch) => readChapters.has(ch.id)).length}/{chapters.length} read
                </span>
            </div>

            {viewMode === 'grid' ? (
                <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
                    {currentChapters.map((ch, index) => {
                        const isRead = readChapters.has(ch.id);
                        const isDownloaded = isChapterDownloaded(mangaId, ch.id);
                        const progress = getDownloadProgress(mangaId, ch.id);
                        const isDownloading = progress?.status === 'downloading';
                        
                        const titleMatch = ch.title.match(/^(Arc\s+\d+[\s–—,-]*(?:Chapter\s*)?[\d.]+|Vol(?:ume)?\s*[\d.]+\s*(?:Chapter\s*)?[\d.]+|Chapter\s+[\d.]+|Ch\.\s*[\d.]+)(?:\s*[:–—,-]\s*["'«]?(.*?)["'»]?)?$/i);
                        const mainStr = titleMatch ? titleMatch[1].trim() : ch.title.split(/[:–—]/)[0].trim();
                        const subMatch = titleMatch ? titleMatch[2] : (ch.title.includes(':') || ch.title.includes('–') ? ch.title.split(/[:–—]/).slice(1).join(' ').trim() : '');
                        const subtitleStr = subMatch ? subMatch.replace(/^["'«]|["'»]$/g, '').trim() : '';

                        return (
                            <div
                                key={`${ch.id}-${index}`}
                                role="button"
                                tabIndex={0}
                                onClick={() => onChapterClick(ch)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        onChapterClick(ch);
                                    }
                                }}
                                title={ch.title}
                                data-label={mainStr}
                                className={`relative aspect-square flex items-center justify-center rounded-[14px] transition-all duration-200 text-center group
                                    ${isRead ? 'opacity-50 bg-white/[0.04]' : 'bg-white/[0.06] hover:bg-white/[0.09]'} active:scale-95 cursor-pointer`}
                            >
                                <span className={`font-semibold text-sm leading-tight ${isRead ? 'text-gray-400' : 'text-gray-100 group-hover:text-yorumi-manga'} transition-colors line-clamp-2`}>
                                    {ch.title.match(/(?:chapter|ch\.?)\s*([\d.]+)/i)?.[1] || ch.title.match(/[\d.]+/)?.[0] || String(index + 1)}
                                </span>
                                {subtitleStr && (
                                    <span className="hidden">
                                        {subtitleStr}
                                    </span>
                                )}
                                <div className="absolute top-0.5 right-0.5 z-20">
                                    <DownloadActionButton
                                        state={isDownloading ? 'downloading' : isDownloaded ? 'downloaded' : 'available'}
                                        progress={progress?.progress || 0}
                                        disabled={isDownloading}
                                        onDownload={() => startDownload({ mangaId, mangaTitle, mangaImage, chapter: ch })}
                                        onCancel={() => cancelDownload(mangaId, ch.id)}
                                        onDelete={() => deleteDownload(mangaId, ch.id)}
                                        buttonClassName="flex h-8 w-8 items-center justify-center rounded-full text-zinc-300 hover:bg-white/10 active:bg-white/15 cursor-pointer touch-manipulation"
                                        iconClassName="h-5 w-5"
                                        ariaLabel={isDownloaded ? 'Delete downloaded chapter' : 'Download chapter'}
                                    />
                                </div>
                            </div>
                        );
                    })}
                    {currentChapters.length === 0 && (
                        <div className="col-span-full text-center py-8 text-gray-500">
                            No chapters found matching "{searchQuery}"
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex flex-col divide-y divide-white/[0.05]">
                    {currentChapters.map((ch, index) => {
                        const isRead = readChapters.has(ch.id);
                        const isDownloaded = isChapterDownloaded(mangaId, ch.id);
                        const progress = getDownloadProgress(mangaId, ch.id);
                        const isDownloading = progress?.status === 'downloading';
                        
                        const titleMatch = ch.title.match(/^(Arc\s+\d+[\s–—,-]*(?:Chapter\s*)?[\d.]+|Vol(?:ume)?\s*[\d.]+\s*(?:Chapter\s*)?[\d.]+|Chapter\s+[\d.]+|Ch\.\s*[\d.]+)(?:\s*[:–—,-]\s*["'«]?(.*?)["'»]?)?$/i);
                        const mainStr = titleMatch ? titleMatch[1].trim() : ch.title.split(/[:–—]/)[0].trim();
                        const subMatch = titleMatch ? titleMatch[2] : (ch.title.includes(':') || ch.title.includes('–') ? ch.title.split(/[:–—]/).slice(1).join(' ').trim() : '');
                        const subtitleStr = subMatch ? subMatch.replace(/^["'«]|["'»]$/g, '').trim() : '';

                        return (
                            <div
                                key={`${ch.id}-${index}`}
                                onClick={() => onChapterClick(ch)}
                                className={`flex items-center justify-between gap-2.5 py-2.5 px-0 sm:px-3 transition-all duration-150 text-left group
                                    ${isRead ? 'opacity-50' : ''} hover:bg-white/[0.03] active:bg-white/[0.06] rounded-xl cursor-pointer`}
                            >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isRead ? 'bg-zinc-600' : 'bg-yorumi-manga shadow-[0_0_8px_rgba(229,57,69,0.5)]'}`} />
                                    <div className="flex flex-col min-w-0">
                                        <span className={`font-medium text-[14px] sm:text-[15px] leading-snug ${isRead ? 'text-zinc-400' : 'text-zinc-100 group-hover:text-yorumi-manga'} transition-colors line-clamp-1`}>
                                            {mainStr}{subtitleStr ? ` : ${subtitleStr}` : ''}
                                        </span>
                                        <div className="flex items-center gap-1.5 text-xs text-zinc-400/80 font-normal mt-0.5">
                                            <span>{ch.uploadDate || 'Recent'}</span>
                                            {(manga?.author || (ch as MangaChapterWithCredits).scanlator) && (
                                                <>
                                                    <span>•</span>
                                                    <span className="truncate max-w-[140px] sm:max-w-[220px]">
                                                        {(ch as MangaChapterWithCredits).scanlator || manga?.author}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                    <DownloadActionButton
                                        state={isDownloading ? 'downloading' : isDownloaded ? 'downloaded' : 'available'}
                                        progress={progress?.progress || 0}
                                        disabled={isDownloading}
                                        onDownload={() => startDownload({ mangaId, mangaTitle, mangaImage, chapter: ch })}
                                        onCancel={() => cancelDownload(mangaId, ch.id)}
                                        onDelete={() => deleteDownload(mangaId, ch.id)}
                                        buttonClassName={`grid h-10 w-10 place-items-center rounded-full transition-colors cursor-pointer touch-manipulation ${
                                            isDownloaded
                                                ? 'text-white hover:bg-white/10'
                                                : isDownloading
                                                ? 'text-white'
                                                : 'text-zinc-300 hover:text-white hover:bg-white/10'
                                        }`}
                                        iconClassName="h-6 w-6"
                                        title={
                                            isDownloaded
                                                ? 'Downloaded for offline (Click to delete)'
                                                : isDownloading
                                                ? `Downloading ${progress?.progress || 0}%`
                                                : 'Download chapter'
                                        }
                                    />
                                </div>
                            </div>
                        );
                    })}
                    {currentChapters.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                            No chapters found matching "{searchQuery}"
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default function MangaDetailsPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const routeManga = (location.state as { manga?: Manga } | null)?.manga ?? null;
    const [viewMode, setViewMode] = useChapterViewMode();
    const [activeSectionTab, setActiveSectionTab] = useState<'chapters' | 'related'>('chapters');
    useEffect(() => {
        setActiveSectionTab('chapters');
    }, [id]);
    const [compactFab, setCompactFab] = useState(false);
    const [mobileDownloadMenuOpen, setMobileDownloadMenuOpen] = useState(false);

    const {
        selectedManga,
        mangaChapters,
        mangaChaptersLoading,
        fetchMangaDetails,
        loadMangaChapter,
        readChapters
    } = useManga();

    const { isInReadList, addToReadList, removeFromReadList } = useReadList();
    const { isFavorite: isFavoriteManga, addFavorite: addFavoriteManga, removeFavorite: removeFavoriteManga } = useFavoriteManga();
    const { continueReadingList } = useContinueReading();
    const { language } = useTitleLanguage();
    const { downloads: mangaDownloads, downloadAll: downloadAllManga } = useMangaDownloads();

    const isDesktopApp = supportsReadingExports();

    const handleOpenFolder = useCallback(() => {
        downloadService.openDownloadsFolder('Manga');
    }, []);

    const currentRouteId = normalizeMangaRouteId(id);
    const selectedMatchesCurrentRoute = Boolean(selectedManga) && [
        selectedManga?.scraper_id,
        selectedManga?.id,
        selectedManga?.mal_id
    ].some((candidate) => normalizeMangaRouteId(candidate) === currentRouteId);
    const routeMatchesCurrentRoute = Boolean(routeManga) && [
        routeManga?.scraper_id,
        routeManga?.id,
        routeManga?.mal_id
    ].some((candidate) => normalizeMangaRouteId(candidate) === currentRouteId);

    const rawDisplayManga = selectedMatchesCurrentRoute
        ? selectedManga
        : routeMatchesCurrentRoute
            ? routeManga
            : selectedManga || routeManga;

    const cachedOfflineManga = useMemo(
        () => offlineLibraryCache.getMangaMeta([id, rawDisplayManga?.id, rawDisplayManga?.mal_id, rawDisplayManga?.scraper_id]),
        [id, rawDisplayManga?.id, rawDisplayManga?.mal_id, rawDisplayManga?.scraper_id]
    );

    const displayManga = useMemo<Manga | null>(() => {
        if (!rawDisplayManga && !cachedOfflineManga) return null;
        if (!rawDisplayManga) return cachedOfflineManga;
        if (!cachedOfflineManga) return rawDisplayManga;
        return {
            ...cachedOfflineManga,
            ...rawDisplayManga,
            synopsis: rawDisplayManga.synopsis || cachedOfflineManga.synopsis,
            genres: rawDisplayManga.genres?.length ? rawDisplayManga.genres : cachedOfflineManga.genres,
            authors: rawDisplayManga.authors?.length ? rawDisplayManga.authors : cachedOfflineManga.authors,
            score: rawDisplayManga.score || cachedOfflineManga.score,
            chapters: rawDisplayManga.chapters || cachedOfflineManga.chapters,
            bannerImage: rawDisplayManga.bannerImage || cachedOfflineManga.bannerImage,
            images:
                rawDisplayManga.images?.jpg?.large_image_url || rawDisplayManga.images?.jpg?.image_url
                    ? rawDisplayManga.images
                    : cachedOfflineManga.images,
        };
    }, [rawDisplayManga, cachedOfflineManga]);

    useEffect(() => {
        if (displayManga && (displayManga.synopsis || displayManga.genres?.length || displayManga.authors?.length || displayManga.score)) {
            offlineLibraryCache.saveMangaMeta(
                [id, displayManga.id, displayManga.mal_id, displayManga.scraper_id],
                displayManga
            );
        }
    }, [displayManga, id]);

    const matchingMangaDownloads = useMemo(() => {
        if (!id && !displayManga) return [];
        const targetId = normalizeMangaRouteId(id);
        const targetTitle = (displayManga?.title || '').toLowerCase().trim();
        return mangaDownloads.filter((d) => {
            if (normalizeMangaRouteId(d.mangaId) === targetId) return true;
            if (targetTitle && d.mangaTitle.toLowerCase().trim() === targetTitle) return true;
            return false;
        });
    }, [mangaDownloads, id, displayManga]);

    const downloadedChapters: MangaChapter[] = useMemo(() => {
        return matchingMangaDownloads.map((d) => ({
            id: d.chapterId,
            title: d.chapterTitle,
            url: d.chapterUrl || d.id,
            uploadDate: 'Offline',
        }));
    }, [matchingMangaDownloads]);

    const cachedOfflineChapters = useMemo(
        () => offlineLibraryCache.getMangaChapters([id, displayManga?.id, displayManga?.mal_id, displayManga?.scraper_id]),
        [id, displayManga?.id, displayManga?.mal_id, displayManga?.scraper_id]
    );

    useEffect(() => {
        if (mangaChapters.length > 0) {
            offlineLibraryCache.saveMangaChapters(
                [id, displayManga?.id, displayManga?.mal_id, displayManga?.scraper_id],
                mangaChapters
            );
        }
    }, [mangaChapters, id, displayManga?.id, displayManga?.mal_id, displayManga?.scraper_id]);

    const effectiveChapters = mangaChapters.length > 0
        ? mangaChapters
        : cachedOfflineChapters.length > 0
            ? cachedOfflineChapters
            : downloadedChapters;

    useEffect(() => {
        if (displayManga?.title) {
            document.title = `${displayManga.title} • Yorumi`;
        }
        return () => {
            document.title = 'Yorumi';
        };
    }, [displayManga?.title]);

    const handleDownloadMangaByMode = useCallback((mode: BatchDownloadMode) => {
        const mangaId = displayManga?.id || displayManga?.mal_id || id || '';
        if (!mangaId) return;
        const downloadedIds = new Set(matchingMangaDownloads.map((d) => d.chapterId));
        // Effective chapters are newest-first; reverse to ascending order so "Next X chapters" grabs the next unread ones
        const ascending = [...effectiveChapters].reverse();
        const unreadUndownloaded = ascending.filter((ch) => !readChapters.has(ch.id) && !downloadedIds.has(ch.id));
        const selected = selectItemsForBatchDownload(unreadUndownloaded, mode);
        if (selected.length === 0) return;
        downloadAllManga(
            {
                id: mangaId,
                title: displayManga?.title || 'Manga',
                image: displayManga?.images?.jpg?.large_image_url || displayManga?.images?.jpg?.image_url || '',
            },
            selected
        );
    }, [displayManga, id, matchingMangaDownloads, effectiveChapters, readChapters, downloadAllManga]);

    const currentProgress = useMemo(() => {
        const targetId = normalizeMangaRouteId(id);
        const targetTitle = (displayManga?.title || '').toLowerCase().trim();
        return continueReadingList.find((p) => {
            if (normalizeMangaRouteId(p.mangaId) === targetId) return true;
            if (targetTitle && (p.mangaTitle || '').toLowerCase().trim() === targetTitle) return true;
            return false;
        });
    }, [continueReadingList, id, displayManga?.title]);

    // Navigate to reader page with path-based URL
    const handleChapterClick = useCallback((chapter: MangaChapter) => {
        if (!displayManga) return;

        const title = slugify(displayManga.title || 'manga');
        const chapterMatch = chapter.title.match(/Chapter\s+(\d+[.]?\d*)/i);
        const chapterNum = chapterMatch ? chapterMatch[1] : '1';
        navigate(`/manga/read/${title}/${id}/c${chapterNum}`, { replace: true, state: { manga: displayManga, chapter } });
    }, [displayManga, id, navigate]);

    // Fetch details on mount or ID change
    // Scroll to top on mount
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
    }, [id]);

    useEffect(() => {
        const onScroll = () => setCompactFab(window.scrollY > 96);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    // Auto-open reader if navigated from "Continue Reading"
    useEffect(() => {
        if (mangaChapters.length > 0) {
            if (location.state?.chapterId) {
                const targetChapter = mangaChapters.find(c => c.id === location.state.chapterId);
                if (targetChapter) {
                    setTimeout(() => {
                        loadMangaChapter(targetChapter);
                    }, 100);
                }
            } else if (location.state?.autoRead) {
                // Auto-read: Start from the first chapter (oldest)
                const firstChapter = mangaChapters[mangaChapters.length - 1];
                if (firstChapter) {
                    setTimeout(() => {
                        // We use handleChapterClick to ensure URL update + load
                        handleChapterClick(firstChapter);
                    }, 100);
                }
            }
        }
    }, [location.state, mangaChapters, loadMangaChapter, handleChapterClick]);

    // Fetch details on ID change
    useEffect(() => {
        if (id) {
            console.log(`[MangaDetailsPage] Fetching details for ID: ${id}`);
            fetchMangaDetails(id, routeManga);
        }
    }, [id, routeManga, fetchMangaDetails]);

    console.log('[MangaDetailsPage] Rendered with ID:', id);

    if (!displayManga) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] pb-20 animate-pulse">
                <div className="relative h-[30vh] md:h-[40vh] w-full overflow-hidden bg-white/10" />
                <div className="max-w-7xl mx-auto px-8 md:px-14 -mt-24 md:-mt-32 relative z-10">
                    <div className="flex flex-col md:flex-row gap-8 lg:gap-12">
                        <div className="flex-shrink-0 mx-auto md:mx-0 w-48 sm:w-52 md:w-56 lg:w-60">
                            <div className="rounded-xl aspect-[2/3] bg-white/10" />
                        </div>
                        <div className="flex-1 space-y-4">
                            <div className="h-10 w-3/4 rounded bg-white/10" />
                            <div className="h-6 w-1/2 rounded bg-white/10" />
                            <div className="h-12 w-56 rounded-full bg-white/10" />
                            <div className="h-6 w-40 rounded bg-white/10 mt-8" />
                            <div className="space-y-2">
                                <div className="h-4 w-full rounded bg-white/10" />
                                <div className="h-4 w-5/6 rounded bg-white/10" />
                                <div className="h-4 w-4/6 rounded bg-white/10" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Determine banner
    // If we have no banner, use the large cover logic or a blur
    const bannerImage = displayManga.bannerImage;
    const displayTitle = getDisplayTitle(displayManga as unknown as Record<string, unknown>, language);
    const hasReadableChapters = effectiveChapters.length > 0;
    const metadataChapterCount = Number(displayManga.chapters || 0);
    const hasResolvedChapterSource = Boolean(String(displayManga.scraper_id || '').trim()) || hasReadableChapters;
    const displayAuthor = getPrimaryMangaAuthor(displayManga);

    const mangaId = String(displayManga.scraper_id || displayManga.id || displayManga.mal_id);

    const addDisplayMangaToReadList = (status: ReadListItem['status']) => {
        addToReadList({
            id: mangaId,
            title: displayManga.title,
            image: displayManga.images.jpg.large_image_url,
            score: displayManga.score,
            type: displayManga.type,
            totalCount: displayManga.chapters || effectiveChapters.length,
            genres: displayManga.genres?.map((g) => g.name),
            mediaStatus: displayManga.status,
            synopsis: displayManga.synopsis,
            status
        });
    };

    const handleToggleReadList = () => {
        if (isInReadList(mangaId)) {
            removeFromReadList(mangaId);
            return;
        }

        addDisplayMangaToReadList('reading');
    };

    const handleBack = () => {
        if (((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0) navigate(-1);
        else navigate('/manga', { replace: true });
    };

    return (
        <div className="relative min-h-screen overflow-x-hidden bg-[#070707] text-white pb-24 md:pb-16 fade-in animate-in duration-300" style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}>
            <div
                className={`fixed inset-x-0 top-0 z-40 md:hidden border-b transition-colors duration-300 ${compactFab ? 'border-purple-400/15 bg-[#24202b]/95 backdrop-blur-xl' : 'border-transparent bg-transparent'}`}
                style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 24px)' }}
            >
                <div className="flex h-14 items-center gap-3 px-4">
                    <button type="button" onClick={handleBack} className="grid h-10 w-10 shrink-0 place-items-center text-white/90 transition-colors active:text-white" aria-label="Go back">
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div className={`min-w-0 flex-1 text-[20px] font-semibold text-white/90 truncate transition-opacity duration-300 ${compactFab ? 'opacity-100' : 'opacity-0'}`}>
                        {displayTitle}
                    </div>
                    <button type="button" onClick={() => window.dispatchEvent(new Event('yorumi:manga:toggle-sort'))} className="grid h-10 w-10 shrink-0 place-items-center text-white/85 transition-colors active:text-white" aria-label="Toggle newest or oldest">
                        <ArrowUpDown className="h-5 w-5" />
                    </button>
                    <button type="button" onClick={() => window.dispatchEvent(new Event('yorumi:manga:toggle-view'))} className="grid h-10 w-10 shrink-0 place-items-center text-white/85 transition-colors active:text-white" aria-label="Toggle chapter view">
                        {viewMode === 'list' ? <Grid2X2 className="h-5 w-5" /> : <List className="h-5 w-5" />}
                    </button>
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setMobileDownloadMenuOpen((open) => !open)}
                            className="grid h-10 w-10 shrink-0 place-items-center text-white/85 transition-colors active:text-white"
                            aria-label="Download chapters"
                        >
                            <Download className="h-5 w-5" />
                        </button>
                        <BatchDownloadMenu
                            isOpen={mobileDownloadMenuOpen}
                            onClose={() => setMobileDownloadMenuOpen(false)}
                            unit="chapter"
                            placement="bottom-right"
                            onSelect={handleDownloadMangaByMode}
                        />
                    </div>
                </div>
            </div>
            <div className="mx-auto w-full max-w-[1440px] px-6 pt-24 sm:px-10 sm:pt-32 md:px-14 md:pt-40 lg:px-16 lg:pt-48">
                <ReadingDetailsHero
                    key={String(displayManga.id || displayManga.mal_id)}
                    title={displayTitle}
                    cover={displayManga.images?.jpg?.large_image_url || displayManga.images?.jpg?.image_url || ''}
                    banner={bannerImage}
                    synopsis={displayManga.synopsis}
                    details={[displayManga.score ? displayManga.score.toFixed(1) : '', displayManga.countryOfOrigin === 'KR' ? 'Manhwa' : displayManga.countryOfOrigin === 'CN' ? 'Manhua' : (displayManga.type || 'Manga'), displayAuthor || '', hasReadableChapters ? `${effectiveChapters.length} chapters` : metadataChapterCount > 0 ? `${metadataChapterCount} chapters` : ''].filter(Boolean)}
                    genres={displayManga.genres?.map((genre) => genre.name)}
                    inList={isInReadList(mangaId)}
                    inFavorites={isFavoriteManga(mangaId)}
                    loading={mangaChaptersLoading}
                    canRead={effectiveChapters.length > 0}
                    readLabel="Read"
                    onRead={() => {
                        const startChapter = currentProgress
                            ? effectiveChapters.find((chapter) => chapter.id === currentProgress.chapterId || chapter.title.match(/Chapter\s+(\d+[.]?\d*)/i)?.[1] === currentProgress.chapterNumber) || effectiveChapters[effectiveChapters.length - 1]
                            : effectiveChapters[effectiveChapters.length - 1];
                        if (startChapter) handleChapterClick(startChapter);
                    }}
                    onToggleList={handleToggleReadList}
                    onToggleFavorite={() => {
                        if (isFavoriteManga(mangaId)) {
                            void removeFavoriteManga(mangaId);
                        } else {
                            void addFavoriteManga({
                                id: mangaId,
                                title: displayTitle,
                                image: displayManga.images?.jpg?.large_image_url || displayManga.images?.jpg?.image_url || '',
                            });
                        }
                    }}
                    onBack={handleBack}
                />
                <div className="relative z-10 mt-6 w-full">
                    {/* Section Tabs Row (below poster, before chapters) */}
                    <div className="flex items-center gap-7 pt-2 pb-1">
                        {(
                            [
                                { key: 'chapters', label: 'Chapters' },
                                { key: 'related', label: 'More like this' },
                            ] as const
                        ).map((tab) => {
                            const isActive = activeSectionTab === tab.key;
                            return (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => setActiveSectionTab(tab.key)}
                                    className={`text-[15px] font-extrabold transition-colors border-0 outline-none focus:outline-none cursor-pointer ${
                                        isActive ? 'text-white' : 'text-white/50 hover:text-white/85'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Chapters Section */}
                    <div id="chapters-section" className={`pt-2 ${activeSectionTab === 'chapters' ? 'block' : 'hidden'}`}>
                        {mangaChaptersLoading ? (
                            <div className="mt-4 bg-transparent p-0 animate-pulse">
                                <div className="flex items-center justify-between gap-4 mb-6">
                                    <div className="h-7 w-32 bg-white/10 rounded-lg" />
                                    <div className="h-9 w-28 bg-white/10 rounded-xl" />
                                </div>
                                <div className="mb-6">
                                    <div className="h-10 w-full bg-white/5 rounded-xl border border-white/5" />
                                </div>
                                <div className="flex flex-col space-y-2">
                                    {Array.from({ length: 8 }).map((_, idx) => (
                                        <div key={idx} className="flex items-center justify-between gap-3 py-3 px-2 border-b border-white/[0.04]">
                                            <div className="flex items-center gap-3">
                                                <div className="w-2 h-2 rounded-full bg-white/10" />
                                                <div className="h-5 w-40 bg-white/10 rounded-md" />
                                            </div>
                                            <div className="w-7 h-7 rounded-full bg-white/5" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : effectiveChapters.length > 0 ? (
                            <>
                            {displayManga.readingProvider === 'mangadex' && <p className="mb-3 text-sm text-white/70">Showing available English chapters from MangaDex; some chapters may be unavailable.</p>}
                            <ChapterList
                                chapters={effectiveChapters}
                                readChapters={readChapters}
                                onChapterClick={handleChapterClick}
                                viewMode={viewMode}
                                onViewModeChange={setViewMode}
                                manga={displayManga}
                                headerActions={
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => handleDownloadMangaByMode('unread')}
                                            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.10] text-white/80 transition-colors hover:bg-white/[0.15] hover:text-white border-0 outline-none focus:outline-none cursor-pointer"
                                            title="Download all chapters for offline reading"
                                            aria-label="Download all chapters"
                                        >
                                            <Download className="h-4 w-4" />
                                        </button>
                                        {isDesktopApp && (
                                            <button
                                                type="button"
                                                onClick={handleOpenFolder}
                                                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.10] text-white/80 transition-colors hover:bg-white/[0.15] hover:text-white border-0 outline-none focus:outline-none cursor-pointer"
                                                title="Open downloaded files on your computer"
                                                aria-label="Open downloads folder"
                                            >
                                                <FolderOpen className="h-4 w-4" />
                                            </button>
                                        )}
                                    </>
                                }
                            />
                            </>
                        ) : (
                            <div className="text-gray-500 text-center py-4 space-y-2">
                                <div>
                                    {hasResolvedChapterSource
                                        ? `No readable chapters were returned from ${String(displayManga?.scraper_id).startsWith('vault:') ? 'Toonily' : 'MangaKatana'}.`
                                        : 'Chapter source for this title was not resolved yet.'}
                                </div>
                                {!hasResolvedChapterSource && metadataChapterCount > 0 && (
                                    <div className="text-xs text-gray-600">
                                        AniList has metadata for {metadataChapterCount} total chapters, but the readable chapter source still needs a match.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {activeSectionTab === 'related' && (
                        <div className="pt-2">
                            <MoreLikeReading
                                kind="manga"
                                anilistId={Number(displayManga.externalIds?.anilist) > 0 ? Number(displayManga.externalIds?.anilist) : undefined}
                                title={displayManga.title}
                                genres={displayManga.genres?.map((g) => g.name)}
                                embedded
                            />
                        </div>
                    )}

                    {/* Characters Section (if available) */}
                    {displayManga.characters && (
                        <DetailsCharacters
                            characters={displayManga.characters as Anime['characters']}
                            title="Characters"
                        />
                    )}
                </div>
            </div>

            {/* Mobile Floating Action Button (Resume / Read) */}
            {effectiveChapters.length > 0 && (
                <div
                    className="fixed right-4 md:hidden z-30 pointer-events-auto flex items-center justify-end gap-4"
                    style={{ bottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}
                >
                    <button
                        type="button"
                        onClick={() => {
                            const startChapter = currentProgress
                                ? effectiveChapters.find((c) => {
                                    if (c.id === currentProgress.chapterId) return true;
                                    const match = c.title.match(/Chapter\s+(\d+[.]?\d*)/i);
                                    return match && match[1] === currentProgress.chapterNumber;
                                }) || effectiveChapters[effectiveChapters.length - 1]
                                : effectiveChapters[effectiveChapters.length - 1];
                            if (startChapter) handleChapterClick(startChapter);
                        }}
                        className={`flex items-center justify-center py-3.5 rounded-2xl bg-[#5b4b72]/95 hover:bg-[#6d5a88] text-white font-bold text-sm shadow-2xl shadow-black/80 border border-white/10 backdrop-blur-md active:scale-95 transition-all duration-500 ease-out cursor-pointer ${compactFab ? 'w-14 px-0 gap-0' : 'px-5 gap-2'}`}
                    >
                        <Play className="w-4 h-4 fill-white text-white" />
                        <span className={`overflow-hidden whitespace-nowrap transition-all ${compactFab ? 'max-w-0 opacity-0' : 'max-w-24 opacity-100'}`}>
                            {currentProgress ? 'Continue' : 'Start'}
                        </span>
                    </button>
                </div>
            )}
        </div>
    );
}

import { useCallback, useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Check, Plus, Play, Download, Loader2, CircleCheckBig, FolderOpen, ArrowLeft, Search, ChevronDown, ArrowUpDown, ArrowDown, ArrowUp, Grid2X2, List, User, Clock3 } from 'lucide-react';
import { useManga } from '../hooks/useManga';
import { useReadList } from '../hooks/useReadList';
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
import ChapterViewToggle, { useChapterViewMode, type ChapterViewMode } from '../components/ui/ChapterViewToggle';

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
    const { isChapterDownloaded, getDownloadProgress, startDownload, deleteDownload } = useMangaDownloads();

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
        <div className="mt-4 sm:mt-6 bg-transparent md:bg-[#111]/40 md:rounded-2xl p-0 md:p-6">
            <div className="mb-4 flex items-center gap-4 md:hidden">
                <h3 className="whitespace-nowrap text-[22px] font-semibold text-white">
                    Chapters <span className="text-sm font-bold text-gray-500">({chapters.length})</span>
                </h3>
                <div className="h-px flex-1 bg-white/10" />
            </div>
            <div className="hidden md:flex items-center justify-between gap-3 mb-4 sm:mb-6">
                <h3 className="hidden md:block text-xl sm:text-2xl font-black text-white tracking-tight">
                    {chapters.length} chapters
                </h3>
                <div className="flex items-center gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <button 
                        type="button"
                        onClick={() => { setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc'); }}
                        className="grid h-10 w-10 shrink-0 place-items-center text-gray-400 transition-colors hover:text-white"
                        title={sortOrder === 'desc' ? 'Newest first' : 'Oldest first'}
                        aria-label={sortOrder === 'desc' ? 'Sort chapters newest first' : 'Sort chapters oldest first'}
                    >
                        {sortOrder === 'desc' ? <ArrowDown className="h-5 w-5" /> : <ArrowUp className="h-5 w-5" />}
                    </button>
                    {onViewModeChange && <ChapterViewToggle viewMode={viewMode} onViewModeChange={onViewModeChange} />}
                    {headerActions}
                </div>
            </div>

            <div className="hidden md:block mb-4 sm:mb-6">
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Search className="w-4 h-4 text-gray-400" />
                    </div>
                    <input 
                        type="text" 
                        placeholder="Search chapters..." 
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); }}
                        className="w-full bg-white/[0.04] border border-white/10 text-white pl-10 pr-4 py-2.5 rounded-xl text-sm placeholder-gray-500 focus:outline-none focus:border-yorumi-manga/50 focus:bg-white/[0.07] transition-all"
                    />
                </div>
            </div>

            {viewMode === 'grid' ? (
                <div className="grid grid-cols-5 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
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
                            <button
                                key={`${ch.id}-${index}`}
                                onClick={() => onChapterClick(ch)}
                                title={ch.title}
                                data-label={mainStr}
                                className={`relative aspect-square flex items-center justify-center rounded-lg transition-all duration-200 text-center group
                                    ${isRead ? 'opacity-50 bg-[#141414]' : 'bg-[#1a1a1a] hover:bg-[#252525]'} active:scale-95 cursor-pointer border border-white/5`}
                            >
                                <span className={`font-semibold text-xs sm:text-sm leading-tight ${isRead ? 'text-gray-400' : 'text-gray-200 group-hover:text-yorumi-manga'} transition-colors line-clamp-2`}>
                                    {ch.title.match(/(?:chapter|ch\.?)\s*([\d.]+)/i)?.[1] || ch.title.match(/[\d.]+/)?.[0] || String(index + 1)}
                                </span>
                                {subtitleStr && (
                                    <span className="hidden">
                                        {subtitleStr}
                                    </span>
                                )}
                                <div className="absolute top-1.5 right-1.5" onClick={(e) => e.stopPropagation()}>
                                    {isDownloading ? (
                                        <Loader2 className="w-3 h-3 animate-spin text-yorumi-manga" />
                                    ) : isDownloaded ? (
                                        <CircleCheckBig className="w-3 h-3 text-emerald-400" />
                                    ) : null}
                                </div>
                            </button>
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
                                className={`flex items-center justify-between gap-3 py-3.5 px-0 sm:px-3 transition-all duration-150 text-left group
                                    ${isRead ? 'opacity-50' : ''} hover:bg-white/[0.03] active:bg-white/[0.06] rounded-xl cursor-pointer`}
                            >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <span className={`w-2 h-2 rounded-full shrink-0 ${isRead ? 'bg-zinc-600' : 'bg-yorumi-manga shadow-[0_0_8px_rgba(229,57,69,0.5)]'}`} />
                                    <div className="flex flex-col min-w-0">
                                        <span className={`font-medium text-[17px] leading-snug ${isRead ? 'text-zinc-400' : 'text-zinc-100 group-hover:text-yorumi-manga'} transition-colors line-clamp-1`}>
                                            {mainStr}{subtitleStr ? ` : ${subtitleStr}` : ''}
                                        </span>
                                        <div className="flex items-center gap-2 text-sm text-zinc-500 font-normal mt-1">
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
                                <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (isDownloaded) {
                                                deleteDownload(mangaId, ch.id);
                                            } else if (!isDownloading) {
                                                startDownload({
                                                    mangaId,
                                                    mangaTitle,
                                                    mangaImage,
                                                    chapter: ch,
                                                });
                                            }
                                        }}
                                        disabled={isDownloading}
                                        className={`p-2 rounded-full border transition-all cursor-pointer ${
                                            isDownloaded
                                                ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30'
                                                : isDownloading
                                                ? 'border-yorumi-manga/30 text-yorumi-manga bg-yorumi-manga/10'
                                                : 'border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 hover:border-white/20'
                                        }`}
                                        title={
                                            isDownloaded
                                                ? 'Downloaded for offline (Click to delete)'
                                                : isDownloading
                                                ? `Downloading ${progress?.progress || 0}%`
                                                : 'Download chapter'
                                        }
                                    >
                                        {isDownloading ? (
                                            <div className="flex items-center gap-1 text-[11px] font-bold text-yorumi-manga">
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                <span>{progress?.progress || 0}%</span>
                                            </div>
                                        ) : isDownloaded ? (
                                            <CircleCheckBig className="w-4 h-4 text-emerald-400" />
                                        ) : (
                                            <Download className="w-4 h-4" />
                                        )}
                                    </button>
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
    const [synopsisExpanded, setSynopsisExpanded] = useState(false);
    const [compactFab, setCompactFab] = useState(false);

    const {
        selectedManga,
        mangaChapters,
        mangaChaptersLoading,
        fetchMangaDetails,
        loadMangaChapter,
        readChapters
    } = useManga();

    const { isInReadList, addToReadList, removeFromReadList } = useReadList();
    const { continueReadingList } = useContinueReading();
    const { language } = useTitleLanguage();
    const { downloads: mangaDownloads, downloadAll: downloadAllManga } = useMangaDownloads();

    const isElectron = typeof window !== 'undefined' && Boolean(window.electronAPI?.openDownloadsFolder);

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

    const displayManga = selectedMatchesCurrentRoute
        ? selectedManga
        : routeMatchesCurrentRoute
            ? routeManga
            : selectedManga || routeManga;

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

    const effectiveChapters = mangaChapters.length > 0 ? mangaChapters : downloadedChapters;

    const handleDownloadAllManga = useCallback(() => {
        const mangaId = displayManga?.id || displayManga?.mal_id || id || '';
        if (!mangaId) return;
        downloadAllManga(
            {
                id: mangaId,
                title: displayManga?.title || 'Manga',
                image: displayManga?.images?.jpg?.large_image_url || displayManga?.images?.jpg?.image_url || '',
            },
            effectiveChapters
        );
    }, [displayManga, id, downloadAllManga, effectiveChapters]);

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
        navigate(`/manga/read/${title}/${id}/c${chapterNum}`, { state: { manga: displayManga, chapter } });
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
    const bannerImage = displayManga.images.jpg.large_image_url;
    const displayTitle = getDisplayTitle(displayManga as unknown as Record<string, unknown>, language);
    const hasReadableChapters = mangaChapters.length > 0;
    const metadataChapterCount = Number(displayManga.chapters || 0);
    const hasResolvedChapterSource = Boolean(String(displayManga.scraper_id || '').trim()) || hasReadableChapters;
    const displayAuthor = displayManga.author || displayManga.authors?.map((author) => author.name).filter(Boolean).join(', ');

    const mangaId = String(displayManga.scraper_id || displayManga.id || displayManga.mal_id);

    const addDisplayMangaToReadList = (status: ReadListItem['status']) => {
        addToReadList({
            id: mangaId,
            title: displayManga.title,
            image: displayManga.images.jpg.large_image_url,
            score: displayManga.score,
            type: displayManga.type,
            totalCount: displayManga.chapters || mangaChapters.length,
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
        navigate('/manga', { replace: true });
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white pb-24 md:pb-16 fade-in animate-in duration-300" style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}>
            <div
                className={`fixed inset-x-0 top-0 z-40 md:hidden border-b transition-colors duration-300 ${compactFab ? 'border-purple-400/15 bg-[#24202b]/95 backdrop-blur-xl' : 'border-transparent bg-transparent'}`}
                style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
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
                    <button type="button" onClick={handleDownloadAllManga} className="grid h-10 w-10 shrink-0 place-items-center text-white/85 transition-colors active:text-white" aria-label="Download chapters">
                        <Download className="h-5 w-5" />
                    </button>
                </div>
            </div>
            {/* 1. Header Hero */}
            <div className="relative h-[30vh] md:h-[40vh] w-full overflow-hidden">

                {/* Background Image with Blur */}
                <div className="absolute inset-0">
                    <img
                        src={bannerImage}
                        alt={displayTitle}
                        className="w-full h-full object-cover blur-sm opacity-55 scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/40 to-black/10" />
                    <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#0a0a0a] to-transparent" />
                </div>
            </div>

            {/* 2. Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-8 md:px-14 -mt-24 md:-mt-32 relative z-10">
                <div className="flex flex-row md:flex-row gap-4 md:gap-8 lg:gap-12 items-start md:items-start">
                    {/* Poster */}
                    <div className="flex-shrink-0 w-28 sm:w-36 md:w-56 lg:w-60 group">
                        <div className="rounded-xl md:rounded-xl overflow-hidden shadow-2xl shadow-black/50 aspect-[2/3]">
                            <img
                                src={displayManga.images.jpg.large_image_url}
                                alt={displayTitle}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                        </div>
                    </div>

                    {/* Meta Data */}
                    <div className="flex-1 text-left space-y-3 md:space-y-4 min-w-0">
                        {/* Overline & Title */}
                        <div className="space-y-2">
                            <h1 className="text-[26px] sm:text-3xl md:text-4xl lg:text-5xl font-semibold md:font-black text-white tracking-tight leading-[1.12]">
                                {displayTitle}
                            </h1>
                            {(displayAuthor || displayManga.status) && (
                                <div className="md:hidden space-y-1.5 text-[15px] leading-tight">
                                    {displayAuthor && (
                                        <div className="flex min-w-0 items-center gap-2 text-zinc-300">
                                            <User className="h-4 w-4 shrink-0 text-zinc-400" />
                                            <span className="truncate">{displayAuthor}</span>
                                        </div>
                                    )}
                                    {displayManga.status && (
                                        <div className="flex min-w-0 items-center gap-2 text-zinc-400">
                                            <Clock3 className="h-4 w-4 shrink-0 text-zinc-500" />
                                            <span className="truncate">{displayManga.status}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Genres */}
                        {displayManga.genres && displayManga.genres.length > 0 && (
                            <div className="hidden md:flex flex-wrap items-center md:justify-start gap-2 pt-1">
                                {displayManga.genres.slice(0, 4).map((genre) => (
                                    <span key={genre.name} className="px-3 py-1 bg-white/5 border border-white/5 rounded-full text-xs font-semibold text-gray-300">
                                        {genre.name}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Metadata Row */}
                        <div className="hidden md:flex flex-wrap items-center md:justify-start gap-4 text-sm font-bold text-gray-400">
                            {(displayManga.score || 0) > 0 && (
                                <span className="flex items-center gap-1 text-[#facc15]">
                                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                                    {displayManga.score}
                                </span>
                            )}
                            {displayManga.views && (
                                <span className="flex items-center gap-1 text-gray-300">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                    {displayManga.views} Views
                                </span>
                            )}
                            {displayAuthor && (
                                <span className="text-gray-300 truncate max-w-[200px]" title={displayAuthor}>
                                    {displayAuthor}
                                </span>
                            )}
                            {!displayManga.views && displayManga.published?.from && (
                                <span>{new Date(displayManga.published.from).getFullYear()}</span>
                            )}
                            {!displayManga.views && (hasReadableChapters || metadataChapterCount > 0) && (
                                <span>
                                    {hasReadableChapters ? `${mangaChapters.length} Chapters` : `${metadataChapterCount} Chapters`}
                                </span>
                            )}
                            {!displayManga.views && displayManga.type && (
                                <span className="px-2 py-0.5 bg-white/10 rounded text-[10px] text-white">
                                    {displayManga.type}
                                </span>
                            )}
                        </div>

                        {/* Synopsis */}
                        <div className="hidden md:block text-gray-300 text-sm md:text-base leading-relaxed max-w-4xl line-clamp-4 pt-2">
                            {displayManga.synopsis || 'No synopsis available.'}
                        </div>

                        {/* Actions */}
                        <div className="hidden md:flex w-full flex-row items-center md:justify-start gap-3 py-2">
                            <button
                                onClick={() => {
                                    if (mangaChapters.length > 0) {
                                        const startChapter = currentProgress
                                            ? mangaChapters.find((c) => {
                                                if (c.id === currentProgress.chapterId) return true;
                                                const match = c.title.match(/Chapter\s+(\d+[.]?\d*)/i);
                                                return match && match[1] === currentProgress.chapterNumber;
                                            }) || mangaChapters[mangaChapters.length - 1]
                                            : mangaChapters[mangaChapters.length - 1];
                                        handleChapterClick(startChapter);
                                    }
                                }}
                                disabled={mangaChaptersLoading || mangaChapters.length === 0}
                                className="h-10 px-6 bg-[#1a1a1a] hover:bg-white/10 text-white text-sm font-bold rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
                            >
                                <Play className="w-4 h-4 fill-current" />
                                <span>
                                    {mangaChaptersLoading
                                        ? 'Loading...'
                                        : currentProgress
                                            ? `Ch. ${currentProgress.chapterNumber}`
                                            : 'Read'}
                                </span>
                            </button>
                            
                            <div className="relative">
                                <button
                                    onClick={handleToggleReadList}
                                    className={`h-10 px-6 text-sm font-bold rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap ${isInReadList(mangaId)
                                        ? 'bg-yorumi-manga/20 text-yorumi-manga hover:bg-yorumi-manga/30'
                                        : 'bg-[#1a1a1a] hover:bg-white/10 text-white'
                                        }`}
                                >
                                    {isInReadList(mangaId) ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                    <span>{isInReadList(mangaId) ? 'Saved' : 'Save'}</span>
                                </button>
                            </div>

                            <button
                                onClick={handleBack}
                                className="h-10 px-6 bg-[#1a1a1a] hover:bg-white/10 text-white text-sm font-bold rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                                <span>Back</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="md:hidden mt-4 space-y-4">
                    <div className="relative">
                        <p className={`overflow-hidden text-base leading-7 text-zinc-300 transition-[max-height] duration-500 ease-out ${synopsisExpanded ? 'max-h-[40rem]' : 'max-h-[5.25rem]'}`}>
                                {displayManga.synopsis || 'No synopsis available.'}
                        </p>
                        {!synopsisExpanded && (displayManga.synopsis || '').length > 140 && (
                            <div className="pointer-events-none absolute inset-x-0 bottom-8 h-12 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/85 to-transparent" />
                        )}
                        {(displayManga.synopsis || '').length > 140 && (
                            <button
                                type="button"
                                onClick={() => setSynopsisExpanded((value) => !value)}
                                className="mx-auto mt-1 flex h-8 w-8 items-center justify-center text-white/85 [&>span]:hidden"
                                aria-label={synopsisExpanded ? 'Show less synopsis' : 'Show more synopsis'}
                            >
                                <ChevronDown className={`h-5 w-5 transition-transform duration-300 ${synopsisExpanded ? 'rotate-180' : ''}`} />
                                <span className={`text-xl leading-none transition-transform ${synopsisExpanded ? 'rotate-180' : ''}`}>⌄</span>
                            </button>
                        )}
                    </div>

                    {displayManga.genres && displayManga.genres.length > 0 && (
                        <div className={`${synopsisExpanded ? 'flex flex-wrap' : 'flex overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'} gap-2 pb-1 transition-all duration-300`}>
                            {(synopsisExpanded ? displayManga.genres : displayManga.genres.slice(0, 8)).map((genre) => (
                                <span key={genre.name} className="shrink-0 rounded-full bg-white/[0.07] px-3 py-1.5 text-xs font-semibold text-zinc-300">
                                    {genre.name}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                <div className="w-full mt-6">
                    {/* Chapters Section */}
                    <div id="chapters-section" className="pt-2">
                        {mangaChaptersLoading ? (
                            <div className="mt-4 bg-transparent md:bg-[#111]/40 rounded-none md:rounded-2xl p-0 md:p-6 animate-pulse">
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
                            <ChapterList
                                chapters={effectiveChapters}
                                readChapters={readChapters}
                                onChapterClick={handleChapterClick}
                                viewMode={viewMode}
                                onViewModeChange={setViewMode}
                                manga={displayManga}
                                headerActions={
                                    <>
                                        {isElectron && (
                                            <button
                                                type="button"
                                                onClick={handleOpenFolder}
                                                className="grid h-10 w-10 place-items-center text-gray-400 transition-colors hover:text-yorumi-manga"
                                                title="Open downloaded files on your computer"
                                                aria-label="Open downloads folder"
                                            >
                                                <FolderOpen className="h-5 w-5" />
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={handleDownloadAllManga}
                                            className="grid h-10 w-10 place-items-center text-gray-400 transition-colors hover:text-yorumi-manga"
                                            title="Download all chapters for offline reading"
                                            aria-label="Download all chapters"
                                        >
                                            <Download className="h-5 w-5" />
                                        </button>
                                    </>
                                }
                            />
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
                                ? mangaChapters.find((c) => {
                                    if (c.id === currentProgress.chapterId) return true;
                                    const match = c.title.match(/Chapter\s+(\d+[.]?\d*)/i);
                                    return match && match[1] === currentProgress.chapterNumber;
                                }) || mangaChapters[mangaChapters.length - 1]
                                : mangaChapters[mangaChapters.length - 1];
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

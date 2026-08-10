import { useCallback, useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Check, Plus, Play } from 'lucide-react';
import { useManga } from '../hooks/useManga';
import { useReadList } from '../hooks/useReadList';
import { useContinueReading } from '../hooks/useContinueReading';
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

// Chapter Grid for Details Page
const ChapterList = ({
    chapters,
    readChapters,
    onChapterClick,
    viewMode = 'list'
}: {
    chapters: MangaChapter[],
    readChapters: Set<string>,
    onChapterClick: (ch: MangaChapter) => void,
    viewMode?: ChapterViewMode
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
    const [page, setPage] = useState(1);
    const ITEMS_PER_PAGE = 50;

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

    const totalPages = Math.ceil(sortedChapters.length / ITEMS_PER_PAGE);
    const currentChapters = sortedChapters.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    return (
        <div className="mt-6 bg-[#111] rounded-2xl p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <h3 className="text-xl font-black text-white">{chapters.length} Chapters</h3>
                <button 
                    onClick={() => { setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc'); setPage(1); }}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-bold text-gray-300 transition-colors flex items-center gap-2"
                >
                    {sortOrder === 'desc' ? '↑ Newest' : '↓ Oldest'}
                </button>
            </div>
            
            <div className="mb-6">
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <input 
                        type="text" 
                        placeholder="Search chapters..." 
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                        className="w-full bg-[#1a1a1a] text-white pl-11 pr-4 py-3 rounded-xl focus:outline-none focus:bg-[#222] transition-all"
                    />
                </div>
            </div>

            {viewMode === 'grid' ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2.5">
                    {currentChapters.map((ch, index) => {
                        const isRead = readChapters.has(ch.id);
                        
                        const titleMatch = ch.title.match(/^(Arc\s+\d+[\s–—,-]*(?:Chapter\s*)?[\d.]+|Vol(?:ume)?\s*[\d.]+\s*(?:Chapter\s*)?[\d.]+|Chapter\s+[\d.]+|Ch\.\s*[\d.]+)(?:\s*[:–—,-]\s*["'«]?(.*?)["'»]?)?$/i);
                        const mainStr = titleMatch ? titleMatch[1].trim() : ch.title.split(/[:–—]/)[0].trim();
                        const subMatch = titleMatch ? titleMatch[2] : (ch.title.includes(':') || ch.title.includes('–') ? ch.title.split(/[:–—]/).slice(1).join(' ').trim() : '');
                        const subtitleStr = subMatch ? subMatch.replace(/^["'«]|["'»]$/g, '').trim() : '';

                        return (
                            <button
                                key={`${ch.id}-${index}`}
                                onClick={() => onChapterClick(ch)}
                                title={ch.title}
                                className={`aspect-square flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200 text-center group
                                    ${isRead ? 'opacity-50 bg-[#141414]' : 'bg-[#1a1a1a] hover:bg-[#252525]'} active:scale-95 cursor-pointer`}
                            >
                                <span className={`font-semibold text-xs sm:text-sm leading-tight ${isRead ? 'text-gray-400' : 'text-gray-200 group-hover:text-yorumi-manga'} transition-colors line-clamp-2`}>
                                    {mainStr}
                                </span>
                                {subtitleStr && (
                                    <span className="text-[10px] text-gray-400 truncate w-full mt-1 px-0.5 font-normal">
                                        {subtitleStr}
                                    </span>
                                )}
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
                <div className="flex flex-col space-y-1">
                    {currentChapters.map((ch, index) => {
                        const isRead = readChapters.has(ch.id);
                        
                        const titleMatch = ch.title.match(/^(Arc\s+\d+[\s–—,-]*(?:Chapter\s*)?[\d.]+|Vol(?:ume)?\s*[\d.]+\s*(?:Chapter\s*)?[\d.]+|Chapter\s+[\d.]+|Ch\.\s*[\d.]+)(?:\s*[:–—,-]\s*["'«]?(.*?)["'»]?)?$/i);
                        const mainStr = titleMatch ? titleMatch[1].trim() : ch.title.split(/[:–—]/)[0].trim();
                        const subMatch = titleMatch ? titleMatch[2] : (ch.title.includes(':') || ch.title.includes('–') ? ch.title.split(/[:–—]/).slice(1).join(' ').trim() : '');
                        const subtitleStr = subMatch ? subMatch.replace(/^["'«]|["'»]$/g, '').trim() : '';

                        return (
                            <button
                                key={`${ch.id}-${index}`}
                                onClick={() => onChapterClick(ch)}
                                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-xl transition-all duration-200 text-left group
                                    ${isRead ? 'opacity-50' : ''} hover:bg-[#1a1a1a] active:scale-[0.99] cursor-pointer`}
                            >
                                <div className="flex flex-col min-w-0">
                                    <span className={`font-semibold text-base ${isRead ? 'text-gray-400' : 'text-gray-200 group-hover:text-yorumi-manga'} transition-colors`}>
                                        {mainStr}
                                    </span>
                                    {subtitleStr && (
                                        <span className="text-gray-400 text-xs sm:text-sm font-normal truncate mt-0.5">
                                            {subtitleStr}
                                        </span>
                                    )}
                                </div>
                                {ch.uploadDate && (
                                    <span className="text-gray-500 text-xs font-medium shrink-0">
                                        {ch.uploadDate}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                    {currentChapters.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                            No chapters found matching "{searchQuery}"
                        </div>
                    )}
                </div>
            )}

            {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-white/5">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-4 py-2 bg-[#111] border border-white/10 rounded-xl text-xs font-bold text-gray-300 disabled:opacity-30 hover:bg-white/5 transition-colors"
                        >
                            Previous
                        </button>
                        <span className="text-xs font-bold text-gray-400">
                            Page {page} of {totalPages}
                        </span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="px-4 py-2 bg-[#111] border border-white/10 rounded-xl text-xs font-bold text-gray-300 disabled:opacity-30 hover:bg-white/5 transition-colors"
                        >
                            Next
                        </button>
                    </div>
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
                        Showing {(page - 1) * ITEMS_PER_PAGE + 1} - {Math.min(page * ITEMS_PER_PAGE, sortedChapters.length)} of {sortedChapters.length}
                    </span>
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
        navigate(`/manga/read/${title}/${id}/c${chapterNum}`, { state: { manga: displayManga } });
    }, [displayManga, id, navigate]);

    // Fetch details on mount or ID change
    // Scroll to top on mount
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
    }, [id]);

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

    return (
        <div className="min-h-screen bg-[#0a0a0a] pb-20 fade-in animate-in duration-300">
            {/* 1. Header Hero */}
            <div className="relative h-[30vh] md:h-[40vh] w-full overflow-hidden">
                {/* Background Image with Blur */}
                <div className="absolute inset-0">
                    <img
                        src={bannerImage}
                        alt={displayTitle}
                        className="w-full h-full object-cover blur-xl opacity-40 scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/60 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#0a0a0a] to-transparent" />
                </div>
            </div>

            {/* 2. Content */}
            <div className="max-w-7xl mx-auto px-8 md:px-14 -mt-24 md:-mt-32 relative z-10">
                <div className="flex flex-col md:flex-row gap-8 lg:gap-12">
                    {/* Poster */}
                    <div className="flex-shrink-0 mx-auto md:mx-0 w-48 sm:w-52 md:w-56 lg:w-60 group">
                        <div className="rounded-xl overflow-hidden shadow-2xl shadow-black/50 aspect-[2/3]">
                            <img
                                src={displayManga.images.jpg.large_image_url}
                                alt={displayTitle}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                        </div>
                    </div>

                    {/* Meta Data */}
                    <div className="flex-1 text-center md:text-left space-y-4">
                        {/* Overline & Title */}
                        <div className="space-y-1">
                            <span className="text-[11px] font-black uppercase tracking-widest text-[#e53945]">
                                {displayManga.countryOfOrigin === 'KR' ? 'Manhwa' :
                                    displayManga.countryOfOrigin === 'CN' ? 'Manhua' :
                                        'Manga'}
                            </span>
                            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-white uppercase tracking-tight leading-tight">
                                {displayTitle}
                            </h1>
                        </div>

                        {/* Genres */}
                        {displayManga.genres && displayManga.genres.length > 0 && (
                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-1">
                                {displayManga.genres.slice(0, 4).map((genre) => (
                                    <span key={genre.name} className="px-3 py-1 bg-white/5 border border-white/5 rounded-full text-xs font-semibold text-gray-300">
                                        {genre.name}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Metadata Row */}
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm font-bold text-gray-400">
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
                            {displayManga.author && (
                                <span className="text-gray-300 truncate max-w-[200px]" title={displayManga.author}>
                                    {displayManga.author}
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
                        <div className="text-gray-300 text-sm md:text-base leading-relaxed max-w-4xl line-clamp-4 pt-2">
                            {displayManga.synopsis || 'No synopsis available.'}
                        </div>

                        {/* Actions */}
                        <div className="flex w-full flex-row items-center justify-center md:justify-start gap-3 py-2">
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
                                onClick={() => navigate(-1)}
                                className="h-10 px-6 bg-[#1a1a1a] hover:bg-white/10 text-white text-sm font-bold rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                                <span>Back</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="w-full mt-6">
                                {/* Chapters Section */}
                                <div id="chapters-section" className="pt-2">
                                    <div className="flex items-center gap-4 mb-6">
                                        <h3 className="text-xl font-black text-white uppercase tracking-wider whitespace-nowrap">Chapters</h3>
                                        <div className="flex-1 h-px bg-white/10" />
                                        <ChapterViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
                                    </div>
                                    {mangaChaptersLoading ? (
                                        <div className="mt-6 bg-[#111] rounded-2xl p-4 sm:p-6 shadow-xl ring-1 ring-white/5 animate-pulse">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                                <div className="h-7 w-32 bg-white/10 rounded-lg"></div>
                                                <div className="h-9 w-28 bg-white/10 rounded-xl"></div>
                                            </div>
                                            <div className="mb-6">
                                                <div className="h-[50px] w-full bg-white/10 rounded-xl border border-white/5"></div>
                                            </div>
                                            <div className="flex flex-col space-y-1">
                                                {Array.from({ length: 10 }).map((_, idx) => (
                                                    <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 rounded-xl border border-transparent">
                                                        <div className="flex flex-col min-w-0">
                                                            <div className="h-6 w-32 bg-white/10 rounded-md mb-1.5"></div>
                                                            <div className="h-4 w-48 bg-white/5 rounded-md"></div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : mangaChapters.length > 0 ? (
                                        <ChapterList
                                            chapters={mangaChapters}
                                            readChapters={readChapters}
                                            onChapterClick={handleChapterClick}
                                            viewMode={viewMode}
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
                                {/* Characters Section */}
                                {displayManga.characters && (
                                    <DetailsCharacters
                                        characters={displayManga.characters as Anime['characters']}
                                        title="Characters"
                                    />
                                )}
                </div>
            </div>
        </div>
    );
}

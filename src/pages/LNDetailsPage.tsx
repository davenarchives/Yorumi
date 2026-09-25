import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { lnService } from '../services/lnService';
import type { LightNovel, LNChapter } from '../types/ln';
import { useLNReadList } from '../hooks/useLNReadList';
import { useContinueLNReading } from '../hooks/useContinueLNReading';
import { useTitleLanguage } from '../context/TitleLanguageContext';
import { getDisplayTitle } from '../utils/titleLanguage';
import { slugify } from '../utils/slugify';
import { Play, Plus, Check, Search, Star, Download, Loader2, CircleCheckBig, FolderOpen, ArrowLeft, ChevronDown, ArrowUpDown, Grid2X2, List, User, Clock3 } from 'lucide-react';
import ChapterViewToggle, { useChapterViewMode, type ChapterViewMode } from '../components/ui/ChapterViewToggle';
import { useLNDownloads } from '../hooks/useLNDownloads';
import { downloadService } from '../services/downloadService';

// Chapter Grid Component matching Manga details format
const LNChapterList = ({
    chapters,
    readChapters,
    onChapterClick,
    viewMode = 'list',
    onViewModeChange,
    novelId,
    novelTitle,
    novelImage,
    author,
    headerActions,
}: {
    chapters: LNChapter[];
    readChapters: Set<string>;
    onChapterClick: (ch: LNChapter) => void;
    viewMode?: ChapterViewMode;
    onViewModeChange?: (mode: ChapterViewMode) => void;
    novelId?: string;
    novelTitle?: string;
    novelImage?: string;
    author?: string;
    headerActions?: React.ReactNode;
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const { isChapterDownloaded, getDownloadProgress, startDownload, deleteDownload } = useLNDownloads();

    const filteredChapters = useMemo(() => {
        return chapters.filter((ch) =>
            ch.title.toLowerCase().includes(searchQuery.toLowerCase()) || String(ch.number).includes(searchQuery)
        );
    }, [chapters, searchQuery]);

    const sortedChapters = useMemo(() => {
        const list = [...filteredChapters];
        if (sortOrder === 'desc') {
            list.reverse();
        }
        return list;
    }, [filteredChapters, sortOrder]);

    const currentChapters = sortedChapters;

    useEffect(() => {
        const toggleSort = () => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
        const toggleView = () => onViewModeChange?.(viewMode === 'list' ? 'grid' : 'list');
        window.addEventListener('yorumi:ln:toggle-sort', toggleSort);
        window.addEventListener('yorumi:ln:toggle-view', toggleView);
        return () => {
            window.removeEventListener('yorumi:ln:toggle-sort', toggleSort);
            window.removeEventListener('yorumi:ln:toggle-view', toggleView);
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
                        onClick={() => {
                            setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                        }}
                        className="h-10 px-4 bg-white/5 hover:bg-white/10 rounded-2xl text-xs sm:text-sm font-bold text-gray-200 transition-colors flex items-center gap-1.5 cursor-pointer border border-white/5 shrink-0"
                    >
                        {sortOrder === 'asc' ? '↓ Oldest First' : '↑ Newest First'}
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
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                        }}
                        className="w-full bg-white/[0.04] border border-white/10 text-white pl-10 pr-4 py-2.5 rounded-xl text-sm placeholder-gray-500 focus:outline-none focus:border-amber-400/50 focus:bg-white/[0.07] transition-all"
                    />
                </div>
            </div>

            {viewMode === 'grid' ? (
                <div className="grid grid-cols-5 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
                    {currentChapters.map((ch, index) => {
                        const isRead = readChapters.has(String(ch.id));
                        const isDownloaded = isChapterDownloaded(novelId, ch.id);
                        const progress = getDownloadProgress(novelId, ch.id);
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
                                <span className={`font-semibold text-xs sm:text-sm leading-tight ${isRead ? 'text-gray-400' : 'text-gray-200 group-hover:text-amber-400'} transition-colors line-clamp-2`}>
                                    {ch.number}
                                </span>
                                {subtitleStr && (
                                    <span className="hidden">
                                        {subtitleStr}
                                    </span>
                                )}
                                <div className="absolute top-1.5 right-1.5" onClick={(e) => e.stopPropagation()}>
                                    {isDownloading ? (
                                        <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                                    ) : isDownloaded ? (
                                        <CircleCheckBig className="w-3 h-3 text-amber-400" />
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
                        const isRead = readChapters.has(String(ch.id));
                        const isDownloaded = isChapterDownloaded(novelId, ch.id);
                        const progress = getDownloadProgress(novelId, ch.id);
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
                                    <span className={`w-2 h-2 rounded-full shrink-0 ${isRead ? 'bg-zinc-600' : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]'}`} />
                                    <div className="flex flex-col min-w-0">
                                        <span className={`font-medium text-[17px] leading-snug ${isRead ? 'text-zinc-400' : 'text-zinc-100 group-hover:text-amber-400'} transition-colors line-clamp-1`}>
                                            {mainStr}{subtitleStr ? ` : ${subtitleStr}` : ''}
                                        </span>
                                        <div className="flex items-center gap-2 text-sm text-zinc-500 font-normal mt-1">
                                            <span>{ch.releaseDate || 'Recent'}</span>
                                            {author && (
                                                <>
                                                    <span>•</span>
                                                    <span className="truncate max-w-[140px] sm:max-w-[220px]">
                                                        {author}
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
                                                if (novelId) deleteDownload(novelId, ch.id);
                                            } else if (!isDownloading) {
                                                startDownload({
                                                    novelId: novelId || '',
                                                    novelTitle: novelTitle || 'Novel',
                                                    novelImage: novelImage || '',
                                                    chapter: ch,
                                                });
                                            }
                                        }}
                                        disabled={isDownloading}
                                        className={`p-2 rounded-full border transition-all cursor-pointer ${
                                            isDownloaded
                                                ? 'border-amber-500/30 text-amber-400 bg-amber-500/10 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30'
                                                : isDownloading
                                                ? 'border-amber-400/30 text-amber-400 bg-amber-400/10'
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
                                            <div className="flex items-center gap-1 text-[11px] font-bold text-amber-400">
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                <span>{progress?.progress || 0}%</span>
                                            </div>
                                        ) : isDownloaded ? (
                                            <CircleCheckBig className="w-4 h-4 text-amber-400" />
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

export default function LNDetailsPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { language } = useTitleLanguage();
    const [viewMode, setViewMode] = useChapterViewMode();

    const routeLN = (location.state as { ln?: LightNovel } | null)?.ln ?? null;

    const [ln, setLn] = useState<LightNovel | null>(routeLN);
    const [chapters, setChapters] = useState<LNChapter[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingChapters, setLoadingChapters] = useState(true);
    const [synopsisExpanded, setSynopsisExpanded] = useState(false);
    const [compactFab, setCompactFab] = useState(false);

    const { isInLNReadList, toggleLNReadList } = useLNReadList();
    const { continueReadingList } = useContinueLNReading();
    const { downloads: lnDownloads, downloadAll: downloadAllLN } = useLNDownloads();

    const isElectron = typeof window !== 'undefined' && Boolean(window.electronAPI?.openDownloadsFolder);

    const handleOpenFolder = useCallback(() => {
        downloadService.openDownloadsFolder('LightNovels');
    }, []);

    const currentProgress = useMemo(() => {
        if (!id) return null;
        return continueReadingList.find((entry) => String(entry.novelId) === String(id));
    }, [id, continueReadingList]);

    const readChapters = useMemo(() => {
        const set = new Set<string>();
        if (currentProgress?.chapterId) {
            set.add(String(currentProgress.chapterId));
        }
        return set;
    }, [currentProgress]);

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
    }, [id]);

    useEffect(() => {
        const onScroll = () => setCompactFab(window.scrollY > 96);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    useEffect(() => {
        if (!id) return;
        let mounted = true;
        setLoading(true);

        const fetchDetailsAndChapters = async () => {
            try {
                let fetchedLN = routeLN;
                const fullDetails = await lnService.getDetails(id).catch(() => null);
                if (fullDetails) {
                    fetchedLN = routeLN
                        ? {
                            ...routeLN,
                            ...fullDetails,
                            title: fullDetails.title || routeLN.title,
                            images: fullDetails.images || routeLN.images,
                            synopsis: fullDetails.synopsis || routeLN.synopsis,
                        }
                        : fullDetails;
                }
                if (mounted && fetchedLN) {
                    setLn(fetchedLN);
                    setLoading(false);
                }

                // Now resolve and fetch backend scraper chapters
                setLoadingChapters(true);
                let scraperId = String(fetchedLN?.scraper_id || id);
                if (!fetchedLN?.scraper_id && !id.includes(':')) {
                    const resolved = await lnService.resolveScraperId([
                        fetchedLN?.title,
                        fetchedLN?.title_english,
                        fetchedLN?.title_romaji,
                        fetchedLN?.title_native,
                        fetchedLN?.title_japanese,
                        ...(Array.isArray(fetchedLN?.synonyms) ? fetchedLN.synonyms : []),
                    ].filter(Boolean) as string[]);
                    if (resolved) {
                        scraperId = resolved;
                    }
                }

                let scraperDetails = await lnService.getScraperNovelDetails(scraperId);
                if (scraperDetails?.chapters && scraperDetails.chapters.length > 5) {
                    const chs = scraperDetails.chapters;
                    if (chs[0]?.title?.toLowerCase().includes('arc 1') && chs[1]?.title?.toLowerCase().includes('arc 5')) {
                        // Stale cache detected, force purge & fresh fetch
                        const fresh = await lnService.getScraperNovelDetails(scraperId, true);
                        if (fresh) scraperDetails = fresh;
                    }
                }

                if (mounted && scraperDetails) {
                    if (scraperDetails.chapters) {
                        setChapters(scraperDetails.chapters);
                    }
                    setLn((prev) => prev ? {
                        ...prev,
                        author: scraperDetails.author && scraperDetails.author !== 'Unknown' && scraperDetails.author !== 'Unknown Author' ? scraperDetails.author : prev.author,
                        synopsis: scraperDetails.description || prev.synopsis,
                        status: scraperDetails.status || prev.status,
                        genres: scraperDetails.genres?.length ? scraperDetails.genres.map((name) => ({ name, mal_id: 0 })) : prev.genres,
                        chapters: scraperDetails.chapters?.length || prev.chapters,
                    } : prev);
                }
            } catch (err) {
                console.error('Failed to load Light Novel details:', err);
            } finally {
                if (mounted) {
                    setLoading(false);
                    setLoadingChapters(false);
                }
            }
        };

        fetchDetailsAndChapters();
        return () => {
            mounted = false;
        };
    }, [id, routeLN]);

    const displayTitle = ln ? getDisplayTitle(ln, language) : 'Light Novel';
    const cover = ln?.images?.jpg?.large_image_url || ln?.images?.jpg?.image_url || '';
    const lnId = String(ln?.id || id);

    const matchingLNDownloads = useMemo(() => {
        if (!id && !ln) return [];
        const targetTitle = (displayTitle || '').toLowerCase().trim();
        return lnDownloads.filter((d) => {
            if (String(d.novelId) === String(id) || String(d.novelId) === String(lnId)) return true;
            if (targetTitle && d.novelTitle.toLowerCase().trim() === targetTitle) return true;
            return false;
        });
    }, [lnDownloads, id, lnId, displayTitle, ln]);

    const downloadedLNChapters: LNChapter[] = useMemo(() => {
        return matchingLNDownloads.map((d) => ({
            id: d.chapterId,
            number: Number(d.chapterNumber || 1),
            title: d.chapterTitle,
            url: d.chapterId,
        }));
    }, [matchingLNDownloads]);

    const effectiveChapters = chapters.length > 0 ? chapters : downloadedLNChapters;

    const handleDownloadAllLN = useCallback(() => {
        const novelId = lnId || id || '';
        if (!novelId) return;
        downloadAllLN(
            {
                id: novelId,
                title: displayTitle || 'Novel',
                image: cover || '',
            },
            effectiveChapters
        );
    }, [lnId, id, displayTitle, cover, downloadAllLN, effectiveChapters]);

    const handleChapterClick = useCallback((ch: LNChapter) => {
        navigate(`/ln/read/${slugify(displayTitle)}/${lnId}/${encodeURIComponent(ch.id)}`, {
            state: { chapter: ch, ln },
        });
    }, [displayTitle, lnId, ln, navigate]);

    if (loading && !ln) {
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

    if (!ln) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a] text-white gap-4">
                <div className="text-6xl font-black text-white/10">!</div>
                <h1 className="text-2xl font-bold">Light Novel Not Found</h1>
                <p className="text-gray-400">We couldn't find the requested novel.</p>
                <button
                    onClick={() => navigate('/ln')}
                    className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-full font-bold transition-colors mt-4"
                >
                    Go Back to Light Novels
                </button>
            </div>
        );
    }

    const isBookmarked = isInLNReadList(lnId);

    const handleBack = () => {
        navigate('/ln', { replace: true });
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
                    <button type="button" onClick={() => window.dispatchEvent(new Event('yorumi:ln:toggle-sort'))} className="grid h-10 w-10 shrink-0 place-items-center text-white/85 transition-colors active:text-white" aria-label="Toggle newest or oldest">
                        <ArrowUpDown className="h-5 w-5" />
                    </button>
                    <button type="button" onClick={() => window.dispatchEvent(new Event('yorumi:ln:toggle-view'))} className="grid h-10 w-10 shrink-0 place-items-center text-white/85 transition-colors active:text-white" aria-label="Toggle chapter view">
                        {viewMode === 'list' ? <Grid2X2 className="h-5 w-5" /> : <List className="h-5 w-5" />}
                    </button>
                    <button type="button" onClick={handleDownloadAllLN} className="grid h-10 w-10 shrink-0 place-items-center text-white/85 transition-colors active:text-white" aria-label="Download chapters">
                        <Download className="h-5 w-5" />
                    </button>
                </div>
            </div>
            {/* 1. Header Hero */}
            <div className="relative h-[30vh] md:h-[40vh] w-full overflow-hidden">

                <div className="absolute inset-0">
                    <img
                        src={ln.bannerImage || cover}
                        alt={displayTitle}
                        className="w-full h-full object-cover blur-sm opacity-55 scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/40 to-black/10" />
                    <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#0a0a0a] to-transparent" />
                </div>
            </div>

            {/* 2. Content Container */}
            <div className="max-w-7xl mx-auto px-4 sm:px-8 md:px-14 -mt-24 md:-mt-32 relative z-10">
                <div className="flex flex-row md:flex-row gap-4 md:gap-8 lg:gap-12 items-start">
                    {/* Poster */}
                    <div className="flex-shrink-0 w-28 sm:w-36 md:w-56 lg:w-60 group">
                        <div className="rounded-xl overflow-hidden shadow-2xl shadow-black/50 aspect-[2/3]">
                            <img
                                src={cover}
                                alt={displayTitle}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                        </div>
                    </div>

                    {/* Metadata Column */}
                    <div className="flex-1 text-left space-y-3 md:space-y-4 min-w-0">
                        <div className="space-y-1">
                            <span className="hidden md:inline text-[11px] font-black uppercase tracking-widest text-amber-400">
                                {ln.countryOfOrigin === 'KR' ? '🇰🇷 Korean Web Novel' : ln.countryOfOrigin === 'CN' ? '🇨🇳 Chinese Web Novel' : (ln.type || 'Light Novel')}
                            </span>
                            <h1 className="text-[26px] sm:text-3xl md:text-4xl lg:text-5xl font-semibold md:font-black text-white tracking-tight leading-[1.12]">
                                {displayTitle}
                            </h1>
                            {(ln.author || ln.status) && (
                                <div className="md:hidden space-y-1.5 text-[15px] leading-tight">
                                    {ln.author && (
                                        <div className="flex min-w-0 items-center gap-2 text-zinc-300">
                                            <User className="h-4 w-4 shrink-0 text-zinc-400" />
                                            <span className="truncate">{ln.author}</span>
                                        </div>
                                    )}
                                    {ln.status && (
                                        <div className="flex min-w-0 items-center gap-2 text-zinc-400">
                                            <Clock3 className="h-4 w-4 shrink-0 text-zinc-500" />
                                            <span className="truncate">{ln.status}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Genres */}
                        {ln.genres && ln.genres.length > 0 && (
                            <div className="hidden md:flex flex-wrap items-center md:justify-start gap-2 pt-1">
                                {ln.genres.slice(0, 4).map((genre) => (
                                    <span key={genre.name} className="px-3 py-1 bg-white/5 border border-white/5 rounded-full text-xs font-semibold text-gray-300">
                                        {genre.name}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Metadata Row */}
                        <div className="hidden md:flex flex-wrap items-center md:justify-start gap-4 text-sm font-bold text-gray-400">
                            {ln.score ? (
                                <span className="flex items-center gap-1 text-[#facc15]">
                                    <Star className="w-3.5 h-3.5 fill-current" />
                                    {ln.score.toFixed(1)}
                                </span>
                            ) : null}
                            {ln.author && (
                                <span className="text-gray-300 truncate max-w-[200px]" title={ln.author}>
                                    {ln.author}
                                </span>
                            )}
                            {chapters.length > 0 && (
                                <span>{chapters.length} Chapters</span>
                            )}
                            <span className="px-2 py-0.5 bg-white/10 rounded text-[10px] text-white uppercase">
                                {ln.status || 'Ongoing'}
                            </span>
                        </div>

                        {/* Synopsis */}
                        <div className="hidden md:block text-gray-300 text-sm md:text-base leading-relaxed max-w-4xl line-clamp-4 pt-2">
                            {ln.synopsis || 'No synopsis available.'}
                        </div>

                        {/* Actions Bar matching Manga details */}
                        <div className="hidden md:flex w-full flex-row items-center md:justify-start gap-3 py-2">
                            <button
                                onClick={() => {
                                    if (chapters.length > 0) {
                                        const startChapter = currentProgress
                                            ? chapters.find((c) => String(c.id) === String(currentProgress.chapterId)) || chapters[0]
                                            : chapters[0];
                                        handleChapterClick(startChapter);
                                    }
                                }}
                                disabled={loadingChapters || chapters.length === 0}
                                className="h-10 px-6 bg-[#1a1a1a] hover:bg-white/10 text-white text-sm font-bold rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
                            >
                                <Play className="w-4 h-4 fill-current" />
                                <span>
                                    {loadingChapters
                                        ? 'Loading...'
                                        : currentProgress
                                            ? `Ch. ${currentProgress.chapterNumber}`
                                            : 'Read'}
                                </span>
                            </button>

                            <button
                                onClick={() =>
                                    toggleLNReadList({
                                        id: ln.id,
                                        title: displayTitle,
                                        image: cover,
                                        score: ln.score,
                                        mediaStatus: ln.status,
                                        type: ln.type,
                                        synopsis: ln.synopsis,
                                        genres: ln.genres?.map((g) => g.name),
                                    })
                                }
                                className={`h-10 px-6 text-sm font-bold rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap ${
                                    isBookmarked
                                        ? 'bg-amber-400/20 text-amber-300 hover:bg-amber-400/30'
                                        : 'bg-[#1a1a1a] hover:bg-white/10 text-white'
                                }`}
                            >
                                {isBookmarked ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                <span>{isBookmarked ? 'Saved' : 'Save'}</span>
                            </button>

                            <button
                                onClick={handleBack}
                                className="h-10 px-6 bg-[#1a1a1a] hover:bg-white/10 text-white text-sm font-bold rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer"
                                title="Go back to previous page"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                                <span>Back</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="md:hidden mt-4 space-y-4">
                    <div className="relative">
                        <p className={`overflow-hidden text-base leading-7 text-zinc-300 transition-[max-height] duration-500 ease-out ${synopsisExpanded ? 'max-h-[40rem]' : 'max-h-[5.25rem]'}`}>
                                {ln.synopsis || 'No synopsis available.'}
                        </p>
                        {!synopsisExpanded && (ln.synopsis || '').length > 140 && (
                            <div className="pointer-events-none absolute inset-x-0 bottom-8 h-12 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/85 to-transparent" />
                        )}
                        {(ln.synopsis || '').length > 140 && (
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

                    {ln.genres && ln.genres.length > 0 && (
                        <div className={`${synopsisExpanded ? 'flex flex-wrap' : 'flex overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'} gap-2 pb-1 transition-all duration-300`}>
                            {(synopsisExpanded ? ln.genres : ln.genres.slice(0, 8)).map((genre) => (
                                <span key={genre.name} className="shrink-0 rounded-full bg-white/[0.07] px-3 py-1.5 text-xs font-semibold text-zinc-300">
                                    {genre.name}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Chapters Section */}
                <div className="w-full mt-6">
                    <div id="chapters-section" className="pt-2">
                        {loadingChapters ? (
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
                            <LNChapterList
                                chapters={effectiveChapters}
                                readChapters={readChapters}
                                onChapterClick={handleChapterClick}
                                viewMode={viewMode}
                                onViewModeChange={setViewMode}
                                novelId={lnId}
                                novelTitle={displayTitle}
                                novelImage={cover}
                                author={ln.author}
                                headerActions={
                                    <>
                                        {isElectron && (
                                            <button
                                                type="button"
                                                onClick={handleOpenFolder}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-300 hover:text-white transition-colors border border-white/5 cursor-pointer"
                                                title="Open downloaded files on your computer"
                                            >
                                                <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                                                <span className="hidden sm:inline">Downloads Folder</span>
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={handleDownloadAllLN}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-300 hover:text-white transition-colors border border-white/5 cursor-pointer"
                                            title="Download all chapters for offline reading"
                                        >
                                            <Download className="w-3.5 h-3.5 text-amber-400" />
                                            <span className="hidden sm:inline">Download All</span>
                                        </button>
                                    </>
                                }
                            />
                        ) : (
                            <div className="text-gray-500 text-center py-4 space-y-2">
                                <div>No readable chapters returned from novel sources.</div>
                            </div>
                        )}
                    </div>
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
                                ? chapters.find((c) => String(c.id) === String(currentProgress.chapterId)) || chapters[0]
                                : chapters[0];
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

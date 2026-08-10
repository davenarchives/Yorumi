import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { lnService } from '../services/lnService';
import type { LightNovel, LNChapter } from '../types/ln';
import { useLNReadList } from '../hooks/useLNReadList';
import { useContinueLNReading } from '../hooks/useContinueLNReading';
import { useTitleLanguage } from '../context/TitleLanguageContext';
import { getDisplayTitle } from '../utils/titleLanguage';
import { slugify } from '../utils/slugify';
import { Play, Plus, Check, Search, Star } from 'lucide-react';
import ChapterViewToggle, { useChapterViewMode, type ChapterViewMode } from '../components/ui/ChapterViewToggle';

// Chapter Grid Component matching Manga details format
const LNChapterList = ({
    chapters,
    readChapters,
    onChapterClick,
    viewMode = 'list',
}: {
    chapters: LNChapter[];
    readChapters: Set<string>;
    onChapterClick: (ch: LNChapter) => void;
    viewMode?: ChapterViewMode;
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [page, setPage] = useState(1);
    const ITEMS_PER_PAGE = 50;

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

    const totalPages = Math.ceil(sortedChapters.length / ITEMS_PER_PAGE) || 1;
    const currentChapters = sortedChapters.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    return (
        <div className="mt-6 bg-[#111] rounded-2xl p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <h3 className="text-xl font-black text-white">{chapters.length} Chapters</h3>
                <button
                    onClick={() => {
                        setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                        setPage(1);
                    }}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-bold text-gray-300 transition-colors flex items-center gap-2"
                >
                    {sortOrder === 'asc' ? '↓ Oldest First' : '↑ Newest First'}
                </button>
            </div>

            <div className="mb-6">
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Search className="w-5 h-5 text-gray-500" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search chapters..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setPage(1);
                        }}
                        className="w-full bg-[#1a1a1a] text-white pl-11 pr-4 py-3 rounded-xl focus:outline-none focus:bg-[#222] transition-all"
                    />
                </div>
            </div>

            {viewMode === 'grid' ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2.5">
                    {currentChapters.map((ch, index) => {
                        const isRead = readChapters.has(String(ch.id));

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
                                <span className={`font-semibold text-xs sm:text-sm leading-tight ${isRead ? 'text-gray-400' : 'text-gray-200 group-hover:text-amber-400'} transition-colors line-clamp-2`}>
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
                        const isRead = readChapters.has(String(ch.id));

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
                                    <span className={`font-semibold text-base ${isRead ? 'text-gray-400' : 'text-gray-200 group-hover:text-amber-400'} transition-colors`}>
                                        {mainStr}
                                    </span>
                                    {subtitleStr && (
                                        <span className="text-gray-400 text-xs sm:text-sm font-normal truncate mt-0.5">
                                            {subtitleStr}
                                        </span>
                                    )}
                                </div>
                                {ch.releaseDate && (
                                    <span className="text-gray-500 text-xs font-medium shrink-0">
                                        {ch.releaseDate}
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
                <div className="flex flex-col items-center gap-4 mt-8 pt-6 border-t border-white/10">
                    <div className="flex flex-wrap justify-center gap-2">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                            <button
                                key={p}
                                onClick={() => setPage(p)}
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors flex-shrink-0
                                    ${page === p ? 'bg-amber-400 text-black' : 'bg-white/5 text-gray-400 hover:bg-white/15 hover:text-white'}`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
                        Showing {(page - 1) * ITEMS_PER_PAGE + 1} - {Math.min(page * ITEMS_PER_PAGE, sortedChapters.length)} of {sortedChapters.length}
                    </span>
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

    const { isInLNReadList, toggleLNReadList } = useLNReadList();
    const { continueReadingList } = useContinueLNReading();

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
        if (!id) return;
        let mounted = true;
        setLoading(true);

        const fetchDetailsAndChapters = async () => {
            try {
                let fetchedLN = routeLN;
                if (!fetchedLN) {
                    fetchedLN = await lnService.getDetails(id);
                }
                if (mounted && fetchedLN) {
                    setLn(fetchedLN);
                    setLoading(false);
                }

                // Now resolve and fetch backend scraper chapters
                setLoadingChapters(true);
                let scraperId = id;
                if (!id.includes(':')) {
                    const resolved = await lnService.resolveScraperId([
                        fetchedLN?.title,
                        fetchedLN?.title_english,
                        fetchedLN?.title_romaji,
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
                    if (scraperDetails.author && scraperDetails.author !== 'Unknown' && scraperDetails.author !== 'Unknown Author') {
                        setLn((prev) => (prev ? { ...prev, author: scraperDetails.author! } : prev));
                    }
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

    return (
        <div className="min-h-screen bg-[#0a0a0a] pb-20 fade-in animate-in duration-300">
            {/* 1. Header Hero */}
            <div className="relative h-[30vh] md:h-[40vh] w-full overflow-hidden">
                <div className="absolute inset-0">
                    <img
                        src={ln.bannerImage || cover}
                        alt={displayTitle}
                        className="w-full h-full object-cover blur-xl opacity-40 scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/60 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#0a0a0a] to-transparent" />
                </div>
            </div>

            {/* 2. Content Container */}
            <div className="max-w-7xl mx-auto px-8 md:px-14 -mt-24 md:-mt-32 relative z-10">
                <div className="flex flex-col md:flex-row gap-8 lg:gap-12">
                    {/* Poster */}
                    <div className="flex-shrink-0 mx-auto md:mx-0 w-48 sm:w-52 md:w-56 lg:w-60 group">
                        <div className="rounded-xl overflow-hidden shadow-2xl shadow-black/50 aspect-[2/3]">
                            <img
                                src={cover}
                                alt={displayTitle}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                        </div>
                    </div>

                    {/* Metadata Column */}
                    <div className="flex-1 text-center md:text-left space-y-4">
                        <div className="space-y-1">
                            <span className="text-[11px] font-black uppercase tracking-widest text-amber-400">
                                {ln.type || 'NOVEL'}
                            </span>
                            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-white uppercase tracking-tight leading-tight">
                                {displayTitle}
                            </h1>
                        </div>

                        {/* Genres */}
                        {ln.genres && ln.genres.length > 0 && (
                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-1">
                                {ln.genres.slice(0, 4).map((genre) => (
                                    <span key={genre.name} className="px-3 py-1 bg-white/5 border border-white/5 rounded-full text-xs font-semibold text-gray-300">
                                        {genre.name}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Metadata Row */}
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm font-bold text-gray-400">
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
                        <div className="text-gray-300 text-sm md:text-base leading-relaxed max-w-4xl line-clamp-4 pt-2">
                            {ln.synopsis || 'No synopsis available.'}
                        </div>

                        {/* Actions Bar matching Manga details */}
                        <div className="flex w-full flex-row items-center justify-center md:justify-start gap-3 py-2">
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
                                onClick={() => navigate(-1)}
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

                {/* Chapters Section */}
                <div className="w-full mt-6">
                    <div id="chapters-section" className="pt-2">
                        <div className="flex items-center gap-4 mb-6">
                            <h3 className="text-xl font-black text-white uppercase tracking-wider whitespace-nowrap">Chapters</h3>
                            <div className="flex-1 h-px bg-white/10" />
                            <ChapterViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
                        </div>
                        {loadingChapters ? (
                            <div className="mt-6 bg-[#111] rounded-2xl p-4 sm:p-6 shadow-xl ring-1 ring-white/5 animate-pulse">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                    <div className="h-7 w-32 bg-white/10 rounded-lg" />
                                    <div className="h-9 w-28 bg-white/10 rounded-xl" />
                                </div>
                                <div className="mb-6">
                                    <div className="h-[50px] w-full bg-white/10 rounded-xl border border-white/5" />
                                </div>
                                <div className="flex flex-col space-y-1">
                                    {Array.from({ length: 10 }).map((_, idx) => (
                                        <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 rounded-xl border border-transparent">
                                            <div className="flex flex-col min-w-0">
                                                <div className="h-6 w-32 bg-white/10 rounded-md mb-1.5" />
                                                <div className="h-4 w-48 bg-white/5 rounded-md" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : chapters.length > 0 ? (
                            <LNChapterList
                                chapters={chapters}
                                readChapters={readChapters}
                                onChapterClick={handleChapterClick}
                                viewMode={viewMode}
                            />
                        ) : (
                            <div className="text-gray-500 text-center py-4 space-y-2">
                                <div>No readable chapters returned from novel sources.</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

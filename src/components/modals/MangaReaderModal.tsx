import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
    ZoomIn,
    ZoomOut,
    LayoutList,
    LayoutGrid,
    Search,
    ChevronLeft,
    Info,
    Calendar,
    PenTool
} from 'lucide-react';
import type { Manga, MangaChapter, MangaPage } from '../../types/manga';
import LoadingSpinner from '../LoadingSpinner';

interface MangaReaderModalProps {
    isOpen: boolean;
    manga: Manga;
    chapters: MangaChapter[];
    currentChapter: MangaChapter | null;
    pages: MangaPage[];
    chapterSearchQuery: string;
    chaptersLoading: boolean;
    pagesLoading: boolean;
    zoomLevel: number;
    onClose: () => void;
    onChapterSearchChange: (query: string) => void;
    onLoadChapter: (chapter: MangaChapter) => void;
    onPrefetchChapter: (chapter: MangaChapter) => void;
    onZoomIn: () => void;
    onZoomOut: () => void;
}

export default function MangaReaderModal({
    isOpen,
    manga,
    chapters,
    currentChapter,
    pages,
    chapterSearchQuery,
    chaptersLoading,
    pagesLoading,
    zoomLevel,
    onClose,
    onChapterSearchChange,
    onLoadChapter,
    onPrefetchChapter,
    onZoomIn,
    onZoomOut,
}: MangaReaderModalProps) {
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
    const [showDetails, setShowDetails] = useState(false);
    const [showChapters, setShowChapters] = useState(false); // Mobile toggle for chapters

    // New Feature States
    const [readingMode, setReadingMode] = useState<'longstrip' | 'page'>('longstrip');
    const [pageIndex, setPageIndex] = useState(0);

    // Immersive Mode State
    const [isHeaderVisible, setIsHeaderVisible] = useState(true);
    const lastScrollY = useRef(0);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const currentScrollY = e.currentTarget.scrollTop;
        const diff = currentScrollY - lastScrollY.current;

        // Threshold to avoid jitter
        if (Math.abs(diff) < 10) return;

        if (diff > 0 && currentScrollY > 60 && isHeaderVisible) {
            // Scrolling Down -> Hide
            setIsHeaderVisible(false);
        } else if (diff < 0 && !isHeaderVisible) {
            // Scrolling Up -> Show
            setIsHeaderVisible(true);
        }

        lastScrollY.current = currentScrollY;
    };

    const handleContentClick = () => {
        if (!isHeaderVisible) {
            setIsHeaderVisible(true);
        }
    };


    // Reset page index on chapter change
    useEffect(() => {
        setPageIndex(0);
    }, [currentChapter?.id]);

    // Preload adjacent pages for smooth navigation
    useEffect(() => {
        if (readingMode !== 'page' || pages.length === 0) return;

        // Preload next 3 pages
        const pagesToPreload = [1, 2, 3];
        pagesToPreload.forEach(offset => {
            const targetIndex = pageIndex + offset;
            if (targetIndex < pages.length && pages[targetIndex]?.imageUrl) {
                const img = new Image();
                img.src = pages[targetIndex].imageUrl;
            }
        });

        // Also preload previous page if available
        if (pageIndex > 0 && pages[pageIndex - 1]?.imageUrl) {
            const img = new Image();
            img.src = pages[pageIndex - 1].imageUrl;
        }
    }, [pageIndex, pages, readingMode]);

    // Handle initial responsive state
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 768) {
                setShowDetails(false);
                setShowChapters(false);
            }
        };

        if (isOpen && window.innerWidth < 768) {
            setShowDetails(false);
            setShowChapters(false);
        }

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [isOpen]);



    if (!isOpen) return null;

    // Filter Chapters (Ascending or Descending?)
    // Original list usually Descending (Latest first). 
    // filteredChapters here reverses it (Oldest first).
    const filteredChapters = [...chapters].reverse().filter(chapter => {
        if (!chapterSearchQuery) return true;
        const query = chapterSearchQuery.toLowerCase();
        return chapter.title.toLowerCase().includes(query);
    });

    // Determine Prev/Next Chapter based on currentChapter
    const currentChapterIndex = chapters.findIndex(c => c.id === currentChapter?.id);
    const prevChapter = currentChapterIndex !== -1 && currentChapterIndex < chapters.length - 1 ? chapters[currentChapterIndex + 1] : null;
    const nextChapter = currentChapterIndex !== -1 && currentChapterIndex > 0 ? chapters[currentChapterIndex - 1] : null;

    // Page Navigation
    const handleNextPage = () => {
        if (pageIndex < pages.length - 1) {
            setPageIndex(p => p + 1);
        } else if (nextChapter) {
            onLoadChapter(nextChapter);
        }
    };

    const handlePrevPage = () => {
        if (pageIndex > 0) {
            setPageIndex(p => p - 1);
        } else if (prevChapter) {
            onLoadChapter(prevChapter);
        }
    };

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/95 backdrop-blur-md transition-all duration-300 pt-[60px]">
            <div className="w-full h-full flex flex-col bg-[#0a0a0a] relative">
                {/* 1. Header Row */}
                <header className={`h-14 shrink-0 flex items-center justify-between px-3 md:px-4 border-b border-white/10 bg-[#0a0a0a] z-50 gap-2 transition-transform duration-300 absolute top-0 left-0 right-0 ${isHeaderVisible ? 'translate-y-0' : '-translate-y-full'}`}>
                    {/* LEFT: Nav & Title */}
                    <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
                        <button
                            onClick={onClose}
                            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors shrink-0"
                        >
                            <ChevronLeft className="w-5 h-5" />
                            <span className="text-sm font-medium hidden md:inline">Back</span>
                        </button>

                        {/* Mobile Chapter Toggle */}
                        <button
                            onClick={() => setShowChapters(!showChapters)}
                            className="md:hidden p-2 text-gray-300 hover:text-white bg-white/5 rounded-lg border border-white/5 shrink-0"
                        >
                            <LayoutList className="w-4 h-4" />
                        </button>

                        <div className="flex flex-col min-w-0">
                            <h1 className="text-sm md:text-lg font-bold text-white tracking-wide truncate leading-tight">
                                {manga.title}
                            </h1>
                            {currentChapter && (
                                <span className="text-xs text-gray-500 truncate hidden sm:block">
                                    {currentChapter.title}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* RIGHT: Controls */}
                    <div className="flex items-center gap-1 md:gap-3 shrink-0">

                        {/* Chapter Nav (Desktop/Mobile) */}
                        <div className="flex items-center bg-white/5 rounded-lg border border-white/10">
                            <button
                                onClick={() => prevChapter && onLoadChapter(prevChapter)}
                                disabled={!prevChapter}
                                className="px-2 md:px-3 py-1.5 hover:bg-white/10 text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent flex items-center gap-1.5 md:gap-2 transition-colors"
                                title="Previous Chapter"
                            >
                                <svg className="w-3 h-3 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                <span className="text-xs font-bold uppercase hidden md:inline">Prev</span>
                                <span className="text-[10px] font-bold uppercase md:hidden">Prev</span>
                            </button>
                            <span className="w-px h-4 bg-white/10 mx-0.5"></span>
                            <button
                                onClick={() => nextChapter && onLoadChapter(nextChapter)}
                                disabled={!nextChapter}
                                className="px-2 md:px-3 py-1.5 hover:bg-white/10 text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent flex items-center gap-1.5 md:gap-2 transition-colors"
                                title="Next Chapter"
                            >
                                <span className="text-xs font-bold uppercase hidden md:inline">Next</span>
                                <span className="text-[10px] font-bold uppercase md:hidden">Next</span>
                                <svg className="w-3 h-3 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            </button>
                        </div>

                        {/* Reading Mode Toggle (Visible on Mobile) */}
                        <button
                            onClick={() => setReadingMode(mode => mode === 'longstrip' ? 'page' : 'longstrip')}
                            className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/10"
                            title={readingMode === 'longstrip' ? 'Switch to Page View' : 'Switch to Longstrip'}
                        >
                            {readingMode === 'longstrip' ? (
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                            ) : (
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                            )}
                        </button>

                        {/* Zoom Controls (Hidden on Mobile) */}
                        <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1 border border-white/10 hidden sm:flex">
                            <button onClick={onZoomOut} className="p-1.5 hover:bg-white/10 rounded text-gray-300 hover:text-white">
                                <ZoomOut className="w-3 h-3 md:w-4 md:h-4" />
                            </button>
                            <span className="text-[10px] md:text-xs font-mono w-8 md:w-10 text-center text-gray-400">{zoomLevel}%</span>
                            <button onClick={onZoomIn} className="p-1.5 hover:bg-white/10 rounded text-gray-300 hover:text-white">
                                <ZoomIn className="w-3 h-3 md:w-4 md:h-4" />
                            </button>
                        </div>



                        {/* Toggle Details (Info) */}
                        <button
                            onClick={() => setShowDetails(!showDetails)}
                            className={`p-2 rounded-lg transition-colors ${showDetails ? 'bg-yorumi-accent text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}
                            title="Toggle Details"
                        >
                            <Info className="w-5 h-5" />
                        </button>
                    </div>
                </header>

                {/* 2. Main Layout */}
                <div className="flex-1 flex min-h-0 relative overflow-hidden">

                    {/* Mobile Backdrop for Sidebars */}
                    {(showChapters || showDetails) && (
                        <div
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm z-30 md:hidden"
                            onClick={() => {
                                setShowChapters(false);
                                setShowDetails(false);
                            }}
                        />
                    )}

                    {/* COLUMN 1: Chapter List (Left Sidebar) */}
                    <aside className={`
                        absolute md:static inset-y-0 left-0 z-40
                        w-[280px] md:w-[320px] shrink-0 flex flex-col h-full 
                        bg-[#111] md:bg-black/20 border-r border-white/10 
                        transition-all duration-300 ease-in-out
                        ${showChapters ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                        ${isHeaderVisible ? 'pt-14' : 'pt-0'}
                    `}>
                        <div className="p-4 border-b border-white/5">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                    Chapters
                                </h3>
                                <div className="flex bg-black/40 rounded-lg p-0.5 border border-white/10">
                                    <button
                                        onClick={() => setViewMode('list')}
                                        className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                    >
                                        <LayoutList className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setViewMode('grid')}
                                        className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                    >
                                        <LayoutGrid className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <div className="relative">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    value={chapterSearchQuery}
                                    onChange={(e) => onChapterSearchChange(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-white/20"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                            {chaptersLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <LoadingSpinner size="md" />
                                </div>
                            ) : filteredChapters.length > 0 ? (
                                <div className={viewMode === 'grid' ? "grid grid-cols-4 gap-2 p-3" : "flex flex-col"}>
                                    {filteredChapters.map((chapter, index) => {
                                        const isCurrent = currentChapter?.id === chapter.id;
                                        // Standardize Title Logic
                                        const match = chapter.title.match(/Chapter\s+(\d+[\.]?\d*)/i);
                                        const displayNum = match ? match[1] : '';
                                        const cleanTitle = chapter.title.replace(/Chapter\s+\d+/, '').trim().replace(/^:/, '').trim();
                                        const mainLabel = displayNum ? viewMode === 'grid' ? displayNum : `Chapter ${displayNum}` : chapter.title;
                                        const subLabel = !displayNum ? '' : cleanTitle;

                                        return (
                                            <button
                                                key={`${chapter.id}-${index}`}
                                                onClick={() => {
                                                    onLoadChapter(chapter);
                                                    setShowChapters(false); // Close mobile menu on select
                                                }}
                                                onMouseEnter={() => onPrefetchChapter(chapter)}
                                                className={`
                                                    group relative transition-all duration-200
                                                    ${viewMode === 'grid'
                                                        ? `aspect-square rounded-md flex items-center justify-center border overflow-hidden ${isCurrent ? 'bg-yorumi-accent text-black border-yorumi-accent font-bold' : 'bg-white/5 border-white/5 hover:bg-white/10 text-gray-400 hover:text-white'}`
                                                        : `w-full px-5 py-3 text-left border-l-2 flex flex-col justify-center ${isCurrent ? 'border-yorumi-accent bg-white/5' : 'border-transparent hover:bg-white/5'}`
                                                    }
                                                `}
                                                title={chapter.title}
                                            >
                                                {viewMode === 'grid' ? (
                                                    <span className="text-xs text-center line-clamp-2 px-1 break-words leading-tight text-[10px]">{mainLabel}</span>
                                                ) : (
                                                    <>
                                                        <div className="flex items-center justify-between w-full mb-0.5">
                                                            <span className={`text-sm font-bold ${isCurrent ? 'text-yorumi-accent' : 'text-gray-400 group-hover:text-white'}`}>
                                                                {mainLabel}
                                                            </span>
                                                            {isCurrent && (
                                                                <span className="w-5 h-5 rounded-full bg-yorumi-accent flex items-center justify-center">
                                                                    <svg className="w-3 h-3 text-black" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center justify-between w-full">
                                                            <span className={`text-xs truncate max-w-[180px] ${isCurrent ? 'text-white' : 'text-gray-600'}`}>
                                                                {subLabel || chapter.uploadDate || 'Available'}
                                                            </span>
                                                        </div>
                                                    </>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="p-8 text-center text-gray-500 text-sm">
                                    No chapters found.
                                </div>
                            )}
                        </div>
                    </aside>

                    {/* COLUMN 2: Reader (Center) */}
                    <div className={`flex-1 min-w-0 bg-[#050505] relative flex flex-col border-r border-white/5 transition-all duration-300 ${isHeaderVisible ? 'pt-14' : 'pt-0'}`}>
                        <div
                            className="flex-1 overflow-y-auto relative h-full [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']"
                            onScroll={handleScroll}
                        >
                            {pagesLoading ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                                    <LoadingSpinner size="lg" />
                                    <p className="text-gray-400 animate-pulse">Loading Pages...</p>
                                </div>
                            ) : pages.length > 0 ? (
                                readingMode === 'longstrip' ? (
                                    // LONGSTRIP MODE
                                    <div
                                        className="flex flex-col items-center pb-8 min-h-full"
                                        onClick={handleContentClick}
                                    >
                                        {pages.map((page, index) => (
                                            <img
                                                key={`${page.pageNumber}-${index}`}
                                                src={page.imageUrl}
                                                alt={`Page ${page.pageNumber}`}
                                                className="transition-all duration-200 block shadow-2xl"
                                                style={{ width: `${zoomLevel}%`, maxWidth: '100%' }}
                                                loading="lazy"
                                            />
                                        ))}
                                        {/* Prev/Next Chapter Buttons at Bottom */}
                                        <div className="flex flex-row gap-2 md:gap-4 mt-8 pb-8 px-4 w-full max-w-2xl justify-center">
                                            {prevChapter && (
                                                <button
                                                    onClick={() => onLoadChapter(prevChapter)}
                                                    className="flex-1 px-3 md:px-8 py-3 md:py-4 bg-white/10 hover:bg-white/20 text-white text-sm md:text-base font-bold rounded-full transition-transform hover:scale-105 border border-white/10 flex items-center justify-center gap-1 md:gap-2"
                                                >
                                                    <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                                    <span className="truncate">Prev Chapter</span>
                                                </button>
                                            )}
                                            {nextChapter && (
                                                <button
                                                    onClick={() => onLoadChapter(nextChapter)}
                                                    className="flex-1 px-3 md:px-8 py-3 md:py-4 bg-yorumi-accent text-black text-sm md:text-base font-bold rounded-full hover:scale-105 transition-transform shadow-lg shadow-yorumi-accent/20 flex items-center justify-center gap-1 md:gap-2"
                                                >
                                                    <span className="truncate">Next Chapter</span>
                                                    <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    // SINGLE PAGE MODE (Right to Left)
                                    <div
                                        className="flex items-center justify-center h-full w-full relative group select-none"
                                        onClick={(e) => {
                                            const width = e.currentTarget.offsetWidth;
                                            const clickX = e.nativeEvent.offsetX;
                                            if (clickX > width / 2) handleNextPage(); // Click Right -> Next Page (Logic Left?? No usually Webtoon is LTR? Manga is RTL?) 
                                            // Requirements says "page (right to left)"
                                            // So "Next Page" should be LEFT CLICK? 
                                            // Standard WebUI: Click Right = Next. Click Left = Prev. 
                                            // RTL Manga: Visual flow is R->L.
                                            // Usually, UX for "Next" is commonly "Click Right Edge" even for Manga on some readers, BUT strictly RTL means "Click Left Edge" = Next.
                                            // I will implement standard "Click Left = Next" for RTL feel? 
                                            // Let's implement Click Left = Next, Click Right = Prev for RTL.
                                            if (clickX < width / 3) handleNextPage(); // Left Zone = Next
                                            else if (clickX > (width * 2 / 3)) handlePrevPage(); // Right Zone = Prev
                                            // Center = Toggle Controls? (Not implementing toggle controls yet, just ignoring center)
                                        }}
                                    >
                                        <img
                                            src={pages[pageIndex]?.imageUrl}
                                            alt={`Page ${pageIndex + 1}`}
                                            className="max-h-full max-w-full object-contain shadow-2xl"
                                            style={{ transform: `scale(${zoomLevel / 100})` }}
                                        />

                                        {/* Overlay Helpers */}
                                        <div className="absolute inset-y-0 left-0 w-1/3 cursor-w-resize z-10 opacity-0 group-hover:opacity-10 transition-opacity bg-gradient-to-r from-white to-transparent" title="Next Page" />
                                        <div className="absolute inset-y-0 right-0 w-1/3 cursor-e-resize z-10 opacity-0 group-hover:opacity-10 transition-opacity bg-gradient-to-l from-white to-transparent" title="Previous Page" />

                                        {/* Page Indicator */}
                                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur px-3 py-1 rounded-full border border-white/10 text-white text-xs font-mono">
                                            Page {pageIndex + 1} / {pages.length}
                                        </div>
                                    </div>
                                )

                            ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 gap-4">
                                    {currentChapter ? (
                                        <>
                                            <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center">
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-red-500/50">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                                                </svg>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-gray-400 font-medium">Unable to load chapter</p>
                                                <p className="text-xs text-gray-600 mt-1">Please try another source or chapter</p>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 opacity-50">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                                                </svg>
                                            </div>
                                            <p>Select a chapter to start reading</p>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* COLUMN 3: Details (Right Sidebar) */}
                    <aside className={`
                        absolute md:static inset-y-0 right-0 z-40
                        w-[300px] md:w-[350px] shrink-0 h-full overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] 
                        bg-[#111] md:bg-black/20 md:border-l border-l border-white/10
                        transition-all duration-300 ease-in-out
                        ${showDetails ? 'translate-x-0' : 'translate-x-full md:hidden'}
                        ${isHeaderVisible ? 'pt-14' : 'pt-0'}
                    `}>
                        {/* Note: desktop behavior for Details: 
                           Start hidden on mobile? 
                           The previous code had {showDetails && <aside>}. 
                           Here I use CSS translate for mobile, but for desktop?
                           Logic: 
                           - Mobile: always off-canvas. showDetails toggles translation.
                           - Desktop: if showDetails is true, it renders statically? 
                           The className logic above:
                             md:translate-x-0 (Always shown if rendered?)
                             md:hidden xl:block ... wait this logic is getting complex with mixed CSS/State.
                             
                           Let's revert to "Conditional Rendering for Desktop content flow" but "Absolute for Mobile".
                           Actually, cleanest is:
                           ALWAYS Render.
                           Mobile: off-canvas (translate).
                           Desktop: Flow.
                           Toggle: Affects both?
                           
                           If showDetails is FALSE:
                             Mobile: Translate out.
                             Desktop: Hidden (display: none via class?)
                             
                           Let's adjust className:
                           ${showDetails ? 'translate-x-0 md:flex' : 'translate-x-full md:hidden'}
                        */}
                        <div className="p-6 flex flex-col gap-6">
                            {/* Poster */}
                            <Link
                                to={`/manga/${manga.id || manga.mal_id}`}
                                onClick={onClose}
                                className="block aspect-[2/3] w-full rounded-xl overflow-hidden shadow-2xl border border-white/5 relative group cursor-pointer"
                            >
                                <img
                                    src={manga.images.jpg.large_image_url}
                                    alt={manga.title}
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                                {/* Hover Overlay */}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <span className="bg-yorumi-accent text-black font-bold px-4 py-2 rounded-full transform translate-y-4 group-hover:translate-y-0 transition-all duration-300">
                                        View Details
                                    </span>
                                </div>

                                <div className="absolute bottom-4 left-4 right-4">
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        <span className="px-2 py-0.5 bg-yorumi-accent text-black text-xs font-bold rounded">
                                            ★ {manga.score}
                                        </span>
                                        <span className={`px-2 py-0.5 text-white text-xs font-bold rounded ${manga.countryOfOrigin === 'KR' ? 'bg-blue-600' :
                                            manga.countryOfOrigin === 'CN' ? 'bg-red-600' : 'bg-white/20'
                                            }`}>
                                            {manga.countryOfOrigin === 'KR' ? 'Manhwa' : manga.countryOfOrigin === 'CN' ? 'Manhua' : 'Manga'}
                                        </span>
                                    </div>
                                </div>
                            </Link>

                            {/* Info */}
                            <div className="space-y-6">
                                <div>
                                    <Link
                                        to={`/manga/${manga.id || manga.mal_id}`}
                                        onClick={onClose}
                                        className="hover:text-yorumi-accent transition-colors block"
                                    >
                                        <h2 className="text-xl font-bold leading-tight text-white mb-2">
                                            {manga.title}
                                        </h2>
                                    </Link>
                                    <p className="text-sm text-gray-500 font-medium">
                                        {manga.type} • {manga.status}
                                    </p>
                                </div>

                                {/* Grid Stats */}
                                <div className="grid grid-cols-2 gap-4 text-sm bg-white/5 p-4 rounded-xl border border-white/5">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-gray-500 text-xs uppercase font-bold tracking-wider flex items-center gap-1">
                                            <Calendar className="w-3 h-3" /> Published
                                        </span>
                                        <span className="text-gray-200 font-medium">
                                            {manga.published?.string || 'Unknown'}
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-gray-500 text-xs uppercase font-bold tracking-wider flex items-center gap-1">
                                            <PenTool className="w-3 h-3" /> Authors
                                        </span>
                                        <span className="text-gray-200 font-medium line-clamp-1">
                                            {manga.authors?.[0]?.name || 'Unknown'}
                                        </span>
                                    </div>
                                </div>

                                {/* Genres */}
                                <div>
                                    <span className="text-gray-500 text-xs uppercase font-bold tracking-wider mb-2 block">Genres</span>
                                    <div className="flex flex-wrap gap-2">
                                        {manga.genres?.map(g => (
                                            <span key={g.mal_id} className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/5 rounded text-xs text-gray-300 transition-colors cursor-default">
                                                {g.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-white/10">
                                    <span className="text-gray-500 text-xs uppercase font-bold tracking-wider mb-2 block">Synopsis</span>
                                    <p className="text-sm text-gray-400 leading-relaxed">
                                        {manga.synopsis}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>
            </div >
        </div >
    );
}

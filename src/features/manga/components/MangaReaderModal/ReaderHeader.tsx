import { ZoomIn, ZoomOut, ChevronLeft, LayoutList, Info } from 'lucide-react';
import type { MangaChapter } from '../../../../types/manga';

interface ReaderHeaderProps {
    mangaTitle: string;
    currentChapter: MangaChapter | null;
    prevChapter: MangaChapter | null;
    nextChapter: MangaChapter | null;
    readingMode: 'longstrip' | 'page';
    zoomLevel: number;
    showDetails: boolean;
    isVisible: boolean;
    onClose: () => void;
    onLoadChapter: (chapter: MangaChapter) => void;
    onToggleReadingMode: () => void;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onToggleDetails: () => void;
    onToggleChapters: () => void;
}

export default function ReaderHeader({
    mangaTitle,
    currentChapter,
    prevChapter,
    nextChapter,
    readingMode,
    zoomLevel,
    showDetails,
    isVisible,
    onClose,
    onLoadChapter,
    onToggleReadingMode,
    onZoomIn,
    onZoomOut,
    onToggleDetails,
    onToggleChapters,
}: ReaderHeaderProps) {
    return (
        <header className={`h-14 shrink-0 flex items-center justify-between px-3 md:px-4 border-b border-white/10 bg-[#0a0a0a] z-50 gap-2 transition-transform duration-300 absolute top-0 left-0 right-0 ${isVisible ? 'translate-y-0' : '-translate-y-full'}`}>
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
                    onClick={onToggleChapters}
                    className="md:hidden p-2 text-gray-300 hover:text-white bg-white/5 rounded-lg border border-white/5 shrink-0"
                >
                    <LayoutList className="w-4 h-4" />
                </button>

                <div className="flex flex-col min-w-0">
                    <h1 className="text-sm md:text-lg font-bold text-white tracking-wide truncate leading-tight">
                        {mangaTitle}
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
                {/* Chapter Nav */}
                <div className="flex items-center bg-white/5 rounded-lg border border-white/10">
                    <button
                        onClick={() => prevChapter && onLoadChapter(prevChapter)}
                        disabled={!prevChapter}
                        className="px-2 md:px-3 py-1.5 hover:bg-white/10 text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent flex items-center gap-1.5 md:gap-2 transition-colors"
                        title="Previous Chapter"
                    >
                        <svg className="w-3 h-3 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
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
                        <svg className="w-3 h-3 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>

                {/* Reading Mode Toggle */}
                <button
                    onClick={onToggleReadingMode}
                    className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/10"
                    title={readingMode === 'longstrip' ? 'Switch to Page View' : 'Switch to Longstrip'}
                >
                    {readingMode === 'longstrip' ? (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                    ) : (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                    )}
                </button>

                {/* Zoom Controls (Desktop) */}
                <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1 border border-white/10 hidden sm:flex">
                    <button onClick={onZoomOut} className="p-1.5 hover:bg-white/10 rounded text-gray-300 hover:text-white">
                        <ZoomOut className="w-3 h-3 md:w-4 md:h-4" />
                    </button>
                    <span className="text-[10px] md:text-xs font-mono w-8 md:w-10 text-center text-gray-400">{zoomLevel}%</span>
                    <button onClick={onZoomIn} className="p-1.5 hover:bg-white/10 rounded text-gray-300 hover:text-white">
                        <ZoomIn className="w-3 h-3 md:w-4 md:h-4" />
                    </button>
                </div>

                {/* Toggle Details */}
                <button
                    onClick={onToggleDetails}
                    className={`p-2 rounded-lg transition-colors ${showDetails ? 'bg-yorumi-manga text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
                    title="Toggle Details"
                >
                    <Info className="w-5 h-5" />
                </button>
            </div>
        </header>
    );
}

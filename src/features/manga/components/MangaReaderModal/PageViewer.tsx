import { useState, useRef, useEffect } from 'react';
import { ChevronUp } from 'lucide-react';
import type { MangaPage, MangaChapter } from '../../../../types/manga';
import sleepingGif from '../../../../assets/sleeping.gif';

interface PageViewerProps {
    pages: MangaPage[];
    currentChapter: MangaChapter | null;
    prevChapter: MangaChapter | null;
    nextChapter: MangaChapter | null;
    readingMode: 'longstrip' | 'page';
    zoomLevel: number;
    pageIndex: number;
    isLoading: boolean;
    isHeaderVisible: boolean;
    onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
    onContentClick: () => void;
    onLoadChapter: (chapter: MangaChapter) => void;
    onPageChange: (index: number) => void;
}

export default function PageViewer({
    pages,
    currentChapter,
    prevChapter,
    nextChapter,
    readingMode,
    zoomLevel,
    pageIndex,
    isLoading,
    isHeaderVisible,
    onScroll,
    onContentClick,
    onLoadChapter,
    onPageChange,
}: PageViewerProps) {
    const [showScrollTop, setShowScrollTop] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Sequential image preloader: loads Page 1 first, then Page 2, 3... 50 in strict order
    useEffect(() => {
        if (!pages || pages.length === 0) return;
        let isCancelled = false;

        const preloadSequentially = (index: number) => {
            if (isCancelled || index >= pages.length) return;
            const img = new Image();
            img.src = pages[index].imageUrl;
            img.onload = () => {
                if (!isCancelled) preloadSequentially(index + 1);
            };
            img.onerror = () => {
                if (!isCancelled) preloadSequentially(index + 1);
            };
        };

        // Page 1 is fetched first, followed by remaining pages in order
        preloadSequentially(0);

        return () => {
            isCancelled = true;
        };
    }, [pages]);

    const handleNextPage = () => {
        if (pageIndex < pages.length - 1) {
            onPageChange(pageIndex + 1);
        } else if (nextChapter) {
            onLoadChapter(nextChapter);
        }
    };

    const handlePrevPage = () => {
        if (pageIndex > 0) {
            onPageChange(pageIndex - 1);
        } else if (prevChapter) {
            onLoadChapter(prevChapter);
        }
    };

    const handlePageClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const width = e.currentTarget.offsetWidth;
        const clickX = e.nativeEvent.offsetX;
        if (clickX < width / 3) handleNextPage();
        else if (clickX > (width * 2 / 3)) handlePrevPage();
        else onContentClick();
    };

    const handleScrollInternal = (e: React.UIEvent<HTMLDivElement>) => {
        onScroll(e);
        setShowScrollTop(e.currentTarget.scrollTop > 500);
    };

    const scrollToTop = () => {
        scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="flex-1 min-w-0 bg-[#050505] relative flex flex-col border-r border-white/5">
            <div
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto relative h-full [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']"
                onScroll={handleScrollInternal}
            >
                {isLoading ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 py-20 text-center">
                        <img src={sleepingGif} alt="Loading..." className="w-32 h-32 object-contain animate-bounce" />
                        <p className="text-yorumi-manga font-bold text-base tracking-wide animate-pulse">Loading chapter content...</p>
                    </div>
                ) : pages.length > 0 ? (
                    readingMode === 'longstrip' ? (
                        // LONGSTRIP MODE
                        <div className="flex flex-col items-center pb-8 min-h-full" onClick={onContentClick}>
                            {pages.map((page, index) => (
                                <div
                                    key={`${page.pageNumber}-${index}`}
                                    className="w-full flex justify-center min-h-[300px] bg-black/10 relative"
                                >
                                    <img
                                        src={page.imageUrl}
                                        alt={`Page ${page.pageNumber}`}
                                        className="transition-opacity duration-300 block shadow-2xl"
                                        style={{ width: `${zoomLevel}%`, maxWidth: '100%' }}
                                        loading={index === 0 ? 'eager' : 'lazy'}
                                        decoding={index === 0 ? 'sync' : 'async'}
                                        fetchPriority={index === 0 ? 'high' : 'auto'}
                                    />
                                </div>
                            ))}

                            {/* Chapter Navigation at Bottom */}
                            <div className="flex flex-row gap-2 md:gap-4 mt-8 pb-8 px-4 w-full max-w-2xl justify-center">
                                {prevChapter && (
                                    <button
                                        onClick={() => onLoadChapter(prevChapter)}
                                        className="flex-1 px-3 md:px-8 py-3 md:py-4 bg-white/10 hover:bg-white/20 text-white text-sm md:text-base font-bold rounded-full transition-transform hover:scale-105 border border-white/10 flex items-center justify-center gap-1 md:gap-2"
                                    >
                                        <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                        </svg>
                                        <span className="truncate">Prev Chapter</span>
                                    </button>
                                )}
                                {nextChapter && (
                                    <button
                                        onClick={() => onLoadChapter(nextChapter)}
                                        className="flex-1 px-3 md:px-8 py-3 md:py-4 bg-yorumi-manga text-white text-sm md:text-base font-bold rounded-full hover:scale-105 transition-transform shadow-lg shadow-yorumi-manga/20 flex items-center justify-center gap-1 md:gap-2"
                                    >
                                        <span className="truncate">Next Chapter</span>
                                        <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : (
                        // SINGLE PAGE MODE (Right to Left)
                        <div
                            className="flex items-center justify-center h-full w-full relative group select-none"
                            onClick={handlePageClick}
                        >
                            <img
                                src={pages[pageIndex]?.imageUrl}
                                alt={`Page ${pageIndex + 1}`}
                                className="max-h-full max-w-full object-contain shadow-2xl"
                                style={{ transform: `scale(${zoomLevel / 100})` }}
                                loading="eager"
                                decoding="async"
                                fetchPriority="high"
                            />

                            {/* Click Zone Overlays */}
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

            {/* Scroll to Top Button */}
            <button
                onClick={scrollToTop}
                className={`absolute right-6 z-40 w-12 h-12 rounded-full bg-yorumi-manga text-black shadow-lg flex items-center justify-center transition-all duration-300 hover:bg-yorumi-manga/90 hover:scale-110 active:scale-95 ${
                    showScrollTop ? 'opacity-100 pointer-events-auto translate-y-0' : 'opacity-0 pointer-events-none translate-y-4'
                }`}
                style={{ bottom: isHeaderVisible ? '6rem' : '1.5rem' }}
                title="Scroll to Top"
            >
                <ChevronUp className="w-6 h-6" strokeWidth={2.5} />
            </button>
        </div>
    );
}

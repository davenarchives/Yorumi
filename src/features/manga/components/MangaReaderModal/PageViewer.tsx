import { useRef, useEffect, useState, useCallback } from 'react';
import type { MangaPage, MangaChapter } from '../../../../types/manga';
import sleepingGif from '../../../../assets/sleeping.gif';
import { createLocalMediaProxyUrl } from '../../../../platform/localMediaProxy';
import { isTauri } from '../../../../platform/runtime';

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

const appendRetryParam = (url: string, attempt: number): string => {
    if (!url || /^data:|^blob:/i.test(url)) return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}_retry=${attempt}`;
};

function MangaPageImage({
    src,
    pageNumber,
    className,
    style,
    eager = false,
}: {
    src: string;
    pageNumber: number;
    className: string;
    style?: React.CSSProperties;
    eager?: boolean;
}) {
    const [activeSrc, setActiveSrc] = useState(src);
    const [retryCount, setRetryCount] = useState(0);
    const [loaded, setLoaded] = useState(false);
    const [failed, setFailed] = useState(false);
    const imgRef = useRef<HTMLImageElement | null>(null);
    const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (retryTimerRef.current) {
            clearTimeout(retryTimerRef.current);
            retryTimerRef.current = null;
        }
        setActiveSrc(src);
        setRetryCount(0);
        setFailed(false);
        // Immediately reveal if already decoded in browser cache so spinner never sticks
        const el = imgRef.current;
        if (el && el.complete && el.naturalWidth > 0 && el.src === src) {
            setLoaded(true);
        } else {
            setLoaded(false);
        }
    }, [src]);

    useEffect(() => {
        const el = imgRef.current;
        if (!loaded && el && el.complete && el.naturalWidth > 0) {
            setLoaded(true);
        }
    }, [activeSrc, loaded]);

    useEffect(() => () => {
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    }, []);

    const handleError = useCallback(() => {
        if (retryCount >= 3) {
            setFailed(true);
            return;
        }

        const nextAttempt = retryCount + 1;
        setRetryCount(nextAttempt);

        // On Tauri, if a direct remote HTTPS image fails (hotlink/referer block), switch to local proxy
        const isDirectRemote = /^https?:\/\//i.test(src) && !src.includes('yorumi-media.localhost') && !src.includes('127.0.0.1');
        const delayMs = nextAttempt === 1 ? 600 : nextAttempt * 1000;

        retryTimerRef.current = setTimeout(() => {
            retryTimerRef.current = null;
            if (isTauri() && isDirectRemote && nextAttempt === 1) {
                void createLocalMediaProxyUrl(src, '').then((proxied) => {
                    setActiveSrc(appendRetryParam(proxied, nextAttempt));
                });
            } else {
                setActiveSrc(appendRetryParam(src, nextAttempt));
            }
        }, delayMs);
    }, [retryCount, src]);

    const handleManualRetry = (e: React.MouseEvent) => {
        e.stopPropagation();
        setFailed(false);
        setLoaded(false);
        const nextAttempt = retryCount + 1;
        setRetryCount(nextAttempt);
        setActiveSrc(appendRetryParam(src, nextAttempt));
    };

    if (failed) {
        return (
            <div className="flex min-h-[360px] w-full flex-col items-center justify-center gap-3 bg-white/[0.03] px-4 py-12 text-center">
                <span className="text-xs font-medium text-white/50">Failed to load Page {pageNumber}</span>
                <button
                    type="button"
                    onClick={handleManualRetry}
                    className="rounded-lg border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/20 cursor-pointer"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <>
            {!loaded && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/[0.02]">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/15 border-t-white/60" />
                </div>
            )}
            <img
                ref={imgRef}
                src={activeSrc}
                alt={`Page ${pageNumber}`}
                referrerPolicy="no-referrer"
                className={`${className} ${loaded ? 'opacity-100' : 'opacity-0'}`}
                style={style}
                loading={eager ? 'eager' : 'lazy'}
                decoding="async"
                fetchPriority={eager ? 'high' : 'auto'}
                onLoad={() => {
                    setLoaded(true);
                    setFailed(false);
                }}
                onError={handleError}
            />
        </>
    );
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
    isHeaderVisible: _isHeaderVisible,
    onScroll,
    onContentClick,
    onLoadChapter,
    onPageChange,
}: PageViewerProps) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Gentle 2-worker preloader delayed briefly so Page 1 gets full upstream bandwidth without throttling
    useEffect(() => {
        if (!pages || pages.length <= 1) return;
        let isCancelled = false;
        let nextIndex = 2;
        const CONCURRENCY = 2;

        const runWorker = () => {
            if (isCancelled || nextIndex >= pages.length) return;
            const current = nextIndex++;
            const img = new Image();
            img.referrerPolicy = 'no-referrer';
            img.decoding = 'async';
            img.onload = runWorker;
            img.onerror = runWorker;
            img.src = pages[current].imageUrl;
        };

        const timer = setTimeout(() => {
            const workerCount = Math.min(CONCURRENCY, Math.max(0, pages.length - 2));
            for (let i = 0; i < workerCount; i += 1) {
                runWorker();
            }
        }, 400);

        return () => {
            isCancelled = true;
            clearTimeout(timer);
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
                                    <MangaPageImage
                                        src={page.imageUrl}
                                        pageNumber={page.pageNumber}
                                        className="transition-opacity duration-100 block shadow-2xl"
                                        style={{ width: `${zoomLevel}%`, maxWidth: '100%' }}
                                        eager={index < 2}
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
                            {pages[pageIndex] && (
                                <MangaPageImage
                                    src={pages[pageIndex].imageUrl}
                                    pageNumber={pageIndex + 1}
                                    className="max-h-full max-w-full object-contain shadow-2xl transition-opacity duration-200"
                                    style={{ transform: `scale(${zoomLevel / 100})` }}
                                    eager
                                />
                            )}

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
        </div>
    );
}

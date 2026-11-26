import { useRef, useEffect, useState, useCallback } from 'react';
import type { MangaPage, MangaChapter } from '../../../../types/manga';
import sleepingGif from '../../../../assets/sleeping.gif';
import { createLocalMediaProxyUrl } from '../../../../platform/localMediaProxy';
import { isTauri } from '../../../../platform/runtime';

export type MangaReadingMode =
    | 'default'
    | 'paged-ltr'
    | 'paged-rtl'
    | 'paged-vertical'
    | 'longstrip'
    | 'longstrip-gaps';

interface PageViewerProps {
    pages: MangaPage[];
    chapters?: MangaChapter[];
    currentChapter: MangaChapter | null;
    prevChapter: MangaChapter | null;
    nextChapter: MangaChapter | null;
    readingMode: MangaReadingMode;
    zoomLevel: number;
    pageIndex: number;
    isLoading: boolean;
    isHeaderVisible: boolean;
    onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
    onContentClick: () => void;
    onLoadChapter: (chapter: MangaChapter) => void;
    onActiveChapterChange?: (chapter: MangaChapter) => void;
    onFetchChapterPages?: (chapter: MangaChapter) => Promise<MangaPage[]>;
    onPageChange: (index: number) => void;
}

interface ChapterSegment {
    chapter: MangaChapter;
    pages: MangaPage[];
    loading?: boolean;
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
    chapters = [],
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
    onActiveChapterChange,
    onFetchChapterPages,
    onPageChange,
}: PageViewerProps) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const pagedContainerRef = useRef<HTMLDivElement>(null);
    const nextChapterSentinelRef = useRef<HTMLDivElement>(null);
    const segmentRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const appendingRef = useRef<string | null>(null);
    const pageTrackerRafRef = useRef<number | null>(null);
    const pagedScrollRafRef = useRef<number | null>(null);
    const [segments, setSegments] = useState<ChapterSegment[]>(() =>
        currentChapter ? [{ chapter: currentChapter, pages }] : []
    );
    const [longstripPageIndicator, setLongstripPageIndicator] = useState<{ current: number; total: number } | null>(null);

    const getNextChapterFor = useCallback(
        (ch: MangaChapter | null): MangaChapter | null => {
            if (!ch || chapters.length === 0) return null;
            const idx = chapters.findIndex((c) => c.url === ch.url);
            return idx > 0 ? chapters[idx - 1] : null;
        },
        [chapters]
    );

    // Sync initial/explicitly selected chapter into segments without wiping when scrolling inside existing segments
    useEffect(() => {
        if (!currentChapter) return;
        setSegments((prev) => {
            const existingIdx = prev.findIndex((s) => s.chapter.url === currentChapter.url);
            if (existingIdx !== -1) {
                // Already in our continuous stream — only hydrate pages if it was empty
                if (prev[existingIdx].pages.length === 0 && pages.length > 0) {
                    const next = [...prev];
                    next[existingIdx] = { ...next[existingIdx], pages, loading: false };
                    return next;
                }
                return prev;
            }
            // Explicit jump to a new chapter outside the stream: reset stream and scroll to top
            appendingRef.current = null;
            if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollTop = 0;
            }
            return [{ chapter: currentChapter, pages }];
        });
    }, [currentChapter, pages]);

    const lastSegment = segments[segments.length - 1] || null;
    const tailNextChapter = lastSegment ? getNextChapterFor(lastSegment.chapter) : nextChapter;

    // Mihon-style seamless multi-chapter append: preload & append next chapter right below
    // the Finished / Next transition card without ever jumping scroll position, so users
    // can scroll continuously forward AND back up into previous chapters!
    const appendNextChapter = useCallback(async () => {
        if (!tailNextChapter || !onFetchChapterPages) return;
        const targetUrl = tailNextChapter.url;
        if (appendingRef.current === targetUrl) return;
        if (segments.some((s) => s.chapter.url === targetUrl)) return;

        appendingRef.current = targetUrl;
        setSegments((prev) => {
            if (prev.some((s) => s.chapter.url === targetUrl)) return prev;
            return [...prev, { chapter: tailNextChapter, pages: [], loading: true }];
        });

        try {
            const nextPages = await onFetchChapterPages(tailNextChapter);
            setSegments((prev) => {
                const updated = prev.map((seg) =>
                    seg.chapter.url === targetUrl
                        ? { ...seg, pages: nextPages, loading: false }
                        : seg
                );
                // Keep a generous 8-chapter sliding window in DOM for smooth mobile memory usage
                return updated.length > 8 ? updated.slice(updated.length - 8) : updated;
            });
        } finally {
            if (appendingRef.current === targetUrl) {
                appendingRef.current = null;
            }
        }
    }, [tailNextChapter, onFetchChapterPages, segments]);

    const isLongstripMode = readingMode === 'default' || readingMode === 'longstrip' || readingMode === 'longstrip-gaps';
    const hasStripGaps = readingMode === 'longstrip-gaps';
    const isPagedVertical = readingMode === 'paged-vertical';
    const isPagedRtl = readingMode === 'paged-rtl';

    // Trigger background append as user approaches the bottom of the last loaded chapter
    useEffect(() => {
        if (!isLongstripMode || isLoading || !tailNextChapter || !onFetchChapterPages) return;
        if (!lastSegment || lastSegment.loading || lastSegment.pages.length === 0) return;
        const root = scrollContainerRef.current;
        const sentinel = nextChapterSentinelRef.current;
        if (!root || !sentinel || typeof IntersectionObserver === 'undefined') return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    void appendNextChapter();
                }
            },
            { root, rootMargin: '900px 0px', threshold: 0.01 }
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [isLongstripMode, isLoading, tailNextChapter, onFetchChapterPages, lastSegment, appendNextChapter]);

    // Track which chapter segment is currently in the middle of the viewport (works scrolling DOWN and UP!)
    useEffect(() => {
        if (!isLongstripMode || !onActiveChapterChange || segments.length <= 1) return;
        const root = scrollContainerRef.current;
        if (!root || typeof IntersectionObserver === 'undefined') return;

        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (!entry.isIntersecting) continue;
                    const chUrl = entry.target.getAttribute('data-chapter-url');
                    const matched = segments.find((s) => s.chapter.url === chUrl);
                    if (matched && matched.chapter.url !== currentChapter?.url) {
                        onActiveChapterChange(matched.chapter);
                        break;
                    }
                }
            },
            { root, rootMargin: '-40% 0px -40% 0px', threshold: 0 }
        );

        segmentRefs.current.forEach((el) => observer.observe(el));
        return () => observer.disconnect();
    }, [isLongstripMode, onActiveChapterChange, segments, currentChapter?.url]);

    // Fast 4-worker rolling preloader for the currently active/latest segment pages
    useEffect(() => {
        const targetPages = lastSegment?.pages?.length ? lastSegment.pages : pages;
        if (!targetPages || targetPages.length <= 5) return;
        let isCancelled = false;
        let nextIndex = 5;
        const CONCURRENCY = 4;

        const runWorker = () => {
            if (isCancelled || nextIndex >= targetPages.length) return;
            const current = nextIndex++;
            const img = new Image();
            img.referrerPolicy = 'no-referrer';
            img.decoding = 'async';
            img.onload = runWorker;
            img.onerror = runWorker;
            img.src = targetPages[current].imageUrl;
        };

        const timer = setTimeout(() => {
            const workerCount = Math.min(CONCURRENCY, Math.max(0, targetPages.length - 5));
            for (let i = 0; i < workerCount; i += 1) {
                runWorker();
            }
        }, 80);

        return () => {
            isCancelled = true;
            clearTimeout(timer);
        };
    }, [lastSegment?.chapter.url, lastSegment?.pages, pages]);

    const scrollToPagedIndex = useCallback((targetIndex: number, behavior: ScrollBehavior = 'smooth') => {
        const el = pagedContainerRef.current;
        if (!el) return;
        if (isPagedVertical) {
            el.scrollTo({ top: targetIndex * el.clientHeight, behavior });
        } else {
            const offset = targetIndex * el.clientWidth;
            el.scrollTo({ left: isPagedRtl ? -offset : offset, behavior });
        }
    }, [isPagedRtl, isPagedVertical]);

    const handleNextPage = () => {
        if (pageIndex < pages.length - 1) {
            const next = pageIndex + 1;
            onPageChange(next);
            scrollToPagedIndex(next, 'smooth');
        } else if (nextChapter) {
            onLoadChapter(nextChapter);
        }
    };

    const handlePrevPage = () => {
        if (pageIndex > 0) {
            const prev = pageIndex - 1;
            onPageChange(prev);
            scrollToPagedIndex(prev, 'smooth');
        } else if (prevChapter) {
            onLoadChapter(prevChapter);
        }
    };

    // Reset paged scroll position to Page 1 when chapter or reading mode changes
    useEffect(() => {
        if (isLongstripMode) return;
        const el = pagedContainerRef.current;
        if (el) {
            el.scrollTo({ left: 0, top: 0, behavior: 'auto' });
        }
    }, [currentChapter?.url, readingMode, isLongstripMode]);

    const handlePagedScroll = (e: React.UIEvent<HTMLDivElement>) => {
        onScroll(e);
        if (pagedScrollRafRef.current !== null) return;
        const el = e.currentTarget;
        pagedScrollRafRef.current = requestAnimationFrame(() => {
            pagedScrollRafRef.current = null;
            if (!el) return;
            const size = isPagedVertical ? el.clientHeight : el.clientWidth;
            if (size <= 0) return;
            const rawPos = isPagedVertical ? el.scrollTop : Math.abs(el.scrollLeft);
            const idx = Math.round(rawPos / size);
            if (idx >= 0 && idx < pages.length && idx !== pageIndex) {
                onPageChange(idx);
            }
        });
    };

    const handlePageClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        if (isPagedVertical) {
            const clickY = e.clientY - rect.top;
            if (clickY < rect.height / 3) handlePrevPage();
            else if (clickY > (rect.height * 2) / 3) handleNextPage();
            else onContentClick();
            return;
        }
        const clickX = e.clientX - rect.left;
        const isLtr = readingMode === 'paged-ltr';
        if (clickX < rect.width / 3) {
            if (isLtr) handlePrevPage();
            else handleNextPage();
        } else if (clickX > (rect.width * 2) / 3) {
            if (isLtr) handleNextPage();
            else handlePrevPage();
        } else {
            onContentClick();
        }
    };

    const updateVisiblePageIndicator = useCallback(() => {
        const root = scrollContainerRef.current;
        if (!root || !isLongstripMode) return;
        const rootRect = root.getBoundingClientRect();
        const probeY = rootRect.top + rootRect.height * 0.5;
        const pageNodes = root.querySelectorAll<HTMLElement>('[data-reader-page]');
        for (let i = 0; i < pageNodes.length; i += 1) {
            const rect = pageNodes[i].getBoundingClientRect();
            if (rect.top <= probeY && rect.bottom >= probeY) {
                const current = Number(pageNodes[i].dataset.readerPage || 0);
                const total = Number(pageNodes[i].dataset.readerTotal || 0);
                if (current > 0 && total > 0) {
                    setLongstripPageIndicator((prev) =>
                        prev && prev.current === current && prev.total === total ? prev : { current, total }
                    );
                }
                return;
            }
        }
    }, [isLongstripMode]);

    // Initialize indicator when first segment loads
    useEffect(() => {
        if (!isLongstripMode) return;
        const firstLoaded = segments.find((s) => s.pages.length > 0);
        if (firstLoaded) {
            setLongstripPageIndicator((prev) => prev || { current: 1, total: firstLoaded.pages.length });
            const raf = requestAnimationFrame(updateVisiblePageIndicator);
            return () => cancelAnimationFrame(raf);
        }
    }, [isLongstripMode, segments, updateVisiblePageIndicator]);

    useEffect(() => () => {
        if (pageTrackerRafRef.current !== null) {
            cancelAnimationFrame(pageTrackerRafRef.current);
        }
    }, []);

    const handleScrollInternal = (e: React.UIEvent<HTMLDivElement>) => {
        onScroll(e);
        if (isLongstripMode && pageTrackerRafRef.current === null) {
            pageTrackerRafRef.current = requestAnimationFrame(() => {
                pageTrackerRafRef.current = null;
                updateVisiblePageIndicator();
            });
        }
    };

    const activePageIndicator = !isLongstripMode
        ? (pages.length > 0 ? { current: pageIndex + 1, total: pages.length } : null)
        : longstripPageIndicator;

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
                    isLongstripMode ? (
                        // SEAMLESS MULTI-CHAPTER LONGSTRIP MODE (Mihon-style)
                        <div className="flex flex-col items-center min-h-full" onClick={onContentClick}>
                            {segments.map((segment, segIdx) => {
                                const segNextChapter = getNextChapterFor(segment.chapter);
                                const isLastSegment = segIdx === segments.length - 1;
                                return (
                                    <div
                                        key={segment.chapter.url}
                                        data-chapter-url={segment.chapter.url}
                                        ref={(el) => {
                                            if (el) segmentRefs.current.set(segment.chapter.url, el);
                                            else segmentRefs.current.delete(segment.chapter.url);
                                        }}
                                        className={`w-full flex flex-col items-center ${hasStripGaps ? 'gap-3 bg-[#0a0a0a]' : ''}`}
                                    >
                                        {segment.loading ? (
                                            <div className="w-full bg-black py-20 flex flex-col items-center justify-center gap-3">
                                                <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/15 border-t-yorumi-manga" />
                                                <span className="text-xs text-zinc-400">Loading {segment.chapter.title}…</span>
                                            </div>
                                        ) : (
                                            segment.pages.map((page, index) => (
                                                <div
                                                    key={`${segment.chapter.url}-${page.pageNumber}-${index}`}
                                                    data-reader-page={index + 1}
                                                    data-reader-total={segment.pages.length}
                                                    className="w-full flex justify-center min-h-[300px] bg-black/10 relative"
                                                >
                                                    <MangaPageImage
                                                        src={page.imageUrl}
                                                        pageNumber={page.pageNumber}
                                                        className="transition-opacity duration-100 block shadow-2xl"
                                                        style={{ width: `${zoomLevel}%`, maxWidth: '100%' }}
                                                        eager={index < 5}
                                                    />
                                                </div>
                                            ))
                                        )}

                                        {/* Mihon-style chapter transition divider between chapters */}
                                        {!segment.loading && segment.pages.length > 0 && (
                                            <div
                                                className="w-full bg-black px-8 sm:px-12 py-20 sm:py-28 flex flex-col justify-center min-h-[45vh]"
                                                onClick={(e) => {
                                                    if (isLastSegment && segNextChapter && !onFetchChapterPages) {
                                                        e.stopPropagation();
                                                        onLoadChapter(segNextChapter);
                                                    }
                                                }}
                                            >
                                                <div className="mx-auto w-full max-w-md space-y-10 text-left">
                                                    <div className="space-y-1.5">
                                                        <p className="text-[15px] font-bold text-white">Finished:</p>
                                                        <p className="text-[20px] sm:text-[22px] font-normal leading-snug text-white">
                                                            {segment.chapter.title}
                                                        </p>
                                                        <p className="text-[13px] text-zinc-400">
                                                            {segment.chapter.uploadDate || 'MangaKatana'}
                                                        </p>
                                                    </div>

                                                    {segNextChapter ? (
                                                        <div className="space-y-1.5">
                                                            <p className="text-[15px] font-bold text-white">Next:</p>
                                                            <p className="text-[20px] sm:text-[22px] font-normal leading-snug text-white">
                                                                {segNextChapter.title}
                                                            </p>
                                                            <p className="text-[13px] text-zinc-400">
                                                                {segNextChapter.uploadDate || 'MangaKatana'}
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-1.5">
                                                            <p className="text-[15px] font-bold text-zinc-400">There&apos;s no next chapter</p>
                                                        </div>
                                                    )}
                                                </div>

                                                {isLastSegment && segNextChapter && (
                                                    <div
                                                        ref={nextChapterSentinelRef}
                                                        className="mt-14 h-8 w-full"
                                                        aria-hidden="true"
                                                    />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        // INTERACTIVE 60FPS SCROLL-SNAP PAGED MODE (LTR / RTL / Vertical)
                        <div
                            ref={pagedContainerRef}
                            dir={isPagedRtl ? 'rtl' : 'ltr'}
                            onScroll={handlePagedScroll}
                            onClick={handlePageClick}
                            className={`h-full w-full flex select-none bg-black [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] ${
                                isPagedVertical
                                    ? 'flex-col overflow-y-auto overflow-x-hidden snap-y snap-mandatory'
                                    : 'flex-row overflow-x-auto overflow-y-hidden snap-x snap-mandatory'
                            }`}
                            style={{ WebkitOverflowScrolling: 'touch' }}
                        >
                            {pages.map((page, idx) => {
                                const isNearActive = Math.abs(idx - pageIndex) <= 3;
                                return (
                                    <div
                                        key={`${currentChapter?.url || 'ch'}-${page.pageNumber}-${idx}`}
                                        dir="ltr"
                                        className="relative h-full w-full shrink-0 snap-center snap-always flex items-center justify-center bg-black overflow-hidden"
                                    >
                                        <MangaPageImage
                                            src={page.imageUrl}
                                            pageNumber={idx + 1}
                                            className="max-h-full max-w-full object-contain shadow-2xl transition-opacity duration-150"
                                            style={{ transform: `scale(${zoomLevel / 100})` }}
                                            eager={isNearActive}
                                        />
                                    </div>
                                );
                            })}

                            {/* Final slide: Mihon-style Finished / Next chapter card */}
                            <div
                                dir="ltr"
                                className="h-full w-full shrink-0 snap-center snap-always bg-black px-8 sm:px-12 flex flex-col justify-center"
                                onClick={(e) => {
                                    if (nextChapter) {
                                        e.stopPropagation();
                                        onLoadChapter(nextChapter);
                                    }
                                }}
                            >
                                <div className="mx-auto w-full max-w-md space-y-10 text-left">
                                    <div className="space-y-1.5">
                                        <p className="text-[15px] font-bold text-white">Finished:</p>
                                        <p className="text-[20px] sm:text-[22px] font-normal leading-snug text-white">
                                            {currentChapter?.title || 'Current Chapter'}
                                        </p>
                                        <p className="text-[13px] text-zinc-400">
                                            {currentChapter?.uploadDate || 'MangaKatana'}
                                        </p>
                                    </div>
                                    {nextChapter ? (
                                        <div className="space-y-1.5 cursor-pointer">
                                            <p className="text-[15px] font-bold text-white">Next:</p>
                                            <p className="text-[20px] sm:text-[22px] font-normal leading-snug text-white">
                                                {nextChapter.title}
                                            </p>
                                            <p className="text-[13px] text-zinc-400">
                                                Tap to read next chapter
                                            </p>
                                        </div>
                                    ) : (
                                        <p className="text-[15px] font-bold text-zinc-400">There&apos;s no next chapter</p>
                                    )}
                                </div>
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

            {/* Mihon-style bottom-center page number indicator (e.g. 1 / 8) */}
            {!isLoading && activePageIndicator && (
                <div
                    className={`pointer-events-none select-none absolute left-1/2 -translate-x-1/2 z-20 transition-opacity duration-200 ${
                        _isHeaderVisible ? 'opacity-0' : 'opacity-100'
                    }`}
                    style={{ bottom: 'calc(0.65rem + env(safe-area-inset-bottom, 0px))' }}
                    aria-live="off"
                >
                    <span
                        className="text-[13px] font-bold tracking-wide tabular-nums text-white"
                        style={{
                            textShadow:
                                '-1px -1px 0 rgba(0,0,0,0.9), 1px -1px 0 rgba(0,0,0,0.9), -1px 1px 0 rgba(0,0,0,0.9), 1px 1px 0 rgba(0,0,0,0.9), 0 1px 4px rgba(0,0,0,0.85)',
                        }}
                    >
                        {activePageIndicator.current} / {activePageIndicator.total}
                    </span>
                </div>
            )}
        </div>
    );
}

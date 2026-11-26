import { useState, useEffect, useRef } from 'react';
import { X, ZoomIn, ZoomOut } from 'lucide-react';
import { useContinueReading } from '../../../../hooks/useContinueReading';
import type { Manga, MangaChapter, MangaPage } from '../../../../types/manga';
import ReaderHeader from './ReaderHeader';
import ReaderFooter from './ReaderFooter';
import PageViewer, { type MangaReadingMode } from './PageViewer';
import MangaInfoSidebar from './MangaInfoSidebar';
import { useTitleLanguage } from '../../../../context/TitleLanguageContext';
import { getDisplayTitle } from '../../../../utils/titleLanguage';
import discordRPCService from '../../../../services/discordRPCService';
import { isNativeMobile } from '../../../../platform/runtime';
import { enterImmersiveMode, exitImmersiveMode } from '../../../../platform/immersiveMode';

const READING_MODE_KEY = 'yorumi_manga_reading_mode_v1';
const READING_MODE_OPTIONS: Array<{ id: MangaReadingMode; label: string }> = [
    { id: 'default', label: 'Default' },
    { id: 'paged-ltr', label: 'Paged (left to right)' },
    { id: 'paged-rtl', label: 'Paged (right to left)' },
    { id: 'paged-vertical', label: 'Paged (vertical)' },
    { id: 'longstrip', label: 'Long strip' },
    { id: 'longstrip-gaps', label: 'Long strip with gaps' },
];

const readSavedReadingMode = (): MangaReadingMode => {
    try {
        const raw = localStorage.getItem(READING_MODE_KEY) as MangaReadingMode | null;
        if (raw && READING_MODE_OPTIONS.some((opt) => opt.id === raw)) return raw;
    } catch {
        // Ignore storage errors
    }
    return 'default';
};

type FullscreenElement = HTMLDivElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
};

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
    onActiveChapterChange?: (chapter: MangaChapter) => void;
    onFetchChapterPages?: (chapter: MangaChapter) => Promise<MangaPage[]>;
    onPrefetchChapter: (chapter: MangaChapter) => void;
    onZoomIn: () => void;
    onZoomOut: () => void;
    readChapters?: Set<string>;
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
    onActiveChapterChange,
    onFetchChapterPages,
    onPrefetchChapter,
    onZoomIn,
    onZoomOut,
    readChapters = new Set()
}: MangaReaderModalProps) {
    const { language } = useTitleLanguage();
    // UI State
    const [showDetails, setShowDetails] = useState(false);
    const [showChapters, setShowChapters] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [readingMode, setReadingMode] = useState<MangaReadingMode>(readSavedReadingMode);
    const [pageIndex, setPageIndex] = useState(0);
    const [isHeaderVisible, setIsHeaderVisible] = useState(false);

    const handleSelectReadingMode = (mode: MangaReadingMode) => {
        setReadingMode(mode);
        try {
            localStorage.setItem(READING_MODE_KEY, mode);
        } catch {
            // Ignore storage errors
        }
    };

    // Sync system bars visibility with reader UI on mobile
    useEffect(() => {
        if (!isNativeMobile()) return;
        if (isHeaderVisible) {
            exitImmersiveMode().catch(() => undefined);
        } else {
            enterImmersiveMode().catch(() => undefined);
        }
    }, [isHeaderVisible]);

    const lastScrollY = useRef(0);
    const readerRootRef = useRef<HTMLDivElement>(null);
    const fullscreenAttemptedRef = useRef(false);
    const { saveProgress } = useContinueReading();

    // Discord Rich Presence update for Manga Reading
    useEffect(() => {
        if (isOpen && manga) {
            const title = getDisplayTitle(manga as unknown as Record<string, unknown>, language) || 'Manga';
            const chapterLabel = currentChapter ? (currentChapter.title || `Chapter ${currentChapter.id}`) : 'Reading';
            const coverImage = manga?.images?.jpg?.large_image_url
                || manga?.images?.jpg?.image_url
                || (manga as any)?.cover
                || (manga as any)?.image;
            discordRPCService.setReadingManga(
                title,
                chapterLabel,
                pages.length > 0 ? pageIndex + 1 : undefined,
                pages.length > 0 ? pages.length : undefined
            );
        }
        return () => {
            if (isOpen) {
                discordRPCService.setBrowsing('Manga');
            }
        };
    }, [isOpen, manga, currentChapter, pages.length, pageIndex, language]);

    // Save progress on chapter change
    useEffect(() => {
        if (currentChapter && manga && manga.title && manga.title !== 'Unknown Title') {
            const match = currentChapter.title.match(/Chapter\s+(\d+[.]?\d*)/i);
            const chapterNum = match ? match[1] : '1';
            saveProgress(manga, {
                id: currentChapter.id,
                chapter: chapterNum,
                title: currentChapter.title
            });
        }
    }, [currentChapter, manga, saveProgress]);

    // Reset page index on chapter change
    useEffect(() => {
        setPageIndex(0);
    }, [currentChapter?.url]);

    // Preload adjacent pages in paged modes
    useEffect(() => {
        if (!readingMode.startsWith('paged') || pages.length === 0) return;
        [1, 2, 3].forEach(offset => {
            const idx = pageIndex + offset;
            if (idx < pages.length && pages[idx]?.imageUrl) {
                const img = new Image();
                img.src = pages[idx].imageUrl;
            }
        });
        if (pageIndex > 0 && pages[pageIndex - 1]?.imageUrl) {
            const img = new Image();
            img.src = pages[pageIndex - 1].imageUrl;
        }
    }, [pageIndex, pages, readingMode]);

    // Handle responsive state
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

    useEffect(() => {
        const fullscreenRoot = readerRootRef.current;

        return () => {
            if (document.fullscreenElement === fullscreenRoot) {
                document.exitFullscreen().catch(() => undefined);
            }
        };
    }, []);

    if (!isOpen) return null;

    // Determine prev/next chapters
    const currentChapterIndex = chapters.findIndex(c => c.url === currentChapter?.url);
    const prevChapter = currentChapterIndex !== -1 && currentChapterIndex < chapters.length - 1
        ? chapters[currentChapterIndex + 1] : null;
    const nextChapter = currentChapterIndex !== -1 && currentChapterIndex > 0
        ? chapters[currentChapterIndex - 1] : null;

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const currentScrollY = e.currentTarget.scrollTop;
        const diff = currentScrollY - lastScrollY.current;

        // Hide top and bottom bars when scrolling
        if (Math.abs(diff) > 5) {
            setIsHeaderVisible(false);
            closeSidebars();
        }
        lastScrollY.current = currentScrollY;
    };

    const handleContentClick = () => {
        setIsHeaderVisible(prev => {
            if (prev) {
                // When hiding the UI, ensure dropdowns are reset
                closeSidebars();
            }
            return !prev;
        });
    };

    const requestMobileFullscreen = () => {
        if (isNativeMobile() || fullscreenAttemptedRef.current || window.innerWidth >= 768 || document.fullscreenElement) return;

        fullscreenAttemptedRef.current = true;
        const element = readerRootRef.current as FullscreenElement | null;

        if (element?.requestFullscreen) {
            element.requestFullscreen({ navigationUI: 'hide' }).catch(() => undefined);
            return;
        }

        const webkitRequestFullscreen = element?.webkitRequestFullscreen;
        if (webkitRequestFullscreen) {
            Promise.resolve(webkitRequestFullscreen.call(element)).catch(() => undefined);
        }
    };

    const closeSidebars = () => {
        setShowChapters(false);
        setShowDetails(false);
        setShowSettings(false);
    };

    return (
        <div
            ref={readerRootRef}
            className={`fixed inset-0 ${isNativeMobile() ? '' : 'top-8'} md:left-[70px] z-[130] md:z-[90] flex items-center justify-center bg-black/95 backdrop-blur-md transition-all duration-300`}
            onPointerDown={requestMobileFullscreen}
        >
            <div className="w-full h-full flex flex-col bg-[#0a0a0a] relative overflow-hidden">
                {/* Header */}
                <ReaderHeader
                    mangaTitle={getDisplayTitle(manga as unknown as Record<string, unknown>, language)}
                    mangaImage={manga.images.jpg.large_image_url}
                    currentChapter={currentChapter}
                    zoomLevel={zoomLevel}
                    isVisible={isHeaderVisible}
                    isSettingsOpen={showSettings}
                    onZoomIn={onZoomIn}
                    onZoomOut={onZoomOut}
                    onToggleSettings={() => {
                        setShowChapters(false);
                        setShowSettings((prev) => !prev);
                    }}
                    onClose={onClose}
                />

                {/* Mihon-style Reading Settings Sheet */}
                {showSettings && (
                    <div
                        className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs"
                        onClick={() => setShowSettings(false)}
                    >
                        <div
                            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl border-t sm:border border-white/10 bg-[#141417] px-5 pt-5 pb-7 sm:p-6 text-white shadow-2xl"
                            style={{ paddingBottom: 'calc(1.75rem + env(safe-area-inset-bottom, 0px))' }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-5">
                                <h2 className="text-base font-bold text-white">Reading settings</h2>
                                <button
                                    type="button"
                                    onClick={() => setShowSettings(false)}
                                    aria-label="Close reading settings"
                                    className="grid h-8 w-8 place-items-center rounded-full text-zinc-400 hover:bg-white/10 hover:text-white cursor-pointer"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="space-y-5">
                                <div>
                                    <p className="text-sm font-semibold text-zinc-300 mb-3">Reading mode</p>
                                    <div className="flex flex-wrap gap-2">
                                        {READING_MODE_OPTIONS.map((opt) => {
                                            const active = readingMode === opt.id;
                                            return (
                                                <button
                                                    key={opt.id}
                                                    type="button"
                                                    onClick={() => handleSelectReadingMode(opt.id)}
                                                    className={`rounded-xl px-3.5 py-2 text-[13px] font-semibold transition-colors cursor-pointer ${
                                                        active
                                                            ? 'bg-yorumi-manga/25 text-white border border-yorumi-manga/70'
                                                            : 'bg-white/[0.04] text-zinc-300 border border-white/15 hover:bg-white/[0.08] hover:text-white'
                                                    }`}
                                                >
                                                    {opt.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="sm:hidden pt-1 border-t border-white/10">
                                    <div className="flex items-center justify-between pt-4">
                                        <span className="text-sm font-semibold text-zinc-300">Zoom</span>
                                        <div className="flex items-center gap-1 bg-white/5 rounded-full p-1 border border-white/10">
                                            <button
                                                type="button"
                                                onClick={onZoomOut}
                                                className="p-1.5 hover:bg-white/10 rounded-full text-gray-300 hover:text-white transition-colors"
                                                aria-label="Zoom out"
                                            >
                                                <ZoomOut className="w-4 h-4" />
                                            </button>
                                            <span className="text-xs font-mono font-bold w-12 text-center text-gray-200">{zoomLevel}%</span>
                                            <button
                                                type="button"
                                                onClick={onZoomIn}
                                                className="p-1.5 hover:bg-white/10 rounded-full text-gray-300 hover:text-white transition-colors"
                                                aria-label="Zoom in"
                                            >
                                                <ZoomIn className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Main Layout */}
                <div className="flex-1 flex min-h-0 relative overflow-hidden">
                    {/* Mobile Backdrop */}
                    {(showChapters || showDetails) && (
                        <div
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm z-30 md:hidden"
                            onClick={closeSidebars}
                        />
                    )}

                    {/* ChapterList has been replaced by the dropdown in ReaderFooter */}

                    {/* Page Viewer */}
                    <PageViewer
                        pages={pages}
                        chapters={chapters}
                        currentChapter={currentChapter}
                        prevChapter={prevChapter}
                        nextChapter={nextChapter}
                        readingMode={readingMode}
                        zoomLevel={zoomLevel}
                        pageIndex={pageIndex}
                        isLoading={pagesLoading}
                        isHeaderVisible={isHeaderVisible}
                        onScroll={handleScroll}
                        onContentClick={handleContentClick}
                        onLoadChapter={onLoadChapter}
                        onActiveChapterChange={onActiveChapterChange}
                        onFetchChapterPages={onFetchChapterPages}
                        onPageChange={setPageIndex}
                    />

                    {/* Manga Info Sidebar */}
                    <MangaInfoSidebar
                        manga={manga}
                        showDetails={showDetails}
                        isHeaderVisible={isHeaderVisible}
                        onClose={onClose}
                    />
                </div>
                {/* Footer Overlay */}
                <ReaderFooter
                    chapters={chapters}
                    currentChapter={currentChapter}
                    prevChapter={prevChapter}
                    nextChapter={nextChapter}
                    isVisible={isHeaderVisible}
                    showChapters={showChapters}
                    readChapters={readChapters}
                    onLoadChapter={onLoadChapter}
                    onToggleChapters={() => setShowChapters(!showChapters)}
                />
            </div>
        </div>
    );
}

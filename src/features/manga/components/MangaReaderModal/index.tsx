import { useState, useEffect, useRef } from 'react';
import { useContinueReading } from '../../../../hooks/useContinueReading';
import type { Manga, MangaChapter, MangaPage } from '../../../../types/manga';
import ReaderHeader from './ReaderHeader';
import ReaderFooter from './ReaderFooter';
import PageViewer from './PageViewer';
import MangaInfoSidebar from './MangaInfoSidebar';
import { useTitleLanguage } from '../../../../context/TitleLanguageContext';
import { getDisplayTitle } from '../../../../utils/titleLanguage';
import discordRPCService from '../../../../services/discordRPCService';

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
    onPrefetchChapter,
    onZoomIn,
    onZoomOut,
    readChapters = new Set()
}: MangaReaderModalProps) {
    const { language } = useTitleLanguage();
    // UI State
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
    const [showDetails, setShowDetails] = useState(false);
    const [showChapters, setShowChapters] = useState(false);
    const [readingMode, setReadingMode] = useState<'longstrip' | 'page'>('longstrip');
    const [pageIndex, setPageIndex] = useState(0);
    const [isHeaderVisible, setIsHeaderVisible] = useState(false);

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

    // Preload adjacent pages
    useEffect(() => {
        if (readingMode !== 'page' || pages.length === 0) return;
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
        if (fullscreenAttemptedRef.current || window.innerWidth >= 768 || document.fullscreenElement) return;

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
    };

    return (
        <div
            ref={readerRootRef}
            className="fixed inset-0 md:left-[70px] z-[130] md:z-[90] flex items-center justify-center bg-black/95 backdrop-blur-md transition-all duration-300"
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
                    onZoomIn={onZoomIn}
                    onZoomOut={onZoomOut}
                />

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

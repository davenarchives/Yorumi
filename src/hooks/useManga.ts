import { useState, useEffect, useRef, useCallback } from 'react';
import type { Manga, MangaChapter, MangaPage } from '../types/manga';
import { mangaService } from '../services/mangaService';

export type MangaViewMode = 'default' | 'popular_manhwa' | 'all_time_popular' | 'top_100';

export function useManga() {
    const [topManga, setTopManga] = useState<Manga[]>([]);
    const [selectedManga, setSelectedManga] = useState<Manga | null>(null);
    const [showMangaDetails, setShowMangaDetails] = useState(false);
    const [mangaPage, setMangaPage] = useState(1);
    const [mangaLastPage, setMangaLastPage] = useState(1);
    const [mangaLoading, setMangaLoading] = useState(false);

    const [mangaChapters, setMangaChapters] = useState<MangaChapter[]>([]);
    const [currentMangaChapter, setCurrentMangaChapter] = useState<MangaChapter | null>(null);
    const [chapterPages, setChapterPages] = useState<MangaPage[]>([]);
    const [mangaChaptersLoading, setMangaChaptersLoading] = useState(false);
    const [mangaPagesLoading, setMangaPagesLoading] = useState(false);
    const [chapterSearchQuery, setChapterSearchQuery] = useState('');
    const [zoomLevel, setZoomLevel] = useState(60);

    // View All state
    const [viewMode, setViewMode] = useState<MangaViewMode>('default');
    const [viewAllManga, setViewAllManga] = useState<Manga[]>([]);
    const [viewAllLoading, setViewAllLoading] = useState(false);
    const [viewAllPagination, setViewAllPagination] = useState({ currentPage: 1, lastPage: 1 });

    const mangaIdCache = useRef(new Map<number | string, string>());
    const mangaChaptersCache = useRef(new Map<string, MangaChapter[]>());
    const chapterPagesCache = useRef(new Map<string, Promise<MangaPage[]>>());

    // Fetch manga (Hot Updates for grid)
    useEffect(() => {
        const fetchManga = async () => {
            setMangaLoading(true);
            try {
                // Fetch Hot Updates instead of generic Top Manga
                const data = await mangaService.getHotUpdates();
                if (data?.data) {
                    // Map Hot Updates to Manga interface
                    const hotUpdates = data.data.slice(0, 8).map((update: any) => ({
                        mal_id: update.id, // String ID from scraper
                        title: update.title,
                        images: {
                            jpg: {
                                image_url: update.thumbnail,
                                large_image_url: update.thumbnail
                            }
                        },
                        score: 0, // Not available in simple update
                        type: 'Manga',
                        status: 'Publishing',
                        chapters: parseInt(update.chapter) || 0,
                        volumes: null,
                        synopsis: 'Hot Update from MangaKatana',
                    } as Manga));

                    setTopManga(hotUpdates);
                    setMangaLastPage(1); // One page for now
                }
            } catch (err) {
                console.error('Error fetching manga:', err);
            } finally {
                setMangaLoading(false);
            }
        };
        fetchManga();
    }, [mangaPage]);

    // View All fetch function
    const fetchViewAll = useCallback(async (type: MangaViewMode, page: number) => {
        setViewAllLoading(true);
        try {
            let result;
            switch (type) {
                case 'popular_manhwa':
                    result = await mangaService.getPopularManhwa(page);
                    break;
                case 'all_time_popular':
                    result = await mangaService.getPopularManga(page);
                    break;
                case 'top_100':
                    result = await mangaService.getTopManga(page);
                    break;
                default:
                    return;
            }
            setViewAllManga(result.data);
            setViewAllPagination({
                currentPage: result.pagination.current_page,
                lastPage: result.pagination.last_visible_page
            });
        } catch (err) {
            console.error('Error fetching view all manga:', err);
        } finally {
            setViewAllLoading(false);
        }
    }, []);

    const openViewAll = useCallback((type: MangaViewMode) => {
        setViewMode(type);
        fetchViewAll(type, 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [fetchViewAll]);

    const closeViewAll = useCallback(() => {
        setViewMode('default');
        setViewAllManga([]);
    }, []);

    const changeViewAllPage = useCallback((page: number) => {
        fetchViewAll(viewMode, page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [fetchViewAll, viewMode]);

    const handleMangaClick = async (manga: Manga) => {
        setSelectedManga(manga);
        setShowMangaDetails(true);
        setMangaChaptersLoading(true);
        setMangaChapters([]);
        setChapterPages([]);
        setCurrentMangaChapter(null);

        try {
            let mangakatanaId: string | null = null;

            // Optimization: If ID is string, assume it's already a scraper ID (Hot Update)
            if (typeof manga.mal_id === 'string') {
                mangakatanaId = manga.mal_id;
                mangaIdCache.current.set(manga.mal_id, mangakatanaId);
            } else if (mangaIdCache.current.has(manga.mal_id)) {
                // Check cache first
                mangakatanaId = mangaIdCache.current.get(manga.mal_id)!;
            }

            if (!mangakatanaId) {
                // Search scraper for chapters using title
                const searchData = await mangaService.searchMangaScraper(manga.title);
                if (searchData.data && searchData.data.length > 0) {
                    const firstResult = searchData.data[0];
                    mangakatanaId = firstResult.id;
                    mangaIdCache.current.set(manga.mal_id, firstResult.id);
                }
            }

            if (mangakatanaId) {
                if (mangaChaptersCache.current.has(mangakatanaId)) {
                    setMangaChapters(mangaChaptersCache.current.get(mangakatanaId)!);
                } else {
                    const chaptersData = await mangaService.getChapters(mangakatanaId);
                    if (chaptersData?.chapters) {
                        mangaChaptersCache.current.set(mangakatanaId, chaptersData.chapters);
                        setMangaChapters(chaptersData.chapters);
                    }
                }
            }
        } catch (error) {
            console.error('Failed to fetch chapters', error);
        } finally {
            setMangaChaptersLoading(false);
        }
    };

    const loadMangaChapter = async (chapter: MangaChapter) => {
        setCurrentMangaChapter(chapter);
        setMangaPagesLoading(true);

        try {
            if (chapterPagesCache.current.has(chapter.url)) {
                const pages = await chapterPagesCache.current.get(chapter.url)!;
                setChapterPages(pages);
            } else {
                const promise = mangaService.getChapterPages(chapter.url);
                chapterPagesCache.current.set(chapter.url, promise);
                const data = await promise;
                if (data?.pages) {
                    setChapterPages(data.pages);
                }
            }
        } catch (err) {
            console.error('Failed to load chapter pages', err);
            setChapterPages([]);
        } finally {
            setMangaPagesLoading(false);
        }
    };

    const prefetchChapter = (chapter: MangaChapter) => {
        if (!chapterPagesCache.current.has(chapter.url)) {
            const promise = mangaService.getChapterPages(chapter.url);
            chapterPagesCache.current.set(chapter.url, promise);
        }
    };

    // History Management
    useEffect(() => {
        const onPopState = () => {
            if (currentMangaChapter) {
                // If reading a chapter, close reader
                setCurrentMangaChapter(null);
                setChapterPages([]);
            } else if (showMangaDetails) {
                // If viewing details, close details
                setShowMangaDetails(false);
                setSelectedManga(null);
            }
        };

        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, [currentMangaChapter, showMangaDetails]);

    const handleMangaClickWithHistory = async (manga: Manga) => {
        window.history.pushState({ modal: 'manga_details', id: manga.mal_id }, '', `#manga/${manga.mal_id}`);
        await handleMangaClick(manga);
    };

    const loadMangaChapterWithHistory = async (chapter: MangaChapter) => {
        window.history.pushState({ modal: 'manga_reader' }, '', `#read/${selectedManga?.mal_id}/${chapter.id}`);
        loadMangaChapter(chapter);
    };

    const closeMangaReader = () => {
        // This function handles closing BOTH details and reader modals via UI buttons
        // So we just go back in history if any modal is open
        if (showMangaDetails || currentMangaChapter) {
            window.history.back();
        }
    };

    const startReading = () => {
        setShowMangaDetails(false);
    };

    const closeAllModals = () => {
        if (showMangaDetails || currentMangaChapter) {
            setShowMangaDetails(false);
            setCurrentMangaChapter(null);
            setChapterPages([]);
            setSelectedManga(null);
            window.history.replaceState(null, '', window.location.pathname);
        }
    };

    const zoomIn = () => setZoomLevel(prev => Math.min(prev + 10, 100));
    const zoomOut = () => setZoomLevel(prev => Math.max(prev - 10, 30));

    const changeMangaPage = (page: number) => {
        setMangaLoading(true);
        setMangaPage(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return {
        // State
        topManga,
        selectedManga,
        showMangaDetails,
        mangaChapters,
        currentMangaChapter,
        chapterPages,
        mangaChaptersLoading,
        mangaPagesLoading,
        chapterSearchQuery,
        zoomLevel,
        mangaLoading,
        mangaPage,
        mangaLastPage,
        // View All state
        viewMode,
        viewAllManga,
        viewAllLoading,
        viewAllPagination,

        // Actions
        setChapterSearchQuery,
        handleMangaClick: handleMangaClickWithHistory,
        startReading,
        loadMangaChapter: loadMangaChapterWithHistory,
        prefetchChapter,
        closeMangaReader,
        closeAllModals,
        zoomIn,
        zoomOut,
        changeMangaPage,
        // View All actions
        openViewAll,
        closeViewAll,
        changeViewAllPage,
    };
}

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
    const latestChapterId = useRef<string | null>(null);

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
            } else if (manga.scraper_id) {
                // Optimization: We already know the scraper ID from the service enrichment!
                mangakatanaId = manga.scraper_id;
                mangaIdCache.current.set(manga.mal_id, mangakatanaId);
            } else if (mangaIdCache.current.has(manga.mal_id)) {
                // Check cache first
                mangakatanaId = mangaIdCache.current.get(manga.mal_id)!;
            }

            if (!mangakatanaId) {
                // Search scraper for chapters using title variations + synonyms
                // STRATEGY: Prioritize English titles since MangaKatana is English

                // Helper: Check if string is primarily Latin characters (English-friendly)
                const isLatinText = (s: string): boolean => {
                    const latinChars = s.replace(/[^a-zA-Z]/g, '').length;
                    return latinChars > s.length * 0.5; // More than 50% Latin
                };

                // Separate English-friendly synonyms from non-Latin ones
                const allSynonyms = manga.synonyms || [];
                const englishSynonyms = allSynonyms.filter(isLatinText);
                const nonLatinSynonyms = allSynonyms.filter(s => !isLatinText(s));

                // Build prioritized title list: English first, then native
                // Build prioritized title list: English first, then native
                const baseTitles = [
                    manga.title_english,          // 1. English title (best for MangaKatana)
                    manga.title,                  // 2. Default title
                    ...englishSynonyms,           // 3. English synonyms
                    manga.title_romaji,           // 4. Romaji (still Latin)
                ].filter(Boolean) as string[];

                // GENERATE SHORT VERSIONS: Take first 3 words of long titles
                // This handles cases where full title is too specific or has extra words
                const shortTitles = baseTitles.map(t => {
                    // Remove possessive 's first, then remove special chars
                    const clean = t.replace(/['\u2019]s\b/gi, '').replace(/[^\w\s]/g, '');
                    const words = clean.split(/\s+/);
                    if (words.length >= 4) { // Only shorten if title is long enough
                        return words.slice(0, 3).join(' ');
                    }
                    return null;
                }).filter(Boolean) as string[];

                const titlesToTry = [
                    ...shortTitles,               // 1. Shortened fallbacks (Highest success rate)
                    ...baseTitles,                // 2. Full English/Romaji
                    manga.title_native,           // 3. Native
                    ...nonLatinSynonyms           // 4. Other
                ].filter(Boolean) as string[];

                // Remove duplicates while preserving order
                const uniqueTitles = [...new Set(titlesToTry)];

                // Helper: Extract significant words (remove common words)
                const extractWords = (s: string): string[] => {
                    const stopWords = ['the', 'a', 'an', 'of', 'and', 'or', 'is', 'has', 'in', 'on'];
                    return s.toLowerCase()
                        .replace(/[^\p{L}\p{N}\s]/gu, '')
                        .split(/\s+/)
                        .filter(w => w.length > 1 && !stopWords.includes(w));
                };

                let bestMatch: { id: string; title: string } | null = null;

                for (const title of uniqueTitles) {
                    if (bestMatch) break; // Stop once we find a match

                    // Add slight delay to avoid rate limiting
                    if (title !== uniqueTitles[0]) await new Promise(r => setTimeout(r, 800));

                    try {
                        // Normalize special characters and simplify for search
                        const normalizedTitle = title
                            // Handle possessive 's - REMOVE it (Mercenary's -> Mercenary)
                            .replace(/['\u2019]s\b/gi, '')
                            .replace(/[''\u2019\u2018`]/g, '')  // Remove other apostrophes (Don't -> Dont)
                            .replace(/[""]/g, '')       // Remove quotes
                            .replace(/[–—]/g, ' ')      // Dashes to spaces  
                            .replace(/[^\p{L}\p{N}\s]/gu, ' ')   // Keep all languages (Unicode)
                            .replace(/\s+/g, ' ')       // Multiple spaces to single
                            .trim();

                        // Skip empty queries. Allow length 1 for CJK (rare but possible)
                        if (normalizedTitle.length < 1) {
                            continue;
                        }

                        const searchData = await mangaService.searchMangaScraper(normalizedTitle);

                        if (searchData.data && searchData.data.length > 0) {
                            console.log(`[useManga] Search "${normalizedTitle}" returned ${searchData.data.length} results`);

                            const candidates = searchData.data;

                            // Parse chapter counts and sort candidates by chapter count (Desc)
                            const sortedCandidates = candidates.map((c: any) => {
                                let count = 0;
                                if (c.latestChapter) {
                                    const match = c.latestChapter.match(/(\d+[\.]?\d*)/);
                                    if (match) count = parseFloat(match[1]);
                                }
                                return { ...c, chapterCount: count };
                            }).sort((a: any, b: any) => b.chapterCount - a.chapterCount);

                            console.log(`[useManga] Checking ${sortedCandidates.length} candidates for query: "${normalizedTitle}"`);
                            sortedCandidates.forEach((c: any) => console.log(` - Candidate: "${c.title}" (Ch: ${c.chapterCount}, ID: ${c.id})`));

                            // 0. EXCLUSION FILTER: Remove "Novel" unless query asks for it
                            const queryHasNovel = normalizedTitle.toLowerCase().includes('novel');
                            const filteredCandidates = sortedCandidates.filter((c: any) => {
                                const t = (c.title || '').toLowerCase();
                                if (!queryHasNovel && t.includes('novel')) return false;
                                return true;
                            });

                            if (filteredCandidates.length === 0) continue;

                            // PASS 0: GLOBAL SYNONYM MATCH (Highest Priority)
                            // Check if candidate matches ANY of our known titles/synonyms, not just the search query
                            const synonymMatch = filteredCandidates.find((c: any) => {
                                const cTitle = (c.title || '').toLowerCase()
                                    .replace(/['\u2019]s\b/gi, '')
                                    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
                                    .replace(/\s+/g, ' ')
                                    .trim();

                                // Check against ALL uniqueTitles
                                return uniqueTitles.some(knownTitle => {
                                    const kTitle = knownTitle.toLowerCase()
                                        .replace(/['\u2019]s\b/gi, '')
                                        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
                                        .replace(/\s+/g, ' ')
                                        .trim();
                                    return cTitle === kTitle || cTitle.startsWith(kTitle) || kTitle.startsWith(cTitle);
                                });
                            });

                            if (synonymMatch) {
                                bestMatch = { id: synonymMatch.id, title: synonymMatch.title };
                                console.log(`[useManga] Found SYNONYM match: ${bestMatch.title}`);
                                break;
                            }

                            // PASS 1: EXACT MATCH (Normalization insensitive)
                            const exactMatch = filteredCandidates.find((c: any) => {
                                const t = (c.title || '').toLowerCase()
                                    .replace(/['\u2019]s\b/gi, '') // Normalize possessives
                                    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
                                    .replace(/\s+/g, ' ')
                                    .trim();
                                return t === normalizedTitle.toLowerCase();
                            });

                            if (exactMatch) {
                                bestMatch = { id: exactMatch.id, title: exactMatch.title };
                                console.log(`[useManga] Found EXACT match: ${bestMatch.title}`);
                                break;
                            }

                            // PASS 2: STRONG CONTAINMENT (Query is full prefix or clearly contained)
                            // e.g. Query: "Solo Leveling" -> Match: "Solo Leveling (Manhwa)"
                            const containmentMatch = filteredCandidates.find((c: any) => {
                                const t = (c.title || '').toLowerCase();
                                const q = normalizedTitle.toLowerCase();
                                // Check if title starts with query (very strong signal)
                                return t.startsWith(q);
                            });

                            if (containmentMatch) {
                                bestMatch = { id: containmentMatch.id, title: containmentMatch.title };
                                console.log(`[useManga] Found CONTAINMENT match: ${bestMatch.title}`);
                                break;
                            }

                            // PASS 3: FUZZY WORD MATCH (Fallback)
                            // Require a high percentage of word overlap
                            for (const result of filteredCandidates) {
                                const resultTitle = (result.title || '').toLowerCase();
                                const searchWords = extractWords(normalizedTitle);
                                const resultWords = extractWords(resultTitle);

                                if (searchWords.length === 0) continue;

                                const matchingWords = searchWords.filter(w => resultTitle.includes(w));
                                const matchRatio = matchingWords.length / searchWords.length;

                                // If query is short (1-2 words), require 100% match of those words
                                // If query is long, require at least 70%
                                const threshold = searchWords.length <= 2 ? 1.0 : 0.7;

                                if (matchRatio >= threshold && resultWords.length > 0) {
                                    // Reverse check: don't match if result has WAY more words (prevent generic matches)
                                    // e.g. "Bleach" shouldn't match "Clorox Bleach 1000 Year War Arc" (silly example, but you get it)
                                    if (resultWords.length < searchWords.length * 2.5) {
                                        bestMatch = { id: result.id, title: result.title };
                                        console.log(`[useManga] Found FUZZY match: ${bestMatch.title} (${Math.round(matchRatio * 100)}%)`);
                                        break;
                                    }
                                }
                            }

                            if (bestMatch) break;
                        }
                    } catch (e) {
                        // Ignore search errors for individual titles
                    }
                }

                if (bestMatch) {
                    mangakatanaId = bestMatch.id;
                    mangaIdCache.current.set(manga.mal_id, bestMatch.id);
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
        // Prevent race conditions: only process the latest request
        const requestId = chapter.id;
        latestChapterId.current = requestId;

        setCurrentMangaChapter(chapter);
        setMangaPagesLoading(true);
        // Clear previous pages immediately to show loading state for the new chapter
        setChapterPages([]);

        try {
            if (chapterPagesCache.current.has(chapter.url)) {
                const pages = await chapterPagesCache.current.get(chapter.url)!;
                // Only update if this is still the latest requested chapter
                if (latestChapterId.current === requestId) {
                    setChapterPages(pages);
                }
            } else {
                const promise = mangaService.getChapterPages(chapter.url);
                chapterPagesCache.current.set(chapter.url, promise);
                const data = await promise;

                // Only update if this is still the latest requested chapter
                if (latestChapterId.current === requestId) {
                    if (data?.pages && data.pages.length > 0) {
                        setChapterPages(data.pages);
                    } else {
                        // If no pages found (and verify not cancelled), keep empty or show error
                        // Ideally we could set an error state here
                    }
                }
            }
        } catch (err) {
            if (latestChapterId.current === requestId) {
                console.error('Failed to load chapter pages', err);
                setChapterPages([]);
            }
        } finally {
            if (latestChapterId.current === requestId) {
                setMangaPagesLoading(false);
            }
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

    const fetchMangaDetails = async (id: string | number) => {
        setMangaLoading(true);
        setSelectedManga(null);
        setMangaChapters([]);
        setChapterPages([]);
        setCurrentMangaChapter(null);

        try {
            // Check if ID is numeric (AniList) or String (Scraper)
            const isAniListId = !isNaN(Number(id));

            if (isAniListId) {
                // 1. Fetch AniList Metadata
                const { data } = await mangaService.getMangaDetails(id);
                console.log('Fetched manga data:', data);
                console.log('Synonyms from API:', data?.synonyms);
                if (data) {
                    setSelectedManga(data);
                    // 2. Fetch Chapters (search scraper via handleMangaClick logic)
                    await handleMangaClick(data);
                }
            } else {
                // 1. Fetch Scraper Metadata (String ID)
                const data = await mangaService.getScraperMangaDetails(String(id));
                if (data) {
                    setSelectedManga(data);
                    // 2. Fetch Chapters directly (we essentially have the ID)
                    // We can reuse handleMangaClick, it handles string IDs optimization
                    await handleMangaClick(data);
                }
            }
        } catch (err) {
            console.error('Failed to fetch manga details', err);
        } finally {
            setMangaLoading(false);
        }
    };

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
        fetchMangaDetails, // New action
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

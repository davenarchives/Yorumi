import { useState, useEffect, useRef, useCallback } from 'react';
import type { Manga, MangaChapter, MangaPage } from '../types/manga';
import { mangaService } from '../services/mangaService';
import { token_set_ratio } from 'fuzzball';

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
    const [zoomLevel, setZoomLevel] = useState(() => window.innerWidth < 768 ? 100 : 60);

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
            } else {
                // 1. CHECK PERSISTENT MAPPING FIRST
                try {
                    const mapRes = await fetch(`http://localhost:3001/api/mapping/${manga.mal_id}`);
                    if (mapRes.ok) {
                        const mapData = await mapRes.json();
                        if (mapData && mapData.id) {
                            console.log(`[useManga] Found persistent mapping: ${manga.mal_id} -> ${mapData.id}`);
                            mangakatanaId = mapData.id;
                            mangaIdCache.current.set(manga.mal_id, mapData.id);
                        }
                    }
                } catch (err) {
                    console.warn('[useManga] Failed to check mapping:', err);
                }
            }

            if (!mangakatanaId) {
                // Search scraper for chapters using title variations + synonyms
                // STRATEGY: Prioritize English titles since MangaKatana is English

                // Helper: Check if string is primarily Latin characters (English-friendly)
                const isLatinText = (s: string | null): boolean => {
                    if (!s) return false;
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
                    if (words.length >= 6) { // Only shorten if title is very long
                        return words.slice(0, 4).join(' '); // Take first 4 words
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
                            // STRIP SUFFIXES: Improve matching by removing (Official), (Digital), (West), etc.
                            .replace(/\s*\(.*?\)\s*/g, '')
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

                            // 1. EXACT MATCH: Check normalized_query == normalized_target
                            // "Fastest, catches 60%"
                            const exactMatch = filteredCandidates.find((c: any) => {
                                const t = (c.title || '').toLowerCase()
                                    .replace(/['\u2019]s\b/gi, '')
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

                            // 2. ALIAS MATCH: Check if candidate exists in known list
                            // "Catches the Japanese/English mismatch"
                            const aliasMatch = filteredCandidates.find((c: any) => {
                                const cTitle = (c.title || '').toLowerCase()
                                    .replace(/['\u2019]s\b/gi, '')
                                    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
                                    .replace(/\s+/g, ' ')
                                    .trim();

                                // Check against ALL uniqueTitles (which includes synonyms)
                                return uniqueTitles.some(knownTitle => {
                                    const kTitle = knownTitle.toLowerCase()
                                        .replace(/['\u2019]s\b/gi, '')
                                        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
                                        .replace(/\s+/g, ' ')
                                        .trim();
                                    return cTitle === kTitle;
                                });
                            });

                            if (aliasMatch) {
                                bestMatch = { id: aliasMatch.id, title: aliasMatch.title };
                                console.log(`[useManga] Found ALIAS match: ${bestMatch.title}`);

                                // Auto-save alias matches as well since they are exact
                                fetch('http://localhost:3001/api/mapping', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        anilistId: manga.mal_id,
                                        scraperId: bestMatch.id,
                                        title: bestMatch.title
                                    })
                                }).catch(e => console.error('[useManga] Failed to auto-save alias mapping:', e));

                                break;
                            }

                            // 3. FUZZY MATCH (RapidFuzz / fuzzball)
                            // "Run process.extractOne with scorer=fuzz.token_set_ratio"
                            let bestFuzzyCandidate = null;
                            let bestFuzzyScore = 0;

                            for (const candidate of filteredCandidates) {
                                const cTitle = (candidate.title || '');
                                // Use token_set_ratio as requested
                                const score = token_set_ratio(normalizedTitle, cTitle);

                                if (score > bestFuzzyScore) {
                                    bestFuzzyScore = score;
                                    bestFuzzyCandidate = candidate;
                                }
                            }

                            if (bestFuzzyCandidate) {
                                // "Check" Step: Best match score < 85 -> Flag
                                if (bestFuzzyScore >= 85) {
                                    // Threshold >= 85: Accept
                                    bestMatch = { id: bestFuzzyCandidate.id, title: bestFuzzyCandidate.title };
                                    console.log(`[useManga] Found FUZZY match: ${bestMatch.title} (Score: ${bestFuzzyScore})`);

                                    // 3. AUTO-SAVE HIGH CONFIDENCE MATCHES
                                    if (bestFuzzyScore > 95) {
                                        console.log(`[useManga] High confidence match (>95). Saving mapping...`);
                                        fetch('http://localhost:3001/api/mapping', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                anilistId: manga.mal_id,
                                                scraperId: bestMatch.id,
                                                title: bestMatch.title
                                            })
                                        }).catch(e => console.error('[useManga] Failed to auto-save mapping:', e));
                                    }

                                    break;
                                } else {
                                    // Threshold < 85: Flag for Manual Review
                                    console.warn(`[useManga] FLAGGED Fuzzy Match: ${bestFuzzyCandidate.title} (Score: ${bestFuzzyScore}) - Below 0.85 threshold. Needs Review.`);
                                    // Do NOT auto-accept. Continue trying other title variations if any.
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

                // Auto-prefetch next 3 chapters for seamless reading
                prefetchNextChapters(chapter, 3);
            }
        }
    };

    const prefetchNextChapters = (currentChapter: MangaChapter, count: number) => {
        const currentIndex = mangaChapters.findIndex(ch => ch.id === currentChapter.id);
        if (currentIndex === -1) return;

        // Chapters are typically ordered newest-first (index 0 = latest chapter)
        // "Next" chapters for reading are at higher indices (earlier chapters)
        // But user likely wants to read forward (next = lower chapter number = higher index? No...)
        // Actually, depends on order. Let's assume: index 0 = chapter N (latest), index 1 = chapter N-1
        // Reading "forward" means going from Chapter 1 -> 2 -> 3, which is from high index to low index.
        // So "next" chapters are at LOWER indices (newer chapters).

        // Let's prefetch BOTH directions to cover different reading patterns:
        // - Next 2 chapters (lower index, reading forward in story)
        // - Previous 1 chapter (higher index, re-reading)
        for (let i = 1; i <= count; i++) {
            const nextIndex = currentIndex - i; // Forward in story (newer chapter)
            if (nextIndex >= 0 && mangaChapters[nextIndex]) {
                prefetchChapter(mangaChapters[nextIndex]);
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

                    // 2. Fetch Chapters directly using the known scraper ID
                    // Skip handleMangaClick's complex search - we already have the ID
                    const scraperId = String(id).startsWith('mk:') ? String(id).replace('mk:', '') : String(id);
                    setMangaChaptersLoading(true);

                    try {
                        if (mangaChaptersCache.current.has(scraperId)) {
                            setMangaChapters(mangaChaptersCache.current.get(scraperId)!);
                        } else {
                            const chaptersData = await mangaService.getChapters(scraperId);
                            if (chaptersData?.chapters) {
                                mangaChaptersCache.current.set(scraperId, chaptersData.chapters);
                                setMangaChapters(chaptersData.chapters);
                            }
                        }
                    } catch (chapErr) {
                        console.error('Failed to fetch chapters for scraper ID:', chapErr);
                    } finally {
                        setMangaChaptersLoading(false);
                    }
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

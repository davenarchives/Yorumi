import { useState, useEffect, useRef, useCallback } from 'react';
import type { Manga, MangaChapter, MangaPage } from '../types/manga';
import { mangaService } from '../services/mangaService';
import { mangaDownloadService } from '../services/mangaDownloadService';
import { token_set_ratio, token_sort_ratio } from 'fuzzball';
import { storage } from '../utils/storage';
import { useReadList } from './useReadList';
import { API_BASE } from '../config/api';

export type MangaViewMode = 'default' | 'popular_manhwa' | 'all_time_popular' | 'top_100';

const getResolvedChapters = (manga: unknown): MangaChapter[] => {
    const chapters = (manga as { resolvedChapters?: MangaChapter[] } | null)?.resolvedChapters;
    return Array.isArray(chapters) ? chapters : [];
};

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
    const [readChapters, setReadChapters] = useState<Set<string>>(new Set());

    // View All state
    const [viewMode, setViewMode] = useState<MangaViewMode>('default');
    const [viewAllManga, setViewAllManga] = useState<Manga[]>([]);
    const [viewAllLoading, setViewAllLoading] = useState(false);
    const [viewAllPagination, setViewAllPagination] = useState({ currentPage: 1, lastPage: 1 });

    const mangaIdCache = useRef(new Map<number | string, string>());
    const mangaChaptersCache = useRef(new Map<string, MangaChapter[]>());
    const chapterPagesCache = useRef(new Map<string, Promise<MangaPage[]>>());
    const latestChapterId = useRef<string | null>(null);
    const scraperSearchCache = useRef(new Map<string, string>());

    const prefetchPageImages = useCallback((pages: MangaPage[], limit: number = 4) => {
        pages.slice(0, limit).forEach((page) => {
            if (!page?.imageUrl) return;
            const img = new Image();
            img.decoding = 'async';
            img.loading = page.pageNumber <= 2 ? 'eager' : 'lazy';
            img.src = page.imageUrl;
        });
    }, []);

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
                        id: update.id,
                        title: update.title,
                        images: {
                            jpg: {
                                image_url: update.thumbnail || '',
                                large_image_url: update.thumbnail || ''
                            }
                        },
                        score: 0, // Not available in simple update
                        type: 'Manga',
                        status: update.status || 'Unknown',
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

    // Load Read History
    useEffect(() => {
        if (selectedManga) {
            const history = storage.getReadChapters(String(selectedManga.mal_id));
            setReadChapters(new Set(history));
        } else {
            setReadChapters(new Set());
        }
    }, [selectedManga]);

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

    const handleMangaClick = useCallback(async (manga: Manga) => {
        setSelectedManga(manga);
        setShowMangaDetails(true);
        setMangaChaptersLoading(true);
        setMangaChapters([]);
        setChapterPages([]);
        setCurrentMangaChapter(null);

        try {

            let mangakatanaId: string | null = null;

            // Optimization: If ID is string, assume it's already a scraper ID (Hot Update)
            if (typeof manga.mal_id === 'string' && !manga.mal_id.startsWith('vault:')) {
                mangakatanaId = manga.mal_id;
                mangaIdCache.current.set(manga.mal_id, mangakatanaId);
            } else if (manga.scraper_id && !String(manga.scraper_id).startsWith('vault:')) {
                // Optimization: We already know the scraper ID from the service enrichment!
                mangakatanaId = manga.scraper_id;
                mangaIdCache.current.set(manga.mal_id, mangakatanaId);
            } else if (mangaIdCache.current.has(manga.mal_id) && !String(mangaIdCache.current.get(manga.mal_id)).startsWith('vault:')) {
                // Check cache first
                mangakatanaId = mangaIdCache.current.get(manga.mal_id)!;
            } else {
                // 1. CHECK PERSISTENT MAPPING FIRST
                try {
                    const mapRes = await fetch(`${API_BASE}/mapping/${manga.mal_id}`);
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

            // Fast path: let backend resolve AniList ID to chapter list first.
            if (!mangakatanaId && typeof manga.mal_id === 'number') {
                try {
                    const unified = await mangaService.getUnifiedMangaDetails(manga.mal_id);
                    const resolvedChapters = getResolvedChapters(unified);
                    if (unified && resolvedChapters.length > 0) {
                        const cacheKey = `anilist:${manga.mal_id}`;
                        mangaChaptersCache.current.set(cacheKey, resolvedChapters);
                        setMangaChapters(resolvedChapters);
                        setMangaChaptersLoading(false);
                        return;
                    }
                } catch (e) {
                    console.warn('[useManga] Unified details fallback failed, trying title search...', e);
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

                // GENERATE KEYWORD SEARCHES: MangaKatana works best with single keywords
                // Extract unique/long words from titles for fallback searches
                const commonWords = new Set(['the', 'a', 'an', 'of', 'and', 'in', 'to', 'for', 'is', 'on', 'that', 'by', 'this', 'with', 'from', 'or', 'be', 'are', 'was', 'as', 'at', 'all', 'but', 'not', 'you', 'have', 'had', 'they', 'we', 'can', 'will', 'my', 'me', 'up', 'do']);
                const keywordSet = new Set<string>();
                baseTitles.forEach(t => {
                    const clean = t.replace(/['\u2019]s\b/gi, '').replace(/[^\w\s]/g, '');
                    clean.split(/\s+/).forEach(word => {
                        const lower = word.toLowerCase();
                        // Keep words that are 4+ chars and not common words
                        if (word.length >= 4 && !commonWords.has(lower)) {
                            keywordSet.add(word);
                        }
                    });
                });
                const keywordSearches = Array.from(keywordSet);
                console.log(`[useManga] Extracted keywords for fallback: ${keywordSearches.join(', ')}`);

                const titlesToTry = [
                    ...baseTitles,                // 1. Full known titles and aliases
                    manga.title_native,           // 2. Native exact title
                    ...nonLatinSynonyms,          // 3. Other exact aliases
                    ...shortTitles,               // 4. Shortened fallbacks
                    ...keywordSearches,           // 5. Single keyword searches (last resort)
                ].filter(Boolean) as string[];

                // Remove duplicates while preserving order
                const uniqueTitles = [...new Set(titlesToTry)];
                const limitedTitles = uniqueTitles.slice(0, 8);



                let bestMatch: { id: string; title: string } | null = null;
                let fallbackCandidate: { id: string; title: string; chapterCount: number } | null = null;
                let fallbackChapterCount = -1;

                for (const title of limitedTitles) {
                    if (bestMatch) break; // Stop once we find a match

                    // Keep delays small so chapter resolution stays responsive.
                    if (title !== limitedTitles[0]) await new Promise(r => setTimeout(r, 120));

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

                        const cachedScraperId = scraperSearchCache.current.get(normalizedTitle.toLowerCase());
                        if (cachedScraperId) {
                            bestMatch = { id: cachedScraperId, title: normalizedTitle };
                            break;
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

                            // Track best fallback candidate by highest chapter count
                            const topCandidate = filteredCandidates[0];
                            if (topCandidate && topCandidate.chapterCount > fallbackChapterCount) {
                                fallbackChapterCount = topCandidate.chapterCount;
                                fallbackCandidate = {
                                    id: topCandidate.id,
                                    title: topCandidate.title,
                                    chapterCount: topCandidate.chapterCount
                                };
                            }

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
                                fetch(`${API_BASE}/api/mapping`, {
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
                            // IMPORTANT: Compare candidates against ALL baseTitles, not just the search keyword
                            // This prevents false positives like "Stellar Theater" matching when searching "Stellar"
                            let bestFuzzyCandidate = null;
                            let bestFuzzyScore = 0;

                            for (const candidate of filteredCandidates) {
                                const cTitle = (candidate.title || '');

                                // Find the best score against any of the original full titles
                                let maxScoreForCandidate = 0;
                                for (const origTitle of baseTitles) {
                                    const score = token_sort_ratio(origTitle, cTitle);
                                    if (score > maxScoreForCandidate) {
                                        maxScoreForCandidate = score;
                                    }
                                }

                                console.log(`[useManga] Candidate "${cTitle}" best score: ${maxScoreForCandidate}`);

                                if (maxScoreForCandidate > bestFuzzyScore) {
                                    bestFuzzyScore = maxScoreForCandidate;
                                    bestFuzzyCandidate = candidate;
                                }

                                // Threshold >= 75: Auto-Accept
                                if (bestFuzzyScore >= 75 && bestFuzzyCandidate) {
                                    bestMatch = { id: (bestFuzzyCandidate as any).id, title: (bestFuzzyCandidate as any).title };
                                    console.log(`[useManga] Found FUZZY match: ${bestMatch.title} (Score: ${bestFuzzyScore})`);
                                    
                                    // Save mapping silently
                                    if (bestMatch && manga.mal_id) {
                                        fetch(`${API_BASE}/api/mapping`, {
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
                                    // Threshold < 75: Flag for Manual Review
                                    console.warn(`[useManga] FLAGGED Fuzzy Match: ${bestFuzzyCandidate ? (bestFuzzyCandidate as any).title : 'none'} (Score: ${bestFuzzyScore}) - Below 0.75 threshold. Needs Review.`);
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
                    limitedTitles.forEach((candidateTitle) => {
                        const key = String(candidateTitle || '').trim().toLowerCase();
                        if (key) {
                            scraperSearchCache.current.set(key, bestMatch!.id);
                        }
                    });
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
    }, []);

    const loadMangaChapter = async (chapter: MangaChapter) => {
        // Prevent race conditions: only process the latest request
        const requestId = chapter.url;
        latestChapterId.current = requestId;

        setCurrentMangaChapter(chapter);
        setMangaPagesLoading(true);

        // Mark Chapter as Read
        if (selectedManga) {
            storage.markChapterAsRead(String(selectedManga.mal_id), chapter.id);
            setReadChapters(prev => new Set(prev).add(chapter.id));
        }

        // Clear previous pages immediately to show loading state for the new chapter
        setChapterPages([]);

        try {
            let pages: MangaPage[] = [];

            // Check if downloaded offline in IndexedDB
            const mangaKey = selectedManga?.id || selectedManga?.mal_id || '';
            if (mangaKey) {
                const downloaded = await mangaDownloadService.getChapter(mangaKey, chapter.id);
                if (downloaded && downloaded.pages && downloaded.pages.length > 0) {
                    pages = downloaded.pages.map((p) => ({
                        pageNumber: p.pageNumber,
                        imageUrl: p.imageUrl,
                    }));
                }
            }

            if (pages.length === 0 && chapterPagesCache.current.has(chapter.url)) {
                // Get from cache
                const cachedPages = await chapterPagesCache.current.get(chapter.url)!;

                // Validate cache - if empty, remove from cache and refetch
                if (cachedPages && cachedPages.length > 0) {
                    pages = cachedPages;
                } else {
                    // Invalid cache entry, remove it
                    chapterPagesCache.current.delete(chapter.url);
                    // Fetch fresh
                    const data = await mangaService.getChapterPages(chapter.url);
                    if (data?.pages && data.pages.length > 0) {
                        pages = data.pages;
                        // Only cache successful results
                        chapterPagesCache.current.set(chapter.url, Promise.resolve(data.pages));
                    }
                }
            } else if (pages.length === 0) {
                // Fetch fresh
                const data = await mangaService.getChapterPages(chapter.url);
                if (data?.pages && data.pages.length > 0) {
                    pages = data.pages;
                    // Only cache successful results
                    chapterPagesCache.current.set(chapter.url, Promise.resolve(data.pages));
                }
            }

            // Retry once if backend returns empty pages for this chapter.
            if (!pages || pages.length === 0) {
                await new Promise(resolve => setTimeout(resolve, 500));
                const retryData = await mangaService.getChapterPages(chapter.url);
                if (retryData?.pages && retryData.pages.length > 0) {
                    pages = retryData.pages;
                    chapterPagesCache.current.set(chapter.url, Promise.resolve(retryData.pages));
                }
            }

            // Only update if this is still the latest requested chapter
            if (latestChapterId.current === requestId) {
                setChapterPages(pages);
                // Warm browser image cache for instant page painting.
                prefetchPageImages(pages);
            }
        } catch (err) {
            if (latestChapterId.current === requestId) {
                console.error('Failed to load chapter pages', err);
                setChapterPages([]);
            }
            // Clear any failed cache entry
            chapterPagesCache.current.delete(chapter.url);
        } finally {
            if (latestChapterId.current === requestId) {
                setMangaPagesLoading(false);

                // Auto-prefetch next chapters for seamless reading
                prefetchNextChapters(chapter, 3);
            }
        }
    };

    const prefetchNextChapters = (currentChapter: MangaChapter, count: number) => {
        const currentIndex = mangaChapters.findIndex(ch => ch.url === currentChapter.url);
        if (currentIndex === -1) return;

        // Collect URLs to prefetch
        // "Next" chapters are at LOWER indices (newer chapters) in descending list
        // We will prefetch next 3 (forward) and prev 1 (backward)
        const urlsToPrefetch: string[] = [];

        // Forward (Next chapters)
        for (let i = 1; i <= count; i++) {
            const nextIndex = currentIndex - i; // Forward in story (newer/next chapter in array)
            if (nextIndex >= 0 && mangaChapters[nextIndex]) {
                // Check if already in cache (client-side) to avoid sending unnecessary requests
                if (!chapterPagesCache.current.has(mangaChapters[nextIndex].url)) {
                    urlsToPrefetch.push(mangaChapters[nextIndex].url);
                    // Create a pending promise in cache so we don't fetch again if user navigates immediately
                    // Actually, better to let loadMangaChapter handle the fetch if it happens
                }
            }
        }

        // Backward (Previous chapter - usually index + 1)
        const prevIndex = currentIndex + 1;
        if (prevIndex < mangaChapters.length && mangaChapters[prevIndex]) {
            if (!chapterPagesCache.current.has(mangaChapters[prevIndex].url)) {
                urlsToPrefetch.push(mangaChapters[prevIndex].url);
            }
        }

        if (urlsToPrefetch.length > 0) {
            console.log(`[useManga] Prefetching ${urlsToPrefetch.length} chapters via backend`);
            mangaService.prefetchChapters(urlsToPrefetch);

            // Also warm client-side page/image cache for the very next chapter.
            const nextUrl = urlsToPrefetch[0];
            if (nextUrl && !chapterPagesCache.current.has(nextUrl)) {
                const warmPromise = mangaService.getChapterPages(nextUrl)
                    .then((data) => {
                        const pages = data?.pages || [];
                        if (pages.length > 0) {
                            prefetchPageImages(pages);
                        }
                        return pages;
                    })
                    .catch(() => []);
                chapterPagesCache.current.set(nextUrl, warmPromise);
            }
        }
    };

    const prefetchChapter = (chapter: MangaChapter) => {
        // Legacy individual prefetch - can redirect to batch
        if (!chapterPagesCache.current.has(chapter.url)) {
            mangaService.prefetchChapters([chapter.url]);
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

    const handleMangaClickWithHistory = useCallback(async (manga: Manga) => {
        window.history.pushState({ modal: 'manga_details', id: manga.mal_id }, '', `#manga/${manga.mal_id}`);
        await handleMangaClick(manga);
    }, [handleMangaClick]);

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

    const fetchMangaDetails = useCallback(async (id: string | number, initialManga?: Manga | null) => {
        setMangaLoading(true);
        setMangaChapters([]);
        setChapterPages([]);
        setCurrentMangaChapter(null);

        try {
            const cachedDetails = mangaService.peekUnifiedMangaDetails(id);
            const seedManga = cachedDetails?.mal_id
                ? cachedDetails
                : initialManga?.mal_id
                    ? initialManga
                    : null;

            if (seedManga?.mal_id) {
                setSelectedManga(seedManga);

                const seedChapters = getResolvedChapters(seedManga);
                if (seedChapters.length > 0) {
                    setMangaChapters(seedChapters);
                    setMangaChaptersLoading(false); // Render UI immediately
                }

                // Start chapter resolution immediately from route/cached manga so
                // the details page does not wait for the full unified fetch first.
                handleMangaClick(seedManga).catch((warmErr) => {
                    console.warn('Early chapter warmup failed:', warmErr);
                });
            } else {
                setSelectedManga(null);
            }

            

            const data = await mangaService.getUnifiedMangaDetails(id);
            if (!data || !data.mal_id) {
                console.error('Manga details not found for ID:', id);
                setSelectedManga(null);
                return;
            }

            setSelectedManga(data);

            const hydratedChapters = getResolvedChapters(data);
            if (hydratedChapters.length > 0) {
                const hydratedKeys = [
                    String(data.scraper_id || '').trim(),
                    String(data.id || '').trim(),
                    String(data.mal_id || '').trim(),
                ].filter(Boolean);
                hydratedKeys.forEach((key) => mangaChaptersCache.current.set(key, hydratedChapters));
                setMangaChapters(hydratedChapters);
                setMangaChaptersLoading(false);
                return;
            }

            const scraperId = String(data.scraper_id || '').trim()
                || (typeof data.mal_id === 'string' ? String(data.mal_id).trim() : '')
                || (typeof data.id === 'string' ? String(data.id).trim() : '');

            if (scraperId) {
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
                return;
            }

            await handleMangaClick(data);
        } catch (err) {
            console.error('Failed to fetch manga details', err);
        } finally {
            setMangaLoading(false);
        }
    }, [handleMangaClick]); // Depend on handleMangaClick

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
        readChapters, // New State
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

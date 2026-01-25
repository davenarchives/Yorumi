import * as mangakatana from '../../scraper/mangakatana';
import { anilistService } from '../anilist/anilist.service';

export interface MangaSearchResult extends mangakatana.MangaSearchResult {
    source: 'mangakatana';
}

// In-memory search cache (5 minute TTL)
const searchCache = new Map<string, { data: any[], timestamp: number }>();
const SEARCH_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Search manga (MangaKatana only) with caching
 */
export async function searchManga(query: string) {
    const cacheKey = query.toLowerCase().trim();
    const now = Date.now();

    // Check cache first
    const cached = searchCache.get(cacheKey);
    if (cached && (now - cached.timestamp) < SEARCH_CACHE_TTL) {
        console.log(`Search cache hit for: "${query}"`);
        return cached.data;
    }

    console.log(`Searching MangaKatana for: "${query}"`);
    const mkResults = await mangakatana.searchManga(query).catch(err => {
        console.error('MangaKatana Search Error:', err.message);
        return [];
    });

    // Prefix IDs to namespace them (optional now, but keeps consistency if we add others later)
    const results = mkResults.map(r => ({
        ...r,
        id: `mk:${r.id}`,
        source: 'mangakatana' as const
    }));

    // Cache the results
    searchCache.set(cacheKey, { data: results, timestamp: now });
    console.log(`Cached ${results.length} results for: "${query}"`);

    return results;
}

/**
 * Get details
 */
export async function getMangaDetails(id: string) {
    // Check if ID is likely AniList (numeric) vs Scraper (string with letters/hyphens)
    // MK IDs usually "some-manga.12345" or "some-manga".
    // AniList ID is purely numeric "123456".
    const isAniListId = /^\d+$/.test(id);

    if (isAniListId) {
        console.log(`[getMangaDetails] Treating "${id}" as AniList ID`);
        const anilistData = await anilistService.getMediaDetails(parseInt(id));
        if (!anilistData) throw new Error('AniList media not found');

        // Resolve chapters from MangaKatana by title
        let chapters: any[] = [];
        try {
            const title = anilistData.title.english || anilistData.title.romaji;
            console.log(`[getMangaDetails] Searching chapters for "${title}"...`);
            const searchResults = await mangakatana.searchManga(title);

            // Simple fuzzy match: Find first result where title includes keyword?
            // Or just take first result?
            // Let's refine: filtering.
            const match = searchResults.find(r =>
                r.title.toLowerCase().includes(title.toLowerCase()) ||
                title.toLowerCase().includes(r.title.toLowerCase())
            );

            if (match) {
                console.log(`[getMangaDetails] Found match: ${match.title} (${match.id})`);
                chapters = await mangakatana.getChapterList(match.id);
            } else {
                console.warn(`[getMangaDetails] No chapter match found for ${title}`);
            }
        } catch (e) {
            console.error('[getMangaDetails] Chapter resolution failed:', e);
        }

        // Map AniList data to MangaDetails format
        return {
            id: id, // Keep original ID
            title: anilistData.title.romaji || anilistData.title.english,
            altNames: anilistData.synonyms || [],
            author: anilistData.staff?.edges?.find((e: any) => e.role === 'Story & Art')?.node?.name?.full || '',
            status: anilistData.status,
            genres: anilistData.genres || [],
            synopsis: anilistData.description || '',
            coverImage: anilistData.coverImage?.extraLarge || anilistData.coverImage?.large,
            url: anilistData.siteUrl,
            source: 'anilist',
            chapters: chapters.map(c => ({ ...c, id: `mk:${c.id}` })) // Namespace chapter IDs if needed
        };
    }

    // Strip prefix if present
    const realId = id.startsWith('mk:') ? id.replace('mk:', '') : id;
    const details = await mangakatana.getMangaDetails(realId);
    return { ...details, id: `mk:${details.id}` };
}

/**
 * Get chapter list
 */
export async function getChapterList(id: string) {
    const realId = id.startsWith('mk:') ? id.replace('mk:', '') : id;
    const chapters = await mangakatana.getChapterList(realId);
    return chapters.map(c => ({ ...c, id: `mk:${c.id}` }));
}

// In-memory cache for chapter pages (30 minute TTL)
const pagesCache = new Map<string, { data: any[], timestamp: number }>();
const PAGES_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Get pages with caching
 */
export async function getChapterPages(url: string) {
    const now = Date.now();

    // Check cache first
    const cached = pagesCache.get(url);
    if (cached && (now - cached.timestamp) < PAGES_CACHE_TTL) {
        console.log(`[Cache] Chapter pages hit: ${url.slice(-30)}`);
        return cached.data;
    }

    console.log(`[Fetch] Getting chapter pages: ${url.slice(-30)}`);
    const pages = await mangakatana.getChapterPages(url);

    // Cache successful results
    if (pages && pages.length > 0) {
        pagesCache.set(url, { data: pages, timestamp: now });

        // Clean old entries if cache is too large
        if (pagesCache.size > 100) {
            for (const [key, val] of pagesCache.entries()) {
                if (now - val.timestamp > PAGES_CACHE_TTL) {
                    pagesCache.delete(key);
                }
            }
        }
    }

    return pages;
}

/**
 * Prefetch multiple chapters to warm the cache
 */
export async function prefetchChapters(urls: string[]) {
    console.log(`[Prefetch] Warming cache for ${urls.length} chapters`);
    // Process in background, don't await the results
    urls.forEach(async (url) => {
        try {
            // Check cache first to avoid unnecessary work
            const cached = pagesCache.get(url);
            const now = Date.now();
            if (!cached || (now - cached.timestamp) >= PAGES_CACHE_TTL) {
                await getChapterPages(url);
            }
        } catch (err) {
            console.error(`[Prefetch] Failed for ${url.slice(-30)}`, err);
        }
    });
    return { success: true, queued: urls.length };
}

// Simple in-memory cache for Hot Updates
let hotUpdatesCache: any[] | null = null;
let hotUpdatesCacheTime = 0;
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

// Spotlight cache (same TTL as hot updates)
let spotlightCache: any[] | null = null;
let spotlightCacheTime = 0;

export async function getHotUpdates() {
    const now = Date.now();
    if (hotUpdatesCache && (now - hotUpdatesCacheTime < CACHE_DURATION)) {
        console.log('Serving Hot Updates from cache');
        return hotUpdatesCache;
    }

    try {
        const updates = await mangakatana.getHotUpdates();
        const mappedUpdates = updates.map(u => ({ ...u, id: `mk:${u.id}` }));

        // Update cache
        if (mappedUpdates.length > 0) {
            hotUpdatesCache = mappedUpdates;
            hotUpdatesCacheTime = now;
        }

        return mappedUpdates;
    } catch (error) {
        console.error('Failed to update hot updates cache', error);
        // Return stale cache if available
        if (hotUpdatesCache) return hotUpdatesCache;
        return [];
    }
}

/**
 * Get Spotlight with enriched chapter info
 */
export async function getEnrichedSpotlight() {
    // Check cache first
    const now = Date.now();
    if (spotlightCache && (now - spotlightCacheTime < CACHE_DURATION)) {
        console.log('Serving Spotlight from cache');
        return spotlightCache;
    }

    try {
        // 1. Get Base Trending from AniList
        let topManga: any[] = [];
        try {
            const trending = await anilistService.getTrendingManga(1, 10);
            topManga = trending.media || [];
        } catch (e) {
            console.warn('AniList trending fetch failed, trying fallback...');
        }

        // FALLBACK: If AniList fails (empty array), use MangaKatana Hot Updates
        if (topManga.length === 0) {
            console.log('Using Hot Updates as Spotlight Fallback');
            const hotUpdates = await getHotUpdates();

            // Map Hot Updates to look like AniList Media objects
            const fallbackManga = hotUpdates.slice(0, 10).map((update: any) => ({
                id: update.id, // String ID (mk:...)
                title: {
                    english: update.title,
                    romaji: update.title,
                    native: update.title
                },
                description: `Latest chapter: ${update.chapter}. (Source: MangaKatana)`,
                coverImage: {
                    extraLarge: update.thumbnail,
                    large: update.thumbnail
                },
                format: 'MANGA',
                chapters: parseFloat(update.chapter) || 0,
                status: 'RELEASING',
                averageScore: 0,
                genres: ['Manga'],
                countryOfOrigin: 'JP'
            }));

            return fallbackManga;
        }

        // 2. Enrich with MangaKatana Chapters in BACKGROUND
        // We return the AniList data immediately so the UI doesn't block
        const limitedManga = topManga.slice(0, 8);

        // Start enrichment in background (fire and forget)
        enrichAndCache(limitedManga).catch(err => console.error('Background enrichment failed', err));

        return limitedManga;

    } catch (error) {
        console.error('Error fetching enriched spotlight:', error);
        return [];
    }
}

/**
 * Helper to enrich manga with chapter data and update cache
 */
async function enrichAndCache(mangaList: any[]) {
    console.log('Starting background spotlight enrichment...');
    const enriched = await Promise.all(mangaList.map(async (item: any) => {
        try {
            // Search by title
            const title = item.title?.english || item.title?.romaji || item.title?.native;
            if (!title) return item;

            // Use the EXPORTED searchManga to benefit from its cache
            const mkResults = await searchManga(title);

            // Find best match (simple check: first result)
            if (mkResults && mkResults.length > 0) {
                const match = mkResults[0];
                if (match.latestChapter) {
                    const numMatch = match.latestChapter.match(/(\d+[\.]?\d*)/);
                    if (numMatch) {
                        item.chapters = parseFloat(numMatch[1]);
                    }
                }
            }
        } catch (e) {
            // Ignore errors for individual items
        }
        return item;
    }));

    // Cache the results
    if (enriched.length > 0) {
        spotlightCache = enriched;
        spotlightCacheTime = Date.now();
        console.log(`[Cache] Updated spotlight cache with ${enriched.length} enriched items`);
    }
}

/**
 * Pre-warm the spotlight cache on server startup
 * This runs in the background so the server starts immediately
 */
export async function warmSpotlightCache() {
    console.log('[Cache] Pre-warming spotlight cache...');
    try {
        await getEnrichedSpotlight();
        console.log('[Cache] Spotlight cache warmed successfully');
    } catch (error) {
        console.error('[Cache] Failed to warm spotlight cache:', error);
    }
}

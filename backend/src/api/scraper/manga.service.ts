import * as mangakatana from '../../scraper/mangakatana';
import { anilistService } from '../anilist/anilist.service';

export interface MangaSearchResult extends mangakatana.MangaSearchResult {
    source: 'mangakatana';
}

/**
 * Search manga (MangaKatana only)
 */
export async function searchManga(query: string) {
    const mkResults = await mangakatana.searchManga(query).catch(err => {
        console.error('MangaKatana Search Error:', err.message);
        return [];
    });

    // Prefix IDs to namespace them (optional now, but keeps consistency if we add others later)
    return mkResults.map(r => ({
        ...r,
        id: `mk:${r.id}`,
        source: 'mangakatana' as const
    }));
}

/**
 * Get details
 */
export async function getMangaDetails(id: string) {
    // Strip prefix if present
    const realId = id.startsWith('mk:') ? id.replace('mk:', '') : id;

    // Fallback for legacy or if user tries to load an old asura ID (will fail or default to MK?)
    // If ID starts with asura:, we can't really load it from MK with that ID. 
    // We'll just assume everything is MK.

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

/**
 * Get pages
 */
export async function getChapterPages(url: string) {
    return mangakatana.getChapterPages(url);
}

// Simple in-memory cache for Hot Updates
let hotUpdatesCache: any[] | null = null;
let hotUpdatesCacheTime = 0;
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

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
    try {
        // 1. Get Base Trending from AniList
        const trending = await anilistService.getTrendingManga(1, 10);
        const topManga = trending.media || [];

        // 2. Enrich with MangaKatana Chapters in parallel
        // We limit to top 8 to match UI
        const limitedManga = topManga.slice(0, 8);

        const enriched = await Promise.all(limitedManga.map(async (item: any) => {
            try {
                // Search by title
                const title = item.title?.english || item.title?.romaji || item.title?.native;
                if (!title) return item;

                // Search on MK
                const mkResults = await mangakatana.searchManga(title);

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

        return enriched;
    } catch (error) {
        console.error('Error fetching enriched spotlight:', error);
        return [];
    }
}

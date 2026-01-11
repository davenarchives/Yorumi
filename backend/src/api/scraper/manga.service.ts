import * as mangakatana from '../../scraper/mangakatana';
import * as asura from '../../scraper/asura';

export interface MangaSearchResult extends Omit<mangakatana.MangaSearchResult, 'source'> {
    source: 'mangakatana' | 'asura';
}

/**
 * Search both sources and merge results
 */
export async function searchManga(query: string) {
    // Run searches in parallel
    const [mkResults, asuraResults] = await Promise.all([
        mangakatana.searchManga(query).catch(err => {
            console.error('MangaKatana Search Error:', err.message);
            return [];
        }),
        asura.searchManga(query).catch(err => {
            console.error('Asura Search Error:', err.message);
            return [];
        })
    ]);

    // Prefix IDs to namespace them
    const processedMK = mkResults.map(r => ({
        ...r,
        id: `mk:${r.id}`
    }));

    const processedAsura = asuraResults.map(r => ({
        ...r,
        id: `asura:${r.id}`
    }));

    // Simple interleave or concatenate?
    // Concatenate for now, maybe prioritize MK?
    // Let's return all.
    return [...processedMK, ...processedAsura];
}

/**
 * Get details by routing based on ID prefix
 */
export async function getMangaDetails(id: string) {
    if (id.startsWith('mk:')) {
        const realId = id.replace('mk:', '');
        const details = await mangakatana.getMangaDetails(realId);
        return { ...details, id }; // Keep the prefixed ID for frontend consistency
    } else if (id.startsWith('asura:')) {
        const realId = id.replace('asura:', '');
        const details = await asura.getMangaDetails(realId);
        return { ...details, id };
    } else {
        // Fallback or legacy ID (assume MK)
        const details = await mangakatana.getMangaDetails(id);
        return { ...details, id: `mk:${id}` };
    }
}

/**
 * Get chapter list
 */
export async function getChapterList(id: string) {
    if (id.startsWith('mk:')) {
        const realId = id.replace('mk:', '');
        const chapters = await mangakatana.getChapterList(realId);
        return chapters.map(c => ({ ...c, id: `mk:${c.id}` })); // Does MK need prefixed chapter IDs? No, usually not used for routing, but consistent is good.
        // Actually, MK `getChapterPages` takes URLs, not IDs.
        // But some scrapers might use IDs.
        // Let's check `getChapterPages` arguments.
        // MK: takes URL.
        // Asura: takes URL (via my implementation).
        // So chapter ID is less critical for routing, but good for React keys.
    } else if (id.startsWith('asura:')) {
        const realId = id.replace('asura:', '');
        const chapters = await asura.getChapterList(realId);
        return chapters.map(c => ({ ...c, id: `asura:${c.id}` }));
    } else {
        const chapters = await mangakatana.getChapterList(id);
        return chapters.map(c => ({ ...c, id: `mk:${c.id}` }));
    }
}

/**
 * Get pages (Routing based on URL domain)
 */
export async function getChapterPages(url: string) {
    if (url.includes('asuracomic.net')) {
        return asura.getChapterPages(url);
    } else {
        // Default to MK or other
        return mangakatana.getChapterPages(url);
    }
}

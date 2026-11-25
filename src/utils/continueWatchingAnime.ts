import type { Anime } from '../types/anime';
import type { WatchProgress } from './storage';
import { parseAnimeRouteId } from './animeNavigation';

export const buildContinueAnime = (item: WatchProgress): Anime => {
    const route = parseAnimeRouteId(item.animeId);
    // Legacy numeric history IDs were saved as MAL IDs when available.
    const legacyMalId = /^\d+$/.test(item.animeId) && !item.anilistId && !item.malId
        ? Number(item.animeId) : 0;
    const anilistId = item.anilistId || (route?.source === 'anilist' && !legacyMalId && !item.malId ? Number(route.id) : 0);
    const malId = item.malId || legacyMalId || (route?.source === 'mal' ? Number(route.id) : 0);
    const poster = item.animePoster || item.animeImage || '';
    return {
        id: anilistId,
        mal_id: malId,
        tmdbId: route?.source === 'tmdb' ? Number(route.id) : undefined,
        source: anilistId ? 'anilist' : malId ? 'mal' : route?.source,
        scraperId: route?.source === 'scraper' ? String(route.id) : undefined,
        title: item.animeTitle,
        images: { jpg: { image_url: poster, large_image_url: poster } },
        anilist_banner_image: item.animeImage,
    } as Anime;
};


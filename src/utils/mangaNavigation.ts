import type { Manga } from '../types/manga';

const normalizeId = (value: unknown) => String(value ?? '').trim();

export const getMangaDetailsRouteId = (manga: Partial<Manga> | null | undefined): string => {
    if (!manga) return '';

    const catalogId = normalizeId(manga.id);
    if (/^\d+$/.test(catalogId) && Number(catalogId) > 0) return catalogId;

    const scraperId = normalizeId(manga.scraper_id);
    if (scraperId) return scraperId;

    if (catalogId) return catalogId;
    return normalizeId(manga.mal_id);
};

export const buildMangaDetailsPath = (manga: Partial<Manga> | null | undefined): string => {
    const routeId = getMangaDetailsRouteId(manga);
    return routeId ? `/manga/details/${encodeURIComponent(routeId)}` : '';
};

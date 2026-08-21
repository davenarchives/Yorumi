type AnimeRouteTarget = {
    id?: unknown;
    mal_id?: unknown;
    tmdbId?: unknown;
    tmdb_id?: unknown;
    source?: unknown;
    scraperId?: unknown;
};

const toPositiveNumber = (value: unknown): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const isAnimePaheSessionId = (value: unknown): boolean =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || '').trim());

const isGenericScraperSessionId = (value: unknown): boolean =>
    /^[a-z0-9-]+$/i.test(String(value || '').trim());

const isProviderScraperSessionId = (value: unknown): boolean =>
    /^consumet:[a-z0-9-]+:.+/i.test(String(value || '').trim());

export const isSupportedScraperSessionId = (value: unknown): boolean => {
    const normalized = String(value || '').trim();
    return isAnimePaheSessionId(normalized) || isGenericScraperSessionId(normalized) || isProviderScraperSessionId(normalized);
};

export const getDirectScraperRouteId = (value: unknown): string => {
    const raw = String(value || '')
        .trim()
        .replace(/^https?:\/\/[^/]+/i, '')
        .replace(/^\/+/, '')
        .replace(/^watch\//i, '');

    if (!raw) return '';

    const normalized = raw.startsWith('s:') ? raw : `s:${raw}`;
    const session = normalized.slice(2).trim().split(/[?#]/)[0];
    return isSupportedScraperSessionId(session) ? `s:${session}` : '';
};

export const getAnimeDetailsRouteId = (item: AnimeRouteTarget): string | number | '' => {
    const tmdbId = toPositiveNumber(item.tmdbId ?? item.tmdb_id);
    const source = String(item.source || '').toLowerCase();
    
    if (source === 'tmdb' && tmdbId > 0) {
        return `tmdb-${tmdbId}`;
    }

    const anilistId = toPositiveNumber(item.id);
    if (anilistId > 0) {
        if (tmdbId > 0 && anilistId === tmdbId) {
            return `tmdb-${tmdbId}`;
        }
        return anilistId;
    }

    const malId = toPositiveNumber(item.mal_id);
    if (malId > 0) return malId;

    if (tmdbId > 0) return `tmdb-${tmdbId}`;

    return getDirectScraperRouteId(item.scraperId);
};

export const getAnimeWatchRouteId = (item: AnimeRouteTarget): string | number | '' => {
    const scraperRouteId = getDirectScraperRouteId(item.scraperId);
    if (scraperRouteId) return scraperRouteId;

    const malId = toPositiveNumber(item.mal_id);
    if (malId > 0) return malId;

    return toPositiveNumber(item.id);
};

export type AnimeIdentitySource = 'anilist' | 'mal' | 'tmdb' | 'scraper';

export type AnimeRouteRef = {
    source: AnimeIdentitySource;
    id: number | string;
};

type AnimeRouteTarget = {
    id?: unknown;
    anilistId?: unknown;
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
    /^(consumet|hi|hianime):[a-z0-9-_]+/i.test(String(value || '').trim());

const isHiAnimeSessionId = (value: unknown): boolean =>
    /^hi[-:][a-z0-9-_]+/i.test(String(value || '').trim());

export const isSupportedScraperSessionId = (value: unknown): boolean => {
    const normalized = String(value || '').trim();
    return isAnimePaheSessionId(normalized) || isGenericScraperSessionId(normalized) || isProviderScraperSessionId(normalized) || isHiAnimeSessionId(normalized);
};

const normalizeScraperSession = (value: unknown): string => {
    const raw = String(value || '')
        .trim()
        .replace(/^s:/i, '')
        .replace(/^scraper-/i, '')
        .replace(/^https?:\/\/[^/]+/i, '')
        .replace(/^\/+/, '')
        .replace(/^watch\//i, '');
    const session = raw.split(/[?#]/)[0].trim();
    return isSupportedScraperSessionId(session) ? session : '';
};

export const getDirectScraperRouteId = (value: unknown): string => {
    const session = normalizeScraperSession(value);
    return session ? `s:${session}` : '';
};

export const parseAnimeRouteId = (value: unknown): AnimeRouteRef | null => {
    const routeId = decodeURIComponent(String(value || '').trim());
    if (!routeId) return null;

    const prefixedNumber = routeId.match(/^(al|anilist|mal|tmdb)-(\d+)$/i);
    if (prefixedNumber) {
        const source = prefixedNumber[1].toLowerCase();
        return {
            source: source === 'al' || source === 'anilist' ? 'anilist' : source as 'mal' | 'tmdb',
            id: Number(prefixedNumber[2]),
        };
    }

    const scraperId = normalizeScraperSession(routeId);
    if (/^(s:|scraper-)/i.test(routeId) && scraperId) {
        return { source: 'scraper', id: scraperId };
    }

    const legacyId = toPositiveNumber(routeId);
    if (legacyId) return { source: 'anilist', id: legacyId };
    if (scraperId) return { source: 'scraper', id: scraperId };
    return null;
};

export const buildAnimeRouteId = (ref: AnimeRouteRef): string => {
    if (ref.source === 'anilist') return `al-${toPositiveNumber(ref.id)}`;
    if (ref.source === 'mal') return `mal-${toPositiveNumber(ref.id)}`;
    if (ref.source === 'tmdb') return `tmdb-${toPositiveNumber(ref.id)}`;
    return getDirectScraperRouteId(ref.id);
};

export const getAnimeDetailsRouteId = (item: AnimeRouteTarget): string => {
    const explicitAnilistId = toPositiveNumber(item.anilistId);
    const anilistId = toPositiveNumber(item.id);
    const malId = toPositiveNumber(item.mal_id);
    const tmdbId = toPositiveNumber(item.tmdbId ?? item.tmdb_id);
    const source = String(item.source || '').toLowerCase();

    if (source === 'tmdb' && tmdbId) return buildAnimeRouteId({ source: 'tmdb', id: tmdbId });
    if (source === 'mal' && malId && !explicitAnilistId && !anilistId) return buildAnimeRouteId({ source: 'mal', id: malId });
    if (explicitAnilistId) return buildAnimeRouteId({ source: 'anilist', id: explicitAnilistId });
    if (anilistId) return buildAnimeRouteId({ source: 'anilist', id: anilistId });
    if (tmdbId) return buildAnimeRouteId({ source: 'tmdb', id: tmdbId });
    if (malId) return buildAnimeRouteId({ source: 'mal', id: malId });
    return getDirectScraperRouteId(item.scraperId);
};

export const getAnimeWatchRouteId = getAnimeDetailsRouteId;

export const getCanonicalAnimeKey = (item: AnimeRouteTarget): string => {
    const routeId = getAnimeDetailsRouteId(item);
    const ref = parseAnimeRouteId(routeId);
    return ref ? `${ref.source}:${ref.id}` : '';
};

export const buildAnimeDetailsPath = (
    item: AnimeRouteTarget,
    options: { episode?: number | string; time?: number } = {}
): string => {
    const routeId = getAnimeDetailsRouteId(item);
    if (!routeId) return '';
    const params = new URLSearchParams();
    if (options.episode !== undefined) params.set('ep', String(options.episode));
    if (options.time && options.time > 0) params.set('t', String(Math.floor(options.time)));
    const query = params.toString();
    return `/anime/details/${encodeURIComponent(routeId)}${query ? `?${query}` : ''}`;
};

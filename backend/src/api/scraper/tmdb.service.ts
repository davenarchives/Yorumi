import axios from 'axios';
import { cacheGet, cacheSet } from '../../utils/redis-cache';

const TMDB_API_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
const TMDB_ACCESS_TOKEN = process.env.TMDB_ACCESS_TOKEN || process.env.TMDB_BEARER_TOKEN || '';
const TMDB_API_KEY = process.env.TMDB_API_KEY || process.env.THEMOVIEDB_API_KEY || '';

type TmdbSearchInput = {
    title?: string;
    titles?: Array<string | undefined>;
    year?: string | number;
    format?: string;
};

type TmdbSearchResult = {
    id: number;
    name?: string;
    title?: string;
    original_name?: string;
    original_title?: string;
    first_air_date?: string;
    release_date?: string;
    origin_country?: string[];
    original_language?: string;
    backdrop_path?: string;
    poster_path?: string;
    popularity?: number;
};

type TmdbMediaType = 'tv' | 'movie';

type TmdbWatchProvider = {
    provider_id: number;
    provider_name: string;
    logo_path?: string | null;
    display_priority?: number;
};

type TmdbWatchProviderRegion = {
    link?: string;
    flatrate?: TmdbWatchProvider[];
    free?: TmdbWatchProvider[];
    ads?: TmdbWatchProvider[];
    rent?: TmdbWatchProvider[];
    buy?: TmdbWatchProvider[];
};

type WatchProviderOption = {
    id: number;
    name: string;
    logoUrl?: string;
    type: 'flatrate' | 'free' | 'ads' | 'rent' | 'buy';
    displayPriority: number;
};

type WatchProviderResult = {
    tmdbId: number;
    mediaType: TmdbMediaType;
    country: string;
    link?: string;
    providers: WatchProviderOption[];
};

type TmdbMediaTarget = {
    tmdbId: number;
    mediaType: TmdbMediaType;
    title?: string;
    year?: string;
};

const normalizeTitle = (value: unknown) =>
    String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const getYear = (value: unknown) => {
    const match = String(value || '').match(/\b(19|20)\d{2}\b/);
    return match?.[0] || '';
};

class TmdbService {
    private memoryCache = new Map<string, { expiresAt: number; value: unknown }>();

    private isConfigured() {
        return Boolean(TMDB_ACCESS_TOKEN || TMDB_API_KEY);
    }

    public async get<T>(path: string, params: Record<string, unknown>) {
        if (!this.isConfigured()) return null;

        const { data } = await axios.get<T>(`${TMDB_API_BASE}${path}`, {
            params: TMDB_API_KEY ? { ...params, api_key: TMDB_API_KEY } : params,
            timeout: 8000,
            proxy: false,
            headers: {
                Accept: 'application/json',
                ...(TMDB_ACCESS_TOKEN ? { Authorization: `Bearer ${TMDB_ACCESS_TOKEN}` } : {}),
            },
        });

        return data;
    }

    public buildImageUrl(path?: string | null, size = 'original') {
        const filePath = String(path || '').trim();
        return filePath ? `${TMDB_IMAGE_BASE}/${size}${filePath}` : '';
    }

    private scoreCandidate(candidate: TmdbSearchResult, titleTokens: string[], year?: string) {
        const candidateTitles = [...new Set([
            candidate.name,
            candidate.title,
            candidate.original_name,
            candidate.original_title,
        ].map(normalizeTitle).filter(Boolean))];
        let score = Number(candidate.popularity || 0) / 100;

        for (const target of titleTokens) {
            let bestTitleScore = 0;
            for (const candidateTitle of candidateTitles) {
                if (candidateTitle === target) bestTitleScore = Math.max(bestTitleScore, 100);
                else if (candidateTitle.includes(target) || target.includes(candidateTitle)) bestTitleScore = Math.max(bestTitleScore, 55);
            }
            score += bestTitleScore;
        }

        const candidateYear = getYear(candidate.first_air_date || candidate.release_date);
        if (year && candidateYear === year) score += 25;
        if (candidate.backdrop_path) score += 15;
        if (candidate.origin_country?.includes('JP') || candidate.original_language === 'ja') score += 1000;

        return score;
    }

    private getMediaTypes(format?: string): TmdbMediaType[] {
        return String(format || '').toUpperCase() === 'MOVIE'
            ? ['movie', 'tv']
            : ['tv', 'movie'];
    }

    private async findBestMatch(input: TmdbSearchInput) {
        const titles = [
            ...(Array.isArray(input.titles) ? input.titles : []),
            input.title,
        ].map((title) => String(title || '').trim()).filter(Boolean);
        const titleTokens = [...new Set(titles.map(normalizeTitle).filter(Boolean))];
        if (titleTokens.length === 0 || !this.isConfigured()) return null;

        const year = getYear(input.year);
        const candidates: Array<{ candidate: TmdbSearchResult; mediaType: TmdbMediaType }> = [];

        for (const title of titles.slice(0, 3)) {
            for (const mediaType of this.getMediaTypes(input.format)) {
                const payload = await this.get<{ results?: TmdbSearchResult[] }>(`/search/${mediaType}`, {
                    query: title,
                    include_adult: false,
                    language: 'en-US',
                    // Intentionally NOT passing 'year' directly to TMDB API because long-running TV shows
                    // have a first_air_date from Season 1, which will cause 0 results if we pass a newer season's year.
                }).catch(() => null);

                if (Array.isArray(payload?.results)) {
                    candidates.push(...payload.results.map((candidate) => ({ candidate, mediaType })));
                }
            }
        }

        // Determine the preferred media type from the input format.
        // When format is explicitly 'TV' (or any TV variant), strongly prefer TV results
        // to prevent movies from the same franchise outscoring the TV series via popularity.
        const upperFormat = String(input.format || '').toUpperCase();
        const preferredMediaType: TmdbMediaType | null =
            upperFormat === 'MOVIE' ? 'movie' :
            (upperFormat === 'TV' || upperFormat === 'TV_SHORT' || upperFormat === 'ONA' || upperFormat === 'OVA' || upperFormat === 'SPECIAL')
                ? 'tv' : null;

        return candidates
            .map((entry) => ({
                ...entry,
                score: this.scoreCandidate(entry.candidate, titleTokens, year)
                    + (preferredMediaType && entry.mediaType === preferredMediaType ? 500 : 0),
            }))
            .sort((a, b) => b.score - a.score)[0] || null;
    }

    async resolveBackdrop(input: TmdbSearchInput): Promise<string | undefined> {
        const titles = [
            ...(Array.isArray(input.titles) ? input.titles : []),
            input.title,
        ].map((title) => String(title || '').trim()).filter(Boolean);
        const titleTokens = [...new Set(titles.map(normalizeTitle).filter(Boolean))];
        if (titleTokens.length === 0 || !this.isConfigured()) return undefined;

        const year = getYear(input.year);
        const cacheKey = `tmdb:backdrop:v2:${titleTokens.join('|')}:${year}:${String(input.format || '').toUpperCase()}`;
        const now = Date.now();
        const mem = this.memoryCache.get(cacheKey);
        if (mem && mem.expiresAt > now) return (mem.value as string | null) || undefined;

        const redisCached = await cacheGet<string | null>(cacheKey).catch(() => null);
        if (redisCached !== null) {
            this.memoryCache.set(cacheKey, { expiresAt: now + 24 * 60 * 60 * 1000, value: redisCached });
            return redisCached || undefined;
        }

        const best = (await this.findBestMatch(input))?.candidate;
        const resolved = this.buildImageUrl(best?.backdrop_path || best?.poster_path) || null;

        this.memoryCache.set(cacheKey, { expiresAt: now + 24 * 60 * 60 * 1000, value: resolved });
        cacheSet(cacheKey, resolved, 24 * 60 * 60).catch(() => undefined);

        return resolved || undefined;
    }

    async resolveMediaTarget(input: TmdbSearchInput): Promise<TmdbMediaTarget | null> {
        const titles = [
            ...(Array.isArray(input.titles) ? input.titles : []),
            input.title,
        ].map((title) => String(title || '').trim()).filter(Boolean);
        const titleTokens = [...new Set(titles.map(normalizeTitle).filter(Boolean))];
        if (titleTokens.length === 0 || !this.isConfigured()) return null;

        const year = getYear(input.year);
        const cacheKey = `tmdb:media-target:v6:${titleTokens.join('|')}:${year}:${String(input.format || '').toUpperCase()}`;
        const now = Date.now();
        const mem = this.memoryCache.get(cacheKey);
        if (mem && mem.expiresAt > now) return (mem.value as TmdbMediaTarget | null) || null;

        const redisCached = await cacheGet<TmdbMediaTarget | null>(cacheKey).catch(() => null);
        if (redisCached !== null) {
            this.memoryCache.set(cacheKey, { expiresAt: now + 24 * 60 * 60 * 1000, value: redisCached });
            return redisCached || null;
        }

        const match = await this.findBestMatch(input);
        if (!match?.candidate?.id) {
            this.memoryCache.set(cacheKey, { expiresAt: now + 6 * 60 * 60 * 1000, value: null });
            cacheSet(cacheKey, null, 6 * 60 * 60).catch(() => undefined);
            return null;
        }

        const resolved: TmdbMediaTarget = {
            tmdbId: match.candidate.id,
            mediaType: match.mediaType,
            title: match.candidate.name || match.candidate.title,
            year: getYear(match.candidate.first_air_date || match.candidate.release_date) || undefined,
        };

        this.memoryCache.set(cacheKey, { expiresAt: now + 24 * 60 * 60 * 1000, value: resolved });
        cacheSet(cacheKey, resolved, 24 * 60 * 60).catch(() => undefined);

        return resolved;
    }

    async resolveWatchProviders(input: TmdbSearchInput & { country?: string }): Promise<WatchProviderResult | null> {
        const titles = [
            ...(Array.isArray(input.titles) ? input.titles : []),
            input.title,
        ].map((title) => String(title || '').trim()).filter(Boolean);
        const titleTokens = [...new Set(titles.map(normalizeTitle).filter(Boolean))];
        if (titleTokens.length === 0 || !this.isConfigured()) return null;

        const country = String(input.country || 'US').trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2) || 'US';
        const cacheKey = `tmdb:watch-providers:v2:${titleTokens.join('|')}:${getYear(input.year)}:${String(input.format || '').toUpperCase()}:${country}`;
        const now = Date.now();
        const mem = this.memoryCache.get(cacheKey);
        if (mem && mem.expiresAt > now) return (mem.value as WatchProviderResult | null) || null;

        const redisCached = await cacheGet<WatchProviderResult | null>(cacheKey).catch(() => null);
        if (redisCached !== null) {
            this.memoryCache.set(cacheKey, { expiresAt: now + 24 * 60 * 60 * 1000, value: redisCached });
            return redisCached || null;
        }

        const match = await this.findBestMatch(input);
        if (!match?.candidate?.id) {
            this.memoryCache.set(cacheKey, { expiresAt: now + 6 * 60 * 60 * 1000, value: null });
            cacheSet(cacheKey, null, 6 * 60 * 60).catch(() => undefined);
            return null;
        }

        const payload = await this.get<{ results?: Record<string, TmdbWatchProviderRegion> }>(
            `/${match.mediaType}/${match.candidate.id}/watch/providers`,
            {}
        ).catch(() => null);
        const region = payload?.results?.[country];
        if (!region) {
            this.memoryCache.set(cacheKey, { expiresAt: now + 6 * 60 * 60 * 1000, value: null });
            cacheSet(cacheKey, null, 6 * 60 * 60).catch(() => undefined);
            return null;
        }

        const seen = new Set<string>();
        const providerTypes: Array<WatchProviderOption['type']> = ['flatrate', 'free', 'ads', 'rent', 'buy'];
        const providers = providerTypes.flatMap((type) =>
            (region[type] || []).map((provider) => ({
                id: provider.provider_id,
                name: provider.provider_name,
                logoUrl: this.buildImageUrl(provider.logo_path, 'w92') || undefined,
                type,
                displayPriority: Number(provider.display_priority || 0),
            }))
        ).filter((provider) => {
            const key = `${provider.id}:${provider.type}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return Boolean(provider.id && provider.name);
        }).sort((a, b) => a.displayPriority - b.displayPriority);

        const resolved: WatchProviderResult = {
            tmdbId: match.candidate.id,
            mediaType: match.mediaType,
            country,
            link: region.link,
            providers,
        };

        this.memoryCache.set(cacheKey, { expiresAt: now + 24 * 60 * 60 * 1000, value: resolved });
        cacheSet(cacheKey, resolved, 24 * 60 * 60).catch(() => undefined);

        return resolved;
    }

    async resolveTvEpisodeThumbnails(tmdbId: number, options?: { seasonNumber?: number, fetchAllSeasons?: boolean }): Promise<Map<number, string>> {
        const fetchAll = options?.fetchAllSeasons;
        const seasonNumber = options?.seasonNumber || 1;
        const cacheKey = `tmdb:episode-thumbnails:v3:${tmdbId}:${fetchAll ? 'all' : seasonNumber}`;
        const now = Date.now();
        const mem = this.memoryCache.get(cacheKey);
        
        if (mem && mem.expiresAt > now) {
            const cachedMap = mem.value as Record<number, string>;
            return new Map(Object.entries(cachedMap).map(([k, v]) => [Number(k), v]));
        }

        const redisCached = await cacheGet<Record<number, string>>(cacheKey).catch(() => null);
        if (redisCached) {
            this.memoryCache.set(cacheKey, { expiresAt: now + 24 * 60 * 60 * 1000, value: redisCached });
            return new Map(Object.entries(redisCached).map(([k, v]) => [Number(k), v]));
        }

        let episodesData: Array<{ episode_number: number, still_path: string | null }> = [];

        if (fetchAll) {
            const tvPayload = await this.get<{ number_of_seasons?: number }>(`/tv/${tmdbId}`, {}).catch(() => null);
            const numSeasons = tvPayload?.number_of_seasons || 1;
            const seasonPromises = [];
            const maxSeasons = Math.min(numSeasons, 30);
            for (let i = 1; i <= maxSeasons; i++) {
                seasonPromises.push(
                    this.get<{ episodes?: Array<{ episode_number: number, still_path: string | null }> }>(
                        `/tv/${tmdbId}/season/${i}`, {}
                    ).catch(() => null)
                );
            }
            const results = await Promise.all(seasonPromises);
            for (const res of results) {
                if (Array.isArray(res?.episodes)) {
                    episodesData.push(...res.episodes);
                }
            }
        } else {
            const payload = await this.get<{ episodes?: Array<{ episode_number: number, still_path: string | null }> }>(
                `/tv/${tmdbId}/season/${seasonNumber}`,
                {}
            ).catch(() => null);
            if (Array.isArray(payload?.episodes)) {
                episodesData = payload.episodes;
            }
        }

        const thumbnailMap = new Map<number, string>();
        const toCache: Record<number, string> = {};

        let absoluteCounter = 1;
        episodesData.forEach((ep) => {
            if (ep.episode_number && ep.still_path) {
                const url = this.buildImageUrl(ep.still_path, 'w780');
                if (url) {
                    if (!thumbnailMap.has(ep.episode_number)) {
                        thumbnailMap.set(ep.episode_number, url);
                        toCache[ep.episode_number] = url;
                    }
                    
                    if (!thumbnailMap.has(absoluteCounter)) {
                        thumbnailMap.set(absoluteCounter, url);
                        toCache[absoluteCounter] = url;
                    }
                    absoluteCounter++;
                }
            }
        });

        if (thumbnailMap.size > 0) {
            this.memoryCache.set(cacheKey, { expiresAt: now + 24 * 60 * 60 * 1000, value: toCache });
            cacheSet(cacheKey, toCache, 24 * 60 * 60).catch(() => undefined);
        } else {
            this.memoryCache.set(cacheKey, { expiresAt: now + 6 * 60 * 60 * 1000, value: {} });
        }

        return thumbnailMap;
    }

    async resolveAbsoluteEpisode(tmdbId: number, absoluteEpisode: number): Promise<{ seasonNumber: number; relativeEpisode: number } | null> {
        const cacheKey = `tmdb:absolute-episode:v2:${tmdbId}:${absoluteEpisode}`;
        const now = Date.now();
        const mem = this.memoryCache.get(cacheKey);
        
        if (mem && mem.expiresAt > now) {
            return (mem.value as { seasonNumber: number; relativeEpisode: number } | null);
        }

        const redisCached = await cacheGet<{ seasonNumber: number; relativeEpisode: number } | null>(cacheKey).catch(() => null);
        if (redisCached !== null) {
            this.memoryCache.set(cacheKey, { expiresAt: now + 24 * 60 * 60 * 1000, value: redisCached });
            return redisCached;
        }

        const tvPayload = await this.get<{ seasons?: Array<{ season_number: number; episode_count: number }> }>(`/tv/${tmdbId}`, {}).catch(() => null);
        
        let resolved: { seasonNumber: number; relativeEpisode: number } | null = null;
        let remainingEpisodes = absoluteEpisode;

        if (Array.isArray(tvPayload?.seasons)) {
            const validSeasons = tvPayload.seasons
                .filter(s => s.season_number > 0)
                .sort((a, b) => a.season_number - b.season_number);
                
            for (const season of validSeasons) {
                if (remainingEpisodes <= season.episode_count) {
                    resolved = { seasonNumber: season.season_number, relativeEpisode: remainingEpisodes };
                    break;
                }
                remainingEpisodes -= season.episode_count;
            }
        }

        if (!resolved && absoluteEpisode > 0) {
            resolved = { seasonNumber: 1, relativeEpisode: absoluteEpisode };
        }

        this.memoryCache.set(cacheKey, { expiresAt: now + 24 * 60 * 60 * 1000, value: resolved });
        cacheSet(cacheKey, resolved, 24 * 60 * 60).catch(() => undefined);

        return resolved;
    }

    async resolveSeasonByTitle(tmdbId: number, searchTitle: string): Promise<number | null> {
        if (!searchTitle) return null;

        const cacheKey = `tmdb:season-by-title:v1:${tmdbId}:${normalizeTitle(searchTitle)}`;
        const now = Date.now();
        const mem = this.memoryCache.get(cacheKey);
        if (mem && mem.expiresAt > now) return (mem.value as number | null) || null;

        const redisCached = await cacheGet<number | null>(cacheKey).catch(() => null);
        if (redisCached !== null) {
            this.memoryCache.set(cacheKey, { expiresAt: now + 24 * 60 * 60 * 1000, value: redisCached });
            return redisCached || null;
        }

        const tvPayload = await this.get<{ seasons?: Array<{ season_number: number; name: string }> }>(`/tv/${tmdbId}`, {}).catch(() => null);
        let resolvedSeason: number | null = null;

        if (Array.isArray(tvPayload?.seasons)) {
            const normalizedSearch = searchTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
            for (const season of tvPayload.seasons) {
                if (season.season_number === 0) continue;
                const normalizedSeasonName = (season.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                if (normalizedSeasonName.length > 3 && normalizedSearch.includes(normalizedSeasonName)) {
                    resolvedSeason = season.season_number;
                    break;
                }
            }
        }
        
        if (!resolvedSeason) {
            // Try fallback regex for "Season X"
            const match = searchTitle.match(/season\s*(\d+)|(\d+)(st|nd|rd|th)\s*season/i) || searchTitle.match(/(?:^|\s)([2-9])$/i);
            if (match) {
                const parsed = parseInt(match[1] || match[2] || match[3]);
                if (!isNaN(parsed) && parsed > 0) resolvedSeason = parsed;
            }
        }

        this.memoryCache.set(cacheKey, { expiresAt: now + 24 * 60 * 60 * 1000, value: resolvedSeason });
        cacheSet(cacheKey, resolvedSeason, 24 * 60 * 60).catch(() => undefined);

        return resolvedSeason;
    }
}

export const tmdbService = new TmdbService();

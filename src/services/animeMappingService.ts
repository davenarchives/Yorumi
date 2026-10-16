import { API_BASE } from '../config/api';
import type { AnimeEpisodeSegment } from '../utils/animeEpisodeMapping';
import type { MappingStatus } from '../utils/contentIdentity';

export interface CanonicalAnimeMapping {
    yorumiId: string;
    anilistId: number;
    malId?: number;
    tmdbShowId?: number;
    tmdbMovieId?: number;
    segments: AnimeEpisodeSegment[];
    status: MappingStatus;
    source: string;
    schemaVersion?: string;
    generatedOn?: string;
    conflicts: string[];
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const NEGATIVE_CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { timestamp: number; mappings: CanonicalAnimeMapping[] }>();
const inFlight = new Map<string, Promise<CanonicalAnimeMapping[]>>();

const load = async (key: string, query: string) => {
    const cached = cache.get(key);
    const ttl = cached?.mappings.length ? CACHE_TTL_MS : NEGATIVE_CACHE_TTL_MS;
    if (cached && Date.now() - cached.timestamp < ttl) return cached.mappings;
    const pending = inFlight.get(key);
    if (pending) return pending;

    const request = fetch(`${API_BASE}/anime/mappings?${query}`)
        .then(async (response) => {
            if (!response.ok) return [];
            const payload = await response.json() as { mappings?: CanonicalAnimeMapping[] };
            const mappings = Array.isArray(payload.mappings) ? payload.mappings : [];
            cache.set(key, { timestamp: Date.now(), mappings });
            return mappings;
        })
        .catch(() => [])
        .finally(() => inFlight.delete(key));
    inFlight.set(key, request);
    return request;
};

export const animeMappingService = {
    getByAniListId(anilistId: number) {
        return load(`anilist:${anilistId}`, `anilistId=${encodeURIComponent(anilistId)}`)
            .then((mappings) => mappings[0] || null);
    },

    getByTmdbId(tmdbId: number, mediaType: 'tv' | 'movie' = 'tv') {
        return load(
            `tmdb:${mediaType}:${tmdbId}`,
            `tmdbId=${encodeURIComponent(tmdbId)}&mediaType=${mediaType}`
        );
    },
};

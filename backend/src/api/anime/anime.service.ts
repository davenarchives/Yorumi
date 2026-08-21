import { tmdbService } from '../scraper/tmdb.service';
import { cacheGet, cacheSet } from '../../utils/redis-cache';
import { anilistService } from '../anilist/anilist.service';

const FIVE_MINUTES_SECONDS = 5 * 60;
const ONE_DAY_SECONDS = 24 * 60 * 60;

function toPositiveInt(value: unknown, fallback: number, max = 50) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.min(Math.floor(parsed), max);
}

function parseList(value: unknown) {
    return String(value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

function parseSort(value: unknown, fallback: string[]) {
    const parsed = parseList(value);
    return parsed.length > 0 ? parsed : fallback;
}

function getYear(dateStr: string | undefined): number | undefined {
    if (!dateStr) return undefined;
    const y = parseInt(dateStr.substring(0, 4));
    return isNaN(y) ? undefined : y;
}

function getSeason(dateStr: string | undefined): string | undefined {
    if (!dateStr) return undefined;
    const m = parseInt(dateStr.substring(5, 7));
    if (isNaN(m)) return undefined;
    if (m <= 3) return 'WINTER';
    if (m <= 6) return 'SPRING';
    if (m <= 9) return 'SUMMER';
    return 'FALL';
}

function mapTmdbStatus(status: string | undefined): string {
    switch (status) {
        case 'Returning Series': return 'RELEASING';
        case 'Ended': return 'FINISHED';
        case 'Canceled': return 'CANCELLED';
        case 'In Production': return 'NOT_YET_RELEASED';
        case 'Planned': return 'NOT_YET_RELEASED';
        default: return status ? status.toUpperCase().replace(/\s+/g, '_') : 'FINISHED';
    }
}

function mapTmdbToAnilistMedia(item: any, isFullDetails = false): any {
    if (!item) return null;
    return {
        id: item.id,
        tmdbId: item.id,
        title: {
            romaji: item.name || item.original_name || item.title,
            english: item.name || item.title,
            native: item.original_name || item.original_title,
            userPreferred: item.name || item.original_name || item.title
        },
        coverImage: {
            extraLarge: tmdbService.buildImageUrl(item.poster_path, 'w780'),
            large: tmdbService.buildImageUrl(item.poster_path, 'w500'),
            medium: tmdbService.buildImageUrl(item.poster_path, 'w342'),
            color: '#000000'
        },
        bannerImage: tmdbService.buildImageUrl(item.backdrop_path, 'w1280') || tmdbService.buildImageUrl(item.poster_path, 'w1280'),
        description: item.overview,
        episodes: item.media_type === 'movie' ? 1 : item.number_of_episodes,
        status: mapTmdbStatus(item.status),
        season: getSeason(item.first_air_date || item.release_date),
        seasonYear: getYear(item.first_air_date || item.release_date),
        genres: (item.genres || []).map((g: any) => g.name || 'Anime'),
        tags: [],
        averageScore: Math.round((item.vote_average || 0) * 10),
        meanScore: Math.round((item.vote_average || 0) * 10),
        popularity: Math.round(item.popularity || 0),
        format: item.media_type === 'movie' ? 'MOVIE' : 'TV',
        isAdult: false,
        startDate: {
            year: getYear(item.first_air_date || item.release_date),
            month: (item.first_air_date || item.release_date) ? parseInt((item.first_air_date || item.release_date).substring(5, 7)) : null,
            day: (item.first_air_date || item.release_date) ? parseInt((item.first_air_date || item.release_date).substring(8, 10)) : null
        },
        countryOfOrigin: 'JP',
        characters: { edges: [] },
        relations: { edges: [] },
        recommendations: { nodes: [] },
        staff: { edges: [] },
        studios: { nodes: (Array.isArray(item.production_companies) ? item.production_companies : []).map((c: any) => ({ name: c.name })) },
        externalLinks: [],
        streamingEpisodes: [],
    };
}

export const streambertAnimeService = {
    parseSearchFilters(query: Record<string, unknown>) {
        return {
            query: String(query.query || query.q || '').trim(),
            page: toPositiveInt(query.page, 1, 500),
            perPage: toPositiveInt(query.perPage || query.limit, 20, 50),
            season: query.season ? String(query.season).toUpperCase() : undefined,
            seasonYear: query.seasonYear || query.year ? toPositiveInt(query.seasonYear || query.year, new Date().getFullYear(), 3000) : undefined,
        };
    },

    async getMetadata(tmdbId: number, format?: string) {
        const cacheKey = `anime:tmdb:meta:v9:${tmdbId}:${format || 'unknown'}`;
        const cached = await cacheGet<any>(cacheKey);
        if (cached) return cached;

        let payload;
        if (format === 'MOVIE') {
            payload = await tmdbService.get<any>(`/movie/${tmdbId}`, { append_to_response: 'credits,recommendations,similar' }).catch(() => null);
            if (payload) {
                payload.media_type = 'movie';
            } else {
                payload = await tmdbService.get<any>(`/tv/${tmdbId}`, { append_to_response: 'credits,recommendations,similar' }).catch(() => null);
                if (payload) payload.media_type = 'tv';
            }
        } else {
            payload = await tmdbService.get<any>(`/tv/${tmdbId}`, { append_to_response: 'credits,recommendations,similar' }).catch(() => null);
            if (payload) {
                payload.media_type = 'tv';
            } else {
                payload = await tmdbService.get<any>(`/movie/${tmdbId}`, { append_to_response: 'credits,recommendations,similar' }).catch(() => null);
                if (payload) payload.media_type = 'movie';
            }
        }

        if (!payload) return null;

        const media = mapTmdbToAnilistMedia(payload, true);
        
        if (payload.credits?.cast) {
            media!.characters.edges = payload.credits.cast.slice(0, 15).map((cast: any) => ({
                role: 'MAIN',
                node: { id: cast.id, name: { full: cast.character, native: cast.character }, image: { large: tmdbService.buildImageUrl(cast.profile_path, 'w500') } },
                voiceActors: [{ id: cast.id, name: { full: cast.name, native: cast.name }, image: { large: tmdbService.buildImageUrl(cast.profile_path, 'w500') }, languageV2: 'Japanese' }]
            }));
        }

        if (payload.recommendations?.results) {
            media!.recommendations.nodes = payload.recommendations.results.slice(0, 12).map((rec: any) => ({
                mediaRecommendation: mapTmdbToAnilistMedia(rec)
            }));
        } else if (payload.similar?.results) {
            media!.recommendations.nodes = payload.similar.results.slice(0, 12).map((rec: any) => ({
                mediaRecommendation: mapTmdbToAnilistMedia(rec)
            }));
        }

        if (media) {
            try {
                const titles = [
                    media.title?.english,
                    media.title?.romaji,
                    media.title?.native,
                    payload.name,
                    payload.original_name,
                ].filter(Boolean);

                const anilistMatch = await anilistService.findBestAnimeMatch({
                    titles,
                    format: media.format,
                    year: media.seasonYear,
                    episodes: media.episodes,
                    perPage: 5,
                }).catch(() => null);

                if (anilistMatch?.id) {
                    const fullAnilist = await anilistService.getAnimeById(anilistMatch.id).catch(() => null);
                    if (fullAnilist) {
                        media.id = fullAnilist.id;
                        media.idMal = fullAnilist.idMal || fullAnilist.id;
                        media.relations = fullAnilist.relations || media.relations;
                        if (fullAnilist.title) media.title = fullAnilist.title;
                        if (fullAnilist.characters?.edges?.length) media.characters = fullAnilist.characters;
                        if (fullAnilist.episodes) media.episodes = fullAnilist.episodes;
                        if (fullAnilist.status) media.status = fullAnilist.status;
                        if (fullAnilist.nextAiringEpisode) (media as any).nextAiringEpisode = fullAnilist.nextAiringEpisode;
                        if (fullAnilist.studios?.nodes?.length) media.studios = fullAnilist.studios;
                    } else {
                        if (anilistMatch.nextAiringEpisode) {
                            (media as any).nextAiringEpisode = anilistMatch.nextAiringEpisode;
                        }
                        if (anilistMatch.status) {
                            media.status = anilistMatch.status;
                        }
                        if (anilistMatch.studios?.nodes?.length) {
                            media.studios = anilistMatch.studios;
                        }
                        if (anilistMatch.episodes) {
                            media.episodes = media.episodes || anilistMatch.episodes;
                        }
                    }
                }
            } catch {
                // Keep base media if AniList match fails
            }
        }

        await cacheSet(cacheKey, media, ONE_DAY_SECONDS);
        return media;
    },

    async search(filters: any) {
        const page = filters.page || 1;
        
        let path = '/discover/tv';
        let sort_by = 'popularity.desc';
        if (filters.sort && Array.isArray(filters.sort)) {
            if (filters.sort.includes('POPULARITY_DESC')) {
                sort_by = 'popularity.desc';
            }
            if (filters.sort.includes('VOTE_COUNT_DESC') || filters.sort.includes('ALL_TIME_POPULAR')) {
                sort_by = 'vote_count.desc';
            }
        }

        let params: Record<string, any> = {
            with_genres: '16',
            with_original_language: 'ja',
            sort_by,
            page,
            include_adult: false,
        };

        if (filters.query) {
            path = '/search/multi';
            params = {
                query: filters.query,
                page,
                include_adult: false,
                language: 'en-US'
            };
        } else if (filters.seasonYear) {
            let firstDate = `${filters.seasonYear}-01-01`;
            let lastDate = `${filters.seasonYear}-12-31`;
            
            if (filters.season === 'WINTER') { firstDate = `${filters.seasonYear}-01-01`; lastDate = `${filters.seasonYear}-03-31`; }
            else if (filters.season === 'SPRING') { firstDate = `${filters.seasonYear}-04-01`; lastDate = `${filters.seasonYear}-06-30`; }
            else if (filters.season === 'SUMMER') { firstDate = `${filters.seasonYear}-07-01`; lastDate = `${filters.seasonYear}-09-30`; }
            else if (filters.season === 'FALL') { firstDate = `${filters.seasonYear}-10-01`; lastDate = `${filters.seasonYear}-12-31`; }

            params['first_air_date.gte'] = firstDate;
            params['first_air_date.lte'] = lastDate;
        }

        const cacheKey = `anime:tmdb:search:v3:${Buffer.from(JSON.stringify({ path, params })).toString('base64url')}`;
        const cached = await cacheGet<any>(cacheKey);
        if (cached) return cached;

        const payload = await tmdbService.get<any>(path, params);
        if (!payload || !payload.results) return { pageInfo: { total: 0, perPage: 20, currentPage: page, lastPage: 1, hasNextPage: false }, media: [] };

        let results = payload.results;
        if (filters.query) {
            results = results.filter((item: any) => {
                if (item.media_type === 'person') return false;
                const lang = item.original_language;
                const countries = item.origin_country || [];
                const genreIds = item.genre_ids || [];
                const hasAnimation = genreIds.includes(16);
                return hasAnimation && (lang === 'ja' || countries.includes('JP'));
            });
        }

        const res = {
            pageInfo: {
                total: payload.total_results || 0,
                perPage: 20,
                currentPage: payload.page || 1,
                lastPage: payload.total_pages || 1,
                hasNextPage: (payload.page || 1) < (payload.total_pages || 1)
            },
            media: results.map((i: any) => mapTmdbToAnilistMedia(i))
        };

        await cacheSet(cacheKey, res, FIVE_MINUTES_SECONDS);
        return res;
    },

    async getEpisodes(tmdbId: number) {
        const metadata = await this.getMetadata(tmdbId);
        if (!metadata) return null;

        let thumbnailsMap = new Map<number, string>();
        if (metadata.format !== 'MOVIE') {
            thumbnailsMap = await tmdbService.resolveTvEpisodeThumbnails(tmdbId, { fetchAllSeasons: true }).catch(() => new Map<number, string>());
        }
        
        // Construct basic episodes based on metadata count.
        const total = Number(metadata.episodes || 12);
        const episodes = Array.from({ length: total }, (_item, index) => {
            const epNum = index + 1;
            return {
                id: `tmdb:${epNum}`,
                episode: epNum,
                title: `Episode ${epNum}`,
                thumbnail: thumbnailsMap.get(epNum) || metadata.bannerImage || metadata.coverImage?.large || null,
                airDate: null,
                length: null,
                description: null,
                summary: null,
            };
        });

        return {
            anilistId: tmdbId,
            season: metadata.season,
            seasonYear: metadata.seasonYear,
            totalEpisodes: total,
            episodes,
        };
    },

    async getEpisode(tmdbId: number, episodeId: string) {
        const bundle = await this.getEpisodes(tmdbId);
        if (!bundle) return null;
        const requested = String(episodeId).replace(/^tmdb:/i, '');
        return bundle.episodes.find((episode: any) => String(episode.id) === episodeId || String(episode.episode) === requested) || null;
    },

    async trending(page: number, perPage: number) {
        const params = {
            with_genres: '16',
            with_original_language: 'ja',
            sort_by: 'popularity.desc',
            page,
            'first_air_date.gte': new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            include_adult: false,
        };
        const payload = await tmdbService.get<any>('/discover/tv', params);
        if (!payload) return { pageInfo: {}, media: [] };
        
        return {
            pageInfo: {
                total: payload.total_results || 0,
                perPage: 20,
                currentPage: payload.page || 1,
                lastPage: payload.total_pages || 1,
                hasNextPage: (payload.page || 1) < (payload.total_pages || 1)
            },
            media: (payload.results || []).map((i: any) => mapTmdbToAnilistMedia(i))
        };
    },

    async popular(page: number, perPage: number) {
        return this.search({ page, perPage, sort: ['VOTE_COUNT_DESC'] });
    },

    async seasonal(season: string, year: number, page: number, perPage: number) {
        return this.search({ page, perPage, season, seasonYear: year, sort: ['POPULARITY_DESC'] });
    },
};

export const animeQuery = {
    toPositiveInt,
};

import type { DiscoveryCategory, ExploreCandidate } from './types';
import { postJson } from '../../../platform/nativeHttp';
import { exploreService } from '../../../services/exploreService';

const ANILIST_GRAPHQL_URL = 'https://graphql.anilist.co';
const POOL_TTL_MS = 15 * 60 * 1000; // 15 minutes cache TTL
const STORAGE_POOL_KEY = 'yorumi_explore_pool_v2';
const STORAGE_POOL_TTL_MS = 30 * 60 * 1000;

const DIVERSE_SPOTLIGHT_GENRES = [
    'Action',
    'Adventure',
    'Comedy',
    'Drama',
    'Fantasy',
    'Mystery',
    'Psychological',
    'Romance',
    'Sci-Fi',
    'Slice of Life',
    'Sports',
    'Supernatural',
    'Thriller',
    'Mecha',
] as const;

const randomInt = (min: number, max: number): number =>
    Math.floor(Math.random() * (max - min + 1)) + min;

interface AniListMediaNode {
    id: number;
    idMal?: number;
    title?: {
        english?: string;
        romaji?: string;
        userPreferred?: string;
    };
    coverImage?: {
        extraLarge?: string;
        large?: string;
    };
    bannerImage?: string;
    description?: string;
    episodes?: number;
    duration?: number;
    averageScore?: number;
    popularity?: number;
    stats?: {
        scoreDistribution?: Array<{
            amount?: number;
        }>;
    };
    status?: string;
    genres?: string[];
    season?: string;
    seasonYear?: number;
    nextAiringEpisode?: {
        episode: number;
        timeUntilAiring?: number;
        airingAt?: number;
    } | null;
    streamingEpisodes?: Array<{
        title?: string;
        thumbnail?: string;
        url?: string;
    }>;
    characters?: {
        edges?: Array<{
            role?: string;
            node?: {
                id?: number;
                name?: { full?: string };
                image?: { large?: string; medium?: string };
            };
        }>;
    };
    studios?: {
        nodes?: Array<{ id: number; name: string }>;
    };
    trailer?: {
        id?: string;
        site?: string;
        thumbnail?: string;
    };
}

const BATCHED_CANDIDATES_QUERY = `
query ExploreCandidatePools(
    $currentSeason: MediaSeason,
    $currentYear: Int,
    $classicCutoffDate: FuzzyDateInt,
    $trendingPage: Int,
    $airingPage: Int,
    $upcomingPage: Int,
    $classicsPage: Int,
    $hiddenGemsPage: Int,
    $genrePage: Int,
    $spotlightGenre: String
) {
    trending: Page(page: $trendingPage, perPage: 20) {
        media(type: ANIME, sort: [TRENDING_DESC, POPULARITY_DESC], isAdult: false) {
            ...MediaFields
        }
    }
    airing: Page(page: $airingPage, perPage: 16) {
        media(type: ANIME, status: RELEASING, season: $currentSeason, seasonYear: $currentYear, sort: [POPULARITY_DESC], isAdult: false) {
            ...MediaFields
        }
    }
    upcoming: Page(page: $upcomingPage, perPage: 12) {
        media(type: ANIME, status: NOT_YET_RELEASED, sort: [POPULARITY_DESC], isAdult: false) {
            ...MediaFields
        }
    }
    classics: Page(page: $classicsPage, perPage: 25) {
        media(type: ANIME, status: FINISHED, startDate_lesser: $classicCutoffDate, averageScore_greater: 75, sort: [POPULARITY_DESC], isAdult: false) {
            ...MediaFields
        }
    }
    hiddenGems: Page(page: $hiddenGemsPage, perPage: 25) {
        media(type: ANIME, status: FINISHED, averageScore_greater: 74, popularity_lesser: 140000, sort: [SCORE_DESC], isAdult: false) {
            ...MediaFields
        }
    }
    genreSpotlight: Page(page: $genrePage, perPage: 20) {
        media(type: ANIME, status: FINISHED, genre: $spotlightGenre, averageScore_greater: 72, sort: [POPULARITY_DESC], isAdult: false) {
            ...MediaFields
        }
    }
}

fragment MediaFields on Media {
    id
    idMal
    title {
        english
        romaji
        userPreferred
    }
    coverImage {
        extraLarge
        large
    }
    bannerImage
    description
    episodes
    duration
    averageScore
    popularity
    status
    genres
    season
    seasonYear
    nextAiringEpisode {
        episode
        timeUntilAiring
        airingAt
    }
    studios(isMain: true) {
        nodes {
            id
            name
        }
    }
    trailer {
        id
        site
        thumbnail
    }
}
`;

function getCurrentSeasonInfo(): { season: 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL'; year: number } {
    const now = new Date();
    const month = now.getMonth(); // 0 = Jan, 11 = Dec
    const year = now.getFullYear();

    if (month >= 0 && month <= 2) return { season: 'WINTER', year };
    if (month >= 3 && month <= 5) return { season: 'SPRING', year };
    if (month >= 6 && month <= 8) return { season: 'SUMMER', year };
    return { season: 'FALL', year };
}

class CandidatePoolService {
    private cachedPool: ExploreCandidate[] = [];
    private lastFetchedTime = 0;
    private fetchPromise: Promise<ExploreCandidate[]> | null = null;

    private mapNodeToCandidate(node: AniListMediaNode, defaultCategory: DiscoveryCategory): ExploreCandidate {
        const title = node.title?.english || node.title?.romaji || node.title?.userPreferred || 'Unknown Anime';
        const cover = node.coverImage?.extraLarge || node.coverImage?.large || '';
        const rawSynopsis = (node.description || '')
            .replace(/<br\s*\/?>/gi, ' ')
            .replace(/<[^>]*>/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        const studios = (node.studios?.nodes || []).map((s) => s.name).filter(Boolean);

        const mainCharEdge = node.characters?.edges?.find((e) => e.role === 'MAIN') || node.characters?.edges?.[0];
        const characterImage = mainCharEdge?.node?.image?.large || mainCharEdge?.node?.image?.medium;
        const characterName = mainCharEdge?.node?.name?.full;

        const streamingEpisodes = (node.streamingEpisodes || [])
            .map((ep) => ({
                title: ep.title || '',
                thumbnail: ep.thumbnail,
                url: ep.url,
            }))
            .filter((ep) => Boolean(ep.title));

        const eligible = new Set<DiscoveryCategory>();
        eligible.add(defaultCategory);

        if (node.status === 'RELEASING') eligible.add('airing');
        if (node.status === 'NOT_YET_RELEASED') eligible.add('upcoming');
        if (node.status === 'FINISHED' && (node.averageScore || 0) >= 78) eligible.add('classics');
        if ((node.popularity || 0) > 40000) eligible.add('trending');

        // All titles with genres are eligible for personalized scoring
        eligible.add('personalized');
        eligible.add('experimental');

        const ratingsCount = (node.stats?.scoreDistribution || []).reduce(
            (sum, entry) => sum + (entry.amount || 0),
            0
        );

        return {
            id: node.id,
            idMal: node.idMal,
            title,
            titleEnglish: node.title?.english,
            titleRomaji: node.title?.romaji,
            coverImage: cover,
            bannerImage: node.bannerImage || cover,
            characterImage,
            characterName,
            synopsis: rawSynopsis || 'No description available.',
            genres: node.genres || [],
            episodesCount: node.episodes || 12,
            duration: node.duration || 24,
            averageScore: node.averageScore,
            popularity: node.popularity,
            ratingsCount: ratingsCount > 0 ? ratingsCount : undefined,
            status: node.status,
            season: node.season,
            seasonYear: node.seasonYear,
            nextAiringEpisode: node.nextAiringEpisode,
            streamingEpisodes,
            studios,
            baseCategory: defaultCategory,
            eligibleCategories: eligible,
            trailer: node.trailer?.id && node.trailer.site === 'youtube' ? {
                id: node.trailer.id,
                site: node.trailer.site,
                thumbnail: node.trailer.thumbnail,
            } : undefined,
        };
    }

    public peekCachedPool(): ExploreCandidate[] {
        if (this.cachedPool.length > 0) return this.cachedPool;
        try {
            const raw = localStorage.getItem(STORAGE_POOL_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw) as { timestamp?: number; items?: Array<Omit<ExploreCandidate, 'eligibleCategories'> & { eligibleCategories?: DiscoveryCategory[] }> };
            if (!parsed?.items?.length || !parsed.timestamp || Date.now() - parsed.timestamp > STORAGE_POOL_TTL_MS) {
                return [];
            }
            const restored: ExploreCandidate[] = parsed.items.map((item) => ({
                ...item,
                eligibleCategories: new Set<DiscoveryCategory>(item.eligibleCategories || [item.baseCategory]),
            }));
            this.cachedPool = restored;
            this.lastFetchedTime = parsed.timestamp;
            return restored;
        } catch {
            return [];
        }
    }

    private persistPool(candidates: ExploreCandidate[]): void {
        if (candidates.length === 0) return;
        try {
            const serializable = candidates.map((item) => ({
                ...item,
                eligibleCategories: Array.from(item.eligibleCategories),
            }));
            localStorage.setItem(STORAGE_POOL_KEY, JSON.stringify({ timestamp: Date.now(), items: serializable }));
        } catch {
            // Ignore storage quota errors
        }
    }

    public async getCandidatePool(forceRefresh = false): Promise<ExploreCandidate[]> {
        const now = Date.now();
        if (!forceRefresh) {
            const hydrated = this.peekCachedPool();
            if (hydrated.length > 0 && now - this.lastFetchedTime < POOL_TTL_MS) {
                return hydrated;
            }
        }

        if (this.fetchPromise) {
            return this.fetchPromise;
        }

        this.fetchPromise = this.fetchFromAniList()
            .then((candidates) => {
                if (candidates.length > 0) {
                    this.cachedPool = candidates;
                    this.lastFetchedTime = Date.now();
                    this.persistPool(candidates);
                }
                this.fetchPromise = null;
                return candidates.length > 0 ? candidates : this.peekCachedPool();
            })
            .catch(async (err) => {
                console.warn('[CandidatePoolService] Primary AniList fetch failed, trying exploreService fallback:', err);
                try {
                    const fallback = await exploreService.getExploreFeed(1, 25);
                    if (fallback.items.length > 0) {
                        const mapped: ExploreCandidate[] = fallback.items.map((item) => ({
                            ...item,
                            studios: [],
                            baseCategory: 'trending',
                            eligibleCategories: new Set<DiscoveryCategory>(['trending', 'personalized', 'experimental']),
                        }));
                        this.cachedPool = mapped;
                        this.lastFetchedTime = Date.now();
                        this.persistPool(mapped);
                        this.fetchPromise = null;
                        return mapped;
                    }
                } catch {
                    // Fall through to cached pool
                }
                this.fetchPromise = null;
                return this.peekCachedPool();
            });

        return this.fetchPromise;
    }

    private async fetchFromAniList(): Promise<ExploreCandidate[]> {
        const { season, year } = getCurrentSeasonInfo();
        const spotlightGenre = DIVERSE_SPOTLIGHT_GENRES[randomInt(0, DIVERSE_SPOTLIGHT_GENRES.length - 1)];

        let json: { data?: Record<string, { media?: AniListMediaNode[] }> } | null = null;
        let lastErr: unknown;
        for (let attempt = 0; attempt < 2; attempt += 1) {
            try {
                json = await postJson<{ data?: Record<string, { media?: AniListMediaNode[] }> }>(
                    ANILIST_GRAPHQL_URL,
                    {
                        query: BATCHED_CANDIDATES_QUERY,
                        variables: {
                            currentSeason: season,
                            currentYear: year,
                            classicCutoffDate: (year - 1) * 10000 + 101,
                            trendingPage: randomInt(1, 4),
                            airingPage: randomInt(1, 2),
                            upcomingPage: randomInt(1, 3),
                            classicsPage: randomInt(1, 10),
                            hiddenGemsPage: randomInt(1, 12),
                            genrePage: randomInt(1, 6),
                            spotlightGenre,
                        },
                    },
                    {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                    }
                );
                if (json?.data) break;
            } catch (error) {
                lastErr = error;
                if (attempt === 0) {
                    await new Promise((resolve) => setTimeout(resolve, 900));
                }
            }
        }

        const data = json?.data;
        if (!data) {
            throw lastErr instanceof Error ? lastErr : new Error('AniList returned empty data');
        }

        const candidateMap = new Map<number, ExploreCandidate>();
        const ingest = (items: AniListMediaNode[] | undefined, category: DiscoveryCategory) => {
            for (const item of items || []) {
                if (!candidateMap.has(item.id)) {
                    candidateMap.set(item.id, this.mapNodeToCandidate(item, category));
                } else {
                    candidateMap.get(item.id)?.eligibleCategories.add(category);
                }
            }
        };

        ingest(data.classics?.media, 'classics');
        ingest(data.hiddenGems?.media, 'experimental');
        ingest(data.genreSpotlight?.media, 'personalized');
        ingest(data.trending?.media, 'trending');
        ingest(data.airing?.media, 'airing');
        ingest(data.upcoming?.media, 'upcoming');

        return Array.from(candidateMap.values());
    }

    /**
     * Seeds the candidate pool directly (useful for tests or offline operation).
     */
    public seedPool(candidates: ExploreCandidate[]): void {
        this.cachedPool = candidates;
        this.lastFetchedTime = Date.now();
    }
}

export const candidatePoolService = new CandidatePoolService();


import { postJson } from '../platform/nativeHttp';

export interface ExploreAnimeItem {
    id: number;
    idMal?: number;
    title: string;
    titleEnglish?: string;
    titleRomaji?: string;
    coverImage: string;
    bannerImage?: string;
    characterImage?: string;
    characterName?: string;
    synopsis: string;
    genres: string[];
    episodesCount: number;
    duration: number;
    averageScore?: number;
    popularity?: number;
    ratingsCount?: number;
    status?: string;
    season?: string;
    seasonYear?: number;
    nextAiringEpisode?: {
        episode: number;
        timeUntilAiring?: number;
        airingAt?: number;
    } | null;
    streamingEpisodes?: Array<{
        title: string;
        thumbnail?: string;
        url?: string;
    }>;
    trailer?: {
        id: string;
        site: string;
        thumbnail?: string;
    };
}

const ANILIST_GRAPHQL_URL = 'https://graphql.anilist.co';

interface AniListExploreResponse {
    data?: {
        Page?: {
            pageInfo?: {
                hasNextPage: boolean;
                currentPage: number;
            };
            media?: Array<{
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
                trailer?: {
                    id?: string;
                    site?: string;
                    thumbnail?: string;
                };
            }>;
        };
    };
}

const EXPLORE_QUERY = `
query ExploreAnimeFeed($page: Int!, $perPage: Int!) {
    Page(page: $page, perPage: $perPage) {
        pageInfo {
            hasNextPage
            currentPage
        }
        media(type: ANIME, sort: [TRENDING_DESC, POPULARITY_DESC], isAdult: false) {
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
            streamingEpisodes {
                title
                thumbnail
                url
            }
            characters(perPage: 6, sort: [ROLE, RELEVANCE, ID]) {
                edges {
                    role
                    node {
                        id
                        name {
                            full
                        }
                        image {
                            large
                            medium
                        }
                    }
                }
            }
            trailer {
                id
                site
                thumbnail
            }
        }
    }
}
`;

class ExploreService {
    private cache = new Map<number, ExploreAnimeItem[]>();

    async getExploreFeed(page = 1, perPage = 25): Promise<{ items: ExploreAnimeItem[]; hasNextPage: boolean }> {
        if (this.cache.has(page)) {
            return { items: this.cache.get(page) || [], hasNextPage: true };
        }

        try {
            const json = await postJson<AniListExploreResponse>(
                ANILIST_GRAPHQL_URL,
                {
                    query: EXPLORE_QUERY,
                    variables: { page, perPage },
                },
                {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                }
            );
            const mediaList = json?.data?.Page?.media || [];
            const hasNextPage = Boolean(json?.data?.Page?.pageInfo?.hasNextPage);

            const items: ExploreAnimeItem[] = mediaList
                .map((m) => {
                    const title = m.title?.english || m.title?.romaji || m.title?.userPreferred || 'Unknown Anime';
                    const cover = m.coverImage?.extraLarge || m.coverImage?.large || '';
                    const rawSynopsis = (m.description || '')
                        .replace(/<br\s*\/?>/gi, ' ')
                        .replace(/<[^>]*>/g, '')
                        .replace(/\s+/g, ' ')
                        .trim();

                    const mainCharEdge = m.characters?.edges?.find((e) => e.role === 'MAIN') || m.characters?.edges?.[0];
                    const characterImage = mainCharEdge?.node?.image?.large || mainCharEdge?.node?.image?.medium;
                    const characterName = mainCharEdge?.node?.name?.full;

                    const streamingEpisodes = (m.streamingEpisodes || [])
                        .map((ep) => ({
                            title: ep.title || '',
                            thumbnail: ep.thumbnail,
                            url: ep.url,
                        }))
                        .filter((ep) => Boolean(ep.title));

                    return {
                        id: m.id,
                        idMal: m.idMal,
                        title,
                        titleEnglish: m.title?.english,
                        titleRomaji: m.title?.romaji,
                        coverImage: cover,
                        bannerImage: m.bannerImage || cover,
                        characterImage,
                        characterName,
                        synopsis: rawSynopsis || 'No description available.',
                        genres: m.genres || [],
                        episodesCount: m.episodes || 12,
                        duration: m.duration || 24,
                        averageScore: m.averageScore,
                        popularity: m.popularity,
                        status: m.status,
                        season: m.season,
                        seasonYear: m.seasonYear,
                        nextAiringEpisode: m.nextAiringEpisode,
                        streamingEpisodes,
                        trailer: m.trailer?.id && m.trailer.site === 'youtube' ? {
                            id: m.trailer.id,
                            site: m.trailer.site,
                            thumbnail: m.trailer.thumbnail,
                        } : undefined,
                    };
                })
                // Prioritize anime with playable trailers
                .sort((a, b) => {
                    if (a.trailer && !b.trailer) return -1;
                    if (!a.trailer && b.trailer) return 1;
                    return 0;
                });

            this.cache.set(page, items);
            return { items, hasNextPage };
        } catch (err) {
            console.warn('[ExploreService] Failed to load explore feed:', err);
            return { items: [], hasNextPage: false };
        }
    }
}

export const exploreService = new ExploreService();


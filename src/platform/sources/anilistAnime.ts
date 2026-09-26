import { postJson } from '../nativeHttp';

const ANILIST_GRAPHQL_URL = 'https://graphql.anilist.co';

export type AniListPageInfo = {
    currentPage: number;
    lastPage: number;
    hasNextPage: boolean;
    total: number;
};

export type LocalAniListAnime = {
    id: number;
    idMal?: number;
    title?: { english?: string; romaji?: string; native?: string; userPreferred?: string };
    coverImage?: { large?: string; extraLarge?: string };
    bannerImage?: string;
    description?: string;
    format?: string;
    episodes?: number;
    duration?: number;
    averageScore?: number;
    popularity?: number;
    isAdult?: boolean;
    status?: string;
    genres?: string[];
    season?: string;
    seasonYear?: number;
    startDate?: { year?: number; month?: number; day?: number };
    endDate?: { year?: number; month?: number; day?: number };
    countryOfOrigin?: string;
    synonyms?: string[];
    nextAiringEpisode?: { episode?: number; airingAt?: number; timeUntilAiring?: number };
    trailer?: { id?: string; site?: string; thumbnail?: string };
    characters?: unknown;
    relations?: unknown;
    studios?: unknown;
    streamingEpisodes?: Array<{ title?: string; thumbnail?: string; url?: string; site?: string }>;
};

type GraphQLResponse<T> = {
    data?: T;
    errors?: Array<{ message?: string }>;
};

export type AniListAnimePage = {
    media: LocalAniListAnime[];
    pageInfo: AniListPageInfo;
};

const MEDIA_FIELDS = `
    id idMal
    title { english romaji native userPreferred }
    coverImage { large extraLarge }
    bannerImage description format episodes duration averageScore popularity isAdult status genres
    season seasonYear
    startDate { year month day }
    endDate { year month day }
    countryOfOrigin synonyms
    nextAiringEpisode { episode airingAt timeUntilAiring }
    trailer { id site thumbnail }
    streamingEpisodes { title thumbnail url site }
    studios { edges { isMain node { id name } } nodes { id name } }
`;

const queryAniList = async <T>(query: string, variables: Record<string, unknown>) => {
    const result = await postJson<GraphQLResponse<T>>(ANILIST_GRAPHQL_URL, { query, variables });
    if (result.errors?.length) {
        throw new Error(result.errors.map((error) => error.message || 'AniList request failed').join('; '));
    }
    if (!result.data) throw new Error('AniList returned no data');
    return result.data;
};

export type AnimeListOptions = {
    page?: number;
    perPage?: number;
    search?: string;
    sort?: string[];
    format?: string;
    season?: string;
    seasonYear?: number;
};

export const getLocalAniListAnimePage = async ({
    page = 1,
    perPage = 24,
    search,
    sort = ['POPULARITY_DESC'],
    format,
    season,
    seasonYear,
}: AnimeListOptions): Promise<AniListAnimePage> => {
    const query = `
        query LocalAnimePage(
            $page: Int!, $perPage: Int!, $search: String, $sort: [MediaSort],
            $format: MediaFormat, $season: MediaSeason, $seasonYear: Int
        ) {
            Page(page: $page, perPage: $perPage) {
                pageInfo { currentPage lastPage hasNextPage total }
                media(
                    type: ANIME, search: $search, sort: $sort,
                    format: $format, season: $season, seasonYear: $seasonYear
                ) { ${MEDIA_FIELDS} }
            }
        }
    `;
    const data = await queryAniList<{ Page: AniListAnimePage }>(query, {
        page,
        perPage,
        search: search || undefined,
        sort,
        format: format || undefined,
        season: season || undefined,
        seasonYear: seasonYear || undefined,
    });
    return {
        ...data.Page,
        media: data.Page.media.filter((item) => item.isAdult !== true),
    };
};

export const getLocalAniListAnimeDetails = async (id: number): Promise<LocalAniListAnime> => {
    const query = `
        query LocalAnimeDetails($id: Int!) {
            Media(id: $id, type: ANIME) {
                ${MEDIA_FIELDS}
                characters(perPage: 25, sort: [ROLE, RELEVANCE, ID]) {
                    edges { role node { id name { full } image { large } } }
                }
                relations {
                    edges {
                        relationType
                        node {
                            id idMal title { romaji english native userPreferred }
                            coverImage { large extraLarge }
                            bannerImage format episodes status season seasonYear
                            startDate { year month day }
                        }
                    }
                }
            }
        }
    `;
    const data = await queryAniList<{ Media: LocalAniListAnime }>(query, { id });
    if (data.Media.isAdult) throw new Error('Adult anime is not available');
    return data.Media;
};

const currentSeason = () => {
    const month = new Date().getMonth() + 1;
    if (month <= 3) return 'WINTER';
    if (month <= 6) return 'SPRING';
    if (month <= 9) return 'SUMMER';
    return 'FALL';
};

export const getLocalAniListAnimeHome = async () => {
    const year = new Date().getFullYear();
    const [trending, popular, seasonal, top, monthly] = await Promise.all([
        getLocalAniListAnimePage({ page: 1, perPage: 18, sort: ['TRENDING_DESC'] }),
        getLocalAniListAnimePage({ page: 1, perPage: 18, sort: ['POPULARITY_DESC'] }),
        getLocalAniListAnimePage({ page: 1, perPage: 18, sort: ['POPULARITY_DESC'], season: currentSeason(), seasonYear: year }),
        getLocalAniListAnimePage({ page: 1, perPage: 18, sort: ['SCORE_DESC'] }),
        getLocalAniListAnimePage({ page: 1, perPage: 18, sort: ['POPULARITY_DESC'] }),
    ]);

    return {
        spotlight: trending.media.slice(0, 8),
        latestEpisodes: seasonal.media.slice(0, 18),
        trending,
        seasonal,
        monthly,
        topAnime: top,
        topTen: {
            day: trending.media.slice(0, 10),
            week: popular.media.slice(0, 10),
            month: monthly.media.slice(0, 10),
        },
    };
};

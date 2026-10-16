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

const ANIME_SEASON_CHAIN_NODE_FIELDS = `
    id idMal title { romaji english native userPreferred }
    coverImage { large extraLarge }
    bannerImage format episodes status season seasonYear isAdult
    startDate { year month day }
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

const isFranchiseEntry = (item?: LocalAniListAnime | null) =>
    Boolean(
        item
        && ['TV', 'TV_SHORT'].includes(String(item.format || '').toUpperCase())
        && String(item.status || '').toUpperCase() !== 'NOT_YET_RELEASED'
        && (() => {
            const year = Number(item.startDate?.year || 0);
            const month = Number(item.startDate?.month || 1);
            const day = Number(item.startDate?.day || 1);
            if (!year) return true;

            const now = new Date();
            const today = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
            return year * 10000 + month * 100 + day <= today;
        })()
    );

export const getLocalAniListAnimeSeasonChain = async (title: string, id?: number): Promise<LocalAniListAnime | null> => {
    const search = String(title || '').replace(/\s+/g, ' ').trim();
    const anilistId = Number(id || 0);
    if (!search) return null;

    const query = `
        query LocalAnimeSeasonChain($id: Int, $hasId: Boolean!, $search: String!, $perPage: Int!) {
            rootById: Media(id: $id, type: ANIME) @include(if: $hasId) {
                ${MEDIA_FIELDS}
                relations {
                    edges {
                        relationType
                        node { ${ANIME_SEASON_CHAIN_NODE_FIELDS} }
                    }
                }
            }
            rootBySearch: Media(search: $search, type: ANIME) {
                ${MEDIA_FIELDS}
                relations {
                    edges {
                        relationType
                        node { ${ANIME_SEASON_CHAIN_NODE_FIELDS} }
                    }
                }
            }
            candidates: Page(page: 1, perPage: $perPage) {
                media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
                    ${ANIME_SEASON_CHAIN_NODE_FIELDS}
                    relations {
                        edges {
                            relationType
                            node { ${ANIME_SEASON_CHAIN_NODE_FIELDS} }
                        }
                    }
                }
            }
        }
    `;
    const data = await queryAniList<{
        rootById: LocalAniListAnime | null;
        rootBySearch: LocalAniListAnime | null;
        candidates: { media: LocalAniListAnime[] };
    }>(query, { id: anilistId > 0 ? anilistId : undefined, hasId: anilistId > 0, search, perPage: 50 });
    const root = data.rootById || data.rootBySearch;
    if (!root || root.isAdult) return null;

    const media = (data.candidates?.media || []).filter((item) => item && item.isAdult !== true);
    const byId = new Map<number, LocalAniListAnime>(media.map((item) => [Number(item.id), item]));
    byId.set(Number(root.id), byId.get(Number(root.id)) || root);

    const visited = new Set<number>();
    const pending = [Number(root.id)];
    const included = new Set<number>();
    const seasonChain: LocalAniListAnime[] = [];
    while (pending.length > 0) {
        const currentId = Number(pending.shift() || 0);
        if (!currentId || visited.has(currentId)) continue;
        visited.add(currentId);

        const current = byId.get(currentId);
        if (!current) continue;
        if (isFranchiseEntry(current) && !included.has(currentId)) {
            included.add(currentId);
            seasonChain.push(current);
        }

        const relations = current.relations as { edges?: Array<{ relationType?: string; node?: LocalAniListAnime }> } | undefined;
        for (const edge of relations?.edges || []) {
            const node = edge.node;
            const nodeId = Number(node?.id || 0);
            if (!node || !nodeId || node.isAdult) continue;
            if (!byId.has(nodeId)) byId.set(nodeId, node);

            if (edge.relationType === 'PREQUEL' || edge.relationType === 'SEQUEL') pending.push(nodeId);
        }
    }

    return { ...root, seasonChain } as LocalAniListAnime;
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
    const query = `
        query LocalAnimeHome($season: MediaSeason!, $seasonYear: Int!) {
            trending: Page(page: 1, perPage: 30) {
                pageInfo { currentPage lastPage hasNextPage total }
                media(type: ANIME, sort: TRENDING_DESC, isAdult: false) { ${MEDIA_FIELDS} }
            }
            seasonal: Page(page: 1, perPage: 24) {
                pageInfo { currentPage lastPage hasNextPage total }
                media(type: ANIME, season: $season, seasonYear: $seasonYear, sort: POPULARITY_DESC, isAdult: false) { ${MEDIA_FIELDS} }
            }
            monthly: Page(page: 1, perPage: 24) {
                pageInfo { currentPage lastPage hasNextPage total }
                media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) { ${MEDIA_FIELDS} }
            }
            topAnime: Page(page: 1, perPage: 24) {
                pageInfo { currentPage lastPage hasNextPage total }
                media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) { ${MEDIA_FIELDS} }
            }
        }
    `;
    const data = await queryAniList<{
        trending: AniListAnimePage;
        seasonal: AniListAnimePage;
        monthly: AniListAnimePage;
        topAnime: AniListAnimePage;
    }>(query, { season: currentSeason(), seasonYear: year });
    const trending = { ...data.trending, media: data.trending.media.filter((item) => !item.isAdult) };
    const seasonal = { ...data.seasonal, media: data.seasonal.media.filter((item) => !item.isAdult) };
    const monthly = { ...data.monthly, media: data.monthly.media.filter((item) => !item.isAdult) };
    const topAnime = { ...data.topAnime, media: data.topAnime.media.filter((item) => !item.isAdult) };

    return {
        spotlight: trending.media.slice(0, 8),
        latestEpisodes: seasonal.media.slice(0, 18),
        trending,
        seasonal,
        monthly,
        topAnime,
        topTen: {
            day: trending.media.slice(0, 10),
            week: seasonal.media.slice(0, 10),
            month: monthly.media.slice(0, 10),
        },
    };
};

import { postJson } from '../nativeHttp';

const ANILIST_GRAPHQL_URL = 'https://graphql.anilist.co';

export type AniListPageInfo = {
    currentPage: number;
    lastPage: number;
    hasNextPage: boolean;
    total: number;
};

export type LocalAniListManga = {
    id: number;
    idMal?: number;
    title?: { english?: string; romaji?: string; native?: string };
    coverImage?: { large?: string; extraLarge?: string };
    bannerImage?: string;
    description?: string;
    format?: string;
    chapters?: number;
    volumes?: number;
    averageScore?: number;
    popularity?: number;
    isAdult?: boolean;
    status?: string;
    genres?: string[];
    startDate?: { year?: number; month?: number; day?: number };
    endDate?: { year?: number; month?: number; day?: number };
    countryOfOrigin?: string;
    synonyms?: string[];
    characters?: unknown;
    relations?: unknown;
    staff?: unknown;
};

type GraphQLResponse<T> = {
    data?: T;
    errors?: Array<{ message?: string }>;
};

export type AniListMangaPage = {
    media: LocalAniListManga[];
    pageInfo: AniListPageInfo;
};

const MEDIA_FIELDS = `
    id idMal
    title { english romaji native }
    coverImage { large extraLarge }
    bannerImage description format chapters volumes averageScore popularity isAdult status genres
    startDate { year month day }
    endDate { year month day }
    countryOfOrigin synonyms
`;

const queryAniList = async <T>(query: string, variables: Record<string, unknown>) => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            const result = await postJson<GraphQLResponse<T>>(ANILIST_GRAPHQL_URL, { query, variables });
            if (result.errors?.length) {
                throw new Error(result.errors.map((error) => error.message || 'AniList request failed').join('; '));
            }
            if (!result.data) throw new Error('AniList returned no data');
            return result.data;
        } catch (error) {
            lastError = error;
            const msg = String(error || '');
            if (attempt === 0 && (msg.includes('429') || msg.includes('502') || msg.includes('503') || msg.includes('timeout'))) {
                await new Promise((resolve) => setTimeout(resolve, 900));
                continue;
            }
            throw error;
        }
    }
    throw lastError;
};

export type MangaListOptions = {
    page?: number;
    perPage?: number;
    search?: string;
    sort?: string[];
    countryOfOrigin?: string;
    format?: string;
};

export const getLocalAniListMangaPage = async ({
    page = 1,
    perPage = 24,
    search,
    sort = ['POPULARITY_DESC'],
    countryOfOrigin,
    format,
}: MangaListOptions): Promise<AniListMangaPage> => {
    const query = `
        query LocalMangaPage(
            $page: Int!, $perPage: Int!, $search: String, $sort: [MediaSort],
            $countryOfOrigin: CountryCode, $format: MediaFormat
        ) {
            Page(page: $page, perPage: $perPage) {
                pageInfo { currentPage lastPage hasNextPage total }
                media(
                    type: MANGA, search: $search, sort: $sort,
                    countryOfOrigin: $countryOfOrigin, format: $format
                ) { ${MEDIA_FIELDS} }
            }
        }
    `;
    const data = await queryAniList<{ Page: AniListMangaPage }>(query, {
        page,
        perPage,
        search: search || undefined,
        sort,
        countryOfOrigin: countryOfOrigin || undefined,
        format: format || undefined,
    });
    return {
        ...data.Page,
        media: data.Page.media.filter((item) => item.isAdult !== true),
    };
};

export const getLocalAniListTop100Manga = async (): Promise<LocalAniListManga[]> => {
    const query = `
        query LocalTop100Manga($page: Int!) {
            Page(page: $page, perPage: 50) {
                media(type: MANGA, sort: SCORE_DESC, isAdult: false) { ${MEDIA_FIELDS} }
            }
        }
    `;
    const [page1, page2] = await Promise.all([
        queryAniList<{ Page: { media: LocalAniListManga[] } }>(query, { page: 1 }),
        queryAniList<{ Page: { media: LocalAniListManga[] } }>(query, { page: 2 }),
    ]);
    return [...(page1.Page?.media || []), ...(page2.Page?.media || [])]
        .filter((item) => item.isAdult !== true)
        .slice(0, 100);
};

export const getLocalAniListMangaDetails = async (id: number): Promise<LocalAniListManga> => {
    const query = `
        query LocalMangaDetails($id: Int!) {
            Media(id: $id, type: MANGA) {
                ${MEDIA_FIELDS}
                characters(perPage: 25, sort: [ROLE, RELEVANCE, ID]) {
                    edges { role node { id name { full } image { large } } }
                }
                relations {
                    edges {
                        relationType
                        node { id title { romaji english native } coverImage { large } format }
                    }
                }
                staff(perPage: 25, sort: [RELEVANCE, ID]) {
                    edges { role node { id name { full } } }
                }
            }
        }
    `;
    const data = await queryAniList<{ Media: LocalAniListManga }>(query, { id });
    if (data.Media.isAdult) throw new Error('Adult manga is not available');
    return data.Media;
};

export const getLocalRandomMangaIds = async (): Promise<Array<{ id: number }>> => {
    const randomPage = Math.floor(Math.random() * 40) + 1;
    const result = await getLocalAniListMangaPage({
        page: randomPage,
        perPage: 25,
        sort: ['POPULARITY_DESC'],
    });
    return result.media.map(({ id }) => ({ id }));
};

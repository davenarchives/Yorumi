import axios from 'axios';
import type { LightNovel, LNChapter, LNChapterContent } from '../types/ln';
import { API_BASE } from '../config/api';
import { getDisplayImageUrl } from '../utils/image';

const ANILIST_URL = 'https://graphql.anilist.co';

const apiClient = axios.create({
    baseURL: API_BASE,
    timeout: 15000,
});

const cacheMap = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

const fetchAniList = async (query: string, variables: any = {}) => {
    const key = JSON.stringify({ query, variables });
    const cached = cacheMap.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }

    const { data } = await axios.post(
        ANILIST_URL,
        { query, variables },
        { headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, timeout: 10000 }
    );

    const result = data?.data;
    if (result) {
        cacheMap.set(key, { data: result, timestamp: Date.now() });
    }
    return result;
};

const mapAniListToLN = (media: any): LightNovel => {
    const title = media.title?.english || media.title?.romaji || media.title?.native || 'Unknown Title';
    const rawImage = media.coverImage?.extraLarge || media.coverImage?.large || '';
    const image = getDisplayImageUrl(rawImage);

    let author = 'Unknown Author';
    if (media.staff?.edges && media.staff.edges.length > 0) {
        const authorEdge = media.staff.edges.find((e: any) =>
            /story|author|creator|writer|original/i.test(e.role || '')
        ) || media.staff.edges[0];
        if (authorEdge?.node?.name?.full) {
            author = authorEdge.node.name.full;
        }
    }

    return {
        id: media.id,
        mal_id: media.idMal || media.id,
        title,
        title_english: media.title?.english,
        title_romaji: media.title?.romaji,
        title_native: media.title?.native,
        images: {
            jpg: {
                image_url: image,
                large_image_url: image,
            },
        },
        score: media.averageScore ? media.averageScore / 10 : 0,
        rank: media.popularity || 0,
        status: media.status,
        type: media.format || 'NOVEL',
        chapters: media.chapters || null,
        volumes: media.volumes || null,
        synopsis: media.description ? media.description.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '') : '',
        author,
        genres: (media.genres || []).map((g: string, i: number) => ({ mal_id: i + 1, name: g })),
        synonyms: media.synonyms || [],
        bannerImage: media.bannerImage || media.coverImage?.extraLarge || image,
        relations: media.relations,
        recommendations: media.recommendations,
    };
};

export const lnService = {
    // 1. Spotlight Light Novels
    async getSpotlight(): Promise<LightNovel[]> {
        const query = `
            query {
                Page(page: 1, perPage: 10) {
                    media(type: MANGA, format: NOVEL, sort: [TRENDING_DESC, POPULARITY_DESC]) {
                        id
                        idMal
                        title { english romaji native }
                        coverImage { extraLarge large }
                        bannerImage
                        description
                        averageScore
                        popularity
                        status
                        format
                        chapters
                        volumes
                        genres
                        synonyms
                        staff(perPage: 5) { edges { role node { name { full } } } }
                    }
                }
            }
        `;
        const res = await fetchAniList(query);
        const list = res?.Page?.media || [];
        return list.map(mapAniListToLN);
    },

    // 2. Latest LN Updates / Trending
    async getLatestUpdates(): Promise<LightNovel[]> {
        const query = `
            query {
                Page(page: 1, perPage: 24) {
                    media(type: MANGA, format: NOVEL, sort: [UPDATED_AT_DESC, TRENDING_DESC]) {
                        id
                        idMal
                        title { english romaji native }
                        coverImage { extraLarge large }
                        description
                        averageScore
                        popularity
                        status
                        format
                        chapters
                        genres
                        staff(perPage: 5) { edges { role node { name { full } } } }
                    }
                }
            }
        `;
        const res = await fetchAniList(query);
        const list = res?.Page?.media || [];
        return list.map(mapAniListToLN);
    },

    // 3. All Time Popular LNs
    async getPopular(page: number = 1): Promise<LightNovel[]> {
        const query = `
            query($page: Int) {
                Page(page: $page, perPage: 24) {
                    media(type: MANGA, format: NOVEL, sort: [POPULARITY_DESC]) {
                        id
                        idMal
                        title { english romaji native }
                        coverImage { extraLarge large }
                        description
                        averageScore
                        popularity
                        status
                        format
                        chapters
                        genres
                        staff(perPage: 5) { edges { role node { name { full } } } }
                    }
                }
            }
        `;
        const res = await fetchAniList(query, { page });
        const list = res?.Page?.media || [];
        return list.map(mapAniListToLN);
    },

    // 4. Top 100 Rated LNs
    async getTop100(page: number = 1): Promise<LightNovel[]> {
        const query = `
            query($page: Int) {
                Page(page: $page, perPage: 24) {
                    media(type: MANGA, format: NOVEL, sort: [SCORE_DESC]) {
                        id
                        idMal
                        title { english romaji native }
                        coverImage { extraLarge large }
                        description
                        averageScore
                        popularity
                        status
                        format
                        chapters
                        genres
                        staff(perPage: 5) { edges { role node { name { full } } } }
                    }
                }
            }
        `;
        const res = await fetchAniList(query, { page });
        const list = res?.Page?.media || [];
        return list.map(mapAniListToLN);
    },

    // 5. Single LN Details from AniList
    async getDetails(id: string | number): Promise<LightNovel | null> {
        const query = `
            query($id: Int) {
                Media(id: $id, type: MANGA) {
                    id
                    idMal
                    title { english romaji native }
                    coverImage { extraLarge large }
                    bannerImage
                    description
                    averageScore
                    popularity
                    status
                    format
                    chapters
                    volumes
                    genres
                    synonyms
                    staff(perPage: 5) { edges { role node { name { full } } } }
                    relations {
                        edges {
                            relationType
                            node {
                                id
                                title { romaji english native }
                                coverImage { large }
                                format
                                type
                            }
                        }
                    }
                    recommendations(perPage: 10) {
                        nodes {
                            mediaRecommendation {
                                id
                                title { romaji english }
                                coverImage { large }
                                type
                                format
                            }
                        }
                    }
                }
            }
        `;
        const numericId = parseInt(String(id), 10);
        if (isNaN(numericId)) return null;

        const res = await fetchAniList(query, { id: numericId });
        if (!res?.Media) return null;
        return mapAniListToLN(res.Media);
    },

    // 6. Backend Integration: Resolve AniList title to backend scraper novel ID
    async resolveScraperId(titles: string[]): Promise<string | null> {
        try {
            const { data } = await apiClient.post('/ln/resolve', { titles });
            return data?.scraperId || null;
        } catch {
            return null;
        }
    },

    // 7. Backend Integration: Get scraper novel details & chapters
    async getScraperNovelDetails(scraperId: string): Promise<{ chapters: LNChapter[]; description?: string; author?: string } | null> {
        try {
            const { data } = await apiClient.get(`/ln/details/${encodeURIComponent(scraperId)}`);
            if (data?.success && data?.data) {
                return {
                    chapters: data.data.chapters || [],
                    description: data.data.description,
                    author: data.data.author,
                };
            }
            return null;
        } catch {
            return null;
        }
    },

    // 8. Backend Integration: Read Chapter Content
    async getChapterContent(chapterId: string): Promise<LNChapterContent | null> {
        try {
            const { data } = await apiClient.get(`/ln/read/${encodeURIComponent(chapterId)}`);
            if (data?.success && data?.data) {
                return data.data;
            }
            return null;
        } catch {
            return null;
        }
    },

    // 9. Search LN Novels
    async searchNovels(query: string): Promise<LightNovel[]> {
        const gqlQuery = `
            query($search: String) {
                Page(page: 1, perPage: 24) {
                    media(search: $search, type: MANGA, format: NOVEL) {
                        id
                        idMal
                        title { english romaji native }
                        coverImage { extraLarge large }
                        description
                        averageScore
                        popularity
                        status
                        format
                        chapters
                        genres
                    }
                }
            }
        `;
        const res = await fetchAniList(gqlQuery, { search: query });
        const list = res?.Page?.media || [];
        return list.map(mapAniListToLN);
    },
};

import axios from 'axios';
import type { LightNovel, LNChapter, LNChapterContent } from '../types/ln';
import { API_BASE } from '../config/api';
import { getDisplayImageUrl } from '../utils/image';
import { fetchWithOfflineFallback } from './offlineCache';
import { POPULAR_KOREAN_NOVELS, POPULAR_CHINESE_NOVELS } from './lnData';

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
        countryOfOrigin: media.countryOfOrigin || 'JP',
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

const mapScraperToLN = (item: any, defaultCountry: 'KR' | 'CN' | 'JP' | string = 'KR'): LightNovel => {
    const rawImage = item.cover || item.image || '';
    const image = rawImage ? (rawImage.startsWith('http') ? rawImage : `${rawImage.startsWith('/') ? '' : '/'}${rawImage}`) : '';

    return {
        id: item.id,
        mal_id: item.id,
        title: item.title || 'Unknown Novel',
        title_english: item.title || 'Unknown Novel',
        images: {
            jpg: {
                image_url: image,
                large_image_url: image,
            },
        },
        score: item.score || (item.rating ? parseFloat(item.rating) : 8.8),
        rank: item.rank || 0,
        status: item.status || 'Ongoing',
        type: 'NOVEL',
        countryOfOrigin: item.countryOfOrigin || defaultCountry,
        source: item.source || 'novelbin',
        scraper_id: item.id,
        synopsis: item.description || item.synopsis || '',
        author: item.author && item.author !== 'Unknown' ? item.author : 'Web Novel Author',
        genres: (item.genres || []).map((g: any, i: number) => (typeof g === 'string' ? { mal_id: i + 1, name: g } : g)),
        bannerImage: image,
    };
};

export const lnService = {
    // 1. Spotlight Light Novels
    async getSpotlight(): Promise<LightNovel[]> {
        return fetchWithOfflineFallback('ln_spotlight', async () => {
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
                            countryOfOrigin
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
        });
    },

    // 2. Latest LN Updates / Trending
    async getLatestUpdates(): Promise<LightNovel[]> {
        return fetchWithOfflineFallback('ln_latest', async () => {
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
                            countryOfOrigin
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
        });
    },

    // 3. All Time Popular Japanese Light Novels
    async getPopular(page: number = 1): Promise<LightNovel[]> {
        return fetchWithOfflineFallback(`ln_popular_${page}`, async () => {
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
                            countryOfOrigin
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
        });
    },

    // 4. Top 100 Rated Light Novels
    async getTop100(page: number = 1): Promise<LightNovel[]> {
        return fetchWithOfflineFallback(`ln_top100_${page}`, async () => {
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
                            countryOfOrigin
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
        });
    },

    // 5. Popular Korean Web Novels (Solo Leveling, Omniscient Reader, TBATE, etc.)
    async getPopularKoreanNovels(): Promise<LightNovel[]> {
        return fetchWithOfflineFallback('ln_popular_korean', async () => {
            return POPULAR_KOREAN_NOVELS;
        });
    },

    // 6. Popular Chinese Web Novels (Lord of the Mysteries, Reverend Insanity, Martial Peak, etc.)
    async getPopularChineseNovels(): Promise<LightNovel[]> {
        return fetchWithOfflineFallback('ln_popular_chinese', async () => {
            return POPULAR_CHINESE_NOVELS;
        });
    },

    // 7. Single LN Details from AniList or Scraper
    async getDetails(id: string | number): Promise<LightNovel | null> {
        const idStr = String(id);
        return fetchWithOfflineFallback(`ln_details_${idStr}`, async () => {
            // Check if this is a direct scraper ID (contains ':')
            if (idStr.includes(':')) {
                // First check if it matches curated Korean / Chinese novels
                const foundCurated = [...POPULAR_KOREAN_NOVELS, ...POPULAR_CHINESE_NOVELS].find(
                    (n) => String(n.id) === idStr || String(n.scraper_id) === idStr
                );

                const scraperDetails = await lnService.getScraperNovelDetails(idStr);
                if (!scraperDetails && !foundCurated) return null;

                const isKR = foundCurated?.countryOfOrigin === 'KR' ||
                    /korean|manhwa|solo.leveling|omniscient|second.life|nano.machine|overgeared|ranker|mount.hua|reincarnation|hunter|gacha|estate/i.test(`${idStr} ${scraperDetails?.title || ''}`);
                const isCN = foundCurated?.countryOfOrigin === 'CN' ||
                    /chinese|xianxia|wuxia|cultivation|martial.peak|reverend|mysteries|battle.through|immortal|heavens|demon|witch|avatar/i.test(`${idStr} ${scraperDetails?.title || ''}`);
                const country = isKR ? 'KR' : isCN ? 'CN' : (foundCurated?.countryOfOrigin || 'JP');

                return {
                    id: idStr,
                    mal_id: idStr,
                    title: scraperDetails?.title || foundCurated?.title || idStr,
                    title_english: scraperDetails?.title || foundCurated?.title_english || idStr,
                    title_romaji: foundCurated?.title_romaji,
                    title_native: foundCurated?.title_native,
                    images: {
                        jpg: {
                            image_url: scraperDetails?.cover || foundCurated?.images.jpg.image_url || '',
                            large_image_url: scraperDetails?.cover || foundCurated?.images.jpg.large_image_url || '',
                        },
                    },
                    score: foundCurated?.score || 9.0,
                    rank: foundCurated?.rank || 0,
                    status: scraperDetails?.status || foundCurated?.status || 'Ongoing',
                    type: 'NOVEL',
                    countryOfOrigin: country,
                    source: (scraperDetails as any)?.source || foundCurated?.source || 'novelbin',
                    scraper_id: idStr,
                    synopsis: scraperDetails?.description || foundCurated?.synopsis || '',
                    author: scraperDetails?.author && scraperDetails.author !== 'Unknown' ? scraperDetails.author : foundCurated?.author || 'Unknown Author',
                    genres: scraperDetails?.genres
                        ? scraperDetails.genres.map((g, i) => (typeof g === 'string' ? { mal_id: i + 1, name: g } : g))
                        : (foundCurated?.genres || []),
                    bannerImage: scraperDetails?.cover || foundCurated?.bannerImage,
                };
            }

            // Numeric ID -> Fetch from AniList
            const numericId = parseInt(idStr, 10);
            if (isNaN(numericId)) return null;

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
                        countryOfOrigin
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

            const res = await fetchAniList(query, { id: numericId });
            if (!res?.Media) return null;
            return mapAniListToLN(res.Media);
        });
    },

    // 8. Backend Integration: Resolve AniList title to backend scraper novel ID
    async resolveScraperId(titles: string[]): Promise<string | null> {
        const key = `ln_resolve_${titles.join('_')}`;
        return fetchWithOfflineFallback(key, async () => {
            try {
                const { data } = await apiClient.post('/ln/resolve', { titles });
                return data?.scraperId || null;
            } catch {
                return null;
            }
        });
    },

    // 9. Backend Integration: Get scraper novel details & chapters
    async getScraperNovelDetails(scraperId: string, refresh = false): Promise<{
        chapters: LNChapter[];
        description?: string;
        author?: string;
        title?: string;
        cover?: string;
        status?: string;
        genres?: string[];
        source?: string;
    } | null> {
        return fetchWithOfflineFallback(`ln_scraper_details_${scraperId}`, async () => {
            try {
                const query = refresh ? '?refresh=true' : '';
                const { data } = await apiClient.get(`/ln/details/${encodeURIComponent(scraperId)}${query}`);
                if (data?.success && data?.data) {
                    return {
                        chapters: data.data.chapters || [],
                        description: data.data.description,
                        author: data.data.author,
                        title: data.data.title,
                        cover: data.data.cover,
                        status: data.data.status,
                        genres: data.data.genres,
                        source: data.data.source,
                    };
                }
                return null;
            } catch {
                return null;
            }
        });
    },

    // 10. Backend Integration: Read Chapter Content
    async getChapterContent(chapterId: string): Promise<LNChapterContent | null> {
        return fetchWithOfflineFallback(`ln_content_${chapterId}`, async () => {
            try {
                const { data } = await apiClient.get(`/ln/read/${encodeURIComponent(chapterId)}`);
                if (data?.success && data?.data) {
                    return data.data;
                }
                return null;
            } catch {
                return null;
            }
        });
    },

    // 11. Unified Search (AniList + Curated + Backend Scraper)
    async searchNovels(query: string): Promise<LightNovel[]> {
        const trimmed = query.trim();
        if (!trimmed) return [];
        return fetchWithOfflineFallback(`ln_search_unified_${trimmed}`, async () => {
            const gqlQuery = `
                query($search: String) {
                    Page(page: 1, perPage: 16) {
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
                            countryOfOrigin
                            chapters
                            genres
                        }
                    }
                }
            `;

            // Run AniList search, backend scraper search, and local curated list match in parallel
            const [aniListRes, scraperRes] = await Promise.allSettled([
                fetchAniList(gqlQuery, { search: trimmed }),
                apiClient.get(`/ln/search?q=${encodeURIComponent(trimmed)}`).then((r) => r.data?.data || []).catch(() => []),
            ]);

            const anilistList = (aniListRes.status === 'fulfilled' && aniListRes.value?.Page?.media)
                ? aniListRes.value.Page.media.map(mapAniListToLN)
                : [];

            // Local curated matches
            const lowerTerm = trimmed.toLowerCase();
            const curatedMatches = [...POPULAR_KOREAN_NOVELS, ...POPULAR_CHINESE_NOVELS].filter((item) =>
                item.title.toLowerCase().includes(lowerTerm) ||
                (item.title_english && item.title_english.toLowerCase().includes(lowerTerm)) ||
                (item.title_romaji && item.title_romaji.toLowerCase().includes(lowerTerm)) ||
                (item.synopsis && item.synopsis.toLowerCase().includes(lowerTerm))
            );

            const scraperList: LightNovel[] = [];
            if (scraperRes.status === 'fulfilled' && Array.isArray(scraperRes.value)) {
                for (const item of scraperRes.value) {
                    const id = item.id;
                    const title = item.title;
                    const isKR = /korean|manhwa|solo.leveling|omniscient|second.life|nano.machine|overgeared|ranker|mount.hua|reincarnation|hunter|gacha|estate/i.test(`${id} ${title}`);
                    const isCN = /chinese|xianxia|wuxia|cultivation|martial.peak|reverend|mysteries|battle.through|immortal|heavens|demon|witch|avatar/i.test(`${id} ${title}`);
                    const country = isKR ? 'KR' : isCN ? 'CN' : 'JP';
                    scraperList.push(mapScraperToLN(item, country));
                }
            }

            // Deduplicate and combine (Curated & Scraper first for Korean/Chinese matches, AniList for Japanese)
            const seenKeys = new Set<string>();
            const combined: LightNovel[] = [];

            const addToList = (item: LightNovel) => {
                const normTitle = (item.title_english || item.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                const key = `${item.id}-${normTitle}`;
                if (!seenKeys.has(normTitle) && !seenKeys.has(String(item.id))) {
                    seenKeys.add(normTitle);
                    seenKeys.add(String(item.id));
                    combined.push(item);
                }
            };

            curatedMatches.forEach(addToList);
            scraperList.forEach(addToList);
            anilistList.forEach(addToList);

            return combined;
        });
    },
};

import axios from 'axios';
import type { LightNovel, LNChapter, LNChapterContent, NovelEditionKind } from '../types/ln';
import { API_BASE, USES_LOCAL_SOURCES } from '../config/api';
import { novelBinSource } from '../platform/sources/novelbin';
import { getDisplayImageUrl } from '../utils/image';
import { fetchWithOfflineFallback, getOfflineData } from './offlineCache';
import { POPULAR_KOREAN_NOVELS, POPULAR_CHINESE_NOVELS } from './lnData';
import { buildYorumiId } from '../utils/contentIdentity';
import { detectNovelEdition, isConfirmedNovelMatch, normalizeNovelTitle } from '../utils/novelIdentity';
import { postJson } from '../platform/nativeHttp';

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

    try {
        const res = await postJson<{ data?: any }>(
            ANILIST_URL,
            { query, variables },
            { 'Content-Type': 'application/json', Accept: 'application/json' }
        );
        const result = res?.data;
        if (result) {
            cacheMap.set(key, { data: result, timestamp: Date.now() });
        }
        return result;
    } catch (e) {
        console.warn('[lnService] AniList fetch error:', e);
        return null;
    }
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
        yorumiId: buildYorumiId('lightNovel', 'anilist', media.id),
        externalIds: { anilist: media.id, mal: media.idMal },
        mappingStatus: 'unresolved',
        editionKind: 'light-novel',
        editionId: `anilist:${media.id}:light-novel`,
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
        publishedYear: media.startDate?.year || undefined,
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
        characters: media.characters,
    };
};

const mapScraperToLN = (item: any, defaultCountry: 'KR' | 'CN' | 'JP' | string = 'KR'): LightNovel => {
    const rawImage = item.cover || item.image || '';
    const image = rawImage ? (rawImage.startsWith('http') ? rawImage : `${rawImage.startsWith('/') ? '' : '/'}${rawImage}`) : '';

    return {
        id: item.id,
        yorumiId: buildYorumiId('lightNovel', item.source || 'novelbin', item.id),
        externalIds: { [item.source || 'novelbin']: item.id },
        mappingStatus: 'verified',
        readingProvider: item.source || 'novelbin',
        editionKind: detectNovelEdition(`${item.title || ''} ${item.type || ''}`),
        editionId: `${item.source || 'novelbin'}:${item.id}`,
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
    peekSpotlight(): LightNovel[] {
        return getOfflineData<LightNovel[]>('ln_spotlight_v2') || [];
    },
    peekLatestUpdates(): LightNovel[] {
        return getOfflineData<LightNovel[]>('ln_latest_v2') || [];
    },
    peekPopular(page: number = 1): LightNovel[] {
        return getOfflineData<LightNovel[]>(`ln_popular_v2_${page}`) || [];
    },
    peekTop100(page: number = 1): LightNovel[] {
        return getOfflineData<LightNovel[]>(`ln_top100_v2_${page}`) || [];
    },
    peekPopularKoreanNovels(): LightNovel[] {
        return POPULAR_KOREAN_NOVELS;
    },
    peekPopularChineseNovels(): LightNovel[] {
        return POPULAR_CHINESE_NOVELS;
    },
    async preloadHome(): Promise<void> {
        await Promise.allSettled([
            this.getSpotlight(),
            this.getLatestUpdates(),
            this.getPopular(1),
            this.getTop100(1),
        ]);
    },

    // 1. Spotlight Light Novels
    async getSpotlight(): Promise<LightNovel[]> {
        return fetchWithOfflineFallback('ln_spotlight_v2', async () => {
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
                            startDate { year }
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
        return fetchWithOfflineFallback('ln_latest_v2', async () => {
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
                            startDate { year }
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
        return fetchWithOfflineFallback(`ln_popular_v2_${page}`, async () => {
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
                            startDate { year }
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
        return fetchWithOfflineFallback(`ln_top100_v2_${page}`, async () => {
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
                            startDate { year }
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

    async getTop100Full(): Promise<LightNovel[]> {
        return fetchWithOfflineFallback('ln_top100_full_v1', async () => {
            const pages = await Promise.all([1, 2, 3, 4, 5].map((p) =>
                this.getTop100(p).catch(() => [] as LightNovel[])
            ));
            const seen = new Set<string>();
            const deduped: LightNovel[] = [];
            for (const page of pages) {
                for (const item of page) {
                    const key = String(item.id || item.mal_id || item.title || '').toLowerCase();
                    if (!key || seen.has(key)) continue;
                    seen.add(key);
                    deduped.push(item);
                    if (deduped.length >= 100) return deduped;
                }
            }
            return deduped;
        });
    },

    // 5. Popular Korean Web Novels (curated list with verified AniList CDN covers & NovelBin scraper IDs)
    async getPopularKoreanNovels(): Promise<LightNovel[]> {
        return POPULAR_KOREAN_NOVELS;
    },

    // 6. Popular Chinese Web Novels (curated list with verified AniList CDN covers & NovelBin scraper IDs)
    async getPopularChineseNovels(): Promise<LightNovel[]> {
        return POPULAR_CHINESE_NOVELS;
    },

    // 7. Single LN Details from AniList or Scraper
    async getDetails(id: string | number): Promise<LightNovel | null> {
        const idStr = String(id);
        return fetchWithOfflineFallback(`ln_v6_details_${idStr}`, async () => {
            // Check if this is a direct scraper ID (contains ':')
            if (idStr.includes(':')) {
                // First check if it matches curated Korean / Chinese novels
                const foundCurated = [...POPULAR_KOREAN_NOVELS, ...POPULAR_CHINESE_NOVELS].find(
                    (n) => String(n.id) === idStr || String(n.scraper_id) === idStr
                );
                if (foundCurated) {
                    return {
                        ...foundCurated,
                        id: idStr,
                        mal_id: idStr,
                        scraper_id: idStr,
                    };
                }

                const scraperDetails = await lnService.getScraperNovelDetails(idStr);
                if (!scraperDetails) return null;

                const isKR =
                    /korean|manhwa|solo.leveling|omniscient|second.life|nano.machine|overgeared|ranker|mount.hua|reincarnation|hunter|gacha|estate/i.test(`${idStr} ${scraperDetails?.title || ''}`);
                const isCN =
                    /chinese|xianxia|wuxia|cultivation|martial.peak|reverend|mysteries|battle.through|immortal|heavens|demon|witch|avatar/i.test(`${idStr} ${scraperDetails?.title || ''}`);
                const country = isKR ? 'KR' : isCN ? 'CN' : 'JP';

                return {
                    id: idStr,
                    mal_id: idStr,
                    title: scraperDetails?.title || idStr,
                    title_english: scraperDetails?.title || idStr,
                    images: {
                        jpg: {
                            image_url: scraperDetails?.cover || '',
                            large_image_url: scraperDetails?.cover || '',
                        },
                    },
                    score: 9.0,
                    rank: 0,
                    status: scraperDetails?.status || 'Ongoing',
                    type: 'NOVEL',
                    countryOfOrigin: country,
                    source: (scraperDetails?.source as LightNovel['source']) || 'novelbin',
                    scraper_id: idStr,
                    synopsis: scraperDetails?.description || '',
                    author: scraperDetails?.author && scraperDetails.author !== 'Unknown' ? scraperDetails.author : 'Unknown Author',
                    genres: scraperDetails?.genres
                        ? scraperDetails.genres.map((g, i) => (typeof g === 'string' ? { mal_id: i + 1, name: g } : g))
                        : [],
                    bannerImage: scraperDetails?.cover || '',
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
                        characters(perPage: 25, sort: [ROLE, RELEVANCE, ID]) {
                            edges {
                                role
                                node {
                                    id
                                    name { full }
                                    image { large }
                                }
                            }
                        }
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
    async resolveScraperId(titles: string[], expectedEdition: NovelEditionKind = 'light-novel'): Promise<string | null> {
        const latinTitles = [...new Set(titles.map((value) => String(value || '').trim()).filter((value) => /[A-Za-z0-9]/.test(value)))];
        if (latinTitles.length === 0) return null;

        // Check curated Korean / Chinese novels first
        const curatedHit = [...POPULAR_KOREAN_NOVELS, ...POPULAR_CHINESE_NOVELS].find((novel) =>
            isConfirmedNovelMatch(latinTitles, novel.title_english || novel.title, 'unknown')
            || (novel.title_romaji && isConfirmedNovelMatch(latinTitles, novel.title_romaji, 'unknown'))
        );
        if (curatedHit?.scraper_id) {
            return String(curatedHit.scraper_id);
        }

        const key = `ln_v6_resolve_${latinTitles.join('_')}`;
        const memCached = cacheMap.get(key);
        if (memCached && Date.now() - memCached.timestamp < CACHE_TTL && memCached.data) {
            return memCached.data as string;
        }

        return fetchWithOfflineFallback(key, async () => {
            if (USES_LOCAL_SOURCES) {
                // 1. Fast slug probe directly against AllNovelFull + NovelFire
                const probedId = await novelBinSource.probeByTitles(latinTitles);
                if (probedId) {
                    cacheMap.set(key, { data: probedId, timestamp: Date.now() });
                    return probedId;
                }

                // 2. Fallback to cleaned search queries across AllNovelFull + NovelFire
                const searchQueries: string[] = [];
                const addQuery = (q: string) => {
                    const cleaned = q
                        .replace(/\s*[\(\[].*?[\)\]]\s*/g, ' ')
                        .replace(/[―–—:!?]/g, ' ')
                        .replace(/\s+/g, ' ')
                        .trim();
                    if (cleaned.length >= 2 && !searchQueries.some((existing) => existing.toLowerCase() === cleaned.toLowerCase())) {
                        searchQueries.push(cleaned);
                    }
                };
                for (const title of latinTitles) {
                    addQuery(title);
                    const noSo = title.replace(/^so\s+/i, '');
                    if (noSo !== title) addQuery(noSo);
                    const colonBase = title.split(/[:–—―]/)[0]?.trim() || '';
                    if (colonBase.length >= 4 && colonBase !== title) addQuery(colonBase);
                }

                for (const query of searchQueries.slice(0, 4)) {
                    const results = await novelBinSource.search(query);
                    const match = results.find((candidate) => isConfirmedNovelMatch(latinTitles, candidate.title, expectedEdition))
                        || results.find((candidate) => isConfirmedNovelMatch(latinTitles, candidate.title, 'unknown'))
                        || results.find((candidate) => latinTitles.some((title) => normalizeNovelTitle(title) === normalizeNovelTitle(candidate.title)));
                    if (match?.id) {
                        cacheMap.set(key, { data: match.id, timestamp: Date.now() });
                        return match.id;
                    }
                }
                return null;
            }
            try {
                const { data } = await apiClient.post('/ln/resolve', { titles: latinTitles });
                const resolved = data?.scraperId || null;
                if (resolved) {
                    cacheMap.set(key, { data: resolved, timestamp: Date.now() });
                }
                return resolved;
            } catch {
                return null;
            }
        }, (val) => !val);
    },

    // 9. Backend Integration: Get scraper novel details & chapters
    async getScraperNovelDetails(scraperId: string, refresh = false, chaptersOnly = false): Promise<{
        chapters: LNChapter[];
        description?: string;
        author?: string;
        title?: string;
        cover?: string;
        status?: string;
        genres?: string[];
        source?: string;
    } | null> {
        const key = `ln_v6_scraper_details_${scraperId}`;
        if (!refresh) {
            const memCached = cacheMap.get(key);
            if (memCached && Date.now() - memCached.timestamp < CACHE_TTL && memCached.data?.chapters?.length > 0) {
                return memCached.data;
            }
        }

        return fetchWithOfflineFallback(
            key,
            async () => {
                if (USES_LOCAL_SOURCES) {
                    try {
                        const details = await novelBinSource.getDetailsFast(scraperId, chaptersOnly);
                        const payload = {
                            ...details,
                            chapters: details.chapters.map((chapter) => ({
                                ...chapter,
                                provider: details.source || 'novelbin',
                                providerId: chapter.id,
                                editionId: details.id,
                                availability: 'available' as const,
                            })),
                        };
                        if (payload.chapters.length > 0) {
                            cacheMap.set(key, { data: payload, timestamp: Date.now() });
                        }
                        return payload;
                    } catch {
                        return null;
                    }
                }
                try {
                    const query = refresh ? '?refresh=true' : '';
                    const { data } = await apiClient.get(`/ln/details/${encodeURIComponent(scraperId)}${query}`);
                    if (data?.success && data?.data) {
                        const payload = {
                            chapters: (data.data.chapters || []).map((chapter: LNChapter) => ({
                                ...chapter,
                                provider: chapter.provider || data.data.source || 'novelbin',
                                providerId: chapter.providerId || chapter.id,
                                editionId: chapter.editionId || scraperId,
                                availability: chapter.availability || 'available',
                            })),
                            description: data.data.description,
                            author: data.data.author,
                            title: data.data.title,
                            cover: data.data.cover,
                            status: data.data.status,
                            genres: data.data.genres,
                            source: data.data.source,
                        };
                        if (payload.chapters.length > 0) {
                            cacheMap.set(key, { data: payload, timestamp: Date.now() });
                        }
                        return payload;
                    }
                    return null;
                } catch {
                    return null;
                }
            },
            (val) => !val || !Array.isArray(val.chapters) || val.chapters.length === 0
        );
    },

    // 10. Backend Integration: Read Chapter Content
    async getChapterContent(chapterId: string): Promise<LNChapterContent | null> {
        return fetchWithOfflineFallback(`ln_v4_content_${chapterId}`, async () => {
            if (USES_LOCAL_SOURCES) {
                try {
                    const chapter = await novelBinSource.getContent(chapterId);
                    return chapter.content?.trim() ? {
                        ...chapter,
                        provider: 'novelbin',
                        providerId: chapter.id,
                        editionId: chapter.novelId,
                        availability: 'readable',
                    } : null;
                } catch (error) {
                    console.error('[LN] Native chapter fetch failed:', error);
                    return null;
                }
            }
            try {
                const { data } = await apiClient.get(`/ln/read/${encodeURIComponent(chapterId)}`);
                if (data?.success && data?.data) {
                    return {
                        ...data.data,
                        provider: data.data.provider || data.data.source || 'novelbin',
                        providerId: data.data.providerId || data.data.id || chapterId,
                        editionId: data.data.editionId || data.data.novelId,
                        availability: 'readable',
                    };
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
        return fetchWithOfflineFallback(`ln_v3_search_unified_${trimmed}`, async () => {
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
                USES_LOCAL_SOURCES
                    ? novelBinSource.search(trimmed)
                    : apiClient.get(`/ln/search?q=${encodeURIComponent(trimmed)}`).then((r) => r.data?.data || []).catch(() => []),
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

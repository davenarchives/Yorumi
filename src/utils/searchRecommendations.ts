import { storage } from './storage';
import { candidatePoolService } from '../features/explore/recommendation/candidatePoolService';

interface ScoredSuggestion {
    title: string;
    score: number;
}

interface TaggedSeedTitle {
    title: string;
    media: 'anime' | 'manga' | 'ln';
    genres: string[];
}

const CURATED_GENRE_CATALOG: TaggedSeedTitle[] = [
    { title: 'Solo Leveling', media: 'manga', genres: ['Action', 'Adventure', 'Fantasy'] },
    { title: 'Omniscient Reader', media: 'ln', genres: ['Action', 'Adventure', 'Fantasy', 'Psychological'] },
    { title: 'Lord of the Mysteries', media: 'ln', genres: ['Fantasy', 'Mystery', 'Supernatural', 'Action'] },
    { title: 'Shadow Slave', media: 'ln', genres: ['Action', 'Adventure', 'Fantasy', 'Mystery'] },
    { title: 'The Beginning After the End', media: 'ln', genres: ['Action', 'Adventure', 'Fantasy'] },
    { title: 'Overgeared', media: 'ln', genres: ['Action', 'Adventure', 'Comedy', 'Fantasy'] },
    { title: 'Mushoku Tensei', media: 'ln', genres: ['Adventure', 'Drama', 'Fantasy'] },
    { title: 'Re:Zero', media: 'ln', genres: ['Drama', 'Fantasy', 'Psychological', 'Thriller'] },
    { title: 'Classroom of the Elite', media: 'ln', genres: ['Drama', 'Psychological'] },
    { title: 'Frieren', media: 'anime', genres: ['Adventure', 'Drama', 'Fantasy'] },
    { title: 'The Apothecary Diaries', media: 'anime', genres: ['Drama', 'Mystery'] },
    { title: 'Dandadan', media: 'manga', genres: ['Action', 'Comedy', 'Sci-Fi', 'Supernatural'] },
    { title: 'Sakamoto Days', media: 'manga', genres: ['Action', 'Comedy'] },
    { title: 'Kagurabachi', media: 'manga', genres: ['Action', 'Fantasy', 'Supernatural'] },
    { title: 'Vagabond', media: 'manga', genres: ['Action', 'Adventure', 'Drama'] },
    { title: 'Vinland Saga', media: 'manga', genres: ['Action', 'Adventure', 'Drama'] },
    { title: 'Berserk', media: 'manga', genres: ['Action', 'Adventure', 'Drama', 'Fantasy', 'Horror'] },
    { title: 'Blue Lock', media: 'manga', genres: ['Sports', 'Action', 'Drama'] },
    { title: 'Chainsaw Man', media: 'manga', genres: ['Action', 'Drama', 'Horror', 'Supernatural'] },
    { title: 'Jujutsu Kaisen', media: 'anime', genres: ['Action', 'Drama', 'Supernatural'] },
    { title: 'Oshi no Ko', media: 'anime', genres: ['Drama', 'Mystery', 'Supernatural'] },
    { title: 'Kaguya-sama: Love is War', media: 'anime', genres: ['Comedy', 'Romance', 'Psychological'] },
    { title: 'Horimiya', media: 'anime', genres: ['Comedy', 'Romance', 'Slice of Life'] },
    { title: 'Steins;Gate', media: 'anime', genres: ['Drama', 'Sci-Fi', 'Thriller'] },
    { title: 'Monster', media: 'anime', genres: ['Drama', 'Mystery', 'Psychological', 'Thriller'] },
    { title: 'Code Geass', media: 'anime', genres: ['Action', 'Drama', 'Mecha', 'Sci-Fi'] },
    { title: 'Hunter x Hunter', media: 'anime', genres: ['Action', 'Adventure', 'Fantasy'] },
    { title: 'Attack on Titan', media: 'anime', genres: ['Action', 'Drama', 'Fantasy', 'Mystery'] },
    { title: 'Dungeon Meshi', media: 'anime', genres: ['Adventure', 'Comedy', 'Fantasy'] },
    { title: 'Mob Psycho 100', media: 'anime', genres: ['Action', 'Comedy', 'Slice of Life', 'Supernatural'] },
];

const normalizeTitle = (title: string): string =>
    title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const safeReadJson = <T,>(key: string, fallback: T): T => {
    try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
        return fallback;
    }
};

interface UserTasteProfile {
    genreWeights: Map<string, number>;
    seenTitles: Set<string>;
    seenIds: Set<string>;
    topAnimeAnilistIds: number[];
    topAnimeMalIds: number[];
    mediaPreference: { anime: number; manga: number; ln: number };
}

function buildUserTasteProfile(): UserTasteProfile {
    const continueWatching = storage.getContinueWatching();
    const watchList = storage.getWatchList();
    const continueReading = storage.getContinueReading();
    const readList = storage.getReadList();
    const animeWatchTime = storage.getAnimeWatchTime();
    const episodeHistory = storage.getEpisodeHistory();
    const chapterHistory = storage.getChapterHistory();
    const animeGenreCache = storage.getAnimeGenreCache();
    const mangaGenreCache = storage.getMangaGenreCache();

    const continueLN = safeReadJson<Array<{ novelId?: string | number; novelTitle?: string; chapterNumber?: number }>>(
        'yorumi_ln_continue_reading_v1',
        [],
    );
    const lnReadList = safeReadJson<Array<{ id?: string | number; title?: string; genres?: string[] }>>(
        'yorumi_ln_read_list_v1',
        [],
    );
    const favAnime = safeReadJson<Array<{ id?: string; title?: string }>>('yorumi_favorite_anime', []);
    const favManga = safeReadJson<Array<{ id?: string; title?: string }>>('yorumi_favorite_manga', []);
    const favLN = safeReadJson<Array<{ id?: string; title?: string }>>('yorumi_favorite_ln', []);

    const favAnimeIds = new Set(favAnime.map((f) => String(f.id || '')));
    const favMangaIds = new Set(favManga.map((f) => String(f.id || '')));
    const favLNIds = new Set(favLN.map((f) => String(f.id || '')));

    const rawGenreScores = new Map<string, number>();
    const seenTitles = new Set<string>();
    const seenIds = new Set<string>();

    const addSeen = (title?: string, ...ids: Array<string | number | undefined>) => {
        if (title) seenTitles.add(normalizeTitle(title));
        for (const id of ids) {
            if (id !== undefined && id !== null && String(id).trim()) {
                seenIds.add(String(id).trim());
            }
        }
    };

    const addGenres = (genres: string[] | undefined, weight: number) => {
        if (!genres || genres.length === 0 || weight <= 0) return;
        for (const g of genres) {
            const clean = g.trim().toLowerCase();
            if (!clean) continue;
            rawGenreScores.set(clean, (rawGenreScores.get(clean) || 0) + weight);
        }
    };

    const animeSeedScores: Array<{ anilistId?: number; malId?: number; weight: number }> = [];

    // 1. Watched anime (weighted by watch time, episode count, and favorite status)
    for (const item of continueWatching) {
        const id = String(item.animeId);
        addSeen(item.animeTitle, id, item.anilistId, item.malId);
        const seconds = Number(animeWatchTime[id] || (item.anilistId ? animeWatchTime[String(item.anilistId)] : 0) || 0);
        const eps = Math.max(episodeHistory[id]?.length || 0, item.episodeNumber || 1);
        const favBonus = favAnimeIds.has(id) || (item.anilistId && favAnimeIds.has(String(item.anilistId))) ? 4 : 0;
        const weight = Math.max(1.5, seconds / 1440, eps * 1.2) + favBonus;
        const genres =
            animeGenreCache[id] ||
            (item.anilistId ? animeGenreCache[String(item.anilistId)] : undefined) ||
            (item.malId ? animeGenreCache[String(item.malId)] : undefined);
        addGenres(genres, weight);

        animeSeedScores.push({
            anilistId: item.anilistId,
            malId: item.malId || (/^\d+$/.test(id) ? Number(id) : undefined),
            weight,
        });
    }

    // 2. Watchlist anime
    for (const item of watchList) {
        const id = String(item.id);
        addSeen(item.title, id, item.anilistId, item.malId);
        const favBonus = favAnimeIds.has(id) ? 3 : 0;
        const progressWeight = (item.currentProgress || 0) * 0.9;
        const weight = 1.5 + progressWeight + favBonus;
        const genres =
            (item.genres && item.genres.length > 0 ? item.genres : undefined) ||
            animeGenreCache[id] ||
            (item.anilistId ? animeGenreCache[String(item.anilistId)] : undefined);
        addGenres(genres, weight);

        animeSeedScores.push({
            anilistId: Number(item.anilistId) || undefined,
            malId: Number(item.malId) || (/^\d+$/.test(id) ? Number(id) : undefined),
            weight: weight * 0.85,
        });
    }

    // 3. Read manga
    for (const item of continueReading) {
        const id = String(item.mangaId);
        addSeen(item.mangaTitle, id);
        const chs = Math.max(chapterHistory[id]?.length || 0, Number(item.chapterNumber) || 1);
        const favBonus = favMangaIds.has(id) ? 3.5 : 0;
        const weight = Math.min(18, Math.max(1.5, chs * 0.35)) + favBonus;
        addGenres(mangaGenreCache[id], weight);
    }

    for (const item of readList) {
        const id = String(item.id);
        addSeen(item.title, id, item.anilistId, item.malId);
        const favBonus = favMangaIds.has(id) ? 3 : 0;
        const genres = (item.genres && item.genres.length > 0 ? item.genres : undefined) || mangaGenreCache[id];
        addGenres(genres, 1.5 + favBonus);
    }

    // 4. Read light novels
    for (const item of continueLN) {
        const id = String(item.novelId || '');
        addSeen(item.novelTitle, id);
    }
    for (const item of lnReadList) {
        const id = String(item.id || '');
        addSeen(item.title, id);
        const favBonus = favLNIds.has(id) ? 3 : 0;
        addGenres(item.genres, 1.8 + favBonus);
    }

    // Normalize genre weights to 0..1
    const maxGenre = Math.max(1, ...Array.from(rawGenreScores.values()));
    const genreWeights = new Map<string, number>();
    rawGenreScores.forEach((val, key) => {
        genreWeights.set(key, val / maxGenre);
    });

    // Top 3 most-watched / highest-weight anime seeds for AniList recommendations
    const sortedSeeds = animeSeedScores.sort((a, b) => b.weight - a.weight);
    const topAnimeAnilistIds: number[] = [];
    const topAnimeMalIds: number[] = [];
    for (const seed of sortedSeeds) {
        if (seed.anilistId && !topAnimeAnilistIds.includes(seed.anilistId) && topAnimeAnilistIds.length < 3) {
            topAnimeAnilistIds.push(seed.anilistId);
        } else if (seed.malId && !topAnimeMalIds.includes(seed.malId) && topAnimeMalIds.length < 3) {
            topAnimeMalIds.push(seed.malId);
        }
    }

    const totalActivity = Math.max(
        1,
        continueWatching.length + watchList.length + continueReading.length + readList.length + continueLN.length + lnReadList.length,
    );

    return {
        genreWeights,
        seenTitles,
        seenIds,
        topAnimeAnilistIds,
        topAnimeMalIds,
        mediaPreference: {
            anime: (continueWatching.length + watchList.length) / totalActivity,
            manga: (continueReading.length + readList.length) / totalActivity,
            ln: (continueLN.length + lnReadList.length) / totalActivity,
        },
    };
}

let cachedRecsKey = '';
let cachedRecsAt = 0;
let cachedAniListRecs: Array<{ title: string; genres: string[]; rating: number; id?: number; malId?: number }> = [];
const ANILIST_RECS_TTL_MS = 15 * 60 * 1000;

async function fetchAniListRecommendationsForSeeds(
    anilistIds: number[],
    malIds: number[],
): Promise<Array<{ title: string; genres: string[]; rating: number; id?: number; malId?: number }>> {
    const key = `${anilistIds.join(',')}|${malIds.join(',')}`;
    if (!key || key === '|') return [];
    if (cachedRecsKey === key && Date.now() - cachedRecsAt < ANILIST_RECS_TTL_MS) {
        return cachedAniListRecs;
    }

    const runQuery = async (varName: 'id_in' | 'idMal_in', ids: number[]) => {
        if (ids.length === 0) return [];
        const res = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
                query: `query ($ids: [Int]) {
                    Page(perPage: 4) {
                        media(${varName}: $ids, type: ANIME) {
                            recommendations(perPage: 8, sort: RATING_DESC) {
                                nodes {
                                    rating
                                    mediaRecommendation {
                                        id
                                        idMal
                                        title { english romaji }
                                        genres
                                        averageScore
                                    }
                                }
                            }
                        }
                    }
                }`,
                variables: { ids },
            }),
        });
        if (!res.ok) return [];
        const json = (await res.json()) as {
            data?: {
                Page?: {
                    media?: Array<{
                        recommendations?: {
                            nodes?: Array<{
                                rating?: number;
                                mediaRecommendation?: {
                                    id?: number;
                                    idMal?: number;
                                    title?: { english?: string; romaji?: string };
                                    genres?: string[];
                                    averageScore?: number;
                                };
                            }>;
                        };
                    }>;
                };
            };
        };

        const out: Array<{ title: string; genres: string[]; rating: number; id?: number; malId?: number }> = [];
        for (const media of json?.data?.Page?.media || []) {
            for (const node of media?.recommendations?.nodes || []) {
                const rec = node?.mediaRecommendation;
                const title = (rec?.title?.english || rec?.title?.romaji || '').trim();
                if (!title || title.length > 48) continue;
                out.push({
                    title,
                    genres: rec?.genres || [],
                    rating: Number(node?.rating || 0) + Number(rec?.averageScore || 0) / 10,
                    id: rec?.id,
                    malId: rec?.idMal,
                });
            }
        }
        return out;
    };

    try {
        const [byAl, byMal] = await Promise.all([
            runQuery('id_in', anilistIds).catch(() => []),
            runQuery('idMal_in', malIds).catch(() => []),
        ]);
        const merged = [...byAl, ...byMal];
        cachedRecsKey = key;
        cachedRecsAt = Date.now();
        cachedAniListRecs = merged;
        return merged;
    } catch {
        return [];
    }
}

const scoreGenres = (genres: string[], weights: Map<string, number>): number => {
    if (genres.length === 0 || weights.size === 0) return 0;
    let total = 0;
    for (const g of genres) {
        total += weights.get(g.trim().toLowerCase()) || 0;
    }
    // Average-blended sum so multi-genre titles don't unfairly drown out focused matches
    return total / Math.sqrt(genres.length);
};

export async function getPersonalizedSearchSuggestions(): Promise<string[]> {
    const profile = buildUserTasteProfile();
    const scored = new Map<string, ScoredSuggestion>();

    const upsert = (title: string, score: number, id?: string | number, malId?: string | number) => {
        const clean = title.trim();
        if (clean.length < 2 || clean.length > 48) return;
        const norm = normalizeTitle(clean);
        if (!norm || profile.seenTitles.has(norm)) return;
        if (id !== undefined && profile.seenIds.has(String(id))) return;
        if (malId !== undefined && profile.seenIds.has(String(malId))) return;

        const existing = scored.get(norm);
        if (!existing || score > existing.score) {
            scored.set(norm, { title: clean, score });
        }
    };

    const [aniListRecs, candidatePool] = await Promise.all([
        fetchAniListRecommendationsForSeeds(profile.topAnimeAnilistIds, profile.topAnimeMalIds),
        candidatePoolService.getCandidatePool().catch(() => []),
    ]);

    // 1. Highest priority: Direct AniList recommendations from user's most-watched anime
    for (const rec of aniListRecs) {
        const genreScore = scoreGenres(rec.genres, profile.genreWeights);
        const recScore = 18 + genreScore * 12 + Math.min(8, Math.log10(Math.max(1, rec.rating) + 1) * 3);
        upsert(rec.title, recScore, rec.id, rec.malId);
    }

    // 2. Explore candidate pool scored by user's top genres + quality
    for (const candidate of candidatePool) {
        const title = (candidate.titleEnglish || candidate.title || '').trim();
        if (!title) continue;
        const genres = Array.isArray(candidate.genres) ? candidate.genres : [];
        const genreScore = scoreGenres(genres, profile.genreWeights);
        const qualityScore = (Number(candidate.score || 75) / 100) * 3;
        const total = genreScore * 14 + qualityScore + profile.mediaPreference.anime * 2;
        upsert(title, total, candidate.id);
    }

    // 3. Curated Anime / Manga / LN catalog scored by user's top genres & media preference
    for (const item of CURATED_GENRE_CATALOG) {
        const genreScore = scoreGenres(item.genres, profile.genreWeights);
        const mediaBoost =
            item.media === 'manga'
                ? profile.mediaPreference.manga * 6
                : item.media === 'ln'
                ? profile.mediaPreference.ln * 6
                : profile.mediaPreference.anime * 2;
        upsert(item.title, genreScore * 13 + mediaBoost + 2.5);
    }

    return Array.from(scored.values())
        .sort((a, b) => b.score - a.score)
        .map((entry) => entry.title)
        .slice(0, 40);
}

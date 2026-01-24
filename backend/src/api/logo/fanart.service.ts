import axios from 'axios';

const FANART_API_KEY = process.env.FANART_API_KEY || '';
const FANART_BASE_URL = 'https://webservice.fanart.tv/v3/tv';

// Log API key status at startup (don't log the actual key for security)
console.log('[Fanart Service] API Key configured:', FANART_API_KEY ? '✓ Yes' : '✗ No');

// Cache for TVDB ID mappings (AniList ID -> TVDB ID)
const tvdbMappingCache = new Map<number, string | null>();

// Cache for logo URLs (TVDB ID -> Logo URL)
const logoCache = new Map<string, string | null>();

// Cache for the entire anime list database (loaded once, reused)
let animeDatabaseCache: any[] | null = null;
let databaseLastFetched: number = 0;
const DATABASE_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface FanartTVResponse {
    name: string;
    thetvdb_id: string;
    hdtvlogo?: Array<{
        id: string;
        url: string;
        lang: string;
        likes: string;
    }>;
    clearlogo?: Array<{
        id: string;
        url: string;
        lang: string;
        likes: string;
    }>;
}

interface AnifyMappingResponse {
    id: string;
    mappings: {
        id: string;
        providerId: string;
        similarity: number;
    }[];
}

/**
 * Resolve AniList ID to TVDB ID using Fribb/anime-lists static database
 * More reliable than live APIs that frequently timeout
 */
export async function getTVDBIdFromAniList(anilistId: number): Promise<string | null> {
    // Check cache first
    if (tvdbMappingCache.has(anilistId)) {
        const cached = tvdbMappingCache.get(anilistId);
        console.log(`[Fanart] Cache hit for AniList ID ${anilistId} -> TVDB ${cached}`);
        return cached ?? null;
    }

    try {
        // Use cached database if available and not expired
        let animeDatabase = animeDatabaseCache;
        const now = Date.now();

        if (!animeDatabase || (now - databaseLastFetched) > DATABASE_CACHE_TTL) {
            console.log('[Fanart] Fetching anime database from GitHub...');
            // Use anime-list-mini for faster loading (smaller file)
            const response = await axios.get(
                'https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-mini.json',
                { timeout: 15000 }
            );

            if (response.data && Array.isArray(response.data)) {
                animeDatabase = response.data;
                animeDatabaseCache = animeDatabase;
                databaseLastFetched = now;
                console.log(`[Fanart] Loaded anime database with ${animeDatabase.length} entries`);
            } else {
                console.warn('[Fanart] Invalid database format received');
                tvdbMappingCache.set(anilistId, null);
                return null;
            }
        }

        // Find entry matching our AniList ID
        // Note: Fribb uses 'livechart_id' for AniList IDs
        const entry = animeDatabase.find((item: any) =>
            item.livechart_id === anilistId || item.anilist_id === anilistId
        );

        if (entry && entry.tvdb_id) {
            const tvdbId = String(entry.tvdb_id);
            console.log(`[Fanart] Resolved AniList ${anilistId} -> TVDB ${tvdbId}`);
            tvdbMappingCache.set(anilistId, tvdbId);
            return tvdbId;
        }

        console.log(`[Fanart] No TVDB mapping found for AniList ID ${anilistId}`);
        tvdbMappingCache.set(anilistId, null);
        return null;
    } catch (error) {
        console.warn(`[Fanart] Error resolving TVDB ID for AniList ${anilistId}:`, error);
        tvdbMappingCache.set(anilistId, null);
        return null;
    }
}

/**
 * Fetch logo from Fanart.tv using TVDB ID
 */
export async function getFanartLogo(tvdbId: string): Promise<string | null> {
    // Check cache first
    if (logoCache.has(tvdbId)) {
        const cached = logoCache.get(tvdbId);
        console.log(`[Fanart] Logo cache hit for TVDB ${tvdbId}: ${cached}`);
        return cached ?? null;
    }

    if (!FANART_API_KEY) {
        console.warn('[Fanart] API key not configured');
        logoCache.set(tvdbId, null);
        return null;
    }

    try {
        const response = await axios.get<FanartTVResponse>(
            `${FANART_BASE_URL}/${tvdbId}`,
            {
                params: { api_key: FANART_API_KEY },
                timeout: 8000 // Increased to 8 seconds
            }
        );

        if (response.data) {
            // Prioritize HD TV Logo, fallback to Clear Logo
            const hdtvLogo = response.data.hdtvlogo?.find((logo) => logo.lang === 'en');
            const clearLogo = response.data.clearlogo?.find((logo) => logo.lang === 'en');

            // If no English, take first available
            const selectedLogo = hdtvLogo || response.data.hdtvlogo?.[0] ||
                clearLogo || response.data.clearlogo?.[0];

            if (selectedLogo) {
                console.log(`[Fanart] Found logo for TVDB ${tvdbId}: ${selectedLogo.url}`);
                logoCache.set(tvdbId, selectedLogo.url);
                return selectedLogo.url;
            }
        }

        console.log(`[Fanart] No logo found for TVDB ${tvdbId}`);
        logoCache.set(tvdbId, null);
        return null;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
            console.log(`[Fanart] No data found for TVDB ${tvdbId}`);
        } else {
            console.warn(`[Fanart] Error fetching logo for TVDB ${tvdbId}:`, error);
        }
        logoCache.set(tvdbId, null);
        return null;
    }
}

/**
 * Get anime logo URL by AniList ID
 * This is the main entry point that combines TVDB resolution and logo fetching
 */
export async function getAnimeLogo(anilistId: number): Promise<{
    logo: string | null;
    source: 'fanart' | 'fallback';
    cached: boolean;
}> {
    // Check if we have cached logo mapping
    const cacheKey = anilistId;
    const tvdbCached = tvdbMappingCache.has(cacheKey);

    // Step 1: Resolve to TVDB ID
    const tvdbId = await getTVDBIdFromAniList(anilistId);

    if (!tvdbId) {
        return { logo: null, source: 'fallback', cached: tvdbCached };
    }

    const logoCached = logoCache.has(tvdbId);

    // Step 2: Fetch logo from Fanart.tv
    const logoUrl = await getFanartLogo(tvdbId);

    return {
        logo: logoUrl,
        source: logoUrl ? 'fanart' : 'fallback',
        cached: tvdbCached && logoCached
    };
}

/**
 * Warmup the anime database cache on server startup
 * This reduces first-request latency significantly
 */
export async function warmupAnimeDatabase(): Promise<void> {
    console.log('[Fanart] Pre-warming anime database...');
    try {
        const response = await axios.get(
            'https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-mini.json',
            { timeout: 30000 }
        );

        if (response.data && Array.isArray(response.data)) {
            animeDatabaseCache = response.data;
            databaseLastFetched = Date.now();
            console.log(`[Fanart] ✓ Anime database warmed up with ${animeDatabaseCache.length} entries`);
        } else {
            console.warn('[Fanart] ✗ Failed to warm up database: invalid format');
        }
    } catch (error) {
        console.warn('[Fanart] ✗ Failed to warm up database:', error);
    }
}

/**
 * Batch fetch logos for multiple AniList IDs
 * Processes in parallel with rate limiting to avoid overwhelming Fanart.tv
 */
export async function batchGetAnimeLogos(anilistIds: number[]): Promise<Map<number, { logo: string | null; source: 'fanart' | 'fallback'; cached: boolean }>> {
    const results = new Map<number, { logo: string | null; source: 'fanart' | 'fallback'; cached: boolean }>();

    // Process in batches of 5 to avoid rate limiting
    const batchSize = 5;
    for (let i = 0; i < anilistIds.length; i += batchSize) {
        const batch = anilistIds.slice(i, i + batchSize);
        const batchResults = await Promise.all(
            batch.map(async (id) => {
                const result = await getAnimeLogo(id);
                return { id, result };
            })
        );

        for (const { id, result } of batchResults) {
            results.set(id, result);
        }
    }

    return results;
}

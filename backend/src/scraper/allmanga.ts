import axios from 'axios';
import crypto from 'crypto';
import type { AnimeSearchResult, Episode, StreamLink, ThumbnailInfo } from './types';
import { tmdbService } from '../api/scraper/tmdb.service';

const API_URL = 'https://api.mkissa.net/api';
const ALLMANGA_REFERER = 'https://mkissa.to';
const STREAM_REFERER = 'https://allmanga.to';

const ANIMETSU_API_URL = 'https://animetsu.net/v2/api/anime';
const ANIMETSU_REFERER = 'https://animetsu.net/';
const ANIMETSU_IMAGE_PROXY = 'https://animetsu.net';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0';
let DYNAMIC_KEYS: { epoch: number; aaKey: Buffer; queryHash: string; buildId: string; fetchTime: number } | null = null;
const STATIC_QUERY_HASH = 'f4662f4b7510b26795dd53ef824a0bf1740fbbc5d1273fab18222ac831bca8d0';

const TS_BUCKET_MS = 300_000;

async function fetchDynamicKeys() {
    if (DYNAMIC_KEYS && Date.now() - DYNAMIC_KEYS.fetchTime < 5 * 60 * 1000) {
        return DYNAMIC_KEYS;
    }
    
    try {
        const pageRes = await axios.get('https://mkissa.to/', {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 10000
        });
        
        const epochMatch = pageRes.data.match(/"epoch":(\d+)/);
        const partBMatch = pageRes.data.match(/"partB":"([^"]+)"/);
        const appUrlMatch = pageRes.data.match(/https:\/\/cdn\.mkissa\.net\/all\/mk\/_app\/immutable\/entry\/app\.[A-Za-z0-9_.-]+\.js/);
        
        if (epochMatch && partBMatch && appUrlMatch) {
            const epoch = parseInt(epochMatch[1], 10);
            const partB = partBMatch[1];
            
            const appRes = await axios.get(appUrlMatch[0], { headers: { 'User-Agent': USER_AGENT }, timeout: 10000 });
            const chunksMatches = [...appRes.data.matchAll(/"(\.\.\/chunks\/[A-Za-z0-9_.-]+\.js)"/g)];
            const chunkUrls = chunksMatches.map(m => m[1].replace('../', 'https://cdn.mkissa.net/all/mk/_app/immutable/')).slice(0, 5);
            
            let maskHex = '';
            for (const cUrl of chunkUrls) {
                const cRes = await axios.get(cUrl, { headers: { 'User-Agent': USER_AGENT }, timeout: 5000 });
                const hexMatch = cRes.data.match(/[0-9a-f]{64}/);
                if (hexMatch) {
                    maskHex = hexMatch[0];
                    break;
                }
            }
            
            if (maskHex) {
                const partBHex = Buffer.from(partB, 'base64').toString('hex');
                let keyHex = '';
                for (let i = 0; i < 64; i += 2) {
                    const m = parseInt(maskHex.substring(i, i + 2), 16);
                    const p = parseInt(partBHex.substring(i, i + 2), 16);
                    keyHex += (m ^ p).toString(16).padStart(2, '0');
                }
                
                DYNAMIC_KEYS = {
                    epoch,
                    aaKey: Buffer.from(keyHex, 'hex'),
                    queryHash: STATIC_QUERY_HASH,
                    buildId: '12',
                    fetchTime: Date.now()
                };
                return DYNAMIC_KEYS;
            }
        }
    } catch (e) {
        // Fallback below
    }
    
    // Fallback to static if dynamic fails
    return {
        epoch: 6886,
        aaKey: Buffer.from('a55ce35d83c1417fdfec0192c2b847eeae58d5bbb331a179d293aac40c035795', 'hex'),
        queryHash: STATIC_QUERY_HASH,
        buildId: '12',
        fetchTime: Date.now()
    };
}

const SEARCH_GQL = `query($search:SearchInput $limit:Int $page:Int $translationType:VaildTranslationTypeEnumType $countryOrigin:VaildCountryOriginEnumType){shows(search:$search limit:$limit page:$page translationType:$translationType countryOrigin:$countryOrigin){edges{_id name englishName type status season availableEpisodes episodeCount lastEpisodeInfo __typename}}}`;
const LATEST_UPDATES_GQL = `query($search:SearchInput $limit:Int $page:Int $translationType:VaildTranslationTypeEnumType $countryOrigin:VaildCountryOriginEnumType){shows(search:$search limit:$limit page:$page translationType:$translationType countryOrigin:$countryOrigin){edges{_id name englishName thumbnail banner type status score averageScore season availableEpisodes lastEpisodeDate lastEpisodeInfo lastEpisodeTimestamp episodeCount genres slugTime} pageInfo{total totalPages page hasNextPage}}}`;
const EPISODE_INFOS_GQL = `query($showId:String! $episodeNumStart:Float! $episodeNumEnd:Float!){episodeInfos(showId:$showId episodeNumStart:$episodeNumStart episodeNumEnd:$episodeNumEnd){_id notes description thumbnails uploadDates episodeIdNum vidInforssub vidInforsdub}}`;
const EPISODE_GQL = `query($showId:String! $translationType:VaildTranslationTypeEnumType! $episodeString:String!){episode(showId:$showId translationType:$translationType episodeString:$episodeString){episodeString sourceUrls}}`;

const HEX_MAP: Record<string, string> = {
    79: 'A', '7a': 'B', '7b': 'C', '7c': 'D', '7d': 'E', '7e': 'F', '7f': 'G', 70: 'H', 71: 'I', 72: 'J',
    73: 'K', 74: 'L', 75: 'M', 76: 'N', 77: 'O', 68: 'P', 69: 'Q', '6a': 'R', '6b': 'S', '6c': 'T',
    '6d': 'U', '6e': 'V', '6f': 'W', 60: 'X', 61: 'Y', 62: 'Z', 59: 'a', '5a': 'b', '5b': 'c',
    '5c': 'd', '5d': 'e', '5e': 'f', '5f': 'g', 50: 'h', 51: 'i', 52: 'j', 53: 'k', 54: 'l',
    55: 'm', 56: 'n', 57: 'o', 48: 'p', 49: 'q', '4a': 'r', '4b': 's', '4c': 't', '4d': 'u',
    '4e': 'v', '4f': 'w', 40: 'x', 41: 'y', 42: 'z', '08': '0', '09': '1', '0a': '2', '0b': '3',
    '0c': '4', '0d': '5', '0e': '6', '0f': '7', '00': '8', '01': '9', 15: '-', 16: '.', 67: '_',
    46: '~', '02': ':', 17: '/', '07': '?', '1b': '#', 63: '[', 65: ']', 78: '@', 19: '!', '1c': '$',
    '1e': '&', 10: '(', 11: ')', 12: '*', 13: '+', 14: ',', '03': ';', '05': '=', '1d': '%',
};

type TranslationType = 'sub' | 'dub';
type AllMangaSource = { sourceUrl?: string; sourceName?: string; priority?: number };
type AllMangaShow = {
    _id?: string;
    name?: string;
    englishName?: string | null;
    thumbnail?: string | null;
    banner?: string | null;
    type?: string | null;
    status?: string | null;
    score?: number | null;
    averageScore?: number | null;
    season?: { quarter?: string; year?: number } | null;
    availableEpisodes?: Record<string, number>;
    lastEpisodeDate?: Record<string, unknown>;
    lastEpisodeInfo?: Record<string, { episodeString?: string }>;
    lastEpisodeTimestamp?: Record<string, number>;
    episodeCount?: number | string | null;
    genres?: string[];
};
type AllMangaEpisodeInfo = {
    _id?: string;
    notes?: string | null;
    description?: string | null;
    thumbnails?: string[];
    uploadDates?: Record<string, string>;
    episodeIdNum?: number;
    vidInforssub?: { vidDuration?: number; vidResolution?: number };
    vidInforsdub?: { vidDuration?: number; vidResolution?: number };
};
type ClockLink = { link?: string; resolutionStr?: string };
type AnimetsuSearchResult = {
    id?: string;
    title?: {
        romaji?: string | null;
        english?: string | null;
        native?: string | null;
    };
    total_eps?: number | null;
    mal_id?: number | null;
    anilist_id?: number | null;
};
type AnimetsuEpisode = {
    ep_num?: number;
    img?: string | null;
};

const requestHeaders = {
    'User-Agent': USER_AGENT,
    Referer: ALLMANGA_REFERER,
    Origin: ALLMANGA_REFERER,
    Accept: '*/*',
};

const animetsuHeaders = {
    'User-Agent': USER_AGENT,
    Referer: ANIMETSU_REFERER,
    Origin: ANIMETSU_REFERER.replace(/\/$/, ''),
    Accept: 'application/json',
};

export class AllMangaScraper {
    static isAllMangaSession(value: unknown) {
        return /^am-[a-z0-9]+$/i.test(String(value || '').trim());
    }

    static toSession(showId: string) {
        return `am-${showId}`;
    }

    static fromSession(value: unknown) {
        const raw = String(value || '').trim().replace(/^s:/i, '').split(/[?#]/)[0];
        const match = raw.match(/^am-([a-z0-9]+)$/i);
        return match?.[1] || '';
    }

    private decodeUrl(encoded: string) {
        const clean = encoded.startsWith('--') ? encoded.slice(2) : encoded;
        let result = '';
        for (let i = 0; i < clean.length; i += 2) {
            const pair = clean.slice(i, i + 2);
            result += HEX_MAP[pair] ?? pair;
        }
        return result.replace(/\\u002F/gi, '/').replace(/\\\|/g, '');
    }

    private parseSourcePayload(value: unknown): AllMangaSource[] {
        if (Array.isArray(value)) return value;
        const parsed = value as { episode?: { sourceUrls?: AllMangaSource[] }; sourceUrls?: AllMangaSource[] } | null;
        if (Array.isArray(parsed?.episode?.sourceUrls)) return parsed.episode.sourceUrls;
        if (Array.isArray(parsed?.sourceUrls)) return parsed.sourceUrls;
        return [];
    }

    private extractSourcesFromText(plain: string): AllMangaSource[] {
        const sources: AllMangaSource[] = [];
        for (const chunk of plain.split(/[{}]/)) {
            const urlMatch = chunk.match(/"sourceUrl"\s*:\s*"([^"]+)"/);
            if (!urlMatch) continue;
            const nameMatch = chunk.match(/"sourceName"\s*:\s*"([^"]+)"/);
            const priorityMatch = chunk.match(/"priority"\s*:\s*([0-9.]+)/);
            sources.push({
                sourceUrl: urlMatch[1],
                sourceName: nameMatch?.[1] || '',
                priority: priorityMatch ? Number(priorityMatch[1]) : 0,
            });
        }
        return sources;
    }

    private async decryptTobeparsed(blob: string): Promise<AllMangaSource[]> {
        try {
            const keys = await fetchDynamicKeys();
            const raw = Buffer.from(blob, 'base64');
            if (raw.length <= 29) return [];
            const nonce = raw.subarray(1, 13);
            const ciphertext = raw.subarray(13, -16);
            const authTag = raw.subarray(-16);

            const decipher = crypto.createDecipheriv('aes-256-gcm', keys.aaKey, nonce);
            decipher.setAuthTag(authTag);
            const plain = decipher.update(ciphertext, undefined, 'utf8') + decipher.final('utf8');

            try {
                const parsed = JSON.parse(plain);
                const sources = this.parseSourcePayload(parsed);
                if (sources.length > 0) return sources;
            } catch {
                const sources = this.extractSourcesFromText(plain);
                if (sources.length > 0) return sources;
            }
            return [];
        } catch {
            return [];
        }
    }

    private async parseEpisodeSources(payload: unknown): Promise<AllMangaSource[]> {
        const data = payload as { data?: { episode?: { sourceUrls?: AllMangaSource[] }; tobeparsed?: string }; tobeparsed?: string };
        const plainSources = this.parseSourcePayload(data?.data?.episode);
        if (plainSources.length > 0) return plainSources;

        const encrypted = data?.data?.tobeparsed || data?.tobeparsed;
        return encrypted ? await this.decryptTobeparsed(encrypted) : [];
    }

    private async gql<T>(variables: Record<string, unknown>, query: string): Promise<T | null> {
        try {
            const response = await axios.post<T>(
                API_URL,
                { variables, query },
                {
                    timeout: 25_000,
                    headers: {
                        ...requestHeaders,
                        'Content-Type': 'application/json',
                    },
                }
            );
            return response.data;
        } catch {
            return null;
        }
    }

    private async generateAaReq(): Promise<string> {
        const keys = await fetchDynamicKeys();
        const ts = Math.floor(Date.now() / TS_BUCKET_MS) * TS_BUCKET_MS;
        const payload = { v: 1, ts, epoch: keys.epoch, qh: keys.queryHash };
        const seed = `${keys.epoch}:${keys.queryHash}:${ts}`;
        const nonce = crypto.createHash('sha256').update(seed).digest().subarray(0, 12);
        
        const plaintext = Buffer.from(JSON.stringify(payload));
        const cipher = crypto.createCipheriv('aes-256-gcm', keys.aaKey, nonce);
        
        const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
        const authTag = cipher.getAuthTag();
        
        const envelope = Buffer.concat([Buffer.from([1]), nonce, ciphertext, authTag]);
        return envelope.toString('base64');
    }

    /**
     * Episode source fetcher: uses a GET request with persisted query hash + Origin header
     * (matching current ani-cli approach), falling back to POST if GET fails.
     */
    private async episodeGql(variables: Record<string, unknown>) {
        try {
            const keys = await fetchDynamicKeys();
            const aaReq = await this.generateAaReq();
            const params = new URLSearchParams({
                variables: JSON.stringify(variables),
                extensions: JSON.stringify({
                    persistedQuery: { version: 1, sha256Hash: keys.queryHash },
                    aaReq,
                }),
            });
            const response = await axios.get(`${API_URL}?${params.toString()}`, {
                timeout: 12_000,
                headers: {
                    'User-Agent': USER_AGENT,
                    Origin: ALLMANGA_REFERER,
                    Referer: ALLMANGA_REFERER,
                },
            });
            if (response.data?.data?.tobeparsed || response.data?.data?.episode?.sourceUrls) {
                return response.data;
            }
        } catch {
            // Fall back to POST below.
        }
        return this.gql(variables, EPISODE_GQL);
    }

    private normalizeTitle(value: unknown) {
        return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    private scoreAnimetsuCandidate(show: AllMangaShow | null | undefined, candidate: AnimetsuSearchResult) {
        const showTitles = [
            show?.englishName,
            show?.name,
        ].map((title) => this.normalizeTitle(title)).filter((title) => title.length >= 4);
        const candidateTitles = [
            candidate?.title?.english,
            candidate?.title?.romaji,
            candidate?.title?.native,
        ].map((title) => this.normalizeTitle(title)).filter((title) => title.length >= 4);

        let score = 0;
        for (const showTitle of showTitles) {
            for (const candidateTitle of candidateTitles) {
                if (showTitle === candidateTitle) score = Math.max(score, 120);
                else if (showTitle.includes(candidateTitle) || candidateTitle.includes(showTitle)) score = Math.max(score, 80);
            }
        }

        const expectedEpisodes = Math.max(
            Number(show?.availableEpisodes?.sub || 0),
            Number(show?.availableEpisodes?.dub || 0),
            Number(show?.episodeCount || 0),
        );
        const candidateEpisodes = Number(candidate?.total_eps || 0);
        if (score > 0 && expectedEpisodes > 0 && candidateEpisodes > 0) {
            const diff = Math.abs(expectedEpisodes - candidateEpisodes);
            if (diff === 0) score += 16;
            else if (diff <= 3) score += 8;
            else if (diff > 12) score -= 16;
        }

        return score;
    }

    private normalizeAnimetsuImage(value: unknown) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        if (/^https?:\/\//i.test(raw)) return raw;
        return `${ANIMETSU_IMAGE_PROXY}${raw.startsWith('/') ? raw : `/${raw}`}`;
    }

    private isLikelyDeadImageUrl(value: unknown) {
        const url = String(value || '').trim();
        return !url || /\/mcovers\/a_tbs\/dhw\//i.test(url);
    }

    private async isReachableImageUrl(value: unknown) {
        const url = String(value || '').trim();
        if (this.isLikelyDeadImageUrl(url)) return false;

        try {
            const response = await axios.head(url, {
                headers: requestHeaders,
                timeout: 5_000,
                validateStatus: (status) => status >= 200 && status < 400,
            });
            const contentType = String(response.headers?.['content-type'] || '').toLowerCase();
            return !contentType || contentType.startsWith('image/');
        } catch {
            try {
                const response = await axios.get(url, {
                    headers: { ...requestHeaders, Range: 'bytes=0-0' },
                    timeout: 5_000,
                    responseType: 'arraybuffer',
                    validateStatus: (status) => status >= 200 && status < 400,
                });
                const contentType = String(response.headers?.['content-type'] || '').toLowerCase();
                return contentType.startsWith('image/');
            } catch {
                return false;
            }
        }
    }

    private async getAnimetsuEpisodeThumbnails(show: AllMangaShow | null | undefined): Promise<Map<number, string>> {
        const title = String(show?.englishName || show?.name || '').trim();
        if (!title) return new Map();

        try {
            const searchUrl = `${ANIMETSU_API_URL}/search`;
            const search = await axios.get<{ results?: AnimetsuSearchResult[] }>(searchUrl, {
                params: { query: title },
                headers: animetsuHeaders,
                timeout: 8_000,
            });
            const candidates = Array.isArray(search.data?.results) ? search.data.results : [];
            const best = candidates
                .map((candidate) => ({ candidate, score: this.scoreAnimetsuCandidate(show, candidate) }))
                .filter((entry) => entry.score > 0 && entry.candidate?.id)
                .sort((a, b) => b.score - a.score)[0]?.candidate;
            if (!best?.id) return new Map();

            const episodes = await axios.get<AnimetsuEpisode[]>(`${ANIMETSU_API_URL}/eps/${best.id}`, {
                headers: animetsuHeaders,
                timeout: 8_000,
            });
            const thumbnailMap = new Map<number, string>();
            (Array.isArray(episodes.data) ? episodes.data : []).forEach((episode) => {
                const episodeNumber = Number(episode?.ep_num || 0);
                const image = this.normalizeAnimetsuImage(episode?.img);
                if (Number.isFinite(episodeNumber) && episodeNumber > 0 && image) {
                    thumbnailMap.set(episodeNumber, image);
                }
            });
            return thumbnailMap;
        } catch (error) {
            console.warn(`[AllManga] Failed to fetch Animetsu episode thumbnails for "${title}"`, error);
            return new Map();
        }
    }

    private async getTmdbEpisodeThumbnails(show: AllMangaShow | null | undefined, totalEpisodes: number): Promise<Map<number, string>> {
        if (!show) return new Map();
        const title = String(show.englishName || show.name || '').trim();
        if (!title) return new Map();

        const year = show.season?.year;
        const target = await tmdbService.resolveMediaTarget({ title, year: year ? String(year) : undefined });
        if (!target || target.mediaType !== 'tv') return new Map();

        let searchTitle = title;
        let seasonNumber = await tmdbService.resolveSeasonByTitle(target.tmdbId, searchTitle);
        
        if (!seasonNumber) {
            const match = searchTitle.match(/season\s*(\d+)|(\d+)(st|nd|rd|th)\s*season/i) || searchTitle.match(/(?:^|\s)([2-9])$/i);
            seasonNumber = match ? parseInt(match[1] || match[2] || match[3]) || 1 : 1;
        }

        return tmdbService.resolveTvEpisodeThumbnails(target.tmdbId, { seasonNumber, fetchAllSeasons: totalEpisodes > 100 });
    }

    private sanitizeTitle(value: string) {
        return value
            .replace(/[''`´]/g, '')
            .replace(/[:!.]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    private candidateTitles(title: string) {
        const candidates = new Set<string>();
        const add = (value: string) => {
            const normalized = String(value || '').replace(/\s+/g, ' ').trim();
            if (normalized) candidates.add(normalized);
        };
        add(title);
        add(this.sanitizeTitle(title));
        add(title.replace(/\bseason\s+\d+\b/ig, '').trim());
        add(title.replace(/\b\d+(st|nd|rd|th)\s+season\b/ig, '').trim());
        return [...candidates].filter(Boolean).slice(0, 5);
    }

    private async search(query: string, translationType: TranslationType): Promise<AllMangaShow[]> {
        const payload = await this.gql<{ data?: { shows?: { edges?: AllMangaShow[] } } }>({
            search: {
                allowAdult: true,
                allowUnknown: false,
                query: query.toLowerCase(),
            },
            limit: 40,
            page: 1,
            translationType,
            countryOrigin: 'ALL',
        }, SEARCH_GQL);

        return Array.isArray(payload?.data?.shows?.edges) ? payload.data.shows.edges : [];
    }

    async searchAnime(query: string): Promise<Array<AnimeSearchResult & Record<string, unknown>>> {
        const cleanQuery = String(query || '').trim();
        if (!cleanQuery) return [];

        const showMap = new Map<string, AllMangaShow>();
        for (const candidate of this.candidateTitles(cleanQuery)) {
            const [subShows, dubShows] = await Promise.all([
                this.search(candidate, 'sub').catch(() => []),
                this.search(candidate, 'dub').catch(() => []),
            ]);
            [...subShows, ...dubShows].forEach((show) => {
                const showId = String(show?._id || '').trim();
                if (showId && !showMap.has(showId)) showMap.set(showId, show);
            });
        }

        return [...showMap.values()]
            .map((show) => ({
                show,
                mapped: this.mapShowToAnime(show),
                score: Math.max(
                    this.scoreShow(cleanQuery, show, 'sub', 1),
                    this.scoreShow(cleanQuery, show, 'dub', 1)
                ),
            }))
            .filter((entry) => entry.mapped && entry.score > 0)
            .sort((a, b) => b.score - a.score)
            .map((entry) => entry.mapped as AnimeSearchResult & Record<string, unknown>);
    }

    private absoluteAssetUrl(value: unknown) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        if (/^https?:\/\//i.test(raw)) return raw;
        if (raw.startsWith('//')) return `https:${raw}`;
        return `https://wp.youtube-anime.com/aln.youtube-anime.com/${raw.replace(/^\/+/, '')}`;
    }

    private formatDuration(seconds: unknown) {
        const value = Number(seconds || 0);
        if (!Number.isFinite(value) || value <= 0) return undefined;
        const minutes = Math.max(1, Math.round(value / 60));
        return `${minutes} min`;
    }

    private pickLatestEpisode(show: AllMangaShow, audio: TranslationType = 'sub') {
        const infoEpisode = Number(show.lastEpisodeInfo?.[audio]?.episodeString || 0);
        if (infoEpisode > 0) return infoEpisode;
        return Number(show.availableEpisodes?.[audio] || 0) || undefined;
    }

    private mapShowToAnime(show: AllMangaShow): AnimeSearchResult & Record<string, unknown> | null {
        const showId = String(show._id || '').trim();
        const title = String(show.englishName || show.name || '').trim();
        if (!showId || !title) return null;

        const latestEpisode = this.pickLatestEpisode(show, 'sub') || this.pickLatestEpisode(show, 'dub');
        const poster = this.absoluteAssetUrl(show.thumbnail);
        const score = Number(show.score || show.averageScore ? (show.score || Number(show.averageScore) / 10) : 0);
        const year = Number(show.season?.year || 0) || undefined;

        return {
            id: AllMangaScraper.toSession(showId),
            session: AllMangaScraper.toSession(showId),
            scraperId: AllMangaScraper.toSession(showId),
            title,
            jname: show.name,
            url: `/anime/${AllMangaScraper.toSession(showId)}`,
            poster,
            image: poster,
            banner: this.absoluteAssetUrl(show.banner),
            status: show.status || 'Unknown',
            type: show.type || 'TV',
            episodes: Number(show.episodeCount || latestEpisode || 0) || undefined,
            latestEpisode,
            sub: Number(show.availableEpisodes?.sub || 0) || undefined,
            dub: Number(show.availableEpisodes?.dub || 0) || undefined,
            year: year ? String(year) : undefined,
            score: Number.isFinite(score) && score > 0 ? String(score) : undefined,
            source: 'allmanga',
            allMangaId: showId,
            genres: Array.isArray(show.genres) ? show.genres : [],
            season: show.season,
            latestTimestamp: Number(show.lastEpisodeTimestamp?.sub || show.lastEpisodeTimestamp?.dub || 0) || undefined,
        };
    }

    private mapEpisodeInfo(showId: string, info: AllMangaEpisodeInfo, fallbackSnapshot?: string, preferredSnapshot?: string): Episode | null {
        const episodeNumber = Number(info.episodeIdNum || 0);
        if (!Number.isFinite(episodeNumber) || episodeNumber <= 0) return null;

        const thumbnail = (Array.isArray(info.thumbnails) ? info.thumbnails : [])
            .map((url) => this.absoluteAssetUrl(url))
            .find(Boolean);
        const duration = this.formatDuration(info.vidInforssub?.vidDuration || info.vidInforsdub?.vidDuration);

        return {
            id: `${AllMangaScraper.toSession(showId)}?ep=${episodeNumber}`,
            session: `${AllMangaScraper.toSession(showId)}?ep=${episodeNumber}`,
            episodeNumber,
            url: `/watch/${AllMangaScraper.toSession(showId)}?ep=${episodeNumber}`,
            title: info.notes || undefined,
            duration,
            snapshot: preferredSnapshot || thumbnail,
            isSubbed: Boolean(info.vidInforssub),
            isDubbed: Boolean(info.vidInforsdub),
        };
    }

    private scoreShow(query: string, show: AllMangaShow, translationType: TranslationType, episodeNumber: number, year?: number) {
        const target = this.normalizeTitle(query);
        const titles = [
            show.name,
            show.englishName,
        ].map((value) => this.normalizeTitle(value)).filter(Boolean);
        if (!target || titles.length === 0) return 0;
        let score = 0;
        let exactMatch = false;
        for (const title of titles) {
            if (target === title) {
                exactMatch = true;
                score = Math.max(score, 150);
            } else if (target === 'onepiece' && title === '1p') {
                exactMatch = true;
                score = Math.max(score, 148);
            }
            else if (title.startsWith(target) || target.startsWith(title)) score = Math.max(score, 105);
            else if (title.includes(target) || target.includes(title)) score = Math.max(score, 70);
        }
        if (score <= 0) return 0;

        const rawTitle = String(show.englishName || show.name || '');
        const rawType = String(show.type || '');
        const isSpecial = /\b(movie|special|recap|ova|ona)\b/i.test(rawTitle) || /\b(movie|special|ova|ona)\b/i.test(rawType);
        const asksSpecial = /\b(movie|special|recap|ova|ona)\b/i.test(query);
        if (isSpecial && !asksSpecial) score -= 220;

        // Year-based scoring: strongly prefer shows from the same year
        if (year && year > 0) {
            const showYear = Number(show.season?.year || 0);
            if (showYear > 0) {
                if (showYear === year) score += 50;
                else if (Math.abs(showYear - year) === 1) score += 10;
                else score -= 60; // Wrong year → likely wrong season
            }
        }

        const availableEpisodes = Number(show.availableEpisodes?.[translationType] || 0);
        if (episodeNumber > 0 && availableEpisodes >= episodeNumber) score += 30;
        if (!asksSpecial && !exactMatch && availableEpisodes <= 1) score -= 120;
        if (availableEpisodes > 1) score += Math.min(25, Math.floor(availableEpisodes / 50));
        return score;
    }

    private async resolveShow(title: string, translationType: TranslationType, episodeNumber: number, year?: number) {
        for (const candidate of this.candidateTitles(title)) {
            const shows = await this.search(candidate, translationType);
            const ranked = shows
                .filter((show) => show?._id)
                .map((show) => ({ show, score: this.scoreShow(candidate, show, translationType, episodeNumber, year) }))
                .sort((a, b) => b.score - a.score);
            const best = ranked.find((entry) => entry.score > 0)?.show;
            if (best?._id) return best;
        }
        return null;
    }

    private async getShowById(showId: string): Promise<AllMangaShow | null> {
        const payload = await this.gql<{ data?: { show?: AllMangaShow } }>({ _id: showId }, `query($_id:String!){show(_id:$_id){_id name englishName thumbnail banner type status score averageScore season availableEpisodes lastEpisodeInfo episodeCount genres}}`);
        return payload?.data?.show || null;
    }

    private async getEpisodeSources(showId: string, episodeNumber: number, translationType: TranslationType) {
        const base = Number.isInteger(episodeNumber) ? String(episodeNumber) : String(episodeNumber);
        const candidates = base.includes('.') ? [base] : [base, `${base}.0`];

        for (const episodeString of candidates) {
            const payload = await this.episodeGql({
                showId,
                translationType,
                episodeString,
            });
            const sources = await this.parseEpisodeSources(payload);
            if (sources.length > 0) return sources;
        }
        return [];
    }

    private normalizeClockUrl(path: string) {
        if (path.startsWith('//')) return `https:${path}`;
        if (path.startsWith('/')) return `https://allanime.day${path}`;
        if (/^https?:\/\//i.test(path)) return path;
        return `https://allanime.day/${path}`;
    }

    private extractThumbnails(url: string): ThumbnailInfo | undefined {
        const hostname = new URL(url).hostname.toLowerCase();
        
        // Vidsrc / Vidembed / Megacloud / etc.
        if (hostname.includes('vidsrc') || hostname.includes('vidembed') || hostname.includes('megacloud')) {
            const match = url.match(/\/embed\/([^/?]+)/);
            if (match) {
                const id = match[1];
                return {
                    spriteUrl: `https://${hostname}/sprite/${id}.webp`,
                    spriteGrid: { columns: 10, rows: 10 },
                    interval: 10,
                };
            }
        }
        
        // Kwik
        if (hostname.includes('kwik')) {
            const match = url.match(/\/([a-zA-Z0-9]+)(?:\/|$)/);
            if (match) {
                const id = match[1];
                return {
                    thumbnailUrl: `https://${hostname}/${id}/thumbnail.jpg`,
                };
            }
        }
        
        // Streamsb / Streamtape / etc.
        if (hostname.includes('streamsb') || hostname.includes('streamtape')) {
            const match = url.match(/\/([a-zA-Z0-9]+)(?:\/|$)/);
            if (match) {
                const id = match[1];
                return {
                    thumbnailUrl: `https://${hostname}/thumbnail/${id}.jpg`,
                };
            }
        }
        
        // Ok.ru
        if (hostname.includes('ok.ru')) {
            const match = url.match(/videoembed\/([0-9]+)/);
            if (match) {
                const id = match[1];
                return {
                    thumbnailUrl: `https://ok.ru/videoembed/${id}`,
                };
            }
        }
        
        // Mp4upload
        if (hostname.includes('mp4upload')) {
            const match = url.match(/\/([a-zA-Z0-9]+)(?:\/|$)/);
            if (match) {
                const id = match[1];
                return {
                    thumbnailUrl: `https://${hostname}/thumbnail/${id}.jpg`,
                };
            }
        }
        
        return undefined;
    }

    private sourceProviderRank(source: AllMangaSource) {
        const name = String(source.sourceName || '').trim().toLowerCase();
        if (name === 'default') return 0;
        if (name === 'yt-mp4' || name === 'yt') return 1;
        if (name === 's-mp4' || name === 'sharepoint') return 2;
        if (name === 'mp4' || name === 'mp4upload') return 3;
        return 99;
    }

    private orderEpisodeSources(sources: AllMangaSource[]) {
        return sources
            .filter((source) => source?.sourceUrl)
            .sort((a, b) => {
                const rankDiff = this.sourceProviderRank(a) - this.sourceProviderRank(b);
                if (rankDiff !== 0) return rankDiff;
                const aEncoded = String(a.sourceUrl || '').startsWith('--') ? 1 : 0;
                const bEncoded = String(b.sourceUrl || '').startsWith('--') ? 1 : 0;
                return (bEncoded - aEncoded) || (Number(b.priority || 0) - Number(a.priority || 0));
            });
    }

    private async resolveSource(source: AllMangaSource, audio: TranslationType): Promise<StreamLink[]> {
        const sourceUrl = String(source.sourceUrl || '');
        if (!sourceUrl) return [];

        if (/^https?:\/\//i.test(sourceUrl) && !/\/clock(?:\.json)?(?:[?#]|$)/i.test(sourceUrl)) {
            const server = String(source.sourceName || 'allmanga');
            let finalUrl = sourceUrl;
            let isIframe = /ok\.ru|streamsb|mp4upload|embed|\/e\//i.test(sourceUrl);
            let isHls = /\.m3u8(?:[?#]|$)/i.test(sourceUrl);
            const isDirectMedia = isHls || /\.(mp4|webm|mkv)(?:[?#]|$)/i.test(sourceUrl);
            const isExtractableIframe = /ok\.ru|vk\.com/i.test(sourceUrl);
            const isAniCliProvider = this.sourceProviderRank(source) < 99;

            if (!isDirectMedia && !isExtractableIframe && !isAniCliProvider) {
                return [];
            }

            // Attempt to extract native HLS for reliable iframes using yt-dlp
            if (isExtractableIframe) {
                try {
                    const { extractNativeHlsWithYtDlp } = require('../utils/ytdlp');
                    const extracted = await extractNativeHlsWithYtDlp(sourceUrl);
                    if (extracted) {
                        finalUrl = extracted;
                        isHls = /\.m3u8(?:[?#]|$)/i.test(extracted);
                        isIframe = false;
                    }
                } catch (error) {
                    console.warn(`[allmanga] yt-dlp extraction failed for ${sourceUrl}`);
                }
            }

            if (isIframe && !isDirectMedia) return [];

            return [{
                quality: '1080',
                audio,
                provider: 'allmanga',
                server,
                url: finalUrl,
                directUrl: isIframe ? undefined : finalUrl,
                isHls,
                referer: STREAM_REFERER,
                thumbnails: this.extractThumbnails(sourceUrl),
            }];
        }

        if (!sourceUrl.startsWith('--')) return [];

        const decodedPath = this.decodeUrl(sourceUrl).replace('/clock', '/clock.json');
        const fetchUrl = this.normalizeClockUrl(decodedPath);

        try {
            const sourceName = String(source.sourceName || 'allmanga');
            if (/fast4speed\.rsvp/i.test(fetchUrl) || /^yt-mp4$/i.test(sourceName)) {
                const finalUrl = await this.followRedirects(fetchUrl);
                if (!finalUrl) return [];
                return [{
                    quality: '1080',
                    audio,
                    provider: 'allmanga',
                    server: sourceName,
                    url: finalUrl,
                    directUrl: finalUrl,
                    isHls: /\.m3u8(?:[?#]|$)/i.test(finalUrl),
                    referer: /(^|\.)googlevideo\.com$/i.test(new URL(finalUrl).hostname) ? 'https://www.youtube.com' : STREAM_REFERER,
                    thumbnails: this.extractThumbnails(finalUrl),
                }];
            }

            const response = await axios.get<{ links?: ClockLink[] }>(fetchUrl, {
                timeout: 12_000,
                headers: requestHeaders,
                maxRedirects: 5,
            });
            const links = Array.isArray(response.data?.links) ? response.data.links : [];
            return links
                .filter((link) => link?.link)
                .filter((link) => !String(link.link || '').includes('sk.json'))
                .sort((a, b) => (parseInt(String(b.resolutionStr || ''), 10) || 0) - (parseInt(String(a.resolutionStr || ''), 10) || 0))
                .map((link) => {
                    const url = String(link.link || '');
                    return {
                        quality: String(link.resolutionStr || '').replace(/[^\d]/g, '') || '1080',
                        audio,
                        provider: 'allmanga',
                        server: sourceName,
                        url,
                        directUrl: url,
                        isHls: /\.m3u8(?:[?#]|$)/i.test(url),
                        referer: STREAM_REFERER,
                        thumbnails: this.extractThumbnails(url),
                    };
                });
        } catch {
            return [];
        }
    }

    private async followRedirects(url: string, maxHops = 10): Promise<string | null> {
        let current = url;
        for (let hop = 0; hop < maxHops; hop += 1) {
            try {
                const response = await axios.get(current, {
                    timeout: 12_000,
                    headers: requestHeaders,
                    maxRedirects: 0,
                    responseType: 'stream',
                    validateStatus: (status) => status >= 200 && status < 400,
                });
                response.data?.destroy?.();
                const location = response.headers?.location;
                if (response.status >= 300 && response.status < 400 && location) {
                    current = new URL(location, current).href;
                    continue;
                }
                return current;
            } catch (error: any) {
                const status = Number(error?.response?.status || 0);
                const location = error?.response?.headers?.location;
                error?.response?.data?.destroy?.();
                if (status >= 300 && status < 400 && location) {
                    current = new URL(location, current).href;
                    continue;
                }
                return null;
            }
        }
        return current;
    }

    async getLinksForEpisodeNumber(title: string, episodeNumber: number, year?: number): Promise<StreamLink[]> {
        const cleanTitle = String(title || '').trim();
        if (!cleanTitle || !Number.isFinite(episodeNumber) || episodeNumber <= 0) return [];

        const allLinks: StreamLink[] = [];
        const audios: readonly TranslationType[] = ['sub', 'dub'];
        await Promise.all(audios.map(async (audio) => {
            const show = await this.resolveShow(cleanTitle, audio, episodeNumber, year);
            if (!show?._id) return;

            const sources = await this.getEpisodeSources(show._id, episodeNumber, audio);
            const orderedSources = this.orderEpisodeSources(sources);

            const resolvedLinksArrays = await Promise.all(
                orderedSources.map(source => this.resolveSource(source, audio).catch(() => []))
            );
            
            for (const links of resolvedLinksArrays) {
                allLinks.push(...links);
            }
        }));

        const seen = new Set<string>();
        return allLinks.filter((link) => {
            const key = `${link.audio}:${link.quality}:${link.url}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    async getLinksForShowId(showId: string, episodeNumber: number, title?: string, year?: number): Promise<StreamLink[]> {
        if (!showId || !Number.isFinite(episodeNumber) || episodeNumber <= 0) return [];

        const allLinks: StreamLink[] = [];
        const audios: readonly TranslationType[] = ['sub', 'dub'];
        
        await Promise.all(audios.map(async (audio) => {
            let sources = await this.getEpisodeSources(showId, episodeNumber, audio);
            
            // Fallback to title search if the current showId doesn't have this audio track (common for sub/dub split shows)
            if (sources.length === 0 && title) {
                const cleanTitle = String(title || '').trim();
                if (cleanTitle) {
                    const altShow = await this.resolveShow(cleanTitle, audio, episodeNumber, year);
                    if (altShow?._id && altShow._id !== showId) {
                        sources = await this.getEpisodeSources(altShow._id, episodeNumber, audio);
                    }
                }
            }

            const orderedSources = this.orderEpisodeSources(sources);

            const resolvedLinksArrays = await Promise.all(
                orderedSources.map(source => this.resolveSource(source, audio).catch(() => []))
            );
            
            for (const links of resolvedLinksArrays) {
                allLinks.push(...links);
            }
        }));

        const seen = new Set<string>();
        return allLinks.filter((link) => {
            const key = `${link.audio}:${link.quality}:${link.url}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    private async fetchLatestUpdatesPage(page: number, limit: number) {
        const safePage = Math.max(1, Math.floor(Number(page) || 1));
        const safeLimit = Math.max(1, Math.floor(Number(limit) || 18));
        const payload = await this.gql<{ data?: { shows?: { edges?: AllMangaShow[]; pageInfo?: any } } }>({
            search: {
                sortBy: 'Latest_Update',
                sortDirection: 'DSC',
                allowAdult: true,
                allowUnknown: false,
            },
            limit: safeLimit,
            page: safePage,
            translationType: 'sub',
            countryOrigin: 'ALL',
        }, LATEST_UPDATES_GQL);

        const edges = Array.isArray(payload?.data?.shows?.edges) ? payload.data.shows.edges : [];
        const pageInfo = payload?.data?.shows?.pageInfo || {};

        return { edges, pageInfo };
    }

    private async filterLatestUpdatesWithImages(shows: AllMangaShow[]) {
        const mappedData = shows
            .map((show) => this.mapShowToAnime(show))
            .filter((item): item is AnimeSearchResult & Record<string, unknown> => Boolean(item?.poster || item?.image || item?.banner));
        const obviousValid = mappedData.filter((item) => !this.isLikelyDeadImageUrl(item?.poster || item?.image || item?.banner));
        const needsValidation = mappedData.filter((item) => this.isLikelyDeadImageUrl(item?.poster || item?.image || item?.banner));
        const validation = await Promise.all(needsValidation.map(async (item) => ({
            item,
            hasReachableImage: await this.isReachableImageUrl(item?.poster || item?.image || item?.banner),
        })));

        return [
            ...obviousValid,
            ...validation
                .filter((entry) => entry.hasReachableImage)
                .map((entry) => entry.item),
        ];
    }

    async getLatestUpdates(page: number = 1, limit: number = 18) {
        const safePage = Math.max(1, Math.floor(Number(page) || 1));
        const safeLimit = Math.max(1, Math.floor(Number(limit) || 18));
        const rawLimit = Math.max(40, safeLimit * 3);
        const filteredItems: Array<AnimeSearchResult & Record<string, unknown>> = [];
        let currentRawPage = safePage;
        let latestPageInfo: any = {};
        let totalResults = 0;
        let hasNextPage = true;
        let scannedPages = 0;

        while (filteredItems.length < safeLimit && hasNextPage && scannedPages < 4) {
            const { edges, pageInfo } = await this.fetchLatestUpdatesPage(currentRawPage, rawLimit);
            latestPageInfo = pageInfo;
            totalResults = totalResults || Number(pageInfo?.total || 0);
            if (edges.length === 0) break;

            const validItems = await this.filterLatestUpdatesWithImages(edges);
            filteredItems.push(...validItems);
            currentRawPage += 1;
            scannedPages += 1;
            hasNextPage = pageInfo?.hasNextPage === false ? false : true;
        }

        const data = filteredItems.slice(0, safeLimit);
        const estimatedLastPage = Math.max(
            safePage,
            totalResults
                ? Math.ceil(totalResults / safeLimit)
                : Number(latestPageInfo.totalPages || 0)
                ? Math.ceil((Number(latestPageInfo.totalPages || 1) * rawLimit) / safeLimit)
                : safePage + (hasNextPage ? 1 : 0)
        );

        return {
            data,
            pagination: {
                current_page: safePage,
                last_visible_page: estimatedLastPage,
                has_next_page: data.length >= safeLimit || hasNextPage,
            },
        };
    }

    async getAnimeInfo(sessionOrShowId: string) {
        const showId = AllMangaScraper.fromSession(sessionOrShowId) || String(sessionOrShowId || '').trim();
        if (!showId) return null;
        const show = await this.getShowById(showId);
        return show ? this.mapShowToAnime(show) : null;
    }

    async getEpisodes(sessionOrShowId: string): Promise<{ episodes: Episode[]; lastPage: number }> {
        const showId = AllMangaScraper.fromSession(sessionOrShowId) || String(sessionOrShowId || '').trim();
        if (!showId) return { episodes: [], lastPage: 1 };

        const show = await this.getShowById(showId);
        const fallbackSnapshot = this.absoluteAssetUrl(show?.banner) || this.absoluteAssetUrl(show?.thumbnail);
        const total = Math.max(
            Number(show?.availableEpisodes?.sub || 0),
            Number(show?.availableEpisodes?.dub || 0),
            Number(show?.episodeCount || 0),
            1
        );

        const animetsuThumbnailsPromise = this.getAnimetsuEpisodeThumbnails(show);
        const tmdbThumbnailsPromise = this.getTmdbEpisodeThumbnails(show, total);
        
        const infos: AllMangaEpisodeInfo[] = [];
        const maxEp = Math.max(total, 500);
        const chunkSize = 500;
        const tasks = [];
        for (let start = 0; start <= maxEp; start += chunkSize) {
            const end = start + chunkSize - 1;
            tasks.push(() =>
                this.gql<{ data?: { episodeInfos?: AllMangaEpisodeInfo[] } }>({
                    showId,
                    episodeNumStart: start,
                    episodeNumEnd: end,
                }, EPISODE_INFOS_GQL)
            );
        }
        
        // Execute in batches of 5 to avoid triggering rate limits
        for (let i = 0; i < tasks.length; i += 5) {
            const batch = await Promise.all(tasks.slice(i, i + 5).map(task => task()));
            for (const payload of batch) {
                const chunk = Array.isArray(payload?.data?.episodeInfos) ? payload.data.episodeInfos : [];
                infos.push(...chunk);
            }
        }

        const [animetsuThumbnails, tmdbThumbnails] = await Promise.all([
            animetsuThumbnailsPromise,
            tmdbThumbnailsPromise
        ]);

        const episodesMap = new Map<number, Episode>();
        for (const info of infos) {
            const epNum = Number(info.episodeIdNum || 0);
            if (!epNum || epNum <= 0) continue;
            const tmdbThumb = tmdbThumbnails.get(epNum);
            const aniThumb = animetsuThumbnails.get(epNum);
            const preferredThumb = tmdbThumb || aniThumb;
            const mapped = this.mapEpisodeInfo(showId, info, fallbackSnapshot, preferredThumb);
            if (!mapped) continue;

            const existing = episodesMap.get(epNum);
            if (!existing) {
                episodesMap.set(epNum, mapped);
            } else {
                existing.isSubbed = existing.isSubbed || mapped.isSubbed;
                existing.isDubbed = existing.isDubbed || mapped.isDubbed;
                if (!existing.snapshot && mapped.snapshot) existing.snapshot = mapped.snapshot;
            }
        }

        const episodes = Array.from(episodesMap.values())
            .sort((a, b) => Number(a.episodeNumber) - Number(b.episodeNumber));

        return {
            episodes,
            lastPage: 1,
        };
    }
}

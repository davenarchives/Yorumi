import axios from 'axios';
import { exec, execFile } from 'child_process';
import util from 'util';
const execPromise = util.promisify(exec);
const execFileAsync = util.promisify(execFile);
import { AllMangaScraper } from '../../scraper/allmanga';
import { AniNekoScraper } from '../../scraper/anineko';
import { AnikotoScraper } from '../../scraper/anikoto';
import { cacheGet, cacheSet } from '../../utils/redis-cache';
import { logger } from '../../core/logger';
import { streambertAnimeService } from './anime.service';
import { tmdbService } from '../scraper/tmdb.service';
import * as cheerio from 'cheerio';

export type SubtitleTrack = { lang: string; url: string };
export type StreamResponse = {
    m3u8: string;
    dubM3u8?: string;
    subtitles: SubtitleTrack[];
    source: string;
    episode: number;
    title?: string;
    duration?: number;
    referer?: string;
    dubReferer?: string;
    isEmbed?: boolean;
    dubIsEmbed?: boolean;
    variants?: Array<{ quality: string; url: string }>;
    dubVariants?: Array<{ quality: string; url: string }>;
};

export type VideoSource = {
    id: string;
    getStream(anilistId: number, episode: number, options?: { title?: string, tmdbId?: number, format?: string, anilistId?: number }): Promise<StreamResponse | null>;
};

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0';
const STREAM_TTL_SECONDS = 5 * 60; // 5 minutes — short TTL prevents stale wrong-episode links

function absoluteUrl(url: string, baseUrl: string) {
    if (/^https?:\/\//i.test(url)) return url;
    return new URL(url, baseUrl).href;
}

function extractSubtitles(html: string, baseUrl: string): SubtitleTrack[] {
    const subtitles: SubtitleTrack[] = [];
    const seen = new Set<string>();
    const pattern = /["']([^"']+\.vtt[^"']*)["']/gi;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html))) {
        const url = absoluteUrl(match[1], baseUrl);
        if (seen.has(url)) continue;
        seen.add(url);
        const langMatch = url.match(/(?:^|[._/-])([a-z]{2})(?:[._/-]|\.vtt|\?)/i);
        subtitles.push({ lang: langMatch?.[1]?.toLowerCase() || 'und', url });
    }
    return subtitles;
}

async function getEpisodeTitle(anilistId: number, episode: number) {
    const details = await streambertAnimeService.getEpisodes(anilistId).catch(() => null);
    const match = details?.episodes?.find((item: any) => Number(item?.episode) === episode);
    return match?.title;
}

async function resolveTmdbInfo(targetId: number, episode: number, options?: { title?: string; tmdbId?: number; format?: string; anilistId?: number }) {
    let tmdbId = options?.tmdbId;
    let format = options?.format;
    const anilistId = options?.anilistId || (options?.tmdbId ? undefined : (targetId > 0 ? targetId : undefined));

    if (!tmdbId && anilistId) {
        tmdbId = await tmdbService.resolveTmdbIdFromAniZip(anilistId).catch(() => undefined) || undefined;
    }

    if (tmdbId) {
        const meta = await streambertAnimeService.getMetadata(tmdbId, format).catch(() => null);
        format = meta?.format || format;
    } else if (options?.title || anilistId) {
        const target = await tmdbService.resolveMediaTarget({ title: options?.title, format, anilistId }).catch(() => null);
        if (target?.tmdbId) {
            tmdbId = target.tmdbId;
            format = target.mediaType === 'movie' ? 'MOVIE' : target.mediaType === 'tv' ? 'TV' : format;
        }
    }

    if (!tmdbId) {
        return { tmdbId: null, isMovie: false, seasonNumber: 1, relativeEpisode: episode };
    }

    const isMovie = format === 'MOVIE';
    let seasonNumber = 1;
    let relativeEpisode = episode;
    if (!isMovie && tmdbId) {
        const resolved = await tmdbService.resolveAbsoluteEpisode(tmdbId, episode).catch(() => null);
        if (resolved) {
            seasonNumber = resolved.seasonNumber;
            relativeEpisode = resolved.relativeEpisode;
        }
    }
    return { tmdbId, isMovie, seasonNumber, relativeEpisode };
}

class VideasySource implements VideoSource {
    id = 'videasy';

    async getStream(anilistId: number, episode: number, options?: { title?: string, tmdbId?: number, format?: string, anilistId?: number }): Promise<StreamResponse | null> {
        const baseUrl = String(process.env.VIDEASY_BASE_URL || 'https://player.videasy.to').replace(/\/+$/, '');
        const { tmdbId, isMovie, seasonNumber, relativeEpisode } = await resolveTmdbInfo(anilistId, episode, options);
        if (!tmdbId) return null;

        const playerUrl = isMovie
            ? `${baseUrl}/movie/${tmdbId}`
            : `${baseUrl}/tv/${tmdbId}/${seasonNumber}/${relativeEpisode}`;
        
        try {
            const response = await axios.get<string>(playerUrl, {
                headers: {
                    'User-Agent': USER_AGENT,
                    Referer: 'https://videasy.to',
                    Accept: 'text/html,application/xhtml+xml',
                },
                timeout: 15_000,
            });
            const html = String(response.data || '');
            const match = html.match(/(?:file|src)\s*[:=]\s*["']([^"']+\.m3u8[^"']*)["']/i);
            
            if (match?.[1]) {
                const m3u8Url = absoluteUrl(match[1], baseUrl);
                return {
                    m3u8: `/api/scraper/proxy?url=${encodeURIComponent(m3u8Url)}&referer=${encodeURIComponent(baseUrl)}`,
                    subtitles: extractSubtitles(html, baseUrl),
                    source: this.id,
                    episode,
                    title: await getEpisodeTitle(anilistId, episode),
                    referer: baseUrl,
                };
            }
        } catch (error) {
            // Ignore extraction errors and fallback to iframe
        }

        return {
            m3u8: playerUrl,
            subtitles: [],
            source: this.id,
            episode,
            title: await getEpisodeTitle(anilistId, episode),
            referer: baseUrl,
        };
    }
}

class EmbedSource implements VideoSource {
    constructor(public id: string, private baseUrl: string) {}

    async getStream(targetId: number, episode: number, options?: { title?: string, tmdbId?: number, format?: string, anilistId?: number }): Promise<StreamResponse | null> {
        const cleanBase = this.baseUrl.replace(/\/+$/, '');
        const { tmdbId, isMovie, seasonNumber, relativeEpisode } = await resolveTmdbInfo(targetId, episode, options);
        if (!tmdbId) return null;

        let playerUrl = isMovie
            ? `${cleanBase}/embed/movie/${tmdbId}`
            : `${cleanBase}/embed/tv/${tmdbId}/${seasonNumber}/${relativeEpisode}`;

        const effectiveAnilistId = options?.anilistId || (options?.tmdbId ? undefined : (targetId > 0 ? targetId : undefined));

        if (this.id === 'vidsrc' || this.id === 'vidking') {
            return {
                m3u8: playerUrl,
                subtitles: [],
                source: this.id,
                episode,
                title: effectiveAnilistId ? await getEpisodeTitle(effectiveAnilistId, episode).catch(() => undefined) : undefined,
                referer: this.baseUrl,
            };
        }

        try {
            const response = await axios.get<string>(playerUrl, {
                headers: {
                    'User-Agent': USER_AGENT,
                    Referer: this.baseUrl,
                },
                timeout: 15_000,
            });
            const html = String(response.data || '');
            const match = html.match(/(?:file|src)\s*[:=]\s*["']([^"']+\.m3u8[^"']*)["']/i);
            
            if (match?.[1]) {
                return {
                    m3u8: absoluteUrl(match[1], this.baseUrl),
                    subtitles: extractSubtitles(html, this.baseUrl),
                    source: this.id,
                    episode,
                    title: effectiveAnilistId ? await getEpisodeTitle(effectiveAnilistId, episode) : undefined,
                    referer: this.baseUrl,
                };
            }
        } catch (error) {
            // Ignore extraction errors and fallback to iframe
        }

        return {
            m3u8: playerUrl,
            subtitles: [],
            source: this.id,
            episode,
            title: effectiveAnilistId ? await getEpisodeTitle(effectiveAnilistId, episode) : undefined,
            referer: this.baseUrl,
        };
    }
}

class AllMangaSource implements VideoSource {
    id = 'allmanga';
    private scraper = new AllMangaScraper();

    async getStream(anilistId: number, episode: number, options?: { title?: string, tmdbId?: number }): Promise<StreamResponse | null> {
        const metadata = options?.tmdbId ? await streambertAnimeService.getMetadata(options.tmdbId) : null;
        const title = options?.title || metadata?.title?.english || metadata?.title?.romaji || metadata?.title?.native;
        if (!title) return null;

        const links = await this.scraper.getLinksForEpisodeNumber(title, episode);
        const best = links
            .filter((link) => {
                const u = link?.directUrl || link?.url || '';
                return u && !/streamsb|sbvideo|sbfull|sbspeed|sbfast|streamtape|embedsito/i.test(u);
            })
            .sort((a, b) => {
                const directA = a.directUrl ? 100_000 : 0;
                const directB = b.directUrl ? 100_000 : 0;
                const qualityA = Number(String(a.quality || '').replace(/[^\d]/g, '')) || 0;
                const qualityB = Number(String(b.quality || '').replace(/[^\d]/g, '')) || 0;
                const subA = String(a.audio || '').toLowerCase() === 'sub' ? 10_000 : 0;
                const subB = String(b.audio || '').toLowerCase() === 'sub' ? 10_000 : 0;
                return (directB + subB + qualityB) - (directA + subA + qualityA);
            })[0];
        const url = best?.directUrl || best?.url;
        if (!url) return null;

        return {
            m3u8: url,
            subtitles: best.subtitles || [],
            source: this.id,
            episode,
            title: await getEpisodeTitle(anilistId, episode),
            referer: best.referer || 'https://allmanga.to',
        };
    }
}

class AniDBSource implements VideoSource {
    id = 'anidb';

    private cleanSearchQuery(query: string): string {
        return String(query || '')
            .toLowerCase()
            .replace(/\b(season|part|cour|nd|rd|th|st)\s*\d+\b/gi, ' ')
            .replace(/[^a-z0-9\s]/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Parse anime slug/ID from the anidb.app suggestions HTML.
     * Suggestions return HTML like:
     *   <a href="https://anidb.app/anime/naruto-3686" ...>
     *     <img ... alt="Naruto" ...>
     *     <p class="...">Naruto</p>
     *   </a>
     *
     * We extract the numeric ID from the slug (e.g. "3686" from "naruto-3686")
     * and optionally match by title.
     */
    private parseAnimeIdFromSuggestions(html: string, searchTitle?: string): string | null {
        if (!html) return null;

        // Extract all suggestion entries: slug and associated text content
        const entries: Array<{ slug: string; id: string; title: string }> = [];
        // Match href="/anime/<slug-id>" and capture everything until </a>
        const linkPattern = /href=["'](?:https?:\/\/anidb\.app)?\/anime\/([a-z0-9-]+-(\d+))["'][^>]*>([\s\S]*?)<\/a>/gi;
        let m: RegExpExecArray | null;
        while ((m = linkPattern.exec(html))) {
            const slug = m[1];
            const id = m[2];
            // Extract readable title from alt attributes or <p> tags inside the link
            const inner = m[3];
            const altMatch = inner.match(/alt=["']([^"']+)["']/i);
            const pMatch = inner.match(/<p[^>]*>([^<]+)<\/p>/i);
            const title = altMatch?.[1] || pMatch?.[1] || '';
            entries.push({ slug, id, title: title.trim() });
        }

        if (entries.length === 0) {
            // Fallback: simple regex for any /anime/<slug>-<id> pattern
            const simple = html.match(/\/anime\/[a-z0-9-]+-(\d+)/i);
            return simple ? simple[1] : null;
        }

        // Try to match by title if we have a search query
        if (searchTitle) {
            const cleanTarget = this.cleanSearchQuery(searchTitle);
            for (const entry of entries) {
                const cleanEntry = this.cleanSearchQuery(entry.title);
                if (cleanEntry && (
                    cleanEntry === cleanTarget ||
                    cleanEntry.includes(cleanTarget) ||
                    cleanTarget.includes(cleanEntry)
                )) {
                    return entry.id;
                }
            }
        }

        // No title match — return the first result
        return entries[0].id;
    }

    private extractEmbedM3u8(html: string): string | null {
        const match = html.match(/file:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/i)
            || html.match(/(?:file|src)\s*[:=]\s*['"]([^'"]+\.m3u8[^'"]*)['"]/i)
            || html.match(/['"](https?:\/\/[^'"]+\.m3u8[^'"]*)['"]/i);
        return match?.[1] ? match[1].replace(/\\\//g, '/').replace(/\\/g, '') : null;
    }

    private parseMasterPlaylist(masterBody: string, masterUrl: string): Array<{ quality: string; url: string }> {
        const variants: Array<{ quality: string; url: string }> = [];
        const seen = new Set<string>();
        const lines = String(masterBody || '').split(/\r?\n/);

        for (let i = 0; i < lines.length; i += 1) {
            const line = lines[i].trim();
            if (!line.startsWith('#EXT-X-STREAM-INF')) continue;

            const resolution = line.match(/RESOLUTION=\d+x(\d+)/i)?.[1];
            const bandwidth = Number(line.match(/BANDWIDTH=(\d+)/i)?.[1] || 0);
            let nextUrl = '';
            for (let j = i + 1; j < lines.length; j += 1) {
                const candidate = lines[j].trim();
                if (!candidate || candidate.startsWith('#')) continue;
                nextUrl = candidate;
                break;
            }
            if (!nextUrl || /EXT-X-I-FRAME/i.test(nextUrl)) continue;

            const url = absoluteUrl(nextUrl, masterUrl);
            if (seen.has(url)) continue;
            seen.add(url);

            const fallbackQuality = bandwidth >= 5_000_000 ? '1080p' : bandwidth >= 2_500_000 ? '720p' : bandwidth >= 1_000_000 ? '480p' : '360p';
            variants.push({ quality: resolution ? `${resolution}p` : fallbackQuality, url });
        }

        return variants.sort((a, b) => {
            const qualityA = Number(String(a.quality || '').replace(/[^\d]/g, '')) || 0;
            const qualityB = Number(String(b.quality || '').replace(/[^\d]/g, '')) || 0;
            return qualityB - qualityA;
        });
    }

    private async resolveEmbedPlaylist(embedUrl: string) {
        const embedHtml = await fetchAnidbText(embedUrl);
        const masterM3u8 = this.extractEmbedM3u8(embedHtml);
        if (!masterM3u8) return null;

        const masterBody = await fetchAnidbText(masterM3u8);
        const variants = this.parseMasterPlaylist(masterBody, masterM3u8);

        return {
            masterM3u8,
            variants,
            preferredM3u8: variants[0]?.url || masterM3u8,
        };
    }

    async getStream(anilistId: number, episode: number, options?: { title?: string, tmdbId?: number, format?: string, anilistId?: number }): Promise<StreamResponse | null> {
        try {
            const metadata = options?.tmdbId ? await streambertAnimeService.getMetadata(options.tmdbId).catch(() => null) : null;
            const rawTitle = options?.title || metadata?.title?.romaji || metadata?.title?.english || metadata?.title?.native || '';
            const searchTitle = this.cleanSearchQuery(rawTitle);
            
            if (!searchTitle) return null;

            let animeId: string | null = null;
            
            // 1. Try suggestions endpoint FIRST — resilient fetch with curl failover bypasses Cloudflare
            const suggHtml = await fetchAnidbText(`https://anidb.app/search/suggestions?q=${encodeURIComponent(searchTitle)}`);
            animeId = this.parseAnimeIdFromSuggestions(suggHtml, rawTitle);
            logger.info(`[anidb-scraper] Suggestions search for "${searchTitle}" → animeId: ${animeId}`);

            // 2. Fallback to browse endpoint
            if (!animeId) {
                const browseHtml = await fetchAnidbText(`https://anidb.app/browse?q=${encodeURIComponent(searchTitle)}`);
                animeId = this.parseAnimeIdFromSuggestions(browseHtml, rawTitle);
                logger.info(`[anidb-scraper] Browse fallback for "${searchTitle}" → animeId: ${animeId}`);
            }

            if (!animeId) {
                logger.warn(`[anidb-scraper] No anime ID found for "${searchTitle}"`);
                return null;
            }

            // 3. Get episodes list
            const epJsonStr = await fetchAnidbText(`https://anidb.app/api/frontend/anime/${animeId}/episodes`);
            let epData: any = null;
            try { epData = JSON.parse(epJsonStr); } catch {}
            const epList = epData?.episodes || (Array.isArray(epData) ? epData : []);
            
            const targetEp = epList.find((e: any) => Number(e.number || e.episode) === episode) || epList[0];
            const epId = targetEp?.id;

            if (!epId) {
                logger.warn(`[anidb-scraper] No episode ID found for anime ${animeId} episode ${episode}`);
                return null;
            }

            // 4. Get embed URLs per language
            const langJsonStr = await fetchAnidbText(`https://anidb.app/api/frontend/episode/${epId}/languages`);
            let langData: any = null;
            try { langData = JSON.parse(langJsonStr); } catch {}
            const embeds = langData?.languages || (Array.isArray(langData) ? langData : []);

            let jpnEmbed = embeds.find((e: any) => e.code === 'jpn' || String(e.name || '').toLowerCase().includes('japan'))?.embed_url || embeds[0]?.embed_url;
            let engEmbed = embeds.find((e: any) => e.code === 'eng' || String(e.name || '').toLowerCase().includes('english'))?.embed_url;

            if (jpnEmbed) jpnEmbed = String(jpnEmbed).replace(/\\\//g, '/');
            if (engEmbed) engEmbed = String(engEmbed).replace(/\\\//g, '/');

            let masterM3u8: string | null = null;
            let dubM3u8: string | null = null;
            let variants: Array<{ quality: string; url: string }> = [];
            let dubVariants: Array<{ quality: string; url: string }> = [];

            // 5. Extract m3u8 from embed pages
            if (jpnEmbed) {
                const resolved = await this.resolveEmbedPlaylist(jpnEmbed);
                if (resolved) {
                    masterM3u8 = resolved.preferredM3u8;
                    variants = resolved.variants;
                }
            }

            if (engEmbed) {
                const resolved = await this.resolveEmbedPlaylist(engEmbed);
                if (resolved) {
                    dubM3u8 = resolved.preferredM3u8;
                    dubVariants = resolved.variants;
                }
            }

            if (masterM3u8) {
                logger.info(`[anidb-scraper] Got m3u8 for anime ${animeId} ep ${episode}: ${masterM3u8.substring(0, 80)}...`);
                const referer = 'https://anidb.app/';

                const epTitle = await getEpisodeTitle(options?.anilistId || (targetEp ? anilistId : 0), episode);

                return {
                    m3u8: masterM3u8,
                    dubM3u8: dubM3u8 || undefined,
                    subtitles: [],
                    source: this.id,
                    episode,
                    duration: (metadata?.duration ? Number(metadata.duration) * 60 : 1440),
                    title: epTitle,
                    referer,
                    variants,
                    dubVariants,
                };
            }

            logger.warn(`[anidb-scraper] No m3u8 extracted from embed for anime ${animeId} ep ${episode}`);
        } catch (error) {
            logger.warn(`[anidb-scraper] AniDB scraping failed for episode ${episode}`, error);
        }

        return null;
    }
}

async function fetchAnidbText(url: string, customHeaders?: Record<string, string>): Promise<string> {
    const ANIDB_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0';
    const ANIDB_REF = 'https://anidb.app/';

    // 1. Try axios first
    try {
        const res = await axios.get<string>(url, {
            headers: {
                'User-Agent': ANIDB_UA,
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8',
                Referer: ANIDB_REF,
                ...(customHeaders || {}),
            },
            timeout: 6000,
        });
        if (typeof res.data === 'string') return res.data;
        if (res.data) return JSON.stringify(res.data);
    } catch {
        // Fall back to curl failover (same strategy as ani-cli) if Cloudflare challenge or 403 occurs
    }

    // 2. Failover to curl / curl-impersonate
    try {
        const curlCmd = process.platform === 'win32' ? 'curl.exe' : 'curl';
        const args = ['-sL', '-A', ANIDB_UA, '-e', ANIDB_REF, '--max-time', '10', url];
        const { stdout } = await execFileAsync(curlCmd, args);
        return stdout || '';
    } catch (err: any) {
        logger.warn(`[anidb-scraper] fetchAnidbText failed for ${url}: ${err?.message || err}`);
        return '';
    }
}

// Default sources for auto-fallback (only sources that return playable HLS/video URLs)
const streamableSources: VideoSource[] = [
    new AniDBSource(),
    new EmbedSource('vidsrc', process.env.VIDSRC_BASE_URL || 'https://vidsrc.in'),
    new EmbedSource('vidking', process.env.VIDKING_BASE_URL || 'https://www.vidking.net'),
    new VideasySource(),
];

// All sources including explicit provider-only sources
const allSources: VideoSource[] = [...streamableSources];

function orderedSources(requested: string) {
    // Default / auto / anidb — use streamable sources
    if (!requested || requested === 'auto' || requested === 'anidb') return streamableSources;
    const source = allSources.find((item) => item.id === requested);
    return source ? [source, ...streamableSources.filter(s => s.id !== requested)] : streamableSources;
}

export const animeVideoSources = {
    async getStream(anilistId: number, episode: number, requestedSource = 'anidb', options?: { title?: string, tmdbId?: number }, nocache = false): Promise<StreamResponse | null> {
        const sourceId = String(requestedSource || 'anidb').trim().toLowerCase();
        const cacheKey = `anime:stream:v109:${anilistId}:${episode}:${sourceId}`;
        if (!nocache) {
            const cached = await cacheGet<StreamResponse>(cacheKey);
            if (cached) return cached;
        }

        const metadata = options?.tmdbId ? await streambertAnimeService.getMetadata(options.tmdbId) : null;
        const isMovie = metadata?.format === 'MOVIE';
        const ttl = isMovie ? 300 : STREAM_TTL_SECONDS;

        const sourcesToTry = orderedSources(sourceId);
        for (const source of sourcesToTry) {
            try {
                const result = await source.getStream(anilistId, episode, options);
                if (result?.m3u8) {
                    await cacheSet(cacheKey, result, ttl);
                    return result;
                }
            } catch (error) {
                logger.warn(`[anime-stream] ${source.id} failed for AniList ${anilistId} episode ${episode}`, error);
            }
        }

        return null;
    },
};


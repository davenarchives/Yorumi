import axios from 'axios';
import { exec } from 'child_process';
import util from 'util';
const execPromise = util.promisify(exec);
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
    const anilistId = options?.anilistId || (targetId > 0 ? targetId : undefined);

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

        if (this.id === 'vidsrc' || this.id === 'vidking') {
            return {
                m3u8: playerUrl,
                subtitles: [],
                source: this.id,
                episode,
                title: await getEpisodeTitle(targetId, episode).catch(() => undefined),
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
                    title: await getEpisodeTitle(targetId, episode),
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
            title: await getEpisodeTitle(targetId, episode),
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

    async getStream(anilistId: number, episode: number, options?: { title?: string, tmdbId?: number, format?: string, anilistId?: number }): Promise<StreamResponse | null> {
        try {
            const metadata = options?.tmdbId ? await streambertAnimeService.getMetadata(options.tmdbId).catch(() => null) : null;
            const searchTitle = options?.title || metadata?.title?.romaji || metadata?.title?.english || metadata?.title?.native || '';
            if (searchTitle) {
                const headers = {
                    'User-Agent': USER_AGENT,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Referer': 'https://anidb.app/',
                };

                const browseRes = await axios.get<string>(`https://anidb.app/browse?q=${encodeURIComponent(searchTitle)}`, { headers, timeout: 10000 }).catch(() => null);
                const browseHtml = String(browseRes?.data || '');
                
                const matches = [...browseHtml.matchAll(/href=["'](https?:\/\/anidb\.app\/anime\/[^"']+)["']/g)].map(m => m[1]);
                const firstLink = matches[0];
                const animeId = firstLink?.split('-').pop();

                if (animeId) {
                    const epRes = await axios.get<any>(`https://anidb.app/api/frontend/anime/${animeId}/episodes`, { headers, timeout: 10000 }).catch(() => null);
                    const epData = epRes?.data;
                    const epList = epData?.episodes || (Array.isArray(epData) ? epData : []);
                    
                    const targetEp = epList.find((e: any) => Number(e.number || e.episode) === episode) || epList[0];
                    const epId = targetEp?.id;

                    if (epId) {
                        const langRes = await axios.get<any>(`https://anidb.app/api/frontend/episode/${epId}/languages`, { headers, timeout: 10000 }).catch(() => null);
                        const langData = langRes?.data;
                        const embeds = langData?.languages || (Array.isArray(langData) ? langData : []);

                        const jpnEmbed = embeds.find((e: any) => e.code === 'jpn' || String(e.name || '').toLowerCase().includes('japan'))?.embed_url || embeds[0]?.embed_url;
                        const engEmbed = embeds.find((e: any) => e.code === 'eng' || String(e.name || '').toLowerCase().includes('english'))?.embed_url;

                        let masterM3u8: string | null = null;
                        let dubM3u8: string | null = null;

                        if (jpnEmbed) {
                            const jpnRes = await axios.get<string>(jpnEmbed, { headers: { ...headers, Referer: 'https://anidb.app/' }, timeout: 10000 }).catch(() => null);
                            const jpnHtml = String(jpnRes?.data || '');
                            const m = jpnHtml.match(/(?:file|src)\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i) || jpnHtml.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i);
                            if (m?.[1]) masterM3u8 = m[1];
                        }

                        if (engEmbed) {
                            const engRes = await axios.get<string>(engEmbed, { headers: { ...headers, Referer: 'https://anidb.app/' }, timeout: 10000 }).catch(() => null);
                            const engHtml = String(engRes?.data || '');
                            const m = engHtml.match(/(?:file|src)\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i) || engHtml.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i);
                            if (m?.[1]) dubM3u8 = m[1];
                        }

                        if (masterM3u8) {
                            const referer = 'https://anidb.app/';
                            const proxiedM3u8 = `/api/scraper/proxy?url=${encodeURIComponent(masterM3u8)}&referer=${encodeURIComponent(referer)}`;
                            const proxiedDubM3u8 = dubM3u8 ? `/api/scraper/proxy?url=${encodeURIComponent(dubM3u8)}&referer=${encodeURIComponent(referer)}` : undefined;

                            return {
                                m3u8: proxiedM3u8,
                                dubM3u8: proxiedDubM3u8,
                                subtitles: [],
                                source: this.id,
                                episode,
                                title: await getEpisodeTitle(anilistId, episode),
                                referer,
                            };
                        }
                    }
                }
            }
        } catch (error) {
            logger.warn(`[anidb-scraper] AniDB scraping failed for episode ${episode}`, error);
        }

        // Fallback to Videasy if anidb.app title is not found
        const videasy = new VideasySource();
        return videasy.getStream(anilistId, episode, options).catch(() => null);
    }
}

const sources: VideoSource[] = [
    new AniDBSource(),
    new EmbedSource('vidsrc', 'https://vidsrc.pm'),
    new EmbedSource('vidking', 'https://www.vidking.net'),
    new VideasySource(),
];

function orderedSources(requested: string) {
    if (!requested || requested === 'auto' || requested === 'anidb') return sources;
    const source = sources.find((item) => item.id === requested);
    return source ? [source] : sources;
}

export const animeVideoSources = {
    async getStream(anilistId: number, episode: number, requestedSource = 'anidb', options?: { title?: string, tmdbId?: number }, nocache = false): Promise<StreamResponse | null> {
        const sourceId = String(requestedSource || 'anidb').trim().toLowerCase();
        const cacheKey = `anime:stream:v104:${anilistId}:${episode}:${sourceId}`;
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

import axios from 'axios';
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
    getStream(anilistId: number, episode: number, options?: { title?: string, tmdbId?: number, format?: string }): Promise<StreamResponse | null>;
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

async function resolveTmdbInfo(targetId: number, episode: number, options?: { title?: string; tmdbId?: number; format?: string }) {
    let tmdbId = options?.tmdbId;
    let format = options?.format;
    if (tmdbId) {
        const meta = await streambertAnimeService.getMetadata(tmdbId, format).catch(() => null);
        format = meta?.format || format;
    } else if (options?.title) {
        const target = await tmdbService.resolveMediaTarget({ title: options.title, format }).catch(() => null);
        if (target?.tmdbId) {
            tmdbId = target.tmdbId;
            format = target.mediaType === 'movie' ? 'MOVIE' : target.mediaType === 'tv' ? 'TV' : format;
        }
    }
    if (!tmdbId) {
        tmdbId = targetId;
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

    async getStream(anilistId: number, episode: number, options?: { title?: string, tmdbId?: number, format?: string }): Promise<StreamResponse | null> {
        const baseUrl = String(process.env.VIDEASY_BASE_URL || 'https://player.videasy.to').replace(/\/+$/, '');
        const { tmdbId, isMovie, seasonNumber, relativeEpisode } = await resolveTmdbInfo(anilistId, episode, options);
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

    async getStream(targetId: number, episode: number, options?: { title?: string, tmdbId?: number, format?: string }): Promise<StreamResponse | null> {
        const cleanBase = this.baseUrl.replace(/\/+$/, '');
        const { tmdbId, isMovie, seasonNumber, relativeEpisode } = await resolveTmdbInfo(targetId, episode, options);
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

const sources: VideoSource[] = [
    new AllMangaSource(),
    new AniNekoScraper(),
    new AnikotoScraper(),
    new EmbedSource('vidsrc', 'https://vsembed.su'),
    new EmbedSource('vidking', 'https://www.vidking.net'),
    new VideasySource(),
];

function orderedSources(requested: string) {
    if (!requested || requested === 'auto' || requested === 'allmanga') return sources;
    const source = sources.find((item) => item.id === requested);
    return source ? [source] : sources;
}

export const animeVideoSources = {
    async getStream(anilistId: number, episode: number, requestedSource = 'allmanga', options?: { title?: string, tmdbId?: number }, nocache = false): Promise<StreamResponse | null> {
        const sourceId = String(requestedSource || 'allmanga').trim().toLowerCase();
        const cacheKey = `anime:stream:v102:${anilistId}:${episode}:${sourceId}`;
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

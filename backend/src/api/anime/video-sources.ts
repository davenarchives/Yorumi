import axios from 'axios';
import { AllMangaScraper } from '../../scraper/allmanga';
import { cacheGet, cacheSet } from '../../utils/redis-cache';
import { logger } from '../../core/logger';
import { streambertAnimeService } from './anime.service';
import { tmdbService } from '../scraper/tmdb.service';
import * as cheerio from 'cheerio';

type SubtitleTrack = { lang: string; url: string };
type StreamResponse = {
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

type VideoSource = {
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



export class AnimeGGSource implements VideoSource {
    id = 'animegg';

    async getStream(anilistId: number, episode: number, options?: { title?: string, tmdbId?: number }): Promise<StreamResponse | null> {
        const metadata = options?.tmdbId ? await streambertAnimeService.getMetadata(options.tmdbId) : null;
        const title = options?.title || metadata?.title?.romaji || metadata?.title?.english || metadata?.title?.native;
        if (!title) return null;

        try {
            const searchTitles = [
                title,
                metadata?.title?.romaji,
                metadata?.title?.english,
                metadata?.title?.native
            ].filter(Boolean) as string[];

            let searchHtml = '';
            let slugMatches: RegExpMatchArray[] = [];

            for (const searchTitle of searchTitles) {
                searchHtml = await axios.get<string>(`https://www.animegg.org/search/?q=${encodeURIComponent(searchTitle)}`, {
                    headers: { 'User-Agent': USER_AGENT }
                }).then(r => r.data).catch(() => '');
                
                slugMatches = [...searchHtml.matchAll(/<a\b[^>]*href=["']\/series\/([^/?#"']+)["']/gi)];
                if (slugMatches.length > 0) break;
            }

            if (slugMatches.length === 0) {
                console.log(`[AnimeGG] slugMatch failed for all titles of ${title}`);
                return null;
            }
            
            const altTitles = [
                title,
                metadata?.title?.romaji,
                metadata?.title?.english,
                ...(metadata?.synonyms || [])
            ].filter(Boolean) as string[];

            const altExpectedSlugs = altTitles.map(t => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
            const altExpectedWordsList = altExpectedSlugs.map(slug => slug.replace(/-/g, ' '));

            const scoredSlugs = slugMatches.map(m => {
                const slug = m[1];
                const slugWords = slug.replace(/-/g, ' ');
                let bestScore = -9999;

                for (let i = 0; i < altExpectedSlugs.length; i++) {
                    const expectedSlug = altExpectedSlugs[i];
                    const expectedWords = altExpectedWordsList[i];
                    let score = 0;

                    if (slug === expectedSlug) score += 1000;
                    if (slugWords === expectedWords) score += 1000;
                    if (slugWords.includes(expectedWords) || expectedWords.includes(slugWords)) score += 500;
                    
                    if (slugWords.replace(/u/g, '') === expectedWords.replace(/u/g, '')) score += 800;

                    const isSpecial = /\b(movie|ova|ona|special|recap)\b/i.test(slugWords);
                    const asksSpecial = /\b(movie|ova|ona|special|recap)\b/i.test(expectedWords);
                    if (isSpecial && !asksSpecial) score -= 2000;

                    if (slug.endsWith('-dub')) score -= 10;
                    
                    if (score > bestScore) bestScore = score;
                }

                return { slug, score: bestScore };
            });

            scoredSlugs.sort((a, b) => b.score - a.score);
            const slug = scoredSlugs[0].slug;

            const seriesHtml = await axios.get<string>(`https://www.animegg.org/series/${slug}`, {
                headers: { 'User-Agent': USER_AGENT }
            }).then(r => r.data);
            
            const liPattern = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
            let epSlug = null;
            let m;
            while ((m = liPattern.exec(seriesHtml))) {
                const block = m[1];
                if (!block.includes('anm_det_pop')) continue;
                
                const hrefMatch = block.match(/href=["']\/([^"']+)["']/i);
                const strongMatch = block.match(/<strong[^>]*>([\s\S]*?)<\/strong>/i);
                if (hrefMatch && strongMatch) {
                    const strongText = strongMatch[1].replace(/<[^>]+>/g, '').trim();
                    // Handle single ep ("12"), ranges ("1-13"), and decimal ("12.5")
                    const rangeMatch = strongText.match(/(\d+)\s*-\s*(\d+)\s*$/);
                    const singleMatch = strongText.match(/(\d+(?:\.\d+)?)\s*$/);
                    let epMatch = false;
                    if (rangeMatch) {
                        // Range: episode must be within [start, end]
                        const start = parseInt(rangeMatch[1]);
                        const end = parseInt(rangeMatch[2]);
                        epMatch = episode >= start && episode <= end;
                    } else if (singleMatch) {
                        epMatch = parseFloat(singleMatch[1]) === episode;
                    }
                    if (epMatch) {
                        epSlug = hrefMatch[1].replace(/#.*$/, '');
                        break;
                    }
                }
            }
            if (!epSlug) return null;

            const watchHtml = await axios.get<string>(`https://www.animegg.org/${epSlug}`, {
                headers: { 'User-Agent': USER_AGENT, Referer: 'https://www.animegg.org' }
            }).then(r => r.data);

            const embedMatch = watchHtml.match(/<iframe\b[^>]*src=["']\/embed\/([^"']+)["']/i);
            if (!embedMatch) {
                console.log(`[AnimeGG] embedMatch failed for ${title} ep ${episode}`);
                return null;
            }
            const embedId = embedMatch[1];
            const embedUrl = `https://www.animegg.org/embed/${embedId}`;

            const embedHtml = await axios.get<string>(embedUrl, {
                headers: { 'User-Agent': USER_AGENT, Referer: `https://www.animegg.org` }
            }).then(r => r.data);

            const videoSourcesMatch = embedHtml.match(/var\s+videoSources\s*=\s*(\[.*?\])\s*;/is);
            let url = '';
            
            if (videoSourcesMatch) {
                const arrStr = videoSourcesMatch[1];
                const sources = [];
                const blockRegex = /\{([^{}]+)\}/g;
                let blockMatch;
                while ((blockMatch = blockRegex.exec(arrStr))) {
                    const block = blockMatch[1];
                    const fileMatch = block.match(/file\s*:\s*["']([^"']+)["']/i);
                    const labelMatch = block.match(/label\s*:\s*["']([^"']+)["']/i);
                    if (fileMatch) {
                        sources.push({ url: fileMatch[1], label: labelMatch ? labelMatch[1] : '0' });
                    }
                }
                
                if (sources.length > 0) {
                    sources.sort((a, b) => {
                        const aVal = parseInt(a.label.replace(/\\D/g, '')) || 0;
                        const bVal = parseInt(b.label.replace(/\\D/g, '')) || 0;
                        return bVal - aVal; // descending order, highest first
                    });
                    url = sources[0].url;
                }
            }
            
            if (!url) {
                const srcMatch = embedHtml.match(/var\s+videoSources\s*=\s*\[\\{.*?file\s*:\s*["']([^"']+)["']/i);
                if (!srcMatch) return null;
                url = srcMatch[1];
            }
            
            if (!url.startsWith('http')) url = `https://www.animegg.org${url}`;

            // Check if fallback embed is available (e.g. mp4upload)
            let backupEmbed = '';
            const backupMatch = embedHtml.match(/<iframe\b[^>]*src=["'](https?:\/\/[^"']+)["']/i);
            if (backupMatch) backupEmbed = backupMatch[1];

            return {
                m3u8: url,
                subtitles: [],
                source: this.id,
                episode,
                title: await getEpisodeTitle(anilistId, episode),
                referer: embedUrl,
                variants: backupEmbed ? [{ quality: 'embed', url: backupEmbed }] : []
            };
        } catch (e: any) {
            console.error(`AnimeGG failed for title ${title}:`, e?.message || e);
            return null;
        }
    }
}

export class AnimeNoSubSource implements VideoSource {
    id = 'animenosub';

    async getStream(anilistId: number, episode: number, options?: { title?: string, tmdbId?: number, format?: string }): Promise<StreamResponse | null> {
        try {
            const title = options?.title || await getEpisodeTitle(anilistId, episode);
            const query = encodeURIComponent(title || '');
            
            const searchRes = await axios.post('https://animenosub.to/wp-admin/admin-ajax.php', 
                `action=ts_ac_do_search&ts_ac_query=${query}`,
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'User-Agent': USER_AGENT,
                        'Origin': 'https://animenosub.to',
                        'Referer': 'https://animenosub.to/'
                    }
                }
            );

            const searchData = searchRes.data;
            if (!searchData?.anime?.[0]?.all) return null;

            let seriesSlug = '';
            for (const item of searchData.anime[0].all) {
                const slugMatch = item.post_link?.match(/\/anime\/([^\/]+)\/?$/);
                if (slugMatch) {
                    seriesSlug = slugMatch[1];
                    break;
                }
            }
            if (!seriesSlug) return null;

            const html = await axios.get(`https://animenosub.to/anime/${seriesSlug}/`, {
                headers: { 'User-Agent': USER_AGENT, 'Referer': 'https://animenosub.to/' }
            }).then(r => r.data);

            const epRegex = new RegExp(`<li\\b[^>]*data-index="\\d+"[^>]*>[\\s\\S]*?<a\\s+href="(https?:\\/\\/animenosub\\.to\\/[^"]+)"[\\s\\S]*?<div\\s+class="epl-num">\\s*(?:Episode\\s+)?${episode}\\s*<\\/div>`, 'i');
            const epMatch = html.match(epRegex);
            if (!epMatch) return null;
            
            const epUrl = epMatch[1];

            const epHtml = await axios.get(epUrl, {
                headers: { 'User-Agent': USER_AGENT, 'Referer': `https://animenosub.to/anime/${seriesSlug}/` }
            }).then(r => r.data);

            let embedUrl = null;
            const optionRegex = /<option\s+value="([^"]+)"\s+data-index="\d+"[^>]*>([^<]+)<\/option>/gi;
            let m;
            while ((m = optionRegex.exec(epHtml))) {
                const b64 = m[1];
                const serverName = m[2].trim();
                if (!serverName || /select video server/i.test(serverName)) continue;
                try {
                    const decoded = Buffer.from(b64, 'base64').toString('utf8');
                    const srcMatch = decoded.match(/src=["']([^"']+)["']/i);
                    if (srcMatch) {
                        embedUrl = srcMatch[1];
                        if (embedUrl.startsWith('//')) embedUrl = 'https:' + embedUrl;
                        break;
                    }
                } catch (e) {}
            }

            if (!embedUrl) {
                const iframeRegex = /<iframe[^>]+src=["']([^"']+)["'][^>]*>/gi;
                let im;
                while ((im = iframeRegex.exec(epHtml))) {
                    const src = im[1];
                    if (/vidmoly|vtbe|streamtape|dood|filemoon|upn\.one|bysesa/i.test(src)) {
                        embedUrl = src;
                        if (embedUrl.startsWith('//')) embedUrl = 'https:' + embedUrl;
                        break;
                    }
                }
            }

            if (!embedUrl) return null;

            return {
                m3u8: embedUrl,
                subtitles: [],
                source: this.id,
                episode,
                title: await getEpisodeTitle(anilistId, episode),
                referer: epUrl,
                isEmbed: true,
                variants: [{ quality: 'embed', url: embedUrl }]
            };
        } catch (e: any) {
            console.error(`AnimeNoSub failed for title ${options?.title}:`, e?.message || e);
            return null;
        }
    }
}

export class ReAnimeSource implements VideoSource {
    id = 'reanime';

    async getStream(anilistId: number, episode: number, options?: { title?: string; tmdbId?: number; audio?: string }): Promise<StreamResponse | null> {
        try {
            const { fetchReAnimeStream } = await import('./reanime-scraper.js');

            const [subData, dubData] = await Promise.all([
                fetchReAnimeStream(anilistId, episode, 'sub', options?.title).catch(() => null),
                fetchReAnimeStream(anilistId, episode, 'dub', options?.title).catch(() => null),
            ]);

            const subStreams = (subData || []) as any[];
            const dubStreams = (dubData || []) as any[];

            const primarySub = subStreams[0];
            const primaryDub = dubStreams[0];
            const primaryData = primarySub || primaryDub;
            
            if (!primaryData?.url) return null;

            const m3u8 = primarySub?.url || primaryDub?.url;
            const dubM3u8 = primaryDub?.url !== primarySub?.url ? primaryDub?.url : undefined;
            const referer = primaryData.referer || 'https://reanime.to/';

            const subtitles: SubtitleTrack[] = (primaryData.subtitles || []).map((sub: any) => ({
                lang: sub.language || 'eng',
                url: sub.url
            }));

            const variants = subStreams.slice(1).map(s => ({ quality: s.serverName || 'HD-1', url: s.url }));
            const dubVariants = dubStreams.slice(1).map(s => ({ quality: s.serverName || 'HD-1', url: s.url }));

            return {
                m3u8,
                dubM3u8,
                variants,
                dubVariants,
                subtitles,
                source: this.id,
                episode,
                title: primaryData.video_title || await getEpisodeTitle(anilistId, episode),
                referer
            };
        } catch (error: any) {
            console.error(`ReAnime failed for AniList ${anilistId} ep ${episode}:`, error?.message || error);
            return null;
        }
    }
}

const sources: VideoSource[] = [
    new AllMangaSource(),
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

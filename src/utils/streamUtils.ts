import type { StreamLink } from '../types/stream';
import type { Episode } from '../types/anime';
import { animeService } from '../services/animeService';

/**
 * Maps numerical quality to standard quality labels
 */
export const getMappedQuality = (q: string): string => {
    const str = String(q || '').trim().toLowerCase();
    if (!str || str === 'auto' || str === '0') return 'Auto';
    if (str.includes('1080')) return '1080p';
    if (str.includes('720')) return '720p';
    if (str.includes('480')) return '480p';
    if (str.includes('360')) return '360p';
    const res = parseInt(str, 10);
    if (res >= 1000) return '1080p';
    if (res >= 600) return '720p';
    if (res >= 400) return '480p';
    if (res >= 300) return '360p';
    return 'Auto';
};

/**
 * Fetches stream data for an episode and maps qualities
 */
export const getStreamData = async (
    episode: Episode,
    scraperSession: string,
    options?: {
        provider?: string;
        title?: string;
        titles?: string[];
        year?: string | number;
        format?: string;
    }
): Promise<StreamLink[]> => {
    const playbackEpisodeNumber = Number(episode._tmdbAbsolute || episode.episodeNumber || 0) || undefined;
    const data = await animeService.getStreams(scraperSession, episode.session, {
        ...options,
        episodeNumber: playbackEpisodeNumber,
    });

    if (data && data.length > 0) {
        const scoreStream = (stream: StreamLink) => {
            const quality = parseInt(String(stream.quality || '0'), 10) || 0;
            const url = String(stream.url || '');
            const directUrl = String(stream.directUrl || '');
            const hasDirectUrl = Boolean(directUrl);
            const isHls = Boolean(stream.isHls) || url.includes('.m3u8') || directUrl.includes('.m3u8');
            const isIframeLike = /vidsrc|vidstream|megacloud|embed|kwik/i.test(url) || !isHls;
            return (isHls ? 1_000_000 : 0) + (hasDirectUrl ? 100_000 : 0) - (isIframeLike ? 1_000_000 : 0) + quality;
        };

        const qualityMap = new Map<string, StreamLink>();
        const sortedData = [...data].sort(
            (a: StreamLink, b: StreamLink) => scoreStream(b) - scoreStream(a)
        );

        sortedData.forEach((s: StreamLink) => {
            const mapped = getMappedQuality(s.quality);
            const audio = String(s.audio || 'sub').toLowerCase();
            const source = String(s.server || s.provider || s.url || 'source').toLowerCase();
            const key = `${audio}:${source}:${mapped}`;
            if (!qualityMap.has(key)) {
                qualityMap.set(key, s);
            }
        });

        const mappedStreams = Array.from(qualityMap.values());
        return mappedStreams.length > 0 ? mappedStreams : [sortedData[0]];
    }
    return [];
};

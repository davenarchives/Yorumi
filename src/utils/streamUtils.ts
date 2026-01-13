import type { StreamLink } from '../types/stream';
import type { Episode } from '../types/anime';

/**
 * Maps numerical quality to standard quality labels
 */
export const getMappedQuality = (q: string): string => {
    const res = parseInt(q);
    if (res >= 1000) return '1080P';
    if (res >= 600) return '720P';
    return '360P';
};

/**
 * Fetches stream data for an episode and maps qualities
 */
export const getStreamData = async (
    episode: Episode,
    scraperSession: string
): Promise<StreamLink[]> => {
    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    const res = await fetch(
        `${API_BASE}/scraper/streams?anime_session=${scraperSession}&ep_session=${episode.session}`
    );
    const data = await res.json();

    if (data && data.length > 0) {
        const qualityMap = new Map<string, StreamLink>();
        const sortedData = [...data].sort(
            (a: StreamLink, b: StreamLink) => (parseInt(b.quality) || 0) - (parseInt(a.quality) || 0)
        );

        sortedData.forEach((s: StreamLink) => {
            const mapped = getMappedQuality(s.quality);
            if (!qualityMap.has(mapped)) {
                qualityMap.set(mapped, s);
            }
        });

        return Array.from(qualityMap.values());
    }
    return [];
};

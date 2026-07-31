export interface SkipTimestamp {
    start: number;
    end: number;
    type: 'op' | 'ed';
    episode: number;
    skipType: 'intro' | 'outro';
}

interface AniSkipResponse {
    results: Array<{
        skip_type?: 'op' | 'ed';
        skipType?: 'op' | 'ed';
        start_time?: number;
        end_time?: number;
        interval?: {
            startTime?: number;
            endTime?: number;
            start_time?: number;
            end_time?: number;
        };
        episode?: number;
        episodeLength?: number;
    }>;
    found: boolean;
}

interface JikanSearchResponse {
    data?: JikanAnimeEntry[];
}

interface JikanAnimeEntry {
    mal_id?: number;
    title?: string;
    title_english?: string | null;
    title_japanese?: string | null;
    titles?: Array<{ title?: string; type?: string }>;
    episodes?: number | null;
}

const ANISKIP_API_BASE = 'https://api.aniskip.com/v1';
const JIKAN_API_BASE = 'https://api.jikan.moe/v4';

function mapAniSkipType(skipType: 'op' | 'ed'): 'intro' | 'outro' {
    return skipType === 'op' ? 'intro' : 'outro';
}

function buildTypesQuery(episodeLengthSeconds?: number | null) {
    const params = new URLSearchParams();
    params.append('types', 'op');
    params.append('types', 'ed');
    const query = params.toString();
    return query ? `?${query}` : '';
}

function mapAniSkipResult(result: AniSkipResponse['results'][number]): SkipTimestamp | null {
    const skipType = result.skip_type || result.skipType;
    const start = result.interval?.start_time ?? result.interval?.startTime ?? result.start_time;
    const end = result.interval?.end_time ?? result.interval?.endTime ?? result.end_time;
    if ((skipType !== 'op' && skipType !== 'ed') || !Number.isFinite(start) || !Number.isFinite(end)) {
        return null;
    }

    return {
        start: Number(start),
        end: Number(end),
        type: skipType,
        episode: Number(result.episode || 0),
        skipType: mapAniSkipType(skipType),
    };
}

async function fetchFromAniSkip(malId: number, episode: number, episodeLengthSeconds?: number | null): Promise<SkipTimestamp[]> {
    const url = `${ANISKIP_API_BASE}/skip-times/${malId}/${episode}${buildTypesQuery(episodeLengthSeconds)}`;
    const response = await fetch(url);
    
    if (!response.ok) {
        if (response.status === 404) return [];
        throw new Error(`AniSkip API error: ${response.status}`);
    }
    
    const data: AniSkipResponse = await response.json();
    
    if (!data.found || !data.results?.length) return [];
    
    return data.results
        .map(mapAniSkipResult)
        .filter((result): result is SkipTimestamp => Boolean(result));
}

function normalizeTitle(title: string): string {
    return title
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function matchesTitle(candidate: JikanAnimeEntry, title: string) {
    const target = normalizeTitle(title);
    if (!target) return false;

    const candidateTitles = [
        candidate?.title,
        candidate?.title_english,
        candidate?.title_japanese,
        ...(Array.isArray(candidate?.titles) ? candidate.titles.map((entry) => entry?.title).filter(Boolean) as string[] : []),
    ]
        .map((value) => normalizeTitle(String(value || '')))
        .filter(Boolean);

    return candidateTitles.some((candidateTitle) => (
        candidateTitle === target ||
        candidateTitle.includes(target) ||
        target.includes(candidateTitle)
    ));
}

async function resolveMalIdFromTitle(title: string): Promise<number | null> {
    const normalizedTitle = String(title || '').trim();
    if (!normalizedTitle) return null;

    const url = `${JIKAN_API_BASE}/anime?q=${encodeURIComponent(normalizedTitle)}&limit=5`;
    const response = await fetch(url);

    if (!response.ok) {
        return null;
    }

    const data = await response.json() as JikanSearchResponse;
    const candidates = Array.isArray(data.data) ? data.data : [];
    const match = candidates.find((candidate) => Boolean(candidate?.mal_id) && matchesTitle(candidate, normalizedTitle))
        || candidates.find((candidate) => Boolean(candidate?.mal_id))
        || null;

    return match?.mal_id && Number.isFinite(match.mal_id) ? match.mal_id : null;
}

export async function fetchSkipTimestamps(
    malId: number | null,
    title: string,
    episode: number,
    episodeLengthSeconds?: number | null
): Promise<SkipTimestamp[]> {
    if (malId && malId > 0) {
        try {
            const results = await fetchFromAniSkip(malId, episode, episodeLengthSeconds);
            if (results.length > 0) return results;
        } catch (error) {
            console.warn('AniSkip MAL ID fetch failed:', error);
        }
    }

    try {
        const resolvedMalId = await resolveMalIdFromTitle(title);
        if (resolvedMalId && resolvedMalId !== malId) {
            const results = await fetchFromAniSkip(resolvedMalId, episode, episodeLengthSeconds);
            if (results.length > 0) return results;
        }
    } catch (error) {
        console.warn('AniSkip title lookup failed:', error);
    }

    return [];
}

function getIntroSkipTimestamp(skipTimestamps: SkipTimestamp[]): SkipTimestamp | null {
    return skipTimestamps.find((ts) => ts.skipType === 'intro') || null;
}

function getOutroSkipTimestamp(skipTimestamps: SkipTimestamp[]): SkipTimestamp | null {
    return skipTimestamps.find((ts) => ts.skipType === 'outro') || null;
}

function isInSkipRange(currentTime: number, skipTimestamp: SkipTimestamp | null, threshold: number = 1): boolean {
    if (!skipTimestamp) return false;
    return currentTime >= skipTimestamp.start - threshold && currentTime <= skipTimestamp.end + threshold;
}

export function shouldSkipIntro(currentTime: number, skipTimestamps: SkipTimestamp[], threshold: number = 1): number | null {
    const intro = getIntroSkipTimestamp(skipTimestamps);
    if (!intro) return null;
    if (isInSkipRange(currentTime, intro, threshold)) {
        return intro.end;
    }
    return null;
}

export function shouldSkipOutro(currentTime: number, skipTimestamps: SkipTimestamp[], duration: number, threshold: number = 1): number | null {
    const outro = getOutroSkipTimestamp(skipTimestamps);
    if (!outro) return null;
    if (isInSkipRange(currentTime, outro, threshold)) {
        return outro.end < duration ? outro.end : duration;
    }
    return null;
}

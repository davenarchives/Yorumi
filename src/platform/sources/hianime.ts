import type { StreamLink, SubtitleTrack } from '../../types/stream';
import { createLocalMediaProxyUrl } from '../localMediaProxy';
import { getJson, getText } from '../nativeHttp';

const BASE_URL = 'https://hianime.at';
const EMBED_KEY = new TextEncoder().encode('otaku-embed-v1');

const parseHtml = (html: string) => new DOMParser().parseFromString(html, 'text/html');
const cleanTitle = (value: string) => value.toLowerCase()
    .replace(/&amp;/gi, '&')
    .replace(/&#0*39;|&apos;|&#x27;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\b(season|part|cour|nd|rd|th|st)\s*\d+\b/gi, ' ')
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const isSafeTitleMatch = (query: string, candidateTitle: string) => {
    const expected = cleanTitle(query);
    const actual = cleanTitle(candidateTitle);
    if (!expected || !actual) return false;
    if (expected === actual) return true;
    if (actual.startsWith(`${expected} `) || expected.startsWith(`${actual} `)) return true;

    const expectedTokens = expected.split(' ').filter((token) => token.length > 1);
    const actualTokens = new Set(actual.split(' ').filter((token) => token.length > 1));
    if (expectedTokens.length < 2) return false;
    const matched = expectedTokens.filter((token) => actualTokens.has(token)).length;
    return matched / expectedTokens.length >= 0.82;
};

const getKnownTitleAliases = (title: string) => {
    const normalized = cleanTitle(title);
    if (normalized === 'the world is dancing' || normalized === 'world is dancing') {
        return ['World Is Dancing', 'World is Dancing'];
    }
    return [];
};

const decodeBase64 = (value: string) => {
    const binary = atob(value);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const decodeString = (value: string) => new TextDecoder().decode(decodeBase64(value));

const decodePayload = (value: string) => {
    const bytes = decodeBase64(value);
    const output = bytes.map((byte, index) => byte ^ EMBED_KEY[index % EMBED_KEY.length]);
    return new TextDecoder().decode(output);
};

type AnimeMatch = { slug: string; animeId: string; title: string };
export type EpisodeMatch = { epNumber: number; epId: string; title: string };
type ResolvedEmbed = { m3u8: string; subtitles: SubtitleTrack[] };

const normalizeSubtitleLanguage = (value: unknown) => {
    const raw = String(value || '').trim().toLowerCase().replace(/_/g, '-');
    const aliases: Record<string, string> = {
        english: 'en', eng: 'en', arabic: 'ar', ara: 'ar', spanish: 'es', spa: 'es',
        french: 'fr', fra: 'fr', german: 'de', deu: 'de', indonesian: 'id', ind: 'id',
        japanese: 'ja', jpn: 'ja', korean: 'ko', kor: 'ko', portuguese: 'pt', por: 'pt',
        russian: 'ru', rus: 'ru', thai: 'th', tha: 'th', vietnamese: 'vi', vie: 'vi',
        chinese: 'zh', zho: 'zh',
    };
    return aliases[raw] || raw || 'und';
};

const detectSubtitleLanguage = (text: string) => {
    if (/[\u0E00-\u0E7F]/u.test(text)) return 'th';
    if (/[\u0600-\u06FF]/u.test(text)) return 'ar';
    if (/[\uAC00-\uD7AF]/u.test(text)) return 'ko';
    if (/[\u3040-\u30FF]/u.test(text)) return 'ja';
    if (/[\u0400-\u04FF]/u.test(text)) return 'ru';
    if (/[\u4E00-\u9FFF]/u.test(text)) return 'zh';
    return 'und';
};

const resolveSubtitleLanguage = async (subtitle: { src?: string; lang?: string; label?: string; language?: string; name?: string }, referer: string) => {
    if (subtitle.src) {
        try {
            const detected = detectSubtitleLanguage(await getText(subtitle.src, { Referer: referer }));
            if (detected !== 'und') return detected;
        } catch {
            // Retain provider metadata when a device cannot sample the subtitle URL.
        }
    }
    return normalizeSubtitleLanguage(subtitle.lang || subtitle.label || subtitle.language || subtitle.name);
};

const extractSlug = (href: string) => {
    try {
        return new URL(href, BASE_URL).pathname.replace(/^\/+/, '').split('?')[0];
    } catch {
        return href.replace(/^https?:\/\/[^/]+/i, '').replace(/^\/+/, '').split('?')[0];
    }
};

const search = async (query: string): Promise<AnimeMatch | null> => {
    try {
        const html = await getText(`${BASE_URL}/search?keyword=${encodeURIComponent(query)}`, { Referer: BASE_URL });
        const document = parseHtml(html);
        const expected = cleanTitle(query);
        const candidates = [...document.querySelectorAll<HTMLAnchorElement>('.film-detail .film-name a')]
            .flatMap((link) => {
                const title = link.textContent?.trim() || '';
                const slug = extractSlug(link.getAttribute('href') || '');
                const animeId = slug.split('-').at(-1) || '';
                return title && /^\d+$/.test(animeId) ? [{ title, slug, animeId }] : [];
            });
        if (candidates.length === 0) return null;

        const asksMovie = /\b(movie|film)\b/i.test(query);
        const safeCandidates = candidates.filter((candidate) => isSafeTitleMatch(query, candidate.title));
        if (safeCandidates.length === 0) return null;

        return safeCandidates.sort((left, right) => {
            const score = (candidate: AnimeMatch) => {
                const actual = cleanTitle(candidate.title);
                let val = actual === expected ? 1000 : actual.startsWith(expected) ? 500 : actual.includes(expected) || expected.includes(actual) ? 200 : 0;
                const isMovie = /\b(movie|film)\b/i.test(candidate.title);
                if (isMovie && !asksMovie) val -= 300;
                return val;
            };
            return score(right) - score(left);
        })[0] || null;
    } catch {
        return null;
    }
};

const getEpisodes = async (anime: AnimeMatch): Promise<EpisodeMatch[]> => {
    try {
        const response = await getJson<{ html?: string }>(`${BASE_URL}/api/theme/episode/list/${anime.animeId}`, {
            Referer: `${BASE_URL}/${anime.slug}`,
            'X-Requested-With': 'XMLHttpRequest',
        });
        const document = parseHtml(response.html || '');
        return [...document.querySelectorAll<HTMLElement>('.ep-item')].flatMap((element) => {
            const numStr = element.getAttribute('data-number') || element.dataset?.number || '';
            const epId = element.getAttribute('data-id') || element.dataset?.id || '';
            const epNumber = Number.parseFloat(numStr);
            return Number.isFinite(epNumber) && epId ? [{ epNumber, epId, title: element.title || `Episode ${epNumber}` }] : [];
        });
    } catch {
        return [];
    }
};

const getEmbeds = async (anime: AnimeMatch, episodeId: string) => {
    try {
        const response = await getJson<{ html?: string }>(`${BASE_URL}/api/theme/episode/servers?episodeId=${encodeURIComponent(episodeId)}`, {
            Referer: `${BASE_URL}/watch/${anime.slug}?ep=${episodeId}`,
            'X-Requested-With': 'XMLHttpRequest',
        });
        const document = parseHtml(response.html || '');
        const pick = (type: 'sub' | 'dub') => {
            const preferred = document.querySelector<HTMLElement>(`.server-item[data-server-name*="Zoko"][data-type="${type}"]`);
            const fallback = document.querySelector<HTMLElement>(`.server-item[data-type="${type}"]`);
            const target = preferred || fallback;
            const hash = target?.getAttribute('data-hash') || target?.dataset?.hash;
            try { return hash ? decodeString(hash) : ''; } catch { return ''; }
        };
        return { sub: pick('sub'), dub: pick('dub') };
    } catch {
        return { sub: '', dub: '' };
    }
};

const resolveEmbed = async (embedUrl: string): Promise<ResolvedEmbed | null> => {
    if (!embedUrl) return null;
    try {
        const html = await getText(embedUrl, { Referer: BASE_URL });
        const payload = html.match(/window\.__P\s*=\s*["']([^"']+)["']/)?.[1];
        if (!payload) return null;
        const data = JSON.parse(decodePayload(payload));
        if (!data?.src) return null;
        const referer = `${new URL(embedUrl).origin}/`;
        const subtitles = await Promise.all((Array.isArray(data.subtitles) ? data.subtitles : []).flatMap((subtitle: { src?: string; lang?: string; label?: string; language?: string; name?: string }) =>
            subtitle?.src ? [Promise.all([
                resolveSubtitleLanguage(subtitle, referer),
                createLocalMediaProxyUrl(subtitle.src, referer),
            ]).then(([lang, url]) => ({ lang, url }))] : []
        ));
        return {
            m3u8: await createLocalMediaProxyUrl(data.src, referer),
            subtitles,
        };
    } catch (error) {
        console.error('[HiAnime Mobile] Failed to resolve embed stream.', { embedUrl, error });
        return null;
    }
};

export const getLocalHiAnimeStreams = async (
    title: string,
    episodeNumber: number,
    alternateTitles: string[] = [],
    malId?: number
): Promise<StreamLink[]> => {
    // 1. Direct MAL ID shortcut (fastest path when MAL ID is known)
    if (malId && malId > 0) {
        try {
            const directSub = `https://zokoanime.video/stream/mal/${malId}/${episodeNumber}/sub`;
            const directDub = `https://zokoanime.video/stream/mal/${malId}/${episodeNumber}/dub`;
            const [subDirect, dubDirect] = await Promise.all([
                resolveEmbed(directSub).catch(() => null),
                resolveEmbed(directDub).catch(() => null),
            ]);
            if (subDirect || dubDirect) {
                return [
                    ...(subDirect ? [{ quality: 'auto', audio: 'sub', provider: 'frieren', server: 'Frieren', url: subDirect.m3u8, directUrl: subDirect.m3u8, isHls: true, isEmbed: false, subtitles: subDirect.subtitles }] : []),
                    ...(dubDirect ? [{ quality: 'auto', audio: 'dub', provider: 'frieren', server: 'Frieren', url: dubDirect.m3u8, directUrl: dubDirect.m3u8, isHls: true, isEmbed: false, subtitles: subDirect?.subtitles || [] }] : []),
                ];
            }
        } catch {
            // ignore direct MAL shortcut errors and fallback to search
        }
    }

    // 2. Search HiAnime
    let anime: AnimeMatch | null = null;
    const candidates = [title, ...alternateTitles]
        .flatMap((value) => {
            const trimmed = value.trim();
            return trimmed ? [trimmed, ...getKnownTitleAliases(trimmed)] : [];
        })
        .filter((value, index, list) => list.indexOf(value) === index);
    for (const candidate of candidates) {
        anime = await search(candidate);
        if (anime) break;
    }
    if (!anime) return [];

    const episodes = await getEpisodes(anime);
    if (episodes.length === 0) return [];

    const episode = episodes.find((item) => item.epNumber === episodeNumber);
    if (!episode) return [];

    const embeds = await getEmbeds(anime, episode.epId);
    const [sub, dub] = await Promise.all([
        embeds.sub ? resolveEmbed(embeds.sub).catch(() => null) : Promise.resolve(null),
        embeds.dub ? resolveEmbed(embeds.dub).catch(() => null) : Promise.resolve(null),
    ]);

    return [
        ...(sub ? [{ quality: 'auto', audio: 'sub', provider: 'frieren', server: 'Frieren', url: sub.m3u8, directUrl: sub.m3u8, isHls: true, isEmbed: false, subtitles: sub.subtitles }] : []),
        ...(dub ? [{ quality: 'auto', audio: 'dub', provider: 'frieren', server: 'Frieren', url: dub.m3u8, directUrl: dub.m3u8, isHls: true, isEmbed: false, subtitles: sub?.subtitles || [] }] : []),
    ];
};

export const getLocalHiAnimeEpisodes = async (
    title: string,
    alternateTitles: string[] = []
): Promise<EpisodeMatch[]> => {
    let anime: AnimeMatch | null = null;
    const candidates = [title, ...alternateTitles]
        .flatMap((value) => {
            const trimmed = value.trim();
            return trimmed ? [trimmed, ...getKnownTitleAliases(trimmed)] : [];
        })
        .filter((value, index, list) => list.indexOf(value) === index);
    for (const candidate of candidates) {
        anime = await search(candidate);
        if (anime) break;
    }
    if (!anime) return [];
    return await getEpisodes(anime);
};

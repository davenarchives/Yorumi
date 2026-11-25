import type { SubtitleTrack } from '../types/stream';
import { API_ORIGIN } from '../config/api';
import { isTauri } from '../platform/runtime';

export interface SubtitleCue {
    start: number;
    end: number;
    text: string;
}

const isEnglish = (value: unknown) => /^(?:en|eng|english)(?:[-_\s(]|$)/i.test(String(value || '').trim());

const isNonSubtitleTrack = (track: SubtitleTrack) => {
    const label = String(track.lang || '').toLowerCase();
    const url = String(track.url || '').toLowerCase();
    return label.includes('thumbnail')
        || label.includes('sprite')
        || /\.(?:jpg|jpeg|png|webp|gif)(?:\?|$)/i.test(url);
};

const LANGUAGE_NAMES: Record<string, string> = {
    en: 'English', eng: 'English', english: 'English',
    ar: 'Arabic', ara: 'Arabic', arabic: 'Arabic',
    es: 'Spanish', spa: 'Spanish', spanish: 'Spanish',
    fr: 'French', fra: 'French', fre: 'French', french: 'French',
    de: 'German', deu: 'German', ger: 'German', german: 'German',
    id: 'Indonesian', ind: 'Indonesian', indonesian: 'Indonesian',
    ja: 'Japanese', jpn: 'Japanese', japanese: 'Japanese',
    pt: 'Portuguese', por: 'Portuguese', portuguese: 'Portuguese',
    th: 'Thai', tha: 'Thai', thai: 'Thai',
    vi: 'Vietnamese', vie: 'Vietnamese', vietnamese: 'Vietnamese',
    it: 'Italian', ita: 'Italian', italian: 'Italian',
    ko: 'Korean', kor: 'Korean', korean: 'Korean',
    ru: 'Russian', rus: 'Russian', russian: 'Russian',
    zh: 'Chinese', zho: 'Chinese', chi: 'Chinese', chinese: 'Chinese',
    tr: 'Turkish', tur: 'Turkish', turkish: 'Turkish',
    pl: 'Polish', pol: 'Polish', polish: 'Polish',
    nl: 'Dutch', nld: 'Dutch', dut: 'Dutch', dutch: 'Dutch',
    ro: 'Romanian', ron: 'Romanian', rum: 'Romanian', romanian: 'Romanian',
    hi: 'Hindi', hin: 'Hindi', hindi: 'Hindi',
    ms: 'Malay', msa: 'Malay', may: 'Malay', malay: 'Malay',
    tl: 'Tagalog', tgl: 'Tagalog', fil: 'Filipino', tagalog: 'Tagalog', filipino: 'Filipino',
    uk: 'Ukrainian', ukr: 'Ukrainian', ukrainian: 'Ukrainian',
    cs: 'Czech', ces: 'Czech', cze: 'Czech', czech: 'Czech',
    sv: 'Swedish', swe: 'Swedish', swedish: 'Swedish',
    no: 'Norwegian', nor: 'Norwegian', norwegian: 'Norwegian',
    fi: 'Finnish', fin: 'Finnish', finnish: 'Finnish',
    da: 'Danish', dan: 'Danish', danish: 'Danish',
    hu: 'Hungarian', hun: 'Hungarian', hungarian: 'Hungarian',
    el: 'Greek', ell: 'Greek', gre: 'Greek', greek: 'Greek',
    he: 'Hebrew', heb: 'Hebrew', hebrew: 'Hebrew',
};

export function getSubtitleLanguageLabel(language?: string): string {
    const raw = String(language || '').trim();
    if (!raw) return 'Unknown';
    const normalized = raw.toLowerCase().replace(/_/g, '-');
    if (LANGUAGE_NAMES[normalized]) return LANGUAGE_NAMES[normalized];

    // Preserve region/variant qualifiers like "English (Signs & Songs)" or "Spanish (Latin America)"
    const qualifierMatch = raw.match(/^([a-zA-Z]+)\s*[-–—(]\s*(.+?)\)?$/);
    if (qualifierMatch) {
        const baseKey = qualifierMatch[1].toLowerCase();
        const baseName = LANGUAGE_NAMES[baseKey];
        if (baseName) {
            const qualifier = qualifierMatch[2].replace(/\)$/, '').trim();
            return qualifier ? `${baseName} (${qualifier})` : baseName;
        }
    }

    const base = normalized.split(/[-\s(]/)[0];
    if (LANGUAGE_NAMES[base]) return LANGUAGE_NAMES[base];
    return raw.charAt(0).toUpperCase() + raw.slice(1);
}

const getSubtitleSortRank = (track: SubtitleTrack): number => {
    const label = String(track.lang || '').trim();
    if (isEnglish(label)) {
        return /sign|song|forced/i.test(label) ? 1 : 0;
    }
    return 2;
};

/**
 * Filter out non-subtitle tracks (thumbnails/sprites), deduplicate by URL,
 * and sort so full English dialogue is first followed by all other languages.
 */
export function normalizeSubtitleTracks(tracks?: SubtitleTrack[]): SubtitleTrack[] {
    if (!Array.isArray(tracks)) return [];
    const unique = new Map<string, SubtitleTrack>();
    for (const track of tracks) {
        const url = String(track?.url || '').trim();
        if (!url || isNonSubtitleTrack(track)) continue;
        if (!unique.has(url)) {
            unique.set(url, {
                ...track,
                url,
                lang: String(track.lang || 'Unknown').trim() || 'Unknown',
            });
        }
    }

    const sorted = Array.from(unique.values()).sort((left, right) => {
        const rankDiff = getSubtitleSortRank(left) - getSubtitleSortRank(right);
        if (rankDiff !== 0) return rankDiff;
        return getSubtitleLanguageLabel(left.lang).localeCompare(getSubtitleLanguageLabel(right.lang));
    });

    return sorted.map((track, index) => ({
        ...track,
        default: index === 0,
    }));
}

export function selectEnglishSubtitleTracks(tracks?: SubtitleTrack[]): SubtitleTrack[] {
    const normalized = normalizeSubtitleTracks(tracks);
    return normalized.length > 0 ? [normalized[0]] : [];
}

const parseAssTimeToVtt = (raw: string): string | null => {
    const match = raw.trim().match(/^(\d+):(\d{1,2}):(\d{1,2})(?:[.,](\d{1,3}))?$/);
    if (!match) return null;
    const h = match[1].padStart(2, '0');
    const m = match[2].padStart(2, '0');
    const s = match[3].padStart(2, '0');
    const frac = (match[4] || '0').padEnd(3, '0').slice(0, 3);
    return `${h}:${m}:${s}.${frac}`;
};

const convertAssToVtt = (text: string): string => {
    const lines = text.split('\n');
    const cues: string[] = [];
    for (const line of lines) {
        if (!/^Dialogue:/i.test(line)) continue;
        const body = line.replace(/^Dialogue:\s*/i, '');
        // Standard ASS format has 9 commas before the Text field
        const parts = body.split(',');
        if (parts.length < 10) continue;
        const start = parseAssTimeToVtt(parts[1]);
        const end = parseAssTimeToVtt(parts[2]);
        if (!start || !end) continue;
        const rawText = parts.slice(9).join(',');
        const cleaned = rawText
            .replace(/\{[^}]*\}/g, '')
            .replace(/\\N|\\n/g, '\n')
            .replace(/\\h/g, ' ')
            .trim();
        if (!cleaned) continue;
        cues.push(`${start} --> ${end}\n${cleaned}`);
    }
    return cues.length > 0 ? `WEBVTT\n\n${cues.join('\n\n')}\n` : '';
};

/**
 * Normalize raw VTT, SRT, or ASS/SSA subtitle text into clean WebVTT.
 * Returns empty string if the payload is empty or looks like an HTML error page.
 */
export function convertSubtitleTextToVtt(rawText: string): string {
    const cleaned = String(rawText || '')
        .replace(/^\uFEFF/, '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .trim();

    if (!cleaned) return '';
    if (/^(?:<!doctype\s+html|<html\b|<head\b|<body\b)/i.test(cleaned)) return '';

    if (/^\[Script Info\]/im.test(cleaned) || /^Dialogue:\s*\d+,/im.test(cleaned)) {
        return convertAssToVtt(cleaned);
    }

    // Normalize SRT/VTT timestamps (1- or 2-digit hours, comma -> dot)
    const normalizedTimes = cleaned.replace(
        /(\d{1,2}:\d{2}:\d{2}),(\d{1,3})/g,
        (_, hms: string, ms: string) => {
            const parts = hms.split(':');
            const hh = parts[0].padStart(2, '0');
            return `${hh}:${parts[1]}:${parts[2]}.${ms.padEnd(3, '0')}`;
        }
    );

    if (/^WEBVTT(?:\s|$)/i.test(normalizedTimes)) {
        return normalizedTimes;
    }

    return `WEBVTT\n\n${normalizedTimes}`;
}

const parseVttTimestamp = (raw: string): number | null => {
    const trimmed = raw.trim().replace(',', '.');
    const parts = trimmed.split(':');
    if (parts.length === 3) {
        const h = Number(parts[0]);
        const m = Number(parts[1]);
        const s = Number(parts[2]);
        if ([h, m, s].every(Number.isFinite)) return h * 3600 + m * 60 + s;
    } else if (parts.length === 2) {
        const m = Number(parts[0]);
        const s = Number(parts[1]);
        if ([m, s].every(Number.isFinite)) return m * 60 + s;
    }
    return null;
};

const stripCueMarkup = (raw: string): string =>
    raw
        .replace(/<[^>]+>/g, '')
        .replace(/\{\\[^}]*\}/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .trim();

export function parseSubtitleCues(rawText: string): SubtitleCue[] {
    const vtt = convertSubtitleTextToVtt(rawText);
    if (!vtt) return [];

    const blocks = vtt.split(/\n{2,}/);
    const cues: SubtitleCue[] = [];

    for (const block of blocks) {
        const lines = block
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean);
        if (lines.length === 0) continue;
        if (/^(?:WEBVTT|NOTE|STYLE|REGION)\b/i.test(lines[0])) continue;

        const timingIdx = lines.findIndex((line) => line.includes('-->'));
        if (timingIdx < 0) continue;

        const timingLine = lines[timingIdx];
        const [startRaw, endAndSettings] = timingLine.split('-->');
        if (!startRaw || !endAndSettings) continue;
        const endRaw = endAndSettings.trim().split(/\s+/)[0];

        const start = parseVttTimestamp(startRaw);
        const end = parseVttTimestamp(endRaw);
        if (start === null || end === null || end <= start) continue;

        const textLines = lines
            .slice(timingIdx + 1)
            .map(stripCueMarkup)
            .filter(Boolean);
        if (textLines.length === 0) continue;

        cues.push({
            start,
            end,
            text: textLines.join('\n'),
        });
    }

    cues.sort((a, b) => a.start - b.start);
    return cues;
}

const decodeDataUriText = (url: string): string => {
    try {
        const commaIdx = url.indexOf(',');
        if (commaIdx < 0) return '';
        const header = url.slice(5, commaIdx);
        const payload = url.slice(commaIdx + 1);
        if (/;base64/i.test(header)) {
            const binary = atob(payload);
            const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
            return new TextDecoder('utf-8').decode(bytes);
        }
        return decodeURIComponent(payload);
    } catch {
        return '';
    }
};

export function resolveSubtitleFetchUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('yorumi-media://')) {
        return url.replace(/^yorumi-media:\/\//i, 'http://yorumi-media.localhost/');
    }
    if (url.startsWith('/api/')) {
        return `${API_ORIGIN}${url}`;
    }
    return url;
}

/**
 * Fetch subtitle text reliably across data URIs, blob URLs, local proxy URLs,
 * and remote HTTPS URLs (with Tauri yorumi-media proxy fallback on CORS errors).
 */
export async function fetchSubtitleText(url: string, signal?: AbortSignal): Promise<string> {
    const trimmed = String(url || '').trim();
    if (!trimmed) return '';

    if (/^data:/i.test(trimmed)) {
        return decodeDataUriText(trimmed);
    }

    const resolved = resolveSubtitleFetchUrl(trimmed);
    try {
        const res = await fetch(resolved, { signal });
        if (res.ok) {
            const text = await res.text();
            if (text.trim()) return text;
        }
    } catch (err) {
        if (signal?.aborted) return '';
        // Fall through to Tauri proxy fallback below
        void err;
    }

    if (isTauri() && /^https?:\/\//i.test(resolved) && !resolved.includes('yorumi-media.localhost')) {
        try {
            const isWindows = typeof navigator !== 'undefined' && /windows/i.test(navigator.userAgent);
            const origin = isWindows ? 'http://yorumi-media.localhost' : 'yorumi-media://localhost';
            const proxied = `${origin}/stream?url=${encodeURIComponent(resolved)}`;
            const res = await fetch(proxied, { signal });
            if (res.ok) {
                return await res.text();
            }
        } catch {
            // ignore
        }
    }

    return '';
}

export interface AutoTranslateLanguageOption {
    code: string;
    label: string;
}

export const AUTO_TRANSLATE_LANGUAGES: AutoTranslateLanguageOption[] = [
    { code: 'es', label: 'Spanish' },
    { code: 'fr', label: 'French' },
    { code: 'de', label: 'German' },
    { code: 'pt', label: 'Portuguese' },
    { code: 'id', label: 'Indonesian' },
    { code: 'tl', label: 'Filipino' },
    { code: 'ar', label: 'Arabic' },
    { code: 'ja', label: 'Japanese' },
    { code: 'ko', label: 'Korean' },
    { code: 'zh-CN', label: 'Chinese' },
    { code: 'ru', label: 'Russian' },
    { code: 'it', label: 'Italian' },
    { code: 'th', label: 'Thai' },
    { code: 'vi', label: 'Vietnamese' },
    { code: 'hi', label: 'Hindi' },
];

const translatedCuesCache = new Map<string, SubtitleCue[]>();

async function translateTextBatch(joinedText: string, targetLang: string, signal?: AbortSignal): Promise<string> {
    const endpoint = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(joinedText)}`;
    const parsePayload = (payload: unknown): string => {
        if (!Array.isArray(payload) || !Array.isArray(payload[0])) return '';
        return (payload[0] as unknown[])
            .map((segment) => (Array.isArray(segment) && typeof segment[0] === 'string' ? segment[0] : ''))
            .join('');
    };

    try {
        const res = await fetch(endpoint, { signal });
        if (res.ok) {
            const parsed = parsePayload(await res.json());
            if (parsed) return parsed;
        }
    } catch (err) {
        if (signal?.aborted) return '';
        void err;
    }

    if (isTauri()) {
        try {
            const isWindows = typeof navigator !== 'undefined' && /windows/i.test(navigator.userAgent);
            const origin = isWindows ? 'http://yorumi-media.localhost' : 'yorumi-media://localhost';
            const proxied = `${origin}/stream?url=${encodeURIComponent(endpoint)}`;
            const res = await fetch(proxied, { signal });
            if (res.ok) {
                return parsePayload(await res.json());
            }
        } catch {
            // ignore
        }
    }

    return '';
}

/**
 * Translate parsed subtitle cues into targetLang in small batches, prioritizing
 * the batch near `currentTimeSeconds` first so translated subtitles appear immediately.
 */
export async function translateSubtitleCues(
    cacheKey: string,
    sourceCues: SubtitleCue[],
    targetLang: string,
    currentTimeSeconds = 0,
    onPartialUpdate?: (cues: SubtitleCue[]) => void,
    signal?: AbortSignal
): Promise<SubtitleCue[]> {
    const fullKey = `${cacheKey}::${targetLang}`;
    const cached = translatedCuesCache.get(fullKey);
    if (cached && cached.length === sourceCues.length) {
        return cached;
    }

    const result: SubtitleCue[] = sourceCues.map((cue) => ({ ...cue }));
    const SEPARATOR = '\n§§§\n';
    const MAX_BATCH_CHARS = 1600;

    // Group cue indices into character-bounded batches
    const batches: number[][] = [];
    let currentBatch: number[] = [];
    let currentChars = 0;

    for (let i = 0; i < sourceCues.length; i += 1) {
        const len = sourceCues[i].text.length + SEPARATOR.length;
        if (currentBatch.length > 0 && currentChars + len > MAX_BATCH_CHARS) {
            batches.push(currentBatch);
            currentBatch = [];
            currentChars = 0;
        }
        currentBatch.push(i);
        currentChars += len;
    }
    if (currentBatch.length > 0) batches.push(currentBatch);

    // Prioritize the batch containing the current playback position first
    let startBatchIdx = batches.findIndex((indices) => {
        const lastCue = sourceCues[indices[indices.length - 1]];
        return lastCue && lastCue.end >= currentTimeSeconds;
    });
    if (startBatchIdx < 0) startBatchIdx = 0;

    const orderedBatches = [
        ...batches.slice(startBatchIdx),
        ...batches.slice(0, startBatchIdx),
    ];

    const runBatch = async (indices: number[]) => {
        if (signal?.aborted) return;
        const joined = indices.map((idx) => sourceCues[idx].text).join(SEPARATOR);
        const translatedJoined = await translateTextBatch(joined, targetLang, signal);
        if (!translatedJoined || signal?.aborted) return;
        const parts = translatedJoined.split(/\s*§§§\s*/);
        if (parts.length === indices.length) {
            indices.forEach((cueIdx, partIdx) => {
                const text = parts[partIdx]?.trim();
                if (text) result[cueIdx] = { ...result[cueIdx], text };
            });
            onPartialUpdate?.([...result]);
        }
    };

    // Translate the active playback batch first for fast feedback
    if (orderedBatches.length > 0) {
        await runBatch(orderedBatches[0]);
    }

    // Translate remaining batches in small concurrent groups
    const remaining = orderedBatches.slice(1);
    const CONCURRENCY = 3;
    for (let i = 0; i < remaining.length; i += CONCURRENCY) {
        if (signal?.aborted) break;
        await Promise.all(remaining.slice(i, i + CONCURRENCY).map(runBatch));
    }

    if (!signal?.aborted) {
        translatedCuesCache.set(fullKey, result);
    }
    return result;
}

import type { SubtitleTrack } from '../types/stream';

const isEnglish = (value: unknown) => /^(?:en|eng|english)(?:[-_]|$)/i.test(String(value || '').trim());

export function selectEnglishSubtitleTracks(tracks?: SubtitleTrack[]): SubtitleTrack[] {
    if (!Array.isArray(tracks)) return [];
    const englishTracks = tracks.filter((track) => track?.url && isEnglish(track.lang));
    const preferred = englishTracks.find((track) => !/sign|song|forced/i.test(String(track.lang || '')))
        || englishTracks[0];
    return preferred ? [{ ...preferred, lang: 'en', default: true }] : [];
}

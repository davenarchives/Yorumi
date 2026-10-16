import type { Episode } from '../types/anime';

export type WatchableEpisode = Episode & {
    tmdbSeason?: number;
    tmdbEpisode?: number;
    playbackEpisodeNumber?: number;
};

const toPositiveNumber = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

export const getPlaybackEpisodeNumber = (episode: Partial<WatchableEpisode> | null | undefined) => {
    return (
        toPositiveNumber(episode?.playbackEpisodeNumber) ||
        toPositiveNumber(episode?._tmdbAbsolute) ||
        toPositiveNumber(episode?.episodeNumber)
    );
};

export const getDownloadEpisodeNumbers = (episode: Partial<WatchableEpisode> | null | undefined) => {
    const playbackNumber = getPlaybackEpisodeNumber(episode);
    const tmdbSeason = toPositiveNumber(episode?.tmdbSeason);
    const candidates = tmdbSeason
        ? [playbackNumber, toPositiveNumber(episode?._tmdbAbsolute)]
        : [playbackNumber, toPositiveNumber(episode?.episodeNumber)];

    return [...new Set(candidates.filter((number) => number > 0))];
};

export const getEpisodeWatchKey = (episode: Partial<WatchableEpisode> | null | undefined) => {
    const tmdbSeason = toPositiveNumber(episode?.tmdbSeason);
    const tmdbEpisode = toPositiveNumber(episode?.tmdbEpisode) || toPositiveNumber(episode?.episodeNumber);
    if (tmdbSeason && tmdbEpisode) {
        return `tmdb:s${tmdbSeason}:e${tmdbEpisode}`;
    }

    const playbackNumber = getPlaybackEpisodeNumber(episode);
    if (playbackNumber) return `ep:${playbackNumber}`;

    const session = String(episode?.session || '').trim();
    return session ? `session:${session}` : '';
};

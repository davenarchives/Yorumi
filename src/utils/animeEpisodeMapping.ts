import type { TmdbEpisode } from '../services/tmdbService';

export interface AnimeEpisodeSegment {
    tmdbSeason: number;
    tmdbEpisodeStart: number;
    tmdbEpisodeEnd: number;
    localEpisodeStart: number;
    localEpisodeEnd: number;
}

export interface MappedTmdbEpisode {
    localEpisode: number;
    tmdbSeason: number;
    tmdbEpisode: number;
    metadata: TmdbEpisode;
}

export const isPrimaryAnimeMapping = (
    segments: AnimeEpisodeSegment[],
    tmdbMovieId?: number
) => Boolean(tmdbMovieId || segments.some((segment) => segment.tmdbSeason > 0));

export const mapLocalEpisodeToTmdb = (
    segments: AnimeEpisodeSegment[],
    localEpisode: number
): { season: number; episode: number } | null => {
    const segment = segments.find((candidate) =>
        localEpisode >= candidate.localEpisodeStart && localEpisode <= candidate.localEpisodeEnd
    );
    if (!segment) return null;
    return {
        season: segment.tmdbSeason,
        episode: segment.tmdbEpisodeStart + (localEpisode - segment.localEpisodeStart),
    };
};

export const mapTmdbMetadataToLocalEpisodes = (
    segments: AnimeEpisodeSegment[],
    episodesBySeason: Map<number, TmdbEpisode[]>
): MappedTmdbEpisode[] => {
    const mapped: MappedTmdbEpisode[] = [];
    for (const segment of [...segments].sort((a, b) => a.localEpisodeStart - b.localEpisodeStart)) {
        const seasonEpisodes = episodesBySeason.get(segment.tmdbSeason) || [];
        const byNumber = new Map(seasonEpisodes.map((episode) => [episode.episode_number, episode]));
        for (let local = segment.localEpisodeStart; local <= segment.localEpisodeEnd; local += 1) {
            const tmdbEpisode = segment.tmdbEpisodeStart + (local - segment.localEpisodeStart);
            // Some AniBridge TMDB ranges use show-absolute episode numbers even
            // though TMDB's season endpoint resets episode_number to 1. Prefer an
            // exact match (needed by split cours), then fall back to the segment's
            // season-local position for later numbered seasons such as Naruto.
            const metadata = byNumber.get(tmdbEpisode)
                || seasonEpisodes[local - segment.localEpisodeStart];
            if (!metadata) continue;
            mapped.push({
                localEpisode: local,
                tmdbSeason: segment.tmdbSeason,
                tmdbEpisode: metadata.episode_number,
                metadata,
            });
        }
    }
    return mapped;
};

import type { Anime } from '../types/anime';

/**
 * Checks whether an anime is currently airing / releasing.
 */
export function isAnimeAiring(status?: string | null): boolean {
    if (!status) return false;
    const s = String(status).trim().toUpperCase().replace(/_/g, ' ');
    return s === 'RELEASING' || s === 'AIRING' || s === 'CURRENTLY AIRING' || s === 'ONGOING';
}

/**
 * Formats time until airing (seconds) into human readable "in X days", "in X hours", "in X minutes", or "soon".
 */
export function formatTimeUntilAiring(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds <= 0) {
        return 'soon';
    }

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);

    if (days > 0) {
        return `in ${days} day${days === 1 ? '' : 's'}`;
    }

    if (hours > 0) {
        return `in ${hours} hour${hours === 1 ? '' : 's'}`;
    }

    const minutes = Math.max(1, Math.floor((seconds % 3600) / 60));
    return `in ${minutes} minute${minutes === 1 ? '' : 's'}`;
}

/**
 * Formats airing label e.g. "Ep 7 airing in 5 days"
 */
export function getAiringLabel(anime: {
    nextAiringEpisode?: { episode: number; timeUntilAiring?: number; airingAt?: number };
    latestEpisode?: number;
    episodes?: number | null;
}): string {
    if (anime.nextAiringEpisode?.episode) {
        let seconds = anime.nextAiringEpisode.timeUntilAiring;
        if (typeof anime.nextAiringEpisode.airingAt === 'number' && anime.nextAiringEpisode.airingAt > 0) {
            seconds = anime.nextAiringEpisode.airingAt - Math.floor(Date.now() / 1000);
        }
        const timeUntilStr = formatTimeUntilAiring(seconds ?? 0);
        return `Ep ${anime.nextAiringEpisode.episode} airing ${timeUntilStr}`;
    }
    const nextEp = Number(anime.latestEpisode || anime.episodes || 0) + 1;
    if (nextEp > 1) {
        return `Ep ${nextEp} airing soon`;
    }
    return 'Airing now';
}

/**
 * Formats Season and Year string e.g. "Spring 2026"
 */
export function getSeasonYearLabel(season?: string | null, year?: number | string | null): string {
    const s = season ? season.trim() : '';
    const seasonName = s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';
    const y = year ? String(year).trim() : '';
    if (seasonName && y) return `${seasonName} ${y}`;
    if (y) return y;
    return seasonName;
}

export function getStatusLabel(value?: string | null): string {
    if (!value) return 'Details unavailable';

    switch (value) {
        case 'RELEASING':
            return 'Airing now';
        case 'FINISHED':
            return 'Completed';
        case 'NOT_YET_RELEASED':
            return 'Not yet released';
        default:
            return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
    }
}

/**
 * Gets the primary meta label for an anime card/details.
 * If the anime is currently airing, it replaces season and year with "Ep # airing in # days".
 */
export function getDisplayMetaLabel(anime: Partial<Anime>): string {
    if (isAnimeAiring(anime.status)) {
        return getAiringLabel(anime);
    }
    const yearVal = anime.year || (anime.aired?.from ? Number.parseInt(String(anime.aired.from).slice(0, 4), 10) : null);
    const seasonYear = getSeasonYearLabel(anime.season, yearVal);
    if (seasonYear) return seasonYear;
    return getStatusLabel(anime.status);
}

/**
 * Checks whether an individual episode is unreleased based on air date.
 */
export function isEpisodeUnreleased(airDate?: string | null): boolean {
    if (!airDate) return false;
    const time = new Date(airDate).getTime();
    return Number.isFinite(time) && time > Date.now();
}

/**
 * Checks whether an anime series or season is released / aired.
 */
export function isAnimeReleased(anime: Partial<Anime> | null | undefined): boolean {
    if (!anime) return false;
    const status = String(anime.status || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
    if (status === 'NOT_YET_RELEASED') return false;

    if (anime.aired?.from) {
        const time = new Date(anime.aired.from).getTime();
        if (Number.isFinite(time) && time > Date.now()) {
            return false;
        }
    }

    const currentYear = new Date().getFullYear();
    if (anime.year && Number.isFinite(anime.year) && anime.year > currentYear) {
        return false;
    }

    return true;
}

/**
 * Filters out unreleased episodes so unreleased episodes are never displayed.
 */
export function filterReleasedEpisodes<T extends {
    episodeNumber?: string | number;
    airDate?: string | null;
    playbackEpisodeNumber?: number;
    session?: string;
}>(
    episodes: T[],
    options?: {
        status?: string | null;
        latestEpisode?: number | null;
        nextAiringEpisodeNumber?: number | null;
    }
): T[] {
    if (!Array.isArray(episodes) || episodes.length === 0) return [];

    const isNotYetReleased = options?.status?.trim().toUpperCase() === 'NOT_YET_RELEASED';
    if (isNotYetReleased) return [];

    // Find the earliest episode number with a confirmed future air date
    let earliestFutureAirNum = Infinity;
    for (const ep of episodes) {
        if (isEpisodeUnreleased(ep.airDate)) {
            const num = Number(ep.episodeNumber || ep.playbackEpisodeNumber || 0);
            if (num > 0 && num < earliestFutureAirNum) {
                earliestFutureAirNum = num;
            }
        }
    }

    const isAiring = isAnimeAiring(options?.status);
    const knownLatest = Number(options?.latestEpisode || 0);
    const nextAiring = Number(options?.nextAiringEpisodeNumber || 0);

    return episodes.filter((ep, index) => {
        // Direct future air date check
        if (isEpisodeUnreleased(ep.airDate)) {
            return false;
        }

        const epNum = Number(ep.episodeNumber || ep.playbackEpisodeNumber || (index + 1));

        // If an earlier episode has a future air date, any subsequent episode cannot be released
        if (earliestFutureAirNum !== Infinity && epNum >= earliestFutureAirNum) {
            return false;
        }

        // If anime is currently airing, cap by next airing or known latest episode
        if (isAiring) {
            if (nextAiring > 0 && epNum >= nextAiring) {
                return false;
            }
            if (knownLatest > 0 && epNum > knownLatest) {
                return false;
            }
        }

        return true;
    });
}


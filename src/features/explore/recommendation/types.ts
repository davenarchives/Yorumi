import type { ExploreAnimeItem } from '../../../services/exploreService';

export type DiscoveryCategory =
    | 'personalized'
    | 'airing'
    | 'trending'
    | 'classics'
    | 'upcoming'
    | 'experimental';

export type InteractionType =
    | 'watchlist'
    | 'like'
    | 'trailer_complete'
    | 'details_open'
    | 'trailer_replay'
    | 'watch_70'
    | 'quick_skip'
    | 'not_interested';

export interface ExploreInteractionEvent {
    animeId: number;
    type: InteractionType;
    genres?: string[];
    studios?: string[];
    format?: string;
    timestamp: number;
    durationWatchedSec?: number;
    totalDurationSec?: number;
}

export interface UserProfileModel {
    genreScores: Record<string, number>;
    studioScores: Record<string, number>;
    formatScores: Record<string, number>;
    dislikedAnimeIds: number[];
    interactionCount: number;
    lastUpdated: number;
}

export interface ExposureRecord {
    animeId: number;
    timestamp: number;
    sessionId: string;
}

export interface ExploreCandidate extends ExploreAnimeItem {
    baseCategory: DiscoveryCategory;
    eligibleCategories: Set<DiscoveryCategory>;
    studios?: string[];
    tags?: string[];
    score?: number;
    affinityScore?: number;
}

export interface ExploreSession {
    id: string;
    seed: number;
    createdAt: number;
    deliveredIds: number[];
    categoryCounts: Record<DiscoveryCategory, number>;
    cursor: number;
    previousSessionFirst30Ids: Set<number>;
    cooldownRelaxationFactor: number;
}


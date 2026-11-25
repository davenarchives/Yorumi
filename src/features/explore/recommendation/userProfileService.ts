import type { ExploreCandidate, ExploreInteractionEvent, InteractionType, UserProfileModel } from './types';

const STORAGE_KEY = 'yorumi_explore_user_profile';
const HALF_LIFE_DAYS = 14;
const HALF_LIFE_MS = HALF_LIFE_DAYS * 24 * 60 * 60 * 1000;

export const EVENT_WEIGHTS: Record<InteractionType, number> = {
    watchlist: 10,
    like: 7,
    trailer_complete: 6,
    details_open: 5,
    trailer_replay: 4,
    watch_70: 3,
    quick_skip: -2,
    not_interested: -10,
};

const DEFAULT_PROFILE: UserProfileModel = {
    genreScores: {},
    studioScores: {},
    formatScores: {},
    dislikedAnimeIds: [],
    interactionCount: 0,
    lastUpdated: Date.now(),
};

class UserProfileService {
    private profile: UserProfileModel | null = null;

    private getStorage(): Storage | null {
        if (typeof window !== 'undefined' && window.localStorage) {
            return window.localStorage;
        }
        return null;
    }

    public getProfile(): UserProfileModel {
        if (this.profile) return this.profile;

        const storage = this.getStorage();
        if (storage) {
            try {
                const raw = storage.getItem(STORAGE_KEY);
                if (raw) {
                    const parsed = JSON.parse(raw) as UserProfileModel;
                    this.profile = this.applyTimeDecay(parsed);
                    return this.profile;
                }
            } catch (err) {
                console.warn('[UserProfileService] Failed to load user profile:', err);
            }
        }

        // Initialize default and attempt bootstrap from existing library data if available
        this.profile = this.bootstrapFromExistingData({ ...DEFAULT_PROFILE });
        this.saveProfile(this.profile);
        return this.profile;
    }

    private saveProfile(profile: UserProfileModel): void {
        this.profile = profile;
        const storage = this.getStorage();
        if (storage) {
            try {
                storage.setItem(STORAGE_KEY, JSON.stringify(profile));
            } catch (err) {
                console.warn('[UserProfileService] Failed to persist user profile:', err);
            }
        }
    }

    /**
     * Applies exponential time decay to historical genre/studio weights so old preferences
     * gracefully adapt to the user's latest taste.
     */
    public applyTimeDecay(profile: UserProfileModel): UserProfileModel {
        const now = Date.now();
        const elapsed = now - (profile.lastUpdated || now);
        if (elapsed <= 0) return profile;

        // Exponential decay multiplier: 0.5^(elapsed / halfLife)
        const decayFactor = Math.pow(0.5, elapsed / HALF_LIFE_MS);
        if (decayFactor >= 0.98) return profile; // Skip tiny decays

        const decayedGenres: Record<string, number> = {};
        for (const [k, v] of Object.entries(profile.genreScores || {})) {
            const decayed = v * decayFactor;
            if (Math.abs(decayed) > 0.1) decayedGenres[k] = decayed;
        }

        const decayedStudios: Record<string, number> = {};
        for (const [k, v] of Object.entries(profile.studioScores || {})) {
            const decayed = v * decayFactor;
            if (Math.abs(decayed) > 0.1) decayedStudios[k] = decayed;
        }

        const decayedFormats: Record<string, number> = {};
        for (const [k, v] of Object.entries(profile.formatScores || {})) {
            const decayed = v * decayFactor;
            if (Math.abs(decayed) > 0.1) decayedFormats[k] = decayed;
        }

        return {
            ...profile,
            genreScores: decayedGenres,
            studioScores: decayedStudios,
            formatScores: decayedFormats,
            lastUpdated: now,
        };
    }

    /**
     * Cold-start bootstrap: scans existing WatchList and Favorites to seed initial genre weights.
     */
    private bootstrapFromExistingData(profile: UserProfileModel): UserProfileModel {
        const storage = this.getStorage();
        if (!storage) return profile;

        try {
            // Check existing watchlist
            const rawWatchList = storage.getItem('yorumi_watch_list');
            if (rawWatchList) {
                const items = JSON.parse(rawWatchList) as Array<{ genres?: string[] }>;
                if (Array.isArray(items)) {
                    for (const item of items) {
                        for (const genre of item.genres || []) {
                            profile.genreScores[genre] = (profile.genreScores[genre] || 0) + 3;
                        }
                    }
                }
            }

            // Check existing favorites
            const rawFavorites = storage.getItem('yorumi_favorite_anime');
            if (rawFavorites) {
                const favorites = JSON.parse(rawFavorites) as Array<{ id: string }>;
                profile.interactionCount += (favorites?.length || 0);
            }
        } catch {
            // Ignore bootstrap parsing issues
        }

        return profile;
    }

    /**
     * Record an interaction event and update the user's preference model.
     */
    public recordInteraction(event: ExploreInteractionEvent): UserProfileModel {
        const profile = this.getProfile();
        const weight = EVENT_WEIGHTS[event.type] ?? 0;

        // If explicitly not interested, permanently exclude this anime ID
        const disliked = new Set(profile.dislikedAnimeIds || []);
        if (event.type === 'not_interested') {
            disliked.add(event.animeId);
        }

        // Update genres
        const genreScores = { ...profile.genreScores };
        for (const genre of event.genres || []) {
            genreScores[genre] = (genreScores[genre] || 0) + weight;
        }

        // Update studios
        const studioScores = { ...profile.studioScores };
        for (const studio of event.studios || []) {
            studioScores[studio] = (studioScores[studio] || 0) + (weight * 0.5);
        }

        // Update format
        const formatScores = { ...profile.formatScores };
        if (event.format) {
            formatScores[event.format] = (formatScores[event.format] || 0) + (weight * 0.3);
        }

        const updated: UserProfileModel = {
            ...profile,
            genreScores,
            studioScores,
            formatScores,
            dislikedAnimeIds: Array.from(disliked),
            interactionCount: profile.interactionCount + 1,
            lastUpdated: Date.now(),
        };

        this.saveProfile(updated);
        return updated;
    }

    /**
     * Calculate normalized affinity score (0 to 1) for a given candidate anime.
     */
    public calculateAffinityScore(candidate: ExploreCandidate): number {
        const profile = this.getProfile();

        // If explicitly disliked, affinity is zero
        if (profile.dislikedAnimeIds.includes(candidate.id)) {
            return -1;
        }

        let rawScore = 0;
        let count = 0;

        // Genre affinity
        for (const g of candidate.genres || []) {
            const s = profile.genreScores[g];
            if (typeof s === 'number') {
                rawScore += s;
                count++;
            }
        }

        // Studio affinity
        for (const studio of candidate.studios || []) {
            const s = profile.studioScores[studio];
            if (typeof s === 'number') {
                rawScore += s * 0.5;
                count++;
            }
        }

        if (count === 0 || rawScore === 0) {
            return 0.5; // Neutral baseline for cold-start / unrated genres
        }

        // Logistic sigmoid mapping to keep affinity smooth between 0.05 and 0.98
        // rawScore around +20 gives ~0.85, 0 gives 0.5, negative gives <0.5
        const affinity = 1 / (1 + Math.exp(-rawScore / 15));
        return Math.max(0.05, Math.min(0.98, affinity));
    }

    /**
     * Return user's top genres for targeted candidate query replenishment.
     */
    public getTopGenres(limit = 4): string[] {
        const profile = this.getProfile();
        return Object.entries(profile.genreScores || {})
            .filter(([, score]) => score > 2)
            .sort(([, a], [, b]) => b - a)
            .slice(0, limit)
            .map(([genre]) => genre);
    }
}

export const userProfileService = new UserProfileService();


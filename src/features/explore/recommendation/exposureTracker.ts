import type { ExposureRecord } from './types';

const STORAGE_KEY = 'yorumi_explore_exposure_history';
const PREV_SESSION_KEY = 'yorumi_explore_previous_session';
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_HISTORY_AGE_MS = 48 * 60 * 60 * 1000; // 48 hours prune window

class ExposureTracker {
    private history: ExposureRecord[] = [];
    private previousSessionFirst30: number[] = [];
    private loaded = false;

    private getStorage(): Storage | null {
        if (typeof window !== 'undefined' && window.localStorage) {
            return window.localStorage;
        }
        return null;
    }

    private load(): void {
        if (this.loaded) return;
        this.loaded = true;
        const storage = this.getStorage();
        if (!storage) return;

        try {
            const raw = storage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw) as ExposureRecord[];
                const cutoff = Date.now() - MAX_HISTORY_AGE_MS;
                this.history = Array.isArray(parsed)
                    ? parsed.filter((r) => r && typeof r.animeId === 'number' && r.timestamp > cutoff)
                    : [];
            }
        } catch (err) {
            console.warn('[ExposureTracker] Failed to load exposure history:', err);
            this.history = [];
        }

        try {
            const rawPrev = storage.getItem(PREV_SESSION_KEY);
            if (rawPrev) {
                const parsed = JSON.parse(rawPrev) as number[];
                this.previousSessionFirst30 = Array.isArray(parsed) ? parsed : [];
            }
        } catch {
            this.previousSessionFirst30 = [];
        }
    }

    private save(): void {
        const storage = this.getStorage();
        if (!storage) return;

        try {
            // Keep at most 300 recent records
            const recent = this.history.slice(-300);
            storage.setItem(STORAGE_KEY, JSON.stringify(recent));
        } catch (err) {
            console.warn('[ExposureTracker] Failed to save exposure history:', err);
        }
    }

    public recordSessionExposures(sessionId: string, animeIds: number[]): void {
        this.load();
        const now = Date.now();
        for (const id of animeIds) {
            this.history.push({ animeId: id, timestamp: now, sessionId });
        }
        this.save();
    }

    public savePreviousSessionSummary(first30Ids: number[]): void {
        this.load();
        this.previousSessionFirst30 = first30Ids.slice(0, 30);
        const storage = this.getStorage();
        if (storage) {
            try {
                storage.setItem(PREV_SESSION_KEY, JSON.stringify(this.previousSessionFirst30));
            } catch {
                // Ignore
            }
        }
    }

    public getPreviousSessionFirst30(): Set<number> {
        this.load();
        return new Set(this.previousSessionFirst30);
    }

    /**
     * Checks if an anime ID was exposed within the 24-hour cooldown.
     */
    public isRecentlyExposed(animeId: number): boolean {
        this.load();
        const now = Date.now();
        const cutoff = now - COOLDOWN_MS;
        return this.history.some((r) => r.animeId === animeId && r.timestamp > cutoff);
    }

    /**
     * Calculates the exposure penalty to be applied to recommendation scoring.
     * Penalty scale: 0 (unseen) to -100 (heavily exposed).
     * Relaxation factor (0 to 1) dynamically reduces penalties when candidate pool is constrained.
     */
    public getExposurePenalty(
        animeId: number,
        previousSessionFirst30: Set<number>,
        relaxationFactor = 0
    ): number {
        this.load();
        const now = Date.now();
        let penalty = 0;

        // 1. Strongly penalize anime in the immediate previous session's first 30 (to avoid identical sequential top feeds)
        if (previousSessionFirst30.has(animeId)) {
            penalty += 80;
        }

        // 2. Add penalty if exposed within 24 hours
        const recentExposure = this.history.find((r) => r.animeId === animeId && now - r.timestamp < COOLDOWN_MS);
        if (recentExposure) {
            const hoursAgo = (now - recentExposure.timestamp) / (3600 * 1000);
            // Decay penalty over 24 hours: 50 pts at 0h down to 10 pts at 24h
            const timeDecayedPenalty = Math.max(10, 50 * (1 - hoursAgo / 24));
            penalty += timeDecayedPenalty;
        }

        // Cap raw penalty at 100
        const totalPenalty = Math.min(100, penalty);

        // Apply relaxation factor (e.g. relaxationFactor = 0.5 reduces penalty by 50%)
        return totalPenalty * (1 - Math.max(0, Math.min(1, relaxationFactor)));
    }
}

export const exposureTracker = new ExposureTracker();


import type { DiscoveryCategory, ExploreCandidate, ExploreSession } from './types';
import { userProfileService } from './userProfileService';
import { exposureTracker } from './exposureTracker';

export function createPRNG(seed: number) {
    let s = seed | 0;
    return function () {
        s = (s + 0x6D2B79F5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Category distribution targets for balanced, era-diverse discovery
const TARGET_DISTRIBUTION: Array<{ category: DiscoveryCategory; ratio: number }> = [
    { category: 'personalized', ratio: 0.28 },
    { category: 'classics', ratio: 0.25 },
    { category: 'experimental', ratio: 0.17 },
    { category: 'trending', ratio: 0.12 },
    { category: 'airing', ratio: 0.12 },
    { category: 'upcoming', ratio: 0.06 },
];

export class RecommendationEngine {
    /**
     * Calculates the transparent composite score for an anime candidate.
     */
    public scoreCandidate(
        candidate: ExploreCandidate,
        session: ExploreSession,
        prng: () => number
    ): number {
        // 1. Explicitly disliked anime are excluded entirely
        const userProfile = userProfileService.getProfile();
        if (userProfile.dislikedAnimeIds.includes(candidate.id)) {
            return -9999;
        }

        // 2. User interest match (30%)
        const affinity = userProfileService.calculateAffinityScore(candidate);
        const interestScore = affinity * 30;

        // 3. Light release freshness (8..12) so older classics & hidden gems compete fairly
        let freshnessScore = 9;
        if (candidate.status === 'RELEASING') {
            freshnessScore = 12;
        } else if (candidate.status === 'NOT_YET_RELEASED') {
            freshnessScore = 10;
        } else if (candidate.seasonYear && candidate.seasonYear >= new Date().getFullYear() - 2) {
            freshnessScore = 11;
        }

        // 4. Trending / popularity signal (10%)
        const pop = candidate.popularity || 0;
        const normalizedPop = Math.min(1, pop / 150000);
        const trendingScore = normalizedPop * 10;

        // 5. Anime quality / score (14%)
        const qualityNormalized = candidate.averageScore ? candidate.averageScore / 100 : 0.72;
        const qualityScore = qualityNormalized * 14;

        // 6. Discovery potential / novelty (14%)
        const isRecentlySeen = exposureTracker.isRecentlyExposed(candidate.id);
        const discoveryScore = isRecentlySeen ? 0 : 14;

        // 7. Session variety / seeded randomness (22%) so every refresh surfaces a genuinely new mix
        const varietyScore = prng() * 22;

        // Raw Composite Base Score (0 - 100)
        let composite = interestScore + freshnessScore + trendingScore + qualityScore + discoveryScore + varietyScore;

        // Penalties:
        // A) Exposure history penalty (adjusted by relaxation factor when pool is constrained)
        const exposurePenalty = exposureTracker.getExposurePenalty(
            candidate.id,
            session.previousSessionFirst30Ids,
            session.cooldownRelaxationFactor
        );
        composite -= exposurePenalty;

        // B) Prioritize playable video trailers (slight soft penalty if trailer is missing)
        if (!candidate.trailer?.id) {
            composite -= 20;
        }

        return composite;
    }

    /**
     * Initializes a brand-new, unique Explore recommendation session.
     */
    public createSession(): ExploreSession {
        const id = `exp_sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const seed = Math.floor(Math.random() * 2147483647);
        const previousSessionFirst30Ids = exposureTracker.getPreviousSessionFirst30();

        return {
            id,
            seed,
            createdAt: Date.now(),
            deliveredIds: [],
            categoryCounts: {
                personalized: 0,
                airing: 0,
                trending: 0,
                classics: 0,
                upcoming: 0,
                experimental: 0,
            },
            cursor: 0,
            previousSessionFirst30Ids,
            cooldownRelaxationFactor: 0,
        };
    }

    /**
     * Generates a ranked, deduplicated, and category-balanced batch of anime for the current session.
     */
    public getNextBatch(
        session: ExploreSession,
        allCandidates: ExploreCandidate[],
        batchSize = 20
    ): { items: ExploreCandidate[]; hasMore: boolean } {
        const prng = createPRNG(session.seed + session.cursor);

        // Filter out anime already delivered in this session
        const deliveredSet = new Set(session.deliveredIds);
        let eligible = allCandidates.filter((c) => !deliveredSet.has(c.id));

        // If the pool is running low, dynamically relax exposure cooldowns
        if (eligible.length < batchSize && session.cooldownRelaxationFactor < 1) {
            session.cooldownRelaxationFactor = Math.min(1, session.cooldownRelaxationFactor + 0.5);
        }

        // Score each candidate
        const scored = eligible.map((candidate) => {
            const score = this.scoreCandidate(candidate, session, prng);
            return {
                ...candidate,
                score,
                rawScore: score,
            };
        }).filter((c) => (c.score || 0) > -1000); // Discard disliked items

        // Partition scored candidates into category buckets
        const buckets: Record<DiscoveryCategory, ExploreCandidate[]> = {
            personalized: [],
            airing: [],
            trending: [],
            classics: [],
            upcoming: [],
            experimental: [],
        };

        for (const item of scored) {
            if (item.eligibleCategories.has('airing')) buckets.airing.push(item);
            if (item.eligibleCategories.has('trending')) buckets.trending.push(item);
            if (item.eligibleCategories.has('classics')) buckets.classics.push(item);
            if (item.eligibleCategories.has('upcoming')) buckets.upcoming.push(item);
            if (item.eligibleCategories.has('personalized')) buckets.personalized.push(item);
            if (item.eligibleCategories.has('experimental')) buckets.experimental.push(item);
        }

        // Sort each bucket by composite score (with slight seeded PRNG perturbation for diversity)
        for (const cat of Object.keys(buckets) as DiscoveryCategory[]) {
            buckets[cat].sort((a, b) => {
                const perturbA = (a.score || 0) + (prng() * 4 - 2);
                const perturbB = (b.score || 0) + (prng() * 4 - 2);
                return perturbB - perturbA;
            });
        }

        // Interleave categories to fulfill target distribution
        const selectedItems: ExploreCandidate[] = [];
        const selectedIds = new Set<number>();

        // Build target count map for this batch
        const targetCounts = TARGET_DISTRIBUTION.map(({ category, ratio }) => ({
            category,
            count: Math.max(1, Math.round(batchSize * ratio)),
        }));

        // Fill based on target distribution
        for (const { category, count } of targetCounts) {
            if (selectedItems.length >= batchSize) break;
            let addedForCat = 0;
            const bucket = buckets[category];
            for (const item of bucket) {
                if (selectedItems.length >= batchSize) break;
                if (addedForCat >= count) break;
                if (!selectedIds.has(item.id)) {
                    selectedIds.add(item.id);
                    selectedItems.push({ ...item, baseCategory: category });
                    session.categoryCounts[category]++;
                    addedForCat++;
                }
            }
        }

        // If batch is not full yet, backfill with remaining highest-scored items from any category
        if (selectedItems.length < batchSize) {
            scored.sort((a, b) => (b.score || 0) - (a.score || 0));
            for (const item of scored) {
                if (selectedItems.length >= batchSize) break;
                if (!selectedIds.has(item.id)) {
                    selectedIds.add(item.id);
                    selectedItems.push(item);
                }
            }
        }

        // Apply anti-clustering diversity pass: avoid 3 consecutive items of the exact same primary genre
        const diversified: ExploreCandidate[] = [];
        const poolToOrder = [...selectedItems];

        while (poolToOrder.length > 0) {
            const last = diversified[diversified.length - 1];
            const secondLast = diversified[diversified.length - 2];
            const forbiddenGenre = (last && secondLast && last.genres[0] && last.genres[0] === secondLast.genres[0])
                ? last.genres[0]
                : null;

            let pickIndex = 0;
            if (forbiddenGenre) {
                const altIndex = poolToOrder.findIndex((it) => it.genres[0] !== forbiddenGenre);
                if (altIndex !== -1) pickIndex = altIndex;
            }

            const [picked] = poolToOrder.splice(pickIndex, 1);
            diversified.push(picked);
        }

        // Update session state
        for (const item of diversified) {
            session.deliveredIds.push(item.id);
        }
        session.cursor += diversified.length;

        // Record in exposure tracker
        exposureTracker.recordSessionExposures(session.id, diversified.map((it) => it.id));

        // If this is the start of the session, remember first 30 for consecutive session repulsion
        if (session.deliveredIds.length <= batchSize) {
            exposureTracker.savePreviousSessionSummary(session.deliveredIds.slice(0, 30));
        }

        const remainingCount = allCandidates.filter((c) => !deliveredSet.has(c.id)).length;
        const hasMore = remainingCount > 0;

        return {
            items: diversified,
            hasMore,
        };
    }
}

export const recommendationEngine = new RecommendationEngine();

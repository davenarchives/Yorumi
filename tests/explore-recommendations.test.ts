import assert from 'node:assert/strict';
import test from 'node:test';
import { RecommendationEngine, createPRNG } from '../src/features/explore/recommendation/recommendationEngine';
import { userProfileService } from '../src/features/explore/recommendation/userProfileService';
import { exposureTracker } from '../src/features/explore/recommendation/exposureTracker';
import type { ExploreCandidate, DiscoveryCategory } from '../src/features/explore/recommendation/types';

// Helper to generate a mock candidate
function createMockCandidate(id: number, overrides: Partial<ExploreCandidate> = {}): ExploreCandidate {
    const baseCategory: DiscoveryCategory = overrides.baseCategory || 'trending';
    const eligible = overrides.eligibleCategories || new Set<DiscoveryCategory>([baseCategory, 'personalized', 'experimental']);

    return {
        id,
        idMal: id + 1000,
        title: `Anime ${id}`,
        coverImage: `https://example.com/cover-${id}.jpg`,
        synopsis: `Synopsis for anime ${id}`,
        genres: overrides.genres || ['Action', 'Adventure'],
        episodesCount: 12,
        duration: 24,
        averageScore: overrides.averageScore ?? 80,
        popularity: overrides.popularity ?? 50000,
        status: overrides.status || 'FINISHED',
        seasonYear: overrides.seasonYear ?? 2024,
        studios: overrides.studios || ['Mappa'],
        baseCategory,
        eligibleCategories: eligible,
        trailer: { id: `trailer-${id}`, site: 'youtube' },
        ...overrides,
    };
}

// Generate a rich synthetic pool of 60 candidates across all discovery categories
function generateMockPool(): ExploreCandidate[] {
    const pool: ExploreCandidate[] = [];

    // 15 Airing
    for (let i = 1; i <= 15; i++) {
        pool.push(createMockCandidate(100 + i, {
            status: 'RELEASING',
            seasonYear: 2026,
            genres: i % 2 === 0 ? ['Action', 'Fantasy'] : ['Romance', 'Comedy'],
            baseCategory: 'airing',
            eligibleCategories: new Set(['airing', 'trending', 'personalized', 'experimental']),
        }));
    }

    // 15 Trending
    for (let i = 1; i <= 15; i++) {
        pool.push(createMockCandidate(200 + i, {
            popularity: 90000 + i * 1000,
            genres: i % 3 === 0 ? ['Sci-Fi', 'Mystery'] : ['Action', 'Drama'],
            baseCategory: 'trending',
            eligibleCategories: new Set(['trending', 'personalized', 'experimental']),
        }));
    }

    // 15 Classics
    for (let i = 1; i <= 15; i++) {
        pool.push(createMockCandidate(300 + i, {
            averageScore: 88 + (i % 8),
            seasonYear: 2005 + i,
            genres: ['Drama', 'Supernatural'],
            baseCategory: 'classics',
            eligibleCategories: new Set(['classics', 'personalized', 'experimental']),
        }));
    }

    // 15 Upcoming
    for (let i = 1; i <= 15; i++) {
        pool.push(createMockCandidate(400 + i, {
            status: 'NOT_YET_RELEASED',
            seasonYear: 2027,
            genres: ['Fantasy', 'Adventure'],
            baseCategory: 'upcoming',
            eligibleCategories: new Set(['upcoming', 'personalized', 'experimental']),
        }));
    }

    return pool;
}

test('PRNG produces deterministic outputs for identical seeds and differs for distinct seeds', () => {
    const prng1 = createPRNG(42);
    const prng2 = createPRNG(42);
    const prng3 = createPRNG(999);

    assert.equal(prng1(), prng2());
    assert.notEqual(prng1(), prng3());
});

test('Test A: Different feed generated on consecutive visits', () => {
    const engine = new RecommendationEngine();
    const pool = generateMockPool();

    const sessionA = engine.createSession();
    const batchA = engine.getNextBatch(sessionA, pool, 20);

    const sessionB = engine.createSession();
    const batchB = engine.getNextBatch(sessionB, pool, 20);

    assert.notEqual(sessionA.id, sessionB.id, 'Session IDs must be unique');
    assert.notEqual(sessionA.seed, sessionB.seed, 'Session seeds must differ');

    const idsA = batchA.items.map((it) => it.id);
    const idsB = batchB.items.map((it) => it.id);

    // Feeds should not be identical sequences
    const identicalCount = idsA.filter((id, idx) => idsB[idx] === id).length;
    assert.ok(identicalCount < 5, `Expected high sequence diversity between visits, got ${identicalCount} matches`);
});

test('Test B: Consecutive sessions produce varied sequences without single-item repetition domination', () => {
    const engine = new RecommendationEngine();
    const pool = generateMockPool();

    const firstItemIds: number[] = [];

    for (let i = 0; i < 5; i++) {
        const session = engine.createSession();
        const batch = engine.getNextBatch(session, pool, 15);
        assert.ok(batch.items.length > 0, 'Batch must not be empty');
        firstItemIds.push(batch.items[0].id);
    }

    // Check that one single anime does not dominate all 5 sessions as the first item
    const uniqueFirsts = new Set(firstItemIds);
    assert.ok(uniqueFirsts.size >= 3, `Expected at least 3 distinct first recommendations across 5 visits, got ${uniqueFirsts.size}`);
});

test('Test C: Personalization updates interest model and boosts relevant content', () => {
    const engine = new RecommendationEngine();
    const session = engine.createSession();
    const prng = createPRNG(12345);

    // Initial baseline
    const fantasyAnime = createMockCandidate(801, { genres: ['Fantasy', 'Magic'] });
    const mechaAnime = createMockCandidate(802, { genres: ['Mecha', 'Sci-Fi'] });

    const initialFantasyScore = engine.scoreCandidate(fantasyAnime, session, prng);

    // User likes & watchlists Fantasy anime
    userProfileService.recordInteraction({
        animeId: 999,
        type: 'watchlist',
        genres: ['Fantasy', 'Magic'],
        timestamp: Date.now(),
    });
    userProfileService.recordInteraction({
        animeId: 998,
        type: 'like',
        genres: ['Fantasy', 'Magic'],
        timestamp: Date.now(),
    });

    const boostedFantasyScore = engine.scoreCandidate(fantasyAnime, session, prng);
    const mechaScore = engine.scoreCandidate(mechaAnime, session, prng);

    assert.ok(boostedFantasyScore > initialFantasyScore, 'Fantasy score should increase after user likes and watchlists Fantasy anime');
    assert.ok(boostedFantasyScore > mechaScore, 'Fantasy score should now outrank neutral Mecha genre');
});

test('Test D: Seasonal relevance gives boost to currently airing titles', () => {
    const engine = new RecommendationEngine();
    const session = engine.createSession();
    const prng = createPRNG(777);

    const airing = createMockCandidate(501, { status: 'RELEASING', seasonYear: 2026, popularity: 50000 });
    const finishedOld = createMockCandidate(502, { status: 'FINISHED', seasonYear: 2012, popularity: 50000 });

    const scoreAiring = engine.scoreCandidate(airing, session, prng);
    const scoreOld = engine.scoreCandidate(finishedOld, session, prng);

    assert.ok(scoreAiring > scoreOld, 'Currently airing anime must receive higher freshness score than decade-old finished anime');
});

test('Test E: Older anime & classics are recommended and not disqualified', () => {
    const engine = new RecommendationEngine();
    const session = engine.createSession();
    const pool = generateMockPool();

    const batch = engine.getNextBatch(session, pool, 25);
    const hasClassics = batch.items.some((it) => it.baseCategory === 'classics' || (it.seasonYear && it.seasonYear < 2020));

    assert.ok(hasClassics, 'Recommendations must surface older acclaimed anime and classics in the feed');
});

test('Test F: Pagination preserves delivered items and prevents duplicates', () => {
    const engine = new RecommendationEngine();
    const session = engine.createSession();
    const pool = generateMockPool();

    const batch1 = engine.getNextBatch(session, pool, 15);
    const batch2 = engine.getNextBatch(session, pool, 15);

    const ids1 = new Set(batch1.items.map((it) => it.id));
    const duplicates = batch2.items.filter((it) => ids1.has(it.id));

    assert.equal(duplicates.length, 0, 'Subsequent pagination batch must contain zero duplicates from earlier batches');
    assert.equal(session.deliveredIds.length, 30, 'Delivered IDs tracking must match delivered count');
});

test('Test G: Disliked / Not Interested anime are strictly excluded', () => {
    const engine = new RecommendationEngine();
    const session = engine.createSession();
    const candidate = createMockCandidate(666);

    // Mark as not interested
    userProfileService.recordInteraction({
        animeId: 666,
        type: 'not_interested',
        timestamp: Date.now(),
    });

    const prng = createPRNG(1);
    const score = engine.scoreCandidate(candidate, session, prng);
    assert.equal(score, -9999, 'Disliked anime must be assigned negative sentinel score to guarantee exclusion');
});

test('Test H: Limited candidate pool gracefully relaxes exposure penalties without producing empty feed', () => {
    const engine = new RecommendationEngine();
    const session = engine.createSession();

    // Small pool of only 10 anime
    const smallPool = [
        createMockCandidate(1),
        createMockCandidate(2),
        createMockCandidate(3),
        createMockCandidate(4),
        createMockCandidate(5),
    ];

    // Simulate heavy exposure history for all of them
    exposureTracker.recordSessionExposures('old_session', [1, 2, 3, 4, 5]);

    // Request batch of 5
    const batch = engine.getNextBatch(session, smallPool, 5);
    assert.equal(batch.items.length, 5, 'Feed must not be empty even when entire pool was recently exposed');
});


import assert from 'node:assert/strict';
import test from 'node:test';
import type { Anime } from '../src/types/anime';
import { compareAnimeFranchiseEntries, isAnimeFranchiseEntry } from '../src/utils/animeFranchise';

const entry = (id: number, title: string, type: string, from?: string, status = 'Finished Airing'): Anime => ({
    id,
    mal_id: id,
    title,
    images: { jpg: { image_url: '', large_image_url: '' } },
    score: 0,
    status,
    type,
    episodes: null,
    aired: { from },
});

test('SPY x FAMILY timeline keeps only canonical TV continuations', () => {
    const entries = [
        entry(5, 'SPY x FAMILY Season 3', 'TV', '2025-10-04'),
        entry(3, 'SPY x FAMILY Season 2', 'TV', '2023-10-07'),
        entry(2, 'SPY x FAMILY Cour 2', 'TV', '2022-10-1'),
        entry(1, 'SPY x FAMILY', 'TV', '2022-4-9'),
    ];

    assert.deepEqual(entries.sort(compareAnimeFranchiseEntries).map((item) => item.id), [1, 2, 3, 5]);
});

test('Mushoku Tensei timeline keeps only TV parts that have started airing', () => {
    const entries = [
        entry(7, 'Mushoku Tensei III Part 2', 'TV', '2027-01-01', 'Not yet aired'),
        entry(1, 'Mushoku Tensei', 'TV', '2021-1-11'),
        entry(2, 'Mushoku Tensei Cour 2', 'TV', '2021-10-4'),
        entry(4, 'Mushoku Tensei Season 2', 'TV', '2023-7-10'),
        entry(5, 'Mushoku Tensei Season 2 Part 2', 'TV', '2024-4-8'),
        entry(6, 'Mushoku Tensei Season 3', 'TV', '2026-7-1'),
    ];

    const releasedEntries = entries.filter(isAnimeFranchiseEntry);
    assert.deepEqual(releasedEntries.sort(compareAnimeFranchiseEntries).map((item) => item.id), [1, 2, 4, 5, 6]);
});

test('franchise chips reject side-story media formats', () => {
    assert.equal(isAnimeFranchiseEntry(entry(1, 'Theme Song', 'MUSIC', '2024-01-01')), false);
    assert.equal(isAnimeFranchiseEntry(entry(2, 'Season ONA', 'ONA', '2024-01-01')), false);
    assert.equal(isAnimeFranchiseEntry(entry(3, 'Season OVA', 'OVA', '2024-01-01')), false);
    assert.equal(isAnimeFranchiseEntry(entry(4, 'Series Continuation', 'TV', '2024-01-01')), true);
});

test('franchise chips reject future TV seasons regardless of status metadata', () => {
    const futureYear = new Date().getFullYear() + 1;
    assert.equal(isAnimeFranchiseEntry(entry(1, 'Upcoming Season', 'TV', `${futureYear}-01-01`, 'NOT_YET_RELEASED')), false);
    assert.equal(isAnimeFranchiseEntry(entry(2, 'Future Dated Season', 'TV', `${futureYear}-01-01`, 'RELEASING')), false);
});

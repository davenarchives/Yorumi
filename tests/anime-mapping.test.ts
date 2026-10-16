import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAnimeMappingIndexes } from '../backend/src/api/anime/anime-mapping.service';
import {
    isPrimaryAnimeMapping,
    mapLocalEpisodeToTmdb,
    mapTmdbMetadataToLocalEpisodes,
} from '../src/utils/animeEpisodeMapping';
import type { TmdbEpisode } from '../src/services/tmdbService';
import { buildAnimeSeasonLabels, getMeaningfulTmdbSeasonLabel } from '../src/utils/animeSeasonLabels';

const fixture = {
    $meta: { schema_version: '3.0.3', generated_on: '2026-10-11' },
    'anilist:151970': {
        'mal:52347': {},
        'tmdb_show:205050:s1': { '1-25': '1-25' },
    },
    'anilist:176508': {
        'mal:58572': {},
        'tmdb_show:205050:s1': { '1-25': '26-50' },
    },
    'anilist:20': {
        'mal:20': {},
        'tmdb_show:46260:s1': { '1-52': '1-52' },
        'tmdb_show:46260:s2': { '53-104': '53-104' },
        'tmdb_show:46260:s3': { '105-158': '105-158' },
        'tmdb_show:46260:s4': { '159-220': '159-220' },
    },
    'anilist:999999': {
        'tmdb_show:1:s1': { '1-12': '1-24' },
    },
    'anilist:176496': {
        'mal:58567': {},
        'tmdb_show:127532:s1': { '1-13': '13-25' },
        'tmdb_show:127532:s2': { '1-13': '1-13' },
    },
} as Parameters<typeof buildAnimeMappingIndexes>[0];

test('AniBridge indexing keeps Shangri-La Frontier cours as separate 25-episode entries', () => {
    const indexes = buildAnimeMappingIndexes(fixture);
    const mappings = indexes.byTmdbShow.get(205050) || [];

    assert.deepEqual(mappings.map((mapping) => mapping.anilistId), [151970, 176508]);
    assert.deepEqual(mappings.map((mapping) => mapping.segments[0]), [
        { tmdbSeason: 1, tmdbEpisodeStart: 1, tmdbEpisodeEnd: 25, localEpisodeStart: 1, localEpisodeEnd: 25 },
        { tmdbSeason: 1, tmdbEpisodeStart: 26, tmdbEpisodeEnd: 50, localEpisodeStart: 1, localEpisodeEnd: 25 },
    ]);
});

test('Naruto remains one 220-episode title while spanning four TMDB seasons', () => {
    const mapping = buildAnimeMappingIndexes(fixture).byAniList.get(20);

    assert.equal(mapping?.status, 'verified');
    assert.equal(mapping?.segments.length, 4);
    assert.deepEqual(mapLocalEpisodeToTmdb(mapping?.segments || [], 220), { season: 4, episode: 220 });
});

test('non-1:1 mappings are surfaced as conflicts instead of guessed', () => {
    const mapping = buildAnimeMappingIndexes(fixture).byAniList.get(999999);

    assert.equal(mapping?.status, 'conflicting');
    assert.equal(mapping?.segments.length, 0);
    assert.match(mapping?.conflicts[0] || '', /Non-1:1 range/);
});

test('overlapping TMDB alternatives are not treated as verified season boundaries', () => {
    const mapping = buildAnimeMappingIndexes(fixture).byAniList.get(176496);

    assert.equal(mapping?.status, 'conflicting');
    assert.match(mapping?.conflicts[0] || '', /Overlapping local ranges/);
});

test('TMDB metadata is projected back onto local episode numbers', () => {
    const mapping = buildAnimeMappingIndexes(fixture).byAniList.get(176508);
    const tmdbEpisodes = Array.from({ length: 50 }, (_, index) => ({
        id: index + 1,
        episode_number: index + 1,
        season_number: 1,
        name: `Episode ${index + 1}`,
    })) as TmdbEpisode[];
    const projected = mapTmdbMetadataToLocalEpisodes(
        mapping?.segments || [],
        new Map([[1, tmdbEpisodes]])
    );

    assert.equal(projected.length, 25);
    assert.equal(projected[0]?.localEpisode, 1);
    assert.equal(projected[0]?.tmdbEpisode, 26);
    assert.equal(projected[24]?.localEpisode, 25);
    assert.equal(projected[24]?.tmdbEpisode, 50);
});

test('show-absolute AniBridge ranges fall back to TMDB season-local episode numbers', () => {
    const mapping = buildAnimeMappingIndexes(fixture).byAniList.get(20);
    const seasonTwoEpisodes = Array.from({ length: 52 }, (_, index) => ({
        id: 1000 + index,
        episode_number: index + 1,
        season_number: 2,
        name: `Episode ${index + 53}`,
    })) as TmdbEpisode[];
    const projected = mapTmdbMetadataToLocalEpisodes(
        mapping?.segments || [],
        new Map([[2, seasonTwoEpisodes]])
    );

    assert.equal(projected.length, 52);
    assert.equal(projected[0]?.localEpisode, 53);
    assert.equal(projected[0]?.tmdbEpisode, 1);
    assert.equal(projected[51]?.localEpisode, 104);
    assert.equal(projected[51]?.tmdbEpisode, 52);
});

test('TMDB Season 0 mappings do not become ordinary season chips', () => {
    assert.equal(isPrimaryAnimeMapping([{
        tmdbSeason: 0,
        tmdbEpisodeStart: 1,
        tmdbEpisodeEnd: 9,
        localEpisodeStart: 1,
        localEpisodeEnd: 9,
    }]), false);
    assert.equal(isPrimaryAnimeMapping([{
        tmdbSeason: 1,
        tmdbEpisodeStart: 26,
        tmdbEpisodeEnd: 50,
        localEpisodeStart: 1,
        localEpisodeEnd: 25,
    }]), true);
});

test('season labels keep cours and parts inside their logical season', () => {
    assert.deepEqual(buildAnimeSeasonLabels([
        'SPY x FAMILY',
        'SPY x FAMILY Cour 2',
        'SPY x FAMILY Season 2',
        'SPY x FAMILY Season 3',
    ]), [
        'Season 1',
        'Season 1 Cour 2',
        'Season 2',
        'Season 3',
    ]);
});

test('genuinely named sequels retain their canonical titles', () => {
    assert.deepEqual(buildAnimeSeasonLabels([
        'Naruto',
        'Naruto: Shippuden',
        'Boruto: Naruto Next Generations',
    ]), [
        'Naruto',
        'Naruto: Shippuden',
        'Boruto: Naruto Next Generations',
    ]);
});

test('Mushoku Tensei labels preserve cours and parts without inventing seasons', () => {
    assert.deepEqual(buildAnimeSeasonLabels([
        'Mushoku Tensei: Jobless Reincarnation',
        'Mushoku Tensei: Jobless Reincarnation Cour 2',
        'Mushoku Tensei: Jobless Reincarnation Season 2',
        'Mushoku Tensei: Jobless Reincarnation Season 2 Part 2',
        'Mushoku Tensei: Jobless Reincarnation Season 3',
        'Mushoku Tensei III: Isekai Ittara Honki Dasu Part 2',
    ]), [
        'Season 1',
        'Season 1 Cour 2',
        'Season 2',
        'Season 2 Part 2',
        'Season 3',
        'Season 3 Part 2',
    ]);
});

test('TMDB arc names are preserved generically without title-specific rules', () => {
    assert.equal(getMeaningfulTmdbSeasonLabel({ season_number: 1, name: 'East Blue' }), 'East Blue');
    assert.equal(getMeaningfulTmdbSeasonLabel({ season_number: 2, name: 'Season 2' }), 'Season 2');
});

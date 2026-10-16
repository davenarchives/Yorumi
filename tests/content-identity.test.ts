import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildProviderKey,
    buildYorumiId,
    getCanonicalIdentityKey,
} from '../src/utils/contentIdentity';
import {
    detectNovelEdition,
    isConfirmedNovelMatch,
    normalizeNovelTitle,
} from '../src/utils/novelIdentity';
import { getAnimeDetailsRouteId } from '../src/utils/animeNavigation';
import { arePlayerAnimeIdsEquivalent } from '../src/utils/playerIdentity';
import { extractExplicitSeasonNumber, isSafeTitleMatch } from '../backend/src/scraper/hianime';
import {
    extractLocalHiAnimeSeasonNumber,
    isSafeLocalHiAnimeTitleMatch,
} from '../src/platform/sources/hianime';
import { hasSeasonNavigation } from '../src/utils/seasonNavigation';
import { selectEnglishSubtitleTracks } from '../src/utils/subtitles';
import { getDownloadEpisodeNumbers } from '../src/utils/episodeWatchKey';

test('canonical content IDs remain provider-qualified', () => {
    assert.equal(buildYorumiId('manga', 'AniList', 30013), 'manga:anilist:30013');
    assert.equal(buildProviderKey('MangaKatana', 'one-piece'), 'mangakatana:one-piece');
    assert.equal(
        getCanonicalIdentityKey('manga', { mangakatana: 'one-piece', anilist: 30013 }, ['anilist', 'mangakatana']),
        'manga:anilist:30013'
    );
});

test('TMDB player identities remain prefixed and cannot collide with AniList IDs', () => {
    assert.equal(getAnimeDetailsRouteId({ id: 0, mal_id: 0, tmdbId: 205050, source: 'tmdb' }), 'tmdb-205050');
    assert.equal(getAnimeDetailsRouteId({ id: 205050, mal_id: 0, source: 'anilist' }), 'al-205050');
});

test('latest-update cards prefer their exact AniList identity over scraper sessions', () => {
    assert.equal(getAnimeDetailsRouteId({
        id: 0,
        anilistId: 152677,
        mal_id: 0,
        scraperId: 'am-y4biiKQXdWqwSmRwD',
        source: 'scraper',
    }), 'al-152677');
});

test('persistent player never reuses Naruto for Shangri-La Frontier', () => {
    assert.equal(arePlayerAnimeIdsEquivalent('al-20', 'tmdb-205050'), false);
    assert.equal(arePlayerAnimeIdsEquivalent('tmdb-205050', 'tmdb-205050'), true);
    assert.equal(arePlayerAnimeIdsEquivalent('al-205050', 'tmdb-205050'), false);
});

test('stream title matching never collapses separate anime seasons', () => {
    assert.equal(extractExplicitSeasonNumber('Welcome to Demon School! Iruma-kun Season 3'), 3);
    assert.equal(extractExplicitSeasonNumber('Mob Psycho 100'), 0);
    assert.equal(extractExplicitSeasonNumber('86'), 0);
    assert.equal(isSafeTitleMatch(
        'Welcome to Demon School! Iruma-kun Season 2',
        'Welcome to Demon School! Iruma-kun'
    ), false);
    assert.equal(isSafeTitleMatch(
        'Welcome to Demon School! Iruma-kun Season 2',
        'Welcome to Demon School! Iruma-kun 2nd Season'
    ), true);
});

test('mobile HiAnime matching keeps season episode lists isolated', () => {
    assert.equal(extractLocalHiAnimeSeasonNumber('With Vengeance, Sincerely, Your Broken Saintess Season 2'), 2);
    assert.equal(isSafeLocalHiAnimeTitleMatch(
        'With Vengeance, Sincerely, Your Broken Saintess',
        'With Vengeance, Sincerely, Your Broken Saintess Season 2'
    ), false);
    assert.equal(isSafeLocalHiAnimeTitleMatch(
        'With Vengeance, Sincerely, Your Broken Saintess Season 2',
        'With Vengeance, Sincerely, Your Broken Saintess 2nd Season'
    ), true);
});

test('standalone anime do not render a redundant season chip', () => {
    const standalone = [{ id: 1, label: 'Standalone Anime', title: 'Standalone Anime', isActive: true }];
    const franchise = [...standalone, { id: 2, label: 'Season 2', title: 'Standalone Anime Season 2', isActive: false }];
    assert.equal(hasSeasonNavigation(standalone), false);
    assert.equal(hasSeasonNavigation(franchise), true);
});

test('download status does not reuse a season-local episode number across TMDB seasons', () => {
    assert.deepEqual(getDownloadEpisodeNumbers({
        episodeNumber: '1',
        tmdbSeason: 1,
        tmdbEpisode: 1,
        playbackEpisodeNumber: 1,
        _tmdbAbsolute: 1,
    }), [1]);
    assert.deepEqual(getDownloadEpisodeNumbers({
        episodeNumber: '1',
        tmdbSeason: 2,
        tmdbEpisode: 1,
        playbackEpisodeNumber: 24,
        _tmdbAbsolute: 24,
    }), [24]);
});

test('player exposes exactly one English subtitle track', () => {
    const selected = selectEnglishSubtitleTracks([
        { lang: 'ar', url: 'arabic.vtt' },
        { lang: 'en', url: 'english.vtt' },
        { lang: 'en-signs', url: 'signs.vtt' },
    ]);
    assert.deepEqual(selected, [{ lang: 'en', url: 'english.vtt', default: true }]);
});

test('light-novel and web-novel editions are not silently collapsed', () => {
    assert.equal(detectNovelEdition('Example Story (Light Novel)'), 'light-novel');
    assert.equal(detectNovelEdition('Example Story Web Novel'), 'web-novel');
    assert.equal(
        isConfirmedNovelMatch(['Example Story Light Novel'], 'Example Story Web Novel', 'light-novel'),
        false
    );
    assert.equal(
        isConfirmedNovelMatch(['Example Story Light Novel'], 'Example Story Light Novel', 'light-novel'),
        true
    );
    assert.notEqual(normalizeNovelTitle('Example Story Light Novel'), normalizeNovelTitle('Example Story Web Novel'));
});

test('unknown-edition candidates may match by title but remain edition-addressable', () => {
    assert.equal(isConfirmedNovelMatch(['Ascendance of a Bookworm'], 'Ascendance of a Bookworm'), true);
    assert.equal(detectNovelEdition('Ascendance of a Bookworm'), 'unknown');
});

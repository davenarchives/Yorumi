import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDirectMangaPage } from '../backend/src/scraper/mangakatana';

test('recognizes a MangaKatana search redirect to a manga details page', () => {
    const result = parseDirectMangaPage('<html><head><link rel="canonical" href="https://mangakatana.com/manga/the-greatest-estate-developer.25916"><meta property="og:image" content="https://mangakatana.com/cover.jpg"></head><body><h1 class="heading">The Greatest Estate Developer</h1></body></html>');
    assert.equal(result?.id, 'the-greatest-estate-developer.25916');
    assert.equal(result?.title, 'The Greatest Estate Developer');
});

test('does not treat search pages or external canonical links as manga results', () => {
    assert.equal(parseDirectMangaPage('<link rel="canonical" href="https://mangakatana.com/?search=example"><h1 class="heading">Example</h1>'), null);
    assert.equal(parseDirectMangaPage('<link rel="canonical" href="https://example.com/manga/example.1"><h1 class="heading">Example</h1>'), null);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { getPrimaryMangaAuthor } from '../src/utils/mangaAuthor';

test('prefers the story author over translation and art credits', () => {
    assert.equal(getPrimaryMangaAuthor({ author: 'Other', authors: [
        { mal_id: 1, name: 'Translator', role: 'Translation' },
        { mal_id: 2, name: 'Creator', role: 'Story & Art' },
    ] }), 'Creator');
});

test('uses one source author or the first available credit as fallback', () => {
    assert.equal(getPrimaryMangaAuthor({ author: 'First Author, Second Author' }), 'First Author');
    assert.equal(getPrimaryMangaAuthor({ authors: [{ mal_id: 1, name: 'First' }, { mal_id: 2, name: 'Second' }] }), 'First');
});

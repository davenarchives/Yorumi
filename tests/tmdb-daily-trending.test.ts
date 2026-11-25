import { test } from 'node:test';
import { deepStrictEqual, strictEqual } from 'node:assert';
import { tmdbService } from '../src/services/tmdbService';

test('daily ranking filters and deduplicates TMDB pages without changing their order', async () => {
    const values = new Map<string, string>([['yorumi_tmdb_read_access_token', 'test-token']]);
    const originalStorage = globalThis.localStorage;
    const originalFetch = globalThis.fetch;
    const originalWindow = globalThis.window;
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { setTimeout, clearTimeout } });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
    } });
    const seen: string[] = [];
    globalThis.fetch = async (input) => {
        const url = String(input);
        seen.push(url);
        const page = new URL(url).searchParams.get('page');
        const anime = (id: number, media_type = 'tv') => ({ id, media_type, genre_ids: [16], original_language: 'ja' });
        const results = page === '1'
            ? [anime(1), { id: 10, media_type: 'tv', genre_ids: [18], original_language: 'ja' }, anime(1), anime(2, 'movie')]
            : [anime(3)];
        return new Response(JSON.stringify({ results }), { status: 200, headers: { 'content-type': 'application/json' } });
    };
    try {
        const results = await tmdbService.getDailyTrendingAnime(3);
        deepStrictEqual(results.map((item) => [item.media_type, item.id]), [['tv', 1], ['movie', 2], ['tv', 3]]);
        strictEqual(seen.length, 2);
        strictEqual(seen.every((url) => url.includes('/trending/all/day?')), true);
    } finally {
        globalThis.fetch = originalFetch;
        Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
        Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: originalStorage });
    }
});

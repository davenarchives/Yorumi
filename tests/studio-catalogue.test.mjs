import { test } from 'node:test';
import { deepStrictEqual } from 'node:assert';
import { groupStudioAnime } from '../src/utils/studioCatalogue.ts';

const anime = (id, type, year, edges = []) => ({ id, type, year, relations: { edges: edges.map(([relationType, relatedId, format]) => ({ relationType, node: { id: relatedId, format } })) } });

test('shows main titles, groups seasons and film editions, and keeps distinct films', () => {
    const titles = [
        anime(1, 'MOVIE', 2025, [['PREQUEL', 10, 'TV']]),
        anime(13, 'SPECIAL', 2023, [['PREQUEL', 12, 'TV']]),
        anime(13, 'SPECIAL', 2023, [['PREQUEL', 12, 'TV']]),
        anime(11, 'TV', 2021, [['SEQUEL', 12, 'TV']]),
        anime(12, 'TV', 2022, [['PREQUEL', 11, 'TV'], ['SEQUEL', 13, 'SPECIAL']]),
        anime(10, 'TV', 2022),
        anime(20, 'TV', 2021),
        anime(21, 'TV', 2022),
        anime(30, 'ONA', 2025),
        anime(31, 'ONA', 2023, [['PARENT', 11, 'TV']]),
        anime(40, 'MOVIE', 2019, [['ALTERNATIVE', 41, 'MOVIE']]),
        anime(41, 'MOVIE', 2016, [['ALTERNATIVE', 40, 'MOVIE']]),
        anime(42, 'MOVIE', 2021, [['PREQUEL', 10, 'TV']]),
    ];
    deepStrictEqual(groupStudioAnime(titles).map((entry) => entry.id), [1, 11, 10, 20, 21, 41, 42]);
});

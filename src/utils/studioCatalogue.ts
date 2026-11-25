import type { Anime } from '../types/anime';

/** AniList can return the same media more than once for a studio. */
export function uniqueStudioAnime(items: Anime[]): Anime[] {
    const seen = new Set<number>();
    return items.filter((anime) => {
        const id = anime.anilistId || anime.id;
        if (!id) return true;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
    });
}

/** Keep main TV series and films, grouping explicitly linked seasons and film editions. */
export function groupStudioAnime(items: Anime[]): Anime[] {
    const unique = uniqueStudioAnime(items);
    const parents = new Map<number, number>();
    const find = (id: number): number => {
        const parent = parents.get(id);
        if (parent === undefined) { parents.set(id, id); return id; }
        if (parent === id) return id;
        const root = find(parent);
        parents.set(id, root);
        return root;
    };
    const formats = new Set(['TV', 'TV_SHORT', 'ONA', 'OVA', 'SPECIAL']);
    for (const anime of unique) {
        const id = anime.anilistId || anime.id;
        const format = String(anime.type || '').toUpperCase();
        if (!id) continue;
        for (const edge of anime.relations?.edges || []) {
            const relatedFormat = String(edge.node.format || '').toUpperCase();
            const linkedSeasons = formats.has(format) && formats.has(relatedFormat) && ['PREQUEL', 'SEQUEL'].includes(edge.relationType);
            const alternateFilm = format === 'MOVIE' && relatedFormat === 'MOVIE' && edge.relationType === 'ALTERNATIVE';
            if (!linkedSeasons && !alternateFilm) continue;
            if (edge.node.id) parents.set(find(edge.node.id), find(id));
        }
    }
    const groups = new Map<number, Anime[]>();
    for (const anime of unique) {
        const id = anime.anilistId || anime.id;
        if (!id || !['TV', 'MOVIE'].includes(String(anime.type || '').toUpperCase())) continue;
        const root = find(id);
        const group = groups.get(root) || [];
        group.push(anime);
        groups.set(root, group);
    }
    const emitted = new Set<number>();
    return unique.flatMap((anime) => {
        const id = anime.anilistId || anime.id;
        if (!id || !['TV', 'MOVIE'].includes(String(anime.type || '').toUpperCase())) return [];
        const root = find(id);
        if (emitted.has(root)) return [];
        emitted.add(root);
        return [[...(groups.get(root) || [anime])].sort((a, b) => {
            return (a.year || Infinity) - (b.year || Infinity);
        })[0]];
    });
}

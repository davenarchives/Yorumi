import type { Anime } from '../types/anime';
import { isAnimeReleased } from './animeAiring';

const FRANCHISE_FORMATS = new Set(['TV', 'TV_SHORT']);

export const getAnimeFranchiseTitle = (item: Partial<Anime>) =>
    item.title_english || item.title || item.title_romaji || item.title_japanese || 'Unknown';

export const isAnimeFranchiseEntry = (item: Partial<Anime>) =>
    Number(item.id || 0) > 0
    && FRANCHISE_FORMATS.has(String(item.type || '').toUpperCase())
    && isAnimeReleased(item);

export const getAnimeFranchiseSortDate = (item: Partial<Anime>) => {
    const [dateYear = 0, dateMonth = 0, dateDay = 0] = String(item.aired?.from || '')
        .split('-')
        .map((value) => Number(value || 0));
    const year = Number(item.year || dateYear || 0);
    const month = Number(dateMonth || 0);
    const day = Number(dateDay || 0);
    return {
        year: year > 0 ? year : Number.MAX_SAFE_INTEGER,
        month: month > 0 ? month : 13,
        day: day > 0 ? day : 32,
    };
};

export const compareAnimeFranchiseEntries = (left: Partial<Anime>, right: Partial<Anime>) => {
    const leftDate = getAnimeFranchiseSortDate(left);
    const rightDate = getAnimeFranchiseSortDate(right);
    if (leftDate.year !== rightDate.year) return leftDate.year - rightDate.year;
    if (leftDate.month !== rightDate.month) return leftDate.month - rightDate.month;
    if (leftDate.day !== rightDate.day) return leftDate.day - rightDate.day;
    return getAnimeFranchiseTitle(left).localeCompare(getAnimeFranchiseTitle(right), undefined, { numeric: true });
};

import type { Manga } from '../types/manga';

export function getPrimaryMangaAuthor(manga: Pick<Manga, 'author' | 'authors'>): string {
    const authors = (manga.authors || []).filter((entry) => entry.name?.trim() && entry.name.trim().toLowerCase() !== 'unknown');
    const storyAuthor = authors.find((entry) => /\b(story|author|writer|original creator)\b/i.test(entry.role || ''));
    if (storyAuthor) return storyAuthor.name.trim();
    const sourceAuthor = manga.author?.split(/[,;?]/)[0]?.trim();
    return sourceAuthor && sourceAuthor.toLowerCase() !== 'unknown' ? sourceAuthor : authors[0]?.name.trim() || '';
}

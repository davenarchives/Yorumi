import { invoke } from '@tauri-apps/api/core';
import { isTauri, isNativeMobile } from '../runtime';

export const supportsReadingExports = () => isTauri() && !isNativeMobile() &&
    (typeof navigator === 'undefined' || !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent));

type ReadingIdentity = { title: string; id: string; chapter: string; chapterId: string };
export const exportMangaPage = (identity: ReadingIdentity, page: { number: number; extension: string; bytes: number[] }) =>
    invoke<boolean>('export_manga_chapter', { ...identity, pages: [page] });
export const exportNovelChapter = (identity: ReadingIdentity, content: string) =>
    invoke<boolean>('export_novel_chapter', { ...identity, content });
export const deleteReadingExport = (category: 'Manga' | 'LightNovels', identity: ReadingIdentity) =>
    invoke<boolean>('delete_reading_export', { category, ...identity });

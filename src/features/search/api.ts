import { animeService } from '../../services/animeService';
import { mangaService } from '../../services/mangaService';
import { tmdbService } from '../../services/tmdbService';
import type { TitleLanguage } from '../../context/TitleLanguageContext';
import { getDisplayTitle, getSecondaryTitle } from '../../utils/titleLanguage';
import type { Anime } from '../../types/anime';
import type { Manga } from '../../types/manga';
import { API_BASE } from '../../config/api';

export interface SearchPreviewItem {
    id: string | number;
    title: string;
    subtitle: string;
    image: string;
    date: string | number | undefined;
    type: string | undefined;
    duration: string | null;
    score?: number;
    status?: string;
    nextAiringEpisode?: { episode: number; timeUntilAiring: number };
    latestEpisode?: number;
    episodes?: number | null;
    url: string;
    manga?: any;
    ln?: any;
    raw?: any;
}

type PreviewAnime = Anime & {
    year?: string | number;
    anilist_cover_image?: string;
};

type PreviewManga = Manga & {
    latestChapter?: string;
};

export const searchApi = {
    async getAnimePreview(rawQuery: string, language: TitleLanguage) {
        const query = rawQuery.replace(/\s+movie$/i, '').trim() || rawQuery;
        if (sessionStorage.getItem('_yrm_vlt_s') === 'unlocked') {
            try {
                const res = await fetch(`${API_BASE}/vault/anime/search?q=${encodeURIComponent(query)}`);
                const json = await res.json();
                if (json.success) {
                    return json.data.slice(0, 6).map((item: any) => ({
                        id: item.id,
                        title: item.title,
                        subtitle: item.releaseDate ? new Date(item.releaseDate).getFullYear().toString() : 'OVA',
                        image: item.image,
                        date: item.releaseDate,
                        type: item.type,
                        duration: null,
                        score: null,
                        url: `/anime/details/${encodeURIComponent(item.scraperId)}`
                    }));
                }
            } catch (e) {
                console.error('[Vault] Anime Search Error:', e);
            }
        }

        if (!tmdbService.hasToken()) {
            const { data } = await animeService.searchAnime(query, 1, 6);
            return (data as PreviewAnime[]).slice(0, 4).map((item) => ({
                id: item.id || item.mal_id,
                title: getDisplayTitle(item as unknown as Record<string, unknown>, language),
                subtitle: getSecondaryTitle(item as unknown as Record<string, unknown>, language),
                image: item.images?.jpg?.large_image_url || item.images?.jpg?.image_url || item.anilist_cover_image || '',
                date: item.aired?.string ? item.aired.string : item.year,
                type: item.type,
                duration: item.duration || null,
                score: item.score,
                status: item.status,
                nextAiringEpisode: item.nextAiringEpisode,
                latestEpisode: item.latestEpisode,
                episodes: item.episodes,
                raw: item,
                url: `/anime/details/${item.id || item.mal_id}`,
                manga: item,
            })) as SearchPreviewItem[];
        }

        const results = await tmdbService.searchMulti(query);
        const animeResults = results.filter(tmdbService.isAnimeContent).slice(0, 6);

        return animeResults.map((item) => {
            const isMovie = item.media_type === 'movie';
            const dateStr = item.release_date || item.first_air_date;
            const year = dateStr ? new Date(dateStr).getFullYear() : undefined;
            const displayTitle = language === 'eng'
                ? (item.name || item.title || item.original_name || item.original_title || '')
                : (item.original_name || item.original_title || item.name || item.title || '');
            const secondaryTitle = language === 'eng'
                ? (item.original_name || item.original_title || '')
                : (item.name || item.title || '');

            return {
                id: item.id,
                title: displayTitle,
                subtitle: secondaryTitle,
                image: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : '',
                date: year,
                type: isMovie ? 'MOVIE' : 'TV',
                duration: null,
                score: item.vote_average ? item.vote_average : undefined,
                url: `/anime/details/tmdb-${item.id}`,
                manga: item,
            };
        }) as SearchPreviewItem[];
    },

    async getMangaPreview(query: string, language: TitleLanguage) {
        if (sessionStorage.getItem('_yrm_vlt_s') === 'unlocked') {
            try {
                const res = await fetch(`${API_BASE}/vault/manga/search?q=${encodeURIComponent(query)}`);
                const json = await res.json();
                if (json.success) {
                    return json.data.slice(0, 6).map((item: any) => ({
                        id: item.id,
                        title: item.title,
                        subtitle: item.rating ? `★ ${item.rating}` : 'Manga',
                        image: item.image,
                        date: item.date,
                        type: item.type,
                        duration: null,
                        score: item.rating ? parseFloat(item.rating) : undefined,
                        url: `/manga/details/${encodeURIComponent(item.scraperId)}`,
                        manga: item,
                    }));
                }
            } catch (e) {
                console.error('[Vault] Manga Search Error:', e);
            }
        }

        const { data } = await mangaService.searchManga(query, 1, 6);
        return (data as PreviewManga[]).slice(0, 4).map((item) => ({
            id: item.id || item.mal_id,
            title: getDisplayTitle(item as unknown as Record<string, unknown>, language),
            subtitle: item.chapters ? `Chapters: ${item.chapters}` : getSecondaryTitle(item as unknown as Record<string, unknown>, language),
            image: item.images?.jpg?.image_url || '',
            date: item.published?.string
                ? item.published.string
                : '',
            type: item.type,
            duration: null,
            score: item.score,
            url: `/manga/details/${item.id || item.mal_id}`,
            manga: item,
        })) as SearchPreviewItem[];
    },

    async getLNPreview(query: string, language: TitleLanguage) {
        const { lnService } = await import('../../services/lnService');
        const items = await lnService.searchNovels(query);
        return items.slice(0, 8).map((item) => ({
            id: item.id,
            title: getDisplayTitle(item as unknown as Record<string, unknown>, language),
            subtitle: item.author || getSecondaryTitle(item as unknown as Record<string, unknown>, language),
            image: item.images?.jpg?.large_image_url || item.images?.jpg?.image_url || '',
            date: item.countryOfOrigin === 'KR' ? 'Korean WN' : item.countryOfOrigin === 'CN' ? 'Chinese WN' : 'Japanese LN',
            type: item.countryOfOrigin === 'KR' ? 'KR (WN)' : item.countryOfOrigin === 'CN' ? 'CN (WN)' : (item.type || 'NOVEL'),
            duration: null,
            score: item.score,
            url: `/ln/details/${item.id}`,
            ln: item,
            manga: item,
        })) as SearchPreviewItem[];
    },
};

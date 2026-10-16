import { animeService } from '../../services/animeService';
import { mangaService } from '../../services/mangaService';
import { tmdbService } from '../../services/tmdbService';
import type { TitleLanguage } from '../../context/TitleLanguageContext';
import { getDisplayTitle, getSecondaryTitle } from '../../utils/titleLanguage';
import type { Anime } from '../../types/anime';
import type { Manga } from '../../types/manga';
import { API_BASE, USES_LOCAL_SOURCES } from '../../config/api';
import { getAnimeDetailsRouteId } from '../../utils/animeNavigation';

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

export const getAnimeSearchSeed = (item: SearchPreviewItem): Anime => {
    const raw = (item.raw || item.manga || {}) as Partial<Anime> & Record<string, unknown>;
    const tmdbMatch = item.url.match(/\/anime\/details\/tmdb-(\d+)/i);
    const tmdbId = Number(raw.tmdbId || tmdbMatch?.[1] || 0);
    const isTmdb = Number.isFinite(tmdbId) && tmdbId > 0;
    const anilistId = Number(raw.id || (!isTmdb ? item.id : 0) || 0);
    const malId = Number(raw.mal_id || 0);

    return {
        ...(raw as Partial<Anime>),
        id: Number.isFinite(anilistId) && anilistId > 0 ? anilistId : 0,
        mal_id: Number.isFinite(malId) && malId > 0 ? malId : 0,
        tmdbId: isTmdb ? tmdbId : undefined,
        source: Number.isFinite(anilistId) && anilistId > 0 ? 'anilist' : (isTmdb ? 'tmdb' : 'anilist'),
        title: raw.title || item.title,
        title_english: raw.title_english || item.title,
        title_romaji: raw.title_romaji || item.subtitle || item.title,
        type: String(raw.type || item.type || 'TV'),
        score: Number(raw.score || item.score || 0),
        status: String(raw.status || item.status || 'Unknown'),
        episodes: Number(raw.episodes || item.episodes || 0) || null,
        images: raw.images || {
            jpg: {
                image_url: item.image,
                large_image_url: item.image,
            },
        },
    } as Anime;
};

type PreviewAnime = Anime & {
    year?: string | number;
    anilist_cover_image?: string;
};

type PreviewManga = Manga & {
    latestChapter?: string;
};

export const searchApi = {
    async getAnimePreview(rawQuery: string, language: TitleLanguage, limit = 8) {
        const query = rawQuery.replace(/\s+movie$/i, '').trim() || rawQuery;
        if (!USES_LOCAL_SOURCES && sessionStorage.getItem('_yrm_vlt_s') === 'unlocked') {
            try {
                const res = await fetch(`${API_BASE}/vault/anime/search?q=${encodeURIComponent(query)}`);
                const json = await res.json();
                if (json.success) {
                    return json.data.slice(0, limit).map((item: any) => {
                        const scraperId = String(item.scraperId || item.id || '').trim();
                        return {
                            id: scraperId,
                            title: item.title,
                            subtitle: item.releaseDate ? new Date(item.releaseDate).getFullYear().toString() : 'OVA',
                            image: item.image,
                            date: item.releaseDate,
                            type: item.type,
                            duration: null,
                            score: null,
                            raw: {
                                ...item,
                                id: 0,
                                mal_id: 0,
                                scraperId,
                                source: 'scraper',
                                images: { jpg: { image_url: item.image, large_image_url: item.image } },
                            },
                            url: `/anime/details/${encodeURIComponent(`s:${scraperId}`)}`,
                        };
                    });
                }
            } catch (e) {
                console.error('[Vault] Anime Search Error:', e);
            }
        }

        try {
            const { data } = await animeService.searchAnime(query, 1, limit);
            if (data && data.length > 0) {
                return (data as PreviewAnime[]).flatMap((item): SearchPreviewItem[] => {
                    const routeId = getAnimeDetailsRouteId(item);
                    if (!routeId) return [];
                    return [{
                        id: routeId,
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
                        url: `/anime/details/${encodeURIComponent(routeId)}`,
                    }];
                });
            }
        } catch {
            // TMDB below remains a bounded fallback when AniList/backend is unavailable.
        }

        const results = await tmdbService.searchMulti(query).catch(() => []);
        return results.filter(tmdbService.isAnimeContent).slice(0, limit).map((item) => {
            const isMovie = item.media_type === 'movie';
            const dateStr = item.release_date || item.first_air_date;
            const year = dateStr ? new Date(dateStr).getFullYear() : undefined;
            const displayTitle = language === 'eng'
                ? (item.name || item.title || item.original_name || item.original_title || '')
                : (item.original_name || item.original_title || item.name || item.title || '');
            const secondaryTitle = language === 'eng'
                ? (item.original_name || item.original_title || '')
                : (item.name || item.title || '');
            const anime: Partial<Anime> = {
                id: 0,
                mal_id: 0,
                tmdbId: item.id,
                source: 'tmdb',
                title: displayTitle,
                title_english: item.name || item.title || displayTitle,
                title_romaji: item.original_name || item.original_title || secondaryTitle,
                images: {
                    jpg: {
                        image_url: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : '',
                        large_image_url: item.poster_path ? `https://image.tmdb.org/t/p/w780${item.poster_path}` : '',
                    },
                },
                score: item.vote_average ? Math.round(item.vote_average * 10) / 10 : 0,
                status: 'FINISHED',
                type: isMovie ? 'MOVIE' : 'TV',
                episodes: isMovie ? 1 : null,
                year,
            };

            return {
                id: item.id,
                title: displayTitle,
                subtitle: secondaryTitle,
                image: anime.images?.jpg.large_image_url || '',
                date: year,
                type: anime.type,
                duration: null,
                score: anime.score,
                url: `/anime/details/tmdb-${item.id}`,
                raw: anime,
            };
        }) as SearchPreviewItem[];
    },

    async getMangaPreview(query: string, language: TitleLanguage, limit = 8) {
        if (!USES_LOCAL_SOURCES && sessionStorage.getItem('_yrm_vlt_s') === 'unlocked') {
            try {
                const res = await fetch(`${API_BASE}/vault/manga/search?q=${encodeURIComponent(query)}`);
                const json = await res.json();
                if (json.success) {
                    return json.data.slice(0, limit).map((item: any) => ({
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

        let data: Manga[] = [];
        if (USES_LOCAL_SOURCES) {
            const scraperResult = await mangaService.searchMangaScraper(query, 1, limit).catch(() => ({ data: [] as Manga[] }));
            data = scraperResult.data || [];
            if (data.length === 0) {
                const catalogResult = await mangaService.searchManga(query, 1, limit).catch(() => ({ data: [] as Manga[] }));
                data = catalogResult.data || [];
            }
        } else {
            const catalogResult = await mangaService.searchManga(query, 1, limit);
            data = catalogResult.data || [];
        }
        return (data as PreviewManga[]).slice(0, limit).map((item) => ({
            id: item.id || item.mal_id,
            title: getDisplayTitle(item as unknown as Record<string, unknown>, language),
            subtitle: item.chapters ? `Chapters: ${item.chapters}` : getSecondaryTitle(item as unknown as Record<string, unknown>, language),
            image: item.images?.jpg?.large_image_url || item.images?.jpg?.image_url || '',
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

    async getLNPreview(query: string, language: TitleLanguage, limit = 8) {
        const { lnService } = await import('../../services/lnService');
        const items = await lnService.searchNovels(query);
        return items.slice(0, limit).map((item) => ({
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

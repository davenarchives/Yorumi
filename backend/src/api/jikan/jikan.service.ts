import axios from 'axios';

const JIKAN_API_URL = 'https://api.jikan.moe/v4';

// Simple delay helper to avoid hitting Jikan rate limits too hard
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const fetchJikan = async (endpoint: string, params: any = {}) => {
    try {
        await delay(500); // 0.5s delay between requests to be safe
        const response = await axios.get(`${JIKAN_API_URL}${endpoint}`, { params });
        return response.data;
    } catch (error: any) {
        console.error(`Jikan API Error (${endpoint}):`, error.response?.data || error.message);
        throw error;
    }
};

// --- Mappers ---

const mapAnime = (item: any) => ({
    mal_id: item.mal_id,
    title: item.title,
    title_japanese: item.title_japanese,
    images: {
        jpg: {
            image_url: item.images.jpg.image_url,
            large_image_url: item.images.jpg.large_image_url
        }
    },
    score: item.score,
    rank: item.rank,
    status: item.status,
    type: item.type,
    episodes: item.episodes,
    year: item.year,
    synopsis: item.synopsis,
    genres: item.genres?.map((g: any) => ({ mal_id: g.mal_id, name: g.name })) || [],
    studios: item.studios?.map((s: any) => ({ mal_id: s.mal_id, name: s.name })) || [],
    producers: item.producers?.map((p: any) => ({ mal_id: p.mal_id, name: p.name })) || [],
    aired: {
        from: item.aired?.from,
        to: item.aired?.to,
        string: item.aired?.string
    },
    duration: item.duration,
    rating: item.rating,
    season: item.season
});

const mapManga = (item: any) => ({
    mal_id: item.mal_id,
    title: item.title,
    title_japanese: item.title_japanese,
    images: {
        jpg: {
            image_url: item.images.jpg.image_url,
            large_image_url: item.images.jpg.large_image_url
        }
    },
    score: item.score,
    rank: item.rank,
    status: item.status,
    type: item.type,
    chapters: item.chapters,
    volumes: item.volumes,
    synopsis: item.synopsis,
    genres: item.genres?.map((g: any) => ({ mal_id: g.mal_id, name: g.name })) || [],
    authors: item.authors?.map((a: any) => ({ mal_id: a.mal_id, name: a.name })) || [],
    published: {
        from: item.published?.from,
        to: item.published?.to,
        string: item.published?.string
    }
});


// --- Anime Service Methods ---

export const searchAnime = async (query: string, page: number = 1, limit: number = 24) => {
    // Jikan supports pagination natively
    const data = await fetchJikan('/anime', { q: query, page, limit, sfw: true });
    return {
        data: data.data.map(mapAnime),
        pagination: data.pagination
    };
};

export const getTopAnime = async (page: number = 1, limit: number = 24) => {
    const data = await fetchJikan('/top/anime', { page, limit });
    return {
        data: data.data.map(mapAnime),
        pagination: data.pagination
    };
};

export const getAnimeById = async (id: number) => {
    const data = await fetchJikan(`/anime/${id}/full`);
    return { data: mapAnime(data.data) };
};


// --- Manga Service Methods ---

export const searchManga = async (query: string, page: number = 1, limit: number = 24) => {
    const data = await fetchJikan('/manga', { q: query, page, limit, sfw: true });
    return {
        data: data.data.map(mapManga),
        pagination: data.pagination
    };
};

export const getTopManga = async (page: number = 1, limit: number = 24) => {
    const data = await fetchJikan('/top/manga', { page, limit });
    return {
        data: data.data.map(mapManga),
        pagination: data.pagination
    };
};

export const getMangaById = async (id: number) => {
    const data = await fetchJikan(`/manga/${id}/full`);
    return { data: mapManga(data.data) };
};


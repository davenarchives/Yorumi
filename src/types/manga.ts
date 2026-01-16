export interface Manga {
    id?: number; // AniList ID
    mal_id: number | string;
    title: string;
    title_english?: string; // For fallback search
    title_romaji?: string;  // For fallback search
    title_native?: string;  // For display/fallback
    images: {
        jpg: {
            image_url: string;
            large_image_url: string;
        };
    };
    score: number;
    rank?: number;
    status: string;
    type: string;
    chapters: number | null;
    volumes: number | null;
    synopsis?: string;
    genres?: { mal_id: number; name: string; }[];
    authors?: { mal_id: number; name: string; }[];
    published?: {
        from?: string;
        to?: string;
        string?: string;
    };
    countryOfOrigin?: string;
}

export interface MangaChapter {
    id: string;
    title: string;
    url: string;
    uploadDate: string;
}

export interface MangaPage {
    pageNumber: number;
    imageUrl: string;
}

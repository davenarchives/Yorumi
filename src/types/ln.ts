export interface LightNovel {
    [key: string]: any;
    id: number | string;
    mal_id?: number | string;
    title: string;
    title_english?: string;
    title_romaji?: string;
    title_native?: string;
    images: {
        jpg: {
            image_url: string;
            large_image_url: string;
        };
    };
    score?: number;
    rank?: number;
    status?: string;
    type?: string;
    chapters?: number | null;
    volumes?: number | null;
    synopsis?: string;
    author?: string;
    genres?: { mal_id: number; name: string }[];
    synonyms?: string[];
    scraper_id?: string;
    bannerImage?: string;
    relations?: {
        edges: {
            relationType: string;
            node: {
                id: number;
                title: { romaji: string; english?: string; native?: string };
                coverImage: { large: string };
                format: string;
                type: string;
            };
        }[];
    };
    recommendations?: {
        nodes: {
            mediaRecommendation: {
                id: number;
                title: { romaji: string; english?: string };
                coverImage: { large: string };
                type: string;
                format: string;
            };
        }[];
    };
}

export interface LNChapter {
    id: string;
    number: number;
    title: string;
    url: string;
    releaseDate?: string;
}

export interface LNChapterContent {
    id: string;
    novelId: string;
    title: string;
    chapterNumber: number;
    content: string;
    prevChapterId?: string | null;
    nextChapterId?: string | null;
}

export interface LNReaderSettings {
    fontSize: number; // in px e.g. 18
    lineHeight: number; // e.g. 1.6
    fontFamily: 'sans' | 'serif' | 'mono';
    theme: 'dark' | 'sepia' | 'midnight' | 'oled';
    maxWidth: 'narrow' | 'medium' | 'wide' | 'full';
}

export interface LNReadListItem {
    id: string | number;
    title: string;
    image: string;
    score?: number;
    mediaStatus?: string;
    type?: string;
    totalCount?: number | null;
    genres?: string[];
    synopsis?: string;
    addedAt: string;
}

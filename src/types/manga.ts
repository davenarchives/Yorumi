import type { ContentAvailability, ExternalIds, MappingStatus } from '../utils/contentIdentity';

export interface Manga {
    id?: number | string; // AniList ID or Scraper ID
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
    score?: number;
    rank?: number;
    status?: string;
    type?: string;
    chapters?: number | null;
    volumes?: number | null;
    synopsis?: string;
    views?: string;
    author?: string;
    artist?: string;
    genres?: { mal_id: number; name: string; }[];
    authors?: { mal_id: number; name: string; }[];
    published?: {
        from?: string;
        to?: string;
        string?: string;
    };
    countryOfOrigin?: string;
    synonyms?: string[];
    scraper_id?: string;
    yorumiId?: string;
    externalIds?: ExternalIds;
    mappingStatus?: MappingStatus;
    readingProvider?: string;
    characters?: {
        edges: {
            role: string;
            node: {
                id: number;
                name: { full: string };
                image: { large: string };
            };
            voiceActors: { // Optional for Manga
                id: number;
                name: { full: string };
                image: { large: string };
                languageV2: string;
            }[];
        }[];
    };
    relations?: {
        edges: {
            relationType: string;
            node: {
                id: number;
                title: { romaji: string; english?: string; native?: string };
                coverImage: { large: string };
                format: string;
            };
        }[];
    };
}

export interface MangaChapter {
    id: string;
    title: string;
    url: string;
    uploadDate: string;
    provider?: string;
    providerId?: string;
    language?: string;
    volume?: string;
    number?: number;
    availability?: ContentAvailability;
}

export interface MangaPage {
    pageNumber: number;
    imageUrl: string;
}

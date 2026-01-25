large_image_url: string;
    };
};
score: number;
rank ?: number;
status: string;
type: string;
episodes: number | null;
year ?: number;
synopsis ?: string;
genres ?: { mal_id: number; name: string; }[];
studios ?: { mal_id: number; name: string; }[];
producers ?: { mal_id: number; name: string; }[];
aired ?: {
    from?: string;
    to?: string;
    string?: string;
};
duration ?: string;
rating ?: string;
season ?: string;

anilist_banner_image ?: string;
anilist_cover_image ?: string;
logoUrl ?: string; // Fanart.tv logo URL
logoSource ?: 'fanart' | 'fallback'; // Source of the logo
latestEpisode ?: number; // For ongoing anime - the latest aired episode
nextAiringEpisode ?: {
    episode: number;
    timeUntilAiring: number;
};
characters ?: {
    edges: {
        role: string;
        node: {
            id: number;
            name: { full: string };
            image: { large: string };
        };
        voiceActors: {
            id: number;
            name: { full: string };
            image: { large: string };
            languageV2: string;
        }[];
    }[];
};
trailer ?: {
    id: string; // Youtube ID
    site: string;
    thumbnail: string;
};
episodeMetadata ?: {
    title: string;
    thumbnail: string;
    url: string;
    site: string;
}[];
relations ?: {
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
countryOfOrigin ?: string;
scraperId ?: string; // ID from HiAnime/Scraper if not matched to AniList
}

export interface Episode {
    session: string;
    episodeNumber: string;
    duration?: string;
    title?: string;
}

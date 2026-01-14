import axios from 'axios';

const ANILIST_API_URL = 'https://graphql.anilist.co';

// Common media fields fragment
const MEDIA_FIELDS = `
    id
    idMal
    title {
        romaji
        english
        native
    }
    description
    bannerImage
    coverImage {
        extraLarge
        large
    }
    format
    episodes
    chapters
    volumes
    duration
    status
    season
    seasonYear
    startDate {
        year
        month
        day
    }
    endDate {
        year
        month
        day
    }
    averageScore
    meanScore
    popularity
    genres
    studios(isMain: true) {
        nodes {
            name
        }
    }
    isAdult
    nextAiringEpisode {
        episode
        airingAt
    }
    streamingEpisodes {
        title
        thumbnail
        url
        site
    }
`;

export const anilistService = {
    async getCoverImages(malIds: number[]) {
        const query = `
            query ($idMal: [Int]) {
                Page {
                    media(idMal_in: $idMal, type: ANIME) {
                        idMal
                        bannerImage
                        coverImage {
                            extraLarge
                            large
                        }
                    }
                }
            }
        `;

        try {
            const response = await axios.post(ANILIST_API_URL, {
                query,
                variables: { idMal: malIds }
            });

            return response.data.data.Page.media;
        } catch (error) {
            console.error('Error fetching AniList images:', error);
            return [];
        }
    },

    async getTrendingAnime(page: number = 1, perPage: number = 10) {
        const query = `
            query ($page: Int, $perPage: Int) {
                Page(page: $page, perPage: $perPage) {
                    pageInfo {
                        total
                        currentPage
                        lastPage
                        hasNextPage
                    }
                    media(type: ANIME, sort: TRENDING_DESC) {
                        ${MEDIA_FIELDS}
                    }
                }
            }
        `;

        try {
            const response = await axios.post(ANILIST_API_URL, {
                query,
                variables: { page, perPage }
            });
            return response.data.data.Page;
        } catch (error) {
            console.error('Error fetching trending anime:', error);
            return { media: [], pageInfo: {} };
        }
    },

    async getPopularThisSeason(page: number = 1, perPage: number = 10) {
        // Get current season and year
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();
        let season: string;
        if (month >= 1 && month <= 3) season = 'WINTER';
        else if (month >= 4 && month <= 6) season = 'SPRING';
        else if (month >= 7 && month <= 9) season = 'SUMMER';
        else season = 'FALL';

        const query = `
            query ($page: Int, $perPage: Int, $season: MediaSeason, $seasonYear: Int) {
                Page(page: $page, perPage: $perPage) {
                    pageInfo {
                        total
                        currentPage
                        lastPage
                        hasNextPage
                    }
                    media(type: ANIME, season: $season, seasonYear: $seasonYear, sort: POPULARITY_DESC) {
                        ${MEDIA_FIELDS}
                    }
                }
            }
        `;

        try {
            const response = await axios.post(ANILIST_API_URL, {
                query,
                variables: { page, perPage, season, seasonYear: year }
            });
            return response.data.data.Page;
        } catch (error) {
            console.error('Error fetching popular this season:', error);
            return { media: [], pageInfo: {} };
        }
    },

    async getTopAnime(page: number = 1, perPage: number = 24) {
        const query = `
            query ($page: Int, $perPage: Int) {
                Page(page: $page, perPage: $perPage) {
                    pageInfo {
                        total
                        currentPage
                        lastPage
                        hasNextPage
                    }
                    media(type: ANIME, sort: POPULARITY_DESC) {
                        ${MEDIA_FIELDS}
                    }
                }
            }
        `;

        try {
            const response = await axios.post(ANILIST_API_URL, {
                query,
                variables: { page, perPage }
            });
            return response.data.data.Page;
        } catch (error) {
            console.error('Error fetching top anime:', error);
            throw error; // Propagate error to route handler
        }
    },

    async getTopManga(page: number = 1, perPage: number = 24) {
        const query = `
            query ($page: Int, $perPage: Int) {
                Page(page: $page, perPage: $perPage) {
                    pageInfo {
                        total
                        currentPage
                        lastPage
                        hasNextPage
                    }
                    media(type: MANGA, sort: POPULARITY_DESC) {
                        ${MEDIA_FIELDS}
                    }
                }
            }
        `;

        try {
            const response = await axios.post(ANILIST_API_URL, {
                query,
                variables: { page, perPage }
            });
            return response.data.data.Page;
        } catch (error) {
            console.error('Error fetching top manga:', error);
            return { media: [], pageInfo: {} };
        }
    },

    async searchAnime(search: string, page: number = 1, perPage: number = 24) {
        const query = `
            query ($search: String, $page: Int, $perPage: Int) {
                Page(page: $page, perPage: $perPage) {
                    pageInfo {
                        total
                        currentPage
                        lastPage
                        hasNextPage
                    }
                    media(search: $search, type: ANIME, sort: SEARCH_MATCH, isAdult: false) {
                        ${MEDIA_FIELDS}
                    }
                }
            }
        `;

        try {
            const response = await axios.post(ANILIST_API_URL, {
                query,
                variables: { search, page, perPage }
            });

            const pageData = response.data.data.Page;
            // Recalculate lastPage to ensure it matches the actual perPage limit
            if (pageData.pageInfo && pageData.pageInfo.total) {
                pageData.pageInfo.lastPage = Math.ceil(pageData.pageInfo.total / perPage);
                // Also ensure hasNextPage is accurate
                pageData.pageInfo.hasNextPage = page < pageData.pageInfo.lastPage;
            }

            return pageData;
        } catch (error) {
            console.error('Error searching AniList:', error);
            return { media: [], pageInfo: {} };
        }
    },

    async searchManga(search: string, page: number = 1, perPage: number = 24) {
        const query = `
            query ($search: String, $page: Int, $perPage: Int) {
                Page(page: $page, perPage: $perPage) {
                    pageInfo {
                        total
                        currentPage
                        lastPage
                        hasNextPage
                    }
                    media(search: $search, type: MANGA, sort: SEARCH_MATCH) {
                        ${MEDIA_FIELDS}
                    }
                }
            }
        `;

        try {
            const response = await axios.post(ANILIST_API_URL, {
                query,
                variables: { search, page, perPage }
            });

            return response.data.data.Page;
        } catch (error) {
            console.error('Error searching manga:', error);
            return { media: [], pageInfo: {} };
        }
    },

    async getAnimeById(id: number) {
        const query = `
            query ($id: Int) {
                Media(id: $id, type: ANIME) {
                    ${MEDIA_FIELDS}
                    relations {
                        edges {
                            relationType
                            node {
                                id
                                title { romaji english }
                                coverImage { large }
                                format
                            }
                        }
                    }
                    recommendations(perPage: 6) {
                        nodes {
                            mediaRecommendation {
                                id
                                title { romaji english }
                                coverImage { large }
                            }
                        }
                    }
                    trailer {
                        id
                        site
                        thumbnail
                    }
                    characters(sort: [ROLE, RELEVANCE, ID], perPage: 12) {
                        edges {
                            role
                            node {
                                id
                                name { full }
                                image { large }
                            }
                            voiceActors(language: JAPANESE, sort: [RELEVANCE, ID]) {
                                id
                                name { full }
                                image { large }
                                languageV2
                            }
                        }
                    }
                }
            }
        `;

        try {
            const response = await axios.post(ANILIST_API_URL, {
                query,
                variables: { id }
            });

            return response.data.data.Media;
        } catch (error) {
            console.error('Error fetching anime by ID:', error);
            return null;
        }
    },

    async getMangaById(id: number) {
        const query = `
            query ($id: Int) {
                Media(idMal: $id, type: MANGA) {
                    ${MEDIA_FIELDS}
                }
            }
        `;

        try {
            const response = await axios.post(ANILIST_API_URL, {
                query,
                variables: { id }
            });

            return response.data.data.Media;
        } catch (error) {
            console.error('Error fetching manga by ID:', error);
            return null;
        }
    }
};

import axios from 'axios';

const JIKAN_BASE_URL = 'https://api.jikan.moe/v4';

// Create an axios instance with a slight delay to respect rate limits if needed, 
// though Jikan's free tier is generous, it's good practice.
const apiClient = axios.create({
    baseURL: JIKAN_BASE_URL,
});

export const searchAnime = async (query: string, page: number = 1) => {
    try {
        const response = await apiClient.get('/anime', {
            params: {
                q: query,
                page,
                limit: 20 // Default limit
            }
        });
        return response.data;
    } catch (error) {
        console.error('Error searching anime:', error);
        throw error;
    }
};

export const getAnimeById = async (id: number) => {
    try {
        const response = await apiClient.get(`/anime/${id}`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching anime with ID ${id}:`, error);
        throw error;
    }
};

export const getTopAnime = async (page: number = 1) => {
    try {
        const response = await apiClient.get('/top/anime', {
            params: {
                page,
                limit: 20
            }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching top anime:', error);
        throw error;
    }
}

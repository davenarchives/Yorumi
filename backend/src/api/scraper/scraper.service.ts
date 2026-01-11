
import { AnimePaheScraper } from '../../../src/scraper/animepahe';

export class ScraperService {
    private scraper: AnimePaheScraper;

    constructor() {
        this.scraper = new AnimePaheScraper();
    }

    async search(query: string) {
        return this.scraper.search(query);
    }

    async getEpisodes(session: string) {
        // Fetch first page to see how many pages there are
        const firstPage = await this.scraper.getEpisodes(session, 1);
        let allEpisodes = [...firstPage.episodes];

        if (firstPage.lastPage > 1) {
            console.log(`Anime has ${firstPage.lastPage} pages of episodes. Fetching the rest...`);
            const pagePromises = [];
            for (let i = 2; i <= firstPage.lastPage; i++) {
                pagePromises.push(this.scraper.getEpisodes(session, i));
            }

            const results = await Promise.all(pagePromises);
            results.forEach(res => {
                allEpisodes = [...allEpisodes, ...res.episodes];
            });
        }

        // Return structured data like the first page, but with all episodes
        return {
            episodes: allEpisodes,
            lastPage: firstPage.lastPage
        };
    }

    async getStreams(animeSession: string, epSession: string) {
        return this.scraper.getLinks(animeSession, epSession);
    }
}

export const scraperService = new ScraperService();

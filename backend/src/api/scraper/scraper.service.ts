
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
            console.log(`Anime has ${firstPage.lastPage} pages of episodes. Fetching the rest in batches...`);

            // Helper for batching
            const batchSize = 5;
            const totalPages = firstPage.lastPage;

            // Create array of page numbers to fetch (2 to lastPage)
            const pagesToFetch = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);

            // Process in batches
            for (let i = 0; i < pagesToFetch.length; i += batchSize) {
                const batch = pagesToFetch.slice(i, i + batchSize);
                console.log(`Fetching batch: pages ${batch[0]} - ${batch[batch.length - 1]}`);

                const batchPromises = batch.map(pageNum => this.scraper.getEpisodes(session, pageNum));
                const results = await Promise.all(batchPromises);

                results.forEach(res => {
                    allEpisodes = [...allEpisodes, ...res.episodes];
                });

                // Small breathing room between batches to let GC catch up if needed
                // await new Promise(r => setTimeout(r, 100)); 
            }
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

import axios from 'axios';
import * as cheerio from 'cheerio';
import { redis } from '../mapping/mapper';
import { anilistService } from '../anilist/anilist.service';

// In-memory cache as fallback when Redis is cold/slow
let inMemorySpotlightCache: any = null;
let isRefreshing = false;

export class HiAnimeScraper {
    private readonly BASE_URL = 'https://hianime.to';

    async getSpotlightAnime(): Promise<any[]> {
        try {
            const { data } = await axios.get(`${this.BASE_URL}/home`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': this.BASE_URL
                },
                timeout: 10000 // 10 seconds timeout
            });

            const $ = cheerio.load(data);
            const spotlight: any[] = [];

            $('#slider .swiper-slide .deslide-item').each((_, element) => {
                const $el = $(element);
                const title = $el.find('.desi-head-title').text().trim();
                const description = $el.find('.desi-description').text().trim();

                // Extract IDs and Links
                const link = $el.find('.desi-buttons a').first().attr('href') || '';
                // link format: /watch/title-id
                const id = link.split('-').pop();

                // Extract Images
                const poster = $el.find('.film-poster-img').attr('data-src') || $el.find('.film-poster-img').attr('src');
                let banner = $el.find('.deslide-cover .film-poster-img').attr('data-src') || $el.find('.deslide-cover .film-poster-img').attr('src');

                // Metadata
                const quality = $el.find('.tick-quality').text().trim();
                const sub = $el.find('.tick-sub').text().trim();
                const dub = $el.find('.tick-dub').text().trim();

                if (title) {
                    spotlight.push({
                        id,
                        title,
                        description,
                        poster,
                        banner,
                        link: this.BASE_URL + link,
                        quality,
                        sub: parseInt(sub) || 0,
                        dub: parseInt(dub) || 0
                    });
                }
            });

            return spotlight;

        } catch (error) {
            console.error('Error scraping HiAnime spotlight:', error);
            return [];
        }
    }

    async getEnrichedSpotlight(): Promise<any> {
        const cacheKey = 'spotlight:hianime:enriched';

        // 1. Try Redis Cache
        try {
            const cached = await redis.get(cacheKey);
            if (cached) {
                // Update in-memory cache with Redis data
                inMemorySpotlightCache = cached;
                return cached;
            }
        } catch (e) {
            console.error('Redis Error (Get Spotlight):', e);
        }

        // 2. If Redis cache miss, check in-memory cache
        if (inMemorySpotlightCache) {
            console.log('📦 Returning stale spotlight from in-memory cache');

            // Trigger background refresh if not already running
            if (!isRefreshing) {
                console.log('🔄 Triggering background spotlight refresh...');
                this.refreshSpotlightInBackground(cacheKey);
            }

            return inMemorySpotlightCache;
        }

        // 3. No cache available - fetch fresh data (blocking only on first ever request)
        console.log('🐢 No cache available. Fetching fresh spotlight data (this may take a while)...');
        return this.fetchAndCacheSpotlight(cacheKey);
    }

    private async refreshSpotlightInBackground(cacheKey: string): Promise<void> {
        if (isRefreshing) return;

        isRefreshing = true;
        try {
            await this.fetchAndCacheSpotlight(cacheKey);
            console.log('✅ Background spotlight refresh complete');
        } catch (error) {
            console.error('❌ Background spotlight refresh failed:', error);
        } finally {
            isRefreshing = false;
        }
    }

    private async fetchAndCacheSpotlight(cacheKey: string): Promise<any> {
        const spotlightItems = await this.getSpotlightAnime();
        const enrichedItems = [];

        // Enrich with AniList data (sequentially to respect rate limits)
        for (const item of spotlightItems) {
            try {
                // Search AniList by title
                const searchResult = await anilistService.searchAnime(item.title, 1, 1);
                const anilistMedia = searchResult?.media?.[0];

                if (anilistMedia) {
                    enrichedItems.push({
                        ...item,
                        id: anilistMedia.id,         // AniList ID
                        mal_id: anilistMedia.idMal,  // MAL ID (used for routing)
                        anilist: anilistMedia        // Full AniList object if needed
                    });
                } else {
                    console.warn(`Could not find AniList match for: ${item.title}`);
                }
            } catch (err) {
                console.error(`Failed to enrich item: ${item.title}`, err);
            }
        }

        const result = { spotlight: enrichedItems };

        // Update both caches
        if (enrichedItems.length > 0) {
            // Update in-memory cache immediately
            inMemorySpotlightCache = result;

            // Save to Redis (12 hours = 43200 seconds)
            try {
                await redis.set(cacheKey, result, { ex: 43200 });
                console.log('💾 Spotlight Cache Updated (Redis + In-Memory, 12h TTL)');
            } catch (e) {
                console.error('Redis Error (Set Spotlight):', e);
            }
        }

        return result;
    }

    async getAZList(letter: string, page: number = 1): Promise<any> {
        try {
            // HiAnime A-Z List URL structure: /az-list/{letter}?page={page}
            let path = '';
            if (letter.toLowerCase() === 'all') path = '/az-list';
            else if (['#', '0-9'].includes(letter)) path = '/az-list/other';
            else path = `/az-list/${letter.toUpperCase()}`;

            const url = `${this.BASE_URL}${path}?page=${page}`;
            console.log(`Scraping AZ List: ${url}`);

            const { data } = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': this.BASE_URL
                }
            });

            const $ = cheerio.load(data);
            const results: any[] = [];

            // Handle pagination
            let lastPage = 1;
            const paginationLast = $('.pagination .page-item:not(.next) a').last().attr('href');
            if (paginationLast) {
                const match = paginationLast.match(/page=(\d+)/);
                if (match) lastPage = parseInt(match[1]);
            }
            const hasNextPage = !!$('.pagination .page-item.next');

            $('.film_list-wrap .flw-item').each((_, element) => {
                const $el = $(element);
                const title = $el.find('.film-name a').text().trim();
                const link = $el.find('.film-name a').attr('href') || '';
                const id = link.split('?')[0].replace('/', '');

                const poster = $el.find('.film-poster-img').attr('data-src') || $el.find('.film-poster-img').attr('src');
                const type = $el.find('.fdi-item.type').text().trim() || 'TV';

                if (title && id) {
                    results.push({
                        id,
                        title,
                        poster,
                        type,
                        link: this.BASE_URL + link
                    });
                }
            });

            return {
                data: results,
                pagination: {
                    last_visible_page: lastPage,
                    has_next_page: hasNextPage,
                    current_page: page
                }
            };

        } catch (error) {
            console.error(`Error scraping AZ list for ${letter}:`, error);
            return { data: [], pagination: { has_next_page: false, last_visible_page: 1 } };
        }
    }

    async getAnimeInfo(id: string): Promise<any> {
        try {
            // Check for /watch/ prefix or direct slug
            const urlPath = id.startsWith('watch/') ? id : `watch/${id}`;
            const url = `${this.BASE_URL}/${urlPath}`;
            console.log(`Scraping Anime Info: ${url}`);

            const { data } = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': this.BASE_URL
                }
            });

            const $ = cheerio.load(data);

            // Extract Details
            const title = $('.anisc-detail .film-name').text().trim();
            const poster = $('.anisc-poster .film-poster-img').attr('data-src') || $('.anisc-poster .film-poster-img').attr('src');
            const description = $('.anisc-detail .film-description .text').text().trim();

            // Stats (Episodes, etc)
            const stats: any = {};
            $('.film-stats .item').each((_, el) => {
                const text = $(el).text();
                if (text.includes('Sub')) stats.sub = parseInt(text.replace(/\D/g, ''));
                if (text.includes('Dub')) stats.dub = parseInt(text.replace(/\D/g, ''));
                if (text.includes('Ep')) stats.episodes = { sub: stats.sub || 0, dub: stats.dub || 0 }; // Approx
            });

            // Status
            // Usually in .anisc-info .item-title:contains("Status") + .name
            const status = $('.anisc-info .item-title:contains("Status")').next().text().trim();

            return {
                id,
                title,
                poster,
                description,
                status,
                stats
            };
        } catch (error) {
            console.error(`Error scraping info for ${id}:`, error);
            return null;
        }
    }
}

import axios from 'axios';
import type { VideoSource, StreamResponse } from '../api/anime/video-sources.js';
import { streambertAnimeService } from '../api/anime/anime.service.js';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export class AnimeGGScraper implements VideoSource {
    id = 'animegg';

    async getStream(anilistId: number, episode: number, options?: { title?: string, tmdbId?: number }): Promise<StreamResponse | null> {
        const metadata = options?.tmdbId ? await streambertAnimeService.getMetadata(options.tmdbId) : null;
        const title = options?.title || metadata?.title?.romaji || metadata?.title?.english || metadata?.title?.native;
        if (!title) return null;

        try {
            const searchTitles = [
                title,
                metadata?.title?.romaji,
                metadata?.title?.english,
                metadata?.title?.native
            ].filter(Boolean) as string[];

            let searchHtml = '';
            let slugMatches: RegExpMatchArray[] = [];

            for (const searchTitle of searchTitles) {
                searchHtml = await axios.get<string>(`https://www.animegg.org/search/?q=${encodeURIComponent(searchTitle)}`, {
                    headers: { 'User-Agent': USER_AGENT }
                }).then(r => r.data).catch(() => '');
                
                slugMatches = [...searchHtml.matchAll(/<a\b[^>]*href=["']\/series\/([^/?#"']+)["']/gi)];
                if (slugMatches.length > 0) break;
            }

            if (slugMatches.length === 0) {
                console.log(`[AnimeGG] slugMatch failed for all titles of ${title}`);
                return null;
            }
            
            const altTitles = [
                title,
                metadata?.title?.romaji,
                metadata?.title?.english,
                ...(metadata?.synonyms || [])
            ].filter(Boolean) as string[];

            const altExpectedSlugs = altTitles.map(t => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
            const altExpectedWordsList = altExpectedSlugs.map(slug => slug.replace(/-/g, ' '));

            const scoredSlugs = slugMatches.map(m => {
                const slug = m[1];
                const slugWords = slug.replace(/-/g, ' ');
                let bestScore = -9999;

                for (let i = 0; i < altExpectedSlugs.length; i++) {
                    const expectedSlug = altExpectedSlugs[i];
                    const expectedWords = altExpectedWordsList[i];
                    let score = 0;

                    if (slug === expectedSlug) score += 1000;
                    if (slugWords === expectedWords) score += 1000;
                    if (slugWords.includes(expectedWords) || expectedWords.includes(slugWords)) score += 500;
                    
                    if (slugWords.replace(/u/g, '') === expectedWords.replace(/u/g, '')) score += 800;

                    const isSpecial = /\b(movie|ova|ona|special|recap)\b/i.test(slugWords);
                    const asksSpecial = /\b(movie|ova|ona|special|recap)\b/i.test(expectedWords);
                    if (isSpecial && !asksSpecial) score -= 2000;

                    if (slug.endsWith('-dub')) score -= 10;
                    
                    if (score > bestScore) bestScore = score;
                }

                return { slug, score: bestScore };
            });

            scoredSlugs.sort((a, b) => b.score - a.score);
            const slug = scoredSlugs[0].slug;

            const seriesHtml = await axios.get<string>(`https://www.animegg.org/series/${slug}`, {
                headers: { 'User-Agent': USER_AGENT }
            }).then(r => r.data);
            
            const liPattern = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
            let epSlug = null;
            let m;
            while ((m = liPattern.exec(seriesHtml))) {
                const block = m[1];
                if (!block.includes('anm_det_pop')) continue;
                
                const hrefMatch = block.match(/href=["']\/([^"']+)["']/i);
                const strongMatch = block.match(/<strong[^>]*>([\s\S]*?)<\/strong>/i);
                if (hrefMatch && strongMatch) {
                    const strongText = strongMatch[1].replace(/<[^>]+>/g, '').trim();
                    // Handle single ep ("12"), ranges ("1-13"), and decimal ("12.5")
                    const rangeMatch = strongText.match(/(\d+)\s*-\s*(\d+)\s*$/);
                    const singleMatch = strongText.match(/(\d+(?:\.\d+)?)\s*$/);
                    let epMatch = false;
                    if (rangeMatch) {
                        // Range: episode must be within [start, end]
                        const start = parseInt(rangeMatch[1]);
                        const end = parseInt(rangeMatch[2]);
                        epMatch = episode >= start && episode <= end;
                    } else if (singleMatch) {
                        epMatch = parseFloat(singleMatch[1]) === episode;
                    }
                    if (epMatch) {
                        epSlug = hrefMatch[1].replace(/#.*$/, '');
                        break;
                    }
                }
            }
            if (!epSlug) return null;

            const watchHtml = await axios.get<string>(`https://www.animegg.org/${epSlug}`, {
                headers: { 'User-Agent': USER_AGENT, Referer: 'https://www.animegg.org' }
            }).then(r => r.data);

            const embedMatch = watchHtml.match(/<iframe\b[^>]*src=["']\/embed\/([^"']+)["']/i);
            if (!embedMatch) {
                console.log(`[AnimeGG] embedMatch failed for ${title} ep ${episode}`);
                return null;
            }
            const embedId = embedMatch[1];
            const embedUrl = `https://www.animegg.org/embed/${embedId}`;

            const embedHtml = await axios.get<string>(embedUrl, {
                headers: { 'User-Agent': USER_AGENT, Referer: `https://www.animegg.org` }
            }).then(r => r.data);

            const videoSourcesMatch = embedHtml.match(/var\s+videoSources\s*=\s*(\[.*?\])\s*;/is);
            let url = '';
            
            if (videoSourcesMatch) {
                const arrStr = videoSourcesMatch[1];
                const sources = [];
                const blockRegex = /\{([^{}]+)\}/g;
                let blockMatch;
                while ((blockMatch = blockRegex.exec(arrStr))) {
                    const block = blockMatch[1];
                    const fileMatch = block.match(/file\s*:\s*["']([^"']+)["']/i);
                    const labelMatch = block.match(/label\s*:\s*["']([^"']+)["']/i);
                    if (fileMatch) {
                        sources.push({ url: fileMatch[1], label: labelMatch ? labelMatch[1] : '0' });
                    }
                }
                
                if (sources.length > 0) {
                    sources.sort((a, b) => {
                        const aVal = parseInt(a.label.replace(/\D/g, '')) || 0;
                        const bVal = parseInt(b.label.replace(/\D/g, '')) || 0;
                        return bVal - aVal; // descending order, highest first
                    });
                    url = sources[0].url;
                }
            }
            
            if (!url) {
                const srcMatch = embedHtml.match(/var\s+videoSources\s*=\s*\[\{.*?file\s*:\s*["']([^"']+)["']/i);
                if (!srcMatch) return null;
                url = srcMatch[1];
            }
            
            if (!url.startsWith('http')) url = `https://www.animegg.org${url}`;

            // Check if fallback embed is available (e.g. mp4upload)
            let backupEmbed = '';
            const backupMatch = embedHtml.match(/<iframe\b[^>]*src=["'](https?:\/\/[^"']+)["']/i);
            if (backupMatch) backupEmbed = backupMatch[1];

            return {
                m3u8: url,
                subtitles: [],
                source: this.id,
                episode,
                title,
                referer: embedUrl,
                variants: backupEmbed ? [{ quality: 'embed', url: backupEmbed }] : []
            };
        } catch (e: any) {
            console.error(`AnimeGG failed for title ${title}:`, e?.message || e);
            return null;
        }
    }
}

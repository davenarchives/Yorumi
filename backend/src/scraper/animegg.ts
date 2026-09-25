import axios from 'axios';
import type { VideoSource, StreamResponse } from '../api/anime/video-sources.js';
import { logger } from '../core/logger.js';

const BASE = 'https://www.animegg.org';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const H = {
    'User-Agent': UA,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Referer': BASE,
};

function normalizeText(text: string): string {
    return (text || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isSafeSlugMatch(query: string, slug: string): boolean {
    const target = normalizeText(query);
    const actual = normalizeText(slug);
    return Boolean(target && actual && (actual === target || actual.includes(target) || target.includes(actual)));
}

export class AnimeGGScraper implements VideoSource {
    id = 'animegg';

    async search(query: string): Promise<string[]> {
        const cleanQuery = query.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
        if (!cleanQuery) return [];

        try {
            const res = await axios.get(`${BASE}/search/?q=${encodeURIComponent(cleanQuery)}`, {
                headers: H,
                timeout: 8000,
            });
            const html = String(res.data || '');
            const seriesMatches = [...html.matchAll(/href=["'](\/series\/[^"']+)["']/g)].map(m => m[1]);
            return [...new Set(seriesMatches)].map(path => path.replace('/series/', ''));
        } catch (error: any) {
            logger.warn(`[animegg] search failed for query: ${query}`, error?.message || error);
            return [];
        }
    }

    async getStream(
        anilistId: number,
        episode: number,
        options?: { title?: string; titles?: any; tmdbId?: number; format?: string; anilistId?: number }
    ): Promise<StreamResponse | null> {
        const searchTitles: string[] = [];
        if (options?.title) searchTitles.push(options.title);
        if (Array.isArray(options?.titles)) {
            searchTitles.push(...options.titles.filter((t: any) => typeof t === 'string'));
        }

        const candidateQueries = [...new Set(searchTitles.filter(Boolean))];
        if (candidateQueries.length === 0) return null;

        let bestSlug: string | null = null;

        for (const query of candidateQueries.slice(0, 3)) {
            const slugs = await this.search(query);
            if (slugs.length === 0) continue;

            const normTarget = normalizeText(query);
            for (const s of slugs) {
                const normSlug = normalizeText(s);
                if (isSafeSlugMatch(query, s)) {
                    bestSlug = s;
                    break;
                }
            }
            if (bestSlug) break;
        }

        if (!bestSlug) return null;

        try {
            // Episode URL on AnimeGG is commonly `/${slug}-episode-${episode}`
            const epUrl = `${BASE}/${bestSlug}-episode-${episode}`;
            const epRes = await axios.get(epUrl, { headers: H, timeout: 8000 });
            const epHtml = String(epRes.data || '');

            const embeds = [...epHtml.matchAll(/data-id=["']([^"']+)["'][^>]*data-version=["'](subbed|dubbed)["']/gi)]
                .map((match) => ({ id: match[1], audio: match[2].toLowerCase() === 'dubbed' ? 'dub' as const : 'sub' as const }));
            if (embeds.length === 0) return null;

            let masterUrl = '';
            let dubMasterUrl = '';
            const variants: Array<{ quality: string; url: string }> = [];
            const dubVariants: Array<{ quality: string; url: string }> = [];

            for (const embed of embeds.slice(0, 4)) {
                try {
                    const embRes = await axios.get(`${BASE}/embed/${embed.id}`, { headers: H, timeout: 6000 });
                    const embHtml = String(embRes.data || '');
                    const m = embHtml.match(/var\s+videoSources\s*=\s*(\[[\s\S]*?\]);/);
                    if (!m) continue;

                    const asJson = m[1]
                        .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
                        .replace(/:\s*'([^']*)'/g, ': "$1"');
                    const parsed = JSON.parse(asJson);

                    if (Array.isArray(parsed) && parsed.length > 0) {
                        for (const s of parsed) {
                            if (!s.file) continue;
                            const fullUrl = s.file.startsWith('http') ? s.file : `${BASE}${s.file}`;
                            const q = s.label || '720p';
                            const targetVariants = embed.audio === 'dub' ? dubVariants : variants;

                            if (embed.audio === 'sub' && !masterUrl) {
                                masterUrl = fullUrl;
                            }
                            if (embed.audio === 'dub' && !dubMasterUrl) {
                                dubMasterUrl = fullUrl;
                            }
                            if (!targetVariants.find(v => v.url === fullUrl)) {
                                targetVariants.push({ quality: q, url: fullUrl });
                            }
                        }
                    }
                } catch {
                    // try next embed
                }
            }

            if (!masterUrl && !dubMasterUrl) return null;

            return {
                m3u8: masterUrl || dubMasterUrl,
                audio: masterUrl ? 'sub' : 'dub',
                dubM3u8: masterUrl ? dubMasterUrl || undefined : undefined,
                variants: masterUrl ? variants : dubVariants,
                dubVariants: masterUrl && dubVariants.length > 0 ? dubVariants : undefined,
                subtitles: [],
                source: this.id,
                episode,
                title: options?.title || `Episode ${episode}`,
                referer: BASE,
                isEmbed: false,
            };
        } catch (error: any) {
            logger.warn(`[animegg] stream resolution failed for ${bestSlug} ep ${episode}`, error?.message || error);
            return null;
        }
    }
}

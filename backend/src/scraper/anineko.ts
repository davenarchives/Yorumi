import axios from 'axios';
import type { VideoSource, StreamResponse, SubtitleTrack } from '../api/anime/video-sources.js';
import { streambertAnimeService } from '../api/anime/anime.service.js';
import { anilistService } from '../api/anilist/anilist.service.js';

const BASE = 'https://anineko.to';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const H = { 'User-Agent': USER_AGENT };

function stripTags(html: string) {
    return html.replace(/<[^>]*>?/gm, '').trim();
}

function decodeEntities(str: string) {
    return str
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#0*39;/g, "'")
        .replace(/&#x27;/gi, "'");
}

function unpackEval(code: string): string {
    try {
        const match = code.match(/}\s*\(\s*['"]([\s\S]*?)['"]\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*['"]([\s\S]*?)['"]\.split\(['"]\|['"]\)/);
        if (match) {
            let p = match[1];
            const a = parseInt(match[2], 10);
            let c = parseInt(match[3], 10);
            const k = match[4].split('|');
            while (c--) {
                if (k[c]) {
                    p = p.replace(new RegExp('\\b' + c.toString(a) + '\\b', 'g'), k[c]);
                }
            }
            return p;
        }
    } catch {
        // ignore
    }
    return '';
}

export class AniNekoScraper implements VideoSource {
    id = 'anineko';

    async getStream(anilistId: number, episode: number, options?: { title?: string, tmdbId?: number, audio?: string }): Promise<StreamResponse | null> {
        let metadata = options?.tmdbId ? await streambertAnimeService.getMetadata(options.tmdbId).catch(() => null) : null;
        let title = options?.title || metadata?.title?.romaji || metadata?.title?.english || metadata?.title?.native;

        let searchTitles: string[] = [];

        if (title) {
            searchTitles.push(title);
        }

        if (anilistId) {
            const anilistData = await anilistService.getMediaDetails(anilistId).catch(() => null);
            if (anilistData?.title) {
                if (anilistData.title.english) searchTitles.push(anilistData.title.english);
                if (anilistData.title.romaji) searchTitles.push(anilistData.title.romaji);
                if (anilistData.title.native) searchTitles.push(anilistData.title.native);
            }
            if (Array.isArray(anilistData?.synonyms)) {
                searchTitles.push(...anilistData.synonyms);
            }
        }

        searchTitles = Array.from(new Set(searchTitles.filter(Boolean)));
        if (searchTitles.length === 0) return null;

        try {
            let seriesSlug = '';
            
            for (const searchTitle of searchTitles) {
                const searchHtml = await axios.get<string>(`${BASE}/browser?keyword=${encodeURIComponent(searchTitle)}`, { headers: H }).then(r => r.data).catch(() => '');
                const results = [];
                for (const m of searchHtml.matchAll(/<a\b[^>]*class=["'][^"']*nv-anime-thumb[^"']*["'][^>]*>[\s\S]*?<\/a>/gi)) {
                    const tag = m[0].match(/<a\b[^>]*>/i)?.[0] ?? "";
                    const hrefMatch = tag.match(/href=["']([^"']+)["']/i);
                    if (!hrefMatch) continue;
                    const slugMatch = hrefMatch[1].match(/\/watch\/([^/?#]+)/);
                    if (!slugMatch) continue;
                    const slug = slugMatch[1];
                    const imgMatch = m[0].match(/<img\b[^>]*alt=["']([^"']+)["'][^>]*>/i);
                    const titleMatch = m[0].match(/<(?:h3|[^>]+class=["'][^"']*nv-anime-title[^"']*["'][^>]*)>([\s\S]*?)<\/(?:h3|[^>]+)>/i);
                    const text = imgMatch ? decodeEntities(imgMatch[1]) : (titleMatch ? stripTags(titleMatch[1]) : slug.replace(/-/g, " "));
                    results.push({ slug, text });
                }

                if (results.length > 0) {
                    const normalizeStr = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
                    const expectedNorm = normalizeStr(searchTitle);

                    let bestMatch = results[0].slug;
                    let bestScore = -999;
                    for (const r of results) {
                        let score = 0;
                        const tNorm = normalizeStr(r.text);
                        const slugNorm = normalizeStr(r.slug);
                        if (slugNorm === expectedNorm || r.slug === expectedNorm) score += 1000;
                        if (tNorm === expectedNorm) score += 1000;
                        if (tNorm.includes(expectedNorm) || expectedNorm.includes(tNorm)) score += 500;
                        if (score > bestScore) {
                            bestScore = score;
                            bestMatch = r.slug;
                        }
                    }
                    seriesSlug = bestMatch;
                    break;
                }
            }

            if (!seriesSlug) return null;

            // Fetch episodes
            const seriesHtml = await axios.get<string>(`${BASE}/watch/${seriesSlug}`, { headers: H }).then(r => r.data);
            const episodes = [];
            for (const m of seriesHtml.matchAll(/<article\b[^>]*class=["'][^"']*nv-info-episode-item[^"']*["'][^>]*>([\s\S]*?)<\/article>/gi)) {
                const block = m[1];
                const link = block.match(/<a\b[^>]*class=["'][^"']*nv-info-episode-main[^"']*["'][^>]*>/i)?.[0] ?? "";
                const hrefMatch = link.match(/href=["']([^"']+)["']/i);
                if (!hrefMatch) continue;
                const numMatch = hrefMatch[1].match(/\/ep-(\d+)/);
                if (!numMatch) continue;
                const num = parseInt(numMatch[1], 10);
                if (num === episode) {
                    const badges = [...block.matchAll(/<span\b[^>]*>([\s\S]*?)<\/span>/gi)].map((b) => stripTags(b[1]).toLowerCase());
                    episodes.push({ num, hasSub: badges.includes("sub"), hasDub: badges.includes("dub") });
                }
            }

            if (episodes.length === 0) return null;

            const targetAudio = options?.audio === 'dub' ? 'dub' : 'sub';
            const epSlug = `ep-${episode}`;
            const watchHtml = await axios.get<string>(`${BASE}/watch/${seriesSlug}/${epSlug}`, { headers: { ...H, Referer: `${BASE}/watch/${seriesSlug}` } }).then(r => r.data);
            
            const byAudio: { sub: string[], dub: string[] } = { sub: [], dub: [] };
            for (const panel of watchHtml.matchAll(/<div\b[^>]*class=["'][^"']*nv-server-grid[^"']*["'][^>]*data-id=["']([^"']+)["'][^>]*>([\s\S]*?)(?=<div\b[^>]*class=["'][^"']*nv-server-grid|$)/gi)) {
                const rawAudio = panel[1].toLowerCase();
                const panelAudio = rawAudio.includes("dub") ? "dub" : "sub";
                for (const btn of panel[2].matchAll(/data-video=["']([^"']+)["']/gi)) {
                    byAudio[panelAudio].push(decodeEntities(btn[1]));
                }
            }

            const embeds = byAudio[targetAudio] || byAudio['sub'] || [];
            if (embeds.length === 0) return null;

            const subtitles: SubtitleTrack[] = [];
            for (const embedUrl of embeds) {
                try {
                    const parsedUrl = new URL(embedUrl);
                    const subUrl = parsedUrl.searchParams.get('sub') || parsedUrl.searchParams.get('caption_1') || parsedUrl.searchParams.get('c1_file');
                    if (subUrl && /^https?:\/\//i.test(subUrl)) {
                        const lang = parsedUrl.searchParams.get('sub_1') || parsedUrl.searchParams.get('c1_label') || 'English';
                        if (!subtitles.some(s => s.url === subUrl)) {
                            subtitles.push({ lang, url: subUrl });
                        }
                    }
                } catch {
                    // ignore
                }
            }

            let m3u8 = '';
            let referer = '';
            const variants: { quality: string; url: string }[] = [];

            for (let i = 0; i < embeds.length; i++) {
                const embed = embeds[i];
                try {
                    const embedHtml = await axios.get<string>(embed, { headers: { ...H, Referer: `${BASE}/` }, timeout: 10_000 }).then(r => r.data).catch(() => '');
                    const patterns = [
                        /const\s+src\s*=\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i,
                        /file\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i,
                        /["'](https?:\/\/[^"']+\/master\.m3u8[^"']*)["']/i,
                        /["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i,
                    ];
                    let extracted = '';
                    for (const pattern of patterns) {
                        const m = embedHtml.match(pattern);
                        if (m) {
                            extracted = decodeEntities(m[1]);
                            break;
                        }
                    }

                    if (!extracted) {
                        const packedMatch = embedHtml.match(/eval\(function\(p,a,c,k,e,d\)[\s\S]*?\.split\(['"]\|['"]\)\)\)/);
                        if (packedMatch) {
                            const unpacked = unpackEval(packedMatch[0]);
                            const m = unpacked.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i) || unpacked.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i);
                            if (m) {
                                extracted = decodeEntities(m[1]);
                            }
                        }
                    }

                    if (extracted) {
                        const embedOrigin = `${new URL(embed).origin}/`;
                        if (!m3u8) {
                            m3u8 = extracted;
                            referer = embedOrigin;
                        } else {
                            variants.push({ quality: `Server ${i + 1}`, url: extracted });
                        }
                    }
                } catch {
                    // continue
                }
            }

            if (!m3u8) return null;

            return {
                m3u8,
                variants,
                subtitles,
                source: this.id,
                episode,
                title: searchTitles[0],
                referer
            };
        } catch (e: any) {
            console.error(`AniNeko failed for title ${searchTitles[0]}:`, e?.message || e);
            return null;
        }
    }
}

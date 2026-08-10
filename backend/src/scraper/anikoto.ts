import axios from 'axios';
import { load } from 'cheerio';
import type { VideoSource, StreamResponse } from '../api/anime/video-sources.js';

const BASE = 'https://anikototv.to';
const SPOOF_REF = 'https://hianimes.re/';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const H = {
    'User-Agent': UA,
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
};

function normalizeTitle(s: string) {
    return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export class AnikotoScraper implements VideoSource {
    id = 'anikoto';

    async getLinksForEpisodeNumber(title: string, episode: number): Promise<any[]> {
        return [];
    }

    async getStream(anilistId: number, episode: number, options?: { title?: string; tmdbId?: number }): Promise<StreamResponse | null> {
        try {
            const title = options?.title || '';
            const searchTitle = title || '';
            if (!searchTitle) return null;

            // Search Anikoto
            let searchHtml = '';
            try {
                const searchRes = await axios.get(`${BASE}/ajax/anime/search?keyword=${encodeURIComponent(searchTitle)}`, {
                    headers: { ...H, 'X-Requested-With': 'XMLHttpRequest', Referer: `${BASE}/` },
                    timeout: 10000
                });
                searchHtml = searchRes.data?.result?.html || '';
            } catch {
                // Ignore search error, we'll try filter
            }

            if (!searchHtml) {
                try {
                    const filterRes = await axios.get(`${BASE}/filter?keyword=${encodeURIComponent(searchTitle)}`, {
                        headers: { ...H, Referer: `${BASE}/` },
                        timeout: 10000
                    });
                    searchHtml = filterRes.data || '';
                } catch {
                    return null; // Both searches failed
                }
            }

            const $ = load(searchHtml);
            const candidates: { slug: string; titleEn: string; titleJp: string }[] = [];

            $('.item').each((_, el) => {
                const a = $(el);
                const href = a.attr('href') || '';
                const slugMatch = href.match(/\/watch\/([^"/]+)/);
                if (slugMatch) {
                    const en = a.find('.name.d-title').text().trim();
                    const jp = a.attr('data-jp') || '';
                    candidates.push({ slug: slugMatch[1], titleEn: en, titleJp: jp });
                }
            });

            $('a.name.d-title').each((_, el) => {
                const a = $(el);
                const href = a.attr('href') || '';
                const slugMatch = href.match(/\/watch\/([^"/]+)/);
                if (slugMatch) {
                    const en = a.text().trim();
                    const jp = a.attr('data-jp') || '';
                    if (!candidates.find(c => c.slug === slugMatch[1])) {
                        candidates.push({ slug: slugMatch[1], titleEn: en, titleJp: jp });
                    }
                }
            });

            if (candidates.length === 0) return null;

            const normSearch = normalizeTitle(searchTitle);
            const asksSeason2 = /\b(season 2|s2|2nd season|season2)\b/i.test(searchTitle);
            const asksMovie = /\b(movie|film)\b/i.test(searchTitle);

            let bestCandidate = candidates[0];
            let bestScore = -999;

            for (const c of candidates) {
                let score = 0;
                const enNorm = normalizeTitle(c.titleEn);
                const jpNorm = normalizeTitle(c.titleJp);

                if (enNorm === normSearch || jpNorm === normSearch) score += 1000;
                else if (enNorm.startsWith(normSearch) || jpNorm.startsWith(normSearch)) score += 500;
                else if (enNorm.includes(normSearch) || jpNorm.includes(normSearch)) score += 200;

                const isS2 = /\b(season 2|s2|2nd season|season2)\b/i.test(c.titleEn);
                const isMovie = /\b(movie|film)\b/i.test(c.titleEn);
                const isMini = /\b(mini|special|recap|chibi)\b/i.test(c.titleEn);

                if (isS2 && !asksSeason2) score -= 300;
                if (isMovie && !asksMovie) score -= 300;
                if (isMini) score -= 400;

                if (score > bestScore) {
                    bestScore = score;
                    bestCandidate = c;
                }
            }

            const chosenSlug = bestCandidate.slug;

            // Get show ID
            const watchPage = await axios.get(`${BASE}/watch/${chosenSlug}`, { headers: { ...H, Referer: `${BASE}/` } }).then(r => r.data).catch(() => '');
            const showIdMatch = watchPage.match(/data-id="(\d+)"/);
            if (!showIdMatch) return null;
            const showId = showIdMatch[1];

            // Get episodes
            const epList = await axios.get(`${BASE}/ajax/episode/list/${showId}`, {
                headers: { ...H, 'X-Requested-With': 'XMLHttpRequest', Referer: `${BASE}/watch/${chosenSlug}` }
            }).then(r => r.data).catch(() => null);

            if (!epList || !epList.result) return null;

            const $ep = load(epList.result);
            let epIds = '';
            $ep('a').each((_, el) => {
                const a = $ep(el);
                if (parseInt(a.attr('data-num') || '0', 10) === episode) {
                    epIds = a.attr('data-ids') || '';
                }
            });

            if (!epIds) return null;

            // Get servers
            const serverList = await axios.get(`${BASE}/ajax/server/list?servers=${encodeURIComponent(epIds)}`, {
                headers: { ...H, 'X-Requested-With': 'XMLHttpRequest', Referer: `${BASE}/` }
            }).then(r => r.data).catch(() => null);

            if (!serverList || !serverList.result) return null;

            const $srv = load(serverList.result);
            const serverLinks: { id: string; name: string; type: string }[] = [];

            $srv('.type').each((_, el) => {
                const typeDiv = $srv(el);
                const type = typeDiv.attr('data-type') || 'sub';
                typeDiv.find('li').each((_, li) => {
                    const linkId = $srv(li).attr('data-link-id');
                    const name = $srv(li).text().trim();
                    if (linkId) serverLinks.push({ id: linkId, name, type });
                });
            });

            let m3u8 = '';
            let dubM3u8 = '';
            let referer = '';
            const subtitles: any[] = [];
            const processedEmbeds = new Set<string>();

            for (const srv of serverLinks) {
                if ((srv.type === 'sub' && m3u8) || (srv.type === 'dub' && dubM3u8)) continue;

                try {
                    const res = await axios.get(`${BASE}/ajax/server?get=${encodeURIComponent(srv.id)}`, {
                        headers: { ...H, 'X-Requested-With': 'XMLHttpRequest', Referer: `${BASE}/` }
                    });
                    const embedUrl = res.data?.result?.url;
                    if (!embedUrl || processedEmbeds.has(embedUrl)) continue;
                    processedEmbeds.add(embedUrl);

                    const origin = new URL(embedUrl).origin;
                    
                    // Fetch embed page to get sources
                    const embedPage = await axios.get(embedUrl, {
                        headers: { ...H, Referer: SPOOF_REF }
                    }).then(r => r.data);
                    
                    const fileIdMatch = embedPage.match(/data-id="([^"]*)"/);
                    if (fileIdMatch) {
                        const fileId = fileIdMatch[1];
                        const sources = await axios.get(`${origin}/stream/getSources?id=${fileId}&id=${fileId}`, {
                            headers: { ...H, 'X-Requested-With': 'XMLHttpRequest', Referer: `${origin}/` }
                        }).then(r => r.data).catch(() => null);

                        if (sources?.sources?.file) {
                            const foundM3u8 = sources.sources.file;
                            if (srv.type === 'sub') {
                                m3u8 = foundM3u8;
                                referer = `${origin}/`;
                                if (sources.tracks) {
                                    for (const t of sources.tracks) {
                                        if (t.file) {
                                            subtitles.push({
                                                url: t.file,
                                                lang: t.label || 'Unknown',
                                            });
                                        }
                                    }
                                }
                            } else {
                                dubM3u8 = foundM3u8;
                            }
                        }
                    }
                } catch {
                    // skip
                }
            }

            if (!m3u8 && !dubM3u8) return null;

            const variants: Array<{ quality: string; url: string }> = [];
            if (m3u8) {
                try {
                    const masterRes = await axios.get<string>(m3u8, {
                        headers: { ...H, Referer: referer || SPOOF_REF },
                        timeout: 5000,
                    });
                    const lines = String(masterRes.data || '').split(/\r?\n/);
                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i].trim();
                        if (!line.startsWith('#EXT-X-STREAM-INF')) continue;
                        const resMatch = line.match(/RESOLUTION=\d+x(\d+)/i)?.[1];
                        const bw = Number(line.match(/BANDWIDTH=(\d+)/i)?.[1] || 0);
                        let nextUrl = '';
                        for (let j = i + 1; j < lines.length; j++) {
                            const candidate = lines[j].trim();
                            if (!candidate || candidate.startsWith('#')) continue;
                            nextUrl = candidate;
                            break;
                        }
                        if (nextUrl && !/EXT-X-I-FRAME/i.test(nextUrl)) {
                            const abs = nextUrl.startsWith('http') ? nextUrl : new URL(nextUrl, m3u8).href;
                            const q = resMatch ? `${resMatch}p` : (bw >= 2500000 ? '720p' : '360p');
                            if (!variants.find(v => v.url === abs)) {
                                variants.push({ quality: q, url: abs });
                            }
                        }
                    }
                } catch {
                    // ignore
                }
            }

            return {
                m3u8: m3u8 || dubM3u8,
                dubM3u8: dubM3u8 || undefined,
                variants,
                subtitles,
                source: this.id,
                episode,
                title: title || `Episode ${episode}`,
                referer: referer || SPOOF_REF
            };

        } catch (e: any) {
            console.error(`Anikoto failed:`, e?.message || e);
            return null;
        }
    }
}

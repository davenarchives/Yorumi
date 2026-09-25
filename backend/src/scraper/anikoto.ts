import axios from 'axios';
import { load } from 'cheerio';
import crypto from 'node:crypto';
import vm from 'node:vm';
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

// ---------------------------------------------------------------------------
// MegaPlay Decryption Helpers
// ---------------------------------------------------------------------------

function decodeScriptString(value: string): string {
    return value.replace(/\\u([\dA-Fa-f]{4})|\\x([\dA-Fa-f]{2})|\\([\\'"bnfrtv0])/g, (_, unicode, hex, escaped) => {
        if (unicode) return String.fromCharCode(Number.parseInt(unicode, 16));
        if (hex) return String.fromCharCode(Number.parseInt(hex, 16));
        const map: Record<string, string> = { b: '\b', n: '\n', f: '\f', r: '\r', t: '\t', v: '\v', '0': '\0' };
        return map[escaped] ?? escaped;
    });
}

function getScriptStrings(script: string): string[] {
    const strings: string[] = [];
    let index = 0;
    let previous = '';
    while (index < script.length) {
        const char = script[index];
        if (char === '/' && script[index + 1] === '/') {
            index = script.indexOf('\n', index + 2);
            if (index < 0) break;
            continue;
        }
        if (char === '/' && script[index + 1] === '*') {
            index = script.indexOf('*/', index + 2);
            if (index < 0) break;
            index += 2;
            continue;
        }
        if (char === '/' && /[=(:,[!&|?{};]/.test(previous)) {
            index++;
            let inClass = false;
            while (index < script.length) {
                if (script[index] === '\\') {
                    index += 2;
                    continue;
                }
                if (script[index] === '[') inClass = true;
                if (script[index] === ']') inClass = false;
                if (script[index] === '/' && !inClass) {
                    index++;
                    while (/[a-z]/i.test(script[index] ?? '')) index++;
                    break;
                }
                index++;
            }
            continue;
        }
        if (char === "'" || char === '"') {
            const quote = char;
            let value = '';
            index++;
            while (index < script.length && script[index] !== quote) {
                if (script[index] === '\\' && index + 1 < script.length) value += script[index++];
                value += script[index++];
            }
            strings.push(decodeScriptString(value));
            index++;
            continue;
        }
        if (char === '`') {
            index++;
            while (index < script.length && script[index] !== '`') index += script[index] === '\\' ? 2 : 1;
            index++;
            continue;
        }
        if (!/\s/.test(char)) previous = char;
        index++;
    }
    return [...new Set(strings)];
}

function getMegaPlayRoutes(script: string) {
    const routes = getScriptStrings(script)
        .filter((value) => /^stream\/getSources[\w/-]*$/i.test(value))
        .sort((left, right) => left.length - right.length);
    const legacy = routes[0] ?? null;
    const modern = routes.find((route) => route !== legacy && route.startsWith(legacy)) ?? null;
    return { legacy, modern };
}

function decryptMegaPlaySource(value: string | undefined, script: string): string | null {
    if (!value) return null;
    const encrypted = Buffer.from(value, 'base64url');
    if (!encrypted.length || encrypted.length % 16) return null;
    const values = getScriptStrings(script).filter((item) => Buffer.byteLength(item) > 0 && Buffer.byteLength(item) <= 32);
    const ivs = values.filter((item) => Buffer.byteLength(item) === 16);
    for (const keyValue of values) {
        const key = Buffer.alloc(32);
        Buffer.from(keyValue).copy(key);
        for (const ivValue of ivs) {
            try {
                const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(ivValue));
                const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
                const data = JSON.parse(decrypted.toString('utf8'));
                const source = data?.file ?? data?.url ?? data?.sources?.file ?? data?.sources?.[0]?.file;
                if (typeof source === 'string' && source) return source;
            } catch {
                // Try next combination
            }
        }
    }
    return null;
}

function getMegaPlaySigningKey(script: string): string | null {
    const objectName = script.match(/\blet\s+([A-Za-z_$][\w$]*)\s*;\s*!\s*function\s*\(\)\s*\{/i)?.[1];
    const entry = script.match(/\bconst\s+[A-Za-z_$][\w$]*\s*=\s*new URLSearchParams\b/);
    if (!objectName || !entry) return null;

    const encoderIndex = script.indexOf('new TextEncoder();return');
    if (encoderIndex < 0) return null;

    const keyVar = script
        .slice(encoderIndex, encoderIndex + 1600)
        .match(/new TextEncoder\(\);return[\s\S]{0,1200}?\]\(([A-Za-z_$][\w$]*)\),\{/i)?.[1];
    if (!keyVar) return null;

    const keyExpression = script.match(
        new RegExp(`(?:const|let|var)\\s+${keyVar}\\s*=\\s*(${objectName}\\.[A-Za-z_$][\\w$]*\\(\\d+\\))`)
    )?.[1];
    if (!keyExpression) return null;

    try {
        const context: Record<string, any> = { console, decodeURI, encodeURI, Math, String, Array, Object, RegExp, Error, SyntaxError };
        context.globalThis = context;
        vm.runInNewContext(
            `${script.slice(0, entry.index)};globalThis.__megaPlaySigningKey=${keyExpression};`,
            context,
            { timeout: 5000 }
        );
        return typeof context.__megaPlaySigningKey === 'string' ? context.__megaPlaySigningKey : null;
    } catch {
        return null;
    }
}

function signMegaPlayUrl(value: string | null, signingKey: string | null): string | null {
    if (!value || !signingKey || /[?&]token=/i.test(value)) return value;
    const match = String(value).match(/\/([a-f0-9]{32})\/([a-f0-9]{32})\//i);
    if (!match) return value;

    const pathKey = `${match[1].toLowerCase()}/${match[2].toLowerCase()}`;
    const payload = `${Math.floor(Date.now() / 1000) + 90}|${pathKey}`;
    const signature = crypto.createHmac('sha256', signingKey).update(payload).digest('base64url');
    const token = `${Buffer.from(payload).toString('base64url')}.${signature}`;
    const endpoint = new URL(value);
    endpoint.searchParams.set('token', token);
    return endpoint.href;
}

function buildSourceUrl(origin: string, path: string, fileId: string): string {
    const endpoint = new URL(path, origin);
    endpoint.searchParams.append('id', fileId);
    endpoint.searchParams.append('id', fileId);
    return endpoint.href;
}

async function extractMegaPlayDetails(embedUrl: string, { referer }: { referer?: string } = {}) {
    const pageUrl = new URL(String(embedUrl));
    const pageHeaders = {
        'User-Agent': UA,
        'Accept': 'text/html,*/*',
        'Referer': referer ?? `${pageUrl.origin}/`,
    };
    const { data: pageHtml } = await axios.get(pageUrl.href, { headers: pageHeaders, timeout: 8000 });
    const fileId = String(pageHtml).match(/data-id=["']([^"']+)["']/i)?.[1];
    if (!fileId) throw new Error(`MegaPlay file id not found: ${embedUrl}`);

    const scriptUrls = [...String(pageHtml).matchAll(/<script[^>]+src=["']([^"']+)["']/gi)]
        .map((m) => new URL(m[1], pageUrl).href);
    const scripts = await Promise.all(scriptUrls.map(async (url) => {
        try {
            const { data } = await axios.get(url, { headers: { 'User-Agent': UA, Referer: pageUrl.href }, timeout: 8000 });
            return String(data);
        } catch {
            return null;
        }
    }));
    const validScripts = scripts.filter((s): s is string => typeof s === 'string');
    const script = validScripts.find((val) => /getSources/i.test(val) && /AES-CBC/i.test(val));
    const signingScript = validScripts.find((val) => val.includes('[a-f0-9]{32}') && val.includes('token='));
    if (!script) throw new Error(`MegaPlay client script not found: ${embedUrl}`);

    const { legacy, modern } = getMegaPlayRoutes(script);
    if (!legacy && !modern) throw new Error(`MegaPlay source routes not found: ${embedUrl}`);

    const sourceHeaders = {
        'User-Agent': UA,
        'Accept': 'application/json,*/*',
        'Referer': pageUrl.href,
        'X-Requested-With': 'XMLHttpRequest',
    };

    const [modernData, legacyData] = await Promise.all([
        modern ? axios.get(buildSourceUrl(pageUrl.origin, modern, fileId), { headers: sourceHeaders, timeout: 8000 }).then(r => r.data).catch(() => null) : null,
        legacy ? axios.get(buildSourceUrl(pageUrl.origin, legacy, fileId), { headers: sourceHeaders, timeout: 8000 }).then(r => r.data).catch(() => null) : null,
    ]);

    const signingKey = signingScript ? getMegaPlaySigningKey(signingScript) : null;
    const modernUrl = signMegaPlayUrl(
        modernData?.sources?.file ?? decryptMegaPlaySource(modernData?.enc, script),
        signingKey
    );
    const legacyUrl = signMegaPlayUrl(
        legacyData?.sources?.file ?? decryptMegaPlaySource(legacyData?.enc, script),
        signingKey
    );

    const sources = [
        modernUrl ? { url: modernUrl, variant: 'modern' } : null,
        legacyUrl ? { url: legacyUrl, variant: 'legacy' } : null,
    ].filter((s): s is { url: string; variant: string } => Boolean(s?.url));

    if (!sources.length) throw new Error(`MegaPlay response has no sources: ${embedUrl}`);
    const metadata = modernData ?? legacyData ?? {};
    return {
        origin: pageUrl.origin,
        sources,
        tracks: Array.isArray(metadata.tracks) ? metadata.tracks : [],
        intro: metadata.intro ?? null,
        outro: metadata.outro ?? null,
    };
}

// ---------------------------------------------------------------------------
// Main Anikoto Scraper Implementation
// ---------------------------------------------------------------------------

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

            let bestCandidate: typeof candidates[number] | null = null;
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

            if (!bestCandidate || bestScore <= 0) return null;

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

                    // If it's a MegaPlay embed, run extractMegaPlayDetails
                    if (/megaplay\.[^/]+\/stream\//i.test(embedUrl)) {
                        const details = await extractMegaPlayDetails(embedUrl, { referer: SPOOF_REF });
                        if (details?.sources?.length) {
                            const foundM3u8 = details.sources[0].url;
                            if (srv.type === 'sub') {
                                m3u8 = foundM3u8;
                                referer = `${details.origin}/`;
                                if (details.tracks) {
                                    for (const t of details.tracks) {
                                        if (t.file) {
                                            subtitles.push({
                                                url: t.file,
                                                lang: t.label || 'Unknown',
                                                default: Boolean(t.default),
                                            });
                                        }
                                    }
                                }
                            } else {
                                dubM3u8 = foundM3u8;
                            }
                        }
                    } else {
                        // Fallback generic extraction
                        const origin = new URL(embedUrl).origin;
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
                    }
                } catch {
                    // skip server link on error
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
                    // ignore playlist parse error
                }
            }

            return {
                m3u8: m3u8 || dubM3u8,
                audio: m3u8 ? 'sub' : 'dub',
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

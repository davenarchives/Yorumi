import axios from 'axios';
import crypto from 'crypto';
import type { VideoSource, StreamResponse, SubtitleTrack } from '../api/anime/video-sources.js';
import { streambertAnimeService } from '../api/anime/anime.service.js';

const BASE = 'https://reanime.to';
const FLIX = 'https://flixcloud.cc';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const H = { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' };

const enc = new TextEncoder();
const dec = new TextDecoder();

async function sha256hex(s: string | Uint8Array): Promise<string> {
    const buf = await crypto.subtle.digest('SHA-256', typeof s === 'string' ? enc.encode(s) : s);
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function b64toU8(b64: string): Uint8Array {
    const bin = Buffer.from(b64, 'base64').toString('binary');
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

async function deriveFields(seed: string) {
    let e = seed;
    for (let i = 0; i < 3; i++) e = await sha256hex(e + i);
    let l = e;
    for (let i = 0; i < 3; i++) l = await sha256hex(l + i);
    return {
        keyField: 'kf_' + e.substring(8, 16),
        ivField: 'ivf_' + e.substring(16, 24),
        containerName: 'cd_' + e.substring(24, 32),
        arrayName: 'ad_' + e.substring(32, 40),
        objectName: 'od_' + e.substring(40, 48),
        tokenField: e.substring(48, 64) + '_' + e.substring(56, 64),
        keyFrag2Field: l.substring(0, 16) + '_' + l.substring(16, 24)
    };
}

function extractSsrObj(html: string): string {
    const m = html.match(/\{type:"data",data:(\{)/);
    if (!m) throw new Error('SSR data block not found');
    let depth = 0;
    const start = html.indexOf('{', m.index! + m[0].length - 1);
    for (let i = start; i < html.length; i++) {
        if (html[i] === '{') depth++;
        else if (html[i] === '}') {
            if (--depth === 0) return html.slice(start, i + 1);
        }
    }
    throw new Error('SSR brace matching failed');
}

function parseJsLiteral(src: string): any {
    let i = 0;
    function ws() { while (i < src.length && /\s/.test(src[i])) i++; }
    function parseValue(): any {
        ws();
        if (src[i] === '{') return parseObject();
        if (src[i] === '[') return parseArray();
        if (src[i] === '"') return parseDStr();
        if (src[i] === "'") return parseSStr();
        if (src.startsWith('true', i)) { i += 4; return true; }
        if (src.startsWith('false', i)) { i += 5; return false; }
        if (src.startsWith('null', i)) { i += 4; return null; }
        if (src.startsWith('undefined', i)) { i += 9; return null; }
        if (src.startsWith('!0', i)) { i += 2; return true; }
        if (src.startsWith('!1', i)) { i += 2; return false; }
        const m = src.slice(i).match(/^-?[\d.]+([eE][+-]?\d+)?/);
        if (m) { i += m[0].length; return parseFloat(m[0]); }
        throw new Error(`JS parse error at pos ${i}`);
    }
    function parseDStr() {
        let r = ''; i++;
        while (i < src.length && src[i] !== '"') {
            if (src[i] === '\\') { i++; r += src[i]; i++; }
            else r += src[i++];
        }
        i++; return r;
    }
    function parseSStr() {
        let r = ''; i++;
        while (i < src.length && src[i] !== "'") {
            if (src[i] === '\\') { i++; r += src[i]; i++; }
            else r += src[i++];
        }
        i++; return r;
    }
    function parseKey() {
        ws();
        if (src[i] === '"') return parseDStr();
        if (src[i] === "'") return parseSStr();
        const m = src.slice(i).match(/^[a-zA-Z_$][a-zA-Z0-9_$]*/);
        if (m) { i += m[0].length; return m[0]; }
        throw new Error(`Bad key at pos ${i}`);
    }
    function parseObject() {
        const obj: any = {}; i++; ws();
        while (i < src.length && src[i] !== '}') {
            if (src[i] === ',') { i++; ws(); continue; }
            const k = parseKey(); ws(); i++; obj[k] = parseValue(); ws();
        }
        i++; return obj;
    }
    function parseArray() {
        const arr: any[] = []; i++; ws();
        while (i < src.length && src[i] !== ']') {
            if (src[i] === ',') { i++; ws(); continue; }
            arr.push(parseValue()); ws();
        }
        i++; return arr;
    }
    return parseValue();
}

function parseWasmDecrypt(wasmBytes: Uint8Array) {
    const b = wasmBytes;
    let pos = 8;
    while (pos < b.length) {
        const secId = b[pos++];
        let sz = 0, sh = 0, by;
        do {
            by = b[pos++];
            sz |= (by & 127) << sh;
            sh += 7;
        } while (by & 128);
        if (secId === 10) {
            pos++;
            let sbs = 0, sh2 = 0, by2;
            do {
                by2 = b[pos++];
                sbs |= (by2 & 127) << sh2;
                sh2 += 7;
            } while (by2 & 128);
            pos += sbs;
            break;
        }
        pos += sz;
    }
    let rbs = 0, sh3 = 0, by3;
    do {
        by3 = b[pos++];
        rbs |= (by3 & 127) << sh3;
        sh3 += 7;
    } while (by3 & 128);
    const r = b.slice(pos, pos + rbs);

    function leb(arr: Uint8Array, idx: number): [number, number] {
        let v = 0, s = 0, b2;
        do {
            b2 = arr[idx++];
            v |= (b2 & 127) << s;
            s += 7;
        } while (b2 & 128);
        return [v, idx];
    }

    const XOR_END = [32, 2, 32, 5, 106, 45, 0, 0, 115, 33, 6];
    let txStart = -1;
    outer: for (let i = 0; i < r.length - XOR_END.length; i++) {
        for (let j = 0; j < XOR_END.length; j++) if (r[i + j] !== XOR_END[j]) continue outer;
        txStart = i + XOR_END.length;
        break;
    }
    if (txStart < 0) throw new Error('WASM: transform start not found');
    let txEnd = -1, step = 36;
    for (let i = txStart; i < r.length - 4; i++) {
        if (r[i] === 32 && r[i + 1] === 5 && r[i + 2] === 65) {
            const [val, ni] = leb(r, i + 3);
            if (r[ni] === 108) {
                txEnd = i;
                step = val;
                break;
            }
        }
    }
    if (txEnd < 0) throw new Error('WASM: keystream not found');
    const code = r.slice(txStart, txEnd);

    function transform(inputByte: number): number {
        let local6 = inputByte & 255;
        const stk: number[] = [];
        let i = 0;
        while (i < code.length) {
            const op = code[i++];
            if (op === 32) {
                const [idx, ni] = leb(code, i);
                i = ni;
                stk.push(idx === 6 ? local6 : 0);
            } else if (op === 33) {
                const [idx, ni] = leb(code, i);
                i = ni;
                const v = stk.pop()!;
                if (idx === 6) local6 = v & 255;
            } else if (op === 65) {
                const [v, ni] = leb(code, i);
                i = ni;
                stk.push(v);
            } else if (op === 106) {
                const b2 = stk.pop()!, a = stk.pop()!;
                stk.push((a + b2) & 255);
            } else if (op === 107) {
                const b2 = stk.pop()!, a = stk.pop()!;
                stk.push((a - b2 + 256) & 255);
            } else if (op === 113) {
                const b2 = stk.pop()!, a = stk.pop()!;
                stk.push((a & b2) & 255);
            } else if (op === 114) {
                const b2 = stk.pop()!, a = stk.pop()!;
                stk.push((a | b2) & 255);
            } else if (op === 115) {
                const b2 = stk.pop()!, a = stk.pop()!;
                stk.push((a ^ b2) & 255);
            } else if (op === 116) {
                const b2 = stk.pop()!, a = stk.pop()!;
                stk.push((a << (b2 & 31)) & 255);
            } else if (op === 117) {
                const b2 = stk.pop()!, a = stk.pop()!;
                stk.push((a >>> (b2 & 31)) & 255);
            } else if (op === 118) {
                const b2 = stk.pop()!, a = stk.pop()!;
                stk.push((a >> (b2 & 31)) & 255);
            }
        }
        return local6;
    }

    return { step, transform };
}

function runDecrypt(wasmBytes: Uint8Array, frag1: Uint8Array, kf2: Uint8Array, T: Uint8Array, seedInt: number): Uint8Array {
    const { step, transform } = parseWasmDecrypt(wasmBytes);
    const out = new Uint8Array(frag1.length);
    for (let i = 0; i < frag1.length; i++) {
        const c = (frag1[i] ^ kf2[i] ^ T[i]) & 255;
        out[i] = transform(c) ^ (((i * step) + seedInt) & 255);
    }
    return out;
}

export async function decryptReAnimeEmbed(html: string) {
    const raw = extractSsrObj(html);
    const data = parseJsLiteral(raw);
    const seed = data.obfuscation_seed;
    if (!seed) throw new Error('obfuscation_seed missing');

    const fields = await deriveFields(seed);
    const ocd = data.obfuscated_crypto_data;
    if (!ocd) throw new Error('obfuscated_crypto_data missing');

    const container = ocd[fields.containerName];
    if (!container) throw new Error(`containerName "${fields.containerName}" not in ocd`);

    const arr = container[fields.arrayName];
    if (!arr) throw new Error(`arrayName "${fields.arrayName}" not in container`);

    const obj = arr[0][fields.objectName];
    if (!obj) throw new Error(`objectName "${fields.objectName}" not in arr[0]`);

    const frag1 = b64toU8(obj[fields.keyField]);
    const iv = b64toU8(obj[fields.ivField]);
    const kf2raw = data[fields.keyFrag2Field];
    if (!kf2raw) throw new Error(`kf2 field "${fields.keyFrag2Field}" not in data`);
    const kf2 = b64toU8(kf2raw);
    const token = data[fields.tokenField];
    if (!token) throw new Error(`tokenField "${fields.tokenField}" missing`);

    const tokRes = await axios.get(`${FLIX}/api/m3u8/${token}`, {
        headers: { ...H, Referer: `${BASE}/` }
    });
    const tokData = tokRes.data;

    const vidKey = (await sha256hex(token + 'vid')).substring(0, 10);
    const keyKey = (await sha256hex(token + 'key')).substring(0, 10);
    const v_bytes = b64toU8(tokData[vidKey]);
    const T_bytes = b64toU8(tokData[keyKey]);

    const seedInt = parseInt(seed.substring(0, 8), 16);
    const wPayload = b64toU8(data.w_payload ?? '');
    const wasmOut = runDecrypt(wPayload, frag1, kf2, T_bytes, seedInt);

    const keyMat = await crypto.subtle.importKey('raw', wasmOut, { name: 'PBKDF2' }, false, ['deriveBits']);
    const derived = new Uint8Array(await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: enc.encode(seed), iterations: 1000, hash: 'SHA-256' },
        keyMat,
        256
    ));
    for (let i = 0; i < 32; i++) derived[i] ^= seed.charCodeAt(i % seed.length);

    const aesKeyBytes = new Uint8Array(await crypto.subtle.digest('SHA-256', derived));
    const aesKey = await crypto.subtle.importKey('raw', aesKeyBytes, { name: 'AES-CBC' }, false, ['decrypt']);
    const plain = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, aesKey, v_bytes);

    const url = dec.decode(plain).trim().replace(/\0+$/, '');
    return {
        url,
        subtitles: data.subtitles ?? [],
        video_title: data.video_title ?? null,
        referer: 'https://flixcloud.cc/'
    };
}

async function resolveReAnimeServers(anilistId: number, episode: number, title?: string): Promise<any[]> {
    let flixServers: any[] = [];
    try {
        const res = await axios.get(`${BASE}/api/flix/${anilistId}/${episode}`, { headers: H });
        if (Array.isArray(res?.data?.servers)) {
            flixServers = res.data.servers;
        }
    } catch (e: any) {
        // Ignore api/flix errors
    }

    let watchServers: any[] = [];
    if (title || flixServers.length === 0) {
        try {
            const query = title || String(anilistId);
            const searchRes = await axios.get(`${BASE}/api/v1/search?q=${encodeURIComponent(query)}&limit=5`, { headers: H });
            const results = Array.isArray(searchRes?.data?.results) ? searchRes.data.results : [];
            let match = results.find((r: any) => {
                const covers = [r?.cover_image?.extra_large, r?.cover_image?.large, r?.cover_image?.medium].filter(Boolean);
                return covers.some((url: string) => url.includes(`bx${anilistId}-`));
            });
            if (!match && results.length > 0) match = results[0];

            if (match?.anime_id) {
                const watchRes = await axios.get(`${BASE}/api/watch/${match.anime_id}/${episode}`, { headers: H });
                if (Array.isArray(watchRes?.data?.episode_links)) {
                    watchServers = watchRes.data.episode_links;
                }
            }
        } catch (e: any) {
            // Ignore search/watch fallback errors
        }
    }

    const merged = [...watchServers];
    const seen = new Set(merged.map((s: any) => s.$id || s.dataLink));
    for (const s of flixServers) {
        const key = s.$id || s.dataLink;
        if (!seen.has(key)) {
            seen.add(key);
            merged.push(s);
        }
    }
    return merged;
}

export async function fetchReAnimeStream(anilistId: number, episode: number, audio: string = 'sub', title?: string) {
    const servers = await resolveReAnimeServers(anilistId, episode, title);
    if (!Array.isArray(servers) || servers.length === 0) {
        console.error("fetchReAnimeStream: No servers found for AniList", anilistId, "episode", episode);
        return null;
    }

    const audioTypes = audio === 'sub' ? ['sub', 's-sub'] : ['dub', 's-dub'];
    const filtered = servers.filter((s: any) => audioTypes.includes(String(s.dataType).toLowerCase()));
    const targets = filtered.length > 0 ? filtered : servers;

    const results: any[] = [];
    for (const targetServer of targets) {
        if (!targetServer?.dataLink) continue;
        try {
            console.log("fetchReAnimeStream: fetching embedLink", targetServer.dataLink);
            const embedRes = await axios.get(targetServer.dataLink, {
                headers: { ...H, Referer: `${BASE}/` }
            });
            if (!embedRes?.data) continue;
            const stream = await decryptReAnimeEmbed(embedRes.data);
            if (stream?.url) {
                (stream as any).serverName = targetServer.serverName || 'HD-1';
                results.push(stream);
            }
        } catch (e: any) {
            console.error("fetchReAnimeStream: embed error for server:", targetServer?.serverName, e.message);
        }
    }

    return results.length > 0 ? results : null;
}

export class ReAnimeScraper implements VideoSource {
    id = 'reanime';

    async getStream(anilistId: number, episode: number, options?: { title?: string; tmdbId?: number; audio?: string }): Promise<StreamResponse | null> {
        try {
            const [subData, dubData] = await Promise.all([
                fetchReAnimeStream(anilistId, episode, 'sub', options?.title).catch(() => null),
                fetchReAnimeStream(anilistId, episode, 'dub', options?.title).catch(() => null),
            ]);

            const subStreams = (subData || []) as any[];
            const dubStreams = (dubData || []) as any[];

            const primarySub = subStreams[0];
            const primaryDub = dubStreams[0];
            const primaryData = primarySub || primaryDub;
            
            if (!primaryData?.url) return null;

            const m3u8 = primarySub?.url || primaryDub?.url;
            const dubM3u8 = primaryDub?.url !== primarySub?.url ? primaryDub?.url : undefined;
            const referer = primaryData.referer || 'https://reanime.to/';

            const subtitles: SubtitleTrack[] = (primaryData.subtitles || []).map((sub: any) => ({
                lang: sub.language || 'eng',
                url: sub.url
            }));

            const variants = subStreams.slice(1).map(s => ({ quality: s.serverName || 'HD-1', url: s.url }));
            const dubVariants = dubStreams.slice(1).map(s => ({ quality: s.serverName || 'HD-1', url: s.url }));

            let title = options?.title;
            if (!title) {
                const metadata = options?.tmdbId ? await streambertAnimeService.getMetadata(options.tmdbId) : null;
                title = metadata?.title?.romaji || metadata?.title?.english || metadata?.title?.native || primaryData.video_title;
            }

            return {
                m3u8,
                dubM3u8,
                variants,
                dubVariants,
                subtitles,
                source: this.id,
                episode,
                title,
                referer
            };
        } catch (error: any) {
            console.error(`ReAnime failed for AniList ${anilistId} ep ${episode}:`, error?.message || error);
            return null;
        }
    }
}

import axios from 'axios';
import { webcrypto as crypto } from 'node:crypto';
import type { VideoSource, StreamResponse } from '../api/anime/video-sources.js';
import { logger } from '../core/logger.js';

const BASE = 'https://reanime.to';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const H = {
    'User-Agent': UA,
    'Accept': 'application/json, */*',
};

function normalizeTitle(value: string): string {
    return String(value || '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .replace(/\b(season|part|cour|nd|rd|th|st)\s*\d+\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function isSafeTitleMatch(query: string, candidate: string): boolean {
    const expected = normalizeTitle(query);
    const actual = normalizeTitle(candidate);
    if (!expected || !actual) return false;
    if (expected === actual) return true;
    if (actual.startsWith(`${expected} `) || expected.startsWith(`${actual} `)) return true;
    const expectedTokens = expected.split(' ').filter((token) => token.length > 1);
    const actualTokens = new Set(actual.split(' ').filter((token) => token.length > 1));
    if (expectedTokens.length < 2) return false;
    const matched = expectedTokens.filter((token) => actualTokens.has(token)).length;
    return matched / expectedTokens.length >= 0.82;
}

// -------------------------------------------------------------
// Flixcloud Extractor
// -------------------------------------------------------------

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function sha256hex(value: string | Uint8Array): Promise<string> {
    const bytes = await crypto.subtle.digest('SHA-256', typeof value === 'string' ? encoder.encode(value) : value);
    return Array.from(new Uint8Array(bytes)).map((item) => item.toString(16).padStart(2, '0')).join('');
}

function b64toU8(value: string): Uint8Array {
    const binary = atob(value);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
}

async function deriveFields(seed: string) {
    let first = seed;
    for (let i = 0; i < 3; i++) first = await sha256hex(first + i);
    let second = first;
    for (let i = 0; i < 3; i++) second = await sha256hex(second + i);
    return {
        keyField: 'kf_' + first.substring(8, 16),
        ivField: 'ivf_' + first.substring(16, 24),
        containerName: 'cd_' + first.substring(24, 32),
        arrayName: 'ad_' + first.substring(32, 40),
        objectName: 'od_' + first.substring(40, 48),
        tokenField: first.substring(48, 64) + '_' + first.substring(56, 64),
        keyFrag2Field: second.substring(0, 16) + '_' + second.substring(16, 24)
    };
}

function extractSsrObj(html: string): string {
    const match = html.match(/\{type:"data",data:(\{)/);
    if (!match) throw new Error('SSR data block not found');
    let depth = 0;
    const start = html.indexOf('{', (match.index || 0) + match[0].length - 1);
    for (let i = start; i < html.length; i++) {
        if (html[i] === '{') depth++;
        else if (html[i] === '}' && --depth === 0) return html.slice(start, i + 1);
    }
    throw new Error('SSR brace matching failed');
}

function parseJsLiteral(source: string): any {
    let index = 0;
    function whitespace() {
        while (index < source.length && /\s/.test(source[index])) index++;
    }
    function doubleString() {
        let out = '';
        index++;
        while (index < source.length && source[index] !== '"') {
            if (source[index] === '\\') {
                index++;
                out += ({ n: '\n', t: '\t', r: '\r', '"': '"', '\\': '\\' } as any)[source[index]] ?? source[index];
                index++;
            } else out += source[index++];
        }
        index++;
        return out;
    }
    function singleString() {
        let out = '';
        index++;
        while (index < source.length && source[index] !== "'") {
            if (source[index] === '\\') {
                index++;
                out += source[index] === "'" ? "'" : (({ n: '\n', t: '\t', r: '\r', '\\': '\\' } as any)[source[index]] ?? source[index]);
                index++;
            } else out += source[index++];
        }
        index++;
        return out;
    }
    function key() {
        whitespace();
        if (source[index] === '"') return doubleString();
        if (source[index] === "'") return singleString();
        const match = source.slice(index).match(/^[a-zA-Z_$][a-zA-Z0-9_$]*/);
        if (!match) throw new Error(`Bad key at pos ${index}`);
        index += match[0].length;
        return match[0];
    }
    function object(): any {
        const out: any = {};
        index++;
        whitespace();
        while (index < source.length && source[index] !== '}') {
            if (source[index] === ',') {
                index++;
                whitespace();
                continue;
            }
            const prop = key();
            whitespace();
            index++;
            out[prop] = value();
            whitespace();
        }
        index++;
        return out;
    }
    function array(): any[] {
        const out: any[] = [];
        index++;
        whitespace();
        while (index < source.length && source[index] !== ']') {
            if (source[index] === ',') {
                index++;
                whitespace();
                continue;
            }
            out.push(value());
            whitespace();
        }
        index++;
        return out;
    }
    function value(): any {
        whitespace();
        if (source[index] === '{') return object();
        if (source[index] === '[') return array();
        if (source[index] === '"') return doubleString();
        if (source[index] === "'") return singleString();
        if (source.startsWith('true', index)) { index += 4; return true; }
        if (source.startsWith('false', index)) { index += 5; return false; }
        if (source.startsWith('null', index)) { index += 4; return null; }
        if (source.startsWith('undefined', index)) { index += 9; return null; }
        if (source.startsWith('!0', index)) { index += 2; return true; }
        if (source.startsWith('!1', index)) { index += 2; return false; }
        const match = source.slice(index).match(/^-?[\d.]+([eE][+-]?\d+)?/);
        if (match) {
            index += match[0].length;
            return parseFloat(match[0]);
        }
        throw new Error(`JS parse error at pos ${index}`);
    }
    return value();
}

function parseWasmDecrypt(bytes: Uint8Array) {
    let position = 8;
    while (position < bytes.length) {
        const section = bytes[position++];
        let size = 0;
        let shift = 0;
        let next: number;
        do {
            next = bytes[position++];
            size |= (next & 127) << shift;
            shift += 7;
        } while (next & 128);
        if (section === 10) {
            position++;
            let bodySize = 0;
            let bodyShift = 0;
            do {
                next = bytes[position++];
                bodySize |= (next & 127) << bodyShift;
                bodyShift += 7;
            } while (next & 128);
            position += bodySize;
            break;
        }
        position += size;
    }
    let functionSize = 0;
    let functionShift = 0;
    let next: number;
    do {
        next = bytes[position++];
        functionSize |= (next & 127) << functionShift;
        functionShift += 7;
    } while (next & 128);
    const body = bytes.slice(position, position + functionSize);
    function leb(array: Uint8Array, index: number): [number, number] {
        let val = 0;
        let s = 0;
        let n: number;
        do {
            n = array[index++];
            val |= (n & 127) << s;
            s += 7;
        } while (n & 128);
        return [val, index];
    }
    const xorEnd = [32, 2, 32, 5, 106, 45, 0, 0, 115, 33, 6];
    let transformStart = -1;
    outer: for (let i = 0; i < body.length - xorEnd.length; i++) {
        for (let j = 0; j < xorEnd.length; j++) if (body[i + j] !== xorEnd[j]) continue outer;
        transformStart = i + xorEnd.length;
        break;
    }
    if (transformStart < 0) throw new Error('WASM: transform start not found');
    let transformEnd = -1;
    let step = 36;
    for (let i = transformStart; i < body.length - 4; i++) {
        if (body[i] === 32 && body[i + 1] === 5 && body[i + 2] === 65) {
            const [val, nextIndex] = leb(body, i + 3);
            if (body[nextIndex] === 108) {
                transformEnd = i;
                step = val;
                break;
            }
        }
    }
    if (transformEnd < 0) throw new Error('WASM: keystream not found');
    const code = body.slice(transformStart, transformEnd);
    function transform(inputByte: number): number {
        let local = inputByte & 255;
        const stack: number[] = [];
        let index = 0;
        while (index < code.length) {
            const opcode = code[index++];
            if (opcode === 32) {
                const [localIndex, nextIndex] = leb(code, index);
                index = nextIndex;
                stack.push(localIndex === 6 ? local : 0);
            } else if (opcode === 33) {
                const [localIndex, nextIndex] = leb(code, index);
                index = nextIndex;
                const val = stack.pop() || 0;
                if (localIndex === 6) local = val & 255;
            } else if (opcode === 65) {
                const [val, nextIndex] = leb(code, index);
                index = nextIndex;
                stack.push(val);
            } else if (opcode === 106) {
                const right = stack.pop() || 0;
                const left = stack.pop() || 0;
                stack.push((left + right) & 255);
            } else if (opcode === 107) {
                const right = stack.pop() || 0;
                const left = stack.pop() || 0;
                stack.push((left - right + 256) & 255);
            } else if (opcode === 113) {
                const right = stack.pop() || 0;
                const left = stack.pop() || 0;
                stack.push((left & right) & 255);
            } else if (opcode === 114) {
                const right = stack.pop() || 0;
                const left = stack.pop() || 0;
                stack.push((left | right) & 255);
            } else if (opcode === 115) {
                const right = stack.pop() || 0;
                const left = stack.pop() || 0;
                stack.push((left ^ right) & 255);
            } else if (opcode === 116) {
                const right = stack.pop() || 0;
                const left = stack.pop() || 0;
                stack.push((left << (right & 7)) & 255);
            } else if (opcode === 118) {
                const right = stack.pop() || 0;
                const left = stack.pop() || 0;
                stack.push((left >>> (right & 7)) & 255);
            }
        }
        return local;
    }
    return { step, transform };
}

function runDecrypt(wasmBytes: Uint8Array, fragment: Uint8Array, keyFragment: Uint8Array, token: Uint8Array, seed: number) {
    const { step, transform } = parseWasmDecrypt(wasmBytes);
    const out = new Uint8Array(fragment.length);
    for (let i = 0; i < fragment.length; i++) {
        const val = fragment[i] ^ keyFragment[i] ^ (token[i] & 255);
        out[i] = (transform(val) ^ (i * step + seed)) & 255;
    }
    return out;
}

export async function extractFlixcloud(embedHtml: string, options: { apiBase?: string; headers?: any; referer?: string } = {}): Promise<any> {
    const apiBase = options.apiBase || 'https://flixcloud.cc';
    const referer = options.referer || 'https://reanime.to/';
    const data = parseJsLiteral(extractSsrObj(embedHtml));
    const seed = data.obfuscation_seed;
    if (!seed) throw new Error('obfuscation_seed missing');
    const fields = await deriveFields(seed);
    const cryptoData = data.obfuscated_crypto_data;
    if (!cryptoData) throw new Error('obfuscated_crypto_data missing');
    const container = cryptoData[fields.containerName];
    if (!container) throw new Error(`containerName "${fields.containerName}" not in ocd`);
    const array = container[fields.arrayName];
    if (!array) throw new Error(`arrayName "${fields.arrayName}" not in container`);
    const object = array[0][fields.objectName];
    if (!object) throw new Error(`objectName "${fields.objectName}" not in arr[0]`);

    const fragment = b64toU8(object[fields.keyField]);
    const iv = b64toU8(object[fields.ivField]);
    const keyFragmentRaw = data[fields.keyFrag2Field];
    if (!keyFragmentRaw) throw new Error(`kf2 field "${fields.keyFrag2Field}" not in data`);
    const keyFragment = b64toU8(keyFragmentRaw);
    const token = data[fields.tokenField];
    if (!token) throw new Error(`tokenField "${fields.tokenField}" missing`);

    const tokenRes = await axios.get(`${apiBase}/api/m3u8/${token}`, {
        headers: { ...H, Referer: referer },
    });
    const tokenData = tokenRes.data;
    const videoKey = (await sha256hex(token + 'vid')).substring(0, 10);
    const tokenKey = (await sha256hex(token + 'key')).substring(0, 10);
    const videoBytes = b64toU8(tokenData[videoKey]);
    const tokenBytes = b64toU8(tokenData[tokenKey]);

    const seedNumber = parseInt(seed.substring(0, 8), 16);
    const wasmPayload = b64toU8(data.w_payload ?? '');
    if (!wasmPayload.length) throw new Error('w_payload missing from embed data');

    const wasmOut = runDecrypt(wasmPayload, fragment, keyFragment, tokenBytes, seedNumber);
    const material = await crypto.subtle.importKey('raw', wasmOut, { name: 'PBKDF2' }, false, ['deriveBits']);
    const derived = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: encoder.encode(seed), iterations: 1000, hash: 'SHA-256' }, material, 256));
    for (let i = 0; i < 32; i++) derived[i] ^= seed.charCodeAt(i % seed.length);
    const aesKeyBytes = new Uint8Array(await crypto.subtle.digest('SHA-256', derived));
    const aesKey = await crypto.subtle.importKey('raw', aesKeyBytes, { name: 'AES-CBC' }, false, ['decrypt']);

    const plain = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, aesKey, videoBytes);
    const url = decoder.decode(plain).trim().replace(/\0+$/, '');
    if (!url.startsWith('http')) throw new Error(`Unexpected decrypted value: ${url.substring(0, 60)}`);

    return {
        url,
        subtitles: data.subtitles ?? [],
        thumbnails_vtt: data.thumbnails_vtt ?? null,
        video_title: data.video_title ?? null,
        intro_chapter: data.intro_chapter ?? null,
        outro_chapter: data.outro_chapter ?? null,
        video_id: data.video_id ?? null,
    };
}

// -------------------------------------------------------------
// ReAnime Scraper Class
// -------------------------------------------------------------

export class ReAnimeScraper implements VideoSource {
    id = 'reanime';

    async resolveAnimeId(title: string, anilistId?: number): Promise<string | null> {
        try {
            const res = await axios.get(`${BASE}/api/v1/search`, {
                params: { q: title, limit: 10 },
                headers: H,
                timeout: 8000,
            });
            const results = Array.isArray(res.data?.results) ? res.data.results : [];
            if (results.length === 0) return null;

            if (anilistId) {
                const match = results.find((r: any) => Number(r.anilist_id) === Number(anilistId));
                if (match?.anime_id) return match.anime_id;
            }

            const safeMatch = results.find((r: any) => {
                const candidateTitles = [
                    r.title,
                    r.name,
                    r.english,
                    r.english_title,
                    r.romaji,
                    r.native,
                ].map((value) => String(value || '')).filter(Boolean);
                return candidateTitles.some((candidate) => isSafeTitleMatch(title, candidate));
            });

            return safeMatch?.anime_id || null;
        } catch {
            return null;
        }
    }

    async getStream(
        anilistId: number,
        episode: number,
        options?: { title?: string; titles?: any; tmdbId?: number; format?: string; anilistId?: number }
    ): Promise<StreamResponse | null> {
        try {
            const targetAnilistId = anilistId || options?.anilistId;
            let servers: any[] = [];

            // Fast path 1: Direct flix endpoint by AniList ID
            if (targetAnilistId && targetAnilistId > 0) {
                try {
                    const flixRes = await axios.get(`${BASE}/api/flix/${targetAnilistId}/${episode}`, {
                        headers: H,
                        timeout: 8000,
                    });
                    if (flixRes.data?.success && Array.isArray(flixRes.data?.servers)) {
                        servers = flixRes.data.servers;
                    }
                } catch {
                    // Ignore, fallback to title search
                }
            }

            // Fast path 2: Search by title if no servers resolved
            if (servers.length === 0 && options?.title) {
                const animeId = await this.resolveAnimeId(options.title, targetAnilistId);
                if (animeId) {
                    try {
                        const watchRes = await axios.get(`${BASE}/api/watch/${animeId}/${episode}`, {
                            headers: H,
                            timeout: 8000,
                        });
                        if (Array.isArray(watchRes.data?.episode_links)) {
                            servers = watchRes.data.episode_links;
                        }
                    } catch {
                        // ignore
                    }
                }
            }

            if (servers.length === 0) return null;

            let subM3u8 = '';
            let dubM3u8 = '';
            const subtitles: any[] = [];

            for (const srv of servers) {
                if (!srv?.dataLink) continue;
                const isDub = srv.dataType === 'dub' || /dub/i.test(srv.dataType || '');
                if (isDub && dubM3u8) continue;
                if (!isDub && subM3u8) continue;

                try {
                    const embedRes = await axios.get(srv.dataLink, {
                        headers: { ...H, Referer: `${BASE}/` },
                        timeout: 10000,
                    });
                    const embedHtml = String(embedRes.data || '');
                    const decrypted = await extractFlixcloud(embedHtml, {
                        apiBase: 'https://flixcloud.cc',
                        referer: `${BASE}/`,
                    });

                    if (decrypted?.url) {
                        // Validate that decrypted.url is an actual playable playlist
                        let isValidPlayable = false;
                        try {
                            const probe = await axios.get(decrypted.url, {
                                headers: {
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                                    Referer: 'https://flixcloud.cc/',
                                },
                                timeout: 4000,
                            });
                            const body = String(probe.data || '');
                            if (probe.status === 200 && body.includes('#EXT')) {
                                isValidPlayable = true;
                            }
                        } catch (probeErr: any) {
                            logger.warn(`[reanime] flixcloud stream validation failed: ${probeErr?.message}`);
                        }

                        if (isValidPlayable) {
                            if (isDub) {
                                dubM3u8 = decrypted.url;
                            } else {
                                subM3u8 = decrypted.url;
                                if (Array.isArray(decrypted.subtitles)) {
                                    for (const sub of decrypted.subtitles) {
                                        if (sub.url) {
                                            subtitles.push({
                                                url: sub.url,
                                                lang: sub.language || 'English',
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
                } catch (e: any) {
                    logger.warn(`[reanime] failed extracting from server ${srv.serverName}`, e?.message || e);
                }
            }

            const activeM3u8 = subM3u8 || dubM3u8;
            if (!activeM3u8) return null;

            return {
                m3u8: activeM3u8,
                audio: subM3u8 ? 'sub' : 'dub',
                dubM3u8: dubM3u8 || undefined,
                subtitles,
                source: this.id,
                episode,
                title: options?.title || `Episode ${episode}`,
                referer: `${BASE}/`,
                isEmbed: false,
            };
        } catch (error: any) {
            logger.warn(`[reanime] getStream failed for AniList ${anilistId} ep ${episode}`, error?.message || error);
            return null;
        }
    }
}

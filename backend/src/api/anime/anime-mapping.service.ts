import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export type MappingStatus = 'verified' | 'unverified' | 'conflicting' | 'unresolved';

export interface AnimeEpisodeSegment {
    tmdbSeason: number;
    tmdbEpisodeStart: number;
    tmdbEpisodeEnd: number;
    localEpisodeStart: number;
    localEpisodeEnd: number;
}

export interface CanonicalAnimeMapping {
    yorumiId: string;
    anilistId: number;
    malId?: number;
    tmdbShowId?: number;
    tmdbMovieId?: number;
    segments: AnimeEpisodeSegment[];
    status: MappingStatus;
    source: 'anibridge-v3';
    schemaVersion?: string;
    generatedOn?: string;
    conflicts: string[];
}

type AniBridgeTargetRanges = Record<string, string | null>;
type AniBridgePayload = Record<string, AniBridgeTargetRanges | Record<string, unknown> | string[]> & {
    $meta?: { schema_version?: string; generated_on?: string };
};

type MappingIndexes = {
    byAniList: Map<number, CanonicalAnimeMapping>;
    byTmdbShow: Map<number, CanonicalAnimeMapping[]>;
    byTmdbMovie: Map<number, CanonicalAnimeMapping[]>;
};

const DEFAULT_DATASET_URL = 'https://github.com/anibridge/anibridge-mappings/releases/download/v3/mappings.json';
const DATASET_TTL_MS = 24 * 60 * 60 * 1000;
const cachePath = process.env.YORUMI_ANIME_MAPPING_CACHE
    || join(tmpdir(), 'yorumi', 'anibridge-v3-mappings.json');

let indexesPromise: Promise<MappingIndexes> | null = null;

const parseClosedRange = (value: string): { start: number; end: number } | null => {
    const match = String(value || '').trim().match(/^(\d+)(?:-(\d+))?$/);
    if (!match) return null;
    const start = Number(match[1]);
    const end = Number(match[2] || match[1]);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start <= 0 || end < start) return null;
    return { start, end };
};

const addIndexValue = <T>(index: Map<number, T[]>, key: number, value: T) => {
    const existing = index.get(key) || [];
    existing.push(value);
    index.set(key, existing);
};

export const buildAnimeMappingIndexes = (payload: AniBridgePayload): MappingIndexes => {
    const byAniList = new Map<number, CanonicalAnimeMapping>();
    const byTmdbShow = new Map<number, CanonicalAnimeMapping[]>();
    const byTmdbMovie = new Map<number, CanonicalAnimeMapping[]>();
    const schemaVersion = payload.$meta?.schema_version;
    const generatedOn = payload.$meta?.generated_on;

    for (const [sourceDescriptor, rawTargets] of Object.entries(payload)) {
        const sourceMatch = sourceDescriptor.match(/^anilist:(\d+)$/);
        if (!sourceMatch || !rawTargets || Array.isArray(rawTargets) || typeof rawTargets !== 'object') continue;

        const anilistId = Number(sourceMatch[1]);
        const segments: AnimeEpisodeSegment[] = [];
        const conflicts: string[] = [];
        let malId: number | undefined;
        let tmdbShowId: number | undefined;
        let tmdbMovieId: number | undefined;

        for (const [targetDescriptor, rawRanges] of Object.entries(rawTargets)) {
            if (!rawRanges || typeof rawRanges !== 'object' || Array.isArray(rawRanges)) continue;
            const malMatch = targetDescriptor.match(/^mal:(\d+)$/);
            if (malMatch) {
                malId = Number(malMatch[1]);
                continue;
            }

            const movieMatch = targetDescriptor.match(/^tmdb_movie:(\d+)$/);
            if (movieMatch) {
                tmdbMovieId = Number(movieMatch[1]);
                continue;
            }

            const showMatch = targetDescriptor.match(/^tmdb_show:(\d+):s(\d+)$/);
            if (!showMatch) continue;
            const candidateShowId = Number(showMatch[1]);
            const tmdbSeason = Number(showMatch[2]);
            if (tmdbShowId && tmdbShowId !== candidateShowId) {
                conflicts.push(`Multiple TMDB shows: ${tmdbShowId}, ${candidateShowId}`);
                continue;
            }
            tmdbShowId = candidateShowId;

            for (const [localRangeValue, tmdbRangeValue] of Object.entries(rawRanges as AniBridgeTargetRanges)) {
                if (typeof tmdbRangeValue !== 'string' || /[,|]/.test(tmdbRangeValue)) {
                    conflicts.push(`Unsupported range ${localRangeValue} -> ${String(tmdbRangeValue)}`);
                    continue;
                }
                const localRange = parseClosedRange(localRangeValue);
                const tmdbRange = parseClosedRange(tmdbRangeValue);
                if (!localRange || !tmdbRange) {
                    conflicts.push(`Open or invalid range ${localRangeValue} -> ${tmdbRangeValue}`);
                    continue;
                }
                if ((localRange.end - localRange.start) !== (tmdbRange.end - tmdbRange.start)) {
                    conflicts.push(`Non-1:1 range ${localRangeValue} -> ${tmdbRangeValue}`);
                    continue;
                }
                segments.push({
                    tmdbSeason,
                    tmdbEpisodeStart: tmdbRange.start,
                    tmdbEpisodeEnd: tmdbRange.end,
                    localEpisodeStart: localRange.start,
                    localEpisodeEnd: localRange.end,
                });
            }
        }

        segments.sort((a, b) => a.localEpisodeStart - b.localEpisodeStart);
        for (let index = 1; index < segments.length; index += 1) {
            const previous = segments[index - 1];
            const current = segments[index];
            if (current.localEpisodeStart <= previous.localEpisodeEnd) {
                conflicts.push(
                    `Overlapping local ranges ${previous.localEpisodeStart}-${previous.localEpisodeEnd} and ${current.localEpisodeStart}-${current.localEpisodeEnd}`
                );
            }
        }
        const status: MappingStatus = conflicts.length > 0
            ? 'conflicting'
            : (tmdbMovieId || segments.length > 0 ? 'verified' : 'unresolved');
        const mapping: CanonicalAnimeMapping = {
            yorumiId: `anime:anilist:${anilistId}`,
            anilistId,
            malId,
            tmdbShowId,
            tmdbMovieId,
            segments,
            status,
            source: 'anibridge-v3',
            schemaVersion,
            generatedOn,
            conflicts,
        };
        byAniList.set(anilistId, mapping);
        if (tmdbShowId) addIndexValue(byTmdbShow, tmdbShowId, mapping);
        if (tmdbMovieId) addIndexValue(byTmdbMovie, tmdbMovieId, mapping);
    }

    for (const mappings of byTmdbShow.values()) {
        mappings.sort((a, b) => {
            const aStart = a.segments[0]?.tmdbEpisodeStart || 0;
            const bStart = b.segments[0]?.tmdbEpisodeStart || 0;
            return aStart - bStart || a.anilistId - b.anilistId;
        });
    }

    return { byAniList, byTmdbShow, byTmdbMovie };
};

const readDatasetFile = async (): Promise<AniBridgePayload | null> => {
    try {
        return JSON.parse(await readFile(cachePath, 'utf8')) as AniBridgePayload;
    } catch {
        return null;
    }
};

const isDatasetFresh = async () => {
    try {
        const info = await stat(cachePath);
        return Date.now() - info.mtimeMs < DATASET_TTL_MS;
    } catch {
        return false;
    }
};

const downloadDataset = async (): Promise<AniBridgePayload> => {
    const response = await fetch(process.env.YORUMI_ANIME_MAPPING_URL || DEFAULT_DATASET_URL, {
        headers: { Accept: 'application/json', 'User-Agent': 'Yorumi/4 anime-mapping-sync' },
        signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`AniBridge mapping sync failed: ${response.status}`);
    const text = await response.text();
    const parsed = JSON.parse(text) as AniBridgePayload;
    if (!parsed.$meta?.schema_version || !String(parsed.$meta.schema_version).startsWith('3.')) {
        throw new Error(`Unsupported AniBridge schema ${String(parsed.$meta?.schema_version || 'unknown')}`);
    }
    await mkdir(dirname(cachePath), { recursive: true });
    await writeFile(cachePath, text, 'utf8');
    return parsed;
};

const loadIndexes = async (): Promise<MappingIndexes> => {
    const cached = await readDatasetFile();
    if (cached && await isDatasetFresh()) return buildAnimeMappingIndexes(cached);
    try {
        return buildAnimeMappingIndexes(await downloadDataset());
    } catch (error) {
        if (cached) {
            console.warn('[anime-mapping] Dataset refresh failed; using stale local copy.', error);
            return buildAnimeMappingIndexes(cached);
        }
        throw error;
    }
};

const getIndexes = () => {
    if (!indexesPromise) {
        indexesPromise = loadIndexes().catch((error) => {
            indexesPromise = null;
            throw error;
        });
    }
    return indexesPromise;
};

export const animeMappingService = {
    async getByAniListId(anilistId: number) {
        return (await getIndexes()).byAniList.get(anilistId) || null;
    },

    async getByTmdbShowId(tmdbShowId: number) {
        return (await getIndexes()).byTmdbShow.get(tmdbShowId) || [];
    },

    async getByTmdbMovieId(tmdbMovieId: number) {
        return (await getIndexes()).byTmdbMovie.get(tmdbMovieId) || [];
    },
};

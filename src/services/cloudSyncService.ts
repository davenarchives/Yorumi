import { setLocalStorageWithCleanup } from '../utils/localStorageQuota';
import { storage } from '../utils/storage';

const DISCORD_SESSION_KEY = 'yorumi_discord_chat_session_v1';
const DISCORD_SESSION_EVENT = 'yorumi-discord-session-updated';
const STORAGE_UPDATED_EVENT = 'yorumi-storage-updated';
const LAST_SYNCED_UID_KEY = 'yorumi_cloud_sync_uid_v1';

const PUSH_DEBOUNCE_MS = 15_000;

/**
 * Strictly user-owned library & history keys.
 * Caches, offline media blobs, and auth tokens are intentionally excluded.
 */
export const SYNCED_USER_KEYS = [
    'yorumi_continue_watching',
    'yorumi_continue_reading',
    'yorumi_ln_continue_reading_v1',
    'yorumi_watch_list',
    'yorumi_read_list',
    'yorumi_ln_read_list_v1',
    'yorumi_episode_history',
    'yorumi_chapter_history',
    'yorumi_favorite_anime',
    'yorumi_favorite_manga',
    'yorumi_favorite_ln',
    'yorumi_library_categories_v1',
    'yorumi_activity_history',
    'yorumi_activity_seen',
    'yorumi_anime_watch_time',
    'yorumi_anime_watch_time_total',
    'yorumi_anime_genre_cache',
    'yorumi_manga_genre_cache',
    'yorumi_profile_first_seen_v1',
] as const;

type SyncedUserKey = (typeof SYNCED_USER_KEYS)[number];
type SyncPayload = Partial<Record<SyncedUserKey, unknown>>;

interface DiscordSession {
    token: string;
    user: {
        id: string;
        username: string;
    };
}

interface ArrayMergeConfig {
    idFields: string[];
    timeFields: string[];
}

const ARRAY_KEY_CONFIG: Partial<Record<SyncedUserKey, ArrayMergeConfig>> = {
    yorumi_continue_watching: { idFields: ['animeId'], timeFields: ['lastWatched', 'timestamp'] },
    yorumi_continue_reading: { idFields: ['mangaId'], timeFields: ['lastRead', 'timestamp'] },
    yorumi_ln_continue_reading_v1: { idFields: ['novelId', 'id'], timeFields: ['updatedAt'] },
    yorumi_watch_list: { idFields: ['id'], timeFields: ['addedAt'] },
    yorumi_read_list: { idFields: ['id'], timeFields: ['addedAt'] },
    yorumi_ln_read_list_v1: { idFields: ['id'], timeFields: ['addedAt'] },
    yorumi_favorite_anime: { idFields: ['id'], timeFields: ['addedAt'] },
    yorumi_favorite_manga: { idFields: ['id'], timeFields: ['addedAt'] },
    yorumi_favorite_ln: { idFields: ['id'], timeFields: ['addedAt'] },
};

const DEFAULT_SYNC_API_BASE = 'https://yorumibot-1.onrender.com/api';

const getSyncApiBase = (): string | null => {
    const explicit = String(import.meta.env.VITE_SYNC_API_URL || '').trim();
    if (explicit) return explicit.replace(/\/+$/, '');

    return DEFAULT_SYNC_API_BASE;
};

const readDiscordSession = (): DiscordSession | null => {
    if (typeof localStorage === 'undefined') return null;
    try {
        const raw = localStorage.getItem(DISCORD_SESSION_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<DiscordSession>;
        if (!parsed?.token || !parsed?.user?.id || !parsed?.user?.username) return null;
        return parsed as DiscordSession;
    } catch {
        return null;
    }
};

const safeParseJson = (raw: string | null): unknown => {
    if (raw === null) return undefined;
    try {
        return JSON.parse(raw);
    } catch {
        return raw;
    }
};

const toTimestampMs = (value: unknown): number => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const numeric = Number(value);
        if (Number.isFinite(numeric)) return numeric;
        const parsed = Date.parse(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
};

const extractRecordId = (item: Record<string, unknown>, idFields: string[]): string | null => {
    for (const field of idFields) {
        const val = item[field];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
            return String(val);
        }
    }
    return null;
};

const extractRecordTime = (item: Record<string, unknown>, timeFields: string[]): number => {
    let best = 0;
    for (const field of timeFields) {
        best = Math.max(best, toTimestampMs(item[field]));
    }
    return best;
};

const mergeObjectArrays = (
    localVal: unknown,
    remoteVal: unknown,
    config: ArrayMergeConfig,
): unknown[] => {
    const localArr = Array.isArray(localVal) ? localVal : [];
    const remoteArr = Array.isArray(remoteVal) ? remoteVal : [];
    const byId = new Map<string, { item: Record<string, unknown>; time: number }>();

    const ingest = (arr: unknown[], preferOnTie: boolean) => {
        for (const entry of arr) {
            if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
            const record = entry as Record<string, unknown>;
            const id = extractRecordId(record, config.idFields);
            if (!id) continue;
            const time = extractRecordTime(record, config.timeFields);
            const existing = byId.get(id);
            if (!existing || time > existing.time || (preferOnTie && time === existing.time)) {
                byId.set(id, { item: record, time });
            }
        }
    };

    ingest(remoteArr, false);
    ingest(localArr, true);

    return Array.from(byId.values())
        .sort((a, b) => b.time - a.time)
        .map((entry) => entry.item);
};

const mergeStringArrayMap = (localVal: unknown, remoteVal: unknown): Record<string, string[]> => {
    const result: Record<string, Set<string>> = {};
    const ingest = (source: unknown) => {
        if (!source || typeof source !== 'object' || Array.isArray(source)) return;
        for (const [k, v] of Object.entries(source as Record<string, unknown>)) {
            if (!Array.isArray(v)) continue;
            if (!result[k]) result[k] = new Set<string>();
            for (const item of v) {
                if (item !== undefined && item !== null) result[k].add(String(item));
            }
        }
    };
    ingest(remoteVal);
    ingest(localVal);

    const out: Record<string, string[]> = {};
    for (const [k, set] of Object.entries(result)) {
        out[k] = Array.from(set);
    }
    return out;
};

const mergeNumericMaxMap = (localVal: unknown, remoteVal: unknown): Record<string, number> => {
    const out: Record<string, number> = {};
    const ingest = (source: unknown) => {
        if (!source || typeof source !== 'object' || Array.isArray(source)) return;
        for (const [k, v] of Object.entries(source as Record<string, unknown>)) {
            const num = Number(v);
            if (!Number.isFinite(num)) continue;
            out[k] = Math.max(out[k] ?? 0, num);
        }
    };
    ingest(remoteVal);
    ingest(localVal);
    return out;
};

const mergeLibraryCategories = (localVal: unknown, remoteVal: unknown): unknown => {
    const tabs = ['anime', 'manga', 'ln'] as const;
    const result: Record<string, Array<{ id: string; name: string; itemIds: string[] }>> = {
        anime: [],
        manga: [],
        ln: [],
    };
    const localObj = localVal && typeof localVal === 'object' ? (localVal as Record<string, unknown>) : {};
    const remoteObj = remoteVal && typeof remoteVal === 'object' ? (remoteVal as Record<string, unknown>) : {};

    for (const tab of tabs) {
        const byId = new Map<string, { id: string; name: string; itemIds: Set<string> }>();
        const ingest = (list: unknown) => {
            if (!Array.isArray(list)) return;
            for (const raw of list) {
                if (!raw || typeof raw !== 'object') continue;
                const cat = raw as { id?: unknown; name?: unknown; itemIds?: unknown };
                if (!cat.id || !cat.name) continue;
                const id = String(cat.id);
                const existing = byId.get(id);
                const ids = Array.isArray(cat.itemIds) ? cat.itemIds.map(String) : [];
                if (existing) {
                    existing.name = String(cat.name);
                    ids.forEach((itemId) => existing.itemIds.add(itemId));
                } else {
                    byId.set(id, { id, name: String(cat.name), itemIds: new Set(ids) });
                }
            }
        };
        ingest(remoteObj[tab]);
        ingest(localObj[tab]);
        result[tab] = Array.from(byId.values()).map((cat) => ({
            id: cat.id,
            name: cat.name,
            itemIds: Array.from(cat.itemIds),
        }));
    }
    return result;
};

const mergeKeyValue = (key: SyncedUserKey, localVal: unknown, remoteVal: unknown): unknown => {
    if (remoteVal === undefined) return localVal;
    if (localVal === undefined) return remoteVal;

    const arrayConfig = ARRAY_KEY_CONFIG[key];
    if (arrayConfig) {
        return mergeObjectArrays(localVal, remoteVal, arrayConfig);
    }

    if (
        key === 'yorumi_episode_history' ||
        key === 'yorumi_chapter_history' ||
        key === 'yorumi_anime_genre_cache' ||
        key === 'yorumi_manga_genre_cache'
    ) {
        return mergeStringArrayMap(localVal, remoteVal);
    }

    if (key === 'yorumi_activity_history' || key === 'yorumi_anime_watch_time') {
        return mergeNumericMaxMap(localVal, remoteVal);
    }

    if (key === 'yorumi_activity_seen') {
        const r = remoteVal && typeof remoteVal === 'object' ? (remoteVal as Record<string, unknown>) : {};
        const l = localVal && typeof localVal === 'object' ? (localVal as Record<string, unknown>) : {};
        return { ...r, ...l };
    }

    if (key === 'yorumi_anime_watch_time_total') {
        return Math.max(Number(localVal) || 0, Number(remoteVal) || 0);
    }

    if (key === 'yorumi_profile_first_seen_v1') {
        const l = Number(localVal);
        const r = Number(remoteVal);
        if (Number.isFinite(l) && l > 0 && Number.isFinite(r) && r > 0) return Math.min(l, r);
        return Number.isFinite(l) && l > 0 ? l : r;
    }

    if (key === 'yorumi_library_categories_v1') {
        return mergeLibraryCategories(localVal, remoteVal);
    }

    return localVal;
};

const collectLocalPayload = (): SyncPayload => {
    const payload: SyncPayload = {};
    if (typeof localStorage === 'undefined') return payload;

    for (const key of SYNCED_USER_KEYS) {
        const parsed = safeParseJson(localStorage.getItem(key));
        if (parsed !== undefined) {
            payload[key] = parsed;
        }
    }
    return payload;
};

const serializePayload = (payload: SyncPayload): string => JSON.stringify(payload);

class CloudSyncService {
    private started = false;
    private isApplyingRemote = false;
    private pushTimer: number | null = null;
    private lastSyncedHashByUser = new Map<string, string>();
    private activeUserId: string | null = null;
    private inflightPull: Promise<void> | null = null;
    private lastPullAt = 0;

    start(): void {
        if (this.started || typeof window === 'undefined') return;
        this.started = true;

        window.addEventListener(DISCORD_SESSION_EVENT, this.handleSessionChange);
        window.addEventListener(STORAGE_UPDATED_EVENT, this.handleStorageUpdated);
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
        window.addEventListener('pagehide', this.handlePageHide);

        const session = readDiscordSession();
        if (session) {
            this.activeUserId = session.user.id;
            void this.pullAndMerge(session);
        }
    }

    stop(): void {
        if (!this.started || typeof window === 'undefined') return;
        this.started = false;

        if (this.pushTimer !== null) {
            window.clearTimeout(this.pushTimer);
            this.pushTimer = null;
        }

        window.removeEventListener(DISCORD_SESSION_EVENT, this.handleSessionChange);
        window.removeEventListener(STORAGE_UPDATED_EVENT, this.handleStorageUpdated);
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        window.removeEventListener('pagehide', this.handlePageHide);
    }

    private handleSessionChange = (): void => {
        const session = readDiscordSession();
        if (!session) {
            this.activeUserId = null;
            if (this.pushTimer !== null) {
                window.clearTimeout(this.pushTimer);
                this.pushTimer = null;
            }
            return;
        }

        if (session.user.id !== this.activeUserId) {
            this.activeUserId = session.user.id;
            void this.pullAndMerge(session);
        }
    };

    private handleStorageUpdated = (): void => {
        if (this.isApplyingRemote) return;
        const session = readDiscordSession();
        if (!session) return;
        this.schedulePush();
    };

    private handleVisibilityChange = (): void => {
        if (document.visibilityState === 'hidden') {
            void this.flushPendingPush(true);
        } else if (document.visibilityState === 'visible') {
            const session = readDiscordSession();
            if (session && Date.now() - this.lastPullAt >= 20_000) {
                void this.pullAndMerge(session);
            }
        }
    };

    private handlePageHide = (): void => {
        void this.flushPendingPush(true);
    };

    private schedulePush(): void {
        if (this.pushTimer !== null) {
            window.clearTimeout(this.pushTimer);
        }
        this.pushTimer = window.setTimeout(() => {
            this.pushTimer = null;
            void this.pushNow(false);
        }, PUSH_DEBOUNCE_MS);
    }

    async pullAndMerge(sessionOverride?: DiscordSession): Promise<void> {
        const session = sessionOverride || readDiscordSession();
        const apiBase = getSyncApiBase();
        if (!session || !apiBase) return;

        if (this.inflightPull) {
            await this.inflightPull;
            return;
        }

        this.inflightPull = (async () => {
            try {
                const res = await fetch(`${apiBase}/sync/library`, {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${session.token}`,
                    },
                });
                if (!res.ok) return;

                const json = (await res.json()) as {
                    success?: boolean;
                    data?: { payload?: SyncPayload | null };
                };
                const remotePayload = json?.data?.payload;
                const localPayload = collectLocalPayload();
                const previousSyncedUid = localStorage.getItem(LAST_SYNCED_UID_KEY);
                const isSwitchingAccount = Boolean(previousSyncedUid && previousSyncedUid !== session.user.id);

                if (!remotePayload || typeof remotePayload !== 'object') {
                    localStorage.setItem(LAST_SYNCED_UID_KEY, session.user.id);
                    // First sign-in with no cloud backup yet — register profile and push local data (unless switching accounts).
                    if (!isSwitchingAccount) {
                        await this.pushNow(false);
                    } else {
                        this.lastSyncedHashByUser.set(session.user.id, serializePayload(localPayload));
                    }
                    return;
                }

                const merged: SyncPayload = {};
                let localChanged = false;

                for (const key of SYNCED_USER_KEYS) {
                    const localVal = isSwitchingAccount ? undefined : localPayload[key];
                    const remoteVal = remotePayload[key];
                    if (localVal === undefined && remoteVal === undefined) continue;

                    const nextVal = mergeKeyValue(key, localVal, remoteVal);
                    merged[key] = nextVal;

                    if (JSON.stringify(localPayload[key]) !== JSON.stringify(nextVal)) {
                        localChanged = true;
                    }
                }

                if (localChanged || isSwitchingAccount) {
                    this.isApplyingRemote = true;
                    try {
                        for (const key of SYNCED_USER_KEYS) {
                            if (merged[key] === undefined) {
                                if (isSwitchingAccount) localStorage.removeItem(key);
                                continue;
                            }
                            const valueToStore =
                                typeof merged[key] === 'string' && key === 'yorumi_profile_first_seen_v1'
                                    ? merged[key]
                                    : JSON.stringify(merged[key]);
                            setLocalStorageWithCleanup(key, valueToStore);
                        }
                        storage.invalidateMemoryCache(SYNCED_USER_KEYS);
                        window.dispatchEvent(new CustomEvent(STORAGE_UPDATED_EVENT));
                    } finally {
                        this.isApplyingRemote = false;
                    }
                }

                localStorage.setItem(LAST_SYNCED_UID_KEY, session.user.id);

                const mergedHash = serializePayload(merged);
                const remoteHash = serializePayload(
                    SYNCED_USER_KEYS.reduce<SyncPayload>((acc, key) => {
                        if (remotePayload[key] !== undefined) acc[key] = remotePayload[key];
                        return acc;
                    }, {}),
                );

                this.lastSyncedHashByUser.set(session.user.id, remoteHash);
                if (mergedHash !== remoteHash) {
                    this.schedulePush();
                }
            } catch {
                // Offline or backend unavailable — stay silent and preserve local data.
            } finally {
                this.lastPullAt = Date.now();
                this.inflightPull = null;
            }
        })();

        await this.inflightPull;
    }

    async flushPendingPush(keepalive = false): Promise<void> {
        if (this.pushTimer !== null) {
            window.clearTimeout(this.pushTimer);
            this.pushTimer = null;
        }
        await this.pushNow(keepalive);
    }

    async pushNow(keepalive = false): Promise<void> {
        const session = readDiscordSession();
        const apiBase = getSyncApiBase();
        if (!session || !apiBase) return;

        const payload = collectLocalPayload();
        const snapshot = serializePayload(payload);
        if (this.lastSyncedHashByUser.get(session.user.id) === snapshot) {
            return;
        }

        try {
            const res = await fetch(`${apiBase}/sync/library`, {
                method: 'PUT',
                keepalive,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.token}`,
                },
                body: JSON.stringify({ payload }),
            });
            if (res.ok) {
                this.lastSyncedHashByUser.set(session.user.id, snapshot);
            }
        } catch {
            // Offline or backend unreachable; next update will retry automatically.
        }
    }
}

export const cloudSyncService = new CloudSyncService();

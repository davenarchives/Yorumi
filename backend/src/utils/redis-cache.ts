import { Redis } from '@upstash/redis';

type MemoryEntry = { value: unknown; expiresAt: number };

const hasRedisConfig = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

const redis = hasRedisConfig
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
    : null;

const memoryFallback = new Map<string, MemoryEntry>();
let redisDisabledUntil = 0;
let redisDisableNoticeShown = false;

function isQuotaError(error: unknown) {
    return String((error as any)?.message || error).toLowerCase().includes('max requests limit exceeded');
}

function getRedisClient() {
    return Date.now() >= redisDisabledUntil ? redis : null;
}

function handleRedisError(operation: string, key: string, error: unknown) {
    if (isQuotaError(error)) {
        redisDisabledUntil = Date.now() + 60 * 60 * 1000;
        if (!redisDisableNoticeShown) {
            console.warn(`[redis-cache] Upstash request quota exhausted; using in-memory cache for the next hour.`);
            redisDisableNoticeShown = true;
        }
        return;
    }

    console.warn(`[${operation}] Redis failed for "${key}"`, error);
}

function cleanupMemoryFallback() {
    if (memoryFallback.size < 500) return;
    const now = Date.now();
    for (const [key, entry] of memoryFallback.entries()) {
        if (entry.expiresAt <= now) memoryFallback.delete(key);
    }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
    const client = getRedisClient();
    if (client) {
        try {
            const value = await client.get<T>(key);
            return value ?? null;
        } catch (error) {
            handleRedisError('cacheGet', key, error);
        }
    }

    const local = memoryFallback.get(key);
    if (!local) return null;
    if (local.expiresAt <= Date.now()) {
        memoryFallback.delete(key);
        return null;
    }
    return local.value as T;
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const client = getRedisClient();
    if (client) {
        try {
            await client.set(key, value, { ex: ttlSeconds });
            return;
        } catch (error) {
            handleRedisError('cacheSet', key, error);
        }
    }

    memoryFallback.set(key, {
        value,
        expiresAt: Date.now() + ttlSeconds * 1000,
    });
    cleanupMemoryFallback();
}

export async function acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    const client = getRedisClient();
    if (client) {
        try {
            const result = await client.set(key, Date.now().toString(), { nx: true, ex: ttlSeconds });
            return result === 'OK';
        } catch (error) {
            handleRedisError('acquireLock', key, error);
        }
    }

    const existing = memoryFallback.get(key);
    if (existing && existing.expiresAt > Date.now()) return false;
    memoryFallback.set(key, {
        value: '1',
        expiresAt: Date.now() + ttlSeconds * 1000,
    });
    return true;
}

export async function releaseLock(key: string): Promise<void> {
    const client = getRedisClient();
    if (client) {
        try {
            await client.del(key);
        } catch (error) {
            handleRedisError('releaseLock', key, error);
        }
    }
    memoryFallback.delete(key);
}

export async function cacheDel(key: string): Promise<void> {
    const client = getRedisClient();
    if (client) {
        try {
            await client.del(key);
        } catch (error) {
            handleRedisError('cacheDel', key, error);
        }
    }
    memoryFallback.delete(key);
}


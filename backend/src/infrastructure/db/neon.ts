import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import { logger } from '../../core/logger';

let cachedSql: NeonQueryFunction<false, false> | null = null;
let cachedUrl = '';
let schemaInitPromise: Promise<void> | null = null;

export function getNeonDatabaseUrl(): string {
    return String(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || '').trim();
}

export function getNeonDirectDatabaseUrl(): string {
    return String(process.env.DATABASE_URL_UNPOOLED || '').trim() || getNeonDatabaseUrl();
}

export function isNeonConfigured(): boolean {
    return Boolean(getNeonDatabaseUrl());
}

export function getNeonSql(): NeonQueryFunction<false, false> | null {
    const url = getNeonDatabaseUrl();
    if (!url) return null;
    if (!cachedSql || cachedUrl !== url) {
        cachedSql = neon(url);
        cachedUrl = url;
        schemaInitPromise = null;
    }
    return cachedSql;
}

export async function ensureNeonSchema(): Promise<void> {
    const directUrl = getNeonDirectDatabaseUrl();
    if (!directUrl) return;
    if (!schemaInitPromise) {
        const schemaSql = directUrl === getNeonDatabaseUrl() ? getNeonSql()! : neon(directUrl);
        schemaInitPromise = (async () => {
            await schemaSql`
                CREATE TABLE IF NOT EXISTS yorumi_users (
                    discord_id TEXT PRIMARY KEY,
                    username TEXT NOT NULL,
                    handle TEXT,
                    avatar_url TEXT,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            `;
            await schemaSql`
                CREATE TABLE IF NOT EXISTS yorumi_library_sync (
                    discord_id TEXT PRIMARY KEY REFERENCES yorumi_users(discord_id) ON DELETE CASCADE,
                    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            `;
            logger.info('[Neon] Database schema verified');
        })().catch((err) => {
            schemaInitPromise = null;
            throw err;
        });
    }
    await schemaInitPromise;
}

export async function checkNeonHealth(): Promise<{
    configured: boolean;
    connected: boolean;
    latencyMs?: number;
    error?: string;
}> {
    const sql = getNeonSql();
    if (!sql) {
        return { configured: false, connected: false, error: 'DATABASE_URL is not configured' };
    }
    const startedAt = Date.now();
    try {
        await ensureNeonSchema();
        await sql`SELECT 1 AS ok`;
        return {
            configured: true,
            connected: true,
            latencyMs: Date.now() - startedAt,
        };
    } catch (err) {
        return {
            configured: true,
            connected: false,
            latencyMs: Date.now() - startedAt,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}

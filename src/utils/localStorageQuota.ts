const VOLATILE_STORAGE_PREFIXES = [
    'yorumi_api_cache_',
    'yorumi_api_cache_v',
    'yorumi_home_cache_',
    'yorumi_logo_cache_',
    'yorumi_stream_cache_',
    'yorumi_anilist_season_chain_',
    'yorumi_ep_cache_',
    'yorumi_tmdb_cache_',
    'yorumi_manga_cache_',
    'yorumi_ln_cache_',
];

const isQuotaError = (error: unknown) => {
    if (!error || typeof error !== 'object') return false;
    const record = error as { name?: string; code?: number };
    return (
        record.name === 'QuotaExceededError' ||
        record.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        record.code === 22 ||
        record.code === 1014
    );
};

const estimateSize = (value: string | null) => (value ? value.length * 2 : 0);

const pruneVolatileLocalStorage = (protectedKey = '') => {
    if (typeof localStorage === 'undefined') return;

    const candidates: Array<{ key: string; size: number }> = [];
    for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key || key === protectedKey) continue;
        if (!VOLATILE_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))) continue;
        candidates.push({ key, size: estimateSize(localStorage.getItem(key)) });
    }

    candidates
        .sort((a, b) => b.size - a.size)
        .slice(0, Math.max(1, Math.ceil(candidates.length / 2)))
        .forEach(({ key }) => {
            try {
                localStorage.removeItem(key);
            } catch {
                // Ignore cleanup failures; the caller will still handle the original write.
            }
        });
};

export const setLocalStorageWithCleanup = (key: string, value: string) => {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (error) {
        if (!isQuotaError(error)) return false;
    }

    pruneVolatileLocalStorage(key);

    try {
        localStorage.setItem(key, value);
        return true;
    } catch {
        return false;
    }
};

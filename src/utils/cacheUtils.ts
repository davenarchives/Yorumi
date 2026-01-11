export const cacheUtils = {
    // Create cache refs
    createCacheRef: <K, V>() => new Map<K, V>(),

    // Generic cache operations
    get: <K, V>(cache: Map<K, V>, key: K): V | undefined => {
        return cache.get(key);
    },

    set: <K, V>(cache: Map<K, V>, key: K, value: V): void => {
        cache.set(key, value);
    },

    has: <K, V>(cache: Map<K, V>, key: K): boolean => {
        return cache.has(key);
    },

    delete: <K, V>(cache: Map<K, V>, key: K): void => {
        cache.delete(key);
    },

    clear: <K, V>(cache: Map<K, V>): void => {
        cache.clear();
    },
};

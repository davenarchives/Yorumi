import { useState, useEffect, useRef } from 'react';
import { API_BASE, USES_LOCAL_SOURCES } from '../../config/api';
import { setLocalStorageWithCleanup } from '../../utils/localStorageQuota';
import type { Anime } from '../../types/anime';
import { tmdbService } from '../../services/tmdbService';

interface AnimeLogoImageProps {
    tmdbId?: number | null;
    title: string;
    year?: number;
    episodes?: number | null;
    format?: string;
    className?: string;
    style?: React.CSSProperties;
    size?: 'small' | 'medium' | 'large'; // small: 80px, medium: 120px, large: 160px
    anime?: Anime;
    preferLogo?: boolean;
    hideFallbackText?: boolean;
}

// Namespace bump clears stale negative entries written while logo rendering was disabled.
const LOGO_CACHE_KEY = 'yorumi_logo_cache_v4';

// Hydrate logo cache from localStorage on module load
function loadCacheFromStorage(): Map<string, string | null> {
    try {
        const stored = localStorage.getItem(LOGO_CACHE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            const entries = Object.entries(parsed).map(([k, v]) => [
                k.includes(':') ? k : `id:${parseInt(k, 10)}`,
                typeof v === 'string' ? v : null
            ] as [string, string | null]);
            return new Map(entries);
        }
    } catch (e) {
        console.warn('[LogoCache] Failed to load from storage:', e);
    }
    return new Map();
}

// Shared logo cache - hydrated from localStorage
const logoCache = loadCacheFromStorage();
const pendingRequests = new Map<string, Promise<string | null>>();

const getPositiveId = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const getTitleCacheKey = (title: string) => {
    const normalized = title.replace(/\s+/g, ' ').trim().toLowerCase();
    return normalized ? `title:${normalized}` : null;
};

// Debounced save to localStorage
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
function persistCache() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        try {
            while (logoCache.size > 250) {
                const oldestKey = logoCache.keys().next().value;
                if (!oldestKey) break;
                logoCache.delete(oldestKey);
            }
            const obj: Record<string, string | null> = {};
            logoCache.forEach((v, k) => { obj[k] = v; });
            setLocalStorageWithCleanup(LOGO_CACHE_KEY, JSON.stringify(obj));
        } catch (e) {
            console.warn('[LogoCache] Failed to persist:', e);
        }
    }, 1000);
}

/**
 * Preload logos for multiple anime IDs in a single batch request
 * Call this when spotlight/trending anime data loads
 */
export async function preloadLogos(tmdbIds: number[]): Promise<void> {
    if (USES_LOCAL_SOURCES) return;
    const uncachedIds = tmdbIds
        .map(getPositiveId)
        .filter((id): id is number => Boolean(id))
        .filter(id => !logoCache.has(`tmdb:${id}`));

    if (uncachedIds.length === 0) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/logo/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tmdbIds: uncachedIds })
        });

        if (response.ok) {
            const data = await response.json();
            let newCount = 0;
            for (const [id, result] of Object.entries(data)) {
                const logoResult = result as { logo: string | null; source: 'fanart' | 'fallback' };
                if (logoResult.source === 'fanart' && logoResult.logo) {
                    logoCache.set(`tmdb:${parseInt(id, 10)}`, logoResult.logo);
                    newCount++;
                }
            }
            if (newCount > 0) {
                persistCache();
            }
        }
    } catch (error) {
        console.warn('[LogoPreload] Failed:', error);
    }
}

export async function preloadSpotlightLogos(animes: Anime[]): Promise<void> {
    const spotlightAnime = animes.slice(0, 8);
    await preloadLogos(spotlightAnime.map((anime) => anime.tmdbId || 0).filter(Boolean));

    let cursor = 0;
    const workers = Array.from({ length: Math.min(2, spotlightAnime.length) }, async () => {
        while (cursor < spotlightAnime.length) {
            const anime = spotlightAnime[cursor++];
            const id = getPositiveId(anime.id || anime.mal_id);
            const title = anime.title_english || anime.title_romaji || anime.title;
            const cacheKey = USES_LOCAL_SOURCES
                ? getTitleCacheKey(`${title}:${anime.year || ''}`)
                : id ? `anime:${id}` : getTitleCacheKey(title);
            if (!cacheKey || logoCache.has(cacheKey)) continue;

            const logo = await tmdbService.getLogoForAnime(anime).catch(() => null);
            if (logo) logoCache.set(cacheKey, logo);
        }
    });

    await Promise.all(workers);
    persistCache();
}

export default function AnimeLogoImage({
    tmdbId,
    title,
    year,
    episodes,
    format,
    className = '',
    size = 'medium',
    style,
    anime,
    preferLogo = false,
    hideFallbackText = false,
}: AnimeLogoImageProps) {
    const resolvedId = getPositiveId(tmdbId ?? anime?.id ?? anime?.mal_id);
    const cacheKey = USES_LOCAL_SOURCES
        ? getTitleCacheKey(`${title}:${year ?? anime?.year ?? ''}`)
        : resolvedId ? `anime:${resolvedId}` : getTitleCacheKey(title);
    const initialCachedLogo = (preferLogo && cacheKey && logoCache.has(cacheKey))
        ? (logoCache.get(cacheKey) ?? null)
        : null;

    const [logoUrl, setLogoUrl] = useState<string | null>(initialCachedLogo);
    const [hasError, setHasError] = useState(false);
    const animeRef = useRef(anime);
    animeRef.current = anime;

    const getMaxHeight = () => {
        switch (size) {
            case 'small': return '80px';
            case 'medium': return '120px';
            case 'large': return '160px';
            default: return '120px';
        }
    };

    useEffect(() => {
        if (!preferLogo) {
            setLogoUrl(null);
            setHasError(true);
            return;
        }
        let isMounted = true;
        if (cacheKey && logoCache.has(cacheKey)) {
            const cached = logoCache.get(cacheKey) ?? null;
            setLogoUrl(cached);
            setHasError(!cached);
            return;
        }
        setLogoUrl(null);
        setHasError(false);

        if (!cacheKey) {
            setHasError(true);
            return () => {
                isMounted = false;
            };
        }

        const fetchLogo = async () => {
            const key = cacheKey as string;
            if (logoCache.has(key)) {
                const cached = logoCache.get(key);
                if (isMounted) {
                    if (cached) {
                        setLogoUrl(cached);
                        setHasError(false);
                    } else {
                        setHasError(true);
                    }
                }
                return;
            }

            if (pendingRequests.has(key)) {
                const result = await pendingRequests.get(key);
                if (isMounted) {
                    if (result) {
                        setLogoUrl(result);
                        setHasError(false);
                    } else {
                        setHasError(true);
                    }
                }
                return;
            }

            const fetchPromise = (async () => {
                try {
                    const params = new URLSearchParams();
                    params.set('title', title);
                    if (year) params.set('year', String(year));
                    if (episodes) params.set('episodes', String(episodes));
                    if (format) params.set('format', format);
                    let resolvedLogo: string | null = null;
                    const actualTmdbId = getPositiveId(animeRef.current?.tmdbId);
                    if (!USES_LOCAL_SOURCES && actualTmdbId) {
                        const response = await fetch(`${API_BASE}/logo/${actualTmdbId}`).catch(() => null);
                        if (response?.ok) {
                            const data = await response.json();
                            if (data.logo && data.source === 'fanart') {
                                resolvedLogo = data.logo;
                                if (data.tmdbId) logoCache.set(`tmdb:${data.tmdbId}`, data.logo);
                            }
                        }
                    }

                    if (!resolvedLogo && animeRef.current) {
                        resolvedLogo = await tmdbService.getLogoForAnime(animeRef.current);
                    }

                    if (resolvedLogo) {
                        logoCache.set(key, resolvedLogo);
                        persistCache();
                    }
                    return resolvedLogo || null;
                } catch {
                    return null;
                } finally {
                    pendingRequests.delete(key);
                }
            })();

            pendingRequests.set(key, fetchPromise);
            const result = await fetchPromise;

            if (isMounted) {
                if (result) {
                    setLogoUrl(result);
                    setHasError(false);
                } else {
                    setHasError(true);
                }
            }
        };

        void fetchLogo();

        return () => {
            isMounted = false;
        };
    }, [tmdbId, title, year, episodes, format, preferLogo, cacheKey, resolvedId]);

    if (logoUrl && !hasError) {
        return (
            <img
                src={logoUrl || undefined}
                alt={title}
                className={`max-w-full h-auto object-contain ${className}`}
                style={{
                    maxHeight: getMaxHeight(),
                    ...style
                }}
                onError={() => {
                    setHasError(true);
                }}
                loading={size === 'large' ? 'eager' : 'lazy'}
                decoding="async"
            />
        );
    }

    if (hideFallbackText) {
        return null;
    }

    return (
        <h1 className={`text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-white leading-tight line-clamp-3 ${className}`}>
            {title}
        </h1>
    );
}

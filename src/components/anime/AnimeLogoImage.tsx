import { useState, useEffect, useRef } from 'react';
import { API_BASE } from '../../config/api';
import { setLocalStorageWithCleanup } from '../../utils/localStorageQuota';
import type { Anime } from '../../types/anime';
import { tmdbService } from '../../services/tmdbService';
import { isNativeMobile } from '../../platform/runtime';

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
}

// Namespace bump clears stale negative entries written while logo rendering was disabled.
const LOGO_CACHE_KEY = 'yorumi_logo_cache_v3';

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
            console.log(`[LogoCache] Hydrated ${entries.length} logos from storage`);
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
            console.log('[LogoCache] Persisted to storage');
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
    if (isNativeMobile()) return;
    // Filter out already cached IDs
    const uncachedIds = tmdbIds
        .map(getPositiveId)
        .filter((id): id is number => Boolean(id))
        .filter(id => !logoCache.has(`id:${id}`));

    if (uncachedIds.length === 0) {
        return; // All cached, no logging needed
    }

    console.log('[LogoPreload] Fetching', uncachedIds.length, 'logos...');

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
                    logoCache.set(`id:${parseInt(id, 10)}`, logoResult.logo);
                    newCount++;
                } else {
                    logoCache.set(`id:${parseInt(id, 10)}`, null);
                }
            }
            if (newCount > 0) {
                persistCache();
                console.log('[LogoPreload] ✓', newCount, 'logos cached');
            }
        }
    } catch (error) {
        console.warn('[LogoPreload] Failed:', error);
    }
}

export async function preloadSpotlightLogos(animes: Anime[]): Promise<void> {
    const spotlightAnime = animes.slice(0, 8);
    await preloadLogos(spotlightAnime.map((anime) => anime.id || anime.mal_id).filter(Boolean));

    let cursor = 0;
    const workers = Array.from({ length: Math.min(2, spotlightAnime.length) }, async () => {
        while (cursor < spotlightAnime.length) {
            const anime = spotlightAnime[cursor++];
            const id = getPositiveId(anime.id || anime.mal_id);
            const title = anime.title_english || anime.title_romaji || anime.title;
            const cacheKey = isNativeMobile()
                ? getTitleCacheKey(`${title}:${anime.year || ''}`)
                : id ? `id:${id}` : getTitleCacheKey(title);
            if (!cacheKey || logoCache.get(cacheKey)) continue;

            const logo = await tmdbService.getLogoForAnime(anime).catch(() => null);
            if (logo) logoCache.set(cacheKey, logo);
        }
    });

    await Promise.all(workers);
    persistCache();
}

export default function AnimeLogoImage({ tmdbId, title, year, episodes, format, className = '', size = 'medium', style, anime, preferLogo = false }: AnimeLogoImageProps) {
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [hasError, setHasError] = useState(false);
    const animeRef = useRef(anime);
    animeRef.current = anime;

    // Determine max height based on size prop
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
        setLogoUrl(null);
        setHasError(false);
        const resolvedId = getPositiveId(tmdbId);
        const cacheKey = isNativeMobile()
            ? getTitleCacheKey(`${title}:${year || ''}`)
            : resolvedId ? `id:${resolvedId}` : getTitleCacheKey(title);

        if (!cacheKey) {
            setHasError(true);
            return () => {
                isMounted = false;
            };
        }

        const fetchLogo = async () => {
            const key = cacheKey as string;
            // Check cache first
            if (logoCache.has(key)) {
                const cached = logoCache.get(key);
                if (cached && isMounted) {
                    setLogoUrl(cached);
                    setHasError(false);
                    return;
                }
                // A Fanart miss must not prevent the per-title TMDB artwork
                // fallback used by standalone Android and unconfigured hosts.
                if (!animeRef.current) {
                    if (isMounted) setHasError(true);
                    return;
                }
                logoCache.delete(key);
            }

            // Check if there's already a pending request for this ID
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

            // Make new request
            const fetchPromise = (async () => {
                try {
                    const params = new URLSearchParams();
                    params.set('title', title);
                    if (year) params.set('year', String(year));
                    if (episodes) params.set('episodes', String(episodes));
                    if (format) params.set('format', format);
                    let resolvedLogo: string | null = null;
                    if (!isNativeMobile() && resolvedId) {
                        const response = await fetch(`${API_BASE}/logo/${resolvedId}`);
                        if (response.ok) {
                            const data = await response.json();
                            if (data.logo && data.source === 'fanart') {
                                resolvedLogo = data.logo;
                                if (data.tmdbId) logoCache.set(`id:${data.tmdbId}`, data.logo);
                            }
                        }
                    }

                    if (!resolvedLogo && animeRef.current) {
                        resolvedLogo = await tmdbService.getLogoForAnime(animeRef.current);
                    }

                    if (resolvedLogo) {
                        logoCache.set(key, resolvedLogo);
                        persistCache();
                        return resolvedLogo;
                    } else {
                        logoCache.set(key, null);
                        persistCache();
                        return null;
                    }
                } catch (error) {
                    console.warn('[AnimeLogoImage] Failed to fetch logo:', error);
                    logoCache.set(key, null);
                    persistCache();
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

        fetchLogo();

        return () => {
            isMounted = false;
        };
    }, [tmdbId, title, year, episodes, format, preferLogo]);

    // If logo is available and no error, show the logo
    if (logoUrl && !hasError) {
        return (
            <img
                src={logoUrl || undefined}
                alt={title}
                className={`max-w-full h-auto object-contain fade-in ${className}`}
                style={{
                    maxHeight: getMaxHeight(),
                    filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.8))',
                    ...style
                }}
                onError={() => {
                    console.warn('[AnimeLogoImage] Image load error, falling back to text');
                    setHasError(true);
                }}
                loading="eager"
            />
        );
    }

    // Default: Show text title immediately while logo is resolving.
    // This provides instant content - user sees title immediately
    return (
        <h1 className={`text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-white leading-tight line-clamp-3 ${className}`}>
            {title}
        </h1>
    );
}

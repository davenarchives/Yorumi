import { useState, useEffect } from 'react';

interface AnimeLogoImageProps {
    anilistId: number;
    title: string;
    className?: string;
    size?: 'small' | 'medium' | 'large'; // small: 80px, medium: 120px, large: 160px
}

// Shared logo cache - persists across component instances
const logoCache = new Map<number, string | null>();
const pendingRequests = new Map<number, Promise<string | null>>();

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * Preload logos for multiple anime IDs in a single batch request
 * Call this when spotlight/trending anime data loads
 */
export async function preloadLogos(anilistIds: number[]): Promise<void> {
    // Filter out already cached IDs
    const uncachedIds = anilistIds.filter(id => !logoCache.has(id));

    if (uncachedIds.length === 0) {
        console.log('[LogoPreload] All logos already cached');
        return;
    }

    console.log('[LogoPreload] Preloading logos for', uncachedIds.length, 'anime');

    try {
        const response = await fetch(`${API_BASE}/logo/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ anilistIds: uncachedIds })
        });

        if (response.ok) {
            const data = await response.json();
            // Store in cache
            for (const [id, result] of Object.entries(data)) {
                const logoResult = result as { logo: string | null; source: 'fanart' | 'fallback' };
                if (logoResult.source === 'fanart' && logoResult.logo) {
                    logoCache.set(parseInt(id), logoResult.logo);
                } else {
                    logoCache.set(parseInt(id), null);
                }
            }
            console.log('[LogoPreload] ✓ Preloaded', Object.keys(data).length, 'logos');
        }
    } catch (error) {
        console.warn('[LogoPreload] Failed to preload logos:', error);
    }
}

export default function AnimeLogoImage({ anilistId, title, className = '', size = 'medium' }: AnimeLogoImageProps) {
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

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
        let isMounted = true;

        const fetchLogo = async () => {
            // Check cache first
            if (logoCache.has(anilistId)) {
                const cached = logoCache.get(anilistId);
                if (isMounted) {
                    if (cached) {
                        setLogoUrl(cached);
                        setHasError(false);
                    } else {
                        setHasError(true);
                    }
                    setIsLoading(false);
                }
                return;
            }

            // Check if there's already a pending request for this ID
            if (pendingRequests.has(anilistId)) {
                const result = await pendingRequests.get(anilistId);
                if (isMounted) {
                    if (result) {
                        setLogoUrl(result);
                        setHasError(false);
                    } else {
                        setHasError(true);
                    }
                    setIsLoading(false);
                }
                return;
            }

            // Make new request
            const fetchPromise = (async () => {
                try {
                    const logoEndpoint = `${API_BASE}/logo/${anilistId}`;
                    const response = await fetch(logoEndpoint);

                    if (!response.ok) {
                        throw new Error('Failed to fetch logo');
                    }

                    const data = await response.json();

                    if (data.logo && data.source === 'fanart') {
                        logoCache.set(anilistId, data.logo);
                        return data.logo;
                    } else {
                        logoCache.set(anilistId, null);
                        return null;
                    }
                } catch (error) {
                    console.warn('[AnimeLogoImage] Failed to fetch logo:', error);
                    logoCache.set(anilistId, null);
                    return null;
                } finally {
                    pendingRequests.delete(anilistId);
                }
            })();

            pendingRequests.set(anilistId, fetchPromise);
            const result = await fetchPromise;

            if (isMounted) {
                if (result) {
                    setLogoUrl(result);
                    setHasError(false);
                } else {
                    setHasError(true);
                }
                setIsLoading(false);
            }
        };

        fetchLogo();

        return () => {
            isMounted = false;
        };
    }, [anilistId]);

    // Show loading shimmer
    if (isLoading) {
        return (
            <div className={`animate-pulse bg-white/5 rounded-lg ${className}`} style={{ height: '3rem' }}>
                <div className="w-full h-full bg-gradient-to-r from-white/0 via-white/10 to-white/0" />
            </div>
        );
    }

    // Fallback to text title if no logo or error
    if (hasError || !logoUrl) {
        return (
            <h1 className={`text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-white leading-tight ${className}`}>
                {title}
            </h1>
        );
    }

    // Display logo image
    return (
        <img
            src={logoUrl}
            alt={title}
            className={`max-w-full h-auto object-contain fade-in ${className}`}
            style={{
                maxHeight: getMaxHeight(),
                filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.8))'
            }}
            onError={() => {
                console.warn('[AnimeLogoImage] Image load error, falling back to text');
                setHasError(true);
            }}
            loading="eager"
        />
    );
}


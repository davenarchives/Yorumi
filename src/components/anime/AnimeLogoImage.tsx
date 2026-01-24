import { useState, useEffect } from 'react';

interface AnimeLogoImageProps {
    anilistId: number;
    title: string;
    className?: string;
    size?: 'small' | 'medium' | 'large'; // small: 80px, medium: 120px, large: 160px
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
            try {
                const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
                const logoEndpoint = `${API_BASE}/logo/${anilistId}`;
                console.log('[AnimeLogoImage] Fetching logo from:', logoEndpoint);

                const response = await fetch(logoEndpoint);

                if (!response.ok) {
                    throw new Error('Failed to fetch logo');
                }

                const data = await response.json();
                console.log('[AnimeLogoImage] API Response:', data);

                if (isMounted) {
                    if (data.logo && data.source === 'fanart') {
                        console.log('[AnimeLogoImage] ✓ Logo found:', data.logo);
                        setLogoUrl(data.logo);
                        setHasError(false);
                    } else {
                        console.log('[AnimeLogoImage] ✗ No logo available, using text fallback');
                        // No logo available, use text fallback
                        setHasError(true);
                    }
                    setIsLoading(false);
                }
            } catch (error) {
                console.warn('[AnimeLogoImage] Failed to fetch logo:', error);
                if (isMounted) {
                    setHasError(true);
                    setIsLoading(false);
                }
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

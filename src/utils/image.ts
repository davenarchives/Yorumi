import { API_BASE, USES_LOCAL_SOURCES } from '../config/api';

const IMAGE_PROXY_BASE = `${API_BASE}/image/proxy?url=`;
const PROXY_HOST_PATTERNS = [
    /(^|\.)animepahe\./i,
    /(^|\.)pahe\./i,
    /(^|\.)animekai\./i,
    /(^|\.)anikai\./i,
    /(^|\.)allanime\./i,
    /(^|\.)allmanga\./i,
    /(^|\.)mangakatana\./i,
    /(^|\.)gojo\./i,
    /(^|\.)akamaized\.net$/i,
    /(^|\.)hanime-cdn\./i,
];

export const getDisplayImageUrl = (url?: string | null): string => {
    const value = String(url || '').trim();
    if (!value) return '';
    if (value.startsWith('data:') || value.startsWith('blob:')) return value;
    if (value.startsWith('/api/')) return value;

    try {
        const parsed = new URL(value);
        const shouldProxy = PROXY_HOST_PATTERNS.some((pattern) => pattern.test(parsed.hostname));
        return shouldProxy && !USES_LOCAL_SOURCES ? `${IMAGE_PROXY_BASE}${encodeURIComponent(value)}` : value;
    } catch {
        return value;
    }
};

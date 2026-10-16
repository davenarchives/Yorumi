export type ContentType = 'anime' | 'manga' | 'lightNovel';
export type MappingStatus = 'verified' | 'unverified' | 'conflicting' | 'unresolved';
export type ContentAvailability = 'cataloged' | 'available' | 'readable' | 'unavailable';

export type ExternalIds = Record<string, string | number | undefined>;

export interface CanonicalContentIdentity {
    yorumiId: string;
    type: ContentType;
    canonicalTitle: string;
    externalIds: ExternalIds;
    mappingStatus: MappingStatus;
    mappingSource?: string;
}

const normalizeId = (value: unknown) => String(value ?? '').trim();

export const buildYorumiId = (
    type: ContentType,
    provider: string,
    id: string | number,
    scope?: string
) => [type, provider.trim().toLowerCase(), normalizeId(id), normalizeId(scope)]
    .filter(Boolean)
    .join(':');

export const buildProviderKey = (provider: string, id: unknown) => {
    const normalizedProvider = provider.trim().toLowerCase();
    const normalizedId = normalizeId(id);
    return normalizedProvider && normalizedId ? `${normalizedProvider}:${normalizedId}` : '';
};

export const getCanonicalIdentityKey = (
    type: ContentType,
    externalIds: ExternalIds,
    precedence: string[]
) => {
    for (const provider of precedence) {
        const value = externalIds[provider];
        if (value !== undefined && normalizeId(value)) {
            return buildYorumiId(type, provider, value);
        }
    }
    return '';
};

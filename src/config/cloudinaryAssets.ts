const CLOUDINARY_CLOUD_NAME =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLOUDINARY_CLOUD_NAME?.trim()) ||
    'div8klfkc';

const buildCloudinaryUrl = (publicIdWithExtension: string) =>
    `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/${publicIdWithExtension}`;

const SHARED_PUBLIC_IDS = {
    animeBg: 'yorumi/shared/anime-bg.png',
    monsterSlash: 'yorumi/shared/monsterslash.png',
    yorumiIcon: 'yorumi/shared/yorumi-icon.svg',
    yorumiPng: 'yorumi/shared/yorumi.png',
    yorumiSvg: 'yorumi/shared/yorumi-svg.svg',
    gcashLogo: 'yorumi/shared/gcash-logo.svg',
    gcashQr: 'yorumi/shared/donation.png',
    luffyGif: 'yorumi/shared/luffy-loading.gif',
    reactSvg: 'yorumi/shared/react.svg'
} as const;

export const CLOUDINARY_SHARED_ASSETS = {
    animeBg: buildCloudinaryUrl(SHARED_PUBLIC_IDS.animeBg),
    monsterSlash: buildCloudinaryUrl(SHARED_PUBLIC_IDS.monsterSlash),
    yorumiIcon: buildCloudinaryUrl(SHARED_PUBLIC_IDS.yorumiIcon),
    yorumiPng: buildCloudinaryUrl(SHARED_PUBLIC_IDS.yorumiPng),
    yorumiSvg: buildCloudinaryUrl(SHARED_PUBLIC_IDS.yorumiSvg),
    gcashLogo: buildCloudinaryUrl(SHARED_PUBLIC_IDS.gcashLogo),
    gcashQr: buildCloudinaryUrl(SHARED_PUBLIC_IDS.gcashQr),
    luffyGif: buildCloudinaryUrl(SHARED_PUBLIC_IDS.luffyGif),
    reactSvg: buildCloudinaryUrl(SHARED_PUBLIC_IDS.reactSvg)
} as const;

export const DEFAULT_BANNER_URL = CLOUDINARY_SHARED_ASSETS.animeBg;

export const getCloudinaryAvatarUrl = (avatarPath: string) => {
    const normalized = avatarPath.replace(/^\/?avatars\//, '').trim();
    if (!normalized) return null;
    return buildCloudinaryUrl(`yorumi/avatars/${normalized}`);
};

export const resolveStaticAssetUrl = (value?: string | null) => {
    if (!value) return value || null;

    if (value === '/anime-bg.png') return CLOUDINARY_SHARED_ASSETS.animeBg;
    if (value === '/monsterslash.png') return CLOUDINARY_SHARED_ASSETS.monsterSlash;
    if (value === '/yorumi-icon.svg' || value === '/yorumi-icon.png') return CLOUDINARY_SHARED_ASSETS.yorumiIcon;
    if (value === '/Yorumi.png') return CLOUDINARY_SHARED_ASSETS.yorumiPng;
    if (value === '/Yorumi.svg') return CLOUDINARY_SHARED_ASSETS.yorumiSvg;
    if (value === '/gcash-logo.svg') return CLOUDINARY_SHARED_ASSETS.gcashLogo;
    if (value === '/donation.png') return CLOUDINARY_SHARED_ASSETS.gcashQr;
    if (value === '/luffy.gif') return CLOUDINARY_SHARED_ASSETS.luffyGif;

    if (value.startsWith('/avatars/')) {
        return getCloudinaryAvatarUrl(value) || value;
    }

    return value;
};

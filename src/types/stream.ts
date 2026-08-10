export interface SubtitleTrack {
    url: string;
    lang: string;
    default?: boolean;
}

export interface StreamLink {
    quality: string;
    audio: string;
    provider?: string;
    server?: string;
    url: string;
    directUrl?: string;
    referer?: string;
    duration?: number;
    isHls: boolean;
    isEmbed?: boolean;
    subtitles?: SubtitleTrack[];
    thumbnails?: ThumbnailInfo;
}

interface ThumbnailInfo {
    spriteUrl?: string;
    spriteGrid?: { columns: number; rows: number };
    thumbnailUrl?: string;
    interval?: number;
    vttUrl?: string;
}

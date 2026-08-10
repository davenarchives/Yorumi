import type { ActiveDownloadProgress, DownloadedEpisode } from '../services/downloadService';
import type { SubtitleTrack } from './stream';

export interface ElectronAPI {
    getEnv: () => Promise<string>;
    saveEnv: (content: string) => Promise<boolean>;
    onM3u8Found: (cb: (url: string) => void) => (event: unknown, url: string) => void;
    offM3u8Found: (handler: unknown) => void;
    onSubtitleFound: (cb: (data: unknown) => void) => (event: unknown, data: unknown) => void;
    offSubtitleFound: (handler: unknown) => void;
    resolveAllManga: (args: unknown) => Promise<unknown>;
    setPlayerVideo: (args: unknown) => Promise<unknown>;
    onWebviewEnterFullscreen: (cb: () => void) => () => void;
    offWebviewEnterFullscreen: (handler: unknown) => void;
    onWebviewLeaveFullscreen: (cb: () => void) => () => void;
    offWebviewLeaveFullscreen: (handler: unknown) => void;
    playerStopped: () => void;
    queryVideoProgress: (webContentsId: number) => Promise<unknown>;
    downloadEpisodeChunked: (params: {
        animeId: string;
        animeTitle: string;
        animeImage: string;
        episodeNumber: number;
        episodeTitle?: string;
        streamUrl: string;
        quality?: string;
        audio?: 'sub' | 'dub';
        subtitles?: SubtitleTrack[];
    }) => Promise<DownloadedEpisode>;
    getLocalDownloads: () => Promise<DownloadedEpisode[]>;
    getLocalDownload: (args: { animeId: string; episodeNumber: number; title?: string; anilistId?: number | string; alternateEpNumbers?: (number | string | undefined)[] }) => Promise<DownloadedEpisode | null>;
    deleteLocalDownload: (args: { animeId: string; episodeNumber: number }) => Promise<boolean>;
    openDownloadsFolder: () => Promise<boolean>;
    onDownloadProgress: (cb: (progress: ActiveDownloadProgress) => void) => (event: unknown, progress: ActiveDownloadProgress) => void;
    offDownloadProgress: (handler: unknown) => void;
}

declare global {
    interface Window {
        electronAPI?: ElectronAPI;
    }
}

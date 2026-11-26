import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { getRuntimePlatform } from './runtime';

export type DownloadMediaType = 'anime' | 'manga' | 'ln';

type DownloadNotificationOptions = {
    mediaType?: DownloadMediaType;
    animeId: string;
    episodeNumber: number;
    animeTitle: string;
    episodeTitle: string;
    progress: number;
    keepProgress?: boolean;
};

type EpisodeUpdateNotificationOptions = {
    entryId: string;
    title: string;
    episodeNumber: number;
    watchedEpisode?: number;
    unreadCount?: number;
    summaryText?: string;
};

type DownloadNotificationPlugin = {
    show(options: DownloadNotificationOptions): Promise<void>;
    update(options: DownloadNotificationOptions): Promise<void>;
    complete(options: DownloadNotificationOptions): Promise<void>;
    fail(options: DownloadNotificationOptions & { message: string }): Promise<void>;
    notifyUpdate(options: EpisodeUpdateNotificationOptions): Promise<void>;
    addListener(
        eventName: 'downloadControl',
        listener: (event: { animeId: string; episodeNumber: number; paused: boolean }) => void
    ): Promise<PluginListenerHandle>;
};

const NativeDownloadNotification = registerPlugin<DownloadNotificationPlugin>('DownloadNotification');

const isAndroid = () => getRuntimePlatform() === 'android';

let lastUpdateSentAt = 0;
let lastUpdateProgress = -1;
let lastUpdateKey = '';

export const showDownloadNotification = async (options: DownloadNotificationOptions) => {
    if (!isAndroid()) return;
    lastUpdateSentAt = Date.now();
    lastUpdateProgress = options.progress;
    lastUpdateKey = `${options.mediaType || 'anime'}:${options.animeId}:${options.episodeTitle}`;
    await NativeDownloadNotification.show({ mediaType: 'anime', ...options });
};

export const updateDownloadNotification = async (options: DownloadNotificationOptions) => {
    if (!isAndroid()) return;
    const now = Date.now();
    const key = `${options.mediaType || 'anime'}:${options.animeId}:${options.episodeTitle}`;
    const progressDelta = Math.abs(options.progress - lastUpdateProgress);
    if (key === lastUpdateKey && now - lastUpdateSentAt < 400 && progressDelta < 3 && options.progress < 99) {
        return;
    }
    lastUpdateSentAt = now;
    lastUpdateProgress = options.progress;
    lastUpdateKey = key;
    await NativeDownloadNotification.update({ mediaType: 'anime', ...options });
};

export const completeDownloadNotification = async (options: DownloadNotificationOptions) => {
    if (!isAndroid()) return;
    lastUpdateProgress = -1;
    lastUpdateKey = '';
    await NativeDownloadNotification.complete({ mediaType: 'anime', ...options });
};

export const failDownloadNotification = async (options: DownloadNotificationOptions & { message: string }) => {
    if (!isAndroid()) return;
    lastUpdateProgress = -1;
    lastUpdateKey = '';
    await NativeDownloadNotification.fail({ mediaType: 'anime', ...options });
};

export const notifyEpisodeUpdate = async (options: EpisodeUpdateNotificationOptions) => {
    if (!isAndroid()) return;
    await NativeDownloadNotification.notifyUpdate(options);
};

export const onNativeDownloadControl = async (
    listener: (event: { animeId: string; episodeNumber: number; paused: boolean }) => void
) => {
    if (!isAndroid()) return null;
    return NativeDownloadNotification.addListener('downloadControl', listener);
};

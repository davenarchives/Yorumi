import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { getRuntimePlatform } from './runtime';

type DownloadNotificationOptions = {
    animeId: string;
    episodeNumber: number;
    animeTitle: string;
    episodeTitle: string;
    progress: number;
};

type DownloadNotificationPlugin = {
    show(options: DownloadNotificationOptions): Promise<void>;
    update(options: DownloadNotificationOptions): Promise<void>;
    complete(options: DownloadNotificationOptions): Promise<void>;
    fail(options: DownloadNotificationOptions & { message: string }): Promise<void>;
    addListener(
        eventName: 'downloadControl',
        listener: (event: { animeId: string; episodeNumber: number; paused: boolean }) => void
    ): Promise<PluginListenerHandle>;
};

const NativeDownloadNotification = registerPlugin<DownloadNotificationPlugin>('DownloadNotification');

const isAndroid = () => getRuntimePlatform() === 'android';

export const showDownloadNotification = async (options: DownloadNotificationOptions) => {
    if (isAndroid()) await NativeDownloadNotification.show(options);
};

export const updateDownloadNotification = async (options: DownloadNotificationOptions) => {
    if (isAndroid()) await NativeDownloadNotification.update(options);
};

export const completeDownloadNotification = async (options: DownloadNotificationOptions) => {
    if (isAndroid()) await NativeDownloadNotification.complete(options);
};

export const failDownloadNotification = async (options: DownloadNotificationOptions & { message: string }) => {
    if (isAndroid()) await NativeDownloadNotification.fail(options);
};

export const onNativeDownloadControl = async (
    listener: (event: { animeId: string; episodeNumber: number; paused: boolean }) => void
) => {
    if (!isAndroid()) return null;
    return NativeDownloadNotification.addListener('downloadControl', listener);
};

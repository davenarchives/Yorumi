import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { getRuntimePlatform } from './runtime';

type NativeProgress = {
    operationId: string;
    progress: number;
    receivedBytes: number;
    totalBytes: number;
};

type NativeDownloadResult = {
    filePath: string;
    fileUrl: string;
    fileSize: number;
    duration?: number;
    isHls?: boolean;
    hlsSegments?: Array<{
        offset: number;
        size: number;
        duration: number;
    }>;
};

type NativeDownloadStoragePlugin = {
    download(options: {
        operationId: string;
        url: string;
        relativePath: string;
        referer?: string;
        hls?: boolean;
        maxHeight?: number;
    }): Promise<NativeDownloadResult>;
    writeText(options: { relativePath: string; content: string }): Promise<NativeDownloadResult>;
    delete(options: { filePath: string }): Promise<void>;
    setPaused(options: { operationId: string; paused: boolean }): Promise<void>;
    cancel(options: { operationId: string }): Promise<void>;
    downloadAndInstallApk(options: { url: string }): Promise<{ installed: boolean }>;
    addListener(eventName: 'progress', listener: (event: NativeProgress) => void): Promise<PluginListenerHandle>;
    addListener(
        eventName: 'updateDownloadProgress',
        listener: (event: { percent?: number; downloaded?: number; total?: number }) => void
    ): Promise<PluginListenerHandle>;
};

const NativeDownloadStorage = registerPlugin<NativeDownloadStoragePlugin>('NativeDownloadStorage');

export const isAndroidDownloadStorageAvailable = () => getRuntimePlatform() === 'android';

export const downloadToNativeStorage = async (
    options: Parameters<NativeDownloadStoragePlugin['download']>[0],
    onProgress?: (progress: NativeProgress) => void
) => {
    let listener: PluginListenerHandle | null = null;
    if (onProgress) {
        listener = await NativeDownloadStorage.addListener('progress', (event) => {
            if (event.operationId === options.operationId) onProgress(event);
        });
    }
    try {
        return await NativeDownloadStorage.download(options);
    } finally {
        await listener?.remove();
    }
};

export const writeTextToNativeStorage = (relativePath: string, content: string) =>
    NativeDownloadStorage.writeText({ relativePath, content });

export const deleteNativeDownload = async (filePath?: string) => {
    if (filePath && isAndroidDownloadStorageAvailable()) {
        await NativeDownloadStorage.delete({ filePath });
    }
};

export const setNativeDownloadPaused = async (operationId: string, paused: boolean) => {
    if (isAndroidDownloadStorageAvailable()) {
        await NativeDownloadStorage.setPaused({ operationId, paused });
    }
};

export const cancelNativeDownload = async (operationId: string) => {
    if (isAndroidDownloadStorageAvailable()) {
        await NativeDownloadStorage.cancel({ operationId });
    }
};

export const downloadAndInstallAndroidApk = async (
    url: string,
    onProgress?: (percent: number) => void
) => {
    if (!isAndroidDownloadStorageAvailable()) {
        throw new Error('Android native installer unavailable');
    }
    let listener: PluginListenerHandle | null = null;
    if (onProgress) {
        listener = await NativeDownloadStorage.addListener('updateDownloadProgress', (event) => {
            const pct = Number(event?.percent ?? 0);
            onProgress(Math.max(0, Math.min(100, pct)));
        });
    }
    try {
        return await NativeDownloadStorage.downloadAndInstallApk({ url });
    } finally {
        await listener?.remove();
    }
};

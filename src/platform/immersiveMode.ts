import { registerPlugin } from '@capacitor/core';
import { isNativeMobile } from './runtime';

interface ImmersiveModePlugin {
    enter(): Promise<void>;
    exit(): Promise<void>;
    enterLandscape(): Promise<void>;
    exitLandscape(): Promise<void>;
    setPictureInPictureEnabled(options: { enabled: boolean }): Promise<void>;
}

// Injected by the Tauri Android MainActivity (real OS-level orientation control).
interface YorumiNativeBridge {
    enterLandscape(): void;
    exitLandscape(): void;
    enterImmersive(): void;
    exitImmersive(): void;
}

const getTauriBridge = (): YorumiNativeBridge | null =>
    (window as unknown as { YorumiNative?: YorumiNativeBridge }).YorumiNative ?? null;

const ImmersiveMode = registerPlugin<ImmersiveModePlugin>('ImmersiveMode');

export const enterImmersiveMode = async () => {
    if (!isNativeMobile()) return;
    const bridge = getTauriBridge();
    if (bridge) return bridge.enterImmersive();
    await ImmersiveMode.enter();
};

export const exitImmersiveMode = async () => {
    if (!isNativeMobile()) return;
    const bridge = getTauriBridge();
    if (bridge) return bridge.exitImmersive();
    await ImmersiveMode.exit();
};

export const enterLandscapePlayerMode = async () => {
    if (!isNativeMobile()) return;
    const bridge = getTauriBridge();
    if (bridge) return bridge.enterLandscape();
    await ImmersiveMode.enterLandscape();
};

export const exitLandscapePlayerMode = async () => {
    if (!isNativeMobile()) return;
    const bridge = getTauriBridge();
    if (bridge) return bridge.exitLandscape();
    await ImmersiveMode.exitLandscape();
};

export const setSystemPictureInPictureEnabled = async (enabled: boolean) => {
    if (!isNativeMobile()) return;
    const bridge = getTauriBridge();
    if (bridge) return;
    await ImmersiveMode.setPictureInPictureEnabled({ enabled });
};

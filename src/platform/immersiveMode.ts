import { registerPlugin } from '@capacitor/core';
import { isNativeMobile } from './runtime';

interface ImmersiveModePlugin {
    enter(): Promise<void>;
    exit(): Promise<void>;
    enterLandscape(): Promise<void>;
    exitLandscape(): Promise<void>;
    setPictureInPictureEnabled(options: { enabled: boolean }): Promise<void>;
}

const ImmersiveMode = registerPlugin<ImmersiveModePlugin>('ImmersiveMode');

export const enterImmersiveMode = async () => {
    if (!isNativeMobile()) return;
    await ImmersiveMode.enter();
};

export const exitImmersiveMode = async () => {
    if (!isNativeMobile()) return;
    await ImmersiveMode.exit();
};

export const enterLandscapePlayerMode = async () => {
    if (!isNativeMobile()) return;
    await ImmersiveMode.enterLandscape();
};

export const exitLandscapePlayerMode = async () => {
    if (!isNativeMobile()) return;
    await ImmersiveMode.exitLandscape();
};

export const setSystemPictureInPictureEnabled = async (enabled: boolean) => {
    if (!isNativeMobile()) return;
    await ImmersiveMode.setPictureInPictureEnabled({ enabled });
};

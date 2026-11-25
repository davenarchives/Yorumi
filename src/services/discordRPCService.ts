import type { DiscordPresenceOptions } from '../types/discord';
import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '../platform/runtime';
import { DEFAULT_DISCORD_CLIENT_ID } from '../config/discord';

const DISCORD_RPC_ENABLED_KEY = 'yorumi_discord_rpc_enabled';

class DiscordRPCService {
    private currentPresence: DiscordPresenceOptions | null = null;
    private activityStartTime: number | null = null;
    private currentActivityKey: string | null = null;

    public isEnabled(): boolean {
        if (typeof localStorage === 'undefined') return true;
        try {
            const raw = localStorage.getItem(DISCORD_RPC_ENABLED_KEY);
            return raw === null ? true : raw !== 'false';
        } catch {
            return true;
        }
    }

    public async setEnabled(enabled: boolean): Promise<void> {
        try {
            localStorage.setItem(DISCORD_RPC_ENABLED_KEY, enabled ? 'true' : 'false');
        } catch {
            // ignore
        }
        if (!enabled) {
            const saved = this.currentPresence;
            await this.clearPresence();
            this.currentPresence = saved;
            return;
        }
        if (this.currentPresence) {
            await this.updatePresence(this.currentPresence);
        }
    }

    public async updatePresence(options: DiscordPresenceOptions): Promise<boolean> {
        this.currentPresence = options;
        if (!this.isEnabled()) return false;
        if (!isTauri()) return false;
        try {
            return await invoke<boolean>('update_discord_presence', { presence: options, clientId: import.meta.env.VITE_DISCORD_CLIENT_ID || DEFAULT_DISCORD_CLIENT_ID });
        } catch { return false; }
    }

    public async clearPresence(): Promise<boolean> {
        this.currentPresence = null;
        this.currentActivityKey = null;
        this.activityStartTime = null;
        if (!isTauri()) return false;
        try { return await invoke<boolean>('clear_discord_presence'); } catch { return false; }
    }

    public setWatchingAnime(animeTitle: string, episodeNumber: number | string, episodeTitle?: string, coverImage?: string) {
        const activityKey = `anime_${animeTitle}_${episodeNumber}`;
        if (this.currentActivityKey !== activityKey) {
            this.currentActivityKey = activityKey;
            this.activityStartTime = Date.now();
        }

        const stateText = episodeTitle && episodeTitle !== `Episode ${episodeNumber}`
            ? `Episode ${episodeNumber}: ${episodeTitle}`
            : `Episode ${episodeNumber}`;

        const validCover = coverImage && coverImage.startsWith('http') ? coverImage : 'yorumi';

        this.updatePresence({
            type: 3, // 3 = WATCHING
            details: `Watching ${animeTitle}`,
            state: stateText,
            largeImageKey: validCover,
            largeImageText: animeTitle,
            smallImageKey: 'yorumi',
            smallImageText: 'Yorumi Anime',
            startTimestamp: this.activityStartTime || Date.now(),
        });
    }

    public setReadingManga(mangaTitle: string, chapterTitleOrNumber: number | string, pageNumber?: number, totalPages?: number) {
        const activityKey = `manga_${mangaTitle}_${chapterTitleOrNumber}`;
        if (this.currentActivityKey !== activityKey) {
            this.currentActivityKey = activityKey;
            this.activityStartTime = Date.now();
        }

        let stateText = typeof chapterTitleOrNumber === 'number' || !isNaN(Number(chapterTitleOrNumber))
            ? `Chapter ${chapterTitleOrNumber}`
            : `${chapterTitleOrNumber}`;

        if (pageNumber && totalPages) {
            stateText += ` (${pageNumber}/${totalPages})`;
        }

        this.updatePresence({
            type: 3, // 3 = WATCHING
            details: `Reading ${mangaTitle}`,
            state: stateText,
            largeImageKey: 'yorumi',
            largeImageText: mangaTitle,
            smallImageKey: 'yorumi',
            smallImageText: 'Yorumi Manga',
            startTimestamp: this.activityStartTime || Date.now(),
        });
    }

    public setReadingLightNovel(novelTitle: string, chapterTitleOrNumber: number | string) {
        const activityKey = `ln_${novelTitle}_${chapterTitleOrNumber}`;
        if (this.currentActivityKey !== activityKey) {
            this.currentActivityKey = activityKey;
            this.activityStartTime = Date.now();
        }

        const stateText = typeof chapterTitleOrNumber === 'number' || !isNaN(Number(chapterTitleOrNumber))
            ? `Chapter ${chapterTitleOrNumber}`
            : `${chapterTitleOrNumber}`;

        this.updatePresence({
            type: 3, // 3 = WATCHING
            details: `Reading ${novelTitle}`,
            state: stateText,
            largeImageKey: 'yorumi',
            largeImageText: novelTitle,
            smallImageKey: 'yorumi',
            smallImageText: 'Yorumi Light Novel',
            startTimestamp: this.activityStartTime || Date.now(),
        });
    }

    public setBrowsing(pageName: string) {
        const activityKey = `browsing_${pageName}`;
        if (this.currentActivityKey !== activityKey) {
            this.currentActivityKey = activityKey;
            this.activityStartTime = Date.now();
        }

        this.updatePresence({
            type: 0, // 0 = PLAYING
            details: 'Browsing Yorumi',
            state: pageName ? `Exploring ${pageName}` : 'In App',
            largeImageKey: 'yorumi',
            largeImageText: 'Yorumi',
            startTimestamp: this.activityStartTime || Date.now(),
        });
    }
}

export const discordRPCService = new DiscordRPCService();
export default discordRPCService;

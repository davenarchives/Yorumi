import type { DiscordPresenceOptions } from '../types/electron';

class DiscordRPCService {
    private currentPresence: DiscordPresenceOptions | null = null;
    private activityStartTime: number | null = null;
    private currentActivityKey: string | null = null;

    public async updatePresence(options: DiscordPresenceOptions): Promise<boolean> {
        this.currentPresence = options;
        if (typeof window !== 'undefined' && window.electronAPI?.updateDiscordPresence) {
            try {
                return await window.electronAPI.updateDiscordPresence(options);
            } catch (err) {
                console.error('[DiscordRPC] Failed to update presence:', err);
            }
        }
        return false;
    }

    public async clearPresence(): Promise<boolean> {
        this.currentPresence = null;
        this.currentActivityKey = null;
        this.activityStartTime = null;
        if (typeof window !== 'undefined' && window.electronAPI?.clearDiscordPresence) {
            try {
                return await window.electronAPI.clearDiscordPresence();
            } catch (err) {
                console.error('[DiscordRPC] Failed to clear presence:', err);
            }
        }
        return false;
    }

    public async setClientId(clientId: string): Promise<boolean> {
        if (typeof window !== 'undefined' && window.electronAPI?.setDiscordClientId) {
            try {
                return await window.electronAPI.setDiscordClientId(clientId);
            } catch (err) {
                console.error('[DiscordRPC] Failed to update client ID:', err);
            }
        }
        return false;
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

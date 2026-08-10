import { useState, useEffect, useCallback } from 'react';
import { downloadService, isDownloadTitleMatch, type DownloadedEpisode, type ActiveDownloadProgress } from '../services/downloadService';
import type { SubtitleTrack } from '../types/stream';

const activeDownloadsMap = new Map<string, ActiveDownloadProgress>();
const listeners = new Set<() => void>();

function notifyListeners() {
    listeners.forEach((fn) => fn());
}

export function useDownloads() {
    const [downloads, setDownloads] = useState<DownloadedEpisode[]>([]);
    const [activeDownloads, setActiveDownloads] = useState<Map<string, ActiveDownloadProgress>>(new Map(activeDownloadsMap));
    const [loading, setLoading] = useState(true);

    const loadDownloads = useCallback(async () => {
        try {
            const list = await downloadService.getDownloads();
            setDownloads(list);
        } catch (err) {
            console.error('Failed to load downloads:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadDownloads();

        const handleUpdate = () => {
            loadDownloads();
        };

        const handleGlobalProgress = () => {
            setActiveDownloads(new Map(activeDownloadsMap));
        };

        listeners.add(handleGlobalProgress);
        window.addEventListener('yorumi-downloads-updated', handleUpdate);

        return () => {
            listeners.delete(handleGlobalProgress);
            window.removeEventListener('yorumi-downloads-updated', handleUpdate);
        };
    }, [loadDownloads]);

    const isEpisodeDownloaded = useCallback(
        (
            animeId: string | number | undefined,
            episodeNumber: number | string | undefined,
            animeTitle?: string,
            anilistId?: number | string,
            alternateEpNumbers?: (number | string | undefined)[]
        ): boolean => {
            if (!downloads || downloads.length === 0) return false;
            const epNums = [episodeNumber, ...(alternateEpNumbers || [])]
                .map((n) => Number(n))
                .filter((n) => Number.isFinite(n) && n > 0);

            const targetId = String(animeId || '').trim().toLowerCase();
            const anilistStr = anilistId ? String(anilistId).trim().toLowerCase() : '';

            return downloads.some((d) => {
                const dEp = Number(d.episodeNumber);
                if (!epNums.includes(dEp)) return false;

                const dAnimeId = String(d.animeId || '').trim().toLowerCase();
                const dKey = String(d.id || '').toLowerCase();

                if (targetId && (dAnimeId === targetId || dAnimeId.includes(targetId) || targetId.includes(dAnimeId) || dKey.startsWith(`${targetId}_ep_`))) return true;
                if (anilistStr && (dAnimeId === anilistStr || dKey.startsWith(`${anilistStr}_ep_`))) return true;
                if (animeTitle && downloadService && isDownloadTitleMatch(d.animeTitle, animeTitle)) return true;

                return false;
            });
        },
        [downloads]
    );

    const getEpisodeDownload = useCallback(
        (
            animeId: string | number | undefined,
            episodeNumber: number | string | undefined,
            animeTitle?: string,
            anilistId?: number | string,
            alternateEpNumbers?: (number | string | undefined)[]
        ): DownloadedEpisode | undefined => {
            if (!downloads || downloads.length === 0) return undefined;
            const epNums = [episodeNumber, ...(alternateEpNumbers || [])]
                .map((n) => Number(n))
                .filter((n) => Number.isFinite(n) && n > 0);

            const targetId = String(animeId || '').trim().toLowerCase();
            const anilistStr = anilistId ? String(anilistId).trim().toLowerCase() : '';

            return downloads.find((d) => {
                const dEp = Number(d.episodeNumber);
                if (!epNums.includes(dEp)) return false;

                const dAnimeId = String(d.animeId || '').trim().toLowerCase();
                const dKey = String(d.id || '').toLowerCase();

                if (targetId && (dAnimeId === targetId || dAnimeId.includes(targetId) || targetId.includes(dAnimeId) || dKey.startsWith(`${targetId}_ep_`))) return true;
                if (anilistStr && (dAnimeId === anilistStr || dKey.startsWith(`${anilistStr}_ep_`))) return true;
                if (animeTitle && downloadService && isDownloadTitleMatch(d.animeTitle, animeTitle)) return true;

                return false;
            });
        },
        [downloads]
    );

    const getDownloadProgress = useCallback(
        (
            animeId: string | number | undefined,
            episodeNumber: number | string | undefined,
            anilistId?: number | string,
            alternateEpNumbers?: (number | string | undefined)[],
            animeTitle?: string
        ): ActiveDownloadProgress | undefined => {
            const epNums = [episodeNumber, ...(alternateEpNumbers || [])]
                .map((n) => Number(n))
                .filter((n) => Number.isFinite(n) && n > 0);
            const strId = String(animeId || '').trim();
            const strAnilist = anilistId ? String(anilistId).trim() : '';

            for (const ep of epNums) {
                if (strId) {
                    const k1 = downloadService.getEpisodeKey(strId, ep);
                    const k2 = downloadService.getLegacyEpisodeKey(strId, ep, animeTitle);
                    if (activeDownloads.has(k1)) return activeDownloads.get(k1);
                    if (activeDownloads.has(k2)) return activeDownloads.get(k2);
                }
                if (strAnilist) {
                    const k1 = downloadService.getEpisodeKey(strAnilist, ep);
                    const k2 = downloadService.getLegacyEpisodeKey(strAnilist, ep, animeTitle);
                    if (activeDownloads.has(k1)) return activeDownloads.get(k1);
                    if (activeDownloads.has(k2)) return activeDownloads.get(k2);
                }
            }

            for (const prog of activeDownloads.values()) {
                if (epNums.includes(Number(prog.episodeNumber))) {
                    return prog;
                }
            }

            return undefined;
        },
        [activeDownloads]
    );

    const startDownload = useCallback(
        async (params: {
            animeId: string;
            animeTitle: string;
            animeImage: string;
            episodeNumber: number;
            episodeTitle?: string;
            streamUrl: string;
            quality?: string;
            audio?: 'sub' | 'dub';
            subtitles?: SubtitleTrack[];
        }) => {
            const key = downloadService.getEpisodeKey(params.animeId, params.episodeNumber);
            const legacyKey = downloadService.getLegacyEpisodeKey(params.animeId, params.episodeNumber, params.animeTitle);

            const initialProg: ActiveDownloadProgress = {
                animeId: params.animeId,
                episodeNumber: params.episodeNumber,
                progress: 0,
                status: 'downloading',
                receivedBytes: 0,
                totalBytes: 0,
            };
            activeDownloadsMap.set(key, initialProg);
            activeDownloadsMap.set(legacyKey, initialProg);
            notifyListeners();

            try {
                const downloaded = await downloadService.downloadStream(params, (progress) => {
                    activeDownloadsMap.set(key, progress);
                    activeDownloadsMap.set(legacyKey, progress);
                    notifyListeners();
                });

                // Clear from active after completion delay
                setTimeout(() => {
                    activeDownloadsMap.delete(key);
                    activeDownloadsMap.delete(legacyKey);
                    notifyListeners();
                }, 1500);

                return downloaded;
            } catch (error) {
                console.error('Download failed:', error);
                setTimeout(() => {
                    activeDownloadsMap.delete(key);
                    activeDownloadsMap.delete(legacyKey);
                    notifyListeners();
                }, 3000);
                throw error;
            }
        },
        []
    );

    const deleteDownload = useCallback(async (animeId: string, episodeNumber: number) => {
        try {
            await downloadService.deleteDownload(animeId, episodeNumber);
        } catch (error) {
            console.error('Failed to delete download:', error);
        }
    }, []);

    return {
        downloads,
        loading,
        isEpisodeDownloaded,
        getEpisodeDownload,
        getDownloadProgress,
        startDownload,
        deleteDownload,
        refreshDownloads: loadDownloads,
    };
}

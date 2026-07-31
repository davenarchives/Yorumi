import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAnime } from '../../../hooks/useAnime';
import { useStreams } from '../../../hooks/useStreams';
import type { Anime, Episode } from '../../../types/anime';
import { storage } from '../../../utils/storage';
import { getEpisodeWatchKey } from '../../../utils/episodeWatchKey';
import { fetchSkipTimestamps, type SkipTimestamp } from '../../../services/skipTimestamps';

const AUTO_NEXT_STORAGE_KEY = 'yorumi:auto-next-enabled';
const AUTO_SKIP_STORAGE_KEY = 'yorumi:auto-skip-enabled';

export function usePlayer(animeId: string | undefined, animeSlugTitle?: string, fallbackEpisode?: Episode | null) {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const location = useLocation();

    // 1. Anime Data
    const animeHook = useAnime();
    const {
        selectedAnime,
        episodes,
        epLoading,
        scraperSession,
        error,
        saveProgress,
        watchedEpisodes,
        markEpisodeComplete,
        handleAnimeClick
    } = animeHook;

    // 2. Stream Data
    const streamTitleCandidates = [
        selectedAnime?.title,
        selectedAnime?.title_english,
        selectedAnime?.title_romaji,
        selectedAnime?.title_japanese,
        animeSlugTitle,
        ...(Array.isArray(selectedAnime?.synonyms) ? selectedAnime.synonyms : []),
    ].map((value) => String(value || '').trim()).filter(Boolean);
    const streamMetadata = {
        titlesKey: [...new Set(streamTitleCandidates)].join('|'),
        year: selectedAnime?.year,
        format: selectedAnime?.type,
        anilistId: selectedAnime?.id,
    };
    const streamsHook = useStreams(scraperSession, selectedAnime?.title || animeSlugTitle, streamMetadata);
    const {
        currentStream,
        serverSwitchLoading,
        streamLoading,
        currentEpisode,
        streams,
        hasResolvedStreams,
        isAutoQuality,
        selectedAudio,
        selectedServer,
        serverOptions,
        availableAudios,
        selectedStreamIndex,
        showQualityMenu,
        setShowQualityMenu,
        handleQualityChange: applyQualityChange,
        setAutoQuality: applyAutoQuality,
        handleServerChange: applyServerChange,
        setSelectedAudio: applySelectedAudio,
        tryNextStream,
        clearStreams,
        loadStream,
        bustEpisodeCache,
    } = streamsHook;

    // 3. UI State
    const [isExpanded, setIsExpanded] = useState(false);
    const [isPlayerReady, setIsPlayerReady] = useState(false);
    const [hasSeenEpisodeFetchStart, setHasSeenEpisodeFetchStart] = useState(false);
    const [episodesResolved, setEpisodesResolved] = useState(false);
    const [streamExhausted, setStreamExhausted] = useState(false);
    const [startAtOverrideSeconds, setStartAtOverrideSeconds] = useState<number | null>(null);
    const [episodeDurationSeconds, setEpisodeDurationSeconds] = useState<number | null>(null);
    const [autoNextEnabled, setAutoNextEnabledState] = useState(() => {
        try {
            return localStorage.getItem(AUTO_NEXT_STORAGE_KEY) !== 'false';
        } catch {
            return true;
        }
    });
    const [autoSkipEnabled, setAutoSkipEnabledState] = useState(() => {
        try {
            return localStorage.getItem(AUTO_SKIP_STORAGE_KEY) !== 'false';
        } catch {
            return true;
        }
    });
    const [skipTimestamps, setSkipTimestamps] = useState<SkipTimestamp[]>([]);
    const [skipTimestampsLoading, setSkipTimestampsLoading] = useState(false);
    const epNumParam = searchParams.get('ep') || '1';
    const resumeAtSeconds = (() => {
        const raw = searchParams.get('t');
        if (!raw) return 0;
        const parsed = Number(raw);
        return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
    })();
    
    // Watch time persistence
    const watchSessionStartedAtRef = useRef<number | null>(null);
    const lastPlaybackSecondRef = useRef<number | null>(null);
    const lastDurationSecondRef = useRef(0);
    const lastSavedProgressRef = useRef<{ at: number; second: number }>({ at: 0, second: -1 });
    const streamErrorRetryRef = useRef<{ url: string; at: number }>({ url: '', at: 0 });
    const streamFetchRetryKeyRef = useRef<string>('');
    const autoLoadAttemptKeyRef = useRef<string>('');
    const streamRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const streamRetryStateRef = useRef<{ key: string; attempts: number }>({ key: '', attempts: 0 });
    const streamFailureStateRef = useRef<{ key: string; attempts: number }>({ key: '', attempts: 0 });
    const STREAM_RETRY_DELAYS_MS: number[] = [];
    const extractDirectScraperSession = (value: unknown): string => {
        const raw = String(value || '').trim();
        const normalized = raw
            .replace(/^s:/i, '')
            .replace(/^https?:\/\/[^/]+/i, '')
            .replace(/^\/+/, '')
            .replace(/^watch\//i, '')
            .trim();
        if (!normalized) return '';
        return /^\d+$/.test(normalized) ? '' : normalized;
    };
    const getTmdbRouteId = (anime: (Anime & { tmdbId?: unknown; tmdb_id?: unknown }) | null | undefined): string => {
        const parsed = Number(anime?.tmdbId ?? anime?.tmdb_id);
        return Number.isFinite(parsed) && parsed > 0 ? `tmdb-${parsed}` : '';
    };
    const selectedTmdbRouteId = getTmdbRouteId(selectedAnime);

    const parseEpisodeNumber = (value: unknown): number => {
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        const raw = String(value ?? '').trim();
        const direct = Number(raw);
        if (Number.isFinite(direct)) return direct;
        const match = raw.match(/(\d+(?:\.\d+)?)/);
        return match ? Number(match[1]) : NaN;
    };
    const getPlaybackEpisodeNumber = (episode: Episode | null | undefined): number => {
        const absolute = parseEpisodeNumber(episode?._tmdbAbsolute);
        if (Number.isFinite(absolute) && absolute > 0) return absolute;
        return parseEpisodeNumber(episode?.episodeNumber);
    };
    const parseEpisodeDurationSeconds = (value: string | undefined): number | null => {
        const raw = String(value || '').trim();
        if (!raw) return null;

        const hoursMatch = raw.match(/(\d+(?:\.\d+)?)\s*h(?:ours?)?/i);
        const minutesMatch = raw.match(/(\d+(?:\.\d+)?)\s*m(?:in(?:ute)?s?)?/i);
        const secondsMatch = raw.match(/(\d+(?:\.\d+)?)\s*s(?:ec(?:ond)?s?)?/i);

        if (!hoursMatch && !minutesMatch && !secondsMatch) {
            const direct = raw.match(/(\d+):(\d{2})(?::(\d{2}))?/);
            if (direct) {
                const hours = direct[3] ? Number(direct[1]) : 0;
                const minutes = direct[3] ? Number(direct[2]) : Number(direct[1]);
                const seconds = Number(direct[3] || direct[2]);
                const total = (hours * 3600) + (minutes * 60) + seconds;
                return Number.isFinite(total) && total > 0 ? total : null;
            }
            return null;
        }

        const hours = hoursMatch ? Number(hoursMatch[1]) : 0;
        const minutes = minutesMatch ? Number(minutesMatch[1]) : 0;
        const seconds = secondsMatch ? Number(secondsMatch[1]) : 0;
        const total = (hours * 3600) + (minutes * 60) + seconds;
        return Number.isFinite(total) && total > 0 ? total : null;
    };
    const decodeSlugTitle = (slug?: string) =>
        String(slug || '')
            .replace(/-/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

    const clearScheduledStreamRetry = useCallback(() => {
        if (streamRetryTimeoutRef.current) {
            clearTimeout(streamRetryTimeoutRef.current);
            streamRetryTimeoutRef.current = null;
        }
    }, []);

    const resetScheduledStreamRetry = useCallback(() => {
        clearScheduledStreamRetry();
        streamRetryStateRef.current = { key: '', attempts: 0 };
    }, [clearScheduledStreamRetry]);

    const setAutoNextEnabled = useCallback((enabled: boolean) => {
        setAutoNextEnabledState(enabled);
        try {
            localStorage.setItem(AUTO_NEXT_STORAGE_KEY, enabled ? 'true' : 'false');
        } catch {
            // Ignore storage errors; the in-memory setting still applies for this session.
        }
    }, []);

    const setAutoSkipEnabled = useCallback((enabled: boolean) => {
        setAutoSkipEnabledState(enabled);
        try {
            localStorage.setItem(AUTO_SKIP_STORAGE_KEY, enabled ? 'true' : 'false');
        } catch {
            // Ignore storage errors; the in-memory setting still applies for this session.
        }
    }, []);

    // --- Effects ---

    // Clear streams on mount/id change
    useEffect(() => {
        clearStreams();
        setHasSeenEpisodeFetchStart(false);
        setEpisodesResolved(false);
        setIsPlayerReady(false);
        setStreamExhausted(false);
        setStartAtOverrideSeconds(null);
        watchSessionStartedAtRef.current = null;
        lastPlaybackSecondRef.current = null;
        lastDurationSecondRef.current = 0;
        lastSavedProgressRef.current = { at: 0, second: -1 };
        streamFetchRetryKeyRef.current = '';
        autoLoadAttemptKeyRef.current = '';
        streamFailureStateRef.current = { key: '', attempts: 0 };
        resetScheduledStreamRetry();
    }, [animeId, clearStreams, resetScheduledStreamRetry]);

    useEffect(() => {
        streamFetchRetryKeyRef.current = '';
        autoLoadAttemptKeyRef.current = '';
        resetScheduledStreamRetry();
    }, [scraperSession, resetScheduledStreamRetry]);

    useEffect(() => {
        setEpisodeDurationSeconds(parseEpisodeDurationSeconds(currentEpisode?.duration));
    }, [currentEpisode?.session, currentEpisode?.duration]);

    useEffect(() => {
        const currentId = String(animeId || '');
        const currentSession = extractDirectScraperSession(currentId);
        const animeMatch = selectedAnime &&
            (
                String(selectedAnime.id) === currentId ||
                String(selectedAnime.mal_id) === currentId ||
                selectedTmdbRouteId === currentId ||
                (!!currentSession && extractDirectScraperSession(selectedAnime.scraperId) === currentSession)
            );
        if (!animeMatch) return;

        if (epLoading) {
            setHasSeenEpisodeFetchStart(true);
            return;
        }

        if (episodes.length > 0 || hasSeenEpisodeFetchStart) {
            setEpisodesResolved(true);
        }
    }, [animeId, selectedAnime?.id, selectedAnime?.mal_id, selectedTmdbRouteId, epLoading,
        episodes.length, hasSeenEpisodeFetchStart]);

    // Fetch Anime if missing
    useEffect(() => {
        const currentId = String(animeId || '');
        const currentSession = extractDirectScraperSession(currentId);

        // Prevent re-fetching if we already have the correct anime loaded
        if (selectedAnime && (
            String(selectedAnime.id) === currentId ||
            String(selectedAnime.mal_id) === currentId ||
            selectedTmdbRouteId === currentId ||
            (!!currentSession && extractDirectScraperSession(selectedAnime.scraperId) === currentSession)
        )) {
            return;
        }

        if (location.state?.anime) {
            handleAnimeClick(location.state.anime);
        } else if (animeId) {
            const directScraperSession = currentSession;
            const ids = isNaN(Number(animeId)) ? animeId : parseInt(animeId);
            const fallbackTitle = decodeSlugTitle(animeSlugTitle);
            handleAnimeClick({
                mal_id: typeof ids === 'number' ? ids : 0,
                id: typeof ids === 'number' ? ids : undefined,
                scraperId: directScraperSession || undefined,
                title: fallbackTitle || String(animeId),
            } as Anime);
        }
    }, [animeId, animeSlugTitle, location.state, selectedAnime?.id, selectedAnime?.mal_id, selectedAnime?.scraperId, selectedTmdbRouteId]);

    // Auto-load Episode
    useEffect(() => {
        // STRICT GUARD: Match URL ID with Context Anime ID
        // This prevents race condition where previous anime state triggers a load for the new page
        const currentId = String(animeId);
        const currentSession = extractDirectScraperSession(currentId);
        const animeMatch = selectedAnime &&
            (
                String(selectedAnime.id) === currentId ||
                String(selectedAnime.mal_id) === currentId ||
                selectedTmdbRouteId === currentId ||
                (!!currentSession && extractDirectScraperSession(selectedAnime.scraperId) === currentSession)
            );

        if (!scraperSession && !selectedAnime?.title) return;

        const playableEpisodes = episodes.length > 0
            ? episodes
            : fallbackEpisode
                ? [fallbackEpisode]
                : [];

        if (playableEpisodes.length > 0 && animeMatch) {
            let targetEp: Episode | undefined;
            const parsedTargetEpisode = parseEpisodeNumber(epNumParam);

            if (epNumParam === 'latest') {
                const sorted = [...playableEpisodes].sort((a, b) => parseFloat(a.episodeNumber) - parseFloat(b.episodeNumber));
                targetEp = sorted[sorted.length - 1];
            } else if (Number.isFinite(parsedTargetEpisode) && parsedTargetEpisode > 0) {
                const sorted = [...playableEpisodes].sort(
                    (a, b) => getPlaybackEpisodeNumber(a) - getPlaybackEpisodeNumber(b)
                );
                targetEp =
                    sorted.find((episode) => getPlaybackEpisodeNumber(episode) === parsedTargetEpisode) ||
                    sorted.find((episode) => parseEpisodeNumber(episode.episodeNumber) === parsedTargetEpisode) ||
                    [...sorted]
                        .reverse()
                        .find((episode) => getPlaybackEpisodeNumber(episode) <= parsedTargetEpisode) ||
                    sorted[sorted.length - 1];
            } else {
                targetEp = playableEpisodes.find(e => e.episodeNumber == epNumParam) || playableEpisodes[0];
            }

            if (targetEp) {
                const isAlreadyCurrent = currentEpisode && getPlaybackEpisodeNumber(currentEpisode) === getPlaybackEpisodeNumber(targetEp);
                if (isAlreadyCurrent && currentStream) return;

                const attemptKey = `${String(animeId || '')}:${String(targetEp.session || targetEp.episodeNumber || '')}`;
                if (autoLoadAttemptKeyRef.current === attemptKey) {
                    return;
                }
                autoLoadAttemptKeyRef.current = attemptKey;

                const targetEpisodeNumber = getPlaybackEpisodeNumber(targetEp);
                const targetWatchKey = getEpisodeWatchKey(targetEp);
                if (targetWatchKey) markEpisodeComplete(targetWatchKey);
                // Update URL if we defaulted to a different episode or resolved 'latest'
                if (String(targetEpisodeNumber) !== epNumParam) {
                    setSearchParams({ ep: String(targetEpisodeNumber) }, { replace: true });
                }
                setIsPlayerReady(false);
                loadStream(targetEp);
            }
        }
    }, [episodes, fallbackEpisode, epNumParam, currentStream,

        scraperSession, selectedServer]);

    // Episode-change bookkeeping.
    useEffect(() => {
        if (!selectedAnime || !currentEpisode) return;
        const episodeWatchKey = getEpisodeWatchKey(currentEpisode);
        if (episodeWatchKey) markEpisodeComplete(episodeWatchKey);
        saveProgress(selectedAnime, currentEpisode, {
            positionSeconds: Math.max(0, Math.floor(startAtOverrideSeconds ?? resumeAtSeconds ?? 0)),
            durationSeconds: Math.max(0, Math.floor(lastDurationSecondRef.current || 0))
        });
        lastSavedProgressRef.current = {
            at: Date.now(),
            second: Math.max(0, Math.floor(startAtOverrideSeconds ?? resumeAtSeconds ?? 0))
        };
        lastPlaybackSecondRef.current = null;
        lastDurationSecondRef.current = 0;
    }, [selectedAnime, currentEpisode, saveProgress, startAtOverrideSeconds, resumeAtSeconds]);

    // Fetch skip timestamps when episode changes
    useEffect(() => {
        if (!selectedAnime || !currentEpisode) {
            setSkipTimestamps([]);
            return;
        }
        const episodeNumber = getPlaybackEpisodeNumber(currentEpisode);
        if (!Number.isFinite(episodeNumber) || episodeNumber <= 0) {
            setSkipTimestamps([]);
            return;
        }
        const malId = selectedAnime.mal_id || selectedAnime.id;
        const title = selectedAnime.title || animeSlugTitle || '';
        const durationSeconds = episodeDurationSeconds ?? parseEpisodeDurationSeconds(currentEpisode.duration);

        setSkipTimestampsLoading(true);
        fetchSkipTimestamps(
            malId && Number.isFinite(malId) ? Number(malId) : null,
            title,
            episodeNumber,
            durationSeconds
        )
            .then((timestamps) => {
                setSkipTimestamps(timestamps);
            })
            .catch((error) => {
                console.warn('Failed to fetch skip timestamps:', error);
                setSkipTimestamps([]);
            })
            .finally(() => {
                setSkipTimestampsLoading(false);
            });
    }, [
        selectedAnime?.mal_id,
        selectedAnime?.id,
        selectedAnime?.title,
        animeSlugTitle,
        currentEpisode?.episodeNumber,
        currentEpisode?.session,
        currentEpisode?.duration,
        episodeDurationSeconds,
    ]);

    // NOTE: Adjacent-episode prefetching has been intentionally disabled to prevent
    // excessive Vercel serverless CPU usage. Each prefetch call spins up a Puppeteer
    // browser instance on the backend, which causes rapid CPU spikes on every episode load.

    // When loading finishes with no stream result, retry with backoff
    // instead of dropping the player into a dead-end state after one miss.
    useEffect(() => {
        if (!currentEpisode) {
            resetScheduledStreamRetry();
            return;
        }
        if (currentStream || streamLoading || hasResolvedStreams) {
            setStreamExhausted(false);
            resetScheduledStreamRetry();
            return;
        }
        if (String(getPlaybackEpisodeNumber(currentEpisode)) !== String(epNumParam)) return;

        const retryKey = `${String(scraperSession || '')}:${String(currentEpisode.session || currentEpisode.episodeNumber || '')}`;
        if (streamRetryStateRef.current.key !== retryKey) {
            resetScheduledStreamRetry();
            streamRetryStateRef.current = { key: retryKey, attempts: 0 };
        }

        const attempt = streamRetryStateRef.current.attempts;
        if (attempt >= STREAM_RETRY_DELAYS_MS.length) {
            setStreamExhausted(true);
            return;
        }
        const delay = STREAM_RETRY_DELAYS_MS[Math.min(attempt, STREAM_RETRY_DELAYS_MS.length - 1)];
        setStreamExhausted(attempt >= STREAM_RETRY_DELAYS_MS.length - 1);

        if (streamRetryTimeoutRef.current) {
            return;
        }

        streamRetryTimeoutRef.current = setTimeout(() => {
            streamRetryTimeoutRef.current = null;
            streamRetryStateRef.current = {
                key: retryKey,
                attempts: attempt + 1,
            };
            streamFetchRetryKeyRef.current = retryKey;
            bustEpisodeCache(currentEpisode.session);
            loadStream(currentEpisode);
        }, delay);
    }, [currentEpisode, currentStream,

        scraperSession, bustEpisodeCache, loadStream, resetScheduledStreamRetry]);

    useEffect(() => {
        return () => {
            clearScheduledStreamRetry();
        };
    }, [clearScheduledStreamRetry]);

    const flushWatchTime = useCallback(() => {
        if (!selectedAnime) return;

        const startedAt = watchSessionStartedAtRef.current;
        if (!startedAt) return;

        const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
        if (seconds <= 0 || !selectedAnime) return;

        const primaryAnimeId = String(selectedAnime.mal_id || selectedAnime.id || '');
        if (primaryAnimeId) {
            storage.addAnimeWatchTime(primaryAnimeId, seconds);
        }
        storage.addAnimeWatchTimeTotal(seconds);
        watchSessionStartedAtRef.current = null;
    }, [selectedAnime?.mal_id, selectedAnime?.id]);

    useEffect(() => {
        if (!isPlayerReady || !selectedAnime || !currentEpisode) {
            flushWatchTime();
            return;
        }

        if (!watchSessionStartedAtRef.current) {
            watchSessionStartedAtRef.current = Date.now();
        }
    }, [isPlayerReady, selectedAnime, currentEpisode?.session, flushWatchTime]);

    const persistLatestProgress = useCallback(() => {
        if (!selectedAnime || !currentEpisode) return;
        if (lastPlaybackSecondRef.current === null) return;
        const second = Math.max(0, Math.floor(lastPlaybackSecondRef.current));
        if (second <= 0 && lastDurationSecondRef.current <= 0) return;

        saveProgress(selectedAnime, currentEpisode, {
            positionSeconds: second,
            durationSeconds: Math.max(0, Math.floor(lastDurationSecondRef.current || 0))
        });
        lastSavedProgressRef.current = { at: Date.now(), second };
    }, [selectedAnime, currentEpisode, saveProgress]);

    const resetEpisodePlaybackState = useCallback((keepResumeFromCurrent = false) => {
        const second = Math.max(0, Math.floor(lastPlaybackSecondRef.current || 0));
        setStartAtOverrideSeconds(keepResumeFromCurrent && second > 0 ? second : null);
        setIsPlayerReady(false);
        setStreamExhausted(false);
        streamFetchRetryKeyRef.current = '';
        streamErrorRetryRef.current = { url: '', at: 0 };
        resetScheduledStreamRetry();
        lastPlaybackSecondRef.current = keepResumeFromCurrent ? lastPlaybackSecondRef.current : null;
        lastDurationSecondRef.current = keepResumeFromCurrent ? lastDurationSecondRef.current : 0;
    }, [resetScheduledStreamRetry]);

    // Flush watch-time when stream/episode changes or unmounting.
    useEffect(() => {
        return () => {
            persistLatestProgress();
            flushWatchTime();
        };
    }, [currentStream?.url, currentEpisode?.session, persistLatestProgress, flushWatchTime]);

    useEffect(() => {
        const handlePageHide = () => {
            persistLatestProgress();
            flushWatchTime();
        };
        const handleVisibility = () => {
            if (document.visibilityState === 'hidden') {
                persistLatestProgress();
                flushWatchTime();
            }
        };
        window.addEventListener('pagehide', handlePageHide);
        document.addEventListener('visibilitychange', handleVisibility);
        return () => {
            window.removeEventListener('pagehide', handlePageHide);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [persistLatestProgress, flushWatchTime]);

    const handlePlaybackProgress = useCallback((progress: { currentTime: number; duration: number; ended?: boolean }) => {
        if (!selectedAnime || !currentEpisode || !isPlayerReady) return;

        const currentSecond = Number.isFinite(progress.currentTime) ? Math.max(0, Math.floor(progress.currentTime)) : 0;
        const durationSeconds = Number.isFinite(progress.duration) ? Math.max(0, Math.floor(progress.duration)) : 0;
        lastDurationSecondRef.current = durationSeconds;
        lastPlaybackSecondRef.current = currentSecond;
        if (durationSeconds > 0) {
            setEpisodeDurationSeconds((current) => {
                if (!current || Math.abs(current - durationSeconds) >= 2) {
                    return durationSeconds;
                }
                return current;
            });
        }

        const now = Date.now();
        const shouldSave = progress.ended || (
            now - lastSavedProgressRef.current.at >= 8000
            && Math.abs(currentSecond - lastSavedProgressRef.current.second) >= 2
        );
        if (!shouldSave) return;

        saveProgress(selectedAnime, currentEpisode, {
            positionSeconds: currentSecond,
            durationSeconds
        });
        lastSavedProgressRef.current = { at: now, second: currentSecond };
    }, [selectedAnime, currentEpisode, isPlayerReady, saveProgress]);

    const handleStreamError = useCallback(() => {
        const url = String(currentStream?.url || '');
        const now = Date.now();
        if (url && streamErrorRetryRef.current.url === url && now - streamErrorRetryRef.current.at < 1200) {
            return;
        }
        streamErrorRetryRef.current = { url, at: now };
        const second = Math.max(0, Math.floor(lastPlaybackSecondRef.current || 0));
        if (second > 0) setStartAtOverrideSeconds(second);
        const switchedSource = tryNextStream();
        if (!switchedSource && currentEpisode) {
            const failureKey = `${String(scraperSession || '')}:${String(currentEpisode.session || currentEpisode.episodeNumber || '')}`;
            if (streamFailureStateRef.current.key !== failureKey) {
                streamFailureStateRef.current = { key: failureKey, attempts: 0 };
            }
            if (streamFailureStateRef.current.attempts >= 2) {
                setStreamExhausted(true);
                return;
            }
            streamFailureStateRef.current = {
                key: failureKey,
                attempts: streamFailureStateRef.current.attempts + 1,
            };
            resetScheduledStreamRetry();
            bustEpisodeCache(currentEpisode.session);
            loadStream(currentEpisode);
        }
    }, [currentEpisode, currentStream?.url, scraperSession, tryNextStream, resetScheduledStreamRetry, bustEpisodeCache, loadStream]);

    // --- Actions ---

    const handleEpisodeClick = (ep: Episode) => {
        persistLatestProgress();
        autoLoadAttemptKeyRef.current = '';
        const episodeNumber = getPlaybackEpisodeNumber(ep);
        const episodeWatchKey = getEpisodeWatchKey(ep);
        if (episodeWatchKey) markEpisodeComplete(episodeWatchKey);
        resetEpisodePlaybackState(false);
        setSearchParams({ ep: String(episodeNumber) });
        loadStream(ep);
    };

    const toggleExpand = () => setIsExpanded(!isExpanded);

    const reloadPlayer = () => {
        if (currentEpisode) {
            autoLoadAttemptKeyRef.current = '';
            bustEpisodeCache(currentEpisode.session);
            resetEpisodePlaybackState(true);
            loadStream(currentEpisode);
        }
    };

    const handleQualityChange = (index: number) => {
        resetEpisodePlaybackState(true);
        applyQualityChange(index);
    };

    const setAutoQuality = () => {
        resetEpisodePlaybackState(true);
        applyAutoQuality();
    };

    const setSelectedServer = (server: typeof selectedServer) => {
        autoLoadAttemptKeyRef.current = '';
        resetEpisodePlaybackState(true);
        applyServerChange(server);
    };

    const setSelectedAudio = (audio: 'sub' | 'dub') => {
        autoLoadAttemptKeyRef.current = '';
        resetEpisodePlaybackState(true);
        applySelectedAudio(audio);
    };

    const displayEpisodes = episodes.length > 0
        ? episodes
        : fallbackEpisode
            ? [fallbackEpisode]
            : [];
    const sortedEpisodes = [...displayEpisodes].sort(
        (a, b) => getPlaybackEpisodeNumber(a) - getPlaybackEpisodeNumber(b)
    );
    const currentEpisodeIndex = sortedEpisodes.findIndex((episode) => {
        if (episode.session && currentEpisode?.session && episode.session === currentEpisode.session) return true;
        if (String(getPlaybackEpisodeNumber(episode)) === String(epNumParam)) return true;
        if (String(episode.episodeNumber) === String(epNumParam)) return true;
        return false;
    });
    const prevEpisode = currentEpisodeIndex > 0 ? sortedEpisodes[currentEpisodeIndex - 1] : null;
    const nextEpisode = currentEpisodeIndex >= 0 && currentEpisodeIndex < sortedEpisodes.length - 1
        ? sortedEpisodes[currentEpisodeIndex + 1]
        : null;

    const handlePrevEp = () => {
        if (prevEpisode) handleEpisodeClick(prevEpisode);
    };

    const handleNextEp = () => {
        if (nextEpisode) handleEpisodeClick(nextEpisode);
    };

    // Derived State
    const currentEpisodeData = displayEpisodes.find(e => (
        String(getPlaybackEpisodeNumber(e)) === String(epNumParam)
        || String(e.episodeNumber) === String(epNumParam)
    ));
    const episodeNumber = parseFloat(String(epNumParam));
    const metadata = selectedAnime?.episodeMetadata || [];
    
    const meta = (Number.isFinite(episodeNumber) && metadata.length > 0)
        ? (metadata.find((item) => {
            const match = item.title?.match(/Episode\s+(\d+)/i);
            return match && parseFloat(match[1]) === episodeNumber;
        }) || metadata[episodeNumber - 1] || null)
        : null;

    const rawTitle = currentEpisodeData?.title;
    const isBasicTitle = rawTitle && (
        rawTitle.trim().toLowerCase() === 'untitled' || 
        !isNaN(Number(rawTitle.trim())) ||
        /^episode\s+\d+$/i.test(rawTitle.trim())
    );
    const cleanRawTitle = rawTitle && !isBasicTitle ? rawTitle : null;

    let cleanCurrentTitle = meta?.title?.replace(/^Episode \d+[\s-]*:?/i, '').trim() || cleanRawTitle;
    if (cleanCurrentTitle) {
        cleanCurrentTitle = cleanCurrentTitle.split('<note-split>')[0].trim();
    }

    return {
        // Data
        anime: selectedAnime,
        episodes,
        currentEpisode,
        currentStream,
        streams,
        error,
        watchedEpisodes,
        episodesResolved,
        epNum: epNumParam,
        resumeAtSeconds: startAtOverrideSeconds ?? resumeAtSeconds,
        cleanCurrentTitle,

        // Loading States
        epLoading,
        serverSwitchLoading,
        streamLoading,
        isPlayerReady,
        streamExhausted,
        skipTimestampsLoading,

        // UI State
        isExpanded,
        isAutoQuality,
        autoNextEnabled,
        autoSkipEnabled,
        selectedAudio,
        selectedServer,
        serverOptions,
        availableAudios,
        showQualityMenu,
        selectedStreamIndex,
        skipTimestamps,
        canPrevEpisode: Boolean(prevEpisode),
        canNextEpisode: Boolean(nextEpisode),

        // Actions
        toggleExpand,
        setIsPlayerReady,
        reloadPlayer,
        handlePrevEp,
        handleNextEp,
        handleEpisodeClick,
        setShowQualityMenu,
        handleQualityChange,
        setAutoQuality,
        setAutoNextEnabled,
        setAutoSkipEnabled,
        setSelectedServer,
        setSelectedAudio,
        handlePlaybackProgress,
        handleStreamError,
        navigate // Expose navigate for back button
    };
}

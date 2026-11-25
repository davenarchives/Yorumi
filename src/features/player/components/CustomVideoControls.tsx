import { useEffect, useState, useRef, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, FastForward, Volume2, VolumeX, Settings, Maximize, Minimize, Mic, Gauge, Video, ChevronLeft, CheckCircle2, Circle, X, RotateCcw, RotateCw, Captions, Lock, Unlock, ListVideo, Server, Check, Cast } from 'lucide-react';
import type { StreamServerKey } from '../../../hooks/useStreams';
import type { StreamLink, SubtitleTrack } from '../../../types/stream';
import type { SkipTimestamp } from '../../../services/skipTimestamps';
import type { Episode } from '../../../types/anime';
import { getMappedQuality } from '../../../utils/streamUtils';
import {
    AUTO_TRANSLATE_LANGUAGES,
    fetchSubtitleText,
    getSubtitleLanguageLabel,
    parseSubtitleCues,
    translateSubtitleCues,
    type SubtitleCue,
} from '../../../utils/subtitles';
import { isMobileShell } from '../../../platform/runtime';
import { enterImmersiveMode, exitImmersiveMode, enterLandscapePlayerMode, exitLandscapePlayerMode } from '../../../platform/immersiveMode';
import { ScreenOrientation } from '@capacitor/screen-orientation';

interface CustomVideoControlsProps {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    onNextEpisode?: () => void;
    onPrevEpisode?: () => void;
    hasNextEpisode?: boolean;
    autoNextEnabled?: boolean;
    onAutoNextChange?: (enabled: boolean) => void;
    autoSkipEnabled?: boolean;
    onAutoSkipChange?: (enabled: boolean) => void;
    skipTimestamps?: SkipTimestamp[];
    skipTimestampsLoading?: boolean;
    selectedAudio: 'sub' | 'dub';
    availableAudios: Array<'sub' | 'dub'>;
    onAudioChange: (audio: 'sub' | 'dub') => void;
    streams: StreamLink[];
    selectedStreamIndex: number;
    isAutoQuality: boolean;
    onQualityChange: (index: number) => void;
    onSetAutoQuality: () => void;
    selectedServer: StreamServerKey;
    serverOptions: Array<{ key: StreamServerKey; label: string }>;
    onServerChange: (server: StreamServerKey) => void;
    streamKey?: string;
    mode?: 'full' | 'mini';
    onMiniClose?: () => void;
    onMiniExpand?: () => void;
    isWide?: boolean;
    onToggleWide?: () => void;
    hlsLevels?: number[];
    onHlsQualitySelect?: (quality: string) => boolean;
    initialDuration?: number;
    animeId?: string;
    animeTitle?: string;
    animeImage?: string;
    episodeNumber?: number;
    episodeTitle?: string;
    hasSubtitles?: boolean;
    subtitleTracks?: SubtitleTrack[];
    pageLayout?: boolean;
    onClose?: () => void;
    onShowEpisodes?: () => void;
    seasonNumber?: number;
    episodes?: Episode[];
    onEpisodeSelect?: (episode: Episode) => void;
}

const PLAYBACK_SPEEDS = [0.25, 1, 1.25, 1.5, 2];
const QUALITY_OPTIONS = ['Auto', '1080p', '720p', '480p', '360p'];
const SEEK_SECONDS = 10;

const waitForViewportOrientation = (orientation: 'portrait' | 'landscape', timeoutMs = 1200) => new Promise<void>((resolve) => {
    const startedAt = Date.now();
    const check = () => {
        const viewport = window.visualViewport;
        const width = viewport?.width || window.innerWidth;
        const height = viewport?.height || window.innerHeight;
        const matches = orientation === 'portrait' ? height >= width : width >= height;
        if (matches || Date.now() - startedAt >= timeoutMs) {
            resolve();
            return;
        }
        window.requestAnimationFrame(check);
    };
    check();
});

const getSubtitleLabel = (language: string) => getSubtitleLanguageLabel(language);

function SeekIcon({ direction }: { direction: 'back' | 'forward' }) {
    const Icon = direction === 'back' ? RotateCcw : RotateCw;
    return (
        <span className="relative flex h-6 w-6 items-center justify-center">
            <Icon className="h-6 w-6 stroke-[2.2]" />
            <span className="absolute text-[8px] font-black leading-none tracking-normal">10</span>
        </span>
    );
}

export default function CustomVideoControls({
    videoRef,
    onNextEpisode,
    onPrevEpisode,
    hasNextEpisode = false,
    autoNextEnabled = true,
    onAutoNextChange,
    autoSkipEnabled = true,
    onAutoSkipChange,
    skipTimestamps = [],
    skipTimestampsLoading = false,
    selectedAudio,
    availableAudios,
    onAudioChange,
    streams,
    selectedStreamIndex,
    isAutoQuality,
    onQualityChange,
    onSetAutoQuality,
    selectedServer,
    serverOptions,
    onServerChange,
    streamKey,
    mode = 'full',
    onMiniClose,
    onMiniExpand,
    onHlsQualitySelect,
    initialDuration = 0,
    animeTitle,
    animeImage,
    episodeNumber,
    episodeTitle,
    hasSubtitles = false,
    subtitleTracks = [],
    pageLayout = false,
    onClose,
    onShowEpisodes,
    seasonNumber,
    episodes = [],
    onEpisodeSelect,
}: CustomVideoControlsProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(initialDuration || 0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const [settingsView, setSettingsView] = useState<'main' | 'speed' | 'quality'>('main');
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [centerAction, setCenterAction] = useState<{ type: 'play' | 'pause'; id: number } | null>(null);
    const [selectedHlsQuality, setSelectedHlsQuality] = useState<string>('Auto');
    const [subtitlesEnabled, setSubtitlesEnabled] = useState(hasSubtitles);
    const [selectedSubtitleIndex, setSelectedSubtitleIndex] = useState(0);
    const [selectedTranslateLang, setSelectedTranslateLang] = useState<string | null>(null);
    const [isTranslatingSubtitles, setIsTranslatingSubtitles] = useState(false);
    const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
    const [baseSubtitleCues, setBaseSubtitleCues] = useState<SubtitleCue[]>([]);
    const [activeSubtitleCues, setActiveSubtitleCues] = useState<SubtitleCue[]>([]);
    const [activeCueTexts, setActiveCueTexts] = useState<string[]>([]);
    const [showEpisodesDrawer, setShowEpisodesDrawer] = useState(false);
    const [showServerMenu, setShowServerMenu] = useState(false);
    const [isControlsLocked, setIsControlsLocked] = useState(false);
    const [isFastForwarding, setIsFastForwarding] = useState(false);
    const nativeFullscreenTransitionRef = useRef(false);
    const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const holdActivatedRef = useRef(false);
    const isFastForwardingRef = useRef(false);
    const suppressNextClickRef = useRef(false);
    const previousPlaybackRateRef = useRef(1);

    const selectSubtitleTrack = useCallback((index: number | null) => {
        setSelectedTranslateLang(null);
        if (index === null) {
            setSubtitlesEnabled(false);
        } else {
            setSelectedSubtitleIndex(index);
            setSubtitlesEnabled(true);
        }
        setShowSubtitleMenu(false);
    }, []);

    const selectTranslatedSubtitle = useCallback((langCode: string) => {
        setSelectedSubtitleIndex(0);
        setSelectedTranslateLang(langCode);
        setSubtitlesEnabled(true);
        setShowSubtitleMenu(false);
    }, []);

    // Keep native video.textTracks disabled so our custom cue overlay is the single
    // deterministic renderer across WebView2, hls.js, offline blobs, and remote streams.
    useEffect(() => {
        const video = videoRef.current;
        if (!video?.textTracks) return;
        const disableNativeTracks = () => {
            for (let i = 0; i < video.textTracks.length; i += 1) {
                if (video.textTracks[i].mode !== 'disabled') {
                    video.textTracks[i].mode = 'disabled';
                }
            }
        };
        disableNativeTracks();
        video.textTracks.addEventListener('addtrack', disableNativeTracks);
        return () => {
            video.textTracks.removeEventListener('addtrack', disableNativeTracks);
        };
    }, [streamKey, videoRef]);

    useEffect(() => {
        setSubtitlesEnabled(hasSubtitles);
        setSelectedSubtitleIndex(0);
        setSelectedTranslateLang(null);
        setShowSubtitleMenu(false);
    }, [hasSubtitles, streamKey]);

    useEffect(() => {
        if (selectedSubtitleIndex >= subtitleTracks.length && subtitleTracks.length > 0) {
            setSelectedSubtitleIndex(0);
        }
    }, [selectedSubtitleIndex, subtitleTracks.length]);

    useEffect(() => {
        if (selectedAudio !== 'dub') return;
        setSubtitlesEnabled(false);
        setSelectedTranslateLang(null);
        setShowSubtitleMenu(false);
    }, [selectedAudio]);

    const activeSubtitleUrl = hasSubtitles && subtitlesEnabled
        ? (selectedTranslateLang
            ? (subtitleTracks[0]?.url || '')
            : (subtitleTracks[selectedSubtitleIndex]?.url || subtitleTracks[0]?.url || ''))
        : '';

    useEffect(() => {
        if (!activeSubtitleUrl) {
            setBaseSubtitleCues([]);
            setActiveSubtitleCues([]);
            setActiveCueTexts([]);
            setIsTranslatingSubtitles(false);
            return;
        }
        const controller = new AbortController();
        let active = true;
        setBaseSubtitleCues([]);
        setActiveSubtitleCues([]);
        setActiveCueTexts([]);

        void fetchSubtitleText(activeSubtitleUrl, controller.signal)
            .then((text) => {
                if (!active) return;
                const parsed = text ? parseSubtitleCues(text) : [];
                setBaseSubtitleCues(parsed);
            })
            .catch(() => {
                if (!active) return;
                setBaseSubtitleCues([]);
            });

        return () => {
            active = false;
            controller.abort();
        };
    }, [activeSubtitleUrl]);

    useEffect(() => {
        if (!selectedTranslateLang) {
            setActiveSubtitleCues(baseSubtitleCues);
            setIsTranslatingSubtitles(false);
            return;
        }
        if (baseSubtitleCues.length === 0 || !activeSubtitleUrl) {
            setActiveSubtitleCues([]);
            return;
        }

        const controller = new AbortController();
        let active = true;
        setIsTranslatingSubtitles(true);
        // Show base cues immediately until the first translated batch arrives
        setActiveSubtitleCues(baseSubtitleCues);

        const currentSec = Number.isFinite(videoRef.current?.currentTime)
            ? Number(videoRef.current?.currentTime || 0)
            : 0;

        void translateSubtitleCues(
            activeSubtitleUrl,
            baseSubtitleCues,
            selectedTranslateLang,
            currentSec,
            (partial) => {
                if (!active) return;
                setActiveSubtitleCues(partial);
                setIsTranslatingSubtitles(false);
            },
            controller.signal
        ).then((finalCues) => {
            if (!active) return;
            setActiveSubtitleCues(finalCues);
            setIsTranslatingSubtitles(false);
        }).catch(() => {
            if (!active) return;
            setIsTranslatingSubtitles(false);
        });

        return () => {
            active = false;
            controller.abort();
        };
    }, [activeSubtitleUrl, baseSubtitleCues, selectedTranslateLang, videoRef]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !hasSubtitles || !subtitlesEnabled || activeSubtitleCues.length === 0) {
            setActiveCueTexts([]);
            return;
        }

        const updateActiveCues = () => {
            const t = Number.isFinite(video.currentTime) ? video.currentTime : 0;
            const matched: string[] = [];
            for (let i = 0; i < activeSubtitleCues.length; i += 1) {
                const cue = activeSubtitleCues[i];
                if (cue.start > t) break;
                if (t >= cue.start && t <= cue.end) {
                    matched.push(cue.text);
                }
            }
            setActiveCueTexts((prev) => {
                if (prev.length === matched.length && prev.every((line, idx) => line === matched[idx])) {
                    return prev;
                }
                return matched;
            });
        };

        updateActiveCues();
        video.addEventListener('timeupdate', updateActiveCues);
        video.addEventListener('seeked', updateActiveCues);
        video.addEventListener('playing', updateActiveCues);
        return () => {
            video.removeEventListener('timeupdate', updateActiveCues);
            video.removeEventListener('seeked', updateActiveCues);
            video.removeEventListener('playing', updateActiveCues);
        };
    }, [activeSubtitleCues, hasSubtitles, subtitlesEnabled, videoRef]);

    useEffect(() => {
        if (initialDuration && initialDuration > 0) {
            setDuration((prev) => (prev > 0 ? prev : initialDuration));
        }
    }, [initialDuration]);

    const isMobile = Boolean(pageLayout || isMobileShell());
    const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const currentStream = streams[selectedStreamIndex];
    const isOfflineStream = Boolean(
        currentStream?.provider === 'Offline Storage' ||
        currentStream?.url?.startsWith('blob:') ||
        currentStream?.url?.includes('/api/scraper/local-file')
    );
    const currentQuality = currentStream ? getMappedQuality(currentStream.quality) : 'Auto';
    const hasDub = availableAudios.includes('dub');
    const canToggleAudio = selectedAudio === 'dub' || hasDub;
    const adjacentHandler = hasNextEpisode ? onNextEpisode : onPrevEpisode;
    const AdjacentIcon = hasNextEpisode ? SkipForward : SkipBack;

    const setVideoPlaybackSpeed = (speed: number) => {
        if (videoRef.current) {
            videoRef.current.playbackRate = speed;
        }
        setPlaybackSpeed(speed);
        setSettingsView('main');
    };

    const handleQualitySelect = (quality: string) => {
        const handledByHls = onHlsQualitySelect?.(quality);
        if (handledByHls) {
            setSelectedHlsQuality(quality);
            if (quality === 'Auto') {
                onSetAutoQuality();
            }
        } else if (quality === 'Auto') {
            onSetAutoQuality();
            setSelectedHlsQuality('Auto');
        } else {
            const index = streams.findIndex(
                (stream) => getMappedQuality(stream.quality).toLowerCase() === quality.toLowerCase()
            );
            if (index >= 0) {
                onQualityChange(index);
            }
            setSelectedHlsQuality(quality);
        }
        setSettingsView('main');
    };

    const introSkip = skipTimestamps.find((ts) => ts.skipType === 'intro');
    const outroSkip = skipTimestamps.find((ts) => ts.skipType === 'outro');

    const [hoverProgress, setHoverProgress] = useState<{ x: number; time: number } | null>(null);
    const getMediaDuration = useCallback((video: HTMLVideoElement | null | undefined) => {
        if (!video) return 0;
        const directDuration = Number(video.duration);
        if (Number.isFinite(directDuration) && directDuration > 0) return directDuration;

        try {
            const seekable = video.seekable;
            if (seekable && seekable.length > 0) {
                const end = Number(seekable.end(seekable.length - 1));
                return Number.isFinite(end) && end > 0 ? end : 0;
            }
        } catch {
            return 0;
        }

        return 0;
    }, []);

    const handleProgressHover = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const activeDuration = getMediaDuration(videoRef.current) || duration;
        const time = x * activeDuration;
        setHoverProgress({ x, time });
    }, [duration, getMediaDuration, videoRef]);

    const handleProgressLeave = useCallback(() => {
        setHoverProgress(null);
    }, []);

    const formatTime = (timeInSeconds: number) => {
        if (isNaN(timeInSeconds)) return '0:00';
        const hours = Math.floor(timeInSeconds / 3600);
        const minutes = Math.floor((timeInSeconds % 3600) / 60);
        const seconds = Math.floor(timeInSeconds % 60);

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const getSkipRangeStyle = useCallback((skip: SkipTimestamp) => {
        if (!duration || !Number.isFinite(duration)) return null;

        const startPercent = Math.max(0, Math.min(100, (skip.start / duration) * 100));
        const endPercent = Math.max(startPercent, Math.min(100, (skip.end / duration) * 100));

        return {
            left: `${startPercent}%`,
            width: `${Math.max(0.5, endPercent - startPercent)}%`,
        };
    }, [duration]);

    const handleMouseMove = useCallback(() => {
        if (isFastForwardingRef.current) return;
        setShowControls(true);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);

        controlsTimeoutRef.current = setTimeout(() => {
            if (pageLayout || isPlaying) {
                setShowControls(false);
                setShowSettings(false);
                setSettingsView('main');
            }
        }, pageLayout ? 5000 : 3000);
    }, [isPlaying, pageLayout]);

    const handleMouseLeave = useCallback(() => {
        if (isPlaying) {
            setShowControls(false);
            setShowSettings(false);
            setSettingsView('main');
        }
    }, [isPlaying]);

    const handlePlayerSurfaceTap = useCallback(() => {
        if (showControls) {
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
            setShowControls(false);
            setShowSettings(false);
            setShowSubtitleMenu(false);
            setShowServerMenu(false);
            setSettingsView('main');
            return;
        }
        handleMouseMove();
    }, [handleMouseMove, showControls]);

    const stopHoldGesture = useCallback(() => {
        if (holdTimerRef.current) {
            clearTimeout(holdTimerRef.current);
            holdTimerRef.current = null;
        }
        const video = videoRef.current;
        if (video && holdActivatedRef.current) {
            video.playbackRate = previousPlaybackRateRef.current;
        }
        holdActivatedRef.current = false;
        isFastForwardingRef.current = false;
        setIsFastForwarding(false);
    }, [videoRef]);

    const startFastForwardGesture = useCallback(() => {
        stopHoldGesture();
        holdActivatedRef.current = false;
        holdTimerRef.current = setTimeout(() => {
            const video = videoRef.current;
            if (!video) return;
            holdActivatedRef.current = true;
            isFastForwardingRef.current = true;
            setIsFastForwarding(true);
            setShowControls(false);
            setShowSettings(false);
            setShowSubtitleMenu(false);
            previousPlaybackRateRef.current = video.playbackRate || playbackSpeed || 1;
            video.playbackRate = 2;
        }, 350);
    }, [playbackSpeed, stopHoldGesture, videoRef]);

    useEffect(() => () => stopHoldGesture(), [stopHoldGesture]);

    useEffect(() => {
        if (!pageLayout) return;
        document.body.classList.toggle('yorumi-player-controls-hidden', !showControls);
        return () => document.body.classList.remove('yorumi-player-controls-hidden');
    }, [pageLayout, showControls]);

    const toggleVideoPlayback = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;

        if (video.paused) {
            video.play().catch(() => undefined);
        } else {
            video.pause();
        }
    }, [videoRef]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const updateDuration = () => {
            const nextDuration = getMediaDuration(video);
            if (nextDuration > 0) setDuration(nextDuration);
        };
        const updateTime = () => {
            setCurrentTime(Number.isFinite(video.currentTime) ? video.currentTime : 0);
            updateDuration();
        };

        video.volume = volume;
        video.muted = isMuted;
        video.playbackRate = playbackSpeed;

        const updatePlayState = () => {
            const isVideoPlaying = !video.paused;
            setIsPlaying(isVideoPlaying);
            setCenterAction({ type: isVideoPlaying ? 'pause' : 'play', id: Date.now() });
        };

        const updateVolume = () => {
            setVolume(video.volume);
            setIsMuted(video.muted);
        };

        video.addEventListener('timeupdate', updateTime);
        video.addEventListener('loadedmetadata', updateDuration);
        video.addEventListener('durationchange', updateDuration);
        video.addEventListener('loadeddata', updateDuration);
        video.addEventListener('canplay', updateDuration);
        video.addEventListener('progress', updateDuration);
        video.addEventListener('play', updatePlayState);
        video.addEventListener('pause', updatePlayState);
        video.addEventListener('volumechange', updateVolume);
        updateTime();
        return () => {
            video.removeEventListener('timeupdate', updateTime);
            video.removeEventListener('loadedmetadata', updateDuration);
            video.removeEventListener('durationchange', updateDuration);
            video.removeEventListener('loadeddata', updateDuration);
            video.removeEventListener('canplay', updateDuration);
            video.removeEventListener('progress', updateDuration);
            video.removeEventListener('play', updatePlayState);
            video.removeEventListener('pause', updatePlayState);
            video.removeEventListener('volumechange', updateVolume);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videoRef, playbackSpeed, streamKey]);

    const togglePlay = (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        toggleVideoPlayback();
    };

    const toggleMute = () => {
        if (videoRef.current) {
            videoRef.current.muted = !videoRef.current.muted;
        }
    };

    const exitNativeFullscreen = useCallback(async () => {
        if (nativeFullscreenTransitionRef.current) return;
        nativeFullscreenTransitionRef.current = true;
        try {
            setShowEpisodesDrawer(false);
            setShowServerMenu(false);

            if (document.fullscreenElement) {
                await document.exitFullscreen().catch(() => undefined);
            }
            await exitLandscapePlayerMode().catch(() => undefined);
            await ScreenOrientation.unlock().catch(() => undefined);
            await exitImmersiveMode().catch(() => undefined);
            await waitForViewportOrientation('portrait');
            document.body.classList.remove('yorumi-player-landscape');
            setIsFullscreen(false);
            window.dispatchEvent(new Event('resize'));
        } finally {
            nativeFullscreenTransitionRef.current = false;
        }
    }, []);

    const enterNativeFullscreen = useCallback(async () => {
        if (nativeFullscreenTransitionRef.current) return;
        nativeFullscreenTransitionRef.current = true;
        try {
            setIsFullscreen(true);
            document.body.classList.add('yorumi-player-landscape');
            await enterLandscapePlayerMode().catch(() => undefined);
            await enterImmersiveMode().catch(() => undefined);
        } finally {
            nativeFullscreenTransitionRef.current = false;
        }
    }, []);

    useEffect(() => {
        if (isMobile) return;
        const handleFullscreenChange = () => {
            setIsFullscreen(Boolean(document.fullscreenElement));
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, [isMobile]);

    const toggleFullscreen = async () => {
        const playerContainer = videoRef.current?.closest('.watch-player-shell');
        if (!playerContainer) return;

        if (isMobile) {
            if (isFullscreen) {
                await exitNativeFullscreen();
            } else {
                await enterNativeFullscreen();
            }
            return;
        }

        if (!document.fullscreenElement) {
            try {
                await playerContainer.requestFullscreen({ navigationUI: 'hide' });
                if (pageLayout) {
                    await ScreenOrientation.lock({ orientation: 'landscape' });
                }
            } catch (error) {
                console.error(error);
            }
        } else {
            await document.exitFullscreen().catch(console.error);
        }
    };

    useEffect(() => () => {
        if (isMobile) {
            document.body.classList.remove('yorumi-player-landscape');
            exitLandscapePlayerMode().catch(() => undefined);
            ScreenOrientation.unlock().catch(() => undefined);
            exitImmersiveMode().catch(() => undefined);
        }
    }, [isMobile]);

    const handleCast = async () => {
        const video = videoRef.current as (HTMLVideoElement & {
            remote?: { state?: string; prompt?: () => Promise<void> };
            webkitShowPlaybackTargetPicker?: () => void;
        }) | null;
        if (!video) return;

        try {
            if (video.remote?.prompt) {
                await video.remote.prompt();
            } else if (video.webkitShowPlaybackTargetPicker) {
                video.webkitShowPlaybackTargetPicker();
            }
        } catch (error) {
            console.error('Failed to cast:', error);
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = Number(e.target.value);
        if (videoRef.current) {
            videoRef.current.currentTime = time;
            setCurrentTime(time);
            const nextDuration = getMediaDuration(videoRef.current);
            if (nextDuration > 0) setDuration(nextDuration);
        }
    };

    const seekBy = (seconds: number) => {
        const video = videoRef.current;
        if (!video) return;
        const durationSeconds = getMediaDuration(video);
        const nextTime = Math.max(0, Math.min(durationSeconds || Number.MAX_SAFE_INTEGER, video.currentTime + seconds));
        video.currentTime = nextTime;
        setCurrentTime(nextTime);
        handleMouseMove();
    };

    const activeDuration = getMediaDuration(videoRef.current) || duration;
    const progressPercentage = activeDuration ? Math.max(0, Math.min(100, (currentTime / activeDuration) * 100)) : 0;

    const renderHoverPreview = () => {
        if (!hoverProgress) return null;

        return (
            <div
                className="absolute bottom-full left-0 z-20 mb-2 -translate-x-1/2 pointer-events-none"
                style={{ left: `${hoverProgress.x * 100}%` }}
            >
                <div className="rounded bg-white px-2 py-1 text-xs font-medium leading-none text-slate-600 shadow-lg">
                    {formatTime(hoverProgress.time)}
                </div>
                <div className="mx-auto -mt-1 h-2 w-2 rotate-45 bg-white shadow-lg" />
            </div>
        );
    };

    useEffect(() => {
        const playerShell = videoRef.current?.closest('.watch-player-shell') as HTMLElement | null;
        if (!playerShell) return;
        playerShell.tabIndex = 0;

        if (!pageLayout) {
            playerShell.addEventListener('mousemove', handleMouseMove);
            playerShell.addEventListener('mouseleave', handleMouseLeave);
        }
        const focusPlayer = () => playerShell.focus({ preventScroll: true });
        const handleGesturePointerDown = (event: PointerEvent) => {
            if (!pageLayout || isControlsLocked || !event.isPrimary || event.button !== 0) return;
            const target = event.target as HTMLElement | null;
            if (target?.closest('button, input, select, [data-player-interactive="true"]')) return;
            startFastForwardGesture();
        };
        const handleGesturePointerUp = (event: PointerEvent) => {
            if (!pageLayout || !event.isPrimary) return;
            const wasFastForwarding = holdActivatedRef.current;
            stopHoldGesture();
            if (wasFastForwarding) {
                suppressNextClickRef.current = true;
                event.preventDefault();
                event.stopPropagation();
            }
        };
        const handleGestureClick = (event: MouseEvent) => {
            if (!suppressNextClickRef.current) return;
            suppressNextClickRef.current = false;
            event.preventDefault();
            event.stopPropagation();
        };
        const handleGesturePointerCancel = () => {
            if (pageLayout) stopHoldGesture();
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (isControlsLocked) return;
            const isPlaybackKey = event.code === 'Space' || event.code === 'ArrowLeft' || event.code === 'ArrowRight';
            if (!isPlaybackKey) return;

            const target = event.target as HTMLElement | null;
            const targetTag = target?.tagName?.toLowerCase();
            const isEditableTarget = Boolean(
                target?.isContentEditable ||
                targetTag === 'input' ||
                targetTag === 'textarea' ||
                targetTag === 'select' ||
                targetTag === 'button'
            );
            const activeElement = document.activeElement;
            const playerIsActive = Boolean(
                document.fullscreenElement?.contains(playerShell) ||
                (activeElement && playerShell.contains(activeElement))
            );

            if (isEditableTarget || !playerIsActive) return;
            event.preventDefault();
            if (event.code === 'Space') {
                toggleVideoPlayback();
            } else if (videoRef.current) {
                const direction = event.code === 'ArrowRight' ? 1 : -1;
                const nextTime = Math.max(0, Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + (direction * SEEK_SECONDS)));
                videoRef.current.currentTime = nextTime;
                setCurrentTime(nextTime);
            }
            handleMouseMove();
        };
        playerShell.addEventListener('pointerdown', focusPlayer);
        playerShell.addEventListener('pointerdown', handleGesturePointerDown, true);
        playerShell.addEventListener('pointerup', handleGesturePointerUp, true);
        playerShell.addEventListener('pointercancel', handleGesturePointerCancel, true);
        playerShell.addEventListener('click', handleGestureClick, true);
        playerShell.addEventListener('keydown', handleKeyDown);

        const initialTimer = setTimeout(handleMouseMove, 0);

        return () => {
            clearTimeout(initialTimer);
            if (!pageLayout) {
                playerShell.removeEventListener('mousemove', handleMouseMove);
                playerShell.removeEventListener('mouseleave', handleMouseLeave);
            }
            playerShell.removeEventListener('pointerdown', focusPlayer);
            playerShell.removeEventListener('pointerdown', handleGesturePointerDown, true);
            playerShell.removeEventListener('pointerup', handleGesturePointerUp, true);
            playerShell.removeEventListener('pointercancel', handleGesturePointerCancel, true);
            playerShell.removeEventListener('click', handleGestureClick, true);
            playerShell.removeEventListener('keydown', handleKeyDown);
        };
    }, [videoRef, handleMouseMove, handleMouseLeave, isControlsLocked, pageLayout, startFastForwardGesture, stopHoldGesture, toggleVideoPlayback]);

    useEffect(() => {
        if (centerAction) {
            const timer = setTimeout(() => {
                setCenterAction(null);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [centerAction]);

    if (mode === 'mini') {
        return (
            <>
                <style>{`
                    @keyframes animetsu-center-pop {
                        0% { opacity: 0; transform: translate(-50%, -50%) scale(0.62); }
                        14% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                        52% { opacity: 0.82; transform: translate(-50%, -50%) scale(1.18); }
                        100% { opacity: 0; transform: translate(-50%, -50%) scale(1.72); }
                    }
                    .animate-animetsu-center-pop {
                        animation: animetsu-center-pop 520ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
                    }
                `}</style>

                {centerAction && (
                    <div
                        key={centerAction.id}
                        className="watch-center-pop absolute top-1/2 left-1/2 z-[60] flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 shadow-2xl pointer-events-none animate-animetsu-center-pop"
                    >
                        {centerAction.type === 'play' ? (
                            <Play className="h-6 w-6 fill-current text-white ml-0.5" />
                        ) : (
                            <Pause className="h-6 w-6 fill-current text-white" />
                        )}
                    </div>
                )}

                {activeCueTexts.length > 0 && (
                    <div className="pointer-events-none absolute inset-x-2 bottom-10 z-[65] flex flex-col items-center gap-0.5 text-center">
                        {activeCueTexts.map((cueText, idx) => (
                            <span
                                key={`${idx}-${cueText}`}
                                className="max-w-full whitespace-pre-line rounded bg-black/75 px-2 py-0.5 text-[11px] font-medium leading-snug text-white shadow"
                            >
                                {cueText}
                            </span>
                        ))}
                    </div>
                )}

                <div className={`absolute inset-0 z-[70] transition-opacity duration-200 ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0'} group-hover:opacity-100`}>
                    <div className="absolute inset-x-0 top-0 flex items-start justify-between p-2 bg-gradient-to-b from-black/55 to-transparent">
                        <button
                            onClick={(event) => {
                                event.stopPropagation();
                                onMiniExpand?.();
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white shadow-lg backdrop-blur-md transition-colors hover:bg-white/20"
                            title="Back to player"
                        >
                            <Maximize className="h-4 w-4" />
                        </button>
                        <button
                            onClick={(event) => {
                                event.stopPropagation();
                                onMiniClose?.();
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white shadow-lg backdrop-blur-md transition-colors hover:bg-white/20"
                            title="Close"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-2 bg-gradient-to-t from-black/70 via-black/40 to-transparent">
                        <div
                            className="relative h-5 w-full cursor-pointer group/progress"
                            onMouseMove={handleProgressHover}
                            onMouseLeave={handleProgressLeave}
                        >
                            <div className="absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 overflow-hidden rounded-full bg-white/25 shadow-inner">
                                {introSkip && (
                                    <div
                                        className="absolute top-0 h-full rounded-full bg-emerald-400/35"
                                        style={getSkipRangeStyle(introSkip) || undefined}
                                    />
                                )}
                                {outroSkip && (
                                    <div
                                        className="absolute top-0 h-full rounded-full bg-amber-400/35"
                                        style={getSkipRangeStyle(outroSkip) || undefined}
                                    />
                                )}
                                <div
                                    className="absolute left-0 top-0 h-full rounded-full bg-white"
                                    style={{ width: `${progressPercentage}%` }}
                                />
                            </div>
                            <div
                                className="absolute top-1/2 z-20 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow"
                                style={{ left: `${progressPercentage}%` }}
                            />
                            <input
                                type="range"
                                min={0}
                                max={duration || 100}
                                value={currentTime}
                                onChange={handleSeek}
                                className="absolute inset-0 z-30 h-full w-full cursor-pointer opacity-0 outline-none focus:outline-none focus:ring-0"
                            />
                            {renderHoverPreview()}
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={togglePlay}
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/50 text-white shadow-lg backdrop-blur-md transition-colors hover:bg-white/20"
                            >
                                {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current ml-0.5" />}
                            </button>
                            <div className="rounded-full bg-black/50 px-3 py-1.5 text-[11px] font-semibold text-white shadow-lg backdrop-blur-md">
                                {formatTime(currentTime)} / {formatTime(duration)}
                            </div>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    const controlsVisible = showControls || (!isMobile && !isPlaying);

    return (
        <>
            <style>{`
                @keyframes animetsu-center-pop {
                    0% { opacity: 0; transform: translate(-50%, -50%) scale(0.62); }
                    14% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                    52% { opacity: 0.82; transform: translate(-50%, -50%) scale(1.18); }
                    100% { opacity: 0; transform: translate(-50%, -50%) scale(1.72); }
                }
                .animate-animetsu-center-pop {
                    animation: animetsu-center-pop 520ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
            `}</style>

            {centerAction && !isMobile && !controlsVisible && (
                <div
                    key={centerAction.id}
                    className="watch-center-pop absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-[60] flex h-16 w-16 items-center justify-center rounded-full bg-black/60 shadow-2xl animate-animetsu-center-pop sm:h-[72px] sm:w-[72px]"
                >
                    {centerAction.type === 'play' ? (
                        <Play className="w-8 h-8 text-white fill-current ml-1 sm:h-9 sm:w-9" />
                    ) : (
                        <Pause className="w-8 h-8 text-white fill-current sm:h-9 sm:w-9" />
                    )}
                </div>
            )}

            <div
                className="absolute inset-x-0 top-0 z-[60] touch-manipulation bg-transparent"
                style={{ bottom: 0 }}
                onClick={isMobile ? handlePlayerSurfaceTap : togglePlay}
                onDoubleClick={!isMobile ? () => void toggleFullscreen() : undefined}
                onContextMenu={(event) => event.preventDefault()}
                aria-hidden="true"
            />

            {isFastForwarding && (
                <div className="pointer-events-none absolute left-1/2 top-4 z-[100] flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/10 bg-black/75 px-4 py-2 text-sm font-bold text-white shadow-xl backdrop-blur-sm">
                    <span>2x</span>
                    <FastForward className="h-4 w-4 fill-current" strokeWidth={2.5} />
                </div>
            )}

            {activeCueTexts.length > 0 && (
                <div
                    className={`pointer-events-none absolute inset-x-4 z-[65] flex flex-col items-center gap-1 text-center transition-[bottom] duration-200 sm:inset-x-10 ${
                        controlsVisible ? 'bottom-16 sm:bottom-20' : 'bottom-5 sm:bottom-8'
                    }`}
                >
                    {activeCueTexts.map((cueText, idx) => (
                        <span
                            key={`${idx}-${cueText}`}
                            className={`max-w-[90%] whitespace-pre-line rounded-md bg-black/75 px-3 py-1 font-semibold leading-snug text-white shadow-[0_2px_8px_rgba(0,0,0,0.85)] ${
                                isFullscreen ? 'text-lg sm:text-2xl' : 'text-sm sm:text-lg'
                            }`}
                            style={{ textShadow: '0 1px 3px rgba(0,0,0,0.95)' }}
                        >
                            {cueText}
                        </span>
                    ))}
                </div>
            )}

            {(showSettings || showSubtitleMenu || showServerMenu) && (
                <div
                    className="absolute inset-0 z-[79] pointer-events-auto"
                    data-player-interactive="true"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                        event.stopPropagation();
                        setShowSettings(false);
                        setShowSubtitleMenu(false);
                        setShowServerMenu(false);
                        setSettingsView('main');
                    }}
                    aria-hidden="true"
                />
            )}

            {/* Unified Fullscreen-style Player Overlay (Mobile + Desktop) */}
            <div
                className={`pointer-events-auto absolute inset-0 z-[80] ${isFastForwarding ? 'pointer-events-none opacity-0' : `transition-opacity duration-300 ${controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0'}`}`}
                onClick={(event) => {
                    if (event.target === event.currentTarget) {
                        if (isMobile) handlePlayerSurfaceTap();
                        else togglePlay();
                    }
                }}
                onDoubleClick={(event) => {
                    if (!isMobile && event.target === event.currentTarget) {
                        void toggleFullscreen();
                    }
                }}
            >
                {/* Top Row: Back button + Title + Cast & Lock */}
                <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between bg-gradient-to-b from-black/70 via-black/30 to-transparent p-3 sm:p-5 pointer-events-none">
                    <div className="pointer-events-auto flex items-start gap-2.5">
                        {(isMobile || isFullscreen || onClose) && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (isFullscreen) {
                                        void toggleFullscreen();
                                    } else if (onClose) {
                                        onClose();
                                    }
                                }}
                                className="grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white drop-shadow hover:bg-black/70 active:scale-90 transition-all cursor-pointer"
                                aria-label="Back"
                            >
                                <ChevronLeft className="h-6 w-6" />
                            </button>
                        )}

                        {(isFullscreen || !isMobile) && (animeTitle || episodeNumber) && (
                            <div className="flex flex-col ml-1 drop-shadow select-none">
                                <span className="text-xs font-semibold text-white/70">
                                    Season {seasonNumber || 1} - E{episodeNumber || 1}
                                </span>
                                <span className="text-base sm:text-lg font-black text-white leading-tight">
                                    {animeTitle || ''}
                                </span>
                                {episodeTitle && (
                                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-white/70">
                                        <span>{episodeTitle}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="pointer-events-auto flex items-center gap-2">
                        {(isFullscreen || !isMobile) && (
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); void handleCast(); }}
                                className="grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white drop-shadow hover:bg-black/70 active:scale-90 transition-all cursor-pointer"
                                aria-label="Cast"
                                title="Cast"
                            >
                                <Cast className="h-5 w-5" />
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsControlsLocked((locked) => !locked);
                                handleMouseMove();
                            }}
                            className="grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white drop-shadow hover:bg-black/70 active:scale-90 transition-all cursor-pointer"
                            aria-label={isControlsLocked ? 'Unlock player controls' : 'Lock player controls'}
                        >
                            {isControlsLocked ? <Lock className="h-5 w-5" /> : <Unlock className="h-5 w-5" />}
                        </button>
                    </div>
                </div>

                {/* Center Playback Controls */}
                {!isControlsLocked && (
                    <div className="absolute inset-0 flex items-center justify-center gap-7 sm:gap-10 pointer-events-none">
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); seekBy(-SEEK_SECONDS); }}
                            className="pointer-events-auto grid h-12 w-12 sm:h-14 sm:w-14 place-items-center rounded-full bg-black/45 text-white drop-shadow hover:bg-black/65 active:scale-90 transition-all cursor-pointer"
                            aria-label={`Back ${SEEK_SECONDS} seconds`}
                        >
                            <SeekIcon direction="back" />
                        </button>
                        <button
                            type="button"
                            onClick={togglePlay}
                            className="pointer-events-auto grid h-16 w-16 sm:h-[72px] sm:w-[72px] place-items-center rounded-full bg-black/60 text-white drop-shadow-xl hover:bg-black/75 active:scale-95 transition-all cursor-pointer"
                            aria-label={isPlaying ? 'Pause' : 'Play'}
                        >
                            {isPlaying ? <Pause className="h-8 w-8 sm:h-9 sm:w-9 fill-current" /> : <Play className="ml-1 h-8 w-8 sm:h-9 sm:w-9 fill-current" />}
                        </button>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); seekBy(SEEK_SECONDS); }}
                            className="pointer-events-auto grid h-12 w-12 sm:h-14 sm:w-14 place-items-center rounded-full bg-black/45 text-white drop-shadow hover:bg-black/65 active:scale-90 transition-all cursor-pointer"
                            aria-label={`Forward ${SEEK_SECONDS} seconds`}
                        >
                            <SeekIcon direction="forward" />
                        </button>
                    </div>
                )}

                {/* Skip Intro Button */}
                {introSkip && currentTime >= introSkip.start && currentTime < introSkip.end && (
                    <div className="absolute right-4 sm:right-6 bottom-16 sm:bottom-20 z-20 pointer-events-auto">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (videoRef.current) {
                                    videoRef.current.currentTime = introSkip.end + 0.1;
                                    setCurrentTime(introSkip.end + 0.1);
                                }
                            }}
                            className="flex items-center gap-1.5 rounded-full bg-black/70 border border-white/20 px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-xl backdrop-blur-md hover:bg-black/85 active:scale-95 transition-all cursor-pointer"
                        >
                            <span>Skip intro</span>
                            <SkipForward className="h-3.5 w-3.5 fill-current" />
                        </button>
                    </div>
                )}
            </div>

            {/* Bottom Controls Bar (Timeline above buttons in fullscreen & desktop) */}
            <div
                className={`pointer-events-auto absolute inset-x-0 bottom-0 z-[90] flex flex-col justify-end bg-gradient-to-t from-black/85 via-black/40 to-transparent pb-0 pt-5 px-3 sm:px-6 ${isControlsLocked || !controlsVisible || isFastForwarding ? 'opacity-0 pointer-events-none' : 'opacity-100'} transition-opacity duration-300`}
                onClick={(event) => {
                    if (event.target === event.currentTarget) handlePlayerSurfaceTap();
                }}
            >
                {!isControlsLocked && (
                    <>
                        <div className={`relative flex w-full items-center justify-between px-0.5 ${isFullscreen || !isMobile ? 'order-2 pb-3 sm:pb-4 pt-2.5' : 'order-1 pb-1'}`}>
                            {/* Left Side: Adjacent Episode + Volume (desktop) + Remaining Time */}
                            <div className="flex items-center gap-3 sm:gap-4">
                                {adjacentHandler && (
                                    <button
                                        type="button"
                                        onClick={(event) => { event.stopPropagation(); adjacentHandler(); if (isMobile) setShowControls(false); }}
                                        className="text-white drop-shadow hover:text-white/80 active:scale-90 transition-transform p-1 cursor-pointer"
                                        title={hasNextEpisode ? 'Next episode' : 'Previous episode'}
                                        aria-label={hasNextEpisode ? 'Next episode' : 'Previous episode'}
                                    >
                                        <AdjacentIcon className="h-5 w-5 fill-current" />
                                    </button>
                                )}
                                {!isMobile && (
                                    <div className="group/volume flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                                            className="text-white drop-shadow hover:text-white/80 transition-colors p-1 cursor-pointer"
                                            aria-label={isMuted || volume === 0 ? 'Unmute' : 'Mute'}
                                        >
                                            {isMuted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                                        </button>
                                        <input
                                            type="range"
                                            min={0}
                                            max={1}
                                            step={0.01}
                                            value={isMuted ? 0 : volume}
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={(e) => {
                                                const val = parseFloat(e.target.value);
                                                if (videoRef.current) {
                                                    videoRef.current.volume = val;
                                                    videoRef.current.muted = val === 0;
                                                }
                                            }}
                                            className="w-0 opacity-0 group-hover/volume:w-20 group-hover/volume:opacity-100 transition-all duration-200 h-1 cursor-pointer appearance-none rounded-full outline-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                                            style={{ background: `linear-gradient(to right, white ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.3) ${(isMuted ? 0 : volume) * 100}%)` }}
                                        />
                                    </div>
                                )}
                                <span className="text-sm font-semibold tracking-tight text-white drop-shadow select-none">
                                    -{formatTime(Math.max(0, (activeDuration || 0) - (currentTime || 0)))}
                                </span>
                            </div>

                            {/* Right Side: Wide, Server, Episodes, Subtitles, Settings, Fullscreen */}
                            <div className="relative flex items-center gap-3 sm:gap-4">
                                {/* Settings Popover */}
                                {showSettings && (
                                    <div
                                        className="yorumi-player-popover pointer-events-auto absolute bottom-full right-0 z-[200] mb-3 w-48 rounded-xl bg-[#1A1A1A]/95 p-1 shadow-2xl backdrop-blur-xl"
                                        data-player-interactive="true"
                                        onClick={(event) => event.stopPropagation()}
                                        onPointerDown={(event) => event.stopPropagation()}
                                        onMouseDown={(event) => event.stopPropagation()}
                                        onTouchStart={(event) => event.stopPropagation()}
                                    >
                                        {settingsView !== 'main' && (
                                            <button
                                                onClick={() => setSettingsView('main')}
                                                className="mb-1.5 flex w-full items-center gap-2 border-b border-white/5 px-2 pb-1.5 pt-1 text-left text-xs font-semibold text-white cursor-pointer"
                                            >
                                                <ChevronLeft className="h-3.5 w-3.5" />
                                                {settingsView === 'quality' ? 'Quality' : 'Playback speed'}
                                            </button>
                                        )}

                                        {settingsView === 'main' && (
                                            <div className="flex flex-col gap-0.5">
                                                <button
                                                    onClick={() => {
                                                        if (canToggleAudio) {
                                                            onAudioChange(selectedAudio === 'dub' ? 'sub' : 'dub');
                                                            setShowSettings(false);
                                                        }
                                                    }}
                                                    disabled={!canToggleAudio}
                                                    className="flex items-center justify-between w-full p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
                                                >
                                                    <div className="flex items-center gap-2 text-white">
                                                        <Mic className="w-4 h-4" />
                                                        <span className="text-xs font-medium">Dub</span>
                                                    </div>
                                                    <div className={`w-8 h-4 rounded-full relative shadow-inner transition-colors ${selectedAudio === 'dub' ? 'bg-white' : 'bg-white/20'}`}>
                                                        <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full transition-transform duration-200 ${selectedAudio === 'dub' ? 'bg-black translate-x-4' : 'bg-white translate-x-0'}`} />
                                                    </div>
                                                </button>
                                                <button
                                                    onClick={() => onAutoNextChange?.(!autoNextEnabled)}
                                                    disabled={!onAutoNextChange || !hasNextEpisode}
                                                    className="flex items-center justify-between w-full p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
                                                >
                                                    <div className="flex items-center gap-2 text-white">
                                                        <SkipForward className="w-4 h-4" />
                                                        <span className="text-xs font-medium">Auto next</span>
                                                    </div>
                                                    <div className={`w-8 h-4 rounded-full relative shadow-inner transition-colors ${autoNextEnabled && hasNextEpisode ? 'bg-white' : 'bg-white/20'}`}>
                                                        <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full transition-transform duration-200 ${autoNextEnabled && hasNextEpisode ? 'bg-black translate-x-4' : 'bg-white translate-x-0'}`} />
                                                    </div>
                                                </button>
                                                <button
                                                    onClick={() => onAutoSkipChange?.(!autoSkipEnabled)}
                                                    disabled={!onAutoSkipChange}
                                                    className="flex items-center justify-between w-full p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
                                                >
                                                    <div className="flex items-center gap-2 text-white">
                                                        <RotateCw className="h-4 w-4 shrink-0" strokeWidth={2} />
                                                        <span className="text-xs font-medium">Auto Skip</span>
                                                    </div>
                                                    <div className={`w-8 h-4 rounded-full relative shadow-inner transition-colors ${autoSkipEnabled ? 'bg-white' : 'bg-white/20'}`}>
                                                        <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full transition-transform duration-200 ${autoSkipEnabled ? 'bg-black translate-x-4' : 'bg-white translate-x-0'}`} />
                                                    </div>
                                                </button>

                                                {skipTimestampsLoading && (
                                                    <div className="px-2 py-1 text-[11px] text-white/60 flex items-center gap-1.5">
                                                        <span className="animate-pulse">Loading skip times...</span>
                                                    </div>
                                                )}
                                                <button
                                                    onClick={() => setSettingsView('speed')}
                                                    className="flex items-center justify-between w-full p-2 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                                                >
                                                    <div className="flex items-center gap-2 text-white">
                                                        <Gauge className="w-4 h-4" />
                                                        <span className="text-xs font-medium">Playback speed</span>
                                                    </div>
                                                    <span className="text-xs text-white/70">{playbackSpeed}x</span>
                                                </button>
                                                <button
                                                    onClick={() => setSettingsView('quality')}
                                                    className="flex items-center justify-between w-full p-2 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                                                >
                                                    <div className="flex items-center gap-2 text-white">
                                                        <Video className="w-4 h-4" />
                                                        <span className="text-xs font-medium">Quality</span>
                                                    </div>
                                                    <span className="text-xs text-white/70">{isAutoQuality ? `Auto(${currentQuality})` : currentQuality}</span>
                                                </button>
                                            </div>
                                        )}

                                        {settingsView === 'speed' && (
                                            <div className="flex flex-col gap-0.5">
                                                {PLAYBACK_SPEEDS.map((speed) => (
                                                    <button
                                                        key={speed}
                                                        onClick={() => setVideoPlaybackSpeed(speed)}
                                                        className={`flex w-full items-center justify-between rounded-lg p-2 text-left transition-colors cursor-pointer ${playbackSpeed === speed ? 'bg-white/15 text-white' : 'text-white/80 hover:bg-white/10'}`}
                                                    >
                                                        <span className="text-xs font-medium">{speed}x</span>
                                                        {playbackSpeed === speed ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {settingsView === 'quality' && (
                                            <div className="flex flex-col gap-0.5">
                                                {QUALITY_OPTIONS.map((quality) => {
                                                    const isAutoOption = quality === 'Auto';
                                                    const isSelected = isAutoOption
                                                        ? (isAutoQuality && selectedHlsQuality === 'Auto')
                                                        : (selectedHlsQuality.toLowerCase() === quality.toLowerCase() || (!isAutoQuality && currentQuality.toLowerCase() === quality.toLowerCase()));

                                                    return (
                                                        <button
                                                            key={quality}
                                                            onClick={() => handleQualitySelect(quality)}
                                                            className={`flex w-full items-center justify-between rounded-lg p-2 text-left transition-colors cursor-pointer ${isSelected ? 'bg-white/15 text-white' : 'text-white/80 hover:bg-white/10'}`}
                                                        >
                                                            <span className="text-xs font-medium">{quality}</span>
                                                            {isSelected ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}

                                    </div>
                                )}

                                {/* Dedicated Server selector button */}
                                {(isFullscreen || !isMobile) && !isOfflineStream && serverOptions.length > 0 && (
                                    <>
                                        {showServerMenu && (
                                            <div
                                                className="yorumi-player-popover pointer-events-auto absolute bottom-full right-24 z-50 mb-3 max-h-64 w-44 overflow-y-auto rounded-xl bg-[#1A1A1A]/95 p-1 shadow-2xl backdrop-blur-xl"
                                                onClick={(event) => event.stopPropagation()}
                                                onPointerDown={(event) => event.stopPropagation()}
                                            >
                                                <div className="border-b border-white/10 px-2.5 py-1.5 text-xs font-semibold text-white">Servers</div>
                                                <div className="flex flex-col gap-0.5 mt-1">
                                                    {serverOptions.map((server) => (
                                                        <button
                                                            key={server.key}
                                                            onClick={() => {
                                                                onServerChange(server.key);
                                                                onSetAutoQuality();
                                                                setShowServerMenu(false);
                                                            }}
                                                            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors cursor-pointer ${selectedServer === server.key ? 'bg-white/15 text-white' : 'text-white/80 hover:bg-white/10'}`}
                                                        >
                                                            <span className="font-medium">{server.label}</span>
                                                            {selectedServer === server.key ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5 text-white/40" />}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setShowServerMenu((v) => !v);
                                                setShowSettings(false);
                                                setShowSubtitleMenu(false);
                                                setShowEpisodesDrawer(false);
                                            }}
                                            className="text-white drop-shadow hover:text-white/80 active:scale-90 transition-transform p-1 cursor-pointer"
                                            title="Servers"
                                            aria-label="Servers"
                                        >
                                            <Server className="h-5 w-5" />
                                        </button>
                                    </>
                                )}

                                {/* Episodes button (on desktop only in fullscreen; on mobile always available) */}
                                {(isMobile ? (onShowEpisodes || (episodes && episodes.length > 0)) : (isFullscreen && episodes && episodes.length > 0)) && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if ((isFullscreen || !isMobile) && episodes && episodes.length > 0) {
                                                setShowEpisodesDrawer((v) => !v);
                                                setShowServerMenu(false);
                                                setShowSettings(false);
                                                setShowSubtitleMenu(false);
                                            } else if (onShowEpisodes) {
                                                onShowEpisodes();
                                            }
                                        }}
                                        className="text-white drop-shadow hover:text-white/80 active:scale-90 transition-transform p-1 cursor-pointer"
                                        title="Episodes"
                                        aria-label="Episodes"
                                    >
                                        <ListVideo className="h-5 w-5" />
                                    </button>
                                )}

                                {/* Subtitle button + language dropdown */}
                                {hasSubtitles && (
                                    <>
                                        {showSubtitleMenu && (
                                            <div
                                                className="yorumi-player-popover pointer-events-auto absolute bottom-full right-8 z-50 mb-3 max-h-64 w-52 overflow-y-auto rounded-lg border border-white/10 bg-[#0d0e12]/85 p-1 shadow-2xl backdrop-blur-2xl"
                                                onClick={(event) => event.stopPropagation()}
                                                onPointerDown={(event) => event.stopPropagation()}
                                            >
                                                <div className="border-b border-white/10 px-2.5 py-2 text-xs font-semibold text-white">Subtitles</div>
                                                <button
                                                    onClick={(event) => { event.stopPropagation(); selectSubtitleTrack(null); }}
                                                    type="button"
                                                    className={`mt-1 flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs transition-colors cursor-pointer ${!subtitlesEnabled ? 'bg-white/15 text-white font-medium' : 'text-white/80 hover:bg-white/10'}`}
                                                >
                                                    <span>Off</span>
                                                    {!subtitlesEnabled && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
                                                </button>
                                                {subtitleTracks.map((track, index) => {
                                                    const isSelected = subtitlesEnabled && !selectedTranslateLang && selectedSubtitleIndex === index;
                                                    return (
                                                        <button
                                                            key={`${track.url}:${index}`}
                                                            onClick={(event) => { event.stopPropagation(); selectSubtitleTrack(index); }}
                                                            type="button"
                                                            className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors cursor-pointer ${isSelected ? 'bg-white/15 text-white font-medium' : 'text-white/80 hover:bg-white/10'}`}
                                                        >
                                                            <span className="truncate">{getSubtitleLabel(track.lang)}</span>
                                                            {isSelected && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
                                                        </button>
                                                    );
                                                })}
                                                {(() => {
                                                    if (typeof navigator !== 'undefined' && !navigator.onLine) return null;
                                                    const nativeLabels = new Set(
                                                        subtitleTracks.map((t) => getSubtitleLabel(t.lang).toLowerCase())
                                                    );
                                                    const extraLangs = AUTO_TRANSLATE_LANGUAGES.filter(
                                                        (opt) => !nativeLabels.has(opt.label.toLowerCase())
                                                    );
                                                    if (extraLangs.length === 0) return null;
                                                    return (
                                                        <>
                                                            <div className="my-1 border-t border-white/10 px-2.5 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-white/45">
                                                                Auto-translate
                                                            </div>
                                                            {extraLangs.map((opt) => {
                                                                const isSelected = subtitlesEnabled && selectedTranslateLang === opt.code;
                                                                return (
                                                                    <button
                                                                        key={opt.code}
                                                                        onClick={(event) => { event.stopPropagation(); selectTranslatedSubtitle(opt.code); }}
                                                                        type="button"
                                                                        className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors cursor-pointer ${isSelected ? 'bg-white/15 text-white font-medium' : 'text-white/80 hover:bg-white/10'}`}
                                                                    >
                                                                        <span className="truncate">{opt.label}</span>
                                                                        {isSelected && (
                                                                            isTranslatingSubtitles
                                                                                ? <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                                                                : <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                                                        )}
                                                                    </button>
                                                                );
                                                            })}
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                        <button
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                setShowSettings(false);
                                                setShowServerMenu(false);
                                                setShowSubtitleMenu((visible) => !visible);
                                            }}
                                            type="button"
                                            className={`p-1 drop-shadow hover:text-white active:scale-90 transition-transform cursor-pointer ${subtitlesEnabled ? 'text-white' : 'text-white/60'}`}
                                            title="Subtitles"
                                            aria-expanded={showSubtitleMenu}
                                            aria-pressed={subtitlesEnabled}
                                        >
                                            <Captions className="h-5 w-5" />
                                        </button>
                                    </>
                                )}

                                {/* Settings button */}
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowSettings(!showSettings);
                                        setShowSubtitleMenu(false);
                                        setShowServerMenu(false);
                                        setSettingsView('main');
                                    }}
                                    className="text-white drop-shadow hover:text-white/80 active:scale-90 transition-transform p-1 cursor-pointer"
                                    title="Settings"
                                    aria-label="Settings"
                                >
                                    <Settings className="h-5 w-5" />
                                </button>

                                {/* Fullscreen button */}
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); void toggleFullscreen(); }}
                                    className="text-white drop-shadow hover:text-white/80 active:scale-90 transition-transform p-1 cursor-pointer"
                                    title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                                    aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                                >
                                    {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>

                        {/* Timeline */}
                        <div
                            className={`relative z-10 h-3 w-full cursor-pointer group/progress ${isFullscreen || !isMobile ? 'order-1' : 'order-2'} ${showSettings || showSubtitleMenu ? 'pointer-events-none' : ''}`}
                            onMouseMove={handleProgressHover}
                            onMouseLeave={handleProgressLeave}
                        >
                            <div className="absolute left-0 right-0 bottom-0.5 h-[3px] group-hover/progress:h-[5px] transition-all overflow-hidden rounded-full bg-white/25">
                                {introSkip && (
                                    <div
                                        className="absolute top-0 h-full rounded-full bg-emerald-400/40"
                                        style={getSkipRangeStyle(introSkip) || undefined}
                                    />
                                )}
                                {outroSkip && (
                                    <div
                                        className="absolute top-0 h-full rounded-full bg-amber-400/40"
                                        style={getSkipRangeStyle(outroSkip) || undefined}
                                    />
                                )}
                                <div
                                    className="absolute left-0 top-0 h-full rounded-full bg-white"
                                    style={{ width: `${progressPercentage}%` }}
                                />
                            </div>
                            <div
                                className="absolute bottom-0.5 z-20 h-2.5 w-2.5 -translate-x-1/2 translate-y-[3.5px] rounded-full bg-white shadow-md transition-transform group-hover/progress:scale-125"
                                style={{ left: `${progressPercentage}%` }}
                            />
                            <input
                                type="range"
                                min={0}
                                max={duration || 100}
                                value={currentTime}
                                onChange={handleSeek}
                                className="absolute inset-0 z-30 h-full w-full cursor-pointer opacity-0 outline-none focus:outline-none focus:ring-0"
                            />
                            {renderHoverPreview()}
                        </div>
                    </>
                )}
            </div>

            {/* Episodes Slide-over Drawer (Fullscreen & Desktop) */}
            {(isFullscreen || !isMobile) && showEpisodesDrawer && episodes && episodes.length > 0 && (
                <div
                    className="pointer-events-auto absolute inset-0 z-[120] flex justify-end bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => setShowEpisodesDrawer(false)}
                >
                    <div
                        className="flex h-full w-[360px] max-w-[90vw] flex-col bg-zinc-950/95 p-4 shadow-2xl backdrop-blur-2xl border-l border-white/10 animate-in slide-in-from-right duration-300"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex shrink-0 items-center justify-between pb-3 border-b border-white/10">
                            <div className="flex flex-col">
                                <span className="text-xs font-semibold text-white/50 truncate max-w-[240px]">
                                    {animeTitle}
                                </span>
                                <span className="text-base font-bold text-white flex items-center gap-1">
                                    Season {seasonNumber || 1}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowEpisodesDrawer(false)}
                                className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 active:scale-90 transition cursor-pointer"
                                aria-label="Close"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto pt-3 space-y-2.5 custom-scrollbar pr-1">
                            {episodes.map((episode) => {
                                const number = String(episode._tmdbAbsolute || episode.episodeNumber || 1);
                                const isActive = Number(number) === Number(episodeNumber);
                                return (
                                    <button
                                        key={episode.session || number}
                                        type="button"
                                        onClick={() => {
                                            onEpisodeSelect?.(episode);
                                            setShowEpisodesDrawer(false);
                                        }}
                                        className={`flex w-full items-start gap-3 rounded-2xl p-2.5 text-left transition-all cursor-pointer ${isActive
                                            ? 'bg-white/15 ring-1 ring-white/30'
                                            : 'bg-white/5 hover:bg-white/10 active:scale-[0.98]'
                                            }`}
                                    >
                                        <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-xl bg-zinc-900 shadow">
                                            <img
                                                src={episode.snapshot || (episode as unknown as { thumbnail?: string }).thumbnail || animeImage}
                                                alt=""
                                                className="h-full w-full object-cover"
                                                loading="lazy"
                                            />
                                            {isActive && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                                    <div className="grid h-6 w-6 place-items-center rounded-full bg-white text-black shadow-md">
                                                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex min-w-0 flex-1 flex-col justify-center">
                                            <span className="font-bold text-xs sm:text-sm text-white line-clamp-1">
                                                {episode.episodeNumber}. {episode.title || `Episode ${episode.episodeNumber}`}
                                            </span>
                                            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-white/70">
                                                {isActive && <span className="font-semibold text-white">Now playing</span>}
                                                <span>{episode.duration || '24 min'}</span>
                                                <span className="uppercase text-white/50">{selectedAudio}</span>
                                            </div>
                                            {episode.overview && (
                                                <p className="mt-1 text-[11px] text-white/50 line-clamp-2 leading-snug">
                                                    {episode.overview}
                                                </p>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

import { useEffect, useState, useRef, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, FastForward, Volume2, VolumeX, Settings, Maximize, Minimize, Mic, Gauge, Video, Monitor, ChevronLeft, CheckCircle2, Circle, X, RotateCcw, RotateCw, Captions, Lock, Unlock } from 'lucide-react';
import type { StreamServerKey } from '../../../hooks/useStreams';
import type { StreamLink, SubtitleTrack } from '../../../types/stream';
import type { SkipTimestamp } from '../../../services/skipTimestamps';
import { getMappedQuality } from '../../../utils/streamUtils';
import { isNativeMobile } from '../../../platform/runtime';
import { enterImmersiveMode, exitImmersiveMode } from '../../../platform/immersiveMode';
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
}

const PLAYBACK_SPEEDS = [0.25, 1, 1.25, 1.5, 2];
const QUALITY_OPTIONS = ['Auto', '1080p', '720p', '480p', '360p'];
const SEEK_SECONDS = 5;
const GLASS_BUTTON_CLASS = 'watch-control-glass rounded-full flex items-center justify-center text-white transition-colors shadow-[0_8px_28px_rgba(0,0,0,0.28)]';
const GLASS_PANEL_CLASS = 'watch-control-glass rounded-full text-white shadow-[0_8px_28px_rgba(0,0,0,0.28)]';

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

const getSubtitleLabel = (language: string) => {
    const raw = String(language || '').trim();
    const normalized = raw.toLowerCase().replace(/_/g, '-');
    const languageNames: Record<string, string> = {
        en: 'English', eng: 'English', english: 'English',
        ar: 'Arabic', ara: 'Arabic', arabic: 'Arabic',
        es: 'Spanish', spa: 'Spanish', spanish: 'Spanish',
        fr: 'French', fra: 'French', fre: 'French', french: 'French',
        de: 'German', deu: 'German', ger: 'German', german: 'German',
        id: 'Indonesian', ind: 'Indonesian', indonesian: 'Indonesian',
        ja: 'Japanese', jpn: 'Japanese', japanese: 'Japanese',
        pt: 'Portuguese', por: 'Portuguese', portuguese: 'Portuguese',
        th: 'Thai', tha: 'Thai', thai: 'Thai',
        vi: 'Vietnamese', vie: 'Vietnamese', vietnamese: 'Vietnamese',
        it: 'Italian', ita: 'Italian', italian: 'Italian',
        ko: 'Korean', kor: 'Korean', korean: 'Korean',
        ru: 'Russian', rus: 'Russian', russian: 'Russian',
        zh: 'Chinese', zho: 'Chinese', chi: 'Chinese', chinese: 'Chinese',
        tr: 'Turkish', tur: 'Turkish', turkish: 'Turkish',
        pl: 'Polish', pol: 'Polish', polish: 'Polish',
        nl: 'Dutch', nld: 'Dutch', dut: 'Dutch', dutch: 'Dutch',
        ro: 'Romanian', ron: 'Romanian', rum: 'Romanian', romanian: 'Romanian',
    };
    if (languageNames[normalized]) return languageNames[normalized];
    const base = normalized.split('-')[0];
    return languageNames[base] || raw || 'Unknown';
};

function SeekIcon({ direction }: { direction: 'back' | 'forward' }) {
    const Icon = direction === 'back' ? RotateCcw : RotateCw;
    return (
        <span className="relative flex h-5 w-5 items-center justify-center">
            <Icon className="h-5 w-5 stroke-[2.5]" />
            <span className="absolute text-[8px] font-black leading-none tracking-normal">5</span>
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
    hlsLevels = [],
    onHlsQualitySelect,
    initialDuration = 0,
    animeId,
    animeTitle,
    animeImage,
    episodeNumber,
    episodeTitle,
    hasSubtitles = false,
    subtitleTracks = [],
    pageLayout = false,
}: CustomVideoControlsProps) {

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(initialDuration || 0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const [settingsView, setSettingsView] = useState<'main' | 'speed' | 'quality' | 'server'>('main');
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [centerAction, setCenterAction] = useState<{ type: 'play' | 'pause'; id: number } | null>(null);
    const [selectedHlsQuality, setSelectedHlsQuality] = useState<string>('Auto');
    const [subtitlesEnabled, setSubtitlesEnabled] = useState(hasSubtitles);
    const [selectedSubtitleIndex, setSelectedSubtitleIndex] = useState(0);
    const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
    const [isControlsLocked, setIsControlsLocked] = useState(false);
    const [isFastForwarding, setIsFastForwarding] = useState(false);
    const nativeFullscreenTransitionRef = useRef(false);
    const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const holdActivatedRef = useRef(false);
    const isFastForwardingRef = useRef(false);
    const suppressNextClickRef = useRef(false);
    const previousPlaybackRateRef = useRef(1);

    const selectSubtitleTrack = useCallback((index: number | null) => {
        const tracks = videoRef.current?.textTracks;
        if (tracks) {
            for (let trackIndex = 0; trackIndex < tracks.length; trackIndex += 1) {
                tracks[trackIndex].mode = index !== null && trackIndex === index ? 'showing' : 'disabled';
            }
        }
        if (index === null) {
            setSubtitlesEnabled(false);
        } else {
            setSelectedSubtitleIndex(index);
            setSubtitlesEnabled(true);
        }
        setShowSubtitleMenu(false);
    }, [videoRef]);

    useEffect(() => {
        const tracks = videoRef.current?.textTracks;
        if (!tracks) return;
        for (let index = 0; index < tracks.length; index += 1) {
            tracks[index].mode = hasSubtitles && subtitlesEnabled && index === selectedSubtitleIndex ? 'showing' : 'disabled';
        }
    }, [hasSubtitles, selectedSubtitleIndex, streamKey, subtitlesEnabled, videoRef]);

    useEffect(() => {
        setSubtitlesEnabled(hasSubtitles);
        setSelectedSubtitleIndex(0);
        setShowSubtitleMenu(false);
    }, [hasSubtitles, streamKey]);

    useEffect(() => {
        if (selectedAudio !== 'dub') return;
        const tracks = videoRef.current?.textTracks;
        if (tracks) {
            for (let index = 0; index < tracks.length; index += 1) {
                tracks[index].mode = 'disabled';
            }
        }
        setSubtitlesEnabled(false);
        setShowSubtitleMenu(false);
    }, [selectedAudio, videoRef]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !hasSubtitles) return;

        const cueLine = showControls || !isPlaying ? -4 : -2;
        const positionCues = () => {
            for (let trackIndex = 0; trackIndex < video.textTracks.length; trackIndex += 1) {
                const track = video.textTracks[trackIndex];
                const cues = track.cues;
                if (!cues) continue;

                for (let cueIndex = 0; cueIndex < cues.length; cueIndex += 1) {
                    const cue = cues[cueIndex];
                    if ('line' in cue && 'snapToLines' in cue) {
                        const positionedCue = cue as TextTrackCue & { line: number | 'auto'; snapToLines: boolean };
                        positionedCue.snapToLines = true;
                        positionedCue.line = cueLine;
                    }
                }
            }
        };

        const trackElements = Array.from(video.querySelectorAll('track'));
        for (let trackIndex = 0; trackIndex < video.textTracks.length; trackIndex += 1) {
            video.textTracks[trackIndex].addEventListener('cuechange', positionCues);
        }
        trackElements.forEach((track) => track.addEventListener('load', positionCues));
        positionCues();

        return () => {
            for (let trackIndex = 0; trackIndex < video.textTracks.length; trackIndex += 1) {
                video.textTracks[trackIndex].removeEventListener('cuechange', positionCues);
            }
            trackElements.forEach((track) => track.removeEventListener('load', positionCues));
        };
    }, [hasSubtitles, isPlaying, showControls, streamKey, videoRef]);

    useEffect(() => {
        if (initialDuration && initialDuration > 0) {
            setDuration(prev => (prev > 0 ? prev : initialDuration));
        }
    }, [initialDuration]);

    const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const currentStream = streams[selectedStreamIndex];
    const isOfflineStream = Boolean(
        currentStream?.provider === 'Offline Storage' ||
        currentStream?.url?.startsWith('blob:') ||
        currentStream?.url?.includes('/api/scraper/local-file')
    );
    const currentQuality = currentStream ? getMappedQuality(currentStream.quality) : 'Auto';
    const selectedServerLabel = serverOptions.find((server) => server.key === selectedServer)?.label || 'Auto';
    const hasDub = availableAudios.includes('dub');
    // Always let a Dub stream request Sub. The handler will purge a stale
    // dub-only response and refetch before deciding that Sub is unavailable.
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
    
    const introSkip = skipTimestamps.find(ts => ts.skipType === 'intro');
    const outroSkip = skipTimestamps.find(ts => ts.skipType === 'outro');

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
                setShowSettings(false); // also hide settings menu
                setSettingsView('main');
            }
        }, pageLayout ? 5000 : 3000);
    }, [isPlaying, pageLayout]);

    const handleMouseLeave = useCallback(() => {
        if (isPlaying) {
            setShowControls(false);
            setShowSettings(false); // also hide settings menu
            setSettingsView('main');
        }
    }, [isPlaying]);

    const handlePlayerSurfaceTap = useCallback(() => {
        if (showControls) {
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
            setShowControls(false);
            setShowSettings(false);
            setShowSubtitleMenu(false);
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
        
        // Restore volume and playback state on new video elements
        video.volume = volume;
        video.muted = isMuted;
        video.playbackRate = playbackSpeed;
        
        // This is where the play state and animation trigger happens
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
            if (document.fullscreenElement) {
                await document.exitFullscreen().catch(() => undefined);
            }
            await ScreenOrientation.lock({ orientation: 'portrait-primary' }).catch((error) => {
                console.warn('Failed to restore portrait orientation', error);
            });
            await waitForViewportOrientation('portrait');
            document.body.classList.remove('yorumi-player-landscape');
            setIsFullscreen(false);
            await ScreenOrientation.unlock().catch((error) => {
                console.warn('Failed to unlock native orientation', error);
            });
            await exitImmersiveMode().catch((error) => {
                console.warn('Failed to exit immersive player mode', error);
            });
        } finally {
            nativeFullscreenTransitionRef.current = false;
        }
    }, []);

    const enterNativeFullscreen = useCallback(async () => {
        if (nativeFullscreenTransitionRef.current) return;
        nativeFullscreenTransitionRef.current = true;
        try {
            // Native rotation owns the viewport. CSS only expands the player;
            // it must never rotate or swap vw/vh dimensions.
            await ScreenOrientation.lock({ orientation: 'landscape' });
            await waitForViewportOrientation('landscape');
            document.body.classList.add('yorumi-player-landscape');
            await enterImmersiveMode();
            setIsFullscreen(true);
        } catch (error) {
            document.body.classList.remove('yorumi-player-landscape');
            setIsFullscreen(false);
            await ScreenOrientation.unlock().catch(() => undefined);
            await exitImmersiveMode().catch(() => undefined);
            console.error('Failed to enter native landscape player mode', error);
        } finally {
            nativeFullscreenTransitionRef.current = false;
        }
    }, []);

    useEffect(() => {
        const handleFullscreenChange = () => {
            if (pageLayout && isNativeMobile()) {
                if (!document.fullscreenElement && isFullscreen && !nativeFullscreenTransitionRef.current) {
                    void exitNativeFullscreen();
                }
                return;
            }
            setIsFullscreen(Boolean(document.fullscreenElement));
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, [exitNativeFullscreen, isFullscreen, pageLayout]);

    const toggleFullscreen = async () => {
        const playerContainer = videoRef.current?.closest('.watch-player-shell');
        if (!playerContainer) return;

        if (pageLayout && isNativeMobile()) {
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
        if (pageLayout && isNativeMobile()) {
            document.body.classList.remove('yorumi-player-landscape');
            ScreenOrientation.unlock().catch(() => undefined);
            exitImmersiveMode().catch(() => undefined);
        }
    }, [pageLayout]);

    const handleCast = async () => {
        const video = videoRef.current as any;
        if (!video) return;

        try {
            if (video.remote && video.remote.state !== 'disconnected') {
                await video.remote.prompt();
            } else if (video.webkitShowPlaybackTargetPicker) {
                video.webkitShowPlaybackTargetPicker();
            } else if (video.remote) {
                await video.remote.prompt();
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
        const playerShell = videoRef.current?.closest('.watch-player-shell') as HTMLElement;
        if (playerShell) {
            playerShell.tabIndex = 0;
            // Touch browsers can synthesize mousemove immediately before click. In
            // page layout that raced the tap toggle: show on mousemove, then hide on
            // click. Hover visibility belongs to the desktop player only.
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
        }
    }, [videoRef, handleMouseMove, handleMouseLeave, isControlsLocked, pageLayout, startFastForwardGesture, stopHoldGesture, toggleVideoPlayback]);

    // Cleanup the center animation state so it fully unmounts
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
                                    className="absolute left-0 top-0 h-full rounded-full bg-yorumi-accent"
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
            
            {/* Center Animation Overlay */}
            {centerAction && !pageLayout && (
                <div 
                    key={centerAction.id}
                    className="watch-center-pop absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-[60] flex h-16 w-16 items-center justify-center rounded-full bg-[#2A2322]/75 shadow-2xl animate-animetsu-center-pop sm:h-[72px] sm:w-[72px]"
                >
                    {centerAction.type === 'play' ? (
                        <Play className="w-8 h-8 text-white fill-current ml-1 sm:h-9 sm:w-9" />
                    ) : (
                        <Pause className="w-8 h-8 text-white fill-current sm:h-9 sm:w-9" />
                    )}
                </div>
            )}

            {pageLayout && (
                <div
                    className="absolute inset-x-0 top-0 z-[60] touch-manipulation bg-transparent"
                    style={{ bottom: '104px' }}
                    onClick={handlePlayerSurfaceTap}
                    onContextMenu={(event) => event.preventDefault()}
                    aria-hidden="true"
                />
            )}

            {pageLayout && isFastForwarding && (
                <div className="pointer-events-none absolute left-1/2 top-4 z-[100] flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/10 bg-black/75 px-4 py-2 text-sm font-bold text-white shadow-xl backdrop-blur-sm">
                    <span>2x</span>
                    <FastForward className="h-4 w-4 fill-current" strokeWidth={2.5} />
                </div>
            )}

            {showSettings && (
                <div
                    className="absolute inset-0 z-[79] pointer-events-auto"
                    data-player-interactive="true"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                        event.stopPropagation();
                        setShowSettings(false);
                        setSettingsView('main');
                    }}
                    aria-hidden="true"
                />
            )}

            {pageLayout && (
                <div
                    className={`pointer-events-auto absolute inset-x-0 top-0 z-[80] ${isFastForwarding ? 'pointer-events-none opacity-0' : `transition-opacity duration-300 ${showControls ? 'opacity-100' : 'pointer-events-none opacity-0'}`}`}
                    style={{ bottom: '104px' }}
                    onClick={(event) => {
                        if (event.target === event.currentTarget) handlePlayerSurfaceTap();
                    }}
                >
                    <button
                        type="button"
                        onClick={() => {
                            setIsControlsLocked((locked) => !locked);
                            handleMouseMove();
                        }}
                        className="absolute left-7 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center text-white drop-shadow-lg"
                        aria-label={isControlsLocked ? 'Unlock player controls' : 'Lock player controls'}
                    >
                        {isControlsLocked ? <Lock className="h-6 w-6" /> : <Unlock className="h-6 w-6" />}
                    </button>
                    {!isControlsLocked && (
                        <>
                            <button type="button" onClick={() => seekBy(-SEEK_SECONDS)} className="absolute top-1/2 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center text-white drop-shadow-lg" style={{ left: 'calc(50% - 72px)' }} aria-label="Back 5 seconds">
                                <SeekIcon direction="back" />
                            </button>
                            <button type="button" onClick={togglePlay} className="absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center text-white drop-shadow-xl" aria-label={isPlaying ? 'Pause' : 'Play'}>
                                {isPlaying ? <Pause className="h-10 w-10 fill-current" /> : <Play className="ml-1 h-10 w-10 fill-current" />}
                            </button>
                            <button type="button" onClick={() => seekBy(SEEK_SECONDS)} className="absolute top-1/2 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center text-white drop-shadow-lg" style={{ left: 'calc(50% + 72px)' }} aria-label="Forward 5 seconds">
                                <SeekIcon direction="forward" />
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* Top Bar - Server Selection */}

            <div 
                className={`watch-controls-deck absolute pointer-events-none ${isFastForwarding ? '' : 'transition-opacity duration-300'} ${pageLayout ? `bottom-6 left-3 right-3 z-[80] h-[84px] bg-transparent px-2 py-1 ${isControlsLocked || !showControls || isFastForwarding ? 'opacity-0' : 'opacity-100'}` : `bottom-0 left-0 right-0 z-[2147483647] p-2 sm:p-6 ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0'}`}`}
                onClick={(event) => {
                    if (event.target === event.currentTarget) handlePlayerSurfaceTap();
                }}
            >
                {!isControlsLocked && <div className="mx-auto max-w-5xl flex flex-col gap-2 sm:gap-4 pointer-events-auto">
                    {/* Scrubber / Progress Bar */}
                    <div
                        className={`relative z-0 h-7 w-full cursor-pointer group/progress ${showSettings || showSubtitleMenu ? 'pointer-events-none' : ''}`}
                        onMouseMove={handleProgressHover}
                        onMouseLeave={handleProgressLeave}
                    >
                        <div className={`absolute left-0 right-0 top-1/2 -translate-y-1/2 overflow-hidden rounded-full bg-white/25 shadow-inner ${pageLayout ? 'h-2' : 'h-2.5'}`}>
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
                                className="absolute left-0 top-0 h-full rounded-full bg-yorumi-accent"
                                style={{ width: `${progressPercentage}%` }}
                            />
                        </div>
                        <div
                            className={`absolute top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow ${pageLayout ? 'h-3.5 w-3.5' : 'h-4 w-4'}`}
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

                    {/* Controls */}
                    <div className={`flex w-full items-center ${pageLayout ? 'justify-between gap-3' : 'justify-center gap-1 sm:justify-between sm:gap-3'}`}>
                        {/* Left Controls */}
                        <div className={`flex min-w-0 items-center ${pageLayout ? 'gap-2' : 'gap-1 sm:gap-2'}`}>
                            {!pageLayout && <button 
                                onClick={togglePlay} 
                                className={`${GLASS_BUTTON_CLASS} h-7 w-7 sm:h-10 sm:w-12`}
                            >
                                {isPlaying ? <Pause className="h-3.5 w-3.5 fill-current sm:h-5 sm:w-5" /> : <Play className="h-3.5 w-3.5 fill-current sm:h-5 sm:w-5" />}
                            </button>}
                            
                            {!pageLayout && adjacentHandler && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); adjacentHandler(); }}
                                    title={hasNextEpisode ? 'Next Episode' : 'Previous Episode'}
                                    className={`${GLASS_BUTTON_CLASS} h-7 w-7 sm:h-10 sm:w-12`}
                                >
                                    <AdjacentIcon className="h-3.5 w-3.5 fill-current sm:h-5 sm:w-5" />
                                </button>
                            )}
                            
                            <div className={`${GLASS_PANEL_CLASS} group/volume flex items-center overflow-hidden transition-all duration-300 ${pageLayout ? 'h-9 w-9' : 'h-7 w-7 sm:h-10 sm:w-12 sm:hover:w-32'}`}>
                                <button 
                                    onClick={toggleMute} 
                                    className={`flex flex-shrink-0 items-center justify-center ${pageLayout ? 'h-9 w-9' : 'h-7 w-7 sm:h-10 sm:w-12'}`}
                                >
                                    {isMuted || volume === 0 ? <VolumeX className={pageLayout ? 'h-5 w-5' : 'h-3.5 w-3.5 sm:h-5 sm:w-5'} /> : <Volume2 className={pageLayout ? 'h-5 w-5' : 'h-3.5 w-3.5 sm:h-5 sm:w-5'} />}
                                </button>
                                <input 
                                    type="range" 
                                    min={0} 
                                    max={1} 
                                    step={0.01} 
                                    value={isMuted ? 0 : volume} 
                                    onChange={(e) => {
                                        const val = parseFloat(e.target.value);
                                        if (videoRef.current) {
                                            videoRef.current.volume = val;
                                            videoRef.current.muted = val === 0;
                                        }
                                    }}
                                    className="hidden h-1 w-16 cursor-pointer appearance-none rounded-full outline-none sm:block [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                                    style={{ background: `linear-gradient(to right, white ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.3) ${(isMuted ? 0 : volume) * 100}%)` }}
                                />
                            </div>

                            {pageLayout && hasNextEpisode && onNextEpisode && (
                                <button
                                    type="button"
                                    onClick={(event) => { event.stopPropagation(); onNextEpisode(); setShowControls(false); }}
                                    className={`${GLASS_BUTTON_CLASS} h-9 w-9`}
                                    title="Next episode"
                                    aria-label="Next episode"
                                >
                                    <SkipForward className="h-5 w-5 fill-current" />
                                </button>
                            )}

                            <div className={`${GLASS_PANEL_CLASS} flex items-center justify-center font-bold tracking-normal ${pageLayout ? 'h-9 min-w-[88px] px-2 text-[11px]' : 'h-7 min-w-[62px] px-1.5 text-[9px] sm:h-10 sm:min-w-0 sm:px-4 sm:text-xs sm:font-medium sm:tracking-wider'}`}>
                                {formatTime(currentTime)} / {formatTime(duration)}
                            </div>
                        </div>

                        {/* Right Controls */}
                        <div className={`relative z-[100] flex shrink-0 items-center ${pageLayout ? 'gap-2' : 'gap-1 sm:gap-2'}`}>
                            {!pageLayout && <button
                                onClick={() => seekBy(-SEEK_SECONDS)}
                                className={`${GLASS_BUTTON_CLASS} h-7 w-7 sm:h-10 sm:w-12`}
                                title="Back 5 seconds"
                            >
                                <SeekIcon direction="back" />
                            </button>}
                            {!pageLayout && <button
                                onClick={() => seekBy(SEEK_SECONDS)}
                                className={`${GLASS_BUTTON_CLASS} h-7 w-7 sm:h-10 sm:w-12`}
                                title="Forward 5 seconds"
                            >
                                <SeekIcon direction="forward" />
                            </button>}

                            <div className={`${GLASS_PANEL_CLASS} relative flex items-center ${pageLayout ? 'h-9 gap-0.5 px-1' : 'h-7 gap-0 px-0 sm:h-10 sm:gap-1 sm:px-3'}`}>
                                {/* Settings Popover */}
                                {showSettings && (
                                    <div
                                        className="pointer-events-auto absolute bottom-full right-0 z-[200] mb-3 w-44 rounded-xl bg-[#1A1A1A]/95 p-1 shadow-2xl backdrop-blur-xl"
                                        data-player-interactive="true"
                                        onClick={(event) => event.stopPropagation()}
                                        onPointerDown={(event) => event.stopPropagation()}
                                        onMouseDown={(event) => event.stopPropagation()}
                                        onTouchStart={(event) => event.stopPropagation()}
                                    >
                                        {settingsView !== 'main' && (
                                            <button
                                                onClick={() => setSettingsView('main')}
                                                className="mb-1.5 flex w-full items-center gap-2 border-b border-white/5 px-2 pb-1.5 pt-1 text-left text-xs font-semibold text-white"
                                            >
                                                <ChevronLeft className="h-3.5 w-3.5" />
                                                {settingsView === 'quality' ? 'Quality' : settingsView === 'server' ? 'Server' : 'Playback speed'}
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
                                                    className="flex items-center justify-between w-full p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-40"
                                                >
                                                    <div className="flex items-center gap-2 text-white">
                                                        <Mic className="w-4 h-4" />
                                                        <span className="text-xs font-medium">Dub</span>
                                                    </div>
                                                    <div className={`w-8 h-4 rounded-full relative shadow-inner transition-colors ${selectedAudio === 'dub' ? 'bg-white' : 'bg-white/20'}`}>
                                                        <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full transition-transform duration-200 ${selectedAudio === 'dub' ? 'bg-black translate-x-4' : 'bg-white translate-x-0'}`}></div>
                                                    </div>
                                                </button>
                                                <button
                                                    onClick={() => onAutoNextChange?.(!autoNextEnabled)}
                                                    disabled={!onAutoNextChange || !hasNextEpisode}
                                                    className="flex items-center justify-between w-full p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-40"
                                                >
                                                    <div className="flex items-center gap-2 text-white">
                                                        <SkipForward className="w-4 h-4" />
                                                        <span className="text-xs font-medium">Auto next</span>
                                                    </div>
                                                    <div className={`w-8 h-4 rounded-full relative shadow-inner transition-colors ${autoNextEnabled && hasNextEpisode ? 'bg-white' : 'bg-white/20'}`}>
                                                        <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full transition-transform duration-200 ${autoNextEnabled && hasNextEpisode ? 'bg-black translate-x-4' : 'bg-white translate-x-0'}`}></div>
                                                    </div>
                                                </button>
                                                <button
                                                    onClick={() => onAutoSkipChange?.(!autoSkipEnabled)}
                                                    disabled={!onAutoSkipChange}
                                                    className="flex items-center justify-between w-full p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-40"
                                                >
                                                    <div className="flex items-center gap-2 text-white">
                                                        <RotateCw className="h-4 w-4 shrink-0" strokeWidth={2} />
                                                        <span className="text-xs font-medium">Auto Skip</span>
                                                    </div>
                                                    <div className={`w-8 h-4 rounded-full relative shadow-inner transition-colors ${autoSkipEnabled ? 'bg-white' : 'bg-white/20'}`}>
                                                        <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full transition-transform duration-200 ${autoSkipEnabled ? 'bg-black translate-x-4' : 'bg-white translate-x-0'}`}></div>
                                                    </div>
                                                </button>

                                                {skipTimestampsLoading && (
                                                    <div className="px-2 py-1 text-[11px] text-white/60 flex items-center gap-1.5">
                                                        <span className="animate-pulse">Loading skip times...</span>
                                                    </div>
                                                )}
                                                <button
                                                    onClick={() => setSettingsView('speed')}
                                                    className="flex items-center justify-between w-full p-2 hover:bg-white/10 rounded-lg transition-colors"
                                                >
                                                    <div className="flex items-center gap-2 text-white">
                                                        <Gauge className="w-4 h-4" />
                                                        <span className="text-xs font-medium">Playback speed</span>
                                                    </div>
                                                    <span className="text-xs text-white/70">{playbackSpeed}x</span>
                                                </button>
                                                <button
                                                    onClick={() => setSettingsView('quality')}
                                                    className="flex items-center justify-between w-full p-2 hover:bg-white/10 rounded-lg transition-colors"
                                                >
                                                    <div className="flex items-center gap-2 text-white">
                                                        <Video className="w-4 h-4" />
                                                        <span className="text-xs font-medium">Quality</span>
                                                    </div>
                                                    <span className="text-xs text-white/70">{isAutoQuality ? `Auto(${currentQuality})` : currentQuality}</span>
                                                </button>
                                                {!isOfflineStream && (
                                                    <button
                                                        onClick={() => setSettingsView('server')}
                                                        className="flex items-center justify-between w-full p-2 hover:bg-white/10 rounded-lg transition-colors"
                                                    >
                                                        <div className="flex items-center gap-2 text-white">
                                                            <Monitor className="w-4 h-4" />
                                                            <span className="text-xs font-medium">Server</span>
                                                        </div>
                                                        <span className="text-xs text-white/70">{selectedServerLabel}</span>
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        {settingsView === 'speed' && (
                                            <div className="flex flex-col gap-0.5">
                                                {PLAYBACK_SPEEDS.map((speed) => (
                                                    <button
                                                        key={speed}
                                                        onClick={() => setVideoPlaybackSpeed(speed)}
                                                        className={`flex w-full items-center justify-between rounded-lg p-2 text-left transition-colors ${playbackSpeed === speed ? 'bg-white/15 text-white' : 'text-white/80 hover:bg-white/10'}`}
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
                                                            className={`flex w-full items-center justify-between rounded-lg p-2 text-left transition-colors ${isSelected ? 'bg-white/15 text-white' : 'text-white/80 hover:bg-white/10'}`}
                                                        >
                                                            <span className="text-xs font-medium">{quality}</span>
                                                            {isSelected ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {settingsView === 'server' && (
                                            <div className="flex flex-col gap-0.5">
                                                {serverOptions.map((server) => (
                                                    <button
                                                        key={server.key}
                                                        onClick={() => {
                                                            onServerChange(server.key);
                                                            onSetAutoQuality();
                                                            setSettingsView('main');
                                                        }}
                                                        className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition-colors ${selectedServer === server.key ? 'bg-white/15 text-white' : 'text-white/80 hover:bg-white/10'}`}
                                                    >
                                                        <span className="text-xs font-medium">{server.label}</span>
                                                        {selectedServer === server.key ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <button onClick={() => { setShowSettings(!showSettings); setShowSubtitleMenu(false); setSettingsView('main'); }} className={`rounded-full text-white transition-colors hover:bg-white/10 hover:text-white/80 ${pageLayout ? 'p-2' : 'p-1.5 sm:p-2'}`}>
                                    <Settings className={pageLayout ? 'h-5 w-5' : 'h-3.5 w-3.5 sm:h-5 sm:w-5'} />
                                </button>
                                {hasSubtitles && (
                                    <>
                                        {showSubtitleMenu && subtitleTracks.length > 1 && (
                                            <div
                                                className="pointer-events-auto absolute bottom-full right-8 z-50 mb-3 max-h-64 w-44 overflow-y-auto rounded-xl bg-[#1A1A1A]/95 p-1 shadow-2xl backdrop-blur-xl sm:right-10"
                                                onClick={(event) => event.stopPropagation()}
                                                onPointerDown={(event) => event.stopPropagation()}
                                            >
                                                <div className="border-b border-white/10 px-2.5 py-2 text-xs font-semibold text-white">Subtitles</div>
                                                <button
                                                    onClick={(event) => { event.stopPropagation(); selectSubtitleTrack(null); }}
                                                    type="button"
                                                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs text-white/80 transition-colors hover:bg-white/10"
                                                >
                                                    <span>Off</span>
                                                    {!subtitlesEnabled && <CheckCircle2 className="h-3.5 w-3.5" />}
                                                </button>
                                                {subtitleTracks.map((track, index) => (
                                                    <button
                                                        key={`${track.url}:${index}`}
                                                        onClick={(event) => { event.stopPropagation(); selectSubtitleTrack(index); }}
                                                        type="button"
                                                        className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-white/80 transition-colors hover:bg-white/10"
                                                    >
                                                        <span className="truncate">{getSubtitleLabel(track.lang)}</span>
                                                        {subtitlesEnabled && selectedSubtitleIndex === index && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        <button
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                setShowSettings(false);
                                                if (subtitleTracks.length <= 1) {
                                                    selectSubtitleTrack(subtitlesEnabled ? null : 0);
                                                    return;
                                                }
                                                setShowSubtitleMenu((visible) => !visible);
                                            }}
                                            type="button"
                                            className={`rounded-full text-white transition-colors ${pageLayout ? 'p-2' : 'p-1.5 sm:p-2'} ${subtitlesEnabled ? 'bg-white/20 hover:bg-white/25' : 'hover:bg-white/10 hover:text-white/80'}`}
                                            title={subtitleTracks.length > 1
                                                ? 'Choose subtitle language'
                                                : (subtitlesEnabled ? 'Turn subtitles off' : 'Turn subtitles on')}
                                            aria-expanded={showSubtitleMenu}
                                            aria-pressed={subtitlesEnabled}
                                        >
                                            <Captions className={pageLayout ? 'h-5 w-5' : 'h-3.5 w-3.5 sm:h-5 sm:w-5'} />
                                        </button>
                                    </>
                                )}
                                <button onClick={toggleFullscreen} className={`rounded-full text-white transition-colors hover:bg-white/10 hover:text-white/80 ${pageLayout ? 'p-2' : 'p-1.5 sm:p-2'}`}>
                                    {isFullscreen ? <Minimize className={pageLayout ? 'h-5 w-5' : 'h-3.5 w-3.5 sm:h-5 sm:w-5'} /> : <Maximize className={pageLayout ? 'h-5 w-5' : 'h-3.5 w-3.5 sm:h-5 sm:w-5'} />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>}
            </div>
        </>
    );
}

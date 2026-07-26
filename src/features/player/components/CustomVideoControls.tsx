import { useEffect, useState, useRef, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Settings, Cast, Maximize, Minimize, Mic, Gauge, Video, Monitor, ChevronLeft, CheckCircle2, Circle, X, RotateCcw, RotateCw } from 'lucide-react';
import RedoIcon from '@mui/icons-material/Redo';
import type { StreamServerKey } from '../../../hooks/useStreams';
import type { StreamLink } from '../../../types/stream';
import type { SkipTimestamp } from '../../../services/skipTimestamps';
import { getMappedQuality } from '../../../utils/streamUtils';

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
}

const PLAYBACK_SPEEDS = [0.25, 1, 1.25, 1.5, 2];
const QUALITY_OPTIONS = ['Auto', '1080P', '720P', '360P'];
const SEEK_SECONDS = 5;
const GLASS_BUTTON_CLASS = 'watch-control-glass rounded-full flex items-center justify-center text-white transition-colors shadow-[0_8px_28px_rgba(0,0,0,0.28)]';
const GLASS_PANEL_CLASS = 'watch-control-glass rounded-full text-white shadow-[0_8px_28px_rgba(0,0,0,0.28)]';

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
    isWide = false,
    onToggleWide,
}: CustomVideoControlsProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const [settingsView, setSettingsView] = useState<'main' | 'speed' | 'quality' | 'server'>('main');
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [centerAction, setCenterAction] = useState<{ type: 'play' | 'pause'; id: number } | null>(null);

    const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const currentStream = streams[selectedStreamIndex];
    const currentQuality = currentStream ? getMappedQuality(currentStream.quality) : '1080P';
    const selectedServerLabel = serverOptions.find((server) => server.key === selectedServer)?.label || 'Auto';
    const hasDub = availableAudios.includes('dub');
    const adjacentHandler = hasNextEpisode ? onNextEpisode : onPrevEpisode;
    const AdjacentIcon = hasNextEpisode ? SkipForward : SkipBack;
    
    const introSkip = skipTimestamps.find(ts => ts.skipType === 'intro');
    const outroSkip = skipTimestamps.find(ts => ts.skipType === 'outro');

    const [hoverProgress, setHoverProgress] = useState<{ x: number; time: number } | null>(null);
    const [hoverSprite, setHoverSprite] = useState<{ url: string; col: number; row: number; spriteGrid: { columns: number; rows: number }; interval: number } | null>(null);
    const [hoverThumbnailUrl, setHoverThumbnailUrl] = useState<string | null>(null);

    const getHoverThumbnail = useCallback((time: number) => {
        const thumbnails = currentStream?.thumbnails;
        if (!thumbnails) return { sprite: null, url: null };

        if (thumbnails.spriteUrl && thumbnails.spriteGrid) {
            const interval = thumbnails.interval || 10;
            const frameIndex = Math.floor(time / interval);
            const col = frameIndex % thumbnails.spriteGrid.columns;
            const row = Math.floor(frameIndex / thumbnails.spriteGrid.columns);
            if (row < thumbnails.spriteGrid.rows) {
                return {
                    sprite: { url: thumbnails.spriteUrl, col, row, spriteGrid: thumbnails.spriteGrid, interval },
                    url: null
                };
            }
        }



        return { sprite: null, url: null };
    }, [currentStream?.thumbnails]);

    const handleProgressHover = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const time = x * duration;
        setHoverProgress({ x, time });
        const { sprite, url } = getHoverThumbnail(time);
        setHoverSprite(sprite);
        setHoverThumbnailUrl(url);
    }, [duration, getHoverThumbnail]);

    const handleProgressLeave = useCallback(() => {
        setHoverProgress(null);
        setHoverSprite(null);
        setHoverThumbnailUrl(null);
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
        setShowControls(true);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);

        controlsTimeoutRef.current = setTimeout(() => {
            if (isPlaying) {
                setShowControls(false);
                setShowSettings(false); // also hide settings menu
                setSettingsView('main');
            }
        }, 3000);
    }, [isPlaying]);

    const handleMouseLeave = useCallback(() => {
        if (isPlaying) {
            setShowControls(false);
            setShowSettings(false); // also hide settings menu
            setSettingsView('main');
        }
    }, [isPlaying]);

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

        const updateTime = () => setCurrentTime(video.currentTime);
        const updateDuration = () => setDuration(video.duration);
        
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
        video.addEventListener('play', updatePlayState);
        video.addEventListener('pause', updatePlayState);
        video.addEventListener('volumechange', updateVolume);
        return () => {
            video.removeEventListener('timeupdate', updateTime);
            video.removeEventListener('loadedmetadata', updateDuration);
            video.removeEventListener('play', updatePlayState);
            video.removeEventListener('pause', updatePlayState);
            video.removeEventListener('volumechange', updateVolume);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videoRef, playbackSpeed, streamKey]);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const togglePlay = (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        toggleVideoPlayback();
    };

    const toggleMute = () => {
        if (videoRef.current) {
            videoRef.current.muted = !videoRef.current.muted;
        }
    };

    const setVideoPlaybackSpeed = (speed: number) => {
        if (videoRef.current) {
            videoRef.current.playbackRate = speed;
        }
        setPlaybackSpeed(speed);
        setSettingsView('main');
    };

    const handleQualitySelect = (quality: string) => {
        if (quality === 'Auto') {
            onSetAutoQuality();
        } else {
            const index = streams.findIndex((stream) => getMappedQuality(stream.quality) === quality);
            if (index >= 0) {
                onQualityChange(index);
            } else {
                onSetAutoQuality();
            }
        }
        setSettingsView('main');
    };

    const toggleFullscreen = () => {
        const playerContainer = videoRef.current?.closest('.watch-player-shell');
        if (!playerContainer) return;

        if (!document.fullscreenElement) {
            playerContainer.requestFullscreen().catch(console.error);
        } else {
            document.exitFullscreen().catch(console.error);
        }
    };

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
        }
    };

    const seekBy = (seconds: number) => {
        const video = videoRef.current;
        if (!video) return;
        const durationSeconds = Number.isFinite(video.duration) ? video.duration : 0;
        const nextTime = Math.max(0, Math.min(durationSeconds || Number.MAX_SAFE_INTEGER, video.currentTime + seconds));
        video.currentTime = nextTime;
        setCurrentTime(nextTime);
        handleMouseMove();
    };

    const progressPercentage = duration ? (currentTime / duration) * 100 : 0;

    useEffect(() => {
        const playerShell = videoRef.current?.closest('.watch-player-shell') as HTMLElement;
        if (playerShell) {
            playerShell.tabIndex = 0;
            playerShell.addEventListener('mousemove', handleMouseMove);
            playerShell.addEventListener('mouseleave', handleMouseLeave);
            const focusPlayer = () => playerShell.focus({ preventScroll: true });
            const handleKeyDown = (event: KeyboardEvent) => {
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
            playerShell.addEventListener('keydown', handleKeyDown);
            
            const initialTimer = setTimeout(handleMouseMove, 0);
            
            return () => {
                clearTimeout(initialTimer);
                playerShell.removeEventListener('mousemove', handleMouseMove);
                playerShell.removeEventListener('mouseleave', handleMouseLeave);
                playerShell.removeEventListener('pointerdown', focusPlayer);
                playerShell.removeEventListener('keydown', handleKeyDown);
            };
        }
    }, [videoRef, handleMouseMove, handleMouseLeave, toggleVideoPlayback]);

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
                        <div className="relative h-1 w-full cursor-pointer overflow-hidden rounded-full bg-white/25">
                            {introSkip && (
                                <div
                                    className="absolute top-0 h-full rounded-full bg-emerald-400/30"
                                    style={getSkipRangeStyle(introSkip) || undefined}
                                />
                            )}
                            {outroSkip && (
                                <div
                                    className="absolute top-0 h-full rounded-full bg-amber-400/30"
                                    style={getSkipRangeStyle(outroSkip) || undefined}
                                />
                            )}
                            <div
                                className="absolute left-0 top-0 h-full rounded-full bg-white"
                                style={{ width: `${progressPercentage}%` }}
                            />
                            <input
                                type="range"
                                min={0}
                                max={duration || 100}
                                value={currentTime}
                                onChange={handleSeek}
                                className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 outline-none focus:outline-none focus:ring-0"
                            />
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
            {centerAction && (
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

            {/* Top Bar - Server Selection */}

            <div 
                className={`absolute bottom-0 left-0 right-0 p-2 sm:p-6 transition-opacity duration-300 z-[2147483647] pointer-events-none ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0'}`}
            >
                <div className="mx-auto max-w-5xl flex flex-col gap-3 sm:gap-4 pointer-events-auto">
                    {/* Scrubber / Progress Bar */}
                    <div 
                        className="relative h-1 w-full bg-white/20 cursor-pointer group overflow-hidden rounded-full"
                        onMouseMove={handleProgressHover}
                        onMouseLeave={handleProgressLeave}
                    >
                        {introSkip && (
                            <div
                                className="absolute top-0 h-full rounded-full bg-emerald-400/30"
                                style={getSkipRangeStyle(introSkip) || undefined}
                            />
                        )}
                        {outroSkip && (
                            <div
                                className="absolute top-0 h-full rounded-full bg-amber-400/30"
                                style={getSkipRangeStyle(outroSkip) || undefined}
                            />
                        )}
                        <div 
                            className="absolute top-0 left-0 h-full bg-white rounded-full transition-all duration-150 ease-out"
                            style={{ width: `${progressPercentage}%` }}
                        />
                        <input
                            type="range"
                            min={0}
                            max={duration || 100}
                            value={currentTime}
                            onChange={handleSeek}
                            className="absolute inset-0 w-full h-full cursor-pointer opacity-0 outline-none focus:outline-none focus:ring-0 z-10"
                        />
                        {/* Hover thumb */}
                        <div 
                            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow"
                            style={{ left: `calc(${progressPercentage}% - 6px)` }}
                        />
                        {/* Hover Preview Thumbnail */}
                        {hoverProgress && (hoverSprite || hoverThumbnailUrl) && (
                            <div 
                                className="absolute bottom-full left-0 mb-2 transform -translate-x-1/2 transition-all duration-150 pointer-events-none z-20"
                                style={{ left: `${hoverProgress.x * 100}%` }}
                            >
                                <div className="relative bg-black/90 rounded-lg overflow-hidden shadow-2xl border border-white/10">
                                    {hoverSprite ? (
                                        <div 
                                            className="w-48 h-27"
                                            style={{
                                                backgroundImage: `url(${hoverSprite.url})`,
                                                backgroundSize: `${hoverSprite.spriteGrid.columns * 100}% ${hoverSprite.spriteGrid.rows * 100}%`,
                                                backgroundPosition: `${hoverSprite.col / (hoverSprite.spriteGrid.columns - 1) * 100}% ${hoverSprite.row / (hoverSprite.spriteGrid.rows - 1) * 100}%`,
                                            }}
                                        />
                                    ) : hoverThumbnailUrl && (
                                        <img 
                                            src={hoverThumbnailUrl} 
                                            alt={`Preview at ${formatTime(hoverProgress.time)}`}
                                            className="w-48 h-27 object-cover"
                                            loading="lazy"
                                        />
                                    )}
                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent px-2 py-1 text-xs text-white/80">
                                        {formatTime(hoverProgress.time)}
                                    </div>
                                </div>
                                <div className="w-2 h-2 bg-black/90 rotate-45 mx-auto -mt-1 border-r border-b border-white/10" />
                            </div>
                        )}
                    </div>

                    {/* Controls */}
                    <div className="flex w-full items-center justify-center gap-1 sm:justify-between sm:gap-3">
                        {/* Left Controls */}
                        <div className="flex min-w-0 items-center gap-1 sm:gap-2">
                            <button 
                                onClick={togglePlay} 
                                className={`${GLASS_BUTTON_CLASS} h-7 w-7 sm:h-10 sm:w-12`}
                            >
                                {isPlaying ? <Pause className="h-3.5 w-3.5 fill-current sm:h-5 sm:w-5" /> : <Play className="h-3.5 w-3.5 fill-current sm:h-5 sm:w-5" />}
                            </button>
                            
                            {adjacentHandler && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); adjacentHandler(); }}
                                    title={hasNextEpisode ? 'Next Episode' : 'Previous Episode'}
                                    className={`${GLASS_BUTTON_CLASS} h-7 w-7 sm:h-10 sm:w-12`}
                                >
                                    <AdjacentIcon className="h-3.5 w-3.5 fill-current sm:h-5 sm:w-5" />
                                </button>
                            )}
                            
                            <div className={`${GLASS_PANEL_CLASS} group/volume flex h-7 w-7 items-center overflow-hidden transition-all duration-300 sm:h-10 sm:w-12 sm:hover:w-32`}>
                                <button 
                                    onClick={toggleMute} 
                                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center sm:h-10 sm:w-12"
                                >
                                    {isMuted || volume === 0 ? <VolumeX className="h-3.5 w-3.5 sm:h-5 sm:w-5" /> : <Volume2 className="h-3.5 w-3.5 sm:h-5 sm:w-5" />}
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

                            <div className={`${GLASS_PANEL_CLASS} flex h-7 min-w-[62px] items-center justify-center px-1.5 text-[9px] font-bold tracking-normal sm:h-10 sm:min-w-0 sm:px-4 sm:text-xs sm:font-medium sm:tracking-wider`}>
                                {formatTime(currentTime)} / {formatTime(duration)}
                            </div>
                        </div>

                        {/* Right Controls */}
                        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                            <button
                                onClick={() => seekBy(-SEEK_SECONDS)}
                                className={`${GLASS_BUTTON_CLASS} h-7 w-7 sm:h-10 sm:w-12`}
                                title="Back 5 seconds"
                            >
                                <SeekIcon direction="back" />
                            </button>
                            <button
                                onClick={() => seekBy(SEEK_SECONDS)}
                                className={`${GLASS_BUTTON_CLASS} h-7 w-7 sm:h-10 sm:w-12`}
                                title="Forward 5 seconds"
                            >
                                <SeekIcon direction="forward" />
                            </button>

                            <div className={`${GLASS_PANEL_CLASS} relative flex h-7 items-center gap-0 px-0 sm:h-10 sm:gap-1 sm:px-3`}>
                                {/* Settings Popover */}
                                {showSettings && (
                                    <div className="absolute bottom-full right-0 mb-3 w-44 bg-[#1A1A1A]/95 backdrop-blur-xl rounded-xl p-1 shadow-2xl border border-white/10 z-50">
                                        {settingsView !== 'main' && (
                                            <button
                                                onClick={() => setSettingsView('main')}
                                                className="mb-1.5 flex w-full items-center gap-2 border-b border-white/10 px-2 pb-1.5 pt-1 text-left text-xs font-semibold text-white"
                                            >
                                                <ChevronLeft className="h-3.5 w-3.5" />
                                                {settingsView === 'quality' ? 'Quality' : settingsView === 'server' ? 'Server' : 'Playback speed'}
                                            </button>
                                        )}

                                        {settingsView === 'main' && (
                                            <div className="flex flex-col gap-0.5">
                                                <button
                                                    onClick={() => hasDub && onAudioChange(selectedAudio === 'dub' ? 'sub' : 'dub')}
                                                    disabled={!hasDub}
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
                                                        <RedoIcon className="w-4 h-4" />
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
                                                    const streamIndex = isAutoOption
                                                        ? streams.findIndex((stream) => getMappedQuality(stream.quality) === 'Auto')
                                                        : streams.findIndex((stream) => getMappedQuality(stream.quality) === quality);
                                                    const isAvailable = isAutoOption || streamIndex >= 0;
                                                    const isSelected = isAutoOption ? isAutoQuality : (!isAutoQuality && currentQuality === quality);
                                                    return (
                                                        <button
                                                            key={quality}
                                                            onClick={() => handleQualitySelect(quality)}
                                                            disabled={!isAvailable}
                                                            className={`flex w-full items-center justify-between rounded-lg p-2 text-left transition-colors disabled:opacity-40 ${isSelected ? 'bg-white/15 text-white' : 'text-white/80 hover:bg-white/10'}`}
                                                        >
                                                            <span className="text-xs font-medium">{quality === 'Auto' ? 'Auto' : quality.replace('P', 'p')}</span>
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

                                <button onClick={() => { setShowSettings(!showSettings); setSettingsView('main'); }} className="rounded-full p-1.5 text-white transition-colors hover:bg-white/10 hover:text-white/80 sm:p-2">
                                    <Settings className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
                                </button>
                                <button onClick={handleCast} className="rounded-full p-1.5 text-white transition-colors hover:bg-white/10 hover:text-white/80 sm:p-2">
                                    <Cast className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
                                </button>
                                <button
                                    onClick={onToggleWide}
                                    className={`rounded-full p-1.5 text-white transition-colors sm:p-2 ${isWide ? 'bg-white/20 hover:bg-white/25' : 'hover:bg-white/10 hover:text-white/80'}`}
                                    title={isWide ? 'Show episodes' : 'Wide player'}
                                >
                                    <Monitor className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
                                </button>
                                <button onClick={toggleFullscreen} className="rounded-full p-1.5 text-white transition-colors hover:bg-white/10 hover:text-white/80 sm:p-2">
                                    {isFullscreen ? <Minimize className="h-3.5 w-3.5 sm:h-5 sm:w-5" /> : <Maximize className="h-3.5 w-3.5 sm:h-5 sm:w-5" />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

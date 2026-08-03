 
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import VideoPlayer, { type VideoPlayerProps } from '../components/VideoPlayer';

type PersistentPlayerContextValue = {
    registerPlayer: (props: VideoPlayerProps, watchUrl: string) => void;
    setInlinePlayerElement: (element: HTMLElement | null) => void;
};

const PersistentPlayerContext = createContext<PersistentPlayerContextValue | null>(null);

const MINI_PLAYER_WIDTH = 'min(430px, calc(100vw - 32px))';
const MINI_PLAYER_MARGIN = 24;

type MiniPosition = {
    x: number;
    y: number;
};

const getMiniSize = () => {
    const width = Math.min(430, Math.max(280, window.innerWidth - 32));
    return {
        width,
        height: width * 9 / 16,
    };
};

const clampMiniPosition = (position: MiniPosition, width: number, height: number): MiniPosition => ({
    x: Math.min(Math.max(16, position.x), Math.max(16, window.innerWidth - width - 16)),
    y: Math.min(Math.max(16, position.y), Math.max(16, window.innerHeight - height - 16)),
});

export function PersistentPlayerProvider({ children }: { children: ReactNode }) {
    const location = useLocation();
    const navigate = useNavigate();
    const [playerProps, setPlayerProps] = useState<VideoPlayerProps | null>(null);
    const [watchUrl, setWatchUrl] = useState('');
    const [inlineElement, setInlineElement] = useState<HTMLElement | null>(null);
    const [inlineRect, setInlineRect] = useState<DOMRect | null>(null);
    const [isClosed, setIsClosed] = useState(false);
    const [hasStartedPlayback, setHasStartedPlayback] = useState(false);
    const [miniPosition, setMiniPosition] = useState<MiniPosition | null>(null);
    const [miniSize, setMiniSize] = useState(() => getMiniSize());
    const watchUrlRef = useRef('');
    const dragRef = useRef<{
        pointerId: number;
        offsetX: number;
        offsetY: number;
        width: number;
        height: number;
    } | null>(null);

    const isWatchRoute = location.pathname.startsWith('/anime/details');
    const shouldShowMiniPlayer = Boolean(playerProps && !isClosed && hasStartedPlayback && !isWatchRoute);
    const shouldShowInlinePlayer = Boolean(playerProps && !isClosed && isWatchRoute);
    const shouldRenderPlayer = shouldShowMiniPlayer || shouldShowInlinePlayer;

    const updateInlineRect = useCallback(() => {
        if (!inlineElement) {
            setInlineRect(null);
            return;
        }
        const rect = inlineElement.getBoundingClientRect();
        setInlineRect({
            ...rect.toJSON(),
            top: rect.top + window.scrollY,
            left: rect.left + window.scrollX,
            width: rect.width,
            height: rect.height,
        } as DOMRect);
    }, [inlineElement]);

    useEffect(() => {
        const frameId = window.requestAnimationFrame(updateInlineRect);
        if (!inlineElement) {
            return () => window.cancelAnimationFrame(frameId);
        }

        const observer = new ResizeObserver(updateInlineRect);
        observer.observe(inlineElement);
        window.addEventListener('resize', updateInlineRect);
        window.addEventListener('scroll', updateInlineRect, { passive: true });

        return () => {
            window.cancelAnimationFrame(frameId);
            observer.disconnect();
            window.removeEventListener('resize', updateInlineRect);
            window.removeEventListener('scroll', updateInlineRect);
        };
    }, [inlineElement, updateInlineRect]);

    useEffect(() => {
        const handleResize = () => {
            const nextSize = getMiniSize();
            setMiniSize(nextSize);
            setMiniPosition((currentPosition) => (
                currentPosition ? clampMiniPosition(currentPosition, nextSize.width, nextSize.height) : currentPosition
            ));
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (!shouldShowMiniPlayer || miniPosition) return;
        const frameId = window.requestAnimationFrame(() => {
            setMiniPosition({
                x: window.innerWidth - miniSize.width - MINI_PLAYER_MARGIN,
                y: window.innerHeight - miniSize.height - MINI_PLAYER_MARGIN,
            });
        });
        return () => window.cancelAnimationFrame(frameId);
    }, [miniPosition, miniSize.height, miniSize.width, shouldShowMiniPlayer]);

    const registerPlayer = useCallback((props: VideoPlayerProps, nextWatchUrl: string) => {
        const previousWatchUrl = watchUrlRef.current;
        watchUrlRef.current = nextWatchUrl;
        setWatchUrl(nextWatchUrl);
        setPlayerProps((currentProps) => {
            const isSameIncomingStream = Boolean(
                currentProps?.streamUrl &&
                props.streamUrl &&
                currentProps.streamUrl === props.streamUrl
            );

            const isSameEpisode = Boolean(
                currentProps?.episodeSession &&
                props.episodeSession &&
                currentProps.episodeSession === props.episodeSession
            );

            const isIncomingStreamEmpty = !props.streamUrl && !props.isLoading;
            const isServerSwitchLoading = props.isLoading && isSameEpisode;

            // Preserve the active stream if:
            // 1. The incoming stream is exactly the same (prevents video flicker).
            // 2. The incoming state is totally empty (user navigated to a new page but didn't click an episode yet).
            // 3. The incoming state is loading the exact SAME episode (user switched servers/qualities, so keep playing in background).
            const shouldPreserveActiveStream = Boolean(
                currentProps?.streamUrl &&
                (isSameIncomingStream || isIncomingStreamEmpty || isServerSwitchLoading)
            );

            if (!shouldPreserveActiveStream || !currentProps) {
                return props;
            }

            return {
                ...props,
                streamUrl: currentProps.streamUrl,
                episodeSession: currentProps.episodeSession,
                isHls: currentProps.isHls,
                subtitles: currentProps.subtitles,
                isLoading: false,
                hasPlayableSource: currentProps.hasPlayableSource,
                streamExhausted: false,
                startAtSeconds: currentProps.startAtSeconds,
            };
        });
        setIsClosed(false);
    }, []);

    const handleMiniClose = useCallback(() => {
        setIsClosed(true);
        setHasStartedPlayback(false);
        setPlayerProps(null);
    }, []);

    const handleMiniExpand = useCallback(() => {
        if (watchUrl) {
            navigate(watchUrl);
        }
    }, [navigate, watchUrl]);

    const handleMiniPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
        if (!shouldShowMiniPlayer || event.button !== 0) return;

        const target = event.target as HTMLElement | null;
        if (target?.closest('button, input, select, textarea, a')) return;

        const rect = event.currentTarget.getBoundingClientRect();
        dragRef.current = {
            pointerId: event.pointerId,
            offsetX: event.clientX - rect.left,
            offsetY: event.clientY - rect.top,
            width: rect.width,
            height: rect.height,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
    }, [shouldShowMiniPlayer]);

    const handleMiniPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;

        setMiniPosition(clampMiniPosition({
            x: event.clientX - drag.offsetX,
            y: event.clientY - drag.offsetY,
        }, drag.width, drag.height));
    }, []);

    const handleMiniPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
        if (dragRef.current?.pointerId !== event.pointerId) return;
        dragRef.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
    }, []);

    const handlePlaybackStateChange = useCallback((state: { isPlaying: boolean }) => {
        if (state.isPlaying) {
            setHasStartedPlayback(true);
        }
    }, []);

    const contextValue = useMemo<PersistentPlayerContextValue>(() => ({
        registerPlayer,
        setInlinePlayerElement: setInlineElement,
    }), [registerPlayer]);

    const layerStyle = shouldShowMiniPlayer
        ? miniPosition
            ? {
                left: `${miniPosition.x}px`,
                top: `${miniPosition.y}px`,
                width: `${miniSize.width}px`,
                height: `${miniSize.height}px`,
            }
            : {
                bottom: '24px',
                right: '24px',
                width: MINI_PLAYER_WIDTH,
                aspectRatio: '16 / 9',
            }
        : inlineRect
            ? {
                left: `${inlineRect.left}px`,
                top: `${inlineRect.top}px`,
                width: `${inlineRect.width}px`,
                height: `${inlineRect.height}px`,
            }
            : undefined;

    return (
        <PersistentPlayerContext.Provider value={contextValue}>
            {children}
            {shouldRenderPlayer && playerProps && layerStyle && createPortal(
                <div
                    className={`${
                        shouldShowMiniPlayer
                            ? 'fixed z-[2147483646] cursor-grab rounded-xl shadow-2xl shadow-black/70 active:cursor-grabbing'
                            : 'absolute z-20 rounded-none md:rounded-2xl'
                    } overflow-hidden bg-black transition-[left,top,right,bottom,width,height,opacity,transform] duration-300 ease-out`}
                    style={layerStyle}
                    onPointerDown={handleMiniPointerDown}
                    onPointerMove={handleMiniPointerMove}
                    onPointerUp={handleMiniPointerUp}
                    onPointerCancel={handleMiniPointerUp}
                >
                    <VideoPlayer
                        {...playerProps}
                        displayMode={shouldShowMiniPlayer ? 'mini' : 'full'}
                        onMiniClose={handleMiniClose}
                        onMiniExpand={handleMiniExpand}
                        onPlaybackStateChange={handlePlaybackStateChange}
                    />
                </div>,
                document.body
            )}
        </PersistentPlayerContext.Provider>
    );
}

export function usePersistentPlayer() {
    const context = useContext(PersistentPlayerContext);
    if (!context) {
        throw new Error('usePersistentPlayer must be used within PersistentPlayerProvider');
    }
    return context;
}

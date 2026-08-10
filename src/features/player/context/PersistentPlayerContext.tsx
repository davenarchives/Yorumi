import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import VideoPlayer, { type VideoPlayerProps } from '../components/VideoPlayer';

type PersistentPlayerContextValue = {
    registerPlayer: (props: VideoPlayerProps, watchUrl: string, watchState?: any) => void;
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
    const [watchState, setWatchState] = useState<any>(null);
    const [inlineElement, setInlineElement] = useState<HTMLElement | null>(null);
    const [inlineRect, setInlineRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
    const [isClosed, setIsClosed] = useState(false);
    const [miniPosition, setMiniPosition] = useState<MiniPosition | null>(null);
    const [miniSize, setMiniSize] = useState(() => getMiniSize());
    const watchUrlRef = useRef('');
    const watchStateRef = useRef<any>(null);
    const lastPlaybackTimeRef = useRef<{ session?: string; time: number }>({ time: 0 });
    const dragRef = useRef<{
        pointerId: number;
        offsetX: number;
        offsetY: number;
        width: number;
        height: number;
    } | null>(null);

    const isWatchRoute = location.pathname.startsWith('/anime/details');
    const hasPlayer = Boolean(playerProps && (playerProps.streamUrl || playerProps.isLoading || playerProps.isServerSwitching));
    const isInlineAvailable = Boolean(isWatchRoute && inlineElement && document.body.contains(inlineElement));

    useEffect(() => {
        if (!isInlineAvailable || !inlineElement) {
            setInlineRect(null);
            return;
        }

        const updateRect = () => {
            if (!inlineElement || !document.body.contains(inlineElement)) return;
            const rect = inlineElement.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                setInlineRect({
                    left: rect.left + window.scrollX,
                    top: rect.top + window.scrollY,
                    width: rect.width,
                    height: rect.height,
                });
            }
        };

        updateRect();

        window.addEventListener('resize', updateRect, { passive: true });

        const resizeObserver = new ResizeObserver(updateRect);
        resizeObserver.observe(inlineElement);

        return () => {
            window.removeEventListener('resize', updateRect);
            resizeObserver.disconnect();
        };
    }, [isInlineAvailable, inlineElement]);

    const isInlineMode = Boolean(isInlineAvailable && inlineRect);
    const shouldShowInlinePlayer = Boolean(hasPlayer && !isClosed && isInlineAvailable);
    const shouldShowMiniPlayer = Boolean(hasPlayer && !isClosed && !isInlineAvailable && playerProps?.streamUrl);
    const shouldRenderPlayer = shouldShowMiniPlayer || shouldShowInlinePlayer;

    const effectivePlayerProps = useMemo(() => {
        if (!playerProps) return null;
        const sameSessionTime = lastPlaybackTimeRef.current.session === playerProps.episodeSession
            ? lastPlaybackTimeRef.current.time
            : 0;

        const effectiveStartAt = (playerProps.startAtSeconds && playerProps.startAtSeconds > sameSessionTime)
            ? playerProps.startAtSeconds
            : (sameSessionTime > 0 ? sameSessionTime : playerProps.startAtSeconds);

        return {
            ...playerProps,
            startAtSeconds: effectiveStartAt,
            onProgress: (progress: { currentTime: number; duration: number; ended?: boolean }) => {
                if (progress.currentTime > 0) {
                    lastPlaybackTimeRef.current = {
                        session: playerProps.episodeSession,
                        time: progress.currentTime,
                    };
                }
                playerProps.onProgress?.(progress);
            },
        };
    }, [playerProps]);

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

    const registerPlayer = useCallback((props: VideoPlayerProps, nextWatchUrl: string, nextWatchState?: any) => {
        watchUrlRef.current = nextWatchUrl;
        setWatchUrl(nextWatchUrl);
        if (nextWatchState !== undefined) {
            watchStateRef.current = nextWatchState;
            setWatchState(nextWatchState);
        }
        setPlayerProps((currentProps) => {
            if (!currentProps) return props;

            const currentEpNum = Number(currentProps.episodeNumber);
            const incomingEpNum = Number(props.episodeNumber);

            const isDifferentNumericId = (idA?: string, idB?: string): boolean => {
                const a = String(idA || '').trim();
                const b = String(idB || '').trim();
                if (!a || !b) return false;
                return /^\d+$/.test(a) && /^\d+$/.test(b) && a !== b;
            };

            const cleanA = (currentProps.animeTitle || '').trim().toLowerCase();
            const cleanB = (props.animeTitle || '').trim().toLowerCase();
            const titleMatches = Boolean(cleanA && cleanB && (
                cleanA === cleanB ||
                cleanA.includes(cleanB) ||
                cleanB.includes(cleanA)
            ));

            const isSameAnime = Boolean(
                (currentProps.animeId && props.animeId && (
                    currentProps.animeId === props.animeId ||
                    !isDifferentNumericId(currentProps.animeId, props.animeId)
                )) ||
                titleMatches
            );

            const isSameEpisode = Boolean(
                (currentProps.episodeSession && props.episodeSession && currentProps.episodeSession === props.episodeSession) ||
                (isSameAnime && Number.isFinite(currentEpNum) && Number.isFinite(incomingEpNum) && currentEpNum === incomingEpNum)
            );

            if (!isSameEpisode) {
                lastPlaybackTimeRef.current = { time: 0 };
                return props;
            }

            if (isSameEpisode && currentProps.streamUrl) {
                if (props.streamUrl && props.streamUrl !== currentProps.streamUrl && !props.isLoading) {
                    return props;
                }

                return {
                    ...props,
                    streamUrl: currentProps.streamUrl,
                    episodeSession: currentProps.episodeSession || props.episodeSession,
                    isHls: currentProps.isHls,
                    subtitles: currentProps.subtitles,
                    isLoading: false,
                    hasPlayableSource: currentProps.hasPlayableSource,
                    streamExhausted: false,
                };
            }

            return props;
        });
        setIsClosed(false);
    }, []);

    const handleMiniClose = useCallback(() => {
        setIsClosed(true);
        setPlayerProps(null);
    }, []);

    const handleMiniExpand = useCallback(() => {
        const targetUrl = watchUrlRef.current || watchUrl;
        const targetState = watchStateRef.current || watchState;
        if (targetUrl) {
            navigate(targetUrl, { state: targetState });
        }
    }, [navigate, watchUrl, watchState]);

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

    const contextValue = useMemo<PersistentPlayerContextValue>(() => ({
        registerPlayer,
        setInlinePlayerElement: setInlineElement,
    }), [registerPlayer]);

    const containerStyle: React.CSSProperties | undefined = shouldRenderPlayer
        ? (isInlineMode && inlineRect
            ? {
                position: 'absolute',
                left: `${inlineRect.left}px`,
                top: `${inlineRect.top}px`,
                width: `${inlineRect.width}px`,
                height: `${inlineRect.height}px`,
                zIndex: 40,
                borderRadius: '1rem',
                overflow: 'hidden',
            }
            : (miniPosition
                ? {
                    position: 'fixed',
                    left: `${miniPosition.x}px`,
                    top: `${miniPosition.y}px`,
                    width: `${miniSize.width}px`,
                    height: `${miniSize.height}px`,
                    zIndex: 2147483646,
                    borderRadius: '0.75rem',
                    overflow: 'hidden',
                }
                : {
                    position: 'fixed',
                    bottom: '24px',
                    right: '24px',
                    width: MINI_PLAYER_WIDTH,
                    aspectRatio: '16 / 9',
                    zIndex: 2147483646,
                    borderRadius: '0.75rem',
                    overflow: 'hidden',
                }))
        : undefined;

    return (
        <PersistentPlayerContext.Provider value={contextValue}>
            {children}
            {shouldRenderPlayer && effectivePlayerProps && containerStyle && createPortal(
                <div
                    className={`shadow-2xl shadow-black/80 bg-black transition-[border-radius] duration-200 ease-out ${
                        isInlineMode ? 'absolute z-40' : 'fixed cursor-grab active:cursor-grabbing z-[2147483646]'
                    }`}
                    style={containerStyle}
                    onPointerDown={!isInlineMode ? handleMiniPointerDown : undefined}
                    onPointerMove={!isInlineMode ? handleMiniPointerMove : undefined}
                    onPointerUp={!isInlineMode ? handleMiniPointerUp : undefined}
                    onPointerCancel={!isInlineMode ? handleMiniPointerUp : undefined}
                >
                    <VideoPlayer
                        {...effectivePlayerProps}
                        displayMode={isInlineMode ? 'full' : 'mini'}
                        onMiniClose={handleMiniClose}
                        onMiniExpand={handleMiniExpand}
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

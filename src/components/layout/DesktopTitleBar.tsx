import { useEffect, useState, useMemo, useRef } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { Bell, CheckCheck, MessageCircle, ArrowDownToLine } from 'lucide-react';
import { isTauri } from '../../platform/runtime';
const yorumiIcon = '/yorumi-icon.png';
import { useWatchlistNotifications } from '../../hooks/useWatchlistNotifications';
import { useAppUpdater } from '../../hooks/useAppUpdater';
import GlobalChatDrawer from '../shared/GlobalChatDrawer';
import DiscordInviteModal, { DiscordBrandIcon } from '../shared/DiscordInviteModal';

interface DesktopTitleBarProps {
    className?: string;
    title?: string;
}

export default function DesktopTitleBar({ className = '', title }: DesktopTitleBarProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const navigationType = useNavigationType();
    const [isMaximized, setIsMaximized] = useState(false);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isDiscordOpen, setIsDiscordOpen] = useState(false);
    const [isUpdateOpen, setIsUpdateOpen] = useState(false);
    const notificationsRef = useRef<HTMLDivElement>(null);
    const updateRef = useRef<HTMLDivElement>(null);

    // Clean, loop-free in-app navigation stack (deduplicates consecutive URLs and replaces redirects in-place)
    type HistoryEntry = { path: string; pathname: string; state: unknown };
    const initialPath = `${location.pathname}${location.search}`;
    const historyStackRef = useRef<HistoryEntry[]>([
        { path: initialPath, pathname: location.pathname, state: location.state },
    ]);
    const historyIndexRef = useRef<number>(0);
    const internalNavTargetRef = useRef<string | null>(null);
    const [navBounds, setNavBounds] = useState({ canGoBack: false, canGoForward: false });

    const syncNavBounds = () => {
        const idx = historyIndexRef.current;
        const len = historyStackRef.current.length;
        setNavBounds((prev) => {
            const next = { canGoBack: idx > 0, canGoForward: idx < len - 1 };
            return prev.canGoBack === next.canGoBack && prev.canGoForward === next.canGoForward ? prev : next;
        });
    };

    useEffect(() => {
        const currentPath = `${location.pathname}${location.search}`;
        const stack = historyStackRef.current;
        const idx = historyIndexRef.current;

        // If this route change was initiated by our own Back/Forward buttons, don't re-push it
        if (internalNavTargetRef.current !== null) {
            const expected = internalNavTargetRef.current;
            internalNavTargetRef.current = null;
            if (expected === currentPath) {
                if (stack[idx]) {
                    stack[idx] = { path: currentPath, pathname: location.pathname, state: location.state };
                }
                syncNavBounds();
                return;
            }
            // Route redirected after Back/Forward (e.g. canonical URL): update entry in-place so it won't loop
            if (stack[idx]) {
                stack[idx] = { path: currentPath, pathname: location.pathname, state: location.state };
            }
            syncNavBounds();
            return;
        }

        const currentEntry = stack[idx];
        if (currentEntry && currentEntry.path === currentPath) {
            stack[idx] = { path: currentPath, pathname: location.pathname, state: location.state };
            syncNavBounds();
            return;
        }

        if (navigationType === 'REPLACE' || (currentEntry && currentEntry.pathname === location.pathname)) {
            // Replace in-place for redirects and same-page query updates (e.g. ?ep=1 -> ?ep=2)
            // so clicking Back goes to the previous page rather than looping through query states.
            stack[idx] = { path: currentPath, pathname: location.pathname, state: location.state };
        } else if (navigationType === 'POP') {
            if (idx > 0 && stack[idx - 1]?.path === currentPath) {
                historyIndexRef.current = idx - 1;
            } else if (idx < stack.length - 1 && stack[idx + 1]?.path === currentPath) {
                historyIndexRef.current = idx + 1;
            } else {
                const truncated = stack.slice(0, idx + 1);
                truncated.push({ path: currentPath, pathname: location.pathname, state: location.state });
                historyStackRef.current = truncated.slice(-50);
                historyIndexRef.current = historyStackRef.current.length - 1;
            }
        } else {
            const truncated = stack.slice(0, idx + 1);
            truncated.push({ path: currentPath, pathname: location.pathname, state: location.state });
            historyStackRef.current = truncated.slice(-50);
            historyIndexRef.current = historyStackRef.current.length - 1;
        }

        syncNavBounds();
    }, [location.pathname, location.search, location.state, navigationType]);
    const updater = useAppUpdater();
    const {
        notifications,
        unreadCount,
        loading: notificationsLoading,
        markAsRead,
        markAllRead,
    } = useWatchlistNotifications();

    useEffect(() => {
        if (!isUpdateOpen) return;
        const onPointerDown = (e: PointerEvent) => {
            if (!updateRef.current?.contains(e.target as Node)) {
                setIsUpdateOpen(false);
            }
        };
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsUpdateOpen(false);
        };
        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [isUpdateOpen]);

    useEffect(() => {
        if (!isNotificationsOpen) return;
        const onPointerDown = (e: PointerEvent) => {
            if (!notificationsRef.current?.contains(e.target as Node)) {
                setIsNotificationsOpen(false);
            }
        };
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsNotificationsOpen(false);
        };
        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [isNotificationsOpen]);
    const [docTitle, setDocTitle] = useState(() => (typeof document !== 'undefined' ? document.title : ''));

    // Track document title updates so titlebar reflects current media title
    useEffect(() => {
        if (typeof document === 'undefined') return;

        const updateTitle = () => {
            setDocTitle(document.title);
        };

        const titleEl = document.querySelector('title');
        let observer: MutationObserver | undefined;

        if (titleEl) {
            observer = new MutationObserver(updateTitle);
            observer.observe(titleEl, { childList: true, subtree: true, characterData: true });
        }

        window.addEventListener('focus', updateTitle);

        return () => {
            observer?.disconnect();
            window.removeEventListener('focus', updateTitle);
        };
    }, []);

    // Track window maximize state in Tauri
    useEffect(() => {
        if (!isTauri()) return;

        let unlisten: (() => void) | undefined;

        const init = async () => {
            try {
                const { getCurrentWindow } = await import('@tauri-apps/api/window');
                const win = getCurrentWindow();
                const maximized = await win.isMaximized();
                setIsMaximized(maximized);

                unlisten = await win.onResized(async () => {
                    try {
                        const max = await win.isMaximized();
                        setIsMaximized(max);
                    } catch {
                        // ignore
                    }
                });
            } catch (err) {
                console.warn('[DesktopTitleBar] Window state listener error:', err);
            }
        };

        void init();

        return () => {
            unlisten?.();
        };
    }, []);

    // Format current location title (Discord-like channel/context label)
    const pageContext = useMemo(() => {
        const path = location.pathname;
        if (path === '/' || path === '/anime') return 'Anime';
        if (path.startsWith('/explore')) return 'Explore';
        if (path.startsWith('/library')) return 'Library';
        if (path.startsWith('/profile')) return 'Profile';
        if (path.startsWith('/search')) return 'Search';
        if (path.startsWith('/manga/read/')) return 'Reading Manga';
        if (path.startsWith('/ln/read/')) return 'Reading Light Novel';

        if (path.startsWith('/anime/details/')) {
            const locState = location.state as {
                anime?: { title?: string; title_english?: string; title_romaji?: string };
                animeTitle?: string;
            } | null;
            const stateTitle =
                locState?.anime?.title_english ||
                locState?.anime?.title ||
                locState?.anime?.title_romaji ||
                locState?.animeTitle;
            if (stateTitle) return stateTitle;

            if (docTitle && !docTitle.toLowerCase().startsWith('yorumi') && docTitle !== 'Yorumi') {
                const clean = docTitle.replace(/\s*[•-]\s*Yorumi.*$/i, '').trim();
                if (clean) return clean;
            }
            return 'Anime Details';
        }

        if (path.startsWith('/manga/details/')) {
            const locState = location.state as { manga?: { title?: string }; mangaTitle?: string } | null;
            const stateTitle = locState?.manga?.title || locState?.mangaTitle;
            if (stateTitle) return stateTitle;

            if (docTitle && !docTitle.toLowerCase().startsWith('yorumi') && docTitle !== 'Yorumi') {
                const clean = docTitle.replace(/\s*[•-]\s*Yorumi.*$/i, '').trim();
                if (clean) return clean;
            }
            return 'Manga Details';
        }

        if (path.startsWith('/ln/details/')) {
            const locState = location.state as { novel?: { title?: string }; lnTitle?: string; ln?: { title?: string } } | null;
            const stateTitle = locState?.novel?.title || locState?.lnTitle || locState?.ln?.title;
            if (stateTitle) return stateTitle;

            if (docTitle && !docTitle.toLowerCase().startsWith('yorumi') && docTitle !== 'Yorumi') {
                const clean = docTitle.replace(/\s*[•-]\s*Yorumi.*$/i, '').trim();
                if (clean) return clean;
            }
            return 'Light Novel Details';
        }

        if (path.startsWith('/manga')) return 'Manga';
        if (path.startsWith('/ln')) return 'Light Novels';
        if (path.startsWith('/anime/studio/')) return 'Studio Catalogue';
        if (path.startsWith('/genre/')) return 'Genre';
        return 'Yorumi';
    }, [location.pathname, location.state, docTitle]);

    const handleBack = () => {
        const idx = historyIndexRef.current;
        if (idx <= 0) return;
        const nextIdx = idx - 1;
        const target = historyStackRef.current[nextIdx];
        if (!target) return;
        historyIndexRef.current = nextIdx;
        internalNavTargetRef.current = target.path;
        syncNavBounds();
        navigate(target.path, { replace: true, state: target.state });
    };

    const handleForward = () => {
        const idx = historyIndexRef.current;
        const stack = historyStackRef.current;
        if (idx >= stack.length - 1) return;
        const nextIdx = idx + 1;
        const target = stack[nextIdx];
        if (!target) return;
        historyIndexRef.current = nextIdx;
        internalNavTargetRef.current = target.path;
        syncNavBounds();
        navigate(target.path, { replace: true, state: target.state });
    };

    const handleMinimize = async () => {
        if (isTauri()) {
            try {
                const { getCurrentWindow } = await import('@tauri-apps/api/window');
                await getCurrentWindow().minimize();
            } catch (err) {
                console.error('[DesktopTitleBar] Minimize failed:', err);
            }

        }
    };

    const handleToggleMaximize = async () => {
        if (isTauri()) {
            try {
                const { getCurrentWindow } = await import('@tauri-apps/api/window');
                await getCurrentWindow().toggleMaximize();
                const max = await getCurrentWindow().isMaximized();
                setIsMaximized(max);
            } catch (err) {
                console.error('[DesktopTitleBar] Toggle maximize failed:', err);
            }

        }
    };

    const handleClose = async () => {
        if (isTauri()) {
            try {
                const { getCurrentWindow } = await import('@tauri-apps/api/window');
                await getCurrentWindow().close();
            } catch (err) {
                console.error('[DesktopTitleBar] Close failed:', err);
            }
        } else {
            window.close();
        }
    };

    const noDragStyle = { WebkitAppRegion: 'no-drag' } as React.CSSProperties;
    const dragStyle = { WebkitAppRegion: 'drag' } as React.CSSProperties;

    return (
        <header
            data-tauri-drag-region
            style={dragStyle}
            className={`fixed top-0 left-0 right-0 h-8 z-[99999] bg-[#0c0d10] border-b border-white/[0.05] flex items-center justify-between select-none ${className}`}
        >
            {/* Left: Discord-style Navigation Arrows */}
            <div
                className="flex items-center gap-0.5 pl-2 h-full"
                data-tauri-drag-region="false"
                style={noDragStyle}
            >
                <button
                    type="button"
                    onClick={handleBack}
                    disabled={!navBounds.canGoBack}
                    title="Back"
                    aria-label="Back"
                    data-tauri-drag-region="false"
                    style={noDragStyle}
                    className="w-6 h-6 flex items-center justify-center rounded text-neutral-400 hover:text-white hover:bg-white/10 active:bg-white/15 transition-colors focus:outline-none disabled:opacity-30 disabled:cursor-default disabled:hover:text-neutral-400 disabled:hover:bg-transparent"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m15 18-6-6 6-6" />
                    </svg>
                </button>
                <button
                    type="button"
                    onClick={handleForward}
                    disabled={!navBounds.canGoForward}
                    title="Forward"
                    aria-label="Forward"
                    data-tauri-drag-region="false"
                    style={noDragStyle}
                    className="w-6 h-6 flex items-center justify-center rounded text-neutral-400 hover:text-white hover:bg-white/10 active:bg-white/15 transition-colors focus:outline-none disabled:opacity-30 disabled:cursor-default disabled:hover:text-neutral-400 disabled:hover:bg-transparent"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m9 18 6-6-6-6" />
                    </svg>
                </button>
            </div>

            {/* Center/Draggable Space with Fixed True-Center Context Pill */}
            <div
                data-tauri-drag-region
                style={dragStyle}
                className="flex-1 h-full pointer-events-auto"
            />
            <div
                data-tauri-drag-region
                style={dragStyle}
                className="pointer-events-none absolute left-1/2 top-0 bottom-0 -translate-x-1/2 flex items-center justify-center max-w-[45vw] select-none"
            >
                <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-300 max-w-full">
                    <img src={yorumiIcon} alt="" className="w-3.5 h-3.5 shrink-0 object-contain opacity-85" />
                    <span className="truncate">{title || pageContext}</span>
                </div>
            </div>

            {/* Right: Updater + Chat + Notifications + Discord-style Window Controls */}
            <div
                className="flex items-center h-full"
                data-tauri-drag-region="false"
                style={noDragStyle}
            >
                {/* Discord-style Green Auto-Updater Button (opens the unified AppUpdateModal) */}
                {updater.updateAvailable && (
                    <div ref={updateRef} className="relative flex items-center h-full">
                        <button
                            type="button"
                            onClick={() => {
                                setIsChatOpen(false);
                                setIsNotificationsOpen(false);
                                setIsUpdateOpen(false);
                                window.dispatchEvent(new Event('yorumi-open-update-modal'));
                            }}
                            title={`Update Ready (v${updater.latestVersion})`}
                            aria-label={`Update Ready (v${updater.latestVersion})`}
                            data-tauri-drag-region="false"
                            style={noDragStyle}
                            className="relative w-8 h-6 flex items-center justify-center rounded transition-colors focus:outline-none cursor-pointer text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/15"
                        >
                            <ArrowDownToLine className={`w-3.5 h-3.5 ${updater.status === 'downloading' ? 'animate-bounce' : ''}`} />
                            <span className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        </button>
                    </div>
                )}

                {/* Discord Community Invite Button */}
                <button
                    type="button"
                    onClick={() => {
                        setIsUpdateOpen(false);
                        setIsNotificationsOpen(false);
                        setIsChatOpen(false);
                        setIsDiscordOpen(true);
                    }}
                    title="Join us on Discord"
                    aria-label="Join us on Discord"
                    data-tauri-drag-region="false"
                    style={noDragStyle}
                    className={`w-8 h-6 flex items-center justify-center rounded transition-colors focus:outline-none cursor-pointer ${
                        isDiscordOpen
                            ? 'text-white bg-white/15'
                            : 'text-neutral-400 hover:text-white hover:bg-white/10'
                    }`}
                >
                    <DiscordBrandIcon className="w-3.5 h-3.5" />
                </button>

                {/* Global Discord Chat Button */}
                <button
                    type="button"
                    onClick={() => {
                        setIsUpdateOpen(false);
                        setIsNotificationsOpen(false);
                        setIsChatOpen((open) => !open);
                    }}
                    title="Global Chat"
                    aria-label="Global Chat"
                    data-tauri-drag-region="false"
                    style={noDragStyle}
                    className={`w-8 h-6 flex items-center justify-center rounded transition-colors focus:outline-none cursor-pointer ${
                        isChatOpen
                            ? 'text-white bg-white/15'
                            : 'text-neutral-400 hover:text-white hover:bg-white/10'
                    }`}
                >
                    <MessageCircle className="w-3.5 h-3.5" />
                </button>

                {/* Watchlist Episode Notifications */}
                <div ref={notificationsRef} className="relative flex items-center h-full">
                    <button
                        type="button"
                        onClick={() => {
                            setIsUpdateOpen(false);
                            setIsChatOpen(false);
                            setIsNotificationsOpen((open) => !open);
                        }}
                        title="Watchlist Episode Updates"
                        aria-label="Watchlist Episode Updates"
                        data-tauri-drag-region="false"
                        style={noDragStyle}
                        className={`relative w-8 h-6 flex items-center justify-center rounded transition-colors focus:outline-none cursor-pointer ${
                            isNotificationsOpen
                                ? 'text-white bg-white/15'
                                : 'text-neutral-400 hover:text-white hover:bg-white/10'
                        }`}
                    >
                        <Bell className="w-3.5 h-3.5" />
                        {unreadCount > 0 && (
                            <span className="absolute top-1 right-1.5 h-1.5 w-1.5 rounded-full bg-yorumi-accent" />
                        )}
                    </button>

                    {isNotificationsOpen && (
                        <div
                            data-tauri-drag-region="false"
                            style={noDragStyle}
                            className="fixed right-3 top-10 z-[100000] w-[340px] max-w-[calc(100vw-24px)] overflow-hidden rounded-2xl border border-white/10 bg-[#0d0e12]/80 backdrop-blur-2xl shadow-2xl shadow-black/80"
                        >
                            <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5 border-b border-white/[0.06]">
                                <div className="flex items-center gap-2">
                                    <span className="text-[14px] font-bold text-white tracking-tight">
                                        Updates
                                    </span>
                                    {unreadCount > 0 && (
                                        <span className="rounded-full bg-yorumi-accent/20 px-2 py-0.5 text-[11px] font-bold text-yorumi-accent">
                                            {unreadCount}
                                        </span>
                                    )}
                                </div>
                                {unreadCount > 0 && (
                                    <button
                                        type="button"
                                        onClick={markAllRead}
                                        title="Mark all read"
                                        className="flex h-7 w-7 items-center justify-center rounded-full text-white/75 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                                    >
                                        <CheckCheck className="h-4 w-4" />
                                    </button>
                                )}
                            </div>

                            <div className="max-h-80 overflow-y-auto custom-scrollbar divide-y divide-white/[0.05]">
                                {notifications.length === 0 ? (
                                    <div className="px-4 py-8 text-center text-xs text-white/50">
                                        {notificationsLoading
                                            ? 'Checking watchlist for new episodes…'
                                            : 'You’re all caught up on your watchlist!'}
                                    </div>
                                ) : (
                                    notifications.map((notif) => (
                                        <button
                                            key={notif.id}
                                            type="button"
                                            onClick={() => {
                                                markAsRead(notif.anilistId, notif.latestEpisode);
                                                setIsNotificationsOpen(false);
                                                navigate(`/anime/details/al-${notif.anilistId}`);
                                            }}
                                            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.06] transition-colors cursor-pointer"
                                        >
                                            <div className="h-12 w-9 shrink-0 overflow-hidden rounded-lg bg-white/5">
                                                {notif.image && (
                                                    <img src={notif.image} alt={notif.title} className="h-full w-full object-cover" />
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5">
                                                    {notif.unread && (
                                                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-yorumi-accent" />
                                                    )}
                                                    <p className="truncate text-[13px] font-bold text-white">
                                                        {notif.title}
                                                    </p>
                                                </div>
                                                <p className="mt-0.5 text-[12px] font-medium text-yorumi-accent">
                                                    Episode {notif.latestEpisode} is out
                                                    {notif.watchedEpisode > 0 ? ` · Watched Ep ${notif.watchedEpisode}` : ''}
                                                </p>
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="w-[1px] h-3.5 bg-white/10 mx-1 shrink-0" />

                {/* Minimize Button */}
                <button
                    type="button"
                    onClick={handleMinimize}
                    title="Minimize"
                    aria-label="Minimize"
                    data-tauri-drag-region="false"
                    style={noDragStyle}
                    className="w-9 h-full flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/10 active:bg-white/15 transition-colors focus:outline-none"
                >
                    <div className="w-2.5 h-[1.5px] bg-current rounded-full" />
                </button>

                {/* Maximize / Restore Button */}
                <button
                    type="button"
                    onClick={handleToggleMaximize}
                    title={isMaximized ? 'Restore' : 'Maximize'}
                    aria-label={isMaximized ? 'Restore' : 'Maximize'}
                    data-tauri-drag-region="false"
                    style={noDragStyle}
                    className="w-9 h-full flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/10 active:bg-white/15 transition-colors focus:outline-none"
                >
                    {isMaximized ? (
                        <div className="relative w-2.5 h-2.5">
                            <div className="absolute top-0 right-0 w-2 h-2 border-[1.2px] border-current rounded-[0.5px]" />
                            <div className="absolute bottom-0 left-0 w-2 h-2 border-[1.2px] border-current bg-[#0c0d10] rounded-[0.5px]" />
                        </div>
                    ) : (
                        <div className="w-2.5 h-2.5 border-[1.3px] border-current rounded-[1px]" />
                    )}
                </button>

                {/* Close Button */}
                <button
                    type="button"
                    onClick={handleClose}
                    title="Close"
                    aria-label="Close"
                    data-tauri-drag-region="false"
                    style={noDragStyle}
                    className="w-10 h-full flex items-center justify-center text-neutral-400 hover:text-white hover:bg-[#e81123] active:bg-[#c90f1f] transition-colors focus:outline-none"
                >
                    <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
                        <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" />
                    </svg>
                </button>
            </div>
            <GlobalChatDrawer isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
            <DiscordInviteModal isOpen={isDiscordOpen} onClose={() => setIsDiscordOpen(false)} />
        </header>
    );
}

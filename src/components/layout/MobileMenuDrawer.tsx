import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    BarChart3,
    Bell,
    ChevronRight,
    Clock,
    CloudOff,
    Download,
    EyeOff,
    HardDrive,
    Info,
    MessageCircle,
    Settings,
} from 'lucide-react';
import { useAppPrefs } from '../../utils/appPrefs';
import { useDownloads } from '../../hooks/useDownloads';
import { useMangaDownloads } from '../../hooks/useMangaDownloads';
import { useLNDownloads } from '../../hooks/useLNDownloads';
import { useWatchlistNotifications } from '../../hooks/useWatchlistNotifications';
import { DiscordBrandIcon } from '../shared/DiscordInviteModal';
import { resetMobileShellShift, shiftMobileShell } from '../../utils/screenShift';
import { isMobileShell } from '../../platform/runtime';
import {
    AboutPage,
    DataStoragePage,
    DownloadQueuePage,
    HistoryPage,
    MenuDrawerEmbeddedContext,
    SettingsPage,
    StatisticsPage,
    UpdatesPage,
} from '../../pages/MenuPages';

export type DesktopSubpageId =
    | 'updates'
    | 'download-queue'
    | 'history'
    | 'statistics'
    | 'storage'
    | 'settings'
    | 'about';

export interface PendingMenuSubpage {
    subpage: DesktopSubpageId;
    tab?: string;
    nonce: number;
}

interface MobileMenuDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    onOpenDiscord: () => void;
    onOpenChat?: () => void;
    pendingSubpage?: PendingMenuSubpage | null;
}

const DRAWER_TRANSITION_MS = 220;
const DRAWER_EASING = 'cubic-bezier(0.25, 1, 0.5, 1)';
let reopenWithoutAnimation = false;

const getDrawerWidth = () =>
    typeof window !== 'undefined' ? Math.min(Math.round(window.innerWidth * 0.84), 340) : 320;

export default function MobileMenuDrawer({
    isOpen,
    onClose,
    onOpenDiscord,
    onOpenChat,
    pendingSubpage,
}: MobileMenuDrawerProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const { downloadedOnly, setDownloadedOnly, incognitoMode, setIncognitoMode } = useAppPrefs();
    const { activeDownloads: activeAnimeDownloads } = useDownloads();
    const { activeDownloads: activeMangaDownloads } = useMangaDownloads();
    const { activeDownloads: activeLNDownloads } = useLNDownloads();
    const { unreadCount } = useWatchlistNotifications();

    const shouldSkipOpenAnimRef = useRef(isOpen && reopenWithoutAnimation);
    if (shouldSkipOpenAnimRef.current && reopenWithoutAnimation) {
        reopenWithoutAnimation = false;
    }

    const [rendered, setRendered] = useState(isOpen);
    const [visible, setVisible] = useState(() => isOpen && shouldSkipOpenAnimRef.current);
    const [activeSubpage, setActiveSubpage] = useState<DesktopSubpageId | null>(null);
    const [subpageVisible, setSubpageVisible] = useState(false);
    const subpageCloseTimerRef = useRef<number | null>(null);
    const prevPathRef = useRef(location.pathname);

    // Close desktop drawer automatically if user clicks a media link inside Updates / History
    useEffect(() => {
        if (prevPathRef.current !== location.pathname) {
            prevPathRef.current = location.pathname;
            if (isOpen && typeof window !== 'undefined' && window.innerWidth >= 768) {
                onClose();
            }
        }
    }, [location.pathname, isOpen, onClose]);

    // Clear subpage state when main drawer finishes closing
    useEffect(() => {
        if (!isOpen) {
            setSubpageVisible(false);
            const t = window.setTimeout(() => setActiveSubpage(null), DRAWER_TRANSITION_MS);
            return () => window.clearTimeout(t);
        }
    }, [isOpen]);

    // Open a specific subpage directly when requested (e.g. "Show entry" notification on tablet)
    useEffect(() => {
        if (!isOpen || !pendingSubpage) return;
        if (typeof window !== 'undefined' && window.innerWidth >= 768) {
            if (subpageCloseTimerRef.current !== null) {
                window.clearTimeout(subpageCloseTimerRef.current);
                subpageCloseTimerRef.current = null;
            }
            setActiveSubpage(pendingSubpage.subpage);
            setSubpageVisible(false);
            window.requestAnimationFrame(() => {
                window.requestAnimationFrame(() => setSubpageVisible(true));
            });
        }
    }, [isOpen, pendingSubpage]);

    const openDesktopSubpage = (subpage: DesktopSubpageId) => {
        if (subpageCloseTimerRef.current !== null) {
            window.clearTimeout(subpageCloseTimerRef.current);
            subpageCloseTimerRef.current = null;
        }
        setActiveSubpage(subpage);
        setSubpageVisible(false);
        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => setSubpageVisible(true));
        });
    };

    const closeDesktopSubpage = () => {
        setSubpageVisible(false);
        if (subpageCloseTimerRef.current !== null) {
            window.clearTimeout(subpageCloseTimerRef.current);
        }
        subpageCloseTimerRef.current = window.setTimeout(() => {
            subpageCloseTimerRef.current = null;
            setActiveSubpage(null);
        }, DRAWER_TRANSITION_MS);
    };

    const scrimRef = useRef<HTMLDivElement>(null);
    const drawerRef = useRef<HTMLElement>(null);
    const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
    const swipeLockRef = useRef<'none' | 'horizontal' | 'vertical'>('none');
    const dragXRef = useRef(0);

    useEffect(() => {
        if (isOpen) {
            setRendered(true);
            dragXRef.current = 0;
            if (shouldSkipOpenAnimRef.current) {
                setVisible(true);
                const timer = window.setTimeout(() => {
                    shouldSkipOpenAnimRef.current = false;
                }, 50);
                return () => window.clearTimeout(timer);
            }
            const raf = window.requestAnimationFrame(() => {
                window.requestAnimationFrame(() => setVisible(true));
            });
            return () => window.cancelAnimationFrame(raf);
        } else {
            shouldSkipOpenAnimRef.current = false;
            setVisible(false);
            const timer = window.setTimeout(() => {
                setRendered(false);
                dragXRef.current = 0;
            }, DRAWER_TRANSITION_MS);
            return () => window.clearTimeout(timer);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [isOpen, onClose]);

    const isDesktopViewport = typeof window !== 'undefined' && window.innerWidth >= 768;

    // TikTok-style unified push of whole screen + bottom navbar + top icons on mobile (overlay on desktop)
    useEffect(() => {
        if (typeof window !== 'undefined' && window.innerWidth >= 768) {
            resetMobileShellShift();
            return;
        }
        if (!rendered) {
            resetMobileShellShift();
            return;
        }
        if (!visible) {
            shiftMobileShell(0, false, DRAWER_TRANSITION_MS);
            return;
        }
        const width = drawerRef.current?.offsetWidth || getDrawerWidth();
        shiftMobileShell(-width, shouldSkipOpenAnimRef.current, DRAWER_TRANSITION_MS);
    }, [rendered, visible]);

    // Safety net: ensure transform is always cleared when component unmounts
    useEffect(() => () => resetMobileShellShift(), []);

    const activeQueueCount = useMemo(() => {
        const seenAnime = new Set<string>();
        activeAnimeDownloads.forEach((prog) => seenAnime.add(`${prog.animeId}:${prog.episodeNumber}`));
        return seenAnime.size + activeMangaDownloads.size + activeLNDownloads.size;
    }, [activeAnimeDownloads, activeMangaDownloads, activeLNDownloads]);

    if (!rendered || typeof document === 'undefined') return null;

    // Reset shift immediately before navigating so the target /menu/* page renders perfectly aligned,
    // and mark reopenWithoutAnimation so returning via Back shows the drawer still (no re-slide).
    const goToPage = (path: string, desktopSubpage?: DesktopSubpageId) => {
        if (isDesktopViewport && desktopSubpage) {
            openDesktopSubpage(desktopSubpage);
            return;
        }
        if (isDesktopViewport) {
            onClose();
            navigate(path);
            return;
        }
        reopenWithoutAnimation = true;
        resetMobileShellShift();
        navigate(path);
    };

    const applyDirectDragStyles = (dragPx: number, dragging: boolean) => {
        const drawer = drawerRef.current;
        const scrim = scrimRef.current;
        const width = drawer?.offsetWidth || 320;
        const progress = Math.max(0, Math.min(1, 1 - dragPx / width));

        if (drawer) {
            drawer.style.transition = dragging ? 'none' : `transform ${DRAWER_TRANSITION_MS}ms ${DRAWER_EASING}`;
            drawer.style.transform = `translateX(${dragPx}px)`;
        }
        if (scrim) {
            scrim.style.transition = dragging ? 'none' : `background-color ${DRAWER_TRANSITION_MS}ms ease-out`;
            scrim.style.backgroundColor = `rgba(0, 0, 0, ${progress * 0.6})`;
        }
        shiftMobileShell(-Math.round(progress * width), dragging, DRAWER_TRANSITION_MS);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length !== 1) return;
        const t = e.touches[0];
        touchStartRef.current = { x: t.clientX, y: t.clientY, time: Date.now() };
        swipeLockRef.current = 'none';
        dragXRef.current = 0;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        const start = touchStartRef.current;
        if (!start || e.touches.length !== 1) return;
        const t = e.touches[0];
        const rawDx = t.clientX - start.x;
        const rawDy = t.clientY - start.y;

        if (swipeLockRef.current === 'none' && (Math.abs(rawDx) > 10 || Math.abs(rawDy) > 10)) {
            if (rawDx > 10 && Math.abs(rawDx) > Math.abs(rawDy) * 1.2) {
                swipeLockRef.current = 'horizontal';
            } else {
                swipeLockRef.current = 'vertical';
            }
        }

        if (swipeLockRef.current === 'horizontal') {
            const clamped = Math.max(0, rawDx);
            dragXRef.current = clamped;
            applyDirectDragStyles(clamped, true);
        }
    };

    const handleTouchEnd = () => {
        const start = touchStartRef.current;
        touchStartRef.current = null;
        if (swipeLockRef.current !== 'horizontal') {
            swipeLockRef.current = 'none';
            return;
        }
        swipeLockRef.current = 'none';

        const offset = dragXRef.current;
        const elapsed = Math.max(1, Date.now() - (start?.time || Date.now()));
        const velocity = offset / elapsed;
        const drawerWidth = drawerRef.current?.offsetWidth || 320;

        if (offset >= Math.min(88, drawerWidth * 0.28) || (offset >= 32 && velocity > 0.4)) {
            applyDirectDragStyles(drawerWidth, false);
            onClose();
        } else {
            dragXRef.current = 0;
            applyDirectDragStyles(0, false);
        }
    };

    const isDesktopAppBar = isDesktopViewport && !isMobileShell();

    return createPortal(
        <div
            ref={scrimRef}
            className="fixed inset-x-0 bottom-0 z-[2147483615] flex justify-end"
            style={{
                top: isDesktopAppBar
                    ? 'calc(2rem + var(--yorumi-mode-banner-height, 0px))'
                    : 'var(--yorumi-mode-banner-height, 0px)',
                backgroundColor: visible ? 'rgba(0, 0, 0, 0.55)' : 'rgba(0, 0, 0, 0)',
                transition: shouldSkipOpenAnimRef.current ? 'none' : `background-color ${DRAWER_TRANSITION_MS}ms ease-out`,
            }}
            onClick={onClose}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
        >
            <aside
                ref={drawerRef}
                className="flex h-full w-[84vw] max-w-[340px] flex-col bg-[#0d0e14]/78 backdrop-blur-2xl text-white border-l border-white/10 pb-[max(env(safe-area-inset-bottom,0px),16px)] will-change-transform"
                style={{
                    paddingTop: downloadedOnly ? '8px' : 'max(env(safe-area-inset-top, 0px), 16px)',
                    transform: visible ? 'translateX(0px)' : 'translateX(100%)',
                    transition: shouldSkipOpenAnimRef.current ? 'none' : `transform ${DRAWER_TRANSITION_MS}ms ${DRAWER_EASING}`,
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex-1 overflow-y-auto">
                    {/* Transparent App Icon Header */}
                    <div className="flex items-center justify-center py-7 border-b border-white/[0.08]">
                        <img
                            src="/yorumi-logo-mark.png"
                            alt="Yorumi"
                            className="h-14 w-14 object-contain"
                        />
                    </div>

                    {/* Modes Section */}
                    <div className="py-1.5">
                        <ToggleRow
                            icon={CloudOff}
                            label="Downloaded only"
                            subtitle="Filters all entries in your library"
                            checked={downloadedOnly}
                            onChange={setDownloadedOnly}
                        />
                        <ToggleRow
                            icon={EyeOff}
                            label="Incognito mode"
                            subtitle="Pauses watch, read & search history"
                            checked={incognitoMode}
                            onChange={setIncognitoMode}
                        />
                    </div>

                    <div className="h-px bg-white/[0.08]" />

                    {/* Personal tools Section */}
                    <div className="py-1.5">
                        <MenuRow
                            icon={Bell}
                            label="Updates"
                            subtitle={unreadCount > 0 ? `${unreadCount} new` : undefined}
                            onClick={() => goToPage('/menu/updates', 'updates')}
                        />
                        <MenuRow
                            icon={Download}
                            label="Download queue"
                            subtitle={activeQueueCount > 0 ? `${activeQueueCount} remaining` : undefined}
                            onClick={() => goToPage('/menu/download-queue', 'download-queue')}
                        />
                        <MenuRow
                            icon={Clock}
                            label="History"
                            onClick={() => goToPage('/menu/history', 'history')}
                        />
                        <MenuRow
                            icon={BarChart3}
                            label="Statistics"
                            onClick={() => goToPage('/menu/statistics', 'statistics')}
                        />
                        <MenuRow
                            icon={HardDrive}
                            label="Data and storage"
                            onClick={() => goToPage('/menu/storage', 'storage')}
                        />
                    </div>

                    <div className="h-px bg-white/[0.08]" />

                    {/* Community & app Section */}
                    <div className="py-1.5">
                        {(!isDesktopViewport || isMobileShell()) && (
                            <>
                                <MenuRow
                                    icon={DiscordBrandIcon}
                                    label="Join us"
                                    onClick={() => {
                                        onClose();
                                        onOpenDiscord();
                                    }}
                                />
                                <MenuRow
                                    icon={MessageCircle}
                                    label="Global chat"
                                    onClick={() => {
                                        if (isDesktopViewport && onOpenChat) {
                                            onClose();
                                            onOpenChat();
                                        } else {
                                            goToPage('/menu/chat');
                                        }
                                    }}
                                />
                            </>
                        )}
                        <MenuRow
                            icon={Settings}
                            label="Settings"
                            onClick={() => goToPage('/menu/settings', 'settings')}
                        />
                        <MenuRow
                            icon={Info}
                            label="About"
                            onClick={() => goToPage('/menu/about', 'about')}
                        />
                    </div>
                </div>
            </aside>

            {/* Desktop & Tablet Sub-Drawer: slides smoothly from the right with frosted glass */}
            {isDesktopViewport && activeSubpage && (
                <section
                    className="fixed right-0 bottom-0 z-[2147483616] flex w-[84vw] max-w-[340px] flex-col border-l border-white/10 bg-[#0d0e14]/78 backdrop-blur-2xl text-white shadow-2xl shadow-black/80 will-change-transform"
                    style={{
                        top: isDesktopAppBar
                            ? 'calc(2rem + var(--yorumi-mode-banner-height, 0px))'
                            : 'var(--yorumi-mode-banner-height, 0px)',
                        transform: subpageVisible && visible ? 'translateX(0px)' : 'translateX(100%)',
                        transition: `transform ${DRAWER_TRANSITION_MS}ms ${DRAWER_EASING}`,
                    }}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={activeSubpage}
                >
                    <MenuDrawerEmbeddedContext.Provider
                        value={{
                            onBack: closeDesktopSubpage,
                            onClose,
                            initialTab:
                                pendingSubpage && pendingSubpage.subpage === activeSubpage
                                    ? pendingSubpage.tab
                                    : undefined,
                        }}
                    >
                        {activeSubpage === 'updates' && <UpdatesPage />}
                        {activeSubpage === 'download-queue' && <DownloadQueuePage />}
                        {activeSubpage === 'history' && <HistoryPage />}
                        {activeSubpage === 'statistics' && <StatisticsPage />}
                        {activeSubpage === 'storage' && <DataStoragePage />}
                        {activeSubpage === 'settings' && <SettingsPage />}
                        {activeSubpage === 'about' && <AboutPage />}
                    </MenuDrawerEmbeddedContext.Provider>
                </section>
            )}
        </div>,
        document.body
    );
}

function MenuRow({
    icon: Icon,
    label,
    subtitle,
    onClick,
}: {
    icon: React.ElementType;
    label: string;
    subtitle?: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex w-full items-center gap-4 px-5 py-3.5 text-left hover:bg-white/[0.06] active:bg-white/[0.08] transition-colors cursor-pointer"
        >
            <Icon className="h-[20px] w-[20px] shrink-0 text-white/90" />
            <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-white">{label}</p>
                {subtitle && (
                    <p className="mt-0.5 truncate text-[12px] text-zinc-400">{subtitle}</p>
                )}
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />
        </button>
    );
}

function ToggleRow({
    icon: Icon,
    label,
    subtitle,
    checked,
    onChange,
}: {
    icon: React.ElementType;
    label: string;
    subtitle: string;
    checked: boolean;
    onChange: (next: boolean) => void;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            className="flex w-full items-center gap-4 px-5 py-3.5 text-left hover:bg-white/[0.06] active:bg-white/[0.08] transition-colors cursor-pointer"
        >
            <Icon className={`h-[20px] w-[20px] shrink-0 ${checked ? 'text-yorumi-accent' : 'text-white/90'}`} />
            <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-white">{label}</p>
                <p className="mt-0.5 truncate text-[12px] text-zinc-400">{subtitle}</p>
            </div>
            <span
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ${
                    checked
                        ? 'border-yorumi-accent bg-yorumi-accent'
                        : 'border-white/25 bg-[#262626]'
                }`}
            >
                <span
                    className={`inline-block h-4 w-4 rounded-full transition-transform ${
                        checked ? 'translate-x-5 bg-black' : 'translate-x-1 bg-zinc-400'
                    }`}
                />
            </span>
        </button>
    );
}

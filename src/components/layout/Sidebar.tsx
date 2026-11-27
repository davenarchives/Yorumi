import { lazy, Suspense, startTransition, useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Compass, Search, Tv, BookOpen, BookText, Library, LogOut, Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useContinueReading } from '../../hooks/useContinueReading';
import { useContinueWatching } from '../../hooks/useContinueWatching';
import { useWatchList } from '../../hooks/useWatchList';
import { useReadList } from '../../hooks/useReadList';
import { useLNReadList } from '../../hooks/useLNReadList';
import { useContinueLNReading } from '../../hooks/useContinueLNReading';
import { useWatchlistNotifications } from '../../hooks/useWatchlistNotifications';
import { getAnimeDetailsRouteId, getDirectScraperRouteId } from '../../utils/animeNavigation';
import { slugify } from '../../utils/slugify';
import type { ReadListItem, WatchListItem } from '../../utils/storage';
import type { LNReadListItem } from '../../types/ln';
const yorumiIcon = '/yorumi-icon.png';
import { isMobileShell, isTauri } from '../../platform/runtime';
import { candidatePoolService } from '../../features/explore/recommendation/candidatePoolService';
import GlobalChatDrawer from '../shared/GlobalChatDrawer';
import DiscordInviteModal from '../shared/DiscordInviteModal';
import MobileMenuDrawer, { type DesktopSubpageId, type PendingMenuSubpage } from './MobileMenuDrawer';
import { useAppPrefs } from '../../utils/appPrefs';

const SearchModal = lazy(() => import('../shared/SearchModal'));

type SavedSidebarItem =
    | (WatchListItem & { isType: 'anime' })
    | (ReadListItem & { isType: 'manga' })
    | (LNReadListItem & { isType: 'ln' });

const toPositiveNumber = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const getAnimeRouteId = (item: WatchListItem) => getAnimeDetailsRouteId({
    id: item.anilistId || item.id,
    mal_id: item.malId,
    scraperId: item.scraperId,
});

const buildAnimeRouteState = (item: WatchListItem) => {
    const anilistId = toPositiveNumber(item.anilistId || item.id);
    const malId = toPositiveNumber(item.malId || item.id);
    const scraperRouteId = getDirectScraperRouteId(item.scraperId);

    return {
        id: anilistId || undefined,
        mal_id: malId,
        scraperId: scraperRouteId ? scraperRouteId.replace(/^s:/i, '') : item.scraperId,
        title: item.title,
        title_english: item.title,
        title_romaji: item.title,
        images: { jpg: { image_url: item.image, large_image_url: item.image } },
        score: item.score || 0,
        status: item.mediaStatus || 'UNKNOWN',
        type: item.type || 'TV',
        episodes: item.totalCount || null,
        genres: item.genres?.map((name) => ({ mal_id: 0, name })) || [],
        synopsis: item.synopsis || '',
    };
};

const buildMangaRouteState = (item: ReadListItem) => ({
    id: item.id,
    mal_id: /^\d+$/.test(item.id) ? Number.parseInt(item.id, 10) : item.id,
    scraper_id: /^\d+$/.test(item.id) ? undefined : item.id,
    title: item.title,
    images: { jpg: { image_url: item.image, large_image_url: item.image } },
    score: item.score || 0,
    status: item.mediaStatus || 'UNKNOWN',
    type: item.type || 'Manga',
    chapters: item.totalCount || null,
    volumes: null,
    genres: item.genres?.map((name) => ({ mal_id: 0, name })) || [],
    synopsis: item.synopsis || '',
});

export default function Sidebar() {
    const navigate = useNavigate();
    const location = useLocation();
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchType, setSearchType] = useState<'anime' | 'manga' | 'ln' | 'users'>('anime');
    const [hoveredCard, setHoveredCard] = useState<{ title: string, top: number } | null>(null);
    const [isExploreEpisodesOpen, setIsExploreEpisodesOpen] = useState(false);
    const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
    const [isMobileDiscordOpen, setIsMobileDiscordOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [pendingMenuSubpage, setPendingMenuSubpage] = useState<PendingMenuSubpage | null>(null);
    const [isTabletSidebarHidden, setIsTabletSidebarHidden] = useState(false);

    useEffect(() => {
        const handleOpenSubpage = (event: Event) => {
            const detail = (event as CustomEvent<{ subpage?: DesktopSubpageId; tab?: string }>).detail;
            if (!detail?.subpage) return;
            setIsMobileChatOpen(false);
            setPendingMenuSubpage({
                subpage: detail.subpage,
                tab: detail.tab,
                nonce: Date.now(),
            });
            setIsMobileMenuOpen(true);
        };
        window.addEventListener('yorumi-open-menu-subpage', handleOpenSubpage);
        return () => window.removeEventListener('yorumi-open-menu-subpage', handleOpenSubpage);
    }, []);

    const toggleTabletSidebar = (nextHidden: boolean) => {
        setIsTabletSidebarHidden(nextHidden);
        window.dispatchEvent(new CustomEvent('yorumi-tablet-sidebar-change', { detail: { hidden: nextHidden } }));
    };

    // Keep watchlist notifications polling active so Android posts native push notifications for new episodes
    useWatchlistNotifications();
    const { downloadedOnly, incognitoMode } = useAppPrefs();

    useEffect(() => {
        const handler = (event: Event) => {
            const detail = (event as CustomEvent<{ open?: boolean }>).detail;
            setIsExploreEpisodesOpen(Boolean(detail?.open));
        };
        window.addEventListener('yorumi-explore-episodes-toggle', handler);
        return () => window.removeEventListener('yorumi-explore-episodes-toggle', handler);
    }, []);
    const isExploreRoute = location.pathname === '/explore';
    const isImmersiveRoute =
        location.pathname.startsWith('/manga/read/') ||
        location.pathname.startsWith('/ln/read/') ||
        location.pathname.startsWith('/anime/details/') ||
        location.pathname.startsWith('/manga/details/') ||
        location.pathname.startsWith('/ln/details/') ||
        location.pathname.startsWith('/menu/');

    // Right-edge swipe-left gesture to open the mobile hamburger drawer (skipped on Explore/immersive/search)
    useEffect(() => {
        if (isImmersiveRoute || isExploreRoute || location.pathname.startsWith('/search')) return;
        let startX = 0;
        let startY = 0;
        let active = false;

        const onTouchStart = (e: TouchEvent) => {
            if (e.touches.length !== 1 || isMobileMenuOpen) return;
            const t = e.touches[0];
            if (t.clientX >= window.innerWidth - 32) {
                startX = t.clientX;
                startY = t.clientY;
                active = true;
            }
        };
        const onTouchMove = (e: TouchEvent) => {
            if (!active || e.touches.length !== 1) return;
            const t = e.touches[0];
            const dx = t.clientX - startX;
            const dy = t.clientY - startY;
            if (dx < -45 && Math.abs(dx) > Math.abs(dy) * 1.3) {
                active = false;
                setIsMobileMenuOpen(true);
            } else if (Math.abs(dy) > 30) {
                active = false;
            }
        };
        const onTouchEnd = () => {
            active = false;
        };

        window.addEventListener('touchstart', onTouchStart, { passive: true });
        window.addEventListener('touchmove', onTouchMove, { passive: true });
        window.addEventListener('touchend', onTouchEnd, { passive: true });
        return () => {
            window.removeEventListener('touchstart', onTouchStart);
            window.removeEventListener('touchmove', onTouchMove);
            window.removeEventListener('touchend', onTouchEnd);
        };
    }, [isExploreRoute, isImmersiveRoute, isMobileMenuOpen, location.pathname]);

    const { watchList: normalWatchList } = useWatchList();
    const { readList: normalReadList } = useReadList();
    const { readList: lnReadList } = useLNReadList();
    const { continueWatchingList } = useContinueWatching();
    const { continueReadingList } = useContinueReading();
    const { continueReadingList: continueLNList } = useContinueLNReading();

    const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [, setClickCount] = useState(0);

    const handleLogoClickInternal = () => {
        setClickCount((prev) => {
            const newCount = prev + 1;
            if (newCount >= 5) {
                const isManga = location.pathname.startsWith('/manga');
                navigate(isManga ? '/manga' : '/');
                return 0;
            }
            if (newCount === 1) {
                navigate('/');
            }
            return newCount;
        });

        if (clickTimeoutRef.current) {
            clearTimeout(clickTimeoutRef.current);
        }
        clickTimeoutRef.current = setTimeout(() => {
            setClickCount(0);
        }, 1500);
    };

    const mobileShell = isMobileShell();
    const displaySavedItems: SavedSidebarItem[] = useMemo(() => {
        if (mobileShell) return [];
        return [
            ...normalWatchList.map((item) => ({ ...item, isType: 'anime' as const })),
            ...normalReadList.map((item) => ({ ...item, isType: 'manga' as const })),
            ...lnReadList.map((item) => ({ ...item, isType: 'ln' as const })),
        ]
            .filter((item, index, self) =>
                index === self.findIndex((t) => String(t.id) === String(item.id) && t.isType === item.isType)
            )
            .sort((a, b) => new Date(b.addedAt || 0).getTime() - new Date(a.addedAt || 0).getTime());
    }, [mobileShell, normalWatchList, normalReadList, lnReadList]);

    const getMatchingWatchProgress = (item: WatchListItem) => {
        const ids = new Set([
            item.id,
            item.anilistId,
            item.malId,
            item.scraperId,
            getDirectScraperRouteId(item.scraperId).replace(/^s:/i, ''),
        ].map((value) => String(value || '').trim()).filter(Boolean));

        return continueWatchingList.find((progress) => ids.has(String(progress.animeId || '').trim()));
    };

    const openSavedItem = (item: SavedSidebarItem) => {
        if (item.isType === 'ln') {
            const progress = continueLNList.find((entry) => String(entry.novelId) === String(item.id));
            if (progress?.chapterId) {
                navigate(`/ln/read/${slugify(item.title || 'novel')}/${item.id}/${encodeURIComponent(progress.chapterId)}`);
                return;
            }
            navigate(`/ln/details/${item.id}`);
            return;
        }

        if (item.isType === 'manga') {
            const progress = continueReadingList.find((entry) => String(entry.mangaId) === String(item.id));
            if (progress?.chapterNumber) {
                navigate(`/manga/read/${slugify(item.title || 'manga')}/${item.id}/c${progress.chapterNumber}`);
                return;
            }

            navigate(`/manga/details/${item.id}`, { state: { manga: buildMangaRouteState(item) } });
            return;
        }

        const routeId = getAnimeRouteId(item);
        if (!routeId) return;

        const anime = buildAnimeRouteState(item);

        const progress = getMatchingWatchProgress(item);
        const resume = Number.isFinite(progress?.positionSeconds)
            ? Math.max(0, Math.floor(Number(progress?.positionSeconds)))
            : 0;
        const episodeNumber = Number(progress?.episodeNumber || 0);
        const query = episodeNumber > 0
            ? `?ep=${episodeNumber}${resume > 0 ? `&t=${resume}` : ''}`
            : '';

        navigate(`/anime/details/${routeId}${query}`, { state: { anime } });
    };

    return (
        <>
            {/* Desktop Left Sidebar (PC only, hidden in full-screen Manga/LN readers) */}
            {!isMobileShell() && !location.pathname.startsWith('/manga/read/') && !location.pathname.startsWith('/ln/read/') && (
                <aside className="yorumi-desktop-sidebar fixed left-0 top-8 h-[calc(100vh-2rem)] hidden w-[70px] bg-[#0a0a0a]/95 backdrop-blur-xl border-r border-white/10 md:flex flex-col items-center py-4 z-[100]">
                    <div className="flex flex-col items-center gap-3 w-full">
                        {/* Logo */}
                        <div
                            onClick={handleLogoClickInternal}
                            className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer mb-4 hover:opacity-80 transition-opacity"
                            title="Home"
                        >
                            <img src={yorumiIcon} alt="Yorumi" className="w-8 h-8 object-contain" />
                        </div>

                        <SidebarIcon
                            icon={Compass}
                            title="Explore"
                            onClick={() => {
                                void candidatePoolService.getCandidatePool();
                                if (location.pathname === '/explore') {
                                    window.dispatchEvent(new CustomEvent('yorumi-explore-refresh'));
                                } else {
                                    navigate('/explore');
                                }
                            }}
                            isActive={location.pathname === '/explore'}
                            activeColor="text-rose-500"
                        />
                        <SidebarIcon
                            icon={Search}
                            title={location.pathname.startsWith('/library') ? 'Search Users' : 'Search'}
                            onClick={() => {
                                const isLibrary = location.pathname.startsWith('/library');
                                const isManga = location.pathname.startsWith('/manga');
                                const isLN = location.pathname.startsWith('/ln');
                                setSearchType(isLibrary ? 'users' : isLN ? 'ln' : isManga ? 'manga' : 'anime');
                                setIsSearchOpen(true);
                            }}
                        />
                        <SidebarIcon icon={Tv} title="Anime" onClick={() => navigate('/')} isActive={location.pathname === '/' || location.pathname.startsWith('/anime')} activeColor="text-[#0596ff]" />
                        <SidebarIcon icon={BookOpen} title="Manga" onClick={() => navigate('/manga')} isActive={location.pathname === '/manga' || location.pathname.startsWith('/manga')} activeColor="text-yorumi-manga" />
                        <SidebarIcon icon={BookText} title="LN" onClick={() => navigate('/ln')} isActive={location.pathname === '/ln' || location.pathname.startsWith('/ln')} activeColor="text-amber-400" />
                        <SidebarIcon icon={Library} title="Library" onClick={() => navigate('/library')} isActive={location.pathname === '/library'} activeColor="text-[#0596ff]" />
                    </div>

                    {displaySavedItems.length > 0 && (
                        <div className="flex-1 w-full min-h-0 flex flex-col items-center mt-3 overflow-hidden">
                            <div className="w-8 h-px bg-white/10 mb-3 shrink-0" />
                            <div className="w-full flex-1 overflow-y-auto flex flex-col items-center gap-3 px-1 pb-4 scrollbar-thin scrollbar-thumb-transparent hover:scrollbar-thumb-blue-500 scrollbar-track-transparent">
                                {displaySavedItems.map(item => (
                                    <button
                                        key={`${item.isType}-${item.id}`}
                                        onClick={() => openSavedItem(item)}
                                        onMouseEnter={(e) => {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            setHoveredCard({ title: item.title, top: rect.top + rect.height / 2 });
                                        }}
                                        onMouseLeave={() => setHoveredCard(null)}
                                        className="relative w-11 h-16 shrink-0 focus:outline-none"
                                    >
                                        <div className="w-full h-full rounded-lg overflow-hidden border-2 border-transparent hover:border-yorumi-accent transition-colors">
                                            <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col items-center gap-4 w-full mt-auto pt-4">
                        <SidebarIcon
                            icon={LogOut}
                            title="Exit App"
                            onClick={async () => {
                                if (isTauri()) {
                                    try {
                                        const { getCurrentWindow } = await import('@tauri-apps/api/window');
                                        await getCurrentWindow().close();
                                    } catch {
                                        window.close();
                                    }
                                } else {
                                    window.close();
                                }
                            }}
                            className="text-red-500 hover:text-red-400 hover:bg-red-500/10"
                        />
                    </div>
                </aside>
            )}

            {/* Tablet Navigation Rail (Android/iOS >= 768px — bare icons, collapsible, frosted glass) */}
            {isMobileShell() && !location.pathname.startsWith('/manga/read/') && !location.pathname.startsWith('/ln/read/') && (
                <>
                    <aside
                        className={`yorumi-tablet-rail fixed left-0 top-0 h-screen hidden w-[84px] bg-[#0b0c12]/78 backdrop-blur-2xl border-r border-white/[0.08] md:flex flex-col items-center justify-between z-[100] select-none transition-transform duration-200 ease-out ${
                            isTabletSidebarHidden ? '-translate-x-full pointer-events-none' : 'translate-x-0'
                        }`}
                        style={{
                            paddingTop: 'calc(max(env(safe-area-inset-top, 0px), 16px) + 0.5rem)',
                            paddingBottom: 'calc(max(env(safe-area-inset-bottom, 0px), 16px) + 0.5rem)',
                        }}
                        aria-label="Tablet navigation"
                    >
                        {/* Top: Bare Brand Logo (5x click Vault unlock preserved) */}
                        <button
                            type="button"
                            onClick={handleLogoClickInternal}
                            className="flex items-center justify-center p-1 active:scale-90 transition-transform focus:outline-none"
                            aria-label="Yorumi Home"
                        >
                            <img src={yorumiIcon} alt="Yorumi" className="h-8 w-8 object-contain" />
                        </button>

                        {/* Center: Primary Media Destinations (bare icons, no containers) */}
                        <nav className="flex w-full flex-col items-center gap-3 px-2">
                            <TabletRailItem
                                icon={Compass}
                                label="Explore"
                                isActive={location.pathname === '/explore'}
                                activeColorClass="text-rose-400"
                                onClick={() => {
                                    void candidatePoolService.getCandidatePool();
                                    if (location.pathname === '/explore') {
                                        window.dispatchEvent(new CustomEvent('yorumi-explore-refresh'));
                                    } else {
                                        startTransition(() => navigate('/explore'));
                                    }
                                }}
                            />
                            <TabletRailItem
                                icon={Tv}
                                label="Anime"
                                isActive={location.pathname === '/' || location.pathname.startsWith('/anime')}
                                activeColorClass="text-yorumi-accent"
                                onClick={() => startTransition(() => navigate('/'))}
                            />
                            <TabletRailItem
                                icon={BookOpen}
                                label="Manga"
                                isActive={location.pathname === '/manga' || location.pathname.startsWith('/manga')}
                                activeColorClass="text-yorumi-manga"
                                onClick={() => startTransition(() => navigate('/manga'))}
                            />
                            <TabletRailItem
                                icon={BookText}
                                label="LN"
                                isActive={location.pathname === '/ln' || location.pathname.startsWith('/ln')}
                                activeColorClass="text-amber-300"
                                onClick={() => startTransition(() => navigate('/ln'))}
                            />
                            <TabletRailItem
                                icon={Library}
                                label="Library"
                                isActive={location.pathname === '/library'}
                                activeColorClass="text-yorumi-accent"
                                onClick={() => startTransition(() => navigate('/library'))}
                            />
                        </nav>

                        {/* Bottom: Search, Menu Drawer & Hide Sidebar */}
                        <div className="flex w-full flex-col items-center gap-2.5 border-t border-white/[0.08] pt-3 px-2">
                            <TabletRailItem
                                icon={Search}
                                label="Search"
                                isActive={isSearchOpen}
                                activeColorClass="text-white"
                                onClick={() => {
                                    setIsMobileChatOpen(false);
                                    setIsMobileMenuOpen(false);
                                    const isLibrary = location.pathname.startsWith('/library');
                                    const isManga = location.pathname.startsWith('/manga');
                                    const isLN = location.pathname.startsWith('/ln');
                                    setSearchType(isLibrary ? 'users' : isLN ? 'ln' : isManga ? 'manga' : 'anime');
                                    setIsSearchOpen(true);
                                }}
                            />
                            <TabletRailItem
                                icon={Menu}
                                label="Menu"
                                isActive={isMobileMenuOpen}
                                showDot={downloadedOnly || incognitoMode}
                                activeColorClass="text-white"
                                onClick={() => {
                                    setIsMobileChatOpen(false);
                                    setPendingMenuSubpage(null);
                                    setIsMobileMenuOpen(true);
                                }}
                            />
                            <TabletRailItem
                                icon={PanelLeftClose}
                                label="Hide"
                                onClick={() => toggleTabletSidebar(true)}
                            />
                        </div>
                    </aside>

                    {/* Bare floating trigger to re-open the sidebar when hidden on tablet */}
                    {isTabletSidebarHidden && (
                        <button
                            type="button"
                            onClick={() => toggleTabletSidebar(false)}
                            aria-label="Show sidebar"
                            className="hidden md:flex fixed left-4 z-[150] h-10 w-10 items-center justify-center text-white/90 drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)] active:scale-90 transition-transform focus:outline-none"
                            style={{
                                top: 'calc(var(--yorumi-mode-banner-height, max(env(safe-area-inset-top, 0px), 16px)) + 0.5rem)',
                            }}
                        >
                            <PanelLeftOpen className="h-5 w-5" />
                        </button>
                    )}
                </>
            )}

            {!isImmersiveRoute && !isExploreEpisodesOpen && (
                <>
                    {/* Mobile Top-Right Decluttered Floating Icons: Search + Hamburger Menu (hidden on /search page) */}
                    {!location.pathname.startsWith('/search') && (
                        <div
                            className="yorumi-mobile-top-actions fixed right-4 z-[150] flex items-center gap-2 md:hidden"
                            style={{
                                top: 'calc(var(--yorumi-mode-banner-height, max(env(safe-area-inset-top, 0px), 16px)) + 0.5rem)',
                            }}
                        >
                            <button
                                type="button"
                                onClick={() => {
                                    setIsMobileChatOpen(false);
                                    setIsMobileMenuOpen(false);
                                    navigate('/search');
                                }}
                                aria-label="Search"
                                className="flex h-9 w-9 items-center justify-center text-white/95 drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)] active:scale-90 transition-transform focus:outline-none"
                            >
                                <Search className="h-5 w-5" />
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setIsMobileChatOpen(false);
                                    setIsMobileMenuOpen(true);
                                }}
                                aria-label="Open menu"
                                className="relative flex h-9 w-9 items-center justify-center text-white/95 drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)] active:scale-90 transition-transform focus:outline-none"
                            >
                                <Menu className="h-5 w-5" />
                                {(downloadedOnly || incognitoMode) && (
                                    <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-yorumi-accent" />
                                )}
                            </button>
                        </div>
                    )}

                    <nav
                        className="yorumi-mobile-navbar fixed z-[2147483600] md:hidden inset-x-0 bottom-0 border-t border-white/15 bg-black pb-[env(safe-area-inset-bottom,0px)]"
                        aria-label="Primary navigation"
                    >
                        <div className="flex items-center justify-around h-16">
                            <MobileNavItem icon={Compass} label="Explore" onClick={() => {
                                void candidatePoolService.getCandidatePool();
                                if (location.pathname === '/explore') window.dispatchEvent(new CustomEvent('yorumi-explore-refresh'));
                                else startTransition(() => navigate('/explore'));
                            }} isActive={location.pathname === '/explore'} />
                            <MobileNavItem icon={Tv} label="Anime" onClick={() => startTransition(() => navigate('/'))} isActive={location.pathname === '/' || location.pathname.startsWith('/anime')} />
                            <MobileNavItem icon={BookOpen} label="Manga" onClick={() => startTransition(() => navigate('/manga'))} isActive={location.pathname.startsWith('/manga')} />
                            <MobileNavItem icon={BookText} label="LN" onClick={() => startTransition(() => navigate('/ln'))} isActive={location.pathname.startsWith('/ln')} />
                            <MobileNavItem icon={Library} label="Library" onClick={() => startTransition(() => navigate('/library'))} isActive={location.pathname.startsWith('/library')} />
                        </div>
                    </nav>
                </>
            )}

            {/* Always mounted so Tablet Navigation Rail Menu, Global Chat & Join Us work on Details tabs too */}
            <MobileMenuDrawer
                isOpen={isMobileMenuOpen && !location.pathname.startsWith('/menu/')}
                onClose={() => {
                    setIsMobileMenuOpen(false);
                    setPendingMenuSubpage(null);
                }}
                onOpenDiscord={() => setIsMobileDiscordOpen(true)}
                onOpenChat={() => setIsMobileChatOpen(true)}
                pendingSubpage={pendingMenuSubpage}
            />
            <GlobalChatDrawer isOpen={isMobileChatOpen} onClose={() => setIsMobileChatOpen(false)} />
            <DiscordInviteModal isOpen={isMobileDiscordOpen} onClose={() => setIsMobileDiscordOpen(false)} />

            {isSearchOpen && (
                <Suspense fallback={null}>
                    <SearchModal
                        isOpen
                        onClose={() => setIsSearchOpen(false)}
                        type={searchType}
                    />
                </Suspense>
            )}

            {hoveredCard && (
                <div
                    className="fixed left-[70px] bg-[#1a1a1a] text-white text-[13px] font-semibold px-3 py-1.5 rounded-md pointer-events-none whitespace-nowrap z-[150] shadow-xl border border-white/5 -translate-y-1/2"
                    style={{ top: hoveredCard.top }}
                >
                    {hoveredCard.title}
                </div>
            )}
        </>
    );
}

interface TabletRailItemProps {
    icon: React.ElementType;
    label: string;
    onClick: () => void;
    isActive?: boolean;
    activeColorClass?: string;
    showDot?: boolean;
}

function TabletRailItem({
    icon: Icon,
    label,
    onClick,
    isActive = false,
    activeColorClass = 'text-yorumi-accent',
    showDot = false,
}: TabletRailItemProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            aria-current={isActive ? 'page' : undefined}
            className="group relative flex w-full flex-col items-center justify-center gap-1 py-1 touch-manipulation active:scale-90 transition-transform focus:outline-none"
        >
            <div className="relative flex items-center justify-center">
                <Icon
                    className={`h-[21px] w-[21px] transition-colors ${
                        isActive ? activeColorClass : 'text-white/55 group-hover:text-white/90'
                    }`}
                    strokeWidth={isActive ? 2.25 : 1.85}
                />
                {showDot && (
                    <span className="pointer-events-none absolute -top-0.5 -right-1.5 h-2 w-2 rounded-full bg-yorumi-accent" />
                )}
            </div>
            <span
                className={`text-[11px] leading-none tracking-tight transition-colors ${
                    isActive ? `font-semibold ${activeColorClass}` : 'font-medium text-white/55 group-hover:text-white/85'
                }`}
            >
                {label}
            </span>
        </button>
    );
}

interface MobileNavItemProps {
    icon: React.ElementType;
    label: string;
    onClick: () => void;
    isActive?: boolean;
}

function MobileNavItem({ icon: Icon, label, onClick, isActive = false }: MobileNavItemProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            aria-current={isActive ? 'page' : undefined}
            className={`relative flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5 touch-manipulation ${isActive ? 'text-white' : 'text-white/60'
                }`}
        >
            <Icon className="h-5 w-5 shrink-0" strokeWidth={2} />
            <span className={`truncate text-[11px] ${isActive ? 'font-bold text-white' : 'font-medium text-white/60'}`}>
                {label}
            </span>
        </button>
    );
}

interface SidebarIconProps {
    icon: React.ElementType;
    title: string;
    onClick: () => void;
    isActive?: boolean;
    activeColor?: string;
    className?: string;
}

function SidebarIcon({ icon: Icon, title, onClick, isActive, activeColor = 'bg-yorumi-accent/20 text-yorumi-accent', className }: SidebarIconProps) {
    return (
        <button
            onClick={onClick}
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 group relative outline-none focus:outline-none ${isActive ? activeColor : 'text-gray-400 hover:text-white hover:bg-white/10'} ${className || ''}`}
        >
            <Icon className="w-5 h-5" />
            <span className="absolute left-[60px] bg-[#1a1a1a] text-white text-[13px] font-semibold px-3 py-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[150] shadow-xl border border-white/5">
                {title}
            </span>
        </button>
    );
}

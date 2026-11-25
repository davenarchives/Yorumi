import { useEffect, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import { LazyMotion, MotionConfig, domAnimation } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppRoutes } from './app/AppRoutes';
import Sidebar from './components/layout/Sidebar';

import ScrollToTop from './components/ui/ScrollToTop';
import TmdbSetupScreen from './components/setup/TmdbSetupScreen';
import { useTitleLanguage } from './context/TitleLanguageContext';
import { useNavbarSearch } from './features/search/hooks/useNavbarSearch';
import { PersistentPlayerProvider } from './features/player/context/PersistentPlayerContext';
import { gentleTransition } from './utils/motion';
import { tmdbService } from './services/tmdbService';
import ScrollRestoration from './components/layout/ScrollRestoration';
import OfflineBanner from './components/shared/OfflineBanner';
import MobilePullToRefresh from './components/shared/MobilePullToRefresh';
import AppUpdateModal from './components/shared/AppUpdateModal';
import discordRPCService from './services/discordRPCService';
import { isMobileShell, isNativeMobile, isTauri } from './platform/runtime';
import DesktopTitleBar from './components/layout/DesktopTitleBar';
import { candidatePoolService } from './features/explore/recommendation/candidatePoolService';
import { lnService } from './services/lnService';
import { mangaService } from './services/mangaService';
import { cloudSyncService } from './services/cloudSyncService';

function App() {
    const location = useLocation();
    const navigate = useNavigate();
    const { language } = useTitleLanguage();
    const [showScrollToTop, setShowScrollToTop] = useState(false);

    useEffect(() => {
        if (isMobileShell()) return;
        document.documentElement.classList.add('has-desktop-titlebar');
        return () => document.documentElement.classList.remove('has-desktop-titlebar');
    }, []);

    // Warm up Explore, Manga, and Light Novel home data in the background shortly after app startup so navigation is instant.
    useEffect(() => {
        const timer = window.setTimeout(() => {
            void candidatePoolService.getCandidatePool().catch(() => undefined);
            void mangaService.getHomeSections().catch(() => undefined);
            void lnService.preloadHome().catch(() => undefined);
        }, 1200);
        return () => window.clearTimeout(timer);
    }, []);

    useEffect(() => {
        cloudSyncService.start();
        return () => cloudSyncService.stop();
    }, []);
    const [tmdbSetupReady, setTmdbSetupReady] = useState(() => (
        tmdbService.hasToken() || tmdbService.hasCompletedSetup()
    ));

    const queryParams = new URLSearchParams(location.search);
    const isExploreRoute = location.pathname === '/explore';
    const isImmersiveRoute =
        location.pathname.startsWith('/manga/read/') ||
        location.pathname.startsWith('/ln/read/') ||
        location.pathname.startsWith('/anime/details/') ||
        location.pathname.startsWith('/manga/details/') ||
        location.pathname.startsWith('/ln/details/') ||
        location.pathname.startsWith('/explore');
    const hideScrollToTop =
        location.pathname.startsWith('/manga/details/') ||
        location.pathname.startsWith('/ln/details/') ||
        location.pathname.startsWith('/anime/details/') ||
        location.pathname.startsWith('/manga/read/') ||
        location.pathname.startsWith('/ln/read/') ||
        location.pathname.startsWith('/explore');
    const activeTab = location.pathname.startsWith('/ln') || queryParams.get('type') === 'ln'
        ? 'ln'
        : location.pathname.startsWith('/manga')
        || queryParams.get('type') === 'manga'
        || queryParams.get('tab') === 'continue-reading'
        || queryParams.get('tab') === 'readlist'
        || queryParams.get('tab') === 'manga-overview'
        ? 'manga'
        : 'anime';

    const { setSearchQuery, setSearchResults } = useNavbarSearch({
        activeTab,
        language,
    });

    useEffect(() => {
        if (!isNativeMobile()) return;

        let listener: PluginListenerHandle | undefined;
        let disposed = false;
        const handleBack = () => {
            const rawHash = window.location.hash.replace(/^#/, '') || '/';
            const [path, rawSearch = ''] = rawHash.split('?');
            const search = new URLSearchParams(rawSearch);
            if (path.startsWith('/anime/details/') && search.has('ep')) {
                search.delete('ep');
                const query = search.toString();
                navigate({ pathname: path, search: query ? `?${query}` : '' }, { replace: true });
                return;
            }
            if (path.startsWith('/anime/details/')) {
                navigate('/', { replace: true });
                return;
            }
            if (path.startsWith('/manga/read/')) {
                const parts = path.split('/').filter(Boolean);
                navigate(parts[3] ? `/manga/details/${parts[3]}` : '/manga', { replace: true });
                return;
            }
            if (path.startsWith('/ln/read/')) {
                const parts = path.split('/').filter(Boolean);
                navigate(parts[3] ? `/ln/details/${parts[3]}` : '/ln', { replace: true });
                return;
            }
            const historyIdx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
            if (historyIdx > 0) {
                navigate(-1);
                return;
            }
            if (path === '/') {
                if (!isTauri()) void CapacitorApp.minimizeApp();
                return;
            }
            navigate(path.startsWith('/manga') ? '/manga' : path.startsWith('/ln') ? '/ln' : '/', { replace: true });
        };

        if (isTauri()) {
            window.addEventListener('yorumi-native-back', handleBack);
        } else {
            void CapacitorApp.addListener('backButton', handleBack).then((handle) => {
                if (disposed) void handle.remove();
                else listener = handle;
            });
        }
        return () => {
            disposed = true;
            window.removeEventListener('yorumi-native-back', handleBack);
            void listener?.remove();
        };
    }, [navigate]);

    useEffect(() => {
        if (!location.pathname.startsWith('/search')) {
            setSearchQuery('');
            setSearchResults([]);
        }

        const path = location.pathname;
        let pageLabel = 'Home';
        if (path === '/') pageLabel = 'Home';
        else if (path.startsWith('/library')) pageLabel = 'Library';
        else if (path.startsWith('/anime')) pageLabel = 'Anime Catalog';
        else if (path.startsWith('/manga')) pageLabel = 'Manga Catalog';
        else if (path.startsWith('/ln') && !path.startsWith('/read-ln')) pageLabel = 'Light Novels';
        else if (path.startsWith('/profile')) pageLabel = 'Profile';
        else if (path.startsWith('/genre')) pageLabel = 'Genres';
        else if (path.startsWith('/explore')) pageLabel = 'Explore';
        else if (path.startsWith('/search')) pageLabel = 'Search';

        if (!path.startsWith('/watch') && !path.startsWith('/read-ln')) {
            discordRPCService.setBrowsing(pageLabel);
        }
    }, [location.pathname, setSearchQuery, setSearchResults]);

    useEffect(() => {
        const toggleFloatingAction = () => {
            setShowScrollToTop(window.scrollY > 400);
        };

        toggleFloatingAction();
        window.addEventListener('scroll', toggleFloatingAction, { passive: true });

        return () => {
            window.removeEventListener('scroll', toggleFloatingAction);
        };
    }, []);


    if (!tmdbSetupReady) {
        return (
            <div className={!isMobileShell() ? 'pt-8' : undefined}>
                {!isMobileShell() && <DesktopTitleBar title="Set Up TMDB" />}
                <TmdbSetupScreen onReady={() => setTmdbSetupReady(true)} />
            </div>
        );
    }

    return (
        <LazyMotion features={domAnimation}>
            <MotionConfig reducedMotion={isMobileShell() ? 'always' : 'user'} transition={gentleTransition}>
                <div className={`min-h-screen bg-yorumi-bg text-white font-sans ${activeTab === 'ln' ? 'selection:bg-yorumi-ln selection:text-black' : activeTab === 'manga' ? 'selection:bg-yorumi-manga selection:text-white' : 'selection:bg-yorumi-accent selection:text-white'} overflow-x-clip ${!isMobileShell() ? 'pt-8' : ''}`}>
                    {/* Custom Discord-style desktop title bar */}
                    {!isMobileShell() && <DesktopTitleBar />}
                    
                    <div className="fixed inset-0 pointer-events-none z-0 hidden md:block">
                        <div className={`absolute top-[-10%] left-[-10%] w-[40%] h-[40%] ${activeTab === 'ln' ? 'bg-yorumi-ln/5' : activeTab === 'manga' ? 'bg-yorumi-manga/5' : 'bg-yorumi-accent/5'} rounded-full blur-[120px]`} />
                        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-yorumi-main/5 rounded-full blur-[120px]" />
                    </div>

                    <Sidebar />
                    <MobilePullToRefresh />

                    <div className={`relative flex ${isExploreRoute && !isMobileShell() ? 'min-h-[calc(100vh-2rem)]' : 'min-h-screen'} w-full flex-1 flex-col ${!isMobileShell() ? 'md:ml-[70px] md:w-[calc(100%-70px)]' : ''} md:pb-0 ${isImmersiveRoute ? 'pb-0' : 'pb-[calc(4rem+env(safe-area-inset-bottom))]'}`}>
                        <PersistentPlayerProvider>
                            <ScrollRestoration />
                            <AppRoutes />
                        </PersistentPlayerProvider>

                        {!hideScrollToTop && (
                            <ScrollToTop
                                activeTab={activeTab as 'anime' | 'manga' | 'ln'}
                                isVisible={showScrollToTop}
                            />
                        )}
                    </div>
                    
                    <OfflineBanner />
                    <AppUpdateModal />
                </div>
            </MotionConfig>
        </LazyMotion>
    );
}

export default App;

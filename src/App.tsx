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
import UpdateModal from './components/modals/UpdateModal';
import OTAUpdateModal from './components/modals/OTAUpdateModal';
import OfflineBanner from './components/shared/OfflineBanner';
import discordRPCService from './services/discordRPCService';
import { isNativeMobile } from './platform/runtime';

function App() {
    const location = useLocation();
    const navigate = useNavigate();
    const { language } = useTitleLanguage();
    const [showScrollToTop, setShowScrollToTop] = useState(false);
    const [tmdbSetupReady, setTmdbSetupReady] = useState(() => (
        tmdbService.hasToken() || tmdbService.hasCompletedSetup()
    ));

    const queryParams = new URLSearchParams(location.search);
    const isImmersiveRoute =
        location.pathname.startsWith('/manga/read/') ||
        location.pathname.startsWith('/ln/read/') ||
        location.pathname.startsWith('/anime/details/') ||
        location.pathname.startsWith('/manga/details/') ||
        location.pathname.startsWith('/ln/details/');
    const hideScrollToTop =
        location.pathname.startsWith('/manga/details/') ||
        location.pathname.startsWith('/ln/details/') ||
        location.pathname.startsWith('/anime/details/') ||
        location.pathname.startsWith('/manga/read/') ||
        location.pathname.startsWith('/ln/read/');
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
        void CapacitorApp.addListener('backButton', () => {
            const currentHash = window.location.hash.replace(/^#/, '').split('?')[0] || '/';

            // 1. If at Home root ('/'), exit the app
            if (currentHash === '/') {
                void CapacitorApp.exitApp();
                return;
            }

            // 2. If inside reader screens, navigate back to their details page
            if (currentHash.startsWith('/manga/read/')) {
                const parts = currentHash.split('/');
                if (parts[4]) {
                    navigate(`/manga/details/${parts[4]}`);
                    return;
                }
                navigate('/manga');
                return;
            }

            if (currentHash.startsWith('/ln/read/')) {
                const parts = currentHash.split('/');
                if (parts[4]) {
                    navigate(`/ln/details/${parts[4]}`);
                    return;
                }
                navigate('/ln');
                return;
            }

            // 3. Details pages always leave their media flow instead of replaying
            // player/query-string entries from the history stack.
            if (currentHash.startsWith('/anime/details/')) {
                navigate('/', { replace: true });
                return;
            }

            if (currentHash.startsWith('/manga/details/')) {
                navigate('/manga', { replace: true });
                return;
            }

            if (currentHash.startsWith('/ln/details/')) {
                navigate('/ln', { replace: true });
                return;
            }

            // 4. If there is history depth in this session, navigate back
            const historyIdx = (window.history.state as { idx?: number })?.idx ?? 0;
            if (historyIdx > 0) {
                navigate(-1);
                return;
            }

            // 5. Fallbacks when history stack has no prior entry:
            if (currentHash.startsWith('/manga/genre/') || currentHash.startsWith('/manga/')) {
                navigate('/manga');
                return;
            }

            if (currentHash.startsWith('/ln/')) {
                navigate('/ln');
                return;
            }

            if (currentHash.startsWith('/genre/') || currentHash.startsWith('/anime/')) {
                navigate('/');
                return;
            }

            // 6. If on secondary root tabs (/manga, /ln, /library, /profile), back takes you to Home
            if (currentHash === '/manga' || currentHash === '/ln' || currentHash === '/library' || currentHash === '/profile') {
                navigate('/');
                return;
            }

            // Default fallback
            navigate('/');
        }).then((handle) => {
            listener = handle;
        });

        return () => {
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
        else if (path.startsWith('/yumi')) pageLabel = 'Yumi AI';
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
        return <TmdbSetupScreen onReady={() => setTmdbSetupReady(true)} />;
    }

    return (
        <LazyMotion features={domAnimation}>
            <MotionConfig reducedMotion="user" transition={gentleTransition}>
                <div className={`min-h-screen bg-yorumi-bg text-white font-sans ${activeTab === 'ln' ? 'selection:bg-yorumi-ln selection:text-black' : activeTab === 'manga' ? 'selection:bg-yorumi-manga selection:text-white' : 'selection:bg-yorumi-accent selection:text-white'} overflow-x-clip`}>
                    {/* Electron drag region - desktop only */}
                    {!isNativeMobile() && (
                        <div 
                            className="fixed top-0 left-0 right-[150px] h-8 z-[9999] md:left-[70px]"
                            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} 
                        />
                    )}
                    
                    <div className="fixed inset-0 pointer-events-none z-0">
                        <div className={`absolute top-[-10%] left-[-10%] w-[40%] h-[40%] ${activeTab === 'ln' ? 'bg-yorumi-ln/5' : activeTab === 'manga' ? 'bg-yorumi-manga/5' : 'bg-yorumi-accent/5'} rounded-full blur-[120px]`} />
                        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-yorumi-main/5 rounded-full blur-[120px]" />
                    </div>

                    <Sidebar />

                    <div className={`relative flex min-h-screen w-full flex-1 flex-col md:ml-[70px] md:w-[calc(100%-70px)] md:pb-0 ${isImmersiveRoute ? 'pb-0' : 'pb-[calc(4.5rem+env(safe-area-inset-bottom))]'}`}>
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
                    
                    <UpdateModal />
                    <OTAUpdateModal />
                    <OfflineBanner />
                </div>
            </MotionConfig>
        </LazyMotion>
    );
}

export default App;

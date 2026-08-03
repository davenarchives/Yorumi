import { useEffect, useState } from 'react';
import { LazyMotion, MotionConfig, domAnimation } from 'framer-motion';
import { useLocation } from 'react-router-dom';
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

function App() {
    const location = useLocation();
    const { language } = useTitleLanguage();
    const [showScrollToTop, setShowScrollToTop] = useState(false);
    const [tmdbSetupReady, setTmdbSetupReady] = useState(() => (
        tmdbService.hasToken() || tmdbService.hasCompletedSetup()
    ));

    const queryParams = new URLSearchParams(location.search);
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
        if (!location.pathname.startsWith('/search')) {
            setSearchQuery('');
            setSearchResults([]);
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
                <div className={`min-h-screen bg-yorumi-bg text-white font-sans ${activeTab === 'ln' ? 'selection:bg-yorumi-ln selection:text-black' : activeTab === 'manga' ? 'selection:bg-yorumi-manga selection:text-white' : 'selection:bg-yorumi-accent selection:text-white'} overflow-x-hidden`}>
                    {/* Electron drag region */}
                    <div 
                        className="fixed top-0 left-[70px] right-[150px] h-8 z-[9999]" 
                        style={{ WebkitAppRegion: 'drag' } as any} 
                    />
                    
                    <div className="fixed inset-0 pointer-events-none z-0">
                        <div className={`absolute top-[-10%] left-[-10%] w-[40%] h-[40%] ${activeTab === 'ln' ? 'bg-yorumi-ln/5' : activeTab === 'manga' ? 'bg-yorumi-manga/5' : 'bg-yorumi-accent/5'} rounded-full blur-[120px]`} />
                        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-yorumi-main/5 rounded-full blur-[120px]" />
                    </div>

                    <Sidebar />

                    <div className="ml-[70px] flex-1 flex flex-col w-[calc(100%-70px)] relative min-h-screen">
                        <PersistentPlayerProvider>
                            <ScrollRestoration />
                            <AppRoutes />
                        </PersistentPlayerProvider>

                        <ScrollToTop activeTab={activeTab as 'anime' | 'manga' | 'ln'} isVisible={showScrollToTop} />
                    </div>
                    
                    <UpdateModal />
                    <OTAUpdateModal />
                </div>
            </MotionConfig>
        </LazyMotion>
    );
}

export default App;

import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const TOP_LEVEL_TAB_PATHS = new Set(['/', '/explore', '/manga', '/ln', '/library']);

const scrollToTopImmediate = () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
};

export default function ScrollRestoration() {
    const location = useLocation();
    const navigationType = useNavigationType();
    const scrollPositions = useRef<Record<string, number>>({});

    useLayoutEffect(() => {
        const isTabRoute = TOP_LEVEL_TAB_PATHS.has(location.pathname);

        // Always start at the very top when switching tabs or pushing/replacing routes.
        if (isTabRoute || navigationType !== 'POP') {
            scrollToTopImmediate();
            return;
        }

        // Restore previous scroll position only when popping back to non-tab pages (e.g. search/genre).
        const savedPosition = scrollPositions.current[location.key];
        if (savedPosition !== undefined) {
            requestAnimationFrame(() => {
                window.scrollTo({ top: savedPosition, left: 0, behavior: 'instant' as ScrollBehavior });
            });
        } else {
            scrollToTopImmediate();
        }
    }, [location.key, location.pathname, navigationType]);

    useEffect(() => {
        const handleScroll = () => {
            scrollPositions.current[location.key] = window.scrollY;
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [location.key]);

    return null;
}

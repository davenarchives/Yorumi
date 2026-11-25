import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { cloudSyncService } from '../../services/cloudSyncService';

const TRIGGER_THRESHOLD = 64;
const MAX_PULL = 92;

const hasScrolledAncestor = (target: EventTarget | null): boolean => {
    let el = target instanceof HTMLElement ? target : null;
    while (el && el !== document.body && el !== document.documentElement) {
        const style = window.getComputedStyle(el);
        const overflowY = style.overflowY;
        if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollTop > 0) {
            return true;
        }
        el = el.parentElement;
    }
    return false;
};

export default function MobilePullToRefresh() {
    const location = useLocation();
    const [pullDistance, setPullDistance] = useState(0);
    const [refreshing, setRefreshing] = useState(false);

    const startYRef = useRef<number | null>(null);
    const startXRef = useRef<number | null>(null);
    const activePullRef = useRef(false);
    const pullDistanceRef = useRef(0);
    const refreshingRef = useRef(false);

    const isDisabledRoute =
        location.pathname === '/explore' ||
        location.pathname.startsWith('/manga/read/') ||
        location.pathname.startsWith('/ln/read/');

    useEffect(() => {
        if (typeof window === 'undefined' || isDisabledRoute) return;

        const isMobileViewport = () => window.matchMedia('(max-width: 767px)').matches;

        const onTouchStart = (e: TouchEvent) => {
            if (!isMobileViewport() || refreshingRef.current) return;
            if (e.touches.length !== 1) return;
            if (window.scrollY > 2 || hasScrolledAncestor(e.target)) return;

            startYRef.current = e.touches[0].clientY;
            startXRef.current = e.touches[0].clientX;
            activePullRef.current = false;
        };

        const onTouchMove = (e: TouchEvent) => {
            if (startYRef.current === null || startXRef.current === null || refreshingRef.current) return;
            if (e.touches.length !== 1) return;

            const deltaY = e.touches[0].clientY - startYRef.current;
            const deltaX = Math.abs(e.touches[0].clientX - startXRef.current);

            if (!activePullRef.current) {
                if (deltaY < 14) return;
                if (deltaX > deltaY * 0.45 || window.scrollY > 2) {
                    startYRef.current = null;
                    startXRef.current = null;
                    return;
                }
                activePullRef.current = true;
            }

            if (deltaY <= 0) {
                pullDistanceRef.current = 0;
                setPullDistance(0);
                return;
            }

            // Prevent Android WebView overscroll stretch while pulling down
            if (e.cancelable) {
                e.preventDefault();
            }

            const damped = Math.min(MAX_PULL, Math.round(deltaY * 0.45));
            pullDistanceRef.current = damped;
            setPullDistance(damped);
        };

        const onTouchEnd = () => {
            const currentPull = pullDistanceRef.current;
            startYRef.current = null;
            startXRef.current = null;
            activePullRef.current = false;

            if (currentPull >= TRIGGER_THRESHOLD && !refreshingRef.current) {
                refreshingRef.current = true;
                setRefreshing(true);
                setPullDistance(TRIGGER_THRESHOLD);

                void Promise.race([
                    cloudSyncService.pullAndMerge().catch(() => undefined),
                    new Promise((resolve) => window.setTimeout(resolve, 1800)),
                ]).finally(() => {
                    window.location.reload();
                });
                return;
            }

            pullDistanceRef.current = 0;
            setPullDistance(0);
        };

        window.addEventListener('touchstart', onTouchStart, { passive: true });
        window.addEventListener('touchmove', onTouchMove, { passive: false });
        window.addEventListener('touchend', onTouchEnd, { passive: true });
        window.addEventListener('touchcancel', onTouchEnd, { passive: true });

        return () => {
            window.removeEventListener('touchstart', onTouchStart);
            window.removeEventListener('touchmove', onTouchMove);
            window.removeEventListener('touchend', onTouchEnd);
            window.removeEventListener('touchcancel', onTouchEnd);
        };
    }, [isDisabledRoute]);

    if (isDisabledRoute || (pullDistance <= 0 && !refreshing)) return null;

    const progress = Math.min(1, pullDistance / TRIGGER_THRESHOLD);
    const translateY = Math.round(pullDistance * 0.65);

    return (
        <div
            aria-hidden="true"
            className="pointer-events-none fixed left-1/2 top-[calc(max(env(safe-area-inset-top,0px),16px)+0.25rem)] z-[2147483605] md:hidden"
            style={{
                transform: `translate(-50%, ${translateY}px)`,
                opacity: Math.max(0.25, progress),
                transition: activePullRef.current ? 'none' : 'transform 180ms ease-out, opacity 180ms ease-out',
            }}
        >
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-[#0d0e12]/90 backdrop-blur-xl shadow-lg shadow-black/70">
                <RefreshCw
                    className={`h-4 w-4 text-white ${refreshing ? 'animate-spin' : ''}`}
                    style={refreshing ? undefined : { transform: `rotate(${Math.round(progress * 270)}deg)` }}
                />
            </div>
        </div>
    );
}

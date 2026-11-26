import { useEffect, useRef } from 'react';
import { useAppPrefs } from '../../utils/appPrefs';

export default function ModeStatusBanner() {
    const { downloadedOnly } = useAppPrefs();
    const bannerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const root = document.documentElement;
        if (!downloadedOnly || !bannerRef.current) {
            root.style.removeProperty('--yorumi-mode-banner-height');
            root.classList.remove('has-mode-banner');
            return;
        }

        const updateHeight = () => {
            const h = bannerRef.current?.getBoundingClientRect().height || 0;
            root.style.setProperty('--yorumi-mode-banner-height', `${Math.ceil(h)}px`);
            root.classList.add('has-mode-banner');
        };

        updateHeight();
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateHeight) : null;
        ro?.observe(bannerRef.current);
        window.addEventListener('resize', updateHeight);
        return () => {
            ro?.disconnect();
            window.removeEventListener('resize', updateHeight);
            root.style.removeProperty('--yorumi-mode-banner-height');
            root.classList.remove('has-mode-banner');
        };
    }, [downloadedOnly]);

    if (!downloadedOnly) return null;

    return (
        <div
            ref={bannerRef}
            className="sticky top-0 z-[2147483610] flex w-full shrink-0 flex-col md:hidden select-none"
        >
            <div className="w-full bg-yorumi-accent pt-[max(env(safe-area-inset-top,0px),12px)] pb-1.5 text-center text-[13px] font-semibold leading-tight text-black">
                Downloaded only
            </div>
        </div>
    );
}

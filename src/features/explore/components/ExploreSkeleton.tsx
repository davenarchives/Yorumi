import { isMobileShell } from '../../../platform/runtime';

/**
 * Full-viewport skeleton matching the mobile 16:9 TikTok-style feed and desktop Explore layout.
 */
export default function ExploreSkeleton() {
    const mobileShell = isMobileShell();

    return (
        <div
            className={`relative w-full ${mobileShell ? 'h-[100dvh]' : 'h-[calc(100vh-2rem)]'} overflow-hidden bg-black select-none`}
            aria-label="Loading explore feed"
        >
            {/* Top Utility Controls Skeleton (Mobile) */}
            <div className="md:hidden absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 pt-[calc(0.85rem+env(safe-area-inset-top,0px))] pointer-events-none animate-pulse">
                <div className="h-10 w-10 rounded-full bg-white/10" />
                <div className="flex items-center gap-2.5">
                    <div className="h-10 w-10 rounded-full bg-white/10" />
                    <div className="h-10 w-10 rounded-full bg-white/10" />
                </div>
            </div>

            {/* Mobile Centered 16:9 Trailer + Fullscreen Pill Skeleton */}
            <div className="md:hidden absolute inset-0 flex flex-col items-center justify-center pb-14 pointer-events-none animate-pulse">
                <div className="w-full aspect-video bg-white/[0.06]" />
                <div className="mt-3.5 h-8 w-28 rounded-full bg-white/10 border border-white/10" />
            </div>

            {/* Desktop Fullscreen Canvas + Top-Right Controls Skeleton */}
            <div className="hidden md:block absolute inset-0 bg-gradient-to-br from-white/[0.04] via-black to-white/[0.03] animate-pulse pointer-events-none">
                <div className="absolute top-6 right-6 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-white/10" />
                    <div className="h-10 w-10 rounded-full bg-white/10" />
                </div>
            </div>

            {/* Bottom-Left Title & Synopsis Skeleton */}
            <div className="absolute left-4 right-20 bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:left-8 md:right-auto md:bottom-8 md:max-w-lg z-20 space-y-2.5 pointer-events-none animate-pulse">
                <div className="h-5 md:h-7 w-48 md:w-72 rounded-md bg-white/15" />
                <div className="h-3.5 md:h-4 w-64 md:w-96 rounded bg-white/10" />
                <div className="h-3.5 md:h-4 w-44 md:w-72 rounded bg-white/10" />
            </div>

            {/* Right Action Rail Skeleton (Avatar, Like, Episodes, Save, Hide) */}
            <div className="absolute right-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:right-6 md:bottom-8 z-20 flex flex-col items-center gap-4 pointer-events-none animate-pulse">
                <div className="h-11 w-11 rounded-full bg-white/15 border border-white/15" />
                {[0, 1, 2, 3].map((item) => (
                    <div key={item} className="flex flex-col items-center gap-1.5">
                        <div className="h-9 w-9 rounded-full bg-white/10" />
                        <div className="h-2.5 w-7 rounded bg-white/10" />
                    </div>
                ))}
            </div>
        </div>
    );
}

import React from 'react';

type SpotlightSkeletonVariant = 'anime' | 'manga' | 'ln';

interface SpotlightSkeletonProps {
    variant?: SpotlightSkeletonVariant;
}

const variantStyles: Record<
    SpotlightSkeletonVariant,
    { primary: string; chipBg: string; chipBorder: string; chipWidth: string }
> = {
    anime: {
        primary: 'bg-[#00a3ff]',
        chipBg: 'bg-[#e0562b]/20',
        chipBorder: 'border-transparent',
        chipWidth: 'w-14',
    },
    manga: {
        primary: 'bg-yorumi-manga',
        chipBg: 'bg-yorumi-manga/20',
        chipBorder: 'border-yorumi-manga/30',
        chipWidth: 'w-16',
    },
    ln: {
        primary: 'bg-yorumi-ln',
        chipBg: 'bg-yorumi-ln/20',
        chipBorder: 'border-yorumi-ln/30',
        chipWidth: 'w-24',
    },
};

const SpotlightSkeleton: React.FC<SpotlightSkeletonProps> = ({ variant = 'anime' }) => {
    const styles = variantStyles[variant];
    const isReading = variant === 'manga' || variant === 'ln';

    return (
        <div className="media-spotlight relative mb-0 md:mb-4 h-[58svh] min-h-[400px] max-h-[490px] w-full overflow-hidden bg-transparent md:h-[100svh] md:min-h-[640px] md:max-h-none">
            {/* Background container with gradient mask matching SpotlightHero and ReadingSpotlight */}
            <div
                className="absolute inset-0 z-0 select-none pointer-events-none"
                style={{
                    maskImage:
                        'linear-gradient(to bottom, #000 0%, #000 35%, rgba(0,0,0,0.75) 58%, rgba(0,0,0,0.32) 74%, rgba(0,0,0,0.08) 88%, transparent 100%)',
                    WebkitMaskImage:
                        'linear-gradient(to bottom, #000 0%, #000 35%, rgba(0,0,0,0.75) 58%, rgba(0,0,0,0.32) 74%, rgba(0,0,0,0.08) 88%, transparent 100%)',
                }}
            >
                <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-white/[0.06] via-white/[0.02] to-transparent" />
                <div className="absolute inset-y-0 left-0 w-full sm:w-[85%] md:w-[75%] lg:w-[65%] bg-gradient-to-r from-[#070707]/90 via-[#070707]/50 to-transparent pointer-events-none" />
                <div className="absolute inset-x-0 top-0 h-[22%] bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
                <div className="absolute inset-y-0 right-0 w-[15%] bg-gradient-to-l from-black/45 to-transparent pointer-events-none" />
            </div>

            {/* Reading Spotlight 3D Covers Carousel Skeleton (Desktop only, for Manga and LN) */}
            {isReading && (
                <div className="absolute right-[13%] top-1/2 z-10 hidden aspect-[2/3] w-48 max-w-[20vw] -translate-y-1/2 md:block lg:w-60 xl:w-[264px] animate-pulse pointer-events-none">
                    {/* Previous cover (behind left) */}
                    <div className="absolute inset-0 origin-bottom -translate-x-[40%] -translate-y-5 rotate-[-8deg] scale-90 overflow-hidden rounded-xl bg-white/[0.04] border border-white/5 shadow-xl" />
                    {/* Next cover (behind right) */}
                    <div className="absolute inset-0 origin-bottom translate-x-[40%] -translate-y-5 rotate-[8deg] scale-90 overflow-hidden rounded-xl bg-white/[0.04] border border-white/5 shadow-xl" />
                    {/* Active center cover */}
                    <div className="absolute inset-0 z-10 overflow-hidden rounded-xl bg-white/[0.09] border border-white/10 shadow-2xl" />
                </div>
            )}

            {/* Foreground Content Skeleton matching Hero layout */}
            <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-end px-4 pb-6 sm:px-10 sm:pb-12 md:px-14 md:pb-14 lg:px-16">
                <div className="flex w-full items-end justify-between gap-8">
                    <div className="flex w-full max-w-2xl flex-col items-center text-center md:items-start md:text-left md:max-w-[740px] lg:max-w-[820px] animate-pulse">
                        {isReading ? (
                            /* Title headline skeleton for Manga and LN */
                            <div className="mb-4 md:mb-5 h-8 sm:h-10 md:h-14 w-[78%] sm:w-[70%] max-w-[620px] rounded-lg bg-white/10" />
                        ) : (
                            /* Logo box skeleton for Anime */
                            <div className="mb-5 h-20 sm:h-24 md:h-28 w-[62%] sm:w-[45%] md:w-[38%] rounded-xl bg-white/10" />
                        )}

                        {/* Metadata pills skeleton */}
                        <div className="mb-3 md:mb-4 flex items-center justify-center md:justify-start gap-2.5">
                            {/* Score Ring skeleton */}
                            <div className="h-7 w-7 rounded-full border border-emerald-500/30 bg-emerald-500/10" />
                            <div className="h-2 w-2 rounded-full bg-white/20" />
                            <div className="h-5 w-12 rounded bg-white/10" />
                            <div className="h-2 w-2 rounded-full bg-white/20" />
                            <div className="h-5 w-20 rounded bg-white/10" />
                            <div className="h-2 w-2 rounded-full bg-white/20" />
                            <div
                                className={`h-5 ${styles.chipWidth} rounded-full border ${styles.chipBg} ${styles.chipBorder}`}
                            />
                        </div>

                        {/* Synopsis skeleton */}
                        <div className="mb-5 md:mb-8 w-full max-w-xl md:max-w-2xl space-y-2.5 flex flex-col items-center md:items-start">
                            <div className="h-4 w-[92%] md:w-[95%] rounded bg-white/10" />
                            <div className="h-4 w-[74%] md:w-[88%] rounded bg-white/10" />
                            <div className="hidden md:block h-4 w-[75%] rounded bg-white/10" />
                            {isReading && <div className="hidden md:block h-4 w-[55%] rounded bg-white/10" />}
                        </div>

                        {/* Action buttons skeleton */}
                        <div className="flex w-full items-center gap-3 sm:gap-5 md:w-auto">
                            <div
                                className={`h-12 sm:h-14 md:h-[58px] min-w-0 flex-1 sm:min-w-[170px] md:min-w-[190px] md:flex-none rounded-full bg-white/80 md:opacity-70 md:${styles.primary}`}
                            />
                            <div className="h-12 sm:h-14 md:h-[58px] min-w-0 flex-1 sm:min-w-[170px] md:min-w-[190px] md:flex-none rounded-full bg-white/[0.12] border border-white/15" />
                        </div>

                        {/* Mobile Carousel Indicator Dots Skeleton */}
                        <div className="mt-5 flex justify-center gap-2 md:hidden">
                            <div className="h-2.5 w-2.5 rounded-full bg-white/80" />
                            {[0, 1, 2, 3, 4].map((dot) => (
                                <div key={dot} className="h-2.5 w-2.5 rounded-full bg-white/25" />
                            ))}
                        </div>
                    </div>

                    {/* Slide indicator dots skeleton on bottom right */}
                    <div className="mb-2 hidden shrink-0 items-center gap-3 sm:flex animate-pulse">
                        <div className="h-9 w-9 rounded-full bg-white/10" />
                        <div className="flex items-center gap-2.5">
                            <div className={`h-2.5 w-9 rounded-full opacity-60 ${styles.primary}`} />
                            <div className="h-2.5 w-2.5 rounded-full bg-white/20" />
                            <div className="h-2.5 w-2.5 rounded-full bg-white/20" />
                            <div className="h-2.5 w-2.5 rounded-full bg-white/20" />
                        </div>
                        <div className="h-9 w-9 rounded-full bg-white/10" />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SpotlightSkeleton;

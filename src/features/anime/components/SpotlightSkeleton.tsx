import React from 'react';

type SpotlightSkeletonVariant = 'anime' | 'manga' | 'ln';

interface SpotlightSkeletonProps {
    variant?: SpotlightSkeletonVariant;
}

const variantStyles: Record<SpotlightSkeletonVariant, { primary: string; titleWidth: string }> = {
    anime: { primary: 'bg-yorumi-accent/45', titleWidth: 'w-[72%]' },
    manga: { primary: 'bg-yorumi-manga/45', titleWidth: 'w-[82%]' },
    ln: { primary: 'bg-amber-400/45', titleWidth: 'w-[78%]' },
};

const SpotlightSkeleton: React.FC<SpotlightSkeletonProps> = ({ variant = 'anime' }) => {
    const styles = variantStyles[variant];

    return (
        <div className="relative mb-8 h-[58vh] min-h-[440px] w-full overflow-hidden bg-[#0a0a0a] md:h-[60vh] md:min-h-[480px]">
            <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-white/[0.08] via-white/[0.04] to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-[60%] bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/80 to-transparent" />
            <div className="absolute inset-0 hidden bg-gradient-to-r from-[#0a0a0a] via-[#0a0a0a]/80 to-transparent md:block" />

            <div className="absolute inset-0 z-10 flex animate-pulse flex-col justify-between px-4 pb-4 md:hidden" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.25rem)' }}>
                <div className="flex items-start justify-between">
                    <div className="h-9 w-24 rounded-full bg-black/55" />
                    <div className="h-9 w-16 rounded-full bg-black/55" />
                </div>
                <div className="space-y-3 pb-1">
                    <div className="flex gap-2">
                        <div className="h-7 w-16 rounded-full border border-white/10 bg-black/45" />
                        <div className="h-7 w-14 rounded-full border border-white/10 bg-black/45" />
                        <div className="h-7 w-20 rounded-full border border-white/10 bg-black/45" />
                    </div>
                    <div className="space-y-2">
                        <div className={`h-8 rounded bg-white/15 ${styles.titleWidth}`} />
                        <div className="h-8 w-[52%] rounded bg-white/15" />
                    </div>
                    <div className="flex gap-2">
                        <div className="h-7 w-20 rounded-full border border-white/10 bg-black/45" />
                        <div className="h-7 w-24 rounded-full border border-white/10 bg-black/45" />
                        <div className="h-7 w-16 rounded-full border border-white/10 bg-black/45" />
                    </div>
                    <div className="flex gap-2 pt-1">
                        <div className={`h-10 flex-1 rounded-lg ${styles.primary}`} />
                        <div className="h-10 min-w-[112px] rounded-lg border border-white/15 bg-white/10" />
                    </div>
                </div>
            </div>

            <div className="absolute inset-0 z-10 mx-auto hidden w-full max-w-7xl animate-pulse items-center gap-12 px-14 pt-12 md:flex">
                <div className="flex h-[380px] w-full max-w-2xl flex-1 flex-col justify-end">
                    <div className="mb-4 h-16 w-[70%] rounded bg-white/10" />
                    <div className="mb-4 flex gap-4">
                        <div className="h-8 w-16 rounded-lg bg-white/10" />
                        <div className="h-8 w-20 rounded-lg bg-white/10" />
                        <div className="h-8 w-20 rounded-lg bg-white/10" />
                    </div>
                    <div className="mb-6 space-y-2">
                        <div className="h-4 w-[90%] rounded bg-white/10" />
                        <div className="h-4 w-[75%] rounded bg-white/10" />
                        <div className="h-4 w-[55%] rounded bg-white/10" />
                    </div>
                    <div className="flex gap-4">
                        <div className={`h-11 w-36 rounded-lg ${styles.primary}`} />
                        <div className="h-11 w-32 rounded-lg border border-white/15 bg-white/10" />
                    </div>
                </div>
                <div className="ml-auto h-[384px] w-64 rounded-xl bg-white/10 shadow-[0_0_40px_rgba(0,0,0,0.6)]" />
            </div>
        </div>
    );
};

export default SpotlightSkeleton;

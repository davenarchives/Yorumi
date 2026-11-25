import React from 'react';

export default function MangaCardSkeleton() {
    return (
        <div className="relative animate-pulse select-none">
            {/* Portrait on mobile (2:3), Landscape on desktop (16:9) */}
            <div className="relative aspect-[2/3] md:aspect-video w-full overflow-hidden rounded-[16px] bg-white/[0.06] border border-white/5" />

            {/* Title & Metadata below matching ReadingCardMetadata */}
            <div className="mt-2.5 pr-1">
                <div className="h-4 w-4/5 rounded bg-white/10" />
                <div className="mt-2 flex items-center gap-2">
                    <div className="h-3.5 w-10 rounded bg-white/10" />
                    <div className="h-1.5 w-1.5 rounded-full bg-white/20" />
                    <div className="h-3.5 w-12 rounded bg-white/10" />
                    <div className="h-1.5 w-1.5 rounded-full bg-white/20" />
                    <div className="h-3.5 w-10 rounded bg-white/10" />
                </div>
            </div>
        </div>
    );
}

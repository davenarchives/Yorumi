import React from 'react';
import Skeleton from '../../../components/ui/Skeleton';

const TopTenSkeleton: React.FC = () => {
    return (
        <div className="space-y-2">
            {Array.from({ length: 10 }).map((_, index) => (
                <div
                    key={`top-ten-skeleton-${index}`}
                    className="relative flex h-[82px] items-stretch gap-2 rounded-lg bg-[#0f1116] overflow-hidden md:h-[72px]"
                >
                    {/* Rank Number Skeleton */}
                    <div className="relative w-16 shrink-0 flex items-center justify-center md:w-14">
                        <Skeleton className="w-6 h-6" />
                    </div>

                    {/* Info Skeleton */}
                    <div className="min-w-0 flex-1 py-2 pr-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <div className="mt-1.5 flex items-center gap-1.5">
                            <Skeleton className="h-6 w-[45px] rounded-md" />
                            <Skeleton className="h-6 w-[35px] rounded-md" />
                        </div>
                    </div>

                    {/* Image Placeholder */}
                    <div 
                        className="relative h-full w-28 shrink-0 -mr-1 bg-[#1a1d24] overflow-hidden [clip-path:polygon(14%_0,100%_0,100%_100%,0_100%)] md:w-24"
                    >
                        <Skeleton className="w-full h-full rounded-none" />
                    </div>
                </div>
            ))}
        </div>
    );
};

export default TopTenSkeleton;

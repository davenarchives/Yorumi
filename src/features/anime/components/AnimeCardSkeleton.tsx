import React from 'react';
import Skeleton from '../../../components/ui/Skeleton';

interface AnimeCardSkeletonProps {
    className?: string;
}

const AnimeCardSkeleton: React.FC<AnimeCardSkeletonProps> = ({ className = '' }) => {
    return (
        <div className={`relative z-0 ${className}`}>
            {/* Poster Skeleton Wrapper */}
            <div className="relative mb-1.5 aspect-[2/3] overflow-hidden rounded-lg shadow-lg md:mb-3">
                <Skeleton className="w-full h-full absolute inset-0 rounded-none" />
                
                {/* Badges Skeletons */}
                <div className="absolute bottom-2 left-2 flex gap-1.5 z-10">
                    <Skeleton className="h-5 w-9 rounded md:h-6 md:w-[45px]" />
                    <Skeleton className="h-5 w-8 rounded md:h-6 md:w-[38px]" />
                </div>
            </div>
            
            {/* Title Skeleton */}
            <div className="space-y-1 mt-1">
                <Skeleton className="w-[90%] h-4 rounded" />
                <Skeleton className="w-[60%] h-4 rounded" />
            </div>
        </div>
    );
};

export default AnimeCardSkeleton;

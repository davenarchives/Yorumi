import Skeleton from '../../../components/ui/Skeleton';

export default function MangaCardSkeleton() {
    return (
        <div className="animate-in fade-in duration-300 relative z-0">
            {/* Image Container Skeleton */}
            <div className="relative mb-1.5 aspect-[2/3] overflow-hidden rounded-lg md:mb-3">
                <Skeleton className="w-full h-full absolute inset-0 rounded-none" />
                
                {/* Default Badges Skeletons */}
                {/* Top Right: Star Rating Skeleton */}
                <div className="absolute top-2 right-2 z-10">
                    <Skeleton className="w-[45px] h-[24px] rounded" />
                </div>

                {/* Bottom Left: the live card renders only its media type here. */}
                <div className="absolute bottom-2 left-2 flex gap-1.5 z-10">
                    <Skeleton className="h-5 w-14 rounded md:h-6 md:w-[60px]" />
                </div>
            </div>
            
            {/* Title Skeleton Below Card */}
            <div className="space-y-1 mt-1">
                <Skeleton className="h-4 w-[90%] rounded" />
                <Skeleton className="h-4 w-[60%] rounded" />
            </div>
        </div>
    );
}

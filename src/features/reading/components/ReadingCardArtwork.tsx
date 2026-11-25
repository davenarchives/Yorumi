import { useId } from 'react';
import { Plus, Check } from 'lucide-react';
import { getDisplayImageUrl } from '../../../utils/image';
import RankBadge from '../../../components/ui/RankBadge';

interface ReadingCardArtworkProps {
    title: string;
    image: string;
    poster?: string;
    badge?: string;
    rank?: number;
    inList?: boolean;
    onToggleList?: () => void;
    onMoreClick?: () => void;
}

export function chapterBadge(chapters?: number | null, status?: string): string | undefined {
    const normalizedStatus = String(status || '').trim().toUpperCase();
    if (!chapters || chapters <= 0 || normalizedStatus === 'FINISHED' || normalizedStatus === 'COMPLETED' || normalizedStatus === 'COMPLETE') return undefined;
    return `Ch ${chapters}`;
}

export default function ReadingCardArtwork({
    title,
    image,
    poster,
    badge,
    rank,
    inList,
    onToggleList,
    onMoreClick,
}: ReadingCardArtworkProps) {
    const effectiveBadge = rank !== undefined ? undefined : badge;
    const maskId = `reading-notch-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
    const width = effectiveBadge ? Math.round(Math.max(76, effectiveBadge.length * 7.2 + 24)) : 0;
    const path = `M -4 -4 H ${width + 12} V 0 A 12 12 0 0 0 ${width} 12 V 18 A 12 12 0 0 1 ${width - 12} 30 H 12 A 12 12 0 0 0 0 42 H -4 V -4 Z`;
    const posterSrc = poster || image;
    const desktopSrc = image || posterSrc;

    return (
        <div className="relative aspect-[2/3] md:aspect-video w-full">
            {effectiveBadge && (
                <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
                    <defs>
                        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1000">
                            <rect width="1000" height="1000" fill="white" />
                            <path d={path} fill="black" />
                        </mask>
                    </defs>
                </svg>
            )}
            <div
                className="relative h-full w-full overflow-hidden rounded-[16px] bg-[#14151c]"
                style={effectiveBadge ? { maskImage: `url(#${maskId})`, WebkitMaskImage: `url(#${maskId})` } : undefined}
            >
                {/* Mobile portrait poster */}
                {posterSrc && (
                    <img
                        src={getDisplayImageUrl(posterSrc)}
                        alt={title}
                        className="md:hidden h-full w-full object-cover object-top transition-transform duration-300 ease-out group-hover:scale-[1.03]"
                        loading="lazy"
                        decoding="async"
                    />
                )}
                {/* Desktop landscape banner */}
                {desktopSrc && (
                    <img
                        src={getDisplayImageUrl(desktopSrc)}
                        alt={title}
                        className="hidden md:block h-full w-full object-cover object-top transition-transform duration-300 ease-out group-hover:scale-[1.03]"
                        loading="lazy"
                        decoding="async"
                    />
                )}
            </div>

            {/* Top-Left Pastel Rank Badge */}
            {rank !== undefined && (
                <RankBadge
                    rank={rank}
                    className="absolute -top-2 -left-2 z-30 pointer-events-none"
                />
            )}

            {/* Top-Left Inverted Cutout Notch Badge */}
            {effectiveBadge && (
                <div
                    className="pointer-events-none absolute left-0 top-0 z-20 flex h-[30px] items-center justify-center pb-0.5 pr-1 text-[11.5px] font-extrabold tracking-tight text-white"
                    style={{ width }}
                >
                    {effectiveBadge}
                </div>
            )}

            {/* Top-Right Floating Action Button: + — hover-only on desktop */}
            {onToggleList && (
                <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1.5 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity duration-200">
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleList();
                        }}
                        aria-label={inList ? 'Remove from List' : 'Add to List'}
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full backdrop-blur-md flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer border ${
                            inList
                                ? 'bg-yorumi-manga text-white border-transparent'
                                : 'bg-black/60 hover:bg-black/80 text-white border-white/10'
                        }`}
                    >
                        {inList ? (
                            <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3]" />
                        ) : (
                            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}

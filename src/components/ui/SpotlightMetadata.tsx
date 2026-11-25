import ScoreRing from './ScoreRing';

export type SpotlightMetadataDetail = string | { label: string; desktopOnly?: boolean };

interface SpotlightMetadataProps {
    score?: number | null;
    details: SpotlightMetadataDetail[];
    chip: string;
}

export default function SpotlightMetadata({ score, details, chip }: SpotlightMetadataProps) {
    const hasScore = score != null && score > 0;
    const cleanDetails = details
        .map((d) => (typeof d === 'string' ? { label: d.trim(), desktopOnly: false } : { label: d.label.trim(), desktopOnly: Boolean(d.desktopOnly) }))
        .filter((d) => Boolean(d.label));
    return (
        <div className="mb-3 md:mb-4 flex flex-nowrap items-center gap-1.5 sm:gap-2.5 md:gap-3 overflow-hidden whitespace-nowrap select-none text-[13px] font-semibold text-white sm:text-base md:text-[18px]">
            {hasScore && (
                <span className="shrink-0" aria-label={`Rating ${score.toFixed(1)} out of 10`}>
                    <ScoreRing score={score} />
                </span>
            )}
            {cleanDetails.map((detail, index) => (
                <span key={`${detail.label}-${index}`} className={detail.desktopOnly ? 'hidden md:contents' : 'contents'}>
                    {(hasScore || index > 0) && (
                        <span className="shrink-0 text-xs sm:text-sm text-white/90">&bull;</span>
                    )}
                    <span
                        className={`font-semibold tracking-wide text-white ${
                            index === 0 && cleanDetails.length > 1 ? 'min-w-0 truncate' : 'shrink-0'
                        }`}
                    >
                        {detail.label}
                    </span>
                </span>
            ))}
            {(hasScore || cleanDetails.length > 0) && (
                <span className="shrink-0 text-xs sm:text-sm text-white/90">&bull;</span>
            )}
            <span className="shrink-0 rounded-[6px] bg-[#e0562b] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white sm:px-2.5 sm:text-sm md:text-[15px]">
                {chip}
            </span>
        </div>
    );
}

interface ReadingCardMetadataProps {
    title: string;
    score?: number;
    format?: string;
    year?: string | number;
    theme?: 'manga' | 'ln';
}

export default function ReadingCardMetadata({
    title,
    score,
    format,
    year,
    theme = 'manga',
}: ReadingCardMetadataProps) {
    const normalizedScore = score && score > 0 ? (score > 10 ? score / 10 : score) : null;
    const hoverColorClass = theme === 'ln' ? 'group-hover:text-yorumi-ln' : 'group-hover:text-yorumi-manga';

    return (
        <div className="mt-2.5 pr-1">
            <h3 className={`line-clamp-2 text-[15px] font-bold leading-snug text-white transition-colors ${hoverColorClass}`}>
                {title}
            </h3>
            <div className="mt-1 flex items-center gap-1.5 text-[12.5px] font-semibold text-white/60">
                {normalizedScore !== null && (
                    <>
                        <span className="inline-flex items-center gap-1 text-white/80">
                            <svg className="-mt-0.5 h-3.5 w-3.5 fill-current text-white/75" viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                            </svg>
                            {normalizedScore.toFixed(1)}
                        </span>
                        <span>&middot;</span>
                    </>
                )}
                <span>{String(format || '').toUpperCase().replace(/[ -]/g, '_') === 'ONE_SHOT' ? 'One-shot' : 'Series'}</span>
                {year && (
                    <>
                        <span>&middot;</span>
                        <span>{year}</span>
                    </>
                )}
            </div>
        </div>
    );
}

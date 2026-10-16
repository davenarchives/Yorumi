type DownloadStateIconProps = {
    state: 'available' | 'queued' | 'downloading' | 'downloaded';
    progress?: number;
    className?: string;
};

export default function DownloadStateIcon({
    state,
    progress = 0,
    className = 'h-5 w-5',
}: DownloadStateIconProps) {
    // These paths are Mihon's Apache-2.0 custom Material Symbols Rounded
    // DownloadCircle/DownloadArrow and Material Symbols Rounded CheckCircle.
    if (state === 'downloaded') {
        return (
            <svg className={className} viewBox="0 -960 960 960" aria-hidden="true">
                <path fill="currentColor" d="m424-408-86-86q-11-11-28-11t-28 11q-11 11-11 28t11 28l114 114q12 12 28 12t28-12l226-226q11-11 11-28t-11-28q-11-11-28-11t-28 11L424-408Zm56 328q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z" />
            </svg>
        );
    }

    const arrowPath = 'M479-680Q462-680 450.5-668.5Q439-657 439-640L439-435 364-511Q352-523 335.5-523Q319-523 307-511Q295-499 294.5-482.5Q294-466 306-454L451-308Q462-297 479-297Q496-297 507-308L650-451Q662-463 662.5-480Q663-497 651-509Q639-521 622-521Q605-521 593-509L519-435 519-640Q519-657 507.5-668.5Q496-680 479-680Z';

    if (state === 'available') {
        return (
            <svg className={className} viewBox="0 -960 960 960" aria-hidden="true">
                <path fill="currentColor" d={`${arrowPath}M480-810C662.3-810 810-662.3 810-480C810-297.7 662.3-150 480-150C297.7-150 150-297.7 150-480C150-662.3 297.7-810 480-810ZM480-880Q397-880 324-848.5Q251-817 197-763Q143-709 111.5-636Q80-563 80-480Q80-397 111.5-324Q143-251 197-197Q251-143 324-111.5Q397-80 480-80Q563-80 636-111.5Q709-143 763-197Q817-251 848.5-324Q880-397 880-480Q880-563 848.5-636Q817-709 763-763Q709-817 636-848.5Q563-880 480-880Z`} />
            </svg>
        );
    }

    const normalizedProgress = Math.max(1, Math.min(100, progress));
    const waves = 9;
    const points = Array.from({ length: 73 }, (_, index) => {
        const angle = (index / 72) * Math.PI * 2;
        const radius = 392 + (state === 'downloading' ? Math.sin(angle * waves) * 24 : 0);
        return `${480 + Math.cos(angle) * radius},${-480 + Math.sin(angle) * radius}`;
    });
    const ringPath = `M${points.join(' L')} Z`;
    const indeterminate = state === 'queued';

    return (
        <svg className={className} viewBox="0 -960 960 960" aria-hidden="true">
            {!indeterminate && (
                <path d={ringPath} fill="none" stroke="currentColor" strokeWidth="72" opacity="0.25" />
            )}
            <path
                className={indeterminate ? 'origin-center animate-spin' : undefined}
                d={indeterminate ? 'M480-872a392 392 0 1 1-277.19 114.81' : ringPath}
                fill="none"
                pathLength="100"
                stroke="currentColor"
                strokeDasharray={indeterminate ? '72 28' : '100'}
                strokeDashoffset={indeterminate ? undefined : 100 - normalizedProgress}
                strokeLinecap="round"
                strokeWidth="72"
                style={indeterminate ? undefined : { transition: 'stroke-dashoffset 350ms linear' }}
                transform={indeterminate ? undefined : 'rotate(-90 480 -480)'}
            />
            <path d={arrowPath} fill="currentColor" />
        </svg>
    );
}

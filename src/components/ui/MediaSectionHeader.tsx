import type { ReactNode } from 'react';

interface MediaSectionHeaderProps {
    index: number;
    title: string;
    actions?: ReactNode;
}

export default function MediaSectionHeader({ title, actions }: MediaSectionHeaderProps) {
    return (
        <div className="mb-5 flex items-center gap-3 md:mb-6 md:gap-4">
            <h2 className="whitespace-nowrap text-[21px] font-bold leading-none tracking-tight text-white md:text-2xl md:font-black md:uppercase md:tracking-wide">
                {title}
            </h2>
            <div className="h-px min-w-4 flex-1 bg-white/10" />
            {actions && <div className="hidden items-center gap-2 md:flex">{actions}</div>}
        </div>
    );
}

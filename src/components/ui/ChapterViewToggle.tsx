import { useState } from 'react';

export type ChapterViewMode = 'list' | 'grid';

const STORAGE_KEY = 'yorumi_chapter_view_mode';

export function useChapterViewMode(initialMode: ChapterViewMode = 'list') {
    const [viewMode, setViewMode] = useState<ChapterViewMode>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved === 'list' || saved === 'grid') return saved;
        } catch {
            // Ignore storage access errors
        }
        return initialMode;
    });

    const updateViewMode = (mode: ChapterViewMode) => {
        setViewMode(mode);
        try {
            localStorage.setItem(STORAGE_KEY, mode);
        } catch {
            // Ignore storage quota errors
        }
    };

    return [viewMode, updateViewMode] as const;
}

interface ChapterViewToggleProps {
    viewMode: ChapterViewMode;
    onViewModeChange: (mode: ChapterViewMode) => void;
    activeClassName?: string;
}

export default function ChapterViewToggle({ viewMode, onViewModeChange, activeClassName = 'text-purple-400' }: ChapterViewToggleProps) {
    const isList = viewMode === 'list';
    const nextMode: ChapterViewMode = isList ? 'grid' : 'list';
    const label = isList ? 'Switch to Grid View' : 'Switch to List View';

    return (
        <button
            type="button"
            onClick={() => onViewModeChange(nextMode)}
            title={label}
            aria-label={label}
            className={`grid h-10 w-10 shrink-0 place-items-center transition-colors duration-200 cursor-pointer ${
                isList ? 'text-white hover:text-white/80' : activeClassName
            }`}
        >
            {isList ? (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="2" />
                    <rect x="14" y="3" width="7" height="7" rx="2" />
                    <rect x="14" y="14" width="7" height="7" rx="2" />
                    <rect x="3" y="14" width="7" height="7" rx="2" />
                </svg>
            ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="3" y1="6" x2="16" y2="6" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="18" x2="14" y2="18" />
                </svg>
            )}
        </button>
    );
}

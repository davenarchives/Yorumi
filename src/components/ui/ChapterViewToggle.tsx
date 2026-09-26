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
}

export default function ChapterViewToggle({ viewMode, onViewModeChange }: ChapterViewToggleProps) {
    return (
        <div className="flex h-10 shrink-0 items-center gap-1">
            <button
                type="button"
                onClick={() => onViewModeChange('list')}
                title="List View"
                aria-label="List View"
                aria-pressed={viewMode === 'list'}
                className={`grid h-10 w-10 place-items-center transition-colors duration-200 ${
                    viewMode === 'list'
                        ? 'text-purple-400'
                        : 'text-gray-500 hover:text-gray-200'
                }`}
            >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="3" y1="6" x2="16" y2="6" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="18" x2="14" y2="18" />
                </svg>
            </button>
            <button
                type="button"
                onClick={() => onViewModeChange('grid')}
                title="Grid View"
                aria-label="Grid View"
                aria-pressed={viewMode === 'grid'}
                className={`grid h-10 w-10 place-items-center transition-colors duration-200 ${
                    viewMode === 'grid'
                        ? 'text-purple-400'
                        : 'text-gray-500 hover:text-gray-200'
                }`}
            >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="2" />
                    <rect x="14" y="3" width="7" height="7" rx="2" />
                    <rect x="14" y="14" width="7" height="7" rx="2" />
                    <rect x="3" y="14" width="7" height="7" rx="2" />
                </svg>
            </button>
        </div>
    );
}

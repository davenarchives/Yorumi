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
        <div className="flex items-center bg-[#141414] border border-white/10 rounded-xl p-1 gap-1 shrink-0">
            <button
                type="button"
                onClick={() => onViewModeChange('list')}
                title="List View"
                aria-label="List View"
                aria-pressed={viewMode === 'list'}
                className={`relative flex flex-col items-center justify-center w-9 h-9 rounded-lg transition-all duration-200 ${
                    viewMode === 'list'
                        ? 'bg-white/10 text-white shadow-sm'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                }`}
            >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="3" y1="6" x2="16" y2="6" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="18" x2="14" y2="18" />
                </svg>
                {viewMode === 'list' && (
                    <span className="absolute bottom-1 w-2.5 h-1 bg-blue-500 rounded-full transition-all" />
                )}
            </button>
            <button
                type="button"
                onClick={() => onViewModeChange('grid')}
                title="Grid View"
                aria-label="Grid View"
                aria-pressed={viewMode === 'grid'}
                className={`relative flex flex-col items-center justify-center w-9 h-9 rounded-lg transition-all duration-200 ${
                    viewMode === 'grid'
                        ? 'bg-white/10 text-white shadow-sm'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                }`}
            >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="2" />
                    <rect x="14" y="3" width="7" height="7" rx="2" />
                    <rect x="14" y="14" width="7" height="7" rx="2" />
                    <rect x="3" y="14" width="7" height="7" rx="2" />
                </svg>
                {viewMode === 'grid' && (
                    <span className="absolute bottom-1 w-2.5 h-1 bg-blue-500 rounded-full transition-all" />
                )}
            </button>
        </div>
    );
}

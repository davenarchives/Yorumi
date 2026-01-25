import { Search, LayoutList, LayoutGrid } from 'lucide-react';
import type { MangaChapter } from '../../../../types/manga';
import LoadingSpinner from '../../../../components/ui/LoadingSpinner';

interface ChapterListProps {
    chapters: MangaChapter[];
    currentChapter: MangaChapter | null;
    searchQuery: string;
    isLoading: boolean;
    viewMode: 'list' | 'grid';
    readChapters: Set<string>;
    isHeaderVisible: boolean;
    showChapters: boolean;
    onSearchChange: (query: string) => void;
    onLoadChapter: (chapter: MangaChapter) => void;
    onPrefetchChapter: (chapter: MangaChapter) => void;
    onViewModeChange: (mode: 'list' | 'grid') => void;
    onClose: () => void;
}

export default function ChapterList({
    chapters,
    currentChapter,
    searchQuery,
    isLoading,
    viewMode,
    readChapters,
    isHeaderVisible,
    showChapters,
    onSearchChange,
    onLoadChapter,
    onPrefetchChapter,
    onViewModeChange,
    onClose,
}: ChapterListProps) {
    // Filter and reverse chapters (oldest first)
    const filteredChapters = [...chapters].reverse().filter(chapter => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return chapter.title.toLowerCase().includes(query);
    });

    return (
        <aside className={`
            absolute md:static inset-y-0 left-0 z-40
            w-[280px] md:w-[320px] shrink-0 flex flex-col h-full 
            bg-[#111] md:bg-black/20 border-r border-white/10 
            transition-all duration-300 ease-in-out
            ${showChapters ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            ${isHeaderVisible ? 'pt-14' : 'pt-0'}
        `}>
            <div className="p-4 border-b border-white/5">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        Chapters
                    </h3>
                    <div className="flex bg-black/40 rounded-lg p-0.5 border border-white/10">
                        <button
                            onClick={() => onViewModeChange('list')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            <LayoutList className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => onViewModeChange('grid')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-white/20"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <LoadingSpinner size="md" />
                    </div>
                ) : filteredChapters.length > 0 ? (
                    <div className={viewMode === 'grid' ? "grid grid-cols-4 gap-2 p-3" : "flex flex-col"}>
                        {filteredChapters.map((chapter, index) => {
                            const isCurrent = currentChapter?.id === chapter.id;
                            const match = chapter.title.match(/Chapter\s+(\d+[\.]?\d*)/i);
                            const displayNum = match ? match[1] : '';
                            const cleanTitle = chapter.title.replace(/Chapter\s+\d+/, '').trim().replace(/^:/, '').trim();
                            const mainLabel = displayNum ? viewMode === 'grid' ? displayNum : `Chapter ${displayNum}` : chapter.title;
                            const subLabel = !displayNum ? '' : cleanTitle;
                            const isRead = readChapters.has(chapter.id);

                            return (
                                <button
                                    key={`${chapter.id}-${index}`}
                                    onClick={() => {
                                        onLoadChapter(chapter);
                                        onClose();
                                    }}
                                    onMouseEnter={() => onPrefetchChapter(chapter)}
                                    className={`
                                        group relative transition-all duration-200
                                        ${viewMode === 'grid'
                                            ? `aspect-square rounded-md flex items-center justify-center border overflow-hidden ${isCurrent ? 'bg-yorumi-manga text-white border-yorumi-manga font-bold' : isRead ? 'bg-white/5 text-gray-600 border-white/10 opacity-50' : 'bg-white/5 border-white/5 hover:bg-white/10 text-gray-400 hover:text-white'}`
                                            : `w-full px-5 py-3 text-left flex flex-col justify-center ${isCurrent ? 'bg-white/5' : isRead ? 'opacity-50' : 'hover:bg-white/5'}`
                                        }
                                    `}
                                    title={chapter.title}
                                >
                                    {viewMode === 'grid' ? (
                                        <span className="text-xs text-center line-clamp-2 px-1 break-words leading-tight text-[10px]">{mainLabel}</span>
                                    ) : (
                                        <>
                                            <div className="flex items-center justify-between w-full mb-0.5">
                                                <span className={`text-sm font-bold ${isCurrent ? 'text-yorumi-manga' : isRead ? 'text-gray-600' : 'text-gray-400 group-hover:text-white'}`}>
                                                    {mainLabel}
                                                </span>
                                                {isCurrent && (
                                                    <span className="w-5 h-5 rounded-full bg-yorumi-manga flex items-center justify-center">
                                                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center justify-between w-full">
                                                <span className={`text-xs truncate max-w-[180px] ${isCurrent ? 'text-white' : 'text-gray-600'}`}>
                                                    {subLabel || chapter.uploadDate || 'Available'}
                                                </span>
                                            </div>
                                        </>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="p-8 text-center text-gray-500 text-sm">
                        No chapters found.
                    </div>
                )}
            </div>
        </aside>
    );
}

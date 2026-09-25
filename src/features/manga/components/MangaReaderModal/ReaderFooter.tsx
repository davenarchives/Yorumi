import { ChevronLeft, ChevronRight, Menu, ChevronDown } from 'lucide-react';
import type { MangaChapter } from '../../../../types/manga';
import { useMemo, useEffect, useRef } from 'react';

interface ReaderFooterProps {
    chapters: MangaChapter[];
    currentChapter: MangaChapter | null;
    prevChapter: MangaChapter | null;
    nextChapter: MangaChapter | null;
    isVisible: boolean;
    showChapters: boolean;
    readChapters: Set<string>;
    onLoadChapter: (chapter: MangaChapter) => void;
    onToggleChapters: () => void;
}

export default function ReaderFooter({
    chapters,
    currentChapter,
    prevChapter,
    nextChapter,
    isVisible,
    showChapters,
    readChapters,
    onLoadChapter,
    onToggleChapters
}: ReaderFooterProps) {
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Scroll to active chapter when dropdown opens
    useEffect(() => {
        if (showChapters && currentChapter && dropdownRef.current) {
            // Small timeout to ensure the dropdown is rendered
            setTimeout(() => {
                const activeEl = dropdownRef.current?.querySelector(`[data-chapter-id="${currentChapter.id}"]`);
                if (activeEl) {
                    activeEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
                }
            }, 50);
        }
    }, [showChapters, currentChapter]);

    const getChapterText = (title: string) => {
        const match = title.match(/Chapter\s+(\d+[.]?\d*)/i);
        return match ? `Chapter ${match[1]}` : title;
    };

    // Strict descending order (highest chapter number first)
    const sortedChapters = useMemo(() => {
        return [...chapters].sort((a, b) => {
            const numA = parseFloat(a.title.match(/Chapter\s+(\d+[.]?\d*)/i)?.[1] || '0');
            const numB = parseFloat(b.title.match(/Chapter\s+(\d+[.]?\d*)/i)?.[1] || '0');
            return numB - numA;
        });
    }, [chapters]);

    return (
        <footer
            className={`shrink-0 bg-[#0a0a0a]/90 backdrop-blur-md z-50 transition-transform duration-300 absolute bottom-0 left-0 right-0 border-t border-white/10 ${
                isVisible ? 'translate-y-0' : 'translate-y-full'
            }`}
            style={{
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
        >
            <div className="w-full h-14 md:h-16 max-w-7xl mx-auto px-4 md:px-14 flex items-center justify-between gap-2">
                {/* LEFT: Prev Chapter */}
                <div className="flex-1 flex justify-start">
                    <button
                        onClick={() => prevChapter && onLoadChapter(prevChapter)}
                        disabled={!prevChapter}
                        className="h-9 md:h-10 px-3 md:px-5 bg-[#1a1a1a] border border-white/5 hover:bg-white/10 text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent flex items-center gap-1.5 rounded-xl transition-colors font-bold text-xs md:text-sm active:scale-95"
                        title="Previous Chapter"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        <span>Prev</span>
                    </button>
                </div>

                {/* CENTER: Chapter Selector */}
                <div className="flex-1 flex justify-center relative">
                    {/* Popover Dropdown */}
                    {showChapters && isVisible && (
                        <div className="absolute bottom-full mb-3 w-64 max-h-[280px] bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col z-[100]">
                            <div ref={dropdownRef} className="overflow-y-auto p-2 space-y-1 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
                                {sortedChapters.map((chapter) => {
                                    const isCurrent = currentChapter?.id === chapter.id;
                                    const isRead = readChapters.has(chapter.id);
                                    return (
                                        <button
                                            key={chapter.id}
                                            data-chapter-id={chapter.id}
                                            onClick={() => {
                                                onLoadChapter(chapter);
                                                onToggleChapters();
                                            }}
                                            className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                                                isCurrent 
                                                    ? 'bg-[#8b5cf6]/20 text-[#8b5cf6]' 
                                                    : isRead
                                                        ? 'text-gray-500 hover:bg-white/5 hover:text-white'
                                                        : 'text-gray-300 hover:bg-white/5 hover:text-white'
                                            }`}
                                        >
                                            {getChapterText(chapter.title)}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <button
                        onClick={onToggleChapters}
                        className="h-9 md:h-10 px-3 md:px-5 bg-white/5 hover:bg-white/10 text-white flex items-center gap-1.5 rounded-xl transition-colors font-bold text-xs md:text-sm border border-white/10 active:scale-95"
                    >
                        <Menu className="w-4 h-4 text-yorumi-manga" />
                        <span className="truncate max-w-[120px] sm:max-w-[180px]">
                            {currentChapter ? getChapterText(currentChapter.title) : 'Select'}
                        </span>
                        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showChapters ? 'rotate-180' : ''}`} />
                    </button>
                </div>

                {/* RIGHT: Next Chapter */}
                <div className="flex-1 flex justify-end">
                    <button
                        onClick={() => nextChapter && onLoadChapter(nextChapter)}
                        disabled={!nextChapter}
                        className="h-9 md:h-10 px-3 md:px-5 bg-yorumi-manga hover:bg-yorumi-manga/90 text-white disabled:opacity-30 disabled:hover:bg-yorumi-manga/50 flex items-center gap-1.5 rounded-xl transition-colors font-bold text-xs md:text-sm shadow-lg shadow-yorumi-manga/20 active:scale-95"
                        title="Next Chapter"
                    >
                        <span>Next</span>
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </footer>
    );
}

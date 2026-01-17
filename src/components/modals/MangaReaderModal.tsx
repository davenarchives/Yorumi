import { useState } from 'react';
import {
    ZoomIn,
    ZoomOut,
    LayoutList,
    LayoutGrid,
    Search,
    ChevronLeft,
    Info,
    Calendar,
    PenTool
} from 'lucide-react';
import type { Manga, MangaChapter, MangaPage } from '../../types/manga';
import LoadingSpinner from '../LoadingSpinner';

interface MangaReaderModalProps {
    isOpen: boolean;
    manga: Manga;
    chapters: MangaChapter[];
    currentChapter: MangaChapter | null;
    pages: MangaPage[];
    chapterSearchQuery: string;
    chaptersLoading: boolean;
    pagesLoading: boolean;
    zoomLevel: number;
    onClose: () => void;
    onChapterSearchChange: (query: string) => void;
    onLoadChapter: (chapter: MangaChapter) => void;
    onPrefetchChapter: (chapter: MangaChapter) => void;
    onZoomIn: () => void;
    onZoomOut: () => void;
}

export default function MangaReaderModal({
    isOpen,
    manga,
    chapters,
    currentChapter,
    pages,
    chapterSearchQuery,
    chaptersLoading,
    pagesLoading,
    zoomLevel,
    onClose,
    onChapterSearchChange,
    onLoadChapter,
    onPrefetchChapter,
    onZoomIn,
    onZoomOut,
}: MangaReaderModalProps) {
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
    const [showDetails, setShowDetails] = useState(true);

    if (!isOpen) return null;

    // Filter Chapters
    const filteredChapters = [...chapters].reverse().filter(chapter => {
        if (!chapterSearchQuery) return true;
        const query = chapterSearchQuery.toLowerCase();
        return chapter.title.toLowerCase().includes(query);
    });

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/95 backdrop-blur-md transition-opacity duration-300 pt-[72px]">
            <div className="w-full h-full flex flex-col bg-[#0a0a0a]">
                {/* 1. Header Row */}
                <header className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-white/10 bg-black/40 backdrop-blur-md z-40">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onClose}
                            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5" />
                            <span className="text-sm font-medium">Back</span>
                        </button>
                        <h1 className="text-lg font-bold text-white tracking-wide truncate max-w-md hidden md:block">
                            {manga.title}
                            {currentChapter && <span className="text-gray-500 font-normal ml-2">/ {currentChapter.title}</span>}
                        </h1>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Zoom Controls */}
                        <div className="flex items-center gap-2 bg-white/5 rounded-lg p-1 border border-white/10">
                            <button onClick={onZoomOut} className="p-1.5 hover:bg-white/10 rounded text-gray-300 hover:text-white">
                                <ZoomOut className="w-4 h-4" />
                            </button>
                            <span className="text-xs font-mono w-10 text-center text-gray-400">{zoomLevel}%</span>
                            <button onClick={onZoomIn} className="p-1.5 hover:bg-white/10 rounded text-gray-300 hover:text-white">
                                <ZoomIn className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Toggle Details */}
                        <button
                            onClick={() => setShowDetails(!showDetails)}
                            className={`p-2 rounded-lg transition-colors ${showDetails ? 'bg-yorumi-accent text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}
                            title="Toggle Details"
                        >
                            <Info className="w-5 h-5" />
                        </button>
                    </div>
                </header>

                {/* 2. Main Layout (3 Columns) */}
                <div className="flex-1 flex min-h-0 relative">

                    {/* COLUMN 1: Chapter List (Left Sidebar) */}
                    <aside className="w-[350px] shrink-0 flex flex-col h-full border-r border-white/10 bg-black/20 overflow-hidden">
                        <div className="p-4 border-b border-white/5">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                    Chapters ({chapters.length})
                                </h3>
                                <div className="flex bg-black/40 rounded-lg p-0.5 border border-white/10">
                                    <button
                                        onClick={() => setViewMode('list')}
                                        className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                    >
                                        <LayoutList className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setViewMode('grid')}
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
                                    placeholder="Number or Title..."
                                    value={chapterSearchQuery}
                                    onChange={(e) => onChapterSearchChange(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-white/20"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                            {chaptersLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <LoadingSpinner size="md" />
                                </div>
                            ) : filteredChapters.length > 0 ? (
                                <div className={viewMode === 'grid' ? "grid grid-cols-5 gap-2 p-3" : "flex flex-col"}>
                                    {filteredChapters.map((chapter, index) => {
                                        const isCurrent = currentChapter?.id === chapter.id;
                                        // Standardize Title Logic
                                        const match = chapter.title.match(/Chapter\s+(\d+[\.]?\d*)/i);
                                        const displayNum = match ? match[1] : '';
                                        const cleanTitle = chapter.title.replace(/Chapter\s+\d+/, '').trim().replace(/^:/, '').trim();
                                        const mainLabel = displayNum ? viewMode === 'grid' ? displayNum : `Chapter ${displayNum}` : chapter.title;
                                        const subLabel = !displayNum ? '' : cleanTitle;

                                        return (
                                            <button
                                                key={`${chapter.id}-${index}`}
                                                onClick={() => onLoadChapter(chapter)}
                                                onMouseEnter={() => onPrefetchChapter(chapter)}
                                                className={`
                                                    group relative transition-all duration-200
                                                    ${viewMode === 'grid'
                                                        ? `aspect-square rounded-md flex items-center justify-center border overflow-hidden ${isCurrent ? 'bg-yorumi-accent text-black border-yorumi-accent font-bold' : 'bg-white/5 border-white/5 hover:bg-white/10 text-gray-400 hover:text-white'}`
                                                        : `w-full px-5 py-3 text-left border-l-2 flex flex-col justify-center ${isCurrent ? 'border-yorumi-accent bg-white/5' : 'border-transparent hover:bg-white/5'}`
                                                    }
                                                `}
                                                title={chapter.title}
                                            >
                                                {viewMode === 'grid' ? (
                                                    <span className="text-xs text-center line-clamp-4 px-1 break-words leading-tight">{mainLabel}</span>
                                                ) : (
                                                    <>
                                                        <div className="flex items-center justify-between w-full mb-0.5">
                                                            <span className={`text-sm font-bold ${isCurrent ? 'text-yorumi-accent' : 'text-gray-400 group-hover:text-white'}`}>
                                                                {mainLabel}
                                                            </span>
                                                            {isCurrent && (
                                                                <span className="w-5 h-5 rounded-full bg-yorumi-accent flex items-center justify-center">
                                                                    <svg className="w-3 h-3 text-black" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
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

                    {/* COLUMN 2: Reader (Center) */}
                    <div className="flex-1 min-w-0 bg-[#050505] relative flex flex-col border-r border-white/5">
                        <div className="flex-1 overflow-y-auto relative h-full [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                            {pagesLoading ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                                    <LoadingSpinner size="lg" />
                                    <p className="text-gray-400 animate-pulse">Loading Pages...</p>
                                </div>
                            ) : pages.length > 0 ? (
                                <div className="flex flex-col items-center py-8 min-h-full">
                                    {pages.map((page, index) => (
                                        <img
                                            key={`${page.pageNumber}-${index}`}
                                            src={page.imageUrl}
                                            alt={`Page ${page.pageNumber}`}
                                            className="transition-all duration-200 block shadow-2xl"
                                            style={{ width: `${zoomLevel}%`, maxWidth: '100%' }}
                                            loading="lazy"
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 gap-4">
                                    {currentChapter ? (
                                        <>
                                            <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center">
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-red-500/50">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                                                </svg>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-gray-400 font-medium">Unable to load chapter</p>
                                                <p className="text-xs text-gray-600 mt-1">Please try another source or chapter</p>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 opacity-50">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                                                </svg>
                                            </div>
                                            <p>Select a chapter to start reading</p>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* COLUMN 3: Details (Right Sidebar) */}
                    {showDetails && (
                        <aside className="w-[350px] shrink-0 h-full overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] bg-black/20">
                            <div className="p-6 flex flex-col gap-6">
                                {/* Poster */}
                                <div className="aspect-[2/3] w-full rounded-xl overflow-hidden shadow-2xl border border-white/5 relative group">
                                    <img
                                        src={manga.images.jpg.large_image_url}
                                        alt={manga.title}
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                                    <div className="absolute bottom-4 left-4 right-4">
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            <span className="px-2 py-0.5 bg-yorumi-accent text-black text-xs font-bold rounded">
                                                ★ {manga.score}
                                            </span>
                                            <span className={`px-2 py-0.5 text-white text-xs font-bold rounded ${manga.countryOfOrigin === 'KR' ? 'bg-blue-600' :
                                                manga.countryOfOrigin === 'CN' ? 'bg-red-600' : 'bg-white/20'
                                                }`}>
                                                {manga.countryOfOrigin === 'KR' ? 'Manhwa' : manga.countryOfOrigin === 'CN' ? 'Manhua' : 'Manga'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Info */}
                                <div className="space-y-6">
                                    <div>
                                        <h2 className="text-xl font-bold leading-tight text-white mb-2">
                                            {manga.title}
                                        </h2>
                                        <p className="text-sm text-gray-500 font-medium">
                                            {manga.type} • {manga.status}
                                        </p>
                                    </div>

                                    {/* Grid Stats */}
                                    <div className="grid grid-cols-2 gap-4 text-sm bg-white/5 p-4 rounded-xl border border-white/5">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-gray-500 text-xs uppercase font-bold tracking-wider flex items-center gap-1">
                                                <Calendar className="w-3 h-3" /> Published
                                            </span>
                                            <span className="text-gray-200 font-medium">
                                                {manga.published?.string || 'Unknown'}
                                            </span>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="text-gray-500 text-xs uppercase font-bold tracking-wider flex items-center gap-1">
                                                <PenTool className="w-3 h-3" /> Authors
                                            </span>
                                            <span className="text-gray-200 font-medium line-clamp-1">
                                                {manga.authors?.[0]?.name || 'Unknown'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Genres */}
                                    <div>
                                        <span className="text-gray-500 text-xs uppercase font-bold tracking-wider mb-2 block">Genres</span>
                                        <div className="flex flex-wrap gap-2">
                                            {manga.genres?.map(g => (
                                                <span key={g.mal_id} className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/5 rounded text-xs text-gray-300 transition-colors cursor-default">
                                                    {g.name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-white/10">
                                        <span className="text-gray-500 text-xs uppercase font-bold tracking-wider mb-2 block">Synopsis</span>
                                        <p className="text-sm text-gray-400 leading-relaxed">
                                            {manga.synopsis}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </aside>
                    )}
                </div>
            </div >
        </div >
    );
}

import { ArrowLeft, ZoomIn, ZoomOut } from 'lucide-react';
import type { MangaChapter } from '../../../../types/manga';

interface ReaderHeaderProps {
    mangaTitle: string;
    mangaImage: string;
    currentChapter: MangaChapter | null;
    zoomLevel: number;
    isVisible: boolean;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onClose?: () => void;
}

export default function ReaderHeader({
    mangaTitle,
    mangaImage,
    currentChapter,
    zoomLevel,
    isVisible,
    onZoomIn,
    onZoomOut,
    onClose,
}: ReaderHeaderProps) {
    return (
        <header
            className={`shrink-0 bg-[#0a0a0a]/90 backdrop-blur-md z-50 transition-transform duration-300 absolute top-0 left-0 right-0 border-b border-white/10 ${
                isVisible ? 'translate-y-0' : '-translate-y-full'
            }`}
            style={{
                paddingTop: 'env(safe-area-inset-top, 0px)',
            }}
        >
            <div className="w-full h-14 md:h-16 max-w-7xl mx-auto px-4 md:px-14 flex items-center justify-between gap-3">
                {/* LEFT: Nav & Title */}
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="p-2 -ml-1 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors flex items-center justify-center shrink-0 active:scale-95"
                            title="Back"
                            aria-label="Back"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    )}

                    {mangaImage && (
                        <img 
                            src={mangaImage} 
                            alt="cover" 
                            className="w-9 h-12 object-cover rounded shadow-sm hidden sm:block shrink-0"
                        />
                    )}

                    <div className="flex flex-col min-w-0 justify-center">
                        <h1 className="text-sm font-bold text-white truncate leading-tight">
                            {mangaTitle}
                        </h1>
                        <span className="text-xs text-gray-400 truncate leading-normal">
                            {currentChapter ? currentChapter.title : 'Reading'}
                        </span>
                    </div>
                </div>

                {/* CENTER: Zoom Controls */}
                <div className="flex-1 flex justify-center hidden sm:flex">
                    <div className="flex items-center gap-1 bg-white/5 rounded-full p-1 border border-white/10">
                        <button onClick={onZoomOut} className="p-1.5 hover:bg-white/10 rounded-full text-gray-300 hover:text-white transition-colors">
                            <ZoomOut className="w-4 h-4" />
                        </button>
                        <span className="text-xs font-mono font-bold w-12 text-center text-gray-300">{zoomLevel}%</span>
                        <button onClick={onZoomIn} className="p-1.5 hover:bg-white/10 rounded-full text-gray-300 hover:text-white transition-colors">
                            <ZoomIn className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* RIGHT: Controls (Removed per user request) */}
                <div className="flex items-center justify-end gap-2 flex-1 shrink-0">
                </div>
            </div>
        </header>
    );
}

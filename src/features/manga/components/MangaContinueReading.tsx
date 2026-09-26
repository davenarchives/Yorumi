import { ArrowLeft, X } from 'lucide-react';
import Carousel from '../../../components/ui/Carousel';
import type { ReadProgress } from '../../../utils/storage';

interface MangaContinueReadingProps {
    items: ReadProgress[];
    variant?: 'dashboard' | 'page';
    onReadClick: (mangaId: string, mangaTitle: string, chapterNumber: string) => void;
    onRemove: (mangaId: string) => void;
    title?: string;
    onBack?: () => void;
    gridColumns?: 4 | 6;
}

export default function MangaContinueReading({
    items,
    variant = 'dashboard',
    onReadClick,
    onRemove,
    title,
    onBack,
    gridColumns,
}: MangaContinueReadingProps) {
    if (items.length === 0) return null;

    // Deduplicate history by title/id (same as MangaContinueReadingPage)
    const seen = new Set<string>();
    const dedupedItems = items.filter((item) => {
        const key = (item.mangaTitle || item.mangaId).toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    if (variant === 'page') {
        return (
            <div className="pb-12 min-h-screen">
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={onBack}
                        className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-white" />
                    </button>
                    <h2 className="text-2xl font-black text-white tracking-wide uppercase">Continue Reading</h2>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                    {dedupedItems.map((item) => (
                        <div
                            key={item.mangaId}
                            className="relative group cursor-pointer"
                            onClick={() => onReadClick(item.mangaId, item.mangaTitle, item.chapterNumber)}
                        >
                            <div className="relative aspect-[3/4] rounded-xl overflow-hidden mb-3 shadow-lg border border-white/5 transition-colors">
                                <img
                                    src={item.mangaImage}
                                    alt={item.mangaTitle}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                />
                                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                    {/* Icon Removed */}
                                </div>
                                <div className="absolute top-2 left-2 bg-yorumi-manga/90 backdrop-blur text-white text-[10px] font-bold px-1.5 py-0.5 rounded border border-white/10 shadow-lg">
                                    CH {item.chapterNumber}
                                </div>
                            </div>
                            <div className="px-1">
                                <h4 className="text-sm font-bold text-white/90 truncate group-hover:text-yorumi-manga transition-colors">
                                    {item.mangaTitle}
                                </h4>
                                <p className="text-xs text-gray-500 truncate mt-0.5">
                                    Chapter {item.chapterNumber}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Dashboard (Carousel) Variant
    return (
        <Carousel
            title={title || "Continue Reading"}
            variant="portrait"
            gridColumns={gridColumns}

        >
            {dedupedItems.map((item) => (
                <div
                    key={item.mangaId}
                    className="relative group h-full flex-[0_0_150px] sm:flex-[0_0_170px] md:flex-[0_0_190px]"
                    onClick={() => onReadClick(item.mangaId, item.mangaTitle, item.chapterNumber)}
                >
                    <div className="relative aspect-[3/4] rounded-xl overflow-hidden mb-3 shadow-lg border border-white/5 transition-colors cursor-pointer">
                        <img
                            src={item.mangaImage}
                            alt={item.mangaTitle}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                            {/* Icon Removed */}
                        </div>
                        <div className="absolute top-2 left-2 bg-yorumi-manga/80 backdrop-blur text-white text-[10px] font-bold px-1.5 py-0.5 rounded border border-white/10 shadow-lg">
                            CH {item.chapterNumber}
                        </div>
                        {/* Remove Button */}
                        <button
                            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 backdrop-blur hover:bg-red-500/80 text-white/80 hover:text-white transition-all opacity-0 group-hover:opacity-100 z-10"
                            onClick={(e) => {
                                e.stopPropagation();
                                onRemove(item.mangaId);
                            }}
                            title="Remove from history"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <div className="px-1">
                        <h4 className="text-sm font-bold text-white/90 truncate group-hover:text-yorumi-manga transition-colors">
                            {item.mangaTitle}
                        </h4>
                        <p className="text-xs text-gray-400 truncate mt-0.5">
                            Chapter {item.chapterNumber}
                        </p>
                    </div>
                </div>
            ))}
        </Carousel>
    );
}

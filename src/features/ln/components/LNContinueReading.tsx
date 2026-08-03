import React from 'react';
import { X } from 'lucide-react';
import Carousel from '../../../components/ui/Carousel';
import type { LNReadingProgress } from '../../../hooks/useContinueLNReading';

interface LNContinueReadingProps {
    items: LNReadingProgress[];
    onReadClick: (novelId: string | number, novelTitle: string, chapterId: string) => void;
    onRemove: (novelId: string | number) => void;
    title?: string;
}

export default function LNContinueReading({
    items,
    onReadClick,
    onRemove,
    title = 'Continue Reading Light Novels',
}: LNContinueReadingProps) {
    if (items.length === 0) return null;

    const seen = new Set<string>();
    const dedupedItems = items.filter((item) => {
        const key = String(item.novelId).toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    return (
        <Carousel title={title} variant="portrait">
            {dedupedItems.map((item) => (
                <div
                    key={item.novelId}
                    className="relative group h-full flex-[0_0_150px] sm:flex-[0_0_170px] md:flex-[0_0_190px] cursor-pointer"
                    onClick={() => onReadClick(item.novelId, item.novelTitle, item.chapterId)}
                >
                    <div className="relative aspect-[3/4] rounded-xl overflow-hidden mb-3 shadow-lg border border-white/5 transition-colors">
                        <img
                            src={item.coverImage}
                            alt={item.novelTitle}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center" />
                        <div className="absolute top-2 left-2 bg-amber-400 text-black text-[10px] font-black px-1.5 py-0.5 rounded shadow-lg uppercase">
                            Ch. {item.chapterNumber || 1}
                        </div>
                        <button
                            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 backdrop-blur hover:bg-red-500/80 text-white/80 hover:text-white transition-all opacity-0 group-hover:opacity-100 z-10"
                            onClick={(e) => {
                                e.stopPropagation();
                                onRemove(item.novelId);
                            }}
                            title="Remove from history"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <div className="px-1">
                        <h4 className="text-sm font-bold text-white/90 truncate group-hover:text-amber-400 transition-colors">
                            {item.novelTitle}
                        </h4>
                        <p className="text-xs text-gray-400 truncate mt-0.5">
                            {item.chapterTitle || `Chapter ${item.chapterNumber}`}
                        </p>
                    </div>
                </div>
            ))}
        </Carousel>
    );
}

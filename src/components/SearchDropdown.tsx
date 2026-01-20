
import { ChevronRight } from 'lucide-react';

interface SearchResultItem {
    id: number | string;
    title: string;
    subtitle: string;
    image: string;
    date?: string;
    type?: string;
    duration?: string;
    url: string;
}

interface SearchDropdownProps {
    results: SearchResultItem[];
    isVisible: boolean;
    onSelect: (item: SearchResultItem) => void;
    onViewAll: () => void;
    isLoading?: boolean;
}

export default function SearchDropdown({
    results,
    isVisible,
    onSelect,
    onViewAll,
    isLoading
}: SearchDropdownProps) {
    if (!isVisible) return null;

    // Use specific colors from the screenshot approximation
    // Background seems to be a dark blueish-purple or just dark theme default
    // The "View all results" button is pink: #ffb7e0 (approximate from screenshot or yorumi-accent?)
    // Actually yorumi-accent in Navbar is varying. Let's use a hardcoded pink for now to match screenshot if yorumi-accent isn't it.
    // Screenshot pink: Light pink/lavender.

    return (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[#150F26] rounded-lg overflow-hidden shadow-2xl z-50 border border-white/5 font-sans">
            {isLoading ? (
                <div className="p-4 text-center text-gray-400 text-sm">Loading...</div>
            ) : results.length > 0 ? (
                <>
                    <div className="max-h-[70vh] overflow-y-auto">
                        {results.map((item) => (
                            <div
                                key={item.id}
                                onClick={() => onSelect(item)}
                                className="group flex items-center gap-4 p-3 hover:bg-white/5 cursor-pointer transition-colors border-b border-white/5 last:border-b-0"
                            >
                                {/* Image */}
                                <div className="w-12 h-16 shrink-0 rounded overflow-hidden relative">
                                    <img
                                        src={item.image}
                                        alt={item.title}
                                        className="w-full h-full object-cover"
                                    />
                                </div>

                                {/* Text Content */}
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-white font-bold text-sm truncate leading-tight mb-0.5">
                                        {item.title}
                                    </h4>
                                    <div className="text-gray-400 text-xs truncate mb-1">
                                        {item.subtitle}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium tracking-wide">
                                        {item.date && <span>{item.date}</span>}
                                        {item.date && item.type && <span className="w-1 h-1 rounded-full bg-gray-600" />}
                                        {item.type && <span>{item.type}</span>}
                                        {item.type && item.duration && <span className="w-1 h-1 rounded-full bg-gray-600" />}
                                        {item.duration && <span>{item.duration}</span>}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* View All Button */}
                    <div
                        onClick={onViewAll}
                        className="bg-yorumi-accent hover:bg-yorumi-accent/90 p-3 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                    >
                        <span className="text-[#150F26] font-bold text-sm uppercase tracking-wide">
                            View all results
                        </span>
                        <ChevronRight className="w-4 h-4 text-[#150F26]" />
                    </div>
                </>
            ) : (
                <div className="p-4 text-center text-gray-400 text-sm">
                    No results found
                </div>
            )}
        </div>
    );
}

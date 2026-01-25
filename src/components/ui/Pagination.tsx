import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
    currentPage: number;
    lastPage: number;
    onPageChange: (page: number) => void;
    accentColor?: string; // Optional custom accent color class (text-...)
}

export default function Pagination({
    currentPage,
    lastPage,
    onPageChange,
    accentColor = 'text-yorumi-accent'
}: PaginationProps) {
    // Generate page numbers to display
    const getPageNumbers = () => {
        const pages = [];
        const maxVisible = 5;

        if (lastPage <= maxVisible) {
            for (let i = 1; i <= lastPage; i++) pages.push(i);
        } else {
            // Logic to show generic window of pages around current
            let start = Math.max(1, currentPage - 2);
            let end = Math.min(lastPage, start + maxVisible - 1);

            if (end - start < maxVisible - 1) {
                start = Math.max(1, end - maxVisible + 1);
            }

            for (let i = start; i <= end; i++) pages.push(i);
        }
        return pages;
    };

    const pages = getPageNumbers();
    // Extract base color name for bg logic (e.g. 'text-yorumi-accent' -> 'bg-yorumi-accent')
    const activeBgClass = accentColor.replace('text-', 'bg-');

    if (lastPage <= 1) return null;

    return (
        <div className="flex items-center justify-center gap-2 mt-12 pb-12">
            {/* First Page */}
            <button
                onClick={() => onPageChange(1)}
                disabled={currentPage === 1}
                className="w-10 h-10 rounded-full bg-[#1a1a2e] border border-white/5 flex items-center justify-center text-gray-400 hover:bg-[#2a2a4e] hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
                <ChevronsLeft className="w-4 h-4" />
            </button>

            {/* Previous Page */}
            <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="w-10 h-10 rounded-full bg-[#1a1a2e] border border-white/5 flex items-center justify-center text-gray-400 hover:bg-[#2a2a4e] hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
                <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Page Numbers */}
            {pages.map((page) => (
                <button
                    key={page}
                    onClick={() => onPageChange(page)}
                    className={`w-10 h-10 rounded-full border flex items-center justify-center font-bold text-sm transition-all duration-200
                        ${currentPage === page
                            ? `${activeBgClass} text-white border-transparent shadow-lg shadow-${activeBgClass}/20`
                            : 'bg-[#1a1a2e] border-white/5 text-gray-400 hover:bg-[#2a2a4e] hover:text-white'
                        }
                    `}
                >
                    {page}
                </button>
            ))}

            {/* Next Page */}
            <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === lastPage}
                className="w-10 h-10 rounded-full bg-[#1a1a2e] border border-white/5 flex items-center justify-center text-gray-400 hover:bg-[#2a2a4e] hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
                <ChevronRight className="w-4 h-4" />
            </button>

            {/* Last Page */}
            <button
                onClick={() => onPageChange(lastPage)}
                disabled={currentPage === lastPage}
                className="w-10 h-10 rounded-full bg-[#1a1a2e] border border-white/5 flex items-center justify-center text-gray-400 hover:bg-[#2a2a4e] hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
                <ChevronsRight className="w-4 h-4" />
            </button>
        </div>
    );
}

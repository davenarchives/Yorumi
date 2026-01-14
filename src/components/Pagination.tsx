interface PaginationProps {
    currentPage: number;
    lastPage: number;
    onPageChange: (page: number) => void;
    isLoading?: boolean;
    onPrefetchPage?: (page: number) => void;
}


export default function Pagination({ currentPage, lastPage, onPageChange, isLoading, onPrefetchPage }: PaginationProps) {
    if (lastPage <= 1) return null;

    // Helper to generate page numbers
    const getPageNumbers = () => {
        // Range: Current - 2 to Current + 2
        // Clamped by 1 and lastPage.
        const start = Math.max(1, currentPage - 2);
        const end = Math.min(lastPage, currentPage + 2);

        const pages = [];
        for (let i = start; i <= end; i++) {
            pages.push(i);
        }
        return pages;
    };

    const handlePageChange = (page: number) => {
        if (page >= 1 && page <= lastPage && page !== currentPage) {
            onPageChange(page);
        }
    };

    return (
        <div className="flex justify-center items-center gap-2 mt-12 pb-8 select-none">
            {/* First Page */}
            <button
                onClick={() => handlePageChange(1)}
                onMouseEnter={() => onPrefetchPage?.(1)}
                disabled={currentPage === 1 || isLoading}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-[#2a2a3e] hover:bg-[#3a3a4e] disabled:opacity-30 disabled:cursor-not-allowed text-gray-300 transition-colors font-bold"
                title="First Page"
            >
                «
            </button>

            {/* Previous Page */}
            <button
                onClick={() => handlePageChange(currentPage - 1)}
                onMouseEnter={() => onPrefetchPage?.(currentPage - 1)}
                disabled={currentPage === 1 || isLoading}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-[#2a2a3e] hover:bg-[#3a3a4e] disabled:opacity-30 disabled:cursor-not-allowed text-gray-300 transition-colors font-bold"
                title="Previous Page"
            >
                ‹
            </button>

            {/* Page Numbers */}
            {getPageNumbers().map((page) => (
                <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    onMouseEnter={() => onPrefetchPage?.(page)}
                    disabled={isLoading}
                    className={`w-10 h-10 flex items-center justify-center rounded-full text-sm font-bold transition-all ${currentPage === page
                        ? 'bg-[#ffbade] text-black shadow-lg shadow-[#ffbade]/20 scan-effect' // Active: Pink
                        : 'bg-[#2a2a3e] text-gray-300 hover:bg-[#3a3a4e]'
                        }`}
                >
                    {page}
                </button>
            ))}

            {/* Next Page */}
            <button
                onClick={() => handlePageChange(currentPage + 1)}
                onMouseEnter={() => onPrefetchPage?.(currentPage + 1)}
                disabled={currentPage === lastPage || isLoading}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-[#2a2a3e] hover:bg-[#3a3a4e] disabled:opacity-30 disabled:cursor-not-allowed text-gray-300 transition-colors font-bold"
                title="Next Page"
            >
                ›
            </button>

            {/* Last Page */}
            <button
                onClick={() => handlePageChange(lastPage)}
                onMouseEnter={() => onPrefetchPage?.(lastPage)}
                disabled={currentPage === lastPage || isLoading}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-[#2a2a3e] hover:bg-[#3a3a4e] disabled:opacity-30 disabled:cursor-not-allowed text-gray-300 transition-colors font-bold"
                title="Last Page"
            >
                »
            </button>
        </div>
    );
}

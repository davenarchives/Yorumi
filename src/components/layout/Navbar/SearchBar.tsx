import { Search, X } from 'lucide-react';
import { forwardRef } from 'react';
import SearchDropdown from './SearchDropdown';

interface SearchBarProps {
    searchQuery: string;
    searchResults: any[];
    isSearching: boolean;
    onSearchChange: (query: string) => void;
    onSearchSubmit: (e: React.FormEvent) => void;
    onClearSearch: () => void;
    onResultSelect: (item: any) => void;
    placeholder?: string;
    showShortcut?: boolean;
    autoFocus?: boolean;
}

const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(({
    searchQuery,
    searchResults,
    isSearching,
    onSearchChange,
    onSearchSubmit,
    onClearSearch,
    onResultSelect,
    placeholder = 'Search...',
    showShortcut = true,
    autoFocus = false,
}, ref) => {
    return (
        <div className="relative group w-full">
            <form onSubmit={onSearchSubmit} className="relative w-full">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-white transition-colors">
                    <Search className="w-4 h-4" />
                </div>
                <input
                    ref={ref}
                    type="text"
                    placeholder={placeholder}
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    autoFocus={autoFocus}
                    className={`w-full h-9 bg-[#1c1c1c] border border-transparent focus:border-white/10 rounded-md pl-10 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:bg-[#252525] transition-all ${searchQuery ? 'pr-20' : 'pr-10'}`}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 z-10">
                    {searchQuery && (
                        <button
                            type="button"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                onClearSearch();
                            }}
                            className="text-gray-500 hover:text-white transition-colors p-1 cursor-pointer"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                    {showShortcut && (
                        <div className="pointer-events-none flex items-center">
                            <span className="bg-white/10 text-gray-400 text-xs px-1.5 py-0.5 rounded border border-white/10 font-mono leading-none flex items-center justify-center">
                                /
                            </span>
                        </div>
                    )}
                </div>
            </form>

            <SearchDropdown
                isVisible={!!searchQuery && (searchResults.length > 0 || isSearching)}
                results={searchResults}
                isLoading={isSearching}
                onSelect={onResultSelect}
                onViewAll={() => {
                    onSearchSubmit({ preventDefault: () => { } } as React.FormEvent);
                    onSearchChange('');
                }}
            />
        </div>
    );
});

SearchBar.displayName = 'SearchBar';

export default SearchBar;

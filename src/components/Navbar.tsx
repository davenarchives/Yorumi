interface NavbarProps {
    activeTab: 'anime' | 'manga';
    searchQuery: string;
    isSearching: boolean;
    onTabChange: (tab: 'anime' | 'manga') => void;
    onSearchChange: (query: string) => void;
    onSearchSubmit: (e: React.FormEvent) => void;
    onClearSearch: () => void;
}

export default function Navbar({
    activeTab,
    searchQuery,
    isSearching,
    onTabChange,
    onSearchChange,
    onSearchSubmit,
    onClearSearch,
}: NavbarProps) {
    return (
        <nav className="flex items-center justify-between px-8 py-4 bg-[#0a0a0a] sticky top-0 z-50 shadow-md shadow-black/20">
            <div className="flex items-center gap-8">
                <h1
                    onClick={onClearSearch}
                    className="text-2xl font-bold tracking-tighter text-white cursor-pointer hover:opacity-80 transition-opacity"
                >
                    YORUMI
                </h1>
                <div className="flex gap-4 text-sm font-medium text-gray-400">
                    <button
                        onClick={() => { onClearSearch(); onTabChange('anime'); }}
                        className={`px-4 py-2 rounded-full transition-colors ${activeTab === 'anime' && !isSearching ? 'text-white bg-white/10' : 'hover:text-white'}`}
                    >
                        Home
                    </button>
                    <button
                        onClick={() => onTabChange('manga')}
                        className={`px-4 py-2 rounded-full transition-colors ${activeTab === 'manga' ? 'text-white bg-white/10' : 'hover:text-white'}`}
                    >
                        Manga
                    </button>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <form onSubmit={onSearchSubmit} className="relative flex items-center">
                    <input
                        type="text"
                        placeholder={activeTab === 'manga' ? "Search manga..." : "Search anime..."}
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-full py-2 px-6 pr-12 w-64 md:w-80 text-sm focus:outline-none focus:border-white/20 focus:bg-white/10 transition-all placeholder:text-gray-500"
                    />
                    <button type="submit" className="absolute right-4 text-gray-400 hover:text-white transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                        </svg>
                    </button>
                </form>
            </div>
        </nav>
    );
}

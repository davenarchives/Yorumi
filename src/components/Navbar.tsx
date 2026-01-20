import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shuffle, User as UserIcon, History, Heart, LogOut, BookOpen } from 'lucide-react';
import { animeService } from '../services/animeService';
import { mangaService } from '../services/mangaService';
import { useAuth } from '../context/AuthContext';
import SearchDropdown from './SearchDropdown';

interface NavbarProps {
    activeTab: 'anime' | 'manga';
    searchQuery: string;
    onTabChange: (tab: 'anime' | 'manga') => void;
    onSearchChange: (query: string) => void;
    onSearchSubmit: (e: React.FormEvent) => void;
    onClearSearch: () => void;
    onLogoClick?: () => void;
    searchResults?: any[]; // Using any[] for now, will refine
    isSearching?: boolean;
}

export default function Navbar({
    activeTab,
    searchQuery,
    onTabChange,
    onSearchChange,
    onSearchSubmit,
    onClearSearch,
    onLogoClick,
    searchResults = [],
    isSearching = false,
}: NavbarProps) {
    const searchInputRef = useRef<HTMLInputElement>(null);
    const navigate = useNavigate();
    const { login, logout, user, avatar } = useAuth();

    const [isScrolled, setIsScrolled] = useState(false);
    const [isLoadingRandom, setIsLoadingRandom] = useState(false);
    const [showMobileSearch, setShowMobileSearch] = useState(false);

    // Handle scroll for transparent navbar
    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 10);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Keyboard shortcut to focus search
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.key === '/' || (e.ctrlKey && e.key === 'k')) && document.activeElement !== searchInputRef.current) {
                e.preventDefault();
                searchInputRef.current?.focus();
                // If on mobile and search is hidden, show it
                if (window.innerWidth < 768) {
                    setShowMobileSearch(true);
                }
            }
            if (e.key === 'Escape' && showMobileSearch) {
                setShowMobileSearch(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showMobileSearch]);

    // Random handler
    const handleRandom = async () => {
        if (isLoadingRandom) return;
        setIsLoadingRandom(true);
        try {
            if (activeTab === 'manga') {
                const result = await mangaService.getRandomManga();
                if (result && result.id) {
                    navigate(`/manga/${result.id}`, { state: { fromRandom: true } });
                }
            } else {
                const result = await animeService.getRandomAnime();
                if (result && result.id) {
                    navigate(`/anime/${result.id}`, { state: { fromRandom: true } });
                }
            }
        } catch (error) {
            console.error('Failed to get random media:', error);
            // Fallback to random ID
            const randomId = Math.floor(Math.random() * 50000) + 1;
            navigate(`/${activeTab}/${randomId}`, { state: { fromRandom: true } });
        } finally {
            setIsLoadingRandom(false);
        }
    };

    return (
        <nav className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-500 ${isScrolled ? 'bg-[#0a0a0a] border-b border-white/5 py-3' : 'bg-gradient-to-b from-black via-black/60 to-transparent border-transparent py-4'
            }`}>
            <div className="px-4 md:px-8 flex items-center justify-between">
                {/* LEFT: Logo + Search + Toggle + Random */}
                <div className="flex items-center gap-4 md:gap-6">
                    {/* Logo */}
                    <div
                        onClick={onLogoClick || onClearSearch}
                        className="flex items-center cursor-pointer hover:opacity-90 transition-opacity select-none shrink-0"
                        role="button"
                        tabIndex={0}
                    >
                        <span className="text-xl md:text-2xl font-black text-white tracking-tighter">YORU</span>
                        <span className="text-xl md:text-2xl font-black text-yorumi-accent tracking-tighter">MI</span>
                    </div>

                    <div className="relative group w-full max-w-xs hidden md:block">
                        <form onSubmit={onSearchSubmit} className="relative w-full">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-white transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                                </svg>
                            </div>
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => onSearchChange(e.target.value)}
                                className={`w-full h-9 bg-[#1c1c1c] border border-transparent focus:border-white/10 rounded-md pl-10 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:bg-[#252525] transition-all ${searchQuery ? 'pr-20' : 'pr-10'}`}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onClearSearch();
                                            searchInputRef.current?.focus();
                                        }}
                                        className="text-gray-500 hover:text-white transition-colors p-1"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                )}
                                <div className="pointer-events-none flex items-center">
                                    <span className="bg-white/10 text-gray-400 text-xs px-1.5 py-0.5 rounded border border-white/10 font-mono leading-none flex items-center justify-center">
                                        /
                                    </span>
                                </div>
                            </div>
                        </form>

                        {/* Search Dropdown */}
                        <SearchDropdown
                            isVisible={!!searchQuery && (searchResults.length > 0 || isSearching)}
                            results={searchResults}
                            isLoading={isSearching}
                            onSelect={(item) => {
                                navigate(item.url);
                                onClearSearch();
                            }}
                            onViewAll={() => {
                                onSearchSubmit({ preventDefault: () => { } } as React.FormEvent);
                                onSearchChange('');
                            }}
                        />
                    </div>

                    {/* Toggle & Random Controls Container */}
                    <div className="hidden md:flex items-center gap-6">
                        {/* ANI | MAN Toggle */}
                        <div className="flex items-center rounded bg-[#1c1c1c] overflow-hidden border border-transparent hover:border-white/10 transition-colors">
                            <button
                                onClick={() => { onClearSearch(); onTabChange('anime'); }}
                                className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${activeTab === 'anime'
                                    ? 'bg-yorumi-accent text-[#0a0a0a]'
                                    : 'text-gray-500 hover:text-white'
                                    }`}
                            >
                                ANI
                            </button>
                            <button
                                onClick={() => onTabChange('manga')}
                                className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${activeTab === 'manga'
                                    ? 'bg-yorumi-main text-white'
                                    : 'text-gray-500 hover:text-white'
                                    }`}
                            >
                                MAN
                            </button>
                        </div>

                        {/* Random Button */}
                        <button
                            onClick={handleRandom}
                            disabled={isLoadingRandom}
                            className="group flex items-center justify-center p-2 text-gray-500 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Random Anime"
                        >
                            <Shuffle className={`w-5 h-5 group-hover:text-yorumi-accent transition-all duration-300 ${isLoadingRandom ? 'animate-spin' : 'group-hover:rotate-180'}`} />
                        </button>
                    </div>
                </div>

                {/* RIGHT: Login + Mobile Controls */}
                <div className="flex items-center justify-end gap-2 md:gap-4 shrink-0">
                    {/* Mobile Search Icon */}
                    <button
                        onClick={() => setShowMobileSearch(!showMobileSearch)}
                        className="md:hidden text-white p-2 md:hover:bg-white/10 active:bg-white/10 rounded-full transition-colors outline-none focus:outline-none"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                            {showMobileSearch ? (
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                            )}
                        </svg>
                    </button>

                    {user ? (
                        <div className="relative group">
                            <button className="flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full overflow-hidden border-2 border-transparent hover:border-yorumi-accent transition-all">
                                {avatar ? (
                                    <img src={avatar} alt="User Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-yorumi-main flex items-center justify-center text-white font-bold text-xs">
                                        {user.displayName?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || 'U'}
                                    </div>
                                )}
                            </button>
                            {/* Dropdown Menu */}
                            <div className="absolute right-0 mt-3 w-72 bg-[#1c1c1c] rounded-2xl shadow-2xl py-6 px-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50 border border-white/5">
                                {/* Header */}
                                <div className="mb-6 px-2">
                                    <div className="text-yorumi-accent font-bold text-lg">
                                        {user.displayName?.split(' ')[0] || 'User'}
                                    </div>
                                    <div className="text-gray-400 text-sm truncate font-medium">
                                        {user.email}
                                    </div>
                                </div>

                                {/* Menu Items */}
                                <div className="space-y-2">
                                    <button
                                        onClick={() => navigate('/profile?tab=profile')}
                                        className="w-full flex items-center gap-3 px-4 py-3 bg-[#2a2a2a]/50 hover:bg-[#2a2a2a] text-gray-200 rounded-xl transition-all group/item"
                                    >
                                        <UserIcon className="w-5 h-5 text-gray-400 group-hover/item:text-white transition-colors" />
                                        <span className="font-medium">Profile</span>
                                    </button>

                                    {activeTab === 'manga' ? (
                                        <>
                                            <button
                                                onClick={() => navigate('/profile?tab=continue-reading')}
                                                className="w-full flex items-center gap-3 px-4 py-3 bg-[#2a2a2a]/50 hover:bg-[#2a2a2a] text-gray-200 rounded-xl transition-all group/item"
                                            >
                                                <BookOpen className="w-5 h-5 text-gray-400 group-hover/item:text-white transition-colors" />
                                                <span className="font-medium">Continue Reading</span>
                                            </button>
                                            <button
                                                onClick={() => navigate('/profile?tab=readlist')}
                                                className="w-full flex items-center gap-3 px-4 py-3 bg-[#2a2a2a]/50 hover:bg-[#2a2a2a] text-gray-200 rounded-xl transition-all group/item"
                                            >
                                                <BookOpen className="w-5 h-5 text-gray-400 group-hover/item:text-white transition-colors" />
                                                <span className="font-medium">Read List</span>
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => navigate('/profile?tab=continue-watching')}
                                                className="w-full flex items-center gap-3 px-4 py-3 bg-[#2a2a2a]/50 hover:bg-[#2a2a2a] text-gray-200 rounded-xl transition-all group/item"
                                            >
                                                <History className="w-5 h-5 text-gray-400 group-hover/item:text-white transition-colors" />
                                                <span className="font-medium">Continue Watching</span>
                                            </button>
                                            <button
                                                onClick={() => navigate('/profile?tab=watchlist')}
                                                className="w-full flex items-center gap-3 px-4 py-3 bg-[#2a2a2a]/50 hover:bg-[#2a2a2a] text-gray-200 rounded-xl transition-all group/item"
                                            >
                                                <Heart className="w-5 h-5 text-gray-400 group-hover/item:text-white transition-colors" />
                                                <span className="font-medium">Watch List</span>
                                            </button>
                                        </>
                                    )}
                                </div>

                                {/* Logout Footer */}
                                <div className="mt-6 flex justify-end">
                                    <button
                                        onClick={logout}
                                        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm font-semibold"
                                    >
                                        Logout
                                        <LogOut className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={login}
                            className="bg-white/10 hover:bg-white/20 text-white border border-white/5 font-bold uppercase text-[10px] md:text-xs tracking-wider px-4 md:px-6 py-2 md:py-2.5 rounded transition-colors"
                        >
                            Login
                        </button>
                    )}
                </div>
            </div>

            {/* Mobile Search Bar & Controls Overlay */}
            <div className={`
                md:hidden overflow-hidden transition-all duration-300 ease-in-out
                ${showMobileSearch ? 'max-h-40 opacity-100 border-t border-white/5 bg-[#0a0a0a]/95 backdrop-blur-md' : 'max-h-0 opacity-0'}
            `}>
                <div className="p-4 space-y-4">
                    <form onSubmit={(e) => { onSearchSubmit(e); setShowMobileSearch(false); }} className="relative group w-full">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="w-full h-10 bg-[#1c1c1c] border border-transparent focus:border-white/10 rounded-md pl-10 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:bg-[#252525] transition-all"
                            autoFocus={showMobileSearch}
                        />
                    </form>

                    <div className="flex items-center justify-between">
                        {/* Mobile ANI | MAN Toggle */}
                        <div className="flex items-center rounded bg-[#1c1c1c] overflow-hidden border border-transparent">
                            <button
                                onClick={() => { onClearSearch(); onTabChange('anime'); setShowMobileSearch(false); }}
                                className={`px-4 py-2 text-xs font-black uppercase tracking-wider transition-all ${activeTab === 'anime'
                                    ? 'bg-yorumi-accent text-[#0a0a0a]'
                                    : 'text-gray-500'
                                    }`}
                            >
                                Anime
                            </button>
                            <button
                                onClick={() => { onTabChange('manga'); setShowMobileSearch(false); }}
                                className={`px-4 py-2 text-xs font-black uppercase tracking-wider transition-all ${activeTab === 'manga'
                                    ? 'bg-yorumi-main text-white'
                                    : 'text-gray-500'
                                    }`}
                            >
                                Manga
                            </button>
                        </div>

                        {/* Mobile Random Button */}
                        <button
                            onClick={() => { handleRandom(); setShowMobileSearch(false); }}
                            disabled={isLoadingRandom}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-gray-400 hover:text-white bg-[#1c1c1c] rounded border border-transparent hover:border-white/10 transition-all"
                        >
                            <Shuffle className={`w-3.5 h-3.5 ${isLoadingRandom ? 'animate-spin' : ''}`} />
                            Random
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    );
}

import { useRef, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { animeService } from '../../../services/animeService';
import { mangaService } from '../../../services/mangaService';
import { useAuth } from '../../../context/AuthContext';
import SearchBar from './SearchBar';
import NavToggle from './NavToggle';
import UserMenu from './UserMenu';
import RandomButton from './RandomButton';
import { useDebounce } from '../../../hooks/useDebounce';

interface NavbarProps {
    activeTab: 'anime' | 'manga';
    searchQuery: string;
    onTabChange: (tab: 'anime' | 'manga') => void;
    onSearchChange: (query: string) => void;
    onSearchSubmit: (e: React.FormEvent) => void;
    onClearSearch: () => void;
    onLogoClick?: () => void;
    searchResults?: any[];
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
    const location = useLocation();
    const { login, logout, user, avatar } = useAuth();

    const [isScrolled, setIsScrolled] = useState(false);
    const [isLoadingRandom, setIsLoadingRandom] = useState(false);
    const [showMobileSearch, setShowMobileSearch] = useState(false);

    // Debounce Logic
    const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
    const debouncedSearchQuery = useDebounce(localSearchQuery, 500);

    // Sync local state when prop changes (e.g. clear button from parent)
    useEffect(() => {
        setLocalSearchQuery(searchQuery);
    }, [searchQuery]);

    // Trigger parent search when debounced value changes
    useEffect(() => {
        if (debouncedSearchQuery === localSearchQuery && debouncedSearchQuery !== searchQuery) {
            onSearchChange(debouncedSearchQuery);
        }
    }, [debouncedSearchQuery, localSearchQuery, onSearchChange, searchQuery]);

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
                    navigate(`/manga/details/${result.id}`, { state: { fromRandom: true } });
                }
            } else {
                const result = await animeService.getRandomAnime();
                if (result && result.id) {
                    navigate(`/anime/details/${result.id}`, { state: { fromRandom: true } });
                }
            }
        } catch (error) {
            console.error('Failed to get random media:', error);
            const randomId = Math.floor(Math.random() * 50000) + 1;
            navigate(`/${activeTab}/details/${randomId}`, { state: { fromRandom: true } });
        } finally {
            setIsLoadingRandom(false);
        }
    };

    const handleResultSelect = (item: any) => {
        navigate(item.url);
        onClearSearch();
    };

    const handleMobileResultSelect = (item: any) => {
        navigate(item.url);
        onClearSearch();
        setShowMobileSearch(false);
    };

    const handleClearAndFocus = () => {
        setLocalSearchQuery('');
        onClearSearch();
        searchInputRef.current?.focus();
    };

    const isTransparentPage = !location.pathname.includes('/manga/read') && !location.pathname.includes('/anime/watch');

    return (
        <nav className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-500 ${isScrolled || !isTransparentPage
            ? 'bg-yorumi-bg border-b border-white/5 py-3'
            : 'bg-gradient-to-b from-black via-black/60 to-transparent border-transparent py-4'
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
                        <span className={`text-xl md:text-2xl font-black ${activeTab === 'manga' ? 'text-yorumi-manga' : 'text-yorumi-accent'} tracking-tighter`}>MI</span>
                    </div>

                    {/* Desktop Search */}
                    <div className="hidden md:block max-w-xs w-full">
                        <SearchBar
                            ref={searchInputRef}
                            searchQuery={localSearchQuery}
                            searchResults={searchResults}
                            isSearching={isSearching}
                            onSearchChange={setLocalSearchQuery}
                            onSearchSubmit={onSearchSubmit}
                            onClearSearch={handleClearAndFocus}
                            onResultSelect={handleResultSelect}
                        />
                    </div>

                    {/* Toggle & Random Controls */}
                    <div className="hidden md:flex items-center gap-6">
                        <NavToggle
                            activeTab={activeTab}
                            onTabChange={onTabChange}
                            onClearSearch={onClearSearch}
                        />
                        <RandomButton
                            isLoading={isLoadingRandom}
                            onClick={handleRandom}
                            theme={activeTab}
                        />
                    </div>
                </div>

                {/* RIGHT: Login + Mobile Controls */}
                <div className="flex items-center justify-end gap-2 md:gap-4 shrink-0">
                    {/* Mobile Search Icon */}
                    <button
                        onClick={() => setShowMobileSearch(!showMobileSearch)}
                        className="md:hidden text-white p-2 md:hover:bg-white/10 active:bg-white/10 rounded-full transition-colors outline-none focus:outline-none"
                    >
                        {showMobileSearch ? (
                            <X className="w-5 h-5" />
                        ) : (
                            <Search className="w-5 h-5" />
                        )}
                    </button>

                    <UserMenu
                        user={user}
                        avatar={avatar}
                        activeTab={activeTab}
                        onLogin={login}
                        onLogout={logout}
                    />
                </div>
            </div>

            {/* Mobile Search Bar & Controls Overlay */}
            <div className={`
                md:hidden overflow-hidden transition-all duration-300 ease-in-out
                ${showMobileSearch ? 'max-h-40 opacity-100 border-t border-white/5 bg-yorumi-bg/95 backdrop-blur-md' : 'max-h-0 opacity-0'}
            `}>
                <div className="p-4 space-y-4">
                    <SearchBar
                        searchQuery={localSearchQuery}
                        searchResults={searchResults}
                        isSearching={isSearching}
                        onSearchChange={setLocalSearchQuery}
                        onSearchSubmit={(e) => { onSearchSubmit(e); setShowMobileSearch(false); }}
                        onClearSearch={onClearSearch}
                        onResultSelect={handleMobileResultSelect}
                        showShortcut={false}
                        autoFocus={showMobileSearch}
                    />

                    <div className="flex items-center justify-between">
                        <NavToggle
                            activeTab={activeTab}
                            onTabChange={onTabChange}
                            onClearSearch={onClearSearch}
                            variant="mobile"
                            onClose={() => setShowMobileSearch(false)}
                        />
                        <RandomButton
                            isLoading={isLoadingRandom}
                            onClick={() => { handleRandom(); setShowMobileSearch(false); }}
                            variant="mobile"
                            theme={activeTab}
                        />
                    </div>
                </div>
            </div>
        </nav>
    );
}

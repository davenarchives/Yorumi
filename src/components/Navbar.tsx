import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shuffle } from 'lucide-react';
import { animeService } from '../services/animeService';

interface NavbarProps {
    activeTab: 'anime' | 'manga';
    searchQuery: string;
    onTabChange: (tab: 'anime' | 'manga') => void;
    onSearchChange: (query: string) => void;
    onSearchSubmit: (e: React.FormEvent) => void;
    onClearSearch: () => void;
    onLogoClick?: () => void;
}

export default function Navbar({
    activeTab,
    searchQuery,
    onTabChange,
    onSearchChange,
    onSearchSubmit,
    onClearSearch,
    onLogoClick,
}: NavbarProps) {
    const searchInputRef = useRef<HTMLInputElement>(null);
    const navigate = useNavigate();

    const [isScrolled, setIsScrolled] = useState(false);
    const [isLoadingRandom, setIsLoadingRandom] = useState(false);

    // Handle scroll for transparent navbar
    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50);
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
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Random anime handler
    const handleRandomAnime = async () => {
        if (isLoadingRandom) return;
        setIsLoadingRandom(true);
        try {
            const result = await animeService.getRandomAnime();
            if (result && result.id) {
                navigate(`/anime/${result.id}`, { state: { fromRandom: true } });
            }
        } catch (error) {
            console.error('Failed to get random anime:', error);
            // Fallback to random ID
            const randomId = Math.floor(Math.random() * 50000) + 1;
            navigate(`/anime/${randomId}`, { state: { fromRandom: true } });
        } finally {
            setIsLoadingRandom(false);
        }
    };

    return (
        <nav className={`fixed top-0 left-0 right-0 z-[100] flex items-center justify-between px-8 transition-colors duration-500 ${isScrolled ? 'bg-[#0a0a0a]/95 backdrop-blur-md border-b border-white/5 py-3' : 'bg-gradient-to-b from-black via-black/60 to-transparent border-transparent py-4'
            }`}>
            {/* LEFT: Logo + Search + Toggle + Random */}
            <div className="flex items-center gap-6">
                {/* Logo */}
                <div
                    onClick={onLogoClick || onClearSearch}
                    className="flex items-center cursor-pointer hover:opacity-90 transition-opacity select-none shrink-0"
                    role="button"
                    tabIndex={0}
                >
                    <span className="text-2xl font-black text-white tracking-tighter">YORU</span>
                    <span className="text-2xl font-black text-yorumi-accent tracking-tighter">MI</span>
                </div>

                {/* Search Bar */}
                <form onSubmit={onSearchSubmit} className="relative group w-full max-w-xs hidden md:block">
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

                {/* Toggle & Random Controls Container */}
                <div className="flex items-center gap-6">
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
                        onClick={handleRandomAnime}
                        disabled={isLoadingRandom}
                        className="group flex items-center justify-center p-2 text-gray-500 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Random Anime"
                    >
                        <Shuffle className={`w-5 h-5 group-hover:text-yorumi-accent transition-all duration-300 ${isLoadingRandom ? 'animate-spin' : 'group-hover:rotate-180'}`} />
                    </button>
                </div>
            </div>

            {/* RIGHT: Login */}
            <div className="flex items-center justify-end gap-4 shrink-0">
                {/* Mobile Search Icon (only visible on small screens) */}
                <button className="md:hidden text-white p-2">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                    </svg>
                </button>

                <button className="bg-white/10 hover:bg-white/20 text-white border border-white/5 font-bold uppercase text-xs tracking-wider px-6 py-2.5 rounded transition-colors">
                    Login
                </button>
            </div>
        </nav>
    );
}

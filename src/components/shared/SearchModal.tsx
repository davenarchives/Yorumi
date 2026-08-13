import React, { useState, useEffect, useRef } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTitleLanguage } from '../../context/TitleLanguageContext';
import { useNavbarSearch } from '../../features/search/hooks/useNavbarSearch';
import type { SearchPreviewItem } from '../../features/search/api';
import { isAnimeAiring, getAiringLabel } from '../../utils/animeAiring';

interface SearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    type: 'anime' | 'manga' | 'ln';
}

export default function SearchModal({ isOpen, onClose, type }: SearchModalProps) {
    const navigate = useNavigate();
    const { language } = useTitleLanguage();
    const { searchQuery, setSearchQuery, searchResults, isSearching } = useNavbarSearch({
        activeTab: type,
        language,
    });
    
    const inputRef = useRef<HTMLInputElement>(null);
    const [recentSearches, setRecentSearches] = useState<string[]>([]);

    const storageKey = `yorumi_recent_searches_${type}`;

    useEffect(() => {
        // Load recent searches from local storage
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                setRecentSearches(JSON.parse(saved));
            }
        } catch (e) {
            console.error('Failed to parse recent searches', e);
        }
    }, [type, storageKey]);

    useEffect(() => {
        if (isOpen) {
            // Focus input when opened
            setTimeout(() => inputRef.current?.focus(), 100);
            
            // Lock body scroll
            document.body.style.overflow = 'hidden';
            
            // Add escape key listener
            const handleEscape = (e: KeyboardEvent) => {
                if (e.key === 'Escape') onClose();
            };
            window.addEventListener('keydown', handleEscape);
            return () => {
                document.body.style.overflow = '';
                window.removeEventListener('keydown', handleEscape);
            };
        } else {
            document.body.style.overflow = '';
        }
    }, [isOpen, onClose]);

    const saveRecentSearch = (query: string) => {
        const trimmed = query.trim();
        if (!trimmed) return;
        
        const updated = [trimmed, ...recentSearches.filter(s => s.toLowerCase() !== trimmed.toLowerCase())].slice(0, 10);
        setRecentSearches(updated);
        try {
            localStorage.setItem(storageKey, JSON.stringify(updated));
        } catch (e) {
            console.error('Failed to save recent searches', e);
        }
    };

    const clearRecentSearches = () => {
        setRecentSearches([]);
        try {
            localStorage.removeItem(storageKey);
        } catch (e) {}
    };

    const removeRecentSearch = (e: React.MouseEvent, termToRemove: string) => {
        e.stopPropagation();
        const updated = recentSearches.filter(s => s !== termToRemove);
        setRecentSearches(updated);
        try {
            if (updated.length > 0) {
                localStorage.setItem(storageKey, JSON.stringify(updated));
            } else {
                localStorage.removeItem(storageKey);
            }
        } catch (e) {}
    };

    const handleResultClick = (item: SearchPreviewItem) => {
        saveRecentSearch(item.title);
        onClose();
        if (type === 'ln') {
            navigate(item.url, { state: { ln: item.ln || item.manga } });
            return;
        }
        if (type === 'manga') {
            navigate(item.url, { state: { manga: item.manga } });
            return;
        }

        const raw = item.manga || {};
        const isMovie = String(item.type || raw.media_type || '').toUpperCase() === 'MOVIE' || raw.media_type === 'movie';
        const anime = {
            ...(raw || {}),
            id: typeof raw.id === 'number' && !item.url.includes('/tmdb-') ? raw.id : 0,
            mal_id: typeof raw.mal_id === 'number' ? raw.mal_id : 0,
            tmdbId: item.url.includes('/tmdb-') ? item.id : raw.tmdbId,
            title: item.title,
            title_english: item.title,
            title_romaji: raw.original_name || raw.original_title || item.subtitle || item.title,
            images: raw.images || {
                jpg: {
                    image_url: item.image,
                    large_image_url: item.image,
                },
            },
            score: item.score || 0,
            status: raw.status || 'FINISHED',
            type: isMovie ? 'MOVIE' : (item.type || raw.type || 'TV'),
            episodes: isMovie ? 1 : (raw.episodes ?? null),
            year: typeof item.date === 'number' ? item.date : raw.year,
            aired: raw.aired || {
                from: raw.release_date || raw.first_air_date,
                string: item.date ? String(item.date) : undefined,
            },
        };
        navigate(item.url, { state: { anime } });
    };

    const handleRecentSearchClick = (term: string) => {
        setSearchQuery(term);
        inputRef.current?.focus();
    };

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            saveRecentSearch(searchQuery);
            if (searchResults.length > 0) {
                handleResultClick(searchResults[0]);
            }
        }
    };

    const accentColor = type === 'ln' ? 'text-amber-400' : type === 'manga' ? 'text-yorumi-manga' : 'text-yorumi-accent';
    const accentBg = type === 'ln' ? 'bg-amber-400' : type === 'manga' ? 'bg-yorumi-manga' : 'bg-yorumi-accent';

    const filteredResults = searchResults.filter(item => {
        if (type === 'manga' || type === 'ln') return true;
        const itemType = (item.type || '').toUpperCase();
        return ['TV', 'SERIES', 'ONA', 'OVA', 'MOVIE', 'SPECIAL'].includes(itemType);
    });

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <m.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9998]"
                        onClick={onClose}
                    />
                    
                    {/* Modal Container */}
                    <m.div
                        initial={{ opacity: 0, scale: 0.95, y: -20, x: "-50%" }}
                        animate={{ opacity: 1, scale: 1, y: 0, x: "-50%" }}
                        exit={{ opacity: 0, scale: 0.95, y: -20, x: "-50%" }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="fixed top-[15vh] left-1/2 w-[90%] max-w-[640px] z-[9999] flex flex-col bg-[#141414] border border-white/10 rounded-lg overflow-hidden"
                    >
                        {/* Header / Input Area */}
                        <form onSubmit={handleFormSubmit} className="relative flex items-center p-4 border-b border-white/10">
                            <Search className="w-6 h-6 text-gray-400 absolute left-6" />
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder={`Search ${type === 'ln' ? 'light novels & web novels' : type === 'manga' ? 'manga and manhwa' : 'movies and series'}...`}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-transparent border-none outline-none text-white text-xl pl-12 pr-12 placeholder-gray-500 py-2"
                            />
                            {searchQuery ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchQuery('');
                                        inputRef.current?.focus();
                                    }}
                                    className="absolute right-6 p-1.5 rounded-md border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="absolute right-6 p-1.5 rounded-md border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            )}
                        </form>

                        {/* Results or Recent Searches */}
                        <div className="flex-1 overflow-y-auto max-h-[60vh] custom-scrollbar p-2">
                            {searchQuery.trim().length > 0 ? (
                                /* Live Search Results */
                                <div className="p-2 space-y-1">
                                    {isSearching ? (
                                        <div className="flex items-center justify-center py-12 text-gray-400">
                                            <div className={`w-6 h-6 border-2 border-transparent border-t-${type === 'manga' ? 'yorumi-manga' : 'yorumi-accent'} rounded-full animate-spin`} />
                                        </div>
                                    ) : filteredResults.length > 0 ? (
                                        filteredResults.map((item) => {
                                            const itemType = (item.type || '').toUpperCase();
                                            let badgeClass = 'border-gray-500/50 text-gray-500';
                                            let badgeText = itemType || 'UNKNOWN';
                                            
                                            if (itemType === 'TV' || itemType === 'SERIES' || itemType === 'ONA' || itemType === 'OVA') {
                                                badgeClass = 'border-[#2d589e] text-[#4d88e5]';
                                                badgeText = 'SERIES';
                                            } else if (itemType === 'MOVIE' || itemType === 'SPECIAL') {
                                                badgeClass = 'border-[#8e1f2b] text-[#e53945]';
                                                badgeText = 'MOVIE';
                                            } else if (itemType === 'MANGA' || itemType === 'MANHWA' || itemType === 'MANHUA') {
                                                badgeClass = 'border-[#7a3b8c] text-[#c961e5]';
                                                badgeText = itemType;
                                            } else if (itemType.includes('KR')) {
                                                badgeClass = 'border-amber-500/50 text-amber-400 bg-amber-500/10';
                                                badgeText = 'KR (WN)';
                                            } else if (itemType.includes('CN')) {
                                                badgeClass = 'border-red-500/50 text-red-400 bg-red-500/10';
                                                badgeText = 'CN (WN)';
                                            } else if (type === 'ln' || itemType === 'NOVEL') {
                                                badgeClass = 'border-amber-400/50 text-amber-300 bg-amber-400/10';
                                                badgeText = 'LN';
                                            }

                                            // Try to extract year from date
                                            let displayYear = item.date;
                                            if (typeof item.date === 'string') {
                                                const yearMatch = item.date.match(/\b(19|20)\d{2}\b/);
                                                if (yearMatch) displayYear = yearMatch[0];
                                            }

                                            return (
                                                <div
                                                    key={item.id}
                                                    onClick={() => handleResultClick(item)}
                                                    className="flex items-center gap-4 p-2 rounded-xl cursor-pointer group transition-colors"
                                                >
                                                    <div className="w-[42px] h-[58px] rounded overflow-hidden bg-[#1a1a1a] flex-shrink-0">
                                                        <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="text-white font-bold text-base truncate group-hover:text-white/90">{item.title}</h3>
                                                        <div className="flex items-center gap-1.5 text-[13px] font-medium text-gray-400 mt-0.5">
                                                            {isAnimeAiring(item.status || (item.raw as any)?.status) ? (
                                                                <span className="text-[#4d88e5] font-bold">{getAiringLabel(item as any)}</span>
                                                            ) : (
                                                                displayYear && <span>{displayYear}</span>
                                                            )}
                                                            {displayYear && item.score && <span>•</span>}
                                                            {item.score ? (
                                                                <span className="flex items-center gap-1">
                                                                    ★ {item.score.toFixed(1)}
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                    <div className={`flex-shrink-0 px-2 py-0.5 rounded border ${badgeClass} text-[10px] font-bold tracking-wider`}>
                                                        {badgeText}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : searchQuery.trim().length >= 2 ? (
                                        <div className="text-center py-12 text-gray-400">
                                            No results found for "{searchQuery}"
                                        </div>
                                    ) : null}
                                </div>
                            ) : (
                                /* Recent Searches */
                                <div className="p-4">
                                    <div className="flex items-center justify-between mb-4 px-2">
                                        <span className="text-xs font-bold text-gray-500 tracking-wider uppercase">Recent Searches</span>
                                        {recentSearches.length > 0 && (
                                            <button 
                                                onClick={clearRecentSearches}
                                                className="text-xs font-semibold text-gray-400 hover:text-white transition-colors"
                                            >
                                                Clear all
                                            </button>
                                        )}
                                    </div>
                                    
                                    {recentSearches.length > 0 ? (
                                        <div className="space-y-0.5">
                                            {recentSearches.map((term, i) => (
                                                <div
                                                    key={i}
                                                    onClick={() => handleRecentSearchClick(term)}
                                                    className="flex items-center gap-4 px-2 py-3 rounded-xl hover:bg-white/5 cursor-pointer group transition-colors"
                                                >
                                                    <Search className="w-5 h-5 text-gray-500 group-hover:text-white transition-colors" />
                                                    <span className="flex-1 text-gray-300 font-medium group-hover:text-white transition-colors truncate">{term}</span>
                                                    <button
                                                        onClick={(e) => removeRecentSearch(e, term)}
                                                        className="text-gray-500 opacity-0 group-hover:opacity-100 hover:text-white transition-colors"
                                                        title="Remove from history"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-sm text-gray-500 font-medium">
                                            No recent searches
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </m.div>
                </>
            )}
        </AnimatePresence>
    );
}

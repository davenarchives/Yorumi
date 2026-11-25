import React, { useState, useEffect, useRef, useMemo } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { Search, X, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTitleLanguage } from '../../context/TitleLanguageContext';
import { useNavbarSearch } from '../../features/search/hooks/useNavbarSearch';
import { getAnimeSearchSeed, type SearchPreviewItem } from '../../features/search/api';
import { isAnimeAiring, getAiringLabel } from '../../utils/animeAiring';
import { suggestSearchCorrection } from '../../utils/searchIntelligence';
import { userSearchService, type PublicUserProfile } from '../../services/userService';
import { useDebounce } from '../../hooks/useDebounce';

interface SearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    type: 'anime' | 'manga' | 'ln' | 'users';
}

export default function SearchModal({ isOpen, onClose, type }: SearchModalProps) {
    const navigate = useNavigate();
    const { language } = useTitleLanguage();
    const isUserSearch = type === 'users';
    const { searchQuery, setSearchQuery, searchResults, isSearching } = useNavbarSearch({
        activeTab: isUserSearch ? 'anime' : type,
        language,
        enabled: isOpen && !isUserSearch,
    });
    const debouncedUserQuery = useDebounce(searchQuery, 180);
    const [userResults, setUserResults] = useState<PublicUserProfile[]>([]);
    const [isSearchingUsers, setIsSearchingUsers] = useState(false);

    useEffect(() => {
        if (!isUserSearch || !isOpen) return;
        const term = debouncedUserQuery.trim();
        let active = true;
        setIsSearchingUsers(true);
        const request = term.length >= 1
            ? userSearchService.searchUsers(term, 15)
            : userSearchService.getDiscoverUsers(10);
        void request
            .then((users) => {
                if (active) setUserResults(users);
            })
            .finally(() => {
                if (active) setIsSearchingUsers(false);
            });
        return () => { active = false; };
    }, [debouncedUserQuery, isOpen, isUserSearch]);

    const inputRef = useRef<HTMLInputElement>(null);
    const [recentSearches, setRecentSearches] = useState<string[]>([]);

    const storageKey = `yorumi_recent_searches_${type}`;

    useEffect(() => {
        // Load recent searches from local storage
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                // The storage namespace changes when the modal switches media type.
                // eslint-disable-next-line react-hooks/set-state-in-effect
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
        } catch {
            // Recent-search persistence is best effort.
        }
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
        } catch {
            // Recent-search persistence is best effort.
        }
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

        const anime = getAnimeSearchSeed(item);
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

    const filteredResults = searchResults.filter(item => {
        if (type === 'manga' || type === 'ln') return true;
        const itemType = (item.type || '').toUpperCase();
        return ['TV', 'SERIES', 'ONA', 'OVA', 'MOVIE', 'SPECIAL'].includes(itemType);
    });

    const suggestion = useMemo(() => {
        const trimmed = searchQuery.trim();
        if (trimmed.length < 2) return null;
        return suggestSearchCorrection(trimmed, filteredResults.map((item) => item.title));
    }, [searchQuery, filteredResults]);

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
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2147483620]"
                        onClick={onClose}
                    />

                    {/* Modal Container */}
                    <m.div
                        initial={{ opacity: 0, scale: 0.95, y: -20, x: "-50%" }}
                        animate={{ opacity: 1, scale: 1, y: 0, x: "-50%" }}
                        exit={{ opacity: 0, scale: 0.95, y: -20, x: "-50%" }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="fixed top-[calc(max(env(safe-area-inset-top,0px),16px)+3rem)] md:top-[15vh] left-1/2 w-[92%] md:w-[90%] max-w-[640px] z-[2147483621] flex flex-col bg-[#0d0e12]/85 md:bg-[#0d0e12]/80 backdrop-blur-2xl border border-white/10 rounded-lg shadow-2xl shadow-black/80 overflow-hidden"
                    >
                        {/* Header / Input Area */}
                        <form onSubmit={handleFormSubmit} className="relative flex items-center p-4 border-b border-white/10">
                            <Search className="w-6 h-6 text-gray-400 absolute left-6" />
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder={`Search ${type === 'users' ? 'users by Discord username' : type === 'ln' ? 'light novels & web novels' : type === 'manga' ? 'manga and manhwa' : 'movies and series'}...`}
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
                            {isUserSearch ? (
                                <div className="p-2 space-y-1">
                                    {!searchQuery.trim() && userResults.length > 0 && (
                                        <div className="px-2 pb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                                            Community Profiles
                                        </div>
                                    )}
                                    {isSearchingUsers && userResults.length === 0 ? (
                                        <div className="py-12 text-center text-gray-400 text-sm animate-pulse">
                                            Searching users...
                                        </div>
                                    ) : userResults.length > 0 ? (
                                        userResults.map((user) => {
                                            const animeCount = (user.watchList?.length || 0) + (user.continueWatching?.length || 0);
                                            const mangaCount = (user.readList?.length || 0) + (user.continueReading?.length || 0);
                                            return (
                                                <button
                                                    key={user.uid}
                                                    type="button"
                                                    onClick={() => {
                                                        onClose();
                                                        navigate(`/user/${user.uid}`);
                                                    }}
                                                    className="w-full flex items-center gap-3.5 p-2.5 rounded-xl hover:bg-white/[0.06] transition-colors text-left cursor-pointer"
                                                >
                                                    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-white/10 flex items-center justify-center text-sm font-bold text-white">
                                                        {user.avatar ? (
                                                            <img src={user.avatar} alt={user.displayName} className="h-full w-full object-cover" />
                                                        ) : (
                                                            user.displayName.charAt(0).toUpperCase()
                                                        )}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="truncate text-sm font-bold text-white">
                                                            {user.displayName}
                                                        </div>
                                                        <div className="mt-0.5 text-xs text-gray-400">
                                                            {animeCount} anime · {mangaCount} manga
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })
                                    ) : (
                                        <div className="py-12 text-center text-gray-500 text-sm">
                                            <Users className="mx-auto mb-2 h-8 w-8 text-gray-600" />
                                            {searchQuery.trim()
                                                ? `No users found matching "${searchQuery}"`
                                                : 'No synced user profiles yet.'}
                                        </div>
                                    )}
                                </div>
                            ) : searchQuery.trim().length > 0 ? (
                                /* Live Search Results */
                                <div className="p-2 space-y-1">
                                    {!isSearching && suggestion && (
                                        <div className="mb-1.5 flex items-center gap-1.5 px-2 py-1 text-xs text-gray-400">
                                            <span>{suggestion.isAlias ? 'Showing results for' : 'Did you mean'}</span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSearchQuery(suggestion.correctedQuery);
                                                    inputRef.current?.focus();
                                                }}
                                                className="font-semibold text-yorumi-accent underline decoration-yorumi-accent/50 underline-offset-2 hover:text-white transition-colors"
                                            >
                                                {suggestion.correctedQuery}
                                            </button>
                                            {!suggestion.isAlias && <span>?</span>}
                                        </div>
                                    )}
                                    {isSearching ? (
                                        <div className="flex items-center justify-center gap-3 py-12 text-sm text-gray-400">
                                            <div className={`w-6 h-6 border-2 border-transparent rounded-full animate-spin ${type === 'manga' ? 'border-t-yorumi-manga' : type === 'ln' ? 'border-t-amber-400' : 'border-t-yorumi-accent'}`} />
                                            <span>Searching…</span>
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
                                            } else if (itemType === 'MANGA') {
                                                badgeClass = 'border-[#7a3b8c] text-[#c961e5]';
                                                badgeText = 'MANGA';
                                            } else if (itemType === 'MANHWA') {
                                                badgeClass = 'border-[#c04888] text-[#f472b6]';
                                                badgeText = 'MANHWA';
                                            } else if (itemType === 'MANHUA') {
                                                badgeClass = 'border-[#b91c1c] text-[#f87171]';
                                                badgeText = 'MANHUA';
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
                                                            {isAnimeAiring(item.status || (item.raw as { status?: string } | undefined)?.status) ? (
                                                                <span className="text-[#4d88e5] font-bold">{getAiringLabel(item)}</span>
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

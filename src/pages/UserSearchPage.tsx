import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, Cat, Book, Clock } from 'lucide-react';
import { userSearchService, type PublicUserProfile } from '../services/userService';
import { useDebounce } from '../hooks/useDebounce';

export default function UserSearchPage() {
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<PublicUserProfile[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const debouncedQuery = useDebounce(query, 350);
    const inputRef = useRef<HTMLInputElement>(null);
    const [discoverUsers, setDiscoverUsers] = useState<PublicUserProfile[]>([]);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        inputRef.current?.focus();
        
        // Fetch discover users on mount
        const loadDiscoverUsers = async () => {
            try {
                const users = await userSearchService.getDiscoverUsers(20);
                setDiscoverUsers(users);
                setErrorMsg(null);
            } catch (error: any) {
                console.error('Failed to load discover users:', error);
                setErrorMsg(error?.message || 'Failed to load users');
            }
        };
        loadDiscoverUsers();
    }, []);

    useEffect(() => {
        const doSearch = async () => {
            const term = debouncedQuery.trim();
            if (term.length < 2) {
                setResults([]);
                setIsSearching(false);
                if (term.length === 0) setHasSearched(false);
                setErrorMsg(null);
                return;
            }

            setIsSearching(true);
            try {
                const users = await userSearchService.searchUsers(term, 20);
                setResults(users);
                setHasSearched(true);
                setErrorMsg(null);
            } catch (error: any) {
                console.error('Search failed:', error);
                setErrorMsg(error?.message || 'Search failed');
                setResults([]);
            } finally {
                setIsSearching(false);
            }
        };

        doSearch();
    }, [debouncedQuery]);

    const getQuickStats = (user: PublicUserProfile) => {
        const animeCount = (user.watchList || []).length + (user.continueWatching || []).length;
        const mangaCount = (user.readList || []).length;
        const totalHours = Math.round(((user.animeWatchTimeTotalSeconds || 0) / 3600) * 10) / 10;
        return { animeCount, mangaCount, totalHours };
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] pt-24 pb-16">
            {/* Hero Section */}
            <div className="relative w-full py-12 md:py-20 overflow-hidden">
                <div className="absolute inset-0 z-0">
                    <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[70%] bg-yorumi-accent/8 rounded-full blur-[140px]" />
                    <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[60%] bg-yorumi-manga/6 rounded-full blur-[120px]" />
                </div>

                <div className="relative z-10 max-w-3xl mx-auto px-4 text-center">
                    <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-6">
                        <Users className="w-4 h-4 text-yorumi-accent" />
                        <span className="text-sm font-semibold text-gray-300">Community</span>
                    </div>

                    <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight mb-4">
                        Find <span className="text-yorumi-accent">Users</span>
                    </h1>
                    <p className="text-gray-400 text-lg md:text-xl font-medium mb-10">
                        Search for friends and explore their anime & manga profiles
                    </p>

                    {/* Search Bar */}
                    <div className="relative max-w-xl mx-auto">
                        <div className="relative group">
                            <div className="absolute inset-0 bg-gradient-to-r from-yorumi-accent/20 via-yorumi-manga/20 to-yorumi-accent/20 rounded-2xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
                            <div className="relative flex items-center bg-[#1c1c1c] border border-white/10 rounded-2xl overflow-hidden transition-all duration-300 group-focus-within:border-yorumi-accent/40">
                                <Search className="w-5 h-5 text-gray-500 ml-5 shrink-0" />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search by display name..."
                                    className="w-full bg-transparent text-white placeholder-gray-500 px-4 py-4 md:py-5 text-base md:text-lg font-medium outline-none"
                                />
                                {query && (
                                    <button
                                        onClick={() => { setQuery(''); setResults([]); setHasSearched(false); }}
                                        className="mr-4 text-gray-400 hover:text-white transition-colors text-sm font-bold"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Loading indicator */}
                        {isSearching && (
                            <div className="absolute -bottom-1 left-0 right-0 h-0.5 overflow-hidden rounded-full">
                                <div className="h-full bg-gradient-to-r from-yorumi-accent to-yorumi-manga animate-pulse rounded-full" />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Results Section */}
            <div className="max-w-4xl mx-auto px-4 mt-8">
                {isSearching && results.length === 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="bg-[#1c1c1c] rounded-2xl p-5 animate-pulse">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-full bg-white/10" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-4 bg-white/10 rounded-full w-32" />
                                        <div className="h-3 bg-white/5 rounded-full w-48" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {errorMsg && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center mb-6">
                        <div className="text-red-400 font-bold mb-2">Error accessing users database</div>
                        <div className="text-gray-400 text-sm">{errorMsg}</div>
                    </div>
                )}

                {!isSearching && hasSearched && results.length === 0 && !errorMsg && (
                    <div className="text-center py-16">
                        <Users className="w-16 h-16 text-gray-700 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-gray-400 mb-2">No users found</h3>
                        <p className="text-gray-500">Try a different name or check the spelling</p>
                    </div>
                )}

                {results.length > 0 && (
                    <>
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest">
                                {results.length} {results.length === 1 ? 'Result' : 'Results'}
                            </h2>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {results.map((user) => {
                                const stats = getQuickStats(user);
                                return (
                                    <button
                                        key={user.uid}
                                        onClick={() => navigate(`/user/${user.uid}`)}
                                        className="group bg-[#1c1c1c] hover:bg-[#222222] border border-white/5 hover:border-yorumi-accent/30 rounded-2xl p-5 text-left transition-all duration-300 relative overflow-hidden"
                                    >
                                        {/* Subtle accent glow on hover */}
                                        <div className="absolute inset-0 bg-gradient-to-br from-yorumi-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                                        <div className="relative z-10 flex items-center gap-4">
                                            {/* Avatar */}
                                            <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-white/10 group-hover:border-yorumi-accent/50 transition-colors shrink-0 bg-[#2a2a2a]">
                                                {user.avatar ? (
                                                    <img src={user.avatar} alt={user.displayName} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-white font-bold text-xl">
                                                        {user.displayName?.charAt(0).toUpperCase() || '?'}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="text-white font-bold text-base truncate group-hover:text-yorumi-accent transition-colors">
                                                    {user.displayName}
                                                </div>

                                                {/* Quick Stats */}
                                                <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500 font-semibold">
                                                    {stats.animeCount > 0 && (
                                                        <span className="flex items-center gap-1">
                                                            <Cat className="w-3.5 h-3.5 text-yorumi-accent" />
                                                            {stats.animeCount}
                                                        </span>
                                                    )}
                                                    {stats.mangaCount > 0 && (
                                                        <span className="flex items-center gap-1">
                                                            <Book className="w-3.5 h-3.5 text-yorumi-manga" />
                                                            {stats.mangaCount}
                                                        </span>
                                                    )}
                                                    {stats.totalHours > 0 && (
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="w-3.5 h-3.5 text-gray-400" />
                                                            {stats.totalHours}h
                                                        </span>
                                                    )}
                                                    {stats.animeCount === 0 && stats.mangaCount === 0 && (
                                                        <span className="text-gray-600">New member</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Arrow */}
                                            <div className="text-gray-600 group-hover:text-yorumi-accent transition-colors shrink-0">
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                                </svg>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </>
                )}

                {/* Empty State when not searched (Discover) */}
                {!hasSearched && !isSearching && !errorMsg && (
                    <div className="mt-8">
                        <div className="flex items-center gap-2 mb-6">
                            <span className="w-1.5 h-6 bg-yorumi-accent rounded-full" />
                            <h2 className="text-xl md:text-2xl font-black text-white">Community Members</h2>
                        </div>
                        
                        {discoverUsers.length > 0 ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5">
                                {discoverUsers.map((user) => (
                                    <button
                                        key={user.uid}
                                        onClick={() => navigate(`/user/${user.uid}`)}
                                        className="group flex flex-col items-center p-2 transition-all duration-300"
                                    >
                                        <div className="w-full aspect-square rounded-xl overflow-hidden border-2 border-white/10 group-hover:border-yorumi-accent/50 transition-colors mb-3 bg-[#2a2a2a]">
                                            {user.avatar ? (
                                                <img src={user.avatar} alt={user.displayName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-white font-bold text-4xl">
                                                    {user.displayName?.charAt(0).toUpperCase() || '?'}
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div className="w-full text-center">
                                            <div className="text-white font-bold text-sm md:text-base truncate px-1 group-hover:text-yorumi-accent transition-colors">
                                                {user.displayName}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-[#1c1c1c] rounded-2xl p-10 mt-4 text-center border border-white/5">
                                <Users className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                                <p className="text-gray-400 font-medium">New members will appear here...</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronRight, ChevronUp, Clock, RotateCw, X } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTitleLanguage } from '../context/TitleLanguageContext';
import { getAnimeSearchSeed, searchApi, type SearchPreviewItem } from '../features/search/api';
import { suggestSearchCorrection } from '../utils/searchIntelligence';
import { useDebounce } from '../hooks/useDebounce';
import { isIncognitoMode } from '../utils/appPrefs';
import { getPersonalizedSearchSuggestions } from '../utils/searchRecommendations';
import { userSearchService, type PublicUserProfile } from '../services/userService';
import AnimeCard from '../features/anime/components/AnimeCard';
import MangaCard from '../features/manga/components/MangaCard';
import LNCard from '../features/ln/components/LNCard';
import type { Anime } from '../types/anime';
import type { Manga } from '../types/manga';
import type { LightNovel } from '../types/ln';

type SearchGroup = 'anime' | 'manga' | 'ln';

const RECENT_SEARCHES_KEY = 'yorumi_recent_searches_global_v1';
const LEGACY_RECENT_KEYS = [
    'yorumi_recent_searches_anime',
    'yorumi_recent_searches_manga',
    'yorumi_recent_searches_ln',
];

const FALLBACK_SUGGESTIONS = [
    'Solo Leveling',
    'Frieren',
    'Jujutsu Kaisen',
    'One Piece',
    'The Apothecary Diaries',
    'Omniscient Reader',
    'Chainsaw Man',
    'Dandadan',
    'Sakamoto Days',
    'Overgeared',
    'Shadow Slave',
    'Lord of the Mysteries',
    'Blue Lock',
    'Vinland Saga',
    'Kagurabachi',
    'Mushoku Tensei',
];

const GROUPS: Array<{ key: SearchGroup; label: string; subtitle: string }> = [
    { key: 'anime', label: 'Anime', subtitle: 'Series and movies' },
    { key: 'manga', label: 'Manga', subtitle: 'Manga, manhwa and manhua' },
    { key: 'ln', label: 'Light Novels', subtitle: 'Light novels and web novels' },
];

const readRecentSearches = (): string[] => {
    const merged: string[] = [];
    const seen = new Set<string>();
    const add = (val: unknown) => {
        const s = typeof val === 'string' ? val.trim() : '';
        if (!s) return;
        const lower = s.toLowerCase();
        if (seen.has(lower)) return;
        seen.add(lower);
        merged.push(s);
    };

    try {
        const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) parsed.forEach(add);
        }
        if (merged.length === 0) {
            for (const key of LEGACY_RECENT_KEYS) {
                const legacy = localStorage.getItem(key);
                if (!legacy) continue;
                const parsed = JSON.parse(legacy);
                if (Array.isArray(parsed)) parsed.forEach(add);
            }
        }
    } catch {
        // Ignore storage read errors
    }
    return merged.slice(0, 15);
};

export default function SearchPage() {
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const { language } = useTitleLanguage();
    const inputRef = useRef<HTMLInputElement>(null);
    const rowRefs = useRef<Record<SearchGroup, HTMLDivElement | null>>({ anime: null, manga: null, ln: null });
    const [query, setQuery] = useState(() => params.get('q') || '');
    const debouncedQuery = useDebounce(query, 180);
    const [results, setResults] = useState<Record<SearchGroup, SearchPreviewItem[]>>({ anime: [], manga: [], ln: [] });
    const [userResults, setUserResults] = useState<PublicUserProfile[]>([]);
    const [loadingState, setLoadingState] = useState<{ anime: boolean; manga: boolean; ln: boolean; users: boolean }>({
        anime: false,
        manga: false,
        ln: false,
        users: false,
    });

    const [recentSearches, setRecentSearches] = useState<string[]>(readRecentSearches);
    const [showAllRecents, setShowAllRecents] = useState(false);
    const [suggestionPool, setSuggestionPool] = useState<string[]>(FALLBACK_SUGGESTIONS);
    const [suggestionPage, setSuggestionPage] = useState(0);

    const displayedSuggestions = useMemo(() => {
        const pageSize = 10;
        if (suggestionPool.length <= pageSize) return suggestionPool;
        const start = (suggestionPage * pageSize) % suggestionPool.length;
        const out: string[] = [];
        for (let i = 0; i < pageSize; i += 1) {
            out.push(suggestionPool[(start + i) % suggestionPool.length]);
        }
        return out;
    }, [suggestionPool, suggestionPage]);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    useEffect(() => {
        let cancelled = false;
        void getPersonalizedSearchSuggestions().then((ranked) => {
            if (cancelled || ranked.length === 0) return;
            setSuggestionPool(ranked);
            setSuggestionPage(0);
        }).catch(() => undefined);
        return () => { cancelled = true; };
    }, []);

    const saveRecentSearch = useCallback((term: string) => {
        if (isIncognitoMode()) return;
        const trimmed = term.trim();
        if (trimmed.length < 2) return;
        setRecentSearches((prev) => {
            const next = [trimmed, ...prev.filter((s) => s.toLowerCase() !== trimmed.toLowerCase())].slice(0, 15);
            try {
                localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
            } catch {
                // Ignore storage write errors
            }
            return next;
        });
    }, []);

    const removeRecentSearch = (term: string) => {
        setRecentSearches((prev) => {
            const next = prev.filter((s) => s !== term);
            try {
                localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
            } catch {
                // Ignore storage write errors
            }
            return next;
        });
    };

    const refreshSuggestions = () => {
        setSuggestionPage((prev) => prev + 1);
    };

    useEffect(() => {
        const value = debouncedQuery.trim();
        Object.values(rowRefs.current).forEach((row) => row?.scrollTo({ left: 0 }));
        setParams(value ? { q: value } : {}, { replace: true });
        if (value.length < 2) {
            setResults({ anime: [], manga: [], ln: [] });
            setUserResults([]);
            setLoadingState({ anime: false, manga: false, ln: false, users: false });
            return;
        }

        let current = true;
        setLoadingState({ anime: true, manga: true, ln: true, users: true });

        // Stream each source independently so fast AniList results appear immediately
        // instead of waiting on slower NovelBin scraping or Render cold starts.
        searchApi.getAnimePreview(value, language)
            .then((anime) => {
                if (current) setResults((prev) => ({ ...prev, anime }));
            })
            .catch(() => {
                if (current) setResults((prev) => ({ ...prev, anime: [] }));
            })
            .finally(() => {
                if (current) setLoadingState((prev) => ({ ...prev, anime: false }));
            });

        searchApi.getMangaPreview(value, language)
            .then((manga) => {
                if (current) setResults((prev) => ({ ...prev, manga }));
            })
            .catch(() => {
                if (current) setResults((prev) => ({ ...prev, manga: [] }));
            })
            .finally(() => {
                if (current) setLoadingState((prev) => ({ ...prev, manga: false }));
            });

        searchApi.getLNPreview(value, language)
            .then((ln) => {
                if (current) setResults((prev) => ({ ...prev, ln }));
            })
            .catch(() => {
                if (current) setResults((prev) => ({ ...prev, ln: [] }));
            })
            .finally(() => {
                if (current) setLoadingState((prev) => ({ ...prev, ln: false }));
            });

        userSearchService.searchUsers(value, 12)
            .then((users) => {
                if (current) setUserResults(users);
            })
            .catch(() => {
                if (current) setUserResults([]);
            })
            .finally(() => {
                if (current) setLoadingState((prev) => ({ ...prev, users: false }));
            });

        return () => { current = false; };
    }, [debouncedQuery, language, setParams]);

    const handleSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();
        const trimmed = query.trim();
        if (!trimmed && displayedSuggestions[0]) {
            setQuery(displayedSuggestions[0]);
            saveRecentSearch(displayedSuggestions[0]);
            return;
        }
        if (trimmed.length >= 2) {
            saveRecentSearch(trimmed);
            inputRef.current?.blur();
        }
    };

    const pickTerm = (term: string) => {
        setQuery(term);
        saveRecentSearch(term);
    };

    const getCardData = (group: SearchGroup, item: SearchPreviewItem) => {
        if (group === 'anime') return getAnimeSearchSeed(item);
        const raw = item.raw || item.ln || item.manga || {};
        const common = {
            ...raw,
            id: raw.id || item.id,
            mal_id: raw.mal_id || item.id,
            title: raw.title || item.title,
            title_english: raw.title_english || item.title,
            title_romaji: raw.title_romaji || item.subtitle || item.title,
            type: raw.type || item.type,
            score: raw.score || item.score || 0,
            images: raw.images || { jpg: { image_url: item.image, large_image_url: item.image } },
        };
        if (group === 'manga') return common as Manga;
        return common as LightNovel;
    };

    const openResult = (group: SearchGroup, item: SearchPreviewItem) => {
        if (query.trim().length >= 2) saveRecentSearch(query);
        const normalized = getCardData(group, item);
        if (group === 'manga') {
            navigate(item.url, { state: { manga: normalized } });
        } else if (group === 'ln') {
            navigate(item.url, { state: { ln: normalized } });
        } else {
            navigate(item.url, { state: { anime: normalized } });
        }
    };

    const hasQuery = debouncedQuery.trim().length >= 2;
    const visibleRecents = showAllRecents ? recentSearches : recentSearches.slice(0, 6);

    const suggestion = useMemo(() => {
        if (!hasQuery) return null;
        const liveTitles = [
            ...results.anime.map((r) => r.title),
            ...results.manga.map((r) => r.title),
            ...results.ln.map((r) => r.title),
        ];
        return suggestSearchCorrection(debouncedQuery, liveTitles);
    }, [debouncedQuery, hasQuery, results]);

    return (
        <div className="min-h-[100dvh] bg-[#0b0b0d] pb-20 text-white">
            {/* TikTok-style Sticky Search Header */}
            <header
                className="sticky top-0 md:top-8 z-30 bg-[#0b0b0d]/95 backdrop-blur-xl"
                style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 10px)' }}
            >
                <form
                    onSubmit={handleSubmit}
                    className="flex h-14 items-center gap-2.5 px-3 md:mx-auto md:max-w-6xl md:px-6"
                >
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="grid h-9 w-9 shrink-0 place-items-center text-white/90 active:scale-90 transition-transform"
                        aria-label="Go back"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>

                    <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full bg-white/[0.09] px-3.5">
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder={displayedSuggestions[0] || 'Search anime, manga, LN...'}
                            className="min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/40"
                        />
                        {query && (
                            <button
                                type="button"
                                onClick={() => {
                                    setQuery('');
                                    inputRef.current?.focus();
                                }}
                                className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/15 text-white/80"
                                aria-label="Clear search"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>

                    <button
                        type="submit"
                        className="shrink-0 px-1.5 text-[15px] font-semibold text-yorumi-accent active:opacity-75 transition-opacity"
                    >
                        Search
                    </button>
                </form>
            </header>

            <main className="mx-auto max-w-6xl py-2">
                {!hasQuery && (
                    <div className="px-4">
                        {/* Recent Searches */}
                        {recentSearches.length > 0 && (
                            <section className="pb-2">
                                <div className="space-y-0.5">
                                    {visibleRecents.map((term) => (
                                        <div
                                            key={term}
                                            className="flex items-center justify-between gap-3 py-2.5 active:bg-white/[0.04] rounded-lg transition-colors"
                                        >
                                            <button
                                                type="button"
                                                onClick={() => pickTerm(term)}
                                                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                                            >
                                                <Clock className="h-4 w-4 shrink-0 text-white/40" />
                                                <span className="truncate text-[15px] font-semibold text-white/95">
                                                    {term}
                                                </span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => removeRecentSearch(term)}
                                                className="grid h-7 w-7 shrink-0 place-items-center text-white/45 hover:text-white"
                                                aria-label={`Remove ${term}`}
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {recentSearches.length > 6 && (
                                    <button
                                        type="button"
                                        onClick={() => setShowAllRecents((prev) => !prev)}
                                        className="mt-1 flex w-full items-center justify-center gap-1 py-2 text-xs font-medium text-white/55 hover:text-white/80"
                                    >
                                        <span>{showAllRecents ? 'See less' : 'See more'}</span>
                                        {showAllRecents ? (
                                            <ChevronUp className="h-3.5 w-3.5" />
                                        ) : (
                                            <ChevronDown className="h-3.5 w-3.5" />
                                        )}
                                    </button>
                                )}

                                <div className="my-3 h-px w-full bg-white/[0.08]" />
                            </section>
                        )}

                        {/* You may like */}
                        <section className="pt-1">
                            <div className="mb-3.5 flex items-center justify-between">
                                <h2 className="text-[15px] font-bold text-white">You may like</h2>
                                <button
                                    type="button"
                                    onClick={refreshSuggestions}
                                    className="flex items-center gap-1.5 text-xs font-medium text-white/55 hover:text-white active:scale-95 transition-all"
                                >
                                    <RotateCw className="h-3.5 w-3.5" />
                                    <span>Refresh</span>
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
                                {displayedSuggestions.map((term, idx) => (
                                    <button
                                        key={`${term}-${idx}`}
                                        type="button"
                                        onClick={() => pickTerm(term)}
                                        className={`truncate text-left text-[14px] font-semibold transition-opacity active:opacity-70 ${idx < 2 ? 'text-yorumi-accent' : 'text-white/90'
                                            }`}
                                    >
                                        {term}
                                    </button>
                                ))}
                            </div>
                        </section>
                    </div>
                )}

                {hasQuery && suggestion && (
                    <div className="px-4 pb-3">
                        <div className="flex flex-wrap items-center gap-1.5 text-sm text-white/70">
                            <span>{suggestion.isAlias ? 'Showing results for' : 'Did you mean'}</span>
                            <button
                                type="button"
                                onClick={() => setQuery(suggestion.correctedQuery)}
                                className="font-bold text-yorumi-accent hover:underline cursor-pointer"
                            >
                                {suggestion.correctedQuery}
                            </button>
                            {!suggestion.isAlias && <span>?</span>}
                        </div>
                    </div>
                )}

                {hasQuery && (loadingState.users || userResults.length > 0) && (
                    <section className="mb-8">
                        <button
                            type="button"
                            onClick={() => navigate('/users')}
                            className="flex w-full items-center justify-between px-4 pb-3 text-left"
                        >
                            <div>
                                <h2 className="text-xl font-semibold leading-tight">Users</h2>
                                <p className="mt-0.5 text-sm text-white/55">Community profiles</p>
                            </div>
                            <ChevronRight className="h-7 w-7 text-white/75" />
                        </button>

                        {loadingState.users ? (
                            <div className="flex gap-3 overflow-hidden px-4">
                                {[0, 1, 2].map((item) => (
                                    <div key={item} className="h-16 w-44 shrink-0 animate-pulse rounded-xl bg-white/5" />
                                ))}
                            </div>
                        ) : (
                            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide">
                                {userResults.map((user) => {
                                    const animeCount = (user.watchList?.length || 0) + (user.continueWatching?.length || 0);
                                    const mangaCount = (user.readList?.length || 0) + (user.continueReading?.length || 0);
                                    return (
                                        <button
                                            key={user.uid}
                                            type="button"
                                            onClick={() => {
                                                if (query.trim().length >= 2) saveRecentSearch(query);
                                                navigate(`/user/${user.uid}`);
                                            }}
                                            className="flex w-52 shrink-0 snap-start items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-2.5 text-left active:bg-white/10 transition-colors"
                                        >
                                            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10 text-sm font-bold text-white">
                                                {user.avatar ? (
                                                    <img src={user.avatar} alt={user.displayName} className="h-full w-full object-cover" />
                                                ) : (
                                                    user.displayName.charAt(0).toUpperCase()
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-bold text-white">{user.displayName}</p>
                                                <p className="mt-0.5 truncate text-xs text-white/55">
                                                    {animeCount} anime · {mangaCount} manga
                                                </p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                )}

                {hasQuery && GROUPS.map((group) => (
                    <section key={group.key} className="mb-8">
                        <button
                            onClick={() => navigate(`/search/${group.key}?q=${encodeURIComponent(debouncedQuery.trim())}`)}
                            className="flex w-full items-center justify-between px-4 pb-3 text-left"
                        >
                            <div>
                                <h2 className="text-xl font-semibold leading-tight">{group.label}</h2>
                                <p className="mt-0.5 text-sm text-white/55">{group.subtitle}</p>
                            </div>
                            <ChevronRight className="h-7 w-7 text-white/75" />
                        </button>

                        {loadingState[group.key] ? (
                            <div className="flex gap-3 overflow-hidden px-4">
                                {[0, 1, 2, 3].map((item) => <div key={item} className="h-52 w-28 shrink-0 animate-pulse rounded-md bg-white/5" />)}
                            </div>
                        ) : results[group.key].length ? (
                            <div
                                ref={(node) => { rowRefs.current[group.key] = node; }}
                                className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide"
                            >
                                {results[group.key].map((item) => (
                                    <div key={`${group.key}-${item.id}`} className="w-[140px] shrink-0 snap-start">
                                        {group.key === 'anime' ? (
                                            <AnimeCard anime={getCardData('anime', item) as Anime} onClick={() => openResult('anime', item)} disableTilt />
                                        ) : group.key === 'manga' ? (
                                            <MangaCard manga={getCardData('manga', item) as Manga} onClick={() => openResult('manga', item)} disableTilt />
                                        ) : (
                                            <LNCard ln={getCardData('ln', item) as LightNovel} onClick={() => openResult('ln', item)} disableTilt />
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="px-4 py-5 text-sm text-white/40">No {group.label.toLowerCase()} results.</p>
                        )}
                    </section>
                ))}
            </main>
        </div>
    );
}

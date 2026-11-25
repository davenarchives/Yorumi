import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Shuffle, SlidersHorizontal, X } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { animeService } from '../services/animeService';
import { tmdbService } from '../services/tmdbService';
import type { Anime } from '../types/anime';
import AnimeLandscapeCard, { AnimeLandscapeCardSkeleton } from '../features/anime/components/AnimeLandscapeCard';
import { buildAnimeDetailsPath } from '../utils/animeNavigation';
import { getDisplayImageUrl } from '../utils/image';

type BrowseTab = 'trending' | 'popular' | 'top_rated' | 'airing' | 'upcoming';

const TABS: Array<{ id: BrowseTab; label: string }> = [
    { id: 'trending', label: 'Trending' },
    { id: 'popular', label: 'Popular' },
    { id: 'top_rated', label: 'Top Rated' },
    { id: 'airing', label: 'Airing' },
    { id: 'upcoming', label: 'Upcoming' },
];

const GENRES = [
    'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror',
    'Mahou Shoujo', 'Mecha', 'Music', 'Mystery', 'Psychological', 'Romance',
    'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural', 'Thriller', 'Ecchi',
];

const TAGS = [
    'Aliens', 'Anti-Hero', 'Band', 'Coming of Age', 'Crime', 'Cyberpunk',
    'Demons', 'Harem', 'Historical', 'Isekai', 'Josei', 'Magic',
    'Martial Arts', 'Military', 'Parody', 'Post-Apocalyptic', 'Reincarnation',
    'School', 'Seinen', 'Shoujo', 'Shounen', 'Super Power', 'Survival',
    'Time Manipulation', 'Vampire',
];

const FORMATS: Array<{ value: string; label: string }> = [
    { value: 'TV', label: 'TV' },
    { value: 'MOVIE', label: 'Movie' },
    { value: 'OVA', label: 'OVA' },
    { value: 'ONA', label: 'ONA' },
    { value: 'SPECIAL', label: 'Special' },
    { value: 'TV_SHORT', label: 'TV Short' },
];

const SEASONS: Array<{ value: string; label: string }> = [
    { value: 'WINTER', label: 'Winter' },
    { value: 'SPRING', label: 'Spring' },
    { value: 'SUMMER', label: 'Summer' },
    { value: 'FALL', label: 'Fall' },
];

const CURRENT_YEAR = new Date().getFullYear() + 1;
const YEARS = Array.from({ length: CURRENT_YEAR - 1979 }, (_, idx) => String(CURRENT_YEAR - idx));

const STATUSES: Array<{ value: string; label: string }> = [
    { value: 'RELEASING', label: 'Airing' },
    { value: 'FINISHED', label: 'Finished' },
    { value: 'NOT_YET_RELEASED', label: 'Upcoming' },
    { value: 'HIATUS', label: 'Hiatus' },
    { value: 'CANCELLED', label: 'Cancelled' },
];

const RATINGS: Array<{ value: string; label: string; minScore: number }> = [
    { value: '9', label: '9+ ★', minScore: 89 },
    { value: '8', label: '8+ ★', minScore: 79 },
    { value: '7', label: '7+ ★', minScore: 69 },
    { value: '6', label: '6+ ★', minScore: 59 },
    { value: '5', label: '5+ ★', minScore: 49 },
];

interface FilterDropdownProps {
    label: string;
    allLabel?: string;
    selectedValues: string[];
    options: Array<{ value: string; label: string }>;
    isOpen: boolean;
    multi?: boolean;
    onToggle: () => void;
    onSelect: (val: string) => void;
    onClear: () => void;
}

function FilterDropdown({
    label,
    allLabel,
    selectedValues,
    options,
    isOpen,
    multi = false,
    onToggle,
    onSelect,
    onClear,
}: FilterDropdownProps) {
    const firstSelectedLabel =
        options.find((opt) => opt.value === selectedValues[0])?.label || selectedValues[0] || '';
    const displayLabel =
        selectedValues.length === 0
            ? label
            : selectedValues.length === 1
                ? firstSelectedLabel
                : `${firstSelectedLabel} +${selectedValues.length - 1}`;

    return (
        <div className="relative">
            <button
                type="button"
                onClick={onToggle}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-colors cursor-pointer whitespace-nowrap border-0 outline-none ${
                    selectedValues.length > 0
                        ? 'bg-[#0596ff] text-white shadow-sm'
                        : 'bg-white/10 hover:bg-white/20 text-white/75 hover:text-white'
                }`}
            >
                <span>{displayLabel}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute right-0 md:left-0 mt-2 w-48 max-h-72 overflow-y-auto rounded-2xl bg-[#14161d]/95 backdrop-blur-xl border border-white/10 shadow-2xl p-1.5 z-50 scrollbar-thin scrollbar-thumb-white/15 scrollbar-track-transparent">
                    <button
                        type="button"
                        onClick={onClear}
                        className={`w-full flex items-center justify-between gap-2 text-left px-3 py-2 rounded-xl text-[13px] font-medium transition-colors cursor-pointer ${
                            selectedValues.length === 0
                                ? 'text-white bg-white/10 font-bold'
                                : 'text-white/70 hover:text-white hover:bg-white/[0.06]'
                        }`}
                    >
                        <span>{allLabel || `All ${label}s`}</span>
                        {selectedValues.length === 0 && <Check className="w-3.5 h-3.5 text-[#0596ff] shrink-0" />}
                    </button>
                    {options.map((opt) => {
                        const isSelected = selectedValues.includes(opt.value);
                        return (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => onSelect(opt.value)}
                                className={`w-full flex items-center justify-between gap-2 text-left px-3 py-2 rounded-xl text-[13px] font-medium transition-colors cursor-pointer ${
                                    isSelected
                                        ? 'text-white bg-white/15 font-bold'
                                        : 'text-white/75 hover:text-white hover:bg-white/[0.06]'
                                }`}
                                aria-pressed={multi ? isSelected : undefined}
                            >
                                <span className="truncate">{opt.label}</span>
                                {isSelected && <Check className="w-3.5 h-3.5 text-[#0596ff] shrink-0" />}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

const parseInitialTab = (raw: string | null): BrowseTab => {
    if (raw === 'popular' || raw === 'top_rated' || raw === 'airing' || raw === 'upcoming' || raw === 'trending') {
        return raw;
    }
    if (raw === 'score') return 'top_rated';
    return 'trending';
};

export default function AnimeBrowsePage() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const activeTab = parseInitialTab(searchParams.get('tab') || searchParams.get('sort'));
    const genreParam = searchParams.get('genre') || '';
    const selectedGenres = useMemo(
        () =>
            Array.from(
                new Set(
                    genreParam
                        .split(',')
                        .map((g) => g.trim())
                        .filter(Boolean)
                )
            ),
        [genreParam]
    );
    const tag = searchParams.get('tag') || '';
    const format = searchParams.get('format') || '';
    const season = searchParams.get('season') || '';
    const year = searchParams.get('year') || '';
    const status = searchParams.get('status') || '';
    const rating = searchParams.get('rating') || '';

    const [openDropdown, setOpenDropdown] = useState<string | null>(null);
    const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
    const [filterDragY, setFilterDragY] = useState(0);
    const [isFilterDragging, setIsFilterDragging] = useState(false);
    const filterDragStartYRef = useRef<number | null>(null);
    const filterDragStartTimeRef = useRef<number>(0);
    const [tagSearch, setTagSearch] = useState('');
    const [items, setItems] = useState<Anime[]>([]);
    const [backdrop, setBackdrop] = useState('');
    const [page, setPage] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [retryNonce, setRetryNonce] = useState(0);

    const dropdownBarRef = useRef<HTMLDivElement>(null);
    const loadMoreRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        if (!openDropdown) return;
        const onPointerDown = (e: PointerEvent) => {
            if (dropdownBarRef.current && !dropdownBarRef.current.contains(e.target as Node)) {
                setOpenDropdown(null);
            }
        };
        document.addEventListener('pointerdown', onPointerDown);
        return () => document.removeEventListener('pointerdown', onPointerDown);
    }, [openDropdown]);

    const updateParam = (key: string, val: string, closeMenu = true) => {
        const next = new URLSearchParams(searchParams);
        next.delete('sort');
        if (val) next.set(key, val);
        else next.delete(key);
        setSearchParams(next, { replace: true });
        if (closeMenu) setOpenDropdown(null);
    };

    const toggleGenre = (genreValue: string) => {
        const nextGenres = selectedGenres.includes(genreValue)
            ? selectedGenres.filter((g) => g !== genreValue)
            : [...selectedGenres, genreValue];
        updateParam('genre', nextGenres.join(','), false);
    };

    const activeFilterEntries = useMemo(() => {
        const list: Array<{ id: string; label: string; onRemove: () => void }> = [];
        selectedGenres.forEach((g) => {
            list.push({
                id: `genre:${g}`,
                label: g,
                onRemove: () => {
                    const remaining = selectedGenres.filter((item) => item !== g);
                    updateParam('genre', remaining.join(','));
                },
            });
        });
        if (tag) {
            list.push({ id: `tag:${tag}`, label: tag, onRemove: () => updateParam('tag', '') });
        }
        if (format) {
            list.push({
                id: `format:${format}`,
                label: FORMATS.find((f) => f.value === format)?.label || format,
                onRemove: () => updateParam('format', ''),
            });
        }
        if (season) {
            list.push({
                id: `season:${season}`,
                label: SEASONS.find((s) => s.value === season)?.label || season,
                onRemove: () => updateParam('season', ''),
            });
        }
        if (year) {
            list.push({ id: `year:${year}`, label: year, onRemove: () => updateParam('year', '') });
        }
        if (status) {
            list.push({
                id: `status:${status}`,
                label: STATUSES.find((s) => s.value === status)?.label || status,
                onRemove: () => updateParam('status', ''),
            });
        }
        if (rating) {
            list.push({
                id: `rating:${rating}`,
                label: RATINGS.find((r) => r.value === rating)?.label || `${rating}+ ★`,
                onRemove: () => updateParam('rating', ''),
            });
        }
        return list;
    }, [format, rating, season, selectedGenres, status, tag, year]);

    const hasActiveFilters = activeFilterEntries.length > 0;

    const filteredTags = useMemo(() => {
        const q = tagSearch.trim().toLowerCase();
        if (!q) return TAGS;
        return TAGS.filter((t) => t.toLowerCase().includes(q));
    }, [tagSearch]);

    // Match Android system navigation bar color and hide mobile navbar while Filters drawer is open
    useEffect(() => {
        const nativeBridge = (window as unknown as {
            YorumiNative?: { setNavigationBarColor?: (hex: string) => void };
        }).YorumiNative;

        if (!isMobileFiltersOpen) {
            setFilterDragY(0);
            setIsFilterDragging(false);
            document.documentElement.classList.remove('explore-episodes-open');
            document.body.classList.remove('explore-episodes-open');
            window.dispatchEvent(new CustomEvent('yorumi-explore-episodes-toggle', { detail: { open: false } }));
            nativeBridge?.setNavigationBarColor?.('#000000');
            return;
        }

        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        document.documentElement.classList.add('explore-episodes-open');
        document.body.classList.add('explore-episodes-open');
        window.dispatchEvent(new CustomEvent('yorumi-explore-episodes-toggle', { detail: { open: true } }));
        nativeBridge?.setNavigationBarColor?.('#121318');

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsMobileFiltersOpen(false);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => {
            document.body.style.overflow = prevOverflow;
            window.removeEventListener('keydown', onKeyDown);
            document.documentElement.classList.remove('explore-episodes-open');
            document.body.classList.remove('explore-episodes-open');
            window.dispatchEvent(new CustomEvent('yorumi-explore-episodes-toggle', { detail: { open: false } }));
            nativeBridge?.setNavigationBarColor?.('#000000');
        };
    }, [isMobileFiltersOpen]);

    const handleFilterDragStart = (clientY: number) => {
        filterDragStartYRef.current = clientY;
        filterDragStartTimeRef.current = Date.now();
        setIsFilterDragging(true);
    };

    const handleFilterDragMove = (clientY: number) => {
        if (filterDragStartYRef.current === null) return;
        const delta = Math.max(0, clientY - filterDragStartYRef.current);
        setFilterDragY(delta);
    };

    const handleFilterDragEnd = () => {
        if (filterDragStartYRef.current === null) return;
        const elapsed = Math.max(1, Date.now() - filterDragStartTimeRef.current);
        const velocity = filterDragY / elapsed;
        filterDragStartYRef.current = null;
        setIsFilterDragging(false);

        if (filterDragY > 110 || velocity > 0.55) {
            setFilterDragY(0);
            setIsMobileFiltersOpen(false);
        } else {
            setFilterDragY(0);
        }
    };

    const clearFilters = () => {
        const next = new URLSearchParams();
        if (activeTab !== 'trending') next.set('tab', activeTab);
        setSearchParams(next, { replace: true });
        setOpenDropdown(null);
    };

    const queryKey = `${activeTab}|${selectedGenres.join(',')}|${tag}|${format}|${season}|${year}|${status}|${rating}`;

    const queryOptions = useMemo(() => {
        let sort: string[] = ['TRENDING_DESC', 'POPULARITY_DESC'];
        let effectiveStatus = status || undefined;

        if (activeTab === 'popular') {
            sort = ['POPULARITY_DESC'];
        } else if (activeTab === 'top_rated') {
            sort = ['SCORE_DESC', 'POPULARITY_DESC'];
        } else if (activeTab === 'airing') {
            sort = ['POPULARITY_DESC'];
            effectiveStatus = effectiveStatus || 'RELEASING';
        } else if (activeTab === 'upcoming') {
            sort = ['POPULARITY_DESC'];
            effectiveStatus = effectiveStatus || 'NOT_YET_RELEASED';
        }

        const ratingObj = RATINGS.find((r) => r.value === rating);
        return {
            perPage: 24,
            sort,
            genres: selectedGenres.length > 0 ? selectedGenres : undefined,
            tag: tag || undefined,
            format: format || undefined,
            season: season || undefined,
            seasonYear: year ? Number(year) : undefined,
            status: effectiveStatus,
            minScore: ratingObj?.minScore,
        };
    }, [activeTab, selectedGenres, tag, format, season, year, status, rating]);

    // Reset and load page 1 whenever filters/tab change
    useEffect(() => {
        let active = true;
        setPage(1);
        setIsLoading(true);
        setLoadError(null);
        setHasNextPage(true);

        animeService
            .browseAnime({ ...queryOptions, page: 1 })
            .then((res) => {
                if (!active) return;
                setItems(res.media);
                setHasNextPage(Boolean(res.pageInfo?.hasNextPage));
            })
            .catch((err) => {
                console.error('Failed to browse anime:', err);
                if (active) {
                    setItems([]);
                    setHasNextPage(false);
                    setLoadError(
                        String(err || '').includes('429')
                            ? 'AniList is temporarily rate-limiting requests. Try again in a moment.'
                            : 'Failed to load anime catalog.'
                    );
                }
            })
            .finally(() => {
                if (active) setIsLoading(false);
            });

        return () => {
            active = false;
        };
    }, [queryKey, queryOptions, retryNonce]);

    // Load subsequent pages
    useEffect(() => {
        if (page <= 1) return;
        let active = true;
        setIsLoadingMore(true);

        animeService
            .browseAnime({ ...queryOptions, page })
            .then((res) => {
                if (!active) return;
                setItems((prev) => {
                    const seen = new Set(prev.map((a) => String(a.anilistId || a.id || a.mal_id || a.title)));
                    const appended = res.media.filter((a: Anime) => {
                        const k = String(a.anilistId || a.id || a.mal_id || a.title);
                        if (seen.has(k)) return false;
                        seen.add(k);
                        return true;
                    });
                    return [...prev, ...appended];
                });
                setHasNextPage(Boolean(res.pageInfo?.hasNextPage));
            })
            .catch((err) => {
                console.error('Failed to load more browse anime:', err);
                if (active) setHasNextPage(false);
            })
            .finally(() => {
                if (active) setIsLoadingMore(false);
            });

        return () => {
            active = false;
        };
    }, [page, queryOptions]);

    // Infinite scroll sentinel
    useEffect(() => {
        const sentinel = loadMoreRef.current;
        if (!sentinel || isLoading || isLoadingMore || !hasNextPage) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((e) => e.isIntersecting)) {
                    observer.disconnect();
                    setPage((prev) => prev + 1);
                }
            },
            { rootMargin: '500px 0px' }
        );
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [isLoading, isLoadingMore, hasNextPage, items.length]);

    const handleAnimeClick = (item: Anime) => {
        const path = buildAnimeDetailsPath(item);
        if (!path) return;
        navigate(path, { state: { anime: item } });
    };

    const handleWatchClick = (item: Anime) => {
        const path = buildAnimeDetailsPath(item, { episode: 1 });
        if (!path) return;
        navigate(path, { state: { anime: item } });
    };

    const handleShuffle = () => {
        if (items.length === 0) return;
        const pick = items[Math.floor(Math.random() * items.length)];
        if (pick) handleAnimeClick(pick);
    };

    // Hero backdrop from the first anime in the current list (upgraded to TMDB w1280 when available)
    const firstAnime = items[0];
    const firstAnimeKey = firstAnime ? String(firstAnime.anilistId || firstAnime.id || firstAnime.mal_id || firstAnime.title) : '';
    useEffect(() => {
        if (!firstAnime) {
            setBackdrop('');
            return;
        }
        let active = true;
        const fallback =
            firstAnime.anilist_banner_image ||
            firstAnime.images?.jpg?.large_image_url ||
            firstAnime.images?.jpg?.image_url ||
            '';
        if (fallback) setBackdrop(getDisplayImageUrl(fallback));

        tmdbService
            .getBackdropForAnime(firstAnime, 'w1280')
            .then((url) => {
                if (active && url) setBackdrop(getDisplayImageUrl(url));
            })
            .catch(() => undefined);

        return () => {
            active = false;
        };
    }, [firstAnimeKey]);

    const activeTabLabel = TABS.find((t) => t.id === activeTab)?.label || 'Browse';
    const mobileBackdrop = firstAnime
        ? getDisplayImageUrl(
              firstAnime.images?.jpg?.large_image_url ||
                  firstAnime.images?.jpg?.image_url ||
                  firstAnime.anilist_cover_image ||
                  ''
          )
        : '';

    return (
        <div className="min-h-screen pb-20 relative bg-[#08090d] text-white overflow-x-clip">
            {/* Crisp Hero Backdrop from the first anime (portrait poster on mobile, TMDB backdrop on desktop) */}
            {(mobileBackdrop || backdrop) && (
                <div
                    className="md:hidden absolute inset-x-0 top-0 h-[340px] bg-cover bg-top"
                    style={{ backgroundImage: `url(${mobileBackdrop || backdrop})` }}
                />
            )}
            {backdrop && (
                <div
                    className="hidden md:block absolute inset-x-0 top-0 h-[520px] bg-cover bg-center"
                    style={{ backgroundImage: `url(${backdrop})` }}
                />
            )}
            <div className="md:hidden absolute inset-x-0 top-0 h-[345px] bg-gradient-to-t from-[#08090d] via-[#08090d]/70 to-[#08090d]/35" />
            <div className="hidden md:block absolute inset-x-0 top-0 h-[525px] bg-gradient-to-t from-[#08090d] via-[#08090d]/65 to-[#08090d]/30" />

            <div className="relative mx-auto w-full max-w-[1440px] px-3.5 sm:px-8 md:px-14 lg:px-16 pt-[calc(max(env(safe-area-inset-top,0px),16px)+4.5rem)] sm:pt-44 md:pt-60">
                {/* Page Title & Subtitle */}
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-white">
                    Anime
                </h1>
                <p className="mt-1 mb-4 md:mt-3 md:mb-6 text-xs sm:text-sm md:text-base text-white/60 font-semibold">
                    {activeTabLabel}
                </p>

                {/* Filter Bar + Active Chips Row Below */}
                <div ref={dropdownBarRef} className="space-y-3 mb-5 md:mb-8">
                    {/* Mobile Top Row: Scrollable Sort Pills (with right fade) + Pinned Filters Pill */}
                    <div className="flex md:hidden items-center gap-2">
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-1 min-w-0 pr-5 [mask-image:linear-gradient(to_right,black_82%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_right,black_82%,transparent_100%)]">
                            {TABS.map((tab) => {
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => updateParam('tab', tab.id === 'trending' ? '' : tab.id)}
                                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer whitespace-nowrap border-0 outline-none shrink-0 ${
                                            isActive
                                                ? 'bg-[#0596ff] text-white'
                                                : 'bg-white/10 text-white/75 active:bg-white/20'
                                        }`}
                                    >
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            type="button"
                            onClick={() => setIsMobileFiltersOpen(true)}
                            className={`inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                                hasActiveFilters
                                    ? 'bg-[#0596ff] text-white'
                                    : 'bg-white/10 text-white/85 active:bg-white/20'
                            }`}
                        >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                            <span>Filters</span>
                            {activeFilterEntries.length > 0 && (
                                <span className="ml-0.5 grid h-4 min-w-[16px] px-1 place-items-center rounded-full bg-white text-[10px] font-black text-[#0596ff]">
                                    {activeFilterEntries.length}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Desktop Top Row: Left Sort Pills, Right Dropdown Filters + Shuffle */}
                    <div className="hidden md:flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
                        <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar pb-0.5 xl:pb-0">
                            {TABS.map((tab) => {
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => updateParam('tab', tab.id === 'trending' ? '' : tab.id)}
                                        className={`px-5 py-2 rounded-full text-sm font-bold transition-colors cursor-pointer whitespace-nowrap border-0 outline-none shrink-0 ${
                                            isActive
                                                ? 'bg-[#0596ff] text-white'
                                                : 'bg-white/10 text-white/75 hover:bg-white/20 hover:text-white'
                                        }`}
                                    >
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <FilterDropdown
                                label="Genre"
                                allLabel="All Genres"
                                selectedValues={selectedGenres}
                                options={GENRES.map((g) => ({ value: g, label: g }))}
                                isOpen={openDropdown === 'genre'}
                                multi
                                onToggle={() => setOpenDropdown((cur) => (cur === 'genre' ? null : 'genre'))}
                                onSelect={toggleGenre}
                                onClear={() => updateParam('genre', '')}
                            />
                            <FilterDropdown
                                label="Tag"
                                allLabel="Any tag"
                                selectedValues={tag ? [tag] : []}
                                options={TAGS.map((t) => ({ value: t, label: t }))}
                                isOpen={openDropdown === 'tag'}
                                onToggle={() => setOpenDropdown((cur) => (cur === 'tag' ? null : 'tag'))}
                                onSelect={(v) => updateParam('tag', v === tag ? '' : v)}
                                onClear={() => updateParam('tag', '')}
                            />
                            <FilterDropdown
                                label="Format"
                                allLabel="All Formats"
                                selectedValues={format ? [format] : []}
                                options={FORMATS}
                                isOpen={openDropdown === 'format'}
                                onToggle={() => setOpenDropdown((cur) => (cur === 'format' ? null : 'format'))}
                                onSelect={(v) => updateParam('format', v === format ? '' : v)}
                                onClear={() => updateParam('format', '')}
                            />
                            <FilterDropdown
                                label="Season"
                                allLabel="All Seasons"
                                selectedValues={season ? [season] : []}
                                options={SEASONS}
                                isOpen={openDropdown === 'season'}
                                onToggle={() => setOpenDropdown((cur) => (cur === 'season' ? null : 'season'))}
                                onSelect={(v) => updateParam('season', v === season ? '' : v)}
                                onClear={() => updateParam('season', '')}
                            />
                            <FilterDropdown
                                label="Year"
                                allLabel="All Years"
                                selectedValues={year ? [year] : []}
                                options={YEARS.map((y) => ({ value: y, label: y }))}
                                isOpen={openDropdown === 'year'}
                                onToggle={() => setOpenDropdown((cur) => (cur === 'year' ? null : 'year'))}
                                onSelect={(v) => updateParam('year', v === year ? '' : v)}
                                onClear={() => updateParam('year', '')}
                            />
                            <FilterDropdown
                                label="Status"
                                allLabel="All Statuses"
                                selectedValues={status ? [status] : []}
                                options={STATUSES}
                                isOpen={openDropdown === 'status'}
                                onToggle={() => setOpenDropdown((cur) => (cur === 'status' ? null : 'status'))}
                                onSelect={(v) => updateParam('status', v === status ? '' : v)}
                                onClear={() => updateParam('status', '')}
                            />
                            <FilterDropdown
                                label="Rating"
                                allLabel="Any Rating"
                                selectedValues={rating ? [rating] : []}
                                options={RATINGS.map((r) => ({ value: r.value, label: r.label }))}
                                isOpen={openDropdown === 'rating'}
                                onToggle={() => setOpenDropdown((cur) => (cur === 'rating' ? null : 'rating'))}
                                onSelect={(v) => updateParam('rating', v === rating ? '' : v)}
                                onClear={() => updateParam('rating', '')}
                            />

                            <button
                                type="button"
                                onClick={handleShuffle}
                                disabled={items.length === 0}
                                title="Random anime"
                                aria-label="Open random anime"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white/85 hover:text-white transition-colors cursor-pointer"
                            >
                                <Shuffle className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Active Filter Chips Row Directly Below (both Mobile & Desktop) */}
                    {hasActiveFilters && (
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar md:flex-wrap pb-0.5">
                            {activeFilterEntries.map((entry) => (
                                <button
                                    key={entry.id}
                                    type="button"
                                    onClick={entry.onRemove}
                                    className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full bg-white/12 hover:bg-white/20 active:bg-white/25 text-xs md:text-[13px] font-bold text-white whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                                >
                                    <span>{entry.label}</span>
                                    <X className="w-3.5 h-3.5 text-white/70" />
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={clearFilters}
                                className="px-2 py-1 text-xs md:text-[13px] font-semibold text-white/75 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                                Clear
                            </button>
                        </div>
                    )}
                </div>

                {/* Anime Grid */}
                {isLoading ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
                        {Array.from({ length: 16 }).map((_, idx) => (
                            <AnimeLandscapeCardSkeleton key={idx} />
                        ))}
                    </div>
                ) : items.length === 0 ? (
                    <div className="py-24 text-center">
                        <p className="text-sm text-white/55 mb-4">
                            {loadError || 'No anime matched those filters.'}
                        </p>
                        {loadError ? (
                            <button
                                type="button"
                                onClick={() => setRetryNonce((n) => n + 1)}
                                className="px-5 py-2 rounded-full bg-[#0596ff] hover:bg-[#1aa3ff] text-white text-xs font-bold cursor-pointer transition-colors"
                            >
                                Retry
                            </button>
                        ) : hasActiveFilters && (
                            <button
                                type="button"
                                onClick={clearFilters}
                                className="px-4 py-2 rounded-full bg-white text-neutral-950 text-xs font-bold cursor-pointer"
                            >
                                Reset filters
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
                            {items.map((anime, idx) => (
                                <AnimeLandscapeCard
                                    key={`${anime.anilistId || anime.id || anime.mal_id || anime.title}-${idx}`}
                                    anime={anime}
                                    onClick={handleAnimeClick}
                                    onWatchClick={handleWatchClick}
                                />
                            ))}
                            {isLoadingMore &&
                                Array.from({ length: 4 }).map((_, idx) => (
                                    <AnimeLandscapeCardSkeleton key={`more-${idx}`} />
                                ))}
                        </div>
                        {hasNextPage && <div ref={loadMoreRef} className="h-10" aria-hidden="true" />}
                    </>
                )}
            </div>

            {/* Mobile Draggable Filter Bottom Sheet (portaled above mobile navbar, matches ExploreEpisodesDrawer) */}
            {isMobileFiltersOpen && typeof document !== 'undefined' && createPortal(
                <>
                    <div
                        onClick={() => setIsMobileFiltersOpen(false)}
                        className="fixed inset-0 bg-black/55 z-[2147483610] md:hidden"
                        aria-hidden="true"
                    />
                    <aside
                        aria-label="Filters"
                        style={{
                            transform: filterDragY > 0 ? `translateY(${filterDragY}px)` : undefined,
                            transition: isFilterDragging ? 'none' : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
                        }}
                        className="md:hidden fixed inset-x-0 bottom-0 z-[2147483620] h-[82vh] max-h-[88vh] rounded-t-[28px] border-t border-white/10 bg-[#121318] flex flex-col select-none overflow-hidden animate-in slide-in-from-bottom duration-250"
                    >
                        {/* Draggable Handle + Header */}
                        <div
                            className="touch-none shrink-0 bg-[#121318] border-b border-white/[0.08]"
                            onPointerDown={(e) => {
                                e.currentTarget.setPointerCapture(e.pointerId);
                                handleFilterDragStart(e.clientY);
                            }}
                            onPointerMove={(e) => handleFilterDragMove(e.clientY)}
                            onPointerUp={handleFilterDragEnd}
                            onPointerCancel={handleFilterDragEnd}
                        >
                            <div className="w-10 h-1 rounded-full bg-white/25 mx-auto mt-2.5 mb-1" />
                            <div className="flex items-center justify-between px-5 py-3">
                                <div className="flex items-center gap-2.5">
                                    <h2 className="text-[17px] font-extrabold text-white tracking-tight">Filters</h2>
                                    {activeFilterEntries.length > 0 && (
                                        <span className="text-[12px] font-bold text-white/60 bg-white/[0.08] px-2.5 py-0.5 rounded-full tabular-nums">
                                            {activeFilterEntries.length}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Scrollable Filter Sections */}
                        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                            {/* Genre (Multi-select) */}
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-white/50 mb-2">
                                    Genre
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => updateParam('genre', '', false)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                                            selectedGenres.length === 0
                                                ? 'bg-[#0596ff] text-white'
                                                : 'bg-white/[0.07] text-white/80 active:bg-white/15'
                                        }`}
                                    >
                                        All Genres
                                    </button>
                                    {GENRES.map((g) => {
                                        const active = selectedGenres.includes(g);
                                        return (
                                            <button
                                                key={g}
                                                type="button"
                                                onClick={() => toggleGenre(g)}
                                                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                                                    active
                                                        ? 'bg-[#0596ff] text-white'
                                                        : 'bg-white/[0.07] text-white/80 active:bg-white/15'
                                                }`}
                                            >
                                                {g}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Tag with Search Input */}
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-white/50 mb-2">
                                    Tag
                                </p>
                                <input
                                    type="text"
                                    value={tagSearch}
                                    onChange={(e) => setTagSearch(e.target.value)}
                                    placeholder="Search tag"
                                    className="w-full mb-2.5 rounded-xl bg-white/[0.06] border border-white/10 px-3.5 py-2 text-xs text-white placeholder:text-white/40 outline-none focus:border-[#0596ff]/60"
                                />
                                <div className="flex flex-wrap gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => updateParam('tag', '', false)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                                            !tag
                                                ? 'bg-[#0596ff] text-white'
                                                : 'bg-white/[0.07] text-white/80 active:bg-white/15'
                                        }`}
                                    >
                                        Any tag
                                    </button>
                                    {filteredTags.map((t) => {
                                        const active = tag === t;
                                        return (
                                            <button
                                                key={t}
                                                type="button"
                                                onClick={() => updateParam('tag', active ? '' : t, false)}
                                                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                                                    active
                                                        ? 'bg-[#0596ff] text-white'
                                                        : 'bg-white/[0.07] text-white/80 active:bg-white/15'
                                                }`}
                                            >
                                                {t}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Format, Season, Status, Rating */}
                            {[
                                { key: 'format', title: 'Format', anyLabel: 'All Formats', value: format, options: FORMATS },
                                { key: 'season', title: 'Season', anyLabel: 'All Seasons', value: season, options: SEASONS },
                                { key: 'status', title: 'Status', anyLabel: 'All Statuses', value: status, options: STATUSES },
                                { key: 'rating', title: 'Minimum Rating', anyLabel: 'Any Rating', value: rating, options: RATINGS.map((r) => ({ value: r.value, label: r.label })) },
                            ].map((section) => (
                                <div key={section.key}>
                                    <p className="text-xs font-bold uppercase tracking-wider text-white/50 mb-2">
                                        {section.title}
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => updateParam(section.key, '', false)}
                                            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                                                !section.value
                                                    ? 'bg-[#0596ff] text-white'
                                                    : 'bg-white/[0.07] text-white/80 active:bg-white/15'
                                            }`}
                                        >
                                            {section.anyLabel}
                                        </button>
                                        {section.options.map((opt) => {
                                            const active = section.value === opt.value;
                                            return (
                                                <button
                                                    key={opt.value}
                                                    type="button"
                                                    onClick={() => updateParam(section.key, active ? '' : opt.value, false)}
                                                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                                                        active
                                                            ? 'bg-[#0596ff] text-white'
                                                            : 'bg-white/[0.07] text-white/80 active:bg-white/15'
                                                    }`}
                                                >
                                                    {opt.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}

                            {/* Year horizontal scroll row */}
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-white/50 mb-2">
                                    Year
                                </p>
                                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                                    <button
                                        type="button"
                                        onClick={() => updateParam('year', '', false)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-colors ${
                                            !year
                                                ? 'bg-[#0596ff] text-white'
                                                : 'bg-white/[0.07] text-white/80 active:bg-white/15'
                                        }`}
                                    >
                                        All Years
                                    </button>
                                    {YEARS.map((y) => {
                                        const active = year === y;
                                        return (
                                            <button
                                                key={y}
                                                type="button"
                                                onClick={() => updateParam('year', active ? '' : y, false)}
                                                className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-colors ${
                                                    active
                                                        ? 'bg-[#0596ff] text-white'
                                                        : 'bg-white/[0.07] text-white/80 active:bg-white/15'
                                                }`}
                                            >
                                                {y}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Sticky Bottom Bar: Shuffle + Clear all + Done */}
                        <div className="px-4 pt-3 pb-[calc(max(env(safe-area-inset-bottom,0px),14px)+0.25rem)] border-t border-white/[0.08] bg-[#121318] flex items-center gap-2 shrink-0">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsMobileFiltersOpen(false);
                                    handleShuffle();
                                }}
                                disabled={items.length === 0}
                                aria-label="Random anime"
                                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/85 active:bg-white/20 disabled:opacity-40 transition-colors"
                            >
                                <Shuffle className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                onClick={clearFilters}
                                className="flex-1 h-11 rounded-full bg-white/10 text-white text-sm font-bold active:bg-white/20 transition-colors"
                            >
                                Clear all
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsMobileFiltersOpen(false)}
                                className="flex-1 h-11 rounded-full bg-[#0596ff] text-white text-sm font-bold inline-flex items-center justify-center gap-1.5 active:opacity-90 transition-opacity"
                            >
                                <Check className="w-4 h-4 stroke-[2.5]" />
                                <span>Done</span>
                            </button>
                        </div>
                    </aside>
                </>,
                document.body
            )}
        </div>
    );
}

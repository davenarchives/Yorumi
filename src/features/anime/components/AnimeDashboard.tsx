import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, m } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Anime } from '../../../types/anime';
import SpotlightHero from './SpotlightHero';
import ContinueWatching from './ContinueWatching';
import AnimeLandscapeCard, { AnimeLandscapeCardSkeleton } from './AnimeLandscapeCard';
import AnimeLandscapeCarousel from './AnimeLandscapeCarousel';
import StudiosCarousel from './StudiosCarousel';
import AnimeHomeSidebar from './AnimeHomeSidebar';
import { tmdbService } from '../../../services/tmdbService';
import { animeService } from '../../../services/animeService';
import { getDisplayImageUrl } from '../../../utils/image';

interface AnimeDashboardProps {
    continueWatchingList?: any[];
    onRemoveHistory?: (id: string | number) => void;
    spotlightAnime: Anime[];
    spotlightLoading?: boolean;
    latestUpdates: Anime[];
    latestUpdatesLoading: boolean;
    trendingAnime: Anime[];
    trendingLoading: boolean;
    popularSeason: Anime[];
    popularSeasonLoading: boolean;
    topTenToday: Anime[];
    topTenWeek: Anime[];
    topTenMonth: Anime[];
    topTenLoading: boolean;
    topAnime: Anime[];
    topAnimeLoading?: boolean;
    topRatedAnime?: Anime[];
    animeMovies?: Anime[];
    upcomingAnime?: Anime[];
    airingAnime?: Anime[];
    allTimeTitle?: string;
    latestUpdatesTitle?: string;
    trendingTitle?: string;
    popularSeasonTitle?: string;
    compactCatalogMode?: boolean;
    hideTopTen?: boolean;
    hideTopAnime?: boolean;
    onAnimeClick: (anime: Anime) => void;
    onWatchClick: (anime: Anime, episodeNumber?: number, startSeconds?: number) => void;
    onAnimeHover?: (anime: Anime) => void;
}

type BrowseTab = 'newest' | 'popular' | 'top_rated';

const getCurrentSeasonHeader = (): string => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const season =
        month <= 3 ? 'Winter' : month <= 6 ? 'Spring' : month <= 9 ? 'Summer' : 'Fall';
    return `Airing ${season} ${year}`;
};

let cachedDailyAnime: Anime[] = [];
let cachedTmdbTrending: Anime[] = [];

export default function AnimeDashboard({
    continueWatchingList,
    onRemoveHistory,
    spotlightAnime,
    spotlightLoading = false,
    latestUpdates,
    latestUpdatesLoading,
    trendingAnime,
    trendingLoading,
    popularSeason,
    popularSeasonLoading,
    topAnime,
    topAnimeLoading = false,
    topRatedAnime = [],
    animeMovies = [],
    upcomingAnime = [],
    airingAnime = [],
    compactCatalogMode = false,
    onAnimeClick,
    onWatchClick,
    onAnimeHover,
}: AnimeDashboardProps) {
    const navigate = useNavigate();
    const [browseTab, setBrowseTab] = useState<BrowseTab>('newest');
    const [browsePage, setBrowsePage] = useState(0);
    const [browseExtraByTab, setBrowseExtraByTab] = useState<Record<BrowseTab, { items: Anime[]; apiPage: number; hasMore: boolean; loading: boolean }>>({
        newest: { items: [], apiPage: 1, hasMore: true, loading: false },
        popular: { items: [], apiPage: 1, hasMore: true, loading: false },
        top_rated: { items: [], apiPage: 1, hasMore: true, loading: false },
    });
    const [dailyAnime, setDailyAnime] = useState<Anime[]>(cachedDailyAnime);
    const [dailyLoading, setDailyLoading] = useState(cachedDailyAnime.length === 0);
    const [tmdbTrending, setTmdbTrending] = useState<Anime[]>(cachedTmdbTrending);
    const [tmdbTrendingLoading, setTmdbTrendingLoading] = useState(cachedTmdbTrending.length === 0);

    useEffect(() => {
        let active = true;
        animeService.getDailyTrendingAnime().then((items) => {
            if (Array.isArray(items) && items.length > 0) {
                cachedDailyAnime = items;
                if (active) setDailyAnime(items);
            }
        }).catch((error) => {
            console.warn('[AnimeDashboard] Daily trending anime unavailable', error);
        }).finally(() => {
            if (active) setDailyLoading(false);
        });
        animeService.getTmdbTrendingNow().then((items) => {
            if (Array.isArray(items) && items.length > 0) {
                cachedTmdbTrending = items;
                if (active) setTmdbTrending(items);
            }
        }).catch((error) => {
            console.warn('[AnimeDashboard] TMDB trending anime unavailable', error);
        }).finally(() => {
            if (active) setTmdbTrendingLoading(false);
        });
        return () => { active = false; };
    }, []);

    // Ambient Mood Background State (blends full page with active spotlight cover like Vivarium)
    const [activeBackdrop, setActiveBackdrop] = useState<string>(() => {
        const first = spotlightAnime[0];
        if (!first) return '';
        const cached = tmdbService.getCachedBackdropForAnime(first);
        const raw = cached || (first as any).backgroundCover || (first as any).backdrop || (first as any).bannerImage || first.anilist_banner_image;
        return raw ? getDisplayImageUrl(raw) : '';
    });

    useEffect(() => {
        if (!activeBackdrop && spotlightAnime.length > 0) {
            const first = spotlightAnime[0];
            const cached = tmdbService.getCachedBackdropForAnime(first);
            const raw = cached || (first as any).backgroundCover || (first as any).backdrop || (first as any).bannerImage || first.anilist_banner_image;
            if (raw) setActiveBackdrop(getDisplayImageUrl(raw));
        }
    }, [spotlightAnime, activeBackdrop]);


    const effectiveTopRated = useMemo(() => {
        if (topRatedAnime.length > 0) return topRatedAnime;
        return [...topAnime, ...trendingAnime]
            .filter((item, idx, arr) => arr.findIndex((x) => (x.id || x.mal_id) === (item.id || item.mal_id)) === idx)
            .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
    }, [topRatedAnime, topAnime, trendingAnime]);

    const effectiveMovies = useMemo(() => {
        if (animeMovies.length > 0) return animeMovies;
        return [...topAnime, ...trendingAnime].filter(
            (item) => String(item.type || '').toUpperCase() === 'MOVIE'
        );
    }, [animeMovies, topAnime, trendingAnime]);

    const effectiveAiring = useMemo(() => {
        if (airingAnime.length > 0) return airingAnime;
        return [...popularSeason, ...trendingAnime].filter((item) => String(item.status || '').toUpperCase() === 'RELEASING');
    }, [airingAnime, popularSeason, trendingAnime]);

    const effectiveUpcoming = useMemo(() => {
        if (upcomingAnime.length > 0) return upcomingAnime;
        return popularSeason.filter((item) => String(item.status || '').toUpperCase() === 'NOT_YET_RELEASED');
    }, [upcomingAnime, popularSeason]);

    const MAX_BROWSE_SLIDES = 50;
    const ITEMS_PER_BLOCK = 6;
    const MAX_BROWSE_ITEMS = MAX_BROWSE_SLIDES * ITEMS_PER_BLOCK;

    const baseBrowseItems = useMemo(() => {
        if (browseTab === 'newest') {
            return latestUpdates.length > 0 ? latestUpdates : popularSeason;
        }
        if (browseTab === 'popular') {
            return topAnime.length > 0 ? topAnime : trendingAnime;
        }
        return effectiveTopRated;
    }, [browseTab, latestUpdates, popularSeason, topAnime, trendingAnime, effectiveTopRated]);

    const allBrowseItems = useMemo(() => {
        const extra = browseExtraByTab[browseTab]?.items || [];
        if (extra.length === 0) return baseBrowseItems.slice(0, MAX_BROWSE_ITEMS);
        const seen = new Set<string>();
        const merged: Anime[] = [];
        for (const item of [...baseBrowseItems, ...extra]) {
            const key = String(item.id || item.mal_id || item.scraperId || item.title || '').toLowerCase();
            if (!key || seen.has(key)) continue;
            seen.add(key);
            merged.push(item);
            if (merged.length >= MAX_BROWSE_ITEMS) break;
        }
        return merged;
    }, [baseBrowseItems, browseExtraByTab, browseTab, MAX_BROWSE_ITEMS]);

    const loadMoreBrowseTab = async (tab: BrowseTab) => {
        const state = browseExtraByTab[tab];
        if (!state || state.loading || !state.hasMore) return;
        const nextApiPage = state.apiPage + 1;
        setBrowseExtraByTab((prev) => ({
            ...prev,
            [tab]: { ...prev[tab], loading: true },
        }));
        try {
            let fetched: Anime[] = [];
            let hasMore = false;
            if (tab === 'newest') {
                const res = await animeService.getLatestUpdatesPage(nextApiPage, 24);
                fetched = res?.data || [];
                hasMore = Boolean(res?.pagination?.has_next_page) && fetched.length > 0;
            } else if (tab === 'popular') {
                const res = await animeService.getTrendingAnime(nextApiPage, 24);
                fetched = res?.data || [];
                hasMore = Boolean(res?.pagination?.has_next_page) && fetched.length > 0;
            } else {
                const res = await animeService.getTopAnime(nextApiPage);
                fetched = res?.data || [];
                hasMore = Boolean(res?.pagination?.has_next_page) && fetched.length > 0;
            }
            setBrowseExtraByTab((prev) => ({
                ...prev,
                [tab]: {
                    items: [...prev[tab].items, ...fetched],
                    apiPage: nextApiPage,
                    hasMore: hasMore && (baseBrowseItems.length + prev[tab].items.length + fetched.length) < MAX_BROWSE_ITEMS,
                    loading: false,
                },
            }));
        } catch {
            setBrowseExtraByTab((prev) => ({
                ...prev,
                [tab]: { ...prev[tab], loading: false, hasMore: false },
            }));
        }
    };

    const totalBlocks = Math.max(1, Math.min(MAX_BROWSE_SLIDES, Math.ceil(allBrowseItems.length / ITEMS_PER_BLOCK)));
    const visibleBrowseItems = useMemo(() => {
        const start = browsePage * ITEMS_PER_BLOCK;
        const slice = allBrowseItems.slice(start, start + ITEMS_PER_BLOCK);
        if (slice.length === 0 && allBrowseItems.length > 0) {
            return allBrowseItems.slice(0, ITEMS_PER_BLOCK);
        }
        return slice;
    }, [allBrowseItems, browsePage]);

    const isBrowseLoading =
        (browseTab === 'newest' && latestUpdatesLoading && popularSeasonLoading) ||
        (browseTab === 'popular' && topAnimeLoading && trendingLoading) ||
        (browseTab === 'top_rated' && topAnimeLoading && topRatedAnime.length === 0);

    const scrollBrowsePrev = () => {
        setBrowsePage((prev) => Math.max(0, prev - 1));
    };

    const scrollBrowseNext = () => {
        const nextSlide = browsePage + 1;
        if (nextSlide < totalBlocks) {
            setBrowsePage(nextSlide);
        }
        // Prefetch next API page when within 2 slides of the end (up to 50 slides)
        if (nextSlide >= totalBlocks - 2 && totalBlocks < MAX_BROWSE_SLIDES) {
            void loadMoreBrowseTab(browseTab);
        }
    };

    const handleBrowseTabChange = (tab: BrowseTab) => {
        setBrowseTab(tab);
        setBrowsePage(0);
    };

    const airingSeasonTitle = useMemo(() => getCurrentSeasonHeader(), []);

    return (
        <div className="media-home-perf relative min-h-screen bg-[#070707] overflow-x-hidden text-white">
            {/* Ambient Mood Background Layer (Vivarium-style moodBg) - desktop only to avoid mobile GPU blur jank */}
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none hidden md:block" aria-hidden="true">
                <AnimatePresence mode="sync">
                    {activeBackdrop && (
                        <m.div
                            key={activeBackdrop}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 1.2, ease: 'easeOut' }}
                            className="absolute inset-0"
                        >
                            {/* Ambient Light Bloom Canvas: heavily blurred, highly saturated colored light */}
                            <div
                                className="absolute -inset-[20%] w-[140%] h-[140%] bg-cover bg-center bg-no-repeat"
                                style={{
                                    backgroundImage: `url(${activeBackdrop})`,
                                    filter: 'blur(100px) saturate(2.4) brightness(1.05)',
                                    transform: 'scale(1.2)',
                                    opacity: 0.55,
                                }}
                            />
                            {/* Ambient Tint Scrim: keeps deep background dark while allowing luminous colors to glow */}
                            <div className="absolute inset-0 bg-[#070707]/35" />
                            <div className="absolute inset-0 bg-gradient-to-b from-[#070707]/10 via-[#070707]/25 to-[#070707]/55" />
                        </m.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Fullscreen Spotlight Hero */}
            {!compactCatalogMode && (
                <SpotlightHero
                    animeList={spotlightAnime}
                    isLoading={spotlightLoading}
                    onAnimeClick={onAnimeClick}
                    onWatchClick={(anime) => onWatchClick(anime)}
                    onAnimeHover={onAnimeHover}
                    onBackdropChange={setActiveBackdrop}
                />
            )}

            {/* Main Dashboard Content */}
            <div className={`relative z-10 w-full max-w-[1440px] mx-auto px-4 sm:px-10 md:px-14 lg:px-16 pb-4 md:pb-16 ${!compactCatalogMode ? 'md:-mt-8' : ''}`}>
                {!compactCatalogMode && continueWatchingList && continueWatchingList.length > 0 && (
                    <div className="mb-10">
                        <ContinueWatching
                            title="Continue Watching"
                            items={continueWatchingList}
                            onRemove={onRemoveHistory || (() => {})}
                            onWatchClick={(anime, ep, start) => onWatchClick(anime, ep, start)}
                        />
                    </div>
                )}

                {/* Upper Two-Column Section: Left (Top 10 Today, Trending Now, Airing, Browse Anime) + Right (Top Airing, Upcoming, Schedule) */}
                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-8 items-start">
                    <div className="min-w-0">
                        {/* 1. Top 10 Today */}
                        <AnimeLandscapeCarousel
                            title="Top 10 Today"
                            animeList={dailyAnime}
                            isLoading={dailyLoading}
                            columns={3}
                            onAnimeClick={onAnimeClick}
                            onWatchClick={(anime) => onWatchClick(anime, 1)}
                            onMouseEnter={onAnimeHover}
                        />

                        {/* 2. Trending Now */}
                        <AnimeLandscapeCarousel
                            title="Trending Now"
                            animeList={tmdbTrending}
                            isLoading={tmdbTrendingLoading}
                            columns={3}
                            onAnimeClick={onAnimeClick}
                            onWatchClick={(anime) => onWatchClick(anime, 1)}
                            onMouseEnter={onAnimeHover}
                        />

                        {/* 3. Airing (Current Season) */}
                        <AnimeLandscapeCarousel
                            title={airingSeasonTitle}
                            animeList={popularSeason}
                            isLoading={popularSeasonLoading}
                            columns={3}
                            onAnimeClick={onAnimeClick}
                            onWatchClick={(anime) => onWatchClick(anime, 1)}
                            onMouseEnter={onAnimeHover}
                            onSeeAll={() => navigate('/anime/browse?tab=airing')}
                        />

                        {/* 4. Browse Anime (Newest / Popular / Top rated) */}
                        <section className="relative z-20 mb-10">
                            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                                <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                                    <h2 className="text-[20px] sm:text-[22px] font-extrabold text-white tracking-tight">
                                        Browse Anime
                                    </h2>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleBrowseTabChange('newest')}
                                            className={`px-4 py-1.5 rounded-full text-xs sm:text-[13px] font-bold transition-all cursor-pointer border-0 outline-none focus:outline-none ${
                                                browseTab === 'newest'
                                                    ? 'bg-white text-neutral-950 shadow-sm'
                                                    : 'bg-white/[0.08] hover:bg-white/[0.16] text-white/80 hover:text-white'
                                            }`}
                                        >
                                            Newest
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleBrowseTabChange('popular')}
                                            className={`px-4 py-1.5 rounded-full text-xs sm:text-[13px] font-bold transition-all cursor-pointer border-0 outline-none focus:outline-none ${
                                                browseTab === 'popular'
                                                    ? 'bg-white text-neutral-950 shadow-sm'
                                                    : 'bg-white/[0.08] hover:bg-white/[0.16] text-white/80 hover:text-white'
                                            }`}
                                        >
                                            Popular
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleBrowseTabChange('top_rated')}
                                            className={`px-4 py-1.5 rounded-full text-xs sm:text-[13px] font-bold transition-all cursor-pointer border-0 outline-none focus:outline-none ${
                                                browseTab === 'top_rated'
                                                    ? 'bg-white text-neutral-950 shadow-sm'
                                                    : 'bg-white/[0.08] hover:bg-white/[0.16] text-white/80 hover:text-white'
                                            }`}
                                        >
                                            Top rated
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (browseTab === 'popular') navigate('/anime/browse?tab=popular');
                                            else if (browseTab === 'top_rated') navigate('/anime/browse?tab=top_rated');
                                            else navigate('/anime/browse?tab=trending');
                                        }}
                                        className="inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-white/80 hover:text-white transition-colors cursor-pointer mr-1"
                                    >
                                        <span>See all</span>
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={scrollBrowsePrev}
                                            aria-label="Previous browse block"
                                            className="w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/[0.18] border-0 outline-none focus:outline-none flex items-center justify-center text-white/85 hover:text-white transition-all cursor-pointer"
                                        >
                                            <ChevronLeft className="w-4 h-4 stroke-[2.2]" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={scrollBrowseNext}
                                            aria-label="Next browse block"
                                            className="w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/[0.18] border-0 outline-none focus:outline-none flex items-center justify-center text-white/85 hover:text-white transition-all cursor-pointer"
                                        >
                                            <ChevronRight className="w-4 h-4 stroke-[2.2]" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5">
                                {isBrowseLoading
                                    ? Array.from({ length: 6 }).map((_, idx) => (
                                          <AnimeLandscapeCardSkeleton key={idx} />
                                      ))
                                    : visibleBrowseItems.map((anime, idx) => (
                                          <AnimeLandscapeCard
                                              key={`browse-${browseTab}-${browsePage}-${anime.id || anime.mal_id || idx}`}
                                              anime={anime}
                                              onClick={onAnimeClick}
                                              onWatchClick={(item) => onWatchClick(item, 1)}
                                              onMouseEnter={onAnimeHover}
                                          />
                                      ))}
                            </div>
                        </section>
                    </div>

                    {/* Right Sidebar: Top Airing, Upcoming, Airing Schedule (Hidden on mobile) */}
                    <div className="hidden xl:block w-full xl:w-[340px] shrink-0">
                        <AnimeHomeSidebar
                            airingAnime={effectiveAiring}
                            upcomingAnime={effectiveUpcoming}
                            isLoading={(popularSeasonLoading || trendingLoading) && effectiveAiring.length === 0}
                            onAnimeClick={onAnimeClick}
                        />
                    </div>
                </div>

                {/* Lower Full-Width Sections: Studios, Top Rated, Anime Movies */}
                <div className="mt-4">
                    {/* 5. Studios */}
                    <StudiosCarousel />

                    {/* 6. Top 100 Anime */}
                    <AnimeLandscapeCarousel
                        title="Top 100 Anime"
                        animeList={effectiveTopRated}
                        isLoading={topAnimeLoading && effectiveTopRated.length === 0}
                        columns={4}
                        showRanking
                        seeAllLabel="View all"
                        onAnimeClick={onAnimeClick}
                        onWatchClick={(anime) => onWatchClick(anime, 1)}
                        onMouseEnter={onAnimeHover}
                        onSeeAll={() => navigate('/anime/top-100')}
                    />

                    {/* 7. Anime Movies */}
                    <AnimeLandscapeCarousel
                        title="Anime movies"
                        animeList={effectiveMovies}
                        isLoading={topAnimeLoading && effectiveMovies.length === 0}
                        columns={4}
                        onAnimeClick={onAnimeClick}
                        onWatchClick={(anime) => onWatchClick(anime, 1)}
                        onMouseEnter={onAnimeHover}
                        onSeeAll={() => navigate('/anime/browse?format=MOVIE')}
                    />
                </div>
            </div>
        </div>
    );
}

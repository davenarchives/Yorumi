
import type { Anime } from '../../../types/anime';
import SpotlightHero from './SpotlightHero';
import TrendingNow from './TrendingNow';
import PopularSeason from './PopularSeason';
import AnimeCard from './AnimeCard';
import AnimeCardSkeleton from './AnimeCardSkeleton';

import TopTenSidebar from './TopTenSidebar';
import ContinueWatching from './ContinueWatching';
import MediaSectionHeader from '../../../components/ui/MediaSectionHeader';

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
    topTenToday,
    topTenWeek,
    topTenMonth,
    topTenLoading,
    topAnime,
    topAnimeLoading = false,
    allTimeTitle = 'All-Time Popular',
    latestUpdatesTitle = 'Latest Updates',
    trendingTitle = 'Trending',
    popularSeasonTitle = 'Popular This Season',
    compactCatalogMode = false,
    hideTopTen = false,
    hideTopAnime = false,


    onAnimeClick,
    onWatchClick,
    onAnimeHover
}: AnimeDashboardProps) {


    return (
        <>
            {!compactCatalogMode && (
                <SpotlightHero
                    animeList={spotlightAnime}
                    isLoading={spotlightLoading}
                    onAnimeClick={onAnimeClick}
                    onWatchClick={onWatchClick}
                    onAnimeHover={onAnimeHover}
                />
            )}

            <div className={`w-full max-w-7xl mx-auto px-4 md:px-14 z-10 relative ${compactCatalogMode ? '' : 'mt-8'}`}>

                {!compactCatalogMode && continueWatchingList && continueWatchingList.length > 0 && (
                    <div className="mb-8">
                        <ContinueWatching
                            title="Continue Watching"
                            items={continueWatchingList}
                            onRemove={onRemoveHistory || (() => {})}
                            onWatchClick={(anime, ep, start) => onWatchClick(anime, ep, start)}
                        />
                    </div>
                )}

                {!compactCatalogMode && (
                    <TrendingNow
                        animeList={latestUpdates}
                        title={latestUpdatesTitle}
                        sectionNumber={1}
                        isLoading={latestUpdatesLoading}
                        onAnimeClick={onAnimeClick}
                        onWatchClick={(anime) => onWatchClick(anime, 1)}

                        onMouseEnter={onAnimeHover}
                    />
                )}

                {!compactCatalogMode && (
                    <TrendingNow
                        animeList={trendingAnime}
                        title={trendingTitle}
                        sectionNumber={2}
                        isLoading={trendingLoading}
                        onAnimeClick={onAnimeClick}
                        onWatchClick={(anime) => onWatchClick(anime, 1)}

                        onMouseEnter={onAnimeHover}
                    />
                )}

                {!compactCatalogMode && (
                    <PopularSeason
                        animeList={popularSeason}
                        title={popularSeasonTitle}
                        sectionNumber={3}
                        isLoading={popularSeasonLoading}
                        onAnimeClick={onAnimeClick}
                        onWatchClick={(anime) => onWatchClick(anime, 1)}

                        onMouseEnter={onAnimeHover}
                    />
                )}

                {/* All-Time Popular + Top 10 + Schedule + Genres */}
                <div className="w-full pt-4">
                    <div className={`grid grid-cols-1 ${!hideTopTen ? 'lg:grid-cols-[1fr_340px]' : ''} gap-6 items-start`}>
                        {!hideTopAnime && (
                            <div data-hover-boundary>
                                <MediaSectionHeader index={4} title={allTimeTitle} />

                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-5 xl:grid-cols-5 gap-4 md:gap-6">
                                    {topAnimeLoading ? (
                                        Array.from({ length: 15 }).map((_, i) => (
                                            <div key={i} className={i >= 12 ? 'hidden sm:block' : ''}>
                                                <AnimeCardSkeleton />
                                            </div>
                                        ))
                                    ) : (
                                        topAnime.slice(0, 15).map((item, i) => (
                                            <div
                                                key={`${item.scraperId || item.id || item.mal_id || item.title}-${item.latestEpisode || item.episodes || 0}`}
                                                className={i >= 12 ? 'hidden sm:block' : ''}
                                            >
                                                <AnimeCard
                                                    anime={item}
                                                    onClick={() => onAnimeClick(item)}
                                                    onWatchClick={() => onWatchClick(item, 1)}
                                                    onMouseEnter={() => onAnimeHover?.(item)}
                                                />
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}

                        {!hideTopTen && (
                            <div className="space-y-6">
                                <TopTenSidebar
                                    today={topTenToday}
                                    week={topTenWeek}
                                    month={topTenMonth}
                                    isLoading={topTenLoading}
                                    onAnimeClick={onAnimeClick}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

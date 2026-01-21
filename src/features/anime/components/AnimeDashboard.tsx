import { useNavigate } from 'react-router-dom';
import type { Anime } from '../../../types/anime';
import SpotlightHero from './SpotlightHero';
import ContinueWatching from './ContinueWatching';
import TrendingNow from './TrendingNow';
import PopularSeason from './PopularSeason';
import AnimeCard from './AnimeCard';
import EstimatedSchedule from './EstimatedSchedule';
import Genres from './Genres';

interface AnimeDashboardProps {
    spotlightAnime: Anime[];
    continueWatchingList: any[];
    trendingAnime: Anime[];
    popularSeason: Anime[];
    topAnime: Anime[];
    onAnimeClick: (anime: Anime) => void;
    onWatchClick: (anime: Anime, episodeNumber?: number) => void;
    onViewAll: (type: 'trending' | 'seasonal' | 'continue_watching' | 'popular') => void;
    onRemoveFromHistory: (animeId: number) => void;
}

export default function AnimeDashboard({
    spotlightAnime,
    continueWatchingList,
    trendingAnime,
    popularSeason,
    topAnime,
    onAnimeClick,
    onWatchClick,
    onViewAll,
    onRemoveFromHistory
}: AnimeDashboardProps) {
    const navigate = useNavigate();

    return (
        <>
            <SpotlightHero
                animeList={spotlightAnime}
                onAnimeClick={onAnimeClick}
                onWatchClick={onWatchClick}
            />

            <div className={`container mx-auto px-4 z-10 relative mt-8`}>
                {/* Continue Watching Carousel */}
                {continueWatchingList.length > 0 && (
                    <ContinueWatching
                        items={continueWatchingList}
                        variant="dashboard"
                        onWatchClick={onWatchClick}
                        onRemove={onRemoveFromHistory}
                        onViewAll={() => onViewAll('continue_watching')}
                    />
                )}

                <TrendingNow
                    animeList={trendingAnime}
                    onAnimeClick={onAnimeClick}
                    onWatchClick={onWatchClick}
                    onViewAll={() => onViewAll('trending')}
                />

                <PopularSeason
                    animeList={popularSeason}
                    onAnimeClick={onAnimeClick}
                    onWatchClick={onWatchClick}
                    onViewAll={() => onViewAll('seasonal')}
                />

                {/* Top Anime Grid (Preview) */}
                <div className="flex items-center justify-between mb-6 pt-4">
                    <h2 className="text-xl font-bold border-l-4 border-yorumi-accent pl-3 text-white">All-Time Popular</h2>
                    <button
                        onClick={() => onViewAll('popular')}
                        className="text-sm font-bold text-yorumi-accent hover:text-white transition-colors"
                    >
                        View All &gt;
                    </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 mb-8">
                    {topAnime.slice(0, 12).map((item) => (
                        <AnimeCard
                            key={item.mal_id}
                            anime={item}
                            onClick={() => onAnimeClick(item)}
                            onWatchClick={() => onWatchClick(item)}
                        />
                    ))}
                </div>

                {/* Schedule and Genres Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
                    <div className="lg:col-span-2">
                        <EstimatedSchedule onAnimeClick={(id) => navigate(`/anime/${id}`)} />
                    </div>
                    <div>
                        <Genres onGenreClick={(genre) => navigate(`/genre/${encodeURIComponent(genre)}`)} />
                    </div>
                </div>
            </div>
        </>
    );
}

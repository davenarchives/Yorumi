import { ArrowLeft, Heart } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AnimeCard from '../features/anime/components/AnimeCard';
import { useWatchList } from '../hooks/useWatchList';
import { slugify } from '../utils/slugify';
import type { WatchListItem } from '../utils/storage';
import { getAnimeDetailsRouteId } from '../utils/animeNavigation';
const isAnimeSessionId = (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const getStoredAnimeRouteId = (item: any) => {
    return getAnimeDetailsRouteId({
        id: item.anilistId || item.id,
        mal_id: item.malId,
        scraperId: item.scraperId,
    });
};

const buildStoredAnimeState = (item: any) => {
    const rawId = String(item.anilistId || item.id || '').trim();
    const parsedId = Number.parseInt(rawId, 10);
    const hasNumericId = Number.isFinite(parsedId) && /^\d+$/.test(rawId);

    return {
        id: hasNumericId ? parsedId : 0,
        mal_id: Number.parseInt(String(item.malId || '0'), 10) || 0,
        scraperId: String(item.scraperId || '').trim() || (!hasNumericId && isAnimeSessionId(rawId) ? rawId : undefined),
        title: item.title,
        images: { jpg: { large_image_url: item.image, image_url: item.image } },
        score: item.score || 0,
        type: item.type || 'TV',
        status: item.mediaStatus || 'UNKNOWN',
        episodes: item.totalCount || null,
        genres: item.genres?.map((g: string) => ({ name: g })) || [],
        synopsis: item.synopsis || ''
    };
};

type WatchClassification = 'all' | WatchListItem['status'];

const WATCH_CLASSIFICATIONS: Array<{
    key: WatchClassification;
    label: string;
    color: string;
}> = [
        { key: 'all', label: 'All', color: 'bg-gray-400' },
        { key: 'watching', label: 'Watching', color: 'bg-[#4b7df3]' },
        { key: 'completed', label: 'Completed', color: 'bg-[#46c72f]' },
        { key: 'plan_to_watch', label: 'Planning', color: 'bg-[#ffbd4a]' },
        { key: 'dropped', label: 'Dropped', color: 'bg-[#dc38d2]' }
    ];

const normalizeWatchStatus = (status?: string): WatchListItem['status'] => {
    if (status === 'completed' || status === 'plan_to_watch' || status === 'dropped') return status;
    return 'watching';
};

const WatchListSection = ({
    label,
    color,
    items,
    onCardClick,
    onWatchClick,
    onRemove
}: {
    label: string;
    color: string;
    items: WatchListItem[];
    onCardClick: (item: WatchListItem, animeData: ReturnType<typeof buildStoredAnimeState>, routeId: string) => void;
    onWatchClick: (item: WatchListItem, animeData: ReturnType<typeof buildStoredAnimeState>, routeId: string) => void;
    onRemove: (id: string) => void;
}) => {
    if (items.length === 0) return null;

    return (
        <section className="space-y-4">
            <div className="flex items-center gap-2">
                <span className={`h-3.5 w-3.5 rounded-full ${color}`} />
                <h2 className="text-xl font-black uppercase tracking-wide text-gray-300">{label}</h2>
                <span className="text-sm font-bold text-gray-600">{items.length}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
                {items.map((item) => {
                    const animeData: any = buildStoredAnimeState(item);
                    const routeId = getStoredAnimeRouteId(item);

                    return (
                        <AnimeCard
                            key={item.id}
                            anime={animeData}
                            onClick={() => onCardClick(item, animeData, routeId)}
                            onWatchClick={() => onWatchClick(item, animeData, routeId)}
                            inList={true}
                            onToggleList={() => onRemove(item.id)}
                            disableTilt
                        />
                    );
                })}
            </div>
        </section>
    );
};

export default function WatchListPage() {
    const navigate = useNavigate();
    const { watchList, removeFromWatchList, loading } = useWatchList();
    const [activeClassification, setActiveClassification] = useState<WatchClassification>('all');
    const groupedWatchList = useMemo(() => {
        return watchList.reduce<Record<WatchListItem['status'], WatchListItem[]>>((groups, item) => {
            groups[normalizeWatchStatus(item.status)].push(item);
            return groups;
        }, {
            watching: [],
            completed: [],
            plan_to_watch: [],
            dropped: []
        });
    }, [watchList]);

    const counts = {
        all: watchList.length,
        watching: groupedWatchList.watching.length,
        completed: groupedWatchList.completed.length,
        plan_to_watch: groupedWatchList.plan_to_watch.length,
        dropped: groupedWatchList.dropped.length
    };

    const handleCardClick = (_item: WatchListItem, animeData: ReturnType<typeof buildStoredAnimeState>, routeId: string) => {
        navigate(`/anime/details/${routeId}`, { state: { anime: animeData } });
    };

    const handleWatchClick = (item: WatchListItem, animeData: ReturnType<typeof buildStoredAnimeState>, routeId: string) => {
        const title = slugify(item.title || 'anime');
        navigate(`/anime/details/${routeId}?ep=1`, { state: { anime: animeData } });
    };

    const visibleClassifications = WATCH_CLASSIFICATIONS.filter((classification) => classification.key !== 'all');

    return (
        <div className="min-h-screen bg-[#07090d] pt-24 pb-12">
            <div className="max-w-[1400px] mx-auto px-4 md:px-8">
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={() => navigate('/profile?tab=anime-overview')}
                        className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-white" />
                    </button>
                    <h1 className="text-2xl font-black text-white tracking-wide uppercase">Watch List</h1>
                </div>

                {!loading && watchList.length > 0 && (
                    <div className="mb-8 flex flex-wrap gap-3">
                        {WATCH_CLASSIFICATIONS.map((classification) => (
                            <button
                                key={classification.key}
                                onClick={() => setActiveClassification(classification.key)}
                                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black transition-colors ${activeClassification === classification.key
                                    ? 'bg-[#1d2b42] text-white'
                                    : 'bg-[#111923] text-gray-400 hover:bg-[#182434] hover:text-white'
                                    }`}
                            >
                                <span className={`h-3.5 w-3.5 rounded-full ${classification.color}`} />
                                {classification.label}
                                <span className="text-xs text-gray-500">{counts[classification.key]}</span>
                            </button>
                        ))}
                    </div>
                )}

                {loading ? (
                    <div className="text-gray-400">Loading watch list...</div>
                ) : watchList.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
                        <Heart className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-400">Your watch list is empty.</p>
                    </div>
                ) : (
                    <div className="space-y-12">
                        {(activeClassification === 'all'
                            ? visibleClassifications
                            : visibleClassifications.filter((classification) => classification.key === activeClassification)
                        ).map((classification) => (
                            <WatchListSection
                                key={classification.key}
                                label={classification.label}
                                color={classification.color}
                                items={groupedWatchList[classification.key as WatchListItem['status']]}
                                onCardClick={handleCardClick}
                                onWatchClick={handleWatchClick}
                                onRemove={removeFromWatchList}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

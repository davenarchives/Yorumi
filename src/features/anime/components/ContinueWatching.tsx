import { ArrowLeft, ChevronLeft, ChevronRight, Play, X } from 'lucide-react';
import useEmblaCarousel from 'embla-carousel-react';
import type { Anime } from '../../../types/anime';
import { buildContinueAnime } from '../../../utils/continueWatchingAnime';
import type { WatchProgress } from '../../../utils/storage';
import AnimeLogoImage from '../../../components/anime/AnimeLogoImage';
import { getDisplayImageUrl } from '../../../utils/image';


interface ContinueWatchingProps {
    items: WatchProgress[];
    variant?: 'dashboard' | 'page';
    onWatchClick: (anime: Anime, episodeNumber: number, startSeconds?: number) => void;
    onRemove: (animeId: string | number) => void;
    title?: string;
    onBack?: () => void;
    gridColumns?: 4 | 6;
}


export default function ContinueWatching({
    items,
    variant = 'dashboard',
    onWatchClick,
    onRemove,
    title,
    onBack,
    gridColumns,
}: ContinueWatchingProps) {
    const [emblaRef, emblaApi] = useEmblaCarousel({ align: 'start', containScroll: 'trimSnaps', dragFree: true });
    if (items.length === 0) return null;

    const renderCard = (item: WatchProgress) => {
        const anime = buildContinueAnime(item);
        const duration = Math.max(0, item.durationSeconds || 0);
        const position = Math.max(0, item.positionSeconds || 0);
        const progress = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;
        const remainingMinutes = duration > 0 ? Math.ceil(Math.max(0, duration - position) / 60) : null;
        const remaining = remainingMinutes === null ? null : remainingMinutes >= 60
            ? `${Math.floor(remainingMinutes / 60)}h ${remainingMinutes % 60}m left`
            : `${remainingMinutes}m left`;

        return (
            <div key={item.animeId} className="group relative min-w-0">
                <button
                    type="button"
                    onClick={() => onWatchClick(anime, item.episodeNumber, item.positionSeconds)}
                    className="block w-full cursor-pointer border-0 bg-transparent p-0 text-left"
                    aria-label={`Continue watching ${item.animeTitle}, episode ${item.episodeNumber}`}
                >
                    <div className="relative aspect-video overflow-hidden rounded-[14px] bg-[#14151c]">
                        <img src={getDisplayImageUrl(item.episodeThumbnail || item.animeImage)} loading="lazy" decoding="async" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = getDisplayImageUrl(item.animeImage); }} alt="" className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]" />
                        <div className="pointer-events-none absolute bottom-3 left-3.5 right-6 z-10 flex items-end">
                            <AnimeLogoImage tmdbId={item.anilistId || anime.id || anime.mal_id} title={item.animeTitle} anime={{ ...anime, id: item.anilistId || anime.id, mal_id: item.malId || anime.mal_id }} preferLogo hideFallbackText size="medium" className="max-w-[72%] object-contain object-left" style={{ maxHeight: '56px' }} />
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
                            <Play className="h-10 w-10 fill-white text-white opacity-0 drop-shadow-lg transition-opacity group-hover:opacity-100" aria-hidden="true" />
                        </div>
                        <div
                            className="absolute inset-x-0 bottom-0 h-1.5 overflow-hidden bg-black/45"
                            role="progressbar"
                            aria-label={`Watch progress for ${item.animeTitle}`}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={duration > 0 ? Math.round(progress) : undefined}
                        >
                            <div className="h-full bg-white" style={{ width: `${progress}%` }} />
                        </div>
                    </div>
                    <h4 className="mt-2.5 line-clamp-2 pr-1 text-[15px] font-bold leading-snug text-white transition-colors group-hover:text-[#0596ff]">{item.animeTitle}</h4>
                    <p className="mt-1 text-[12.5px] font-semibold text-white/60">
                        {item.episodeNumber > 0 ? `S${item.seasonNumber ?? 1} E${item.seasonEpisodeNumber ?? item.episodeNumber}` : 'Continue watching'}{remaining ? ` \u00b7 ${remaining}` : ''}
                    </p>
                </button>
                <button
                    type="button"
                    className="absolute right-2 top-2 z-10 rounded-full bg-black/70 p-1.5 text-white/80 opacity-0 transition-opacity hover:bg-red-500 hover:text-white focus:opacity-100 group-hover:opacity-100"
                    onClick={() => onRemove(item.animeId)}
                    aria-label={`Remove ${item.animeTitle} from history`}
                    title="Remove from history"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        );
    };

    if (variant === 'page') {
        return (
            <div className="min-h-screen pb-12">
                <div className="mb-8 flex items-center gap-4">
                    <button onClick={onBack} aria-label="Go back" className="rounded-full bg-white/5 p-2 transition-colors hover:bg-white/10">
                        <ArrowLeft className="h-5 w-5 text-white" />
                    </button>
                    <h2 className="text-2xl font-extrabold text-white">Continue Watching</h2>
                </div>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {items.map(renderCard)}
                </div>
            </div>
        );
    }

    return (
        <section className="relative">
            <div className="mb-4 flex items-center justify-between gap-4">
                <h2 className="text-[20px] font-extrabold tracking-tight text-white sm:text-[22px]">{title || 'Continue Watching'}</h2>
                {!gridColumns && <div className="flex shrink-0 gap-1.5">
                    <button type="button" onClick={() => emblaApi?.scrollPrev()} aria-label="Previous Continue Watching" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08] text-white/85 transition-colors hover:bg-white/[0.18]">
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => emblaApi?.scrollNext()} aria-label="Next Continue Watching" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08] text-white/85 transition-colors hover:bg-white/[0.18]">
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>}
            </div>
            {gridColumns ? (
                <div className={`grid gap-5 ${gridColumns === 4 ? 'grid-cols-4' : 'grid-cols-6'}`}>{items.map(renderCard)}</div>
            ) : (
                <div ref={emblaRef} className="overflow-hidden">
                    <div className="flex touch-pan-y gap-5">
                        {items.map((item) => <div key={item.animeId} className="min-w-0 flex-[0_0_240px] sm:flex-[0_0_275px] md:flex-[0_0_290px] lg:flex-[0_0_300px]">{renderCard(item)}</div>)}
                    </div>
                </div>
            )}
        </section>
    );
}

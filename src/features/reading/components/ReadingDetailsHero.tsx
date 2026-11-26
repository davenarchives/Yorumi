import { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, Check, Heart, Plus } from 'lucide-react';
import { cacheImage, getCachedImage, getDisplayImageUrl, handleImageError } from '../../../utils/image';
import { useOnlineStatus } from '../../../hooks/useOnlineStatus';

interface ReadingDetailsHeroProps {
    title: string;
    cover: string;
    banner?: string;
    synopsis?: string;
    details: string[];
    genres?: string[];
    inList: boolean;
    inFavorites?: boolean;
    loading: boolean;
    canRead: boolean;
    readLabel: string;
    onRead: () => void;
    onToggleList: () => void;
    onToggleFavorite?: () => void;
    onBack: () => void;
}

export default function ReadingDetailsHero({ title, cover, banner, synopsis, details, genres = [], inList, inFavorites = false, loading, canRead, readLabel, onRead, onToggleList, onToggleFavorite, onBack }: ReadingDetailsHeroProps) {
    const isOnline = useOnlineStatus();
    const [expanded, setExpanded] = useState(false);
    const [cachedCover, setCachedCover] = useState<string | null>(null);
    const [cachedBanner, setCachedBanner] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        const resolveUrl = async (rawUrl: string | undefined, setter: (v: string | null) => void) => {
            if (!rawUrl) {
                setter(null);
                return;
            }
            const hit = await getCachedImage(rawUrl).catch(() => null);
            if (cancelled) return;
            if (hit) {
                setter(hit);
                return;
            }
            setter(null);
            if (isOnline) {
                const saved = await cacheImage(rawUrl).catch(() => rawUrl);
                if (!cancelled && saved && saved !== rawUrl) {
                    setter(saved);
                }
            }
        };
        void resolveUrl(cover, setCachedCover);
        void resolveUrl(banner || cover, setCachedBanner);
        return () => {
            cancelled = true;
        };
    }, [cover, banner, isOnline]);

    const cleanSynopsis = (synopsis || 'No synopsis available.').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    const isLong = cleanSynopsis.length > 185;
    const displayed = !expanded && isLong ? `${cleanSynopsis.slice(0, 185).trimEnd()}...` : cleanSynopsis;
    const image = cachedBanner || getDisplayImageUrl(banner || cover);
    const portrait = cachedCover || getDisplayImageUrl(cover);
    const mask = 'linear-gradient(to bottom, #000 0%, #000 35%, rgba(0,0,0,.75) 58%, rgba(0,0,0,.32) 74%, rgba(0,0,0,.08) 88%, transparent 100%)';
    return <>
        {image && <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
            <div className="absolute -inset-[20%] bg-cover bg-center" style={{ backgroundImage: `url(${image})`, filter: 'blur(100px) saturate(2.4) brightness(1.05)', transform: 'scale(1.2)', opacity: 0.55 }} />
            <div className="absolute inset-0 bg-[#070707]/55" />
        </div>}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-screen min-h-[640px] select-none" aria-hidden="true" style={{ maskImage: mask, WebkitMaskImage: mask }}>
            {portrait && <div className="md:hidden absolute inset-0 bg-cover bg-top bg-no-repeat" style={{ backgroundImage: `url(${portrait})` }} />}
            {image && <div className="hidden md:block absolute inset-0 scale-105 bg-cover bg-center bg-no-repeat blur-sm" style={{ backgroundImage: `url(${image})` }} />}
            <div className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-[#070707]/90 via-[#070707]/50 to-transparent md:w-[65%]" />
            <div className="absolute inset-x-0 top-0 h-[22%] bg-gradient-to-b from-black/60 to-transparent" />
            <div className="absolute inset-y-0 right-0 w-[15%] bg-gradient-to-l from-black/45 to-transparent" />
        </div>
        <div className="relative z-10 flex flex-col items-start gap-5 sm:flex-row sm:gap-7 md:gap-9">
            <div className="relative invisible sm:visible aspect-[2/3] w-32 shrink-0 self-start overflow-hidden rounded-[16px] bg-[#121212] shadow-2xl shadow-black/70 sm:w-40 md:w-[190px] lg:w-[205px]">
                <img src={portrait} alt={title} className="absolute inset-0 h-full w-full object-cover" onError={(event) => handleImageError(event, title)} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-3 pt-1 text-left">
                <h1 className="max-w-2xl text-2xl font-extrabold leading-tight tracking-tight text-white md:text-3xl">{title}</h1>
                {details.length > 0 && <div className="flex flex-wrap items-center gap-2.5 text-[14px] font-bold text-white/90 md:text-[15px]">{details.map((detail, index) => <span key={`${detail}-${index}`}>{index > 0 && <span className="mr-2.5 text-white/50">&middot;</span>}{detail}</span>)}</div>}
                <div className="max-w-2xl text-[14px] font-medium leading-[1.55] text-white/90 md:text-[15.5px]"><p className="inline">{displayed}</p>{isLong && <button type="button" onClick={() => setExpanded((value) => !value)} className="ml-1.5 inline font-extrabold text-white hover:underline">{expanded ? 'less' : 'more'}</button>}</div>
                {genres.length > 0 && <div className="flex flex-wrap gap-2 pt-0.5">{genres.slice(0, 3).map((genre) => <span key={genre} className="rounded-full bg-white/[0.12] px-3.5 py-1.5 text-[13px] font-bold text-white/90">{genre}</span>)}</div>}
                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    <button type="button" onClick={onRead} disabled={loading || !canRead} className="flex h-11 items-center gap-2.5 rounded-full bg-white px-7 text-[15px] font-extrabold text-black transition-all hover:bg-white/90 active:scale-95 disabled:opacity-60 border-0 outline-none focus:outline-none cursor-pointer"><BookOpen className="h-4 w-4" /><span>{readLabel || 'Read'}</span></button>
                    <button type="button" onClick={onToggleList} className="flex h-11 items-center gap-2 rounded-full bg-white/[0.12] px-5 text-[14.5px] font-bold text-white transition-colors hover:bg-white/[0.18] cursor-pointer">{inList ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}<span>{inList ? 'Saved' : 'Read list'}</span></button>
                    {onToggleFavorite && (
                        <button
                            type="button"
                            onClick={onToggleFavorite}
                            title={inFavorites ? 'Remove from favorites' : 'Add to favorites'}
                            aria-label={inFavorites ? 'Remove from favorites' : 'Add to favorites'}
                            className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors border-0 outline-none focus:outline-none cursor-pointer ${
                                inFavorites
                                    ? 'bg-rose-500/25 text-rose-400 hover:bg-rose-500/35'
                                    : 'bg-white/[0.12] text-white hover:bg-white/[0.18]'
                            }`}
                        >
                            <Heart className={`h-4 w-4 ${inFavorites ? 'fill-current' : ''}`} />
                        </button>
                    )}
                    <button type="button" onClick={onBack} aria-label="Go back" className="hidden md:flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.12] text-white transition-colors hover:bg-white/[0.18] cursor-pointer"><ArrowLeft className="h-4 w-4" /></button>
                </div>
            </div>
        </div>
    </>;
}

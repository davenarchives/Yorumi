import { useEffect, useState } from 'react';
import { useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AnimeLandscapeCard, { AnimeLandscapeCardSkeleton } from '../features/anime/components/AnimeLandscapeCard';
import { animeService } from '../services/animeService';
import { tmdbService } from '../services/tmdbService';
import type { Anime } from '../types/anime';
import { buildAnimeDetailsPath } from '../utils/animeNavigation';
import { getDisplayImageUrl } from '../utils/image';
import { groupStudioAnime, uniqueStudioAnime } from '../utils/studioCatalogue';
import type { StudioSort } from '../platform/sources/anilistAnime';

export default function AnimeStudioPage() {
    const { name = '' } = useParams();
    return <StudioView key={name} name={name} />;
}

function StudioView({ name }: { name: string }) {
    const [sort, setSort] = useState<StudioSort>('topRated');
    const [logo, setLogo] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        tmdbService.getStudioLogo(name).then((url) => {
            if (active) setLogo(url);
        }).catch(() => undefined);
        return () => { active = false; };
    }, [name]);

    return <StudioCatalogue key={sort} name={name} logo={logo} sort={sort} onSortChange={setSort} />;
}

function StudioCatalogue({ name, logo, sort, onSortChange }: { name: string; logo: string | null; sort: StudioSort; onSortChange: (sort: StudioSort) => void }) {
    const navigate = useNavigate();
    const [page, setPage] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [studioName, setStudioName] = useState(name);
    const [items, setItems] = useState<Anime[]>([]);
    const [backdrop, setBackdrop] = useState('');
    const [mobileBackdrop, setMobileBackdrop] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [logoFailed, setLogoFailed] = useState(false);
    const loadMoreRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let active = true;
        animeService.getStudioAnime(name, page, sort).then(async (result) => {
            if (!active) return;
            setStudioName(result.name);
            setItems((previous) => uniqueStudioAnime(page === 1 ? result.media : [...previous, ...result.media]));
            setHasNextPage(result.pageInfo.hasNextPage);
            setLoading(false);
            if (page === 1 && result.media.length > 0) {
                const topRated = sort === 'topRated' ? result.media : (await animeService.getStudioAnime(name, 1, 'topRated').catch(() => null))?.media || [];
                const top = groupStudioAnime(topRated)[0];
                if (!active || !top) return;
                const fallback = top.anilist_banner_image || top.images?.jpg?.large_image_url || '';
                const poster = top.images?.jpg?.large_image_url || top.images?.jpg?.image_url || top.anilist_cover_image || fallback;
                setBackdrop(getDisplayImageUrl(fallback));
                if (poster) setMobileBackdrop(getDisplayImageUrl(poster));
                const image = await tmdbService.getBackdropForAnime(top, 'w1280').catch(() => null);
                if (active && image) setBackdrop(getDisplayImageUrl(image));
            }
        }).catch(() => {
            if (active) {
                if (page === 1) setItems([]);
                setError(true);
                setLoading(false);
            }
        });
        return () => { active = false; };
    }, [name, page, sort]);

    useEffect(() => {
        const sentinel = loadMoreRef.current;
        if (!sentinel || loading || error || !hasNextPage) return;
        let requested = false;
        const loadNext = () => {
            if (requested) return;
            requested = true;
            setLoading(true);
            setPage((current) => current + 1);
        };
        if (typeof IntersectionObserver === 'undefined') {
            const checkPosition = () => {
                if (sentinel.getBoundingClientRect().top <= window.innerHeight + 400) loadNext();
            };
            window.addEventListener('scroll', checkPosition, { passive: true, capture: true });
            window.addEventListener('resize', checkPosition);
            checkPosition();
            return () => {
                window.removeEventListener('scroll', checkPosition, true);
                window.removeEventListener('resize', checkPosition);
            };
        }
        const observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                observer.disconnect();
                loadNext();
            }
        }, { rootMargin: '400px 0px' });
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [loading, error, hasNextPage]);

    const openAnime = (anime: Anime) => {
        const path = buildAnimeDetailsPath(anime);
        if (path) navigate(path, { state: { anime } });
    };

    return (
        <div className="min-h-screen pb-20 relative bg-[#08090d]">
            {(mobileBackdrop || backdrop) && <div className="md:hidden absolute inset-x-0 top-0 h-[520px] bg-cover bg-top" style={{ backgroundImage: `url(${mobileBackdrop || backdrop})` }} />}
            {backdrop && <div className="hidden md:block absolute inset-x-0 top-0 h-[520px] bg-cover bg-center" style={{ backgroundImage: `url(${backdrop})` }} />}
            <div className="absolute inset-x-0 top-0 h-[525px] bg-gradient-to-t from-[#08090d] via-[#08090d]/65 to-[#08090d]/30" />
            <div className="relative mx-auto w-full max-w-[1440px] px-4 sm:px-10 md:px-14 lg:px-16 pt-48 sm:pt-64">
                <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white">
                    {logo && !logoFailed ? <img src={logo} alt={studioName} className="max-w-[290px] sm:max-w-[420px] max-h-24 object-contain object-left brightness-0 invert" onError={() => setLogoFailed(true)} /> : studioName}
                </h1>
                <p className="mt-3 mb-6 text-white/60 font-semibold">Studio</p>
                <div className="flex flex-wrap gap-2.5 mb-8" aria-label="Sort studio anime">
                    {([['newest', 'Newest'], ['popular', 'Popular'], ['topRated', 'Top Rated']] as const).map(([value, label]) => (
                        <button key={value} type="button" onClick={() => onSortChange(value)} aria-pressed={sort === value} className={`rounded-full px-5 py-2 text-sm font-bold transition-colors ${sort === value ? 'bg-[#0596ff] text-white' : 'bg-white/10 text-white/75 hover:bg-white/20 hover:text-white'}`}>
                            {label}
                        </button>
                    ))}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                        {groupStudioAnime(items).map((anime) => (
                            <AnimeLandscapeCard key={anime.id} anime={anime} onClick={openAnime} />
                        ))}
                        {loading && Array.from({ length: 8 }, (_, i) => <AnimeLandscapeCardSkeleton key={`loading-${i}`} />)}
                    </div>
                {error && <p className="py-8 text-white/60" role="alert">Could not load this studio. Please try again later.</p>}
                {!loading && !error && items.length === 0 && <p className="py-16 text-white/60">No anime found for this studio.</p>}
                {hasNextPage && !error && <div ref={loadMoreRef} className="h-px" aria-hidden="true" />}
            </div>
        </div>
    );
}

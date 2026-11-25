import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { animeService } from '../services/animeService';
import { mangaService } from '../services/mangaService';
import { lnService } from '../services/lnService';
import { tmdbService } from '../services/tmdbService';
import type { Anime } from '../types/anime';
import type { Manga } from '../types/manga';
import type { LightNovel } from '../types/ln';
import AnimeLandscapeCard, { AnimeLandscapeCardSkeleton } from '../features/anime/components/AnimeLandscapeCard';
import MangaCard from '../features/manga/components/MangaCard';
import LNCard from '../features/ln/components/LNCard';
import MangaCardSkeleton from '../features/manga/components/MangaCardSkeleton';
import { buildAnimeDetailsPath } from '../utils/animeNavigation';
import { getMangaDetailsRouteId } from '../utils/mangaNavigation';
import { getDisplayImageUrl } from '../utils/image';

interface Top100PageProps {
    mediaType: 'anime' | 'manga' | 'ln';
}

export default function Top100Page({ mediaType }: Top100PageProps) {
    const navigate = useNavigate();
    const isAnime = mediaType === 'anime';
    const isManga = mediaType === 'manga';

    const [animeList, setAnimeList] = useState<Anime[]>(() =>
        isAnime ? (animeService.peekTop100Anime() ?? []) : []
    );
    const [mangaList, setMangaList] = useState<Manga[]>(() =>
        isManga ? (mangaService.peekTop100Manga() ?? []) : []
    );
    const [lnList, setLnList] = useState<LightNovel[]>([]);
    const [backdrop, setBackdrop] = useState('');
    const [isLoading, setIsLoading] = useState(() =>
        isAnime
            ? !(animeService.peekTop100Anime()?.length)
            : isManga
              ? !(mangaService.peekTop100Manga()?.length)
              : true
    );

    useEffect(() => {
        let active = true;
        window.scrollTo({ top: 0, behavior: 'auto' });

        if (isAnime) {
            const cached = animeService.peekTop100Anime();
            if (cached?.length) {
                setAnimeList(cached);
                setIsLoading(false);
            } else {
                setIsLoading(true);
            }
            animeService
                .getTop100Anime()
                .then(async (items) => {
                    if (!active) return;
                    const sliced = items.slice(0, 100);
                    setAnimeList(sliced);
                    const top = sliced[0];
                    if (top) {
                        const fallback =
                            top.anilist_banner_image ||
                            top.images?.jpg?.large_image_url ||
                            top.images?.jpg?.image_url ||
                            '';
                        if (fallback) setBackdrop(getDisplayImageUrl(fallback));
                        const tmdbBackdrop = await tmdbService.getBackdropForAnime(top, 'w1280').catch(() => null);
                        if (active && tmdbBackdrop) setBackdrop(getDisplayImageUrl(tmdbBackdrop));
                    }
                })
                .catch((err) => console.error('Failed to fetch Top 100 Anime:', err))
                .finally(() => {
                    if (active) setIsLoading(false);
                });
        } else if (isManga) {
            const cached = mangaService.peekTop100Manga();
            if (cached?.length) {
                setMangaList(cached);
                setIsLoading(false);
            } else {
                setIsLoading(true);
            }
            mangaService
                .getTop100Manga()
                .then((items) => {
                    if (!active) return;
                    const sliced = items.slice(0, 100);
                    setMangaList(sliced);
                    const top = sliced[0];
                    if (top) {
                        const img =
                            top.bannerImage ||
                            top.images?.jpg?.large_image_url ||
                            top.images?.jpg?.image_url ||
                            '';
                        if (img) setBackdrop(getDisplayImageUrl(img));
                    }
                })
                .catch((err) => console.error('Failed to fetch Top 100 Manga:', err))
                .finally(() => {
                    if (active) setIsLoading(false);
                });
        } else {
            setIsLoading(true);
            lnService
                .getTop100Full()
                .then((items) => {
                    if (!active) return;
                    const sliced = items.slice(0, 100);
                    setLnList(sliced);
                    const top = sliced[0];
                    if (top) {
                        const img =
                            top.bannerImage ||
                            top.images?.jpg?.large_image_url ||
                            top.images?.jpg?.image_url ||
                            '';
                        if (img) setBackdrop(getDisplayImageUrl(img));
                    }
                })
                .catch((err) => console.error('Failed to fetch Top 100 Light Novels:', err))
                .finally(() => {
                    if (active) setIsLoading(false);
                });
        }

        return () => {
            active = false;
        };
    }, [isAnime, isManga]);

    const handleAnimeClick = (item: Anime) => {
        const path = buildAnimeDetailsPath(item);
        if (!path) return;
        navigate(path, { state: { anime: item } });
    };

    const handleAnimeWatch = (item: Anime) => {
        const path = buildAnimeDetailsPath(item, { episode: 1 });
        if (!path) return;
        navigate(path, { state: { anime: item } });
    };

    const handleMangaClick = (item: Manga) => {
        const routeId = getMangaDetailsRouteId(item) || String(item.id || item.mal_id || '');
        if (!routeId) return;
        navigate(`/manga/details/${encodeURIComponent(routeId)}`, { state: { manga: item } });
    };

    const handleLNClick = (item: LightNovel) => {
        const id = String(item.id || item.mal_id || '');
        if (!id) return;
        navigate(`/ln/details/${encodeURIComponent(id)}`, { state: { ln: item } });
    };

    const title = isAnime ? 'Top 100 Anime' : isManga ? 'Top 100 Manga' : 'Top 100 Light Novels';
    const itemsCount = isAnime ? animeList.length : isManga ? mangaList.length : lnList.length;
    const firstPoster = isAnime
        ? animeList[0]?.images?.jpg?.large_image_url || animeList[0]?.images?.jpg?.image_url || animeList[0]?.anilist_cover_image || ''
        : isManga
          ? mangaList[0]?.images?.jpg?.large_image_url || mangaList[0]?.images?.jpg?.image_url || ''
          : lnList[0]?.images?.jpg?.large_image_url || lnList[0]?.images?.jpg?.image_url || '';
    const mobileBackdrop = firstPoster ? getDisplayImageUrl(firstPoster) : '';

    return (
        <div className="min-h-screen pb-20 relative bg-[#08090d] text-white">
            {/* Hero Backdrop (portrait poster on mobile, landscape backdrop on desktop) */}
            {(mobileBackdrop || backdrop) && (
                <div
                    className="md:hidden absolute inset-x-0 top-0 h-[520px] bg-cover bg-top"
                    style={{ backgroundImage: `url(${mobileBackdrop || backdrop})` }}
                />
            )}
            {backdrop && (
                <div
                    className="hidden md:block absolute inset-x-0 top-0 h-[520px] bg-cover bg-center"
                    style={{ backgroundImage: `url(${backdrop})` }}
                />
            )}
            <div className="absolute inset-x-0 top-0 h-[525px] bg-gradient-to-t from-[#08090d] via-[#08090d]/65 to-[#08090d]/30" />

            <div className="relative mx-auto w-full max-w-[1440px] px-4 sm:px-10 md:px-14 lg:px-16">
                {/* Title & Subtitle aligned directly above the card grid */}
                <div className="pt-48 sm:pt-64 mb-8">
                    <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white">
                        {title}
                    </h1>
                    <p className="mt-3 text-white/60 font-semibold">
                        {!isLoading && itemsCount > 0 ? `Rankings • #1 – #${itemsCount}` : 'Rankings'}
                    </p>
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                        {Array.from({ length: 16 }).map((_, idx) =>
                            isAnime ? (
                                <AnimeLandscapeCardSkeleton key={idx} />
                            ) : (
                                <MangaCardSkeleton key={idx} />
                            )
                        )}
                    </div>
                ) : itemsCount === 0 ? (
                    <div className="py-24 text-center text-sm text-white/50">
                        No ranked titles available right now.
                    </div>
                ) : isAnime ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 pt-1">
                        {animeList.map((anime, idx) => (
                            <AnimeLandscapeCard
                                key={`${anime.id || anime.mal_id || anime.tmdbId || anime.title}-${idx}`}
                                anime={anime}
                                rank={idx + 1}
                                onClick={handleAnimeClick}
                                onWatchClick={handleAnimeWatch}
                            />
                        ))}
                    </div>
                ) : isManga ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 pt-1">
                        {mangaList.map((manga, idx) => (
                            <div
                                key={`${manga.id || manga.mal_id || manga.title}-${idx}`}
                                className="relative group cursor-pointer"
                            >
                                <MangaCard
                                    manga={manga}
                                    rank={idx + 1}
                                    onClick={handleMangaClick}
                                    disableTilt
                                />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 pt-1">
                        {lnList.map((ln, idx) => (
                            <div
                                key={`${ln.id || ln.mal_id || ln.title}-${idx}`}
                                className="relative group cursor-pointer"
                            >
                                <LNCard
                                    ln={ln}
                                    rank={idx + 1}
                                    showRanking
                                    onClick={handleLNClick}
                                    disableTilt
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

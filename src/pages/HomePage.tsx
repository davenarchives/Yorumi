import { useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useRef } from 'react';
import { useAnime } from '../hooks/useAnime';
import { getAnimeDetailsRouteId, getAnimeWatchRouteId } from '../utils/animeNavigation';
import type { Anime } from '../types/anime';
import { animeService } from '../services/animeService';

// Feature Components
import AnimeDashboard from '../features/anime/components/AnimeDashboard';

export default function HomePage() {
    const navigate = useNavigate();
    const anime = useAnime();
    const isCatalogFilterView = false;
    const filteredTopAnime = Array.isArray(anime.topAnime) ? anime.topAnime : [];
    const allTimeTitle = 'All-Time Popular';
    const routeResolutionCache = useRef(new Map<string, Promise<{ routeId: string; anime: Anime } | null>>());
    const resolvedRouteCache = useRef(new Map<string, { routeId: string; anime: Anime }>());

    useEffect(() => {
        anime.fetchHomeData();
    }, []);

    // Navigation Handlers
    const normalizeTitle = (value: unknown) =>
        String(value || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();

    const getRouteResolutionKey = useCallback((item: Anime) => {
        const query = item.title_english || item.title_romaji || item.title || item.title_japanese;
        if (!query) return '';
        return [
            normalizeTitle(query),
            Number(item.latestEpisode || item.episodes || 0),
            normalizeTitle(item.type)
        ].join(':');
    }, []);

    const getImmediateRouteTarget = useCallback((item: Anime): { routeId: string; anime: Anime } | null => {
        const directRouteId = getAnimeDetailsRouteId(item);
        if (directRouteId) {
            return { routeId: directRouteId, anime: item };
        }

        const routeKey = getRouteResolutionKey(item);
        return routeKey ? resolvedRouteCache.current.get(routeKey) || null : null;
    }, [getRouteResolutionKey]);

    const resolveRouteTarget = useCallback(async (item: Anime): Promise<{ routeId: string; anime: Anime } | null> => {
        const immediate = getImmediateRouteTarget(item);
        if (immediate) return immediate;

        const query = item.title_english || item.title_romaji || item.title || item.title_japanese;
        if (!query) return null;

        const routeKey = getRouteResolutionKey(item);
        if (!routeKey) return null;

        if (!routeResolutionCache.current.has(routeKey)) {
            routeResolutionCache.current.set(routeKey, (async () => {
                const search = await animeService.searchAnime(String(query), 1, 8).catch(() => ({ data: [] as Anime[] }));
                const targetTitles = [
                    item.title,
                    item.title_english,
                    item.title_romaji,
                    item.title_japanese
                ]
                    .map(normalizeTitle)
                    .filter(Boolean);
                const targetEpisodes = Number(item.latestEpisode || item.episodes || 0);

                const ranked = (search.data || [])
                    .filter((candidate: Anime) => Boolean(candidate.id || candidate.mal_id))
                    .map((candidate: Anime) => {
                        const candidateTitles = [
                            candidate.title,
                            candidate.title_english,
                            candidate.title_romaji,
                            candidate.title_japanese
                        ]
                            .map(normalizeTitle)
                            .filter(Boolean);

                        let titleScore = 0;
                        candidateTitles.forEach((candidateTitle) => {
                            if (targetTitles.includes(candidateTitle)) {
                                titleScore = Math.max(titleScore, 100);
                                return;
                            }
                            if (targetTitles.some((targetTitle) =>
                                targetTitle && (candidateTitle.includes(targetTitle) || targetTitle.includes(candidateTitle))
                            )) {
                                titleScore = Math.max(titleScore, 60);
                            }
                        });

                        const candidateEpisodes = Number(candidate.episodes || 0);
                        const episodeScore = targetEpisodes > 0 && candidateEpisodes > 0
                            ? Math.max(0, 20 - Math.abs(candidateEpisodes - targetEpisodes))
                            : 0;

                        return {
                            candidate,
                            score: titleScore + episodeScore
                        };
                    })
                    .sort((a: { candidate: Anime; score: number }, b: { candidate: Anime; score: number }) => b.score - a.score);

                const bestMatch = ranked.find((entry: { candidate: Anime; score: number }) => entry.score > 0)?.candidate || search.data?.[0];
                if (!bestMatch) return null;

                const routeId = getAnimeDetailsRouteId(bestMatch);
                if (!routeId) return null;
                const resolved = {
                    routeId,
                    anime: { ...item, ...bestMatch }
                };
                resolvedRouteCache.current.set(routeKey, resolved);
                return resolved;
            })());
        }

        return routeResolutionCache.current.get(routeKey)!;
    }, [getImmediateRouteTarget, getRouteResolutionKey]);

    const handleAnimeClick = async (item: Anime, breadcrumbParent?: string) => {
        const resolved = getImmediateRouteTarget(item) || await resolveRouteTarget(item);
        if (!resolved) return;
        navigate(`/anime/details/${resolved.routeId}`, { state: { anime: resolved.anime, breadcrumbParent } });
    };

    const handleWatchClick = async (item: Anime, episodeNumber?: number, startSeconds?: number) => {
        const immediateWatchRouteId = getAnimeWatchRouteId(item);
        const resolved = immediateWatchRouteId
            ? { routeId: immediateWatchRouteId, anime: item }
            : await resolveRouteTarget(item);
        if (!resolved) return;

        const id = resolved.routeId;

        let targetEp: number | string | undefined = episodeNumber;
        const normalizedStatus = String(resolved.anime.status || item.status || '').toUpperCase();
        const knownLatestEpisode = Number(resolved.anime.latestEpisode || item.latestEpisode || 0);

        if (!targetEp) {
            targetEp = knownLatestEpisode > 0 && normalizedStatus !== 'FINISHED'
                ? knownLatestEpisode
                : normalizedStatus === 'RELEASING'
                    ? 'latest'
                    : 1;
        }

        const resume = Number.isFinite(startSeconds) ? Math.max(0, Math.floor(startSeconds || 0)) : 0;
        const url = `/anime/details/${id}?ep=${targetEp}${resume > 0 ? `&t=${resume}` : ''}`;
        navigate(url, { state: { anime: resolved.anime } });
    };

    const handleAnimeHover = (item: Anime) => {
        anime.prefetchEpisodes(item);
        if (!getAnimeDetailsRouteId(item)) {
            resolveRouteTarget(item).catch(() => undefined);
        }
    };

    useEffect(() => {
        anime.spotlightAnime.slice(0, 8).forEach((item) => {
            if (!getAnimeDetailsRouteId(item)) {
                resolveRouteTarget(item).catch(() => undefined);
            }
        });
    }, [anime.spotlightAnime, resolveRouteTarget]);

    // Scroll to top on mount
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [anime.currentPage]);

    // Replace full-page loading with AnimeDashboard showing skeletons
    if (anime.loading && anime.currentPage === 1 && anime.topAnime.length === 0 && anime.spotlightAnime.length === 0 && anime.latestUpdates.length === 0 && anime.trendingAnime.length === 0) {
        return (
            <div className={`min-h-screen pb-20 ${isCatalogFilterView ? 'pt-24' : ''}`}>
                <AnimeDashboard
                    spotlightAnime={[]}
                    spotlightLoading={true}
                    latestUpdates={[]}
                    latestUpdatesLoading={true}
                    trendingAnime={[]}
                    trendingLoading={true}
                    popularSeason={[]}
                    popularSeasonLoading={true}
                    topTenToday={[]}
                    topTenWeek={[]}
                    topTenMonth={[]}
                    topTenLoading={true}
                    topAnime={[]}
                    topAnimeLoading={true}
                    allTimeTitle={allTimeTitle}
                    compactCatalogMode={isCatalogFilterView}


                    onAnimeClick={handleAnimeClick}
                    onWatchClick={handleWatchClick}
                    onAnimeHover={handleAnimeHover}
                />
            </div>
        );
    }

    if (anime.error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center text-red-500">
                <p className="text-xl mb-4">{anime.error}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-red-500/10 border border-red-500 rounded hover:bg-red-500/20"
                >
                    Retry
                </button>
            </div>
        );
    }



    // Default Dashboard
    return (
        <div className={`min-h-screen pb-20 ${isCatalogFilterView ? 'pt-24' : ''}`}>
            <AnimeDashboard
                spotlightAnime={anime.spotlightAnime}
                spotlightLoading={anime.spotlightLoading}
                latestUpdates={anime.latestUpdates}
                latestUpdatesLoading={anime.latestUpdatesLoading}
                trendingAnime={anime.trendingAnime}
                trendingLoading={anime.trendingLoading}
                popularSeason={anime.popularSeason}
                popularSeasonLoading={anime.popularSeasonLoading}
                topTenToday={anime.topTenToday}
                topTenWeek={anime.topTenWeek}
                topTenMonth={anime.topTenMonth}
                topTenLoading={anime.topTenLoading}
                topAnime={filteredTopAnime}
                topAnimeLoading={anime.loading}
                allTimeTitle={allTimeTitle}
                compactCatalogMode={isCatalogFilterView}


                onAnimeClick={handleAnimeClick}
                onWatchClick={handleWatchClick}
                onAnimeHover={handleAnimeHover}
            />
        </div>
    );
}

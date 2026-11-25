import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import HomePage from '../pages/HomePage';
import MangaPage from '../pages/MangaPage';
import LNPage from '../pages/LNPage';
import AnimeDetailsPage from '../pages/AnimeDetailsPage';
import SpotlightSkeleton from '../features/anime/components/SpotlightSkeleton';
import ExploreSkeleton from '../features/explore/components/ExploreSkeleton';

const AnimeFormatPage = lazy(() => import('../pages/AnimeFormatPage'));
const AnimeStudioPage = lazy(() => import('../pages/AnimeStudioPage'));
const ContinueWatchingPage = lazy(() => import('../pages/ContinueWatchingPage'));
const FavoriteAnimePage = lazy(() => import('../pages/FavoriteAnimePage'));
const FavoriteMangaPage = lazy(() => import('../pages/FavoriteMangaPage'));
const GenrePage = lazy(() => import('../pages/GenrePage'));
const LibraryPage = lazy(() => import('../pages/LibraryPage'));
const LNDetailsPage = lazy(() => import('../pages/LNDetailsPage'));
const LNReaderPage = lazy(() => import('../pages/LNReaderPage'));
const MangaContinueReadingPage = lazy(() => import('../pages/MangaContinueReadingPage'));
const MangaDetailsPage = lazy(() => import('../pages/MangaDetailsPage'));
const MangaFormatPage = lazy(() => import('../pages/MangaFormatPage'));
const MangaGenrePage = lazy(() => import('../pages/MangaGenrePage'));
const MangaReaderPage = lazy(() => import('../pages/MangaReaderPage'));
const MangaReadListPage = lazy(() => import('../pages/MangaReadListPage'));
const ProfilePage = lazy(() => import('../pages/ProfilePage'));
const SearchPage = lazy(() => import('../pages/SearchPage'));
const SearchResultsPage = lazy(() => import('../pages/SearchResultsPage'));
const UserProfilePage = lazy(() => import('../pages/UserProfilePage'));
const UserSearchPage = lazy(() => import('../pages/UserSearchPage'));
const WatchListPage = lazy(() => import('../pages/WatchListPage'));
const ExplorePage = lazy(() => import('../pages/ExplorePage'));
const Top100Page = lazy(() => import('../pages/Top100Page'));
const AnimeBrowsePage = lazy(() => import('../pages/AnimeBrowsePage'));

function RouteFallback() {
    const location = useLocation();
    const pathname = location.pathname;

    if (pathname.includes('/details/')) {
        return (
            <div className="min-h-screen bg-[#070707] px-6 sm:px-10 md:px-14 lg:px-16 pt-24 sm:pt-32 md:pt-40 animate-pulse">
                <div className="mx-auto w-full max-w-[1440px]">
                    <div className="flex flex-col md:flex-row gap-8 items-start">
                        <div className="w-48 sm:w-56 md:w-64 aspect-[2/3] rounded-2xl bg-white/10 shrink-0" />
                        <div className="flex-1 space-y-4 w-full">
                            <div className="h-10 w-3/4 rounded-xl bg-white/10" />
                            <div className="h-6 w-1/3 rounded-lg bg-white/10" />
                            <div className="space-y-2 pt-4">
                                <div className="h-4 w-full rounded bg-white/10" />
                                <div className="h-4 w-5/6 rounded bg-white/10" />
                                <div className="h-4 w-2/3 rounded bg-white/10" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (pathname.startsWith('/explore')) {
        return <ExploreSkeleton />;
    }

    if (pathname.startsWith('/library')) {
        return (
            <div className="min-h-screen bg-[#070707] px-4 sm:px-8 md:px-14 pt-6 pb-24 animate-pulse">
                <div className="mx-auto w-full max-w-[1440px] space-y-6">
                    <div className="flex items-center justify-between gap-4">
                        <div className="h-8 w-36 rounded-lg bg-white/10" />
                        <div className="h-9 w-28 rounded-full bg-white/10" />
                    </div>
                    <div className="flex gap-2.5 overflow-hidden">
                        {[0, 1, 2, 3].map((pill) => (
                            <div key={pill} className="h-9 w-24 shrink-0 rounded-full bg-white/10" />
                        ))}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                        {Array.from({ length: 10 }).map((_, idx) => (
                            <div key={idx} className="space-y-2">
                                <div className="aspect-[2/3] w-full rounded-xl bg-white/10" />
                                <div className="h-4 w-4/5 rounded bg-white/10" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    const variant = pathname.startsWith('/manga') ? 'manga' : pathname.startsWith('/ln') ? 'ln' : 'anime';

    return (
        <div className="relative min-h-screen bg-[#070707] pb-20">
            <SpotlightSkeleton variant={variant} />
        </div>
    );
}

export function AppRoutes() {
    const location = useLocation();

    return (
        <main className="relative z-10">
            <Suspense fallback={<RouteFallback />}>
                <Routes location={location}>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/anime/popular" element={<AnimeFormatPage />} />
                    <Route path="/anime/browse" element={<AnimeBrowsePage />} />
                    <Route path="/anime/top-100" element={<Top100Page mediaType="anime" />} />
                    <Route path="/anime/movies" element={<AnimeFormatPage />} />
                    <Route path="/anime/tv" element={<AnimeFormatPage />} />
                    <Route path="/anime/ova" element={<AnimeFormatPage />} />
                    <Route path="/anime/ona" element={<AnimeFormatPage />} />
                    <Route path="/anime/specials" element={<AnimeFormatPage />} />
                    <Route path="/anime/details/:id" element={<AnimeDetailsPage />} />
                    <Route path="/anime/studio/:name" element={<AnimeStudioPage />} />


                    <Route path="/manga" element={<MangaPage />} />
                    <Route path="/manga/top-100" element={<Top100Page mediaType="manga" />} />
                    <Route path="/manga/details/:id" element={<MangaDetailsPage />} />
                    <Route path="/manga/read/:title/:id/:chapter" element={<MangaReaderPage />} />

                    <Route path="/ln" element={<LNPage />} />
                    <Route path="/ln/top-100" element={<Top100Page mediaType="ln" />} />
                    <Route path="/ln/details/:id" element={<LNDetailsPage />} />
                    <Route path="/ln/read/:title/:id/:chapter" element={<LNReaderPage />} />
                    <Route path="/genre/:name" element={<GenrePage />} />
                    <Route path="/manga/genre/:name" element={<MangaGenrePage />} />
                    <Route path="/manga/popular" element={<MangaFormatPage />} />
                    <Route path="/manga/latest" element={<MangaFormatPage />} />
                    <Route path="/manga/directory" element={<MangaFormatPage />} />
                    <Route path="/manga/new" element={<MangaFormatPage />} />
                    <Route path="/manga/manhwa" element={<MangaFormatPage />} />
                    <Route path="/manga/one-shot" element={<MangaFormatPage />} />
                    <Route path="/manga/specials" element={<MangaFormatPage />} />

                    <Route path="/library" element={<LibraryPage />} />
                    <Route path="/explore" element={<ExplorePage />} />
                    <Route path="/search" element={<SearchPage />} />
                    <Route path="/search/:type" element={<SearchResultsPage />} />

                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/users" element={<UserSearchPage />} />
                    <Route path="/user/:uid" element={<UserProfilePage />} />
                    <Route path="/anime/continue-watching" element={<ContinueWatchingPage />} />
                    <Route path="/anime/watch-list" element={<WatchListPage />} />
                    <Route path="/anime/favorites" element={<FavoriteAnimePage />} />
                    <Route path="/manga/continue-reading" element={<MangaContinueReadingPage />} />
                    <Route path="/manga/read-list" element={<MangaReadListPage />} />
                    <Route path="/manga/favorites" element={<FavoriteMangaPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </Suspense>
        </main>
    );
}

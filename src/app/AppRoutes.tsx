import { AnimatePresence, m } from 'framer-motion';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import HomePage from '../pages/HomePage';
import { pageTransitionVariants } from '../utils/motion';

const AnimeDetailsPage = lazy(() => import('../pages/AnimeDetailsPage'));
const AnimeFormatPage = lazy(() => import('../pages/AnimeFormatPage'));
const ContinueWatchingPage = lazy(() => import('../pages/ContinueWatchingPage'));
const FavoriteAnimePage = lazy(() => import('../pages/FavoriteAnimePage'));
const FavoriteMangaPage = lazy(() => import('../pages/FavoriteMangaPage'));
const GenrePage = lazy(() => import('../pages/GenrePage'));
const LibraryPage = lazy(() => import('../pages/LibraryPage'));
const LNDetailsPage = lazy(() => import('../pages/LNDetailsPage'));
const LNPage = lazy(() => import('../pages/LNPage'));
const LNReaderPage = lazy(() => import('../pages/LNReaderPage'));
const MangaContinueReadingPage = lazy(() => import('../pages/MangaContinueReadingPage'));
const MangaDetailsPage = lazy(() => import('../pages/MangaDetailsPage'));
const MangaFormatPage = lazy(() => import('../pages/MangaFormatPage'));
const MangaGenrePage = lazy(() => import('../pages/MangaGenrePage'));
const MangaPage = lazy(() => import('../pages/MangaPage'));
const MangaReaderPage = lazy(() => import('../pages/MangaReaderPage'));
const MangaReadListPage = lazy(() => import('../pages/MangaReadListPage'));
const ProfilePage = lazy(() => import('../pages/ProfilePage'));
const SearchPage = lazy(() => import('../pages/SearchPage'));
const SearchResultsPage = lazy(() => import('../pages/SearchResultsPage'));
const UserProfilePage = lazy(() => import('../pages/UserProfilePage'));
const UserSearchPage = lazy(() => import('../pages/UserSearchPage'));
const WatchListPage = lazy(() => import('../pages/WatchListPage'));
const YumiPage = lazy(() => import('../pages/YumiPage'));

function RouteFallback() {
    return (
        <div
            className="flex min-h-[50vh] items-center justify-center text-sm text-white/60"
            role="status"
            aria-live="polite"
        >
            Loading…
        </div>
    );
}

const getTransitionKey = (pathname: string) => {
    if (pathname.startsWith('/anime/details/')) {
        return '/anime/details';
    }
    if (pathname.startsWith('/manga/details/')) {
        return '/manga/details';
    }
    if (pathname.startsWith('/ln/details/')) {
        return '/ln/details';
    }
    return pathname;
};

export function AppRoutes() {
    const location = useLocation();

    return (
        <AnimatePresence mode="wait">
            <m.main
                key={getTransitionKey(location.pathname)}
                variants={pageTransitionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="relative z-10"
            >
                <Suspense fallback={<RouteFallback />}>
                <Routes location={location}>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/anime/popular" element={<AnimeFormatPage />} />
                    <Route path="/anime/movies" element={<AnimeFormatPage />} />
                    <Route path="/anime/tv" element={<AnimeFormatPage />} />
                    <Route path="/anime/ova" element={<AnimeFormatPage />} />
                    <Route path="/anime/ona" element={<AnimeFormatPage />} />
                    <Route path="/anime/specials" element={<AnimeFormatPage />} />
                    <Route path="/anime/details/:id" element={<AnimeDetailsPage />} />


                    <Route path="/manga" element={<MangaPage />} />
                    <Route path="/manga/details/:id" element={<MangaDetailsPage />} />
                    <Route path="/manga/read/:title/:id/:chapter" element={<MangaReaderPage />} />

                    <Route path="/ln" element={<LNPage />} />
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
                    <Route path="/search" element={<SearchPage />} />
                    <Route path="/search/:type" element={<SearchResultsPage />} />

                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/users" element={<UserSearchPage />} />
                    <Route path="/yumi" element={<YumiPage />} />
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
            </m.main>
        </AnimatePresence>
    );
}

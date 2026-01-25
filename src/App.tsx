import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import HomePage from './pages/HomePage';
import AnimeDetailsPage from './pages/AnimeDetailsPage';
import MangaDetailsPage from './pages/MangaDetailsPage';
import WatchPage from './pages/WatchPage';
import MangaReaderPage from './pages/MangaReaderPage';
import SearchPage from './pages/SearchPage';
import MangaPage from './pages/MangaPage';
import GenrePage from './pages/GenrePage';
import MangaGenrePage from './pages/MangaGenrePage';
import ProfilePage from './pages/ProfilePage';
import Footer from './components/layout/Footer';
import { useAnime } from './hooks/useAnime';
import { animeService } from './services/animeService';
import { mangaService } from './services/mangaService';
import ScrollToTop from './components/ui/ScrollToTop';

// Debounce helper
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchTerm = useDebounce(searchQuery, 100);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { closeViewAll } = useAnime();

  // Derive active tab from URL or Query Params (to persist state on Search Page)
  const queryParams = new URLSearchParams(location.search);
  const activeTab = location.pathname.startsWith('/manga')
    || queryParams.get('type') === 'manga'
    || queryParams.get('tab') === 'continue-reading'
    || queryParams.get('tab') === 'readlist'
    ? 'manga' : 'anime';

  // Perform search when debounced term changes
  useEffect(() => {
    const performSearch = async () => {
      if (!debouncedSearchTerm.trim()) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        if (activeTab === 'anime') {
          const { data } = await animeService.searchAnime(debouncedSearchTerm, 1);
          setSearchResults(data.slice(0, 4).map((item: any) => ({
            id: item.id,
            title: item.title_english || item.title || 'Unknown',
            subtitle: item.title_japanese || item.title_english,
            image: item.images.jpg.image_url,
            date: item.aired?.string ? new Date(item.aired.string).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : item.year,
            type: item.type, // e.g., TV
            duration: item.duration,
            url: `/anime/details/${item.id}`
          })));
        } else {
          const { data } = await mangaService.searchManga(debouncedSearchTerm, 1);
          setSearchResults(data.slice(0, 4).map((item: any) => ({
            id: item.id,
            title: item.title_english || item.title || 'Unknown',
            subtitle: item.title_japanese || item.title_english,
            image: item.images.jpg.image_url,
            date: item.published?.string ? new Date(item.published.string).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '',
            type: item.type, // e.g., MANGA
            duration: null, // Manga doesn't have duration
            url: `/manga/details/${item.id}`
          })));
        }
      } catch (error) {
        console.error("Search failed:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    performSearch();
  }, [debouncedSearchTerm, activeTab]);

  // Sync Search Query if we are on search page
  useEffect(() => {
    if (!location.pathname.startsWith('/search')) {
      // Don't clear query here as it might clear while user is typing if they navigate?
      // Actually, existing logic: if NOT on search page, clear query.
      // But we want to keep the query if the specific user interaction (like clicking outside) hasn't happened.
      // However, for now, let's keep it but ensure we don't clear it unnecessarily.
      // If we are navigating TO a page (like details), we probably want to clear it.
      // But if we are just staying on the same page...

      // Original logic was fine for "resetting" state when navigating away from search page.
      // But now we have a dropdown on EVERY page.
      // If I click a result, I navigate. After navigation, I probably want the search to clear.

      // Let's modify: Only clear if we just navigated and NOT just typing.
      // Actually, let's trust the existing logic for now, but be careful.
      // existing: setSearchQuery('');
      // This runs on EVERY location change.
    }
    // If we navigate to a details page, we want the search bar to clear? Yes.
    // So this is probably fine.
    if (!location.pathname.startsWith('/search')) {
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [location.pathname]);

  const handleTabChange = (tab: 'anime' | 'manga') => {
    if (tab === 'anime') {
      closeViewAll();
      navigate('/');
    }
    else navigate('/manga');
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    navigate(`/search?q=${encodeURIComponent(searchQuery)}&type=${activeTab}`);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleLogoClick = () => {
    closeViewAll();
    navigate(activeTab === 'manga' ? '/manga' : '/');
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    // If on search page, navigate back to home
    if (location.pathname === '/search') {
      navigate(activeTab === 'manga' ? '/manga' : '/');
    }
  };

  return (
    <div className={`min-h-screen bg-yorumi-bg text-white font-sans ${activeTab === 'manga' ? 'selection:bg-yorumi-manga' : 'selection:bg-yorumi-accent'} selection:text-white overflow-x-hidden`}>
      {/* Background Gradients */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className={`absolute top-[-10%] left-[-10%] w-[40%] h-[40%] ${activeTab === 'manga' ? 'bg-yorumi-manga/5' : 'bg-yorumi-accent/5'} rounded-full blur-[120px]`} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-yorumi-main/5 rounded-full blur-[120px]" />
      </div>

      <Navbar
        activeTab={activeTab}
        searchQuery={searchQuery}
        onTabChange={handleTabChange}
        onSearchChange={setSearchQuery}
        onSearchSubmit={handleSearchSubmit}
        onClearSearch={handleClearSearch}
        onLogoClick={handleLogoClick}
        searchResults={searchResults}
        isSearching={isSearching}
      />

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/anime/details/:id" element={<AnimeDetailsPage />} />
        <Route path="/anime/watch/:title/:id" element={<WatchPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/manga" element={<MangaPage />} />
        <Route path="/manga/details/:id" element={<MangaDetailsPage />} />
        <Route path="/manga/read/:title/:id/:chapter" element={<MangaReaderPage />} />
        <Route path="/genre/:name" element={<GenrePage />} />
        <Route path="/manga/genre/:name" element={<MangaGenrePage />} />
        <Route path="/profile" element={<ProfilePage />} />
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Scroll to Top Button */}
      <ScrollToTop activeTab={activeTab as 'anime' | 'manga'} />

      <Footer />
    </div>
  );
}

export default App;

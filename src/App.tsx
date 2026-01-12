import { useState, useEffect, useRef } from 'react';
import './App.css';

// Hooks
import { useAnime } from './hooks/useAnime';
import { useManga } from './hooks/useManga';
import { useStreams } from './hooks/useStreams';
import { useSearch } from './hooks/useSearch';

// Components
import Navbar from './components/Navbar';
import Pagination from './components/Pagination';
import LoadingSpinner from './components/LoadingSpinner';
import AnimeCard from './components/AnimeCard';
import MangaCard from './components/MangaCard';
import AnimeDetailsModal from './components/modals/AnimeDetailsModal';
import WatchModal from './components/modals/WatchModal';
import MangaReaderModal from './components/modals/MangaReaderModal';
import MangaDetailsModal from './components/modals/MangaDetailsModal';

import SpotlightHero from './components/SpotlightHero';
import TrendingNow from './components/TrendingNow';
import PopularSeason from './components/PopularSeason';

// Utils
import { scrollUtils } from './utils/scrollUtils';

function App() {
  const [activeTab, setActiveTab] = useState<'anime' | 'manga'>('anime');
  // No need for separate viewMode state here, handled in useAnime

  // Custom hooks for all logic
  const anime = useAnime();
  const manga = useManga();
  const streams = useStreams(anime.scraperSession);
  const search = useSearch(activeTab);

  // Lock body scroll when modals are open
  useEffect(() => {
    const isModalOpen = anime.showAnimeDetails || anime.showWatchModal ||
      manga.showMangaDetails || (!!manga.selectedManga && !manga.showMangaDetails);
    scrollUtils.toggleScroll(isModalOpen);
    return () => scrollUtils.unlockScroll();
  }, [anime.showAnimeDetails, anime.showWatchModal, manga.showMangaDetails, manga.selectedManga]);

  // Infinite Scroll Observer for Search
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!search.isSearching) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && search.searchPagination.has_next_page && !search.searchLoading) {
        search.loadMore();
      }
    }, { threshold: 0.1, rootMargin: '100px' });

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => observer.disconnect();
  }, [search.isSearching, search.searchPagination.has_next_page, search.searchLoading, search.loadMore]);

  // Clear search when switching tabs
  const handleTabChange = (tab: 'anime' | 'manga') => {
    search.clearSearch();
    setActiveTab(tab);
    if (tab === 'manga') {
      // If switching to manga, we might want to reset anime view, but keep history? 
      // For now let's just leave it or strictly close it if transparent navigation is desired.
      // The user prompt didn't strictly specify cross-tab history behavior.
      // But existing code had setViewMode('default').
      anime.closeViewAll();
    }
  };

  // Determine what content to display
  const displayAnime = search.isSearching ? (search.searchResults as typeof anime.topAnime) : anime.topAnime;
  const displayManga = search.isSearching ? (search.searchResults as typeof manga.topManga) : manga.topManga;
  const isLoading = activeTab === 'anime' ? anime.loading && !search.isSearching : manga.mangaLoading && !search.isSearching;

  const showHero = activeTab === 'anime' && !isLoading && !search.isSearching && anime.currentPage === 1 && anime.spotlightAnime && anime.spotlightAnime.length > 0 && anime.viewMode === 'default';

  // Handle Logo Click - Reset to Home
  const handleLogoClick = () => {
    search.clearSearch();
    setActiveTab('anime');
    anime.closeViewAll();
    anime.changePage(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Navigation */}
      <Navbar
        activeTab={activeTab}
        searchQuery={search.searchQuery}
        onTabChange={handleTabChange}
        onSearchChange={search.setSearchQuery}
        onSearchSubmit={search.handleSearch}
        onClearSearch={search.clearSearch}
        onLogoClick={handleLogoClick}
      />

      {/* Hero Section (Spotlight Carousel) - Full Width - Only on Page 1 */}
      {showHero && (
        <SpotlightHero
          animeList={anime.spotlightAnime}
          onAnimeClick={anime.handleAnimeClick}
        />
      )}

      {/* Main Content */}
      <main className={`container mx-auto px-4 z-10 relative pb-20 ${showHero ? '' : 'pt-24'}`}>
        {/* Loading State */}
        {isLoading && activeTab === 'manga' ? ( // Adjusted isLoading check
          <LoadingSpinner size="lg" text={`Loading ${activeTab}...`} />
        ) : null}

        {activeTab === 'anime' && (
          <>
            {isLoading && !search.isSearching ? (
              <LoadingSpinner size="lg" text={`Loading ${activeTab}...`} />
            ) : search.isSearching ? (
              /* Search Results - Grid View */
              <>
                <h2 className="text-xl font-bold mb-6">Search Results for "{search.searchQuery}"</h2>
                {displayAnime.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                    {displayAnime.map((item) => (
                      <AnimeCard
                        key={item.mal_id}
                        anime={item}
                        onClick={() => anime.handleAnimeClick(item)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-400 py-12">
                    No anime found matching "{search.searchQuery}"
                  </div>
                )}
                {/* Search Pagination */}
                {search.searchResults.length > 0 && search.searchPagination.has_next_page && (
                  <div ref={sentinelRef} className="h-24 flex justify-center items-center w-full">
                    {search.searchLoading && <LoadingSpinner size="md" />}
                  </div>
                )}
              </>
            ) : anime.viewMode === 'trending' ? (
              <>
                <div className="flex items-center gap-2 mb-6">
                  <button
                    onClick={anime.closeViewAll}
                    className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <h2 className="text-xl font-bold border-l-4 border-yorumi-accent pl-3 text-white">Trending Now</h2>
                </div>
                {anime.viewAllLoading ? (
                  <LoadingSpinner size="lg" text="Loading Trending..." />
                ) : (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 mb-8">
                      {anime.viewAllAnime.map((item) => (
                        <AnimeCard
                          key={item.mal_id}
                          anime={item}
                          onClick={() => anime.handleAnimeClick(item)}
                        />
                      ))}
                    </div>
                    <Pagination
                      currentPage={anime.viewAllPagination.current_page}
                      lastPage={anime.viewAllPagination.last_visible_page}
                      onPageChange={anime.changeViewAllPage}
                    />
                  </>
                )}
              </>
            ) : anime.viewMode === 'seasonal' ? (
              <>
                <div className="flex items-center gap-2 mb-6">
                  <button
                    onClick={anime.closeViewAll}
                    className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <h2 className="text-xl font-bold border-l-4 border-yorumi-accent pl-3 text-white">Popular This Season</h2>
                </div>
                {anime.viewAllLoading ? (
                  <LoadingSpinner size="lg" text="Loading Popular..." />
                ) : (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 mb-8">
                      {anime.viewAllAnime.map((item) => (
                        <AnimeCard
                          key={item.mal_id}
                          anime={item}
                          onClick={() => anime.handleAnimeClick(item)}
                        />
                      ))}
                    </div>
                    <Pagination
                      currentPage={anime.viewAllPagination.current_page}
                      lastPage={anime.viewAllPagination.last_visible_page}
                      onPageChange={anime.changeViewAllPage}
                    />
                  </>
                )}

              </>
            ) : (
              // Default View
              <>
                {/* Trending & Popular - Only on Page 1 */}
                {anime.currentPage === 1 && (
                  <>
                    {/* Trending Now Section */}
                    <TrendingNow
                      animeList={anime.trendingAnime}
                      onAnimeClick={anime.handleAnimeClick}
                      onViewAll={() => anime.openViewAll('trending')}
                    />

                    {/* Popular This Season Section */}
                    <PopularSeason
                      animeList={anime.popularSeason}
                      onAnimeClick={anime.handleAnimeClick}
                      onViewAll={() => anime.openViewAll('seasonal')}
                    />
                  </>
                )}

                {/* Main Content Grid (Top Anime) */}
                <h2 className="text-xl font-bold mb-6 border-l-4 border-yorumi-accent pl-3 text-white">All-Time Popular</h2>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 mb-8">
                  {displayAnime.map((item) => (
                    <AnimeCard
                      key={item.mal_id}
                      anime={item}
                      onClick={() => anime.handleAnimeClick(item)}
                    />
                  ))}
                </div>

                <Pagination
                  currentPage={anime.currentPage}
                  lastPage={anime.lastVisiblePage}
                  onPageChange={(page) => {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    anime.changePage(page);
                  }}
                  isLoading={anime.loading}
                />
              </>
            )}
          </>
        )}

        {/* Manga Tab */}
        {activeTab === 'manga' && !isLoading && (
          <>
            {search.isSearching && <h2 className="text-xl font-bold mb-6">Search Results for "{search.searchQuery}"</h2>}

            {displayManga.length > 0 ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                  {displayManga.map((item) => (
                    <MangaCard
                      key={item.mal_id}
                      manga={item}
                      onClick={() => manga.handleMangaClick(item)}
                    />
                  ))}
                </div>

                {!search.isSearching && (
                  <Pagination
                    currentPage={manga.mangaPage}
                    lastPage={manga.mangaLastPage}
                    onPageChange={manga.changeMangaPage}
                    isLoading={manga.mangaLoading}
                  />
                )}
              </>
            ) : (
              <div className="text-center text-gray-400 py-12">
                No manga found {search.isSearching && `matching "${search.searchQuery}"`}
              </div>
            )}
            {/* Manga Infinite Scroll Sentinel */}
            {search.isSearching && search.searchResults.length > 0 && search.searchPagination.has_next_page && (
              <div ref={sentinelRef} className="h-24 flex justify-center items-center w-full">
                {search.searchLoading && <LoadingSpinner size="md" />}
              </div>
            )}
          </>
        )}

        {/* Error State */}
        {anime.error && <div className="text-center text-red-400 py-12">{anime.error}</div>}
      </main>

      {/* Modals */}
      <AnimeDetailsModal
        isOpen={anime.showAnimeDetails && !!anime.selectedAnime}
        anime={anime.selectedAnime!}
        episodes={anime.episodes}
        epLoading={anime.epLoading}
        onClose={anime.closeDetails}
        onWatchNow={anime.startWatching}
      />

      {/* Manga Details Modal */}
      <MangaDetailsModal
        isOpen={manga.showMangaDetails && !!manga.selectedManga}
        manga={manga.selectedManga!}
        onClose={manga.closeMangaReader}
        onReadNow={manga.startReading}
      />

      <WatchModal
        isOpen={anime.showWatchModal && !!anime.selectedAnime}
        anime={anime.selectedAnime!}
        episodes={anime.episodes}
        currentEpisode={streams.currentEpisode}
        episodeSearchQuery={anime.episodeSearchQuery}
        epLoading={anime.epLoading}
        streams={streams.streams}
        selectedStreamIndex={streams.selectedStreamIndex}
        isAutoQuality={streams.isAutoQuality}
        showQualityMenu={streams.showQualityMenu}
        currentStream={streams.currentStream}
        streamLoading={streams.streamLoading}
        playerMode={streams.playerMode}
        videoRef={streams.videoRef}
        onClose={anime.closeWatch}
        onEpisodeSearchChange={anime.setEpisodeSearchQuery}
        onLoadStream={streams.loadStream}
        onPrefetchStream={streams.prefetchStream}
        onQualityMenuToggle={() => streams.setShowQualityMenu(!streams.showQualityMenu)}
        onQualityChange={streams.handleQualityChange}
        onSetAutoQuality={streams.setAutoQuality}
        onPlayerModeChange={streams.setPlayerMode}
        getMappedQuality={streams.getMappedQuality}
      />
      {/* Manga Reader Modal */}
      {
        manga.selectedManga && !manga.showMangaDetails && (
          <MangaReaderModal
            isOpen={!!manga.selectedManga}
            manga={manga.selectedManga}
            chapters={manga.mangaChapters}
            currentChapter={manga.currentMangaChapter}
            pages={manga.chapterPages}
            chapterSearchQuery={manga.chapterSearchQuery}
            chaptersLoading={manga.mangaChaptersLoading}
            pagesLoading={manga.mangaPagesLoading}
            zoomLevel={manga.zoomLevel}
            onClose={manga.closeMangaReader}
            onChapterSearchChange={manga.setChapterSearchQuery}
            onLoadChapter={manga.loadMangaChapter}
            onPrefetchChapter={manga.prefetchChapter}
            onZoomIn={manga.zoomIn}
            onZoomOut={manga.zoomOut}
          />
        )
      }
    </div >
  );
}

export default App;

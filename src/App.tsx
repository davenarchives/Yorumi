import { useState, useEffect } from 'react';
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

// Utils
import { scrollUtils } from './utils/scrollUtils';

function App() {
  const [activeTab, setActiveTab] = useState<'anime' | 'manga'>('anime');

  // Custom hooks for all logic
  const anime = useAnime();
  const manga = useManga();
  const streams = useStreams(anime.scraperSession);
  const search = useSearch(activeTab);

  // Lock body scroll when modals are open
  useEffect(() => {
    scrollUtils.toggleScroll(!!anime.selectedAnime || !!manga.selectedManga);
    return () => scrollUtils.unlockScroll();
  }, [anime.selectedAnime, manga.selectedManga]);

  // Clear search when switching tabs
  const handleTabChange = (tab: 'anime' | 'manga') => {
    search.clearSearch();
    setActiveTab(tab);
  };

  // Determine what content to display
  const displayAnime = search.isSearching ? (search.searchResults as typeof anime.topAnime) : anime.topAnime;
  const displayManga = search.isSearching ? (search.searchResults as typeof manga.topManga) : manga.topManga;
  const isLoading = activeTab === 'anime' ? anime.loading && !search.isSearching : manga.mangaLoading && !search.isSearching;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Navigation */}
      <Navbar
        activeTab={activeTab}
        searchQuery={search.searchQuery}
        isSearching={search.isSearching}
        onTabChange={handleTabChange}
        onSearchChange={search.setSearchQuery}
        onSearchSubmit={search.handleSearch}
        onClearSearch={search.clearSearch}
      />

      {/* Main Content */}
      <main className="container mx-auto px-8 py-8">
        {/* Loading State */}
        {isLoading ? (
          <LoadingSpinner size="lg" text={`Loading ${activeTab}...`} />
        ) : null}

        {/* Anime Tab */}
        {activeTab === 'anime' && !isLoading && (
          <>
            {search.isSearching && <h2 className="text-xl font-bold mb-6">Search Results for "{search.searchQuery}"</h2>}

            {displayAnime.length > 0 ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                  {displayAnime.map((item) => (
                    <AnimeCard
                      key={item.mal_id}
                      anime={item}
                      onClick={() => anime.handleAnimeClick(item)}
                    />
                  ))}
                </div>

                {!search.isSearching && (
                  <Pagination
                    currentPage={anime.currentPage}
                    lastPage={anime.lastVisiblePage}
                    onPageChange={anime.changePage}
                    isLoading={anime.loading}
                  />
                )}
              </>
            ) : (
              <div className="text-center text-gray-400 py-12">
                No anime found {search.isSearching && `matching "${search.searchQuery}"`}
              </div>
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
          </>
        )}

        {/* Error State */}
        {anime.error && <div className="text-center text-red-400 py-12">{anime.error}</div>}
      </main>

      {/* Modals */}
      <AnimeDetailsModal
        isOpen={anime.showAnimeDetails && !!anime.selectedAnime}
        anime={anime.selectedAnime!}
        onClose={anime.closeDetails}
        onWatchNow={anime.startWatching}
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
      {manga.selectedManga && (
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
      )}
    </div>
  );
}

export default App;

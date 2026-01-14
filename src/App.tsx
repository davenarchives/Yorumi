import { useEffect, useRef, useState } from 'react';
import AnimeCard from './components/AnimeCard';
import MangaCard from './components/MangaCard';
import Navbar from './components/Navbar';
import Pagination from './components/Pagination';
import LoadingSpinner from './components/LoadingSpinner';
import AnimeDetailsModal from './components/modals/AnimeDetailsModal';
import MangaDetailsModal from './components/modals/MangaDetailsModal';
import MangaReaderModal from './components/modals/MangaReaderModal';
import WatchModal from './components/modals/WatchModal';
import TrendingNow from './components/TrendingNow';
import PopularSeason from './components/PopularSeason';
import Carousel from './components/Carousel';
import SpotlightHero from './components/SpotlightHero';
import { useAnime } from './hooks/useAnime';
import { useManga } from './hooks/useManga';
import { useStreams } from './hooks/useStreams';
import { useSearch } from './hooks/useSearch';
import { ArrowLeft } from 'lucide-react';
import type { Anime } from './types/anime';
import type { Manga } from './types/manga';

function App() {
  const [activeTab, setActiveTab] = useState<'anime' | 'manga'>('anime');

  const {
    searchQuery,
    isSearching,
    searchResults,
    searchLoading,
    searchPagination,
    setSearchQuery: handleSearchChange, // Renamed for consistency with Navbar prop
    handleSearch: handleSearchSubmit,   // Renamed for consistency with Navbar prop
    clearSearch,
    loadMore: loadMoreSearch,
  } = useSearch(activeTab); // Pass activeTab to useSearch

  const anime = useAnime();
  const manga = useManga();
  const streams = useStreams(anime.scraperSession); // Pass scraperSession

  // No need for separate useEffect to sync search results, use them directly

  const isLoading = activeTab === 'anime' ? anime.loading : manga.mangaLoading;

  // Use searchResults when searching, otherwise use top lists
  const displayAnime = isSearching ? (searchResults as Anime[]) : anime.topAnime;
  const displayManga = isSearching ? (searchResults as Manga[]) : manga.topManga;

  const handleAnimeSelection = (selected: Anime) => {
    anime.handleAnimeClick(selected);
  };

  const handleWatchDirectly = (selected: Anime) => {
    // For direct watch, we might need to handle it in useAnime to set everything up
    // But useAnime.watchAnime handles it
    anime.watchAnime(selected);
  };

  const handleEpisodeClick = (episode: any) => {
    if (anime.selectedAnime) {
      anime.saveProgress(anime.selectedAnime, episode);
    }
    streams.loadStream(episode);
  };

  // Debounced Prefetch on Hover
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleAnimeHover = (item: Anime) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);

    hoverTimeoutRef.current = setTimeout(() => {
      anime.prefetchEpisodes(item);
    }, 300); // 300ms delay to prevent spam
  };

  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        if (isSearching) {
          loadMoreSearch();
        }
      }
    });

    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [isSearching, loadMoreSearch]);

  // Auto-load stream when Watch Modal opens
  useEffect(() => {
    if (anime.showWatchModal && anime.selectedAnime && !streams.currentStream && !streams.streamLoading && anime.episodes.length > 0) {
      // Find the first episode or continue watching episode
      // For now, default to first episode
      // TODO: Use Continue Watching logic here if available
      const firstEp = anime.episodes[0];
      // Check if we have a continued episode
      const continued = anime.continueWatchingList.find(c => c.mal_id === anime.selectedAnime?.mal_id);

      let targetEp = firstEp;
      if (continued) {
        const found = anime.episodes.find(e => e.episodeNumber === continued.episodeNumber.toString());
        if (found) targetEp = found;
      }

      if (targetEp) {
        anime.saveProgress(anime.selectedAnime, targetEp);
        streams.loadStream(targetEp);
      }
    }
  }, [anime.showWatchModal, anime.selectedAnime, streams.currentStream, streams.streamLoading, anime.episodes, streams, anime]);

  const handleLogoClick = () => {
    clearSearch();
    setActiveTab('anime');
    anime.closeAllModals();
    manga.closeAllModals();
    anime.changePage(1); // Reset to first page
    manga.changeMangaPage(1); // Reset to first page
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTabChange = (tab: 'anime' | 'manga') => {
    setActiveTab(tab);
    anime.closeAllModals();
    manga.closeAllModals();
    clearSearch();
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-yorumi-accent selection:text-white overflow-x-hidden">
      {/* Background Gradients */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-yorumi-accent/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[120px]" />
      </div>

      <Navbar
        activeTab={activeTab}
        searchQuery={searchQuery}
        onTabChange={handleTabChange}
        onSearchChange={handleSearchChange}
        onSearchSubmit={handleSearchSubmit}
        onClearSearch={clearSearch}
        onLogoClick={handleLogoClick}
      />

      {/* Error Banner */}
      {anime.error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-3 rounded mx-4 mt-24 text-center">
          <p>{anime.error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm underline mt-1 hover:text-red-400"
          >
            Refresh Page
          </button>
        </div>
      )}

      {/* Spotlight Hero - Full Width */}
      {activeTab === 'anime' && !isSearching && anime.viewMode === 'default' && anime.currentPage === 1 && (
        <SpotlightHero
          animeList={anime.trendingAnime.slice(0, 8)}
          onAnimeClick={handleAnimeSelection}
          onWatchClick={handleWatchDirectly}
        />
      )}

      {/* Main Content */}
      <main className={`container mx-auto px-4 z-10 relative pb-20 ${
        /* Add top padding if Spotlight is NOT visible */
        !(activeTab === 'anime' && !isSearching && anime.viewMode === 'default' && anime.currentPage === 1)
          ? 'pt-24'
          : 'mt-8' /* Add spacing between hero and content */
        }`}>

        {/* Loading State for Tab Switch */}
        {isLoading && activeTab === 'manga' && !isSearching && displayManga.length === 0 ? (
          <LoadingSpinner size="lg" text={`Loading ${activeTab}...`} />
        ) : null}

        {activeTab === 'anime' && (
          <>
            {isLoading && !isSearching ? (
              <div className="flex items-center justify-center min-h-[60vh]">
                <LoadingSpinner size="lg" text={`Loading ${activeTab}...`} />
              </div>
            ) : isSearching ? (
              /* Search Results - Grid View */
              <>
                <h2 className="text-xl font-bold mb-6 pt-24">Search Results for "{searchQuery}"</h2>
                {displayAnime.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                    {displayAnime.map((item) => (
                      <AnimeCard
                        key={item.mal_id}
                        anime={item}
                        onClick={() => handleAnimeSelection(item)}
                        onWatchClick={() => handleWatchDirectly(item)}
                        onMouseEnter={() => handleAnimeHover(item)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-400 py-12 pt-24">
                    No anime found matching "{searchQuery}"
                  </div>
                )}
                {/* Search Pagination */}
                {searchResults.length > 0 && searchPagination.has_next_page && (
                  <div ref={sentinelRef} className="h-24 flex justify-center items-center w-full">
                    {searchLoading && <LoadingSpinner size="md" />}
                  </div>
                )}
              </>
            ) : anime.viewMode === 'continue_watching' ? (
              /* Continue Watching View All */
              <div className="pt-24 pb-12 px-8 min-h-screen">
                <div className="flex items-center gap-4 mb-8">
                  <button
                    onClick={anime.closeViewAll}
                    className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5 text-white" />
                  </button>
                  <h2 className="text-2xl font-black text-white tracking-wide uppercase">Continue Watching</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                  {anime.continueWatchingList.map((item) => (
                    <div
                      key={item.mal_id}
                      className="relative group cursor-pointer"
                      onClick={() => {
                        anime.handleAnimeClick({ mal_id: item.mal_id } as any).then(() => {
                          const dummyEp = {
                            session: item.episodeId,
                            episodeNumber: item.episodeNumber.toString(),
                            title: item.episodeTitle
                          };
                          anime.startWatching();
                          streams.loadStream(dummyEp);
                        });
                      }}
                    >
                      {/* Landscape Card Container */}
                      <div className="relative aspect-video rounded-lg overflow-hidden mb-3 shadow-lg border border-white/5 transition-colors">
                        <img
                          src={item.image}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform shadow-xl">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white ml-1">
                              <path fillRule="evenodd" d="M4.5 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                        <div className="absolute bottom-0 inset-x-0 h-1 bg-white/20">
                          <div className="h-full bg-yorumi-accent w-1/3" />
                        </div>
                        <div className="absolute top-2 left-2 bg-black/60 backdrop-blur text-white text-[10px] font-bold px-1.5 py-0.5 rounded border border-white/10">
                          EP {item.episodeNumber}
                        </div>
                      </div>
                      <div className="px-1">
                        <h4 className="text-sm font-bold text-gray-200 truncate group-hover:text-yorumi-accent transition-colors">
                          {item.title}
                        </h4>
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {item.episodeTitle || `Episode ${item.episodeNumber}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : anime.viewMode === 'trending' ? (
              <div className="pt-24">
                <div className="flex items-center gap-2 mb-6">
                  <button
                    onClick={anime.closeViewAll}
                    className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5 text-white" />
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
                          onClick={() => handleAnimeSelection(item)}
                          onMouseEnter={() => handleAnimeHover(item)}
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
              </div>
            ) : anime.viewMode === 'seasonal' ? (
              <div className="pt-24">
                <div className="flex items-center gap-2 mb-6">
                  <button
                    onClick={anime.closeViewAll}
                    className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5 text-white" />
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
                          onClick={() => handleAnimeSelection(item)}
                          onMouseEnter={() => handleAnimeHover(item)}
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
              </div>
            ) : (
              // Default View
              <>
                {/* Continue Watching Section */}
                {anime.continueWatchingList.length > 0 && anime.currentPage === 1 && (
                  <Carousel
                    title="Continue Watching"
                    variant="landscape"
                    onViewAll={() => anime.openViewAll('continue_watching')}
                  >
                    {anime.continueWatchingList.map((item) => (
                      <div
                        key={item.mal_id}
                        className="relative group h-full flex-[0_0_240px] sm:flex-[0_0_280px] md:flex-[0_0_320px]"
                        onClick={() => {
                          anime.handleAnimeClick({ mal_id: item.mal_id } as any).then(() => {
                            const dummyEp = {
                              session: item.episodeId,
                              episodeNumber: item.episodeNumber.toString(),
                              title: item.episodeTitle
                            };
                            anime.startWatching();
                            streams.loadStream(dummyEp);
                          });
                        }}
                      >
                        {/* Landscape Card Container */}
                        <div className="relative aspect-video rounded-lg overflow-hidden mb-3 shadow-lg border border-white/5 transition-colors cursor-pointer">
                          {/* Image */}
                          <img
                            src={item.image}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />

                          {/* Overlay - Darken on hover + Play Button */}
                          <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform shadow-xl">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white ml-1">
                                <path fillRule="evenodd" d="M4.5 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" clipRule="evenodd" />
                              </svg>
                            </div>
                          </div>

                          {/* Progress Bar (Fake for now, or use progress_seconds if implemented) */}
                          <div className="absolute bottom-0 inset-x-0 h-1 bg-white/20">
                            <div className="h-full bg-yorumi-accent w-1/3" />
                          </div>

                          {/* Episode Badge */}
                          <div className="absolute top-2 left-2 bg-black/60 backdrop-blur text-white text-[10px] font-bold px-1.5 py-0.5 rounded border border-white/10">
                            EP {item.episodeNumber}
                          </div>
                        </div>

                        {/* Title Info Below */}
                        <div className="px-1">
                          <h4 className="text-sm font-bold text-gray-200 truncate group-hover:text-yorumi-accent transition-colors">
                            {item.title}
                          </h4>
                          <p className="text-xs text-gray-500 truncate mt-0.5">
                            {item.episodeTitle || `Episode ${item.episodeNumber}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </Carousel>
                )}

                {/* Trending & Popular - Only on Page 1 */}
                {anime.currentPage === 1 && (
                  <>
                    <TrendingNow
                      animeList={anime.trendingAnime}
                      onAnimeClick={handleAnimeSelection}
                      onWatchClick={handleWatchDirectly}
                      onViewAll={() => anime.openViewAll('trending')}
                      onMouseEnter={handleAnimeHover}
                    />

                    <PopularSeason
                      animeList={anime.popularSeason}
                      onAnimeClick={handleAnimeSelection}
                      onWatchClick={handleWatchDirectly}
                      onViewAll={() => anime.openViewAll('seasonal')}
                      onMouseEnter={handleAnimeHover}
                    />
                  </>
                )}

                {/* Main Content Grid (Top Anime) */}
                <h2 className="text-xl font-bold mb-6 border-l-4 border-yorumi-accent pl-3 text-white">All-Time Popular</h2>

                {displayAnime.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 mb-8">
                    {displayAnime.map((item) => (
                      <AnimeCard
                        key={item.mal_id}
                        anime={item}
                        onClick={() => handleAnimeSelection(item)}
                        onWatchClick={() => handleWatchDirectly(item)}
                        onMouseEnter={handleAnimeHover}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-400 py-12">
                    No popular anime found.
                  </div>
                )}

                <Pagination
                  currentPage={anime.currentPage}
                  lastPage={anime.lastVisiblePage}
                  onPageChange={(page) => {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    anime.changePage(page);
                  }}
                  isLoading={anime.loading}
                  onPrefetchPage={anime.prefetchPage}
                />
              </>
            )}
          </>
        )}

        {/* Manga Tab */}
        {activeTab === 'manga' && (
          <>
            {isLoading && !isSearching ? (
              <div className="flex items-center justify-center min-h-[60vh]">
                <LoadingSpinner size="lg" text={`Loading ${activeTab}...`} />
              </div>
            ) : (
              <>
                {isSearching && <h2 className="text-xl font-bold mb-6 pt-24">Search Results for "{searchQuery}"</h2>}

                <div className={`${isSearching ? '' : 'pt-24'}`}>
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

                      {!isSearching && (
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
                      No manga found {isSearching && `matching "${searchQuery}"`}
                    </div>
                  )}
                  {/* Manga Infinite Scroll Sentinel */}
                  {isSearching && searchResults.length > 0 && searchPagination.has_next_page && (
                    <div ref={sentinelRef} className="h-24 flex justify-center items-center w-full">
                      {searchLoading && <LoadingSpinner size="md" />}
                    </div>
                  )}
                </div>
              </>
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
        onEpisodeClick={handleEpisodeClick}
        onAnimeClick={handleAnimeSelection}
      />

      {/* Manga Details Modal */}
      <MangaDetailsModal
        isOpen={manga.showMangaDetails && !!manga.selectedManga}
        manga={manga.selectedManga!}
        onClose={manga.closeMangaReader}
        onReadNow={manga.startReading}
      />

      {/* Manga Reader Modal */}
      {manga.selectedManga && (
        <MangaReaderModal
          isOpen={!!manga.currentMangaChapter}
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

      {/* Watch Modal - Fixed Props */}
      <WatchModal
        isOpen={anime.showWatchModal && !!anime.selectedAnime}
        anime={anime.selectedAnime!}
        episodes={anime.episodes}
        currentEpisode={streams.currentEpisode} // Linked to streams hook
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
        onLoadStream={(ep) => {
          if (anime.selectedAnime) anime.saveProgress(anime.selectedAnime, ep);
          streams.loadStream(ep);
        }}
        onPrefetchStream={streams.prefetchStream}
        onQualityMenuToggle={() => streams.setShowQualityMenu(!streams.showQualityMenu)}
        onQualityChange={streams.handleQualityChange}
        onSetAutoQuality={streams.setAutoQuality}
        onPlayerModeChange={streams.setPlayerMode}
        getMappedQuality={streams.getMappedQuality}

        // Navbar Props
        activeTab={activeTab}
        searchQuery={searchQuery}
        onTabChange={handleTabChange}
        onSearchChange={handleSearchChange}
        onSearchSubmit={handleSearchSubmit}
        onClearSearch={clearSearch}
        onLogoClick={handleLogoClick}
      />
    </div>
  );
}

export default App;

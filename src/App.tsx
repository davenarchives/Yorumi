import { useState, useEffect, useRef } from 'react';
import AnimeCard from './components/AnimeCard';
import MangaCard from './components/MangaCard';
import './App.css';
import Hls from 'hls.js';

interface Anime {
  mal_id: number;
  title: string;
  images: {
    jpg: {
      image_url: string;
      large_image_url: string;
    };
  };
  score: number;
  rank?: number;
  status: string;
  type: string;
  episodes: number | null;
  year?: number;
  synopsis?: string;
}

interface Episode {
  session: string;
  episodeNumber: string;
  duration?: string;
  title?: string;
}

interface Manga {
  mal_id: number;
  title: string;
  images: {
    jpg: {
      image_url: string;
      large_image_url: string;
    };
  };
  score: number;
  rank?: number;
  status: string;
  type: string;
  chapters: number | null;
  volumes: number | null;
  synopsis?: string;
}

interface MangaChapter {
  id: string;
  title: string;
  url: string;
  uploadDate: string;
}

interface MangaPage {
  pageNumber: number;
  imageUrl: string;
}

interface StreamLink {
  quality: string;
  audio: string;
  url: string;
  directUrl?: string;
  isHls: boolean;
}

function App() {
  const [topAnime, setTopAnime] = useState<Anime[]>([]);
  const [searchResults, setSearchResults] = useState<Anime[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastVisiblePage, setLastVisiblePage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<'anime' | 'manga'>('anime');

  // Manga state
  const [topManga, setTopManga] = useState<Manga[]>([]);
  const [mangaPage, setMangaPage] = useState(1);
  const [mangaLastPage, setMangaLastPage] = useState(1);
  const [mangaLoading, setMangaLoading] = useState(false);

  // Manga Reader State
  const [selectedManga, setSelectedManga] = useState<Manga | null>(null);
  const [mangaChapters, setMangaChapters] = useState<MangaChapter[]>([]);
  const [currentMangaChapter, setCurrentMangaChapter] = useState<MangaChapter | null>(null);
  const [chapterPages, setChapterPages] = useState<MangaPage[]>([]);
  const [mangaChaptersLoading, setMangaChaptersLoading] = useState(false);
  const [mangaPagesLoading, setMangaPagesLoading] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(60);

  // Watch State
  const [selectedAnime, setSelectedAnime] = useState<Anime | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [scraperSession, setScraperSession] = useState<string | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(null);

  const [streams, setStreams] = useState<StreamLink[]>([]);
  const [selectedStreamIndex, setSelectedStreamIndex] = useState<number>(0);
  const [isAutoQuality, setIsAutoQuality] = useState(true);
  const [playerMode, setPlayerMode] = useState<'hls' | 'embed'>('embed');
  const [showQualityMenu, setShowQualityMenu] = useState(false);

  const [epLoading, setEpLoading] = useState(false);
  const [streamLoading, setStreamLoading] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const currentStream = streams[selectedStreamIndex] || null;

  useEffect(() => {
    // If we have directUrl and mode is HLS, setup hls.js
    if (currentStream?.directUrl && playerMode === 'hls' && videoRef.current) {
      console.log("Setting up HLS player for:", currentStream.directUrl);
      if (Hls.isSupported()) {
        if (hlsRef.current) hlsRef.current.destroy();
        const hls = new Hls({
          capLevelToPlayerSize: true, // Help with "auto" if it's a master playlist
        });
        hls.loadSource(currentStream.directUrl);
        hls.attachMedia(videoRef.current);
        hlsRef.current = hls;
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        videoRef.current.src = currentStream.directUrl;
      }
    }
  }, [currentStream, playerMode]);

  useEffect(() => {
    const fetchTopAnime = async () => {
      try {
        setLoading(true);
        const res = await fetch(`http://localhost:3001/api/jikan/top?page=${currentPage}&limit=24`);
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();

        if (data && data.data) {
          setTopAnime(data.data);
          if (data.pagination) {
            setLastVisiblePage(data.pagination.last_visible_page);
          }
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load anime. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    if (!isSearching && activeTab === 'anime') {
      fetchTopAnime();
    }
  }, [currentPage, isSearching, activeTab]);

  // Fetch Top Manga
  useEffect(() => {
    const fetchTopManga = async () => {
      try {
        setMangaLoading(true);
        const res = await fetch(`http://localhost:3001/api/jikan/top/manga?page=${mangaPage}&limit=24`);
        if (!res.ok) throw new Error('Failed to fetch manga');
        const data = await res.json();

        if (data && data.data) {
          setTopManga(data.data);
          if (data.pagination) {
            setMangaLastPage(data.pagination.last_visible_page);
          }
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load manga. Please try again later.');
      } finally {
        setMangaLoading(false);
      }
    };

    if (activeTab === 'manga') {
      fetchTopManga();
    }
  }, [mangaPage, activeTab]);

  useEffect(() => {
    if (selectedAnime) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [selectedAnime]);

  // Lock body scroll when manga reader is open
  useEffect(() => {
    if (selectedManga) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [selectedManga]);

  useEffect(() => {
    const performSearch = async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`http://localhost:3001/api/jikan/search?q=${encodeURIComponent(searchQuery)}&page=${currentPage}&limit=24`);
        const data = await res.json();
        if (data && data.data) {
          setSearchResults(data.data);
          if (data.pagination) {
            setLastVisiblePage(data.pagination.last_visible_page);
          }
        }
      } catch (err) {
        console.error("Search failed", err);
      } finally {
        setSearchLoading(false);
      }
    };

    if (isSearching && searchQuery.trim()) {
      performSearch();
    }
  }, [currentPage, isSearching, searchQuery]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) {
      setIsSearching(false);
      return;
    }
    setCurrentPage(1);
    setIsSearching(true);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setIsSearching(false);
    setSearchResults([]);
    setSearchLoading(false);
    setCurrentPage(1);
  };

  const handleAnimeClick = async (anime: Anime) => {
    setSelectedAnime(anime);
    setEpLoading(true);
    setEpisodes([]);
    setCurrentEpisode(null);
    setStreams([]);
    setScraperSession(null);

    try {
      // 1. Fetch full details to get synopsis
      console.log(`Fetching details for ID ${anime.mal_id}...`);
      const detailRes = await fetch(`http://localhost:3001/api/jikan/anime/${anime.mal_id}`);
      const detailData = await detailRes.json();
      if (detailData && detailData.data) {
        setSelectedAnime(detailData.data);
      }

      // 2. Search for the anime to get session
      console.log(`Searching for ${anime.title} on scraper...`);
      let searchRes = await fetch(`http://localhost:3001/api/scraper/search?q=${encodeURIComponent(anime.title)}`);
      let searchData = await searchRes.json();

      if ((!searchData || searchData.length === 0) && anime.title.includes(':')) {
        const simpleTitle = anime.title.split(':')[0].trim();
        console.log(`No results for full title, trying fallback: ${simpleTitle}`);
        searchRes = await fetch(`http://localhost:3001/api/scraper/search?q=${encodeURIComponent(simpleTitle)}`);
        searchData = await searchRes.json();
      }

      if (searchData && searchData.length > 0) {
        const session = searchData[0].session || searchData[0].id;
        setScraperSession(session);
        const epRes = await fetch(`http://localhost:3001/api/scraper/episodes?session=${session}`);
        const epData = await epRes.json();

        if (epData && epData.episodes) {
          setEpisodes(epData.episodes);
        } else if (epData && epData.ep_details) {
          setEpisodes(epData.ep_details);
        } else if (Array.isArray(epData)) {
          setEpisodes(epData);
        }
      }
    } catch (e) {
      console.error("Failed to load episodes", e);
    } finally {
      setEpLoading(false);
    }
  };

  const getMappedQuality = (q: string): string => {
    const res = parseInt(q);
    if (res >= 1000) return '1080P';
    if (res >= 600) return '720P';
    return '360P';
  };

  const loadStream = async (episode: Episode) => {
    if (!scraperSession) return;
    setCurrentEpisode(episode);
    setStreamLoading(true);
    setStreams([]);
    setSelectedStreamIndex(0);
    setIsAutoQuality(true);

    try {
      const res = await fetch(`http://localhost:3001/api/scraper/streams?anime_session=${scraperSession}&ep_session=${episode.session}`);
      const data = await res.json();

      if (data && data.length > 0) {
        const qualityMap = new Map<string, StreamLink>();
        const sortedData = [...data].sort((a: StreamLink, b: StreamLink) => (parseInt(b.quality) || 0) - (parseInt(a.quality) || 0));

        sortedData.forEach((s: StreamLink) => {
          const mapped = getMappedQuality(s.quality);
          if (!qualityMap.has(mapped)) {
            qualityMap.set(mapped, s);
          }
        });

        const standardizedStreams = Array.from(qualityMap.values());
        setStreams(standardizedStreams);

        if (!standardizedStreams[0].directUrl) setPlayerMode('embed');
      } else {
        console.log("No streams found");
      }
    } catch (e) {
      console.error("Failed to load stream", e);
    } finally {
      setStreamLoading(false);
    }
  };

  const handleQualityChange = (index: number) => {
    setSelectedStreamIndex(index);
    setIsAutoQuality(false);
    setShowQualityMenu(false);
  };

  const setAutoQuality = () => {
    setIsAutoQuality(true);
    setSelectedStreamIndex(0); // Highest by default
    setShowQualityMenu(false);
  };

  const closeDetails = () => {
    setSelectedAnime(null);
    setEpisodes([]);
    setCurrentEpisode(null);
    setStreams([]);
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  };

  // Manga Reader Handlers
  const handleMangaClick = async (manga: Manga) => {
    setSelectedManga(manga);
    setMangaChaptersLoading(true);
    setMangaChapters([]);
    setCurrentMangaChapter(null);
    setChapterPages([]);
    setZoomLevel(60);

    try {
      // Search for the manga on MangaKatana
      console.log(`Searching for ${manga.title} on MangaKatana...`);
      const searchRes = await fetch(`http://localhost:3001/api/manga/search?q=${encodeURIComponent(manga.title)}`);
      const searchData = await searchRes.json();

      if (searchData?.data && searchData.data.length > 0) {
        const mangaId = searchData.data[0].id;
        console.log(`Found manga: ${mangaId}, fetching chapters...`);

        // Fetch chapters
        const chaptersRes = await fetch(`http://localhost:3001/api/manga/chapters/${encodeURIComponent(mangaId)}`);
        const chaptersData = await chaptersRes.json();

        if (chaptersData?.data) {
          setMangaChapters(chaptersData.data);
        }
      } else {
        console.log('Manga not found on MangaKatana');
      }
    } catch (e) {
      console.error('Failed to load manga chapters:', e);
    } finally {
      setMangaChaptersLoading(false);
    }
  };

  const loadMangaChapter = async (chapter: MangaChapter) => {
    setCurrentMangaChapter(chapter);
    setMangaPagesLoading(true);
    setChapterPages([]);

    try {
      const res = await fetch(`http://localhost:3001/api/manga/pages?url=${encodeURIComponent(chapter.url)}`);
      const data = await res.json();

      if (data?.data) {
        setChapterPages(data.data);
      }
    } catch (e) {
      console.error('Failed to load chapter pages:', e);
    } finally {
      setMangaPagesLoading(false);
    }
  };

  const zoomIn = () => setZoomLevel(prev => Math.min(200, prev + 10));
  const zoomOut = () => setZoomLevel(prev => Math.max(30, prev - 10));

  const closeMangaReader = () => {
    setSelectedManga(null);
    setMangaChapters([]);
    setCurrentMangaChapter(null);
    setChapterPages([]);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans">
      <nav className="flex items-center justify-between px-8 py-4 bg-[#0a0a0a] sticky top-0 z-50 shadow-md shadow-black/20">
        <div className="flex items-center gap-8">
          <h1 onClick={clearSearch} className="text-2xl font-bold tracking-tighter text-white cursor-pointer hover:opacity-80 transition-opacity">YORUMI</h1>
          <div className="flex gap-4 text-sm font-medium text-gray-400">
            <button onClick={() => { clearSearch(); setActiveTab('anime'); }} className={`px-4 py-2 rounded-full transition-colors ${activeTab === 'anime' && !isSearching ? 'text-white bg-white/10' : 'hover:text-white'}`}>Home</button>
            <button onClick={() => setActiveTab('manga')} className={`px-4 py-2 rounded-full transition-colors ${activeTab === 'manga' ? 'text-white bg-white/10' : 'hover:text-white'}`}>Manga</button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <form onSubmit={handleSearch} className="relative flex items-center">
            <input
              type="text"
              placeholder="Search anime..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-full py-2 px-6 pr-12 w-64 md:w-80 text-sm focus:outline-none focus:border-white/20 focus:bg-white/10 transition-all placeholder:text-gray-500"
            />
            <button type="submit" className="absolute right-4 text-gray-400 hover:text-white transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            </button>
          </form>
        </div>
      </nav>

      <main className="container mx-auto px-6 py-8">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-xl font-bold">
            {activeTab === 'manga' ? 'Top Manga' : (isSearching ? `Search results for "${searchQuery}"` : 'Top Anime')}
          </h2>
          {isSearching && activeTab === 'anime' && (
            <button onClick={clearSearch} className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
              Clear Search
            </button>
          )}
        </div>

        {/* Loading States */}
        {(activeTab === 'anime' && (searchLoading || (loading && topAnime.length === 0))) || (activeTab === 'manga' && mangaLoading) ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
          </div>
        ) : error ? (
          <div className="text-center text-red-500 py-12">{error}</div>
        ) : activeTab === 'manga' ? (
          /* Manga View */
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {topManga.slice(0, (mangaPage === 5 ? 4 : 24)).map((manga, index) => (
                <MangaCard key={manga.mal_id} manga={{ ...manga, rank: (mangaPage - 1) * 24 + index + 1 }} onClick={handleMangaClick} />
              ))}
            </div>

            {/* Manga Pagination UI */}
            <div className="flex justify-center items-center mt-12 mb-8 gap-3">
              {mangaPage > 1 && (
                <>
                  <button onClick={() => setMangaPage(1)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:bg-white/10 transition-all font-bold text-xs">«</button>
                  <button onClick={() => setMangaPage(prev => Math.max(1, prev - 1))} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:bg-white/10 transition-all font-bold text-xs">‹</button>
                </>
              )}
              {(() => {
                const pages = [];
                const maxPage = Math.min(mangaLastPage, 5);
                let start = Math.max(1, mangaPage - 1);
                if (start + 3 > maxPage) start = Math.max(1, maxPage - 3);
                for (let i = start; i <= Math.min(start + 3, maxPage); i++) pages.push(i);
                return pages.map(pageNum => (
                  <button key={pageNum} onClick={() => setMangaPage(pageNum)} className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${mangaPage === pageNum ? 'bg-[#ffb6d9] text-[#1a1c2c] shadow-lg shadow-pink-500/20' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                    {pageNum}
                  </button>
                ));
              })()}
              {mangaPage < Math.min(mangaLastPage, 5) && (
                <>
                  <button onClick={() => setMangaPage(prev => Math.min(5, prev + 1))} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:bg-white/10 transition-all font-bold text-xs">›</button>
                  <button onClick={() => setMangaPage(Math.min(mangaLastPage, 5))} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:bg-white/10 transition-all font-bold text-xs">»</button>
                </>
              )}
            </div>
          </>
        ) : (
          /* Anime View */
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {(isSearching ? searchResults : topAnime.slice(0, (currentPage === 5 ? 4 : 24))).map((anime, index) => (
                <AnimeCard key={anime.mal_id} anime={{ ...anime, rank: isSearching ? anime.rank : ((currentPage - 1) * 24 + index + 1) }} onClick={handleAnimeClick} />
              ))}
            </div>

            {/* Pagination UI */}
            <div className="flex justify-center items-center mt-12 mb-8 gap-3">
              {/* Back Buttons */}
              {currentPage > 1 && (
                <>
                  <button
                    onClick={() => setCurrentPage(1)}
                    className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:bg-white/10 transition-all font-bold text-xs"
                  >
                    «
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:bg-white/10 transition-all font-bold text-xs"
                  >
                    ‹
                  </button>
                </>
              )}

              {/* Sliding window pagination logic */}
              {(() => {
                const pages = [];
                const maxPage = isSearching ? lastVisiblePage : Math.min(lastVisiblePage, 5);

                // Show 4 pages at a time as in the mockup
                let start = Math.max(1, currentPage - 1);
                if (start + 3 > maxPage) start = Math.max(1, maxPage - 3);

                for (let i = start; i <= Math.min(start + 3, maxPage); i++) {
                  pages.push(i);
                }

                return pages.map(pageNum => (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${currentPage === pageNum ? 'bg-[#ffb6d9] text-[#1a1c2c] shadow-lg shadow-pink-500/20' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                  >
                    {pageNum}
                  </button>
                ));
              })()}

              {/* Forward Buttons */}
              {currentPage < (isSearching ? lastVisiblePage : Math.min(lastVisiblePage, 5)) && (
                <>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(isSearching ? lastVisiblePage : 5, prev + 1))}
                    className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:bg-white/10 transition-all font-bold text-xs"
                  >
                    ›
                  </button>
                  <button
                    onClick={() => setCurrentPage(isSearching ? lastVisiblePage : Math.min(lastVisiblePage, 5))}
                    className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:bg-white/10 transition-all font-bold text-xs"
                  >
                    »
                  </button>
                </>
              )}
            </div>

            {isSearching && searchResults.length === 0 && !searchLoading && (
              <div className="text-center py-20 text-gray-500">
                No anime found matching "{searchQuery}"
              </div>
            )}
          </>
        )}
      </main>

      {
        selectedAnime && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md transition-opacity duration-300">
            <div className="w-full h-full flex flex-col">
              <div className="flex items-center p-4 bg-[#1a1a1a]/80 border-b border-white/5">
                <button onClick={closeDetails} className="flex items-center gap-2 text-white/70 hover:text-white transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                  </svg>
                  <span>Back</span>
                </button>
                <h2 className="ml-4 text-lg font-bold truncate">{selectedAnime.title}</h2>
              </div>

              <div className="flex-1 flex overflow-hidden">
                <div className="w-80 bg-[#111] border-r border-white/5 flex flex-col">
                  <div className="p-4 border-b border-white/5 bg-[#161616]">
                    <h3 className="font-semibold text-gray-400 text-sm uppercase tracking-wide">Episodes ({episodes.length})</h3>
                  </div>
                  <div className="flex-1 overflow-y-auto no-scrollbar">
                    {epLoading ? (
                      <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#facc15]"></div></div>
                    ) : episodes.length > 0 ? (
                      <div className="space-y-1">
                        {episodes.map((ep: Episode) => (
                          <div
                            key={ep.session}
                            onClick={() => loadStream(ep)}
                            className={`p-4 cursor-pointer hover:bg-white/5 transition-colors border-l-2 ${currentEpisode?.session === ep.session ? 'bg-white/10 border-[#facc15]' : 'border-transparent'}`}
                          >
                            <div className="flex items-center justify-between font-mono text-sm text-gray-400">
                              <span>EP {ep.episodeNumber}</span>
                              <span className="text-xs text-gray-600">{ep.duration}</span>
                            </div>
                            <div className="text-sm font-medium mt-1 truncate">{ep.title || `Episode ${ep.episodeNumber}`}</div>
                          </div>
                        ))}
                      </div>
                    ) : <div className="p-8 text-center text-gray-500">No episodes found.</div>}
                  </div>
                </div>

                <div className="flex-1 bg-black flex flex-col relative">
                  {currentStream && (
                    <div className="absolute top-4 right-4 z-10 flex gap-2">
                      <div className="relative">
                        <button
                          onClick={() => setShowQualityMenu(!showQualityMenu)}
                          className="px-3 py-1 flex items-center gap-1.5 rounded-full text-xs font-bold bg-white/10 text-white hover:bg-white/20 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0m-9.75 0h9.75" />
                          </svg>
                          {isAutoQuality ? 'AUTO' : getMappedQuality(currentStream.quality)}
                        </button>

                        {showQualityMenu && (
                          <div className="absolute right-0 mt-2 p-2 w-28 bg-[#1a1a1a] rounded-lg shadow-2xl border border-white/10 flex flex-col gap-1 z-20">
                            <h4 className="px-2 py-1 text-[10px] font-bold text-gray-500 uppercase">Quality</h4>
                            {streams.map((s, idx) => (
                              <button
                                key={idx}
                                onClick={() => handleQualityChange(idx)}
                                className={`px-3 py-1.5 text-xs text-left rounded transition-colors ${!isAutoQuality && selectedStreamIndex === idx ? 'bg-white text-black font-bold' : 'hover:bg-white/5 text-gray-300'}`}
                              >
                                {getMappedQuality(s.quality)}
                              </button>
                            ))}
                            <button
                              onClick={setAutoQuality}
                              className={`px-3 py-1.5 text-xs text-left rounded transition-colors ${isAutoQuality ? 'bg-white text-black font-bold' : 'hover:bg-white/5 text-gray-300'}`}
                            >
                              AUTO
                            </button>
                          </div>
                        )}
                      </div>

                      {currentStream.directUrl && (
                        <button
                          onClick={() => setPlayerMode('hls')}
                          className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${playerMode === 'hls' ? 'bg-[#facc15] text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}
                        >
                          Clean Player
                        </button>
                      )}
                      <button
                        onClick={() => setPlayerMode('embed')}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${playerMode === 'embed' ? 'bg-[#facc15] text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}
                      >
                        Embed Mode
                      </button>
                    </div>
                  )}

                  <div className="flex-1 flex items-center justify-center">
                    {streamLoading ? (
                      <div className="flex flex-col items-center gap-4">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#facc15]"></div>
                        <p className="text-gray-400 animate-pulse">Loading stream...</p>
                      </div>
                    ) : currentStream ? (
                      playerMode === 'hls' && currentStream.directUrl ? (
                        <video ref={videoRef} controls className="w-full h-full" autoPlay />
                      ) : (
                        <iframe
                          src={currentStream.url}
                          className="w-full h-full"
                          allowFullScreen
                          allow="autoplay; encrypted-media"
                          frameBorder="0"
                        ></iframe>
                      )
                    ) : (
                      <div className="flex flex-col items-center justify-center text-gray-500 gap-4">
                        <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                          </svg>
                        </div>
                        <p>Select an episode to start watching</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="w-80 bg-[#111] border-l border-white/5 overflow-y-auto hidden xl:block p-6 space-y-6">
                  <div className="aspect-[2/3] rounded-lg overflow-hidden shadow-lg">
                    <img src={selectedAnime?.images.jpg.large_image_url} alt={selectedAnime?.title} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold leading-tight mb-2">{selectedAnime?.title}</h1>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="px-2 py-1 bg-white/10 rounded">{selectedAnime?.type}</span>
                      <span className="px-2 py-1 bg-white/10 rounded">{selectedAnime?.year}</span>
                      <span className="px-2 py-1 bg-[#facc15] text-black font-bold rounded flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" /></svg>
                        {selectedAnime?.score}
                      </span>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-400 mb-2 uppercase tracking-wide">Synopsis</h4>
                    <p className="text-sm text-gray-300 leading-relaxed max-h-60 overflow-y-auto no-scrollbar">
                      {selectedAnime?.synopsis || 'No synopsis available.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Manga Reader Modal */}
      {selectedManga && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md transition-opacity duration-300">
          <div className="w-full h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-[#1a1a1a]/80 border-b border-white/5">
              <div className="flex items-center">
                <button onClick={closeMangaReader} className="flex items-center gap-2 text-white/70 hover:text-white transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                  </svg>
                </button>
                <h2 className="ml-4 text-lg font-bold truncate">
                  {selectedManga.title}
                  {currentMangaChapter && <span className="text-gray-400 font-normal"> | {currentMangaChapter.title}</span>}
                </h2>
              </div>

              {/* Zoom Controls */}
              <div className="flex items-center gap-2">
                <button onClick={zoomOut} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM13.5 10.5h-6" />
                  </svg>
                </button>
                <span className="text-sm font-bold text-white/80 w-12 text-center">{zoomLevel}%</span>
                <button onClick={zoomIn} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
              {/* Chapter Sidebar */}
              <div className="w-64 bg-[#111] border-r border-white/5 flex flex-col">
                <div className="p-4 border-b border-white/5 bg-[#161616] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-400">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                    </svg>
                    <h3 className="font-semibold text-white text-sm">Chapters</h3>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto no-scrollbar">
                  {mangaChaptersLoading ? (
                    <div className="flex justify-center p-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#facc15]"></div>
                    </div>
                  ) : mangaChapters.length > 0 ? (
                    <div className="space-y-0.5">
                      {mangaChapters.map((chapter) => (
                        <div
                          key={chapter.id}
                          onClick={() => loadMangaChapter(chapter)}
                          className={`px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors border-l-2 ${currentMangaChapter?.id === chapter.id
                              ? 'bg-white/10 border-[#facc15]'
                              : 'border-transparent'
                            }`}
                        >
                          <div className="text-sm font-medium truncate">{chapter.title}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-gray-500">No chapters found on MangaKatana.</div>
                  )}
                </div>
              </div>

              {/* Reading Area */}
              <div className="flex-1 bg-[#0a0a0a] overflow-y-auto">
                {mangaPagesLoading ? (
                  <div className="flex flex-col items-center justify-center h-full gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#facc15]"></div>
                    <p className="text-gray-400 animate-pulse">Loading pages...</p>
                  </div>
                ) : chapterPages.length > 0 ? (
                  <div className="flex flex-col items-center py-4 gap-1">
                    {chapterPages.map((page) => (
                      <img
                        key={page.pageNumber}
                        src={page.imageUrl}
                        alt={`Page ${page.pageNumber}`}
                        className="transition-all duration-200"
                        style={{ width: `${zoomLevel}%` }}
                        loading="lazy"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4">
                    <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                      </svg>
                    </div>
                    <p>Select a chapter to start reading</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div >
  );
}

export default App;

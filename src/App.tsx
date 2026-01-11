import { useState, useEffect, useRef } from 'react';
import AnimeCard from './components/AnimeCard';
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
  rank: number;
  status: string;
  type: string;
  episodes: number | null;
  year?: number;
  synopsis?: string;
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Watch State
  const [selectedAnime, setSelectedAnime] = useState<Anime | null>(null);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [scraperSession, setScraperSession] = useState<string | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState<any | null>(null);

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
        const res = await fetch(`http://localhost:3001/api/jikan/top?page=1`);
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();

        const initialData = data.data.filter((item: Anime) => item.rank);
        initialData.sort((a: Anime, b: Anime) => a.rank - b.rank);

        setTopAnime(initialData);
        setLoading(false);

        setLoadingMore(true);
        let currentPage = 2;
        let currentCount = initialData.length;

        while (currentCount < 100 && currentPage <= 7) {
          await new Promise(resolve => setTimeout(resolve, 600));
          const res = await fetch(`http://localhost:3001/api/jikan/top?page=${currentPage}`);
          if (!res.ok) {
            currentPage++;
            continue;
          }
          const nextData = await res.json();

          setTopAnime(prev => {
            const combined = [...prev, ...nextData.data];
            let unique = Array.from(new Map(combined.map(item => [item.mal_id, item])).values());
            unique = unique.filter(item => item.rank);
            unique.sort((a, b) => a.rank - b.rank);
            if (unique.length > 100) unique = unique.slice(0, 100);
            currentCount = unique.length;
            return unique;
          });
          currentPage++;
        }
      } catch (err) {
        console.error(err);
        if (topAnime.length === 0) setError('Failed to load anime. Please try again later.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    };
    fetchTopAnime();
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) {
      setIsSearching(false);
      return;
    }

    setSearchLoading(true);
    setIsSearching(true);
    try {
      const res = await fetch(`http://localhost:3001/api/jikan/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data && data.data) {
        setSearchResults(data.data);
      }
    } catch (err) {
      console.error("Search failed", err);
    } finally {
      setSearchLoading(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setIsSearching(false);
    setSearchResults([]);
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

  const loadStream = async (episode: any) => {
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

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans">
      <nav className="flex items-center justify-between px-8 py-4 bg-[#0a0a0a] sticky top-0 z-50 shadow-md shadow-black/20">
        <div className="flex items-center gap-8">
          <h1 onClick={clearSearch} className="text-2xl font-bold tracking-tighter text-white cursor-pointer hover:opacity-80 transition-opacity">YORUMI</h1>
          <div className="flex gap-4 text-sm font-medium text-gray-400">
            <button onClick={clearSearch} className={`px-4 py-2 rounded-full transition-colors ${!isSearching ? 'text-white bg-white/10' : 'hover:text-white'}`}>Home</button>
            <button className="hover:text-white transition-colors px-4 py-2">Manga</button>
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
            {isSearching ? `Search results for "${searchQuery}"` : 'Top Anime'}
          </h2>
          {isSearching && (
            <button onClick={clearSearch} className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
              Clear Search
            </button>
          )}
        </div>

        {(loading || searchLoading) && (isSearching ? searchResults.length === 0 : topAnime.length === 0) ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
          </div>
        ) : error ? (
          <div className="text-center text-red-500 py-12">{error}</div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {(isSearching ? searchResults : topAnime).map((anime, index) => (
                <AnimeCard key={anime.mal_id} anime={{ ...anime, rank: isSearching ? undefined : index + 1 }} onClick={handleAnimeClick} />
              ))}
            </div>
            {!isSearching && loadingMore && (
              <div className="flex justify-center items-center py-8 gap-2">
                <div className="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
              </div>
            )}
            {isSearching && searchResults.length === 0 && !searchLoading && (
              <div className="text-center py-20 text-gray-500">
                No anime found matching "{searchQuery}"
              </div>
            )}
          </>
        )}
      </main>

      {selectedAnime && (
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
                <div className="flex-1 overflow-y-auto scrollbar-thin">
                  {epLoading ? (
                    <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#facc15]"></div></div>
                  ) : episodes.length > 0 ? (
                    <div className="space-y-1">
                      {episodes.map((ep: any) => (
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
                  <p className="text-sm text-gray-300 leading-relaxed max-h-60 overflow-y-auto scrollbar-thin">
                    {selectedAnime?.synopsis || 'No synopsis available.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

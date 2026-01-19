import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, LayoutList, LayoutGrid, RotateCw, Maximize, Minimize, Settings, Search, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { useAnime } from '../hooks/useAnime';
import { useStreams } from '../hooks/useStreams';
import LoadingSpinner from '../components/LoadingSpinner';
import type { Anime, Episode } from '../types/anime';

export default function WatchPage() {
    const { id } = useParams<{ id: string }>();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    const animeHook = useAnime();
    const { selectedAnime, episodes, epLoading, scraperSession, error, saveProgress } = animeHook;
    const streamsHook = useStreams(scraperSession);
    const {
        currentStream,
        streamLoading,
        currentEpisode,
        streams,
        isAutoQuality,
        selectedStreamIndex,
        showQualityMenu,
        setShowQualityMenu,
        handleQualityChange,
        setAutoQuality,
        clearStreams
    } = streamsHook;

    // Clear previous anime's stream state when changing anime
    useEffect(() => {
        clearStreams();
    }, [id]);

    const epNum = searchParams.get('ep') || '1';

    // UI States
    const [isExpanded, setIsExpanded] = useState(false);
    const [autoPlay] = useState(() => localStorage.getItem('yorumi_autoplay') === 'true');
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const [searchEp, setSearchEp] = useState('');
    const [selectedRange, setSelectedRange] = useState<string>('1-100');
    const [showRangeMenu, setShowRangeMenu] = useState(false);

    // Persist AutoPlay
    useEffect(() => {
        localStorage.setItem('yorumi_autoplay', String(autoPlay));
    }, [autoPlay]);

    // 1. Fetch Anime & Episodes on Mount
    const location = useLocation();
    useEffect(() => {
        if (location.state?.anime) {
            animeHook.handleAnimeClick(location.state.anime);
        } else if (id) {
            animeHook.handleAnimeClick({ mal_id: parseInt(id) } as Anime);
        }
    }, [id, location.state]);

    // 2. Auto-load Episode when episodes are ready
    useEffect(() => {
        if (episodes.length > 0 && !currentStream && !streamLoading) {
            const targetEp = episodes.find(e => e.episodeNumber == epNum) || episodes[0];
            if (targetEp) {
                streamsHook.loadStream(targetEp);
            }
        }
    }, [episodes, epNum]);

    // 3. Save "Continue Watching" Progress
    useEffect(() => {
        if (selectedAnime && currentEpisode) {
            saveProgress(selectedAnime, currentEpisode);
        }
    }, [selectedAnime, currentEpisode]);

    const handleEpisodeClick = (ep: Episode) => {
        setSearchParams({ ep: String(ep.episodeNumber) });
        streamsHook.loadStream(ep);
    };

    const toggleExpand = () => setIsExpanded(!isExpanded);
    const reloadPlayer = () => {
        if (currentEpisode) {
            streamsHook.loadStream(currentEpisode);
        }
    };

    // Navigation Handlers
    const handlePrevEp = () => {
        const currIdx = episodes.findIndex(e => e.episodeNumber == epNum);
        if (currIdx > 0) { // Episodes are often sorted desc or asc, logic depends. Assuming array order matters.
            // If episodes sorted DESC (newest first), prev index is Older (e.g. ep 10 -> ep 9)
            // If episodes sorted ASC (oldest first), prev index is Newer (e.g. ep 2 -> ep 1)
            // Let's rely on index - 1 or + 1 logic based on array. 
            // Simple logic: find episode with Num - 1
            const targetNum = parseInt(epNum) - 1;
            const target = episodes.find(e => parseInt(e.episodeNumber) === targetNum);
            if (target) handleEpisodeClick(target);
        }
    };

    const handleNextEp = () => {
        const targetNum = parseInt(epNum) + 1;
        const target = episodes.find(e => parseInt(e.episodeNumber) === targetNum);
        if (target) handleEpisodeClick(target);
    };

    // Filter Episodes
    const filteredEpisodes = episodes.filter(ep =>
        ep.title?.toLowerCase().includes(searchEp.toLowerCase()) ||
        ep.episodeNumber.toString().includes(searchEp)
    ).filter(ep => {
        if (searchEp) return true; // Ignore range if searching
        const [start, end] = selectedRange.split('-').map(Number);
        const epNumVal = parseInt(ep.episodeNumber.toString());
        if (isNaN(epNumVal)) return true;
        return epNumVal >= start && epNumVal <= end;
    });

    // Generate Ranges
    const ranges = [];
    if (episodes.length > 100) {
        for (let i = 0; i < episodes.length; i += 100) {
            const start = i + 1;
            const end = Math.min(i + 100, episodes.length);
            ranges.push(`${start}-${end}`);
        }
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center h-screen w-full bg-[#0a0a0a] text-white">
                <h1 className="text-2xl font-bold text-red-400 mb-4">{error}</h1>
                <button
                    onClick={() => navigate('/')}
                    className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                    Back to Home
                </button>
            </div>
        );
    }

    if (!selectedAnime) {
        return (
            <div className="flex flex-col items-center justify-center w-full h-screen bg-[#0a0a0a] text-white pt-[72px]">
                <LoadingSpinner />
            </div>
        );
    }

    // Use any cast to avoid type errors with mismatched interface if needed
    // Use any cast to avoid type errors with mismatched interface if needed
    const animeData: any = selectedAnime;
    const currentEpTitle = episodes.find(e => e.episodeNumber == epNum)?.title;
    const cleanCurrentTitle = currentEpTitle && currentEpTitle.trim().toLowerCase() !== 'untitled' ? currentEpTitle : null;
    const displayTitle = cleanCurrentTitle || `Episode ${epNum}`;

    return (
        <div className="flex flex-col h-screen w-full bg-[#0a0a0a] text-white overflow-hidden pt-[72px]">
            {/* 1. Header Row (Fixed) */}
            <header className="h-14 shrink-0 flex items-center px-6 border-b border-white/10 bg-black/40 backdrop-blur-md z-40">
                <button
                    onClick={() => navigate('/')}
                    className="mr-4 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                    <span className="text-sm font-medium">Back</span>
                </button>
                <h1 className="text-lg font-bold text-white tracking-wide truncate">
                    {animeData.title}
                </h1>
            </header>

            {/* 2. Main Layout (3 Columns) */}
            <div className="flex-1 flex flex-col md:flex-row min-h-0 relative overflow-y-auto md:overflow-hidden">

                {/* COLUMN 1: Episode List (Left Sidebar) */}
                <aside className="w-full md:w-[350px] shrink-0 flex flex-col h-[500px] md:h-full border-r border-white/10 bg-black/20 overflow-hidden order-2 md:order-1">
                    <div className="p-4 border-b border-white/5">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                Episodes ({episodes.length})
                                {ranges.length > 1 && (
                                    <div className="relative">
                                        <button
                                            onClick={() => setShowRangeMenu(!showRangeMenu)}
                                            className="ml-2 flex items-center gap-1 text-xs bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded text-white transition-colors"
                                        >
                                            {selectedRange}
                                            <ChevronDown className="w-3 h-3" />
                                        </button>
                                        {showRangeMenu && (
                                            <div className="absolute top-full left-0 mt-1 bg-[#1a1a1a] border border-white/10 rounded-lg p-1 min-w-[100px] shadow-xl z-50 max-h-[200px] overflow-y-auto">
                                                {ranges.map((range) => (
                                                    <button
                                                        key={range}
                                                        onClick={() => { setSelectedRange(range); setShowRangeMenu(false); }}
                                                        className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-colors ${selectedRange === range ? 'bg-yellow-500/20 text-yellow-500' : 'text-gray-300 hover:bg-white/10'}`}
                                                    >
                                                        {range}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </h3>
                            <div className="flex bg-black/40 rounded-lg p-0.5 border border-white/10">
                                <button
                                    onClick={() => setViewMode('list')}
                                    className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                >
                                    <LayoutList className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setViewMode('grid')}
                                    className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                >
                                    <LayoutGrid className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input
                                type="text"
                                placeholder="Number of Ep"
                                value={searchEp}
                                onChange={(e) => setSearchEp(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-white/20"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                        {epLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-indigo-500"></div>
                            </div>
                        ) : filteredEpisodes.length > 0 ? (
                            <div className={viewMode === 'grid' ? "grid grid-cols-5 gap-2 p-3" : "flex flex-col"}>
                                {filteredEpisodes.map((ep) => {
                                    const isCurrent = ep.episodeNumber == epNum;
                                    const cleanTitle = ep.title && ep.title.trim().toLowerCase() !== 'untitled' ? ep.title : null;
                                    const displayTitle = cleanTitle || `Episode ${ep.episodeNumber}`;

                                    return (
                                        <button
                                            key={ep.episodeNumber}
                                            onClick={() => handleEpisodeClick(ep)}
                                            className={`
                                                group relative transition-all duration-200
                                                ${viewMode === 'grid'
                                                    ? `aspect-square rounded-md flex items-center justify-center border ${isCurrent ? 'bg-yellow-500 text-black border-yellow-500 font-bold' : 'bg-white/5 border-white/5 hover:bg-white/10 text-gray-400 hover:text-white'}`
                                                    : `w-full px-5 py-3 text-left border-l-2 flex flex-col justify-center ${isCurrent ? 'border-yellow-500 bg-white/5' : 'border-transparent hover:bg-white/5'}`
                                                }
                                            `}
                                        >
                                            {viewMode === 'grid' ? (
                                                <span className="text-sm">{ep.episodeNumber}</span>
                                            ) : (
                                                <>
                                                    <div className="flex items-center justify-between w-full mb-0.5">
                                                        <span className={`text-sm font-bold ${isCurrent ? 'text-yellow-500' : 'text-gray-400 group-hover:text-white'}`}>
                                                            EP {ep.episodeNumber}
                                                        </span>
                                                        {isCurrent && (
                                                            <span className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center">
                                                                <svg className="w-4 h-4 text-black" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className={`text-sm truncate w-full ${isCurrent ? 'text-white' : 'text-gray-500'}`}>
                                                        {displayTitle}
                                                    </span>
                                                </>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="p-8 text-center text-gray-500 text-sm">
                                {episodes.length === 0 ? "No episodes found." : "No matching episodes."}
                            </div>
                        )}
                    </div>
                </aside>

                {/* COLUMN 2: Player (Center) */}
                <div className="flex-1 min-w-0 relative bg-black flex flex-col order-1 md:order-2">
                    {/* Video Player Container */}
                    <div className={`relative w-full ${isExpanded ? 'flex-1 min-h-[300px]' : 'aspect-video shrink-0'} bg-black group transition-all duration-300`}>
                        {streamLoading ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-20">
                                <LoadingSpinner />
                                <p className="mt-4 text-gray-400 animate-pulse">Loading Stream...</p>
                            </div>
                        ) : currentStream ? (
                            <iframe
                                key={currentStream.url}
                                src={currentStream.url}
                                className="w-full h-full border-0"
                                allowFullScreen
                                allow="autoplay"
                            />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-gray-500">
                                <span className="mb-2 text-6xl opacity-20">▶</span>
                                <p>Select an episode</p>
                            </div>
                        )}
                    </div>

                    {/* Metadata & Controls Bar (Below Player) */}
                    <div className="p-4">
                        {/* Title Info */}
                        <div className="mb-3">
                            <h2 className="text-lg font-bold text-white leading-tight">{animeData.title}</h2>
                            <div className="flex items-baseline gap-3">
                                <p className="text-yellow-500 font-medium text-sm">Episode {epNum}</p>
                                {displayTitle && <p className="text-gray-400 text-xs">{displayTitle}</p>}
                            </div>
                        </div>

                        {/* Controls Row */}
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible">
                            {/* Previous */}
                            <button
                                onClick={handlePrevEp}
                                className="flex-shrink-0 px-4 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={epNum === '1'}
                            >
                                <ChevronLeft className="w-4 h-4" />
                                <span className="hidden sm:inline">Previous</span>
                            </button>

                            {/* Next */}
                            <button
                                onClick={handleNextEp}
                                className="flex-shrink-0 px-4 py-2.5 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-bold flex items-center gap-2 transition-colors"
                            >
                                <span className="hidden sm:inline">Next</span>
                                <ChevronRight className="w-4 h-4" />
                            </button>

                            {/* Quality Selector */}
                            <div className="relative flex-shrink-0 ml-auto z-50">
                                <button
                                    onClick={() => setShowQualityMenu(!showQualityMenu)}
                                    className="h-10 px-4 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white font-medium flex items-center gap-2 transition-colors relative z-10"
                                >
                                    <Settings className="w-4 h-4" />
                                    <span className="hidden sm:inline">
                                        {isAutoQuality ? 'Auto' : streams[selectedStreamIndex]?.quality || 'Quality'}
                                    </span>
                                </button>
                                {showQualityMenu && (
                                    <>
                                        <>
                                            <div className="fixed inset-0 z-50" onClick={() => setShowQualityMenu(false)}></div>
                                            {/* Mobile: Central Modal */}
                                            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#1a1a1a] border border-white/10 rounded-xl p-2 min-w-[200px] shadow-2xl flex flex-col gap-1 z-50 sm:hidden">
                                                <div className="px-3 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 border-b border-white/5">
                                                    Select Quality
                                                </div>
                                                <button
                                                    onClick={setAutoQuality}
                                                    className={`w-full text-left px-4 py-3 text-base rounded-lg transition-colors ${isAutoQuality ? 'bg-yellow-500 text-black font-bold' : 'text-gray-300 hover:bg-white/10'}`}
                                                >
                                                    Auto
                                                </button>
                                                {streams.map((stream, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => handleQualityChange(idx)}
                                                        className={`w-full text-left px-4 py-3 text-base rounded-lg transition-colors ${!isAutoQuality && selectedStreamIndex === idx ? 'bg-yellow-500 text-black font-bold' : 'text-gray-300 hover:bg-white/10'}`}
                                                    >
                                                        {stream.quality ? stream.quality.replace(/\s?p$/i, '') : 'Unknown'}P {stream.isHls && '(HLS)'}
                                                    </button>
                                                ))}
                                            </div>

                                            {/* Desktop: Popover */}
                                            <div className="hidden sm:flex absolute bottom-full right-0 mb-2 bg-[#1a1a1a] border border-white/10 rounded-lg p-1.5 min-w-[140px] shadow-xl flex-col gap-1 z-20">
                                                <button
                                                    onClick={setAutoQuality}
                                                    className={`w-full text-left px-3 py-1.5 text-sm rounded-md transition-colors ${isAutoQuality ? 'bg-yellow-500/20 text-yellow-500' : 'text-gray-300 hover:bg-white/10'}`}
                                                >
                                                    Auto
                                                </button>
                                                {streams.map((stream, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => handleQualityChange(idx)}
                                                        className={`w-full text-left px-3 py-1.5 text-sm rounded-md transition-colors ${!isAutoQuality && selectedStreamIndex === idx ? 'bg-yellow-500/20 text-yellow-500' : 'text-gray-300 hover:bg-white/10'}`}
                                                    >
                                                        {stream.quality ? stream.quality.replace(/\s?p$/i, '') : 'Unknown'}P {stream.isHls && '(HLS)'}
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    </>
                                )}
                            </div>

                            {/* Reload */}
                            <button
                                onClick={reloadPlayer}
                                className="flex-shrink-0 h-10 px-4 rounded-lg bg-transparent hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white font-medium flex items-center gap-2 transition-colors"
                            >
                                <RotateCw className="w-4 h-4" />
                                <span className="hidden sm:inline">Reload</span>
                            </button>

                            {/* Expand */}
                            <button
                                onClick={toggleExpand}
                                className="flex-shrink-0 flex h-10 px-4 rounded-lg bg-transparent hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white font-medium items-center gap-2 transition-colors"
                            >
                                {isExpanded ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                                <span className="hidden sm:inline">{isExpanded ? 'Collapse' : 'Expand'}</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* COLUMN 3: Anime Details (Right Sidebar) */}
                {!isExpanded && (
                    <aside className="w-full md:w-[350px] shrink-0 h-auto md:h-full overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] border-t md:border-t-0 md:border-l border-white/10 bg-black/20 order-3 md:order-3">
                        <div className="p-6 flex flex-col gap-6">
                            {/* Poster - Clickable */}
                            <div
                                className="aspect-[2/3] w-full rounded-xl overflow-hidden shadow-2xl relative group cursor-pointer"
                                onClick={() => navigate(`/anime/${id}`)}
                            >
                                <img
                                    src={animeData.main_picture?.large || animeData.main_picture?.medium || animeData.images?.jpg?.large_image_url}
                                    alt={animeData.title}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                    <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-sm font-medium bg-black/60 px-3 py-1.5 rounded-full">
                                        View Details
                                    </span>
                                </div>
                            </div>

                            {/* Info */}
                            <div className="space-y-4">
                                <div
                                    className="cursor-pointer group"
                                    onClick={() => navigate(`/anime/${id}`)}
                                >
                                    <h2 className="text-xl font-bold leading-tight text-white group-hover:text-yorumi-accent transition-colors">
                                        {animeData.title}
                                    </h2>
                                    <p className="text-sm text-gray-500 mt-1 uppercase tracking-wider font-medium">
                                        {animeData.title_english || animeData.alternative_titles?.en}
                                    </p>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    <span className="px-2 py-0.5 bg-white/10 text-white text-xs font-bold rounded">TV</span>
                                    <span className="px-2 py-0.5 bg-yellow-400 text-black text-xs font-bold rounded flex items-center gap-1">
                                        ★ {animeData.score || animeData.mean}
                                    </span>
                                    <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-bold rounded">HD</span>
                                </div>

                                <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm pt-2">
                                    <div className="flex flex-col">
                                        <span className="text-gray-500 text-xs uppercase font-bold tracking-wider mb-0.5">Aired</span>
                                        <span className="text-gray-300 font-medium">{animeData.start_season?.year || animeData.year || '?'}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-gray-500 text-xs uppercase font-bold tracking-wider mb-0.5">Premiered</span>
                                        <span className="text-gray-300 font-medium">{animeData.season || 'Fall 2004'}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-gray-500 text-xs uppercase font-bold tracking-wider mb-0.5">Status</span>
                                        <span className="text-gray-300 font-medium">{animeData.status}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-gray-500 text-xs uppercase font-bold tracking-wider mb-0.5">Genres</span>
                                        <span className="text-gray-300 font-medium line-clamp-1">
                                            {animeData.genres?.map((g: any) => g.name).join(', ')}
                                        </span>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-white/10">
                                    <p className="text-sm text-gray-400 leading-relaxed">
                                        {animeData.synopsis}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </aside>
                )}

            </div>
        </div>
    );
}

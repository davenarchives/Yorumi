import { useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { usePlayer } from '../features/player/hooks/usePlayer';

// Feature Components
import EpisodeList from '../features/player/components/EpisodeList';
import VideoPlayer from '../features/player/components/VideoPlayer';
import PlayerControls from '../features/player/components/PlayerControls';
import AnimeDetailsSidebar from '../features/anime/components/AnimeDetailsSidebar';

export default function WatchPage() {
    const { id } = useParams<{ title: string; id: string }>();

    const {
        anime,
        episodes,
        currentStream,
        streams,
        error,
        watchedEpisodes,
        epNum,
        cleanCurrentTitle,
        epLoading,
        streamLoading,
        isExpanded,
        isAutoQuality,
        showQualityMenu,
        selectedStreamIndex,
        toggleExpand,
        reloadPlayer,
        handlePrevEp,
        handleNextEp,
        handleEpisodeClick,
        setShowQualityMenu,
        handleQualityChange,
        setAutoQuality,
        navigate
    } = usePlayer(id);

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

    if (!anime) {
        return (
            <div className="flex flex-col items-center justify-center w-full h-screen bg-[#0a0a0a] text-white pt-[72px]">
                <LoadingSpinner />
            </div>
        );
    }

    // Use any cast to avoid type errors with mismatched interface if needed
    const animeData: any = anime;

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
                <EpisodeList
                    episodes={episodes}
                    currentEpNumber={epNum}
                    watchedEpisodes={watchedEpisodes}
                    isLoading={epLoading}
                    onEpisodeClick={handleEpisodeClick}
                />

                {/* COLUMN 2: Player (Center) */}
                <div className="flex-1 min-w-0 relative bg-black flex flex-col order-1 md:order-2">
                    {/* Video Player Container */}
                    <VideoPlayer
                        streamUrl={currentStream?.url}
                        isLoading={streamLoading}
                        isExpanded={isExpanded}
                    />

                    {/* Metadata & Controls Bar (Below Player) */}
                    <PlayerControls
                        animeTitle={animeData.title}
                        episodeNumber={epNum}
                        episodeTitle={cleanCurrentTitle}
                        isExpanded={isExpanded}
                        canPrev={epNum !== '1'}
                        isAutoQuality={isAutoQuality}
                        selectedStreamIndex={selectedStreamIndex}
                        streams={streams}
                        showQualityMenu={showQualityMenu}
                        onPrev={handlePrevEp}
                        onNext={handleNextEp}
                        onReload={reloadPlayer}
                        onToggleExpand={toggleExpand}
                        setShowQualityMenu={setShowQualityMenu}
                        onQualityChange={handleQualityChange}
                        onSetAutoQuality={setAutoQuality}
                    />
                </div>

                {/* COLUMN 3: Anime Details (Right Sidebar) */}
                {!isExpanded && (
                    <AnimeDetailsSidebar
                        anime={anime}
                        currentId={id || ''}
                    />
                )}

            </div>
        </div>
    );
}

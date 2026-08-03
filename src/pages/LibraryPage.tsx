import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Carousel from '../components/ui/Carousel';
import ContinueWatching from '../features/anime/components/ContinueWatching';
import MangaContinueReading from '../features/manga/components/MangaContinueReading';
import LNContinueReading from '../features/ln/components/LNContinueReading';
import { useContinueReading } from '../hooks/useContinueReading';
import { useContinueWatching } from '../hooks/useContinueWatching';
import { useContinueLNReading } from '../hooks/useContinueLNReading';
import { useReadList } from '../hooks/useReadList';
import { useWatchList } from '../hooks/useWatchList';
import { useLNReadList } from '../hooks/useLNReadList';
import { slugify } from '../utils/slugify';
import type { WatchListItem } from '../utils/storage';

const getAnimeRouteId = (item: WatchListItem) => {
    const scraperId = item.scraperId;
    if (String(scraperId || '').startsWith('vault') || item.type === 'Vault Video') {
        return scraperId || `vault-anime:hanime:${item.id}`;
    }
    if (scraperId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(scraperId.replace(/^s:/, ''))) {
        return `s:${scraperId.replace(/^s:/, '')}`;
    }
    return String(item.anilistId || item.id);
};

export default function LibraryPage() {
    const { continueWatchingList, removeFromHistory: removeWatchingHistory } = useContinueWatching();
    const { continueReadingList, removeFromHistory: removeReadingHistory } = useContinueReading();
    const { continueReadingList: continueLNList, removeLNProgress } = useContinueLNReading();
    const { watchList, removeFromWatchList } = useWatchList();
    const { readList, removeFromReadList } = useReadList();
    const { readList: lnReadList, toggleLNReadList } = useLNReadList();
    const navigate = useNavigate();

    const filteredWatching = continueWatchingList;
    const filteredReading = continueReadingList;
    const filteredLN = continueLNList;
    const filteredWatchList = watchList;
    const filteredReadList = readList;
    const filteredLNList = lnReadList;

    const hasContent =
        filteredWatching.length > 0 ||
        filteredReading.length > 0 ||
        filteredLN.length > 0 ||
        filteredWatchList.length > 0 ||
        filteredReadList.length > 0 ||
        filteredLNList.length > 0;

    return (
        <div className="min-h-screen bg-[#0a0a0a] pt-12 pb-24">
            <div className="w-full max-w-7xl mx-auto px-8 md:px-14 relative">
                <div className="mb-8">
                    <h1 className="mb-2 text-2xl font-bold uppercase tracking-wider text-white">
                        MY LIBRARY
                    </h1>
                    <p className="text-sm text-gray-400">
                        Watch history, progress, and saved titles
                    </p>
                </div>

                <div className="space-y-8 pb-12">
                    {!hasContent && (
                        <div className="flex flex-col items-center justify-center py-24 rounded-lg border border-dashed border-white/10 text-gray-500 bg-white/5">
                            <p>Your library is empty. Start exploring to save items here!</p>
                        </div>
                    )}

                    <ContinueWatching
                        title={`Continue Watching (${filteredWatching.length})`}
                        items={filteredWatching}
                        onRemove={removeWatchingHistory}
                        onWatchClick={(anime, episodeNumber, startSeconds) => {
                            const title = slugify(anime.title || 'anime');
                            const routeId = anime.scraperId || anime.id || anime.mal_id;
                            const resume = Number.isFinite(startSeconds) ? Math.max(0, Math.floor(startSeconds || 0)) : 0;
                            navigate(`/anime/details/${routeId}?ep=${episodeNumber}${resume > 0 ? `&t=${resume}` : ''}`);
                        }}
                    />

                    <MangaContinueReading
                        title={`Continue Reading (${filteredReading.length})`}
                        items={filteredReading}
                        onRemove={removeReadingHistory}
                        onReadClick={(mangaId, mangaTitle, chapterNumber) => {
                            const title = slugify(mangaTitle || 'manga');
                            navigate(`/manga/read/${title}/${mangaId}/c${chapterNumber}`);
                        }}
                    />

                    <LNContinueReading
                        title={`Continue Reading Light Novels (${filteredLN.length})`}
                        items={filteredLN}
                        onRemove={removeLNProgress}
                        onReadClick={(novelId, novelTitle, chapterId) => {
                            const title = slugify(novelTitle || 'novel');
                            navigate(`/ln/read/${title}/${novelId}/${encodeURIComponent(chapterId)}`);
                        }}
                    />

                    {filteredWatchList.length > 0 && (
                        <Carousel title={`Watchlist (${filteredWatchList.length})`} variant="portrait">
                            {filteredWatchList.map((item) => (
                                <div
                                    key={item.id}
                                    className="relative group h-full cursor-pointer"
                                    onClick={() => {
                                        const routeId = getAnimeRouteId(item);
                                        navigate(`/anime/details/${routeId}`);
                                    }}
                                >
                                    <div className="relative aspect-[3/4] rounded-xl overflow-hidden mb-3 shadow-lg border border-white/5 transition-colors cursor-pointer">
                                        {item.image && <img src={item.image} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />}
                                        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center" />
                                        <button
                                            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 backdrop-blur hover:bg-red-500/80 text-white/80 hover:text-white transition-all opacity-0 group-hover:opacity-100 z-10"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeFromWatchList(item.id);
                                            }}
                                            title="Remove from watchlist"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                    <div className="px-1">
                                        <h4 className="text-sm font-bold text-white/90 truncate group-hover:text-yorumi-accent transition-colors">{item.title}</h4>
                                    </div>
                                </div>
                            ))}
                        </Carousel>
                    )}

                    {filteredReadList.length > 0 && (
                        <Carousel title={`Manga Readlist (${filteredReadList.length})`} variant="portrait">
                            {filteredReadList.map((item) => (
                                <div
                                    key={item.id}
                                    className="relative group h-full cursor-pointer"
                                    onClick={() => {
                                        const mangaRouteId = String(item.scraperId || '').startsWith('vault') ? item.scraperId : item.id;
                                        navigate(`/manga/details/${mangaRouteId}`);
                                    }}
                                >
                                    <div className="relative aspect-[3/4] rounded-xl overflow-hidden mb-3 shadow-lg border border-white/5 transition-colors cursor-pointer">
                                        {item.image && <img src={item.image} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />}
                                        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center" />
                                        <button
                                            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 backdrop-blur hover:bg-red-500/80 text-white/80 hover:text-white transition-all opacity-0 group-hover:opacity-100 z-10"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeFromReadList(item.id);
                                            }}
                                            title="Remove from readlist"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                    <div className="px-1">
                                        <h4 className="text-sm font-bold text-white/90 truncate group-hover:text-yorumi-manga transition-colors">{item.title}</h4>
                                    </div>
                                </div>
                            ))}
                        </Carousel>
                    )}

                    {filteredLNList.length > 0 && (
                        <Carousel title={`Novellist (${filteredLNList.length})`} variant="portrait">
                            {filteredLNList.map((item) => (
                                <div
                                    key={item.id}
                                    className="relative group h-full cursor-pointer"
                                    onClick={() => {
                                        navigate(`/ln/details/${item.id}`);
                                    }}
                                >
                                    <div className="relative aspect-[3/4] rounded-xl overflow-hidden mb-3 shadow-lg border border-white/5 transition-colors cursor-pointer">
                                        {item.image && <img src={item.image} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />}
                                        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center" />
                                        <button
                                            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 backdrop-blur hover:bg-red-500/80 text-white/80 hover:text-white transition-all opacity-0 group-hover:opacity-100 z-10"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleLNReadList(item);
                                            }}
                                            title="Remove from novellist"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                    <div className="px-1">
                                        <h4 className="text-sm font-bold text-white/90 truncate group-hover:text-amber-400 transition-colors">{item.title}</h4>
                                    </div>
                                </div>
                            ))}
                        </Carousel>
                    )}
                </div>
            </div>
        </div>
    );
}

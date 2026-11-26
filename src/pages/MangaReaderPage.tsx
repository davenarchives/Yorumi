import { useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useManga, collectMangaHistoryKeys } from '../hooks/useManga';
import { storage } from '../utils/storage';
import { slugify } from '../utils/slugify';
import MangaReaderModal from '../features/manga/components/MangaReaderModal';
import type { MangaChapter } from '../types/manga';
import sleepingGif from '../assets/sleeping.gif';
import { enterImmersiveMode, exitImmersiveMode } from '../platform/immersiveMode';
import { offlineLibraryCache } from '../services/offlineLibraryCache';

export default function MangaReaderPage() {
    const { id, chapter } = useParams<{ title: string; id: string; chapter: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const routeManga = location.state?.manga;
    const routeChapter = location.state?.chapter as MangaChapter | undefined;

    useEffect(() => {
        enterImmersiveMode().catch((error) => console.warn('Unable to enter immersive reader mode:', error));
        return () => {
            exitImmersiveMode().catch((error) => console.warn('Unable to exit immersive reader mode:', error));
        };
    }, []);

    const {
        selectedManga,
        mangaChapters,
        currentMangaChapter,
        chapterPages,
        mangaChaptersLoading,
        mangaPagesLoading,
        chapterSearchQuery,
        zoomLevel,
        mangaLoading,
        setChapterSearchQuery,
        fetchMangaDetails,
        loadMangaChapter,
        fetchChapterPagesDirect,
        setActiveChapterSilent,
        prefetchChapter,
        zoomIn,
        zoomOut,
        readChapters
    } = useManga();

    // Fetch manga details on mount
    useEffect(() => {
        if (id) {
            fetchMangaDetails(id, routeManga);
        }
    }, [id, routeManga, fetchMangaDetails]);

    // Auto-load chapter when chapters are available
    useEffect(() => {
        if (routeChapter && !currentMangaChapter) {
            loadMangaChapter(routeChapter);
            return;
        }
        if (mangaChapters.length > 0 && chapter && !currentMangaChapter) {
            // Find chapter by number (chapter param is like "c4" or "c2.1" from URL, strip the 'c' prefix)
            const chapterNumStr = (chapter.startsWith('c') ? chapter.slice(1) : chapter).trim();
            const chapterNum = parseFloat(chapterNumStr);
            const targetChapter = mangaChapters.find(ch => {
                const match = ch.title.match(/Chapter\s+(\d+[.]?\d*)/i);
                if (!match) return false;
                return match[1] === chapterNumStr || (Number.isFinite(chapterNum) && parseFloat(match[1]) === chapterNum);
            });

            if (targetChapter) {
                loadMangaChapter(targetChapter);
            } else if (mangaChapters.length > 0) {
                // Fallback: load first chapter if target not found
                console.warn(`Chapter ${chapter} not found, loading first available`);
                loadMangaChapter(mangaChapters[mangaChapters.length - 1]);
            }
        }
    }, [mangaChapters, chapter, currentMangaChapter, loadMangaChapter, routeChapter]);

    const activeManga = selectedManga || routeManga;

    // Always mark the active chapter as read under all known IDs (route ID + routeManga + selectedManga),
    // even when opened offline or before selectedManga finishes hydrating on mount.
    useEffect(() => {
        if (!currentMangaChapter?.id) return;
        const keys = collectMangaHistoryKeys(activeManga, [id, routeManga?.mal_id, routeManga?.id, routeManga?.scraper_id]);
        if (keys.length > 0) {
            storage.markChapterAsRead(keys, currentMangaChapter.id);
        }
    }, [currentMangaChapter?.id, activeManga, id, routeManga]);

    const effectiveReadChapters = (() => {
        const keys = collectMangaHistoryKeys(activeManga, [id, routeManga?.mal_id, routeManga?.id, routeManga?.scraper_id]);
        const merged = new Set<string>(readChapters);
        for (const chId of storage.getReadChapters(keys)) {
            merged.add(chId);
        }
        if (currentMangaChapter?.id) {
            merged.add(currentMangaChapter.id);
        }
        return merged;
    })();

    const cachedOfflineChapters = offlineLibraryCache.getMangaChapters([
        id,
        activeManga?.id,
        activeManga?.mal_id,
        activeManga?.scraper_id,
    ]);

    const effectiveChapters = mangaChapters.length > 0
        ? mangaChapters
        : cachedOfflineChapters.length > 0
            ? cachedOfflineChapters
            : routeChapter
                ? [routeChapter]
                : [];

    // Handle chapter navigation - update URL
    const handleLoadChapter = (ch: MangaChapter) => {
        if (activeManga) {
            const title = slugify(activeManga.title || 'manga');
            const chapterMatch = ch.title.match(/Chapter\s+(\d+[.]?\d*)/i);
            const chapterNum = chapterMatch ? chapterMatch[1] : '1';
            navigate(`/manga/read/${title}/${id}/c${chapterNum}`, { replace: true, state: { manga: activeManga, chapter: ch } });
        }
        loadMangaChapter(ch);
    };

    // Silent chapter sync when seamlessly scrolling across chapters in longstrip mode
    const handleActiveChapterChange = (ch: MangaChapter) => {
        setActiveChapterSilent(ch);
        if (activeManga) {
            const title = slugify(activeManga.title || 'manga');
            const chapterMatch = ch.title.match(/Chapter\s+(\d+[.]?\d*)/i);
            const chapterNum = chapterMatch ? chapterMatch[1] : '1';
            const nextPath = `/manga/read/${title}/${id}/c${chapterNum}`;
            if (window.location.pathname !== nextPath) {
                window.history.replaceState(window.history.state, '', nextPath);
            }
        }
    };

    // Handle close - go back to details
    const handleClose = () => {
        if (id) {
            navigate(`/manga/details/${encodeURIComponent(id)}`, { replace: true, state: { manga: activeManga } });
        } else {
            navigate('/manga', { replace: true });
        }
    };

    // Show loading while manga, chapters, or chapter pages are loading
    if ((mangaLoading && !activeManga) || (mangaChaptersLoading && !routeChapter && cachedOfflineChapters.length === 0) || !activeManga || (!currentMangaChapter && effectiveChapters.length > 0)) {
        return (
            <div className="fixed inset-0 z-[130] md:z-[90] flex flex-col items-center justify-center gap-4 bg-black/95 backdrop-blur-md text-center">
                <img src={sleepingGif} alt="Loading..." className="w-32 h-32 object-contain animate-bounce" />
                <p className="text-yorumi-manga font-bold text-base tracking-wide animate-pulse">Loading chapter content...</p>
            </div>
        );
    }

    // Handle case where no chapters exist
    if (effectiveChapters.length === 0) {
        const sourceName = activeManga?.scraper_id?.toString().startsWith('vault:') ? 'Toonily' : 'MangaKatana';
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a] text-white gap-4">
                <div className="text-6xl font-black text-white/10">!</div>
                <h1 className="text-2xl font-bold">No Chapters Available</h1>
                <p className="text-gray-400">This manga doesn't have any readable chapters available on {sourceName}.</p>
                <button
                    onClick={() => navigate(`/manga/details/${id}`)}
                    className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-full font-bold transition-colors mt-4"
                >
                    Go Back
                </button>
            </div>
        );
    }

    return (
        <MangaReaderModal
            isOpen={true}
            onClose={handleClose}
            manga={activeManga}
            chapters={effectiveChapters}
            currentChapter={currentMangaChapter}
            pages={chapterPages}
            chapterSearchQuery={chapterSearchQuery}
            chaptersLoading={mangaChaptersLoading}
            pagesLoading={mangaPagesLoading}
            zoomLevel={zoomLevel}
            onChapterSearchChange={setChapterSearchQuery}
            onLoadChapter={handleLoadChapter}
            onActiveChapterChange={handleActiveChapterChange}
            onFetchChapterPages={fetchChapterPagesDirect}
            onPrefetchChapter={prefetchChapter}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            readChapters={effectiveReadChapters}
        />
    );
}

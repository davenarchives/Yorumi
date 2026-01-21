import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useManga } from '../hooks/useManga';
import { slugify } from '../utils/slugify';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import MangaReaderModal from '../features/manga/components/MangaReaderModal';

export default function MangaReaderPage() {
    const { id, chapter } = useParams<{ title: string; id: string; chapter: string }>();
    const navigate = useNavigate();

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
        prefetchChapter,
        zoomIn,
        zoomOut,
        readChapters
    } = useManga();

    // Fetch manga details on mount
    useEffect(() => {
        if (id) {
            fetchMangaDetails(id);
        }
    }, [id, fetchMangaDetails]);

    // Auto-load chapter when chapters are available
    useEffect(() => {
        if (mangaChapters.length > 0 && chapter && !currentMangaChapter) {
            // Find chapter by number (chapter param is like "c4" from URL, strip the 'c' prefix)
            const chapterNumStr = chapter.startsWith('c') ? chapter.slice(1) : chapter;
            const chapterNum = parseInt(chapterNumStr);
            const targetChapter = mangaChapters.find(ch => {
                const match = ch.title.match(/Chapter\s+(\d+)/i);
                return match && parseInt(match[1]) === chapterNum;
            });

            if (targetChapter) {
                loadMangaChapter(targetChapter);
            } else if (mangaChapters.length > 0) {
                // Fallback: load first chapter if target not found
                console.warn(`Chapter ${chapter} not found, loading first available`);
                loadMangaChapter(mangaChapters[mangaChapters.length - 1]);
            }
        }
    }, [mangaChapters, chapter, currentMangaChapter, loadMangaChapter]);

    // Handle chapter navigation - update URL
    const handleLoadChapter = (ch: any) => {
        if (selectedManga) {
            const title = slugify(selectedManga.title || 'manga');
            const chapterMatch = ch.title.match(/Chapter\s+(\d+)/i);
            const chapterNum = chapterMatch ? chapterMatch[1] : '1';
            navigate(`/manga/read/${title}/${id}/c${chapterNum}`, { replace: true });
        }
        loadMangaChapter(ch);
    };

    // Handle close - go back to details
    // Don't call closeMangaReader() as it uses history.back() which conflicts with navigate()
    const handleClose = () => {
        if (id) {
            navigate(`/manga/details/${id}`);
        } else {
            navigate('/manga');
        }
    };

    // Show loading while manga or chapters are loading
    if (mangaLoading || mangaChaptersLoading || !selectedManga) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
                <LoadingSpinner size="lg" text="Loading Manga..." />
            </div>
        );
    }

    // Show loading while waiting for chapter to load
    if (!currentMangaChapter && mangaChapters.length > 0) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
                <LoadingSpinner size="lg" text="Loading Chapter..." />
            </div>
        );
    }

    // Handle case where no chapters exist
    if (mangaChapters.length === 0) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a] text-white gap-4">
                <div className="text-6xl font-black text-white/10">!</div>
                <h1 className="text-2xl font-bold">No Chapters Available</h1>
                <p className="text-gray-400">This manga doesn't have any chapters on MangaKatana.</p>
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
            manga={selectedManga}
            chapters={mangaChapters}
            currentChapter={currentMangaChapter}
            pages={chapterPages}
            chapterSearchQuery={chapterSearchQuery}
            chaptersLoading={mangaChaptersLoading}
            pagesLoading={mangaPagesLoading}
            zoomLevel={zoomLevel}
            onChapterSearchChange={setChapterSearchQuery}
            onLoadChapter={handleLoadChapter}
            onPrefetchChapter={prefetchChapter}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            readChapters={readChapters}
        />
    );
}

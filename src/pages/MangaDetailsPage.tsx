import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Check, Plus } from 'lucide-react';
import { useManga } from '../hooks/useManga';
import { storage } from '../utils/storage';
import LoadingSpinner from '../components/LoadingSpinner';
import MangaCard from '../components/MangaCard';
import MangaReaderModal from '../components/modals/MangaReaderModal';
import type { MangaChapter } from '../types/manga';

// Chapter Grid for Details Page
const ChapterList = ({
    chapters,
    onChapterClick
}: {
    chapters: MangaChapter[],
    onChapterClick: (ch: MangaChapter) => void
}) => {
    // Determine reasonable pagination
    const ITEMS_PER_PAGE = 30;
    const [page, setPage] = useState(1);

    // Sort ascending (Chapter 1 -> Latest) by reversing the array
    const sortedChapters = [...chapters].reverse();

    const totalPages = Math.ceil(sortedChapters.length / ITEMS_PER_PAGE);
    const currentChapters = sortedChapters.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    return (
        <div className="mt-6">
            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
                {currentChapters.map((ch, index) => {
                    // Extract just the number or short identifier
                    const match = ch.title.match(/Chapter\s+(\d+[\.]?\d*)/i);
                    const displayNum = match ? match[1] : ch.title.replace('Chapter', '').trim();

                    return (
                        <button
                            key={`chapter-${ch.id}-${index}`}
                            onClick={() => onChapterClick(ch)}
                            className="aspect-square flex items-center justify-center rounded transition-all duration-200 relative group bg-white/10 hover:bg-yorumi-accent hover:text-black hover:scale-105 hover:shadow-lg hover:shadow-yorumi-accent/20 text-gray-300 cursor-pointer border border-white/5 hover:border-yorumi-accent overflow-hidden"
                            title={ch.title}
                        >
                            <span className="text-xs text-center font-bold line-clamp-4 px-1 break-words leading-tight">{displayNum}</span>
                        </button>
                    );
                })}
            </div>

            {totalPages > 1 && (
                <div className="flex flex-col items-center gap-4 mt-8">
                    <div className="flex flex-wrap justify-center gap-2">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                            <button
                                key={p}
                                onClick={() => setPage(p)}
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-colors flex-shrink-0
                                    ${page === p ? 'bg-yorumi-500 text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20'}`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                    <span className="text-xs text-gray-500">
                        Showing {(page - 1) * ITEMS_PER_PAGE + 1} - {Math.min(page * ITEMS_PER_PAGE, sortedChapters.length)} of {sortedChapters.length} chapters
                    </span>
                </div>
            )}
        </div>
    );
};

export default function MangaDetailsPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();

    // Use the useManga hook logic locally for this page
    const {
        selectedManga,
        mangaChapters,
        currentMangaChapter,
        chapterPages,
        mangaChaptersLoading,
        mangaPagesLoading,
        chapterSearchQuery,
        zoomLevel,
        mangaLoading, // This tracks the details fetching
        setChapterSearchQuery,
        fetchMangaDetails,
        loadMangaChapter,
        prefetchChapter,
        closeMangaReader,
        zoomIn,
        zoomOut
    } = useManga();

    const [activeTab, setActiveTab] = useState<'summary' | 'relations'>('summary');

    // Fetch details on mount or ID change
    const lastFetchedId = useRef<string | null>(null);

    // Fetch details on mount or ID change
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });

        // Prevent infinite loops / duplicate fetches
        if (id && id !== lastFetchedId.current) {
            console.log(`[MangaDetailsPage] Fetching details for ID: ${id}`);
            lastFetchedId.current = id;
            fetchMangaDetails(id);
        }
    }, [id]);

    console.log('[MangaDetailsPage] Rendered with ID:', id);

    const handleBack = () => {
        if (location.state?.from) {
            navigate(-1);
        } else {
            navigate('/manga');
        }
    };

    if (mangaLoading || !selectedManga) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <LoadingSpinner size="lg" text="Loading Manga Details..." />
            </div>
        );
    }

    // Determine banner
    // If we have no banner, use the large cover logic or a blur
    const bannerImage = selectedManga.images.jpg.large_image_url;

    return (
        <div className="min-h-screen bg-[#0a0a0a] pb-20 fade-in animate-in duration-300">
            {/* 1. Header Hero */}
            <div className="relative h-[40vh] md:h-[50vh] w-full overflow-hidden">
                {/* Background Image with Blur */}
                <div className="absolute inset-0">
                    <img
                        src={bannerImage}
                        alt={selectedManga.title}
                        className="w-full h-full object-cover blur-xl opacity-40 scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/60 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#0a0a0a] to-transparent" />
                </div>

                <button
                    onClick={handleBack}
                    className="absolute top-20 md:top-24 left-4 md:left-6 z-50 p-3 bg-black/50 hover:bg-white/20 rounded-full backdrop-blur-sm transition-colors text-white"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>
            </div>

            {/* 2. Content */}
            <div className="container mx-auto px-4 md:px-6 -mt-24 md:-mt-32 relative z-10">
                <div className="flex flex-col md:flex-row gap-6 md:gap-8">
                    {/* Poster */}
                    <div className="flex-shrink-0 mx-auto md:mx-0 w-48 sm:w-64 md:w-72 group">
                        <div className="rounded-xl overflow-hidden shadow-2xl shadow-black/50 aspect-[2/3]">
                            <img
                                src={selectedManga.images.jpg.large_image_url}
                                alt={selectedManga.title}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                        </div>
                    </div>

                    {/* Meta Data */}
                    <div className="flex-1 pt-4 md:pt-8 text-center md:text-left space-y-4">
                        <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-white leading-tight">
                            {selectedManga.title}
                        </h1>

                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-sm">
                            <span className="bg-[#facc15] text-black px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1">
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                                {selectedManga.score}
                            </span>

                            {/* Origin / Type Badge */}
                            <span className={`px-2.5 py-1 rounded text-xs font-bold ${selectedManga.countryOfOrigin === 'KR' ? 'bg-blue-500 text-white' :
                                selectedManga.countryOfOrigin === 'CN' ? 'bg-red-500 text-white' :
                                    'bg-white/10 text-gray-300'
                                }`}>
                                {selectedManga.countryOfOrigin === 'KR' ? 'Manhwa' :
                                    selectedManga.countryOfOrigin === 'CN' ? 'Manhua' :
                                        'Manga'}
                            </span>

                            {/* Status */}
                            <span className="px-2.5 py-1 bg-white/10 rounded text-gray-300 text-xs">
                                {selectedManga.status}
                            </span>

                            {/* Chapter Count */}
                            {(selectedManga.chapters || mangaChapters.length > 0) && (
                                <span className="bg-[#22c55e] text-white px-2.5 py-1 rounded text-xs font-bold">
                                    {mangaChapters.length > 0 ? mangaChapters.length : selectedManga.chapters} Chapters
                                </span>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-row items-center justify-center md:justify-start gap-4 py-2">
                            <button
                                onClick={() => {
                                    // Start reading first chapter (last in array since MK returns newest-first)
                                    if (mangaChapters.length > 0) {
                                        const firstChapter = mangaChapters[mangaChapters.length - 1];
                                        loadMangaChapter(firstChapter);
                                    }
                                }}
                                disabled={mangaChaptersLoading}
                                className="h-12 px-8 bg-[#facc15] hover:bg-[#ffe066] disabled:opacity-50 disabled:cursor-not-allowed text-black text-lg font-bold rounded-full transition-transform active:scale-95 flex items-center gap-3 shadow-lg shadow-yellow-500/20"
                            >
                                {mangaChaptersLoading ? 'Loading Chapters...' : 'Read Now'}
                            </button>
                            <button
                                onClick={() => {
                                    if (storage.isInReadList(selectedManga.mal_id.toString())) {
                                        storage.removeFromReadList(selectedManga.mal_id.toString());
                                        // Force list update (hacky, ideally use context/event)
                                        navigate('.', { replace: true });
                                    } else {
                                        storage.addToReadList({
                                            id: selectedManga.mal_id.toString(),
                                            title: selectedManga.title,
                                            image: selectedManga.images.jpg.large_image_url
                                        });
                                        navigate('.', { replace: true });
                                    }
                                }}
                                className={`h-12 px-8 text-lg font-bold rounded-full transition-colors border flex items-center gap-2 ${storage.isInReadList(selectedManga.mal_id.toString())
                                        ? 'bg-yorumi-accent text-black border-yorumi-accent'
                                        : 'bg-white/10 hover:bg-white/20 text-white border-white/10'
                                    }`}
                            >
                                {storage.isInReadList(selectedManga.mal_id.toString()) ? (
                                    <>
                                        <Check className="w-5 h-5" />
                                        In List
                                    </>
                                ) : (
                                    <>
                                        <Plus className="w-5 h-5" />
                                        Add to List
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex items-center gap-8 border-b border-white/10 mb-6">
                            <button
                                onClick={() => setActiveTab('summary')}
                                className={`pb-3 text-lg font-bold transition-colors relative ${activeTab === 'summary' ? 'text-white' : 'text-gray-500 hover:text-white'}`}
                            >
                                Summary
                                {activeTab === 'summary' && <div className="absolute bottom-0 inset-x-0 h-0.5 bg-pink-500" />}
                            </button>
                            <button
                                onClick={() => setActiveTab('relations')}
                                className={`pb-3 text-lg font-bold transition-colors relative ${activeTab === 'relations' ? 'text-white' : 'text-gray-500 hover:text-white'}`}
                            >
                                Relations
                                {activeTab === 'relations' && <div className="absolute bottom-0 inset-x-0 h-0.5 bg-pink-500" />}
                            </button>
                        </div>

                        {activeTab === 'summary' && (
                            <>
                                <p className="text-gray-300 text-base leading-relaxed max-w-3xl">
                                    {selectedManga.synopsis || 'No synopsis available.'}
                                </p>

                                {/* Synonyms Section - English only */}
                                {(() => {
                                    // Only pure English: Latin chars without accents
                                    const isEnglishOnly = (s: string) => /^[a-zA-Z0-9\s\-':!?.,"()]+$/.test(s);
                                    const englishSynonyms = (selectedManga.synonyms || []).filter(isEnglishOnly);
                                    return englishSynonyms.length > 0 ? (
                                        <div className="py-4 mt-4">
                                            <h4 className="text-sm font-bold text-gray-400 mb-2">Also Known As</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {englishSynonyms.map((syn, i) => (
                                                    <span
                                                        key={i}
                                                        className="px-2 py-1 bg-white/5 rounded text-gray-400 text-xs hover:bg-white/10 transition-colors"
                                                    >
                                                        {syn}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ) : null;
                                })()}

                                {/* Chapters Section */}
                                <div id="chapters-section" className="py-6 border-t border-white/10 mt-6">
                                    <h3 className="text-xl font-bold text-white mb-4">Chapters</h3>
                                    {mangaChaptersLoading ? (
                                        <div className="py-8 flex justify-center"><LoadingSpinner size="md" /></div>
                                    ) : mangaChapters.length > 0 ? (
                                        <ChapterList
                                            chapters={mangaChapters}
                                            onChapterClick={loadMangaChapter}
                                        />
                                    ) : (
                                        <div className="text-gray-500 text-center py-4">
                                            No chapters found on MangaKatana.
                                        </div>
                                    )}
                                </div>

                                {/* Characters Section (if available) */}
                                {(selectedManga as any).characters?.edges?.length > 0 && (
                                    <div className="py-6 border-t border-white/10 mt-6">
                                        <h3 className="text-xl font-bold text-white mb-4">Characters</h3>
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                            {(selectedManga as any).characters.edges.slice(0, 8).map((char: any, i: number) => (
                                                <div key={i} className="flex items-center gap-3 bg-white/5 p-2 rounded-lg">
                                                    <img
                                                        src={char.node.image?.large}
                                                        alt={char.node.name?.full}
                                                        className="w-12 h-12 rounded object-cover"
                                                    />
                                                    <div>
                                                        <p className="text-sm font-bold text-gray-200 line-clamp-1">{char.node.name?.full}</p>
                                                        <p className="text-xs text-gray-500 uppercase">{char.role}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {activeTab === 'relations' && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                {/* Use `relations` from enriched data */}
                                {(selectedManga as any).relations?.edges?.map((edge: any) => (
                                    <MangaCard
                                        key={edge.node.id}
                                        manga={{
                                            mal_id: edge.node.id,
                                            title: edge.node.title.romaji,
                                            images: { jpg: { large_image_url: edge.node.coverImage.large, image_url: edge.node.coverImage.large } },
                                            type: edge.node.format,
                                            status: 'Unknown',
                                            chapters: 0,
                                            volumes: 0,
                                            score: 0
                                        }}
                                        onClick={() => navigate(`/manga/${edge.node.id}`)}
                                    />
                                )) || <div className="text-gray-500">No relations found.</div>}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Reader Modal */}
            <MangaReaderModal
                isOpen={!!currentMangaChapter}
                onClose={closeMangaReader}
                manga={selectedManga}
                chapters={mangaChapters}
                currentChapter={currentMangaChapter}
                pages={chapterPages}
                chapterSearchQuery={chapterSearchQuery}
                chaptersLoading={mangaChaptersLoading}
                pagesLoading={mangaPagesLoading}
                zoomLevel={zoomLevel}
                onChapterSearchChange={setChapterSearchQuery}
                onLoadChapter={loadMangaChapter}
                onPrefetchChapter={prefetchChapter}
                onZoomIn={zoomIn}
                onZoomOut={zoomOut}
            />
        </div>
    );
}

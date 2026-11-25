import { supportsReadingExports } from '../platform/tauri/readingExports';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { lnService } from '../services/lnService';
import type { LightNovel, LNChapter } from '../types/ln';
import { useLNReadList } from '../hooks/useLNReadList';
import { useFavoriteLN } from '../hooks/useFavoriteLN';
import { useContinueLNReading } from '../hooks/useContinueLNReading';
import { useTitleLanguage } from '../context/TitleLanguageContext';
import { getDisplayTitle } from '../utils/titleLanguage';
import { slugify } from '../utils/slugify';
import { Play, Download, FolderOpen, ArrowLeft, ArrowUpDown, Grid2X2, List } from 'lucide-react';
import { useChapterViewMode, type ChapterViewMode } from '../components/ui/ChapterViewToggle';
import { useLNDownloads } from '../hooks/useLNDownloads';
import { downloadService } from '../services/downloadService';
import DownloadStateIcon from '../components/ui/DownloadStateIcon';
import ReadingDetailsHero from '../features/reading/components/ReadingDetailsHero';
import MoreLikeReading from '../features/reading/components/MoreLikeReading';
import DetailsCharacters from '../features/anime/components/details/DetailsCharacters';
import type { Anime } from '../types/anime';

// Chapter Grid Component matching Manga details format
const LNChapterList = ({
    chapters,
    readChapters,
    onChapterClick,
    viewMode = 'list',
    onViewModeChange,
    novelId,
    novelTitle,
    novelImage,
    author,
    headerActions,
}: {
    chapters: LNChapter[];
    readChapters: Set<string>;
    onChapterClick: (ch: LNChapter) => void;
    viewMode?: ChapterViewMode;
    onViewModeChange?: (mode: ChapterViewMode) => void;
    novelId?: string;
    novelTitle?: string;
    novelImage?: string;
    author?: string;
    headerActions?: React.ReactNode;
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const { isChapterDownloaded, getDownloadProgress, startDownload, deleteDownload } = useLNDownloads();

    const filteredChapters = useMemo(() => {
        return chapters.filter((ch) =>
            ch.title.toLowerCase().includes(searchQuery.toLowerCase()) || String(ch.number).includes(searchQuery)
        );
    }, [chapters, searchQuery]);

    const sortedChapters = useMemo(() => {
        const list = [...filteredChapters];
        if (sortOrder === 'desc') {
            list.reverse();
        }
        return list;
    }, [filteredChapters, sortOrder]);

    const currentChapters = sortedChapters;

    useEffect(() => {
        const toggleSort = () => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
        const toggleView = () => onViewModeChange?.(viewMode === 'list' ? 'grid' : 'list');
        window.addEventListener('yorumi:ln:toggle-sort', toggleSort);
        window.addEventListener('yorumi:ln:toggle-view', toggleView);
        return () => {
            window.removeEventListener('yorumi:ln:toggle-sort', toggleSort);
            window.removeEventListener('yorumi:ln:toggle-view', toggleView);
        };
    }, [onViewModeChange, viewMode]);

    return (
        <div className="mt-4 sm:mt-6 bg-transparent p-0">
            <div className="mb-4 flex items-center gap-4 md:hidden">
                <h3 className="whitespace-nowrap text-[22px] font-semibold text-white">
                    Chapters <span className="text-sm font-bold text-gray-500">({chapters.length})</span>
                </h3>
                <div className="h-px flex-1 bg-white/10" />
            </div>
            {/* Uniform Toolbar matching DetailsEpisodeGrid */}
            <div className="hidden md:flex flex-wrap items-center justify-between gap-3 mb-6">
                <div className="flex flex-wrap items-center gap-2.5">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search chapters"
                        className="h-10 min-w-0 w-60 md:w-64 rounded-full bg-white/[0.10] px-4 text-[14px] font-semibold text-white placeholder-white/50 transition-colors focus:bg-white/[0.15] border-0 outline-none focus:outline-none"
                    />
                    <button
                        type="button"
                        onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                        className="flex h-10 items-center gap-1.5 rounded-full bg-white/[0.10] px-4 text-[14px] font-bold text-white transition-colors hover:bg-white/[0.15] border-0 outline-none focus:outline-none cursor-pointer"
                        title={sortOrder === 'asc' ? 'Sorted oldest first' : 'Sorted newest first'}
                    >
                        <ArrowUpDown className="h-3.5 w-3.5 text-white/80" />
                        <span>{sortOrder === 'asc' ? 'Oldest' : 'Newest'}</span>
                    </button>
                    {onViewModeChange && (
                        <button
                            type="button"
                            onClick={() => onViewModeChange(viewMode === 'list' ? 'grid' : 'list')}
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.10] text-white/80 transition-colors hover:bg-white/[0.15] hover:text-white border-0 outline-none focus:outline-none cursor-pointer"
                            title={viewMode === 'list' ? 'Switch to grid view' : 'Switch to list view'}
                            aria-label={viewMode === 'list' ? 'Switch to grid view' : 'Switch to list view'}
                        >
                            {viewMode === 'list' ? <Grid2X2 className="h-4 w-4" /> : <List className="h-4 w-4" />}
                        </button>
                    )}
                    {headerActions}
                </div>
                <span className="text-[13.5px] font-bold text-white/75">
                    {chapters.filter((ch) => readChapters.has(String(ch.id))).length}/{chapters.length} read
                </span>
            </div>

            {viewMode === 'grid' ? (
                <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
                    {currentChapters.map((ch, index) => {
                        const isRead = readChapters.has(String(ch.id));
                        const isDownloaded = isChapterDownloaded(novelId, ch.id);
                        const progress = getDownloadProgress(novelId, ch.id);
                        const isDownloading = progress?.status === 'downloading';

                        const titleMatch = ch.title.match(/^(Arc\s+\d+[\s–—,-]*(?:Chapter\s*)?[\d.]+|Vol(?:ume)?\s*[\d.]+\s*(?:Chapter\s*)?[\d.]+|Chapter\s+[\d.]+|Ch\.\s*[\d.]+)(?:\s*[:–—,-]\s*["'«]?(.*?)["'»]?)?$/i);
                        const mainStr = titleMatch ? titleMatch[1].trim() : ch.title.split(/[:–—]/)[0].trim();
                        const subMatch = titleMatch ? titleMatch[2] : (ch.title.includes(':') || ch.title.includes('–') ? ch.title.split(/[:–—]/).slice(1).join(' ').trim() : '');
                        const subtitleStr = subMatch ? subMatch.replace(/^["'«]|["'»]$/g, '').trim() : '';

                        return (
                            <div
                                key={`${ch.id}-${index}`}
                                role="button"
                                tabIndex={0}
                                onClick={() => onChapterClick(ch)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        onChapterClick(ch);
                                    }
                                }}
                                title={ch.title}
                                data-label={mainStr}
                                className={`relative aspect-square flex items-center justify-center rounded-[14px] transition-all duration-200 text-center group
                                    ${isRead ? 'opacity-50 bg-white/[0.04]' : 'bg-white/[0.06] hover:bg-white/[0.09]'} active:scale-95 cursor-pointer`}
                            >
                                <span className={`font-semibold text-sm leading-tight ${isRead ? 'text-gray-400' : 'text-gray-100 group-hover:text-amber-400'} transition-colors line-clamp-2`}>
                                    {ch.number}
                                </span>
                                {subtitleStr && (
                                    <span className="hidden">
                                        {subtitleStr}
                                    </span>
                                )}
                                <button
                                    type="button"
                                    className="absolute top-0.5 right-0.5 z-20 flex h-7 w-7 items-center justify-center rounded-full text-zinc-300 hover:bg-white/10 active:bg-white/15 cursor-pointer"
                                    aria-label={isDownloaded ? 'Delete downloaded chapter' : 'Download chapter'}
                                    disabled={isDownloading}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        if (isDownloading) return;
                                        if (isDownloaded) {
                                            if (novelId) deleteDownload(novelId, ch.id);
                                        } else {
                                            startDownload({
                                                novelId: novelId || '',
                                                novelTitle: novelTitle || 'Novel',
                                                novelImage: novelImage || '',
                                                chapter: ch,
                                            });
                                        }
                                    }}
                                >
                                    <DownloadStateIcon state={isDownloading ? 'downloading' : isDownloaded ? 'downloaded' : 'available'} progress={progress?.progress || 0} className="h-4 w-4" />
                                </button>
                            </div>
                        );
                    })}
                    {currentChapters.length === 0 && (
                        <div className="col-span-full text-center py-8 text-gray-500">
                            No chapters found matching "{searchQuery}"
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex flex-col divide-y divide-white/[0.05]">
                    {currentChapters.map((ch, index) => {
                        const isRead = readChapters.has(String(ch.id));
                        const isDownloaded = isChapterDownloaded(novelId, ch.id);
                        const progress = getDownloadProgress(novelId, ch.id);
                        const isDownloading = progress?.status === 'downloading';

                        const titleMatch = ch.title.match(/^(Arc\s+\d+[\s–—,-]*(?:Chapter\s*)?[\d.]+|Vol(?:ume)?\s*[\d.]+\s*(?:Chapter\s*)?[\d.]+|Chapter\s+[\d.]+|Ch\.\s*[\d.]+)(?:\s*[:–—,-]\s*["'«]?(.*?)["'»]?)?$/i);
                        const mainStr = titleMatch ? titleMatch[1].trim() : ch.title.split(/[:–—]/)[0].trim();
                        const subMatch = titleMatch ? titleMatch[2] : (ch.title.includes(':') || ch.title.includes('–') ? ch.title.split(/[:–—]/).slice(1).join(' ').trim() : '');
                        const subtitleStr = subMatch ? subMatch.replace(/^["'«]|["'»]$/g, '').trim() : '';

                        return (
                            <div
                                key={`${ch.id}-${index}`}
                                onClick={() => onChapterClick(ch)}
                                className={`flex items-center justify-between gap-2.5 py-2.5 px-0 sm:px-3 transition-all duration-150 text-left group
                                    ${isRead ? 'opacity-50' : ''} hover:bg-white/[0.03] active:bg-white/[0.06] rounded-xl cursor-pointer`}
                            >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isRead ? 'bg-zinc-600' : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]'}`} />
                                    <div className="flex flex-col min-w-0">
                                        <span className={`font-medium text-[14px] sm:text-[15px] leading-snug ${isRead ? 'text-zinc-400' : 'text-zinc-100 group-hover:text-amber-400'} transition-colors line-clamp-1`}>
                                            {mainStr}{subtitleStr ? ` : ${subtitleStr}` : ''}
                                        </span>
                                        <div className="flex items-center gap-1.5 text-xs text-zinc-400/80 font-normal mt-0.5">
                                            <span>{ch.releaseDate || 'Recent'}</span>
                                            {author && (
                                                <>
                                                    <span>•</span>
                                                    <span className="truncate max-w-[140px] sm:max-w-[220px]">
                                                        {author}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (isDownloaded) {
                                                if (novelId) deleteDownload(novelId, ch.id);
                                            } else if (!isDownloading) {
                                                startDownload({
                                                    novelId: novelId || '',
                                                    novelTitle: novelTitle || 'Novel',
                                                    novelImage: novelImage || '',
                                                    chapter: ch,
                                                });
                                            }
                                        }}
                                        disabled={isDownloading}
                                        className={`grid h-8 w-8 place-items-center rounded-full transition-colors cursor-pointer ${
                                            isDownloaded
                                                ? 'text-zinc-400 hover:bg-red-500/20 hover:text-red-400'
                                                : isDownloading
                                                ? 'text-zinc-400'
                                                : 'text-zinc-400 hover:text-white hover:bg-white/10'
                                        }`}
                                        title={
                                            isDownloaded
                                                ? 'Downloaded for offline (Click to delete)'
                                                : isDownloading
                                                ? `Downloading ${progress?.progress || 0}%`
                                                : 'Download chapter'
                                        }
                                    >
                                        <DownloadStateIcon
                                            state={isDownloading ? 'downloading' : isDownloaded ? 'downloaded' : 'available'}
                                            progress={progress?.progress || 0}
                                            className="h-5 w-5"
                                        />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                    {currentChapters.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                            No chapters found matching "{searchQuery}"
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default function LNDetailsPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { language } = useTitleLanguage();
    const [viewMode, setViewMode] = useChapterViewMode();
    const [activeSectionTab, setActiveSectionTab] = useState<'chapters' | 'related'>('chapters');
    useEffect(() => {
        setActiveSectionTab('chapters');
    }, [id]);

    const routeLN = (location.state as { ln?: LightNovel } | null)?.ln ?? null;

    const [serverLN, setServerLN] = useState<LightNovel | null>(routeLN);
    const [chapters, setChapters] = useState<LNChapter[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingChapters, setLoadingChapters] = useState(true);
    const [compactFab, setCompactFab] = useState(false);

    const { isInLNReadList, toggleLNReadList } = useLNReadList();
    const { isFavorite: isFavoriteLN, addFavorite: addFavoriteLN, removeFavorite: removeFavoriteLN } = useFavoriteLN();
    const { continueReadingList } = useContinueLNReading();
    const { downloads: lnDownloads, downloadAll: downloadAllLN } = useLNDownloads();

    const isDesktopApp = supportsReadingExports();

    const handleOpenFolder = useCallback(() => {
        downloadService.openDownloadsFolder('LightNovels');
    }, []);

    const currentProgress = useMemo(() => {
        if (!id) return null;
        return continueReadingList.find((entry) => String(entry.novelId) === String(id));
    }, [id, continueReadingList]);

    const readChapters = useMemo(() => {
        const set = new Set<string>();
        if (currentProgress?.chapterId) {
            set.add(String(currentProgress.chapterId));
        }
        return set;
    }, [currentProgress]);

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
    }, [id]);

    useEffect(() => {
        const onScroll = () => setCompactFab(window.scrollY > 96);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    useEffect(() => {
        if (!id) return;
        let mounted = true;
        setLoading(!routeLN);
        setLoadingChapters(true);
        setChapters([]);

        const fetchDetailsAndChapters = async () => {
            try {
                // Start resolving chapters immediately if routeLN already provides scraper_id or titles
                const earlyTitles = [
                    routeLN?.title_english,
                    routeLN?.title,
                    routeLN?.title_romaji,
                    ...(Array.isArray(routeLN?.synonyms) ? routeLN.synonyms : []),
                ].filter(Boolean) as string[];
                const earlyScraperId = String(routeLN?.scraper_id || (id.includes(':') ? id : '')).trim();
                const earlyResolvePromise = earlyScraperId
                    ? Promise.resolve(earlyScraperId)
                    : earlyTitles.length > 0
                        ? lnService.resolveScraperId(earlyTitles)
                        : Promise.resolve(null);

                const [fullDetails, earlyResolvedId] = await Promise.all([
                    lnService.getDetails(id).catch(() => null),
                    earlyResolvePromise,
                ]);

                let fetchedLN = routeLN;
                if (fullDetails) {
                    fetchedLN = routeLN
                        ? {
                            ...routeLN,
                            ...fullDetails,
                            title: fullDetails.title || routeLN.title,
                            images: fullDetails.images || routeLN.images,
                            synopsis: fullDetails.synopsis || routeLN.synopsis,
                        }
                        : fullDetails;
                }
                if (mounted && fetchedLN) {
                    setServerLN(fetchedLN);
                    setLoading(false);
                }

                // Resolve scraper ID if not resolved by the early parallel pass
                let scraperId = String(earlyResolvedId || fetchedLN?.scraper_id || (id.includes(':') ? id : '')).trim();
                if (!scraperId) {
                    const resolved = await lnService.resolveScraperId([
                        fetchedLN?.title_english,
                        fetchedLN?.title,
                        fetchedLN?.title_romaji,
                        ...(Array.isArray(fetchedLN?.synonyms) ? fetchedLN.synonyms : []),
                    ].filter(Boolean) as string[]);
                    if (resolved) {
                        scraperId = resolved;
                    }
                }

                if (!scraperId) {
                    if (mounted) setLoadingChapters(false);
                    return;
                }

                const hasRichMetadata = Boolean(fetchedLN?.synopsis && (fetchedLN?.images?.jpg?.large_image_url || fetchedLN?.images?.jpg?.image_url));
                let scraperDetails = await lnService.getScraperNovelDetails(scraperId, false, hasRichMetadata);
                if (scraperDetails?.chapters && scraperDetails.chapters.length > 5) {
                    const chs = scraperDetails.chapters;
                    if (chs[0]?.title?.toLowerCase().includes('arc 1') && chs[1]?.title?.toLowerCase().includes('arc 5')) {
                        // Stale cache detected, force purge & fresh fetch
                        const fresh = await lnService.getScraperNovelDetails(scraperId, true, hasRichMetadata);
                        if (fresh) scraperDetails = fresh;
                    }
                }

                if (mounted && scraperDetails) {
                    if (scraperDetails.chapters) {
                        setChapters(scraperDetails.chapters);
                    }
                    setServerLN((prev) => prev ? {
                        ...prev,
                        scraper_id: scraperId,
                        author: scraperDetails.author && scraperDetails.author !== 'Unknown' && scraperDetails.author !== 'Unknown Author' ? scraperDetails.author : prev.author,
                        synopsis: scraperDetails.description || prev.synopsis,
                        status: scraperDetails.status || prev.status,
                        genres: scraperDetails.genres?.length ? scraperDetails.genres.map((name) => ({ name, mal_id: 0 })) : prev.genres,
                        chapters: scraperDetails.chapters?.length || prev.chapters,
                    } : prev);
                }
            } catch (err) {
                console.error('Failed to load Light Novel details:', err);
            } finally {
                if (mounted) {
                    setLoading(false);
                    setLoadingChapters(false);
                }
            }
        };

        fetchDetailsAndChapters();
        return () => {
            mounted = false;
        };
    }, [id, routeLN]);

    const matchingLNDownloads = useMemo(() => {
        if (!id && !serverLN) return [];
        const targetTitle = (serverLN?.title || routeLN?.title || '').toLowerCase().trim();
        return lnDownloads.filter((d) => {
            if (String(d.novelId) === String(id)) return true;
            if (targetTitle && d.novelTitle.toLowerCase().trim() === targetTitle) return true;
            return false;
        });
    }, [lnDownloads, id, serverLN, routeLN]);

    const fallbackLN = useMemo<LightNovel | null>(() => {
        if (matchingLNDownloads.length > 0) {
            const first = matchingLNDownloads[0];
            return {
                id: first.novelId,
                mal_id: first.novelId,
                title: first.novelTitle,
                title_english: first.novelTitle,
                images: {
                    jpg: {
                        image_url: first.novelImage,
                        large_image_url: first.novelImage,
                    },
                },
                chapters: matchingLNDownloads.length,
                status: 'Completed',
                type: 'NOVEL',
                score: 0,
            } as LightNovel;
        }
        return null;
    }, [matchingLNDownloads]);

    const ln: LightNovel | null = serverLN || fallbackLN;
    const displayTitle = ln ? getDisplayTitle(ln, language) : 'Light Novel';
    const cover = ln?.images?.jpg?.large_image_url || ln?.images?.jpg?.image_url || '';
    const lnId = String(ln?.id || id);

    const downloadedLNChapters: LNChapter[] = useMemo(() => {
        return matchingLNDownloads.map((d) => ({
            id: d.chapterId,
            number: Number(d.chapterNumber || 1),
            title: d.chapterTitle,
            url: d.chapterId,
        }));
    }, [matchingLNDownloads]);

    const effectiveChapters = chapters.length > 0 ? chapters : downloadedLNChapters;

    const handleDownloadAllLN = useCallback(() => {
        const novelId = lnId || id || '';
        if (!novelId) return;
        downloadAllLN(
            {
                id: novelId,
                title: displayTitle || 'Novel',
                image: cover || '',
            },
            effectiveChapters
        );
    }, [lnId, id, displayTitle, cover, downloadAllLN, effectiveChapters]);

    const handleChapterClick = useCallback((ch: LNChapter) => {
        navigate(`/ln/read/${slugify(displayTitle)}/${lnId}/${encodeURIComponent(ch.id)}`, {
            replace: true,
            state: { chapter: ch, ln },
        });
    }, [displayTitle, lnId, ln, navigate]);

    useEffect(() => {
        if (displayTitle) {
            document.title = `${displayTitle} • Yorumi`;
        }
        return () => {
            document.title = 'Yorumi';
        };
    }, [displayTitle]);

    if (loading && !ln) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] pb-20 animate-pulse">
                <div className="relative h-[30vh] md:h-[40vh] w-full overflow-hidden bg-white/10" />
                <div className="max-w-7xl mx-auto px-8 md:px-14 -mt-24 md:-mt-32 relative z-10">
                    <div className="flex flex-col md:flex-row gap-8 lg:gap-12">
                        <div className="flex-shrink-0 mx-auto md:mx-0 w-48 sm:w-52 md:w-56 lg:w-60">
                            <div className="rounded-xl aspect-[2/3] bg-white/10" />
                        </div>
                        <div className="flex-1 space-y-4">
                            <div className="h-10 w-3/4 rounded bg-white/10" />
                            <div className="h-6 w-1/2 rounded bg-white/10" />
                            <div className="h-12 w-56 rounded-full bg-white/10" />
                            <div className="h-6 w-40 rounded bg-white/10 mt-8" />
                            <div className="space-y-2">
                                <div className="h-4 w-full rounded bg-white/10" />
                                <div className="h-4 w-5/6 rounded bg-white/10" />
                                <div className="h-4 w-4/6 rounded bg-white/10" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!ln) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a] text-white gap-4">
                <div className="text-6xl font-black text-white/10">!</div>
                <h1 className="text-2xl font-bold">Light Novel Not Found</h1>
                <p className="text-gray-400">We couldn't find the requested novel.</p>
                <button
                    onClick={() => navigate('/ln')}
                    className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-full font-bold transition-colors mt-4"
                >
                    Go Back to Light Novels
                </button>
            </div>
        );
    }

    const isBookmarked = isInLNReadList(lnId);
    const handleBack = () => {
        if (((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0) navigate(-1);
        else navigate('/ln', { replace: true });
    };

    return (
        <div className="relative min-h-screen overflow-x-hidden bg-[#070707] text-white pb-24 md:pb-16 fade-in animate-in duration-300" style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}>
            <div
                className={`fixed inset-x-0 top-0 z-40 md:hidden border-b transition-colors duration-300 ${compactFab ? 'border-purple-400/15 bg-[#24202b]/95 backdrop-blur-xl' : 'border-transparent bg-transparent'}`}
                style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 24px)' }}
            >
                <div className="flex h-14 items-center gap-3 px-4">
                    <button type="button" onClick={handleBack} className="grid h-10 w-10 shrink-0 place-items-center text-white/90 transition-colors active:text-white" aria-label="Go back">
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div className={`min-w-0 flex-1 text-[20px] font-semibold text-white/90 truncate transition-opacity duration-300 ${compactFab ? 'opacity-100' : 'opacity-0'}`}>
                        {displayTitle}
                    </div>
                    <button type="button" onClick={() => window.dispatchEvent(new Event('yorumi:ln:toggle-sort'))} className="grid h-10 w-10 shrink-0 place-items-center text-white/85 transition-colors active:text-white" aria-label="Toggle newest or oldest">
                        <ArrowUpDown className="h-5 w-5" />
                    </button>
                    <button type="button" onClick={() => window.dispatchEvent(new Event('yorumi:ln:toggle-view'))} className="grid h-10 w-10 shrink-0 place-items-center text-white/85 transition-colors active:text-white" aria-label="Toggle chapter view">
                        {viewMode === 'list' ? <Grid2X2 className="h-5 w-5" /> : <List className="h-5 w-5" />}
                    </button>
                    <button type="button" onClick={handleDownloadAllLN} className="grid h-10 w-10 shrink-0 place-items-center text-white/85 transition-colors active:text-white" aria-label="Download chapters">
                        <Download className="h-5 w-5" />
                    </button>
                </div>
            </div>
            <div className="mx-auto w-full max-w-[1440px] px-6 pt-24 sm:px-10 sm:pt-32 md:px-14 md:pt-40 lg:px-16 lg:pt-48">
                <ReadingDetailsHero
                    key={String(ln.id)}
                    title={displayTitle}
                    cover={cover}
                    banner={ln.bannerImage}
                    synopsis={ln.synopsis}
                    details={[ln.score ? ln.score.toFixed(1) : '', ln.type || 'Light Novel', ln.author && ln.author !== 'Unknown Author' ? ln.author : '', effectiveChapters.length ? `${effectiveChapters.length} chapters` : '', ln.status || ''].filter(Boolean)}
                    genres={ln.genres?.map((genre) => genre.name)}
                    inList={isBookmarked}
                    inFavorites={isFavoriteLN(lnId)}
                    loading={loadingChapters}
                    canRead={effectiveChapters.length > 0}
                    readLabel="Read"
                    onRead={() => {
                        const startChapter = currentProgress ? effectiveChapters.find((chapter) => String(chapter.id) === String(currentProgress.chapterId)) || effectiveChapters[0] : effectiveChapters[0];
                        if (startChapter) handleChapterClick(startChapter);
                    }}
                    onToggleList={() => toggleLNReadList({ id: ln.id, title: displayTitle, image: cover, score: ln.score, mediaStatus: ln.status, type: ln.type, synopsis: ln.synopsis, genres: ln.genres?.map((genre) => genre.name) })}
                    onToggleFavorite={() => {
                        if (isFavoriteLN(lnId)) {
                            void removeFavoriteLN(lnId);
                        } else {
                            void addFavoriteLN({
                                id: lnId,
                                title: displayTitle,
                                image: cover,
                            });
                        }
                    }}
                    onBack={handleBack}
                />
                {/* Chapters & More Like This Section */}
                <div className="relative z-10 mt-6 w-full">
                    {/* Section Tabs Row (below poster, before chapters) */}
                    <div className="flex items-center gap-7 pt-2 pb-1">
                        {(
                            [
                                { key: 'chapters', label: 'Chapters' },
                                { key: 'related', label: 'More like this' },
                            ] as const
                        ).map((tab) => {
                            const isActive = activeSectionTab === tab.key;
                            return (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => setActiveSectionTab(tab.key)}
                                    className={`text-[15px] font-extrabold transition-colors border-0 outline-none focus:outline-none cursor-pointer ${
                                        isActive ? 'text-white' : 'text-white/50 hover:text-white/85'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    <div id="chapters-section" className={`pt-2 ${activeSectionTab === 'chapters' ? 'block' : 'hidden'}`}>
                        {loadingChapters ? (
                            <div className="mt-4 bg-transparent p-0 animate-pulse">
                                <div className="flex items-center justify-between gap-4 mb-6">
                                    <div className="h-7 w-32 bg-white/10 rounded-lg" />
                                    <div className="h-9 w-28 bg-white/10 rounded-xl" />
                                </div>
                                <div className="mb-6">
                                    <div className="h-10 w-full bg-white/5 rounded-xl border border-white/5" />
                                </div>
                                <div className="flex flex-col space-y-2">
                                    {Array.from({ length: 8 }).map((_, idx) => (
                                        <div key={idx} className="flex items-center justify-between gap-3 py-3 px-2 border-b border-white/[0.04]">
                                            <div className="flex items-center gap-3">
                                                <div className="w-2 h-2 rounded-full bg-white/10" />
                                                <div className="h-5 w-40 bg-white/10 rounded-md" />
                                            </div>
                                            <div className="w-7 h-7 rounded-full bg-white/5" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : effectiveChapters.length > 0 ? (
                            <LNChapterList
                                chapters={effectiveChapters}
                                readChapters={readChapters}
                                onChapterClick={handleChapterClick}
                                viewMode={viewMode}
                                onViewModeChange={setViewMode}
                                novelId={lnId}
                                novelTitle={displayTitle}
                                novelImage={cover}
                                author={ln.author}
                                headerActions={
                                    <>
                                        <button
                                            type="button"
                                            onClick={handleDownloadAllLN}
                                            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.10] text-white/80 transition-colors hover:bg-white/[0.15] hover:text-white border-0 outline-none focus:outline-none cursor-pointer"
                                            title="Download all chapters for offline reading"
                                            aria-label="Download all chapters"
                                        >
                                            <Download className="h-4 w-4" />
                                        </button>
                                        {isDesktopApp && (
                                            <button
                                                type="button"
                                                onClick={handleOpenFolder}
                                                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.10] text-white/80 transition-colors hover:bg-white/[0.15] hover:text-white border-0 outline-none focus:outline-none cursor-pointer"
                                                title="Open downloaded files on your computer"
                                                aria-label="Open downloads folder"
                                            >
                                                <FolderOpen className="h-4 w-4" />
                                            </button>
                                        )}
                                    </>
                                }
                            />
                        ) : (
                            <div className="text-gray-500 text-center py-4 space-y-2">
                                <div>No readable chapters returned from novel sources.</div>
                            </div>
                        )}
                    </div>
                    {activeSectionTab === 'related' && (
                        <div className="pt-2">
                            <MoreLikeReading
                                kind="novel"
                                anilistId={Number(ln.externalIds?.anilist) > 0 ? Number(ln.externalIds?.anilist) : undefined}
                                title={ln.title}
                                genres={ln.genres?.map((g) => g.name)}
                                embedded
                            />
                        </div>
                    )}

                    {/* Characters Section (if available) */}
                    {ln.characters && (
                        <DetailsCharacters
                            characters={ln.characters as Anime['characters']}
                            title="Characters"
                        />
                    )}
                </div>
            </div>

            {/* Mobile Floating Action Button (Resume / Read) */}
            {effectiveChapters.length > 0 && (
                <div
                    className="fixed right-4 md:hidden z-30 pointer-events-auto flex items-center justify-end gap-4"
                    style={{ bottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}
                >
                    <button
                        type="button"
                        onClick={() => {
                            const startChapter = currentProgress
                                ? effectiveChapters.find((c) => String(c.id) === String(currentProgress.chapterId)) || effectiveChapters[0]
                                : effectiveChapters[0];
                            if (startChapter) handleChapterClick(startChapter);
                        }}
                        className={`flex items-center justify-center py-3.5 rounded-2xl bg-[#5b4b72]/95 hover:bg-[#6d5a88] text-white font-bold text-sm shadow-2xl shadow-black/80 border border-white/10 backdrop-blur-md active:scale-95 transition-all duration-500 ease-out cursor-pointer ${compactFab ? 'w-14 px-0 gap-0' : 'px-5 gap-2'}`}
                    >
                        <Play className="w-4 h-4 fill-white text-white" />
                        <span className={`overflow-hidden whitespace-nowrap transition-all ${compactFab ? 'max-w-0 opacity-0' : 'max-w-24 opacity-100'}`}>
                            {currentProgress ? 'Continue' : 'Start'}
                        </span>
                    </button>
                </div>
            )}
        </div>
    );
}

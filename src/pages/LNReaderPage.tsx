import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { lnService } from '../services/lnService';
import type { LNChapterContent, LNReaderSettings, LightNovel, LNChapter } from '../types/ln';
import { useContinueLNReading } from '../hooks/useContinueLNReading';
import { useTitleLanguage } from '../context/TitleLanguageContext';
import { getDisplayTitle } from '../utils/titleLanguage';
import { slugify } from '../utils/slugify';
import sleepingGif from '../assets/sleeping.gif';
import {
    ArrowLeft,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    Settings,
    Type,
    X,
    RotateCcw,
    Menu,
    ChevronDown,
    ZoomIn,
    ZoomOut,
} from 'lucide-react';

const DEFAULT_SETTINGS: LNReaderSettings = {
    fontSize: 18,
    lineHeight: 1.7,
    fontFamily: 'sans',
    theme: 'dark',
    maxWidth: 'medium',
};

const STORAGE_SETTINGS_KEY = 'yorumi_ln_reader_settings_v1';

export default function LNReaderPage() {
    const { title: slugTitle, id: novelId, chapter: chapterIdParam } = useParams<{
        title: string;
        id: string;
        chapter: string;
    }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { language } = useTitleLanguage();

    const passedLN = (location.state as any)?.ln as LightNovel | undefined;
    const chapterId = decodeURIComponent(chapterIdParam || '');

    const [loadedChapters, setLoadedChapters] = useState<LNChapterContent[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingNext, setLoadingNext] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [novelChapters, setNovelChapters] = useState<LNChapter[]>([]);
    const [novelDetails, setNovelDetails] = useState<any>(null);
    const [showChaptersDropdown, setShowChaptersDropdown] = useState(false);
    const [isHeaderVisible, setIsHeaderVisible] = useState(false);
    const [showScrollTop, setShowScrollTop] = useState(false);

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [settings, setSettings] = useState<LNReaderSettings>(() => {
        try {
            const raw = localStorage.getItem(STORAGE_SETTINGS_KEY);
            return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
        } catch {
            return DEFAULT_SETTINGS;
        }
    });

    const { saveLNProgress } = useContinueLNReading();
    const contentRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const activeChapter = useMemo(() => {
        return loadedChapters[loadedChapters.length - 1] || null;
    }, [loadedChapters]);

    const handleContentClick = () => {
        setIsHeaderVisible((prev) => {
            if (prev) {
                setShowChaptersDropdown(false);
            }
            return !prev;
        });
    };

    const updateSettings = (newSettings: Partial<LNReaderSettings>) => {
        setSettings((prev) => {
            const updated = { ...prev, ...newSettings };
            try {
                localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(updated));
            } catch {
                // ignore
            }
            return updated;
        });
    };

    // Load novel chapters for the dropdown menu
    useEffect(() => {
        if (!novelId) return;
        let mounted = true;

        const loadDetails = async () => {
            try {
                let scraperId = novelId;
                if (!novelId.includes(':')) {
                    const resolved = await lnService.resolveScraperId([passedLN?.title || slugTitle || novelId]);
                    if (resolved) scraperId = resolved;
                }
                const details = await lnService.getScraperNovelDetails(scraperId);
                if (mounted && details) {
                    setNovelDetails(details);
                    setNovelChapters(details.chapters || []);
                }
            } catch (err) {
                console.error('Failed to load novel details for reader:', err);
            }
        };

        loadDetails();
        return () => {
            mounted = false;
        };
    }, [novelId, passedLN?.title, slugTitle]);

    // Initial load when chapterId changes
    useEffect(() => {
        if (!chapterId) return;
        let mounted = true;
        setLoading(true);
        setError(null);
        setLoadedChapters([]);

        if (contentRef.current) {
            contentRef.current.scrollTop = 0;
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });

        lnService
            .getChapterContent(chapterId)
            .then((data) => {
                if (mounted) {
                    if (data) {
                        setLoadedChapters([data]);
                        if (novelId) {
                            saveLNProgress({
                                novelId,
                                novelTitle: passedLN?.title || novelDetails?.title || slugTitle || 'Novel',
                                coverImage: passedLN?.images?.jpg?.large_image_url || novelDetails?.cover || '',
                                chapterId: data.id,
                                chapterNumber: data.chapterNumber,
                                chapterTitle: data.title,
                            });
                        }
                    } else {
                        setError('Failed to load chapter text from source.');
                    }
                    setLoading(false);
                }
            })
            .catch((err) => {
                if (mounted) {
                    console.error('LN Reader fetch error:', err);
                    setError('Error loading chapter content.');
                    setLoading(false);
                }
            });

        return () => {
            mounted = false;
        };
    }, [chapterId, novelId]);

    // Load next chapter for Infinite Scroll
    const loadNextChapter = useCallback(async () => {
        if (loadingNext || loadedChapters.length === 0) return;
        const lastCh = loadedChapters[loadedChapters.length - 1];

        let nextId = lastCh.nextChapterId;
        if (!nextId && novelChapters.length > 0) {
            const idx = novelChapters.findIndex((c) => String(c.id) === String(lastCh.id));
            if (idx !== -1 && idx + 1 < novelChapters.length) {
                nextId = String(novelChapters[idx + 1].id);
            }
        }

        if (!nextId) return;
        if (loadedChapters.some((c) => String(c.id) === String(nextId))) return;

        setLoadingNext(true);
        try {
            const nextData = await lnService.getChapterContent(nextId);
            if (nextData) {
                setLoadedChapters((prev) => {
                    if (prev.some((c) => String(c.id) === String(nextData.id))) return prev;
                    return [...prev, nextData];
                });
                if (novelId) {
                    saveLNProgress({
                        novelId,
                        novelTitle: passedLN?.title || novelDetails?.title || slugTitle || 'Novel',
                        coverImage: passedLN?.images?.jpg?.large_image_url || novelDetails?.cover || '',
                        chapterId: nextData.id,
                        chapterNumber: nextData.chapterNumber,
                        chapterTitle: nextData.title,
                    });
                }
            }
        } catch (err) {
            console.error('Failed to load next chapter:', err);
        } finally {
            setLoadingNext(false);
        }
    }, [loadingNext, loadedChapters, novelChapters, novelId, passedLN, novelDetails, slugTitle, saveLNProgress]);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        setIsHeaderVisible(false);
        setShowChaptersDropdown(false);
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        setShowScrollTop(scrollTop > 300);

        if (scrollHeight - (scrollTop + clientHeight) < 600) {
            loadNextChapter();
        }
    };

    const scrollToTop = () => {
        if (contentRef.current) {
            contentRef.current.parentElement?.scrollTo({ top: 0, behavior: 'smooth' });
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Scroll to current chapter in dropdown
    useEffect(() => {
        if (showChaptersDropdown && activeChapter && dropdownRef.current) {
            setTimeout(() => {
                const activeEl = dropdownRef.current?.querySelector(`[data-chapter-id="${activeChapter.id}"]`);
                if (activeEl) {
                    activeEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
                }
            }, 50);
        }
    }, [showChaptersDropdown, activeChapter]);

    const navigateToChapter = (targetChapterId: string) => {
        if (!targetChapterId || !novelId) return;
        setShowChaptersDropdown(false);
        navigate(`/ln/read/${slugTitle || 'novel'}/${novelId}/${encodeURIComponent(targetChapterId)}`, {
            state: { ln: passedLN },
        });
    };

    const getThemeStyles = () => {
        switch (settings.theme) {
            case 'sepia':
                return { bg: 'bg-[#1a1612]', text: 'text-[#e3d7c5]', border: 'border-[#2e261f]', panel: 'bg-[#241e18]' };
            case 'midnight':
                return { bg: 'bg-[#0d1117]', text: 'text-[#c9d1d9]', border: 'border-[#30363d]', panel: 'bg-[#161b22]' };
            case 'oled':
                return { bg: 'bg-black', text: 'text-gray-200', border: 'border-white/10', panel: 'bg-[#111111]' };
            case 'dark':
            default:
                return { bg: 'bg-[#0a0a0a]', text: 'text-gray-200', border: 'border-white/10', panel: 'bg-[#141414]' };
        }
    };

    const themeStyle = getThemeStyles();

    const getMaxWidthClass = () => {
        switch (settings.maxWidth) {
            case 'narrow':
                return 'max-w-xl';
            case 'wide':
                return 'max-w-4xl';
            case 'full':
                return 'max-w-6xl';
            case 'medium':
            default:
                return 'max-w-2xl';
        }
    };

    const getFontFamilyClass = () => {
        switch (settings.fontFamily) {
            case 'serif':
                return 'font-serif';
            case 'mono':
                return 'font-mono';
            case 'sans':
            default:
                return 'font-sans';
        }
    };

    const sortedChapters = useMemo(() => {
        return [...novelChapters];
    }, [novelChapters]);

    const displayNovelTitle = passedLN ? getDisplayTitle(passedLN, language) : novelDetails?.title || 'Light Novel';
    const coverImage = passedLN?.images?.jpg?.large_image_url || novelDetails?.cover || '';

    return (
        <div className="fixed inset-0 md:left-[70px] z-[130] md:z-[90] flex items-center justify-center bg-black/95 backdrop-blur-md transition-all duration-300">
            <div className={`w-full h-full flex flex-col ${themeStyle.bg} ${themeStyle.text} relative overflow-hidden transition-colors duration-300`}>
                {/* Header (Matching Manga Header Height & Style) */}
                <header className={`h-20 shrink-0 ${themeStyle.panel} border-b ${themeStyle.border} z-50 absolute top-0 left-0 right-0 flex items-center justify-between px-6 md:px-14 backdrop-blur-md bg-opacity-90 transition-transform duration-300 ${isHeaderVisible ? 'translate-y-0' : '-translate-y-full'}`}>
                    {/* Left side: Cover + Title */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        {coverImage && (
                            <img
                                src={coverImage}
                                alt="cover"
                                className="w-10 h-14 object-cover rounded shadow-sm hidden sm:block"
                            />
                        )}

                        <div className="flex flex-col min-w-0">
                            <h1 className="text-sm font-semibold text-gray-400 truncate hidden sm:block">
                                {displayNovelTitle}
                            </h1>
                            <span className="text-base md:text-lg font-bold text-white truncate leading-tight">
                                {activeChapter ? activeChapter.title : 'Loading Chapter...'}
                            </span>
                        </div>
                    </div>

                    {/* Center side: Font Controls */}
                    <div className="flex-1 flex justify-center hidden md:flex">
                        <div className="flex items-center gap-1 bg-white/5 rounded-full p-1 border border-white/10">
                            <button
                                onClick={() => updateSettings({ fontSize: Math.max(13, settings.fontSize - 1) })}
                                className="p-1.5 hover:bg-white/10 rounded-full text-gray-300 hover:text-white transition-colors"
                                title="Decrease font size"
                            >
                                <ZoomOut className="w-4 h-4" />
                            </button>
                            <span className="text-xs font-mono font-bold w-12 text-center text-amber-400">
                                {settings.fontSize}px
                            </span>
                            <button
                                onClick={() => updateSettings({ fontSize: Math.min(28, settings.fontSize + 1) })}
                                className="p-1.5 hover:bg-white/10 rounded-full text-gray-300 hover:text-white transition-colors"
                                title="Increase font size"
                            >
                                <ZoomIn className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Right side: Reader Settings */}
                    <div className="flex items-center justify-end gap-2 flex-1 shrink-0">
                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className="p-2.5 hover:bg-white/10 rounded-xl border border-white/10 transition-colors flex items-center gap-2 text-xs font-bold"
                        >
                            <Settings className="w-4 h-4 text-amber-400" />
                            <span className="hidden sm:inline">Reader Settings</span>
                        </button>
                    </div>
                </header>

                {/* Main Content Scrollable Area */}
                <main onClick={handleContentClick} onScroll={handleScroll} className="flex-1 overflow-y-auto pt-24 pb-28 px-6 custom-scrollbar cursor-pointer flex flex-col">
                    <div className={`mx-auto w-full ${getMaxWidthClass()} my-auto`}>
                        {loading ? (
                            <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 py-20 text-center">
                                <img src={sleepingGif} alt="Loading..." className="w-32 h-32 object-contain animate-bounce" />
                                <p className="text-amber-400 font-bold text-base tracking-wide animate-pulse">Loading chapter content...</p>
                            </div>
                        ) : error ? (
                            <div className="py-24 text-center flex flex-col items-center justify-center gap-4">
                                <p className="text-red-400 font-semibold">{error}</p>
                                <button
                                    onClick={() => window.location.reload()}
                                    className="px-6 py-2.5 bg-amber-400 hover:bg-amber-300 text-black font-extrabold rounded-xl text-sm shadow-lg shadow-amber-400/20"
                                >
                                    Retry Chapter
                                </button>
                            </div>
                        ) : loadedChapters.length > 0 ? (
                            <div className="space-y-12">
                                {loadedChapters.map((ch, idx) => (
                                    <article key={ch.id} ref={idx === 0 ? contentRef : undefined} className="space-y-6">
                                        {idx > 0 && (
                                            <div className="my-16 h-px bg-white/10 w-full" />
                                        )}

                                        <h2 className="text-2xl md:text-3xl font-black mb-8 pb-4 border-b border-white/10 leading-snug">
                                            {ch.title}
                                        </h2>

                                        <div
                                            className={`leading-relaxed space-y-5 ${getFontFamilyClass()}`}
                                            style={{
                                                fontSize: `${settings.fontSize}px`,
                                                lineHeight: settings.lineHeight,
                                            }}
                                            dangerouslySetInnerHTML={{ __html: ch.content }}
                                        />
                                    </article>
                                ))}

                                {/* Sleeping GIF at the very bottom when fetching next chapter via infinite scroll */}
                                {loadingNext && (
                                    <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
                                        <img src={sleepingGif} alt="Loading next chapter..." className="w-28 h-28 object-contain animate-bounce" />
                                        <p className="text-amber-400 font-bold text-sm tracking-wide animate-pulse">Loading next chapter...</p>
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </div>
                </main>

                {/* Footer (Matching Manga Footer Height & Layout) */}
                <footer className={`h-20 shrink-0 ${themeStyle.panel} border-t ${themeStyle.border} z-50 absolute bottom-0 left-0 right-0 flex items-center justify-between px-6 md:px-14 backdrop-blur-md bg-opacity-90 transition-transform duration-300 ${isHeaderVisible ? 'translate-y-0' : 'translate-y-full'}`}>
                    {/* LEFT: Prev Chapter */}
                    <div className="flex-1 flex justify-start">
                        <button
                            disabled={!loadedChapters[0]?.prevChapterId}
                            onClick={() => loadedChapters[0]?.prevChapterId && navigateToChapter(loadedChapters[0].prevChapterId)}
                            className="h-10 px-4 md:px-6 bg-[#1a1a1a] border border-white/5 hover:bg-white/10 text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent flex items-center gap-2 rounded-xl transition-colors font-bold text-sm"
                            title="Previous Chapter"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            <span>Prev</span>
                        </button>
                    </div>

                    {/* CENTER: Chapter Dropdown Selector */}
                    <div className="flex-1 flex justify-center relative">
                        {showChaptersDropdown && (
                            <div className="absolute bottom-full mb-4 w-64 md:w-80 max-h-[300px] bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col z-[100]">
                                <div
                                    ref={dropdownRef}
                                    className="overflow-y-auto p-2 space-y-1 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent"
                                >
                                    {sortedChapters.length > 0 ? (
                                        sortedChapters.map((ch) => {
                                            const isCurrent = activeChapter?.id === ch.id || activeChapter?.chapterNumber === ch.number;
                                            return (
                                                <button
                                                    key={ch.id}
                                                    data-chapter-id={ch.id}
                                                    onClick={() => navigateToChapter(ch.id)}
                                                    className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                                                        isCurrent
                                                            ? 'bg-amber-400/20 text-amber-300 font-bold'
                                                            : 'text-gray-300 hover:bg-white/5 hover:text-white'
                                                    }`}
                                                >
                                                    {ch.title}
                                                </button>
                                            );
                                        })
                                    ) : (
                                        <div className="px-4 py-3 text-xs text-gray-400 text-center">
                                            Ch. {activeChapter?.chapterNumber || 1}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <button
                            onClick={() => setShowChaptersDropdown((prev) => !prev)}
                            className="h-10 px-4 md:px-6 bg-white/5 hover:bg-white/10 text-white flex items-center gap-2 rounded-xl transition-colors font-bold text-sm border border-white/10"
                        >
                            <Menu className="w-4 h-4 text-amber-400" />
                            <span className="truncate max-w-[120px] sm:max-w-[200px]">
                                {activeChapter ? `Ch. ${activeChapter.chapterNumber}` : 'Select Chapter'}
                            </span>
                            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showChaptersDropdown ? 'rotate-180' : ''}`} />
                        </button>
                    </div>

                    {/* RIGHT: Next Chapter */}
                    <div className="flex-1 flex justify-end">
                        <button
                            disabled={!activeChapter?.nextChapterId}
                            onClick={() => activeChapter?.nextChapterId && navigateToChapter(activeChapter.nextChapterId)}
                            className="h-10 px-4 md:px-6 bg-amber-400 hover:bg-amber-300 text-black disabled:opacity-50 disabled:hover:bg-amber-400 flex items-center gap-2 rounded-xl transition-colors font-extrabold text-sm shadow-lg shadow-amber-400/20"
                            title="Next Chapter"
                        >
                            <span>Next</span>
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </footer>

                {/* Reader Settings Modal */}
                {isSettingsOpen && (
                    <div className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                        <div className={`w-full max-w-md ${themeStyle.panel} border ${themeStyle.border} rounded-2xl p-6 shadow-2xl space-y-6 relative`}>
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-extrabold flex items-center gap-2">
                                    <Type className="w-5 h-5 text-amber-400" />
                                    Reader Preferences
                                </h3>

                                <button
                                    onClick={() => setIsSettingsOpen(false)}
                                    className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Font Size Slider */}
                            <div>
                                <div className="flex justify-between text-xs font-semibold mb-2">
                                    <span>Font Size</span>
                                    <span className="text-amber-400">{settings.fontSize}px</span>
                                </div>
                                <input
                                    type="range"
                                    min={13}
                                    max={28}
                                    value={settings.fontSize}
                                    onChange={(e) => updateSettings({ fontSize: Number(e.target.value) })}
                                    className="w-full accent-amber-400 cursor-pointer"
                                />
                            </div>

                            {/* Line Height Selector */}
                            <div>
                                <span className="text-xs font-semibold block mb-2">Line Height</span>
                                <div className="grid grid-cols-4 gap-2">
                                    {[1.4, 1.6, 1.8, 2.0].map((lh) => (
                                        <button
                                            key={lh}
                                            onClick={() => updateSettings({ lineHeight: lh })}
                                            className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                                                settings.lineHeight === lh
                                                    ? 'bg-amber-400 text-black border-amber-400 font-extrabold'
                                                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                                            }`}
                                        >
                                            {lh}x
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Font Family Selector */}
                            <div>
                                <span className="text-xs font-semibold block mb-2">Font Style</span>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { id: 'sans', label: 'Sans-Serif' },
                                        { id: 'serif', label: 'Serif' },
                                        { id: 'mono', label: 'Monospace' },
                                    ].map((font) => (
                                        <button
                                            key={font.id}
                                            onClick={() => updateSettings({ fontFamily: font.id as any })}
                                            className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                                                settings.fontFamily === font.id
                                                    ? 'bg-amber-400 text-black border-amber-400 font-extrabold'
                                                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                                            }`}
                                        >
                                            {font.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Theme Mode Selector */}
                            <div>
                                <span className="text-xs font-semibold block mb-2">Reader Theme</span>
                                <div className="grid grid-cols-4 gap-2">
                                    {[
                                        { id: 'dark', label: 'Dark', bg: 'bg-[#0a0a0a]', text: 'text-white' },
                                        { id: 'sepia', label: 'Sepia', bg: 'bg-[#1a1612]', text: 'text-[#e3d7c5]' },
                                        { id: 'midnight', label: 'Midnight', bg: 'bg-[#0d1117]', text: 'text-gray-200' },
                                        { id: 'oled', label: 'OLED', bg: 'bg-black', text: 'text-white' },
                                    ].map((t) => (
                                        <button
                                            key={t.id}
                                            onClick={() => updateSettings({ theme: t.id as any })}
                                            className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all ${t.bg} ${t.text} ${
                                                settings.theme === t.id ? 'border-amber-400 ring-2 ring-amber-400/50' : 'border-white/10'
                                            }`}
                                        >
                                            {t.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Container Width */}
                            <div>
                                <span className="text-xs font-semibold block mb-2">Reading Width</span>
                                <div className="grid grid-cols-4 gap-2">
                                    {['narrow', 'medium', 'wide', 'full'].map((w) => (
                                        <button
                                            key={w}
                                            onClick={() => updateSettings({ maxWidth: w as any })}
                                            className={`py-2 rounded-xl text-xs font-bold capitalize border transition-all ${
                                                settings.maxWidth === w
                                                    ? 'bg-amber-400 text-black border-amber-400 font-extrabold'
                                                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                                            }`}
                                        >
                                            {w}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Reset Settings */}
                            <div className="pt-2">
                                <button
                                    onClick={() => updateSettings(DEFAULT_SETTINGS)}
                                    className="w-full py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2 opacity-70 hover:opacity-100"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    Reset Preferences
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {/* Back to top floating button */}
                <button
                    onClick={scrollToTop}
                    className={`fixed right-6 md:right-10 z-[120] p-3 rounded-full bg-amber-400 text-black shadow-xl hover:bg-amber-300 transition-all duration-300 ${
                        showScrollTop ? 'opacity-100 scale-100' : 'opacity-0 scale-0 pointer-events-none'
                    } ${isHeaderVisible ? 'bottom-24' : 'bottom-8'}`}
                    title="Back to top"
                >
                    <ChevronUp className="w-5 h-5 stroke-[3]" />
                </button>
            </div>
        </div>
    );
}

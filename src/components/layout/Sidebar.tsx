import { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Search, Tv, BookOpen, Library, LogOut } from 'lucide-react';
import SearchModal from '../shared/SearchModal';
import { useContinueReading } from '../../hooks/useContinueReading';
import { useContinueWatching } from '../../hooks/useContinueWatching';
import { useWatchList } from '../../hooks/useWatchList';
import { useReadList } from '../../hooks/useReadList';
import { getDirectScraperRouteId } from '../../utils/animeNavigation';
import { slugify } from '../../utils/slugify';
import type { ReadListItem, WatchListItem } from '../../utils/storage';
const yorumiIcon = '/yorumi-icon.png';

type SavedSidebarItem =
    | (WatchListItem & { isManga: false })
    | (ReadListItem & { isManga: true });

const toPositiveNumber = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const getAnimeRouteId = (item: WatchListItem) => (
    getDirectScraperRouteId(item.scraperId) ||
    String(item.anilistId || item.malId || item.id || '').trim()
);

const buildAnimeRouteState = (item: WatchListItem) => {
    const anilistId = toPositiveNumber(item.anilistId || item.id);
    const malId = toPositiveNumber(item.malId || item.id);
    const scraperRouteId = getDirectScraperRouteId(item.scraperId);

    return {
        id: anilistId || undefined,
        mal_id: malId,
        scraperId: scraperRouteId ? scraperRouteId.replace(/^s:/i, '') : item.scraperId,
        title: item.title,
        title_english: item.title,
        title_romaji: item.title,
        images: { jpg: { image_url: item.image, large_image_url: item.image } },
        score: item.score || 0,
        status: item.mediaStatus || 'UNKNOWN',
        type: item.type || 'TV',
        episodes: item.totalCount || null,
        genres: item.genres?.map((name) => ({ mal_id: 0, name })) || [],
        synopsis: item.synopsis || '',
    };
};

const buildMangaRouteState = (item: ReadListItem) => ({
    id: item.id,
    mal_id: /^\d+$/.test(item.id) ? Number.parseInt(item.id, 10) : item.id,
    scraper_id: /^\d+$/.test(item.id) ? undefined : item.id,
    title: item.title,
    images: { jpg: { image_url: item.image, large_image_url: item.image } },
    score: item.score || 0,
    status: item.mediaStatus || 'UNKNOWN',
    type: item.type || 'Manga',
    chapters: item.totalCount || null,
    volumes: null,
    genres: item.genres?.map((name) => ({ mal_id: 0, name })) || [],
    synopsis: item.synopsis || '',
});

export default function Sidebar() {
    const navigate = useNavigate();
    const location = useLocation();
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchType, setSearchType] = useState<'anime' | 'manga'>('anime');
    const [hoveredCard, setHoveredCard] = useState<{title: string, top: number} | null>(null);

    const { watchList: normalWatchList } = useWatchList();
    const { readList: normalReadList } = useReadList();
    const { continueWatchingList } = useContinueWatching();
    const { continueReadingList } = useContinueReading();

    const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [clickCount, setClickCount] = useState(0);

    const handleLogoClickInternal = () => {
        setClickCount((prev) => {
            const newCount = prev + 1;
            if (newCount >= 5) {
                // Must navigate to the Vault interface (\/\ or \/manga\) per guidelines
                const isManga = location.pathname.startsWith('/manga');
                navigate(isManga ? '/manga' : '/');
                return 0;
            }
            if (newCount === 1) {
                // Only navigate home on the first click, not every click
                navigate('/');
            }
            return newCount;
        });

        if (clickTimeoutRef.current) {
            clearTimeout(clickTimeoutRef.current);
        }
        clickTimeoutRef.current = setTimeout(() => {
            setClickCount(0);
        }, 1500);
    };

    const displaySavedItems: SavedSidebarItem[] = [
        ...normalWatchList.map(item => ({ ...item, isManga: false as const })),
        ...normalReadList.map(item => ({ ...item, isManga: true as const }))
    ]
    .filter((item, index, self) => 
        // deduplicate by ID across lists just in case
        index === self.findIndex((t) => t.id === item.id)
    )
    .sort((a, b) => new Date(b.addedAt || 0).getTime() - new Date(a.addedAt || 0).getTime());

    const getMatchingWatchProgress = (item: WatchListItem) => {
        const ids = new Set([
            item.id,
            item.anilistId,
            item.malId,
            item.scraperId,
            getDirectScraperRouteId(item.scraperId).replace(/^s:/i, ''),
        ].map((value) => String(value || '').trim()).filter(Boolean));

        return continueWatchingList.find((progress) => ids.has(String(progress.animeId || '').trim()));
    };

    const openSavedItem = (item: SavedSidebarItem) => {
        if (item.isManga) {
            const progress = continueReadingList.find((entry) => String(entry.mangaId) === String(item.id));
            if (progress?.chapterNumber) {
                navigate(`/manga/read/${slugify(item.title || 'manga')}/${item.id}/c${progress.chapterNumber}`);
                return;
            }

            navigate(`/manga/details/${item.id}`, { state: { manga: buildMangaRouteState(item) } });
            return;
        }

        const routeId = getAnimeRouteId(item);
        if (!routeId) return;
        
        const anime = buildAnimeRouteState(item);

        const progress = getMatchingWatchProgress(item);
        const resume = Number.isFinite(progress?.positionSeconds)
            ? Math.max(0, Math.floor(Number(progress?.positionSeconds)))
            : 0;
        const episodeNumber = Number(progress?.episodeNumber || 0);
        const query = episodeNumber > 0
            ? `?ep=${episodeNumber}${resume > 0 ? `&t=${resume}` : ''}`
            : '';

        navigate(`/anime/details/${routeId}${query}`, { state: { anime } });
    };

    return (
        <>
        <aside className="fixed left-0 top-0 h-screen w-[70px] bg-[#0a0a0a]/90 backdrop-blur-xl border-r border-white/5 flex flex-col items-center py-6 z-[100]">
            <div className="flex flex-col items-center gap-3 w-full">
                {/* Logo */}
                <div 
                    onClick={handleLogoClickInternal} 
                    className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer mb-4 hover:opacity-80 transition-opacity"
                    title="Home"
                >
                    <img src={yorumiIcon} alt="Yorumi" className="w-8 h-8 object-contain" />
                </div>
                
                <SidebarIcon 
                    icon={ArrowLeft} 
                    title="Back" 
                    onClick={() => {
                        if (location.pathname.startsWith('/manga/read/')) {
                            const parts = location.pathname.split('/');
                            if (parts.length >= 5) {
                                navigate(`/manga/details/${parts[4]}`);
                                return;
                            }
                        }
                        if (location.pathname.startsWith('/anime/details/')) {
                            const parts = location.pathname.split('/');
                            if (parts.length >= 5) {
                                navigate(`/anime/details/${parts[4]}`);
                                return;
                            }
                        }
                        navigate(-1);
                    }} 
                />
                <SidebarIcon 
                    icon={Search} 
                    title="Search" 
                    onClick={() => {
                        const isManga = location.pathname.startsWith('/manga');
                        setSearchType(isManga ? 'manga' : 'anime');
                        setIsSearchOpen(true);
                    }} 
                />
                <SidebarIcon icon={Tv} title="Anime" onClick={() => navigate('/')} isActive={location.pathname === '/' || location.pathname.startsWith('/anime')} />
                <SidebarIcon icon={BookOpen} title="Manga" onClick={() => navigate('/manga')} isActive={location.pathname === '/manga' || location.pathname.startsWith('/manga')} />
                <SidebarIcon icon={Library} title="Library" onClick={() => navigate('/library')} isActive={location.pathname === '/library'} />
            </div>

            {displaySavedItems.length > 0 && (
                <div className="flex-1 w-full min-h-0 flex flex-col items-center mt-3 overflow-hidden">
                    <div className="w-8 h-px bg-white/10 mb-3 shrink-0" />
                    <div className="w-full flex-1 overflow-y-auto flex flex-col items-center gap-3 px-1 pb-4 scrollbar-thin scrollbar-thumb-transparent hover:scrollbar-thumb-blue-500 scrollbar-track-transparent">
                        {displaySavedItems.map(item => (
                            <button
                                key={`${item.isManga ? 'manga' : 'anime'}-${item.id}`}
                                onClick={() => openSavedItem(item)}
                                onMouseEnter={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setHoveredCard({ title: item.title, top: rect.top + rect.height / 2 });
                                }}
                                onMouseLeave={() => setHoveredCard(null)}
                                className="relative w-11 h-16 shrink-0 focus:outline-none"
                            >
                                <div className="w-full h-full rounded-lg overflow-hidden border-2 border-transparent hover:border-yorumi-accent transition-colors">
                                    <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex flex-col items-center gap-4 w-full mt-auto pt-4">
                <SidebarIcon 
                    icon={LogOut} 
                    title="Exit App" 
                    onClick={() => window.close()} 
                    className="text-red-500 hover:text-red-400 hover:bg-red-500/10" 
                />
            </div>
        </aside>
        
        <SearchModal 
            isOpen={isSearchOpen} 
            onClose={() => setIsSearchOpen(false)} 
            type={searchType} 
        />
        {hoveredCard && (
            <div 
                className="fixed left-[70px] bg-[#1a1a1a] text-white text-[13px] font-semibold px-3 py-1.5 rounded-md pointer-events-none whitespace-nowrap z-[150] shadow-xl border border-white/5 -translate-y-1/2"
                style={{ top: hoveredCard.top }}
            >
                {hoveredCard.title}
            </div>
        )}
        </>
    );
}

interface SidebarIconProps {
    icon: React.ElementType;
    title: string;
    onClick: () => void;
    isActive?: boolean;
    className?: string;
}

function SidebarIcon({ icon: Icon, title, onClick, isActive, className }: SidebarIconProps) {
    return (
        <button
            onClick={onClick}
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 group relative outline-none focus:outline-none ${isActive ? 'bg-yorumi-accent/20 text-yorumi-accent' : 'text-gray-400 hover:text-white hover:bg-white/10'} ${className || ''}`}
        >
            <Icon className="w-5 h-5" />
            <span className="absolute left-[60px] bg-[#1a1a1a] text-white text-[13px] font-semibold px-3 py-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[150] shadow-xl border border-white/5">
                {title}
            </span>
        </button>
    );
}

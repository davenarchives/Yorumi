import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, Cat, Book, ChevronLeft, BookOpen, History, ChevronRight } from 'lucide-react';
import { userSearchService, type PublicUserProfile } from '../services/userService';
import { useAuth } from '../context/AuthContext';
import useEmblaCarousel from 'embla-carousel-react';
import { DEFAULT_BANNER_URL, resolveStaticAssetUrl } from '../config/cloudinaryAssets';
import { getAnimeDetailsRouteId } from '../utils/animeNavigation';

type TabType = 'profile' | 'anime-overview' | 'manga-overview';

const isAnimeSessionId = (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const getStoredAnimeRouteId = (item: any) => {
    return getAnimeDetailsRouteId({
        id: item.anilistId || item.id,
        mal_id: item.malId,
        scraperId: item.scraperId,
    });
};

const buildStoredAnimeState = (item: any) => {
    const rawId = String(item.anilistId || item.id || '').trim();
    const parsedId = Number.parseInt(rawId, 10);
    const hasNumericId = Number.isFinite(parsedId) && /^\d+$/.test(rawId);

    return {
        id: hasNumericId ? parsedId : 0,
        mal_id: Number.parseInt(String(item.malId || '0'), 10) || 0,
        scraperId: String(item.scraperId || '').trim() || (!hasNumericId && isAnimeSessionId(rawId) ? rawId : undefined),
        title: item.title,
        images: { jpg: { large_image_url: item.image, image_url: item.image } },
        score: item.score || 0,
        type: item.type || 'TV',
        status: item.mediaStatus || 'UNKNOWN',
        episodes: item.totalCount || null,
        genres: item.genres?.map((g: string) => ({ name: g })) || [],
        synopsis: item.synopsis || ''
    };
};

export default function UserProfilePage() {
    const { uid } = useParams<{ uid: string }>();
    const navigate = useNavigate();
    const { user: currentUser } = useAuth();
    const [profile, setProfile] = useState<PublicUserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('profile');

    // Redirect to own profile if viewing self
    useEffect(() => {
        if (currentUser && uid === currentUser.uid) {
            navigate('/profile', { replace: true });
        }
    }, [currentUser, uid, navigate]);

    useEffect(() => {
        const fetchProfile = async () => {
            if (!uid) return;
            setLoading(true);
            try {
                const data = await userSearchService.getUserProfile(uid);
                setProfile(data);
            } catch (error) {
                console.error('Failed to fetch user profile:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, [uid]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] pt-20">
                <div className="relative w-full h-[35vh] md:h-[45vh] animate-pulse bg-[#1c1c1c]">
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent" />
                </div>
                <div className="max-w-7xl mx-auto px-4 md:px-8 py-12">
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                        <div className="bg-[#1c1c1c] rounded-2xl h-64 animate-pulse" />
                        <div className="bg-[#1c1c1c] rounded-2xl h-64 animate-pulse" />
                    </div>
                </div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                <div className="text-center">
                    <User className="w-16 h-16 text-gray-700 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-white mb-2">User not found</h2>
                    <p className="text-gray-500 mb-6">This profile doesn't exist or is no longer available.</p>
                    <button
                        onClick={() => navigate('/users')}
                        className="px-6 py-3 bg-yorumi-accent text-black font-bold rounded-xl hover:bg-yorumi-accent/90 transition-colors"
                    >
                        Back to Community
                    </button>
                </div>
            </div>
        );
    }

    const isMangaOverview = activeTab === 'manga-overview';

    return (
        <div className="min-h-screen bg-[#0a0a0a] relative">
            {/* Hero Banner */}
            <div className="relative w-full h-[35vh] md:h-[45vh] flex flex-col items-center justify-center overflow-hidden">
                <div className="absolute inset-0 z-0">
                    <img
                        src={resolveStaticAssetUrl(profile.banner) || DEFAULT_BANNER_URL}
                        alt="Banner"
                        className="w-full h-full object-cover opacity-60"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/50 to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a]/30 to-transparent" />
                </div>


                {/* Profile Greeting */}
                <div className="relative z-10 flex flex-col items-center mt-4 md:mt-10 px-4 text-center">
                    <h1 className="text-4xl md:text-7xl font-black text-white tracking-tight mb-2 drop-shadow-2xl">
                        <span className={isMangaOverview ? 'text-yorumi-manga' : 'text-yorumi-accent'}>
                            {profile.displayName?.split(' ')[0] || 'User'}
                        </span>
                        {'\'s Profile'}
                    </h1>
                </div>

                {/* Tabs */}
                <div className="absolute bottom-0 w-full flex justify-center z-20">
                    <div className="flex flex-nowrap overflow-x-auto justify-start md:justify-center gap-6 md:gap-16 border-b border-white/10 w-full max-w-5xl px-4 md:px-8 mx-4 no-scrollbar pb-0.5">
                        <TabButton
                            active={activeTab === 'profile'}
                            onClick={() => setActiveTab('profile')}
                            icon={<User className={activeTab === 'profile' ? "w-5 h-5 fill-current" : "w-5 h-5"} />}
                            label="Profile"
                        />
                        <TabButton
                            active={activeTab === 'anime-overview'}
                            onClick={() => setActiveTab('anime-overview')}
                            icon={<Cat className={activeTab === 'anime-overview' ? "w-5 h-5 fill-current" : "w-5 h-5"} />}
                            label="Anime Overview"
                        />
                        <TabButton
                            active={activeTab === 'manga-overview'}
                            onClick={() => setActiveTab('manga-overview')}
                            icon={<Book className={activeTab === 'manga-overview' ? "w-5 h-5 fill-current" : "w-5 h-5"} />}
                            label="Manga Overview"
                            activeClassName="text-yorumi-manga border-yorumi-manga"
                        />
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-3 md:px-8 py-8 md:py-12 relative z-10">
                {activeTab === 'profile' && <UserProfileTab profile={profile} />}
                {activeTab === 'anime-overview' && <UserAnimeOverview profile={profile} />}
                {activeTab === 'manga-overview' && <UserMangaOverview profile={profile} />}
            </div>
        </div>
    );
}

/* ─── Shared Components ─── */

const TabButton = ({
    active, onClick, icon, label,
    activeClassName = 'text-yorumi-accent border-yorumi-accent'
}: {
    active: boolean; onClick: () => void; icon: React.ReactNode;
    label: string; activeClassName?: string;
}) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2 md:gap-3 pb-3 md:pb-4 text-sm md:text-lg font-bold transition-all duration-300 border-b-2 outline-none whitespace-nowrap shrink-0 ${active
            ? activeClassName
            : 'text-gray-400 border-transparent hover:text-white hover:border-white/20'
        }`}
    >
        {icon}{label}
    </button>
);

const StatItem = ({ value, label, valueClassName = 'text-[#3cb6ff]' }: { value: string; label: string; valueClassName?: string }) => (
    <div className="text-center">
        <div className={`text-3xl md:text-4xl font-black leading-none mb-2 ${valueClassName}`}>{value}</div>
        <div className="text-[10px] md:text-[11px] font-bold text-gray-500 tracking-widest">{label}</div>
    </div>
);

/* ─── Activity Heatmap ─── */

const ActivityHeatmap = ({ activityData }: { activityData: Record<string, number> }) => {
    const weeks = 29;
    const days = 7;
    const grid: React.ReactNode[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let w = 0; w < weeks; w++) {
        for (let d = 0; d < days; d++) {
            const daysAgo = (weeks - 1 - w) * days + (6 - d);
            const date = new Date(today);
            date.setDate(date.getDate() - daysAgo);

            if (date > today) {
                grid.push(<div key={`${w}-${d}`} className="w-[7px] h-[7px] md:w-3.5 md:h-3.5 rounded-sm opacity-0" />);
                continue;
            }

            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const dateString = `${year}-${month}-${day}`;
            const amount = activityData[dateString] || 0;

            let color = 'bg-[#3b3b3b]';
            if (amount >= 5) color = 'bg-[#39d353]';
            else if (amount >= 3) color = 'bg-[#26a641]';
            else if (amount >= 2) color = 'bg-[#006d32]';
            else if (amount >= 1) color = 'bg-[#0e4429]';

            const displayDate = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
            const tooltipPositionClass = w === 0 ? 'left-0 translate-x-0' : w === weeks - 1 ? 'right-0 translate-x-0' : 'left-1/2 -translate-x-1/2';
            const tooltipArrowClass = w === 0 ? 'left-4' : w === weeks - 1 ? 'right-4' : 'left-1/2 -translate-x-1/2';
            const placeTooltipAbove = d >= days - 2;
            const tooltipVerticalClass = placeTooltipAbove ? 'bottom-full mb-2' : 'top-full mt-2';
            const tooltipArrowVerticalClass = placeTooltipAbove ? 'top-full border-t-[#1a1c23]' : 'bottom-full border-b-[#1a1c23]';

            grid.push(
                <div key={`${w}-${d}`} className="relative group/tooltip">
                    <div className={`w-[7px] h-[7px] md:w-3.5 md:h-3.5 rounded-[2px] md:rounded-[3px] ${color} transition-colors hover:ring-1 hover:ring-white/50 cursor-pointer`} />
                    <div className={`absolute ${tooltipVerticalClass} ${tooltipPositionClass} w-max px-3 py-2 bg-[#1a1c23] text-white text-xs rounded-md opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-50 pointer-events-none shadow-xl border border-white/10 flex flex-col items-center`}>
                        <span className="font-bold text-[13px] mb-1">{displayDate}</span>
                        <div className="flex items-center gap-1.5 text-gray-400 font-medium">
                            <div className="w-2 h-2 rounded-full bg-[#518feb]" />
                            Amount: <span className="text-white font-bold">{amount}</span>
                        </div>
                        <div className={`absolute ${tooltipArrowVerticalClass} ${tooltipArrowClass} border-4 border-transparent`} />
                    </div>
                </div>
            );
        }
    }

    return (
        <div>
            <h3 className="text-xs font-bold text-gray-500 mb-3 px-1">Activity Overview</h3>
            <div className="bg-[#1c1c1c] rounded-2xl p-4 md:p-6 overflow-visible">
                <div className="w-full flex justify-center overflow-visible pt-2 md:pt-4">
                    <div className="grid grid-rows-7 grid-flow-col gap-[2px] md:gap-[4px] overflow-visible">
                        {grid}
                    </div>
                </div>
                <div className="flex items-center justify-end gap-2 mt-4 text-[11px] text-gray-500 font-medium flex-wrap">
                    <span>Less</span>
                    <div className="flex gap-1">
                        {['bg-[#3b3b3b]','bg-[#0e4429]','bg-[#006d32]','bg-[#26a641]','bg-[#39d353]'].map(c => (
                            <div key={c} className={`w-2.5 h-2.5 rounded-[2px] ${c}`} />
                        ))}
                    </div>
                    <span>More</span>
                </div>
            </div>
        </div>
    );
};

/* ─── Genre overview ─── */

const GenreOverview = ({ genreCounts, label = 'Genre Overview' }: { genreCounts: Record<string, number>; label?: string }) => {
    const sorted = Object.entries(genreCounts).sort(([, a], [, b]) => b - a);
    const hasHistory = sorted.some(([, c]) => c > 0);
    const accentPalette = ['bg-[#ff579c]', 'bg-[#518feb]', 'bg-[#61ffb8]', 'bg-[#ffd768]', 'bg-[#6d94b0]', 'bg-[#b06d6d]', 'bg-[#986db0]', 'bg-[#6db091]'];
    const top4 = (sorted.length > 0 ? sorted : [['Romance', 0], ['Action', 0], ['Fantasy', 0], ['Drama', 0]])
        .slice(0, 4)
        .map(([genre, count], i) => ({
            label: genre as string,
            count: count as number,
            bg: hasHistory ? accentPalette[i] : 'bg-gray-600',
            text: hasHistory ? accentPalette[i].replace('bg-', 'text-') : 'text-gray-400',
        }));
    const totalEntries = sorted.reduce((sum, [, count]) => sum + count, 0);
    const footerSegments = hasHistory
        ? sorted.slice(0, 8).map(([genre, count], i) => ({
            genre,
            count,
            width: totalEntries > 0 ? `${(count / totalEntries) * 100}%` : '0%',
            bg: accentPalette[i % accentPalette.length],
        }))
        : [];

    return (
        <div>
            <h3 className="text-xs font-bold text-gray-500 mb-3 px-1">{label}</h3>
            <div className="bg-[#1c1c1c] rounded-3xl overflow-hidden">
                <div className="p-5 md:p-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {top4.map(g => (
                        <div key={g.label} className="flex flex-col items-center">
                            <div className={`w-full py-2.5 ${g.bg} rounded-xl text-center font-bold text-[13px] text-white mb-2 shadow-lg truncate px-3`}>
                                {g.label}
                            </div>
                            <div className="mt-1.5 text-[12px] text-gray-500 flex items-center gap-1 font-bold leading-none">
                                <span className={`font-black ${g.text} text-[14px]`}>{g.count}</span>
                                <span className="text-gray-500">Entries</span>
                            </div>
                        </div>
                    ))}
                </div>
                </div>
                {hasHistory && footerSegments.length > 0 && (
                    <div className="h-4 flex w-full mt-1">
                        {footerSegments.map((segment) => (
                            <div
                                key={segment.genre}
                                className={segment.bg}
                                style={{ width: segment.width }}
                                title={`${segment.genre}: ${segment.count}`}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

/* ─── Helpers ─── */

const normalizeTitleKey = (title?: string) =>
    (title || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .trim();

const parseEpisodeNumber = (value: unknown): number => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const raw = String(value ?? '').trim();
    const direct = Number(raw);
    if (Number.isFinite(direct)) return direct;
    const keyedMatch = raw.match(/^ep:(\d+(?:\.\d+)?)$/i) || raw.match(/:e(\d+(?:\.\d+)?)$/i);
    if (keyedMatch) return Number(keyedMatch[1]);
    const match = raw.match(/(\d+(?:\.\d+)?)/);
    return match ? Number(match[1]) : NaN;
};

const normalizeGenres = (genres: unknown): string[] => {
    if (!Array.isArray(genres)) return [];
    return genres
        .map((genre) => (typeof genre === 'string' ? genre : (genre as { name?: string })?.name || genre))
        .filter((genre): genre is string => typeof genre === 'string' && genre.trim().length > 0);
};

const buildAnimeGenreCounts = (profile: PublicUserProfile): Record<string, number> => {
    const genreCounts: Record<string, number> = {};
    const animeGenreMap = new Map<string, string[]>();

    (profile.watchList || []).forEach((item: any) => {
        animeGenreMap.set(String(item.id), normalizeGenres(item.genres));
    });

    (profile.continueWatching || []).forEach((item: any) => {
        const animeId = String(item.animeId);
        if (!animeGenreMap.has(animeId)) {
            animeGenreMap.set(animeId, normalizeGenres(profile.animeGenreCache?.[animeId] || []));
        }
    });

    (profile.favoriteAnime || []).forEach((item: any) => {
        const animeId = String(item.id);
        if (!animeGenreMap.has(animeId)) {
            animeGenreMap.set(animeId, normalizeGenres(item.genres?.length ? item.genres : profile.animeGenreCache?.[animeId] || []));
        }
    });

    animeGenreMap.forEach((genres) => {
        genres.forEach((genreName) => {
            genreCounts[genreName] = (genreCounts[genreName] || 0) + 1;
        });
    });

    return genreCounts;
};

const buildMangaGenreCounts = (profile: PublicUserProfile): Record<string, number> => {
    const genreCounts: Record<string, number> = {};
    const mangaGenreMap = new Map<string, string[]>();

    (profile.readList || []).forEach((item: any) => {
        mangaGenreMap.set(String(item.id), normalizeGenres(item.genres));
    });

    (profile.continueReading || []).forEach((item: any) => {
        const mangaId = String(item.mangaId);
        if (!mangaGenreMap.has(mangaId)) {
            mangaGenreMap.set(mangaId, normalizeGenres(profile.mangaGenreCache?.[mangaId] || []));
        }
    });

    (profile.favoriteManga || []).forEach((item: any) => {
        const mangaId = String(item.id);
        if (!mangaGenreMap.has(mangaId)) {
            mangaGenreMap.set(mangaId, normalizeGenres(item.genres?.length ? item.genres : profile.mangaGenreCache?.[mangaId] || []));
        }
    });

    mangaGenreMap.forEach((genres) => {
        genres.forEach((genreName) => {
            genreCounts[genreName] = (genreCounts[genreName] || 0) + 1;
        });
    });

    return genreCounts;
};

/* ─── Profile Tab ─── */

type CompletionMeta = {
    totalCount: number;
    isFinished: boolean;
};

const normalizeStatusKey = (value: unknown) =>
    String(value ?? '')
        .toLowerCase()
        .replace(/[^a-z]/g, '');

const isFinishedAnimeStatus = (value: unknown) =>
    new Set(['finished', 'finishedairing', 'completed']).has(normalizeStatusKey(value));

const isFinishedMangaStatus = (value: unknown) =>
    new Set(['finished', 'finishedpublishing', 'completed']).has(normalizeStatusKey(value));

const readPositiveCount = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
};

const upsertCompletionMeta = (
    metaMap: Map<string, CompletionMeta>,
    key: string,
    item: any,
    isFinishedStatus: (value: unknown) => boolean
) => {
    const current = metaMap.get(key) || { totalCount: 0, isFinished: false };
    metaMap.set(key, {
        totalCount: Math.max(current.totalCount, readPositiveCount(item?.totalCount)),
        isFinished: current.isFinished || isFinishedStatus(item?.mediaStatus || item?.status)
    });
};

const applyAnimeCompletionSnapshot = (
    animeGroups: Map<string, Set<string>>,
    completionMeta: Map<string, CompletionMeta>,
    animeCompletionCache: Record<string, { title?: string; totalCount?: number; mediaStatus?: string }>
) => {
    Object.entries(animeCompletionCache || {}).forEach(([animeId, snapshot]) => {
        let targetKey = normalizeTitleKey(snapshot?.title) || `history:${animeId}`;
        let foundKey: string | null = null;
        for (const [gKey, ids] of animeGroups.entries()) {
            if (ids.has(animeId)) {
                foundKey = gKey;
                break;
            }
        }
        if (foundKey) {
            targetKey = foundKey;
        } else {
            if (!animeGroups.has(targetKey)) {
                animeGroups.set(targetKey, new Set<string>());
            }
            animeGroups.get(targetKey)!.add(animeId);
        }
        upsertCompletionMeta(completionMeta, targetKey, snapshot, isFinishedAnimeStatus);
    });
};

const applyMangaCompletionSnapshot = (
    mangaGroups: Map<string, Set<string>>,
    completionMeta: Map<string, CompletionMeta>,
    mangaCompletionCache: Record<string, { title?: string; totalCount?: number; mediaStatus?: string }>
) => {
    Object.entries(mangaCompletionCache || {}).forEach(([mangaId, snapshot]) => {
        let targetKey = normalizeTitleKey(snapshot?.title) || `history:${mangaId}`;
        let foundKey: string | null = null;
        for (const [gKey, ids] of mangaGroups.entries()) {
            if (ids.has(mangaId)) {
                foundKey = gKey;
                break;
            }
        }
        if (foundKey) {
            targetKey = foundKey;
        } else {
            if (!mangaGroups.has(targetKey)) {
                mangaGroups.set(targetKey, new Set<string>());
            }
            mangaGroups.get(targetKey)!.add(mangaId);
        }
        upsertCompletionMeta(completionMeta, targetKey, snapshot, isFinishedMangaStatus);
    });
};

const countCompletedAnimeGroups = (
    animeGroups: Map<string, Set<string>>,
    animeGroupProgress: Map<string, Set<number>>,
    episodeHistory: Record<string, Array<number | string>>,
    completionMeta: Map<string, CompletionMeta>
) => Array.from(animeGroups.entries()).reduce((sum, [key, ids]) => {
    const meta = completionMeta.get(key);
    if (!meta || !meta.isFinished || meta.totalCount <= 0) return sum;

    const uniqueEpisodes = new Set<number>();
    ids.forEach((id) => (episodeHistory[id] || []).forEach((ep) => {
        const n = parseEpisodeNumber(ep);
        if (n > 0) uniqueEpisodes.add(n);
    }));
    (animeGroupProgress.get(key) || []).forEach((ep) => uniqueEpisodes.add(ep));

    return sum + (uniqueEpisodes.size >= meta.totalCount ? 1 : 0);
}, 0);

const countCompletedMangaGroups = (
    mangaGroups: Map<string, Set<string>>,
    mangaGroupProgress: Map<string, Set<string>>,
    chapterHistory: Record<string, string[]>,
    completionMeta: Map<string, CompletionMeta>
) => Array.from(mangaGroups.entries()).reduce((sum, [key, ids]) => {
    const meta = completionMeta.get(key);
    if (!meta || !meta.isFinished || meta.totalCount <= 0) return sum;

    const uniqueChapters = new Set<string>();
    ids.forEach((id) => (chapterHistory[id] || []).forEach((ch) => uniqueChapters.add(String(ch))));
    (mangaGroupProgress.get(key) || []).forEach((ch) => uniqueChapters.add(ch));

    return sum + (uniqueChapters.size >= meta.totalCount ? 1 : 0);
}, 0);

const UserProfileTab = ({ profile }: { profile: PublicUserProfile }) => {
    const navigate = useNavigate();
    // Porting the exact Map-based logic from ProfilePage.tsx for mathematical parity.
    const animeGroups = new Map<string, Set<string>>();
    const animeGroupProgress = new Map<string, Set<number>>();
    const animeCompletionMeta = new Map<string, CompletionMeta>();
    const ensureAnimeGroup = (key: string) => {
        if (!animeGroups.has(key)) animeGroups.set(key, new Set<string>());
        return animeGroups.get(key)!;
    };
    const ensureAnimeProgress = (key: string) => {
        if (!animeGroupProgress.has(key)) animeGroupProgress.set(key, new Set<number>());
        return animeGroupProgress.get(key)!;
    };

    (profile.watchList || []).forEach((i: any) => {
        const key = normalizeTitleKey(i.title) || `id:${i.id}`;
        ensureAnimeGroup(key).add(String(i.id));
        upsertCompletionMeta(animeCompletionMeta, key, i, isFinishedAnimeStatus);
    });
    (profile.continueWatching || []).forEach((i: any) => {
        const key = normalizeTitleKey(i.animeTitle) || `id:${i.animeId}`;
        ensureAnimeGroup(key).add(String(i.animeId));
        upsertCompletionMeta(animeCompletionMeta, key, i, isFinishedAnimeStatus);
        const ep = parseEpisodeNumber(i.episodeNumber);
        if (ep > 0) ensureAnimeProgress(key).add(ep);
    });
    (profile.favoriteAnime || []).forEach((i: any) => {
        const key = normalizeTitleKey(i.title) || `id:${i.id}`;
        ensureAnimeGroup(key).add(String(i.id));
        upsertCompletionMeta(animeCompletionMeta, key, i, isFinishedAnimeStatus);
    });
    applyAnimeCompletionSnapshot(animeGroups, animeCompletionMeta, profile.animeCompletionCache || {});
    Object.keys(profile.episodeHistory || {}).forEach(id => {
        if (!Array.from(animeGroups.values()).some(ids => ids.has(id))) ensureAnimeGroup(`id:${id}`).add(id);
    });
    Object.keys(profile.animeWatchTime || {}).forEach(id => {
        if (!Array.from(animeGroups.values()).some(ids => ids.has(id))) ensureAnimeGroup(`id:${id}`).add(id);
    });

    const mangaGroups = new Map<string, Set<string>>();
    const mangaGroupProgress = new Map<string, Set<string>>();
    const mangaCompletionMeta = new Map<string, CompletionMeta>();
    const ensureMangaGroup = (key: string) => {
        if (!mangaGroups.has(key)) mangaGroups.set(key, new Set<string>());
        return mangaGroups.get(key)!;
    };
    const ensureMangaProgress = (key: string) => {
        if (!mangaGroupProgress.has(key)) mangaGroupProgress.set(key, new Set<string>());
        return mangaGroupProgress.get(key)!;
    };

    (profile.readList || []).forEach((i: any) => {
        const key = normalizeTitleKey(i.title) || `id:${i.id}`;
        ensureMangaGroup(key).add(String(i.id));
        upsertCompletionMeta(mangaCompletionMeta, key, i, isFinishedMangaStatus);
    });
    (profile.favoriteManga || []).forEach((i: any) => {
        const key = normalizeTitleKey(i.title) || `id:${i.id}`;
        ensureMangaGroup(key).add(String(i.id));
        upsertCompletionMeta(mangaCompletionMeta, key, i, isFinishedMangaStatus);
    });
    (profile.continueReading || []).forEach((i: any) => {
        const key = normalizeTitleKey(i.mangaTitle) || `id:${i.mangaId}`;
        ensureMangaGroup(key).add(String(i.mangaId));
        upsertCompletionMeta(mangaCompletionMeta, key, i, isFinishedMangaStatus);
        if (i.chapterNumber) ensureMangaProgress(key).add(String(i.chapterNumber));
    });
    applyMangaCompletionSnapshot(mangaGroups, mangaCompletionMeta, profile.mangaCompletionCache || {});
    Object.keys(profile.chapterHistory || {}).forEach(id => {
        if (!Array.from(mangaGroups.values()).some(ids => ids.has(id))) ensureMangaGroup(`id:${id}`).add(id);
    });

    const animeCount = animeGroups.size;
    const mangaCount = mangaGroups.size;

    const totalEpisodes = Array.from(animeGroups.entries()).reduce((sum, [key, ids]) => {
        const unique = new Set<number>();
        ids.forEach(id => (profile.episodeHistory?.[id] || []).forEach(ep => {
            const n = parseEpisodeNumber(ep);
            if (n > 0) unique.add(n);
        }));
        (animeGroupProgress.get(key) || []).forEach(ep => unique.add(ep));
        return sum + unique.size;
    }, 0);

    const totalChapters = Array.from(mangaGroups.entries()).reduce((sum, [key, ids]) => {
        const unique = new Set<string>();
        ids.forEach(id => (profile.chapterHistory?.[id] || []).forEach(ch => unique.add(String(ch))));
        (mangaGroupProgress.get(key) || []).forEach(ch => unique.add(ch));
        return sum + unique.size;
    }, 0);

    const completedAnime = countCompletedAnimeGroups(animeGroups, animeGroupProgress, profile.episodeHistory || {}, animeCompletionMeta);
    const completedManga = countCompletedMangaGroups(mangaGroups, mangaGroupProgress, profile.chapterHistory || {}, mangaCompletionMeta);

    // Combined genre analysis including continueWatching/Reading for accurate public breakdown.
    const genreCounts = {
        ...buildAnimeGenreCounts(profile)
    };
    Object.entries(buildMangaGenreCounts(profile)).forEach(([name, count]) => {
        genreCounts[name] = (genreCounts[name] || 0) + count;
    });

    const memberSince = profile.creationTime
        ? new Date(profile.creationTime).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })
        : null;

    return (
        <div className="w-full max-w-[1180px] mx-auto grid grid-cols-1 xl:grid-cols-2 gap-6 md:gap-8 xl:gap-8">
            {/* Left */}
            <div className="space-y-6 md:space-y-8 min-w-0">
                {/* Profile Card */}
                <div
                    className="bg-[#1c1c1c] rounded-2xl p-5 md:p-7 overflow-hidden"
                    style={profile.profileCardBackground ? {
                        backgroundImage: `linear-gradient(90deg, rgba(28,28,28,0.94) 0%, rgba(28,28,28,0.9) 48%, rgba(28,28,28,0.84) 100%), url(${profile.profileCardBackground})`,
                        backgroundSize: 'cover', backgroundPosition: 'center'
                    } : undefined}
                >
                    <h2 className="text-[20px] md:text-[22px] font-bold mb-6 flex items-center gap-3 text-white">
                        <User className="w-6 h-6 text-[#518feb] fill-[#518feb]" />
                        Profile Details
                    </h2>
                    <div className="flex flex-col sm:flex-row gap-6 sm:gap-8">
                        <div className="flex justify-center sm:justify-start sm:pt-1">
                            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-[#3cb6ff] shadow-xl bg-yorumi-main shrink-0">
                                {profile.avatar ? (
                                    <img src={resolveStaticAssetUrl(profile.avatar) || profile.avatar} alt={profile.displayName} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-white font-bold text-4xl">
                                        {profile.displayName?.charAt(0).toUpperCase() || '?'}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex-1 space-y-5">
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1.5">Display Name</label>
                                <div className="text-xl md:text-2xl font-black text-white tracking-tight leading-none">{profile.displayName}</div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1.5">Member Since</label>
                                <div className="text-sm md:text-[15px] font-bold text-white">{memberSince || 'Unknown'}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Overall Stats */}
                <div>
                    <h3 className="text-xs font-bold text-gray-500 mb-3 px-1">Overall Stats</h3>
                    <div className="bg-[#1c1c1c] rounded-3xl p-5 md:p-6">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                            <div className="text-center">
                                <div className="text-2xl md:text-3xl font-black text-yorumi-accent leading-none mb-1">{animeCount}</div>
                                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Anime</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl md:text-3xl font-black text-yorumi-manga leading-none mb-1">{mangaCount}</div>
                                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Manga</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl md:text-3xl font-black text-[#61ffb8] leading-none mb-1">{totalEpisodes}</div>
                                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Episodes</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl md:text-3xl font-black text-[#ffd768] leading-none mb-1">{totalChapters}</div>
                                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Chapters</div>
                            </div>
                        </div>
                        {(completedAnime > 0 || completedManga > 0) && (
                            <div className="mt-5 pt-5 border-t border-white/10 text-center">
                                <span className="text-gray-400 text-sm font-semibold">{completedAnime} completed anime • {completedManga} completed manga</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Combined Genre Overview */}
                {Object.keys(genreCounts).length > 0 && (
                    <GenreOverview genreCounts={genreCounts} label="Genre Overview" />
                )}
            </div>

            {/* Right */}
            <div className="space-y-6 md:space-y-8 min-w-0">
                <ActivityHeatmap activityData={profile.activityHistory || {}} />

                {/* Favorite Anime */}
                {(profile.favoriteAnime || []).length > 0 && (
                    <FavoriteBoard
                        items={profile.favoriteAnime}
                        label="Favorite Animes"
                        onClickItem={(id) => navigate(`/anime/details/${getAnimeDetailsRouteId({ id })}`)}
                        accentClass="hover:border-yorumi-accent/70"
                    />
                )}

                {/* Favorite Manga */}
                {(profile.favoriteManga || []).length > 0 && (
                    <FavoriteBoard
                        items={profile.favoriteManga}
                        label="Favorite Mangas"
                        onClickItem={(id) => window.location.pathname !== `/manga/details/${id}` && (window.location.href = `/manga/details/${id}`)}
                        accentClass="hover:border-yorumi-manga/70"
                    />
                )}
            </div>
        </div>
    );
};

/* ─── Reusable Favorite Board ─── */

const FavoriteBoard = ({
    items, label, onClickItem, accentClass
}: {
    items: any[];
    label: string;
    onClickItem: (id: string) => void;
    accentClass: string;
}) => (
    <div>
        <h3 className="text-xs font-bold text-gray-500 mb-3 px-1">{label}</h3>
        <div className="bg-[#1c1c1c] rounded-3xl p-5 md:p-6">
            <div className="grid grid-cols-6 gap-3">
                {items.slice(0, 12).map((item: any) => (
                    <button
                        key={item.id}
                        onClick={() => onClickItem(item.id)}
                        className={`aspect-[2/3] rounded-lg overflow-hidden border border-white/10 transition-colors ${accentClass}`}
                    >
                        <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                    </button>
                ))}
            </div>
        </div>
    </div>
);

/* ─── Carousel ─── */

const ListCarousel = ({
    items, label, onClickItem, accentClass, emptyIcon, emptyText
}: {
    items: any[];
    label: string;
    onClickItem: (item: any) => void;
    accentClass: string;
    emptyIcon: React.ReactNode;
    emptyText: string;
}) => {
    const [emblaRef, emblaApi] = useEmblaCarousel({ align: 'start', containScroll: 'trimSnaps', dragFree: true });
    const scroll = (dir: 'left' | 'right') => { if (!emblaApi) return; dir === 'right' ? emblaApi.scrollNext() : emblaApi.scrollPrev(); };

    return (
        <div>
            <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-xs font-bold text-gray-500">{label}</h3>
                {items.length > 3 && (
                    <div className="flex gap-1">
                        <button onClick={() => scroll('left')} className="p-1 rounded-full bg-white/5 hover:bg-white/10 transition-colors border border-white/10">
                            <ChevronLeft className="w-3.5 h-3.5 text-gray-300" />
                        </button>
                        <button onClick={() => scroll('right')} className="p-1 rounded-full bg-white/5 hover:bg-white/10 transition-colors border border-white/10">
                            <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                        </button>
                    </div>
                )}
            </div>
            {items.length === 0 ? (
                <div className="bg-[#1c1c1c] rounded-2xl p-8 text-center">
                    {emptyIcon}
                    <p className="text-gray-400 text-sm mt-3">{emptyText}</p>
                </div>
            ) : (
                <div className="overflow-hidden" ref={emblaRef}>
                    <div className="flex gap-4">
                        {items.slice(0, 15).map((item: any, idx: number) => (
                            <button
                                key={item.id || idx}
                                onClick={() => onClickItem(item)}
                                className={`flex-[0_0_100px] aspect-[2/3] rounded-xl overflow-hidden border border-white/10 transition-colors ${accentClass} shrink-0`}
                            >
                                <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const RecentActivityBoard = ({ items }: { items: any[] }) => {
    const navigate = useNavigate();
    const recentItems = [...items]
        .sort((a, b) => (Number(b.lastWatched || b.timestamp || 0) - Number(a.lastWatched || a.timestamp || 0)))
        .slice(0, 3);

    if (recentItems.length === 0) {
        return (
            <div>
                <div className="flex items-center justify-between mb-4 px-1">
                    <h3 className="text-xs font-bold text-gray-500">Recent Activity</h3>
                </div>
                <div className="bg-[#1c1c1c] rounded-2xl p-8 text-center">
                    <History className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">No recent anime progress yet.</p>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-4 px-1">
                <h3 className="text-xs font-bold text-gray-500">Recent Activity</h3>
            </div>
            <div className="space-y-3">
                {recentItems.map((item, index) => (
                    <button
                        key={`${item.animeId || item.id}-${index}`}
                        onClick={() => navigate(`/anime/details/${item.animeId || item.id}`)}
                        className="relative flex w-full rounded-xl overflow-hidden h-24 md:h-28 text-left"
                        style={{
                            backgroundImage: `linear-gradient(90deg, rgba(17,17,17,0.95) 0%, rgba(17,17,17,0.9) 45%, rgba(17,17,17,0.82) 100%), url(${item.animeImage || item.image})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center'
                        }}
                    >
                        <div className="h-full w-20 md:w-28 shrink-0">
                            <img src={item.animePoster || item.animeImage || item.image} alt={item.animeTitle || item.title} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col justify-center relative z-10 px-4 md:px-5 py-3 md:py-4">
                            <p className="text-[13px] md:text-[15px] font-bold text-[#518feb] truncate">{item.animeTitle || item.title}</p>
                            <p className="text-[13px] md:text-[15px] font-bold text-gray-100 mb-0.5 truncate">
                                Watched Episode {item.episodeNumber}
                            </p>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};

/* ─── Anime Overview Tab ─── */

const UserAnimeOverview = ({ profile }: { profile: PublicUserProfile }) => {
    const navigate = useNavigate();
    const fmt = new Intl.NumberFormat('en-US');

    const watchList = profile.watchList || [];
    const continueWatching = profile.continueWatching || [];
    const episodeHistory = profile.episodeHistory || {};

    // Exact Map-based grouping for Anime.
    const animeGroups = new Map<string, Set<string>>();
    const animeGroupProgress = new Map<string, Set<number>>();
    const animeCompletionMeta = new Map<string, CompletionMeta>();
    const ensureGroup = (key: string) => {
        if (!animeGroups.has(key)) animeGroups.set(key, new Set<string>());
        return animeGroups.get(key)!;
    };
    const ensureProgress = (key: string) => {
        if (!animeGroupProgress.has(key)) animeGroupProgress.set(key, new Set<number>());
        return animeGroupProgress.get(key)!;
    };

    watchList.forEach((i: any) => {
        const key = normalizeTitleKey(i.title) || `id:${i.id}`;
        ensureGroup(key).add(String(i.id));
        upsertCompletionMeta(animeCompletionMeta, key, i, isFinishedAnimeStatus);
    });
    continueWatching.forEach((i: any) => {
        const key = normalizeTitleKey(i.animeTitle) || `id:${i.animeId}`;
        ensureGroup(key).add(String(i.animeId));
        upsertCompletionMeta(animeCompletionMeta, key, i, isFinishedAnimeStatus);
        const ep = parseEpisodeNumber(i.episodeNumber);
        if (ep > 0) ensureProgress(key).add(ep);
    });
    (profile.favoriteAnime || []).forEach((i: any) => {
        const key = normalizeTitleKey(i.title) || `id:${i.id}`;
        ensureGroup(key).add(String(i.id));
        upsertCompletionMeta(animeCompletionMeta, key, i, isFinishedAnimeStatus);
    });
    applyAnimeCompletionSnapshot(animeGroups, animeCompletionMeta, profile.animeCompletionCache || {});
    Object.keys(episodeHistory).forEach(id => {
        if (!Array.from(animeGroups.values()).some(ids => ids.has(id))) ensureGroup(`id:${id}`).add(id);
    });
    Object.keys(profile.animeWatchTime || {}).forEach(id => {
        if (!Array.from(animeGroups.values()).some(ids => ids.has(id))) ensureGroup(`id:${id}`).add(id);
    });

    const totalAnime = animeGroups.size;
    const totalEpisodes = Array.from(animeGroups.entries()).reduce((sum, [key, ids]) => {
        const unique = new Set<number>();
        ids.forEach(id => (episodeHistory[id] || []).forEach(ep => {
            const n = parseEpisodeNumber(ep);
            if (n > 0) unique.add(n);
        }));
        (animeGroupProgress.get(key) || []).forEach(ep => unique.add(ep));
        return sum + unique.size;
    }, 0);

    const completedAnime = countCompletedAnimeGroups(animeGroups, animeGroupProgress, episodeHistory, animeCompletionMeta);
    const hasStats = totalAnime > 0;
    const valueClass = hasStats ? 'text-[#3cb6ff]' : 'text-gray-400';

    const genreCounts = buildAnimeGenreCounts(profile);

    return (
        <div className="space-y-10">
            <div className="w-full max-w-[1180px] mx-auto grid grid-cols-1 xl:grid-cols-2 gap-6 md:gap-8">
                {/* Left */}
                <div className="space-y-6 md:space-y-8 min-w-0">
                    <div>
                        <h3 className="text-xs font-bold text-gray-500 mb-3 px-1">Anime Stats</h3>
                        <div className="bg-[#1c1c1c] rounded-3xl p-5 md:p-6">
                            <div className="grid grid-cols-3 gap-4 divide-x divide-white/20">
                                <StatItem value={fmt.format(totalAnime)} label="TOTAL ANIMES" valueClassName={valueClass} />
                                <StatItem value={fmt.format(totalEpisodes)} label="EPISODES WATCHED" valueClassName={valueClass} />
                                <StatItem value={fmt.format(completedAnime)} label="COMPLETED ANIME" valueClassName={valueClass} />
                            </div>
                        </div>
                    </div>

                    <GenreOverview genreCounts={genreCounts} label="Anime Genre Overview" />

                    {/* Favorite Anime */}
                    {(profile.favoriteAnime || []).length > 0 && (
                        <FavoriteBoard
                            items={profile.favoriteAnime}
                            label="Favorite Animes"
                            onClickItem={(id) => navigate(`/anime/details/${id}`)}
                            accentClass="hover:border-yorumi-accent/70"
                        />
                    )}
                </div>

                {/* Right */}
                <div className="space-y-6 md:space-y-8 min-w-0">
                    <RecentActivityBoard items={continueWatching} />

                    <ListCarousel
                        items={watchList}
                        label="Watch List"
                        onClickItem={(item) => navigate(`/anime/details/${getStoredAnimeRouteId(item)}`, { state: { anime: buildStoredAnimeState(item) } })}
                        accentClass="hover:border-yorumi-accent/70"
                        emptyIcon={<History className="w-10 h-10 text-gray-700 mx-auto" />}
                        emptyText="No anime in their watch list yet."
                    />
                </div>
            </div>
        </div>
    );
};

/* ─── Manga Overview Tab ─── */

const UserMangaOverview = ({ profile }: { profile: PublicUserProfile }) => {
    const navigate = useNavigate();
    const fmt = new Intl.NumberFormat('en-US');

    const readList = profile.readList || [];
    const continueReading = profile.continueReading || [];
    const chapterHistory = profile.chapterHistory || {};

    // Exact Map-based grouping for Manga.
    const mangaGroups = new Map<string, Set<string>>();
    const mangaGroupProgress = new Map<string, Set<string>>();
    const mangaCompletionMeta = new Map<string, CompletionMeta>();
    const ensureGroup = (key: string) => {
        if (!mangaGroups.has(key)) mangaGroups.set(key, new Set<string>());
        return mangaGroups.get(key)!;
    };
    const ensureProgress = (key: string) => {
        if (!mangaGroupProgress.has(key)) mangaGroupProgress.set(key, new Set<string>());
        return mangaGroupProgress.get(key)!;
    };

    readList.forEach((i: any) => {
        const key = normalizeTitleKey(i.title) || `id:${i.id}`;
        ensureGroup(key).add(String(i.id));
        upsertCompletionMeta(mangaCompletionMeta, key, i, isFinishedMangaStatus);
    });
    (profile.favoriteManga || []).forEach((i: any) => {
        const key = normalizeTitleKey(i.title) || `id:${i.id}`;
        ensureGroup(key).add(String(i.id));
        upsertCompletionMeta(mangaCompletionMeta, key, i, isFinishedMangaStatus);
    });
    continueReading.forEach((i: any) => {
        const key = normalizeTitleKey(i.mangaTitle) || `id:${i.mangaId}`;
        ensureGroup(key).add(String(i.mangaId));
        upsertCompletionMeta(mangaCompletionMeta, key, i, isFinishedMangaStatus);
        if (i.chapterNumber) ensureProgress(key).add(String(i.chapterNumber));
    });
    applyMangaCompletionSnapshot(mangaGroups, mangaCompletionMeta, profile.mangaCompletionCache || {});
    Object.keys(chapterHistory).forEach(id => {
        if (!Array.from(mangaGroups.values()).some(ids => ids.has(id))) ensureGroup(`id:${id}`).add(id);
    });

    const totalManga = mangaGroups.size;
    const totalChapters = Array.from(mangaGroups.entries()).reduce((sum, [key, ids]) => {
        const unique = new Set<string>();
        ids.forEach(id => (chapterHistory[id] || []).forEach(ch => unique.add(String(ch))));
        (mangaGroupProgress.get(key) || []).forEach(ch => unique.add(ch));
        return sum + unique.size;
    }, 0);

    const completedManga = countCompletedMangaGroups(mangaGroups, mangaGroupProgress, chapterHistory, mangaCompletionMeta);
    const hasStats = totalManga > 0;
    const valueClass = hasStats ? 'text-yorumi-manga' : 'text-gray-400';

    const genreCounts = buildMangaGenreCounts(profile);

    return (
        <div className="space-y-10">
            <div className="w-full max-w-[1180px] mx-auto grid grid-cols-1 xl:grid-cols-2 gap-6 md:gap-8">
                {/* Left */}
                <div className="space-y-6 md:space-y-8 min-w-0">
                    <div>
                        <h3 className="text-xs font-bold text-gray-500 mb-3 px-1">Manga Stats</h3>
                        <div className="bg-[#1c1c1c] rounded-3xl p-5 md:p-6">
                            <div className="grid grid-cols-3 gap-4 divide-x divide-white/20">
                                <StatItem value={fmt.format(totalManga)} label="TOTAL MANGA" valueClassName={valueClass} />
                                <StatItem value={fmt.format(totalChapters)} label="CHAPTERS READ" valueClassName={valueClass} />
                                <StatItem value={fmt.format(completedManga)} label="COMPLETED MANGA" valueClassName={valueClass} />
                            </div>
                        </div>
                    </div>

                    <GenreOverview genreCounts={genreCounts} label="Manga Genre Overview" />

                    {/* Favorite Manga */}
                    {(profile.favoriteManga || []).length > 0 && (
                        <FavoriteBoard
                            items={profile.favoriteManga}
                            label="Favorite Mangas"
                            onClickItem={(id) => navigate(`/manga/details/${id}`)}
                            accentClass="hover:border-yorumi-manga/70"
                        />
                    )}
                </div>

                {/* Right */}
                <div className="space-y-6 md:space-y-8 min-w-0">
                    <ListCarousel
                        items={readList}
                        label="Read List"
                        onClickItem={(item) => navigate(`/manga/details/${item.id}`)}
                        accentClass="hover:border-yorumi-manga/70"
                        emptyIcon={<BookOpen className="w-10 h-10 text-gray-700 mx-auto" />}
                        emptyText="No manga in their read list yet."
                    />
                </div>
            </div>
        </div>
    );
};


import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, History, Heart, Pencil, Check, X, BookOpen } from 'lucide-react';
import { storage } from '../utils/storage';
import { useContinueWatching } from '../hooks/useContinueWatching';
import { useContinueReading } from '../hooks/useContinueReading';

type TabType = 'profile' | 'continue-watching' | 'watchlist' | 'continue-reading' | 'readlist';

export default function ProfilePage() {
    const { user, avatar } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    const activeTab = (searchParams.get('tab') as TabType) || 'watchlist';

    const handleTabChange = (tab: TabType) => {
        setSearchParams({ tab });
    };

    // Redirect to home if not logged in
    useEffect(() => {
        if (!user) {
            navigate('/');
        }
    }, [user, navigate]);

    if (!user) return null;

    return (
        <div className="min-h-screen bg-[#0a0a0a] relative">
            {/* Full Width Hero Section */}
            <div className="relative w-full h-[35vh] md:h-[45vh] flex flex-col items-center justify-center overflow-hidden">
                {/* Background Image */}
                <div className="absolute inset-0 z-0">
                    <img
                        src="/anime-bg.png"
                        alt="Background"
                        className="w-full h-full object-cover opacity-60"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/50 to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a]/30 to-transparent" />
                </div>

                {/* Greeting Content */}
                <div className="relative z-10 flex flex-col items-center mt-4 md:mt-10 px-4 text-center">
                    <h1 className="text-4xl md:text-8xl font-black text-white tracking-tight mb-4 drop-shadow-2xl">
                        Hi, <span className="text-yorumi-accent">{user.displayName?.split(' ')[0] || 'User'}</span>
                    </h1>
                    <p className="text-gray-200 text-lg md:text-2xl font-medium drop-shadow-lg">
                        Welcome back to your personal hub
                    </p>
                </div>

                {/* Navigation Tabs - Positioned at bottom of hero */}
                <div className="absolute bottom-0 w-full flex justify-center z-20">
                    <div className="flex flex-nowrap overflow-x-auto justify-start md:justify-center gap-6 md:gap-16 border-b border-white/10 w-full max-w-5xl px-4 md:px-8 mx-4 no-scrollbar pb-0.5">
                        <TabButton
                            active={activeTab === 'profile'}
                            onClick={() => handleTabChange('profile')}
                            icon={<User className={activeTab === 'profile' ? "w-5 h-5 fill-current" : "w-5 h-5"} />}
                            label="Profile"
                        />
                        <TabButton
                            active={activeTab === 'continue-watching'}
                            onClick={() => handleTabChange('continue-watching')}
                            icon={<History className={activeTab === 'continue-watching' ? "w-5 h-5 fill-current" : "w-5 h-5"} />}
                            label="Continue Watching"
                        />
                        <TabButton
                            active={activeTab === 'watchlist'}
                            onClick={() => handleTabChange('watchlist')}
                            icon={<Heart className={activeTab === 'watchlist' ? "w-5 h-5 fill-current" : "w-5 h-5"} />}
                            label="Watch List"
                        />
                        <TabButton
                            active={activeTab === 'continue-reading'}
                            onClick={() => handleTabChange('continue-reading')}
                            icon={<BookOpen className={activeTab === 'continue-reading' ? "w-5 h-5 fill-current" : "w-5 h-5"} />}
                            label="Continue Reading"
                        />
                        <TabButton
                            active={activeTab === 'readlist'}
                            onClick={() => handleTabChange('readlist')}
                            icon={<BookOpen className={activeTab === 'readlist' ? "w-5 h-5 fill-current" : "w-5 h-5"} />}
                            label="Read List"
                        />
                    </div>
                </div>
            </div>

            {/* Content Section */}
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-12 relative z-10">
                {activeTab === 'profile' && <ProfileTab user={user} avatar={avatar} />}
                {activeTab === 'continue-watching' && <ContinueWatchingTab />}
                {activeTab === 'watchlist' && <WatchListTab />}
                {activeTab === 'continue-reading' && <ContinueReadingTab />}
                {activeTab === 'readlist' && <ReadListTab />}
            </div>
        </div>
    );
}

// Components

const TabButton = ({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2 md:gap-3 pb-3 md:pb-4 text-sm md:text-lg font-bold transition-all duration-300 border-b-2 outline-none whitespace-nowrap shrink-0 ${active
            ? 'text-yorumi-accent border-yorumi-accent'
            : 'text-gray-400 border-transparent hover:text-white hover:border-white/20'
            }`}
    >
        {icon}
        {label}
    </button>
);

const ProfileTab = ({ user, avatar }: { user: any, avatar: string | null }) => {
    const { updateName } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [newName, setNewName] = useState(user.displayName || '');
    const [loading, setLoading] = useState(false);

    const handleSave = async () => {
        if (!newName.trim() || newName === user.displayName) {
            setIsEditing(false);
            return;
        }
        setLoading(true);
        try {
            await updateName(newName);
            setIsEditing(false);
        } catch (error) {
            console.error("Failed to update name", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-[#1c1c1c] rounded-2xl p-8 border border-white/5 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                <User className="w-6 h-6 text-yorumi-accent" />
                Profile Details
            </h2>

            <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-yorumi-accent shadow-xl shrink-0 bg-yorumi-main">
                    {avatar ? (
                        <img src={avatar} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-white font-bold text-4xl">
                            {user.displayName?.charAt(0).toUpperCase()}
                        </div>
                    )}
                </div>

                <div className="space-y-6 w-full">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Display Name</label>
                        {isEditing ? (
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    className="bg-black/30 border border-white/10 rounded-lg px-4 py-2 text-white outline-none focus:border-yorumi-accent flex-1 font-medium"
                                    placeholder="Enter display name"
                                    autoFocus
                                />
                                <button
                                    onClick={handleSave}
                                    disabled={loading}
                                    className="p-2 bg-yorumi-accent text-black rounded-lg hover:bg-yorumi-accent/80 transition-colors disabled:opacity-50"
                                >
                                    <Check className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => {
                                        setIsEditing(false);
                                        setNewName(user.displayName || '');
                                    }}
                                    disabled={loading}
                                    className="p-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 group">
                                <div className="text-xl font-bold text-white tracking-tight">{user.displayName || 'No Name Set'}</div>
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="p-1.5 rounded-lg text-gray-400 opacity-0 group-hover:opacity-100 hover:text-white hover:bg-white/10 transition-all"
                                >
                                    <Pencil className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Email Address</label>
                        <div className="text-base font-medium text-gray-300">{user.email}</div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Joined On</label>
                        <div className="text-base font-medium text-gray-300">
                            {user.metadata?.creationTime
                                ? new Date(user.metadata.creationTime).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })
                                : 'Unknown'}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ContinueWatchingTab = () => {
    const { continueWatchingList: history } = useContinueWatching();
    const navigate = useNavigate();

    if (history.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <History className="w-16 h-16 text-gray-700 mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">No History Yet</h3>
                <p className="text-gray-400">Start watching anime to see them appear here!</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3 mb-8">
                <History className="w-8 h-8 text-yorumi-accent" />
                <h2 className="text-3xl font-bold">Continue Watching</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {history.map((item) => (
                    <div
                        key={item.animeId}
                        onClick={() => navigate(`/watch/${item.animeId}?episode=${item.episodeId}`)}
                        className="aspect-video bg-[#1c1c1c] rounded-xl border border-white/5 flex flex-col items-center justify-center group cursor-pointer hover:border-yorumi-accent/50 transition-colors relative overflow-hidden"
                    >
                        {item.animeImage ? (
                            <>
                                <img src={item.animeImage} alt={item.animeTitle} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent" />
                                <div className="absolute bottom-4 left-4 right-4">
                                    <h4 className="font-bold text-white truncate">{item.animeTitle}</h4>
                                    <p className="text-xs text-yorumi-accent">Episode {item.episodeNumber}</p>
                                </div>
                            </>
                        ) : (
                            <>
                                <History className="w-8 h-8 text-gray-600 mb-2 group-hover:text-yorumi-accent transition-colors" />
                                <span className="text-gray-500 text-sm font-medium">History Item</span>
                            </>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

const WatchListTab = () => {
    const [watchlist, setWatchlist] = useState<any[]>([]);
    const navigate = useNavigate();

    useEffect(() => {
        const data = storage.getWatchList();
        setWatchlist(data);
    }, []);

    if (watchlist.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <Heart className="w-16 h-16 text-gray-700 mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">Your List is Empty</h3>
                <p className="text-gray-400">Add anime to your list to track them here!</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <Heart className="w-8 h-8 text-yorumi-accent" />
                    <h2 className="text-3xl font-bold">Watch List</h2>
                </div>

                <div className="bg-[#1c1c1c] p-1 rounded-lg flex items-center gap-1">
                    <span className="px-3 py-1 bg-yorumi-accent text-[#0a0a0a] text-xs font-bold rounded">All</span>
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
                {watchlist.map((item) => (
                    <div
                        key={item.id}
                        onClick={() => navigate(`/anime/${item.id}`)}
                        className="aspect-[2/3] bg-[#1c1c1c] rounded-xl border border-white/5 flex flex-col items-center justify-center group cursor-pointer hover:border-yorumi-accent/50 transition-colors relative overflow-hidden"
                    >
                        {item.image ? (
                            <>
                                <img src={item.image} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                                    <h4 className="font-bold text-white text-sm line-clamp-2">{item.title}</h4>
                                </div>
                            </>
                        ) : (
                            <>
                                <Heart className="w-8 h-8 text-gray-600 mb-2 group-hover:text-yorumi-accent transition-colors" />
                                <span className="text-gray-500 text-sm font-medium">Anime Item</span>
                            </>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

const ContinueReadingTab = () => {
    const { continueReadingList: history } = useContinueReading();
    const navigate = useNavigate();

    if (history.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <BookOpen className="w-16 h-16 text-gray-700 mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">No Reading History Yet</h3>
                <p className="text-gray-400">Start reading manga to see them appear here!</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3 mb-8">
                <BookOpen className="w-8 h-8 text-yorumi-accent" />
                <h2 className="text-3xl font-bold">Continue Reading</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {history.map((item) => (
                    <div
                        key={item.mangaId}
                        onClick={() => navigate(`/read/${item.mangaId}?chapter=${item.chapterId}`)}
                        className="aspect-video bg-[#1c1c1c] rounded-xl border border-white/5 flex flex-col items-center justify-center group cursor-pointer hover:border-yorumi-accent/50 transition-colors relative overflow-hidden"
                    >
                        {item.mangaImage ? (
                            <>
                                <img src={item.mangaImage} alt={item.mangaTitle} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent" />
                                <div className="absolute bottom-4 left-4 right-4">
                                    <h4 className="font-bold text-white truncate">{item.mangaTitle}</h4>
                                    <p className="text-xs text-yorumi-accent">Chapter {item.chapterNumber}</p>
                                </div>
                            </>
                        ) : (
                            <>
                                <BookOpen className="w-8 h-8 text-gray-600 mb-2 group-hover:text-yorumi-accent transition-colors" />
                                <span className="text-gray-500 text-sm font-medium">History Item</span>
                            </>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

const ReadListTab = () => {
    const [readlist, setReadlist] = useState<any[]>([]);
    const navigate = useNavigate();

    useEffect(() => {
        const data = storage.getReadList();
        setReadlist(data);
    }, []);

    if (readlist.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <BookOpen className="w-16 h-16 text-gray-700 mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">Your List is Empty</h3>
                <p className="text-gray-400">Add manga to your list to track them here!</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <BookOpen className="w-8 h-8 text-yorumi-accent" />
                    <h2 className="text-3xl font-bold">Read List</h2>
                </div>

                <div className="bg-[#1c1c1c] p-1 rounded-lg flex items-center gap-1">
                    <span className="px-3 py-1 bg-yorumi-accent text-[#0a0a0a] text-xs font-bold rounded">All</span>
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
                {readlist.map((item) => (
                    <div
                        key={item.id}
                        onClick={() => navigate(`/manga/${item.id}`)}
                        className="aspect-[2/3] bg-[#1c1c1c] rounded-xl border border-white/5 flex flex-col items-center justify-center group cursor-pointer hover:border-yorumi-accent/50 transition-colors relative overflow-hidden"
                    >
                        {item.image ? (
                            <>
                                <img src={item.image} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                                    <h4 className="font-bold text-white text-sm line-clamp-2">{item.title}</h4>
                                </div>
                            </>
                        ) : (
                            <>
                                <BookOpen className="w-8 h-8 text-gray-600 mb-2 group-hover:text-yorumi-accent transition-colors" />
                                <span className="text-gray-500 text-sm font-medium">Manga Item</span>
                            </>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};



import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, ArrowLeft } from 'lucide-react';
import { userSearchService, type PublicUserProfile } from '../services/userService';
import LibraryPage from './LibraryPage';

export default function UserProfilePage() {
    const { uid } = useParams<{ uid: string }>();
    const navigate = useNavigate();
    const [profile, setProfile] = useState<PublicUserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        const fetchProfile = async () => {
            if (!uid) {
                setLoading(false);
                return;
            }
            setLoading(true);
            try {
                const data = await userSearchService.getUserProfile(uid);
                if (!cancelled) setProfile(data);
            } catch (error) {
                console.error('Failed to fetch user profile:', error);
                if (!cancelled) setProfile(null);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        void fetchProfile();
        return () => {
            cancelled = true;
        };
    }, [uid]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] px-4 md:px-14 pt-24 md:pt-28 pb-24">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="h-16 w-16 md:h-20 md:w-20 rounded-full bg-white/[0.06] animate-pulse" />
                        <div className="space-y-2.5">
                            <div className="h-6 w-40 rounded-lg bg-white/[0.06] animate-pulse" />
                            <div className="h-4 w-56 rounded-lg bg-white/[0.04] animate-pulse" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                        <div className="h-48 rounded-2xl bg-white/[0.04] animate-pulse" />
                        <div className="h-48 rounded-2xl bg-white/[0.04] animate-pulse" />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                        {Array.from({ length: 6 }).map((_, idx) => (
                            <div key={idx} className="aspect-[2/3] rounded-xl bg-white/[0.04] animate-pulse" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
                <div className="text-center">
                    <User className="w-14 h-14 text-zinc-600 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">User not found</h2>
                    <p className="text-sm text-zinc-400 mb-6">This profile doesn&apos;t exist or hasn&apos;t synced yet.</p>
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-black text-sm font-semibold rounded-full hover:bg-zinc-200 transition-colors cursor-pointer"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Go back
                    </button>
                </div>
            </div>
        );
    }

    return <LibraryPage readOnlyProfile={profile} />;
}

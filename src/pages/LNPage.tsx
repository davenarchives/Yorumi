import { useNavigate } from 'react-router-dom';
import LNSpotlight from '../features/ln/components/LNSpotlight';
import LatestLNUpdates from '../features/ln/components/LatestLNUpdates';
import AllTimePopularLN from '../features/ln/components/AllTimePopularLN';
import Top100LN from '../features/ln/components/Top100LN';
import type { LightNovel } from '../types/ln';

export default function LNPage() {
    const navigate = useNavigate();

    const handleLNClick = (lnId: string, autoRead?: boolean, lnData?: LightNovel) => {
        navigate(`/ln/details/${lnId}`, { state: { autoRead, ln: lnData } });
    };

    return (
        <div className="min-h-screen pb-20">
            {/* Hero Spotlight Carousel */}
            <LNSpotlight onLNClick={handleLNClick} />

            <div className="w-full max-w-7xl mx-auto px-8 md:px-14 z-10 relative mt-8">
                {/* Latest LN Updates */}
                <LatestLNUpdates onLNClick={handleLNClick} />

                {/* All Time Popular Light Novels */}
                <AllTimePopularLN onLNClick={handleLNClick} />

                {/* Top 100 Light Novels */}
                <Top100LN onLNClick={handleLNClick} />
            </div>
        </div>
    );
}

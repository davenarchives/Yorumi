import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LNSpotlight from '../features/ln/components/LNSpotlight';
import LatestLNUpdates from '../features/ln/components/LatestLNUpdates';
import AllTimePopularLN from '../features/ln/components/AllTimePopularLN';
import Top100LN from '../features/ln/components/Top100LN';
import PopularKoreanNovels from '../features/ln/components/PopularKoreanNovels';
import PopularChineseNovels from '../features/ln/components/PopularChineseNovels';
import type { LightNovel } from '../types/ln';

export default function LNPage() {
    const navigate = useNavigate();
    const [backdrop, setBackdrop] = useState('');

    const handleLNClick = (lnId: string, autoRead?: boolean, lnData?: LightNovel) => {
        const routeId = String(lnData?.id || lnId).trim();
        navigate(`/ln/details/${encodeURIComponent(routeId)}`, { state: { autoRead, ln: lnData } });
    };

    return (
        <div className="media-home-perf relative min-h-screen overflow-hidden bg-[#070707] pb-4 md:pb-20">
            {backdrop && <div className="pointer-events-none absolute inset-0 overflow-hidden hidden md:block" aria-hidden="true">
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${backdrop})`, filter: 'blur(100px) saturate(2.4) brightness(1.05)', transform: 'scale(1.2)', opacity: 0.35 }} />
                <div className="absolute inset-0 bg-[#070707]/65" />
            </div>}
            {/* Hero Spotlight Carousel */}
            <LNSpotlight onBackdropChange={setBackdrop} onLNClick={handleLNClick} />

            <div className="reading-home-sections relative z-10 mx-auto mt-3 md:-mt-6 w-full max-w-[1440px] px-4 sm:px-10 md:px-14 lg:px-16">
                {/* Popular Korean Web Novels */}
                <PopularKoreanNovels onLNClick={handleLNClick} />

                {/* Popular Chinese Web Novels */}
                <PopularChineseNovels onLNClick={handleLNClick} />

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

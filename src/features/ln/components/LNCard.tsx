import React, { useState, useRef, useEffect, useCallback } from 'react';
import { m } from 'framer-motion';
import type { LightNovel } from '../../../types/ln';
import { useTitleLanguage } from '../../../context/TitleLanguageContext';
import { getDisplayTitle } from '../../../utils/titleLanguage';
import { cardItemVariants, pressMotion } from '../../../utils/motion';
import { Star } from 'lucide-react';

interface LNCardProps {
    ln: LightNovel;
    rank?: number;
    onClick: (ln: LightNovel) => void;
    disableTilt?: boolean;
}

export default function LNCard({ ln, rank, onClick, disableTilt = false }: LNCardProps) {
    const { language } = useTitleLanguage();
    const cardRef = useRef<HTMLDivElement>(null);
    const [rotation, setRotation] = useState({ x: 0, y: 0 });
    const [glare, setGlare] = useState({ x: 50, y: 50, opacity: 0 });
    const [isHovered, setIsHovered] = useState(false);
    const [popupSide, setPopupSide] = useState<'left' | 'right'>('right');

    const displayTitle = getDisplayTitle(ln, language);
    const cover = ln.images?.jpg?.large_image_url || ln.images?.jpg?.image_url || '';

    const updatePopupSide = useCallback(() => {
        if (typeof window === 'undefined' || !cardRef.current) {
            setPopupSide('right');
            return;
        }

        const rect = cardRef.current.getBoundingClientRect();
        const availableRight = window.innerWidth - 16;
        const popupWidth = 260;
        const gap = 16;

        setPopupSide(rect.right + gap + popupWidth > availableRight ? 'left' : 'right');
    }, []);

    useEffect(() => {
        if (!isHovered) return;
        updatePopupSide();
        window.addEventListener('resize', updatePopupSide);
        return () => {
            window.removeEventListener('resize', updatePopupSide);
        };
    }, [isHovered, updatePopupSide]);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (disableTilt || !cardRef.current) return;

        const rect = cardRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = ((y - centerY) / centerY) * -12;
        const rotateY = ((x - centerX) / centerX) * 12;

        setRotation({ x: rotateX, y: rotateY });
        setGlare({
            x: (x / rect.width) * 100,
            y: (y / rect.height) * 100,
            opacity: 1,
        });
    };

    const handleMouseLeave = () => {
        if (disableTilt) {
            setIsHovered(false);
            return;
        }
        setRotation({ x: 0, y: 0 });
        setGlare((prev) => ({ ...prev, opacity: 0 }));
        setIsHovered(false);
    };

    return (
        <m.div
            ref={cardRef}
            variants={cardItemVariants}
            initial="initial"
            animate="animate"
            whileTap={pressMotion}
            className="select-none cursor-pointer group relative z-0 hover:z-50"
            style={{ perspective: '1000px' }}
            onClick={() => onClick(ln)}
            onMouseEnter={(e) => {
                setIsHovered(true);
                updatePopupSide();
                handleMouseMove(e);
            }}
            onMouseLeave={handleMouseLeave}
            onMouseMove={handleMouseMove}
        >
            {/* Image Container with 3D Transform */}
            <div
                className="relative aspect-[2/3] rounded-xl overflow-hidden mb-2.5 shadow-lg border border-white/5 bg-[#141414] transition-all duration-75 ease-out"
                style={{
                    transform: disableTilt
                        ? 'none'
                        : `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) scale3d(${isHovered ? 1.05 : 1}, ${isHovered ? 1.05 : 1}, 1)`,
                    transformStyle: 'preserve-3d',
                    boxShadow: isHovered
                        ? '0 20px 40px -5px rgba(0,0,0,0.5), 0 10px 20px -5px rgba(0,0,0,0.3)'
                        : 'none',
                }}
            >
                {/* Glare Overlay */}
                <div
                    className="absolute inset-0 z-30 pointer-events-none mix-blend-overlay transition-opacity duration-300"
                    style={{
                        background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,0.35) 0%, transparent 80%)`,
                        opacity: disableTilt ? 0 : glare.opacity,
                    }}
                />

                <img src={cover} alt={displayTitle} className="w-full h-full object-cover" loading="lazy" />

                {/* Rank Badge (Top Left) */}
                {rank ? (
                    <div className="absolute top-2 left-2 z-10 px-2 py-0.5 bg-amber-400 text-black font-black text-xs rounded-md shadow-md">
                        #{rank}
                    </div>
                ) : null}

                {/* Top Right: Star Rating */}
                {ln.score ? (
                    <div className="absolute top-2 right-2 z-10">
                        <span className="bg-black/70 backdrop-blur-md text-amber-400 px-2 py-0.5 rounded-md text-xs font-extrabold flex items-center gap-1 border border-white/10">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            {ln.score.toFixed(1)}
                        </span>
                    </div>
                ) : null}

                {/* Bottom Left: Type + Status Badges */}
                <div className="absolute bottom-2 left-2 flex gap-1.5 z-10">
                    <span className="bg-white/20 backdrop-blur-sm text-white px-2 py-0.5 rounded text-[10px] font-extrabold uppercase">
                        {ln.type || 'NOVEL'}
                    </span>
                    <span className="bg-black/60 backdrop-blur-sm text-gray-300 px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${ln.status === 'FINISHED' ? 'bg-blue-400' : 'bg-green-400'}`} />
                        {ln.status || 'ONGOING'}
                    </span>
                </div>
            </div>

            {/* Hover Tooltip Popover (Identical to Manga Card Popover) */}
            {isHovered && (
                <div
                    className={`pointer-events-none absolute top-2 z-[60] hidden w-[260px] rounded-2xl bg-[#181824] p-4 text-white shadow-[0_18px_40px_rgba(0,0,0,0.6)] border border-white/10 lg:block ${
                        popupSide === 'left' ? 'right-[calc(100%+16px)]' : 'left-[calc(100%+16px)]'
                    }`}
                >
                    <div
                        className="absolute top-7 h-3 w-3 bg-[#181824]"
                        style={
                            popupSide === 'left'
                                ? { right: -8, clipPath: 'polygon(0 0, 100% 50%, 0 100%)' }
                                : { left: -8, clipPath: 'polygon(100% 0, 0 50%, 100% 100%)' }
                        }
                    />

                    <div className="space-y-2.5">
                        {/* Line 1: Year / Status */}
                        <p className="text-sm font-extrabold tracking-wide text-gray-200">
                            {ln.year || (ln.status === 'FINISHED' ? 'FINISHED' : 'Ongoing')}
                        </p>

                        {/* Line 2: Author */}
                        {ln.author && ln.author !== 'Unknown Author' && (
                            <p className="text-sm font-bold text-amber-400">{ln.author}</p>
                        )}

                        {/* Line 3: Format • Chapters */}
                        <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                            {ln.type || 'NOVEL'}{ln.chapters ? ` • ${ln.chapters} ch` : ''}
                        </p>

                        {/* Line 4: Genres */}
                        {ln.genres && ln.genres.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                                {ln.genres.slice(0, 3).map((genre) => (
                                    <span
                                        key={genre.name}
                                        className="rounded-full bg-amber-400 px-3 py-1 text-[11px] font-extrabold lowercase tracking-wide text-black"
                                    >
                                        {genre.name}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Title Below Card */}
            <h3 className="text-sm font-semibold text-gray-100 line-clamp-2 leading-tight group-hover:text-amber-400 transition-colors">
                {displayTitle}
            </h3>
        </m.div>
    );
}

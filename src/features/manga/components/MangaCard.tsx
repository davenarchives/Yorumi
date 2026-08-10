import React from 'react';
import { m } from 'framer-motion';
import type { Manga } from '../../../types/manga';
import { useTitleLanguage } from '../../../context/TitleLanguageContext';
import { getDisplayTitle } from '../../../utils/titleLanguage';
import { cardItemVariants, pressMotion } from '../../../utils/motion';

interface MangaCardProps {
    manga: Manga;
    onClick: (manga: Manga) => void;
    onMouseEnter?: (manga: Manga) => void;
    inList?: boolean;
    onToggleList?: (manga: Manga) => void;
    disableTilt?: boolean;
}

const MangaCard: React.FC<MangaCardProps> = ({ manga, onClick, onMouseEnter, inList, onToggleList, disableTilt = false }) => {
    const { language } = useTitleLanguage();
    const cardRef = React.useRef<HTMLDivElement>(null);
    const [rotation, setRotation] = React.useState({ x: 0, y: 0 });
    const [glare, setGlare] = React.useState({ x: 50, y: 50, opacity: 0 });
    const [isHovered, setIsHovered] = React.useState(false);
    const [popupSide, setPopupSide] = React.useState<'left' | 'right'>('right');
    const normalizedStatus = String(manga.status || '').toUpperCase();
    const isOngoing = normalizedStatus === 'RELEASING' || normalizedStatus === 'PUBLISHING' || normalizedStatus === 'ONGOING';
    const displayTitle = getDisplayTitle(manga as unknown as Record<string, unknown>, language);

    // Determine count display (Chapters -> Volumes)
    const countDisplay = manga.chapters
        ? `${manga.chapters} ch`
        : manga.volumes
            ? `${manga.volumes} vol`
            : null;

    const updatePopupSide = React.useCallback(() => {
        if (typeof window === 'undefined' || !cardRef.current) {
            setPopupSide('right');
            return;
        }

        const rect = cardRef.current.getBoundingClientRect();
        const boundary = cardRef.current.closest('[data-hover-boundary]');
        const boundaryRect = boundary instanceof HTMLElement
            ? boundary.getBoundingClientRect()
            : { right: window.innerWidth - 16 };
        const availableRight = Math.min(window.innerWidth - 16, boundaryRect.right);
        const popupWidth = 260;
        const gap = 16;

        setPopupSide(rect.right + gap + popupWidth > availableRight ? 'left' : 'right');
    }, []);

    React.useEffect(() => {
        if (!isHovered) return;

        updatePopupSide();
        window.addEventListener('resize', updatePopupSide);

        return () => {
            window.removeEventListener('resize', updatePopupSide);
        };
    }, [isHovered, updatePopupSide]);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (disableTilt) {
            onMouseEnter?.(manga);
            return;
        }
        if (!cardRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        // Calculate rotation (max 12 degrees)
        const rotateX = ((y - centerY) / centerY) * -12;
        const rotateY = ((x - centerX) / centerX) * 12;

        setRotation({ x: rotateX, y: rotateY });
        setGlare({
            x: (x / rect.width) * 100,
            y: (y / rect.height) * 100,
            opacity: 1
        });

        onMouseEnter?.(manga);
    };

    const handleMouseLeave = () => {
        if (disableTilt) {
            setIsHovered(false);
            return;
        }
        setRotation({ x: 0, y: 0 });
        setGlare(prev => ({ ...prev, opacity: 0 }));
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
            onClick={() => onClick(manga)}
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
                className="relative aspect-[2/3] rounded-lg overflow-hidden mb-3 bg-[#141414] transition-all duration-75 ease-out"
                style={{
                    transform: disableTilt
                        ? 'none'
                        : `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) scale3d(${isHovered ? 1.05 : 1}, ${isHovered ? 1.05 : 1}, 1)`,
                    transformStyle: 'preserve-3d',
                }}
            >
                <img
                    src={manga.images.jpg.large_image_url || manga.images.jpg.image_url}
                    alt={displayTitle}
                    className="w-full h-full object-cover"
                    loading="lazy"
                />

                {/* Default Badges - Always Visible */}
                {/* Top Right: Star Rating */}
                {manga.score !== undefined && manga.score > 0 && (
                    <div className="absolute top-2 right-2 z-10">
                        <span className="bg-[#facc15] text-black px-2 py-1 rounded text-xs font-bold flex items-center gap-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" /></svg>
                            {manga.score.toFixed(1)}
                        </span>
                    </div>
                )}

                {/* Bottom Left: Type + Count - Always Visible */}
                <div className="absolute bottom-2 left-2 flex gap-1.5 z-10">
                    <span className="bg-white/20 backdrop-blur-sm text-white px-2 py-1 rounded text-xs font-bold uppercase">
                        {manga.countryOfOrigin === 'KR' ? 'Manhwa' : manga.countryOfOrigin === 'CN' ? 'Manhua' : (manga.type || 'Manga')}
                    </span>
                    {(manga.chapters || manga.volumes) ? (
                        <span className="bg-[#22c55e] text-white px-2 py-1 rounded text-xs font-bold flex items-center gap-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M19 4H5a2 2 0 00-2 2v12a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v2H6V9h5v2zm7 0h-1.5v-.5h-2v3h2V13H18v2h-5V9h5v2z" /></svg>
                            {manga.chapters || manga.volumes}
                        </span>
                    ) : (
                        <span className="bg-white/20 backdrop-blur-sm text-white px-2 py-1 rounded text-xs font-bold flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${isOngoing ? 'bg-green-500' : 'bg-gray-500'}`}></span>
                            <span className="uppercase text-[10px]">{isOngoing ? 'Ongoing' : manga.status}</span>
                        </span>
                    )}
                </div>

                {onToggleList && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleList(manga);
                        }}
                        className={`absolute bottom-2 right-2 z-10 flex h-10 w-10 items-center justify-center rounded-full transition-colors ${inList ? 'bg-yorumi-manga text-white hover:bg-yorumi-manga/80' : 'bg-[#1c2433]/90 text-white hover:bg-[#2b364a]'}`}
                        title={inList ? 'Remove from List' : 'Add to List'}
                    >
                        {inList ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                        )}
                    </button>
                )}

            </div>

            {isHovered && (
                <div className={`pointer-events-none absolute top-2 z-[60] hidden w-[260px] rounded-2xl bg-[#1a1a2e] p-4 text-white shadow-xl lg:block ${popupSide === 'left' ? 'right-[calc(100%+16px)]' : 'left-[calc(100%+16px)]'}`}>
                    <div
                        className="absolute top-7 h-3 w-3 bg-[#1a1a2e]"
                        style={popupSide === 'left'
                            ? { right: -8, clipPath: 'polygon(0 0, 100% 50%, 0 100%)' }
                            : { left: -8, clipPath: 'polygon(100% 0, 0 50%, 100% 100%)' }}
                    />

                    <div className="space-y-3">
                        {/* Line 1: Year / Status */}
                        <p className="text-sm font-extrabold tracking-wide text-[#e8dbff]">
                            {manga.published?.from ? manga.published.from.substring(0, 4) : (isOngoing ? 'Ongoing' : (manga.status || 'Unknown Status'))}
                        </p>

                        {/* Line 2: Author */}
                        {manga.authors && manga.authors.length > 0 && (
                            <p className="text-sm font-bold text-[#d886ff]">
                                {manga.authors[0].name}
                            </p>
                        )}

                        {/* Line 3: Type • Chapters */}
                        <p className="text-sm font-semibold text-[#b4a8d4]">
                            {manga.countryOfOrigin === 'KR' ? 'Manhwa' : manga.countryOfOrigin === 'CN' ? 'Manhua' : (manga.type || 'Manga')} {countDisplay ? ` • ${countDisplay}` : ''}
                            {manga.views ? ` • ${manga.views} views` : ''}
                        </p>

                        {manga.genres && manga.genres.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-1">
                                {manga.genres.slice(0, 2).map((genre) => (
                                    <span key={genre.mal_id} className="rounded-full bg-[#d886ff] px-3 py-1 text-[11px] font-extrabold lowercase tracking-wide text-[#2e0a3d]">
                                        {genre.name}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Title Below Card */}
            <h3 className="text-sm font-semibold text-gray-100 line-clamp-2 leading-tight group-hover:text-yorumi-manga transition-colors">
                {displayTitle}
            </h3>
        </m.div>
    );
};

export default MangaCard;

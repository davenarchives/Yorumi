import ReadingCardArtwork, { chapterBadge } from '../../reading/components/ReadingCardArtwork';
import ReadingCardMetadata from '../../reading/components/ReadingCardMetadata';
import React from 'react';
import { m } from 'framer-motion';
import type { Manga } from '../../../types/manga';
import { useTitleLanguage } from '../../../context/TitleLanguageContext';
import { getDisplayTitle } from '../../../utils/titleLanguage';
import { cardItemVariants, pressMotion } from '../../../utils/motion';
import { useReadList } from '../../../hooks/useReadList';

interface MangaCardProps {
    manga: Manga;
    onClick: (manga: Manga) => void;
    onMouseEnter?: (manga: Manga) => void;
    inList?: boolean;
    onToggleList?: (manga: Manga) => void;
    disableTilt?: boolean;
    rank?: number;
}

const MangaCard: React.FC<MangaCardProps> = ({ manga, onClick, onMouseEnter, inList, onToggleList, disableTilt = false, rank }) => {
    const { language } = useTitleLanguage();
    const { isInReadList, addToReadList, removeFromReadList } = useReadList();
    const cardRef = React.useRef<HTMLDivElement>(null);
    const [rotation, setRotation] = React.useState({ x: 0, y: 0 });
    const [isHovered, setIsHovered] = React.useState(false);
    const displayTitle = getDisplayTitle(manga as unknown as Record<string, unknown>, language);

    const mangaIdStr = String(manga.id || manga.mal_id || '');
    const effectiveInList = inList !== undefined ? inList : isInReadList(mangaIdStr);
    const posterUrl = manga.images?.jpg?.large_image_url || manga.images?.jpg?.image_url || '';
    const bannerUrl = manga.bannerImage || posterUrl;

    const handleToggleList = () => {
        if (onToggleList) {
            onToggleList(manga);
            return;
        }
        if (effectiveInList) {
            removeFromReadList(mangaIdStr);
        } else {
            addToReadList({
                id: mangaIdStr,
                title: displayTitle,
                image: posterUrl || bannerUrl,
                score: manga.score,
                type: manga.type,
                status: 'reading',
            });
        }
    };

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
        onMouseEnter?.(manga);
    };

    const handleMouseLeave = () => {
        if (disableTilt) {
            setIsHovered(false);
            return;
        }
        setRotation({ x: 0, y: 0 });
        setIsHovered(false);
    };

    return (
        <m.div
            ref={cardRef}
            variants={cardItemVariants}
            initial="initial"
            animate="animate"
            whileTap={pressMotion}
            className="select-none cursor-pointer group relative z-0"
            style={{ perspective: '1000px' }}
            onClick={() => onClick(manga)}
            onMouseEnter={(e) => {
                setIsHovered(true);
                handleMouseMove(e);
            }}
            onMouseLeave={handleMouseLeave}
            onMouseMove={handleMouseMove}
        >
            <div className="relative transition-transform duration-75" style={{ transform: disableTilt ? 'none' : `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) scale(${isHovered ? 1.05 : 1})` }}>
                <ReadingCardArtwork
                    title={displayTitle}
                    image={bannerUrl}
                    poster={posterUrl}
                    badge={chapterBadge(manga.chapters, manga.status)}
                    rank={rank}
                    inList={effectiveInList}
                    onToggleList={handleToggleList}
                />
            </div>

            <ReadingCardMetadata
                title={displayTitle}
                score={manga.score}
                format={manga.type}
                year={manga.published?.from?.match(/^\d{4}/)?.[0]}
                theme="manga"
            />
        </m.div>
    );
};

export default MangaCard;

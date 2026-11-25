import ReadingCardArtwork, { chapterBadge } from '../../reading/components/ReadingCardArtwork';
import ReadingCardMetadata from '../../reading/components/ReadingCardMetadata';
import React, { useState, useRef } from 'react';
import { m } from 'framer-motion';
import type { LightNovel } from '../../../types/ln';
import { useTitleLanguage } from '../../../context/TitleLanguageContext';
import { getDisplayTitle } from '../../../utils/titleLanguage';
import { cardItemVariants, pressMotion } from '../../../utils/motion';
import { useLNReadList } from '../../../hooks/useLNReadList';

interface LNCardProps {
    ln: LightNovel;
    rank?: number;
    showRanking?: boolean;
    onClick: (ln: LightNovel) => void;
    disableTilt?: boolean;
}

export default function LNCard({ ln, rank, showRanking = false, onClick, disableTilt = false }: LNCardProps) {
    const { language } = useTitleLanguage();
    const { isInLNReadList, toggleLNReadList } = useLNReadList();
    const cardRef = useRef<HTMLDivElement>(null);
    const [rotation, setRotation] = useState({ x: 0, y: 0 });
    const [isHovered, setIsHovered] = useState(false);

    if (!ln) return null;

    const displayTitle = getDisplayTitle(ln, language);
    const cover = ln.images?.jpg?.large_image_url || ln.images?.jpg?.image_url || '';
    const banner = ln.bannerImage || cover;
    const lnIdStr = String(ln.id || ln.mal_id || ln.scraper_id || '');
    const inList = isInLNReadList(lnIdStr);

    const handleToggleList = () => {
        toggleLNReadList({
            id: ln.id || lnIdStr,
            title: displayTitle,
            image: cover,
            score: ln.score,
            mediaStatus: ln.status,
            type: ln.type,
            synopsis: ln.synopsis,
            genres: Array.isArray(ln.genres)
                ? ln.genres.map((genre: any) => (typeof genre === 'string' ? genre : genre?.name)).filter(Boolean)
                : [],
        });
    };

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
            onClick={() => onClick(ln)}
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
                    image={banner}
                    poster={cover}
                    badge={chapterBadge(ln.chapters, ln.status)}
                    rank={showRanking ? rank : undefined}
                    inList={inList}
                    onToggleList={handleToggleList}
                />
            </div>

            <ReadingCardMetadata
                title={displayTitle}
                score={ln.score}
                format={ln.type}
                year={ln.publishedYear}
                theme="ln"
            />
        </m.div>
    );
}

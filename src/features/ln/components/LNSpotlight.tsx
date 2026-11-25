import { useEffect, useMemo, useState } from 'react';
import { lnService } from '../../../services/lnService';
import type { LightNovel } from '../../../types/ln';
import { useTitleLanguage } from '../../../context/TitleLanguageContext';
import { getDisplayTitle } from '../../../utils/titleLanguage';
import SpotlightSkeleton from '../../anime/components/SpotlightSkeleton';
import ReadingSpotlight from '../../reading/components/ReadingSpotlight';

interface LNSpotlightProps {
    onLNClick: (lnId: string, autoRead?: boolean, lnData?: LightNovel) => void;
    onBackdropChange?: (url: string) => void;
}

export default function LNSpotlight({ onLNClick, onBackdropChange }: LNSpotlightProps) {
    const { language } = useTitleLanguage();
    const initialSpotlight = lnService.peekSpotlight();
    const [lns, setLns] = useState<LightNovel[]>(initialSpotlight);
    const [loading, setLoading] = useState(initialSpotlight.length === 0);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [detailsById, setDetailsById] = useState<Record<string, LightNovel>>({});
    useEffect(() => {
        let active = true;
        void lnService.getSpotlight().then((data) => {
            if (active && data && data.length > 0) {
                setLns(data);
            }
        })
            .catch((error) => console.error('Failed to fetch novel spotlight', error))
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, []);
    const activeId = String(lns[selectedIndex]?.id || lns[selectedIndex]?.mal_id || lns[selectedIndex]?.scraper_id || '');
    useEffect(() => {
        if (!activeId || detailsById[activeId]) return;
        let active = true;
        void lnService.getDetails(activeId).then((details) => {
            if (active && details) setDetailsById((current) => ({ ...current, [activeId]: details }));
        }).catch(() => undefined);
        return () => { active = false; };
    }, [activeId, detailsById]);
    const display = useMemo(() => lns.map((ln) => {
        const details = detailsById[String(ln.id || ln.mal_id || ln.scraper_id || '')];
        const seedBanner = ln.bannerImage && ln.bannerImage !== ln.images?.jpg?.large_image_url && ln.bannerImage !== ln.images?.jpg?.image_url ? ln.bannerImage : undefined;
        const preferredImages = ln.images?.jpg?.large_image_url || ln.images?.jpg?.image_url ? ln.images : details?.images;
        return details ? { ...ln, ...details, id: ln.id || details.id, title: details.title || ln.title, score: details.score && details.score > 0 ? details.score : ln.score, images: preferredImages || ln.images, bannerImage: (details.bannerImage && details.bannerImage !== details.images?.jpg?.large_image_url && details.bannerImage !== details.images?.jpg?.image_url) ? details.bannerImage : seedBanner, synopsis: details.synopsis || ln.synopsis, author: details.author && details.author !== 'Unknown Author' ? details.author : ln.author, chapters: details.chapters || ln.chapters, volumes: details.volumes || ln.volumes, genres: details.genres?.length ? details.genres : ln.genres } : { ...ln, bannerImage: seedBanner };
    }), [lns, detailsById]);

    const items = useMemo(() => display.map((ln, index) => ({
        key: String(ln.id || index),
        title: getDisplayTitle(ln, language),
        cover: ln.images?.jpg?.large_image_url || ln.images?.jpg?.image_url || '',
        banner: ln.bannerImage && ln.bannerImage !== ln.images?.jpg?.large_image_url && ln.bannerImage !== ln.images?.jpg?.image_url ? ln.bannerImage : undefined,
        synopsis: ln.synopsis,
        rating: ln.score,
        format: 'Light Novel',
        details: [
            ...(ln.author && ln.author !== 'Unknown Author' ? [ln.author] : []),
            ...(ln.chapters ? [{ label: `${ln.chapters} chapters`, desktopOnly: true }] : []),
        ],
    })), [display, language]);

    if (loading && lns.length === 0) return <SpotlightSkeleton variant="ln" />;

    return <ReadingSpotlight
        theme="ln"
        items={items}
        onSelect={setSelectedIndex}
        onRead={(index) => { const item = display[index]; if (item) onLNClick(String(item.id), true, item); }}
        onDetails={(index) => { const item = display[index]; if (item) onLNClick(String(item.id), false, item); }}
        onBackdropChange={onBackdropChange}
    />;
}

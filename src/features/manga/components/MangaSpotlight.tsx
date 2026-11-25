import { getPrimaryMangaAuthor } from '../../../utils/mangaAuthor';
import { useEffect, useMemo, useRef, useState } from 'react';
import { mangaService } from '../../../services/mangaService';
import type { Manga } from '../../../types/manga';
import { useTitleLanguage } from '../../../context/TitleLanguageContext';
import { getDisplayTitle } from '../../../utils/titleLanguage';
import { getMangaDetailsRouteId } from '../../../utils/mangaNavigation';
import SpotlightSkeleton from '../../anime/components/SpotlightSkeleton';
import ReadingSpotlight from '../../reading/components/ReadingSpotlight';
import {
    enhanceMangaPosterMeta,
    peekEnhancedMangaMeta,
    type EnhancedMangaPosterMeta,
} from '../../../utils/mangaPosterCache';

interface MangaSpotlightProps {
    onMangaClick: (mangaId: string, autoRead?: boolean, manga?: Manga) => void;
    onBackdropChange?: (url: string) => void;
}

export default function MangaSpotlight({ onMangaClick, onBackdropChange }: MangaSpotlightProps) {
    const { language } = useTitleLanguage();
    const cached = mangaService.peekEnrichedSpotlight();
    const [mangas, setMangas] = useState<Manga[]>(cached?.data || []);
    const [loading, setLoading] = useState(!cached?.data?.length);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [ratingsById, setRatingsById] = useState<Record<string, EnhancedMangaPosterMeta | null>>({});
    const [detailsById, setDetailsById] = useState<Record<string, Manga>>({});
    const fetchedIdsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        let cancelled = false;
        void mangaService.getEnrichedSpotlight().then(({ data }) => {
            if (cancelled || !data?.length) return;
            setMangas(data);
            void mangaService.enrichVisibleManga(data, (enriched, index) => {
                if (!cancelled) setMangas((current) => current.map((item, i) => i === index ? enriched : item));
            });
        }).catch((error) => console.error('Failed to fetch trending manga for spotlight', error))
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    const activeId = String(mangas[selectedIndex]?.id || mangas[selectedIndex]?.mal_id || mangas[selectedIndex]?.scraper_id || '');
    useEffect(() => {
        if (!activeId || detailsById[activeId]) return;
        let cancelled = false;
        void mangaService.getUnifiedMangaDetails(activeId).then((details) => {
            if (!cancelled && details) setDetailsById((current) => ({ ...current, [activeId]: details as Manga }));
        }).catch(() => undefined);
        return () => { cancelled = true; };
    }, [activeId, detailsById]);

    useEffect(() => {
        if (!mangas.length) return;
        let cancelled = false;

        const slice = mangas.slice(0, 8);
        void (async () => {
            for (const manga of slice) {
                if (cancelled) break;
                const id = String(manga.id || manga.mal_id || manga.scraper_id || '');
                if (!id || fetchedIdsRef.current.has(id)) continue;
                const rawTitle = manga.title || manga.title_english || '';
                if (!rawTitle) continue;

                const cachedMeta = peekEnhancedMangaMeta(rawTitle);
                if (cachedMeta !== undefined) {
                    fetchedIdsRef.current.add(id);
                    if (!cancelled) {
                        setRatingsById((current) => ({ ...current, [id]: cachedMeta }));
                    }
                    continue;
                }

                const enhanced = await enhanceMangaPosterMeta(rawTitle);
                if (!cancelled) {
                    if (enhanced) fetchedIdsRef.current.add(id);
                    setRatingsById((current) => ({ ...current, [id]: enhanced }));
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [mangas]);

    const display = useMemo(() => mangas.map((manga) => {
        const idKey = String(manga.id || manga.mal_id || manga.scraper_id || '');
        const details = detailsById[idKey];
        const meta = ratingsById[idKey] ?? peekEnhancedMangaMeta(manga.title || manga.title_english);
        const base = details
            ? { ...manga, ...details, title: manga.title || details.title, images: details.images || manga.images, score: details.score && details.score > 0 ? details.score : manga.score }
            : manga;
        return meta?.coverUrl
            ? { ...base, images: { jpg: { large_image_url: meta.coverUrl, image_url: meta.coverUrl } }, bannerImage: meta.bannerUrl || base.bannerImage }
            : base;
    }), [mangas, detailsById, ratingsById]);

    const items = useMemo(() => display.map((manga, index) => {
        const idKey = String(manga.id || manga.mal_id || manga.scraper_id || '');
        const meta = ratingsById[idKey] ?? peekEnhancedMangaMeta(manga.title || manga.title_english);
        return {
            key: idKey || String(index),
            title: getDisplayTitle(manga as unknown as Record<string, unknown>, language),
            cover: meta?.coverUrl || manga.images?.jpg?.large_image_url || manga.images?.jpg?.image_url || '',
            banner: meta?.bannerUrl || manga.bannerImage || undefined,
            synopsis: manga.synopsis || meta?.synopsis,
            rating: manga.score && manga.score > 0 ? manga.score : meta?.score,
            format: (meta?.countryOfOrigin || manga.countryOfOrigin) === 'KR' ? 'Manhwa' : (meta?.countryOfOrigin || manga.countryOfOrigin) === 'CN' ? 'Manhua' : 'Manga',
            details: [
                ...(getPrimaryMangaAuthor(manga) ? [getPrimaryMangaAuthor(manga)] : []),
                ...(manga.chapters ? [{ label: `${manga.chapters} chapters`, desktopOnly: true }] : []),
            ],
        };
    }), [display, language, ratingsById]);

    if (loading && mangas.length === 0) return <SpotlightSkeleton variant="manga" />;

    return <ReadingSpotlight
        theme="manga"
        items={items}
        onSelect={setSelectedIndex}
        onRead={(index) => { const item = display[index]; if (item) onMangaClick(getMangaDetailsRouteId(item), true, item); }}
        onDetails={(index) => { const item = display[index]; if (item) onMangaClick(getMangaDetailsRouteId(item), false, item); }}
        onBackdropChange={onBackdropChange}
    />;
}

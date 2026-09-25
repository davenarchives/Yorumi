import { useEffect, useState } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTitleLanguage } from '../context/TitleLanguageContext';
import { searchApi, type SearchPreviewItem } from '../features/search/api';
import AnimeCard from '../features/anime/components/AnimeCard';
import MangaCard from '../features/manga/components/MangaCard';
import LNCard from '../features/ln/components/LNCard';
import type { Anime } from '../types/anime';
import type { Manga } from '../types/manga';
import type { LightNovel } from '../types/ln';

type SearchGroup = 'anime' | 'manga' | 'ln';

export default function SearchResultsPage() {
    const navigate = useNavigate();
    const { type } = useParams();
    const [params] = useSearchParams();
    const { language } = useTitleLanguage();
    const query = params.get('q')?.trim() || '';
    const group: SearchGroup = type === 'manga' || type === 'ln' ? type : 'anime';
    const [results, setResults] = useState<SearchPreviewItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let current = true;
        setLoading(true);
        const request = group === 'anime'
            ? searchApi.getAnimePreview(query, language, 30)
            : group === 'manga'
                ? searchApi.getMangaPreview(query, language, 30)
                : searchApi.getLNPreview(query, language, 30);
        request.then((items) => { if (current) setResults(items); })
            .catch(() => { if (current) setResults([]); })
            .finally(() => { if (current) setLoading(false); });
        return () => { current = false; };
    }, [group, language, query]);

    const openResult = (item: SearchPreviewItem) => {
        const normalized = cardData(item);
        if (group === 'manga') navigate(item.url, { state: { manga: normalized } });
        else if (group === 'ln') navigate(item.url, { state: { ln: normalized } });
        else navigate(item.url, { state: { anime: normalized } });
    };

    const cardData = (item: SearchPreviewItem) => {
        const raw = item.raw || item.ln || item.manga || {};
        return {
            ...raw,
            id: raw.id || item.id,
            mal_id: raw.mal_id || item.id,
            title: raw.title || item.title,
            title_english: raw.title_english || item.title,
            title_romaji: raw.title_romaji || item.subtitle || item.title,
            type: raw.type || item.type,
            score: raw.score || item.score || 0,
            images: raw.images || { jpg: { image_url: item.image, large_image_url: item.image } },
        };
    };

    return (
        <div className="min-h-[100dvh] bg-[#0b0b0d] text-white">
            <header className="sticky top-0 z-30 border-b border-white/10 bg-[#111114]/95 backdrop-blur-xl" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
                <div className="flex h-16 items-center gap-4 px-3 md:mx-auto md:max-w-6xl">
                    <button onClick={() => navigate(-1)} className="grid h-10 w-10 place-items-center" aria-label="Back"><ArrowLeft className="h-6 w-6" /></button>
                    <h1 className="min-w-0 flex-1 truncate text-lg font-medium">{query}</h1>
                    <button onClick={() => navigate('/search')} className="grid h-10 w-10 place-items-center" aria-label="Clear search"><X className="h-6 w-6" /></button>
                </div>
            </header>

            <main className="mx-auto max-w-6xl px-3 py-4">
                {loading ? (
                    <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                        {Array.from({ length: 8 }).map((_, index) => <div key={index} className="aspect-[2/3] animate-pulse rounded-lg bg-white/5" />)}
                    </div>
                ) : results.length ? (
                    <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                        {results.map((item) => (
                            <div key={`${group}-${item.id}`} className="min-w-0">
                                {group === 'anime' ? <AnimeCard anime={cardData(item) as Anime} onClick={() => openResult(item)} disableTilt />
                                    : group === 'manga' ? <MangaCard manga={cardData(item) as Manga} onClick={() => openResult(item)} disableTilt />
                                        : <LNCard ln={cardData(item) as LightNovel} onClick={() => openResult(item)} disableTilt />}
                            </div>
                        ))}
                    </div>
                ) : <p className="py-20 text-center text-sm text-white/45">No results found.</p>}
            </main>
        </div>
    );
}

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, Search, X } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTitleLanguage } from '../context/TitleLanguageContext';
import { searchApi, type SearchPreviewItem } from '../features/search/api';
import { useDebounce } from '../hooks/useDebounce';
import AnimeCard from '../features/anime/components/AnimeCard';
import MangaCard from '../features/manga/components/MangaCard';
import LNCard from '../features/ln/components/LNCard';
import type { Anime } from '../types/anime';
import type { Manga } from '../types/manga';
import type { LightNovel } from '../types/ln';

type SearchGroup = 'anime' | 'manga' | 'ln';

const GROUPS: Array<{ key: SearchGroup; label: string; subtitle: string }> = [
    { key: 'anime', label: 'Anime', subtitle: 'Series and movies' },
    { key: 'manga', label: 'Manga', subtitle: 'Manga, manhwa and manhua' },
    { key: 'ln', label: 'Light Novels', subtitle: 'Light novels and web novels' },
];

export default function SearchPage() {
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const { language } = useTitleLanguage();
    const inputRef = useRef<HTMLInputElement>(null);
    const rowRefs = useRef<Record<SearchGroup, HTMLDivElement | null>>({ anime: null, manga: null, ln: null });
    const [query, setQuery] = useState(() => params.get('q') || '');
    const debouncedQuery = useDebounce(query, 280);
    const [results, setResults] = useState<Record<SearchGroup, SearchPreviewItem[]>>({ anime: [], manga: [], ln: [] });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    useEffect(() => {
        const value = debouncedQuery.trim();
        Object.values(rowRefs.current).forEach((row) => row?.scrollTo({ left: 0 }));
        setParams(value ? { q: value } : {}, { replace: true });
        if (value.length < 2) {
            setResults({ anime: [], manga: [], ln: [] });
            setLoading(false);
            return;
        }

        let current = true;
        setLoading(true);
        Promise.all([
            searchApi.getAnimePreview(value, language),
            searchApi.getMangaPreview(value, language),
            searchApi.getLNPreview(value, language),
        ]).then(([anime, manga, ln]) => {
            if (current) setResults({ anime, manga, ln });
        }).catch(() => {
            if (current) setResults({ anime: [], manga: [], ln: [] });
        }).finally(() => {
            if (current) setLoading(false);
        });

        return () => { current = false; };
    }, [debouncedQuery, language, setParams]);

    const openResult = (group: SearchGroup, item: SearchPreviewItem) => {
        const normalized = getCardData(group, item);
        if (group === 'manga') {
            navigate(item.url, { state: { manga: normalized } });
        } else if (group === 'ln') {
            navigate(item.url, { state: { ln: normalized } });
        } else {
            navigate(item.url, { state: { anime: normalized } });
        }
    };

    const hasQuery = debouncedQuery.trim().length >= 2;

    const getCardData = (group: SearchGroup, item: SearchPreviewItem) => {
        const raw = item.raw || item.ln || item.manga || {};
        const common = {
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
        if (group === 'anime') return common as Anime;
        if (group === 'manga') return common as Manga;
        return common as LightNovel;
    };

    return (
        <div className="min-h-[100dvh] bg-[#0b0b0d] pb-10 text-white">
            <header
                className="sticky top-0 z-30 border-b border-white/10 bg-[#111114]/95 backdrop-blur-xl"
                style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
            >
                <div className="flex h-16 items-center gap-3 px-3 md:mx-auto md:max-w-6xl md:px-6">
                    <button onClick={() => navigate(-1)} className="grid h-10 w-10 shrink-0 place-items-center text-white/80" aria-label="Go back">
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                    <Search className="h-5 w-5 shrink-0 text-white/35" />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search..."
                        className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-white/35 md:text-lg"
                    />
                    {query && (
                        <button onClick={() => { setQuery(''); inputRef.current?.focus(); }} className="grid h-10 w-10 shrink-0 place-items-center text-white/70" aria-label="Clear search">
                            <X className="h-6 w-6" />
                        </button>
                    )}
                </div>
            </header>

            <main className="mx-auto max-w-6xl py-3">
                {!hasQuery && (
                    <p className="px-4 py-16 text-center text-sm text-white/45">Type at least two characters to search all three libraries.</p>
                )}

                {hasQuery && GROUPS.map((group) => (
                    <section key={group.key} className="mb-8">
                        <button
                            onClick={() => navigate(`/search/${group.key}?q=${encodeURIComponent(debouncedQuery.trim())}`)}
                            className="flex w-full items-center justify-between px-4 pb-3 text-left"
                        >
                            <div>
                                <h2 className="text-xl font-semibold leading-tight">{group.label}</h2>
                                <p className="mt-0.5 text-sm text-white/55">{group.subtitle}</p>
                            </div>
                            <ChevronRight className="h-7 w-7 text-white/75" />
                        </button>

                        {loading ? (
                            <div className="flex gap-3 overflow-hidden px-4">
                                {[0, 1, 2, 3].map((item) => <div key={item} className="h-52 w-28 shrink-0 animate-pulse rounded-md bg-white/5" />)}
                            </div>
                        ) : results[group.key].length ? (
                            <div
                                ref={(node) => { rowRefs.current[group.key] = node; }}
                                className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide"
                            >
                                {results[group.key].map((item) => (
                                    <div key={`${group.key}-${item.id}`} className="w-[140px] shrink-0 snap-start">
                                        {group.key === 'anime' ? (
                                            <AnimeCard anime={getCardData('anime', item) as Anime} onClick={() => openResult('anime', item)} disableTilt />
                                        ) : group.key === 'manga' ? (
                                            <MangaCard manga={getCardData('manga', item) as Manga} onClick={() => openResult('manga', item)} disableTilt />
                                        ) : (
                                            <LNCard ln={getCardData('ln', item) as LightNovel} onClick={() => openResult('ln', item)} disableTilt />
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="px-4 py-5 text-sm text-white/40">No {group.label.toLowerCase()} results.</p>
                        )}
                    </section>
                ))}
            </main>
        </div>
    );
}

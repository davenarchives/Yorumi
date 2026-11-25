import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { postJson } from '../../../platform/nativeHttp';
import { getMangaDetailsRouteId } from '../../../utils/mangaNavigation';
import type { Manga } from '../../../types/manga';
import type { LightNovel } from '../../../types/ln';
import MangaCard from '../../manga/components/MangaCard';
import LNCard from '../../ln/components/LNCard';

type ReadingKind = 'manga' | 'novel';
type Media = {
    id: number;
    title?: { english?: string; romaji?: string; native?: string; userPreferred?: string };
    synonyms?: string[];
    coverImage?: { large?: string; extraLarge?: string };
    format?: string;
    countryOfOrigin?: string;
    status?: string;
    averageScore?: number;
    isAdult?: boolean;
    chapters?: number;
    volumes?: number;
    recommendations?: { nodes?: Array<{ mediaRecommendation?: Media | null } | null> };
};
type GraphQLResult = { data?: { Media?: Media | null; Page?: { media?: Media[] } }; errors?: Array<{ message?: string }> };
const cache = new Map<string, Media[]>();
const normalize = (value: string) => value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
const fields = `id title { english romaji native userPreferred } synonyms coverImage { large extraLarge } format countryOfOrigin status averageScore isAdult chapters volumes genres`;
const recommendationFields = `recommendations(perPage: 25, sort: RATING_DESC) { nodes { mediaRecommendation { ${fields} } } }`;

const normalizeFranchiseBase = (value?: string | null): string =>
    String(value || '')
        .toLowerCase()
        .replace(/[:–—-].*$/, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

async function getRecommendations(kind: ReadingKind, id: number | undefined, title: string, genres?: string[]): Promise<Media[]> {
    const genreList = (genres || []).filter(Boolean).slice(0, 4);
    const key = `${kind}:${id || normalize(title)}:${genreList.join(',')}`;
    const cached = cache.get(key);
    if (cached) return cached;

    const baseTitle = normalizeFranchiseBase(title);
    const seen = new Set<number>();
    if (id) seen.add(id);
    const items: Media[] = [];
    const matchesKind = (item: Media) =>
        kind === 'novel' ? item.format === 'NOVEL' : ['MANGA', 'ONE_SHOT'].includes(item.format || '');
    const isSameFranchise = (item: Media) => {
        if (!baseTitle || baseTitle.length < 4) return false;
        const titles = [item.title?.english, item.title?.romaji, item.title?.userPreferred]
            .map((t) => normalizeFranchiseBase(t))
            .filter((t) => t.length >= 4);
        return titles.some((t) => t === baseTitle || t.startsWith(`${baseTitle} `) || baseTitle.startsWith(`${t} `));
    };

    try {
        const query = id
            ? `query ($id: Int!) { Media(id: $id, type: MANGA) { ${fields} ${recommendationFields} } }`
            : `query ($search: String!) { Page(page: 1, perPage: 5) { media(search: $search, type: MANGA${kind === 'novel' ? ', format: NOVEL' : ', format_in: [MANGA, ONE_SHOT]'}) { ${fields} ${recommendationFields} } } }`;
        const result = await postJson<GraphQLResult>('https://graphql.anilist.co', { query, variables: id ? { id } : { search: title } });
        if (!result.errors?.length) {
            const match = id ? result.data?.Media : result.data?.Page?.media?.find((candidate) =>
                [candidate.title?.english, candidate.title?.romaji, candidate.title?.native, candidate.title?.userPreferred, ...(candidate.synonyms || [])]
                    .some((candidateTitle) => candidateTitle && normalize(candidateTitle) === normalize(title)),
            );
            if (match && !match.isAdult && matchesKind(match)) {
                seen.add(match.id);
                (match.recommendations?.nodes || []).forEach((node) => {
                    const item = node?.mediaRecommendation;
                    if (!item || item.isAdult || seen.has(item.id) || !matchesKind(item) || isSameFranchise(item)) return;
                    seen.add(item.id);
                    items.push(item);
                });
            }
        }
    } catch {
        // Fall back to close-genre matches
    }

    if (items.length < 10 && genreList.length > 0) {
        try {
            const formatClause = kind === 'novel' ? 'format: NOVEL' : 'format_in: [MANGA, ONE_SHOT]';
            const genreQuery = `query ($genres: [String!]) { Page(page: 1, perPage: 24) { media(type: MANGA, ${formatClause}, genre_in: $genres, sort: [SCORE_DESC, POPULARITY_DESC], isAdult: false) { ${fields} } } }`;
            const genreRes = await postJson<GraphQLResult>('https://graphql.anilist.co', { query: genreQuery, variables: { genres: genreList } });
            const genreSet = new Set(genreList.map((g) => g.toLowerCase()));
            const candidates = (genreRes.data?.Page?.media || [])
                .filter((item): item is Media => Boolean(item?.id) && !item.isAdult && !seen.has(item.id) && matchesKind(item) && !isSameFranchise(item))
                .sort((a, b) => {
                    const gA = ((a as Media & { genres?: string[] }).genres || []).filter((g) => genreSet.has(g.toLowerCase())).length;
                    const gB = ((b as Media & { genres?: string[] }).genres || []).filter((g) => genreSet.has(g.toLowerCase())).length;
                    if (gB !== gA) return gB - gA;
                    return (b.averageScore || 0) - (a.averageScore || 0);
                });
            candidates.forEach((item) => {
                if (items.length >= 16 || seen.has(item.id)) return;
                seen.add(item.id);
                items.push(item);
            });
        } catch {
            // Keep collected recommendations
        }
    }

    cache.set(key, items);
    return items;
}

interface Props { kind: ReadingKind; anilistId?: number; title: string; genres?: string[]; embedded?: boolean; }
export default function MoreLikeReading({ kind, anilistId, title, genres, embedded = false }: Props) {
    const navigate = useNavigate();
    const [emblaRef, emblaApi] = useEmblaCarousel({ align: 'start', containScroll: 'trimSnaps', dragFree: true });
    const genreKey = (genres || []).filter(Boolean).slice(0, 4).join(',');
    const requestKey = `${kind}:${anilistId || normalize(title)}:${genreKey}`;
    const [result, setResult] = useState<{ key: string; items: Media[]; loading: boolean }>({ key: '', items: [], loading: false });
    useEffect(() => {
        if (!title && !anilistId) return;
        let active = true;
        setResult((prev) => ({ key: requestKey, items: prev.key === requestKey ? prev.items : [], loading: true }));
        void getRecommendations(kind, anilistId, title, genres).then((items) => {
            if (active) setResult({ key: requestKey, items, loading: false });
        }).catch((error) => {
            console.warn('[MoreLikeReading] Recommendations unavailable', error);
            if (active) setResult({ key: requestKey, items: [], loading: false });
        });
        return () => { active = false; };
    }, [kind, anilistId, title, genreKey, requestKey]);
    const items = result.key === requestKey ? result.items : [];
    const loading = result.key === requestKey && result.loading;
    if (!items.length) {
        if (!embedded) return null;
        if (loading) {
            return (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4 pt-2 animate-pulse">
                    {Array.from({ length: 5 }).map((_, idx) => (
                        <div key={idx} className="space-y-2">
                            <div className="aspect-[2/3] w-full rounded-xl bg-white/10" />
                            <div className="h-4 w-3/4 rounded bg-white/10" />
                        </div>
                    ))}
                </div>
            );
        }
        return <p className="py-8 text-sm font-semibold text-white/50">No similar titles available.</p>;
    }
    return <section className={embedded ? 'relative z-10 pt-2' : 'relative z-10 mt-12'}>
        <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-[20px] font-extrabold tracking-tight text-white sm:text-[22px]">More like this</h2>
            <div className="flex gap-1.5">
                <button type="button" onClick={() => emblaApi?.scrollPrev()} aria-label="Previous recommendations" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08] text-white hover:bg-white/[0.18]"><ChevronLeft className="h-4 w-4" /></button>
                <button type="button" onClick={() => emblaApi?.scrollNext()} aria-label="Next recommendations" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08] text-white hover:bg-white/[0.18]"><ChevronRight className="h-4 w-4" /></button>
            </div>
        </div>
        <div ref={emblaRef} className="overflow-hidden"><div className="flex touch-pan-y gap-4">
            {items.map((item) => {
                const name = item.title?.english || item.title?.romaji || item.title?.native || 'Unknown';
                const image = item.coverImage?.extraLarge || item.coverImage?.large || '';
                const base = { id: item.id, mal_id: item.id, title: name, title_english: item.title?.english, title_romaji: item.title?.romaji, images: { jpg: { image_url: image, large_image_url: image } }, type: item.format, countryOfOrigin: item.countryOfOrigin, status: item.status, score: item.averageScore ? item.averageScore / 10 : undefined, chapters: item.chapters, volumes: item.volumes };
                return <div key={item.id} className="min-w-0 flex-[0_0_140px] md:flex-[0_0_210px] lg:flex-[0_0_230px]">
                    {kind === 'manga'
                        ? <MangaCard manga={base as Manga} disableTilt onClick={(manga) => { const route = getMangaDetailsRouteId(manga); if (route) navigate(`/manga/details/${encodeURIComponent(route)}`, { state: { manga } }); }} />
                        : <LNCard ln={base as LightNovel} disableTilt onClick={(ln) => navigate(`/ln/details/${encodeURIComponent(String(ln.id))}`, { state: { ln } })} />}
                </div>;
            })}
        </div></div>
    </section>;
}

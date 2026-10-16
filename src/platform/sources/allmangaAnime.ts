import { postJson } from '../nativeHttp';

const ALLMANGA_API_URL = 'https://api.mkissa.net/api';
const ALLMANGA_ORIGIN = 'https://mkissa.to';

const LATEST_UPDATES_QUERY = `query($search:SearchInput $limit:Int $page:Int $translationType:VaildTranslationTypeEnumType $countryOrigin:VaildCountryOriginEnumType){shows(search:$search limit:$limit page:$page translationType:$translationType countryOrigin:$countryOrigin){edges{_id aniListId name englishName thumbnail banner type status score averageScore season availableEpisodes lastEpisodeDate lastEpisodeInfo lastEpisodeTimestamp episodeCount genres slugTime} pageInfo{total totalPages page hasNextPage}}}`;

type AllMangaShow = {
    _id?: string;
    aniListId?: string | number | null;
    name?: string;
    englishName?: string | null;
    thumbnail?: string | null;
    banner?: string | null;
    type?: string | null;
    status?: string | null;
    score?: number | null;
    averageScore?: number | null;
    season?: { quarter?: string; year?: number } | null;
    availableEpisodes?: Record<string, number>;
    lastEpisodeInfo?: Record<string, { episodeString?: string }>;
    lastEpisodeTimestamp?: Record<string, number>;
    episodeCount?: number | string | null;
    genres?: string[];
};

type AllMangaLatestResponse = {
    data?: {
        shows?: {
            edges?: AllMangaShow[];
            pageInfo?: { total?: number; totalPages?: number; page?: number; hasNextPage?: boolean };
        };
    };
};

export type LocalAllMangaLatestItem = {
    id: string;
    session: string;
    scraperId: string;
    title: string;
    jname?: string;
    poster: string;
    image: string;
    banner: string;
    status: string;
    type: string;
    episodes?: number;
    latestEpisode?: number;
    sub?: number;
    dub?: number;
    year?: string;
    score?: string;
    source: 'allmanga';
    allMangaId: string;
    anilistId?: number;
    genres: string[];
};

const absoluteAssetUrl = (value: unknown) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith('//')) return `https:${raw}`;
    return `https://wp.youtube-anime.com/aln.youtube-anime.com/${raw.replace(/^\/+/, '')}`;
};

const latestEpisodeFor = (show: AllMangaShow, audio: 'sub' | 'dub') => {
    const explicitEpisode = Number(show.lastEpisodeInfo?.[audio]?.episodeString || 0);
    return explicitEpisode > 0 ? explicitEpisode : Number(show.availableEpisodes?.[audio] || 0);
};

const mapShow = (show: AllMangaShow): LocalAllMangaLatestItem | null => {
    const showId = String(show._id || '').trim();
    const title = String(show.englishName || show.name || '').trim();
    const poster = absoluteAssetUrl(show.thumbnail);
    if (!showId || !title || !poster) return null;

    const session = `am-${showId}`;
    const latestEpisode = latestEpisodeFor(show, 'sub') || latestEpisodeFor(show, 'dub') || undefined;
    const score = Number(show.score || (show.averageScore ? Number(show.averageScore) / 10 : 0));
    const year = Number(show.season?.year || 0) || undefined;
    const anilistId = Number(show.aniListId || 0) || undefined;
    return {
        id: session,
        session,
        scraperId: session,
        title,
        jname: show.name,
        poster,
        image: poster,
        banner: absoluteAssetUrl(show.banner),
        status: show.status || 'Unknown',
        type: show.type || 'TV',
        episodes: Number(show.episodeCount || latestEpisode || 0) || undefined,
        latestEpisode,
        sub: Number(show.availableEpisodes?.sub || 0) || undefined,
        dub: Number(show.availableEpisodes?.dub || 0) || undefined,
        year: year ? String(year) : undefined,
        score: Number.isFinite(score) && score > 0 ? String(score) : undefined,
        source: 'allmanga',
        allMangaId: showId,
        anilistId,
        genres: Array.isArray(show.genres) ? show.genres : [],
    };
};

export const getLocalAllMangaLatestUpdates = async (page = 1, limit = 18) => {
    const safePage = Math.max(1, Math.floor(Number(page) || 1));
    const safeLimit = Math.max(1, Math.floor(Number(limit) || 18));
    const payload = await postJson<AllMangaLatestResponse>(
        ALLMANGA_API_URL,
        {
            query: LATEST_UPDATES_QUERY,
            variables: {
                search: {
                    sortBy: 'Latest_Update',
                    sortDirection: 'DSC',
                    allowAdult: true,
                    allowUnknown: false,
                },
                limit: safeLimit,
                page: safePage,
                translationType: 'sub',
                countryOrigin: 'ALL',
            },
        },
        { Referer: ALLMANGA_ORIGIN, Origin: ALLMANGA_ORIGIN },
    );
    const shows = payload.data?.shows;
    const data = (shows?.edges || [])
        .map(mapShow)
        .filter((item): item is LocalAllMangaLatestItem => item !== null)
        .slice(0, safeLimit);
    const total = Number(shows?.pageInfo?.total || 0);

    return {
        data,
        pagination: {
            current_page: Number(shows?.pageInfo?.page || safePage),
            last_visible_page: Number(shows?.pageInfo?.totalPages || (total ? Math.ceil(total / safeLimit) : safePage)),
            has_next_page: Boolean(shows?.pageInfo?.hasNextPage),
        },
    };
};

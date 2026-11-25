import React, { useMemo, useState } from 'react';
import type { Anime } from '../../../types/anime';
import { useTitleLanguage } from '../../../context/TitleLanguageContext';
import { getDisplayTitle } from '../../../utils/titleLanguage';
import { getDisplayImageUrl } from '../../../utils/image';

interface AnimeHomeSidebarProps {
    airingAnime: Anime[];
    upcomingAnime: Anime[];
    isLoading?: boolean;
    onAnimeClick: (anime: Anime) => void;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatEpisodeScheduleText = (anime: Anime, isUpcoming = false): string => {
    const nextEp = anime.nextAiringEpisode;
    if (nextEp && Number(nextEp.episode) > 0) {
        const seconds = Number(nextEp.timeUntilAiring || 0);
        if (seconds > 0) {
            const targetDate = new Date(Date.now() + seconds * 1000);
            const month = MONTH_NAMES[targetDate.getMonth()];
            const day = targetDate.getDate();
            const hours = String(targetDate.getHours()).padStart(2, '0');
            const mins = String(targetDate.getMinutes()).padStart(2, '0');
            return `Episode ${nextEp.episode} \u2022 ${month} ${day} at ${hours}:${mins}`;
        }
        return `Episode ${nextEp.episode} \u2022 Airing soon`;
    }

    if (isUpcoming) {
        if (anime.aired?.from) {
            const parsed = new Date(anime.aired.from);
            if (!Number.isNaN(parsed.getTime())) {
                const month = MONTH_NAMES[parsed.getMonth()];
                const day = parsed.getDate();
                return `Episode 1 \u2022 ${month} ${day} at 23:00`;
            }
        }
        return '';
    }

    const ep = anime.latestEpisode || anime.episodes;
    if (ep) {
        return `Episode ${ep} \u2022 Released`;
    }
    return 'Currently airing';
};

const SidebarBannerRow: React.FC<{
    anime: Anime;
    isUpcoming?: boolean;
    language: Parameters<typeof getDisplayTitle>[1];
    onClick: () => void;
}> = ({ anime, isUpcoming = false, language, onClick }) => {
    const displayTitle = getDisplayTitle(anime as unknown as Record<string, unknown>, language);
    const posterUrl = getDisplayImageUrl(
        anime.images?.jpg?.large_image_url ||
        anime.images?.jpg?.image_url ||
        anime.anilist_cover_image ||
        ''
    );
    const bannerUrl = getDisplayImageUrl(
        anime.anilist_banner_image ||
        anime.episodeMetadata?.[0]?.thumbnail ||
        posterUrl
    );
    const score = anime.score && anime.score > 0
        ? (anime.score > 10 ? (anime.score / 10).toFixed(1) : anime.score.toFixed(1))
        : null;
    const year = anime.year || (isUpcoming ? new Date().getFullYear() + 1 : new Date().getFullYear());
    const scheduleLine = formatEpisodeScheduleText(anime, isUpcoming);

    return (
        <button
            type="button"
            onClick={onClick}
            className="w-full text-left relative h-[76px] rounded-xl overflow-hidden border-0 outline-none focus:outline-none bg-[#161821] hover:bg-[#1c1f2b] flex items-center gap-3 p-2 group transition-all duration-200 cursor-pointer"
        >
            {/* Soft Backdrop Banner on the right */}
            {bannerUrl && (
                <div
                    className="absolute inset-0 bg-cover bg-center opacity-45 group-hover:opacity-60 transition-opacity duration-300"
                    style={{ backgroundImage: `url(${bannerUrl})` }}
                />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-[#0d0f16] via-[#0d0f16]/85 to-black/35" />

            {/* Left Poster Thumbnail */}
            <div className="relative z-10 w-11 h-[60px] rounded-lg overflow-hidden bg-white/5 shrink-0">
                {posterUrl && (
                    <img
                        src={posterUrl}
                        alt={displayTitle}
                        className="w-full h-full object-cover"
                        loading="lazy"
                    />
                )}
            </div>

            {/* Right Text Info */}
            <div className="relative z-10 min-w-0 flex-1 pr-1">
                <h4 className="text-[13px] font-bold text-white truncate group-hover:text-[#0596ff] transition-colors">
                    {displayTitle}
                </h4>
                <div className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-white/80">
                    <span className="bg-white/15 px-1.5 py-0.2 rounded text-[10px] font-bold uppercase text-white">
                        {anime.type || 'TV'}
                    </span>
                    <span className="text-white/75">{year}</span>
                    {score && (
                        <span className="inline-flex items-center gap-0.5 text-white/85">
                            <span className="text-white/70">&#9734;</span>
                            {score}
                        </span>
                    )}
                </div>
                {scheduleLine && (
                    <p className="mt-0.5 text-[11px] font-semibold text-white/65 truncate">
                        {scheduleLine}
                    </p>
                )}
            </div>
        </button>
    );
};

const SidebarCardSkeleton: React.FC<{ title: string }> = ({ title }) => (
    <div className="rounded-2xl bg-[#0e0f13]/80 backdrop-blur-md border border-white/[0.06] p-4">
        <h3 className="text-base font-extrabold text-white mb-3.5">{title}</h3>
        <div className="space-y-2.5">
            {Array.from({ length: 5 }).map((_, idx) => (
                <div
                    key={idx}
                    className="h-[76px] rounded-xl bg-white/[0.06] animate-pulse"
                />
            ))}
        </div>
    </div>
);

const AnimeHomeSidebar: React.FC<AnimeHomeSidebarProps> = ({
    airingAnime,
    upcomingAnime,
    isLoading = false,
    onAnimeClick,
}) => {
    const { language } = useTitleLanguage();
    const [selectedDayOffset, setSelectedDayOffset] = useState(0);

    const scheduleDays = useMemo(() => {
        const now = new Date();
        return Array.from({ length: 5 }).map((_, offset) => {
            const d = new Date(now);
            d.setDate(now.getDate() + offset);
            return {
                offset,
                dayName: DAY_NAMES[d.getDay()],
                dateLabel: `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`,
                dayOfWeek: d.getDay(),
            };
        });
    }, []);

    const scheduleItemsByOffset = useMemo(() => {
        const map = new Map<number, Array<{ anime: Anime; time: string; episode: number }>>();
        for (let i = 0; i < 5; i++) {
            map.set(i, []);
        }

        const nowMs = Date.now();
        const fallbackSlots = ['01:00', '18:30', '20:26', '21:00', '22:00', '22:30', '23:00', '23:30'];

        airingAnime.forEach((anime, index) => {
            const nextEp = anime.nextAiringEpisode;
            if (nextEp && Number(nextEp.timeUntilAiring) > 0) {
                const airDate = new Date(nowMs + Number(nextEp.timeUntilAiring) * 1000);
                const diffDays = Math.floor((airDate.getTime() - nowMs) / 86400000);
                const bucket = diffDays >= 0 && diffDays < 5 ? diffDays : index % 5;
                const hours = String(airDate.getHours()).padStart(2, '0');
                const mins = String(airDate.getMinutes()).padStart(2, '0');
                map.get(bucket)?.push({
                    anime,
                    time: `${hours}:${mins}`,
                    episode: Number(nextEp.episode || (anime.latestEpisode || 0) + 1 || 1),
                });
            } else {
                const bucket = index % 5;
                map.get(bucket)?.push({
                    anime,
                    time: fallbackSlots[index % fallbackSlots.length],
                    episode: Number((anime.latestEpisode || 0) + 1 || anime.episodes || 1),
                });
            }
        });

        for (let i = 0; i < 5; i++) {
            const list = map.get(i) || [];
            list.sort((a, b) => a.time.localeCompare(b.time));
            map.set(i, list.slice(0, 7));
        }

        return map;
    }, [airingAnime]);

    if (isLoading && airingAnime.length === 0 && upcomingAnime.length === 0) {
        return (
            <aside className="w-full space-y-6">
                <SidebarCardSkeleton title="Top airing" />
                <SidebarCardSkeleton title="Upcoming" />
            </aside>
        );
    }

    const activeScheduleList = scheduleItemsByOffset.get(selectedDayOffset) || [];

    return (
        <aside className="w-full space-y-6">
            {/* Top Airing Card */}
            {airingAnime.length > 0 && (
                <div className="rounded-2xl bg-[#0e0f13]/80 backdrop-blur-md border border-white/[0.06] p-4">
                    <h3 className="text-[16px] font-extrabold text-white mb-3.5 tracking-tight">
                        Top airing
                    </h3>
                    <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1" aria-label="Top airing anime">
                        {airingAnime.slice(0, 10).map((anime, index) => (
                            <SidebarBannerRow
                                key={`top-airing-${anime.id || anime.mal_id || index}`}
                                anime={anime}
                                language={language}
                                onClick={() => onAnimeClick(anime)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Upcoming Card */}
            {upcomingAnime.length > 0 && (
                <div className="rounded-2xl bg-[#0e0f13]/80 backdrop-blur-md border border-white/[0.06] p-4">
                    <h3 className="text-[16px] font-extrabold text-white mb-3.5 tracking-tight">
                        Upcoming
                    </h3>
                    <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1" aria-label="Upcoming anime">
                        {upcomingAnime.slice(0, 10).map((anime, index) => (
                            <SidebarBannerRow
                                key={`upcoming-${anime.id || anime.mal_id || index}`}
                                anime={anime}
                                isUpcoming
                                language={language}
                                onClick={() => onAnimeClick(anime)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Airing Schedule Card */}
            {airingAnime.length > 0 && (
                <div className="rounded-2xl bg-[#0e0f13]/80 backdrop-blur-md border border-white/[0.06] p-4">
                    <h3 className="text-[16px] font-extrabold text-white mb-3 tracking-tight">
                        Airing schedule
                    </h3>

                    {/* Day Selector Tabs */}
                    <div className="flex items-start gap-4 mb-4 pb-2.5">
                        {scheduleDays.map((day) => {
                            const isActive = day.offset === selectedDayOffset;
                            return (
                                <button
                                    key={day.offset}
                                    type="button"
                                    onClick={() => setSelectedDayOffset(day.offset)}
                                    className="flex flex-col items-start text-left cursor-pointer group border-0 outline-none focus:outline-none"
                                >
                                    <span
                                        className={`text-[15px] font-extrabold transition-colors ${
                                            isActive ? 'text-white' : 'text-white/55 group-hover:text-white/85'
                                        }`}
                                    >
                                        {day.dayName}
                                    </span>
                                    {isActive ? (
                                        <span className="text-[10px] font-bold text-white/80 border-b-2 border-white pb-0.5 mt-0.5">
                                            {day.dateLabel}
                                        </span>
                                    ) : (
                                        <span className="h-[15px]" />
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Scheduled Episode Rows */}
                    <div className="space-y-3">
                        {activeScheduleList.map(({ anime, time, episode }, idx) => {
                            const displayTitle = getDisplayTitle(
                                anime as unknown as Record<string, unknown>,
                                language
                            );
                            return (
                                <button
                                    key={`sched-${anime.id || anime.mal_id || idx}`}
                                    type="button"
                                    onClick={() => onAnimeClick(anime)}
                                    className="w-full flex items-center justify-between gap-2.5 text-left group cursor-pointer border-0 outline-none focus:outline-none"
                                >
                                    <div className="min-w-0 flex items-center gap-2 flex-1">
                                        <span className="text-[11.5px] font-extrabold text-white/75 shrink-0 tabular-nums">
                                            {time}
                                        </span>
                                        <span className="text-[12px] font-extrabold text-white/90 uppercase truncate group-hover:text-[#0596ff] transition-colors">
                                            {displayTitle}
                                        </span>
                                    </div>
                                    <span className="shrink-0 px-2 py-0.5 rounded bg-white/10 text-[10px] font-extrabold text-white/85">
                                        EP {episode}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </aside>
    );
};

export default AnimeHomeSidebar;

import { useState } from 'react';
import { Play, Plus, Check, ChevronDown } from 'lucide-react';
import { AnimatePresence, m } from 'framer-motion';
import type { Anime } from '../../../../types/anime';
import { useTitleLanguage } from '../../../../context/TitleLanguageContext';
import { getDisplayTitle } from '../../../../utils/titleLanguage';
import { isAnimeAiring, getAiringLabel, getSeasonYearLabel } from '../../../../utils/animeAiring';

interface DetailsInfoProps {
    anime: Anime;
    episodesCount: number;
    isLoading?: boolean;
    inList: boolean;
    inFavorites?: boolean;
    onWatch: () => void;
    onToggleList: () => void;
    onToggleFavorite?: () => void;
    onBack: () => void;
    statusPicker?: React.ReactNode;
    children?: React.ReactNode;
}

export default function DetailsInfo({ anime, episodesCount, isLoading = false, inList, inFavorites = false, onWatch, onToggleList, onToggleFavorite, onBack, statusPicker, children }: DetailsInfoProps) {
    const { language } = useTitleLanguage();
    const [synopsisExpanded, setSynopsisExpanded] = useState(false);
    const displayTitle = getDisplayTitle(anime as unknown as Record<string, unknown>, language);

    // ... helper ...
    const getLatestEpisode = () => {
        if (anime.status === 'NOT_YET_RELEASED') return null;
        if (String(anime.type || '').toUpperCase() === 'MOVIE') return null;
        if (anime.latestEpisode) return anime.latestEpisode;
        if (episodesCount > 0) return episodesCount;
        if (anime.episodes) return anime.episodes;
        return null;
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-row gap-4 md:gap-8 lg:gap-12 items-start md:items-end">
                {/* Portrait Image */}
            <div className="flex-shrink-0 w-28 sm:w-36 md:w-56 lg:w-60 relative aspect-[2/3]">
                <div className="rounded-xl overflow-hidden shadow-2xl shadow-black/50 w-full h-full relative bg-[#121212] border border-white/5">
                    <AnimatePresence mode="popLayout">
                        <m.img
                            key={anime.id || anime.mal_id}
                            src={anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || ''}
                            alt={displayTitle}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.4 }}
                            className="w-full h-full object-cover absolute inset-0"
                        />
                    </AnimatePresence>
                </div>
            </div>

            {/* Details */}
            <div className="flex-1 text-left flex flex-col justify-end md:h-[336px] lg:h-[360px] gap-3 md:gap-4 min-w-0 relative">
                <AnimatePresence mode="wait">
                    <m.div
                        key={anime.id || anime.mal_id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                        className="flex flex-col gap-3 md:gap-4 justify-end h-full w-full"
                    >
                        {/* Title */}
                        <div className="space-y-1">
                            <h1 className="text-[24px] sm:text-3xl md:text-4xl lg:text-5xl font-semibold md:font-black text-white md:uppercase tracking-tight leading-[1.12]">
                                {anime.title_english || anime.title || displayTitle}
                            </h1>
                        </div>

                        {/* Genres */}
                        {anime.genres && anime.genres.length > 0 && (
                            <div className="hidden md:flex flex-wrap items-center justify-start gap-2">
                                {anime.genres.slice(0, 4).map((genre) => (
                                    <span key={genre.name} className="px-3 py-1 bg-white/5 border border-white/5 rounded-full text-xs font-semibold text-gray-300">
                                        {genre.name}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Metadata Row */}
                        <div className="flex flex-wrap items-center justify-start gap-x-3 gap-y-1 text-sm font-bold text-gray-400">
                            {isLoading ? (
                                <>
                                    <span className="h-4 w-14 bg-white/10 rounded animate-pulse" />
                                    <span className="h-4 w-16 bg-white/10 rounded animate-pulse" />
                                    <span className="h-4 w-10 bg-white/10 rounded animate-pulse" />
                                </>
                            ) : (
                                <>
                                    {anime.score > 0 && (
                                        <span className="flex items-center gap-1 text-[#facc15]">
                                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                                            {anime.score}
                                        </span>
                                    )}
                                    {isAnimeAiring(anime.status) ? (
                                        <span className="text-[#9ed7ff] font-extrabold">{getAiringLabel(anime)}</span>
                                    ) : (
                                        (getSeasonYearLabel(anime.season, anime.year) || anime.year) && (
                                            <span>{getSeasonYearLabel(anime.season, anime.year) || anime.year}</span>
                                        )
                                    )}
                                    {getLatestEpisode() && (
                                        <span>{getLatestEpisode()} Episodes</span>
                                    )}
                                    {anime.type && (
                                        <span className="px-2 py-0.5 bg-white/10 rounded text-[10px] text-white">
                                            {anime.type}
                                        </span>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Synopsis */}
                        <div className="hidden md:block text-gray-300 text-sm md:text-base leading-relaxed max-w-4xl line-clamp-4">
                            {anime.synopsis || 'No synopsis.'}
                        </div>

                        {/* Actions */}
                        <div className="hidden md:flex w-full flex-row items-center justify-start gap-3 pt-1">
                            <button
                                onClick={onWatch}
                                disabled={isLoading}
                                className="h-10 px-6 bg-[#1a1a1a] hover:bg-white/10 text-white text-sm font-bold rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap"
                            >
                                <Play className="w-4 h-4 fill-current" />
                                <span>Watch</span>
                            </button>
                            
                            <div className="relative">
                                <button
                                    onClick={onToggleList}
                                    disabled={isLoading}
                                    className={`h-10 px-6 text-sm font-bold rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap ${inList
                                        ? 'bg-yorumi-accent/20 text-yorumi-accent hover:bg-yorumi-accent/30'
                                        : 'bg-[#1a1a1a] hover:bg-white/10 text-white'
                                        }`}
                                >
                                    {inList ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                    <span>{inList ? 'Saved' : 'Save'}</span>
                                </button>
                                {statusPicker}
                            </div>

                            <button
                                onClick={onBack}
                                className="h-10 px-6 bg-[#1a1a1a] hover:bg-white/10 text-white text-sm font-bold rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                                <span>Back</span>
                            </button>
                        </div>
                    </m.div>
                </AnimatePresence>
            </div>
        </div>

            <div className="md:hidden space-y-4">
                <div className="relative">
                    <p className={`overflow-hidden text-base leading-7 text-zinc-300 transition-[max-height] duration-500 ease-out ${synopsisExpanded ? 'max-h-[40rem]' : 'max-h-[5.25rem]'}`}>
                        {anime.synopsis || 'No synopsis available.'}
                    </p>
                    {!synopsisExpanded && (anime.synopsis || '').length > 140 && (
                        <div className="pointer-events-none absolute inset-x-0 bottom-8 h-12 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/85 to-transparent" />
                    )}
                    {(anime.synopsis || '').length > 140 && (
                        <button
                            type="button"
                            onClick={() => setSynopsisExpanded((value) => !value)}
                            className="mx-auto mt-1 flex h-8 w-8 items-center justify-center text-white/85"
                            aria-label={synopsisExpanded ? 'Show less synopsis' : 'Show more synopsis'}
                        >
                            <ChevronDown className={`h-5 w-5 transition-transform duration-300 ${synopsisExpanded ? 'rotate-180' : ''}`} />
                        </button>
                    )}
                </div>
                {anime.genres && anime.genres.length > 0 && (
                    <div className={`${synopsisExpanded ? 'flex flex-wrap' : 'flex overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'} gap-2 pb-1 transition-all duration-300`}>
                        {(synopsisExpanded ? anime.genres : anime.genres.slice(0, 8)).map((genre) => (
                            <span key={genre.name} className="shrink-0 rounded-full bg-white/[0.07] px-3 py-1.5 text-xs font-semibold text-zinc-300">
                                {genre.name}
                            </span>
                        ))}
                    </div>
                )}
                <div className="hidden">
                    <button onClick={onWatch} disabled={isLoading} className="h-11 rounded-xl bg-white/[0.08] text-sm font-bold text-white flex items-center justify-center gap-2">
                        <Play className="h-4 w-4 fill-current" /> Watch
                    </button>
                    <button onClick={onToggleList} disabled={isLoading} className={`h-11 rounded-xl text-sm font-bold flex items-center justify-center gap-2 ${inList ? 'bg-yorumi-accent/20 text-yorumi-accent' : 'bg-white/[0.08] text-white'}`}>
                        {inList ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {inList ? 'Saved' : 'Save'}
                    </button>
                    <button onClick={onBack} className="h-11 rounded-xl bg-white/[0.08] text-sm font-bold text-white flex items-center justify-center gap-2">
                        <span aria-hidden="true">←</span> Back
                    </button>
                </div>
            </div>

            {/* Children for layout extension (Tabs, etc) */}
            <div className="w-full">
                {children}
            </div>
        </div>
    );
}

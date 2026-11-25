import { useState } from 'react';

export interface CharacterEdge {
    role?: string;
    node: {
        id?: number | string;
        name?: { full?: string };
        image?: { large?: string };
    };
    voiceActors?: {
        id?: number | string;
        name?: { full?: string };
        image?: { large?: string };
        languageV2?: string;
    }[];
}

interface DetailsCharactersProps {
    characters?: {
        edges?: CharacterEdge[];
    } | null;
    title?: string;
    showHeader?: boolean;
    initialCount?: number;
}

export default function DetailsCharacters({
    characters,
    title = 'Characters',
    showHeader = true,
    initialCount = 16,
}: DetailsCharactersProps) {
    const [showAll, setShowAll] = useState(false);

    const edges = characters?.edges;
    if (!edges || edges.length === 0) return null;

    const displayedCharacters = showAll ? edges : edges.slice(0, initialCount);

    return (
        <div className={showHeader ? 'py-6 mt-6' : 'pt-2'}>
            {showHeader && (
                <div className="flex items-center gap-4 mb-5">
                    <h3 className="text-xl font-black text-white uppercase tracking-wider whitespace-nowrap">
                        {title}
                    </h3>
                    <div className="flex-1 h-px bg-white/10" />
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {displayedCharacters.map((edge, idx) => {
                    const char = edge.node;
                    const va = edge.voiceActors?.[0];
                    const roleLabel = edge.role
                        ? edge.role.toLowerCase()
                        : 'character';

                    return (
                        <div
                            key={`${char?.id || 'char'}-${idx}`}
                            className="flex items-center justify-between gap-3 rounded-[14px] bg-white/[0.06] p-3 hover:bg-white/[0.09] transition-colors"
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                {char?.image?.large ? (
                                    <img
                                        src={char.image.large}
                                        alt={char.name?.full || 'Character'}
                                        className="h-14 w-14 shrink-0 rounded-full object-cover bg-[#181818]"
                                        loading="lazy"
                                    />
                                ) : (
                                    <div className="h-14 w-14 shrink-0 rounded-full bg-[#161a29] flex flex-col items-center justify-center text-[10px] font-extrabold text-[#3b82f6] tracking-tight leading-tight select-none">
                                        <span>NO</span>
                                        <span>IMAGE</span>
                                    </div>
                                )}
                                <div className="min-w-0">
                                    <div className="truncate text-sm font-bold text-white">
                                        {char?.name?.full || 'Unknown'}
                                    </div>
                                    <div className="text-xs font-semibold text-white/50 capitalize">
                                        {roleLabel}
                                    </div>
                                </div>
                            </div>

                            {va && (
                                <div className="flex items-center gap-2.5 min-w-0 text-right">
                                    <div className="min-w-0 hidden sm:block">
                                        <div className="truncate text-xs font-bold text-white/90">
                                            {va.name?.full}
                                        </div>
                                        <div className="text-[11px] font-semibold text-white/45">
                                            {va.languageV2 || 'Japanese'}
                                        </div>
                                    </div>
                                    {va.image?.large ? (
                                        <img
                                            src={va.image.large}
                                            alt={va.name?.full}
                                            className="h-12 w-12 shrink-0 rounded-full object-cover bg-[#181818]"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <div className="h-12 w-12 shrink-0 rounded-full bg-[#161a29] flex flex-col items-center justify-center text-[9px] font-extrabold text-[#3b82f6] tracking-tight leading-tight select-none">
                                            <span>NO</span>
                                            <span>IMAGE</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {edges.length > initialCount && (
                <div className="mt-5 flex justify-center">
                    <button
                        type="button"
                        onClick={() => setShowAll(!showAll)}
                        className="text-xs font-semibold tracking-wider uppercase text-zinc-400 hover:text-white transition-colors bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 px-4 py-2 rounded-xl cursor-pointer"
                    >
                        {showAll ? 'Show less' : `Show all (${edges.length})`}
                    </button>
                </div>
            )}
        </div>
    );
}

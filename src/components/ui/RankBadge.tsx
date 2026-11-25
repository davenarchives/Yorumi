import React from 'react';

const PASTEL_RANK_COLORS = [
    '#86efac', // Mint green (#1 in reference)
    '#fb7185', // Coral red (#2 in reference)
    '#f472b6', // Rose pink (#3 in reference)
    '#93c5fd', // Sky blue
    '#fde047', // Butter yellow
    '#c4b5fd', // Lavender
    '#fdba74', // Peach
    '#5eead4', // Aqua
    '#f9a8d4', // Pastel pink
    '#bef264', // Lime
    '#a5f3fc', // Ice cyan
    '#fca5a5', // Salmon
];

/**
 * Deterministic pseudo-random pastel color picker per rank so adjacent ranks
 * vary naturally and never flicker across re-renders.
 */
export function getRankPastelColor(rank: number): string {
    if (rank === 1) return PASTEL_RANK_COLORS[0];
    if (rank === 2) return PASTEL_RANK_COLORS[1];
    if (rank === 3) return PASTEL_RANK_COLORS[2];

    const hash = ((rank * 2654435761) >>> 0) % PASTEL_RANK_COLORS.length;
    return PASTEL_RANK_COLORS[hash];
}

interface RankBadgeProps {
    rank: number;
    className?: string;
}

export const RankBadge: React.FC<RankBadgeProps> = ({ rank, className = '' }) => {
    if (!Number.isFinite(rank) || rank <= 0) return null;

    const bgColor = getRankPastelColor(rank);
    const isThreeDigits = rank >= 100;

    return (
        <span
            className={`inline-flex items-center justify-center rounded-full font-black text-neutral-950 shadow-[0_4px_12px_rgba(0,0,0,0.45)] select-none leading-none tabular-nums tracking-tight ${
                isThreeDigits
                    ? 'h-8 min-w-[34px] px-1.5 text-[11px] sm:h-9 sm:min-w-[38px] sm:text-xs'
                    : 'h-8 w-8 text-[11.5px] sm:h-9 sm:w-9 sm:text-[12.5px]'
            } ${className}`}
            style={{ backgroundColor: bgColor }}
            aria-label={`Rank #${rank}`}
        >
            #{rank}
        </span>
    );
};

export default RankBadge;

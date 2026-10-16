const getExplicitNumber = (title: string, unit: 'season' | 'cour' | 'part') => {
    const match = title.match(new RegExp(`\\b${unit}\\s*(\\d+)\\b`, 'i'))
        || title.match(new RegExp(`\\b(\\d+)(?:st|nd|rd|th)\\s*${unit}\\b`, 'i'));
    return match ? Number(match[1]) : 0;
};

const hasUnit = (title: string, unit: 'cour' | 'part') =>
    new RegExp(`\\b${unit}\\b`, 'i').test(title);

const getBaseTitle = (title: string) => title
    .toLowerCase()
    .replace(/\b(?:season|cour|part)\s*\d+\b/gi, ' ')
    .replace(/\b\d+(?:st|nd|rd|th)\s*(?:season|cour|part)\b/gi, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Produces stable navigation labels without knowing anything about a specific
 * franchise. Cours and parts remain subdivisions of the current logical
 * season, while explicitly numbered seasons advance to their declared number.
 * Named sequels whose base title changes keep their real title.
 */
export const buildAnimeSeasonLabels = (titles: string[]): string[] => {
    if (titles.length === 0) return [];

    const rootBaseTitle = getBaseTitle(titles[0]);
    const usesNumberedSeasonFormat = titles.some((title, index) =>
        index > 0 &&
        getBaseTitle(title) === rootBaseTitle &&
        (getExplicitNumber(title, 'season') > 0 || hasUnit(title, 'cour') || hasUnit(title, 'part'))
    );
    const usedLabels = new Set<string>();
    let currentSeason = 0;

    return titles.map((title, index) => {
        const explicitSeason = getExplicitNumber(title, 'season');
        const courNumber = getExplicitNumber(title, 'cour');
        const partNumber = getExplicitNumber(title, 'part');
        const isCour = hasUnit(title, 'cour');
        const isPart = hasUnit(title, 'part');
        const isContinuationUnit = isCour || isPart;

        if (explicitSeason > 0) currentSeason = explicitSeason;
        else if (index === 0) currentSeason = 1;
        else if (!isContinuationUnit) currentSeason += 1;

        const suffix = [
            isCour ? `Cour ${courNumber || 1}` : '',
            isPart ? `Part ${partNumber || 1}` : '',
        ].filter(Boolean).join(' ');
        const sharesRootTitle = getBaseTitle(title) === rootBaseTitle;
        const useSeasonLabel = explicitSeason > 0 || isContinuationUnit || (usesNumberedSeasonFormat && sharesRootTitle);
        let label = useSeasonLabel
            ? `Season ${currentSeason}${suffix ? ` ${suffix}` : ''}`
            : title;

        if (usedLabels.has(label)) label = `${label} (${index + 1})`;
        usedLabels.add(label);
        return label;
    });
};

export const getMeaningfulTmdbSeasonLabel = (season: { season_number: number; name?: string }) => {
    const fallback = `Season ${season.season_number}`;
    const name = String(season.name || '').trim();
    return !name || /^season\s*\d+$/i.test(name) ? fallback : name;
};

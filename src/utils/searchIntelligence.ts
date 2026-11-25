export interface SearchCorrection {
    correctedQuery: string;
    isAlias: boolean;
}

const ALIAS_MAP: Record<string, string> = {
    op: 'One Piece',
    opm: 'One-Punch Man',
    wanpanman: 'One-Punch Man',
    aot: 'Attack on Titan',
    snk: 'Attack on Titan',
    shingeki: 'Attack on Titan',
    'shingeki no kyojin': 'Attack on Titan',
    jjk: 'Jujutsu Kaisen',
    mha: 'My Hero Academia',
    bnha: 'My Hero Academia',
    'boku no hero': 'My Hero Academia',
    kny: 'Demon Slayer',
    kimetsu: 'Demon Slayer',
    'kimetsu no yaiba': 'Demon Slayer',
    csm: 'Chainsaw Man',
    hxh: 'Hunter x Hunter',
    fma: 'Fullmetal Alchemist',
    fmab: 'Fullmetal Alchemist: Brotherhood',
    sao: 'Sword Art Online',
    cote: 'Classroom of the Elite',
    youkoso: 'Classroom of the Elite',
    orv: "Omniscient Reader's Viewpoint",
    'jeonjijeok dokja': "Omniscient Reader's Viewpoint",
    tbate: 'The Beginning After the End',
    lotm: 'Lord of the Mysteries',
    guimi: 'Lord of the Mysteries',
    'gu zhen ren': 'Reverend Insanity',
    'na honjaman': 'Solo Leveling',
    tensura: 'That Time I Got Reincarnated as a Slime',
    slime: 'That Time I Got Reincarnated as a Slime',
    mushoku: 'Mushoku Tensei',
    rezero: 'Re:Zero',
    're zero': 'Re:Zero',
    danmachi: 'Is It Wrong to Try to Pick Up Girls in a Dungeon?',
    konosuba: 'KonoSuba',
    oregairu: 'My Teen Romantic Comedy SNAFU',
    kusuriya: 'The Apothecary Diaries',
    'kusuriya no hitorigoto': 'The Apothecary Diaries',
    apothecary: 'The Apothecary Diaries',
    sousou: "Frieren: Beyond Journey's End",
    'sousou no frieren': "Frieren: Beyond Journey's End",
    jjba: "JoJo's Bizarre Adventure",
    jojo: "JoJo's Bizarre Adventure",
    dbz: 'Dragon Ball Z',
    dbs: 'Dragon Ball Super',
    mdzs: 'Grandmaster of Demonic Cultivation',
    'mo dao zu shi': 'Grandmaster of Demonic Cultivation',
    tgcf: "Heaven Official's Blessing",
    'tian guan ci fu': "Heaven Official's Blessing",
    btth: 'Battle Through the Heavens',
    tged: 'The Greatest Estate Developer',
    totcf: "Trash of the Count's Family",
    rotmhs: 'Return of the Mount Hua Sect',
    tybw: 'Bleach: Thousand-Year Blood War',
    sxf: 'Spy x Family',
    onk: 'Oshi no Ko',
    ngnl: 'No Game No Life',
    tqq: 'The Quintessential Quintuplets',
    kaguya: 'Kaguya-sama: Love is War',
};

const POPULAR_TITLES: string[] = [
    'One Piece',
    'One-Punch Man',
    'Attack on Titan',
    'Jujutsu Kaisen',
    'Demon Slayer',
    'Chainsaw Man',
    'My Hero Academia',
    'Hunter x Hunter',
    'Fullmetal Alchemist: Brotherhood',
    'Death Note',
    'Naruto',
    'Naruto Shippuden',
    'Bleach',
    'Dragon Ball',
    'Solo Leveling',
    "Omniscient Reader's Viewpoint",
    'The Beginning After the End',
    'Lord of the Mysteries',
    'Reverend Insanity',
    'Mushoku Tensei',
    'The Apothecary Diaries',
    "Frieren: Beyond Journey's End",
    'Classroom of the Elite',
    'Sword Art Online',
    'Overlord',
    'Re:Zero',
    'That Time I Got Reincarnated as a Slime',
    'Berserk',
    'Vagabond',
    'Vinland Saga',
    'Monster',
    'Code Geass',
    'Steins;Gate',
    "JoJo's Bizarre Adventure",
    'Black Clover',
    'Fairy Tail',
    'Gintama',
    'Haikyuu!!',
    'Tokyo Ghoul',
    'Spy x Family',
    'Oshi no Ko',
    'Blue Lock',
    'Sakamoto Days',
    'Kagurabachi',
    'Dandadan',
    'Nano Machine',
    'Second Life Ranker',
    'Return of the Mount Hua Sect',
    'The Greatest Estate Developer',
    'SSS-Class Suicide Hunter',
    "Trash of the Count's Family",
    'Martial Peak',
    'Grandmaster of Demonic Cultivation',
    "Heaven Official's Blessing",
    'Battle Through the Heavens',
    'Shadow Slave',
    'KonoSuba',
    'Kaguya-sama: Love is War',
    'Mob Psycho 100',
    'Horimiya',
    'Bocchi the Rock!',
    'Cyberpunk: Edgerunners',
    'Violet Evergarden',
    'Your Name',
    'Cowboy Bebop',
    'Neon Genesis Evangelion',
    'Gachiakuta',
    'Kaiju No. 8',
    'Tower of God',
    'Wind Breaker',
];

const normalizeSearchText = (value: string) =>
    String(value || '')
        .toLowerCase()
        .replace(/['\u2019\u2018`]/g, '')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const damerauLevenshtein = (a: string, b: string): number => {
    const m = a.length;
    const n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;

    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost
            );
            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
                dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
            }
        }
    }
    return dp[m][n];
};

/**
 * Resolves known shorthand/alternative aliases (e.g. "opm" -> "One-Punch Man", "snk" -> "Attack on Titan").
 */
export const resolveSearchAlias = (rawQuery: string): string | null => {
    const norm = normalizeSearchText(rawQuery);
    if (!norm) return null;
    return ALIAS_MAP[norm] || null;
};

/**
 * Detects likely typos against known titles and live result titles to power "Did you mean ...?".
 */
export const suggestSearchCorrection = (
    rawQuery: string,
    candidateTitles: string[] = []
): SearchCorrection | null => {
    const norm = normalizeSearchText(rawQuery);
    if (norm.length < 3) return null;

    // 1. Exact alias match (e.g., "opm", "aot", "orv", "kusuriya")
    const aliasHit = ALIAS_MAP[norm];
    if (aliasHit && normalizeSearchText(aliasHit) !== norm) {
        return { correctedQuery: aliasHit, isAlias: true };
    }

    // 2. Fuzzy typo match against combined dictionary + live returned titles
    const pool = [...new Set([...POPULAR_TITLES, ...candidateTitles])].filter(Boolean);
    let bestTitle = '';
    let bestScore = Infinity;

    for (const title of pool) {
        const normTitle = normalizeSearchText(title);
        if (!normTitle) continue;
        // If user already typed an exact prefix or exact match, no typo correction needed
        if (normTitle === norm || normTitle.startsWith(norm) || norm.startsWith(normTitle)) {
            return null;
        }
        if (Math.abs(normTitle.length - norm.length) > Math.max(3, Math.floor(normTitle.length * 0.35))) {
            continue;
        }
        const dist = damerauLevenshtein(norm, normTitle);
        const maxAllowed = norm.length <= 5 ? 1 : norm.length <= 10 ? 2 : 3;
        if (dist > 0 && dist <= maxAllowed && dist < bestScore) {
            bestScore = dist;
            bestTitle = title;
        }
    }

    if (bestTitle) {
        return { correctedQuery: bestTitle, isAlias: false };
    }

    return null;
};

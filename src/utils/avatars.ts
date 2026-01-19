// Categorised Avatar Data
export type AvatarCategory =
    | 'DragonBall' | 'OnePiece' | 'ZoroChibi'
    | 'HXH' | 'DragonBallChibi' | 'AttackOnTitan' | 'Conan'
    | 'Naruto' | 'OnePunchMan' | 'Sakura' | 'THA'
    | 'DemonSlayer' | 'JujutsuKaisen' | 'ChainSaw'
    | 'SpyFamily' | 'Berserk' | 'Bleach' | 'DeathNote'
    | 'SpyFamily' | 'Berserk' | 'Bleach' | 'DeathNote'
    | 'Haikyu' | 'Genshin' | 'Frieren' | 'BocchiTheRock';

export interface AvatarItem {
    id: string;
    path: string;
    tags: AvatarCategory[];
}

export const AVATAR_DATA: AvatarItem[] = [
    // Bocchi The Rock
    { id: 'bocchi_hitori', path: 'bocchitherock/hitori.jpg', tags: ['BocchiTheRock'] },
    { id: 'bocchi_kita', path: 'bocchitherock/kita.jpg', tags: ['BocchiTheRock'] },
    { id: 'bocchi_nijika', path: 'bocchitherock/nijika.jpg', tags: ['BocchiTheRock'] },
    { id: 'bocchi_ryo', path: 'bocchitherock/ryo.jpg', tags: ['BocchiTheRock'] },

    // Frieren
    { id: 'frieren_fern', path: 'frieren/fern.jpg', tags: ['Frieren'] },
    { id: 'frieren_frieren', path: 'frieren/frieren.jpg', tags: ['Frieren'] },
    { id: 'frieren_stark', path: 'frieren/stark.jpg', tags: ['Frieren'] },
    { id: 'frieren_ubel', path: 'frieren/ubel.jpg', tags: ['Frieren'] },

    // Genshin
    { id: 'genshin_baizhu', path: 'genshin/baizhu.jpg', tags: ['Genshin'] },
    { id: 'genshin_beidou', path: 'genshin/beidou.jpg', tags: ['Genshin'] },
    { id: 'genshin_chichi', path: 'genshin/chichi.jpg', tags: ['Genshin'] },
    { id: 'genshin_childe', path: 'genshin/childe.jpg', tags: ['Genshin'] },
    { id: 'genshin_eula', path: 'genshin/eula.jpg', tags: ['Genshin'] },
    { id: 'genshin_hutao', path: 'genshin/hutao.jpg', tags: ['Genshin'] },
    { id: 'genshin_keqing', path: 'genshin/keqing.jpg', tags: ['Genshin'] },
    { id: 'genshin_thoma', path: 'genshin/thoma.jpg', tags: ['Genshin'] },
    { id: 'genshin_xiangling', path: 'genshin/xiangling.jpg', tags: ['Genshin'] },
    { id: 'genshin_zhongli', path: 'genshin/zhongli.jpg', tags: ['Genshin'] },

    // Hunter x Hunter 
    { id: 'hxh_chrollo', path: 'hunterxhunter/chrollo.jpg', tags: ['HXH'] },
    { id: 'hxh_gon', path: 'hunterxhunter/gon.jpg', tags: ['HXH'] },
    { id: 'hxh_hisoka', path: 'hunterxhunter/hisoka.jpg', tags: ['HXH'] },
    { id: 'hxh_killua', path: 'hunterxhunter/killua.jpg', tags: ['HXH'] },
    { id: 'hxh_kurapika', path: 'hunterxhunter/kurapika.jpg', tags: ['HXH'] },

    // One Piece
    { id: 'op_brook', path: 'onepiece/brook.jpg', tags: ['OnePiece'] },
    { id: 'op_chopper', path: 'onepiece/chopper.jpg', tags: ['OnePiece'] },
    { id: 'op_franky', path: 'onepiece/franky.jpg', tags: ['OnePiece'] },
    { id: 'op_jinbei', path: 'onepiece/jinbei.jpg', tags: ['OnePiece'] },
    { id: 'op_luffy', path: 'onepiece/luffy.jpg', tags: ['OnePiece'] },
    { id: 'op_nami', path: 'onepiece/nami.jpg', tags: ['OnePiece'] },
    { id: 'op_robin', path: 'onepiece/robin.jpg', tags: ['OnePiece'] },
    { id: 'op_sanji', path: 'onepiece/sanji.jpg', tags: ['OnePiece'] },
    { id: 'op_zoro', path: 'onepiece/zoro.jpg', tags: ['OnePiece'] },

    // ... (Add more mappings as files become available or mock them for UI demo)
];

// Helper to get all categories
export const getAllCategories = (): AvatarCategory[] => {
    // Collect unique tags
    const tags = new Set<AvatarCategory>();
    AVATAR_DATA.forEach(item => item.tags.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
};

export const getRandomAvatar = () => {
    const randomItem = AVATAR_DATA[Math.floor(Math.random() * AVATAR_DATA.length)];
    return `/avatars/${randomItem.path}`;
};

export const getAvatarsByCategory = (category: AvatarCategory | 'All'): AvatarItem[] => {
    if (category === 'All') return AVATAR_DATA;
    return AVATAR_DATA.filter(item => item.tags.includes(category));
};

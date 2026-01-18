export const AVATAR_FILES = [
    // Frieren
    'frieren/fern.jpg',
    'frieren/frieren.jpg',
    'frieren/stark.jpg',
    'frieren/ubel.jpg',

    // Genshin
    'genshin/baizhu.jpg',
    'genshin/beidou.jpg',
    'genshin/chichi.jpg',
    'genshin/childe.jpg',
    'genshin/eula.jpg',
    'genshin/hutao.jpg',
    'genshin/keqing.jpg',
    'genshin/lumine.jpg',
    'genshin/paimon.jpg',
    'genshin/thoma.jpg',
    'genshin/xiangling.jpg',
    'genshin/zhongli.jpg',

    // Hunter x Hunter
    'hunterxhunter/chrollo.jpg',
    'hunterxhunter/gon.jpg',
    'hunterxhunter/hisoka.jpg',
    'hunterxhunter/killua.jpg',
    'hunterxhunter/kurapika.jpg',

    // One Piece
    'onepiece/brook.jpg',
    'onepiece/chopper.jpg',
    'onepiece/franky.jpg',
    'onepiece/jinbei.jpg',
    'onepiece/luffy.jpg',
    'onepiece/nami.jpg',
    'onepiece/robin.jpg',
    'onepiece/sanji.jpg',
    'onepiece/zoro.jpg'
];

export const getRandomAvatar = () => {
    const randomFile = AVATAR_FILES[Math.floor(Math.random() * AVATAR_FILES.length)];
    return `/avatars/${randomFile}`; // served from public/avatars
};

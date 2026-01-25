const axios = require('axios');

const BASE = 'https://mangakatana.com';
const patterns = [
    '/manga-list',
    '/manga',
    '/az-list',
    '/alpha/A',
    '/manga/A',
    '/manga/all',
    '/list/A',
    '/directory',
    '/pages/manga-list',
    '/?filter=1' // sometimes filter params on home
];

async function probe() {
    for (const p of patterns) {
        try {
            const url = `${BASE}${p}`;
            console.log(`Probing: ${url}`);
            const res = await axios.head(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                },
                validateStatus: null
            });
            console.log(` => Status: ${res.status}`);
            if (res.status === 200) {
                // Double check if it's just the homepage (sometimes 200 means soft 404 or redirect to home)
                // But head request might not show content. A 200 is promising.
            }
        } catch (e) {
            console.log(` => Error: ${e.message}`);
        }
    }
}

probe();

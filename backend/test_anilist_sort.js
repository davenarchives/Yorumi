const axios = require('axios');

async function test() {
    const url = 'https://graphql.anilist.co';
    const query = `
        query ($page: Int) {
            Page(page: $page, perPage: 50) {
                media(type: MANGA, sort: TITLE_ROMAJI, isAdult: false) {
                    title {
                        romaji
                    }
                }
            }
        }
    `;

    try {
        // Check Page 1 (Start of A?)
        console.log('Fetching Page 1...');
        let res = await axios.post(url, { query, variables: { page: 1 } });
        let first = res.data.data.Page.media[0];
        let last = res.data.data.Page.media[49];
        console.log(`Page 1: "${first.title.romaji}" ... "${last.title.romaji}"`);

        // Check Page 100 (Where are we?)
        console.log('Fetching Page 100...');
        res = await axios.post(url, { query, variables: { page: 100 } });
        first = res.data.data.Page.media[0];
        last = res.data.data.Page.media[49];
        console.log(`Page 100: "${first.title.romaji}" ... "${last.title.romaji}"`);

    } catch (e) {
        console.error('Error:', e.message);
    }
}

test();

const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
    try {
        console.log('Fetching mangakatana.com/manga-list...');
        const res = await axios.get('https://mangakatana.com/manga-list', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const $ = cheerio.load(res.data);

        console.log('Checking for A-Z links/filters on /manga-list...');
        $('a').each((i, el) => {
            const text = $(el).text().trim();
            const href = $(el).attr('href');
            if (['A', 'B', 'Z', '0-9'].includes(text) || (href && href.includes('alpha'))) {
                console.log(`Found link: [${text}] -> ${href}`);
            }
        });

        // Check for sorting
        $('.filter_group a, .sort_group a').each((i, el) => {
            console.log(`Filter/Sort link: [${$(el).text().trim()}] -> ${$(el).attr('href')}`);
        });

    } catch (e) {
        console.error('Error:', e.message);
    }
}

test();

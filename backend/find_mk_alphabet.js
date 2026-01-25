const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
    try {
        console.log('Fetching mangakatana.com homepage...');
        const res = await axios.get('https://mangakatana.com', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const $ = cheerio.load(res.data);

        console.log('Searching for alphabet links...');
        $('a').each((i, el) => {
            const text = $(el).text().trim();
            const href = $(el).attr('href');

            // Look for single letters or "0-9"
            if (/^[A-Z]$/.test(text) || text === '0-9' || text === '#') {
                console.log(`Found alphabet link: [${text}] -> ${href}`);
            }

            if (href && (href.includes('az') || href.includes('list') || href.includes('directory'))) {
                console.log(`Found list link: [${text}] -> ${href}`);
            }
        });

    } catch (e) {
        console.error('Error:', e.message);
    }
}

test();

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

        console.log('Finding navigation links...');
        $('ul.nav li a, div.menu a').each((i, el) => {
            console.log(`Nav: [${$(el).text().trim()}] -> ${$(el).attr('href')}`);
        });

        // Check for specific manga listing pattern
        console.log('Checking for any link containing "list" or "directory" or "alpha"...');
        $('a').each((i, el) => {
            const href = $(el).attr('href');
            if (href && (href.includes('list') || href.includes('directory') || href.includes('alpha'))) {
                console.log(`Match: [${$(el).text().trim()}] -> ${href}`);
            }
        });

    } catch (e) {
        console.error('Error:', e.message);
    }
}

test();

const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
    try {
        console.log('Searching "A" on mangakatana...');
        const res = await axios.get('https://mangakatana.com/?search=A&search_by=book_name', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const $ = cheerio.load(res.data);

        console.log('Results:');
        $('#book_list .item .title a').each((i, el) => {
            if (i < 5) console.log(` - ${$(el).text().trim()}`);
            if (i === 5) console.log(' ...');
        });

        console.log('Total found:', $('.uk-pagination').length ? 'Pagination exists' : 'No pagination');

    } catch (e) {
        console.error('Error:', e.message);
    }
}

test();

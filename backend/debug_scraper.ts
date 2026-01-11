
import * as asura from './src/scraper/asura';

async function test() {
    console.log('Testing Asura Search...');
    const results = await asura.searchManga('The Greatest Estate Developer');
    console.log('Results:', results);

    if (results.length > 0) {
        const first = results[0];
        console.log(`Getting chapters for: ${first.id} (${first.title})`);
        const chapters = await asura.getChapterList(first.id);
        console.log(`Found ${chapters.length} chapters.`);
        if (chapters.length > 0) {
            console.log('First chapter:', chapters[0]);
            console.log('Last chapter:', chapters[chapters.length - 1]);
        }
    } else {
        console.log('No results found.');
    }
}

test().catch(console.error);

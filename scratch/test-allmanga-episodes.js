const LATEST_UPDATES_GQL = `query($search:SearchInput $limit:Int $page:Int $translationType:VaildTranslationTypeEnumType $countryOrigin:VaildCountryOriginEnumType){shows(search:$search limit:$limit page:$page translationType:$translationType countryOrigin:$countryOrigin){edges{_id name englishName season availableEpisodes episodeCount lastEpisodeInfo}}}`;

const EPISODE_INFOS_GQL = `query($showId:String! $episodeNumStart:Float! $episodeNumEnd:Float!){episodeInfos(showId:$showId episodeNumStart:$episodeNumStart episodeNumEnd:$episodeNumEnd){_id notes description thumbnails uploadDates episodeIdNum vidInforssub vidInforsdub}}`;

const SHOW_GQL = `query($_id:String!){show(_id:$_id){_id name englishName type status season availableEpisodes availableEpisodesDetail lastEpisodeInfo episodeCount genres}}`;

async function test() {
    const res = await fetch('https://api.mkissa.net/api', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Referer': 'https://mkissa.to',
            'Origin': 'https://mkissa.to'
        },
        body: JSON.stringify({
            query: LATEST_UPDATES_GQL,
            variables: {
                search: {
                    sortBy: 'Latest_Update',
                    sortDirection: 'DSC',
                    allowAdult: true,
                    allowUnknown: false,
                },
                limit: 20,
                page: 1,
                translationType: 'sub',
                countryOrigin: 'ALL',
            }
        })
    });
    const json = await res.json();
    const shows = json.data?.shows?.edges || [];
    console.log('Latest shows:');
    for (const s of shows.slice(0, 10)) {
        console.log(`- [${s._id}] ${s.englishName || s.name} | avail:`, JSON.stringify(s.availableEpisodes));
    }

    // Search for Polar Opposites or season 2
    const polar = shows.find(s => (s.englishName || s.name || '').toLowerCase().includes('polar') || (s.englishName || s.name || '').toLowerCase().includes('seihantai') || (s.englishName || s.name || '').toLowerCase().includes('season 2'));
    const targetId = polar ? polar._id : shows[0]?._id;
    const targetName = polar ? (polar.englishName || polar.name) : (shows[0]?.englishName || shows[0]?.name);
    console.log(`\nTesting episodes for target: [${targetId}] ${targetName}`);

    // Query show details with availableEpisodesDetail
    const showRes = await fetch('https://api.mkissa.net/api', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Referer': 'https://mkissa.to',
            'Origin': 'https://mkissa.to'
        },
        body: JSON.stringify({
            query: SHOW_GQL,
            variables: { _id: targetId }
        })
    });
    const showJson = await showRes.json();
    console.log('Show detail availableEpisodes:', showJson.data?.show?.availableEpisodes);
    console.log('Show detail availableEpisodesDetail:', showJson.data?.show?.availableEpisodesDetail);

    // Query episodeInfos(0, 9999)
    const epRes = await fetch('https://api.mkissa.net/api', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Referer': 'https://mkissa.to',
            'Origin': 'https://mkissa.to'
        },
        body: JSON.stringify({
            query: EPISODE_INFOS_GQL,
            variables: { showId: targetId, episodeNumStart: 0, episodeNumEnd: 9999 }
        })
    });
    const epJson = await epRes.json();
    const infos = epJson.data?.episodeInfos || [];
    console.log(`Fetched ${infos.length} episodeInfos (0..9999):`);
    console.log('episodeIdNums:', infos.map(i => i.episodeIdNum));
}

test().catch(console.error);

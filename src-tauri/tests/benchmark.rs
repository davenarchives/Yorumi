use std::time::Instant;

#[test]
fn test_parsing_benchmark() {
    let sample_html = r#"
    <div id="book_list">
        <div class="item">
            <h3 class="title"><a href="/manga/one-piece.123">One Piece</a></h3>
            <div class="media"><div class="wrap_img"><img data-src="https://img.mangakatana.com/op.jpg"/></div></div>
            <div class="text"><div class="chapter"><a href="/manga/one-piece.123/c1100">Chapter 1100</a></div></div>
        </div>
        <div class="item">
            <h3 class="title"><a href="/manga/jujutsu-kaisen.456">Jujutsu Kaisen</a></h3>
            <div class="media"><div class="wrap_img"><img data-src="https://img.mangakatana.com/jjk.jpg"/></div></div>
            <div class="text"><div class="chapter"><a href="/manga/jujutsu-kaisen.456/c260">Chapter 260</a></div></div>
        </div>
    </div>
    "#;

    let start = Instant::now();
    for _ in 0..100 {
        let doc = scraper::Html::parse_document(sample_html);
        let sel = scraper::Selector::parse(".item .title a").unwrap();
        let titles: Vec<String> = doc.select(&sel).map(|e| e.text().collect()).collect();
        assert_eq!(titles.len(), 2);
    }
    let elapsed = start.elapsed();
    println!("100 HTML parse iterations took: {:?}", elapsed);
    assert!(elapsed.as_millis() < 500, "Parsing took too long: {:?}", elapsed);
}


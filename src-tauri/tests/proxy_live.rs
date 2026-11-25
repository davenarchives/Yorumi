//! Live end-to-end check of the `yorumi-media` proxy against the real Zoko/HiAnime chain.
//! Run with: cargo test --manifest-path src-tauri/Cargo.toml --test proxy_live -- --nocapture

use yorumi_lib::media::protocol::proxy_request;
use yorumi_lib::scrapers::ScraperClient;

fn proxy_uri(url: &str, referer: &str) -> String {
    format!(
        "http://yorumi-media.localhost/stream?url={}&referer={}",
        urlencoding::encode(url),
        urlencoding::encode(referer)
    )
}

#[tokio::test]
async fn zoko_embed_to_m3u8_through_proxy() {
    let client = ScraperClient::new().client().clone();

    // 1. Embed page via proxy (same call getText() makes in the webview)
    let embed = "https://zokoanime.video/stream/mal/21/1/sub";
    let res = proxy_request(client.clone(), proxy_uri(embed, "https://hianime.at"), None).await;
    println!("embed status: {}", res.status());
    let html = String::from_utf8_lossy(res.body()).to_string();
    assert!(res.status().is_success(), "embed fetch failed: {}", &html[..html.len().min(200)]);
    assert!(html.contains("__P"), "embed page has no __P payload");

    // 2. Decode payload
    let start = html.find("window.__P").unwrap();
    let rest = &html[start..];
    let q = rest.find(|c| c == '"' || c == '\'').unwrap();
    let rest = &rest[q + 1..];
    let end = rest.find(|c| c == '"' || c == '\'').unwrap();
    let b64 = &rest[..end];
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD.decode(b64).unwrap();
    let key = b"otaku-embed-v1";
    let decoded: Vec<u8> = bytes.iter().enumerate().map(|(i, b)| b ^ key[i % key.len()]).collect();
    let json: serde_json::Value = serde_json::from_slice(&decoded).unwrap();
    let src = json["src"].as_str().unwrap().to_string();
    println!("m3u8 src: {}", src);

    // 3. Master manifest through proxy
    let res = proxy_request(client.clone(), proxy_uri(&src, "https://zokoanime.video/"), None).await;
    println!("master status: {} ct: {:?}", res.status(), res.headers().get("content-type"));
    let master = String::from_utf8_lossy(res.body()).to_string();
    println!("master rewritten:\n{}", master);
    assert!(res.status().is_success());
    let variant_line = master.lines().find(|l| l.starts_with("http")).expect("no rewritten variant");

    // 4. Variant playlist via the rewritten proxy link
    let res = proxy_request(client.clone(), variant_line.to_string(), None).await;
    println!("variant status: {}", res.status());
    let variant = String::from_utf8_lossy(res.body()).to_string();
    assert!(res.status().is_success(), "variant failed: {}", &variant[..variant.len().min(200)]);
    let seg_line = variant.lines().find(|l| l.starts_with("http")).expect("no rewritten segment");

    // 5. First segment
    let res = proxy_request(client.clone(), seg_line.to_string(), None).await;
    println!(
        "segment status: {} ct: {:?} len: {} first byte: {:?}",
        res.status(),
        res.headers().get("content-type"),
        res.body().len(),
        res.body().first()
    );
    assert!(res.status().is_success());
    assert_eq!(res.body().first(), Some(&0x47u8), "segment is not MPEG-TS");
}


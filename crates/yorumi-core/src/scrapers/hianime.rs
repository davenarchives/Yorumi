use std::sync::Arc;
use async_trait::async_trait;
use base64::Engine;
use regex::Regex;
use scraper::{Html, Selector};
use serde::Deserialize;
use url::Url;

use crate::scrapers::client::ScraperClient;
use crate::scrapers::error::ScraperError;
use crate::scrapers::traits::AnimeProvider;
use crate::scrapers::types::{AnimeSearchResult, Episode, StreamLink, SubtitleTrack};

const HIANIME_BASE: &str = "https://hianime.at";
const DEOBFUSCATION_KEY: &[u8] = b"otaku-embed-v1";

#[derive(Debug, Deserialize)]
struct AjaxHtmlResponse {
    html: Option<String>,
}

#[derive(Debug, Deserialize)]
struct EmbedPayload {
    src: Option<String>,
    subtitles: Option<Vec<EmbedSubtitle>>,
}

#[derive(Debug, Deserialize)]
struct EmbedSubtitle {
    src: Option<String>,
    lang: Option<String>,
    label: Option<String>,
    default: Option<bool>,
}

pub struct HiAnimeScraper {
    client: Arc<ScraperClient>,
}

impl HiAnimeScraper {
    pub fn new(client: Arc<ScraperClient>) -> Self {
        Self { client }
    }

    pub fn deobfuscate_blob(blob: &str) -> Option<String> {
        let bytes = base64::engine::general_purpose::STANDARD.decode(blob.trim()).ok()?;
        let mut output = Vec::with_capacity(bytes.len());
        for (i, b) in bytes.iter().enumerate() {
            output.push(b ^ DEOBFUSCATION_KEY[i % DEOBFUSCATION_KEY.len()]);
        }
        String::from_utf8(output).ok()
    }
}

#[async_trait]
impl AnimeProvider for HiAnimeScraper {
    fn id(&self) -> &'static str {
        "hianime"
    }

    fn name(&self) -> &'static str {
        "HiAnime"
    }

    async fn search(&self, query: &str) -> Result<Vec<AnimeSearchResult>, ScraperError> {
        let encoded_query = urlencoding::encode(query.trim());
        let search_url = format!("{}/search?keyword={}", HIANIME_BASE, encoded_query);
        let html_content = self.client.get_html(&search_url, Some(HIANIME_BASE)).await?;

        let results = {
            let document = Html::parse_document(&html_content);
            let item_selector = Selector::parse(".film-detail").map_err(|e| ScraperError::Parse(e.to_string()))?;
            let name_selector = Selector::parse(".film-name a").map_err(|e| ScraperError::Parse(e.to_string()))?;
            let poster_selector = Selector::parse(".film-poster img").map_err(|e| ScraperError::Parse(e.to_string()))?;
            let tick_eps_selector = Selector::parse(".tick-eps").map_err(|e| ScraperError::Parse(e.to_string()))?;
            let tick_sub_selector = Selector::parse(".tick-sub").map_err(|e| ScraperError::Parse(e.to_string()))?;
            let tick_dub_selector = Selector::parse(".tick-dub").map_err(|e| ScraperError::Parse(e.to_string()))?;

            let mut items = Vec::new();

            for element in document.select(&item_selector) {
                let Some(name_elem) = element.select(&name_selector).next() else {
                    continue;
                };

                let title = name_elem.text().collect::<String>().trim().to_string();
                let href = name_elem.value().attr("href").unwrap_or_default();
                let clean_href = href.trim_start_matches('/').trim_start_matches("https://hianime.at/").to_string();
                
                // Extract anime ID from slug ending e.g. "attack-on-titan-112" -> "112"
                let id = clean_href.rsplit('-').next().unwrap_or("").to_string();
                if id.is_empty() || !id.chars().all(|c| c.is_ascii_digit()) {
                    continue;
                }

                let poster = element.parent().and_then(|p| {
                    if let Some(parent_elem) = scraper::ElementRef::wrap(p) {
                        parent_elem.select(&poster_selector).next().and_then(|img| {
                            img.value().attr("data-src").or_else(|| img.value().attr("src")).map(|s| s.to_string())
                        })
                    } else {
                        None
                    }
                });

                let episodes = element.select(&tick_eps_selector).next().and_then(|e| {
                    e.text().collect::<String>().trim().parse::<u32>().ok()
                });

                let sub = element.select(&tick_sub_selector).next().and_then(|e| {
                    e.text().collect::<String>().trim().parse::<u32>().ok()
                });

                let dub = element.select(&tick_dub_selector).next().and_then(|e| {
                    e.text().collect::<String>().trim().parse::<u32>().ok()
                });

                items.push(AnimeSearchResult {
                    id: id.clone(),
                    title,
                    url: format!("{}/{}", HIANIME_BASE, clean_href),
                    poster,
                    status: None,
                    r#type: None,
                    episodes,
                    sub,
                    dub,
                    year: None,
                    score: None,
                    session: format!("hianime:{}", id),
                });
            }

            items
        };

        Ok(results)
    }

    async fn get_episodes(&self, anime_id: &str) -> Result<Vec<Episode>, ScraperError> {
        let ep_list_url = format!("{}/api/theme/episode/list/{}", HIANIME_BASE, anime_id);
        let json_data: Result<AjaxHtmlResponse, _> = self.client.get_json(&ep_list_url, Some(HIANIME_BASE)).await;
        
        let html_string = match json_data {
            Ok(res) => res.html.unwrap_or_default(),
            Err(_) => self.client.get_html(&ep_list_url, Some(HIANIME_BASE)).await?,
        };

        let episodes = {
            let fragment = Html::parse_fragment(&html_string);
            let ep_item_selector = Selector::parse(".ep-item").map_err(|e| ScraperError::Parse(e.to_string()))?;

            let mut eps = Vec::new();

            for el in fragment.select(&ep_item_selector) {
                let num_str = el.value().attr("data-number").unwrap_or_default();
                let ep_id = el.value().attr("data-id").unwrap_or_default();
                let title = el.value().attr("title").map(|s| s.to_string()).unwrap_or_else(|| format!("Episode {}", num_str));
                let ep_num = num_str.parse::<f32>().unwrap_or(0.0) as u32;

                if !ep_id.is_empty() && ep_num > 0 {
                    eps.push(Episode {
                        id: ep_id.to_string(),
                        episode_number: ep_num,
                        url: format!("{}/watch?ep={}", HIANIME_BASE, ep_id),
                        title: Some(title),
                        duration: None,
                        date: None,
                        snapshot: None,
                        session: format!("hianime:ep:{}", ep_id),
                        is_subbed: Some(true),
                        is_dubbed: None,
                        is_filler: None,
                    });
                }
            }

            eps
        };

        Ok(episodes)
    }

    async fn get_streams(&self, episode_id: &str, _server: Option<&str>) -> Result<Vec<StreamLink>, ScraperError> {
        let servers_url = format!("{}/api/theme/episode/servers?episodeId={}", HIANIME_BASE, episode_id);
        let referer = format!("{}/watch?ep={}", HIANIME_BASE, episode_id);
        
        let json_data: Result<AjaxHtmlResponse, _> = self.client.get_json(&servers_url, Some(&referer)).await;
        let html_string = match json_data {
            Ok(res) => res.html.unwrap_or_default(),
            Err(_) => self.client.get_html(&servers_url, Some(&referer)).await?,
        };

        let (sub_hash, dub_hash) = {
            let fragment = Html::parse_fragment(&html_string);
            let server_item_selector = Selector::parse(".server-item").map_err(|e| ScraperError::Parse(e.to_string()))?;

            let mut sub = None;
            let mut dub = None;

            for el in fragment.select(&server_item_selector) {
                let server_type = el.value().attr("data-type").unwrap_or_default();
                let server_name = el.value().attr("data-server-name").unwrap_or_default();
                let hash = el.value().attr("data-hash").unwrap_or_default();

                if hash.is_empty() {
                    continue;
                }

                if server_type == "sub" {
                    if server_name.contains("Zoko") || sub.is_none() {
                        sub = Some(hash.to_string());
                    }
                } else if server_type == "dub" {
                    if server_name.contains("Zoko") || dub.is_none() {
                        dub = Some(hash.to_string());
                    }
                }
            }

            (sub, dub)
        };

        let mut streams = Vec::new();

        // Process SUB embed
        if let Some(hash) = sub_hash {
            if let Ok(embed_url_bytes) = base64::engine::general_purpose::STANDARD.decode(hash) {
                if let Ok(embed_url) = String::from_utf8(embed_url_bytes) {
                    if let Ok(Some(stream)) = self.resolve_embed(&embed_url, "sub").await {
                        streams.push(stream);
                    }
                }
            }
        }

        // Process DUB embed
        if let Some(hash) = dub_hash {
            if let Ok(embed_url_bytes) = base64::engine::general_purpose::STANDARD.decode(hash) {
                if let Ok(embed_url) = String::from_utf8(embed_url_bytes) {
                    if let Ok(Some(stream)) = self.resolve_embed(&embed_url, "dub").await {
                        streams.push(stream);
                    }
                }
            }
        }

        Ok(streams)
    }
}

impl HiAnimeScraper {
    async fn resolve_embed(&self, embed_url: &str, audio: &str) -> Result<Option<StreamLink>, ScraperError> {
        let origin = match Url::parse(embed_url) {
            Ok(u) => format!("{}://{}/", u.scheme(), u.host_str().unwrap_or("")),
            Err(_) => HIANIME_BASE.to_string(),
        };

        let embed_html = self.client.get_html(embed_url, Some(HIANIME_BASE)).await?;

        // Extract window.__P = "..."
        let re = Regex::new(r#"window\.__P\s*=\s*["']([^"']+)["']"#).map_err(|e| ScraperError::Parse(e.to_string()))?;
        let Some(captures) = re.captures(&embed_html) else {
            return Ok(None);
        };

        let blob = captures.get(1).map(|m| m.as_str()).unwrap_or_default();
        let Some(decrypted_json_str) = Self::deobfuscate_blob(blob) else {
            return Ok(None);
        };

        let payload: EmbedPayload = serde_json::from_str(&decrypted_json_str)
            .map_err(|e| ScraperError::Parse(format!("Failed to parse embed JSON: {}", e)))?;

        let Some(m3u8_url) = payload.src else {
            return Ok(None);
        };

        let mut subtitles = Vec::new();
        if let Some(subs) = payload.subtitles {
            for sub in subs {
                if let Some(src) = sub.src {
                    let lang = sub.lang.or(sub.label).unwrap_or_else(|| "English".to_string());
                    subtitles.push(SubtitleTrack {
                        url: src,
                        lang,
                        default: sub.default.unwrap_or(false),
                    });
                }
            }
        }

        Ok(Some(StreamLink {
            quality: "auto".to_string(),
            audio: audio.to_string(),
            provider: Some("hianime".to_string()),
            server: Some("Megacloud".to_string()),
            url: m3u8_url,
            direct_url: None,
            referer: Some(origin),
            cookie: None,
            audio_language: Some(if audio == "dub" { "en".to_string() } else { "ja".to_string() }),
            is_hls: true,
            subtitles: Some(subtitles),
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_deobfuscation() {
        let original = r#"{"src":"https://example.com/master.m3u8"}"#;
        let mut xored = Vec::new();
        for (i, b) in original.bytes().enumerate() {
            xored.push(b ^ DEOBFUSCATION_KEY[i % DEOBFUSCATION_KEY.len()]);
        }
        let blob = base64::engine::general_purpose::STANDARD.encode(&xored);
        let decrypted = HiAnimeScraper::deobfuscate_blob(&blob).expect("Failed to decrypt");
        assert_eq!(decrypted, original);
    }
}


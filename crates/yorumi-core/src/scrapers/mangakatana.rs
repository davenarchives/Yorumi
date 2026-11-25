use std::sync::Arc;
use async_trait::async_trait;
use regex::Regex;
use scraper::{Html, Selector};
use url::Url;

use crate::scrapers::client::ScraperClient;
use crate::scrapers::error::ScraperError;
use crate::scrapers::traits::MangaProvider;
use crate::scrapers::types::{ChapterPage, MangaChapter, MangaSearchResult};

const BASE_URL: &str = "https://mangakatana.com";

pub struct MangaKatanaScraper {
    client: Arc<ScraperClient>,
}

impl MangaKatanaScraper {
    pub fn new(client: Arc<ScraperClient>) -> Self {
        Self { client }
    }

    fn normalize_manga_id(input: &str) -> String {
        let mut value = input.trim();
        if let Some(stripped) = value.strip_prefix("mk:") {
            value = stripped;
        }

        let parsed_path;
        if value.starts_with("http://") || value.starts_with("https://") {
            if let Ok(parsed) = Url::parse(value) {
                parsed_path = parsed.path().to_string();
                value = &parsed_path;
            }
        }

        if let Some(idx) = value.find("/manga/") {
            value = &value[idx + "/manga/".len()..];
        } else if let Some(stripped) = value.strip_prefix("manga/") {
            value = stripped;
        }

        let cleaned = value.trim_matches('/');
        let no_query = cleaned.split('?').next().unwrap_or(cleaned);
        let no_hash = no_query.split('#').next().unwrap_or(no_query);
        no_hash.split('/').next().unwrap_or(no_hash).to_string()
    }

    fn to_absolute_url(url: &str) -> String {
        let trimmed = url.trim();
        if trimmed.is_empty() {
            return String::new();
        }
        if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
            return trimmed.to_string();
        }
        if let Some(stripped) = trimmed.strip_prefix("//") {
            return format!("https:{}", stripped);
        }
        format!("{}/{}", BASE_URL.trim_end_matches('/'), trimmed.trim_start_matches('/'))
    }

    fn parse_manga_items(html_content: &str) -> Vec<MangaSearchResult> {
        let mut results = Vec::new();
        let document = Html::parse_document(html_content);

        // Handle direct 302 redirect to a single manga detail page
        let canonical_selector = Selector::parse("link[rel=\"canonical\"]").unwrap();
        let og_url_selector = Selector::parse("meta[property=\"og:url\"]").unwrap();
        let heading_selector = Selector::parse("h1.heading").unwrap();
        let og_image_selector = Selector::parse("meta[property=\"og:image\"]").unwrap();
        let direct_chapter_selector = Selector::parse("tr .chapter a").unwrap();

        let canonical_href = document
            .select(&canonical_selector)
            .next()
            .and_then(|el| el.value().attr("href"))
            .or_else(|| {
                document
                    .select(&og_url_selector)
                    .next()
                    .and_then(|el| el.value().attr("content"))
            })
            .unwrap_or("");
        let heading_title = document
            .select(&heading_selector)
            .next()
            .map(|el| el.text().collect::<String>().trim().to_string())
            .unwrap_or_default();

        if !heading_title.is_empty() && canonical_href.contains("/manga/") {
            let abs_url = Self::to_absolute_url(canonical_href);
            let id = Self::normalize_manga_id(&abs_url);
            if !id.is_empty() {
                let cover = document
                    .select(&og_image_selector)
                    .next()
                    .and_then(|el| el.value().attr("content"))
                    .map(Self::to_absolute_url);
                let latest_chapter = document
                    .select(&direct_chapter_selector)
                    .next()
                    .map(|el| el.text().collect::<String>().trim().to_string());
                results.push(MangaSearchResult {
                    id,
                    title: heading_title,
                    url: abs_url,
                    cover,
                    latest_chapter,
                    genres: Vec::new(),
                    status: None,
                });
                return results;
            }
        }

        let item_selector = Selector::parse("#book_list .item, .item").unwrap();
        let title_selector = Selector::parse("h3.title a, div.text > h3 > a, .title a").unwrap();
        let manga_link_selector = Selector::parse("a[href*=\"/manga/\"]").unwrap();
        let img_selector = Selector::parse(".media .wrap_img img, div.cover img, img").unwrap();
        let chapter_selector = Selector::parse("div.text .chapter a, .chapter a").unwrap();

        for item in document.select(&item_selector) {
            let mut link_el = item.select(&title_selector).next();
            if link_el.is_none() {
                link_el = item.select(&manga_link_selector).find(|el| !el.text().collect::<String>().trim().is_empty());
            }

            let Some(link) = link_el else { continue };
            let title = link.text().collect::<String>().trim().to_string();
            let raw_url = link.value().attr("href").unwrap_or("").trim().to_string();

            if title.is_empty() || !raw_url.contains("/manga/") {
                continue;
            }

            let abs_url = Self::to_absolute_url(&raw_url);
            let id = Self::normalize_manga_id(&abs_url);
            if id.is_empty() || results.iter().any(|r: &MangaSearchResult| r.id == id) {
                continue;
            }

            let mut thumbnail = None;
            if let Some(img) = item.select(&img_selector).next() {
                let src = img.value().attr("data-src").or_else(|| img.value().attr("src")).unwrap_or("");
                if !src.is_empty() {
                    thumbnail = Some(Self::to_absolute_url(src));
                }
            }

            let latest_chapter = item.select(&chapter_selector).next().map(|ch| {
                ch.text().collect::<String>().trim().to_string()
            });

            results.push(MangaSearchResult {
                id,
                title,
                url: abs_url,
                cover: thumbnail,
                latest_chapter,
                genres: Vec::new(),
                status: None,
            });
        }

        results
    }
}

#[async_trait]
impl MangaProvider for MangaKatanaScraper {
    fn id(&self) -> &'static str {
        "mangakatana"
    }

    fn name(&self) -> &'static str {
        "MangaKatana"
    }

    async fn search(&self, query: &str) -> Result<Vec<MangaSearchResult>, ScraperError> {
        let clean_query = query.trim();
        if clean_query.is_empty() {
            return Ok(Vec::new());
        }

        let encoded_query = urlencoding::encode(clean_query);
        let url = format!("{}/?search={}&search_by=book_name", BASE_URL, encoded_query);

        let html = self.client.get_html(&url, None).await?;
        let results = Self::parse_manga_items(&html);
        Ok(results)
    }

    async fn get_chapters(&self, manga_id: &str) -> Result<Vec<MangaChapter>, ScraperError> {
        let normalized_id = Self::normalize_manga_id(manga_id);
        let url = format!("{}/manga/{}", BASE_URL, normalized_id);

        let html = self.client.get_html(&url, None).await?;
        let mut chapters = Vec::new();

        {
            let document = Html::parse_document(&html);
            let row_selector = Selector::parse("tr").unwrap();
            let link_selector = Selector::parse(".chapter a").unwrap();
            let date_selector = Selector::parse(".update_time").unwrap();
            let chapter_num_re = Regex::new(r"(?i)chapter\s*([\d.]+)").unwrap();

            for row in document.select(&row_selector) {
                let Some(link) = row.select(&link_selector).next() else { continue };
                let title = link.text().collect::<String>().trim().to_string();
                let raw_href = link.value().attr("href").unwrap_or("").trim();
                if raw_href.is_empty() {
                    continue;
                }

                let chapter_url = Self::to_absolute_url(raw_href);
                let chapter_id = chapter_url
                    .trim_end_matches('/')
                    .split('/')
                    .last()
                    .unwrap_or("")
                    .to_string();

                if chapter_id.is_empty() {
                    continue;
                }

                let upload_date = row.select(&date_selector).next().map(|d| {
                    d.text().collect::<String>().trim().to_string()
                });

                let chapter_number = chapter_num_re
                    .captures(&title)
                    .and_then(|caps| caps.get(1))
                    .and_then(|m| m.as_str().parse::<f32>().ok())
                    .unwrap_or_else(|| {
                        // Try from id if title lacks number
                        chapter_num_re
                            .captures(&chapter_id)
                            .and_then(|caps| caps.get(1))
                            .and_then(|m| m.as_str().parse::<f32>().ok())
                            .unwrap_or(0.0)
                    });

                chapters.push(MangaChapter {
                    id: chapter_id,
                    chapter_number,
                    title,
                    release_date: upload_date,
                });
            }
        }

        Ok(chapters)
    }

    async fn get_pages(&self, chapter_id_or_url: &str) -> Result<Vec<ChapterPage>, ScraperError> {
        let target_url = if chapter_id_or_url.starts_with("http://") || chapter_id_or_url.starts_with("https://") {
            chapter_id_or_url.to_string()
        } else if chapter_id_or_url.contains('/') {
            format!("{}/manga/{}", BASE_URL, chapter_id_or_url.trim_start_matches('/'))
        } else {
            return Err(ScraperError::InvalidInput(format!("Invalid chapter URL or path: {}", chapter_id_or_url)));
        };

        let html = self.client.get_html(&target_url, None).await?;

        // 1. Look for JavaScript array containing image URLs (e.g., var thzq = ['url1', 'url2'];)
        let var_re = Regex::new(r"(?m)var\s+(?:thzq|ytaw|htnc)\s*=\s*\[([\s\S]*?)\];").unwrap();
        let str_re = Regex::new(r#"['"]([^'"]+)['"]"#).unwrap();

        if let Some(caps) = var_re.captures(&html) {
            if let Some(content) = caps.get(1) {
                let mut pages = Vec::new();
                let mut page_number = 1;
                for url_match in str_re.captures_iter(content.as_str()) {
                    if let Some(matched_url) = url_match.get(1) {
                        let url_str = matched_url.as_str().trim();
                        if url_str.contains("http") || url_str.starts_with("//") {
                            pages.push(ChapterPage {
                                page_number,
                                image_url: Self::to_absolute_url(url_str),
                            });
                            page_number += 1;
                        }
                    }
                }
                if !pages.is_empty() {
                    return Ok(pages);
                }
            }
        }

        // 2. Fallback: Parse #imgs img elements
        let mut pages = Vec::new();
        {
            let document = Html::parse_document(&html);
            let img_selector = Selector::parse("#imgs img, .viewer img").unwrap();
            let mut page_number = 1;

            for img in document.select(&img_selector) {
                let src = img.value().attr("data-src").or_else(|| img.value().attr("src")).unwrap_or("");
                if src.contains("http") || src.starts_with("//") {
                    pages.push(ChapterPage {
                        page_number,
                        image_url: Self::to_absolute_url(src),
                    });
                    page_number += 1;
                }
            }
        }

        Ok(pages)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_manga_id() {
        assert_eq!(MangaKatanaScraper::normalize_manga_id("mk:one-piece.123"), "one-piece.123");
        assert_eq!(MangaKatanaScraper::normalize_manga_id("https://mangakatana.com/manga/one-piece.123"), "one-piece.123");
        assert_eq!(MangaKatanaScraper::normalize_manga_id("https://mangakatana.com/manga/one-piece.123/c1042"), "one-piece.123");
        assert_eq!(MangaKatanaScraper::normalize_manga_id("/manga/naruto.456/"), "naruto.456");
    }

    #[test]
    fn test_parse_pages_from_script() {
        let sample_html = r#"
        <script>
        var thzq = ['https://img.mangakatana.com/1.jpg', 'https://img.mangakatana.com/2.jpg'];
        </script>
        "#;
        let var_re = Regex::new(r"(?m)var\s+(?:thzq|ytaw|htnc)\s*=\s*\[([\s\S]*?)\];").unwrap();
        let str_re = Regex::new(r#"['"]([^'"]+)['"]"#).unwrap();
        let caps = var_re.captures(sample_html).unwrap();
        let content = caps.get(1).unwrap().as_str();
        let urls: Vec<String> = str_re.captures_iter(content).filter_map(|c| c.get(1).map(|m| m.as_str().to_string())).collect();
        assert_eq!(urls.len(), 2);
        assert_eq!(urls[0], "https://img.mangakatana.com/1.jpg");
    }
}

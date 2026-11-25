use std::sync::Arc;
use async_trait::async_trait;
use regex::Regex;
use scraper::{Html, Selector};
use serde::Deserialize;

use crate::scrapers::client::ScraperClient;
use crate::scrapers::error::ScraperError;
use crate::scrapers::traits::NovelProvider;
use crate::scrapers::types::{NovelChapter, NovelChapterContent, NovelSearchResult};

const NOVELBIN_BASE: &str = "https://novel-bin.com";

pub struct NovelBinScraper {
    client: Arc<ScraperClient>,
}

#[derive(Debug, Deserialize)]
struct AjaxChapterItem {
    index: Option<f32>,
    title: Option<String>,
    url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AjaxChapterListResponse {
    chapters: Option<Vec<AjaxChapterItem>>,
}

impl NovelBinScraper {
    pub fn new(client: Arc<ScraperClient>) -> Self {
        Self { client }
    }

    fn clean_slug(slug: &str) -> String {
        let mut s = slug.trim();
        if let Some(stripped) = s.strip_prefix("nb:") {
            s = stripped;
        }
        if let Some(stripped) = s.strip_prefix("/novel-bin/") {
            s = stripped;
        }
        if let Some(stripped) = s.strip_prefix("novel-bin/") {
            s = stripped;
        }
        s.trim_matches('/').to_string()
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
        format!("{}/{}", NOVELBIN_BASE.trim_end_matches('/'), trimmed.trim_start_matches('/'))
    }

    fn sanitize_content_html(html_str: &str) -> String {
        let document = Html::parse_fragment(html_str);
        let p_selector = Selector::parse("p").unwrap();
        let promo_re = Regex::new(r"(?i)find light novel|read novel online|translator:|editor:|novel-bin|wuxiaworld|allnovelfull").unwrap();

        let mut paragraphs = Vec::new();
        for p in document.select(&p_selector) {
            let inner_text = p.text().collect::<String>().trim().to_string();
            if inner_text.is_empty() {
                continue;
            }
            if inner_text.len() < 140 && promo_re.is_match(&inner_text) {
                continue;
            }
            let inner_html = p.inner_html().trim().to_string();
            paragraphs.push(format!("<p>{}</p>", inner_html));
        }

        if paragraphs.is_empty() {
            // If no <p> tags, split by double newlines
            html_str.split("\n\n")
                .map(|s| s.trim())
                .filter(|s| !s.is_empty())
                .map(|s| format!("<p>{}</p>", s))
                .collect::<Vec<_>>()
                .join("\n")
        } else {
            paragraphs.join("\n")
        }
    }
}

#[async_trait]
impl NovelProvider for NovelBinScraper {
    fn id(&self) -> &'static str {
        "novelbin"
    }

    fn name(&self) -> &'static str {
        "NovelBin"
    }

    async fn search(&self, query: &str) -> Result<Vec<NovelSearchResult>, ScraperError> {
        let clean_query = query.trim();
        if clean_query.is_empty() {
            return Ok(Vec::new());
        }

        let encoded = urlencoding::encode(clean_query);
        let url = format!("{}/search?keyword={}", NOVELBIN_BASE, encoded);
        let html = self.client.get_html(&url, None).await?;

        let mut results = Vec::new();
        let mut seen_ids = std::collections::HashSet::new();

        {
            let document = Html::parse_document(&html);
            let card_selector = Selector::parse(".list-novel .row, a.almanac-book-row, .novel-title a").unwrap();
            let title_selector = Selector::parse(".novel-title a, h3 a, h3").unwrap();
            let img_selector = Selector::parse("img").unwrap();

            for el in document.select(&card_selector) {
                let href = if el.value().name() == "a" {
                    el.value().attr("href").unwrap_or("")
                } else {
                    el.select(&title_selector)
                        .next()
                        .and_then(|a| a.value().attr("href"))
                        .unwrap_or("")
                };

                if href.is_empty() || !href.contains("/novel-bin/") || href.contains("/genre/") || href.contains("/author/") {
                    continue;
                }

                let clean_href = href.trim_matches('/');
                let slug = clean_href
                    .split("/novel-bin/")
                    .last()
                    .unwrap_or("")
                    .trim_matches('/');

                if slug.is_empty() || slug.contains("chapter") || slug == "search" {
                    continue;
                }

                let id = format!("nb:{}", slug);
                if seen_ids.contains(&id) {
                    continue;
                }
                seen_ids.insert(id.clone());

                let title = el.select(&title_selector)
                    .next()
                    .map(|t| t.text().collect::<String>().trim().to_string())
                    .or_else(|| el.value().attr("title").map(|t| t.trim().to_string()))
                    .unwrap_or_else(|| slug.replace('-', " "));

                if title.is_empty() {
                    continue;
                }

                let cover = el.select(&img_selector)
                    .next()
                    .and_then(|img| {
                        img.value().attr("src")
                            .or_else(|| img.value().attr("data-src"))
                    })
                    .map(|c| Self::to_absolute_url(c));

                results.push(NovelSearchResult {
                    id,
                    title,
                    url: Self::to_absolute_url(href),
                    cover,
                    author: None,
                    latest_chapter: None,
                });
            }
        }

        Ok(results)
    }

    async fn get_chapters(&self, novel_id: &str) -> Result<Vec<NovelChapter>, ScraperError> {
        let clean_slug = Self::clean_slug(novel_id);
        let ajax_url = format!("{}/ajax/chapter-list?slug={}", NOVELBIN_BASE, clean_slug);

        // 1. Try AJAX chapter list
        if let Ok(response) = self.client.get_json::<AjaxChapterListResponse>(&ajax_url, None).await {
            if let Some(chapters) = response.chapters {
                if !chapters.is_empty() {
                    let mut list = Vec::new();
                    let mut seen_ids = std::collections::HashSet::new();

                    for (i, ch) in chapters.into_iter().enumerate() {
                        let ch_url = ch.url.unwrap_or_default();
                        let ch_slug = Self::clean_slug(&ch_url);
                        if ch_slug.is_empty() || seen_ids.contains(&ch_slug) {
                            continue;
                        }
                        seen_ids.insert(ch_slug.clone());

                        let ch_id = format!("nb:{}", ch_slug);
                        let number = ch.index.unwrap_or((i + 1) as f32);
                        let title = ch.title.unwrap_or_else(|| format!("Chapter {}", number));

                        list.push(NovelChapter {
                            id: ch_id,
                            chapter_number: number,
                            title,
                        });
                    }

                    if !list.is_empty() {
                        return Ok(list);
                    }
                }
            }
        }

        // 2. Fallback: Parse HTML from novel detail page
        let target_url = format!("{}/novel-bin/{}/", NOVELBIN_BASE, clean_slug);
        let html = self.client.get_html(&target_url, None).await?;

        let mut list = Vec::new();
        {
            let document = Html::parse_document(&html);
            let link_selector = Selector::parse("a[href*=\"/chapter-\"], a[href*=\"/novel-bin/\"]").unwrap();
            let chapter_re = Regex::new(r"(?i)chapter-([\d.]+)").unwrap();
            let mut seen_ids = std::collections::HashSet::new();
            let mut count = 1.0f32;

            for link in document.select(&link_selector) {
                let href = link.value().attr("href").unwrap_or("");
                if !href.contains("/chapter-") {
                    continue;
                }

                let ch_slug = Self::clean_slug(href);
                if !ch_slug.starts_with(&format!("{}/chapter-", clean_slug)) || seen_ids.contains(&ch_slug) {
                    continue;
                }
                seen_ids.insert(ch_slug.clone());

                let title = link.text().collect::<String>().trim().to_string();
                let number = chapter_re
                    .captures(&ch_slug)
                    .and_then(|c| c.get(1))
                    .and_then(|m| m.as_str().parse::<f32>().ok())
                    .unwrap_or(count);

                list.push(NovelChapter {
                    id: format!("nb:{}", ch_slug),
                    chapter_number: number,
                    title: if title.is_empty() { format!("Chapter {}", number) } else { title },
                });
                count += 1.0;
            }
        }

        Ok(list)
    }

    async fn get_content(&self, chapter_id_or_url: &str) -> Result<NovelChapterContent, ScraperError> {
        let clean_slug = Self::clean_slug(chapter_id_or_url);
        let target_url = format!("{}/novel-bin/{}", NOVELBIN_BASE, clean_slug);
        let html = self.client.get_html(&target_url, None).await?;

        let chapter_re = Regex::new(r"(?i)chapter-([\d.]+)").unwrap();
        let chapter_number = chapter_re
            .captures(&clean_slug)
            .and_then(|c| c.get(1))
            .and_then(|m| m.as_str().parse::<f32>().ok())
            .unwrap_or(1.0);

        let novel_id = clean_slug.split("/chapter-").next().unwrap_or("").to_string();

        let (title, raw_content, prev_chapter_id, next_chapter_id) = {
            let document = Html::parse_document(&html);
            let title_selector = Selector::parse("#chapter h1, main h1, .chr-title, .chapter-title, h1").unwrap();
            let title = document.select(&title_selector)
                .next()
                .map(|t| t.text().collect::<String>().trim().to_string())
                .unwrap_or_else(|| format!("Chapter {}", chapter_number));

            let content_selector = Selector::parse("#chr-content, .chr-c, .reading-content, #chapter-content, .chapter-content").unwrap();
            let raw_content = document.select(&content_selector)
                .next()
                .map(|c| c.inner_html())
                .unwrap_or_default();

            let prev_selector = Selector::parse("#prev_chap, a.btn-prev, a[class*=\"prev\"]").unwrap();
            let prev_id = document.select(&prev_selector)
                .next()
                .and_then(|a| a.value().attr("href"))
                .filter(|href| !href.contains("javascript:"))
                .map(|href| format!("nb:{}", Self::clean_slug(href)));

            let next_selector = Selector::parse("#next_chap, a.btn-next, a[class*=\"next\"]").unwrap();
            let next_id = document.select(&next_selector)
                .next()
                .and_then(|a| a.value().attr("href"))
                .filter(|href| !href.contains("javascript:"))
                .map(|href| format!("nb:{}", Self::clean_slug(href)));

            (title, raw_content, prev_id, next_id)
        };

        let sanitized = Self::sanitize_content_html(&raw_content);

        Ok(NovelChapterContent {
            id: format!("nb:{}", clean_slug),
            novel_id,
            title,
            chapter_number,
            content: sanitized,
            prev_chapter_id,
            next_chapter_id,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_clean_slug() {
        assert_eq!(NovelBinScraper::clean_slug("nb:solo-leveling/chapter-1"), "solo-leveling/chapter-1");
        assert_eq!(NovelBinScraper::clean_slug("/novel-bin/solo-leveling/chapter-1/"), "solo-leveling/chapter-1");
    }

    #[test]
    fn test_sanitize_content_html() {
        let input = "<p>Find light novel online at novel-bin.</p><p>This is the real chapter sentence.</p>";
        let sanitized = NovelBinScraper::sanitize_content_html(input);
        assert!(!sanitized.contains("Find light novel"));
        assert!(sanitized.contains("This is the real chapter sentence."));
    }
}

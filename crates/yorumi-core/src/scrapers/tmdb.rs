use std::sync::Arc;
use serde::{Deserialize, Serialize};

use crate::db::Database;
use crate::scrapers::client::ScraperClient;

const TMDB_BASE: &str = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE: &str = "https://image.tmdb.org/t/p";
const SETTING_TOKEN_KEY: &str = "yorumi_tmdb_read_access_token";

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TmdbArtwork {
    pub backdrop_original: Option<String>,
    pub backdrop_w780: Option<String>,
    pub logo_url: Option<String>,
}

#[derive(Deserialize)]
struct TmdbSearchResponse {
    #[serde(default)]
    results: Vec<TmdbSearchItem>,
}

#[derive(Deserialize)]
struct TmdbSearchItem {
    id: u64,
    backdrop_path: Option<String>,
    #[serde(default)]
    genre_ids: Vec<u32>,
    popularity: Option<f64>,
}

#[derive(Deserialize)]
struct TmdbImagesResponse {
    #[serde(default)]
    logos: Vec<TmdbLogo>,
    #[serde(default)]
    backdrops: Vec<TmdbBackdrop>,
}

#[derive(Deserialize)]
struct TmdbLogo {
    file_path: Option<String>,
    iso_639_1: Option<String>,
    vote_average: Option<f64>,
}

#[derive(Deserialize)]
struct TmdbBackdrop {
    file_path: Option<String>,
    iso_639_1: Option<String>,
}

pub struct TmdbClient {
    client: Arc<ScraperClient>,
    db: Arc<Database>,
}

impl TmdbClient {
    pub fn new(client: Arc<ScraperClient>, db: Arc<Database>) -> Self {
        Self { client, db }
    }

    pub fn resolve_token(&self) -> Option<String> {
        for var in ["TMDB_READ_ACCESS_TOKEN", "VITE_TMDB_READ_ACCESS_TOKEN"] {
            if let Ok(val) = std::env::var(var) {
                let trimmed = val.trim().to_string();
                if !trimmed.is_empty() {
                    return Some(trimmed);
                }
            }
        }
        self.db
            .get_setting(SETTING_TOKEN_KEY)
            .ok()
            .flatten()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
    }

    /// Resolves high-res TMDB backdrop + transparent English PNG logo for an anime,
    /// backed by a 7-day SQLite WAL cache for instant <1ms loads.
    pub async fn get_artwork(
        &self,
        title: &str,
        year: Option<u32>,
        is_movie: bool,
    ) -> Option<TmdbArtwork> {
        let clean_title = strip_season_suffix(title);
        let cache_key = format!(
            "tmdb:artwork:v1:{}:{}:{}",
            if is_movie { "movie" } else { "tv" },
            clean_title.to_lowercase(),
            year.unwrap_or(0)
        );

        if let Ok(Some((payload, is_fresh))) = self.db.get_cache_entry(&cache_key) {
            if is_fresh {
                if let Ok(art) = serde_json::from_str::<TmdbArtwork>(&payload) {
                    return Some(art);
                }
            }
        }

        let token = self.resolve_token()?;
        let media_kind = if is_movie { "movie" } else { "tv" };
        let mut search_url = format!(
            "{}/search/{}?query={}&include_adult=false&language=en-US&page=1",
            TMDB_BASE,
            media_kind,
            urlencoding::encode(&clean_title)
        );
        if let Some(y) = year {
            let param = if is_movie { "year" } else { "first_air_date_year" };
            search_url.push_str(&format!("&{}={}", param, y));
        }

        let search_resp = self
            .client
            .client()
            .get(&search_url)
            .bearer_auth(&token)
            .header("Accept", "application/json")
            .send()
            .await
            .ok()?;
        if !search_resp.status().is_success() {
            return None;
        }

        let mut parsed: TmdbSearchResponse = search_resp.json().await.ok()?;
        if parsed.results.is_empty() && year.is_some() {
            // Retry without year constraint (common for Season 2/3 titles)
            let fallback_url = format!(
                "{}/search/{}?query={}&include_adult=false&language=en-US&page=1",
                TMDB_BASE,
                media_kind,
                urlencoding::encode(&clean_title)
            );
            if let Ok(resp) = self
                .client
                .client()
                .get(&fallback_url)
                .bearer_auth(&token)
                .header("Accept", "application/json")
                .send()
                .await
            {
                if let Ok(fb) = resp.json::<TmdbSearchResponse>().await {
                    parsed = fb;
                }
            }
        }

        // Prefer Animation genre (16) then highest popularity
        parsed.results.sort_by(|a, b| {
            let a_anim = a.genre_ids.contains(&16);
            let b_anim = b.genre_ids.contains(&16);
            b_anim
                .cmp(&a_anim)
                .then_with(|| {
                    b.popularity
                        .unwrap_or(0.0)
                        .partial_cmp(&a.popularity.unwrap_or(0.0))
                        .unwrap_or(std::cmp::Ordering::Equal)
                })
        });

        let best = parsed.results.first()?;
        let mut backdrop_path = best.backdrop_path.clone();
        let mut logo_path: Option<String> = None;

        let images_url = format!(
            "{}/{}/{}/images?include_image_language=en,ja,null",
            TMDB_BASE, media_kind, best.id
        );
        if let Ok(img_resp) = self
            .client
            .client()
            .get(&images_url)
            .bearer_auth(&token)
            .header("Accept", "application/json")
            .send()
            .await
        {
            if let Ok(imgs) = img_resp.json::<TmdbImagesResponse>().await {
                // Prefer English logo, then highest vote
                let mut logos = imgs.logos;
                logos.sort_by(|a, b| {
                    let a_en = a.iso_639_1.as_deref() == Some("en");
                    let b_en = b.iso_639_1.as_deref() == Some("en");
                    b_en.cmp(&a_en).then_with(|| {
                        b.vote_average
                            .unwrap_or(0.0)
                            .partial_cmp(&a.vote_average.unwrap_or(0.0))
                            .unwrap_or(std::cmp::Ordering::Equal)
                    })
                });
                logo_path = logos.into_iter().find_map(|l| l.file_path);

                // Prefer textless (`null`) backdrop for cleanest hero/card visuals
                if let Some(clean_bg) = imgs
                    .backdrops
                    .iter()
                    .find(|b| b.iso_639_1.is_none() && b.file_path.is_some())
                    .and_then(|b| b.file_path.clone())
                {
                    backdrop_path = Some(clean_bg);
                }
            }
        }

        let artwork = TmdbArtwork {
            backdrop_original: backdrop_path
                .as_deref()
                .map(|p| format!("{}/original{}", TMDB_IMAGE_BASE, p)),
            backdrop_w780: backdrop_path
                .as_deref()
                .map(|p| format!("{}/w780{}", TMDB_IMAGE_BASE, p)),
            logo_url: logo_path
                .as_deref()
                .map(|p| format!("{}/w500{}", TMDB_IMAGE_BASE, p)),
        };

        if let Ok(serialized) = serde_json::to_string(&artwork) {
            let _ = self.db.set_cache_entry(&cache_key, &serialized, 7 * 86400);
        }

        Some(artwork)
    }
}

fn strip_season_suffix(title: &str) -> String {
    let lower = title.to_lowercase();
    for marker in [" season ", " part ", " cour ", " final season", " 2nd season", " 3rd season"] {
        if let Some(idx) = lower.find(marker) {
            let trimmed = title[..idx].trim();
            if !trimmed.is_empty() {
                return trimmed.to_string();
            }
        }
    }
    title.trim().to_string()
}

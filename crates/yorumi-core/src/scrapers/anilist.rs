use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;

use crate::db::Database;
use crate::scrapers::client::ScraperClient;
use crate::scrapers::error::ScraperError;

const ANILIST_GRAPHQL_URL: &str = "https://graphql.anilist.co";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AniListTitle {
    pub romaji: Option<String>,
    pub english: Option<String>,
    pub native: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AniListCoverImage {
    pub extra_large: Option<String>,
    pub large: Option<String>,
    pub medium: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AniListDate {
    pub year: Option<u32>,
    pub month: Option<u32>,
    pub day: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AniListNextAiring {
    pub episode: u32,
    pub airing_at: i64,
    pub time_until_airing: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AniListMedia {
    pub id: u32,
    pub id_mal: Option<u32>,
    pub title: AniListTitle,
    pub description: Option<String>,
    pub banner_image: Option<String>,
    pub cover_image: Option<AniListCoverImage>,
    pub format: Option<String>,
    pub episodes: Option<u32>,
    pub duration: Option<u32>,
    pub status: Option<String>,
    pub season: Option<String>,
    pub season_year: Option<u32>,
    pub start_date: Option<AniListDate>,
    pub end_date: Option<AniListDate>,
    pub average_score: Option<u32>,
    pub popularity: Option<u32>,
    #[serde(default)]
    pub genres: Vec<String>,
    #[serde(default)]
    pub synonyms: Vec<String>,
    pub next_airing_episode: Option<AniListNextAiring>,
    pub is_adult: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AniListPageInfo {
    pub total: Option<u32>,
    pub per_page: Option<u32>,
    pub current_page: Option<u32>,
    pub last_page: Option<u32>,
    pub has_next_page: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AniListMediaPage {
    pub page_info: AniListPageInfo,
    pub media: Vec<AniListMedia>,
}

// Internal GraphQL Response Deserializers
#[derive(Deserialize)]
struct GraphQLResponse<T> {
    data: Option<T>,
    errors: Option<Vec<GraphQLError>>,
}

#[derive(Deserialize)]
struct GraphQLError {
    message: String,
}

#[derive(Deserialize)]
struct PageData {
    #[serde(rename = "Page")]
    page: Option<PageInner>,
}

#[derive(Deserialize)]
struct PageInner {
    #[serde(rename = "pageInfo")]
    page_info: AniListPageInfo,
    media: Vec<AniListMedia>,
}

#[derive(Deserialize)]
struct SingleMediaData {
    #[serde(rename = "Media")]
    media: Option<AniListMedia>,
}

// Cache Entry
struct CacheEntry<T> {
    data: T,
    expires_at: Instant,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnimeBrowseFilter {
    pub sort: Option<String>,
    pub genre: Option<String>,
    pub tag: Option<String>,
    pub format: Option<String>,
    pub season: Option<String>,
    pub season_year: Option<u32>,
    pub status: Option<String>,
    pub min_score: Option<u32>,
    pub search: Option<String>,
}

pub struct AniListClient {
    client: Arc<ScraperClient>,
    db: Option<Arc<Database>>,
    cache: RwLock<HashMap<String, CacheEntry<serde_json::Value>>>,
    last_request_time: RwLock<Instant>,
}

const MEDIA_FRAGMENT: &str = r#"
    id
    idMal
    title {
        romaji
        english
        native
    }
    description(asHtml: false)
    bannerImage
    coverImage {
        extraLarge
        large
        medium
    }
    format
    episodes
    duration
    status
    season
    seasonYear
    startDate {
        year
        month
        day
    }
    endDate {
        year
        month
        day
    }
    averageScore
    popularity
    genres
    synonyms
    nextAiringEpisode {
        episode
        airingAt
        timeUntilAiring
    }
    isAdult
"#;

impl AniListClient {
    pub fn new(client: Arc<ScraperClient>) -> Self {
        Self {
            client,
            db: None,
            cache: RwLock::new(HashMap::new()),
            last_request_time: RwLock::new(Instant::now() - Duration::from_secs(10)),
        }
    }

    pub fn new_with_db(client: Arc<ScraperClient>, db: Arc<Database>) -> Self {
        Self {
            client,
            db: Some(db),
            cache: RwLock::new(HashMap::new()),
            last_request_time: RwLock::new(Instant::now() - Duration::from_secs(10)),
        }
    }

    async fn execute_graphql<T: for<'de> Deserialize<'de>>(
        &self,
        query: &str,
        variables: serde_json::Value,
        ttl: Duration,
    ) -> Result<T, ScraperError> {
        let cache_key = format!("anilist:{}:{}", query.trim(), variables);

        // 1. Read from in-memory L1 cache
        {
            let cache_read = self.cache.read().await;
            if let Some(entry) = cache_read.get(&cache_key) {
                if Instant::now() < entry.expires_at {
                    if let Ok(deserialized) = serde_json::from_value::<T>(entry.data.clone()) {
                        return Ok(deserialized);
                    }
                }
            }
        }

        // 1b. Read from persistent SQLite L2 cache (fresh hit returns immediately in <1ms)
        let mut stale_fallback: Option<T> = None;
        if let Some(db) = &self.db {
            if let Ok(Some((payload, is_fresh))) = db.get_cache_entry(&cache_key) {
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(&payload) {
                    if let Ok(deserialized) = serde_json::from_value::<T>(val.clone()) {
                        if is_fresh {
                            let mut cache_write = self.cache.write().await;
                            cache_write.insert(
                                cache_key,
                                CacheEntry {
                                    data: val,
                                    expires_at: Instant::now() + ttl,
                                },
                            );
                            return Ok(deserialized);
                        } else {
                            stale_fallback = Some(deserialized);
                        }
                    }
                }
            }
        }

        // 2. Pace requests (AniList 60 req/min rate limit)
        {
            let mut last_req = self.last_request_time.write().await;
            let elapsed = last_req.elapsed();
            let min_interval = Duration::from_millis(650);
            if elapsed < min_interval {
                tokio::time::sleep(min_interval - elapsed).await;
            }
            *last_req = Instant::now();
        }

        // 3. Make HTTP POST request to AniList GraphQL
        let body = serde_json::json!({
            "query": query,
            "variables": variables
        });

        let resp_result = self
            .client
            .client()
            .post(ANILIST_GRAPHQL_URL)
            .header("Content-Type", "application/json")
            .header("Accept", "application/json")
            .json(&body)
            .send()
            .await;

        let resp = match resp_result {
            Ok(r) => r,
            Err(e) => {
                if let Some(stale) = stale_fallback {
                    return Ok(stale);
                }
                return Err(ScraperError::Network(e));
            }
        };

        let status = resp.status();
        if !status.is_success() {
            if let Some(stale) = stale_fallback {
                return Ok(stale);
            }
            if status.as_u16() == 429 {
                return Err(ScraperError::RateLimited("AniList 429 Too Many Requests".to_string()));
            }
            return Err(ScraperError::Network(resp.error_for_status().unwrap_err()));
        }

        let gql_resp: GraphQLResponse<serde_json::Value> = resp.json().await?;
        if let Some(errors) = gql_resp.errors {
            if let Some(stale) = stale_fallback {
                return Ok(stale);
            }
            let error_msgs = errors.into_iter().map(|e| e.message).collect::<Vec<_>>().join(", ");
            return Err(ScraperError::Parse(format!("GraphQL Errors: {}", error_msgs)));
        }

        let Some(data) = gql_resp.data else {
            if let Some(stale) = stale_fallback {
                return Ok(stale);
            }
            return Err(ScraperError::NotFound("Empty GraphQL data in AniList response".to_string()));
        };

        // 4. Store in L1 memory cache and L2 SQLite persistent cache
        if let Some(db) = &self.db {
            if let Ok(serialized) = serde_json::to_string(&data) {
                let _ = db.set_cache_entry(&cache_key, &serialized, ttl.as_secs());
            }
        }
        {
            let mut cache_write = self.cache.write().await;
            cache_write.insert(
                cache_key,
                CacheEntry {
                    data: data.clone(),
                    expires_at: Instant::now() + ttl,
                },
            );

            if cache_write.len() > 150 {
                let now = Instant::now();
                cache_write.retain(|_, v| now < v.expires_at);
            }
        }

        let result = serde_json::from_value::<T>(data)
            .map_err(|e| ScraperError::Parse(format!("Failed to deserialize GraphQL payload: {}", e)))?;

        Ok(result)
    }

    /// Fetch trending anime
    pub async fn get_trending(&self, page: u32, per_page: u32) -> Result<AniListMediaPage, ScraperError> {
        let query = format!(
            r#"
            query ($page: Int, $perPage: Int) {{
                Page (page: $page, perPage: $perPage) {{
                    pageInfo {{
                        total
                        perPage
                        currentPage
                        lastPage
                        hasNextPage
                    }}
                    media (type: ANIME, sort: [TRENDING_DESC, POPULARITY_DESC], isAdult: false) {{
                        {}
                    }}
                }}
            }}
            "#,
            MEDIA_FRAGMENT
        );

        let variables = serde_json::json!({
            "page": page,
            "perPage": per_page
        });

        let data: PageData = self
            .execute_graphql(&query, variables, Duration::from_secs(300))
            .await?;

        let page_inner = data.page.ok_or_else(|| ScraperError::NotFound("No trending page found".to_string()))?;
        Ok(AniListMediaPage {
            page_info: page_inner.page_info,
            media: page_inner.media,
        })
    }

    /// Fetch all-time popular anime
    pub async fn get_popular(&self, page: u32, per_page: u32) -> Result<AniListMediaPage, ScraperError> {
        let query = format!(
            r#"
            query ($page: Int, $perPage: Int) {{
                Page (page: $page, perPage: $perPage) {{
                    pageInfo {{
                        total
                        perPage
                        currentPage
                        lastPage
                        hasNextPage
                    }}
                    media (type: ANIME, sort: [POPULARITY_DESC], isAdult: false) {{
                        {}
                    }}
                }}
            }}
            "#,
            MEDIA_FRAGMENT
        );

        let variables = serde_json::json!({
            "page": page,
            "perPage": per_page
        });

        let data: PageData = self
            .execute_graphql(&query, variables, Duration::from_secs(900))
            .await?;

        let page_inner = data.page.ok_or_else(|| ScraperError::NotFound("No popular page found".to_string()))?;
        Ok(AniListMediaPage {
            page_info: page_inner.page_info,
            media: page_inner.media,
        })
    }

    /// Search anime by title query
    pub async fn search_anime(&self, query_str: &str, page: u32, per_page: u32) -> Result<AniListMediaPage, ScraperError> {
        let query = format!(
            r#"
            query ($search: String, $page: Int, $perPage: Int) {{
                Page (page: $page, perPage: $perPage) {{
                    pageInfo {{
                        total
                        perPage
                        currentPage
                        lastPage
                        hasNextPage
                    }}
                    media (search: $search, type: ANIME, sort: [SEARCH_MATCH], isAdult: false) {{
                        {}
                    }}
                }}
            }}
            "#,
            MEDIA_FRAGMENT
        );

        let variables = serde_json::json!({
            "search": query_str,
            "page": page,
            "perPage": per_page
        });

        let data: PageData = self
            .execute_graphql(&query, variables, Duration::from_secs(300))
            .await?;

        let page_inner = data.page.ok_or_else(|| ScraperError::NotFound("No search results found".to_string()))?;
        Ok(AniListMediaPage {
            page_info: page_inner.page_info,
            media: page_inner.media,
        })
    }

    /// Fetch full anime details by AniList ID
    pub async fn get_anime_details(&self, id: u32) -> Result<AniListMedia, ScraperError> {
        let query = format!(
            r#"
            query ($id: Int) {{
                Media (id: $id, type: ANIME) {{
                    {}
                }}
            }}
            "#,
            MEDIA_FRAGMENT
        );

        let variables = serde_json::json!({ "id": id });

        let data: SingleMediaData = self
            .execute_graphql(&query, variables, Duration::from_secs(3600))
            .await?;

        let media = data.media.ok_or_else(|| ScraperError::NotFound(format!("Media ID {} not found", id)))?;
        Ok(media)
    }

    /// Fetch Top 100 Anime / Manga / Light Novels unified on AniList SCORE_DESC.
    pub async fn get_top_100(
        &self,
        media_type: &str,
        page: u32,
        per_page: u32,
    ) -> Result<AniListMediaPage, ScraperError> {
        let (anilist_type, format_filter) = match media_type {
            "manga" => ("MANGA", Some("MANGA")),
            "novel" => ("MANGA", Some("NOVEL")),
            _ => ("ANIME", None),
        };

        let query = format!(
            r#"
            query ($page: Int, $perPage: Int, $type: MediaType, $format: MediaFormat) {{
                Page (page: $page, perPage: $perPage) {{
                    pageInfo {{
                        total
                        perPage
                        currentPage
                        lastPage
                        hasNextPage
                    }}
                    media (type: $type, format: $format, sort: [SCORE_DESC, POPULARITY_DESC], isAdult: false) {{
                        {}
                    }}
                }}
            }}
            "#,
            MEDIA_FRAGMENT
        );

        let variables = serde_json::json!({
            "page": page,
            "perPage": per_page,
            "type": anilist_type,
            "format": format_filter,
        });

        let data: PageData = self
            .execute_graphql(&query, variables, Duration::from_secs(900))
            .await?;

        let page_inner = data
            .page
            .ok_or_else(|| ScraperError::NotFound("No top 100 page found".to_string()))?;
        Ok(AniListMediaPage {
            page_info: page_inner.page_info,
            media: page_inner.media,
        })
    }

    /// Browse anime with composable filters (Trending, Popular, Top Rated, Airing, Upcoming, Genre, Format, Season, Year, Status, Rating).
    pub async fn browse_anime(
        &self,
        filter: &AnimeBrowseFilter,
        page: u32,
        per_page: u32,
    ) -> Result<AniListMediaPage, ScraperError> {
        let sort = match filter.sort.as_deref() {
            Some("POPULAR") => vec!["POPULARITY_DESC"],
            Some("TOP_RATED") => vec!["SCORE_DESC", "POPULARITY_DESC"],
            Some("NEWEST") => vec!["START_DATE_DESC", "POPULARITY_DESC"],
            _ => vec!["TRENDING_DESC", "POPULARITY_DESC"],
        };

        let query = format!(
            r#"
            query (
                $page: Int,
                $perPage: Int,
                $sort: [MediaSort],
                $genre: String,
                $tag: String,
                $format: MediaFormat,
                $season: MediaSeason,
                $seasonYear: Int,
                $status: MediaStatus,
                $averageScoreGreater: Int,
                $search: String
            ) {{
                Page (page: $page, perPage: $perPage) {{
                    pageInfo {{
                        total
                        perPage
                        currentPage
                        lastPage
                        hasNextPage
                    }}
                    media (
                        type: ANIME,
                        sort: $sort,
                        genre: $genre,
                        tag: $tag,
                        format: $format,
                        season: $season,
                        seasonYear: $seasonYear,
                        status: $status,
                        averageScore_greater: $averageScoreGreater,
                        search: $search,
                        isAdult: false
                    ) {{
                        {}
                    }}
                }}
            }}
            "#,
            MEDIA_FRAGMENT
        );

        let variables = serde_json::json!({
            "page": page,
            "perPage": per_page,
            "sort": sort,
            "genre": filter.genre,
            "tag": filter.tag,
            "format": filter.format,
            "season": filter.season,
            "seasonYear": filter.season_year,
            "status": filter.status,
            "averageScoreGreater": filter.min_score,
            "search": filter.search,
        });

        let data: PageData = self
            .execute_graphql(&query, variables, Duration::from_secs(300))
            .await?;

        let page_inner = data
            .page
            .ok_or_else(|| ScraperError::NotFound("No browse page found".to_string()))?;
        Ok(AniListMediaPage {
            page_info: page_inner.page_info,
            media: page_inner.media,
        })
    }

    /// Fetch trending or popular Manga / Light Novels via AniList (cached in SQLite WAL).
    pub async fn get_reading_list(
        &self,
        format: &str, // "MANGA" | "NOVEL"
        sort: &str,   // "TRENDING_DESC" | "POPULARITY_DESC" | "SCORE_DESC"
        page: u32,
        per_page: u32,
    ) -> Result<AniListMediaPage, ScraperError> {
        let sort_arr = match sort {
            "POPULARITY_DESC" => vec!["POPULARITY_DESC"],
            "SCORE_DESC" => vec!["SCORE_DESC", "POPULARITY_DESC"],
            _ => vec!["TRENDING_DESC", "POPULARITY_DESC"],
        };
        let query = format!(
            r#"
            query ($page: Int, $perPage: Int, $format: MediaFormat, $sort: [MediaSort]) {{
                Page (page: $page, perPage: $perPage) {{
                    pageInfo {{
                        total
                        perPage
                        currentPage
                        lastPage
                        hasNextPage
                    }}
                    media (type: MANGA, format: $format, sort: $sort, isAdult: false) {{
                        {}
                    }}
                }}
            }}
            "#,
            MEDIA_FRAGMENT
        );

        let variables = serde_json::json!({
            "page": page,
            "perPage": per_page,
            "format": format,
            "sort": sort_arr,
        });

        let data: PageData = self
            .execute_graphql(&query, variables, Duration::from_secs(600))
            .await?;

        let page_inner = data
            .page
            .ok_or_else(|| ScraperError::NotFound("No reading list page found".to_string()))?;
        Ok(AniListMediaPage {
            page_info: page_inner.page_info,
            media: page_inner.media,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_anilist_media_deserialization() {
        let sample = serde_json::json!({
            "id": 16498,
            "idMal": 16498,
            "title": {
                "romaji": "Shingeki no Kyojin",
                "english": "Attack on Titan",
                "native": "進撃の巨人"
            },
            "description": "Centuries ago, mankind was slaughtered...",
            "bannerImage": "https://s4.anilist.co/file/anilistcdn/media/anime/banner/16498.jpg",
            "coverImage": {
                "extraLarge": "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498-mMGfXF3fW3nw.png",
                "large": "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx16498-mMGfXF3fW3nw.png",
                "medium": null
            },
            "format": "TV",
            "episodes": 25,
            "duration": 24,
            "status": "FINISHED",
            "season": "SPRING",
            "seasonYear": 2013,
            "startDate": { "year": 2013, "month": 4, "day": 7 },
            "endDate": { "year": 2013, "month": 9, "day": 29 },
            "averageScore": 85,
            "popularity": 540000,
            "genres": ["Action", "Drama", "Fantasy", "Mystery"],
            "synonyms": ["AoT", "SnK"],
            "nextAiringEpisode": null,
            "isAdult": false
        });

        let media: AniListMedia = serde_json::from_value(sample).expect("Failed to deserialize AniListMedia");
        assert_eq!(media.id, 16498);
        assert_eq!(media.title.english.as_deref(), Some("Attack on Titan"));
        assert_eq!(media.episodes, Some(25));
        assert_eq!(media.genres.len(), 4);
    }
}


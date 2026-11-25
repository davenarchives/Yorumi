use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WatchProgress {
    pub anime_id: String,
    pub episode_id: String,
    pub episode_number: f32,
    pub anime_title: Option<String>,
    pub anime_image: Option<String>,
    #[serde(default)]
    pub position_seconds: f64,
    #[serde(default)]
    pub duration_seconds: f64,
    pub last_watched: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadProgress {
    pub manga_id: String,
    pub chapter_id: String,
    pub chapter_number: String,
    pub manga_title: Option<String>,
    pub manga_image: Option<String>,
    #[serde(default = "default_page_one")]
    pub page_number: u32,
    pub last_read: i64,
}

fn default_page_one() -> u32 {
    1
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NovelProgress {
    pub novel_id: String,
    pub chapter_id: String,
    pub novel_title: Option<String>,
    pub chapter_number: f32,
    pub last_read: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryEntry {
    pub id: String,
    pub media_type: String, // "anime" | "manga" | "novel"
    pub anilist_id: Option<String>,
    pub mal_id: Option<String>,
    pub scraper_id: Option<String>,
    pub title: String,
    pub image: Option<String>,
    pub status: String, // "watching" | "reading" | "completed" | "plan_to_watch" | "plan_to_read" | "dropped"
    pub score: Option<f32>,
    pub current_progress: Option<f32>,
    pub total_count: Option<u32>,
    pub genres: Vec<String>,
    pub added_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadedEpisode {
    pub id: String,
    pub anime_id: String,
    pub anime_title: String,
    pub anime_image: Option<String>,
    pub episode_number: f32,
    pub episode_title: Option<String>,
    pub quality: Option<String>,
    pub audio: Option<String>,
    pub file_size: Option<u64>,
    pub file_path: String,
    pub downloaded_at: i64,
    pub is_hls: Option<bool>,
    pub duration: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActiveDownloadProgress {
    pub anime_id: String,
    pub episode_number: f32,
    pub progress: f32, // 0 to 100
    pub status: String, // "queued" | "downloading" | "paused" | "completed" | "error" | "saving"
    pub received_bytes: u64,
    pub total_bytes: u64,
    pub error: Option<String>,
}



use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnimeSearchResult {
    pub id: String,
    pub title: String,
    pub url: String,
    pub poster: Option<String>,
    pub status: Option<String>,
    pub r#type: Option<String>,
    pub episodes: Option<u32>,
    pub sub: Option<u32>,
    pub dub: Option<u32>,
    pub year: Option<String>,
    pub score: Option<String>,
    pub session: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Episode {
    pub id: String,
    pub episode_number: u32,
    pub url: String,
    pub title: Option<String>,
    pub duration: Option<String>,
    pub date: Option<String>,
    pub snapshot: Option<String>,
    pub session: String,
    pub is_subbed: Option<bool>,
    pub is_dubbed: Option<bool>,
    pub is_filler: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleTrack {
    pub url: String,
    pub lang: String,
    #[serde(default)]
    pub default: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamLink {
    pub quality: String,
    pub audio: String,
    pub provider: Option<String>,
    pub server: Option<String>,
    pub url: String,
    pub direct_url: Option<String>,
    pub referer: Option<String>,
    pub cookie: Option<String>,
    pub audio_language: Option<String>,
    pub is_hls: bool,
    pub subtitles: Option<Vec<SubtitleTrack>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MangaSearchResult {
    pub id: String,
    pub title: String,
    pub url: String,
    pub cover: Option<String>,
    pub latest_chapter: Option<String>,
    pub genres: Vec<String>,
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MangaChapter {
    pub id: String,
    pub chapter_number: f32,
    pub title: String,
    pub release_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NovelSearchResult {
    pub id: String,
    pub title: String,
    pub url: String,
    pub cover: Option<String>,
    pub author: Option<String>,
    pub latest_chapter: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NovelChapter {
    pub id: String,
    pub chapter_number: f32,
    pub title: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChapterPage {
    pub page_number: u32,
    pub image_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NovelChapterContent {
    pub id: String,
    pub novel_id: String,
    pub title: String,
    pub chapter_number: f32,
    pub content: String,
    pub prev_chapter_id: Option<String>,
    pub next_chapter_id: Option<String>,
}



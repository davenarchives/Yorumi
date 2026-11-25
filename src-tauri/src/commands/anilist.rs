use tauri::State;
use crate::scrapers::{AniListMedia, AniListMediaPage};
use crate::state::AppState;

#[tauri::command]
pub async fn anilist_get_trending(
    page: Option<u32>,
    per_page: Option<u32>,
    state: State<'_, AppState>,
) -> Result<AniListMediaPage, String> {
    state
        .anilist
        .get_trending(page.unwrap_or(1), per_page.unwrap_or(20))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn anilist_get_popular(
    page: Option<u32>,
    per_page: Option<u32>,
    state: State<'_, AppState>,
) -> Result<AniListMediaPage, String> {
    state
        .anilist
        .get_popular(page.unwrap_or(1), per_page.unwrap_or(20))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn anilist_search(
    query: String,
    page: Option<u32>,
    per_page: Option<u32>,
    state: State<'_, AppState>,
) -> Result<AniListMediaPage, String> {
    state
        .anilist
        .search_anime(&query, page.unwrap_or(1), per_page.unwrap_or(20))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn anilist_get_media(
    id: u32,
    state: State<'_, AppState>,
) -> Result<AniListMedia, String> {
    state
        .anilist
        .get_anime_details(id)
        .await
        .map_err(|e| e.to_string())
}

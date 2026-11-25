use tauri::State;
use crate::scrapers::{AnimeProvider, AnimeSearchResult, Episode, StreamLink};
use crate::state::AppState;

#[tauri::command]
pub async fn search_anime(
    query: String,
    state: State<'_, AppState>,
) -> Result<Vec<AnimeSearchResult>, String> {
    state
        .hianime
        .search(&query)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_anime_episodes(
    anime_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<Episode>, String> {
    state
        .hianime
        .get_episodes(&anime_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_anime_streams(
    episode_id: String,
    server: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<StreamLink>, String> {
    state
        .hianime
        .get_streams(&episode_id, server.as_deref())
        .await
        .map_err(|e| e.to_string())
}


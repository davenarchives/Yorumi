use tauri::State;
use crate::db::{LibraryEntry, ReadProgress, WatchProgress};
use crate::state::AppState;

#[tauri::command]
pub async fn db_save_watch_progress(
    progress: WatchProgress,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.db.save_watch_progress(&progress).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn db_get_continue_watching(
    limit: Option<u32>,
    state: State<'_, AppState>,
) -> Result<Vec<WatchProgress>, String> {
    state.db.get_continue_watching(limit.unwrap_or(30)).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn db_get_anime_history(
    anime_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<String>, String> {
    state.db.get_anime_episode_history(&anime_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn db_save_read_progress(
    progress: ReadProgress,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.db.save_read_progress(&progress).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn db_get_continue_reading(
    limit: Option<u32>,
    state: State<'_, AppState>,
) -> Result<Vec<ReadProgress>, String> {
    state.db.get_continue_reading(limit.unwrap_or(30)).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn db_get_manga_history(
    manga_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<String>, String> {
    state.db.get_manga_chapter_history(&manga_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn db_save_library_entry(
    entry: LibraryEntry,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.db.save_library_entry(&entry).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn db_get_library_entries(
    media_type: Option<String>,
    status: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<LibraryEntry>, String> {
    state.db.get_library_entries(media_type.as_deref(), status.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn db_remove_library_entry(
    id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.db.remove_library_entry(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn db_get_setting(
    key: String,
    state: State<'_, AppState>,
) -> Result<Option<String>, String> {
    state.db.get_setting(&key).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn db_set_setting(
    key: String,
    value: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.db.set_setting(&key, &value).map_err(|e| e.to_string())
}


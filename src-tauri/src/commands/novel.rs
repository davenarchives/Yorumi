use tauri::State;
use crate::scrapers::{NovelChapter, NovelChapterContent, NovelProvider, NovelSearchResult};
use crate::state::AppState;

#[tauri::command]
pub async fn search_novels(
    query: String,
    state: State<'_, AppState>,
) -> Result<Vec<NovelSearchResult>, String> {
    state
        .novelbin
        .search(&query)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_novel_chapters(
    novel_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<NovelChapter>, String> {
    state
        .novelbin
        .get_chapters(&novel_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_novel_content(
    chapter_id_or_url: String,
    state: State<'_, AppState>,
) -> Result<NovelChapterContent, String> {
    state
        .novelbin
        .get_content(&chapter_id_or_url)
        .await
        .map_err(|e| e.to_string())
}


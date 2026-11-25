use tauri::State;
use crate::scrapers::{ChapterPage, MangaChapter, MangaProvider, MangaSearchResult};
use crate::state::AppState;

#[tauri::command]
pub async fn search_manga(
    query: String,
    state: State<'_, AppState>,
) -> Result<Vec<MangaSearchResult>, String> {
    state
        .mangakatana
        .search(&query)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_manga_chapters(
    manga_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<MangaChapter>, String> {
    state
        .mangakatana
        .get_chapters(&manga_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_manga_pages(
    chapter_id_or_url: String,
    state: State<'_, AppState>,
) -> Result<Vec<ChapterPage>, String> {
    state
        .mangakatana
        .get_pages(&chapter_id_or_url)
        .await
        .map_err(|e| e.to_string())
}


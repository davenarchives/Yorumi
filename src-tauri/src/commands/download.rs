use tauri::{AppHandle, State};
#[cfg(mobile)]
use tauri::Manager;
use crate::db::DownloadedEpisode;
use crate::state::AppState;

#[tauri::command]
pub async fn start_download(
    #[allow(unused_variables)] app: AppHandle,
    anime_id: String,
    anime_title: String,
    anime_image: Option<String>,
    episode_number: f32,
    episode_title: Option<String>,
    stream_url: String,
    referer: Option<String>,
    quality: Option<String>,
    audio: Option<String>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    #[cfg(mobile)]
    let override_root = Some(
        app.path()
            .app_data_dir()
            .map_err(|e| format!("Failed to resolve app data directory: {}", e))?
            .join("downloads")
            .join("Anime"),
    );
    #[cfg(not(mobile))]
    let override_root = None;

    state
        .downloader
        .start_download(
            override_root,
            anime_id,
            anime_title,
            anime_image,
            episode_number,
            episode_title,
            stream_url,
            referer,
            quality,
            audio,
        )
        .await
}

#[tauri::command]
pub async fn get_local_downloads(
    state: State<'_, AppState>,
) -> Result<Vec<DownloadedEpisode>, String> {
    state.downloader.get_local_downloads()
}

#[tauri::command]
pub async fn get_local_download(
    anime_id: String,
    episode_number: f32,
    state: State<'_, AppState>,
) -> Result<Option<DownloadedEpisode>, String> {
    state.downloader.get_local_download(&anime_id, episode_number)
}

#[tauri::command]
pub async fn delete_local_download(
    anime_id: String,
    episode_number: f32,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    state
        .downloader
        .delete_local_download(&anime_id, episode_number)
}

#[tauri::command]
pub async fn open_downloads_folder(category: Option<String>) -> Result<bool, String> {
    crate::downloader::DownloadManager::open_downloads_folder(category.as_deref())
}

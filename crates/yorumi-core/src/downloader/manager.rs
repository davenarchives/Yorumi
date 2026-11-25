use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::SystemTime;
use tokio::sync::broadcast;

use crate::db::{ActiveDownloadProgress, Database, DownloadedEpisode};
use crate::downloader::hls::download_hls_stream;

#[derive(Clone)]
pub struct DownloadManager {
    db: Arc<Database>,
    client: reqwest::Client,
    downloads_root: PathBuf,
    progress_tx: broadcast::Sender<ActiveDownloadProgress>,
}

impl DownloadManager {
    pub fn new(db: Arc<Database>, client: reqwest::Client, downloads_root: PathBuf) -> Self {
        let (progress_tx, _) = broadcast::channel(128);
        Self {
            db,
            client,
            downloads_root,
            progress_tx,
        }
    }

    /// Subscribe to real-time download progress updates (consumed by Tauri, GPUI, or UniFFI).
    pub fn subscribe(&self) -> broadcast::Receiver<ActiveDownloadProgress> {
        self.progress_tx.subscribe()
    }

    fn sanitize_filename(name: &str) -> String {
        name.chars()
            .map(|c| match c {
                '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
                _ => c,
            })
            .collect()
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn start_download(
        &self,
        override_root: Option<PathBuf>,
        anime_id: String,
        anime_title: String,
        anime_image: Option<String>,
        episode_number: f32,
        episode_title: Option<String>,
        stream_url: String,
        referer: Option<String>,
        quality: Option<String>,
        audio: Option<String>,
    ) -> Result<String, String> {
        let root = override_root.unwrap_or_else(|| self.downloads_root.clone());
        let safe_anime_title = Self::sanitize_filename(&anime_title);
        let anime_folder = root.join(&safe_anime_title);
        fs::create_dir_all(&anime_folder)
            .map_err(|e| format!("Failed to create download folder: {}", e))?;

        let file_name = format!("Episode_{}.mp4", episode_number);
        let dest_path = anime_folder.join(file_name);
        let dest_str = dest_path.to_string_lossy().to_string();

        let ep_id = format!("{}_ep_{}", anime_id, episode_number);
        let client = self.client.clone();
        let db = self.db.clone();
        let progress_tx = self.progress_tx.clone();
        let progress_anime_id = anime_id.clone();

        tokio::spawn(async move {
            let init_progress = ActiveDownloadProgress {
                anime_id: progress_anime_id.clone(),
                episode_number,
                progress: 0.0,
                status: "downloading".to_string(),
                received_bytes: 0,
                total_bytes: 0,
                error: None,
            };
            let _ = progress_tx.send(init_progress);

            let progress_id = progress_anime_id.clone();
            let tx_progress = progress_tx.clone();
            let on_progress = move |pct: f32, received: u64, total: u64| {
                let p = ActiveDownloadProgress {
                    anime_id: progress_id.clone(),
                    episode_number,
                    progress: pct,
                    status: if pct >= 100.0 {
                        "saving".to_string()
                    } else {
                        "downloading".to_string()
                    },
                    received_bytes: received,
                    total_bytes: total,
                    error: None,
                };
                let _ = tx_progress.send(p);
            };

            match download_hls_stream(
                &client,
                &stream_url,
                referer.as_deref(),
                &dest_path,
                on_progress,
            )
            .await
            {
                Ok((file_size, is_hls_ts)) => {
                    let now = SystemTime::now()
                        .duration_since(SystemTime::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_millis() as i64;

                    let ep = DownloadedEpisode {
                        id: ep_id,
                        anime_id: progress_anime_id.clone(),
                        anime_title,
                        anime_image,
                        episode_number,
                        episode_title,
                        quality,
                        audio,
                        file_size: Some(file_size),
                        file_path: dest_str,
                        downloaded_at: now,
                        is_hls: Some(is_hls_ts),
                        duration: None,
                    };

                    let _ = db.save_downloaded_episode(&ep);

                    let complete_progress = ActiveDownloadProgress {
                        anime_id: progress_anime_id,
                        episode_number,
                        progress: 100.0,
                        status: "completed".to_string(),
                        received_bytes: file_size,
                        total_bytes: file_size,
                        error: None,
                    };
                    let _ = progress_tx.send(complete_progress);
                }
                Err(err) => {
                    let error_progress = ActiveDownloadProgress {
                        anime_id: progress_anime_id,
                        episode_number,
                        progress: 0.0,
                        status: "error".to_string(),
                        received_bytes: 0,
                        total_bytes: 0,
                        error: Some(err),
                    };
                    let _ = progress_tx.send(error_progress);
                }
            }
        });

        Ok("Download started".to_string())
    }

    pub fn get_local_downloads(&self) -> Result<Vec<DownloadedEpisode>, String> {
        self.db.get_downloaded_episodes().map_err(|e| e.to_string())
    }

    pub fn get_local_download(
        &self,
        anime_id: &str,
        episode_number: f32,
    ) -> Result<Option<DownloadedEpisode>, String> {
        self.db
            .get_downloaded_episode(anime_id, episode_number)
            .map_err(|e| e.to_string())
    }

    pub fn delete_local_download(
        &self,
        anime_id: &str,
        episode_number: f32,
    ) -> Result<bool, String> {
        let file_path = self
            .db
            .delete_downloaded_episode(anime_id, episode_number)
            .map_err(|e| e.to_string())?;
        if let Some(path_str) = file_path {
            let path = Path::new(&path_str);
            if path.exists() {
                let _ = fs::remove_file(path);
            }
            Ok(true)
        } else {
            Ok(false)
        }
    }

    pub fn open_downloads_folder(category: Option<&str>) -> Result<bool, String> {
        let mut base = PathBuf::from(".");
        #[cfg(target_os = "windows")]
        {
            if let Ok(profile) = std::env::var("USERPROFILE") {
                base = PathBuf::from(profile).join("Downloads");
            }
        }
        #[cfg(unix)]
        {
            if let Ok(home) = std::env::var("HOME") {
                base = PathBuf::from(home).join("Downloads");
            }
        }

        let sub = match category {
            Some("Manga") => "Manga",
            Some("LightNovels") => "LightNovels",
            _ => "Anime",
        };
        let target = base.join("Yorumi").join(sub);
        let _ = fs::create_dir_all(&target);

        #[cfg(target_os = "windows")]
        {
            let _ = std::process::Command::new("explorer").arg(&target).spawn();
        }

        #[cfg(target_os = "macos")]
        {
            let _ = std::process::Command::new("open").arg(&target).spawn();
        }

        #[cfg(target_os = "linux")]
        {
            let _ = std::process::Command::new("xdg-open").arg(&target).spawn();
        }

        Ok(true)
    }
}

pub mod db;
pub mod downloader;
pub mod media;
pub mod scrapers;

use std::path::PathBuf;
use std::sync::Arc;

use db::Database;
use downloader::DownloadManager;
use media::LocalMediaProxy;
use scrapers::{
    AniListClient, HiAnimeScraper, MangaKatanaScraper, NovelBinScraper, ScraperClient, TmdbClient,
};

/// Shared application core owned by every Yorumi client (Desktop GPUI, Android/iOS UniFFI, Tauri).
/// Contains zero UI/WebView/Tauri dependencies.
pub struct YorumiCore {
    pub client: Arc<ScraperClient>,
    pub hianime: Arc<HiAnimeScraper>,
    pub mangakatana: Arc<MangaKatanaScraper>,
    pub novelbin: Arc<NovelBinScraper>,
    pub anilist: Arc<AniListClient>,
    pub tmdb: Arc<TmdbClient>,
    pub db: Arc<Database>,
    pub downloader: Arc<DownloadManager>,
    pub downloads_dir: PathBuf,
}

impl YorumiCore {
    pub fn default_db_path() -> PathBuf {
        #[cfg(target_os = "windows")]
        {
            if let Ok(app_data) = std::env::var("APPDATA") {
                let dir = PathBuf::from(app_data).join("com.yorumi.app");
                let _ = std::fs::create_dir_all(&dir);
                return dir.join("yorumi.db");
            }
        }

        #[cfg(unix)]
        {
            if let Ok(home) = std::env::var("HOME") {
                let dir = PathBuf::from(home)
                    .join(".local")
                    .join("share")
                    .join("com.yorumi.app");
                let _ = std::fs::create_dir_all(&dir);
                return dir.join("yorumi.db");
            }
        }

        PathBuf::from("data").join("yorumi.db")
    }

    pub fn default_downloads_dir() -> PathBuf {
        #[cfg(target_os = "windows")]
        {
            if let Ok(profile) = std::env::var("USERPROFILE") {
                return PathBuf::from(profile)
                    .join("Downloads")
                    .join("Yorumi")
                    .join("Anime");
            }
        }

        #[cfg(unix)]
        {
            if let Ok(home) = std::env::var("HOME") {
                return PathBuf::from(home)
                    .join("Downloads")
                    .join("Yorumi")
                    .join("Anime");
            }
        }

        PathBuf::from("Downloads").join("Yorumi").join("Anime")
    }

    pub fn new(
        db_path: Option<PathBuf>,
        downloads_dir: Option<PathBuf>,
    ) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let client = Arc::new(ScraperClient::new());
        let path = db_path.unwrap_or_else(Self::default_db_path);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let db = Arc::new(Database::open(&path)?);
        let resolved_downloads = downloads_dir.unwrap_or_else(Self::default_downloads_dir);
        let downloader = Arc::new(DownloadManager::new(
            db.clone(),
            client.client().clone(),
            resolved_downloads.clone(),
        ));

        Ok(Self {
            hianime: Arc::new(HiAnimeScraper::new(client.clone())),
            mangakatana: Arc::new(MangaKatanaScraper::new(client.clone())),
            novelbin: Arc::new(NovelBinScraper::new(client.clone())),
            anilist: Arc::new(AniListClient::new_with_db(client.clone(), db.clone())),
            tmdb: Arc::new(TmdbClient::new(client.clone(), db.clone())),
            db,
            downloader,
            client,
            downloads_dir: resolved_downloads,
        })
    }

    /// Starts the local 127.0.0.1 HTTP HLS proxy server (for libmpv on Desktop & Media3/AVPlayer on Mobile).
    pub async fn start_media_proxy(&self) -> Result<LocalMediaProxy, std::io::Error> {
        LocalMediaProxy::start(self.client.client().clone()).await
    }
}

use std::ops::Deref;
use std::path::PathBuf;
use yorumi_core::YorumiCore;

pub struct AppState {
    pub core: YorumiCore,
}

impl AppState {
    pub fn new(
        db_path: Option<PathBuf>,
        downloads_dir: Option<PathBuf>,
    ) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        Ok(Self {
            core: YorumiCore::new(db_path, downloads_dir)?,
        })
    }
}

impl Deref for AppState {
    type Target = YorumiCore;

    fn deref(&self) -> &Self::Target {
        &self.core
    }
}

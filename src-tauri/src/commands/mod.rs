pub mod anilist;
pub mod anime;
pub mod download;
pub mod http;
pub mod manga;
pub mod novel;
pub mod storage;
pub mod reading_export;
#[cfg(not(mobile))]
pub mod discord;
#[cfg(not(mobile))]
pub mod updater;

pub use anilist::*;
pub use anime::*;
pub use download::*;
pub use manga::*;
pub use novel::*;
pub use storage::*;


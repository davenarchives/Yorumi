pub mod anilist;
pub mod client;
pub mod error;
pub mod hianime;
pub mod mangakatana;
pub mod novelbin;
pub mod tmdb;
pub mod traits;
pub mod types;

pub use anilist::{AniListClient, AniListMedia, AniListMediaPage, AniListTitle, AnimeBrowseFilter};
pub use client::ScraperClient;
pub use error::ScraperError;
pub use hianime::HiAnimeScraper;
pub use mangakatana::MangaKatanaScraper;
pub use novelbin::NovelBinScraper;
pub use tmdb::{TmdbArtwork, TmdbClient};
pub use traits::{AnimeProvider, MangaProvider, NovelProvider};
pub use types::*;


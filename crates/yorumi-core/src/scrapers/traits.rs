use async_trait::async_trait;
use crate::scrapers::error::ScraperError;
use crate::scrapers::types::{
    AnimeSearchResult, ChapterPage, Episode, MangaChapter, MangaSearchResult, NovelChapter,
    NovelChapterContent, NovelSearchResult, StreamLink,
};

#[async_trait]
pub trait AnimeProvider: Send + Sync {
    fn id(&self) -> &'static str;
    fn name(&self) -> &'static str;
    async fn search(&self, query: &str) -> Result<Vec<AnimeSearchResult>, ScraperError>;
    async fn get_episodes(&self, anime_id: &str) -> Result<Vec<Episode>, ScraperError>;
    async fn get_streams(&self, episode_id: &str, server: Option<&str>) -> Result<Vec<StreamLink>, ScraperError>;
}

#[async_trait]
pub trait MangaProvider: Send + Sync {
    fn id(&self) -> &'static str;
    fn name(&self) -> &'static str;
    async fn search(&self, query: &str) -> Result<Vec<MangaSearchResult>, ScraperError>;
    async fn get_chapters(&self, manga_id: &str) -> Result<Vec<MangaChapter>, ScraperError>;
    async fn get_pages(&self, chapter_id_or_url: &str) -> Result<Vec<ChapterPage>, ScraperError>;
}

#[async_trait]
pub trait NovelProvider: Send + Sync {
    fn id(&self) -> &'static str;
    fn name(&self) -> &'static str;
    async fn search(&self, query: &str) -> Result<Vec<NovelSearchResult>, ScraperError>;
    async fn get_chapters(&self, novel_id: &str) -> Result<Vec<NovelChapter>, ScraperError>;
    async fn get_content(&self, chapter_id_or_url: &str) -> Result<NovelChapterContent, ScraperError>;
}


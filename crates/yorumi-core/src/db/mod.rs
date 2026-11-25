pub mod models;
pub mod schema;

use std::path::Path;
use std::sync::{Arc, Mutex};
use rusqlite::{params, Connection, Result};

pub use models::*;

#[derive(Clone)]
pub struct Database {
    conn: Arc<Mutex<Connection>>,
}

impl Database {
    pub fn open<P: AsRef<Path>>(path: P) -> Result<Self> {
        let conn = Connection::open(path)?;
        schema::init_database(&conn)?;
        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    pub fn open_in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory()?;
        schema::init_database(&conn)?;
        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    fn conn(&self) -> std::sync::MutexGuard<'_, Connection> {
        self.conn.lock().unwrap_or_else(|e| e.into_inner())
    }

    // --- Anime Watch Progress & History ---

    pub fn save_watch_progress(&self, p: &WatchProgress) -> Result<()> {
        let conn = self.conn();
        conn.execute(
            r#"
            INSERT INTO anime_history (
                anime_id, episode_id, episode_number, anime_title, anime_image,
                position_seconds, duration_seconds, last_watched
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            ON CONFLICT(anime_id, episode_id) DO UPDATE SET
                episode_number = excluded.episode_number,
                anime_title = excluded.anime_title,
                anime_image = excluded.anime_image,
                position_seconds = excluded.position_seconds,
                duration_seconds = excluded.duration_seconds,
                last_watched = excluded.last_watched
            "#,
            params![
                p.anime_id,
                p.episode_id,
                p.episode_number,
                p.anime_title,
                p.anime_image,
                p.position_seconds,
                p.duration_seconds,
                p.last_watched,
            ],
        )?;
        Ok(())
    }

    pub fn get_continue_watching(&self, limit: u32) -> Result<Vec<WatchProgress>> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            r#"
            SELECT anime_id, episode_id, episode_number, anime_title, anime_image,
                   position_seconds, duration_seconds, last_watched
            FROM anime_history
            GROUP BY anime_id
            HAVING last_watched = MAX(last_watched)
            ORDER BY last_watched DESC
            LIMIT ?1
            "#,
        )?;

        let rows = stmt.query_map(params![limit], |row| {
            Ok(WatchProgress {
                anime_id: row.get(0)?,
                episode_id: row.get(1)?,
                episode_number: row.get(2)?,
                anime_title: row.get(3)?,
                anime_image: row.get(4)?,
                position_seconds: row.get(5)?,
                duration_seconds: row.get(6)?,
                last_watched: row.get(7)?,
            })
        })?;

        let mut results = Vec::new();
        for r in rows {
            results.push(r?);
        }
        Ok(results)
    }

    pub fn get_anime_episode_history(&self, anime_id: &str) -> Result<Vec<String>> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            "SELECT episode_id FROM anime_history WHERE anime_id = ?1 ORDER BY episode_number ASC",
        )?;
        let rows = stmt.query_map(params![anime_id], |row| row.get(0))?;
        let mut results = Vec::new();
        for r in rows {
            results.push(r?);
        }
        Ok(results)
    }

    // --- Manga Read Progress & History ---

    pub fn save_read_progress(&self, p: &ReadProgress) -> Result<()> {
        let conn = self.conn();
        conn.execute(
            r#"
            INSERT INTO manga_history (
                manga_id, chapter_id, chapter_number, manga_title, manga_image,
                page_number, last_read
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
            ON CONFLICT(manga_id, chapter_id) DO UPDATE SET
                chapter_number = excluded.chapter_number,
                manga_title = excluded.manga_title,
                manga_image = excluded.manga_image,
                page_number = excluded.page_number,
                last_read = excluded.last_read
            "#,
            params![
                p.manga_id,
                p.chapter_id,
                p.chapter_number,
                p.manga_title,
                p.manga_image,
                p.page_number,
                p.last_read,
            ],
        )?;
        Ok(())
    }

    pub fn get_continue_reading(&self, limit: u32) -> Result<Vec<ReadProgress>> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            r#"
            SELECT manga_id, chapter_id, chapter_number, manga_title, manga_image,
                   page_number, last_read
            FROM manga_history
            GROUP BY manga_id
            HAVING last_read = MAX(last_read)
            ORDER BY last_read DESC
            LIMIT ?1
            "#,
        )?;

        let rows = stmt.query_map(params![limit], |row| {
            Ok(ReadProgress {
                manga_id: row.get(0)?,
                chapter_id: row.get(1)?,
                chapter_number: row.get(2)?,
                manga_title: row.get(3)?,
                manga_image: row.get(4)?,
                page_number: row.get(5)?,
                last_read: row.get(6)?,
            })
        })?;

        let mut results = Vec::new();
        for r in rows {
            results.push(r?);
        }
        Ok(results)
    }

    pub fn get_manga_chapter_history(&self, manga_id: &str) -> Result<Vec<String>> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            "SELECT chapter_id FROM manga_history WHERE manga_id = ?1 ORDER BY last_read ASC",
        )?;
        let rows = stmt.query_map(params![manga_id], |row| row.get(0))?;
        let mut results = Vec::new();
        for r in rows {
            results.push(r?);
        }
        Ok(results)
    }

    // --- Library Entries (Favorites & Lists) ---

    pub fn save_library_entry(&self, entry: &LibraryEntry) -> Result<()> {
        let conn = self.conn();
        let genres_json = serde_json::to_string(&entry.genres).unwrap_or_else(|_| "[]".to_string());
        conn.execute(
            r#"
            INSERT INTO library_entries (
                id, media_type, anilist_id, mal_id, scraper_id, title, image,
                status, score, current_progress, total_count, genres, added_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
            ON CONFLICT(id) DO UPDATE SET
                media_type = excluded.media_type,
                anilist_id = excluded.anilist_id,
                mal_id = excluded.mal_id,
                scraper_id = excluded.scraper_id,
                title = excluded.title,
                image = excluded.image,
                status = excluded.status,
                score = excluded.score,
                current_progress = excluded.current_progress,
                total_count = excluded.total_count,
                genres = excluded.genres,
                updated_at = excluded.updated_at
            "#,
            params![
                entry.id,
                entry.media_type,
                entry.anilist_id,
                entry.mal_id,
                entry.scraper_id,
                entry.title,
                entry.image,
                entry.status,
                entry.score,
                entry.current_progress,
                entry.total_count,
                genres_json,
                entry.added_at,
                entry.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn get_library_entries(
        &self,
        media_type: Option<&str>,
        status: Option<&str>,
    ) -> Result<Vec<LibraryEntry>> {
        let conn = self.conn();
        let mut query = "SELECT id, media_type, anilist_id, mal_id, scraper_id, title, image, status, score, current_progress, total_count, genres, added_at, updated_at FROM library_entries WHERE 1=1".to_string();

        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
        if let Some(mt) = media_type {
            query.push_str(" AND media_type = ?");
            params_vec.push(Box::new(mt.to_string()));
        }
        if let Some(st) = status {
            query.push_str(" AND status = ?");
            params_vec.push(Box::new(st.to_string()));
        }
        query.push_str(" ORDER BY updated_at DESC");

        let mut stmt = conn.prepare(&query)?;
        let rusqlite_params: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|b| b.as_ref()).collect();

        let rows = stmt.query_map(rusqlite_params.as_slice(), |row| {
            let genres_raw: String = row.get(11).unwrap_or_else(|_| "[]".to_string());
            let genres: Vec<String> = serde_json::from_str(&genres_raw).unwrap_or_default();

            Ok(LibraryEntry {
                id: row.get(0)?,
                media_type: row.get(1)?,
                anilist_id: row.get(2)?,
                mal_id: row.get(3)?,
                scraper_id: row.get(4)?,
                title: row.get(5)?,
                image: row.get(6)?,
                status: row.get(7)?,
                score: row.get(8)?,
                current_progress: row.get(9)?,
                total_count: row.get(10)?,
                genres,
                added_at: row.get(12)?,
                updated_at: row.get(13)?,
            })
        })?;

        let mut results = Vec::new();
        for r in rows {
            results.push(r?);
        }
        Ok(results)
    }

    pub fn remove_library_entry(&self, id: &str) -> Result<()> {
        let conn = self.conn();
        conn.execute("DELETE FROM library_entries WHERE id = ?1", params![id])?;
        Ok(())
    }

    // --- App Settings (Key-Value) ---

    pub fn get_setting(&self, key: &str) -> Result<Option<String>> {
        let conn = self.conn();
        let mut stmt = conn.prepare("SELECT value FROM app_settings WHERE key = ?1")?;
        let mut rows = stmt.query(params![key])?;
        if let Some(row) = rows.next()? {
            Ok(Some(row.get(0)?))
        } else {
            Ok(None)
        }
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<()> {
        let conn = self.conn();
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as i64;
        conn.execute(
            r#"
            INSERT INTO app_settings (key, value, updated_at) VALUES (?1, ?2, ?3)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
            "#,
            params![key, value, now],
        )?;
        Ok(())
    }

    // --- Downloaded Episodes Storage ---

    pub fn save_downloaded_episode(&self, ep: &DownloadedEpisode) -> Result<()> {
        let conn = self.conn();
        conn.execute(
            r#"
            INSERT INTO downloaded_episodes (
                id, anime_id, anime_title, anime_image, episode_number,
                episode_title, quality, audio, file_size, file_path,
                downloaded_at, is_hls, duration
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
            ON CONFLICT(id) DO UPDATE SET
                anime_title = excluded.anime_title,
                anime_image = excluded.anime_image,
                episode_number = excluded.episode_number,
                episode_title = excluded.episode_title,
                quality = excluded.quality,
                audio = excluded.audio,
                file_size = excluded.file_size,
                file_path = excluded.file_path,
                downloaded_at = excluded.downloaded_at,
                is_hls = excluded.is_hls,
                duration = excluded.duration
            "#,
            params![
                ep.id,
                ep.anime_id,
                ep.anime_title,
                ep.anime_image,
                ep.episode_number,
                ep.episode_title,
                ep.quality,
                ep.audio,
                ep.file_size,
                ep.file_path,
                ep.downloaded_at,
                ep.is_hls.map(|h| if h { 1 } else { 0 }),
                ep.duration,
            ],
        )?;
        Ok(())
    }

    pub fn get_downloaded_episodes(&self) -> Result<Vec<DownloadedEpisode>> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            r#"
            SELECT id, anime_id, anime_title, anime_image, episode_number,
                   episode_title, quality, audio, file_size, file_path,
                   downloaded_at, is_hls, duration
            FROM downloaded_episodes
            ORDER BY downloaded_at DESC
            "#,
        )?;

        let rows = stmt.query_map([], |row| {
            let is_hls_num: Option<i32> = row.get(11)?;
            Ok(DownloadedEpisode {
                id: row.get(0)?,
                anime_id: row.get(1)?,
                anime_title: row.get(2)?,
                anime_image: row.get(3)?,
                episode_number: row.get(4)?,
                episode_title: row.get(5)?,
                quality: row.get(6)?,
                audio: row.get(7)?,
                file_size: row.get(8)?,
                file_path: row.get(9)?,
                downloaded_at: row.get(10)?,
                is_hls: is_hls_num.map(|n| n == 1),
                duration: row.get(12)?,
            })
        })?;

        let mut results = Vec::new();
        for r in rows {
            results.push(r?);
        }
        Ok(results)
    }

    pub fn get_downloaded_episode(
        &self,
        anime_id: &str,
        episode_number: f32,
    ) -> Result<Option<DownloadedEpisode>> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            r#"
            SELECT id, anime_id, anime_title, anime_image, episode_number,
                   episode_title, quality, audio, file_size, file_path,
                   downloaded_at, is_hls, duration
            FROM downloaded_episodes
            WHERE anime_id = ?1 AND episode_number = ?2
            LIMIT 1
            "#,
        )?;

        let mut rows = stmt.query(params![anime_id, episode_number])?;
        if let Some(row) = rows.next()? {
            let is_hls_num: Option<i32> = row.get(11)?;
            Ok(Some(DownloadedEpisode {
                id: row.get(0)?,
                anime_id: row.get(1)?,
                anime_title: row.get(2)?,
                anime_image: row.get(3)?,
                episode_number: row.get(4)?,
                episode_title: row.get(5)?,
                quality: row.get(6)?,
                audio: row.get(7)?,
                file_size: row.get(8)?,
                file_path: row.get(9)?,
                downloaded_at: row.get(10)?,
                is_hls: is_hls_num.map(|n| n == 1),
                duration: row.get(12)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn delete_downloaded_episode(
        &self,
        anime_id: &str,
        episode_number: f32,
    ) -> Result<Option<String>> {
        let conn = self.conn();
        let path: Option<String> = {
            let mut stmt = conn.prepare(
                "SELECT file_path FROM downloaded_episodes WHERE anime_id = ?1 AND episode_number = ?2",
            )?;
            let mut rows = stmt.query(params![anime_id, episode_number])?;
            if let Some(row) = rows.next()? {
                Some(row.get(0)?)
            } else {
                None
            }
        };

        if path.is_some() {
            conn.execute(
                "DELETE FROM downloaded_episodes WHERE anime_id = ?1 AND episode_number = ?2",
                params![anime_id, episode_number],
            )?;
        }
        Ok(path)
    }

    // --- Persistent KV Cache (Stale-While-Revalidate) ---

    /// Returns `(payload, is_fresh)` if present in SQLite cache.
    pub fn get_cache_entry(&self, key: &str) -> Result<Option<(String, bool)>> {
        let conn = self.conn();
        let now_secs = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;
        let mut stmt = conn.prepare(
            "SELECT payload, fetched_at, ttl_secs FROM kv_cache WHERE cache_key = ?1",
        )?;
        let mut rows = stmt.query(params![key])?;
        if let Some(row) = rows.next()? {
            let payload: String = row.get(0)?;
            let fetched_at: i64 = row.get(1)?;
            let ttl_secs: i64 = row.get(2)?;
            let is_fresh = (now_secs - fetched_at) < ttl_secs;
            Ok(Some((payload, is_fresh)))
        } else {
            Ok(None)
        }
    }

    pub fn set_cache_entry(&self, key: &str, payload: &str, ttl_secs: u64) -> Result<()> {
        let conn = self.conn();
        let now_secs = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;
        conn.execute(
            r#"
            INSERT INTO kv_cache (cache_key, payload, fetched_at, ttl_secs)
            VALUES (?1, ?2, ?3, ?4)
            ON CONFLICT(cache_key) DO UPDATE SET
                payload = excluded.payload,
                fetched_at = excluded.fetched_at,
                ttl_secs = excluded.ttl_secs
            "#,
            params![key, payload, now_secs, ttl_secs as i64],
        )?;
        Ok(())
    }

    pub fn prune_expired_cache(&self, max_stale_secs: u64) -> Result<usize> {
        let conn = self.conn();
        let now_secs = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;
        let deleted = conn.execute(
            "DELETE FROM kv_cache WHERE (?1 - fetched_at) > (ttl_secs + ?2)",
            params![now_secs, max_stale_secs as i64],
        )?;
        Ok(deleted)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_database_lifecycle() {
        let db = Database::open_in_memory().unwrap();

        // 1. Watch Progress
        let wp = WatchProgress {
            anime_id: "one-piece".to_string(),
            episode_id: "ep-1".to_string(),
            episode_number: 1.0,
            anime_title: Some("One Piece".to_string()),
            anime_image: None,
            position_seconds: 120.0,
            duration_seconds: 1440.0,
            last_watched: 1000,
        };
        db.save_watch_progress(&wp).unwrap();

        let continue_watching = db.get_continue_watching(10).unwrap();
        assert_eq!(continue_watching.len(), 1);
        assert_eq!(continue_watching[0].anime_id, "one-piece");
        assert_eq!(continue_watching[0].position_seconds, 120.0);

        let history = db.get_anime_episode_history("one-piece").unwrap();
        assert_eq!(history, vec!["ep-1"]);

        // 2. Library Entry
        let entry = LibraryEntry {
            id: "one-piece".to_string(),
            media_type: "anime".to_string(),
            anilist_id: Some("21".to_string()),
            mal_id: Some("21".to_string()),
            scraper_id: Some("one-piece-100".to_string()),
            title: "One Piece".to_string(),
            image: Some("https://img.example.com/op.jpg".to_string()),
            status: "watching".to_string(),
            score: Some(9.5),
            current_progress: Some(1.0),
            total_count: Some(1100),
            genres: vec!["Action".to_string(), "Adventure".to_string()],
            added_at: 1000,
            updated_at: 1000,
        };
        db.save_library_entry(&entry).unwrap();

        let entries = db.get_library_entries(Some("anime"), Some("watching")).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].title, "One Piece");
        assert_eq!(entries[0].genres, vec!["Action", "Adventure"]);

        // 3. App Settings
        db.set_setting("theme", "dark").unwrap();
        assert_eq!(db.get_setting("theme").unwrap(), Some("dark".to_string()));

        // 4. Persistent SWR KV Cache
        db.set_cache_entry("home:trending", r#"{"ok":true}"#, 300).unwrap();
        let (payload, is_fresh) = db.get_cache_entry("home:trending").unwrap().unwrap();
        assert_eq!(payload, r#"{"ok":true}"#);
        assert!(is_fresh);
    }
}


use rusqlite::{Connection, Result};

pub fn init_database(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        r#"
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS anime_history (
            anime_id TEXT NOT NULL,
            episode_id TEXT NOT NULL,
            episode_number REAL NOT NULL,
            anime_title TEXT,
            anime_image TEXT,
            position_seconds REAL DEFAULT 0.0,
            duration_seconds REAL DEFAULT 0.0,
            last_watched INTEGER NOT NULL,
            PRIMARY KEY (anime_id, episode_id)
        );

        CREATE INDEX IF NOT EXISTS idx_anime_history_last_watched
            ON anime_history (last_watched DESC);

        CREATE TABLE IF NOT EXISTS manga_history (
            manga_id TEXT NOT NULL,
            chapter_id TEXT NOT NULL,
            chapter_number TEXT NOT NULL,
            manga_title TEXT,
            manga_image TEXT,
            page_number INTEGER DEFAULT 1,
            last_read INTEGER NOT NULL,
            PRIMARY KEY (manga_id, chapter_id)
        );

        CREATE INDEX IF NOT EXISTS idx_manga_history_last_read
            ON manga_history (last_read DESC);

        CREATE TABLE IF NOT EXISTS novel_history (
            novel_id TEXT NOT NULL,
            chapter_id TEXT NOT NULL,
            novel_title TEXT,
            chapter_number REAL DEFAULT 1.0,
            last_read INTEGER NOT NULL,
            PRIMARY KEY (novel_id, chapter_id)
        );

        CREATE INDEX IF NOT EXISTS idx_novel_history_last_read
            ON novel_history (last_read DESC);

        CREATE TABLE IF NOT EXISTS library_entries (
            id TEXT PRIMARY KEY,
            media_type TEXT NOT NULL,
            anilist_id TEXT,
            mal_id TEXT,
            scraper_id TEXT,
            title TEXT NOT NULL,
            image TEXT,
            status TEXT NOT NULL,
            score REAL,
            current_progress REAL DEFAULT 0.0,
            total_count INTEGER,
            genres TEXT,
            added_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_library_entries_type_status
            ON library_entries (media_type, status);

        CREATE INDEX IF NOT EXISTS idx_library_entries_updated_at
            ON library_entries (updated_at DESC);

        CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS downloaded_episodes (
            id TEXT PRIMARY KEY,
            anime_id TEXT NOT NULL,
            anime_title TEXT NOT NULL,
            anime_image TEXT,
            episode_number REAL NOT NULL,
            episode_title TEXT,
            quality TEXT,
            audio TEXT,
            file_size INTEGER,
            file_path TEXT NOT NULL,
            downloaded_at INTEGER NOT NULL,
            is_hls INTEGER DEFAULT 0,
            duration REAL DEFAULT 0.0
        );

        CREATE INDEX IF NOT EXISTS idx_downloaded_episodes_anime_id
            ON downloaded_episodes (anime_id);

        CREATE TABLE IF NOT EXISTS kv_cache (
            cache_key TEXT PRIMARY KEY,
            payload TEXT NOT NULL,
            fetched_at INTEGER NOT NULL,
            ttl_secs INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_kv_cache_fetched_at
            ON kv_cache (fetched_at);
        "#,
    )?;

    Ok(())
}


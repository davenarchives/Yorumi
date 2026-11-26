pub mod commands;
pub mod media;
pub mod state;

pub use yorumi_core::{db, downloader, scrapers};

use state::AppState;
use tauri::{Emitter, Manager};

const YT_HUD_CLEANER_SCRIPT: &str = r#"
(function () {
  try {
    if (location.hostname !== 'www.youtube-nocookie.com' || !location.pathname.startsWith('/embed/')) return;
    var css = '.ytp-bezel,.ytp-bezel-text-wrapper,.ytp-bezel-icon,.ytp-doubletap-ui-legacy,.ytp-chrome-top,.ytp-chrome-bottom,.ytp-gradient-top,.ytp-gradient-bottom,.ytp-pause-overlay,.ytp-pause-overlay-container,.ytp-cued-thumbnail-overlay,.ytp-large-play-button,.ytp-watermark,.ytp-title,.ytp-show-cards-title,.player-controls-content,.player-controls-middle,.player-controls-top,.player-controls-bottom,.player-controls-background,.player-controls-background-container,ytm-custom-control,.ytm-autonav-overlay,.c3-overlay,.icon-button.player-control-play-pause-icon{display:none!important;opacity:0!important;visibility:hidden!important;pointer-events:none!important;}';
    var inject = function () {
      if (document.getElementById('yorumi-yt-hud-hide')) return;
      var root = document.head || document.documentElement;
      if (!root) return;
      var s = document.createElement('style');
      s.id = 'yorumi-yt-hud-hide';
      var nonceEl = document.querySelector('style[nonce],script[nonce]');
      if (nonceEl && nonceEl.nonce) s.nonce = nonceEl.nonce;
      s.textContent = css;
      root.appendChild(s);
    };
    inject();
    document.addEventListener('DOMContentLoaded', inject, { once: true });
  } catch (_) {}
})();
"#;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri::plugin::Builder::<tauri::Wry, ()>::new("youtube-hud-cleaner")
                .js_init_script(YT_HUD_CLEANER_SCRIPT)
                .build(),
        )
        .setup(|app| {
            #[cfg(mobile)]
            let db_path = Some(app.path().app_data_dir()?.join("yorumi.db"));
            #[cfg(not(mobile))]
            let db_path = None;

            #[cfg(mobile)]
            let downloads_dir = Some(app.path().app_data_dir()?.join("downloads").join("Anime"));
            #[cfg(not(mobile))]
            let downloads_dir = None;

            let app_state = AppState::new(db_path, downloads_dir)
                .map_err(|e| -> Box<dyn std::error::Error> { e })?;

            // Forward core broadcast download events to Tauri frontend listeners.
            let mut progress_rx = app_state.downloader.subscribe();
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                while let Ok(progress) = progress_rx.recv().await {
                    let _ = handle.emit("download-progress", &progress);
                }
            });

            app.manage(app_state);
            #[cfg(not(mobile))]
            app.manage(commands::discord::DiscordState::default());
            Ok(())
        })
        .register_asynchronous_uri_scheme_protocol("yorumi-media", move |ctx, request, responder| {
            let client = ctx.app_handle().state::<AppState>().client.client().clone();
            media::handle_media_protocol(client, request, responder);
        })
        .invoke_handler(tauri::generate_handler![
            // Native HTTP (scraper adapters)
            commands::http::http_fetch_text,
            commands::http::http_fetch_post,
            // Anime
            commands::anime::search_anime,
            commands::anime::get_anime_episodes,
            commands::anime::get_anime_streams,
            // Manga
            commands::manga::search_manga,
            commands::manga::get_manga_chapters,
            commands::manga::get_manga_pages,
            // Novel
            commands::novel::search_novels,
            commands::novel::get_novel_chapters,
            commands::novel::get_novel_content,
            // AniList
            commands::anilist::anilist_get_trending,
            commands::anilist::anilist_get_popular,
            commands::anilist::anilist_search,
            commands::anilist::anilist_get_media,
            // Storage & Persistence
            commands::storage::db_save_watch_progress,
            commands::storage::db_get_continue_watching,
            commands::storage::db_get_anime_history,
            commands::storage::db_save_read_progress,
            commands::storage::db_get_continue_reading,
            commands::storage::db_get_manga_history,
            commands::storage::db_save_library_entry,
            commands::storage::db_get_library_entries,
            commands::storage::db_remove_library_entry,
            commands::storage::db_get_setting,
            commands::storage::db_set_setting,
            // Downloads & Offline
            commands::download::start_download,
            commands::download::get_local_downloads,
            commands::download::get_local_download,
            commands::download::delete_local_download,
            commands::download::open_downloads_folder,
            commands::reading_export::export_manga_chapter,
            commands::reading_export::export_novel_chapter,
            commands::reading_export::delete_reading_export,
            #[cfg(not(mobile))]
            commands::discord::update_discord_presence,
            #[cfg(not(mobile))]
            commands::discord::clear_discord_presence,
            #[cfg(not(mobile))]
            commands::updater::install_desktop_update,
        ])
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}

Yorumi **v5.0.0** is a major cross-platform milestone — built with a native **Tauri v2** desktop shell, upgraded **Android APK**, redesigned **Library & Explore** experience, live **Global Chat**, automatic **Discord Cloud Sync**, and an in-app **Auto-Updater**.

## New Features
- **Explore Trailer Feed**: Added a TikTok-style vertical anime trailer feed with personalized recommendations across classics, hidden gems, and rotating genres, plus full-screen tap play/pause, double-tap heart likes, and long-press **2x speed**.
- **Discord Cloud Sync (PC & Android)**: Sign in with Discord to automatically sync your continue watching, episode/chapter history, watchlist, favorites, custom library categories, activity heatmap, and watch time across devices via Neon Postgres.
- **Global Chat & Live Now Watching**: Added a live Global Discord Chat drawer across desktop and mobile with Discord OAuth2 sign-in, live create/edit/delete sync, and clickable `▸ Now Watching` links that jump straight to the exact episode and timestamp.
- **Unified In-App Auto-Updater**: Added automatic GitHub Releases update checks with a Mihon-style changelog modal on Desktop and Android, streaming direct `.exe` / `.dmg` / `.AppImage` / `.apk` updates with live progress.
- **Browse Anime Catalogue**: Added `/anime/browse` with multi-select genres, tags, format, season, year, status, rating filters, shuffle, infinite scroll, and a draggable mobile filter bottom sheet.
- **Library Profile, Activity Heatmap & Public Profiles**: Added a full-screen widescreen backdrop, 26-week Activity contribution heatmap, daily streak, accurate watch hours, Top Genres breakdown, custom categories (`Watchlist`, `Favorites`, and user lists), and Neon-backed User Search (`/user/:uid`).
- **Watchlist Episode Notifications & Discord Community Modal**: Added a live Watchlist Episode Updates bell and an animated Discord invite popup across desktop and mobile.
- **Multi-Language & Auto-Translated Subtitles**: Replaced fragile native `<track>` rendering with a deterministic WebVTT/SRT/ASS cue renderer supporting all native subtitle tracks plus 15+ on-demand translated languages.

## Changes
- **Unified Desktop & Mobile Video Player**: Unified desktop and mobile player controls with `-10s` / `Play-Pause` / `+10s`, dedicated server selector, frosted-glass subtitle dropdown, and fullscreen slide-over episodes drawer.
- **Redesigned Mobile Search (`/search`)**: Added a full-page mobile search UI with recent searches, progressive per-source streaming results, typo suggestions (`Did you mean ...?`), User Search, and personalized **You may like** recommendations.
- **Light & Web Novel Sources**: Migrated Light Novel scraping to **AllNovelFull** and **NovelFire** with verified AniList artwork and background next-chapter prefetching.
- **Redesigned Website & Docs**: Overhauled `yorumi.vercel.app` with animated feature illustrations, mobile & 2-row desktop showcase marquees, live GitHub download counter, sticky Docs/Changelogs navigation, and direct `v5.0.0` installer links.

## Improvements
- **Faster Manga & LN Readers**: Added a 6-worker parallel page preloader, immutable 24h image caching in Rust `yorumi-media`, and instant home section preloading on startup.
- **Offline Downloads on Desktop & Android**: Upgraded Tauri Rust HLS downloader and Android native downloads with parallel server racing, offline metadata/thumbnails, and self-contained offline VTT subtitles.
- **Smarter AniList Pacing & Fallbacks**: Added global request pacing and cached fallbacks to prevent `429` rate-limit failures during browsing and Explore sessions.
- **Seamless Android Launch & Navigation**: Updated the Android splash screen to match Yorumi's brand purple without an icon container, refined mobile spotlight swiping, and added pull-to-refresh cloud sync.

## Fixes
- **Phone ↔ PC Sync Cache Refresh**: Fixed an in-memory storage cache issue where newly pulled cloud sync data didn't appear until app restart, and added automatic foreground pull when switching back to an open app.
- **Accurate Hours Watched**: Fixed Library watch-hour inflation caused by multiplying episode/chapter numbers instead of using real tracked watch seconds and completed episode/chapter history.
- **Explore Mobile Pause & Desktop Loading**: Fixed mobile trailers blacking out when paused, fixed invalid `seasonYear_lesser` Explore queries on desktop, and ensured clean vertical scroll snapping.
- **Season & Sequel Matching**: Fixed Season 1 episodes mistakenly resolving to Season 2 streams, fixed Trending Now watchlist `+` for TMDB entries, and deduplicated Continue Watching / Continue Reading entries across AniList and MAL IDs.
- **Quota Safety**: Fixed a `localStorage.clear()` bug in `mangaService.ts` so quota cleanup only prunes volatile caches and never touches user history or sessions.
- **Mobile Download Controls**: Fixed status-bar overlap on mobile Details headers and made touch download buttons visible and reliably tappable across Anime, Manga, and Light Novels.

## Removals
- **Removed Firebase**: Completely removed Firebase Auth/Firestore dependencies in favor of lightweight Discord OAuth2 + Neon Postgres sync.
- **Removed Yumi AI Chatbot**: Removed the unused Yumi chatbot pages, routes, and services.
- **Removed MangaDex Fallback**: Streamlined manga reading to use MangaKatana exclusively with reliable proxy MIME detection.
- **Codebase Cleanup**: Removed dead frontend/backend modules and unused bundled assets (~1.44 MB trimmed).

## Under the hood
- **Shared Pure-Rust Engine (`crates/yorumi-core`)**: Extracted scrapers, SQLite WAL `kv_cache`, TMDB artwork cache, HLS `DownloadManager`, and local `127.0.0.1` media proxy into a root Cargo workspace with `src-tauri` as a thin desktop adapter.
- **CI/CD Tauri + Android Pipelines**: Updated GitHub Actions release workflows to build and publish normalized `Yorumi.exe`, `Yorumi.dmg`, `Yorumi.AppImage`, and signed `Yorumi.apk` assets directly to GitHub Releases.

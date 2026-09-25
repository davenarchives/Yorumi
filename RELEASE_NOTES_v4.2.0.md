# Yorumi v4.2.0

Yorumi 4.2 is the first mobile-focused release of the new cross-platform experience. It adds a standalone Android application and APK release automation, rebuilds the compact mobile browsing and playback experience, and substantially hardens Anime, Manga, and Light Novel sources.

## Mobile apps

- Added a standalone Capacitor Android application that can browse Anime through AniList and resolve HiAnime streams directly on-device without a locally running Yorumi backend.
- Added official adaptive Android launcher icons and branded splash assets across all density buckets.
- Replaced the mobile player's hardcoded CSS rotation with native screen-orientation locking and reliable fullscreen cleanup.
- Added GitHub Actions packaging for signed Android APK releases using the same `npm run android:build:release` command used locally.
- Added device-safe layouts for status bars, display cutouts, navigation bars, and edge-to-edge media surfaces.

## Offline Library and downloads

- Added downloadable Anime episodes, Manga chapters, and Light Novel chapters backed by local IndexedDB storage.
- Added offline playback for downloaded Anime, including locally cached subtitle tracks.
- Added offline Manga page reading and Light Novel chapter reading.
- Unified downloaded and saved titles in My Library while preserving the normal details routes and synopsis metadata.
- Online Library cards now retain full known episode/chapter totals instead of replacing them with the downloaded count.
- Offline Library mode automatically shows only titles with local content and displays the locally available count.
- Fixed Android HLS downloads forwarding the phone-local `127.0.0.1:18765` proxy address to the backend, which caused `ECONNREFUSED`.
- Fixed native proxy HLS detection and preserved resolved stream types during downloads.
- Made the complete My Library header and media selector sticky while keeping it below Android system-tray icons.

## Anime browsing and details

- Rebuilt Anime home discovery with fast cached AniList/TMDB data and resilient empty-result recovery.
- Redesigned mobile Anime details to match Manga and Light Novel details with a compact hero, metadata, genres, seasons, episode artwork, and synopsis previews.
- Added movie playback as one complete playable entry without synthetic episode numbering or an Episodes heading.
- Added compact mobile episode sorting, list/grid switching, download-all controls, and predictable back navigation.
- Fixed search cards opening a black screen by normalizing route state for Anime, Manga, and Light Novels.
- Improved title matching and rejected unrelated scraper results across providers.

## Manga and Light Novels

- Restored readable Manga chapters across home sections by resolving visible AniList records to MangaKatana IDs and chapter catalogs.
- Changed Manga spotlight selection to MangaKatana hot updates, matching Electron instead of using AniList selection or unrelated fallbacks.
- Fixed missing Manga spotlight slides, unknown metadata, pixelated artwork, and expensive preloading that starved chapter requests.
- Added progressive Manga spotlight detail hydration without blocking the initial page render.
- Expanded NovelBin and AllNovelFull chapter discovery beyond their former 30/50 chapter limits.
- Added request coalescing, pacing, and bounded retry handling for NovelBin HTTP 429 responses.
- Added a native adaptive scraper fallback for upstream DOM/class-name changes.
- Improved Manga page ordering, eager first-page loading, and background sequential preloading.
- Stabilized Light Novel chapter loading and aligned its mobile reader header, selector, and navigation controls.

## Mobile interface

- Unified Anime, Manga, and Light Novel mobile home layouts, section headers, cards, metadata pills, and chapter headings.
- Rebuilt all three mobile spotlights as swipeable, edge-to-edge, artwork-first presentations with complete metadata.
- Added Anime spotlight autoplay and airing countdowns.
- Refined Top Trending for narrow screens with clearer ranks and larger poster thumbnails.
- Added expandable synopsis treatment and consistent genre chips to every media details page.
- Fixed sticky search behavior and page-transition transforms on Android.

## Player and streaming

- Added a dedicated Android fullscreen player with native landscape orientation and a mobile episode sheet.
- Added tap-to-toggle controls and YouTube-style press-and-hold 2x playback anywhere on the video, hiding controls while active.
- Centered transport controls and fixed undersized controls after leaving fullscreen.
- Added subtitle language discovery, selection, direct single-track toggling, and responsive caption positioning.
- Added strict Sub/Dub separation, Sub-first selection, and reliable switching without stale streams.
- Added automatic provider failover, playback watchdog recovery, and strict episode matching to prevent playing the wrong episode.
- Added direct HLS providers and hardened HiAnime/Frieren, AniKoto/Stark, AnimeGG/Fern, and ReAnime/Himmel resolution.
- Fixed Android WebView HLS black screens by consistently routing native streams through hls.js and the on-device media proxy.
- Fixed stale completed positions resuming at the end and immediately advancing episodes.
- Hardened playlist, key, subtitle, and segment proxy rewriting across Android and Electron.

## Desktop and backend

- Preserved the existing Windows, macOS, and Linux Electron release matrix.
- Restored the packaged Electron preload bridge and Discord Rich Presence integration.
- Bundled scraper browser dependencies correctly for packaged Electron builds.
- Improved Express 5 route compatibility, backend startup, cache invalidation, and scraper error recovery.
- Added structured download directories and reliable playback/server recovery on desktop.

## Packaging notes

- Android package: `com.yorumi.app`, version code `420`, version name `4.2.0`.
- Offline media remains private app data. Uninstalling the app or clearing its storage removes downloads.
- Source websites may change or restrict access; download availability still depends on the selected source being reachable when the download starts.

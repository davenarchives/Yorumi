# Changelog

## [Unreleased]

## [5.0.6] - 2026-11-26

- Added Mihon-style seamless multi-chapter long-strip streaming (`PageViewer.tsx`, `MangaReaderModal/index.tsx`, `MangaReaderPage.tsx`, `useManga.ts`): chapters flow continuously back-to-back with `Finished / Next` transition banners so readers can scroll forward or back up across chapters without reloads or jumps, paired with immediate tap-time chapter warming (`MangaDetailsPage.tsx`) and a 4-worker rolling page preloader.
- Added Manga Reading Settings & 60fps interactive scroll-snap Paged modes (`ReaderHeader.tsx`, `MangaReaderModal/index.tsx`, `PageViewer.tsx`): added a top-right Settings sheet with 6 reading modes (`Default`, `Paged (left to right)`, `Paged (right to left)`, `Paged (vertical)`, `Long strip`, `Long strip with gaps`), native finger-drag scroll-snap swiping in all Paged modes, mobile zoom controls, and a dynamic outlined bottom-center `current / total` page indicator that hides when reader bars are visible.
- Fixed manga chapter read-state tracking (`storage.ts`, `useManga.ts`, `MangaReaderPage.tsx`, `MangaDetailsPage.tsx`): resolved the initial mount race where opening a chapter via `routeChapter` skipped marking it as read, unified read history across all manga IDs (`mal_id`, `id`, `scraper_id`, stripped `mk:` slugs), and synced details/reader read sets on storage and offline-history restore events.
- Fixed cross-manga and cross-LN offline download collisions (`mangaDownloadService.ts`, `lnDownloadService.ts`, `useManga.ts`): removed unsafe bare `chapterId` fallbacks so downloaded chapters are strictly scoped to their series identity, and eliminated multi-second blob-URL stalls when opening undownloaded chapters.
- Kept download/downloaded icons at full brightness on read Manga and Light Novel chapters (`MangaDetailsPage.tsx`, `LNDetailsPage.tsx`), and updated the marketing website (`website/`) to `v5.0.6` with changelogs and release links.

## [5.0.5] - 2026-11-26

- Added durable offline History persistence (`src/services/offlineHistoryStore.ts`, `storage.ts`, `useContinueWatching.ts`, `useContinueReading.ts`, `useContinueLNReading.ts`, `useActivityHistory.ts`, `MenuPages.tsx`, `main.tsx`): mirrored all watch/read/LN/activity/search history keys into IndexedDB (`yorumi_offline_history_v1`) with automatic boot hydration, increased retention from 20 to 200 items, and cached history posters locally.
- Added full offline Library persistence across Desktop and Android (`offlineImageCache.ts`, `offlineLibraryCache.ts`, `LibraryPage.tsx`, `ReadingDetailsHero.tsx`, `MangaDetailsPage.tsx`, `LNDetailsPage.tsx`): prefetched posters across all three tabs (`Anime`, `Manga`, `LN`), fixed CORS/hotlink-blocked MangaKatana/NovelFire image caching via Tauri `yorumi-media` referer forwarding, background-cached Manga & LN metadata + chapter lists while online, hydrated `ReadingDetailsHero` covers/backdrops from offline cache, and kept the full Library browsable offline.
- Added TikTok-style mobile menu drawer & pages (`MobileMenuDrawer.tsx`, `ModeStatusBanner.tsx`, `MenuPages.tsx`, `Sidebar.tsx`, `AppRoutes.tsx`, `appPrefs.ts`): zero-bounce whole-screen + navbar slide, `Downloaded only` & `Incognito mode` toggles, tabbed `Download queue` (`Anime | Manga | LN`), date-grouped `History`, `Statistics`, `Data and storage` with Discord Cloud Sync, `Global chat`, `Settings`, and cleaned-up `About`.
- Added native Android episode update push notifications (`DownloadNotificationService.java`, `DownloadNotificationPlugin.java`, `downloadNotification.ts`, `useWatchlistNotifications.ts`) with deep-linking to `/anime/details/al-<id>`.
- Added smooth 60fps Explore swipe-left to real `AnimeDetailsPage` (`ExplorePage.tsx`, `AnimeDetailsPage.tsx`, `screenShift.ts`, `App.tsx`) with preloaded metadata, deferred episode loading, and single-active YouTube iframe optimization, plus static pull-to-refresh navbar (`MobilePullToRefresh.tsx`, `src/index.css`).
- Fixed Android & Desktop anime downloads (`AnimeDetailsPage.tsx`, `DetailsEpisodeGrid.tsx`, `NativeDownloadStoragePlugin.java`, `nativeDownloadStorage.ts`, `downloadService.ts`, `useDownloads.ts`): passed `malId` + `altTitles` for stream resolution, added 720p mobile cap, `403`/`401` header fallback, and real native cancellation.
- Updated marketing website (`website/src/App.tsx`, `website/src/Documentation.tsx`) with left-aligned mobile layout, single-row hero CTA buttons, jitter-free live download counter, and `v5.0.5` changelog & download links.
- Fixed slow mobile episode rendering (`AnimeDetailsPage.tsx`, `anilistAnime.ts`) and empty Studio pages (`anilistAnime.ts`, `nativeHttp.ts`, `studioCatalogue.ts`); added Yorumi NSIS setup icon (`tauri.conf.json`), Windows silent update auto-relaunch (`updater.rs`), and Android in-app APK download + native package installer (`NativeDownloadStoragePlugin.java`, `nativeDownloadStorage.ts`, `useAppUpdater.ts`, `AndroidManifest.xml`).

## [5.0.0] - 2026-11-25

- Added TikTok-style mobile Explore gestures (`src/pages/ExplorePage.tsx`, `src/index.css`): full-screen tap to play/pause (including above and below the 16:9 trailer), double-tap anywhere to like with an animated rose heart burst, long-press for `2x` playback speed with the anime-player `2x` pill, and fixed paused mobile trailers blacking out instead of freezing on the current frame.
- Added the animated Discord community modal (`src/components/shared/DiscordInviteModal.tsx`, `DesktopTitleBar.tsx`, `Sidebar.tsx`) and Discord invite button across desktop, mobile, and the marketing website.
- Fixed Phone ↔ PC Discord Cloud Sync (`src/services/cloudSyncService.ts`, `src/utils/storage.ts`) by invalidating `storageMemoryCache` immediately when applying pulled Neon data and adding throttled foreground pulls on `visibilitychange`, and fixed inflated Library watch hours (`LibraryProfileOverview.tsx`) to use actual tracked watch seconds and watched episode/chapter history instead of multiplying raw episode/chapter numbers.
- Updated `website/` with a 2-row opposite-direction cropped desktop showcase marquee, sticky header on Docs & Changelogs, slower live GitHub download counter starting from 500, and `v5.0.0` release links & changelog; updated `README.md` and CI/CD workflows (`.github/workflows/release.yml`, `.github/workflows/mobile-release.yml`) for `v5.0.0` Tauri + Android releases.
- Improved Explore trailer playback by preparing the next three trailers and removing playback and category overlays, hiding the feed scrollbar, and cropping embedded player chrome.

- Revamped the Yorumi marketing website (`website/src/App.tsx`, `website/src/index.css`) with a Tarsi-inspired landing page layout while keeping Yorumi's sakura/lavender light & dark theme: clean top navbar with solid `Download Yorumi` CTA, split hero with inline keyword pills + tilted app preview frame with the Yorumi mascot popping out, 3 squircle feature cards, horizontal screenshot strip with lightbox modal, cross-platform `Included, not extra` highlight card, centered `Start watching today.` closer CTA, community strip, and multi-column footer (preserving `v4.3.0` downloads, CLI install commands, and Documentation).
- Sped up Search across mobile and desktop (`SearchPage.tsx`, `src/features/search/api.ts`, `useNavbarSearch.ts`, `SearchModal.tsx`, `userService.ts`): replaced blocking `Promise.all` on mobile `/search` with progressive per-source streaming so fast AniList Anime/Manga results appear immediately without waiting on NovelBin scraping or Render cold starts, added a shared 3-minute in-memory preview cache with in-flight deduplication, reduced search debounce from `280ms` to `180ms`, bounded slow Manga scraper / User Search requests with timeouts, and stopped wasted background Anime searches when `SearchModal` is in User Search mode.
- Made `AnimeBrowsePage.tsx` mobile-friendly: tightened mobile hero height and top spacing, compacted sort tabs onto a single horizontal row, replaced the 4-row wrapping filter pills on mobile with a compact `Filters` pill + removable active filter chips + `Shuffle` row backed by a native-style filter bottom sheet (desktop filter bar preserved).
- Unified public user profile page (`/user/:uid` in `UserProfilePage.tsx`, `LibraryPage.tsx`, `LibraryProfileOverview.tsx`, `userService.ts`, `backend/src/api/sync/sync.routes.ts`) to render the exact same read-only Library interface (backdrop, avatar, Activity + Top Genres overview, `[Anime | Manga | LN]` switcher, custom categories, search/sort/display options, and clickable cards) without edit/delete controls.
- Pointed Cloud Sync and User Search (`src/services/cloudSyncService.ts`, `src/services/userService.ts`) to the hosted Render service (`https://yorumibot-1.onrender.com/api` by default, overridable via `VITE_SYNC_API_URL`) so standalone `.exe` and `.apk` builds sync and search users out-of-the-box without bundling any database credentials.
- Removed the icon container from the Android splash screen (`android/app/src/main/res/drawable-nodpi/splash_icon.png`, `drawable/splash_bg.xml`, `values/styles.xml`, `values-v31/styles.xml`): replaced `@mipmap/ic_launcher_foreground` on the launch theme with a transparent moon-and-cat cutout centered directly on the purple `@color/ic_launcher_background` with `windowSplashScreenIconBackgroundColor` set to transparent, keeping the home-screen launcher icon unchanged.
- Added Neon-backed User Search across backend, Library desktop search, and mobile `/search` (`backend/src/api/sync/sync.routes.ts`, `src/services/userService.ts`, `Sidebar.tsx`, `SearchModal.tsx`, `SearchPage.tsx`): exposed `GET /api/sync/users` and `GET /api/sync/users/:uid` backed by Neon Postgres (`yorumi_users` + `yorumi_library_sync`), switched desktop Sidebar Search to User Search when on `/library`, and added a **Users** results section to mobile `/search`.
- Added unified Mihon-style `AppUpdateModal` across Mobile, Web, and Desktop (`src/components/shared/AppUpdateModal.tsx`, `useAppUpdater.ts`, `DesktopTitleBar.tsx`, `App.tsx`): dynamically parses GitHub release notes and renders only the changelog categories present (`New Features`, `Changes`, `Improvements`, `Fixes`, `Removals`, `Under the hood`), adds Android `.apk` asset detection, and provides full-width `Download` / `Not now` controls with live progress.
- Fixed mobile download buttons across Anime, Manga, and Light Novels (`AnimeDetailsPage.tsx`, `DetailsEpisodeGrid.tsx`, `MangaDetailsPage.tsx`, `LNDetailsPage.tsx`): added status-bar top clearance (`max(env(safe-area-inset-top, 0px), 24px)`) on all 3 mobile details headers so top-right Download/Sort/View buttons are never buried under the Android status bar, made Anime episode card download buttons visible and tappable on touch (`opacity-90 md:opacity-0 md:group-hover:opacity-100`) plus unhid the toolbar Download All button on mobile, and replaced invalid nested `<span role="button">` inside `<button>` on Manga & LN chapter grid tiles with proper `<button>` controls and larger `h-7 w-7` touch targets.
- Diversified Explore feed (`candidatePoolService.ts`, `recommendationEngine.ts`): replaced hardcoded `page: 1` seasonal AniList queries with randomized deeper pages across classics (pages `1..10`), hidden gems (pages `1..12`), rotating genre spotlights (14 genres, pages `1..6`), trending, airing, and upcoming; bumped pool cache key to `yorumi_explore_pool_v2` to purge stale caches; and rebalanced `TARGET_DISTRIBUTION`, `freshnessScore`, and `varietyScore` so every Explore session surfaces a genuinely diverse mix across eras and genres.
- Fixed duplicate anime/manga entries in Continue Watching & Continue Reading (`src/utils/storage.ts`): deduplicated entries across `animeId`, `anilistId`, `malId`, and normalized title on save, read, and delete so the same show opened under different IDs (e.g. AniList ID vs MAL ID) merges cleanly into one card while preserving resume timestamps.
- Built a personalized "You may like" search recommendation engine (`src/utils/searchRecommendations.ts`, wired in `SearchPage.tsx`): ranks fresh, unwatched/unread suggestions using weighted genre affinity from watch time, episode/chapter history, favorites, and lists across Anime, Manga, and LN, combined with batched AniList recommendations for your top most-watched titles, with paged `Refresh` rotation.
- Redesigned mobile `/search` page (`SearchPage.tsx`, `Sidebar.tsx`) with a TikTok-style full-page search UI: pill input + accent `Search` action, recent searches with `Clock` + `×` remove + `See more` toggle, and a 2-column `You may like` section with `Refresh` (top 2 highlighted in accent color) while keeping mobile top-right Search navigating to `/search`.
- Refined mobile top-right controls (`Sidebar.tsx`, `SearchModal.tsx`, `ExplorePage.tsx`): reordered icons to Search, Chat, Notification with unboxed bare icon styling in the same top-right position across all pages including Explore, and hid Explore's mobile top-right refresh/mute buttons so the 3 icons never collide.
- Upgraded mobile Library Activity & Top Genres cards (`LibraryProfileOverview.tsx`) to a fixed-height (`h-[196px]`, zero layout shift) tap-to-expand split row (`flex-1` expanded card + `72px` compact summary strip showing the latest 9 non-future activity days so active squares are always visible; 2-column grid preserved on desktop).
- Fixed Spotlight horizontal touch swiping across Anime, Manga, and LN (`SpotlightHero.tsx`, `ReadingSpotlight.tsx`, `MobilePullToRefresh.tsx`): removed `pointer-events-auto` from the foreground text/logo overlay so touch drags anywhere on the spotlight pass through to Embla (`touch-pan-y`, `dragThreshold: 4`), and tightened pull-to-refresh vertical angle gating so horizontal swipes never conflict.
- Fixed Activity heatmap square aspect ratio on mobile (`flex-col` 10-week 1:1 square grid) and added automatic batched AniList genre backfill (`LibraryProfileOverview.tsx`, `useContinueWatching.ts`) so Top Genres populates immediately for existing watched anime and caches for Neon sync.
- Placed Library Activity and Top Genres side-by-side (`grid-cols-2`, compact 12-week heatmap + compact genre rows on mobile) in `LibraryProfileOverview.tsx`, and fixed `cloudSyncService.ts` to resolve `http://localhost:3001/api` on Tauri desktop and Capacitor mobile when `VITE_SYNC_API_URL` is unset (plus clean account-switch handling via `yorumi_cloud_sync_uid_v1`).
- Tightened mobile Library layout and added non-stretching pull-to-refresh (`LibraryPage.tsx`, `LibraryProfileOverview.tsx`, `MobilePullToRefresh.tsx`, `src/index.css`): compacted the mobile `[Anime | Manga | LN]` switcher + icon buttons to fit cleanly on one row without overlap, fitted Activity stats onto one line and all 26 weeks (Jun–Nov) inside mobile screen width without horizontal clipping, disabled Android WebView overscroll stretch (`overscroll-behavior-y: none`), and added a floating pull-to-refresh indicator that syncs Neon cloud state and reloads without stretching the bottom navbar.
- Updated mobile UI to match desktop (`Sidebar.tsx`, `GlobalChatDrawer.tsx`, `LibraryPage.tsx`, `LibraryProfileOverview.tsx`): added Global Chat and Watchlist Episode Notifications (with unread indicator and frosted-glass dropdown) beside Search in the mobile top action bar, replaced the mobile Library dropdown with desktop's 3-tab segmented media pill (`Anime | Manga | LN`), added a quick `+ New` category button on mobile, made card delete buttons touch-accessible on mobile, and tightened signed-out mobile Library hero spacing.
- Fixed Library overview Activity counts, Top Genres, and Hours (`LibraryProfileOverview.tsx`, `useContinueLNReading.ts`, `cloudSyncService.ts`): recorded LN reading sessions in activity history, broke out watched anime / read manga / read LN counts in the Activity card and profile header, computed real + estimated hours across anime, manga, and LN (fixing `0.0h` display), and synced `yorumi_anime_genre_cache` and `yorumi_manga_genre_cache` to Neon Postgres alongside local history/activity/watch-time keys.
- Added automatic debounced Discord-authenticated cloud sync (`src/services/cloudSyncService.ts`, wired in `src/App.tsx`, `useContinueLNReading.ts`, `useLNReadList.ts`): pulls and non-destructively merges user library/history keys on startup and sign-in, and debounces writes by 15s (plus `pagehide`/`visibilitychange` keepalive flush) to keep Neon Free tier compute usage minimal.
- Fixed catastrophic `localStorage.clear()` bug in `src/services/mangaService.ts` that wiped all user watch history, watchlist, favorites, categories, and Discord session whenever `localStorage` hit its quota: replaced the shadow helper with the safe `setLocalStorageWithCleanup` from `src/utils/localStorageQuota.ts` and added `yorumi_manga_cache_` / `yorumi_ln_cache_` to `VOLATILE_STORAGE_PREFIXES` so only volatile caches are ever pruned.
- Removed the Yumi AI chatbot across frontend and backend (`YumiPage.tsx`, `yumiService.ts`, `yumiRecommendations.ts`, `backend/src/api/chat/yumi.routes.ts`, `/yumi` route, and `/api/chat` mount).
- Removed Firebase completely (`firebase` dependency, `src/services/firebase.ts`, and dead Firestore code in `animeService.ts`, `YumiPage.tsx`, `userService.ts`, `UserSearchPage.tsx`), cutting unused bundle weight.
- Wired Neon Postgres (`@neondatabase/serverless`) into the Express backend (`backend/src/infrastructure/db/neon.ts`, `backend/src/api/sync/sync.routes.ts`, `backend/src/core/config/env.ts`, mounted at `/api/sync`): loads `.env.local`/`.env` across root and `backend/`, uses `DATABASE_URL_UNPOOLED` for schema initialization (`yorumi_users`, `yorumi_library_sync`) and pooled `DATABASE_URL` for runtime queries, exposes `GET /api/sync/health`, and provides Discord-token-authenticated `GET` / `PUT` / `DELETE /api/sync/library` endpoints (gracefully disabled when unset).
- Fixed Season 1 episodes playing Season 2 (e.g. *Cyberpunk: Edgerunners* Ep 1 playing *Cyberpunk: Edgerunners 2* Ep 1) and masked the 3px H.264 GPU green bottom-edge artifact in `VideoPlayer.tsx`: updated `getExplicitSeasonNumber` in `AnimeDetailsPage.tsx` to detect trailing sequel numbers (`2`–`9`, `II`–`IV`), resolved TMDB season chip switches to the matching AniList season entry, guarded `<DetailsVideoPlayer>` against mismatched TMDB-season vs `displayAnime` identities, passed the active season's `anime` metadata from `DetailsVideoPlayer.tsx` into `usePlayer.ts`, updated `resolveMalIdFromAniList` in `src/platform/sources/hianime.ts`, and added explicit season filtering to `backend/src/scraper/anineko.ts`.
- Removed MangaDex fallback completely (`src/platform/sources/mangadex.ts`, `tests/mangadex-match.test.ts`, and `mangaService.ts`) so manga reading uses MangaKatana exclusively; updated `crates/yorumi-core/src/media/proxy.rs` to detect image extensions (even when `i1.mangakatana.com` responds with `application/octet-stream`) so proper `image/*` MIME types and `Cache-Control: public, max-age=86400, immutable` are always set, and raised upstream media timeout to 60s for slow MangaKatana scans.
- Codebase QA & cleanup: removed 7 dead frontend components (`LoadingSpinner`, `MediaSectionHeader`, `PopularSeason`, `TopTenSidebar`, `TopTenSkeleton`, `TrendingNow`, `LNContinueReading`), 2 dead backend modules (`backend/src/scraper/mangadex.ts`, `backend/src/utils/ytdlp.ts`), 6 unused/duplicated bundled assets (~1.44 MB saved: `src/assets/luffy.gif`, `src/assets/react.svg`, duplicate `src/assets/yorumi-icon.png`, `public/vite.svg`, `public/gcash-logo.svg`, `public/yorumi-icon.svg`), and 3 empty accidental root folders (`Untitled*`); fixed `eslint.config.js` to ignore generated/build folders; fixed `PageViewer.tsx` cached-image spinner sticking and reduced concurrent preloading to 2 workers so MangaKatana doesn't throttle Page 1 (`proxy.rs` timeout raised to 25s).
- Accelerated manga and LN reader performance (`crates/yorumi-core/src/media/proxy.rs`, `crates/yorumi-core/src/scrapers/client.rs`, `PageViewer.tsx`, `LNReaderPage.tsx`): skipped unnecessary MPEG-TS demasking/buffer-cloning on plain manga images in Rust, added `Cache-Control: public, max-age=86400, immutable` on proxied images for instant WebView2 cache hits, enabled `tcp_nodelay(true)` + 24 idle connections/host in `ScraperClient`, upgraded `PageViewer` from 1-by-1 sequential preloading to a 6-worker parallel preload pool with 8 eager async-decoded pages, and prefetched the next LN chapter in the background on `LNReaderPage`.
- Replaced raw `navigate(-1)` / `navigate(1)` in `DesktopTitleBar.tsx` with a deduplicated, loop-free in-app history stack (`<` / `>`) that replaces redirects and same-page query changes in-place and disables arrows at history bounds.
- Fixed broken MangaDex and manga reader page images on desktop (`mangaService.ts`, `PageViewer.tsx`): routed MangaDex chapter pages through Tauri's `yorumi-media` proxy with `Referer: https://mangadex.org/` to prevent hotlink 403 blocks from `http://tauri.localhost/`, added `referrerPolicy="no-referrer"` on reader images and preloader, and added automatic retry with proxy fallback + manual Retry UI in `MangaPageImage`.
- Removed the English-only subtitle filter in `backend/src/scraper/hianime.ts` so all native multi-language tracks are returned, and added on-demand auto-translated subtitle languages (`Spanish`, `French`, `German`, `Portuguese`, `Indonesian`, `Filipino`, `Arabic`, `Japanese`, `Korean`, `Chinese`, `Russian`, `Italian`, `Thai`, `Vietnamese`, `Hindi`) directly in the player's Subtitles dropdown (`src/utils/subtitles.ts`, `CustomVideoControls.tsx`).
- Replaced fragile native `<track>` rendering with a deterministic WebVTT/SRT/ASS subtitle cue renderer in `CustomVideoControls.tsx` + `src/utils/subtitles.ts` (immune to WebView2/hls.js track resets and CORS issues for both online and offline playback), preserved all available subtitle languages in `VideoPlayer.tsx` and offline downloads (`downloadService.ts`), and updated the CC button to always open a frosted-glass subtitle language dropdown (`Off` + all available languages).
- Persisted full offline anime metadata (poster, backdrop, synopsis, score, year, rating, genres, and episode thumbnails/titles) via `downloadService.saveOfflineAnimeMetadata` / `getOfflineAnimeMetadata`, fixed CORS-blocked image caching in `offlineImageCache.ts` via Tauri's `yorumi-media` proxy, wired `EpisodeThumbnail` to fall back to cached offline images, relaxed English subtitle matching (`src/utils/subtitles.ts`), converted offline `data:` VTT tracks to `blob:` URLs in `getOfflineStream()`, and prioritized servers with soft subtitles when downloading episodes in `DetailsEpisodeGrid.tsx`.
- Fixed desktop (Tauri) anime episode downloads, offline playback, and offline subtitles (`downloadService.ts`, `DetailsEpisodeGrid.tsx`, `crates/yorumi-core/src/downloader/hls.rs`, `manager.rs`, `src-tauri/src/media/protocol.rs`): raced stream providers in parallel to pick the first working server (preferring tracks with subtitles), properly awaited Tauri `download-progress` completion/error instead of falling through to CORS-blocked browser fetch, added `Origin` headers + HTTP status checks + segment retries + accurate `is_hls` detection in the Rust HLS downloader, persisted self-contained offline VTT subtitles for Tauri downloads, and added `/local-file` range streaming to the `yorumi-media` Tauri protocol so downloaded episodes play 100% offline.
- Added a Discord-style green desktop auto-updater button beside Global Chat in `DesktopTitleBar.tsx` (`src/hooks/useAppUpdater.ts`, `src-tauri/src/commands/updater.rs`): automatically checks GitHub Releases (`davenarchives/Yorumi`), surfaces an emerald download icon only when a newer version is available, streams the platform installer with live progress, and runs silent in-place update & restart (`install_desktop_update`).
- Loaded the full Top 100 lists in `Top100Manga.tsx` (`mangaService.getTop100Manga`) and `Top100LN.tsx` (`lnService.getTop100Full`) so `<` / `>` pages all the way from `#1` through `#100`, and added on-demand pagination up to 50 slides (300 items) in `AnimeDashboard.tsx`'s `Browse Anime` section.
- Preloaded Manga and Light Novel home sections on app startup (`App.tsx`, `lnService.ts` `peek*` + `preloadHome()`) and hydrated all 6 LN home components synchronously from cache (`LNSpotlight`, `PopularKoreanNovels`, `PopularChineseNovels`, `LatestLNUpdates`, `AllTimePopularLN`, `Top100LN`) so navigating to `/ln` renders instantly without skeleton flashes; removed the AniList portrait poster fallback on desktop 16:9 `AnimeLandscapeCard.tsx` cards; and restored the 3-row paged grids (12 items/page with `<` / `>` controls beside `View all >`) in `Top100Manga.tsx` and `Top100LN.tsx`.
- Updated Anime `More like this` (`DetailsInfo.tsx`) to recommend similar close-genre anime (AniList recommendations + genre-overlap fallback, excluding same-franchise relations) instead of sequels/same-franchise entries; unified `MangaDetailsPage.tsx` and `LNDetailsPage.tsx` with `Chapters | More like this` tabs below the hero poster and the exact `DetailsEpisodeGrid` pill toolbar (`Search chapters`, `Newest/Oldest`, Grid/List, Download, Folder, and `X/Y read` counter, with close-genre fallback and same-franchise filtering in `MoreLikeReading.tsx`).
- Unified modals (`SearchModal.tsx`, `LibraryPage.tsx` Filter/Sort/Display, Add/Move/Delete Category modals and menus) to share the same frosted glass surface (`bg-[#0d0e12]/80 backdrop-blur-2xl border-white/10`) and `rounded-lg` border radius, and switched `GlobalChatDrawer.tsx` auto-scroll to instant (`behavior: 'auto'`).
- Updated `LibraryPage.tsx` toolbar to remove the blurred glass strip and compress the desktop media switcher (`Anime | Manga | Light Novel`), category tabs (`All`, `Watchlist`, `Favorites`, custom categories), and controls (`+ New category`, Search, Filter/Sort, More) into a single clean transparent row matching `AnimeDetailsPage`.
- Added a full-screen `DetailsHero`-style backdrop (`tmdbService.getBackdropForAnime`, `h-screen` mask fade + matching vignette overlays) + Activity Heatmap + Top Genres overview (`src/features/library/components/LibraryProfileOverview.tsx`) above the Library grid in `LibraryPage.tsx`: renders the most recently watched anime's widescreen backdrop behind the entire top viewport, displays the signed-in Discord avatar/username (updating live via `yorumi-discord-session-updated` from `GlobalChatDrawer.tsx`) with `Joined · watched · in watchlist` stats, a 26-week Activity contribution heatmap (titles, active days, day streak), and a Top Genres breakdown with watch hours.
- Updated Global Chat `▸ Now Watching` (`GlobalChatDrawer.tsx`, `AnimeDetailsPage.tsx`, `YorumiBot/src/app.js`) to attach live anime title, season, episode, and exact playback timestamp ONLY while actively watching an episode (never stale history), and made the `▸` tag clickable so other users jump directly to that episode and seek to that exact timestamp (`?ep=N&t=S`).
- Added Discord OAuth2 sign-in to Global Chat (`GlobalChatDrawer.tsx`, `src-tauri/capabilities/default.json`, `YorumiBot/src/app.js` `/auth/discord/login`, `/auth/discord/callback`, `/auth/discord/poll`): allowlisted `yorumibot-1.onrender.com` and `discord.com` in Tauri's `opener:allow-open-url` capability and added Capacitor `Browser.open` support so clicking `Sign in` launches Discord OAuth2 cleanly on desktop and mobile.
- Added a built-in non-deletable `Watchlist` (`Read list` on Manga/LN) category tab beside `All` and `Favorites` in `LibraryPage.tsx` that automatically appears only when at least one watchlisted/read-listed entry exists and filters directly to watchlisted entries.
- Added a Global Discord Chat drawer (`GlobalChatDrawer.tsx`, defaulted to `https://yorumibot-1.onrender.com`) with live create, edit, and delete message sync via SSE + fallback polling, plus a Watchlist Episode Updates notification bell (`useWatchlistNotifications.ts`) in `DesktopTitleBar.tsx`.
- Fixed broken anime episode downloads on both standalone desktop (Tauri) and mobile (Android) (`downloadService.ts`, `useDownloads.ts`, `DetailsEpisodeGrid.tsx`): fetched subtitle tracks via `nativeHttp.fetchText` instead of dead `localhost:3001/api/scraper/proxy` URLs (and made caption fetch failures non-fatal), forwarded `referer` and unwrapped proxy URLs to Tauri and Android native downloaders, and enlarged the episode card download icon to `h-6 w-6` without its dark circle container to match the watched circle.
- Added a hover-reveal circular `×` delete button on Library cards and list rows (`LibraryPage.tsx`) to delete entries from Library (`All`), remove from `Favorites`, or remove from a custom category.
- Removed the bordered background box around `Showing results for` / `Did you mean` search suggestions across `SearchModal.tsx`, `SearchPage.tsx`, and `SearchResultsPage.tsx` so they render as clean inline text.
- Shortened the mobile Library media selector label from `Light Novel` to `LN` (`LibraryPage.tsx`).
- Fixed Library anime entries opening incomplete scraper-only details (`LibraryPage.tsx`, `AnimeContext.tsx`): preferred canonical AniList/MAL/TMDB route IDs over `s:<uuid>` scraper IDs in `getAnimeRouteId`, and hydrated incomplete scraper shells via AniList title search + `getAnimeDetails` while preserving `scraperId` so score, year, synopsis, genres, airing countdown, and episode stills match the normal Details page.
- Removed the Personal Hub banner/tabs from `LibraryPage.tsx` (deleted `LibraryOverviewHub.tsx`), updated Explore's right action rail (`ExplorePage.tsx`) to use solid filled icons on desktop and mobile, separated the Heart button to Like-only (`yorumi_explore_liked_anime`), switched the Bookmark button to add/remove Favorites, and added a built-in non-deletable `Favorites` category tab in `LibraryPage.tsx` that automatically appears only when at least one favorite entry exists for the active media tab.
- Shared a single in-flight-deduped AniList poster/metadata cache (`src/utils/mangaPosterCache.ts`) with strict exact-title matching (removing loose substring and `data[0]` fallbacks so non-AniList comics like `Radiant` never inherit unrelated posters/badges like `Radiant Rewind`) across `LatestMangaUpdates.tsx`, `MangaSpotlight.tsx`, and `useManga.ts` (and fixed `MangaSpotlight`'s self-canceling `useEffect` dependency), and updated the Manga/LN Details primary CTA (`ReadingDetailsHero.tsx`, `MangaDetailsPage.tsx`, `LNDetailsPage.tsx`) to always display `Read` (disabled with `disabled:opacity-60` while loading).
- Updated Global Chat `▸ Now Watching` (`GlobalChatDrawer.tsx`, `AnimeDetailsPage.tsx`, `YorumiBot/src/app.js`) to attach live anime title, season, episode, and exact playback timestamp ONLY while actively watching an episode (never stale history), and made the `▸` tag clickable so other users jump directly to that episode and seek to that exact timestamp (`?ep=N&t=S`).
- Added Discord OAuth2 sign-in to Global Chat (`GlobalChatDrawer.tsx`, `src-tauri/capabilities/default.json`, `YorumiBot/src/app.js` `/auth/discord/login`, `/auth/discord/callback`, `/auth/discord/poll`): allowlisted `yorumibot-1.onrender.com` and `discord.com` in Tauri's `opener:allow-open-url` capability and added Capacitor `Browser.open` support so clicking `Sign in` launches Discord OAuth2 cleanly on desktop and mobile.
- Added a built-in non-deletable `Watchlist` (`Read list` on Manga/LN) category tab beside `All` and `Favorites` in `LibraryPage.tsx` that automatically appears only when at least one watchlisted/read-listed entry exists and filters directly to watchlisted entries.
- Added a Global Discord Chat drawer (`GlobalChatDrawer.tsx`, defaulted to `https://yorumibot-1.onrender.com`) with live create, edit, and delete message sync via SSE + fallback polling, plus a Watchlist Episode Updates notification bell (`useWatchlistNotifications.ts`) in `DesktopTitleBar.tsx`.
- Fixed broken anime episode downloads on both standalone desktop (Tauri) and mobile (Android) (`downloadService.ts`, `useDownloads.ts`, `DetailsEpisodeGrid.tsx`): fetched subtitle tracks via `nativeHttp.fetchText` instead of dead `localhost:3001/api/scraper/proxy` URLs (and made caption fetch failures non-fatal), forwarded `referer` and unwrapped proxy URLs to Tauri and Android native downloaders, and enlarged the episode card download icon to `h-6 w-6` without its dark circle container to match the watched circle.
- Added a hover-reveal circular `×` delete button on Library cards and list rows (`LibraryPage.tsx`) to delete entries from Library (`All`), remove from `Favorites`, or remove from a custom category.
- Removed the bordered background box around `Showing results for` / `Did you mean` search suggestions across `SearchModal.tsx`, `SearchPage.tsx`, and `SearchResultsPage.tsx` so they render as clean inline text.
- Shortened the mobile Library media selector label from `Light Novel` to `LN` (`LibraryPage.tsx`).
- Fixed Library anime entries opening incomplete scraper-only details (`LibraryPage.tsx`, `AnimeContext.tsx`): preferred canonical AniList/MAL/TMDB route IDs over `s:<uuid>` scraper IDs in `getAnimeRouteId`, and hydrated incomplete scraper shells via AniList title search + `getAnimeDetails` while preserving `scraperId` so score, year, synopsis, genres, airing countdown, and episode stills match the normal Details page.
- Removed the Personal Hub banner/tabs from `LibraryPage.tsx` (deleted `LibraryOverviewHub.tsx`), updated Explore's right action rail (`ExplorePage.tsx`) to use solid filled icons on desktop and mobile, separated the Heart button to Like-only (`yorumi_explore_liked_anime`), switched the Bookmark button to add/remove Favorites, and added a built-in non-deletable `Favorites` category tab in `LibraryPage.tsx` that automatically appears only when at least one favorite entry exists for the active media tab.
- Shared a single in-flight-deduped AniList poster/metadata cache (`src/utils/mangaPosterCache.ts`) with strict exact-title matching (removing loose substring and `data[0]` fallbacks so non-AniList comics like `Radiant` never inherit unrelated posters/badges like `Radiant Rewind`) across `LatestMangaUpdates.tsx`, `MangaSpotlight.tsx`, and `useManga.ts` (and fixed `MangaSpotlight`'s self-canceling `useEffect` dependency), and updated the Manga/LN Details primary CTA (`ReadingDetailsHero.tsx`, `MangaDetailsPage.tsx`, `LNDetailsPage.tsx`) to always display `Read` (disabled with `disabled:opacity-60` while loading).
- Fixed Manga/Manhwa/Manhua type chips (`mangaService.ts`, `src/features/search/api.ts`, `SearchModal.tsx`, `MangaDetailsPage.tsx`) to derive `MANHWA` (`countryOfOrigin === 'KR'`) and `MANHUA` (`countryOfOrigin === 'CN'`) instead of labeling all AniList manga entries as `MANGA`, made `getMangaPreview` AniList-first (only falling back to MangaKatana when `< 3` results) so desktop search no longer stalls behind MangaKatana's rate-limit queue, and added clickable `Did you mean ...?` typo/alias suggestions to desktop `SearchModal.tsx`.
- Fixed MangaKatana scraper matching (`mangakatana.ts`, `mangaService.ts`) so serialized manga like `One-Punch Man` and `One Piece` never lock onto 1-chapter oneshots (`Chapter 0: Oneshot`): penalized oneshot/pilot/spinoff candidates, rewarded chapter depth, inspected multiple confirmed candidates in `resolveLocalMangaKatanaDetails` to pick the real serialized entry, and bumped `PERSISTED_CACHE_PREFIX` (`yorumi_manga_cache_v6`) to purge stale 1-chapter mappings.
- Added fuzzy typo correction (`Did you mean ...?`) and alternative title / shorthand alias search (`src/utils/searchIntelligence.ts`, `src/features/search/api.ts`, `SearchPage.tsx`, `SearchResultsPage.tsx`) across Anime, Manga (merging AniList synonym-indexed search with MangaKatana), and Light Novels.

- Kept the primary `Read` / `Ch. N` CTA button in `ReadingDetailsHero.tsx` crisp white with its label instead of swapping to dimmed `Loading...` while chapters resolve, matching Anime Details on both desktop and mobile.

- Unified the desktop and mobile video player controls in `CustomVideoControls.tsx` to use the sleek mobile-fullscreen player layout (top episode title header + Cast/Lock, center `-10s` / `Play-Pause` / `+10s`, thin white timeline above clean bottom controls with desktop hover volume slider, dedicated server selector, and slide-over episodes drawer; removed duplicate Server entry from Settings, removed the Aspect Ratio button, and restricted the desktop Episodes drawer button to fullscreen).

- Fixed Explore feed loading & preloading (`candidatePoolService.ts`, `exploreService.ts`, `useExploreFeed.ts`, `App.tsx`): migrated AniList queries to `postJson` (`nativeHttp.ts`), trimmed heavy `characters`/`stats` fields from the batched query, added retry + `exploreService` fallback + `localStorage` pool caching (`yorumi_explore_pool_v1`), and preloaded the candidate pool on app startup so Explore trailers load immediately on click; also moved `<AnimeLogoImage />` in `SpotlightHero.tsx` into the `z-20` foreground layer so spotlight logos always render bright above all gradient vignettes.

- Updated the Android splash screen (`styles.xml`, `values-v31/styles.xml`, `drawable/splash_bg.xml`) to use the exact Yorumi logo purple (`@color/ic_launcher_background` `#291F6F`) for a seamless launch transition.

- Tightened chapter list row sizing (`text-[14px] sm:text-[15px]`, `py-2.5`, compact `h-5 w-5` download icon) and updated chapter grid tiles to 4 squares per row on mobile (`grid-cols-4 gap-2.5`) with the same translucent glass surface (`rounded-[14px] bg-white/[0.06] hover:bg-white/[0.09]`) across mobile and desktop in `LNDetailsPage.tsx` and `MangaDetailsPage.tsx`.

- Replaced the broken `novel-bin.com` scraper (now returning `<title>Redirecting...</title>` anti-bot pages) with **AllNovelFull** (`allnovelfull.com`, using single-request `/ajax-chapter-option` full chapter loading) and **NovelFire** (`novelfire.net`, clean `#content` HTML + broad Japanese LN coverage) in `src/platform/sources/novelbin.ts`, updated curated Korean/Chinese novel IDs in `src/services/lnData.ts` to verified `anf:` slugs, and bumped LN cache keys (`ln_v6_*`, `ln_v4_content_`) in `src/services/lnService.ts` to purge stale failed entries on mobile and desktop.

- Hid chapter counts on mobile only in `LNSpotlight.tsx` and `MangaSpotlight.tsx` (`SpotlightMetadata.tsx` `desktopOnly` flag) so the metadata row fits without clipping, replaced all 24 dead `novel-bin.com/files/image/*` covers in `lnData.ts` (`POPULAR_KOREAN_NOVELS`, `POPULAR_CHINESE_NOVELS`) with verified `s4.anilist.co` URLs (and bypassed the empty AniList `format: NOVEL` KR/CN query in `lnService.ts` + bumped `ln_v5_details_`), consolidated `ChapterViewToggle.tsx` into a single toggle button, and unified the desktop sort button icon to `ArrowUpDown` with default white styling across `LNDetailsPage.tsx` and `MangaDetailsPage.tsx`.

- Fixed `MangaSpotlight.tsx` to prefer the manga's own `images.jpg.large_image_url` so the spotlight poster matches `MangaDetailsPage`, matched `ReadingDetailsHero.tsx` mobile poster visibility/sizing (`invisible sm:visible`) to Anime Details (`DetailsInfo.tsx`), and replaced dead `novel-bin.com/files/image/*` Light Novel covers in `LNSpotlight.tsx` and `lnService.ts` (`getPopularKoreanNovels`, `getPopularChineseNovels`) with AniList `s4.anilist.co` covers (`ln_v4_popular_korean`, `ln_v4_popular_chinese`).

- Updated mobile hero backdrops across `DetailsHero.tsx`, `ReadingDetailsHero.tsx`, `AnimeBrowsePage.tsx`, `Top100Page.tsx`, and `AnimeStudioPage.tsx` to use the crisp vertical portrait poster (`bg-top`) on mobile instead of stretching horizontal banners/backdrops.

- Removed "See all" from `Top 10 Today` and `Trending Now` in `AnimeDashboard.tsx`, added a global AniList request pacing queue (`650ms`) + in-flight deduplication in `anilistAnime.ts` to prevent `429` bursts, and wired `animeService.browseAnime` to fall back to `getTrendingAnime` / `getPopularThisSeason` / `getTopAnime` / `getTop100Anime` if AniList rate-limits.

- Updated mobile `SpotlightHero.tsx`, `ReadingSpotlight.tsx` (Manga & LN), and `SpotlightSkeleton.tsx` to a compact `70svh` (`min-h-[460px] max-h-[600px]`) height instead of full screen, using crisp vertical portrait posters (`object-top`) on mobile.

- Ensured the mobile bottom navbar (`Sidebar.tsx`, `ExploreEpisodesDrawer.tsx`, `index.css`) unmounts and hides reliably when the Explore episodes sheet is open.

- Hardened `/anime/browse` against AniList `429` rate limits: upgraded `queryAniList` retry backoff (`anilistAnime.ts`), added fallback to cached home sections in `animeService.browseAnime`, and added a dedicated error state with a **Retry** button in `AnimeBrowsePage.tsx`.

- Added the circular Heart (favorite) button to `ReadingDetailsHero.tsx` on both mobile and desktop (matching `DetailsInfo.tsx`), wired to `useFavoriteManga` in `MangaDetailsPage.tsx` and a new `useFavoriteLN` hook (`src/hooks/useFavoriteLN.ts`) in `LNDetailsPage.tsx`.

- Extracted the shared pure-Rust engine into `crates/yorumi-core` inside a root Cargo workspace (`Cargo.toml`), adding a persistent SQLite WAL `kv_cache` layer (Stale-While-Revalidate), unified AniList `get_top_100` / `browse_anime` / `get_reading_list` queries, a SQLite-cached TMDB artwork client (`tmdb.rs`), a decoupled `DownloadManager` (`tokio::sync::broadcast`), and a local `127.0.0.1` HTTP HLS proxy (`LocalMediaProxy`), while keeping `src-tauri/` working as a thin adapter behind the React UI.

- Updated `AnimeBrowsePage.tsx` to match the Studio Catalogue hero layout: crisp `520px` hero backdrop sourced from the first anime (upgraded via TMDB `w1280` backdrop), `#08090d` gradient fade, `text-4xl sm:text-6xl` heading aligned with the card grid, and `#0596ff` active pills.

- Added `/anime/browse` (`AnimeBrowsePage.tsx`, `anilistAnime.ts`, `animeService.ts`) with Trending/Popular/Top Rated/Airing/Upcoming tabs, Genre/Tag/Format/Season/Year/Status/Rating filter dropdowns, shuffle random button, infinite scroll, and 4-column landscape card grid; wired `AnimeDashboard.tsx` "See all" links to `/anime/browse`.

- Updated `LNCard.tsx` and `Top100LN.tsx` to use the same stroke-free pastel circular rank badges (`RankBadge`) and added a **View all** button navigating to `/ln/top-100` (`Top100Page.tsx`, `lnService.getTop100Full()`).

- Removed the floating back button on `Top100Page.tsx` and unified `mangaService.getTop100Manga()` (`anilistManga.ts`, `mangaService.ts`) to use `getHomeSections().top` + AniList `SCORE_DESC` (`getLocalAniListTop100Manga`) so `/manga/top-100` matches the `Top 100 Manga` home grid `#1`–`#100`.

- Unified `animeService.getTop100Anime()` (`anilistAnime.ts`, `animeService.ts`) to query AniList `SCORE_DESC` (`getLocalAniListTop100Anime`) so the `/anime/top-100` "View all" page matches the `Top 100 Anime` carousel rankings (`#1`–`#100`).

- Aligned the studio logo, title, and filter pills to the card grid in `AnimeStudioPage.tsx` (`max-w-[1440px] px-4 sm:px-10 md:px-14 lg:px-16`, `grid-cols-2 md:grid-cols-3 xl:grid-cols-4`), and updated `Top100Page.tsx` to use the same hero backdrop and left-aligned header/grid layout.

- Disabled the `hqdefault.jpg` trailer preview image overlay on desktop Explore (`ExplorePage.tsx`) and kept the trailer iframe `md:opacity-100` so scrolling goes directly to video.

- Fixed desktop `ExploreEpisodesDrawer` height/width (`md:static md:max-h-none md:h-full md:w-[420px] lg:w-[440px] md:shrink-0`) and `ExplorePage` flex container (`flex-1 min-w-0`) so the episodes sidebar fills 100% height with no bottom black gap or right-edge clipping, and removed the dimmed `mqdefault.jpg` pause cover overlay in `ExplorePage.tsx`.

- Expanded the desktop Explore episodes sidebar (`480px` width in `ExploreEpisodesDrawer.tsx` and `ExplorePage.tsx`) and removed all backdrop dimming/blur and shadow gradients behind/beside the episodes panel on both desktop and mobile.

- Fixed `ExploreEpisodesDrawer` on mobile to portal to `document.body` and hide `.yorumi-mobile-navbar` (`html.explore-episodes-open`) while open, without affecting desktop.
- Fixed studio catalog loading reliability in `src-tauri/src/commands/http.rs` (avoid duplicate `Accept`/`Content-Type`/`User-Agent` headers in `http_fetch_post`), added retry on transient AniList errors (`anilistAnime.ts`), and added caching/in-flight deduplication for `getStudioAnime` (`animeService.ts`).

- Added stroke-free pastel circular rank badges (`RankBadge.tsx`) for Top 100 Anime (`AnimeDashboard.tsx`, `AnimeLandscapeCarousel.tsx`, `AnimeLandscapeCard.tsx`) and Top 100 Manga (`Top100Manga.tsx`, `MangaCard.tsx`, `ReadingCardArtwork.tsx`) on both desktop and mobile, plus "View all" navigation to dedicated `/anime/top-100` and `/manga/top-100` pages (`Top100Page.tsx`) showing full `#1`–`#100` ranked lists.

- Fixed desktop spotlight bottom seam across Anime, Manga, and LN (`SpotlightHero.tsx`, `ReadingSpotlight.tsx`, `AnimeDashboard.tsx`, `MangaPage.tsx`, `LNPage.tsx`) by applying `.spotlight-track-mask` to the vignette overlay and tucking the first content row (`md:-mt-8` / `md:-mt-6`) into the faded spotlight edge for a seamless blend into the ambient backdrop.

- Made the top-right `+` list button hover-only on desktop (`AnimeLandscapeCard.tsx`, `ReadingCardArtwork.tsx`), and removed blocking `AnimatePresence mode="wait"` route transitions on desktop (`AppRoutes.tsx`) for instant, lightweight navigation.

- Restored the inverted rounded cutout notch mask (`AnimeLandscapeCard.tsx`) on mobile airing badges so the card corners match the desktop seamless rounded cutout look.

- Updated `ExploreEpisodesDrawer` and `MainActivity.kt` on mobile: removed the episode watched circle badge and header `X` close button, added pointer drag-to-dismiss on the mobile sheet handle/header, extended the sheet above the bottom navbar (`z-[2147483620]`), and synced Android system navigation bar color (`#121318`) with the drawer surface while open.

- Added mobile-accurate skeleton loading across all mobile tabs: created `ExploreSkeleton` for `ExplorePage` and `/explore` route fallback, updated `SpotlightSkeleton` to match the centered mobile Anime/Manga/LN spotlight layout (split action buttons and indicator dots), and added a Library grid skeleton in `AppRoutes` `RouteFallback`.

- Fixed `ExplorePage` preloaded trailers so inactive slides pause and reset to `0:00` instead of playing silently in the background, ensuring every trailer starts from the beginning when scrolled into view.

- Optimized mobile navigation and WebView responsiveness: forced scroll-to-top (`0, 0`) on tab switches and route pushes (`ScrollRestoration.tsx`), bypassed blocking `AnimatePresence mode="wait"` route transitions on mobile (`AppRoutes.tsx`), enabled `reducedMotion="always"` for Framer Motion on mobile (`App.tsx`), and added `touch-action: manipulation`, `-webkit-tap-highlight-color: transparent`, and `overscroll-behavior-y: contain` in `src/index.css`.

- Moved `ReadingSpotlight` titles back into the outer foreground (`z-20`) without `AnimatePresence` remounting so Manga and LN spotlight titles stay crisp white like the synopsis with zero swipe delay.

- Updated Manga and LN reader headers (`ReaderHeader.tsx`, `LNReaderPage.tsx`) to display full manga/novel and chapter names without truncation, removed the back button box container, and updated reader back navigation (`MangaReaderPage.tsx`, `LNReaderPage.tsx`, `MangaDetailsPage.tsx`, `LNDetailsPage.tsx`) to always return cleanly to the series details page without looping or getting stuck.

- Applied the same 1:1 slide-locked title and instant metadata/stationary button optimization to `ReadingSpotlight` (used by Manga and LN spotlights), removing `AnimatePresence` remount delays and updating `selectedIndex` immediately on swipe.

- Made `SpotlightHero` logos move 1:1 with each Embla slide poster on both mobile and desktop, and removed `AnimatePresence` remount transitions so ratings, year, genre, content rating, and synopsis update instantaneously while Play/Details stay stationary.

- Made mobile anime spotlight logos move with their artwork and kept action buttons stationary while slide metadata updates immediately.

- Restored the season and episode number beside the episode title on the mobile watch page.

- Prevented mobile Back from looping between anime details and watched episodes; details now returns to Anime Home.

- Kept mobile episode dates and durations on a single row.

- Kept mobile player controls mounted while resolving streams and removed malformed fullscreen metadata text.

- Corrected mobile player season labels and garbled separators, simplified the episode subtitle, and opened the player while the selected episode is resolving.

- Moved the mobile fullscreen anime timeline above the controls and restored inline player sizing after the portrait rotation completes.

- Made mobile detail and Android system back navigation return to the previous page, with section fallbacks for direct links.

- Smoothed Explore transitions by retaining preloaded playback and showing artwork while a trailer starts; deferred mobile spotlight foreground updates until swipes settle.

- **Mobile Explore 16:9 Trailer Format & Native Fullscreen Mode**:
  - Updated `ExplorePage.tsx` on mobile (`< md`) to display trailers in a clean centered `16:9` (`aspect-video`) frame on a black canvas with a TikTok-style `Full screen` pill button directly underneath, clean text anime titles, and spaced TikTok-style right action buttons above the bottom navbar.
  - Showed the mobile bottom progress bar only once paused/clicked (`!isFullscreen && isActive && isPaused`) flush at `bottom-0` with full touch/pointer drag-to-scrub seeking (`touch-none`), removed the offset `centerAction` pop overlay and circular Play/Pause icon containers, pre-buffered the next 2 trailers automatically (`activeIndex + 2`), and reset scrolled slides to `0:00`.
  - Updated the Explore Heart button label to show the total number of AniList users who rated the anime (`stats.scoreDistribution`, formatted like `9,999`, `100.0K`, `999.9K`, `1M`) with a `+1` local increment when liked.
  - Guarded the desktop `<aside>` sidebar (`Sidebar.tsx`) and `md:ml-[70px]` shell offset (`App.tsx`) with `!isMobileShell()` so the desktop sidebar never appears or offsets layout on mobile even in landscape fullscreen.
  - Removed the active-tab top white indicator line from the mobile bottom navbar (`Sidebar.tsx`), positioned the mobile Explore progress bar flush onto the navbar border line (`z-[2147483605]`), and reset `isPaused` synchronously on scroll (`useLayoutEffect` + `handleScroll`/`scrollToIndex`) so the Play icon never appears after scrolling.
  - Replaced CSS `rotate-90` tilt fullscreen with native OS-level landscape fullscreen (`enterLandscapePlayerMode` / `exitLandscapePlayerMode` and web `requestFullscreen` fallback), increased YouTube iframe overscan (`w-[152%] h-[176%]`) + opaque dimmed poster pause cover (`opacity-0` iframe + `mqdefault.jpg` over `bg-black` when paused) so YouTube overlays are completely hidden, and added the floating `sleeping.gif` loading animation matching `VideoPlayer.tsx` for Explore feed and trailer buffering.

- **Mobile Reading Spotlight & Details Polish**:
  - Updated `SpotlightMetadata.tsx` to keep score, author/chapters, and format chip (`MANHWA` / `LIGHT NOVEL` / etc.) on a single non-wrapping row (`flex-nowrap`, `whitespace-nowrap`) with compact mobile spacing and zero dead space.
  - Hid the redundant circular back button in `ReadingDetailsHero.tsx` on mobile (`hidden md:flex`) for both Manga and Light Novels since the mobile top bar already provides navigation back.

- **Mobile Swipe & Scroll Performance Pass**:
  - Spotlights (`SpotlightHero.tsx`, `ReadingSpotlight.tsx`) now render artwork only for the active slide and its neighbours, load `w1280` TMDB backdrops on mobile instead of `original` (4K), and moved the bottom fade `mask-image` off the moving Embla track on mobile (`.spotlight-track-mask`, desktop-only).
  - Heavy spotlight side-effects (episode prefetch, details fetch, ambient backdrop updates, parent `onSelect`) now run on Embla `settle` instead of `select`, so no page-wide re-renders happen mid-swipe; ambient backdrop updates are skipped on mobile.
  - Disabled `backdrop-filter` inside mobile home pages (`.media-home-perf`) and on the fixed mobile Search button (`Sidebar.tsx`), and set `touch-action: pan-y pinch-zoom` on carousel tracks so horizontal swipes don't fight vertical scrolling.
  - `AnimeLandscapeCard.tsx` skips TMDB backdrop lookups on mobile (portrait posters are shown there), removes per-card SVG `<mask>` compositing and `AnimeLogoImage` overlays on mobile, and uses `content-visibility: auto` on mobile `.media-home-perf section` elements to eliminate vertical section scroll lag.

- **Mobile Smooth Scrolling, Spotlight Swiping & Browse Limit**:
  - Moved spotlight slide artwork directly inside Embla Carousel slides (`SpotlightHero.tsx`, `ReadingSpotlight.tsx`) with `will-change-transform` and parallel TMDB backdrop preloading for seamless 1:1 finger-tracked swiping without `AnimatePresence` crossfade lag.
  - Disabled heavy full-screen `blur(100px)` / `blur-[120px]` ambient backdrop layers on mobile (`< md`) in `AnimeDashboard.tsx`, `MangaPage.tsx`, `LNPage.tsx`, and `App.tsx` to eliminate GPU overdraw during vertical scrolling and remove the muddy brown tint in empty regions.
  - Tightened mobile spotlight height/bottom padding (`pb-6`, `h-[76svh]`) and removed double-stacked bottom padding above the mobile bottom navbar (`AnimeDashboard.tsx`, `MangaPage.tsx`, `LNPage.tsx`, `AnimeLandscapeCarousel.tsx`, `App.tsx`).
  - Limited "Browse Anime" (`AnimeDashboard.tsx`) to 6 cards per page (`ITEMS_PER_BLOCK = 6`, skeleton count `6`).

- **Player Fullscreen Zoom Rotation & Genre-Based Recommendations**:
  - Replaced franchise relations in "More Like This" (`DetailsVideoPlayer.tsx`) with genuine genre-matched recommendations via AniList community recommendations and `animeService.getAnimeByGenre`.
  - Added strict filtering against sequels, prequels, spin-offs, and matching franchise keywords, ensuring "More Like This" only features similar anime from other franchises rather than sequels.
  - Fixed mobile fullscreen zoom button click crash caused by unsupported orientation lock calls under Tauri Android WebView, eliminating blocking promises and failed state rollbacks.
  - Added seamless CSS landscape rotation (`yorumi-player-rotated`) fallback when devices are held in portrait with auto-rotate locked, dynamically toggling based on viewport orientation.
  - Added right-hand sliding Episodes Drawer in landscape/fullscreen mode matching reference styling, with episode thumbnails, active checkmark badges, episode titles, "Now playing" tags, duration, audio badges, and synopsis overviews.
  - Added dedicated Server selector popover button and Cast button to the landscape player controls deck.

- **Mobile Video Controls & Player Redesign**:
  - Redesigned video player controls for mobile viewports (`CustomVideoControls.tsx`) matching the reference style:
    - Removed container pill capsules (`GLASS_PANEL_CLASS`, `GLASS_BUTTON_CLASS`) in favor of clean, container-less white icons with drop-shadows and active touch feedback.
    - Updated time display to show remaining duration with a minus sign (e.g. `-23:49`) instead of elapsed / total duration.
    - Repositioned the progress scrubber flush along the very bottom edge of the player video, placing the control buttons row above it.
    - Updated seek buttons to 10 seconds (`SEEK_SECONDS = 10`) with `SeekIcon` displaying "10".
    - Added clean circular center controls (10s rewind, play/pause, 10s forward) and skip-intro pill.
    - Top-left header overlay in fullscreen/landscape mode displays Season, Episode, Anime title, and Episode title.
  - Added clean bold title and Season/Episode subtitle directly below the player video in portrait mode (`DetailsVideoPlayer.tsx`).
  - Aligned "More Like This" cards with a fixed 2-row title container (`h-[2.5rem] min-h-[2.5rem]` with `line-clamp-2 text-ellipsis overflow-hidden`) and `rounded-[16px]` artwork to guarantee equal card heights and alignment.
  - Corrected `getRuntimePlatform()` in `runtime.ts` to identify Android environments running under Tauri, enabling native orientation lock and immersive mode.

- Remove mobile mini-player playback and align related-title cards on the mobile viewing page, with anime and episode information below the video.

- Add a dedicated mobile anime viewing page with related titles and persistent mini-player playback.

- Preserve the original mobile anime details placement while hiding the poster.

- Simplified mobile anime details and changed episode cards to compact thumbnail rows.

- Match manga and light novel spotlight background blur to their detail pages on desktop and mobile.

- **Card Action Buttons & LN Page Fixes**:
  - Removed the three-dots (`...`) action button from all cards across Anime (`AnimeLandscapeCard.tsx`, `AnimeCard.tsx`), Manga (`MangaCard.tsx`, `ReadingCardArtwork.tsx`), and Light Novels (`LNCard.tsx`, `ReadingCardArtwork.tsx`), retaining only the single `+` / check button.
  - Resolved Light Novels page black screen crash caused by conditional hooks violation in `LNCard.tsx` (React Error #310), CORS blocks on AniList GraphQL requests via `postJson` native bridge in `lnService.ts`, and safe parsing guards in `useLNReadList.ts`.
  - Added synchronous fallback to Korean web novels in `LNSpotlight.tsx` to prevent blank hero banners on cold loads or rate-limiting.
- **Latest Manga AniList Cover Enhancement**:
  - Enhanced "Latest Updates" cards in `LatestMangaUpdates.tsx` with high-resolution AniList cover photos, horizontal banners, scores, and media format tags instead of raw pixelated scraper thumbnails.
- **Manga Spotlight Desktop-Style Background Cover**:
  - Enriched Manga spotlight items in `MangaSpotlight.tsx` with high-resolution widescreen horizontal backdrop banners (`bannerImage`) from AniList, matching the desktop spotlight presentation on mobile.

- Support an explicit Vite hot-reload address for Android development over ADB reverse.

- Fixed the light novel and manga spotlights crashing when loading finishes, and show manga posters in the mobile spotlight.

- **Mobile Portrait Cards & Right Sidebar Hidden**:
  - Transformed cards across Anime (`AnimeLandscapeCard.tsx`), Manga (`MangaCard.tsx`, `ReadingCardArtwork.tsx`), and Light Novels (`LNCard.tsx`, `ReadingCardArtwork.tsx`) into portrait format (`aspect-[2/3] md:aspect-video`) on mobile screens to match the reference design:
    - Renders vertical portrait posters on mobile screens while preserving widescreen landscape backdrops/banners on desktop.
    - Added twin floating translucent action buttons at the top right of each card: `...` (more details/options) and `+` (add to watchlist/read list, which shows a checkmark when added).
    - Preserved top-left inverted cutout notch badges for episode airings and chapter numbers with seamless rounded corners (`rounded-[16px]`).
    - Adjusted mobile carousel item widths (`flex-[0_0_148px] sm:flex-[0_0_175px] md:flex-[0_0_290px]`) and grid columns (`grid-cols-2`) for natural mobile scaling.
  - Hidden the entire right sidebar (`AnimeHomeSidebar`) containing "Top Airing", "Upcoming", and "Airing schedule" on mobile/tablet viewports (`hidden xl:block`), displaying it only on desktop screens.

- **Unified Manga & Light Novel Mobile Spotlight Styling**: Aligned the Manga and Light Novel spotlight hero (`ReadingSpotlight.tsx`) to match the Anime spotlight on mobile devices:
  - Centered mobile layout with large bold title, circular score ring and format chip, clamped synopsis, and equal-width action pills ("Read" and "Details").
  - Added mobile spotlight slide indicator dots (`h-2.5 w-2.5 rounded-full`) aligned to the bottom center.
  - Reserved proper bottom clearance (`pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))]`) above the global black navigation bar.
- **Seamless 60fps Spotlight Swiping & Lag Fix**:
  - Eliminated the 700ms `mode="wait"` animation delay across `SpotlightHero` and `ReadingSpotlight` in favor of concurrent `mode="sync"` transitions (`0.22s`) so content updates instantaneously on swipe.
  - Removed GPU-intensive `scale: 1.03` layer transformations on fullscreen background covers during carousel transitions to prevent mobile GPU frame drops.
  - Optimized Embla carousel snap duration to `18` with `skipSnaps: false` for snappy, immediate tactile swipe response.
  - Memoized spotlight feed arrays (`display` and `items`) with `useMemo` in `MangaSpotlight` and `LNSpotlight` to prevent thrashing re-renders on slide changes.

- **Anime Spotlight Backdrop Covers Restored**: Restored TMDB and source backdrop images as the full cover background in the Anime spotlight hero (`SpotlightHero.tsx`) across both mobile and desktop viewports, ensuring widescreen backdrop presentation.

- **Unified Full-Width Black Navigation Across All Tabs**: Unified the global mobile navigation bar across all views (Explore, Anime, Manga, LN, and Library) using the full-width black navbar (`inset-x-0 bottom-0 bg-black border-t border-white/15 h-16`), featuring active top-edge indicator lines and labeled destinations. Adjusted Explore overlay and action button spacing (`bottom-20`) to sit seamlessly above the black navbar.

- **TikTok Mobile Explore Redesign & Bottom-Sheet Episodes Modal**: Redesigned the Explore feed for mobile screens to precisely match TikTok's layout:
  - Removed up and down navigation chevrons on mobile (`hidden md:flex`) in favor of natural vertical swipe scrolling.
  - Positioned the character profile avatar in the right-side vertical action bar directly above the Heart icon, adorned with an overlapping `+` watchlist badge. Clicking the avatar navigates to anime details, and tapping the `+` badge toggles watchlist status.
  - Cleaned the bottom-left overlay on mobile to display only the bold anime title and expandable synopsis with `#genre` hashtags and `... more` / `less` toggle, removing the redundant avatar and button clutter.
  - Removed the standalone "Details" button on mobile (`hidden md:flex`), as the profile avatar now serves as the primary route to details.
  - Transformed the Explore episodes drawer on mobile into a slide-up bottom sheet modal (`rounded-t-[28px]`, dark backdrop blur overlay, drag handle pill, and close `X` button), while preserving the side drawer panel layout on desktop.

- **Tauri Android Live HMR Development**: Configured Tauri Android development to enable live Hot Module Replacement (HMR) for frontend UI updates without needing to rebuild or reinstall the debug APK. Added `TAURI_DEV_HOST` binding and WebSocket configuration on port 5174 in `vite.config.ts`, multi-port process cleanup in `ensure-port-free.cjs`, automated `adb reverse` tunneling for ports 5173, 5174, and 3001 via `setup-android-reverse.cjs`, and `dev:tauri:android:reverse` for offline USB development.

- Reduced the size of Explore?s mobile navigation icons.

- **Explore mobile system bars**: Reserve room for the Android status bar and use a full-width black navigation bar with labelled destinations.

- **Mobile navigation and spotlight**: Add a floating Explore, Anime, Manga, LN, and Library bar and center the anime spotlight actions for mobile.

- **Tauri Android startup**: Hide the desktop title bar on mobile and prevent the external font stylesheet from blocking the initial render.

- **TikTok-Style Floating Action Icons & Decimal Score**: Removed circular background containers from the Explore vertical action bar to match TikTok's clean aesthetic, rendering bare icons with strong drop shadows and hover scaling. Formatted ratings as single-decimal scores (e.g. `6.1`, `6.6`, `8.4`) instead of raw percentages.

- **Explore Episodes Drawer Hook Order & Empty State Fix**: Resolved React hooks order violation in `ExploreEpisodesDrawer` where an early return preceded `displayedEpisodes = useMemo()`, which crashed component render when clicking the "Eps" icon. Moved component guards after all hooks and added an empty state fallback ("No episodes available yet") when no episodes have aired.

- **Upcoming and Unreleased Episode Suppression**: Hid the "Eps" action button and suppressed the episode drawer entirely for upcoming and unreleased anime titles in the Explore feed. Prevented the details page video player from mounting when an unreleased anime is visited with episode query parameters, avoiding black screen player states.

- **Explore Main Character Profile Avatar**: Replaced the anime cover poster in the bottom-left Explore feed profile circle with the anime's main character portrait queried directly from AniList character edges.
- **Explore Released Episodes & Streaming Metadata Sync**: Resolved missing thumbnails and generic titles in the Explore episodes drawer by capping airing series to officially released episodes (preventing unreleased future placeholder cards from cluttering the feed) and resolving episode titles and high-quality thumbnails from streaming and AniZip metadata.
- **Explore Episodes Drawer Watch Progress & Clean Header**: Connected the Explore episodes drawer to application-wide watch progress and continue watching history. Removed the season dropdown chip and chevron pagination controls, displaying a full scrollable episode list with real-time `Now playing` highlights, thumbnail progress bars, and watched checkmarks synchronized with the anime details page. Clicking an episode immediately registers it into Continue Watching and launches details playback.
- **TikTok-Style Expandable Synopsis with Genre Hashtags**: Styled the Explore card synopsis to match TikTok's expandable caption layout, showing a compact preview with an inline bold `... more` toggle that expands into the full synopsis with `#Genre` hashtags and a `less` toggle.
- **Explore 1080p High-Resolution Playback**: Enforced 1080p high-resolution playback on Explore trailers by supplying `vq=hd1080` parameters on YouTube player embeds and dispatching `setPlaybackQuality('hd1080')` and `setPlaybackQuality('highres')` on player initialization and state changes. Cleaned up standalone TikTok scraper routes and services.
- **Browse Anime 3x3 Grid Block Pagination**: Restored the 3x3 (9 items) landscape grid layout for Browse Anime while keeping white active pills (`Newest`, `Popular`, `Top rated`) and `See all >`. Wired the Studios-style `<` and `>` arrow buttons to paginate the entire 9-card block smoothly across pages instead of scrolling as a 1-row carousel.
- **TMDB setup**: Open the API settings and guide in the system browser on Tauri.

- **Tauri development**: Start or reuse the local API and wait for it before Vite starts, avoiding connection-refused errors.

- **Explore feed**: Remove extra document scrolling, reset the feed on refresh, and start available trailers as soon as the player is ready.

- **Tauri desktop migration**: Restore Discord Rich Presence and manga/novel disk exports, migrate existing offline chapters, and publish stable desktop download filenames for website links.

- **Desktop builds**: Restore the custom title bar and replace Electron packaging with Tauri desktop releases, and remove obsolete Electron-only frontend branches.

- **Desktop title bar**: Keep the page scrollbar below the window header.

- **Explore playback**: Start with sound enabled and hide the feed scrollbar.

- **Desktop setup window**: Show the desktop title bar and window controls on the TMDB setup screen.

- **Desktop readers and Tauri manga pages**: Keep manga and novel readers below the desktop title bar, proxy MangaKatana page images in Tauri, avoid caching empty chapter responses, and recognize the alternate novel source?s current search layout.

- **Explore trailer transitions**: Preload adjacent muted trailers without pausing them on scroll, start playback on the active card, and hide loading or unavailable YouTube embeds against a black background.

- **Explore Seamless Looping & Loading Screen Removal**: Removed the center "Generating Fresh Explore Feed..." loading screen and spinning icon for a clean, immediate dark transition. Implemented continuous player telemetry handshake and proactive near-end rewind detection (looping back to 0:00 when within 0.45s of completion or on ended state) so trailers loop continuously without ever showing the YouTube replay button or end screen.
- **Explore Play/Pause Animation & Scroll Polish**: Eliminated pause triggers and YouTube pause bezel flashes when scrolling between trailers on Explore by mounting the active trailer only and removing pre-pause commands during slide transitions. Added the exact watch-page center pop animation (`@keyframes animetsu-center-pop`, `bg-[#2A2322]/75`, 520ms bezier pop scale 0.62 -> 1 -> 1.18 -> 1.72 with white Play/Pause icons) when pausing or resuming playback.
- **Dynamic, Personalized Explore Recommendation Algorithm**: Upgraded Explore with a session-based multi-category recommendation engine. Every visit to Explore (initial entry, navigating back from details/library/search, or clicking the sidebar Explore icon) generates a fresh session with unique random seed, multi-bucket candidate retrieval (Airing, Trending, Upcoming, Classics, Personalized, and Experimental), 24-hour exposure cooldown with dynamic relaxation, real-time user interest modeling (tracking genres, studios, watchlist, likes, trailer dwell time, and skips), and anti-clustering genre diversity. Added a subtle "Hide" (Not Interested) action to exclude unwanted titles permanently and a 1-click feed refresh button.
- **Removed Native YouTube Controls & Added TikTok Interaction Barrier**: Eliminated native YouTube on-screen overlay controls (the `|<<` previous and `>>|` next track playlist buttons and `( || )` center pause circle) by removing `playlist` query parameter injection and adding a transparent interaction barrier over the video. Added clean programmatic play/pause toggling via YouTube IFrame API `postMessage`, an animated TikTok-style play indicator on pause, instant mute toggling, and automatic seamless looping.
- **Sidebar Explore Navigation**: Replaced the redundant Back button with an Explore compass icon (`/explore`), preserving the 5-click logo Vault unlock mechanism.

- **Discord-style custom desktop header & window controls**: Replaced native OS window frame with a sleek frameless title bar matching Discord's layout (`decorations: false` in Tauri). Features back/forward navigation arrows (`← →`), a clean frameless context display with Yorumi icon (showing "Anime" on home and dynamic media titles on details pages), and custom window control buttons (minimize, maximize/restore toggle with state tracking, and close with Windows/Discord red hover styling). Added window management permissions in Tauri capabilities and adjusted desktop sidebar/page layout spacing.

- **Seamless skeleton loading states across Anime, Manga, and Light Novels**: Updated Spotlight skeleton layouts for Manga and Light Novels to include the right-hand 3D rotating cover stack and large title headlines, aligned landscape card skeletons (`aspect-video rounded-[14px]`) across all Manga/LN carousels and Top 100 grids, exported `AnimeLandscapeCardSkeleton` to prevent runtime component errors, eager-loaded top-level hub pages (`MangaPage` and `LNPage`), and replaced bare `Loading…` text fallback with context-aware skeleton shells.

- **Unified Anime Cast pill styling for Manga and Light Novels**: Restored the original Anime details "Cast" tab with translucent 4-column pills, circular avatars, and dual voice actor credits; aligned Manga and Light Novel character sections to follow this exact same styling.

- **Manga & Light Novel scraper speed and chapter reliability**: Eliminated home-page background MangaKatana scraping that triggered IP rate-limiting, paced search requests with empty-response retry, cached chapters directly from MangaKatana 302 detail redirects and `.alt_name` aliases, added fast NovelBin `/ajax/chapter-list` slug probing with AllNovelFull fallback, parallelized AniList metadata and chapter resolution on details pages, and prevented empty chapter lists from polluting offline caches.
- **Tauri dev server port cleanup**: Updated `ensure-port-free.cjs` and `vite.config.ts` to wait for Windows TCP port release before starting Vite so `npm run dev:tauri` loads cleanly on the first run.

- **Manga chapters**: Fall back to available English MangaDex chapters when MangaKatana returns empty responses, and label the potentially incomplete list.

- **Manga credits**: Show only the primary story author in the details and spotlight metadata.

- **Manga chapter resolution**: Handle MangaKatana search redirects and keyword fallbacks, and avoid caching unresolved chapter sources.

- **Reading backgrounds**: Apply the same soft blur to manga and light novel spotlight and details artwork.

- **Manga and light novel cards**: Match the anime landscape card style, show available scores and publication years, and show available chapter counts for unfinished titles.

- **Light novel spotlight**: Match the manga spotlight with softened artwork, yellow controls, rating and metadata styling, cover placement, and a four-line synopsis.

- **Manga spotlight ratings**: Look up matching AniList scores for MangaKatana titles and reuse the anime metadata row with a manga format chip.

- **Manga spotlight**: Show the rating and a four-line synopsis, and move the cover carousel left.

- **Reading spotlights**: Reduce the size of the manga and light novel cover carousel.

- **Reading spotlight backgrounds**: Show full-screen artwork and restore purple manga and yellow light novel accents.

- **Reading details backgrounds**: Restore full-screen manga and light novel artwork, using a softly blurred cover when no banner is available.

- **Reading recommendations**: Show a More like this carousel of AniList recommendations below manga and novel chapters.

- **Manga and novel details**: Match the anime details presentation while retaining chapter reading, list, and download controls.

- **Reading spotlights**: Restore a larger three-cover carousel for manga and light novels.

- **Reading spotlight artwork**: Use landscape banners when available and display portrait covers without stretching them across the screen.

- **Manga and novel home pages**: Match the anime home spotlight and section styling while preserving portrait cover cards and reading navigation.

- **Continue Watching details**: Preserve AniList and MAL identities and artwork when resuming saved history, avoiding mismatched details from legacy numeric IDs.

- **Continue Watching**: Match anime carousel card sizing and logo overlays while showing episode thumbnails, inset white progress, season and episode labels, and remaining time.

- **Episode cards and seasons**: Show a simple Now Playing indicator and label single-season series without a dropdown.

- **Cleaner video player**: Remove the adjacent-episode background panels and the video ambient-light effect and control.
- **Playback source failures**: Stop repeatedly restarting an exhausted movie or episode lookup and show the unavailable-stream state when all sources fail.
- **Anime home rankings**: Rank Top 10 Today using AniList's latest daily trend snapshot and use TMDB daily trending for Trending Now.
- **Studio layout**: Center the studio card grid within the available page width.
- **Complete season discovery**: Search the base franchise name when resolving related seasons, so entries such as The Apothecary Diaries Season 1 are not omitted when viewing Season 3.
- **Studio card consistency**: Match the anime carousel's landscape card width and hide title overlays when logo artwork is unavailable.
- **Studio card details and logos**: Include complete season relation metadata, tolerate older partial records, and retry logo lookups without confusing AniList and TMDB IDs.
- **Studio catalogue main titles**: Exclude short-form and special entries and group explicitly linked alternative film editions into a single card.
- **Studio logos and sorting**: Show available company logos and add Newest, Popular, and Top Rated sorting to studio catalogues.
- **Studio browsing**: Load additional anime automatically while scrolling, with skeleton cards during each request.
- **Fullscreen anime spotlight**: Restore the anime home backdrop and its loading skeleton to viewport height.
- **Studio series grouping**: Combine explicitly related seasons and specials into one series card while leaving movies separate.
- **Studio catalogue duplicates**: Filter repeated AniList media IDs across studio pages.
- **Anime home and studios**: Show up to ten scrollable airing and upcoming titles, and open ranked studio catalogues with the top-rated anime's backdrop.
- **Tauri mobile storage paths**: Place the mobile database and anime downloads in the platform-provided app data directory, and report database initialization failures instead of silently losing data in memory.
- **Tauri Android TLS build**: Use Rustls for native HTTP to avoid a cross-compiled OpenSSL dependency.
- **Tauri media protocol portability**: Use the platform-specific custom protocol URL for playback and preserve it when rewriting HLS playlists.
- **Tauri Android scaffolding**: Initialize the Android project and add development and APK build commands for the ongoing native migration.
- **Anime details tabs & mini player auto-minimize**: Removed the redundant 'About' tab from anime details (synopsis and metadata remain accessible in the hero section). Switching to the 'Cast' or 'More like this' tabs while playing automatically minimizes the video into the persistent floating mini player so audio and video continue smoothly, while expanding the mini player automatically navigates back to the 'Episodes' tab and scrolls into view.
- **Landscape recommendations ('More like this')**: Renamed 'Related' to 'More like this' on the details page and rendered recommendations using 4-column landscape cards matching the home page carousel styling.
- **Seamless cutout notch on anime cards**: Preserved the inverted curved tab notch geometry (`buildTopLeftNotchGeometry`) on landscape cards with an SVG cutout mask on the image container so the ambient background naturally shines through, extending the mask coordinates outward to eliminate subpixel anti-aliasing edge lines.
- **Harmonized Anime Home spotlight skeleton**: Synchronized `SpotlightSkeleton` dimensions and gradient alpha mask directly with `SpotlightHero`, eliminating vertical layout jumps and flashing dark boxes during home page loading.
- **Vivarium-style ambient light page blending**: Re-engineered full-page ambient illumination using oversized high-saturation bloom canvases, removing hard bottom borders with progressive linear-gradient alpha masks so backdrop artwork smoothly dissolves into luminous colored ambient light across the entire viewport.
- **Pinned Details poster card alignment**: Fixed details page portrait poster shifting downwards when expanding synopsis descriptions.
- **Tauri protocol CORS & panic resilience**: Fixed stream requests getting blocked by Chromium WebView2 CORS policy.

## [4.3.0] - 2026-10-16

- **Bounded Android HLS downloads**: Fixed large mobile episode downloads slowing down or stopping partway through when temporary segments consumed the same amount of storage as the final video. Android now keeps a small parallel prefetch window, assembles segments into the final temporary file as they arrive in playlist order, deletes staged segments immediately, checks estimated free space before starting, and reports the failing segment's network error when retries are exhausted.

- **Complete Android offline Anime playback**: Fixed downloaded HLS episodes freezing after the first synthetic byte-range chunk (commonly around 23 seconds). Native downloads now preserve every source segment's exact duration and byte boundary, offline playback sends explicit range requests to the loopback file server, empty segments fail the download, and incompatible v4.3.0 Android HLS downloads are removed from storage so users re-download them in the corrected format.

- **Correct v4.3.0 Android release asset**: Replaced the v4.2.0 APK that had been attached to the v4.3.0 GitHub release through the unsigned CI fallback, refreshed the bundled fallback with the signed v4.3.0 build, and made mobile release CI reject bundled APKs whose embedded version does not match `package.json`.

- **Current website downloads and compact mobile actions**: Pinned the marketing site's downloads to the verified v4.3.0 GitHub release assets, removed invalid Windows/Linux portable links, corrected the macOS downloads to the published universal DMG and ZIP, removed the heart from the download heading, and kept Download and Development docs on one mobile row.

- **Library Category Management & Deletion Modal**: Added full category lifecycle support across desktop and mobile, allowing users to create custom categories, edit category names with an ergonomic inline save button, reorder categories, and delete custom categories with an interactive dialog offering options to reassign existing entries to Default or remove them entirely.

- **Sticky Controls & Leveled Library Grid**: Converted the library controls and category navigation bar into a sticky header with frosted glass backdrop blur (`backdrop-blur-md`), preventing layout jumps while scrolling. Aligned card content top levels across both comfortable and compact grid display modes, standardizing title height clamping and sub-info row placement (progress badges, episode counters, and download indicators).

- **Click-Outside Search Dismissal & Mobile Search Ergonomics**: Updated the library search input across desktop and mobile to automatically close when clicking outside the search container. Maintained native bottom search placement on mobile for one-handed reachability while integrating seamless search toggle states.

- **Direct Scraper Detail Routing & Episode Metadata Sync**: Fixed library click navigation for scraper-backed entries, resolving provider-qualified routes cleanly to prevent empty or broken detail views. Preserved episode numbering and sub/dub metadata synchronization across season boundaries.

- **Aniyomi-style mobile Library controls**: Added mobile category tabs with persisted custom categories and entry assignment, inline Library search, Yorumi-native Downloaded/Started/Completed filters, alphabetical/count/recent sorting with direction control, compact/comfortable/cover-only/list display modes with adjustable grid density, and a three-dot menu for adding categories or opening a random entry from the currently visible results. Library sheets hide the mobile navbar while open so every option remains reachable.

- **Consistent download controls and card sizing**: Kept queued/downloading indicators neutral across Anime, Manga, and Light Novels; reserved blue, purple, and yellow accents for each page's active list/grid view control; stopped showing Anime's desktop download folder as active by default; and matched Anime download cards to the six-column Manga/Light Novel download sizing.

- **Mobile library category dropdown**: Replaced the compact Anime, Manga, and Light Novel icon toggle in the mobile Library header with a smaller white labeled dropdown that clearly shows the active category and closes after selection, outside taps, or Escape. Mobile card titles are strictly capped at two lines with an ellipsis instead of exposing a partial third line. The existing desktop selector remains unchanged.

- **Smooth neutral download progress and faster Android HLS**: Removed the separate blue resolving spinner so Anime download controls stay the same neutral color and transition directly from the available icon into Mihon's wavy progress state. Circular progress now animates between percentage updates, Android notifications display a percentage instead of an ambiguous `1/100` counter, and native HLS downloads bypass the localhost playback-proxy double hop, use a rolling disk-backed segment queue, retry transient failures, and report byte-level progress. Android honors explicit source quality and otherwise selects a balanced 720p rendition instead of silently forcing the largest 1080p master-playlist variant.

- **Exact Mihon download indicators**: Replaced Yorumi's approximate download glyphs with Mihon's Apache-2.0 custom Material Symbols paths and current state treatment: outlined `DownloadCircle` when available, `DownloadArrow` over a 26dp rounded wavy progress ring while queued/downloading, and the filled rounded `CheckCircle` when complete. The shared indicator now appears consistently in Anime, Manga, and Light Novel rows and grids.

- **Native Android offline downloads**: Replaced episode-sized WebView Blob/IndexedDB writes with streamed native filesystem downloads, including temporary-file promotion, completion validation, HLS segment streaming, pause/resume, and byte-range offline playback. Manga pages and Light Novel chapter files now persist in the same app-owned native download tree while IndexedDB keeps lightweight catalog metadata. Removed the redundant download progress bar below Anime episode cards on Android and Electron; progress remains visible in the circular download icon and Android notification.

- **Mihon-style Android downloads**: Replaced Anime episode download spinners with circular available/progress/completed state icons, added a native Android foreground download notification with live progress and `Pause`/`Resume` plus `Show entry` actions, and made notification pause state suspend both HLS segment batches and direct-stream reads until resumed.

- **Responsive NovelBin loading and stable desktop Anime hero**: Reworked backend and native NovelBin throttling so only request start times are spaced; a slow response or retry no longer blocks every later NovelBin operation behind one global queue. Reduced retry/timeout amplification, fetched novel metadata and chapter indexes concurrently with inline fallback, and kept desktop Anime posters and titles top-aligned while expanded synopsis text grows downward without repositioning the hero.

- **Repository knowledge vault**: Added a linked `obsidian/` vault that maps Yorumi's runtime architecture, frontend and backend boundaries, content identity model, Anime/Manga/Light Novel flows, playback, offline storage, Electron and Android behavior, routes, external services, validation, debugging, and release procedures. Agent startup guidance now points to the vault, while personal Obsidian workspace state is excluded through `.gitignore`.

- **Expandable desktop Anime synopsis**: Added the mobile-style synopsis fade and chevron to Electron/desktop Anime details. Long descriptions can now expand to their full text and collapse again, while the hero details area grows with the content instead of clipping or overlapping the action buttons.

- **Standalone Anime episode layout**: Removed the redundant single season/title chip from Anime details when a title has no second navigable season. Season navigation now appears only when at least two distinct season entries are available on both desktop and mobile.

- **Mobile Anime season episode isolation**: Fixed the standalone Android HiAnime matcher treating unnumbered Season 1 and explicitly numbered sequels as the same title, which could show Season 2's shorter episode list under both season tabs. Rotated the stale episode cache and now enriches local-provider cards with matching TMDB titles, summaries, dates, and stills before falling back to the series poster.

- **Exact latest-Anime routing**: Requested and preserved AllManga's canonical `aniListId` across home Latest Updates, paginated latest/new-release feeds, and shared Anime card navigation. Sequel cards now route directly to their own AniList record instead of fuzzy-matching or falling back to the previous season, while retaining the AllManga session for episode playback; affected frontend and backend caches were rotated.

- **Canonical Anime season and arc chips**: Restored the generic season navigation policy: multi-entry AniList TV timelines keep their real `Season`, `Cour`, and `Part` identities, while long-running single-entry shows use TMDB's meaningful season/arc names. Fixed AniList's unpadded dates such as `2021-1-11` sorting after October and turning Season 1 into a duplicate Season 2, removed movie/special/OVA/ONA chip floods, excluded `NOT_YET_RELEASED` and future-dated seasons until they begin airing, kept AniBridge episode translation internal, and rotated affected caches without title-specific hardcoding.

- **Season-isolated Anime downloads**: Fixed downloaded/checkmark state leaking from Season 1 episodes onto identically numbered episodes in later TMDB seasons. Download lookup and progress now use the season-aware absolute playback episode for TMDB-backed grids instead of also matching the repeated season-local number, while existing Season 1 downloads remain recognized.

- **TMDB-authoritative Anime season chips**: Standardized Anime series navigation on TMDB's canonical numbered seasons for every title with a resolved TMDB record. Season chips now consistently render as `Season 1`, `Season 2`, and so on, exclude Season 0/Specials, and no longer expose AniList cour/part entries or virtual cour splits when TMDB season data is available. Verified AniBridge mappings remain in use only to select the correct initial TMDB season and preserve episode/playback translation.

- **Robust Offline Mode & Media Persistence**: Fixed offline playback and hero banner display across Anime, Manga, and Light Novels. Fixed hero banner image error fallbacks in `DetailsHero.tsx`, `MangaDetailsPage.tsx`, and `LNDetailsPage.tsx` to prevent portrait title placeholders from stretching into distorted shapes across widescreen banners. Resolved offline video playback stalls where downloaded episodes remained black at `0:00 / 0:00` by fixing `CustomHlsLoader` to provide complete Hls.js `LoaderStats` (preventing unhandled null dereferences in fragment and playlist controllers), enforcing valid byte-range headers for native `/api/scraper/local-file` requests, adding chunk slicing for blob URLs, bypassing false duration rejection for offline streams, and restoring full stream duration metadata from downloaded manifests. Persisted artwork thumbnails into CacheStorage/IndexedDB, regenerated manga page blob URLs on read, and kept library progress intact while offline.

- **Generic Anime episode playback isolation**: Scoped frontend stream caches by provider plus AniList/MAL IDs, titles, year, and format so placeholder episode sessions such as `instant:1` cannot collide across shows or seasons. Chromium/Electron now uses hls.js instead of its falsely advertised native HLS path, and repeat playlist/subtitle proxy requests always return a real body instead of an empty `304`, preventing valid episodes from remaining at `0:00` and cycling through every server.

- **Reliable offline downloads and season-safe playback**: Fixed Anime downloads choosing raw CDN URLs that return `403` instead of Yorumi's referer-aware proxy, fixed protected HLS segment URLs resolving against the upstream CDN and leaving `.tmp.ts` files on desktop, added safe startup cleanup for abandoned staging files, emitted absolute Yorumi proxy URLs from rewritten manifests, fixed native-mobile HLS segments escaping the on-device proxy, routed Manga page downloads through that proxy, rejected false-success desktop Anime downloads, and bounded Anime, Manga, and Light Novel bulk-download concurrency to prevent scraper overload and source rate limits. Downloaded MPEG-TS episodes now play as byte-range HLS fragments instead of waiting for an entire episode-sized segment, exactly one English subtitle track is exposed and embedded for offline use, download/player reuse requires an exact season ID, provider searches reject candidates from another explicit season, and season chips remain numerically ordered regardless of the active season. Ambient-mode player backing remains unchanged.

- **Light Novel reader identity navigation**: Matched the LN reader header to the Manga reader with a compact cover, primary novel title, and secondary chapter title. The cover/title block and back arrow now navigate directly to the novel's canonical details route instead of relying on browser history.

- **Unified AllManga Latest Updates**: Made AllManga's `Latest_Update` Anime feed the sole source for the Latest Updates homepage row and paginated view on both Electron and Android/iOS. Added a native Capacitor AllManga adapter, removed mobile TMDB first-air-date and AniList seasonal substitutes, increased the backend fast bundle to 18 entries, and rotated affected frontend caches.

- **AniList-ranked Trending Anime carousel**: Restored AniList `TRENDING_DESC` as the sole ranking authority for the Trending row on both backend-connected and standalone clients. Removed TMDB popularity padding that introduced unrelated catalog and legacy titles, retained TMDB for supplemental catalog/details metadata, rejected undersized Trending payloads, and rotated every affected cache.

- **Player-anchored ambient mode**: Replaced the viewport-fixed ambient projector with a document-anchored projection that stays locked to the video while scrolling and remains correctly positioned when playback is paused. Removed ambient-only borders from surrounding UI and increased the Blur and Spread slider track and thumb thickness for easier control.

- **Canonical Anime season labels and immutable display titles**: Removed synthetic scraper-search titles that were being written back into Anime metadata and repeatedly concatenating names such as SPY x FAMILY. Mapped chips now navigate to the real AniList season record while playback mapping remains a separate ID. Labels are derived generically from relationship order and explicit `Season`, `Cour`, and `Part` units, producing `Season 1`, `Season 1 Cour 2`, and `Season 2` without hardcoded series names; genuinely named sequels retain their titles.

- **Exact Anime season episode boundaries**: Fixed single-record TMDB shows bypassing virtual AniList season slices, which made Solo Leveling Season 1 display all 25 franchise episodes instead of 12. TMDB metadata projection now handles AniBridge's show-absolute ranges across later TMDB seasons, restoring all 220 Naruto episodes instead of stopping at the first 52, rejects overlapping alternative mappings as conflicts, and refuses to display incomplete mapped metadata as a complete episode grid.

- **Hard-reset Anime detail navigation**: Keyed the stateful Anime details tree by its provider-qualified route ID so searching another title destroys the previous title's season chips, poster, banner, and metadata state. TMDB search previews now generate real `tmdb-*` routes instead of invalid `mal-0` links, and episode grids require an exact owner—including the active AniBridge mapping—before rendering cached scraper episodes.

- **Complete Anime season discovery and route-safe metadata**: Merged verified AniBridge season boundaries with the cached AniList sequel chain so separately modeled sequels such as The Apothecary Diaries Season 3 remain visible without sacrificing mapped episode ranges. Reconnected every Anime homepage feed—including Spotlight and Top Ten—to the TMDB-backed catalog, rotated stale home caches, and added a strict route ownership gate so a newly searched title can never render the previous title's poster, banner, or metadata while it loads.

- **Anime mapping player isolation follow-up**: Kept TMDB player identities provider-prefixed, made persistent-player reuse require an exact content identity, scoped scraper-session caches to each AniBridge mapping, bypassed show-wide fast-session hydration during mapped season switches, and rotated the episode cache. This prevents a previous title such as Naruto from being reused in the Shangri-La Frontier player. TMDB Season 0/ONA mappings are no longer injected into normal TV season navigation.

- **Canonical cross-provider content architecture**: Superseded the interim AniList-first Anime workaround with TMDB-first discovery/details plus cached AniBridge v3 season and episode mappings. Anime season chips now use explicit mapping segments, so Shangri-La Frontier is split into two 25-episode entries while Naruto remains one 220-episode entry across four TMDB seasons; local display numbering stays separate from stream-provider numbering. Added provider-qualified shared IDs and mapping statuses, manga chapter availability/readability tracking, light-novel edition identity that rejects explicit LN/Web Novel conflicts, automated mapping/identity fixtures, and a repository-grounded architecture audit. Mapping downloads use a 24-hour local cache with stale fallback so normal browsing no longer requires routine AniList relation calls.

- **Canonical Anime identity, season totals, and episode clicks**: Made AniList the identity and episode-count authority for Anime search and AniList detail routes while retaining TMDB for supplementary season artwork and metadata. Provider-qualified routing and episode caches now share one canonical key, AniList fast details preserve their scraper session and playable episode payload, stale mixed-provider detail caches were rotated, and navbar search no longer opens franchise-wide TMDB records ahead of exact AniList seasons. This restores 25/25 episode separation for both Shangri-La Frontier seasons, the full 220-episode Naruto entry, and working episode-card playback from those detail pages.

- **Consistent search details and canonical routing**: Resolved route inconsistencies between searching and browsing from Home. When opening a title from search (via TMDB or search previews), the details page now automatically canonicalizes the route to the resolved AniList identity (`al-${id}`), preserves existing AniList and MAL IDs on search seed data, and never suppresses AniZip episode metadata. Enabled TMDB instant episode hydration with high-resolution stills and synopses as an immediate zero-latency fallback whenever scraper episodes are pending, eliminating generic placeholder episode cards ("1. EPISODE 1") and poster repetitions. Filtered out zero-episode and unreleased TMDB seasons from chip navigation.

- **Canonical season routes and episode metadata recovery**: Fixed AniZip specials (`S1`..`S24` ONA monologue shorts) overwriting canon TV episodes in AniZip mappings, which was stripping episode stills and replacing canon episode titles and overviews with generic shorts fallback metadata. Rotated the AniZip episode metadata cache to purge stale corrupted session storage. Unified season chip navigation to route directly to each season's canonical ID (`al-${id}`) without query parameter redirect loops or mismatched route states, and fixed AniList season chips incorrectly matching TMDB season intercept logic in `handleSeasonChipClick`, ensuring clicking any season chip navigates and renders immediately with full high-resolution screencaps, titles, and descriptions.

- **Unreleased season chips exclusion**: Season chains and navigation chips now strictly filter out unreleased future seasons (e.g., upcoming sequels and split cours with `NOT_YET_RELEASED` status, future start dates, or future years). Only currently released or actively airing seasons are displayed in season chip navigation, and season chain caches were rotated across frontend and backend.

- **Strict unreleased episode filtering**: Unreleased and future-dated anime episodes are now completely filtered out from episode grids, lists, counts, and player carousels. Ongoing airing anime no longer display locked "UNRELEASED" placeholder cards or un-aired trailing episode placeholders, episode counts accurately reflect only released episodes, and playback navigation cannot advance to unreleased episodes.

- **Season-owned episode grids**: Episode arrays now carry the identity of the anime that loaded them. Switching from a newly airing Season 2 with only two released episodes back to Season 1 immediately rejects that stale two-episode array, shows the correct resolving state, and renders Season 1 only after its own cached or scraped episode list is available.

- **Series-correct franchise episode totals and playback**: AniList franchise chips no longer borrow TMDB season slices such as Naruto's 52-episode season or Shippuden's 21-episode season. Each selected entry now loads its own scraper session and exact AniList episode total, full sequel titles such as Boruto are preserved, unreleased zero-episode continuations are hidden, and complete resolved chains are reused across chip switches.

- **Complete AniList sequel chains**: Season navigation now resolves bounded multi-hop PREQUEL/SEQUEL relations in one AniList GraphQL request, allowing continuations such as Sword Art Online: Alicization to appear without reintroducing per-season request bursts or unrelated franchise/spin-off chips. Rotated the affected frontend, backend, and persisted season-chain caches.

- **Anime playback identity recovery**: Kept AniList season metadata IDs isolated from the loaded scraper playback session, restoring stream requests on details pages after dynamic season artwork and metadata switching was introduced.

- **Franchise-safe Anime season chains**: Removed AniList `PARENT` relations from season navigation so broader franchise entries and spin-off parents cannot be mislabeled as Season 1. AniList entries without an explicit season number now retain their real title instead of receiving a generated Season 1 label, and stale season query IDs are ignored unless they belong to the current series chain.

- **AniList-native season metadata switching**: Replaced generic TMDB season controls with real AniList sequel/prequel entries whenever available. Selecting a season now hydrates that exact AniList record so the hero title, poster, banner, synopsis, score, year, status, and episode count change with the season while the underlying search route remains stable.

- **Route-safe Anime season switching and thumbnail recovery**: Season chips are now hidden while a newly searched TMDB title replaces the previous details state, AniList-linked seasons remain on the current title route, selected sequel metadata can switch to its own TMDB mapping, and scraper snapshots remain available when TMDB/AniZip do not provide episode stills.

- **Season chips on searched series details**: TV series opened from TMDB-backed search results now keep their resolved season metadata and display an active season chip even when the show currently has only one season. When TMDB models a sequel as a separate TV record, one cached AniList relationship lookup restores the complete season chip chain without bringing back the previous request burst.

- **AniList-ranked Anime home with bounded requests**: Restored AniList as the authority for Trending, Popular This Season, All-Time Popular, and Top Trending while retaining TMDB for details, seasons, and episode artwork. Cold-start home rankings now come from one batched AniList GraphQL query behind the shared home cache instead of five parallel requests, and standalone mobile uses the same single-query bundle.

- **Reliable first-load Anime home sections**: Prevented incomplete home bundles from being cached, rotated affected home caches, and made concurrent TMDB metadata consumers share identical in-flight requests. TMDB remains the direct source for Anime search, genres, A-Z discovery, details, seasons, and episode artwork while ranked home feeds use the batched AniList path.

- **Season-correct Anime episode thumbnails**: Prevented season-local AniZip episode numbers from overwriting TMDB stills after switching seasons. TMDB season stills now remain authoritative, AniZip enrichment is matched only by a safe absolute episode number for TMDB seasons, and the affected TMDB cache namespace was rotated.

- **TMDB-first Anime identity, search, and season navigation**: Made TMDB authoritative for Anime search, catalog feeds, metadata, episode totals, and multi-season navigation on desktop and mobile. Routine search, trending, popular, seasonal, genre, Spotlight, and home requests no longer fall through to live AniList calls when TMDB is empty, eliminating catalog request bursts that could trigger AniList 429 responses. AniList remains only for unresolved legacy AniList/MAL IDs, and affected metadata/home caches were rotated.

- **NovelBin chapter and title resolution recovery**: Restored NovelBin as the primary light-novel reader, serialized and retried its rate-limited requests across backend and native Android paths, rejected empty/error-page chapter payloads, tightened title matching to prevent a selected novel from opening another title, and rotated light-novel caches so stale failures and source mappings cannot persist.

- **Stale Anime details redirect**: Opening a second anime from search after viewing another (e.g. One Piece) no longer bounces back to the first title. The details page stays mounted across routes, and its canonical-ID and franchise-root redirects were acting on the previous title's `selectedAnime`/season chips for one render; both now only redirect when that data matches the current route.

- **Canonical Anime navigation and metadata flow**: Unified Spotlight, search, catalog, saved-list, and legacy Anime links around provider-qualified AniList, MAL, TMDB, and scraper routes; made AniList the shared Electron/Android catalog authority; added MAL/TMDB-aware detail resolution; namespaced and rotated details, home, season, episode, and AniZip caches; and restored episode descriptions across desktop and mobile cards.

- **Search modal result recovery**: Prevented failed or empty startup searches from being cached, added a bounded backend request with TMDB fallback, corrected AniList/MAL identity mapping, and restored a visible loading indicator while Electron search is in flight.

- **Canonical franchise details routes**: AniList sequel search results now collapse onto the earliest main-series details route and preserve the requested entry as the active season, so Spotlight, search, and season chips use one shared Anime page instead of separate season pages.

- **Automatic Manga and LN hydration**: Standardized Manga Spotlight, catalog, and search navigation around the catalog ID while retaining scraper IDs for chapters, and made Light Novel Spotlight consume its automatically fetched full metadata on desktop and mobile.

- **Faster Manga rows and cleaner LN cards**: Loads Top Manga, All-Time Popular, and Popular Manhwa through one shared catalog request; hides ranks and ratings outside Top 100 Novels; and replaces country-code badges with Light Novel or Web Novel labels.

- **External TMDB setup links**: Opens the TMDB settings and setup guide in Android's system browser, and allows both trusted destinations through Electron's external-link handler instead of replacing or silently blocking the app window.

- **Electron Spotlight synopsis restoration**: Correctly maps wrapped AniList Spotlight metadata from the local backend and rotates affected home caches so desktop builds display synopses immediately instead of retaining empty cached entries.

- **Transparent 16:9 ambient frame**: Preserved the player's structural 16:9 viewport and `object-contain` behavior for older 4:3 anime. Only the frame backing becomes transparent during ambient mode, allowing projected pixels to replace black letterbox space without stretching or cropping the source.

- **Clean ambient player corners**: Removed the opaque black backing colors from the complete desktop player stack while ambient light is active, including the persistent-player portal and its details-page mount target. Rounded corners now reveal the ambient projection instead of a hidden black container.

- **Ambient-light control icon**: Replaced the top-left Ambient Light trigger's generic settings gear with a dedicated sun/ambient-light icon, while preserving the gear for the player's normal playback settings.

- **Independent ambient blur**: Blur now activates the ambient renderer even when Spread is 0%, keeping a 1x video projection behind the player and allowing its softened colors to spill outward like the reference extension. Ambient remains completely disabled only when both controls are 0%.

- **Anime-blue episode toolbar**: Changed the active list/grid view icon and downloads-folder icon in the Anime episode toolbar to the same blue accent, while preserving the shared purple view-toggle default for non-Anime sections.

- **Ambient-transparent player menus**: The Ambient Light, playback settings, and subtitle popovers now use a translucent dark surface while Spread is active, allowing projected video color to remain visible behind the menus while retaining readable controls.

- **Ambient-transparent episode tiles**: Episode thumbnail cards now use a subtle translucent surface while ambient light is active, allowing the video projection to remain visible through the episode grid without fading the thumbnail artwork or sacrificing label contrast.

- **Undimmed ambient colors**: Removed the separate 162-degree black page gradient from the ambient compositor. At 0% Blur, Spread now shows only sharp pixels sampled from the current video frame without an additional dark tint mixed over them.

- **Compact ambient settings menu**: Restyled the Ambient Light popup to match the player's existing settings surface, using the same compact dark panel, 208px width, small header and labels, tighter spacing, and a reduced 32px settings trigger.

- **Continuous source-origin ambient projection**: Rebuilt Spread from sharp concentric copies anchored to the exact visible video rectangle. Copies are composited largest-to-smallest in dense 3% steps around one center, forming smooth successive outer bands that continue source pixels like rays instead of presenting a detached enlarged screen. Every copy uses a proportionally scaled version of Yorumi's 16px player radius, Blur remains an independent optional softening pass, letterboxed media uses its real picture bounds, and 0% Spread produces no ambient layer.

- **Projector-accurate ambient boundary**: Ported Ambient Light for YouTube's independent horizontal/vertical projector-shadow model into the single-canvas renderer, using its 15% spread fade start and `16 / (35 × 0.64)` power curve. The projected rays now multiply through a curved outer alpha boundary instead of ending in a generic radial CSS mask.

- **Scrollbar-safe ambient spread**: Moved the expanded ambient projector into a fixed, strictly contained viewport layer so high Spread values are clipped to the visible screen and can no longer create bottom or side scrollbars.

- **Smooth rounded ambient playback**: Replaced the multi-canvas ambient renderer (up to 36 frame copies per update) with one low-resolution, GPU-composited projector driven by decoded-video frame callbacks. The desktop inline player retains its rounded corners without restoring the old drop shadow, keeping a clean edge between the video and its ambient field.

- **Seamless ambient player surface**: Removed desktop inline-player drop shadows so projected video colors meet the player edge without a dark halo, and made the desktop navigation rail translucent while ambient light is active so the effect continues behind the sidebar without reducing icon readability. Mini-player elevation remains unchanged.

- **Video-reactive ambient light controls**: Replaced the redundant desktop player server badge with a settings icon and a compact Ambient Light panel. Blur and Spread default to 0% without a separate toggle; Spread projects the current frame outward from its source while Blur softens the projected image. Server selection remains available in the main player settings.

- **Total releases download badge in README**: Added a Shields.io `for-the-badge` styled badge with the official Yorumi icon right before the React badge in the header, displaying all-time total downloads across all GitHub releases linked directly to the project releases page.

- **Website platform download cards visual hierarchy alignment**: Standardized button dimensions, typography, and vertical spacing across macOS, Windows, Linux, and Android download cards on the website. All primary download buttons now share an identical 48px height with single-line labels, all secondary buttons share a 44px height (including adding a GitHub release mirror button to Android), tertiary release asset links and minimum requirement sections are aligned horizontally, and card hover animations are unified.
- **Material 3 bottom navbar and mobile back-to-top cleanup**: Adjusted the mobile bottom navigation bar height from 62px to the standard 80px container height to match Material Design 3 / Tachiyomi / Mihon proportions with centered pill indicators, increased page bottom padding clearance in App layout, and completely removed the floating back-to-top button on mobile while preserving it for desktop viewports.
- **Current-season mobile episode drawer**: Made the loaded anime identity authoritative when resolving franchise season chips, preventing a base-series route ID from selecting Season 1 episodes while watching later named entries such as JoJo's Bizarre Adventure: Steel Ball Run.
- **Reliable tap-to-toggle player controls**: Removed Android's synthetic mouse-move race from the page-layout player so each ordinary video tap consistently alternates controls between shown and hidden, without control-button taps triggering the surface toggle.
- **Video-relative mobile control centering**: Centered the lock, seek, and play controls against the actual video viewport instead of the full player shell that includes the bottom timeline deck, keeping controls visually centered in portrait and fullscreen playback.
- **Latin-script subtitle identification**: Subtitle selection now analyzes dialogue vocabulary to distinguish the one genuine English track from provider-mislabeled Spanish, French, German, Italian, Portuguese, Indonesian, Turkish, Polish, Dutch, Romanian, and Vietnamese tracks.
- **Player-verified subtitle menu languages**: The video player now inspects every subtitle track before labeling the selector, overriding duplicated English provider labels with the actual detected language and clearing stale stream caches that retained incorrect metadata.
- **Accurate subtitle language labels**: Subtitle resolvers on Electron and standalone Android now inspect subtitle text for distinctive scripts instead of blindly trusting duplicated provider metadata, so Arabic and other non-Latin tracks are labeled correctly rather than appearing as English.
- **Component-accurate loading skeletons**: Rebuilt Anime, Manga, and Light Novel spotlight placeholders around the current artwork-first mobile and cover-stack desktop layouts, including matching heights, safe-area badges, metadata, titles, and compact actions. Card skeleton spacing and badges now mirror the latest live Anime and Manga cards.
- **Eight-entry Android Anime Spotlight**: Expanded the standalone Android trending spotlight bundle from six to eight Anime entries to match Electron, and rotated the affected home caches so existing installs receive the complete list immediately.
- **Compact desktop-style mobile spotlight actions and larger mini-player**: Anime, Manga, and LN mobile spotlights now use smaller colored primary Watch/Read actions followed by dark Detail buttons matching desktop hierarchy. The Electron mini-player is larger, remains 16:9 and window-clamped, and forces the complete video surface to fill its bounds without cropping.
- **Android system Back navigation stack**: Hardware Back now closes Anime playback to its details page before returning to Anime Home, routes secondary section roots back to Home consistently, and minimizes Yorumi at Home instead of terminating the application process.
- **Restored player control pills and strict lock mode**: Restored the compact rounded backgrounds around bottom player actions, raised and tightened the row toward the timeline, and completely unmounts the bottom interaction deck while locked so invisible controls cannot still pause or seek playback.
- **Minimal mobile player chrome**: Removed the visible bottom controls container, reduced the mobile/fullscreen timeline and button sizing, tightened the center playback cluster, and moved the smaller lock action farther inward from the left edge.
- **Dub subtitle cleanup**: Switching playback to dub now immediately disables every active browser text track and removes subtitle track elements from dubbed streams, preventing the final subtitle cue from freezing on-screen.
- **Centered mobile player controls**: Removed the redundant top-left server badge from the mobile player because server selection already exists in Settings, and vertically centered the lock, seek, and play controls against the complete fullscreen viewport.
- **Deterministic player settings dismissal**: Added a dedicated click-away layer so Electron and Android close settings only when tapping outside the card, while pointer, mouse, and touch events inside remain captured for Server, Quality, and playback controls.
- **Player settings interaction isolation**: Raised the settings control stack above the scrubber and disables timeline pointer events while a settings or subtitle menu is open, so Server selection works on Electron and Android without seeking playback. Auto Skip also uses the aligned Lucide icon sizing shared by the other settings rows.
- **Compact and lock-safe mobile player controls**: Inset and shortened the bottom player deck, moved next episode beside volume instead of the fullscreen side rail, blocked hold/keyboard playback actions while controls are locked, and expanded surface taps across the player overlay to hide visible controls.
- **Position-independent Season 1 labeling**: Anime season selectors now identify the earliest unnumbered base series as Season 1 instead of assuming the first rendered chip is the original, fixing chains that sort an active Season 2 before the base entry.
- **One Piece arc season labels**: One Piece keeps TMDB's meaningful arc titles in its season selector instead of replacing all twenty-plus arcs with generic numbered season labels.
- **Reliable active Anime season highlight**: Season chips now reconcile route, AniList, MAL, and normalized title identity so the currently opened season remains highlighted after entering details from mobile search, even when providers use different IDs.
- **Semantic Anime season selectors**: The original entry is shown as Season 1, sequel titles explicitly containing season, cour, or part markers are reduced to labels such as Season 2 Part 2, and colon-separated franchise sequels keep only their meaningful subtitle, such as Stardust Crusaders, Diamond Is Unbreakable, or Shippuden.
- **Complete Anime Spotlight logo preloading**: Preloads transparent logo artwork for every Anime Spotlight entry with bounded concurrency, preserving Fanart.tv priority on Electron and TMDB-backed standalone resolution on Android instead of resolving only the first visible slide.
- **Isolated website development port**: Pinned the separate documentation website to port 5174 so it cannot occupy the Electron app's port 5173 and accidentally render the website inside the desktop window, and removed `strictPort` so Vite dev server starts reliably without crashing if an orphaned process temporarily occupies the port.
- **Anime spotlight logo hierarchy and cleaner episode heading**: Restored Fanart.tv clear logos in Electron Anime Spotlight, added Android transparent-logo resolution through the configured TMDB token, and retained text titles only as the final fallback. Restored the Android Anime header actions while removing the duplicate sort/view controls beside the mobile Episodes heading.
- **Standalone Android Anime support**: Wired on-device AniList anime discovery (home, trending, search, popular, A-Z lists, and full details) and HiAnime local episode/stream resolution into the Android application, enabling completely standalone anime browsing, episode discovery, and video playback on mobile without requiring a local or remote Express backend.
- **Official Android app launcher icon and branded splash screen**: Replaced the default Capacitor app icon and splash screens with official high-resolution Yorumi adaptive foreground/background mipmap assets and legacy round/square icons across all device densities (mdpi through xxxhdpi).
- **Sticky mobile search bar**: Fixed mobile search header failing to stick when scrolling by replacing ancestor `overflow-x-hidden` with `overflow-x-clip` and clearing residual motion transforms on page transition completion.
- **Unified mobile details synopsis and genre chips**: Added the manga/light-novel expandable faded synopsis and centered show-more caret to anime details, standardized manga and light-novel genres on anime's compact filled pill chips, and reduced synopsis text sizing consistently across all three detail views.
- **Direct mobile anime playback controls**: Removed the redundant download button beside the mobile Episodes heading and stopped episode selections from scrolling the underlying details page before opening the dedicated mobile player.
- **Unified mobile chapter headings**: Matched manga and light-novel chapter headings to anime's `Episodes (count)` layout, including typography, count treatment, spacing, and the trailing divider.
- **Reliable details-page back navigation**: Made anime, manga, and light-novel detail back actions return directly to their respective home pages, including Android system Back, instead of looping through player and query-string history entries.
- **Unified simplified mobile media homes**: Redesigned anime, manga, and light-novel home sections with compact numbered headings, cleaner dividers, reduced side padding, and hidden mobile carousel arrows. Standardized all three spotlights on a full-bleed artwork layout with featured counters, flat metadata, simplified actions, and no floating cover thumbnail.
- **Mobile media card and spotlight refinement**: Expanded anime All-Time Popular to twelve visible mobile entries, matched manga and light-novel carousel/grid card sizing to anime, and restored each spotlight's original chips, colors, and action styling inside the compact rounded feature-card layout with a slide counter.
- **Swipeable mobile spotlight card layout**: Rebuilt anime, manga, and light-novel mobile spotlights around the artwork-first reference layout with top status/count badges, bottom-anchored titles and metadata, equal pill actions, and unobstructed horizontal swipe navigation.
- **Poster-only mobile spotlights and airing countdown**: Switched mobile spotlights to sharp portrait posters without banner artwork or blur, removed frosted-glass effects from mobile controls, and added the next anime episode with a compact days/hours/minutes airing countdown.
- **Complete anime spotlight metadata**: Added format, available episodes, rating, duration, genres, and studio to the mobile anime spotlight, with a tighter bottom-anchored layout matching the reference.
- **Edge-to-edge mobile spotlights**: Removed the inset card radius, border-like framing, margins, and shadow from mobile spotlights, and moved the status and slide-count badges below the device safe area.
- **Spotlight genre hydration and blur cleanup**: Removed the leading airing-badge icon, hydrated missing anime detail metadata so genre chips render before the studio, and removed remaining blur effects from Manga and LN spotlight artwork and controls.
- **Consistent Manga/LN spotlight brightness**: Removed the extra mobile black overlay and full-height gradient from Manga and LN, matching Anime's bottom-only readability gradient, and added reliable Manga author fallback rendering after genre chips.
- **Anime spotlight autoplay**: Added the same five-second looping autoplay behavior used by Manga and LN while preserving swipe navigation and pausing on desktop hover.
- **Mobile Top Trending layout**: Reworked the ranking panel for phones with a larger responsive heading, stable Today/Week/Month control, taller list rows, clearer titles and ranks, and wider right-side poster thumbnails.
- **Manga/LN spotlight metadata hierarchy**: Added CC chapter counts and star ratings to mobile Manga and LN spotlights, and moved author names above the title while keeping genre chips below it.
- **Manga/LN spotlight detail hydration**: Active spotlight slides now fetch and merge full detail metadata when lightweight list records omit chapter counts, authors, or genres, ensuring the complete metadata row renders instead of rating alone.
- **Compact mobile media cards**: Moved Anime, Manga, and LN titles inside their posters over a bottom visibility gradient, shifted badges above the title, removed Manga chapter/CC badges, and kept the existing below-card title presentation on desktop.
- **Unboxed mobile card metadata**: Removed filled containers, padding, and rounded boxes from mobile Anime, Manga, and LN format/count labels, leaving only readable text and icons over the poster gradient.
- **Compact mobile metadata pills**: Restored the card metadata containers across Anime, Manga, and LN with smaller type, tighter padding, and subtler pill sizing for a denser mobile layout.
- **Compact below-card mobile titles**: Moved Anime, Manga, and LN titles back beneath their posters, reduced mobile title sizing, removed the title fade overlays, and returned metadata pills to the poster bottom edge.

- **Android player scroll lock and proxy recovery**: Locked document scrolling while the dedicated player is mounted, added a stable loopback URL fallback when Capacitor proxy URL creation is interrupted by live reload, surfaced mobile embed-resolution errors, and purged stale empty stream results with cache namespace v25.

- **Anime details/player mobile overflow cleanup**: Hid the global bottom navigation throughout anime details and playback, suppressed the details toolbar while the dedicated player is open, and constrained player header/footer controls so titles and actions cannot overlap on narrow Android screens.

- **Dedicated Android anime player and resolver correction**: Moved mobile playback into a separate full-screen surface with an episode carousel sheet, stopped passing AniList IDs to the MAL-only direct stream endpoint, and bumped the stream cache namespace so valid-looking wrong-title responses cannot leave playback stuck while fetching.

- **Anime details compact mobile toolbar**: Removed the redundant Series label and added the Manga/LN-style Android toolbar that transitions from transparent to solid while scrolling, with working back, episode-order, list/grid, and download-all actions.

- **Android anime details redesign**: Matched anime details to the mobile Manga/LN presentation with a compact side-by-side hero, flat metadata and genre treatment, equal-width actions, horizontally scrollable seasons, and an edge-to-edge episode list with larger landscape artwork and synopsis previews.

- **Mobile HLS completed-position reset**: Added duration-aware validation to HLS resume and synchronization so completed or stale near-end timestamps restart at zero instead of seeking directly to the end and triggering episode completion or auto-next.

- **Mobile light-novel reader alignment**: Reworked the reader header and footer into stable responsive grids, kept previous/next controls fully on-screen with compact mobile buttons, centered the chapter selector, and displayed the selected chapter title during content loading.

- **Android NovelBin chapter rate-limit recovery**: Coalesced duplicate in-flight data requests, paced native NovelBin traffic, and added bounded backoff for HTTP 429 responses instead of immediately repeating rejected chapter requests through the same-device proxy.

- **Android black-screen HLS regression fix**: Prevented Android WebView's unreliable native-HLS capability result from bypassing hls.js, ensuring proxied mobile streams load their manifests, duration, and video frames through the local media proxy.

- **Packaged Electron scraper runtime**: Changed the local Puppeteer and stealth-plugin imports to statically discoverable module specifiers so the production backend bundle includes provider browser fallbacks instead of looking for excluded `backend/node_modules` at runtime.

- **Android anime streaming and LN chapter recovery**: The on-device media proxy now streams HLS/media response bodies instead of buffering complete segments in memory, preventing phone playback from stalling on a black frame. Failed native HTML requests now retry through the app's OkHttp proxy with an enforced desktop browser identity, allowing later NovelBin chapters to recover from mobile-fingerprint blocking.
- **Single-language caption toggle**: The subtitle dropdown is now shown only when multiple languages are available; a single-language captions button toggles that track directly on or off.
- **Clickable subtitle selection**: Subtitle menu choices now switch the browser text track synchronously and stop pointer events from falling through to the video controls, fixing language rows that appeared selectable but did nothing.
- **Accurate subtitle language labels**: Removed the hardcoded English fallback for unlabeled subtitle tracks. HiAnime now reads additional provider metadata, URL language hints, and subtitle script content when needed; unknown tracks remain Unknown, and exact duplicate tracks are removed from the selector.
- **Subtitle language selector**: The player caption button now opens a language menu with Off and every subtitle track supplied by the active provider, while continuing to default to English when available.
- **Strict anime episode routing and stable server switching**: Removed unsafe episode-one fallbacks from HiAnime, AniDB, AllManga, and the native mobile HiAnime source, preventing missing episode matches from silently playing another episode. Provider requests are now source-strict instead of silently returning a different provider, server selection starts only one request, implausibly short/long media is rejected against known episode runtime, Fern correctly separates its labeled SUBBED and DUBBED embeds, and stream cache namespaces were bumped.
- **Responsive subtitle position**: Raised native video captions slightly during playback and moved them farther upward whenever the progress bar and player controls are visible.
- **Player caption control placement**: Removed the unused wide-player monitor action and moved the subtitle toggle into its place beside Settings and Fullscreen.
- **English subtitle priority fix**: The video player now selects full English dialogue captions ahead of Thai and other subtitle tracks, while retaining non-English tracks as fallback data.
- **Anime audio and captions correction**: Restored native subtitle track rendering in the player, prevented the persistent player from keeping an old dub URL while showing new Sub/Dub state, stopped Fern/AnimeGG from labeling its no-caption English stream as Sub, and made Sub requests search fallback servers when the current server only resolves Dub.
- **Electron HiAnime black-screen and recovery fix**: Removed stale upstream `Content-Length` headers from rewritten HLS playlists and tied media-stream cancellation to the outgoing response. Shortened signed-stream caching from 20 to 4 minutes, fixed Frieren-to-HiAnime cache invalidation, and stopped playback recovery from silently bouncing between Sub and Dub; exhausted streams now proceed through normal server failover while preserving the user's audio choice.
- **Sub-first audio selection fix**: Anime playback now defaults to subtitle audio on every episode/server load, keeps Sub and Dub streams strictly separated, allows the Dub switch to return to Sub when both tracks exist, and correctly labels dub-only scraper results instead of exposing the same Dub stream as a fake Sub option. Unticking a stale dub-only response now purges and refetches that episode instead of disabling the control. Stream caches were bumped to purge stale audio metadata.
- **Cross-platform HLS proxy origin fix**: Rewrote nested playlist, subtitle, key, and media proxy references as same-origin URLs instead of hardcoded backend-origin URLs. The frontend also remaps stale `localhost:3001` proxy responses to its active API origin, preventing Android WebView from treating the phone itself as the backend and improving Electron HLS reliability.
- **Mobile live-reload command**: Added `npm run dev:mobile`, which starts the backend and exposes Vite on the local network instead of binding only to the PC loopback interface.
- **Android light-novel chapter fix**: Added native JSON response handling for Capacitor HTTP requests and switched NovelBin's chapter catalog request to it, preventing valid chapter responses from being converted to `"[object Object]"` and discarded on Android.
- **Android light-novel content fix**: Native source requests now use NovelBin's accepted desktop browser header profile (its edge returns HTTP 429 to mobile-looking native requests), unwrap text payloads returned by device HTTP implementations, and use expanded chapter-content selectors for the current reader markup.
- **Scraper misroute hardening**: Tightened manga/anime title resolution across MangaKatana, HiAnime/Frieren, AniKoto/Stark, AnimeGG/Fern, and ReAnime/Himmel so weak search results are rejected instead of routing to unrelated titles; bumped affected cache namespaces and reset player quality selection when switching sub/dub.
- **HiAnime alternate-title resolver fix**: Backend Frieren now honors array-form alternate titles from the player request, rejects the unrelated `Wandance` result for `The World Is Dancing`, and logs the accepted title query used for successful stream resolution.
- Removed the legacy What's New update modal from the shared application shell on both Electron and Android while retaining the functional OTA updater.
- Refined the Android TMDB onboarding screen with safe-area-aware mobile spacing, clearer typography and actions, resilient token input sizing, and linked its guide directly to the website's new `#docs-tmdb` tutorial deep link.
- Made Electron episode thumbnails feel immediate by showing cached cover fallbacks while stills load, prioritizing only visible rows, and resetting failed image state when sources change.
- Unified Anime, Manga, and Light Novel catalog toolbars as aligned borderless icon actions for sorting, list/grid views, downloads folders, and bulk downloads.
- Deduplicated desktop Anime Library history, watchlist, and downloads across providers by normalized title while retaining the newest progress entry.
- Replaced desktop Library carousels with top-to-bottom grids showing four anime cards or six manga and light-novel cards per row.
- Changed Electron episode thumbnails to an inset rounded 4:3 layout, opened more room for metadata, and limited smaller long titles to three ellipsized lines.
- Increased the website carousel indicators and dark-mode control hit areas for easier touch interaction, and added accessible slide labels.
- Simplified the Android GitHub Release asset name to `Yorumi.apk` and remove the superseded versioned APK asset during publishing.
- Made the existing Android npm build commands cross-platform through a shared Gradle launcher and moved APK release CI to Linux for reliable repeatable builds.
- Added the locally release-signed and signature-verified v4.2.0 APK as the no-secret CI release artifact, ensuring the workflow never substitutes a debug build, and standardized its published filename as `Yorumi v4.2.0.apk`.
- Prepared the standalone v4.2.0 release notes, synchronized desktop/Android/website version metadata, and added signed Android APK GitHub Actions release automation using the existing npm release command.
- Made Library network-aware: online cards retain full known Anime episode and Manga/LN chapter totals and open the complete details catalog, while offline mode shows only titles with local downloads and reports their locally available episode/chapter counts.
- Kept the sticky mobile Library header below Android's status bar using the device safe-area inset, preventing its title and media tabs from merging with system-tray icons.
- Fixed Android anime downloads incorrectly forwarding the phone-local media proxy URL to the backend, which caused `ECONNREFUSED 127.0.0.1:18765`; HLS playlists and segments now remain on the on-device proxy path.
- Made the complete My Library header and media-tab selector sticky on mobile with an opaque blurred surface, while preserving the existing desktop layout.
- Fixed Android Manga chapter starvation by removing the spotlight's eight-page MangaKatana detail preload, and fixed Anime downloads by preserving the resolved stream's HLS type instead of guessing solely from native proxy URLs.
- Unified Library navigation with the normal Anime, Manga, and Light Novel detail data paths so saved synopsis and genres render immediately and full metadata still refreshes online. Added downloaded-only titles to the mobile Library and direct offline handoff for downloaded Manga/LN chapters and Anime episodes.
- Fixed slides seven and eight of the Manga spotlight showing Unknown metadata by rejecting incomplete MangaKatana detail responses, invalidating the affected detail cache, and progressively hydrating all eight slides with the same full details used by Electron.
- Fixed pixelated Android Manga spotlight artwork by replacing MangaKatana hot-update thumbnails with each active title's full detail cover for both the hero background and cover presentation, matching Electron's image selection.
- Matched the Android Manga spotlight to Electron by sourcing and ordering its eight entries exclusively from MangaKatana hot updates, while enriching each active slide without blocking the carousel. AniList no longer selects Manga spotlight titles.
- Fixed slow and broken Android Manga home rendering by preserving valid persisted home caches, rendering AniList cards and spotlight data immediately, and progressively hydrating MangaKatana chapters in the background instead of blocking entire sections on dozens of scraper requests.
- Changed mobile press-and-hold playback to YouTube-style behavior: holding anywhere across the entire player temporarily plays at 2x speed, immediately hides every control except a polished centered fast-forward indicator, and restores the previous speed on release. A normal video tap toggles the controls, and the old hold-to-rewind gesture is removed.
- Centered the mobile player transport controls symmetrically.
- Fixed search-result cards opening a black screen by normalizing Anime, Manga, and Light Novel route state before navigation and hardening anime artwork rendering against incomplete provider records.
- Fixed undersized mobile player controls after leaving landscape by preventing Android Web Fullscreen from retaining landscape viewport scaling and waiting for portrait viewport dimensions before restoring the player layout.
- Simplified movie details by removing the Episodes heading/count and the synthetic `1.` prefix from the single movie playback card.
- Added movies to the mobile anime details episode section as a single playable entry, using the movie artwork and title when no normal episode record exists.
- Replaced the Android player's hardcoded 90-degree CSS viewport rotation with the native Capacitor screen-orientation lock, synchronized fullscreen cleanup, and an unrotated dynamic-viewport layout.
- Fixed Android manga spotlight loading by hydrating every visible spotlight entry through the in-app MangaKatana source, with a bounded request queue for stable mobile scraping.
- Fixed missing readable chapters and chapter counts across the manga home sections by resolving visible AniList entries to MangaKatana and carrying their scraper IDs and chapter lists into navigation.

- **Electron Discord RPC and Preload IPC Bridge ([preload.mjs](dist-electron/preload.mjs), [main.bundle.js](dist-electron/main.bundle.js), [main.cjs](dist-electron/main.cjs), [main.js](dist-electron/main.js))**:
  - Restored missing `dist-electron/preload.mjs` script with CommonJS `require('electron')` sandbox bridge, resolving preload load failures and exposing `window.electronAPI` so the frontend can dispatch Discord presence updates.
  - Added `discordRpcClient.on('error')` listener in Electron main process to safely handle unexpected socket closures or IPC disconnects without crashing.
  - Upgraded `setDiscordActivity` to send activity payloads via `discordRpcClient.request('SET_ACTIVITY', ...)` to preserve activity types (e.g., `type: 3` for Watching, `type: 0` for Playing) and dynamic poster art on Discord user cards, with resilient fallback to `setActivity`.
  - Re-synchronized bundled `dist-electron/main.cjs` and `dist-electron/main.js` artifacts with the source `main.bundle.js`.

- **Android anime player glitch and loopback playback fix ([capacitor.config.ts](capacitor.config.ts), [MainActivity.java](android/app/src/main/java/com/yorumi/app/MainActivity.java), [LocalMediaProxyPlugin.java](android/app/src/main/java/com/yorumi/app/LocalMediaProxyPlugin.java), [VideoPlayer.tsx](src/features/player/components/VideoPlayer.tsx), [usePlayer.ts](src/features/player/hooks/usePlayer.ts), [useStreams.ts](src/hooks/useStreams.ts), [animeService.ts](src/services/animeService.ts))**:
  - Configured `server: { androidScheme: 'http', cleartext: true }` in `capacitor.config.ts` and set `WebSettings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW)` in `MainActivity.java` to prevent WebView mixed-content security policies from blocking Hls.js segment and playlist requests to the local proxy (`http://127.0.0.1:18765`).
  - Fixed `LocalMediaProxyPlugin.java` error response crash by replacing `Status.lookup(502)` (which returned null and caused a NPE inside NanoHTTPD) with `getStatus(502, "Bad Gateway")` and adding full CORS headers to error responses.
  - Hardened playlist URI rewriting in `LocalMediaProxyPlugin.java` with regex matching `URI=(["'])(.*?)\1` to handle single- and double-quoted tags (`#EXT-X-KEY`, `#EXT-X-MAP`, `#EXT-X-MEDIA`) without parsing failures.
  - Disabled Web Worker demuxing on mobile (`enableWorker: !isNativeMobile`) in `VideoPlayer.tsx`, avoiding Blob worker instantiation failures inside the mobile WebView.
  - Extended watchdog timeout `PLAYBACK_START_WATCHDOG_MS` to 30s (from 12s) and `MEDIA_STALL_TIMEOUT_MS` to 25s (from 14s) to eliminate false timeout aborts and server hopping while buffering on mobile.
  - Guarded the auto-load effect in `usePlayer.ts` with `autoLoadAttemptKeyRef` to prevent infinite reload/re-trigger loops, and bypassed multi-server failover loops on mobile where all servers resolve to the same local scraper.
  - Disabled background prefetching of alternate desktop servers on mobile in `useStreams.ts` and unified the local mobile stream cache key in `animeService.ts` to prevent duplicate concurrent network storms.



- **Mobile reader details cleanup ([MangaDetailsPage.tsx](src/pages/MangaDetailsPage.tsx), [LNDetailsPage.tsx](src/pages/LNDetailsPage.tsx), [MangaSpotlight.tsx](src/features/manga/components/MangaSpotlight.tsx))**:
  - Removed mobile spotlight pagination dots and chapter-list pagination controls from manga and light-novel details.
  - Reworked mobile details headers to show cover art beside the title, with blurred synopsis cards, show more/less synopsis controls, genre chips, chapter counts, and Start/Continue actions.
  - Updated the mobile floating read button to collapse to an icon-only state after scrolling.
  - Flattened mobile synopsis into an inline fade/caret treatment, removed duplicated chapter/action rows, and softened mobile title weight while keeping author/status visible.
  - Matched manga and light-novel mobile synopsis expansion with a down-chevron control, smoother height animation, expanded full tag wrapping, and a clearer low-blur poster backdrop.
  - Hid mobile chapter search, compacted chapter controls into icon-style actions, removed author from the mobile hero line, and added a purple sticky detail toolbar while scrolling.
  - Replaced the overlapping floating chapter-count label with mobile floating chapter controls and smoothed the compact scrolled toolbar transition.
  - Hid the compact mobile toolbar until scrolling and changed its actions to chapter sort, list/grid toggle, and download.
  - Removed back-to-top floating buttons from the light-novel reader and manga page viewer.
  - Disabled the global back-to-top button on manga/light-novel details and reader routes, and centered the collapsed mobile read FAB icon.
  - Tuned mobile manga/light-novel details toward a Mihon-style layout with tighter title/chapter typography, larger flat genre chips, and explicit icon rows for author and status.

- **Mobile spotlight chapter resolution ([mangaService.ts](src/services/mangaService.ts), [LNDetailsPage.tsx](src/pages/LNDetailsPage.tsx))**:
  - Android/iOS manga spotlight details now resolve AniList metadata titles into MangaKatana source details and hydrate readable chapters before rendering.
  - Light-novel spotlight details now include native/Japanese titles and synonyms when resolving NovelBin source IDs, improving chapter matches for AniList-only entries.

- **Android HLS playback fix ([VideoPlayer.tsx](src/features/player/components/VideoPlayer.tsx))**:
  - Force Android/iOS and local loopback proxy `.m3u8` streams through hls.js instead of WebView's native HLS path, preventing black-screen `0:00 / 0:00` playback.

- **Backend-free Android anime metadata ([anilistAnime.ts](src/platform/sources/anilistAnime.ts), [animeService.ts](src/services/animeService.ts))**:
  - Added direct on-device AniList queries for Android/iOS anime home data, search, details, top anime, trending, seasonal, monthly, and latest-list fallbacks.
  - Restored mobile anime cards, metadata, and homepage sections when the APK is running without the Express backend.

- **Mobile Manga & Light Novel details edge-to-edge redesign ([MangaDetailsPage.tsx](src/pages/MangaDetailsPage.tsx), [LNDetailsPage.tsx](src/pages/LNDetailsPage.tsx), [Sidebar.tsx](src/components/layout/Sidebar.tsx))**:
  - Removed the boxed card container around chapters on mobile, replacing it with a flat, clean edge-to-edge list featuring status indicators (`•`), upload/release date and author metadata, and circular download buttons matching the Tachiyomi/Mihon reference layout.
  - Hid the mobile bottom navigation bar on `/manga/details/:id` and `/ln/details/:id`, allowing content to scroll edge-to-edge behind the transparent Android system navigation bar.
  - Added an elevated floating action button (FAB) at the bottom-right on mobile (`[ ▶ Resume ]` / `[ ▶ Read ]`) positioned above the system navigation bar safe area.
  - Unified the chapter list headers into a single compact bar, eliminating redundant double headers and cleanly incorporating the sort toggle, view mode toggle, and download actions.
  - Adjusted mobile container padding to `px-4` and ensured `safe-area-inset-bottom` padding prevents UI clipping against Android navigation buttons.

- **Backend-free Android anime playback foundation ([hianime.ts](src/platform/sources/hianime.ts), [animeService.ts](src/services/animeService.ts), [LocalMediaProxyPlugin.java](android/app/src/main/java/com/yorumi/app/LocalMediaProxyPlugin.java), [MainActivity.java](android/app/src/main/java/com/yorumi/app/MainActivity.java), [build.gradle](android/app/build.gradle))**:
  - Ported the Frieren/HiAnime stream lookup into the Android app so mobile can resolve anime episodes without the Express backend.
  - Added a native loopback HLS proxy for Android that rewrites playlists, key URIs, subtitles, and segment URLs to `127.0.0.1`, keeping video playback local to the device WebView.
  - Kept Electron/web on the existing backend scraper route while native mobile uses the on-device adapter boundary.

- **Android edge-to-edge fullscreen & docked bottom navigation ([styles.xml](android/app/src/main/res/values/styles.xml), [MainActivity.java](android/app/src/main/java/com/yorumi/app/MainActivity.java), [ImmersiveModePlugin.java](android/app/src/main/java/com/yorumi/app/ImmersiveModePlugin.java), [Sidebar.tsx](src/components/layout/Sidebar.tsx), [App.tsx](src/App.tsx))**:
  - Replaced Android's light theme with a dark edge-to-edge theme, eliminating the solid white status bar and solid white navigation bar on mobile.
  - Programmatically configured transparent status/navigation bars, enforced light system icons (`setAppearanceLightStatusBars(false)` / `setAppearanceLightNavigationBars(false)`), and disabled artificial navigation bar contrast scrims on Android 10+.
  - Docked the mobile bottom navigation bar flush to the screen bottom with `safe-area-inset-bottom` padding, creating a seamless unified dark surface across Android's 3-button or gesture navigation bar without affecting Electron/desktop.
  - Added Material You-style active indicator pills to mobile nav tabs and scoped desktop Electron drag regions exclusively to non-mobile platforms.

- **Native Android navigation and immersive manga reader ([App.tsx](src/App.tsx), [MangaReaderPage.tsx](src/pages/MangaReaderPage.tsx), [ImmersiveModePlugin.java](android/app/src/main/java/com/yorumi/app/ImmersiveModePlugin.java))**:
  - Android's system Back button now follows React Router history and exits only from the root page.
  - Manga reading enters native immersive mode, hides both status and navigation bars, permits transient swipe-reveal, and restores system UI when leaving.

- **Working Capacitor live reload ([capacitor.config.ts](capacitor.config.ts))**:
  - Honor `CAPACITOR_SERVER_URL` during Android sync so a development APK can load Vite from the computer over USB or Wi-Fi.

- **Backend-free Android light novels ([novelbin.ts](src/platform/sources/novelbin.ts), [lnService.ts](src/services/lnService.ts))**:
  - Ported NovelBin search, title resolution, novel metadata, full chapter lists, and sanitized chapter reading into the APK through Capacitor native HTTP.
  - Mobile LN search now combines direct AniList discovery with the on-device readable source while Electron/web retain the existing Express scraper flow.

- **Mobile bottom navigation ([Sidebar.tsx](src/components/layout/Sidebar.tsx), [App.tsx](src/App.tsx))**:
  - Replaced the desktop sidebar at phone widths with a compact safe-area-aware navigation bar for Anime, Manga, Search, LN, and Library.
  - Elevated Search as the central action, added route-aware active colors, reserved page space for the bar, and hide it inside immersive manga/light-novel readers.
  - Kept the navbar and Search action visually flat with opaque solid colors and no gradients or colored glow.

- **Frieren HLS playback and subtitles ([VideoPlayer.tsx](src/features/player/components/VideoPlayer.tsx), [CustomVideoControls.tsx](src/features/player/components/CustomVideoControls.tsx), [scraper.routes.ts](backend/src/api/scraper/scraper.routes.ts))**:
  - Removed fabricated codec metadata from rewritten HLS master playlists and start playback on the lowest rendition before adaptive quality steps up.
  - Proxy subtitle files through the backend with the source referer, attach them as native video text tracks, and expose an on/off captions control.
  - Prefer English when providers return multiple subtitle languages and raise cues in windowed playback so controls do not cover them.

- **Backend-free Android manga discovery ([anilistManga.ts](src/platform/sources/anilistManga.ts), [mangaService.ts](src/services/mangaService.ts))**:
  - Added direct on-device AniList GraphQL queries for manga search, numeric details, top, trending, popular, manhwa, one-shot, A-Z, spotlight, and random discovery.
  - Ported MangaKatana latest, new, directory, and hot-update lists into the local adapter, completing the manga landing page without Express.
  - Kept all web/Electron API routes unchanged and selected local providers only on Capacitor Android/iOS.

- **First fully local Android content provider ([mangakatana.ts](src/platform/sources/mangakatana.ts), [nativeHttp.ts](src/platform/nativeHttp.ts), [mangaService.ts](src/services/mangaService.ts))**:
  - Ported MangaKatana search, details, chapter lists, and page extraction into the APK using Capacitor's native HTTP stack and browser-native DOM parsing.
  - Android/iOS now call the local adapter directly for the MangaKatana flow while Electron/web retain their existing Express API behavior.
  - Routed global manga search through the local provider on mobile and bypassed the unavailable backend image proxy for native-device requests.
  - Preserved existing in-memory and persisted manga caches, request deduplication, and stale-cache fallbacks.

- **Android foundation without Electron regressions ([capacitor.config.ts](capacitor.config.ts), [runtime.ts](src/platform/runtime.ts), [AppProviders.tsx](src/app/AppProviders.tsx), [api.ts](src/config/api.ts))**:
  - Added an isolated Capacitor Android build target that packages the existing React/Vite frontend without changing the Electron backend startup or packaging flow.
  - Added explicit web, Electron, Android, and iOS runtime detection plus hash routing for packaged mobile assets.
  - Hid the desktop-only Exit control on native mobile and added separate Android sync/open/debug-build commands.
  - Established the platform boundary for incrementally replacing Express endpoints with direct on-device source adapters.
  - Added a typed local source registry and Android migration guide covering provider porting, native networking, caching, media proxying, and APK commands.

- **Faster startup and smaller initial download ([AppRoutes.tsx](src/app/AppRoutes.tsx))**:
  - Split secondary pages into route-level chunks so anime details, manga, light novel, library, profile, and Yumi code loads only when visited.
  - Deferred the global search modal until it is opened, avoiding its UI code during normal startup.
  - Kept the home page in the initial bundle for immediate startup and added an accessible lightweight loading state for lazy routes.

## [4.1.1] - 2026-09-20

- **Instant Episode Thumbnails & Titles via AniZip Integration ([episodeMetadataService.ts](file:///c:/Github/Yorumi/src/services/episodeMetadataService.ts), [AnimeDetailsPage.tsx](file:///c:/Github/Yorumi/src/pages/AnimeDetailsPage.tsx), [DetailsEpisodeGrid.tsx](file:///c:/Github/Yorumi/src/features/anime/components/details/DetailsEpisodeGrid.tsx))**:
  - Integrated **AniZip** (`api.ani.zip`) as a zero-authentication, ~150ms episode metadata source that provides real episode titles (English, Romaji, Japanese), HD TVDB screencap thumbnails, overviews, and air dates for virtually every anime.
  - **New `episodeMetadataService.ts`**: Client-side service with dual-layer caching (in-memory `Map` + `sessionStorage` with 7-day TTL) and request deduplication. Returns cached data synchronously on revisit for 0ms render.
  - **Episode cards now render real titles and HD screencaps on first paint** instead of generic `Episode 1`, `Episode 2` placeholders with blank black boxes. Titles and thumbnails load within ~200ms of navigating to any anime details page.
  - **Multi-tier fallback chain**: AniZip screencap → scraper snapshot → TMDB still → anime poster/banner. Episode cards never render as empty black boxes.
  - **EpisodeThumbnail component upgraded**: Added pulse skeleton placeholder during image load, smooth opacity fade-in transition, and automatic fallback to anime cover art if screencap fails to load.
  - **Parallelized season relation fetching**: The sequential 12-relation while-loop in `loadSeasonMetadata` now fetches up to 4 relations concurrently via `Promise.all`, significantly reducing metadata resolution time for multi-season franchises.
  - **Removed premature TMDB bypass**: Multi-season anime (with `collectedItems.length > 1`) no longer unconditionally skips TMDB TV details lookup. TMDB enrichment now proceeds if an AniZip-resolved `tmdbId` is available.
  - **AniZip thumbnails always prioritized over scraper snapshots**: Scraper snapshots (low-quality screenshots with burned-in subtitles) are now never used when AniZip data is available. Thumbnail priority: AniZip HD screencap → TMDB still → anime poster/banner.
  - **Episode metadata resets on anime navigation**: Switching to a different anime now immediately resets `episodeMeta` state, preventing the previous anime's thumbnails from leaking into the new anime's episode cards.

- **Auto-Server Failover on Playback Failure ([usePlayer.ts](file:///c:/Github/Yorumi/src/features/player/hooks/usePlayer.ts), [VideoPlayer.tsx](file:///c:/Github/Yorumi/src/features/player/components/VideoPlayer.tsx))**:
  - When a server fails to produce a playable stream (black screen, 0:00/0:00 duration, or network error), the player now **automatically switches to the next server** in the cascade (Frieren → Stark → Fern → Himmel) until playback starts.
  - **Playback start watchdog**: New 12-second timer detects zero-duration / no-timeupdate scenarios (broken HLS manifests, empty segments) and triggers auto-failover. Previously, these black-screen states persisted indefinitely.
  - Only marks `streamExhausted` after all 4 servers have been tried and a full cache-bust retry round completes.
  - Failed server tracking resets on episode change, ensuring each episode gets fresh failover opportunities.

## [4.1.0] - 2026-08-21

- **Server Selector Renamed to Frieren Characters & KickAssAnime Removal ([useStreams.ts](file:///c:/Github/Yorumi/src/hooks/useStreams.ts), [VideoPlayer.tsx](file:///c:/Github/Yorumi/src/features/player/components/VideoPlayer.tsx), [animeService.ts](file:///c:/Github/Yorumi/src/services/animeService.ts), [video-sources.ts](file:///c:/Github/Yorumi/backend/src/api/anime/video-sources.ts), [scraper.service.ts](file:///c:/Github/Yorumi/backend/src/api/scraper/scraper.service.ts), [scraper.routes.ts](file:///c:/Github/Yorumi/backend/src/api/scraper/scraper.routes.ts), [DetailsEpisodeGrid.tsx](file:///c:/Github/Yorumi/src/features/anime/components/details/DetailsEpisodeGrid.tsx))**:
  - Removed **KickAssAnime** from video sources, fallback chains, and episode resolution pipelines.
  - Renamed the server options in the player dropdown and controls to *Frieren: Beyond Journey's End* characters:
    - **Frieren**: Flagship server powered by HiAnime (MegaCloud HLS with soft subtitles).
    - **Stark**: Power server powered by AniKoto (Megaplay direct HLS with comprehensive multi-language subtitles and dub).
    - **Fern**: Rapid precision server powered by AnimeGG (direct MP4 streams across 1080p, 720p, and 480p).
    - **Himmel**: Legendary hero server powered by ReAnime (Flixcloud direct HLS).
  - Implemented robust bidirectional name-to-provider mapping in `src/services/animeService.ts` and `src/hooks/useStreams.ts`, ensuring scrapers remain fully operational regardless of whether queries use character aliases or canonical provider keys.
  - Bumped stream cache keys (`v114` backend, `v19` frontend) to purge stale cache entries.

- **Video Stream Providers Stability, KickAssAnime & ReAnime Fixes, and AnimeGG Integration ([scraper.routes.ts](file:///c:/Github/Yorumi/backend/src/api/scraper/scraper.routes.ts), [scraper.service.ts](file:///c:/Github/Yorumi/backend/src/api/scraper/scraper.service.ts), [kickassanime.ts](file:///c:/Github/Yorumi/backend/src/scraper/kickassanime.ts), [reanime.ts](file:///c:/Github/Yorumi/backend/src/scraper/reanime.ts), [animegg.ts](file:///c:/Github/Yorumi/backend/src/scraper/animegg.ts), [video-sources.ts](file:///c:/Github/Yorumi/backend/src/api/anime/video-sources.ts), [useStreams.ts](file:///c:/Github/Yorumi/src/hooks/useStreams.ts), [VideoPlayer.tsx](file:///c:/Github/Yorumi/src/features/player/components/VideoPlayer.tsx), [animeService.ts](file:///c:/Github/Yorumi/src/services/animeService.ts), [DetailsEpisodeGrid.tsx](file:///c:/Github/Yorumi/src/features/anime/components/details/DetailsEpisodeGrid.tsx))**:
  - **KickAssAnime Fixes**:
    - Resolved CORS/403 block by wrapping KickAssAnime streams in `/api/scraper/proxy` with `Referer: https://krussdomi.com/` and proxy media parameter.
    - Fixed protocol-relative URL rewriting in `scraper.routes.ts` where `//st1.advancedairesearchlab...` was previously misidentified as origin-relative (`https://hls.krussdomi.com//st1...`), causing 404s.
    - Added Krussdomi CDN domains (`habibikun.xyz`, `advancedairesearchlab.xyz`, `babybayw.xyz`, `narutokun.xyz`) to proxy media segment rewriting.
    - Added manifest probe validation in `kickassanime.ts` to ensure unplayable manifests return `null` and trigger graceful fallbacks.
  - **ReAnime Fixes & Guardrails**:
    - Diagnosed Flixcloud anti-bot challenges and encrypted `sResp...` non-m3u8 tokens returned by upstream `fetch9.flixcloud.cc`.
    - Added active manifest validation in `reanime.ts` and `scraper.routes.ts`: rejects non-`#EXT` responses (HTTP 502 instead of parsing raw tokens as playlists) and cleanly yields to backup providers.
  - **AnimeGG Integration**:
    - Integrated high-speed direct MP4 provider **AnimeGG** from `Anivexa-API` featuring full 1080p, 720p, and 480p streams with sub and dub tracks.
    - Added full HTTP 206 Partial Content range-request streaming through the backend proxy.
  - **Resilient Multi-Provider Fallback Cascade**:
    - Updated `orderedSources` in `video-sources.ts` and `resolveStreamDataWithFallback` in `useStreams.ts` so selecting any server automatically falls back across `AniKoto`, `HiAnime`, and `AnimeGG` if the primary server encounters upstream downtime or Cloudflare challenges, ensuring zero playback stalls or blank player states.
    - Purged stale cache keys with `v113` stream cache namespace.

- **Anime Tab High-Speed Performance & Resilient Multi-Tier Hydration ([anime.routes.ts](file:///c:/Github/Yorumi/backend/src/api/anime/anime.routes.ts), [anilist.routes.ts](file:///c:/Github/Yorumi/backend/src/api/anilist/anilist.routes.ts), [animeService.ts](file:///c:/Github/Yorumi/src/services/animeService.ts), [AnimeContext.tsx](file:///c:/Github/Yorumi/src/context/AnimeContext.tsx))**:
  - Resolved severe performance bottleneck where the Anime tab took several seconds or stalled with skeleton placeholders and "No titles available" compared to instant Manga and Light Novel tabs.
  - Root-caused missing TMDB credentials causing `/api/anime/home-fast`, `/trending`, `/popular`, and `/seasonal` to return empty datasets (`media: []`), triggering a cascading 6-request waterfall of retries with artificial 1.0s and 2.5s sleep loops.
  - Implemented automatic high-speed AniList fallbacks on `/api/anime/home-fast`, `/trending`, `/popular`, and `/seasonal` with in-memory caching (`ANIME_HOME_FAST_TTL_MS = 2 min`, `MEDIA_POOL_CACHE_TTL = 10 min`), achieving ~60ms response times.
  - Added dual-endpoint resilience in `animeService.ts`: `getHomeFastData()` now seamlessly falls back to `/api/anilist/home-fast` if `/api/anime/home-fast` returns empty or errors.
  - Eliminated artificial retry delays (`[0, 1000, 2500]ms`) in `fetchSpotlight` and optimized `AnimeContext.tsx` fast bundle timeout, ensuring instant local cache hydration (`readHomeCache`) on component mount and sub-second background updates.

- **Top 3 Direct HLS Video Providers Overhaul ([kickassanime.ts](file:///c:/Github/Yorumi/backend/src/scraper/kickassanime.ts), [anikoto.ts](file:///c:/Github/Yorumi/backend/src/scraper/anikoto.ts), [reanime.ts](file:///c:/Github/Yorumi/backend/src/scraper/reanime.ts), [video-sources.ts](file:///c:/Github/Yorumi/backend/src/api/anime/video-sources.ts), [useStreams.ts](file:///c:/Github/Yorumi/src/hooks/useStreams.ts), [VideoPlayer.tsx](file:///c:/Github/Yorumi/src/features/player/components/VideoPlayer.tsx))**:
  - Replaced deprecated iframe embed providers (`Videasy`, `VidSrc`, `VidKing`) with the Top 3 verified `.m3u8` HLS providers from `Anivexa-API`: **KickAssAnime**, **AniKoto**, and **ReAnime**.
  - **KickAssAnime**: Built native queries to `https://kaa.lt/api/fsearch` and episode servers to extract direct Krussdomi master manifests up to 4K resolution (2160p, 1080p, 720p, 540p, 360p).
  - **AniKoto**: Implemented full MegaPlay decryption engine (extracting script strings, deciphering AES-256-CBC payloads, and HMAC-SHA256 signing stream tokens using VM sandbox key extraction), delivering direct `.m3u8` master streams and multi-language VTT subtitles (English, Spanish, French, German, Italian, Portuguese, Russian, Arabic) for both SUB and DUB.
  - **ReAnime**: Built native AniList-keyed scraper with authentic Flixcloud decryption (PBKDF2, SHA-256, AES-CBC, WASM keystream transform) returning master `.m3u8` and soft subtitles.
  - Updated frontend player server selector and episode resolution pipelines to `HiAnime`, `KickAssAnime`, `AniKoto`, and `ReAnime`.

- **Light Novel 30-Chapter Cap Resolution ([novel.ts](file:///c:/Github/Yorumi/backend/src/scraper/novel.ts))**:
  - Fixed **NovelBin** details scraper which was capped to the first 30 chapters rendered in static HTML (`ol.almanac-chapter-list`). Now automatically queries `/ajax/chapter-list?slug={cleanSlug}`, retrieving the full index of all chapters (e.g. 304+ / 680+ chapters) in clean JSON.
  - Fixed **AllNovelFull** details scraper which was limited to the first page of 50 chapters and pagination buttons. Now dynamically extracts `novelId` from `input#truyen-id` / `data-novel-id` and retrieves all pages via `/ajax-chapter-list?novelId={id}&page={p}` in parallel, returning the entire novel index (e.g. all 270 chapters of Solo Leveling).

- **HiAnime Main Server Integration & Anime Scraper Overhaul ([hianime.ts](file:///c:/Github/Yorumi/backend/src/scraper/hianime.ts), [video-sources.ts](file:///c:/Github/Yorumi/backend/src/api/anime/video-sources.ts), [ani-cli.sh](file:///c:/Github/Yorumi/backend/ani-cli.sh), [useStreams.ts](file:///c:/Github/Yorumi/src/hooks/useStreams.ts), [VideoPlayer.tsx](file:///c:/Github/Yorumi/src/features/player/components/VideoPlayer.tsx))**:
  - Replaced the degraded `anidb.app` server (failing with HTTP 503 Maintenance) with a native **HiAnime** (`https://hianime.at`) scraper, bringing Yorumi into 100% architectural alignment with upstream `ani-cli` v5.1.4.
  - Implemented XOR deobfuscation (`otaku-embed-v1`) on `window.__P` payloads to extract direct high-speed HLS `.m3u8` master streams and `.vtt` subtitles for both **SUB** and **DUB** tracks.
  - Added multi-tier in-memory and Redis caching (`v110`) for sub-millisecond warm stream resolution, intro/outro skip metadata support, and seamless fallback routing from legacy `anidb` requests to `hianime`.
  - Fixed secondary fallback servers (`videasy`, `vidsrc`, `vidking`) by returning `isEmbed: true` on iframe embeds, preventing player crashes caused by attempting HLS playback on iframe URLs.
  - Synchronized internal `backend/ani-cli.sh` with upstream `pystardust/ani-cli` v5.1.4.
  - Added `HiAnime (ani-cli)` as the recommended primary server option in the frontend player controls.

- **Native TypeScript Adaptive Scraper Engine ([adaptive.ts](file:///c:/Github/Yorumi/backend/src/scraper/adaptive.ts), [novel.ts](file:///c:/Github/Yorumi/backend/src/scraper/novel.ts))**:
  - Implemented a native, zero-dependency adaptive scraping engine inspired by Scrapling's element fingerprinting algorithms, keeping Yorumi 100% native Node.js/TypeScript with zero Python microservices or external binaries.
  - Features high-precision multi-factor similarity scoring (tag matching 25%, structural traits/links/images 30%, text metrics 25%, attribute patterns 20%) with structural penalty rules for missing required elements.
  - Zero-overhead fast path: Primary CSS selectors execute immediately without similarity computation; adaptive similarity scoring engages strictly as a self-healing fallback when 0 elements match.
  - Integrated `AdaptiveEngine.query` and `AdaptiveEngine.queryOne` across NovelBin, WuxiaWorld, RoyalRoad, and AllNovelFull scrapers, preventing scraper breakage when upstream websites change CSS class names or DOM layouts.

- **Light Novel Multi-Source Scraper Overhaul ([novel.ts](file:///c:/Github/Yorumi/backend/src/scraper/novel.ts))**:
  - Overhauled **NovelBin** scraper to support its new "Almanac" design layout, replacing broken legacy card selectors (`.list-novel .row`) with `a.almanac-book-row` / `a[href*="/novel-bin/"]` and chapters from `ol.almanac-chapter-list`.
  - Fixed **AllNovelFull** search, details, and chapter content parsing to align with current DOM structure (`.con`, `h1`, `#list-chapter`, and `#chapter-content`).
  - Restored full search results and chapter indexing across all 4 light novel sources (NovelBin, WuxiaWorld, AllNovelFull, and RoyalRoad).

- **Backend Dev Server & Express 5 Route Parsing ([backend/package.json](file:///c:/Github/Yorumi/backend/package.json), [lnscraper.routes.ts](file:///c:/Github/Yorumi/backend/src/api/scraper/lnscraper.routes.ts))**:
  - Fixed backend startup failure caused by missing `nodemon` binary by updating the `dev` script to use `npx tsx watch` with zero external binary dependency.
  - Aligned backend `build` script with the root esbuild bundling pipeline (`dist/bundle.cjs`).
  - Resolved `PathError: Missing parameter name at index 14: /details/:id(*)` crash by updating Light Novel route definitions to Express 5 / `path-to-regexp` v8 compatible route arrays (`['/details/:id', '/details/*id']` and `['/read/:chapterId', '/read/*chapterId']`).

- **Electron Preload Script & Desktop IPC Bridge ([preload.mjs](file:///c:/Github/Yorumi/dist-electron/preload.mjs), [.gitignore](file:///c:/Github/Yorumi/.gitignore))**:
  - Restored missing `dist-electron/preload.mjs` script implementing the `window.electronAPI` bridge via `contextBridge.exposeInMainWorld`.
  - Resolved fatal `ENOENT` renderer initialization crash (`chrome-error://chromewebdata/`) causing a blank white screen upon launching the Electron desktop application.
  - Exempted `dist-electron/preload.mjs` in `.gitignore` to prevent preload script loss on Git checkouts.

- **High-Throughput TMDB Core Architecture & Rate-Limit Shield ([anime.routes.ts](file:///c:/Github%20Repos/Yorumi/backend/src/api/anime/anime.routes.ts), [api.ts](file:///c:/Github%20Repos/Yorumi/src/features/search/api.ts), [AnimeDetailsPage.tsx](file:///c:/Github%20Repos/Yorumi/src/pages/AnimeDetailsPage.tsx))**:
  - Re-architected catalog browsing, discovery feeds (Trending, Popular, Seasonal, Spotlight, Top 10), and search to be driven 80–90% by TMDB, eliminating AniList 429 rate limit exceptions permanently.
  - Retained AniList as a lightweight, aggressively cached (7-day TTL) micro-service for split-cour/part franchise labeling, Japanese voice actors, studio badges, and real-time airing countdowns.
  - Fixed multi-season chip selection and hero details syncing so clicking Season 1 (e.g. on *Horimiya* or *Saga of Tanya the Evil*) cleanly updates the hero banner, synopsis, poster artwork, and 16:9 episode screenshot stills.

## [4.0.9] - 2026-08-13

- **Discord Rich Presence (RPC) Integration ([main.js](file:///c:/Github%20Repos/Yorumi/dist-electron/main.js), [build-electron.cjs](file:///c:/Github%20Repos/Yorumi/scripts/build-electron.cjs), [preload.mjs](file:///c:/Github%20Repos/Yorumi/dist-electron/preload.mjs), [electron.d.ts](file:///c:/Github%20Repos/Yorumi/src/types/electron.d.ts), [discordRPCService.ts](file:///c:/Github%20Repos/Yorumi/src/services/discordRPCService.ts))**:
  - Fixed standalone `.exe` executable Discord Rich Presence failure by bundling `discord-rpc` and `electron-updater` directly into `dist-electron/main.js` using `esbuild` during Electron packaging.
  - Eliminated missing `node_modules/discord-rpc` runtime module errors when running packaged standalone desktop releases.
  - Integrated full Discord Rich Presence into Electron main process, automatically broadcasting real-time Anime watching, Manga reading, and Light Novel reading activity to Discord user cards.
  - Displays dynamic episode and chapter details, page numbers, and live elapsed timers with automatic reconnect throttling to prevent app lag.
  - Supports custom Discord Application IDs via `DISCORD_CLIENT_ID` environment variables with default fallback ID `1532608064174166097`.
  - Configured high-resolution Yorumi cat logo asset keys (`'yorumi'`) for Manga, Light Novels, and Page Browsing, and dynamic cover poster thumbnails for Anime playback.

- **Sequential Manga Page Loader ([PageViewer.tsx](file:///c:/Github%20Repos/Yorumi/src/features/manga/components/MangaReaderModal/PageViewer.tsx))**:
  - Built high-priority eager loading for Page 1 (`loading="eager"`, `fetchPriority="high"`, `decoding="sync"`).
  - Implemented strict sequential background preloading ($1 \rightarrow 2 \rightarrow 3 \dots 50$) so pages load in exact numerical order without network race conditions.
  - Added baseline height container placeholders to eliminate layout shift (CLS) and scroll jumping while images render.

- **Resilient Light Novel Reader Engine ([LNReaderPage.tsx](file:///c:/Github%20Repos/Yorumi/src/pages/LNReaderPage.tsx))**:
  - Fixed a React `useEffect` dependency race condition that was resetting state and causing an infinite loading spinner when novel metadata loaded in parallel with chapter text.
  - Stabilized component refs (`novelDetailsRef`, `passedLNRef`, `saveLNProgressRef`) to ensure chapter fetching completes reliably across online and offline cached chapters.

- **AniDB Ultra-Fast Stream Resolution Pipeline ([video-sources.ts](file:///c:/Github%20Repos/Yorumi/backend/src/api/anime/video-sources.ts), [allmanga.ts](file:///c:/Github%20Repos/Yorumi/backend/src/scraper/allmanga.ts), [scraper.service.ts](file:///c:/Github%20Repos/Yorumi/backend/src/api/scraper/scraper.service.ts))**:
  - Reduced AniDB stream loading times from 20–30+ seconds down to **~2.4s for cold lookups** and **<1ms for cached lookups**.
  - Parallelized `suggestions` and `browse` search queries via `Promise.all` for immediate title matching.
  - Implemented multi-tier Redis caching for episode lists (`anidb:episodes:${animeId}`, 24-hour TTL), language embeds (`anidb:languages:${epId}`, 12-hour TTL), and extended `animeId` cache to 30 days (`anidb:animeid:anilist:${anilistId}`).
  - Optimized `curl` arguments with `--compressed` and reduced hard request timeout from 4s to 2s.
  - Bypassed redundant TMDB resolution queries when `provider === 'anidb'` is explicitly requested.

- **AniDB Turbo Scraper Pipeline ([video-sources.ts](file:///c:/Github%20Repos/Yorumi/backend/src/api/anime/video-sources.ts), [allmanga.ts](file:///c:/Github%20Repos/Yorumi/backend/src/scraper/allmanga.ts))**:
  - Swapped `fetchAnidbText` and `fetchAnidbUrl` to use a `curl`-first fetch strategy with a 4-second hard timeout, bypassing Cloudflare anti-bot delays instantly (~300ms instead of 16-60s).
  - Added 24-hour Redis `animeId` caching (`anidb:animeid:${searchTitle}`), skipping search suggestion round-trips for subsequent episode playback.
  - Parallelized JPN (sub) and ENG (dub) embed playlist resolutions with `Promise.all`.

- **Official Closed Captions (CC) Badge Component ([CCIcon.tsx](file:///c:/Github%20Repos/Yorumi/src/components/ui/CCIcon.tsx))**:
  - Replaced corrupted vector SVG paths with official Material Design `<CCIcon />` across Spotlight Hero carousels, Anime & Manga cards, and Top 10 sidebars.

## [4.0.7] - 2026-08-12

- **Structured Disk Downloads & Physical Directory Organization ([main.js](file:///c:/Github%20Repos/Yorumi/dist-electron/main.js), [preload.mjs](file:///c:/Github%20Repos/Yorumi/dist-electron/preload.mjs), [electron.d.ts](file:///c:/Github%20Repos/Yorumi/src/types/electron.d.ts), [downloadService.ts](file:///c:/Github%20Repos/Yorumi/src/services/downloadService.ts), [mangaDownloadService.ts](file:///c:/Github%20Repos/Yorumi/src/services/mangaDownloadService.ts), [lnDownloadService.ts](file:///c:/Github%20Repos/Yorumi/src/services/lnDownloadService.ts))**:
  - Organized physical downloads into clean dedicated subdirectories:
    - `downloads/Anime/[Anime Title]/Episode X.mp4`
    - `downloads/Manga/[Manga Title]/Chapter X/page_001.jpg`
    - `downloads/LightNovels/[Novel Title]/Chapter X.txt`
  - Added automatic startup migration (`organizeLegacyDownloads()`) in Electron that relocates loose `.mp4` and `.ts` files from the root `downloads/` directory into their respective `downloads/Anime/[Title]/` subfolders while updating manifest paths seamlessly.
  - Implemented physical disk writing for Manga (`saveMangaDisk`) and Light Novels (`saveLNDisk`) in Electron so offline chapters are written to disk as well as stored in IndexedDB.
  - Upgraded `openDownloadsFolder(category)` to open category-specific directories (`downloads/Anime`, `downloads/Manga`, `downloads/LightNovels`) directly when clicked from Anime, Manga, or Light Novel pages.

## [4.0.6] - 2026-08-12

- **Korean (KR) & Chinese (CN) Web Novels & Hybrid Metadata Catalog ([lnService.ts](file:///c:/Github%20Repos/Yorumi/src/services/lnService.ts), [lnData.ts](file:///c:/Github%20Repos/Yorumi/src/services/lnData.ts), [LNPage.tsx](file:///c:/Github%20Repos/Yorumi/src/pages/LNPage.tsx), [PopularKoreanNovels.tsx](file:///c:/Github%20Repos/Yorumi/src/features/ln/components/PopularKoreanNovels.tsx), [PopularChineseNovels.tsx](file:///c:/Github%20Repos/Yorumi/src/features/ln/components/PopularChineseNovels.tsx))**:
  - Added full support for **Korean Web Novels** (e.g. *Solo Leveling*, *Omniscient Reader's Viewpoint*, *The Beginning After the End*, *Second Life Ranker*, *Nano Machine*, *Trash of the Count's Family*, *Return of the Mount Hua Sect*, *The Greatest Estate Developer*, *SSS-Class Suicide Hunter*) and **Chinese Web Novels / Xianxia / Wuxia** (e.g. *Lord of the Mysteries*, *Reverend Insanity*, *Martial Peak*, *Grandmaster of Demonic Cultivation*, *Heaven Official's Blessing*, *Coiling Dragon*, *Battle Through the Heavens*, *Renegade Immortal*, *The King's Avatar*, *Release That Witch*).
  - Introduced dedicated **Origin Filter Pills** (`All Novels`, `🇰🇷 Korean`, `🇨🇳 Chinese`, `🇯🇵 Japanese`) on the Light Novel hub (`/ln`).
  - Added origin and country badge indicators (`KR (WN)`, `CN (WN)`, `LN`) to novel cards ([LNCard.tsx](file:///c:/Github%20Repos/Yorumi/src/features/ln/components/LNCard.tsx)) and global search modal previews ([SearchModal.tsx](file:///c:/Github%20Repos/Yorumi/src/components/shared/SearchModal.tsx)).
  - Upgraded Light Novel search to execute parallel multi-source discovery across AniList GraphQL (`format: NOVEL`), curated web novel datasets, and live backend scraper endpoints (`/ln/search`), automatically normalizing, deduplicating, and formatting non-Japanese web novels.
  - Standardized Light Novel section headers with subtle horizontal divider lines (`────`) and chevron carousel controls matching Manga and Anime design language, removing the vertical colored indicator pills.
  - Aligned **Top 100 Light Novels** ([Top100LN.tsx](file:///c:/Github%20Repos/Yorumi/src/features/ln/components/Top100LN.tsx)) with the full multi-column grid layout and header design matching Top 100 Manga.
  - Implemented auto-hiding of the top navigation header and bottom chapter bar on scroll in the Manga Reader ([MangaReaderModal/index.tsx](file:///c:/Github%20Repos/Yorumi/src/features/manga/components/MangaReaderModal/index.tsx)).
  - Styled the "Back to Top" chevron arrow to match the dark background across Manga Reader ([PageViewer.tsx](file:///c:/Github%20Repos/Yorumi/src/features/manga/components/MangaReaderModal/PageViewer.tsx)) and global floating button ([ScrollToTop.tsx](file:///c:/Github%20Repos/Yorumi/src/components/ui/ScrollToTop.tsx)).
  - Enabled parallel concurrent downloading in **Download All** ([DetailsEpisodeGrid.tsx](file:///c:/Github%20Repos/Yorumi/src/features/anime/components/details/DetailsEpisodeGrid.tsx)) so all released episodes resolve and download simultaneously with live progress bars.
  - Added full offline **Download and "Download All" support for Manga** ([mangaDownloadService.ts](file:///c:/Github%20Repos/Yorumi/src/services/mangaDownloadService.ts), [useMangaDownloads.ts](file:///c:/Github%20Repos/Yorumi/src/hooks/useMangaDownloads.ts), [MangaDetailsPage.tsx](file:///c:/Github%20Repos/Yorumi/src/pages/MangaDetailsPage.tsx), [useManga.ts](file:///c:/Github%20Repos/Yorumi/src/hooks/useManga.ts)) with IndexedDB storage (`yorumi_manga_downloads_v1`), parallel chapter page image caching, live progress indicators, and seamless offline reader fallback.
  - Added full offline **Download and "Download All" support for Light Novels** ([lnDownloadService.ts](file:///c:/Github%20Repos/Yorumi/src/services/lnDownloadService.ts), [useLNDownloads.ts](file:///c:/Github%20Repos/Yorumi/src/hooks/useLNDownloads.ts), [LNDetailsPage.tsx](file:///c:/Github%20Repos/Yorumi/src/pages/LNDetailsPage.tsx), [LNReaderPage.tsx](file:///c:/Github%20Repos/Yorumi/src/pages/LNReaderPage.tsx)) with IndexedDB storage (`yorumi_ln_downloads_v1`), formatted chapter text caching, and offline reader fallback.
  - Positioned **Chapter View Toggle** (`List` / `Grid`) directly beside the `Chapters` title on Manga and Light Novel details pages, with `Downloads Folder` (Electron) and `Download All` buttons placed at the far right end of the header row.
  - Added dedicated **Downloads Carousels** to both the Manga and Light Novel tabs on the **Library Page** ([LibraryPage.tsx](file:///c:/Github%20Repos/Yorumi/src/pages/LibraryPage.tsx)), allowing users to view, manage, delete, and launch offline manga and light novel downloads identically to Anime.

## [4.0.5] - 2026-08-10

- **Offline Download & Playback Engine Fixes ([VideoPlayer.tsx](file:///c:/Github%20Repos/Yorumi/src/features/player/components/VideoPlayer.tsx), [downloadService.ts](file:///c:/Github%20Repos/Yorumi/src/services/downloadService.ts), [useDownloads.ts](file:///c:/Github%20Repos/Yorumi/src/hooks/useDownloads.ts), [DetailsEpisodeGrid.tsx](file:///c:/Github%20Repos/Yorumi/src/features/anime/components/details/DetailsEpisodeGrid.tsx))**:
  - Fixed offline playback black screen and `0:00 / 0:00` freeze by ensuring `shouldUseNativeVideo` evaluates to `true` for all offline media and consolidating native HTML5 `<video>` lifecycle effects to prevent double-assigning `video.src` and interrupting browser buffering.
  - Unified episode download keys across Web (IndexedDB) and Electron desktop environments, fixing real-time download progress tracking and deletion.
  - Upgraded episode grid download resolution to search across all stream providers (`anidb`, `auto`, `videasy`, `vidsrc`, `vidking`) and extract direct streams reliably.
  - Enhanced `/api/scraper/local-file` byte-range and MIME-type handling for instant seeking and smooth playback.

- **Persistent Single-Instance Video Player & Zero-Reset Portal Transitions ([PersistentPlayerContext.tsx](file:///c:/Github%20Repos/Yorumi/src/features/player/context/PersistentPlayerContext.tsx))**:
  - Mounted `<VideoPlayer>` inside a single persistent portal attached directly to `document.body`.
  - Switching display modes between watch page full mode and Mini Player mode (`/manga`, `/library`, `/ln`, `/anime`, Back button) no longer unmounts the `<VideoPlayer>` component tree, native HTML5 `<video>`, or embed `iframe`s.
  - Video stream and embed playback continue uninterrupted at the exact timestamp without resetting to `0:00` or reloading.

- **Native GPU Hardware Compositor Player Layout**:
  - Positioned watch page player using page-absolute coordinates (`rect.left + scrollX`, `rect.top + scrollY`).
  - Scrolling the details page runs 100% natively on Chrome's GPU hardware compositor with zero JavaScript scroll listener lag and zero bounce.

- **Automatic Next/Previous Episode Navigation ([usePlayer.ts](file:///c:/Github%20Repos/Yorumi/src/features/player/hooks/usePlayer.ts), [DetailsVideoPlayer.tsx](file:///c:/Github%20Repos/Yorumi/src/features/anime/components/details/DetailsVideoPlayer.tsx))**:
  - Updated `usePlayer.ts` so `onNextEpisode` (`▶|`) and `onPrevEpisode` (`|◀`) controls are always enabled and functional.
  - If the full episode list is still fetching in the background, clicking Next or Previous calculates adjacent episode numbers (`currentEp + 1` or `currentEp - 1`) automatically.
  - Instantly unmounts old stream, shows `sleeping.gif` loading animation (`fetching anime player...`), and auto-plays the new episode stream when resolved.

- **AniDB Stream Engine & Download Resolution Fixes ([useStreams.ts](file:///c:/Github%20Repos/Yorumi/src/hooks/useStreams.ts), [downloadService.ts](file:///c:/Github%20Repos/Yorumi/src/services/downloadService.ts))**:
  - Fixed master `.m3u8` playlist download extraction and proxied segment resolution for AniDB stream sources.

- **Universal Multi-Architecture macOS & Windows Build Pipeline ([package.json](file:///c:/Github%20Repos/Yorumi/package.json), [release.yml](file:///c:/Github%20Repos/Yorumi/.github/workflows/release.yml))**:
  - Added build targets for macOS Universal `.dmg` (M1/M2/M3/M4 Apple Silicon & Intel x64), Windows ARM64 (Snapdragon X Elite / Copilot+ PCs), Windows Portable `.exe`, and Linux AppImage in GitHub Actions CI/CD workflow.

## [4.0.3] - 2026-08-10

- **Permanent Portal Container Lock & Zero Unmount Playback ([PersistentPlayerContext.tsx](file:///c:/Github%20Repos/Yorumi/src/features/player/context/PersistentPlayerContext.tsx))**:
  - Identified and fixed the root cause of video stream resets during route changes: switching `createPortal` target container between `inlineElement` and `document.body` forced React to unmount and remount the `<VideoPlayer>` DOM tree, destroying the native HTML5 `<video>` element and resetting playback to `0:00`.
  - Locked `createPortal` target container permanently to `document.body`.
  - Inline player mode on details pages now uses fixed viewport-relative positioning matching `inlineElement`'s bounds, while Mini Player mode uses fixed bottom-right coordinates.
  - Because the portal container target never changes, `<VideoPlayer>` and the native `<video>` element remain mounted in DOM memory throughout all route transitions, enabling 100% uninterrupted, smooth continuous playback when navigating between details pages, Mini Player, and back.

- **Details Overview Mini Player Fallback ([PersistentPlayerContext.tsx](file:///c:/Github%20Repos/Yorumi/src/features/player/context/PersistentPlayerContext.tsx))**:
  - Fixed a bug where returning from the active watch player to the anime details overview page (where `inlineElement` is not mounted in the DOM) caused the video player to become invisible while audio continued playing in the background.
  - Defined `isInlineAvailable = Boolean(isWatchRoute && inlineElement)`. Whenever `inlineElement` is not present in the DOM (such as on the details overview tab), `shouldShowMiniPlayer` evaluates to `true`, instantly displaying the draggable Mini Player in the bottom-right corner with full audio and video visibility.

- **Online Stream Loading Overlay ([VideoPlayer.tsx](file:///c:/Github%20Repos/Yorumi/src/features/player/components/VideoPlayer.tsx))**:
  - Fixed a bug where watching an online stream displayed a static black screen without a loading indicator while streams were being resolved.
  - Updated the loading condition to `(!resolvedStreamUrl || isLoading || isServerSwitching) && !streamExhausted`, guaranteeing that the floating sleeping GIF loading animation (`fetching anime player...`) is displayed whenever an online stream is resolving.
  - Downloaded offline files continue to resolve instantly in <5ms with 0ms loading delay.

- **Sidebar Back Button Navigation ([Sidebar.tsx](file:///c:/Github%20Repos/Yorumi/src/components/layout/Sidebar.tsx))**:
  - Updated the global sidebar Back button on anime details pages to use `navigate(-1)` instead of hardcoded `navigate('/')`.
  - When navigating to an anime details page from **Library - Downloads**, clicking the sidebar Back button now returns you directly to **Library - Downloads** instead of resetting your navigation back to Home.

- **Instant Offline Stream Return & Zero Scraper Lag ([useStreams.ts](file:///c:/Github%20Repos/Yorumi/src/hooks/useStreams.ts), [downloadService.ts](file:///c:/Github%20Repos/Yorumi/src/services/downloadService.ts))**:
  - Fixed a bug where playing downloaded episodes triggered online network scrapers (`ANIDB`/`VidSrc`) over the network, causing PC lag, `0:00 / 0:00` black screen loading spinners, and accidentally picking online streams over local files.
  - `ensureStreamDataForServer()` now returns `[offlineStream]` **immediately** (<5ms) when a local file is present, skipping online network scrapers entirely.
  - Assigned offline local streams a top priority score (`100,000,000`) in `scoreStream()` so the local file is always stream #1.
  - Fixed slug vs numeric ID matching (`isDifferentNumericId`) so downloads saved under slug IDs (e.g. `you-and-i-are-polar-opposites`) are properly matched when opening pages with numeric AniList IDs (`170942`).

- **Downloaded Episode Key Format ([downloadService.ts](file:///c:/Github%20Repos/Yorumi/src/services/downloadService.ts), [useDownloads.ts](file:///c:/Github%20Repos/Yorumi/src/hooks/useDownloads.ts))**:
  - Updated `getEpisodeKey()` to format keys as `{slug}-e{episodeNumber}` (e.g. `you-and-i-are-polar-opposites-e2`, `you-and-i-are-polar-opposites-e15`).
  - Maintained full backwards compatibility for legacy key formats (`{animeId}_ep_{episodeNumber}`).

- **Episode Grid Download Check Icon ([DetailsEpisodeGrid.tsx](file:///c:/Github%20Repos/Yorumi/src/features/anime/components/details/DetailsEpisodeGrid.tsx))**:
  - Removed the standalone `isWatched` check icon from the top-right header of episode cards.
  - Replaced the `isDownloaded` indicator icon (`CheckCircle2`) with `CircleCheckBig` (the bold checkmark inside a circle) for a cleaner, bolder look.

- **Episode Season Merging Fix ([AnimeDetailsPage.tsx](file:///c:/Github%20Repos/Yorumi/src/pages/AnimeDetailsPage.tsx))**:
  - Fixed a bug where multi-season anime (e.g. *"You and I Are Polar Opposites"*) showed merged Season 1 + Season 2 episodes (25 total) on the details page instead of the current season's episodes only.
  - Root cause: `buildInstantEpisodes` generated placeholder episodes up to `selectedAnime.episodes` (AniList total across all seasons) before TMDB resolved the actual season breakdown asynchronously.
  - Added an optional `maxEpisodes` parameter to `buildInstantEpisodes`. When the active season chip is not Season 1 (i.e., a continuation), the caller now passes `activeChip.count` as the cap, preventing placeholder episodes from bleeding across seasons during the async TMDB resolution phase.

- **Download Episode Number Mismatch Fix ([AnimeDetailsPage.tsx](file:///c:/Github%20Repos/Yorumi/src/pages/AnimeDetailsPage.tsx))**:
  - Fixed a bug where opening a multi-season anime details page from Library → Downloads would incorrectly show downloaded episodes from *other seasons* in addition to the correct season's downloads.
  - Root cause: `matchingDownloads` used fuzzy title matching which matched "You and I Are Polar Opposites" (S1 downloads) when viewing "Season 2" (different AniList ID). The S1 episode numbers (1–4) were then incorrectly included in `downloadedEpisodeSet`, causing S2's episodes 1–4 to appear to be "downloaded" and show in the offline filter.
  - Fixed by rejecting title-match results when the download's `animeId` differs from the current anime's ID, so only same-series downloads bleed through.
  - Added a scraper episode cap: when multiple season chips are visible and TMDB hasn't resolved yet, cap the displayed scraper episodes to `max(anime.episodes, anime.latestEpisode)` to prevent merged S1+S2 episodes from showing as a single merged list during the TMDB async load.

## [4.0.2] - 2026-08-08

- **Electron Download Library Visibility & Audio Fix ([main.js](file:///c:/Github/Repos/Yorumi/dist-electron/main.js), [downloadService.ts](file:///c:/Github/Repos/Yorumi/src/services/downloadService.ts))**:
  - Fixed a critical bug where `cp` (child_process) was not imported at the top-level scope of the native downloader section, causing `findFfmpegExecutable()` to always return `null` silently. This meant:
    1. FFmpeg was never invoked for direct-download → downloaded episodes had no audio (raw TS segments written without remux).
    2. FFmpeg transmux after chunked download always failed → files saved as `.ts` instead of `.mp4`.
  - Added `const cp = __require("child_process")` at the correct top-level scope so FFmpeg is correctly found and used for both direct-download and transmux paths.
  - Implemented `bootstrapOrphanedDownloads()` — a non-blocking startup routine that scans the downloads folder for any `.ts`/`.mp4` files not tracked in `manifest.json` (orphaned from older sessions), registers them instantly in the manifest so they appear in the Library, and then queues async FFmpeg transmux for `.ts` files to produce proper audio-carrying MP4s.
  - Bootstrap runs on first `get-local-downloads` IPC call (on Library page mount) so orphaned historic downloads are recovered without blocking the UI.

- **HLS Proxied Segment Resolution & Multi-Provider Download Stream Fallback ([downloadService.ts](file:///c:/Github/Repos/Yorumi/src/services/downloadService.ts), [main.js](file:///c:/Github/Repos/Yorumi/dist-electron/main.js), [DetailsEpisodeGrid.tsx](file:///c:/Github/Repos/Yorumi/src/features/anime/components/details/DetailsEpisodeGrid.tsx), [streamUtils.ts](file:///c:/Github/Repos/Yorumi/src/utils/streamUtils.ts))**:
  - Fixed a critical bug in both Electron and Web HLS chunked segment downloaders where relative variant playlists and TS segment URLs in proxied stream playlists (`/api/scraper/proxy?url=...`) were resolved against `localhost:3001/api/scraper/` instead of the underlying upstream stream base URL, causing 404 segment fetch failures.
  - Implemented `resolveHlsUrl` to properly extract upstream query targets and preserve referer and proxy headers across recursive variant and segment resolution.
  - Fixed `handleDownloadEpisode` and `streamUtils.ts` to compute actual playback episode numbers via `getPlaybackEpisodeNumber` (fixing mismatched season vs absolute episode numbering) and automatically fallback across `anidb` and `auto`/`allmanga` providers to resolve downloadable video streams.

- **MP4 Download Transmuxing & Automatic Legacy TS Migration ([main.js](file:///c:/Github/Repos/Yorumi/dist-electron/main.js), [scraper.routes.ts](file:///c:/Github/Repos/Yorumi/backend/src/api/scraper/scraper.routes.ts))**:
  - Implemented automatic FFmpeg path detection with Windows shell shim support and fast container transmuxing (`-c:v copy -c:a aac -b:a 192k -ac 2 -movflags +faststart`) so all downloaded HLS/video streams are saved as clean, standard `.mp4` video files.
  - Added startup migration in Electron to automatically convert any existing `.ts` downloads into `.mp4` and update the manifest.
  - Updated `/api/scraper/local-file` to prefer `.mp4` files over legacy `.ts` files with full range support and CORS headers.
- **Fuzzy Episode Download State Matching & Offline Prioritization ([DetailsEpisodeGrid.tsx](file:///c:/Github/Repos/Yorumi/src/features/anime/components/details/DetailsEpisodeGrid.tsx), [useDownloads.ts](file:///c:/Github/Repos/Yorumi/src/hooks/useDownloads.ts), [useStreams.ts](file:///c:/Github/Repos/Yorumi/src/hooks/useStreams.ts))**:
  - Fixed an issue where downloaded episodes showed download buttons instead of the downloaded badge due to strict slug/id mismatch on anime details pages.
  - Updated `isEpisodeDownloaded`, `getEpisodeDownload`, and IPC handlers to cross-reference slug IDs, AniList IDs, clean titles via `isDownloadTitleMatch`, and multiple episode numbering schemes (`playbackEpisodeNumber`, `episodeNumber`, `_tmdbAbsolute`).
  - Prioritized offline downloaded streams in `useStreams.ts` so downloaded episodes play immediately without failing or waiting for scraper responses.
- **Non-Numeric & Custom Scraper Anime ID Route Resolution ([AnimeDetailsPage.tsx](file:///c:/Github/Repos/Yorumi/src/pages/AnimeDetailsPage.tsx))**:
  - Fixed a routing crash where non-numeric anime IDs (e.g. AllManga `am-4qKCf...` or slug identifiers from downloads) failed `Number.parseInt` checks and erroneously redirected back to `/`.
  - Added full fallback support to hydrate anime details and episode lists directly from navigation state and local offline downloads.
- **Native FFmpeg Lossless Video & Universal AAC Stereo Audio Downloader ([main.js](file:///c:/Github/Repos/Yorumi/dist-electron/main.js))**:
  - Configured FFmpeg with `-c:v copy -c:a aac -b:a 192k -ac 2 -movflags +faststart` and added yt-dlp secondary fallback to ensure downloaded MP4 files have universal, 100% supported 2-channel stereo AAC audio that plays on Windows Media Player, VLC, and HTML5 video.
  - Implemented real-time progress parsing (`0-100%`) from FFmpeg output streamed to episode cards.
- **Library Downloads Anime Series Card Flow ([LibraryPage.tsx](file:///c:/Github/Repos/Yorumi/src/pages/LibraryPage.tsx), [AnimeDetailsPage.tsx](file:///c:/Github/Repos/Yorumi/src/pages/AnimeDetailsPage.tsx))**:
  - Refactored the Library Downloads section to always show clean Anime Series Cards with episode count badges and total disk size.
  - Clicking an anime card opens the Anime Details page where all downloaded episodes for that series are immediately accessible and playable offline without blocking on network requests.
- **Episode Grid Background Downloads & Player Decoupling ([DetailsEpisodeGrid.tsx](file:///c:/Github/Repos/Yorumi/src/features/anime/components/details/DetailsEpisodeGrid.tsx), [CustomVideoControls.tsx](file:///c:/Github/Repos/Yorumi/src/features/player/components/CustomVideoControls.tsx), [useStreams.ts](file:///c:/Github/Repos/Yorumi/src/hooks/useStreams.ts))**:
  - Removed download button from custom video player controls to prevent download triggers from interfering with live playback.
  - Added one-click download buttons, download state badges, and live progress bars directly to each episode card in `DetailsEpisodeGrid` so users can download any episode in the background without needing to start video playback.
  - Added "Download All" bulk download and "Downloads Folder" opening action to `DetailsEpisodeGrid`.
  - Refactored `useStreams.ts` to ensure normal online playback is never hijacked or broken by offline download records.
- **HLS Master Playlist Variant Resolution & Media Loader Fix ([main.js](file:///c:/Github/Repos/Yorumi/dist-electron/main.js), [VideoPlayer.tsx](file:///c:/Github/Repos/Yorumi/src/features/player/components/VideoPlayer.tsx), [downloadService.ts](file:///c:/Github/Repos/Yorumi/src/services/downloadService.ts))**:
  - Fixed a critical bug in the chunked downloader where HLS master playlists (`#EXT-X-STREAM-INF`) were treated as segment lists instead of fetching the child media playlist, causing a small text playlist to be written into the `.ts` file instead of MPEG-TS video frames.
  - Implemented recursive variant quality playlist resolution with highest-bandwidth auto-selection.
  - Enhanced `CustomHlsLoader` in `VideoPlayer.tsx` to handle `/api/scraper/local-file` streaming endpoints via native `fetch()` ArrayBuffer loading.
- **Offline Download Title Normalization & State Matching ([downloadService.ts](file:///c:/Github/Repos/Yorumi/src/services/downloadService.ts), [AnimeDetailsPage.tsx](file:///c:/Github/Repos/Yorumi/src/pages/AnimeDetailsPage.tsx), [usePlayer.ts](file:///c:/Github/Repos/Yorumi/src/features/player/hooks/usePlayer.ts))**:
  - Implemented `cleanDownloadTitle()` and `isDownloadTitleMatch()` to handle truncated anime titles with ellipsis (e.g. "You and I Are Polar ...") so downloaded episodes reliably match full titles ("You and I Are Polar Opposites").
  - Propagated `downloadId`, `downloadedEpisode`, and `animeTitle` via navigation state from `LibraryPage` to `AnimeDetailsPage` and `usePlayer` to guarantee instantaneous offline playback resolution when clicking downloads.
- **Range-Enabled Local Video File Streamer ([scraper.routes.ts](file:///c:/Github/Repos/Yorumi/backend/src/api/scraper/scraper.routes.ts), [downloadService.ts](file:///c:/Github/Repos/Yorumi/src/services/downloadService.ts))**:
  - Added `GET /api/scraper/local-file` backend endpoint with `206 Partial Content` HTTP Range header streaming to serve native disk downloads directly to `<video>` and `hls.js` without CORS or `file:///` browser security blocks.
  - Updated `useStreams.ts` to evaluate `offline.filePath` in addition to `offline.videoBlob` so Electron native disk downloads trigger offline playback properly.
- **Electron Native Disk Downloader Architecture ([main.js](file:///c:/Github/Repos/Yorumi/dist-electron/main.js), [downloadService.ts](file:///c:/Github/Repos/Yorumi/src/services/downloadService.ts))**:
  - Implemented IPC-based native disk streaming downloader in Electron (`app.getPath('userData')/downloads/`), writing video stream chunks directly to disk files using Node `fs.createWriteStream`.
  - Replaced browser RAM Blob storage in Electron mode to eliminate memory spikes during multi-hundred-megabyte episode downloads.
  - Implemented real-time progress IPC event streaming (`0-100%`) from main process to renderer.
  - Maintained browser `IndexedDB` fallback for non-Electron web environments.
- **Downloaded Anime HLS Playback Fix ([downloadService.ts](file:///c:/Github/Repos/Yorumi/src/services/downloadService.ts), [VideoPlayer.tsx](file:///c:/Github/Repos/Yorumi/src/features/player/components/VideoPlayer.tsx))**:
  - Fixed a critical bug where downloaded HLS anime episodes failed to play (remaining black or stalling at `0:00 / 2:00:00`).
  - Added an in-memory `.m3u8` HLS playlist wrapper generation in `downloadService.getOfflineStream()` so concatenated MPEG-TS segment blobs are correctly routed to `hls.js`.
  - Implemented `CustomHlsLoader` using standard `fetch` in `VideoPlayer.tsx` to handle `blob:` URLs directly, bypassing XHR status 0 limitations.
  - Added MPEG-TS sync byte detection (`0x47`) to automatically support legacy downloaded blobs as well as new downloads.
  - Pre-fetched and converted subtitle tracks to local Blobs during episode downloads for offline subtitle rendering.
- **Strict Offline Download Matching Fix ([downloadService.ts](file:///c:/Github/Repos/Yorumi/src/services/downloadService.ts))**:
  - Fixed an issue where `getDownload()` fell back to returning downloaded episodes from *other* anime when the target anime was not in offline storage.
  - Added strict `animeId` / `animeTitle` filtering to ensure `getDownload()` only matches episodes belonging to the requested anime.
  - Added non-empty `videoBlob.size` validation before creating local blob URLs in `useStreams.ts` so un-downloaded online anime cleanly fetch fresh video streams from the scraper API instead of passing an empty string (`src=""`).
- **Auto-Load Episode Loop Fix ([usePlayer.ts](file:///c:/Github/Repos/Yorumi/src/features/player/hooks/usePlayer.ts))**:
  - Fixed an infinite re-render loop (`Maximum update depth exceeded`) where `usePlayer` was repeatedly invoking `loadStream(targetEp)` on every frame while `streamLoading` was active.
  - Added a `streamLoading || serverSwitchLoading` guard before calling `loadStream()` to prevent redundant load attempts.
  - Added numerical equivalence check (`currentEpParamNumber !== targetEpisodeNumber`) before calling `setSearchParams()` to prevent duplicate URL updates.
- **Stale Cache Purge ([animeService.ts](file:///c:/Github/Repos/Yorumi/src/services/animeService.ts))**:
  - Bumped `PERSISTED_CACHE_PREFIX` to `v10` and `STREAM_CACHE_VERSION` to `v18` to purge all stale stream and API response caches.
- **React Infinite Loop Fix (`Maximum update depth exceeded`)**:
  - Replaced mutable `streams` state and looping `useEffect` in `useStreams.ts` with a pure `useMemo` hook derived from `allStreams` and `selectedAudio`.
  - Removed state mutation dependencies so `useStreams` can never trigger infinite re-renders.
- **Offline Download Stream Resolution Fix**:
  - Updated `downloadService.ts` (`getOfflineStream`) to include `directUrl: streamUrl` for local blob links so `VideoPlayer.tsx` detects direct video streams properly.
  - Enhanced `useStreams.ts` to match offline downloads by `episode.session` in addition to episode number & target ID.
- **Downloads-Only Scope Fix ([AnimeDetailsPage.tsx](file:///c:/Github/Repos/Yorumi/src/pages/AnimeDetailsPage.tsx))**:
  - Restricted the "show only downloaded episodes" filter to trigger **ONLY** when navigating from the Downloads area (`location.state?.fromDownloads`) or when device is offline (`!navigator.onLine`).
  - When opening an anime from Home, Search, Watchlist, or Recent Watches, **ALL** episodes (`E1, E2, E3, E4...`) are displayed normally.
- **Offline Download Stream & Metadata Priority**:
  - Updated `useStreams.ts` to check IndexedDB (`downloadService`) **FIRST** for downloaded video blobs before making any network requests, eliminating network timeouts when offline or playing downloaded anime.
  - Added an offline fallback in `animeService.ts` (`getAnimeDetailsFast`) to construct anime metadata and episode lists directly from IndexedDB when offline.
- **Grouped Offline Anime Downloads**:
  - Updated `LibraryPage.tsx` so multiple downloaded episodes of the same anime are grouped into a single Anime Card showing total episodes, combined file size, title, and cover image.
  - Single-episode downloads remain as individual cards.
- **Offline Details Page Episode Filtering**:
  - Updated `AnimeDetailsPage.tsx` so when viewing an offline downloaded anime, the episode grid filters to display **only the downloaded episodes** sorted in **ascending order** (`E1, E2, E3...`).
- **Season Chips Glow Removal**:
  - Removed glowing shadow effects (`shadow-lg shadow-blue-500/20`) on active Season Chips in `DetailsEpisodeGrid.tsx` for a clean, solid pill style.
- **HLS Stream Autoplay & Media Initialization Fix**:
  - Fixed a black screen issue at `0:00` in `VideoPlayer.tsx` where seeking and `.play()` were invoked prematurely before HLS media metadata was parsed (`readyState < 1`).
  - Added a `loadedmetadata` event listener in `MANIFEST_PARSED` to ensure seeking and `.play()` execute only after HLS segment metadata is ready.
  - Implemented an automatic muted playback fallback (`video.muted = true; video.play()`) if unmuted autoplay is blocked by browser/Electron policies.
- **Video Player Stream Registration & Playback Fix**:
  - Fixed a bug in `PersistentPlayerContext.tsx` where `isIncomingStreamEmpty` incorrectly preserved the previous anime's video stream when a different episode or anime was clicked.
  - Added an `isDifferentEpisode` guard in `PersistentPlayerContext.tsx` to ensure new episode stream properties are registered immediately when clicking any anime.
  - Removed duplicate stream attempt lock in `usePlayer.ts` so `loadStream(targetEp)` always fires cleanly whenever a stream is missing.
  - Fixed HLS stream autoplay in `VideoPlayer.tsx` by isolating native video autoplay handlers from `hls.js` manifest parsing.
- **Enhanced Player Title Header (`E2 {Anime Title}`)**:
  - Updated video player header logic ([DetailsVideoPlayer.tsx](file:///c:/Github/Repos/Yorumi/src/features/anime/components/details/DetailsVideoPlayer.tsx)) to display the **Anime Title** alongside the episode number badge (`E2 {Anime Title}` or `E2 {Anime Title} • {Episode Title}`) instead of rendering bare/generic `Episode 2` text.
- **Offline-First Catalog & Media Browsing (Anime, Manga, Light Novels)**:
  - Built a universal offline-first caching system ([offlineCache.ts](file:///c:/Github/Repos/Yorumi/src/services/offlineCache.ts)) with persistent `localStorage` and memory caching across Anime, Manga, and Light Novel catalogs.
  - Automatically caches Spotlight, Trending, Popular, Top 100, Latest Updates, Detail pages, Chapter/Episode lists, and Reader content in the background when online.
  - Serves cached catalog payloads immediately when offline or on network failure, allowing all media cards, details, and chapter lists to remain fully visible and accessible without internet.
  - Added an offline mode indicator badge ([OfflineBanner.tsx](file:///c:/Github/Repos/Yorumi/src/components/shared/OfflineBanner.tsx)) displaying `"Offline Mode — Browsing Offline Library"` when `!navigator.onLine`.
- **Persistent Player & Seamless Playback Resumption**:
  - Fixed an issue where returning from the floating mini player or navigating back to `/anime/details/...` reset the video to 0:00.
  - Implemented continuous playback tracking in `VideoPlayer.tsx` (`lastTimeRef`) and `usePlayer.ts` to preserve active video streams when expanding or navigating back.
  - Automatically loads saved episode timestamps from `storage.getContinueWatching()` when opening an episode, resuming playback seamlessly right where the user left off.
- **Library Media Separation with Header Selector**: Divided the My Library page (`/library`) into dedicated views for **Anime**, **Manga**, and **Light Novels** with a horizontal divider line and an icon selector toggle matching the app's design language.
- **Direct Last-Read Chapter Resumption**:
  - In **Manga Details** and **Library Readlists**, clicking "Read" / saved manga automatically resumes reading from the user's last read chapter (supporting decimal chapter numbers like `Ch. 0.16` and `Ch. 2.1`) matching Light Novel behavior.
  - In **LN Details** and **Library Novellists**, clicking saved light novels automatically resumes reading from the last read chapter.
- **Unified Manga Reader Loading Screen**: Replaced generic spinners in the Manga Reader and page viewer with the bouncing sleeping mascot animation and status text matching the Light Novel reader.
- **All macOS Platforms Desktop Support**: Configured `electron-builder` to target all macOS platforms across architectures—Universal binaries (`universal`), Apple Silicon (`arm64` - M1/M2/M3/M4), and Intel (`x64`) in both `.dmg` disk image installers and portable `.zip` bundles. Added explicit npm scripts (`build:electron:mac:universal`, `build:electron:mac:arm64`, `build:electron:mac:x64`).
- **macOS Media Player Integration in Yorumi CLI**: Expanded player auto-detection in `yorumi-cli/src/player.ts` and setup helper tips in `install.sh` for macOS environments (IINA `/Applications/IINA.app`, Homebrew Apple Silicon `/opt/homebrew/bin/mpv`, Intel `/usr/local/bin/mpv`, and VLC).
- **Website Multi-Architecture macOS Downloads**: Updated `website/src/App.tsx` download buttons and badges for `v4.0.2` with direct options for macOS Universal, Apple Silicon, and Intel installers.
- **Streamlined Video Providers**: Configured **AniDB** as the primary direct HLS stream provider backed by **VidSrc**, **VidKing**, and **Videasy** embed sources, removing broken/torrent scrapers.

### Fixed
- **Trending Anime Carousel Card Count**: Fixed an issue where the Trending carousel only displayed ~4 cards. Increased backend home trending pool sizes from 10 to 30 items, and fixed `isReleasedTrendingAnime` so currently-releasing anime (`status: 'RELEASING' | 'FINISHED' | 'COMPLETED'`) with unannounced total episode counts are not mistakenly dropped.
- **AniDB Cloudflare Bypass (`ani-cli` Alignment)**: Implemented resilient curl/browser failover for `anidb.app` requests in `video-sources.ts` and `allmanga.ts` (matching `ani-cli`'s failover architecture) to bypass Cloudflare Turnstile/Managed Challenges and cleanly extract master HLS streams.
- **AniDB & Server Dropdown Selection**:
  1. Fixed server selection handler in `usePlayer.ts` and `DetailsVideoPlayer.tsx` by properly exposing and wiring `handleServerChange` to `onServerChange`, ensuring clicking **AniDB**, **VidSrc**, **VidKing**, or **Videasy** immediately evicts the stream cache and reloads playback for the chosen provider.
  2. Updated AniDB anime search in `backend/src/api/anime/video-sources.ts`, `backend/src/scraper/allmanga.ts`, and `yorumi-cli/src/allanime.ts` to support both `/browse?q=` and `/search/suggestions?q=` endpoints with clean title matching against card titles and slugs.
  3. Supported matching both relative (`/anime/...`) and absolute (`https://anidb.app/anime/...`) href patterns.
  4. Sanitized escaped slashes in language `embed_url` endpoints, robustly parsed master `.m3u8` playlist files, and enabled full native multi-quality (1080p, 720p, 360p) and Sub/Dub resolution.
  5. Switched `yorumi-cli` AniDB URL fetching to non-blocking native `fetch` with timeout.
  6. Bumped the frontend persisted stream cache to `v17` and backend stream cache to `v109` so old bad/stale stream payloads are purged after provider fixes.
- **VidSrc Active Domain & Embed Player Resolution**:
  1. Updated default active VidSrc embed domain to `https://vidsrc.in` (and supported mirrors) to resolve live embed streams reliably.
  2. Fixed TMDB target ID resolution in `video-sources.ts` to prevent conflating TMDB IDs with AniList IDs.
  3. Added `isEmbed` metadata flag to `scraper.service.ts` stream payloads for embed providers.
  4. Updated `scoreStream` in `src/hooks/useStreams.ts` to ensure selected embed servers (`vidsrc`, `vidking`, `videasy`) are properly scored without penalty when explicitly selected by the user.

## [4.0.1] - 2026-08-05

### Added & Changed
- **Cross-Platform Desktop Release Automation**: Added automated GitHub Actions build workflow (`.github/workflows/release.yml`) that compiles macOS (`.dmg`), Linux (`.AppImage`), and Windows (`.exe`) installers in parallel and publishes official GitHub Releases when version tags (`v*`) are pushed.
- **Multi-Platform Build Commands**: Configured `package.json` with explicit `build:electron:win`, `build:electron:mac`, `build:electron:linux`, and `build:electron:all` scripts.

### Fixed
- **VidSrc Provider & Embed Player Resolution**: Fixed backend route validation in `scraper.routes.ts` (`/api/scraper/streams`), updated VidSrc default domain to `https://vidsrc.net` in `video-sources.ts`, and added standard HTML5 `<iframe />` fallback rendering in `VideoPlayer.tsx` for web browser mode.

## [4.0.0] - 2026-08-04

### Added & Changed
- **Light Novel (LN) Reading Hub & Reader**: Introduced a dedicated Light Novel feature slice (`src/features/ln`), complete with an LN Homepage (`/ln`), Spotlight hero, All-Time Popular list, Top 100 LN grid, Search filter, Bookmark management, Reading Progress synchronization, and a custom LN Reader (`/ln/read/...`) with customizable typography, theme controls, and chapter navigation.
- **AniDB Primary Anime Scraper Engine**: Switched the primary anime streaming source engine to **AniDB** (`anidb.app`), using multi-step scraping (`browse` $\rightarrow$ `episodes` $\rightarrow$ `languages` $\rightarrow$ `master.m3u8`).
- **Direct Multi-Quality & Dual-Audio Playback**: Enabled native HLS resolution switching (**1080p**, **720p**, **360p**) and Japanese Sub & English Dub audio track selection for AniDB streams via backend `.m3u8` and segment (`.xls`) proxying.
- **Streamlined Provider Options**: Configured `AniDB` as default primary provider, backed by `VidSrc`, `VidKing`, and `Videasy`.
- **Standalone Electron Executable (.exe)**: Embedded the Express backend scraper (`backend/dist/bundle.cjs`) directly into the Electron `.exe` build so desktop users run 100% self-contained out-of-the-box without needing any local or external server.
- **Cross-Platform Desktop Build Commands**: Added explicit multi-platform target build scripts in `package.json` (`build:electron:win`, `build:electron:mac`, `build:electron:linux`, and `build:electron:all`) and updated `scripts/build-electron.cjs` to forward platform flags to `electron-builder` for seamless Windows (`.exe`), macOS (`.dmg`), and Linux (`.AppImage`) packaging.
- **Website Redesign for v4.0.0**: Updated `website/src/App.tsx` description, version badges to `v4.0.0`, client `.exe` download links, "What's new" release highlights, and carousel preview slides for Light Novel browsing and reading (`lighnovel.png`, `read-lightnovel.png`).

### Fixed
- **VidSrc Provider & Embed Player Resolution**:
  1. Fixed backend route validation in `scraper.routes.ts` (`/api/scraper/streams`) which rejected VidSrc, VidKing, and AniDB requests with a 400 error (`anime_session and ep_session are required`) when selecting metadata-based embed sources without a raw scraper session.
  2. Updated default VidSrc mirror domain in `backend/src/api/anime/video-sources.ts` from timed-out `vidsrc.pm` to active `https://vidsrc.net` (with `VIDSRC_BASE_URL` env override support).
  3. Fixed embed player rendering in `src/features/player/components/VideoPlayer.tsx` by adding standard HTML5 `<iframe />` fallback rendering for web browsers (preventing Electron `<webview />` elements from rendering blank in web mode).
- **AniDB Stream Proxying & Cross-Platform Reliability**: Wrapped raw `AniDBSource` (`masterM3u8`/`dubM3u8`) stream URLs in `/api/scraper/proxy` with `Referer: https://anidb.app/` headers so the video player (`hls.js`) successfully streams without 403 Forbidden / CORS errors in desktop `.exe` builds. Replaced process-heavy `curl.exe` shell calls with native non-blocking `axios.get` requests for cross-platform reliability. Also replaced hardcoded `localhost:3001` URLs in `manga.service.ts` with relative `/api` paths.
- **Standalone Executable (.exe) Non-Dev Runtime Reliability**: Fixed standalone `.exe` runtime execution for non-developer end users. Added `asarUnpack` for `backend/dist/bundle.cjs` in `package.json`, registered `before-quit` and `will-quit` backend process cleanup in `dist-electron/main.js` to eliminate `EADDRINUSE :::3001` port conflicts, updated `browser-manager.ts` to restrict `@sparticuz/chromium` to serverless environments (`VERCEL=1`), and removed `process.execPath` fallback in Puppeteer browser launching.
- **Player Quality Selection Persistence**: Fixed quality options (1080p, 720p, 480p, 360p) being greyed out or resetting to Auto when using HLS streams or single-source providers in `CustomVideoControls.tsx`.
- **Player Route & Position Stability**: Fixed persistent player route checks in `PersistentPlayerContext.tsx` to prevent the video player from unmounting or popping out into a floating mini-player when changing episode search parameters on the details page.
- **Stale Stream Cache Invalidation**: Bumped stream cache version key to `v104` in `video-sources.ts` to automatically purge stale stream caches.

## [3.5.7] - 2026-07-28

### Added & Changed
- **Minimal Website Landing Page, Separate Documentation Pages, & UI Polish**: Redesigned the hero section of `website/src/App.tsx` to adopt a clean, minimal aesthetic with the **v3.5.7** version indicator aligned to the base of the **Yorumi** heading (`items-baseline`), styled the **Get Started** button in Yorumi's signature blue theme (`bg-yorumi-main`). Abstracted the **Start Using** Hub and the 3-column **Developer Docs & Guides** component (`website/src/Documentation.tsx`) into their own dedicated, full-page views (`#get-started` and `#docs`) with URL hash-routing, ensuring users no longer just scroll down a massive single page. Removed faint borders across cards and fixed the "blacked-out" button contrast issue on Client download links by replacing solid dark backgrounds with beautiful, theme-aware translucent colors (`bg-yorumi-main/10`), ensuring perfect visibility in both light and dark modes. Also includes a placeholder for a new TMDB API Key picture tutorial!
- **Anikoto Provider Integration**: Ported the Anikoto scraper logic into the Yorumi backend, enabling a new stream source for anime. Registered `anikoto` in the video-sources API and frontend `useStreams.ts` to allow users to select it in the player.
- **Anime Player Scrubber Polish**: Enlarged the video progress bar, switched played progress to Yorumi blue, added a plain circular playhead, and simplified hover timestamps.

### Fixed
- **Anime Player Next-Episode Navigation State**: Preserved route state when switching episodes from the details player controls and adjacent episode previews, preventing scraper-session detail pages from rebuilding with the raw session token as the anime title and keeping the viewport anchored on the player during next/auto-next.
- **AllManga Stream Resolution Speed Optimization**: Bypassed redundant AniList season title resolution (`resolveSeasonTitle`) and redundant GraphQL search queries in `scraper.service.ts` and `backend/src/scraper/allmanga.ts` when a valid AllManga show ID session is present. Replaced process-heavy `execFileAsync('curl')` calls with direct non-blocking `axios.get` requests (3s timeout) in `fetchAnidbUrl`, reducing AllManga stream resolution times from over 9 seconds down to ~150ms.
- **Removed VidSrc Fallback on AllManga Stream Load**: Removed automatic fallback to `vidsrc`, `vidking`, and `videasy` servers in `src/hooks/useStreams.ts` when `AllManga` is selected, ensuring the player maintains the user's chosen server instead of silently switching.
- **Manga Page Loading & Empty Section Protection**: Fixed manga page sections failing to load when AniList GraphQL API throttles or returns empty arrays. Added resilient fallbacks to MangaKatana scrapers across backend `/top/manga`, `/popular/manga`, `/top/manhwa`, `/top/one-shot`, and `/trending/manga` routes, and implemented `isEmptyData` cache protection to prevent caching empty responses.
- **Spotlight Cards Visual Cleanup**: Removed borders and drop-shadows across spotlight card components in `MangaSpotlight.tsx` for a clean presentation.

## [3.5.6] - 2026-07-26

### Added & Changed
- **Top Ten Anime List Episodes & Cache Invalidation**: Updated `/anime/home-fast` to populate Top Ten lists (Today, Week, Month) using AniList trending and seasonal lists with total episodes and latest episode data. Prioritized total episode count display in `TopTenSidebar.tsx` and bumped frontend cache keys (`yorumi_home_cache_v20` and `home-fast-data-v21`) to automatically purge stale Top Ten caches.
- **Dynamic AES-256-GCM Key Scraping for AllManga**: Updated the AllManga scraper (`backend/src/scraper/allmanga.ts`) and `yorumi-cli` (`v2.1.8`) to dynamically scrape encryption keys (`epoch`, `partB`, and SvelteKit JS chunks) from `mkissa.to` at runtime to derive the AES-256-GCM key (`aaKey`), preventing static key expiration.
- **ani-cli Flow Alignment**: Synchronized time-bucketed `aaReq` signature generation (using seconds-based timestamping and `epoch:queryHash:ts` SHA-256 nonces), switched API requests to `mkissa.net/api`, and updated headers to match `mkissa.to` Origin and Referer requirements.
- **Enhanced Payload Decryption**: Added robust fallback handling in `allmanga.ts` (`decryptTobeparsed` and `parseEpisodeSources`) to support both plaintext source payloads and AES-256-GCM encrypted `tobeparsed` responses.
- **Primary Player Server Migration**: Restored `AllManga` as the default visible streaming provider globally across the player and backend `auto` stream priority.
- **Anime Hover Tooltips & Metadata**: Improved home section anime cards to display comprehensive AniList metadata (airing status, release year, studio, format, episode count, and genre chips) without score percentages.
- **Title Routing & Search Scoring**: Enhanced AllManga title matching so base TV anime series outrank movies, OVAs, or specials.
- **Video Player Toggle Sliders**: Fixed broken toggle switch styling in video player settings (`Dub`, `Auto next`, `Auto Skip`) by replacing invalid `left-4.5` classes with `translate-x-4` so the knob smoothly slides to the right when toggled ON.
- **Sidebar & README Logo Polish**: Fixed broken sidebar logo image upon bundling in Electron/production builds by importing `yorumi-icon.png` from `src/assets/yorumi-icon.png` (matching the logo used in the README) so Vite bundles and resolves the asset cleanly across web and desktop builds. Reduced the README logo image width to 100px for a more balanced layout.

### Removed
- **Defunct Streaming Providers**: Removed offline or deprecated providers (`Animegg`, `Animenosub`, `Reanime`, `AniNeko`) from the player server picker and backend source defaults so users only encounter active, high-speed servers.
- **Embed Navigation Buttons**: Removed floating next/previous episode overlay buttons from embedded iframe players.
### Android player layout

- Made the anime player fill its dedicated mobile screen without rounded card corners or the separate episode footer.
- Moved server selection, settings, captions, and fullscreen into the persistent control deck below the video image.
- Moved lock, five-second seek, play/pause, and next-episode actions into a centered transport row over the video while keeping the lower deck focused on volume and display controls.
- Enlarged and split the lower mobile controls between left and right edges, and removed the redundant standalone server icon while retaining server selection in Settings.
- Made mobile controls start unlocked, auto-fade after five seconds, return on a screen tap, and collapse to a single left-side unlock action while locked; also corrected the episode-list header action size.
- Corrected locked/unlocked icon states, kept the lock action centered, and replaced the translucent episode bottom sheet with an opaque full-screen picker whose carousel is vertically centered.
- Prevented the persistent video portal from covering the mobile episode picker, and restored the locked padlock to its original left-side position.
- Made Android fullscreen request landscape orientation and restore portrait on exit, while changing the episode picker to a transparent blurred overlay with safe-area spacing below the system status bar.
- Routed Android fullscreen through the native immersive-mode bridge with forced landscape rotation, and portaled the episode picker to the document root so its cards cannot be covered by the persistent player.
- Hardened Android fullscreen by forcing a fixed landscape orientation, invoking native immersive and browser fullscreen paths together, and only changing the fullscreen state after at least one path succeeds.
- Portaled the complete Android player above the responsive desktop shell so landscape cannot activate the sidebar/content offset, and reapplied immersive system-bar hiding after orientation settles.
- Replaced unreliable WebView orientation fullscreen with a deterministic phone-player mode that rotates the player surface itself to `100vh × 100vw`, fills the physical display, and keeps 16:9 video contained without the desktop shell.
- Made the rotated movie-mode control deck fully transparent so no solid black controls strip covers the video.
- Made video-area taps toggle the complete mobile player chrome, including the header and server badge, while preserving the five-second auto-hide behavior.
- Changed the mobile player surface toggle from pointer-down handling to a normal touch-optimized click so controls hide with one quick tap instead of behaving like a long press.
- Removed the redundant Watch, Save, and Back action row from mobile anime details.
- Standardized Anime, Manga, and LN grid views as compact numbered tiles with five columns per row on phones.
- Hardened details-page back navigation: Anime now returns through valid app history with a Home fallback, matching Manga and LN section fallbacks, and desktop/mobile actions share the same handler.
- Pinned the mobile player lock control to a fixed left position so its location does not shift when switching between locked and unlocked states.
- Anchored mobile Play/Pause to the exact player center, with seek actions positioned symmetrically and Next independently pinned to the right edge.
- Matched the mobile Lock and Next Episode controls to the same icon and touch-target size.
- Vertically aligned the pinned Lock control to the same center line as seek, Play/Pause, and Next Episode.
- Removed green watched-state outlines from anime episode cards while retaining their subtle watched tint and green label.
# Search

- Added a mobile-only search page that searches Anime, Manga, and Light Novels together in separate swipeable rows while preserving the existing Electron/desktop search modal.
- Positioned the mobile search header below the Android status bar and kept the bottom navigation visible on the search page.
- Added a fallback manga catalog search and standardized all search results on the same 140px Anime, Manga, and LN cards used by the home pages.
- Added clean full-result grids for Anime, Manga, and LN search sections without Popular, layout-toggle, or overflow controls.
- Fixed Manga spotlight navigation to resolve and pass its readable chapter source, scraper ID, and hydrated chapter list.
- Shortened the mobile search prompt to `Search...` and reduced Anime Top Trending heading, tab, and entry-title typography on phones.
- Replaced the mobile player's CSS-based fake fullscreen rotation with native Android landscape immersive mode, preventing the controls from rotating inside a portrait window.
- Added an immediate forced-rotation fallback for fullscreen: Android landscape is still requested, but devices that ignore it now rotate the player instantly, while successful native rotation automatically disables the fallback.
- Removed the CSS fullscreen fallback and strengthened legitimate Android fullscreen with Activity-level sensor landscape plus modern and legacy immersive flags that hide the status and navigation bars.
- Restored reliable CSS-rotated mobile fullscreen with immersive system bars, disabled the in-app floating mini player on native mobile, and added Android system Picture-in-Picture when Home is pressed during active playback.
- Updated the mobile bottom navigation so only the current route is highlighted and its icon receives the filled active treatment, including Search.
- Replaced artificially filled Lucide mobile-nav icons with proper Material outline/filled icon pairs for clean active states.
- Restored the original outlined Lucide mobile-nav icons with no fill while retaining active-only tab highlighting.
- Removed bracketed section numbering from Anime, Manga, and Light Novel home sections while preserving their headings and dividers.
- Fixed Light Novel chapter-source identity by preserving exact scraper IDs from selected results and rejecting loosely matched NovelBin titles during fallback resolution.
- Simplified the native-mobile Library into a two-column poster grid with overlaid titles and episode/chapter counts, while preserving the richer desktop Library layout.
- Connected every mobile Library card to its canonical Anime, Manga, or LN details route with the correct media state payload for immediate, reliable detail loading.

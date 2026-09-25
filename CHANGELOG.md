# Changelog

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

## [Unreleased]

- Made Android release automation fall back to an installable debug-signed APK when repository signing secrets are absent, and standardized the published filename as `Yorumi v4.2.0.apk`.
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

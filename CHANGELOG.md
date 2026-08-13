# Changelog

## [4.0.9] - 2026-08-13

- **Discord Rich Presence (RPC) Integration ([main.js](file:///c:/Github%20Repos/Yorumi/dist-electron/main.js), [preload.mjs](file:///c:/Github%20Repos/Yorumi/dist-electron/preload.mjs), [electron.d.ts](file:///c:/Github%20Repos/Yorumi/src/types/electron.d.ts), [discordRPCService.ts](file:///c:/Github%20Repos/Yorumi/src/services/discordRPCService.ts))**:
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

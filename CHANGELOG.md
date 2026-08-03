# Changelog

## [4.0.0] - 2026-08-04

### Added & Changed
- **Light Novel (LN) Reading Hub & Reader**: Introduced a dedicated Light Novel feature slice (`src/features/ln`), complete with an LN Homepage (`/ln`), Spotlight hero, All-Time Popular list, Top 100 LN grid, Search filter, Bookmark management, Reading Progress synchronization, and a custom LN Reader (`/ln/read/...`) with customizable typography, theme controls, and chapter navigation.
- **AniDB Primary Anime Scraper Engine**: Switched the primary anime streaming source engine to **AniDB** (`anidb.app`), using multi-step scraping (`browse` $\rightarrow$ `episodes` $\rightarrow$ `languages` $\rightarrow$ `master.m3u8`).
- **Direct Multi-Quality & Dual-Audio Playback**: Enabled native HLS resolution switching (**1080p**, **720p**, **360p**) and Japanese Sub & English Dub audio track selection for AniDB streams via backend `.m3u8` and segment (`.xls`) proxying.
- **Streamlined Provider Options**: Configured `AniDB` as default primary provider, backed by `VidSrc`, `VidKing`, and `Videasy`.
- **Standalone Electron Executable (.exe)**: Embedded the Express backend scraper (`backend/dist/bundle.cjs`) directly into the Electron `.exe` build so desktop users run 100% self-contained out-of-the-box without needing any local or external server.
- **Website Redesign for v4.0.0**: Updated `website/src/App.tsx` description, version badges to `v4.0.0`, client `.exe` download links, "What's new" release highlights, and carousel preview slides for Light Novel browsing and reading (`lighnovel.png`, `read-lightnovel.png`).

### Fixed
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

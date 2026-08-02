# Changelog

## [3.5.7] - 2026-07-28

### Added & Changed
- **Minimal Website Landing Page, Separate Documentation Pages, & UI Polish**: Redesigned the hero section of `website/src/App.tsx` to adopt a clean, minimal aesthetic with the **v3.5.7** version indicator aligned to the base of the **Yorumi** heading (`items-baseline`), styled the **Get Started** button in Yorumi's signature blue theme (`bg-yorumi-main`). Abstracted the **Start Using** Hub and the 3-column **Developer Docs & Guides** component (`website/src/Documentation.tsx`) into their own dedicated, full-page views (`#get-started` and `#docs`) with URL hash-routing, ensuring users no longer just scroll down a massive single page. Removed faint borders across cards and fixed the "blacked-out" button contrast issue on Client download links by replacing solid dark backgrounds with beautiful, theme-aware translucent colors (`bg-yorumi-main/10`), ensuring perfect visibility in both light and dark modes. Also includes a placeholder for a new TMDB API Key picture tutorial!
- **Anikoto Provider Integration**: Ported the Anikoto scraper logic into the Yorumi backend, enabling a new stream source for anime. Registered `anikoto` in the video-sources API and frontend `useStreams.ts` to allow users to select it in the player.

### Fixed
- **TMDB ID Resolution for VidSrc, VidKing, & Videasy**: Fixed an issue where TMDB-based video sources failed to load when playing AniList anime due to raw AniList IDs being passed instead of valid TMDB IDs. Integrated automatic AniZip mapping (`api.ani.zip`) in `tmdb.service.ts` to map AniList IDs directly to TMDB IDs without requiring manual TMDB API keys. Fallback logic now gracefully skips missing TMDB IDs instead of generating broken iframe embeds.
- **AniNeko Scraper & Title Matching**: Fixed a critical bug in `backend/src/scraper/anineko.ts` where HTML entity encoding in search results (`&#039;`) caused apostrophe title mismatches and score drops to 0, returning null for titles like *Frieren: Beyond Journey's End*. Added Dean Edwards packer decoding (`unpackEval`) to extract `.m3u8` streams from obfuscated embed providers (`otakuhg`, `otakuvid`, `bibiemb`), and added direct subtitle VTT extraction from server link query parameters.
- **AniNeko Playback Stability**: Fixed a critical issue where AniNeko streams would load the `m3u8` playlist but fail to play (stuck at 0:00 with a black screen). Resolved by explicitly injecting `CODECS="avc1.640028,mp4a.40.2"` into the HLS manifest so Chrome accepts the High-profile H.264 video chunks, and patched a stream pipeline vulnerability in the backend proxy (`scraper.routes.ts`) where dropped upstream connections would hang indefinitely without closing the browser's response stream.
- **AllManga Backend Scraper Corruption**: Fixed two corrupted code regions in `backend/src/scraper/allmanga.ts` caused by bad merges — a duplicate `followRedirects` method with stale code fragments spliced in, and orphaned `fetchLatestUpdatesPage` body code that broke `getLinksForShowId`. The backend scraper now compiles and runs correctly, restoring stream resolution for AllManga sources.

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

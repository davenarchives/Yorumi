Yorumi **v5.0.7** upgrades the **Explore** feed to TikTok-smooth instant trailer playback with clean overlays and Main Character avatars, ships a **built-in global TMDB edge proxy** for crisp logos & backdrops out of the box, brings the **slide-over menu drawer** to Desktop, and polishes **Android download notifications** and mobile layout.

## New Features
- **Built-In Global TMDB Artwork Proxy**: High-resolution widescreen backdrops, official anime title logos, and crisp episode thumbnails now work out of the box across Desktop and Android via a 24-hour edge-cached Cloudflare Worker proxy — plus an optional **TMDB API Key** override card in Settings if you prefer your own key.
- **Desktop Menu Drawer & Slide-Over Sub-Drawer**: Replaced the desktop title bar notification bell with a hamburger menu button (preserving the unread dot) that opens the drawer, with `Updates`, `Download queue`, `History`, `Statistics`, `Data and storage`, `Settings`, and `About` sliding out in a matching side panel.
- **Main Character Avatars on Explore**: Explore feed profile circles now display the anime's Main Character portrait (framed to the face) across both Android and Desktop.

## Improvements
- **TikTok-Smooth Explore Feed**: Preloads the next trailer silently for zero-delay `0:00` playback on scroll, removes poster flashes and scroll-snap bounce, and automatically detects & skips region-blocked or broken trailers.
- **Clean Trailer Playback (Android & Desktop)**: Removed YouTube embed play/pause overlays and bezel animations inside `youtube-nocookie.com` embeds on both Android WebView and Tauri Desktop (Windows, macOS, Linux).
- **Consistent Explore Swipe-to-Details**: Swiping left on Explore renders the real Anime Details page smoothly even mid-drag and immediately pauses & mutes the background trailer once Details opens (resuming cleanly on Back).
- **Larger Mobile Spotlight Logos**: Improved logo sizing and unified caching on mobile Spotlight banners so official show logos look sharp and load without flickering.
- **Cleaner Mobile Layout**: Hid native scrollbars globally on mobile viewports and ensured Anime, Manga, and Light Novel details headers sit cleanly below the `Downloaded only` status banner.

## Fixes
- **Android Download Notification Navigation**: Fixed tapping `Show entry` or an active Anime, Manga, or Light Novel download notification failing to open the Download Queue — it now opens `/menu/download-queue` directly on the matching media tab for both warm and cold launches.

## Under the hood
- **Cloudflare TMDB Edge Worker**: Added `cloudflare/tmdb-proxy/` with CORS and 24-hour global edge caching, plus Metahub (`images.metahub.space`), AniZip, and HD YouTube fallbacks in `tmdbService.ts` and `episodeMetadataService.ts`.
- **Release Alignment**: Updated app, Tauri, Android (`versionCode 507`), website (`yorumi.cloud`), and CI/CD release workflows to `v5.0.7`.

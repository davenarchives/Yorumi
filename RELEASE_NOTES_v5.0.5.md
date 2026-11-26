Yorumi **v5.0.5** focuses on true **offline-first Library & History persistence**, a smooth **TikTok-style mobile menu drawer & Explore swipe-to-details**, **Android episode update push notifications**, and **rock-solid anime downloads** on both Desktop and Android.

## New Features
- **TikTok-Style Mobile Menu Drawer & Pages**: Added a smooth zero-bounce slide-over drawer (`Updates`, `Download queue`, `History`, `Statistics`, `Data and storage`, `Join us`, `Global chat`, `Settings`, `About`) with right-edge swipe-left to open, whole-screen + navbar push, and no re-animation when returning from subpages.
- **Downloaded Only & Incognito Mode**: Added persistent `Downloaded only` (with a sticky top status bar and automatic Library filtering) and `Incognito mode` (pausing anime, manga, LN, and search history writes).
- **Android Episode Update Push Notifications**: Added a native Android `"Episode updates"` notification channel that alerts you when airing watchlist anime release new episodes and deep-links straight to the anime details page.
- **Explore Swipe-Left to Real Details**: Swiping left on any Explore trailer now smoothly reveals the real `AnimeDetailsPage` preloaded with metadata (loading episodes once snapped open) and returns to your exact Explore session on Back.
- **Tabbed Download Queue & Date-Grouped History**: Upgraded Download Queue with `Anime | Manga | LN` tabs showing full series title, episode/chapter label, progress, and cancel controls, plus a date-grouped vertical History view (`Today`, `Yesterday`, `M/D/YY`).

## Improvements
- **Full Offline Library Persistence (Desktop & Android)**: Library now prefetches posters across **all three tabs** (`Anime`, `Manga`, `Light Novel`) and background-caches full Manga & Light Novel metadata (synopsis, genres, authors, banner, cover) and chapter lists locally so your entire Library works offline.
- **Durable Offline History (IndexedDB Mirror)**: Mirrored watch, read, light novel, activity, and search history into IndexedDB (`yorumi_offline_history_v1`), raised history retention from 20 to **200 entries**, and cached history posters locally with clean offline fallbacks.
- **60fps Mobile Navigation & Pull-to-Refresh**: Reduced active mobile Explore YouTube iframes from 4 to 1, wrapped mobile tab switches in `startTransition`, disabled desktop-only backdrop re-renders on mobile, and locked the bottom navbar static during pull-to-refresh.
- **Mobile Website Polish**: Left-aligned the landing page on mobile, placed hero `Download Free` + `Android APK` buttons in a single row, and eliminated horizontal jitter on the live download counter.

## Fixes
- **Android & Desktop Anime Downloads**: Fixed MAL-keyed anime downloads failing by passing `malId` and `altTitles` to stream resolution, deduplicated local scraper queries, added `403`/`401` header fallback (`Referer+Origin` → `Referer` → no headers) and a `720p` mobile stream cap in `NativeDownloadStoragePlugin`, and wired real native download cancellation.
- **Offline Manga & LN Posters & Details**: Fixed CORS/hotlink-blocked MangaKatana and NovelFire posters failing to cache on Tauri Desktop by sending inferred `Referer` headers through `yorumi-media`, and wired `ReadingDetailsHero` to render cached offline posters and backdrops.
- **Drawer & Subpage Alignment**: Fixed `/menu/*` pages shifting left after drawer navigation, removed unnecessary bounce on drawer open/pull-to-refresh, and cleaned up About page icons and layout.

## Under the hood
- **Offline Stores**: Added `src/services/offlineHistoryStore.ts` (IndexedDB backup + boot hydration) and extended `src/services/offlineLibraryCache.ts` with full Manga, LN, and Anime metadata caching.
- **Batch Downloads & Cleanup**: Renamed `MihonDownloadMenu` to `BatchDownloadMenu`, fixed ESLint diagnostics in `LibraryPage.tsx`, and aligned `v5.0.5` CI/CD release workflows.

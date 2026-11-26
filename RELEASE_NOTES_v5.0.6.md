Yorumi **v5.0.6** upgrades the **Manga Reader** with Mihon-style seamless multi-chapter scrolling, **60fps interactive paged swiping**, **reading mode settings**, **reliable read-state tracking**, and **offline download isolation**.

## New Features
- **Seamless Multi-Chapter Manga Reader**: Long-strip mode now streams chapters continuously back-to-back with Mihon-style `Finished / Next` transition banners — scroll forward into the next chapter or freely scroll back up to previous chapters without reloads or scroll jumps.
- **Manga Reading Settings & 6 Reading Modes**: Added a top-right Settings button in the manga reader opening a Reading Settings sheet with `Default`, `Paged (left to right)`, `Paged (right to left)`, `Paged (vertical)`, `Long strip`, and `Long strip with gaps` (persisted across sessions), plus mobile zoom controls.
- **60fps Interactive Paged Swiping**: Upgraded all Paged modes (`LTR`, `RTL`, and `Vertical`) to a native CSS scroll-snap pager so you can drag pages freely with your finger and watch adjacent pages slide in real time, alongside tap-zone smooth scrolling and a final `Finished / Next` transition slide.
- **Dynamic Bottom Page Indicator**: Added a Mihon-style outlined `current / total` page indicator centered at the bottom of the screen that stays visible while reading and hides automatically when the reader bars open.

## Improvements
- **Faster Chapter Loading & Preloading**: Chapters now warm immediately on tap before the reader mounts, backed by a 4-worker rolling page preloader and background next-chapter prefetching.
- **Crisp Download Icons on Read Chapters**: Dimming for read Manga and Light Novel chapters now applies only to the title and date so download/downloaded icons stay crisp white.
- **Website SEO & Clean Routes (`yorumi.cloud`)**: Added real routes (`/download`, `/docs`, `/changelogs`), `sitemap.xml`, `robots.txt`, and `SoftwareApplication` structured data.

## Fixes
- **Reliable Manga Read State**: Fixed chapters sometimes failing to mark as read due to a mount race condition when opening a chapter from details, ID mismatches (`mal_id` vs `id` vs `scraper_id`), and stale/offline details state.
- **Cross-Series Offline Download Collision**: Fixed downloaded chapters from one manga or light novel accidentally matching another series with the same relative chapter ID (such as `c1`), and eliminated multi-second blob-URL stalls when opening undownloaded chapters.

## Under the hood
- **Unified Chapter History Keys**: Extended `storage.markChapterAsRead` and `storage.getReadChapters` to support multi-key lookups and writes across `mal_id`, `id`, `scraper_id`, and normalized slugs.
- **Release Alignment**: Updated app, Tauri, Android (`versionCode 506`), website, and CI/CD release workflows to `v5.0.6`.

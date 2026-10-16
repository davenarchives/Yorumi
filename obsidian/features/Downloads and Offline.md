---
type: feature-map
status: maintained
last_verified: 2026-10-16
source_paths:
  - src/services/downloadService.ts
  - src/services/offlineImageCache.ts
  - src/platform/localMediaProxy.ts
  - src/platform/downloadNotification.ts
  - src/platform/nativeDownloadStorage.ts
  - src/types/electron.d.ts
  - android/app/src/main/java
---

# Downloads and Offline

## Anime Downloads

- IndexedDB database: `yorumi_downloads_v1`.
- Electron can write media to filesystem paths through `window.electronAPI`.
- Browser downloads store blobs and metadata in IndexedDB. Android streams media to app-owned files and keeps only lightweight metadata in IndexedDB.
- HLS downloads rewrite manifests and segments, support byte ranges, preserve duration, cache artwork, and retain one English subtitle track. Android records each source HLS segment's exact duration, byte offset, and byte size while assembling the final file; offline manifests must use those original boundaries rather than arbitrary fixed-size chunks.
- Anime, Manga, and Light Novel rows use Mihon's exact Apache-2.0 Material Symbol paths and state treatment: `DownloadCircle` when available, `DownloadArrow` with a wavy circular progress ring while queued/downloading, and filled `CheckCircle` when downloaded.
- Queued/downloading indicators remain neutral rather than inheriting Anime, Manga, or Light Novel accent colors. Page accents are reserved for active view controls: blue for Anime, purple for Manga, and yellow for Light Novels.
- Android Anime downloads run with a native foreground progress notification that reports percentages. Its Pause/Resume action controls native HLS segment reads or direct-stream reads; Show entry returns to Yorumi.
- Native HLS downloads unwrap Yorumi's localhost playback URLs and fetch upstream media directly with the embedded referer/origin context. A rolling queue writes segments to bounded disk staging, retries failures, emits byte-level progress, and assembles the final file in playlist order without a slow segment idling the other workers.
- Android honors an explicit source quality when present and otherwise caps adaptive HLS downloads at 720p. Do not automatically choose the highest-bandwidth master-playlist rendition: mobile download size and completion time are product constraints, not merely playback quality concerns.
- Android writes to a `.tmp` file, verifies that it is non-empty, and only then promotes it to the final download. Offline video is served through the loopback proxy with byte-range support.
- Android HLS records without exact segment metadata use the incompatible v4.3.0 format and are removed from IndexedDB and native storage on discovery so they cannot remain falsely marked as playable; the episode must be downloaded again.

## Manga and Novel Downloads

- Each content type has its own download service and progress behavior.
- Manga persists page blobs and recreates usable blob URLs when reading.
- Android Manga pages and Light Novel chapter files are streamed/written to the app-owned download tree; their IndexedDB records retain native paths for offline loading and deletion.
- Native protected pages/media use the on-device local proxy.
- Bulk operations stay concurrency-bounded.

## Offline Images

`offlineImageCache` uses browser storage facilities such as CacheStorage/IndexedDB so covers and banners survive network loss.

## Correctness Rules

- Download identity includes canonical content and season where applicable.
- Do not match later seasons by repeated local episode number.
- Treat partial files and false HTTP successes as failures.
- Preserve valid HLS loader statistics and byte-range semantics.
- Keep offline byte ranges aligned to the original HLS fragments; splitting concatenated transport streams into arbitrary byte sizes can freeze playback at the first artificial boundary.
- Clean abandoned desktop staging files safely on startup.

See [[platforms/Electron]], [[platforms/Android and Mobile]], and [[data/Storage Caches and Persistence]].

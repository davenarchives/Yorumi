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
  - src/platform/tauri/readingExports.ts
  - src-tauri/src/commands/reading_export.rs
  - android/app/src/main/java
---

# Downloads and Offline

## Anime Downloads

- IndexedDB database: `yorumi_downloads_v1`.
- Tauri downloads anime through Rust commands and records local files in SQLite.
- Browser downloads store blobs and metadata in IndexedDB. Android streams media to app-owned files and keeps only lightweight metadata in IndexedDB.
- HLS downloads preserve duration, cache artwork, and retain one English subtitle track as durable WebVTT data. A download with advertised English captions is not marked complete if those captions cannot be persisted.
- Anime, Manga, and Light Novel rows use Mihon's exact Apache-2.0 Material Symbol paths and state treatment: `DownloadCircle` when available, `DownloadArrow` with a wavy circular progress ring while queued/downloading, and filled `CheckCircle` when downloaded.
- Queued/downloading indicators remain neutral rather than inheriting Anime, Manga, or Light Novel accent colors. Page accents are reserved for active view controls: blue for Anime, purple for Manga, and yellow for Light Novels.
- Android Anime downloads run with a native foreground progress notification that reports percentages. Its Pause/Resume action controls native HLS segment reads or direct-stream reads; Show entry returns to Yorumi.
- Native HLS downloads unwrap Yorumi's localhost playback URLs and fetch upstream media directly with the embedded referer/origin context. A bounded parallel prefetch window writes segments to disk staging, retries failures, supports AES-128 HLS keys, emits byte-level progress, assembles in playlist order, and deletes each staged segment after assembly. Android then transmuxes the transport stream to one MP4 file before promoting the download. The native layer estimates the selected rendition's size and rejects downloads that cannot fit the final file plus a small staging buffer.
- Android honors an explicit source quality when present and otherwise caps adaptive HLS downloads at 720p. Do not automatically choose the highest-bandwidth master-playlist rendition: mobile download size and completion time are product constraints, not merely playback quality concerns.
- Android writes to temporary transport and MP4 files, verifies that the muxed MP4 is non-empty, and only then promotes it to the final download. Offline video is served through the loopback proxy with byte-range support.
- Android HLS records from the incompatible segmented format are removed from metadata and native storage on discovery so they cannot remain falsely marked as playable; the episode must be downloaded again.

## Desktop Finalization

- Tauri owns desktop download paths and native download commands.
- HLS is downloaded and finalized into one MP4. A `.ts` fallback is never accepted as a completed download.
- The selected player provider is persisted locally and is the first provider used by episode downloads; normal provider failover remains available.

## Manga and Novel Downloads

- Each content type has its own download service and progress behavior.
- Manga persists page blobs and recreates usable blob URLs when reading.
- Android Manga pages and Light Novel chapter files are streamed/written to the app-owned download tree; their IndexedDB records retain native paths for offline loading and deletion.
- Tauri exports manga pages and novel chapter HTML to `Downloads/Yorumi/Manga` and `Downloads/Yorumi/LightNovels`, while IndexedDB remains the offline reader store. Previously stored chapters are exported when their download list loads; deletion removes the matching export.
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

See [[platforms/Android and Mobile]], and [[data/Storage Caches and Persistence]].

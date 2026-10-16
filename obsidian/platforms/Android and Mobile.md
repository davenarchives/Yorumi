---
type: platform-map
status: maintained
last_verified: 2026-10-16
source_paths:
  - ANDROID.md
  - capacitor.config.ts
  - android
  - src/platform
  - src/platform/sources
---

# Android and Mobile

## Runtime Model

Android packages the shared React frontend with Capacitor. Supported content operations run through local TypeScript adapters and native HTTP, so end users do not need the Yorumi backend running.

## Local Support

- AniList Anime: search/details/episodes.
- HiAnime: search/details/episodes/streams.
- AllManga: native latest/recent anime feeds.
- AniList Manga: search/details.
- MangaKatana: search/details/chapters/pages.
- NovelBin: search/details/chapters/content.

The generic registry currently contains MangaKatana and NovelBin; anime-specific adapters are called by their feature services.

## Native Bridge

- `nativeHttp.ts` uses Capacitor HTTP for requests blocked in a WebView.
- `localMediaProxy.ts` bridges to `LocalMediaProxyPlugin` for protected and offline media.
- `nativeDownloadStorage.ts` bridges to `NativeDownloadStoragePlugin`, which streams Anime and Manga files into app-owned storage and writes Light Novel chapter files without routing large payloads through WebView IndexedDB.
- Native Anime HLS downloads return exact per-segment byte ranges and durations to IndexedDB. Offline playback reconstructs a local VOD playlist from those boundaries and reads each range through `LocalMediaProxyPlugin`.
- `ImmersiveModePlugin` controls fullscreen system UI behavior.
- `MainActivity` registers custom plugins.

## Build and Wireless Test

1. Enable Developer options, Wireless debugging, and pair ADB: `adb pair PHONE_IP:PAIR_PORT`.
2. Connect: `adb connect PHONE_IP:DEBUG_PORT`.
3. Build: `npm run android:build:debug`.
4. Install: `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`.
5. Inspect logs with `adb logcat` or Chrome `chrome://inspect` for the WebView.

For live Vite testing, run `npm run dev:mobile` and set `CAPACITOR_SERVER_URL` to the development machine's LAN URL before syncing.

## Guardrails

- Hash routing and Android back behavior must remain intact.
- Test local adapters independently from the backend.
- Java 21 is required by the Android build.
- Android is the current mobile release target; iOS is not part of v4.2.0.

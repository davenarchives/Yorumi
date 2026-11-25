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

The Tauri migration has an initialized Android project in `src-tauri/gen/android`.

### Live Development & Instant HMR (No Rebuilding Debug APK)
- Run `npm run dev:tauri:android` to launch the app on a connected device/emulator in development mode.
- Any UI or React code change in `src/` triggers instant Vite Hot Module Replacement (HMR) directly inside the running Android WebView over WebSocket without rebuilding or reinstalling the APK.
- `scripts/setup-android-reverse.cjs` runs automatically on startup to configure `adb reverse` port forwarding for ports `5173` (Vite dev server), `5174` (HMR WebSocket), and `3001` (Backend API), eliminating Windows Firewall hurdles.
- For USB or offline ADB development without relying on local Wi-Fi, run `npm run dev:tauri:android:reverse` (`tauri android dev --host localhost`).
- Use `npm run build:tauri:android:debug` only when compiling a standalone debug APK with bundled offline assets.

Tauri Android uses dark system bars and the mobile shell without the desktop title bar. Its external font loads without blocking the first render. Tauri mobile resolves its database and anime download directories through the app data directory rather than a desktop home directory. Its Rust HTTP client uses Rustls so Android cross-compilation does not depend on a separate OpenSSL installation.

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
- Native Anime HLS downloads resolve the chosen rendition, decrypt AES-128 segments when required, and transmux the completed transport stream into one MP4. Offline playback reads that MP4 through `LocalMediaProxyPlugin` with byte-range support.
- HLS segments download through a bounded parallel prefetch window, are appended to the final temporary file in playlist order, and are removed from staging immediately after assembly. A rendition-based free-space preflight avoids beginning episodes that cannot fit locally.
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

- Android system Back uses React Router history on both Tauri and Capacitor; direct entries fall back to the relevant section, and anime playback closes first. Detail-page back buttons also return to the preceding route when available.

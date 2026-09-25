# Yorumi Android

Yorumi's Android target uses Capacitor to package the existing React/Vite UI. It
is intentionally isolated from Electron: the desktop build still starts and
packages `backend/dist/bundle.cjs`, while Android will call local source adapters
inside the application.

## Current status

- The native `android/` project is generated and contains the compiled UI.
- Packaged mobile navigation uses hash routing.
- Desktop-only controls are excluded on Android/iOS.
- The local source registry and adapter contract live in
  `src/platform/sources/`.
- Existing content services still use the Express API until their providers are
  migrated.

### Local provider support

| Provider | Search | Details | Episodes / Chapters | Streams / Pages |
| --- | --- | --- | --- | --- |
| MangaKatana | Local | Local | Local | Local |
| AniList Manga | Local | Local | N/A | N/A |
| AniList Anime | Local | Local | Local | N/A |
| HiAnime | Local | Local | Local | Local |
| NovelBin | Local | Local | Local | Local |

MangaKatana, NovelBin, HiAnime, and AniList run through Android's native HTTP stack and local media proxy in the packaged application. They do not require Express, Puppeteer, or the Yorumi desktop backend to search, browse, read, or stream media on mobile.

## Commands

```powershell
npm run android:sync
npm run android:open
npm run android:build:debug
```

The debug APK is emitted under `android/app/build/outputs/apk/debug/`.

Building the APK requires Android Studio (or the Android command-line SDK) and
JDK 21 with `JAVA_HOME` configured. `android:sync` can run without those tools,
but Gradle cannot compile the native project until Java is available.

## Local source migration

Each provider should be moved in a vertical slice:

1. Extract its request and parsing code from `backend/src/scraper/` into a
   platform-neutral adapter implementing `LocalSourceAdapter`.
2. Replace Node-only APIs with `fetch`, a Capacitor native HTTP plugin, or a
   small custom Android plugin when headers/cookies require native networking.
3. Replace Express endpoint calls in the matching frontend service with the
   adapter on Android while retaining the existing API call on Electron/web.
4. Store metadata and content caches locally; never embed provider secrets.
5. Validate search, details, content, failure fallback, and cache invalidation
   on a physical Android device.

Recommended order:

1. Manga search/details/pages
2. Novel search/details/chapters
3. Anime metadata/search
4. Direct-stream anime providers
5. Native media proxy, downloads, and background work

Puppeteer and `@sparticuz/chromium` are not included in Android. Any source that
depends on browser automation must be rewritten around native HTTP/WebView
interception or excluded from the mobile source list.

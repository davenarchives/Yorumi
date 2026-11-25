---
type: architecture
status: maintained
last_verified: 2026-10-16
source_paths:
  - src/platform/runtime.ts
  - src/config/api.ts
  - src/app/AppProviders.tsx
  - capacitor.config.ts
---

# Runtime Platforms

| Runtime | Router | API shape | Media/files |
| --- | --- | --- | --- |
| Web | `BrowserRouter` | same-origin `/api` or configured API | browser storage and network |
| Tauri | `HashRouter` | Native Rust IPC commands (`invoke`) and some remaining backend API calls | zero-port `yorumi-media://` protocol, SQLite database, native HLS downloader |
| Android/iOS | `HashRouter` | local adapters first; configured API for remaining paths | Capacitor HTTP and local media proxy |

Tauri media URLs use an HTTP localhost origin on Windows and Android and the custom scheme on other platforms; rewritten HLS playlists preserve the originating scheme.

## Detection

`src/platform/runtime.ts` combines Capacitor native detection, Tauri window detection (`isTauri()`), and desktop detection (`isNativeDesktop()`). Do not duplicate runtime checks throughout features; reuse platform helpers.

## Desktop Window & Title Bar

Tauri runs in frameless mode (`decorations: false`), using a custom Discord-style title bar (`DesktopTitleBar`) with draggable region (`data-tauri-drag-region`), back/forward navigation arrows, active view context pill, and custom minimize, maximize/restore, and close buttons powered by `@tauri-apps/api/window`. The title bar is also present on the initial TMDB setup screen.

The TMDB setup links open in the system browser through Tauri's opener plugin, with the allowed destinations scoped in `src-tauri/capabilities/default.json`.

## API Selection

`src/config/api.ts` computes `API_BASE` and exposes whether local sources are active. Desktop/localhost defaults target `http://localhost:3001/api`; native may use an explicit server only for features not migrated to local adapters.

## Cross-Platform Expectations

- A web/backend fix may not affect native mobile because mobile can bypass Express.
- Shared UI bugs can appear on every runtime, but responsive layouts and input/back behavior differ.
- Route links must work under both browser history and hash routing.

Tauri frontend services call Rust commands directly; desktop Discord presence uses Discord IPC and reading exports use the user Downloads directory. See [[platforms/Android and Mobile]].


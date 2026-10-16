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
| Electron | `HashRouter` | local backend on port 3001 | IPC, filesystem downloads, HLS proxy |
| Android/iOS | `HashRouter` | local adapters first; configured API for remaining paths | Capacitor HTTP and local media proxy |

## Detection

`src/platform/runtime.ts` combines Capacitor native detection with Electron protocol/API detection. Do not duplicate runtime checks throughout features; reuse platform helpers.

## API Selection

`src/config/api.ts` computes `API_BASE` and exposes whether local sources are active. Desktop/localhost defaults target `http://localhost:3001/api`; native may use an explicit server only for features not migrated to local adapters.

## Cross-Platform Expectations

- A web/backend fix may not affect native mobile because mobile can bypass Express.
- A local-adapter fix may not affect Electron because Electron normally uses its bundled backend.
- Shared UI bugs can appear on every runtime, but responsive layouts and input/back behavior differ.
- Route links must work under both browser history and hash routing.

See [[platforms/Electron]] and [[platforms/Android and Mobile]].


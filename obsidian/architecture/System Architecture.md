---
type: architecture
status: maintained
last_verified: 2026-10-16
source_paths:
  - src/main.tsx
  - src/App.tsx
  - src/app/AppProviders.tsx
  - backend/src/app.ts
  - scripts/build-electron.cjs
  - capacitor.config.ts
---

# System Architecture

## Runtime Topology

```text
Shared React UI
├─ Browser ─────── remote/same-origin Express API
├─ Electron ────── bundled local Express API + Electron IPC/filesystem
└─ Android ─────── Capacitor native HTTP + local source adapters/proxy

Express API
├─ AniList/TMDB/AniBridge enrichment
├─ Anime/Manga/Novel source orchestration
├─ media and image proxying
├─ mapping/cache services
└─ Yumi/import/profile support
```

## Shared Frontend

- `src/main.tsx` bootstraps React and clears stale stream state.
- `src/app/AppProviders.tsx` installs routing and global providers.
- `src/app/App.tsx` owns application shell behavior, persistent player, connectivity, updates, and native back handling.
- `src/app/AppRoutes.tsx` defines product routes.
- `src/platform/runtime.ts` chooses web, Electron, Android, or iOS behavior.

## Boundary Rules

- UI components should consume services/hooks rather than call provider endpoints directly.
- External I/O belongs in `src/services` or backend infrastructure/scraper layers.
- Pure identity and transformation logic belongs in `src/utils`.
- Native mobile paths must remain standalone for supported sources.
- Generated outputs under `dist*` and `backend/dist` are never hand-edited.

## Related Maps

- [[architecture/Runtime Platforms]]
- [[architecture/Frontend Map]]
- [[architecture/Backend API Map]]
- [[architecture/Content Identity and Mapping]]

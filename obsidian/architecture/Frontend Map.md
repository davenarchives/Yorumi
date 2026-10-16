---
type: architecture
status: maintained
last_verified: 2026-10-16
source_paths:
  - src/app
  - src/context
  - src/features
  - src/hooks
  - src/services
  - src/utils
---

# Frontend Map

## Layers

| Area | Responsibility |
| --- | --- |
| `src/app` | boot shell, providers, routing |
| `src/pages` | route-level composition |
| `src/features` | feature UI and feature-local logic |
| `src/components` | shared presentation/layout/player pieces |
| `src/context` | long-lived cross-route state such as Anime and player |
| `src/hooks` | reusable stateful behavior |
| `src/services` | API/provider/native I/O |
| `src/platform` | runtime and native bridges |
| `src/utils` | pure transforms, identity, storage helpers |
| `src/types` | shared contracts and Electron globals |

## Global State

- `AnimeContext` orchestrates anime discovery/details, episodes, watched progress, and important caches.
- `PersistentPlayerContext` keeps playback alive across navigation.
- Auth and title-language providers control local identity and preferred title display.

## High-Risk Frontend Flows

- Anime details joins canonical route identity, season chains, TMDB metadata, mapping segments, provider episodes, and playback numbering.
- Offline content spans UI, storage, IndexedDB/CacheStorage, native proxying, and Electron filesystem APIs.
- Native routing/back handling is centralized; avoid component-specific platform hacks when a shared helper exists.

## Navigation

See [[reference/Routes and Endpoints]] for route families and [[architecture/Content Identity and Mapping]] before changing content URLs or cache keys.


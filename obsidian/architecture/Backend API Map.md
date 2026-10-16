---
type: architecture
status: maintained
last_verified: 2026-10-16
source_paths:
  - backend/src/app.ts
  - backend/src/index.ts
  - backend/src/routes
  - backend/src/api
  - backend/src/scraper
---

# Backend API Map

## Boot

- `backend/src/index.ts` starts the service and warmers.
- `backend/src/app.ts` configures CORS/JSON, mounts `/api`, exposes `/avatars`, and installs error handling.
- Production output is `backend/dist/bundle.cjs`; never edit it directly.

## Route Families

| Prefix | Purpose |
| --- | --- |
| `/api/anilist` | discovery, details, rankings, schedules, chains, manga metadata |
| `/api/anime` | normalized metadata, episodes, streams, mappings, discovery |
| `/api/scraper` | provider search/details/streams, proxies, prefetch, cache reset |
| `/api/manga` | search, details, chapters, pages, home feeds |
| `/api/ln` | novel search, resolve, details, reading |
| `/api/chat` | Yumi requests |
| `/api/import` | external library import |
| `/api/user` | user-related API behavior |
| `/api/mapping` | provider mapping identification and persistence |
| `/api/logo`, `/api/image`, `/api/avatars` | media support |

## Provider Orchestration

- Scraper implementations live under `backend/src/scraper`.
- `scraper.service.ts` coordinates fallbacks and should retain resilient error handling.
- Video-source orchestration lives under `backend/src/api/anime`.
- Cache, browser, TMDB, mapping, and persistence infrastructure lives under `backend/src/infrastructure` and `backend/src/core`.

## Change Rules

- Preserve public response contracts unless the task explicitly changes them.
- Keep provider-specific parsing isolated.
- Preserve fallbacks and diagnostics when one source fails.
- Build with `npm run build --prefix backend` after backend modifications.


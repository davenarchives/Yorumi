---
type: reference
status: maintained
last_verified: 2026-10-16
source_paths:
  - src/app/AppRoutes.tsx
  - backend/src/routes
---

# Routes and Endpoints

## Frontend Route Families

- `/` — home.
- `/popular`, `/movies`, `/tv`, `/ova`, `/ona`, `/specials` — anime discovery.
- `/anime/details/:id` — canonical anime details.
- `/genre/:name` — genre discovery.
- `/manga`, `/manga/details/:id`, manga genre/format routes, and manga reader routes.
- `/ln`, light-novel details, and reader routes.
- `/search` and typed search routes.
- `/library`, continue, favorites, watch-list, and read-list routes.
- `/profile`, `/users`, `/user/:id`, and `/yumi`.

Exact route patterns are defined in `src/app/AppRoutes.tsx`; use route helpers rather than constructing content URLs ad hoc.

## Backend Prefixes

- `/api/anilist`: anime/manga discovery, details, rankings, schedules, relations.
- `/api/anime`: normalized metadata, episodes, streams, mappings.
- `/api/scraper`: provider search, episodes, playable streams, proxying, prefetch, cache reset.
- `/api/manga`: manga discovery, details, chapters, pages.
- `/api/ln`: novel search, resolution, details, reading.
- `/api/chat`: Yumi.
- `/api/import`: library import.
- `/api/user`: user behavior.
- `/api/mapping`: mapping CRUD/identification.
- `/api/logo`, `/api/image`, `/api/avatars`: media support.

## Contract Rule

Frontend and backend routes are public internal contracts. Do not rename paths, parameters, response fields, or IPC channels silently.


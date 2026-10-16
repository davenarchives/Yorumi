---
type: feature-map
status: maintained
last_verified: 2026-10-16
source_paths:
  - src/services/lnService.ts
  - src/platform/sources/novelbin.ts
  - src/features
  - src/pages
  - backend/src/routes
  - backend/src/scraper/novel.ts
---

# Light Novels

## Architecture

- Catalog/curated metadata identifies the title.
- NovelBin provides searchable reading details, chapter lists, and chapter content.
- Browser/Electron use `/api/ln`; native mobile registers NovelBin locally as `novelbin` with kind `novel`.

## Flow

```text
catalog/search identity
→ provider resolve
→ edition compatibility check
→ chapter list
→ chapter content or offline copy
→ reading progress
```

## Guardrails

- Do not merge an explicit web-novel edition into a light-novel identity or vice versa.
- Keep provider IDs/slugs stable across details and reader navigation.
- Reader back/title navigation should return to the canonical novel details route.
- Bulk downloads must remain concurrency-bounded to avoid source throttling.
- NovelBin requests are start-rate-limited in both backend and native HTTP paths; never hold the scheduler lock while waiting for a network response or retry backoff.
- NovelBin details fetch metadata and the full chapter index concurrently, then fall back to inline chapters when the index endpoint fails.

See [[architecture/Content Identity and Mapping]] and [[features/Downloads and Offline]].

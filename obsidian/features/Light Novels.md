---
type: feature-map
status: maintained
last_verified: 2026-11-12
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

- The novel home uses the anime-style full-height reading spotlight and section headers with landscape cards matching the anime card presentation and chapter badges for titles not marked finished. The spotlight displays a three-cover carousel on desktop, full-screen banner or cover artwork blurred to match its details page on desktop and mobile, yellow controls, a shared rating and metadata row, and a four-line synopsis.

- Catalog/curated metadata identifies the title.
- NovelBin provides searchable reading details, chapter lists, and chapter content.
- Browser/Electron use `/api/ln`; native mobile registers NovelBin locally as `novelbin` with kind `novel`.

## Flow

- The details page uses the shared anime-style reading hero with a softly blurred full-screen banner or cover backdrop and keeps provider-specific chapter lists, read actions, and downloads. A single More like this row shows format-matched AniList recommendations when the title is identified.

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
- Reader back/title navigation should return to the canonical novel details route; desktop reader overlays begin below the title bar.
- Bulk downloads must remain concurrency-bounded to avoid source throttling.
- NovelBin requests are start-rate-limited across backend, mobile, and Tauri HTTP paths for `/search` and HTML pages, while `/ajax/chapter-list?slug=...` is probed directly from candidate title slugs before falling back to search (with AllNovelFull fallback when NovelBin has no match; its current search layout is parsed alongside the legacy layout).
- NovelBin details reuse cached or `chaptersOnly` AJAX chapter lists when rich metadata is already available from AniList or curated lists, and offline caches reject empty chapter payloads.

See [[architecture/Content Identity and Mapping]] and [[features/Downloads and Offline]].

---
type: feature-map
status: maintained
last_verified: 2026-10-16
source_paths:
  - src/services/mangaService.ts
  - src/platform/sources/mangakatana.ts
  - src/platform/sources/anilistManga.ts
  - src/features/manga
  - src/pages
  - backend/src/routes
---

# Manga

## Architecture

- AniList supplies catalog/discovery metadata.
- MangaKatana supplies readable details, chapters, and pages.
- Browser/Electron normally use `/api/manga`; native mobile can use local source adapters.
- Reader state, reading history, downloads, and offline page blobs are separate concerns.

## Flow

```text
catalog/search result
→ canonical manga identity
→ readable-provider resolution
→ chapter list
→ page fetch or downloaded pages
→ progress/history update
```

## Native Sources

- The local source registry exposes MangaKatana as `mangakatana` with kind `manga`.
- `anilistManga.ts` supports native AniList discovery/details.
- Native protected images may require `src/platform/localMediaProxy.ts`.

## Guardrails

- Do not mark metadata-only titles readable without a valid provider match.
- Preserve chapter identifiers; display numbers alone may collide.
- Recreate blob URLs when opening persisted downloaded pages.
- Vault navigation and vault-specific storage are intentionally separate from normal manga state.

See [[features/Downloads and Offline]] and [[data/Storage Caches and Persistence]].

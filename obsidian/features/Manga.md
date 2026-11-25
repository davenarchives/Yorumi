---
type: feature-map
status: maintained
last_verified: 2026-11-12
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

- The manga spotlight displays the high-resolution widescreen background cover banner matching desktop presentation.
- The manga home uses the anime-style full-height reading spotlight and section headers with landscape cards matching the anime card presentation and chapter badges for titles not marked finished. The spotlight displays a three-cover carousel on desktop, softly blurred full-screen banner or cover artwork, purple controls, a rating, and a synopsis limited to four lines. For unrated MangaKatana entries, the active spotlight looks up an exact title match on AniList; the shared anime metadata row shows the score when available and a format chip.

- AniList supplies catalog/discovery metadata. Spotlight and details show one primary story author, with a source-credit fallback when roles are unavailable.
- MangaKatana supplies readable details, chapters, and pages. Search paces `/?search=` queries (`book_name`), handles direct detail redirects by caching the full details/chapters and `.alt_name` aliases from the redirected HTML, and starts chapter resolution in parallel with AniList details when seed titles are available. Home carousels use AniList metadata directly instead of background-scraping MangaKatana on mount.
- Browser/Electron normally use `/api/manga`; native mobile and Tauri use local source adapters. When MangaKatana fails, local details can match a title to available English MangaDex chapters; the UI notes that this list may be incomplete.
- Reader state, reading history, downloads, and offline page blobs are separate concerns. Desktop reader overlays begin below the title bar; Tauri fetches MangaKatana page images through its local media proxy with the chapter referer and does not cache empty chapter responses.

## Flow

- The details page uses the shared anime-style reading hero with a softly blurred full-screen banner or cover backdrop and keeps provider-specific chapter lists, read actions, and downloads. A single More like this row shows format-matched AniList recommendations when the title is identified.

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

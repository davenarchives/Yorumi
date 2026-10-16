---
type: architecture
status: maintained
last_verified: 2026-10-16
source_paths:
  - docs/CONTENT_ARCHITECTURE_AUDIT.md
  - src/utils/contentIdentity.ts
  - src/utils/animeNavigation.ts
  - src/services/animeMappingService.ts
  - backend/src
  - tests
---

# Content Identity and Mapping

The detailed audit in `docs/CONTENT_ARCHITECTURE_AUDIT.md` is authoritative background. This note is the navigation summary.

## Core Rule

Identity, descriptive metadata, readable/playable availability, and provider numbering are separate concepts. Never collapse them into a title string or a bare episode number.

## Anime

- Routes and caches use provider-qualified canonical identities.
- TMDB supplies descriptive metadata and season structure when resolved.
- AniBridge supplies verified cross-provider episode/season relationships.
- AniList supplies identity, enrichment, discovery, and relationship fallback.
- Stream-provider numbering remains separate from displayed/TMDB episode numbering.
- Only closed, contiguous, one-to-one mappings are trusted automatically.
- Open, overlapping, ratio, multi-show, or otherwise ambiguous mappings are marked conflicting rather than guessed.

## Manga

- AniList may own metadata identity while MangaKatana owns readable chapters/pages.
- Availability and readability must be represented separately.

## Light Novels

- Catalog identity and NovelBin reading identity are joined cautiously.
- Explicit light-novel versus web-novel edition conflicts must not be silently merged.

## Regression Protection

- Mapping and identity fixtures live under `tests/`.
- Run `npm run test:mappings` when changing mapping, navigation, season, or identity utilities.
- Rotate affected cache versions when an old shape could survive the fix.


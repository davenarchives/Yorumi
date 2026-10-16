---
type: snapshot
status: maintained
last_verified: 2026-10-16
---

# Current State

## Application Shape

- Version is `4.3.0` in the root and website packages.
- React 19 + TypeScript + Vite provide the shared UI.
- Electron packages the UI with a bundled local Express backend.
- Capacitor packages the UI for Android and uses native/local source adapters instead of requiring the backend.
- Browser deployments use the remote `/api` backend.
- Firebase integration is currently a local-user shim; `isFirebaseEnabled` is false.

## Content Direction

- Anime uses provider-qualified identity and separates descriptive metadata, season mapping, and stream-provider numbering.
- TMDB, AniBridge, AniList, and scraper providers have distinct responsibilities; mappings must not be guessed.
- Manga separates metadata identity from readable-provider availability.
- Light novels preserve LN versus web-novel edition identity.

## Operational Notes

- Frontend stream/session caches are deliberately invalidated at startup.
- Data-fetching fixes must account for stale local and backend caches during testing.
- Android is the current mobile release target; `ios/` is ignored.
- `website/` is a separate marketing site and has its own package/build.
- `yorumi-cli/`, when present, is a separate product and must not depend on the Yorumi backend.

## Source of Truth

This note is a snapshot, not a contract. Verify claims in source before modifying behavior, then update this note if the architecture changed.


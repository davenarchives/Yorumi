---
type: runbook
status: maintained
last_verified: 2026-10-16
source_paths:
  - src/context/AnimeContext.tsx
  - src/utils/storage.ts
  - src/services/animeMappingService.ts
  - backend/src
---

# Debugging Data and Cache Bugs

## Symptom Triage

| Symptom | First checks |
| --- | --- |
| Wrong title/poster after navigation | route key, canonical owner, stale component state |
| Same episodes under two seasons | season identity, mapping segment, provider matcher, cache key |
| Missing thumbnails/summaries on mobile | local adapter enrichment, TMDB/AniList match, image proxy |
| Player opens wrong show/season | persistent-player identity, playback number, session cache owner |
| Works on desktop, fails on Android | local adapter/native HTTP/proxy path rather than backend |
| Works cold, fails later | localStorage/IndexedDB/backend cache collision |
| Offline media stalls | manifest rewrite, segment URL, range response, HLS loader stats |

## Procedure

1. Capture runtime, route, canonical ID, provider ID, season ID, display episode, and playback episode.
2. Determine which layer produced the wrong value; do not patch presentation first.
3. Inspect cache keys and serialized ownership before changing fetch logic.
4. Reproduce with caches cleared, then with warm caches.
5. Patch the earliest incorrect transform or ownership check.
6. Rotate only caches whose old shape remains unsafe.
7. Test another unrelated title/provider to catch overfitting.

## Cache Hygiene

- Use the scraper stream-cache reset endpoint for stream fixes.
- Clear localStorage/IndexedDB only in development unless a migration is intentional.
- Never wipe user progress to solve a metadata cache bug.
- Document cache version changes in `CHANGELOG.md`.


---
type: data-map
status: maintained
last_verified: 2026-10-16
source_paths:
  - src/utils/storage.ts
  - src/context/AnimeContext.tsx
  - src/services/downloadService.ts
  - src/services/offlineImageCache.ts
---

# Storage Caches and Persistence

## Durable User State

`src/utils/storage.ts` manages continue watching/reading, pending deletes, watch/read lists, episode/chapter history, vault variants, anime watch time, completion/genre caches, and queued cloud writes.

Additional local keys cover title language, local user, profile visuals, activity history, and seen state.

## Important Cache Families

- Anime home cache: versioned `yorumi_home_cache_*`.
- Episode/session cache: versioned `yorumi_ep_cache_*`.
- Season-chain, AniZip metadata, and TMDB caches are independently versioned.
- Backend mapping downloads use a time-bounded cache with stale fallback.
- Stream/session cache is proactively cleared on app boot.
- Downloads use IndexedDB; images use browser offline storage.

## Cache Change Checklist

1. Decide whether the existing serialized shape is still valid.
2. Include canonical provider/content/season ownership in keys.
3. Rotate the version when stale values could reproduce the bug.
4. Clear backend caches when scraper or response-shape behavior changes.
5. Test both cold and warm cache paths.
6. Preserve user progress and downloaded media unless migration is deliberate.

See [[runbooks/Debugging Data and Cache Bugs]].


---
type: feature-map
status: maintained
last_verified: 2026-10-16
source_paths:
  - src/features/search
  - src/pages
  - src/services/firebase.ts
  - src/utils/storage.ts
  - backend/src/routes
---

# Search Library Profiles and Yumi

## Search

- Shared search UI lives in `src/features/search` and route pages.
- Results must navigate with canonical provider-qualified IDs.
- Anime search may combine sources, but ranking and exact-season ownership must survive normalization.

## Library and Progress

- Continue watching/reading, favorites, watch/read lists, and history are persisted locally through `src/utils/storage.ts`.
- The mobile Library uses one labeled category dropdown for Anime, Manga, and Light Novel; desktop retains the compact segmented media selector.
- Mobile Library categories and display preferences are persisted separately in local storage. Categories contain explicit content IDs; search, Yorumi-native Downloaded/Started/Completed filters, sorting, display mode, and random-entry selection operate on the active Anime, Manga, or Light Novel view without mutating the underlying watch/read/download records. The global mobile navbar is suppressed while a Library sheet or category dialog is open.
- Pending cloud writes are queued even though current Firebase behavior is local-only.
- Vault lists use separate keys and must not leak into normal library state.

## Profiles

- `src/services/firebase.ts` currently exposes a local-user shim with Firebase disabled.
- Profile/avatar/banner/activity values are stored locally; Firestore rules remain in the repository for future/optional cloud behavior.

## Yumi

- Frontend recommendation/chat UI calls backend `/api/chat/yumi`.
- Backend model access uses server environment variables; never expose model keys in frontend code or this vault.

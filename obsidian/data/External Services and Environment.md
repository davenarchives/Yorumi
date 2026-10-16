---
type: data-map
status: maintained
last_verified: 2026-10-16
source_paths:
  - .env.example
  - src/services
  - backend/src
  - firestore.rules
---

# External Services and Environment

## Services

| Service | Role |
| --- | --- |
| AniList | anime/manga identity, discovery, relations, rankings |
| TMDB | anime descriptive metadata, artwork, TV season structure |
| AniBridge | verified cross-provider anime episode mappings |
| Anime/Manga/Novel providers | playable/readable source data |
| Groq-compatible chat API | Yumi model responses |
| Upstash Redis | optional backend caching |
| Cloudinary/image sources | media/logo support |
| Discord | desktop Rich Presence |
| Firebase | optional cloud profile/storage architecture; disabled in current frontend shim |

## Environment Families

`.env.example` documents frontend API URL, backend chat model/key, TMDB credentials, Cloudinary override, Discord IDs, and Firebase configuration.

## Security Rules

- Keep secret credentials backend-only.
- Never paste populated environment values into Obsidian notes, logs, fixtures, screenshots, or commits.
- Android signing secrets belong in GitHub Actions secrets or ignored local signing files.
- Treat provider cookies/tokens and temporary stream URLs as secrets.


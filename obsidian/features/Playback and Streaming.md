---
type: feature-map
status: maintained
last_verified: 2026-10-16
source_paths:
  - src/features/player/context/PersistentPlayerContext.tsx
  - src/features/player/hooks/usePlayer.ts
  - src/hooks/useStreams.ts
  - src/features/player/components
  - backend/src/api/anime
  - backend/src/routes
---

# Playback and Streaming

## Frontend

- `PersistentPlayerContext` keeps playback state across route changes.
- `usePlayer` coordinates selected content, progress, and player lifecycle.
- `useStreams` resolves source/server choices and failover.
- `src/components/player` contains the video element, HLS integration, custom controls, subtitles, and ambient mode.

## Backend/Desktop

- Scraper routes resolve playable sources and proxy protected manifests/assets.
- Video source orchestration lives in `backend/src/api/anime`.
- Electron runs the backend locally, avoiding browser CORS and referer limitations through Yorumi proxies.

## Native

- HiAnime/local adapters can resolve episodes and streams on-device.
- `LocalMediaProxyPlugin` serves rewritten/protected network and local media to the WebView/HLS player.

## Identity Rules

- Stream caches include provider and canonical content ownership, not just episode number.
- Player reuse requires exact content and season identity.
- Display numbering can differ from stream-provider numbering; pass both explicitly.
- Proxy URLs must retain required headers/referers and return real bodies rather than invalid empty cache responses.

## Failure Order

When playback fails, inspect: route identity → episode owner → mapping → provider episode → stream server → manifest rewrite → segment/subtitle requests → player loader.

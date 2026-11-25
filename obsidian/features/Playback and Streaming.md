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

- Mobile anime playback opens a dedicated viewing surface with the title, season and episode information, and genre-matched related recommendations. Leaving the surface closes playback; mobile does not show an in-app mini player.
- Mobile player controls include container-less icons, remaining-time countdown, a scrubber above the bottom controls in fullscreen (flush at the bottom inline), server selector, and a right-sliding landscape episodes drawer with thumbnails, progress checkmarks, and synopses.
- Fullscreen zoom transitions support native screen orientation lock and CSS landscape rotation fallbacks (`.yorumi-player-rotated`) when device orientation lock is restricted.

- `PersistentPlayerContext` keeps playback state across route changes.
- `usePlayer` coordinates selected content, progress, and player lifecycle.
- `useStreams` resolves source/server choices and failover.
- `src/features/player/components` contains the video element, HLS integration, custom controls, and subtitles. Episode navigation remains in the player controls; the watch page does not display adjacent episode backgrounds.

- Explore preloads YouTube embeds on the active and adjacent cards with `vq=hd1080` parameters and commands `setPlaybackQuality('hd1080')` / `setPlaybackQuality('highres')` on player initialization and playback, ensuring trailers render in 1080p high definition where available. Adjacent players remain muted and playing to avoid pause-bezel flashes, and the background remains black until the active video plays or when the provider reports an error. Clicking toggles playback with the anime watch page's center pop animation and custom interaction overlay.

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
- A failed lookup must settle into the unavailable-stream state instead of automatically restarting indefinitely; resolving a different provider episode may trigger a fresh lookup.

## Failure Order

When playback fails, inspect: route identity → episode owner → mapping → provider episode → stream server → manifest rewrite → segment/subtitle requests → player loader.

- Explore keeps adjacent embeds playing muted and shows trailer artwork until playback starts; the active embed is unmuted when allowed by the browser. YouTube controls and transient player overlays remain controlled by the provider.

- Mobile fullscreen exit retains the fullscreen surface until portrait orientation returns, then refreshes the inline player bounds.

- The mobile watch surface mounts as soon as an episode is selected and displays stream loading inside the player. It shows the selected season, episode number, and episode title below the anime title, and fullscreen uses the selected season number.

- Mobile player controls and the video surface mount while the stream is being resolved, with a non-interactive loading overlay on the same surface.

- On mobile, episode changes replace the current history entry. Back closes playback first; Back from anime details returns to Anime Home rather than revisiting playback.

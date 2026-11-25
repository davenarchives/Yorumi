---
type: feature-map
status: maintained
last_verified: 2026-10-16
source_paths:
  - src/context/AnimeContext.tsx
  - src/pages/AnimeDetailsPage.tsx
  - src/features/anime
  - src/services/animeService.ts
  - src/services/tmdbService.ts
  - src/services/animeMappingService.ts
  - src/services/episodeMetadataService.ts
---

# Anime

## Entry Points

- Mobile anime details hide the hero poster while preserving its vertical space, hide the round back action, and show episodes as compact thumbnail-and-metadata rows.

- On narrow screens, each anime spotlight logo moves with its artwork; metadata and synopsis update on selection while action buttons and carousel indicators remain stationary.

- Explore fills the viewport below the desktop header without document scrolling. On mobile its feed leaves room for the system status area and a full-width black primary navigation bar. Fresh sessions start at the first available trailer; active trailers request sound, while adjacent trailers stay muted.

- Continue Watching matches the home landscape carousel card size and logo overlay, and displays episode thumbnails using saved episode data or AniZip metadata, with anime artwork as fallback. Cards show an inset playback progress bar, season and episode labels, and remaining time when duration is available.

- Top 10 Today ranks anime by AniList's latest available daily trend snapshot; Trending Now uses TMDB daily trending filtered to Japanese animation. Each row is omitted if its source is unavailable.
- The anime home spotlight and its loading skeleton fill the viewport height, subject to minimum content height on short screens.
- Season-chain candidate searches use the base franchise title while accepting only explicit prequel/sequel links; seasons with distinct AniList IDs are not collapsed merely because they share a TMDB show ID.
- Studio catalogue sorting is fetched from AniList for Newest, Popular, or Top Rated. Company logos come from an exact-name TMDB company lookup when a TMDB token and logo are available, with the name as fallback; the backdrop remains from the top-rated title.
- Studio cards display TV series and movies only. Related seasons and alternate movie editions are grouped using explicit AniList relationships; other formats can connect related seasons but are not shown as standalone cards.
- Studio relation nodes include season title and artwork metadata for details navigation; older partial relation nodes are ignored when constructing season cards. Logo lookup uses TMDB IDs only for the TMDB-based backend endpoint and does not retain failed lookups.
- Studio landscape cards use the same maximum width as anime home carousel cards; missing logo artwork leaves the image unobstructed and the title remains below it.
- The home sidebar shows up to ten airing and upcoming titles in separately scrollable lists. Studio cards open `/anime/studio/:name`, whose AniList catalogue loads more pages automatically while scrolling; repeated IDs are removed, explicitly linked seasons are grouped across loaded pages, and the highest-ranked main title supplies the hero backdrop.
- `AnimeContext` owns shared anime data, episodes, progress, and cache coordination.
- `AnimeDetailsPage` coordinates canonical identity, season navigation, metadata projection, and playback episode ownership.
- Detail presentation is split under `src/features/anime/components/details`.

## Data Flow

- Continue Watching preserves saved AniList and MAL IDs for details navigation. Older bare numeric history IDs were saved MAL-first and are resolved through AniZip when available; saved poster artwork seeds details while metadata loads.

```text
route identity
→ canonical anime identity
→ metadata/details
→ season chain or TMDB seasons
→ verified mapping segment
→ provider episode list
→ enriched title/summary/still
→ playback identity and stream lookup
```

## Services

- `animeService`: normalized frontend anime API access.
- `tmdbService`: TMDB discovery/details/season metadata.
- `animeMappingService`: cached AniBridge mapping download and interpretation.
- `episodeMetadataService`: episode-level enrichment and fallback.

## Important Rules

- Do not reuse episode results unless owner identity and active mapping match.
- Do not infer a sequel by fuzzy title alone when explicit season information conflicts.
- Show a static season label without a dropdown for a single standalone season; preserve season navigation when multiple choices exist.
- Keep display episode, TMDB absolute/local episode, and provider playback episode distinct.
- Desktop detail expansion keeps the poster and title top-anchored; long synopsis content grows downward without shifting the hero identity block.
- Details page provides Episodes, Cast, and More like this tabs; switching away from Episodes while video playback is active automatically minimizes playback into the persistent floating mini player, and expanding the mini player restores the Episodes tab.
- Native anime paths may use `src/platform/sources/anilistAnime.ts`, `allmangaAnime.ts`, and `hianime.ts` instead of Express.

See [[architecture/Content Identity and Mapping]], [[features/Playback and Streaming]], and [[runbooks/Debugging Data and Cache Bugs]].

- On mobile, anime spotlight metadata updates on selection while expensive prefetch and backdrop work waits until the carousel settles.

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

- `AnimeContext` owns shared anime data, episodes, progress, and cache coordination.
- `AnimeDetailsPage` coordinates canonical identity, season navigation, metadata projection, and playback episode ownership.
- Detail presentation is split under `src/features/anime/components/details`.

## Data Flow

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
- Hide season navigation for a single standalone season.
- Keep display episode, TMDB absolute/local episode, and provider playback episode distinct.
- Desktop detail expansion keeps the poster and title top-anchored; long synopsis content grows downward without shifting the hero identity block.
- Native anime paths may use `src/platform/sources/anilistAnime.ts`, `allmangaAnime.ts`, and `hianime.ts` instead of Express.

See [[architecture/Content Identity and Mapping]], [[features/Playback and Streaming]], and [[runbooks/Debugging Data and Cache Bugs]].

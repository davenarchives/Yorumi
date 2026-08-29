---
name: feature-development-in-anime-or-manga-section
description: Workflow command scaffold for feature-development-in-anime-or-manga-section in Yorumi.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /feature-development-in-anime-or-manga-section

Use this workflow when working on **feature-development-in-anime-or-manga-section** in `Yorumi`.

## Goal

Implements or updates a feature in anime or manga sections, often involving multiple related files for a cohesive user-facing change (e.g., episode progress, watched status, layout, or UI behavior).

## Common Files

- `src/utils/storage.ts`
- `src/context/AnimeContext.tsx`
- `src/features/anime/components/details/DetailsVideoPlayer.tsx`
- `src/features/anime/components/details/DetailsEpisodeGrid.tsx`
- `src/features/anime/components/details/DetailsCharacters.tsx`
- `src/components/layout/Sidebar.tsx`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Update or add logic in a context or utility (e.g., storage.ts, AnimeContext.tsx)
- Update or add UI components (e.g., DetailsVideoPlayer.tsx, DetailsEpisodeGrid.tsx, DetailsCharacters.tsx, Sidebar.tsx)
- Update the main page or container to use new logic (e.g., AnimeDetailsPage.tsx)
- Adjust styling or layout for visual consistency

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.
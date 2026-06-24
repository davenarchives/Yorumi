---
name: routine-chore-update-across-multiple-components
description: Workflow command scaffold for routine-chore-update-across-multiple-components in Yorumi.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /routine-chore-update-across-multiple-components

Use this workflow when working on **routine-chore-update-across-multiple-components** in `Yorumi`.

## Goal

Performs routine updates, refactors, or maintenance across a wide set of component files, often touching many files in a single commit (e.g., dependency updates, minor fixes, or style consistency).

## Common Files

- `src/features/anime/components/*.tsx`
- `src/features/manga/components/**/*.tsx`
- `src/features/player/components/*.tsx`
- `src/features/player/context/*.tsx`
- `src/features/player/hooks/*.ts`
- `src/features/search/api.ts`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Identify a set of related files (e.g., all components in a feature, or all context files)
- Apply the update or fix to each file (could be style, import, minor logic, or dependency update)
- Commit all changes together with a 'chore' message

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.
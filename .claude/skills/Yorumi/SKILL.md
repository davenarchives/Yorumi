```markdown
# Yorumi Development Patterns

> Auto-generated skill from repository analysis

## Overview

This skill teaches you the core development patterns, coding conventions, and workflows used in the Yorumi repository—a TypeScript project built with Vite. Yorumi focuses on anime and manga features, with a modular component structure and a strong emphasis on maintainability and consistency. You'll learn how to contribute features, perform routine maintenance, and follow the project's established conventions for code style, commits, and testing.

## Coding Conventions

### File Naming

- **PascalCase** is used for component and context files.
  - Example: `AnimeContext.tsx`, `DetailsVideoPlayer.tsx`
- Utilities and hooks use lowerCamelCase or kebab-case as appropriate.
  - Example: `storage.ts`, `useAnimeData.ts`

### Import Style

- **Relative imports** are preferred.
  ```typescript
  import { useAnimeContext } from '../../context/AnimeContext';
  import storage from '../utils/storage';
  ```

### Export Style

- **Mixed exports**: Both default and named exports are used, depending on context.
  ```typescript
  // Named export
  export function useAnimeData() { ... }

  // Default export
  export default AnimeContext;
  ```

### Commit Messages

- **Conventional commits** with prefixes:
  - `chore:`, `feat:`, `build:`, `fix:`
- Example:
  ```
  feat: add watched status to episode grid
  chore: update dependencies across components
  ```

## Workflows

### Feature Development in Anime or Manga Section

**Trigger:** When developing or refining a feature related to anime or manga details, progress tracking, or UI.

**Command:** `/feature-anime-manga`

1. **Update or add logic** in a context or utility file  
   _Example:_  
   Edit `src/context/AnimeContext.tsx` or `src/utils/storage.ts` to handle new state or persistence.
   ```typescript
   // src/context/AnimeContext.tsx
   export const AnimeContext = createContext({ watchedEpisodes: [] });
   ```
2. **Update or add UI components**  
   _Example:_  
   Modify or create components like `DetailsVideoPlayer.tsx`, `DetailsEpisodeGrid.tsx`, or `DetailsCharacters.tsx`.
   ```tsx
   // src/features/anime/components/details/DetailsEpisodeGrid.tsx
   <EpisodeItem watched={watchedEpisodes.includes(episode.id)} />
   ```
3. **Update the main page or container** to use new logic  
   _Example:_  
   Integrate the updated context or components in `AnimeDetailsPage.tsx`.
   ```tsx
   // src/pages/AnimeDetailsPage.tsx
   <AnimeContextProvider>
     <DetailsEpisodeGrid />
   </AnimeContextProvider>
   ```
4. **Adjust styling or layout** for visual consistency  
   _Example:_  
   Update CSS modules or style props as needed.

**Files Involved:**
- `src/utils/storage.ts`
- `src/context/AnimeContext.tsx`
- `src/features/anime/components/details/DetailsVideoPlayer.tsx`
- `src/features/anime/components/details/DetailsEpisodeGrid.tsx`
- `src/features/anime/components/details/DetailsCharacters.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/pages/AnimeDetailsPage.tsx`

---

### Routine Chore Update Across Multiple Components

**Trigger:** When applying small changes, refactors, or maintenance across many files (e.g., dependency updates, minor fixes, style consistency).

**Command:** `/chore-multi-update`

1. **Identify related files**  
   _Example:_  
   All components in a feature, or all context files.
2. **Apply the update or fix** to each file  
   _Examples:_  
   - Update import paths for consistency
   - Apply a new coding style rule
   - Update dependencies in `package.json`
   ```typescript
   // Before
   import Sidebar from '../../../components/layout/Sidebar';
   // After
   import Sidebar from '../../components/layout/Sidebar';
   ```
3. **Commit all changes together** with a `chore` message  
   _Example:_
   ```
   chore: update import paths for anime components
   ```

**Files Involved:**
- `src/features/anime/components/*.tsx`
- `src/features/manga/components/**/*.tsx`
- `src/features/player/components/*.tsx`
- `src/features/player/context/*.tsx`
- `src/features/player/hooks/*.ts`
- `src/features/search/api.ts`
- `src/hooks/*.ts`
- `src/components/**/*.tsx`
- `src/context/*.tsx`
- `package.json`
- `package-lock.json`
- `backend/.env.example`
- `backend/src/api/**/*.ts`
- `backend/src/routes/index.ts`

---

## Testing Patterns

- **Test files** use the pattern: `*.test.*` (e.g., `AnimeContext.test.tsx`)
- **Testing framework:** Not specified; check for presence of Jest, Vitest, or similar in `package.json`.
- **Test location:** Tests are typically placed alongside the files they test or in a dedicated `__tests__` directory.

_Example:_
```typescript
// AnimeContext.test.tsx
import { render } from '@testing-library/react';
import { AnimeContextProvider } from './AnimeContext';

test('provides default context', () => {
  // ...
});
```

## Commands

| Command               | Purpose                                                        |
|-----------------------|----------------------------------------------------------------|
| /feature-anime-manga  | Start or update a feature in anime or manga sections           |
| /chore-multi-update   | Apply routine updates or refactors across multiple components  |
```

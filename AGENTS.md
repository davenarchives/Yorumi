# Yorumi Agent Playbook

This file defines how coding agents should work in this repo so execution stays consistent, fast, and context-aware.

## Mission
- Ship minimal, correct fixes with clear validation.
- Preserve existing behavior unless a change request explicitly says otherwise.
- Prefer root-cause fixes over local patches.

## Project Context
- Stack: React 19 + TypeScript + Vite (frontend), Express + TypeScript backend scraper API.
- Frontend source: `src/`
- Backend source: `backend/src/`
- Build outputs: `dist/`, `backend/dist/` (do not hand-edit)
- **yorumi-cli**: A standalone CLI tool (`yorumi-cli/`) completely unrelated to the main Yorumi app. It must work out-of-the-box for non-developer users to watch anime without needing the Yorumi backend running locally.

## Repository Knowledge
- Start repository exploration at `obsidian/00 - Repository Index.md`, then read only the maps relevant to the task.
- Treat source code as authoritative when a note and implementation disagree; correct the stale note in the same change.
- Update the relevant Obsidian map when changing architecture, data flow, routes, caches, build/release steps, or product invariants.
- Record durable, non-obvious architecture decisions under `obsidian/decisions/` using the provided template.
- Never store secrets, populated environment values, signing data, user data, or temporary provider credentials in the knowledge vault.

## Default Workflow
1. Understand scope and impacted layer (`src`, `backend/src`).
2. Inspect existing patterns in nearby files before editing.
3. Make the smallest coherent change.
4. Run the most relevant validation commands.
5. Report exactly what changed, why, and how it was verified.

## Execution Rules (Do)
- Use `rg`/`rg --files` for fast search.
- Reuse existing utilities/hooks/services before creating new ones.
- Keep API contracts stable unless the task explicitly includes contract changes.
- Match local naming and file organization conventions.
- Prefer TypeScript-safe fixes over `any`/casts.
- When touching scraper logic, preserve fallback behavior and error handling.
- If there is a new patch or bugfix deployed that affects data fetching, always clear the stale cache or ensure the cache is purged during testing.
- Keep frontend and backend changes logically separated in commits/summary.
- After changes, update `CHANGELOG.md` and any affected knowledge map under `obsidian/`.

## Guardrails (Do Not)
- Do not edit generated/build artifacts in `dist*` or `backend/dist`.
- Do not introduce broad refactors during bugfix tasks.
- Do not add new dependencies unless necessary and justified.
- Do not hardcode secrets or tokens; use environment variables.
- Do not silently change ports, routes, or IPC channel names.
- Do not weaken error handling in scraper/network flows.
- When bumping the application version, ALWAYS update the hardcoded version badge in `website/src/App.tsx`.

## Validation Matrix
Run only what is relevant to changed areas, but always run at least one verification command.

- Frontend/UI changes:
  - `npm run lint`
  - `npx tsc -p tsconfig.app.json --noEmit`
  - `npm run build` (ALWAYS run this after any code modifications to ensure no build-time errors)
- Backend/API/scraper changes:
  - `npm run dev --prefix backend` (smoke start)
  - `npm run build --prefix backend` (ALWAYS run this after backend changes)
If a command cannot run (time/tooling/env), state that explicitly and provide the next best verification evidence.

## Change Heuristics
- Bugfix request: reproduce signal -> identify failing path -> patch root cause -> verify with targeted command.
- Feature request: implement vertical slice first -> wire data flow -> polish UI -> validate build/lint.
- Refactor request: preserve behavior, include before/after risk notes, and keep diff scoped.

## File-Level Guidance
- `src/features`, `src/components`: keep presentational logic separate from data-fetching logic.
- `src/services`: external I/O and API wrappers only; keep pure transforms in `src/utils`.
- `src/hooks`: reusable stateful behavior; avoid embedding endpoint constants directly.
- `backend/src/api`: request/response shaping and orchestration.
- `backend/src/scraper`: source-specific scraping/parsing with resilient fallbacks and logging.

## Done Criteria
A task is done only when all are true:
- Requested behavior is implemented.
- No unrelated files were changed.
- Relevant checks were run (or inability was clearly reported).
- Summary includes changed files and validation commands used.

## Response Format for Agents
- Start with result status.
- List key file changes with paths.
- List validation commands run and outcomes.
- End with short residual risks or follow-up items (only if real).
- Do not remove navigation logic from the Vault unlock flow; spam-clicking the logo 5x MUST navigate to the Vault interface (\/\ or \/manga\).

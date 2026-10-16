---
type: reference
status: maintained
last_verified: 2026-10-16
source_paths:
  - AGENTS.md
  - src/components/layout/Sidebar.tsx
  - src/utils/storage.ts
---

# Invariants and Guardrails

## Product Invariants

- Spam-clicking the logo five times must still unlock and navigate to the Vault interface (`/` or `/manga` as appropriate).
- Native Android core watching/reading must work without a locally running Yorumi backend.
- Content identity must be provider-qualified; title strings and bare episode numbers are not identities.
- Display numbering and provider playback numbering remain separate.
- Ambiguous mappings are rejected or surfaced as conflicts, never guessed.
- A title with only one real season does not show a redundant season chip.
- Downloaded state must not leak between identically numbered episodes in different seasons.
- Persistent player reuse requires exact content/season ownership.
- Scraper/provider fallback behavior and error handling must remain resilient.

## Engineering Guardrails

- Do not edit generated build artifacts.
- Do not introduce dependencies without necessity and justification.
- Do not hardcode secrets, ports, routes, or IPC channel changes.
- Keep frontend I/O in services and pure transforms in utilities.
- Clear or rotate stale caches when data-fetching behavior changes.
- Update `CHANGELOG.md` and the relevant vault note with architectural changes.
- When bumping the app version, update `website/src/App.tsx`.

## Validation Invariants

- Every task runs at least one relevant verification.
- Frontend code modifications run the root build.
- Backend modifications run the backend build.
- Mapping changes run mapping fixtures.


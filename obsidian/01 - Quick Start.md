---
type: guide
status: maintained
last_verified: 2026-10-16
source_paths:
  - package.json
  - backend/package.json
  - AGENTS.md
---

# Quick Start

## Prerequisites

- Node.js 20 for local and CI parity.
- Java 21 for Android builds.
- Android SDK and ADB for device testing.
- Environment values copied from `.env.example`; never commit populated secrets.

## Common Commands

| Goal | Command |
| --- | --- |
| Install root dependencies | `npm install` |
| Install backend dependencies | `npm install --prefix backend` |
| Browser + backend + Electron dev | `npm run dev` |
| Mobile network development | `npm run dev:mobile` |
| Frontend build | `npm run build:frontend` |
| Full app/backend build | `npm run build` |
| Lint | `npm run lint` |
| Type-check frontend | `npx tsc -p tsconfig.app.json --noEmit` |
| Build backend | `npm run build --prefix backend` |
| Mapping fixtures | `npm run test:mappings` |
| Android sync/open | `npm run android:sync`, `npm run android:open` |
| Debug APK | `npm run android:build:debug` |

The debug APK is emitted under `android/app/build/outputs/apk/debug/`.

## Before Editing

1. Read `AGENTS.md` and [[reference/Invariants and Guardrails]].
2. Identify the runtime: web, Electron, native mobile, backend, or shared.
3. Follow the relevant map from [[00 - Repository Index]].
4. Search nearby patterns with `rg` before adding utilities or abstractions.
5. Clear or rotate affected data caches when changing fetching or identity logic.

## Validation Rule

Run the narrowest relevant checks first. Any code modification requires the build specified by `AGENTS.md`; documentation-only changes require at least a link/path validation.


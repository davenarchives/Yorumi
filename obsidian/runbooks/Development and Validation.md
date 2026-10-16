---
type: runbook
status: maintained
last_verified: 2026-10-16
source_paths:
  - AGENTS.md
  - package.json
  - backend/package.json
  - website/package.json
---

# Development and Validation

## Workflow

1. Identify the affected runtime and layer.
2. Read the nearest implementation and relevant map.
3. Reproduce or identify the failing data path.
4. Make the smallest coherent change.
5. Clear/rotate relevant caches for data-fetching fixes.
6. Run targeted checks, then required builds.
7. Update `CHANGELOG.md` and the affected vault note.

## Validation Matrix

| Change | Required checks |
| --- | --- |
| Frontend/UI | `npm run lint`; `npx tsc -p tsconfig.app.json --noEmit`; `npm run build` |
| Backend/API/scraper | backend smoke start when practical; `npm run build --prefix backend` |
| Identity/mapping | `npm run test:mappings` plus frontend build |
| Android/native | root build, `npm run android:sync`, appropriate Gradle debug/release build |
| Website | `npm run lint --prefix website`; `npm run build --prefix website` |
| Documentation only | path/link/frontmatter validation and `git diff --check` |

Do not fix unrelated failures. Report them clearly.

## Useful Diagnostics

- `rg --files` for ownership discovery.
- `rg -n "pattern" src backend/src` for data-flow tracing.
- `adb logcat` and `chrome://inspect` for Android/WebView.
- Electron renderer devtools plus backend terminal logs.
- Network panel to distinguish identity, API, proxy, and media failures.


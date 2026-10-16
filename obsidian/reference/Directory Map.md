---
type: reference
status: maintained
last_verified: 2026-10-16
---

# Directory Map

| Path | Ownership |
| --- | --- |
| `src/app/` | application shell, providers, routes |
| `src/pages/` | route-level screens |
| `src/features/` | domain feature UI/logic |
| `src/components/` | shared UI, layout, player |
| `src/context/` | cross-route state |
| `src/hooks/` | reusable stateful behavior |
| `src/services/` | frontend API, providers, downloads, integrations |
| `src/platform/sources/` | standalone native content adapters |
| `src/platform/` | runtime/native bridges |
| `src/utils/` | pure identity, navigation, storage, transforms |
| `backend/src/api/` | API shaping/orchestration |
| `backend/src/routes/` | Express routes |
| `backend/src/scraper/` | source-specific parsing and fallbacks |
| `backend/src/infrastructure/` | browser/cache/external infrastructure |
| `backend/src/core/` | backend domain contracts/utilities |
| `android/` | Capacitor Android project and custom plugins |
| `scripts/` | Electron build generation and build helpers |
| `tests/` | mapping, franchise, and identity fixtures |
| `docs/` | formal audits and supporting documentation |
| `website/` | separate marketing/docs Vite app |
| `.github/workflows/` | desktop and Android CI/release |
| `obsidian/` | durable linked repository memory |

## Generated or External

- Do not hand-edit `dist/`, `backend/dist/`, `dist-app/`, Android build outputs, or generated Electron outputs.
- `yorumi-cli/` is a separate standalone product even when present beside this app.

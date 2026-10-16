---
type: platform-map
status: maintained
last_verified: 2026-10-16
source_paths:
  - scripts/build-electron.cjs
  - src/types/electron.d.ts
  - package.json
  - package.json
---

# Electron

## Runtime

- The packaged desktop app loads the built React frontend and starts the bundled backend locally on port 3001.
- `scripts/build-electron.cjs` generates/bundles main and preload behavior, creates windows, defines IPC, manages downloads, and integrates updates.
- Renderer API types are declared in `src/types/electron.d.ts`.
- Discord Rich Presence is desktop-specific.

## Packaging

- App ID: `com.yorumi.app`.
- Output: `dist-app/`.
- Packaged inputs include `dist/`, `dist-electron/`, and the backend bundle.
- Targets include Windows NSIS, macOS DMG/ZIP universal, and Linux AppImage.

## Development and Build

- `npm run dev` starts backend, Vite, and Electron.
- `npm run build:electron` performs the general package flow.
- Platform scripts include `build:electron:win`, `build:electron:mac:universal`, and `build:electron:linux`.

## Guardrails

- Keep IPC channel names and `electronAPI` typings synchronized.
- Do not edit generated `dist-electron` or packaged outputs by hand.
- Desktop network fixes may need both renderer and bundled-backend changes.
- Filesystem downloads require exact success reporting; never mark failed/partial content complete.

---
type: runbook
status: maintained
last_verified: 2026-10-16
source_paths:
  - .github/workflows/release.yml
  - .github/workflows/mobile-release.yml
  - MOBILE_RELEASE.md
  - package.json
  - render.yaml
  - vercel.json
---

# Release and Deployment

## Desktop

- `.github/workflows/release.yml` builds Linux, macOS, and Windows on `main`, version tags, or manual dispatch.
- CI installs root and backend dependencies, runs `npm run build`, then packages with the platform-specific Electron script.
- Version tags publish artifacts to GitHub Releases using the release notes file.
- Electron Builder outputs to `dist-app/` and publishes under `davenarchives/Yorumi`.

## Android

- `.github/workflows/mobile-release.yml` uses Node 20 and Java 21.
- Signed builds require `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD` secrets.
- With signing configured, CI runs `npm run android:build:release` and uploads `Yorumi.apk`.
- Release details and manual procedures are in `MOBILE_RELEASE.md`.

## Hosted Services

- `render.yaml` deploys the backend from `backend/`, builds it, starts the production server, and checks `/`.
- `vercel.json` routes `/api/*` through the serverless entry and sends frontend routes to `index.html` with security headers.
- `firebase.json` points to `firestore.rules`.
- `website/` is a separate Vite marketing build.

## Version Checklist

1. Update package versions consistently.
2. Update the hardcoded badge in `website/src/App.tsx`.
3. Update release notes and workflow references if version-specific filenames change.
4. Validate desktop, backend, website, and Android as applicable.
5. Confirm generated artifacts are not accidentally committed.

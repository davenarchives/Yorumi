---
type: index
status: maintained
last_verified: 2026-10-16
---

# Repository Index

Yorumi is a React application delivered as a browser app, an Electron desktop app, and a standalone Capacitor Android app. A TypeScript/Express service supplies scraping, proxying, mapping, and enrichment to browser and desktop clients; native mobile uses local TypeScript source adapters for core browsing and playback.

## Start Here

- [[01 - Quick Start]] — commands, entry points, and safe first steps
- [[02 - Current State]] — current implementation facts and known architectural direction
- [[architecture/System Architecture]] — end-to-end system shape
- [[reference/Directory Map]] — ownership by directory
- [[reference/Invariants and Guardrails]] — behavior that must not regress

## Architecture

- [[architecture/Runtime Platforms]]
- [[architecture/Frontend Map]]
- [[architecture/Backend API Map]]
- [[architecture/Content Identity and Mapping]]

## Product Areas

- [[features/Anime]]
- [[features/Manga]]
- [[features/Light Novels]]
- [[features/Playback and Streaming]]
- [[features/Downloads and Offline]]
- [[features/Search Library Profiles and Yumi]]

## Platforms and Data

- [[platforms/Electron]]
- [[platforms/Android and Mobile]]
- [[data/Storage Caches and Persistence]]
- [[data/External Services and Environment]]

## Operations

- [[runbooks/Development and Validation]]
- [[runbooks/Release and Deployment]]
- [[runbooks/Debugging Data and Cache Bugs]]
- [[reference/Routes and Endpoints]]
- [[reference/Glossary]]

## Maintaining This Vault

- Update maps in the same change that alters their subject.
- Add a note under `decisions/` when a non-obvious architectural choice should survive future refactors.
- Use `source_paths` or inline repository paths to make every claim traceable.
- Do not duplicate implementation detail that is clearer in code.


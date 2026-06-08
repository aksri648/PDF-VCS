# PDF Version Control System (MERN + Tauri)

Desktop application for uploading, editing, and version-controlling PDF files with near-realtime autosave and rollback. MERN stack wrapped in Tauri v2 for cross-platform native builds (Windows + Linux).

## Quick Start (Dev)

```bash
# 1. Install dependencies
npm install
cd frontend && npm install && cd ..
cd backend && npm install && cd ..

# 2. Run backend + frontend together
npm run dev

# 3. Or run as desktop app
npm run tauri:dev
```

Backend runs on `localhost:3001`, frontend (Vite) on `localhost:5173`.

## Build

```bash
npm run tauri:build
```

Produces a native `.exe` (Windows) or `.AppImage` (Linux). CI builds both via GitHub Actions on tag push (`v*`).

## Architecture

- **frontend/** — React 18 + Vite + TypeScript + Tailwind, PDF.js renderer, pdf-lib editor, Zustand state.
- **backend/** — Express + Mongoose, MongoDB GridFS storage, Socket.IO realtime, mongodb-memory-server for dev.
- **src-tauri/** — Tauri v2 Rust shell that spawns the backend as a sidecar.

See `CLAUDE_CODE_MASTER_PROMPT.md` (root) for full spec.

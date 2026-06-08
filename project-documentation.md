# PDF Version Control System — Project Documentation

A desktop application for uploading, editing, and version-controlling PDF files with near-realtime autosave and rollback. Built on the MERN stack (MongoDB, Express, React, Node.js) and wrapped in Tauri v2 for native Windows + Linux desktop builds.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Tech Stack](#3-tech-stack)
4. [Repository Layout](#4-repository-layout)
5. [Prerequisites](#5-prerequisites)
6. [Local Setup](#6-local-setup)
7. [Running the App](#7-running-the-app)
8. [Backend Reference](#8-backend-reference)
9. [Frontend Reference](#9-frontend-reference)
10. [Database Schema](#10-database-schema)
11. [Real-time Sync (Socket.IO)](#11-real-time-sync-socketio)
12. [Diff Algorithm](#12-diff-algorithm)
13. [Autosave Pipeline](#13-autosave-pipeline)
14. [Tauri Desktop Build](#14-tauri-desktop-build)
15. [GitHub Actions CI/CD](#15-github-actions-cicd)
16. [Environment Variables](#16-environment-variables)
17. [Troubleshooting](#17-troubleshooting)
18. [Known Limitations & Next Steps](#18-known-limitations--next-steps)

---

## 1. Overview

**What it does:**

- Upload PDF files via drag-and-drop.
- Edit PDFs with text, highlight, freehand draw, rectangle, and circle annotations.
- Every change is auto-saved as a new version after 2 seconds of inactivity.
- A version history sidebar shows every snapshot with diff summaries (which pages changed).
- Preview, rollback, download, label, or diff any past version.
- Runs as a web app (browser + backend) or as a single native desktop executable (Tauri v2 sidecar pattern).

**Target users:** anyone who wants Git-style version control for PDFs without the friction of Git itself.

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Tauri v2 Window (Rust)                │
│  spawns backend as sidecar, kills on exit                │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Frontend (React + Vite + PDF.js)                  │  │
│  │  - Dashboard (doc grid)                            │  │
│  │  - Editor (canvas + overlay + version sidebar)     │  │
│  └─────────────────┬──────────────────────────────────┘  │
│                    │ HTTP /api + Socket.IO               │
│  ┌─────────────────▼──────────────────────────────────┐  │
│  │  Backend (Express + Socket.IO)                     │  │
│  │  - PDF / version routes                            │  │
│  │  - Debounced autosave handler                      │  │
│  │  - Page-level SHA256 diff service                  │  │
│  └─────────────────┬──────────────────────────────────┘  │
│                    │                                     │
│  ┌─────────────────▼──────────────────────────────────┐  │
│  │  MongoDB (mongodb-memory-server in dev /          │  │
│  │  external Mongo via MONGODB_URI in prod)           │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

Three independent processes:

1. **Tauri shell** — Rust binary that creates the OS window and spawns the backend as a child process.
2. **Express backend** — Node.js server on `localhost:3001` exposing REST + Socket.IO. Connects to a MongoDB instance (in-memory for dev, external for prod).
3. **Vite frontend** — React app served at `localhost:5173` in dev, baked into `frontend/dist` in production and served by Tauri.

In dev mode the frontend proxies `/api` and `/socket.io` to `localhost:3001` so there's no CORS hassle.

---

## 3. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend framework | React | 18.3 |
| Build tool | Vite | 5.4 |
| Language | TypeScript | 5.5 |
| Styling | Tailwind CSS | 3.4 |
| PDF rendering | pdfjs-dist | 4.5 |
| PDF manipulation | pdf-lib | 1.17 |
| Client state | Zustand | 4.5 |
| Routing | react-router-dom | 6.26 |
| Drag-drop | react-dropzone | 14.2 |
| Realtime client | socket.io-client | 4.7 |
| Backend runtime | Node.js | 20+ |
| Backend framework | Express | 4.19 |
| ODM | Mongoose | 8.5 |
| Realtime server | socket.io | 4.7 |
| Uploads | multer | 1.4 |
| Dev DB | mongodb-memory-server | 10.0 |
| Dev runner | tsx | 4.16 |
| Desktop shell | Tauri | 2.x |
| Sidecar packer | pkg | latest |
| CI | GitHub Actions | matrix (Ubuntu + Windows) |

---

## 4. Repository Layout

```
pdf-vcs/
├── backend/                    # Express API server
│   ├── src/
│   │   ├── controllers/        # Request handlers
│   │   │   ├── pdfController.ts
│   │   │   └── versionController.ts
│   │   ├── models/             # Mongoose schemas
│   │   │   ├── Document.ts
│   │   │   └── Version.ts
│   │   ├── routes/             # Express routers
│   │   │   ├── pdf.routes.ts
│   │   │   └── version.routes.ts
│   │   ├── services/           # Business logic
│   │   │   ├── diffService.ts      # SHA256 page hashing + change detection
│   │   │   └── storageService.ts   # Version creation & rollback
│   │   ├── socket/
│   │   │   └── socketHandler.ts    # Debounced autosave room handler
│   │   └── server.ts           # App entry
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                   # React + Vite app
│   ├── src/
│   │   ├── components/
│   │   │   ├── PDFEditor.tsx       # Canvas + annotation overlay
│   │   │   ├── VersionHistory.tsx  # Sidebar list
│   │   │   ├── FileUploader.tsx    # Drag-and-drop dropzone
│   │   │   ├── Toolbar.tsx         # Tool / zoom / save controls
│   │   │   ├── DiffViewer.tsx      # Side-by-side version compare
│   │   │   └── PreviewModal.tsx    # Read-only version preview
│   │   ├── hooks/
│   │   │   ├── useAutoSave.ts      # 2 s debounce hook
│   │   │   └── useSocket.ts        # Socket.IO room subscription
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx       # Document grid
│   │   │   └── Editor.tsx          # Full editor layout
│   │   ├── store/
│   │   │   └── pdfStore.ts         # Zustand global store
│   │   ├── api.ts                  # REST client
│   │   ├── pdfEdit.ts              # pdf-lib annotation embedding
│   │   ├── pdfjs.ts                # PDF.js worker config
│   │   ├── types.ts                # Shared TS interfaces
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── src-tauri/                  # Tauri Rust shell
│   ├── src/
│   │   └── main.rs             # Spawns backend sidecar, manages lifecycle
│   ├── capabilities/
│   │   └── default.json        # Permission manifest (shell:allow-spawn)
│   ├── binaries/
│   │   └── README.md           # Sidecar build instructions
│   ├── icons/                  # App icons (32x32.png, 128x128.png, icon.png)
│   ├── Cargo.toml
│   ├── build.rs
│   └── tauri.conf.json
│
├── .github/
│   └── workflows/
│       └── build-release.yml   # Matrix build + GitHub Releases
│
├── .gitignore
├── package.json                # Root scripts (dev / tauri / build)
├── project-documentation.md    # This file
└── README.md
```

---

## 5. Prerequisites

| Tool | Required for | Install hint |
|---|---|---|
| Node.js ≥ 20 | Backend + frontend | `nvm install 20` |
| npm ≥ 10 | Package manager | bundled with Node |
| Rust (stable) | Tauri build only | `curl https://sh.rustup.rs -sSf \| sh` |
| `pkg` | Sidecar bundling for Tauri | `npm install -g pkg` |
| Linux system libs | Tauri build on Linux | `libgtk-3-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev patchelf libssl-dev` |
| MongoDB | Optional — external Mongo for prod | dev uses in-memory automatically |

> **You do NOT need** Rust, `pkg`, or system libs for plain web dev. Only the Tauri desktop build pulls them in.

---

## 6. Local Setup

From the repo root:

```bash
# 1. Install root devDeps (concurrently, tauri-cli)
npm install

# 2. Install backend dependencies (~3 minutes — pulls mongodb-memory-server)
cd backend && npm install && cd ..

# 3. Install frontend dependencies (~1 minute)
cd frontend && npm install && cd ..
```

Optional — copy backend env template:

```bash
cp backend/.env.example backend/.env
```

If `MONGODB_URI` is left empty, the backend boots an in-process MongoDB via `mongodb-memory-server` — no external Mongo needed.

---

## 7. Running the App

### Mode A — Web (browser)

Run both servers concurrently:

```bash
npm run dev
```

This launches:

- Backend on **http://localhost:3001**
- Frontend on **http://localhost:5173**

Open `http://localhost:5173` in your browser. Vite proxies `/api` and `/socket.io` to the backend, so CORS is not an issue.

### Mode B — Desktop (Tauri)

Requires Rust + Linux system libs (see [Prerequisites](#5-prerequisites)):

```bash
npm run tauri:dev
```

Tauri runs `cd frontend && npm run dev` automatically, then loads the dev URL in a native window.

### Mode C — Production build

```bash
# Frontend bundle only
cd frontend && npm run build      # → frontend/dist/

# Backend compile only
cd backend && npm run build       # → backend/dist/

# Full desktop bundle (requires sidecar binary, see §14)
npm run tauri:build               # → src-tauri/target/release/bundle/
```

### Useful root scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start backend + frontend together (browser mode) |
| `npm run dev:backend` | Just the backend |
| `npm run dev:frontend` | Just the frontend |
| `npm run build:frontend` | Build the Vite app |
| `npm run build:backend` | Compile the backend with `tsc` |
| `npm run tauri:dev` | Run desktop app in dev mode |
| `npm run tauri:build` | Build desktop installers |

---

## 8. Backend Reference

### Boot sequence (`backend/src/server.ts`)

1. Load `.env` via `dotenv/config`.
2. Connect to MongoDB — uses `MONGODB_URI` if set, else spins up `mongodb-memory-server`.
3. Set up Express with `cors` + `express.json({ limit: '10mb' })`.
4. Mount `/api/pdf` and `/api/versions` routes.
5. Attach Socket.IO with `maxHttpBufferSize: 100 MB` for large PDF payloads.
6. Listen on `PORT` (default `3001`).
7. Trap `SIGINT` / `SIGTERM` for graceful shutdown.

### REST API

#### PDF routes — `/api/pdf`

| Method | Endpoint | Body | Returns |
|---|---|---|---|
| `POST` | `/upload` | `multipart/form-data` (`file`, optional `name`, `thumbnail`, `author`) | `{ document, versionId }` |
| `GET` | `/` | — | Array of documents with `versionCount` |
| `GET` | `/:id` | — | Single document |
| `DELETE` | `/:id` | — | `{ ok: true }` (cascades versions) |

#### Version routes — `/api/versions`

| Method | Endpoint | Body | Returns |
|---|---|---|---|
| `GET` | `/:documentId` | — | Array of versions (no `pdfData`) |
| `GET` | `/:documentId/:versionId` | — | PDF binary (`application/pdf`) |
| `GET` | `/:documentId/:versionId?format=json` | — | Version metadata only |
| `POST` | `/:documentId` | `multipart/form-data` (`file`, `label`, `isAutoSave`, `thumbnail`) | New version metadata |
| `POST` | `/:documentId/rollback/:versionId` | — | New rollback version metadata |
| `DELETE` | `/:documentId/:versionId` | — | `{ ok: true }` |
| `PATCH` | `/:documentId/:versionId/label` | `{ label }` | Updated version |

### Limits

- Max upload size: 100 MB (configured in both Multer instances).
- Max Socket.IO frame: 100 MB.
- JSON body limit: 10 MB.

Adjust in `pdf.routes.ts`, `version.routes.ts`, `server.ts`, and `socketHandler.ts` if you need bigger files.

---

## 9. Frontend Reference

### Routes (`App.tsx`)

| Path | Component | Purpose |
|---|---|---|
| `/` | `Dashboard` | Document grid + uploader |
| `/editor/:id` | `EditorPage` | Annotate, autosave, version history |

### Global state (`store/pdfStore.ts`)

Zustand store fields:

- `documentId` — currently open doc.
- `currentPdfBytes` — Uint8Array of the latest version's PDF.
- `pageCount`, `currentPage`, `zoom` — viewer controls.
- `tool` — selected annotation tool (`select | text | highlight | draw | rect | circle`).
- `annotations` — array of in-flight (not yet embedded) annotations.
- `history` / `future` — undo/redo stacks.
- `versions` — version metadata list (newest first).
- `saveStatus` — `idle | saving | saved | error`.

### Components

- **`Toolbar`** — tool selector, undo/redo, zoom, save status, manual save button.
- **`PDFEditor`** — renders the current page via PDF.js onto a `<canvas>`, overlays a second `<canvas>` for annotations, handles mouse events per tool.
- **`VersionHistory`** — sidebar with each version's label (inline-editable), timestamp (`date-fns` relative), changed pages badge, and Preview / Rollback / Download / Diff buttons.
- **`PreviewModal`** — read-only PDF.js renderer for any past version, with prev/next paging.
- **`DiffViewer`** — side-by-side render of two versions for the same page; red border = changed, green = unchanged.
- **`FileUploader`** — `react-dropzone` accepting PDFs only; generates a first-page thumbnail before upload.

### Hooks

- **`useSocket(documentId, handlers)`** — joins the doc's Socket.IO room, exposes `onVersionSaved` and `onSaveError` callbacks.
- **`useAutoSave(trigger, enabled, onSave, delay = 2000)`** — debounced effect that calls `onSave` after `delay` ms of `trigger` being stable. Skips the first render to avoid saving on mount.

### PDF.js worker

`pdfjs.ts` sets `pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'`. The worker is copied to `frontend/public/` automatically by `vite-plugin-static-copy` (see `vite.config.ts`).

---

## 10. Database Schema

### `Document`

```ts
{
  _id: ObjectId,
  name: string,                  // Filename
  currentVersionId: ObjectId,    // → Version
  metadata: {
    pageCount: number,
    fileSize: number,            // bytes
    author: string,
  },
  createdAt: Date,
  updatedAt: Date,
}
```

### `Version`

```ts
{
  _id: ObjectId,
  documentId: ObjectId,          // → Document (indexed)
  versionNumber: number,         // 1, 2, 3, …
  label: string,                 // "v3 — autosave" or user-given
  pdfData: Buffer,               // Inline PDF binary
  diffSummary: string,           // e.g. "Page 1, 3 modified; 1 page added"
  changedPages: number[],        // 0-based page indices
  isAutoSave: boolean,
  thumbnail: string,             // base64 PNG of page 1 (small)
  createdAt: Date,
}
```

Compound index on `{ documentId: 1, versionNumber: -1 }` for fast version listing.

> **Storage note:** `pdfData` is stored as a `Buffer` inside the Version document. MongoDB's 16 MB document cap applies. For files routinely over 16 MB you should swap to GridFS (see §18).

---

## 11. Real-time Sync (Socket.IO)

### Rooms

Each document gets its own room: `doc:<documentId>`. Clients join via `join-document`, leave via `leave-document` (or on disconnect).

### Client → Server events

| Event | Payload | Effect |
|---|---|---|
| `join-document` | `{ documentId }` | Subscribe to room |
| `leave-document` | `{ documentId }` | Unsubscribe |
| `pdf-change` | `{ documentId, pdfData, changedPages?, thumbnail? }` | Triggers 2 s debounced autosave |
| `request-save` | `{ documentId, label?, pdfData, thumbnail? }` | Immediate manual save |

### Server → Client events

| Event | Payload | Effect |
|---|---|---|
| `version-saved` | `{ version }` (metadata only) | Broadcast to all clients in room |
| `save-error` | `{ message }` | Sent to the offender + room (errors) |

### Debounce mechanism

`socketHandler.ts` keeps two per-document maps: `debounceTimers` and `pendingPayloads`. Every `pdf-change` resets the timer and overwrites the pending payload, so only the most recent state lands in the DB. The 2 s constant is `AUTOSAVE_DELAY_MS`.

> **Current frontend flow:** the autosave is driven by the REST endpoint (`api.saveVersion`) rather than Socket.IO. The socket path is wired up server-side and ready for clients that prefer pushing binary payloads through the websocket.

---

## 12. Diff Algorithm

`backend/src/services/diffService.ts`:

1. `hashPagesOfPdf(bytes)` — loads the PDF with `pdf-lib`, copies each page into a one-page PDF, serializes it (`useObjectStreams: false` for deterministic output), and SHA256-hashes the bytes. Returns `{ pageCount, hashes[] }`.
2. `computeDiff(prev, next)` — pairwise compare hashes. Produces `changedPages: number[]` (0-based) and a human summary like `"Page 1, 3 modified; 2 pages added"`.

This runs server-side on every version save (including rollbacks and uploads — the upload version is "Initial version (N pages)").

> **Tradeoff:** content-stream hashing detects any byte-level page change but treats two visually identical pages with different internal object ordering as "changed". Good enough for v1; future work could use rendered-image diffs.

---

## 13. Autosave Pipeline

End-to-end for one annotation edit:

1. User draws on the overlay canvas in `PDFEditor`.
2. `addAnnotation()` pushes to Zustand store; the `annotations` array changes.
3. `useAutoSave` in `EditorPage` sees the new `annotations` reference, debounces 2 s.
4. After 2 s of inactivity, callback runs:
   - `embedAnnotations(pdfBytes, annotations)` merges all in-flight annotations into the PDF via `pdf-lib` (text via Helvetica, rectangles, ellipses, lines from freehand paths, highlights as 35% opacity rectangles).
   - `generateThumbnail(merged)` renders page 1 at scale 0.3 and dumps a `data:image/png` URL.
   - `POST /api/versions/:documentId` with the merged PDF as multipart, `isAutoSave: true`, and the thumbnail.
5. Backend's `appendVersion` increments `versionNumber`, computes the diff against the previous version, persists, and updates `Document.currentVersionId`.
6. Backend emits `version-saved` to the room; the same client also prepends the version locally and flips `saveStatus` to `saved`.

Manual save uses the same pipeline with `isAutoSave: false` and a label.

---

## 14. Tauri Desktop Build

### `tauri.conf.json` highlights

- `beforeDevCommand` → `cd ../frontend && npm run dev`
- `beforeBuildCommand` → `cd ../frontend && npm run build`
- `frontendDist` → `../frontend/dist`
- `bundle.targets` → `["appimage", "deb", "nsis", "msi"]`
- `bundle.externalBin` → `binaries/pdf-vcs-backend`

The `externalBin` entry tells Tauri to look for the backend sidecar in `src-tauri/binaries/` and bundle it inside the installer. The actual file must be named with the Rust target triple suffix:

- Linux: `pdf-vcs-backend-x86_64-unknown-linux-gnu`
- Windows: `pdf-vcs-backend-x86_64-pc-windows-msvc.exe`

### `main.rs` sidecar lifecycle

On `setup`, the Rust shell spawns the sidecar with `app.shell().sidecar("pdf-vcs-backend")`, stores the `CommandChild` in app state, and streams the child's stdout/stderr to the Tauri console. On `RunEvent::ExitRequested` (window closes), it calls `child.kill()` so the backend doesn't outlive the window.

### Permissions

`capabilities/default.json` allows `shell:allow-execute` and `shell:allow-spawn` for the sidecar binary. No other Tauri APIs are exposed — the frontend talks to the backend over HTTP/WebSocket only.

### Building the sidecar

```bash
cd backend
npm run build                                     # tsc → dist/
pkg dist/server.js \
  --targets node20-linux-x64,node20-win-x64 \
  --output ../src-tauri/binaries/pdf-vcs-backend
```

`pkg` produces `pdf-vcs-backend-linux` and `pdf-vcs-backend-win.exe`. **Rename them** to match the Rust target triple suffix Tauri expects (see above).

### Icons

Drop in `src-tauri/icons/`:
- `32x32.png`
- `128x128.png`
- `icon.png` (square master)

Generate via `npx @tauri-apps/cli icon path/to/source.png` if you have one source image.

---

## 15. GitHub Actions CI/CD

Workflow file: `.github/workflows/build-release.yml`.

**Trigger:** any tag matching `v*` (e.g. `v0.1.0`). Manual `workflow_dispatch` also enabled.

**Matrix:**

| OS | Rust target | pkg target | Sidecar filename |
|---|---|---|---|
| `ubuntu-latest` | `x86_64-unknown-linux-gnu` | `node20-linux-x64` | `pdf-vcs-backend-x86_64-unknown-linux-gnu` |
| `windows-latest` | `x86_64-pc-windows-msvc` | `node20-win-x64` | `pdf-vcs-backend-x86_64-pc-windows-msvc.exe` |

**Steps per OS:**

1. Checkout repo.
2. Setup Node 20 and Rust stable with the matrix target.
3. (Linux only) Install GTK / WebKit / appindicator system libs.
4. `npm install` in `frontend/` and `backend/`.
5. Build the backend (`tsc`).
6. `npm install -g pkg`; bundle the backend into the sidecar binary name expected by Tauri.
7. Build the frontend (`vite build`).
8. Run `tauri-apps/tauri-action@v0` with `projectPath: pdf-vcs` and `args: --target <triple>`, which compiles the Tauri app and uploads `.AppImage` / `.deb` (Linux) and `.exe` / `.msi` (Windows) artifacts to a GitHub Release.

To cut a release:

```bash
git tag v0.1.0
git push origin v0.1.0
```

---

## 16. Environment Variables

Backend (`backend/.env`):

| Var | Default | Description |
|---|---|---|
| `PORT` | `3001` | HTTP + WebSocket port |
| `MONGODB_URI` | _(unset)_ | If set, connect to this Mongo. Otherwise use `mongodb-memory-server`. |
| `FRONTEND_URL` | `http://localhost:5173` | Allowed CORS origin |

Frontend: none required. The Vite dev server proxies `/api` and `/socket.io` to `localhost:3001`. In production, the bundled SPA assumes the backend is reachable at the same origin or the Tauri sidecar's port (3001).

---

## 17. Troubleshooting

### `Type 'Uint8Array<ArrayBufferLike>' is not assignable to type 'BlobPart'`

TypeScript 5.7+ tightened `Uint8Array` generics. Cast with `merged as BlobPart` (already applied in `Editor.tsx`). If you see this in new code, do the same.

### `Object literal may only specify known properties, and 'canvas' does not exist in type 'RenderParameters'`

Old PDF.js API. Drop the `canvas` field from `page.render({ canvasContext, viewport })`.

### Backend hangs on first boot

`mongodb-memory-server` downloads a `mongod` binary on first run (~70 MB). Subsequent boots cache it under `~/.cache/mongodb-binaries`. Set `MONGODB_URI` to an external Mongo to skip the download entirely.

### `EADDRINUSE: 3001`

Another process owns port 3001 (often a previous backend that didn't shut down). `lsof -i :3001` then `kill <pid>`, or set `PORT=3002` in `.env` and update `vite.config.ts` proxy target.

### Frontend chunk size warning

`dist/assets/index-*.js` is ~1.1 MB minified (~380 KB gzipped) — PDF.js is the big offender. Acceptable for an Electron-style desktop app; if you want to split, use dynamic `import()` for the editor route or configure `build.rollupOptions.output.manualChunks` in `vite.config.ts`.

### Tauri build fails: `failed to spawn backend`

The sidecar binary isn't in `src-tauri/binaries/` with the correct triple suffix. Rebuild with `pkg` and rename per [§14](#14-tauri-desktop-build).

### Tauri build fails on Linux: missing GTK / WebKit

```bash
sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.1-dev \
  libayatana-appindicator3-dev librsvg2-dev patchelf libssl-dev
```

### Multer / 1.x security warning

Multer 1.x has known CVEs (not exploitable in this configuration — we use in-memory storage with size limits — but worth upgrading). Migration path: `npm install multer@^2` and adjust the import path; 2.x is API-compatible for the small surface we use.

---

## 18. Known Limitations & Next Steps

**In-document PDF storage.** PDF binaries are inlined in the `Version` document. MongoDB caps at 16 MB per doc. For larger PDFs, move to GridFS:

```ts
const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db);
const uploadStream = bucket.openUploadStream(`v${n}.pdf`);
uploadStream.end(pdfData);
```

Store the resulting `_id` on `Version` instead of the buffer.

**Diff fidelity.** SHA256 of serialized pages catches any byte change. Two visually identical pages with reordered object streams will register as different. For visual diffs, render both versions of a changed page via PDF.js and pixel-diff with a library like `pixelmatch`.

**No collaborative editing.** Multiple users editing the same doc simultaneously will race — last write wins. CRDT or OT layer required for real multi-user.

**No authentication.** Anyone with access to the backend can read/write anything. Add a JWT middleware + per-user document ownership before any deployment outside localhost.

**Page reorder / delete not yet wired.** The spec calls for drag-to-reorder and page deletion; the data model and `pdf-lib` capabilities are in place but the UI controls aren't.

**Annotation rendering parity.** The overlay canvas previews annotations in screen coordinates; `embedAnnotations` re-projects them into PDF coordinate space (flipping Y). The mapping is correct for unrotated pages at scale 1.5; rotated pages will need extra handling.

**Multer 1.x → 2.x migration.** See [§17](#17-troubleshooting).

**Code splitting.** The PDF.js worker is already split; the main app bundle isn't. Easy win if startup time matters.

---

## Appendix — Quick API smoke tests

```bash
# Health check
curl http://localhost:3001/health

# Upload a PDF
curl -X POST -F "file=@sample.pdf" -F "name=sample.pdf" \
  http://localhost:3001/api/pdf/upload

# List documents
curl http://localhost:3001/api/pdf

# List versions
curl http://localhost:3001/api/versions/<documentId>

# Download a version (PDF binary)
curl -o v1.pdf http://localhost:3001/api/versions/<documentId>/<versionId>

# Rollback
curl -X POST http://localhost:3001/api/versions/<documentId>/rollback/<versionId>

# Rename a version
curl -X PATCH -H "Content-Type: application/json" \
  -d '{"label":"reviewed"}' \
  http://localhost:3001/api/versions/<documentId>/<versionId>/label
```

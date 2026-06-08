# Sidecar Backend

Place compiled backend binaries here following Tauri's sidecar naming:

- `pdf-vcs-backend-x86_64-unknown-linux-gnu`
- `pdf-vcs-backend-x86_64-pc-windows-msvc.exe`

Build with `pkg` or `nexe`:

```bash
cd backend
npm run build
pkg dist/server.js \
  --targets node20-linux-x64,node20-win-x64 \
  --output ../src-tauri/binaries/pdf-vcs-backend
```

The Tauri build references these via `externalBin` in `tauri.conf.json`.

# AGENTS.md

## Project overview

PreBase is a single-package Electron desktop app (npm, TypeScript, React, Vite via electron-vite). There is no backend server, database, or Docker stack. All product logic runs inside Electron main + renderer processes.

## Common commands

| Task | Command |
|------|---------|
| Install deps | `npm install` |
| Dev (Electron + Vite HMR) | `npm run dev` |
| Typecheck | `npm run typecheck` |
| Production build | `npm run build` |
| Preview built app | `npm run preview` |

There is no ESLint or unit-test script in `package.json`.

## Cursor Cloud specific instructions

### Services

Only **one process** is required for development: `npm run dev` (electron-vite builds main/preload, serves the renderer on port **5173**, and launches Electron). No external services are needed.

Run long-lived dev in tmux, e.g. session `prebase-dev`:

```bash
tmux -f /exec-daemon/tmux.portal.conf new-session -d -s prebase-dev -c /workspace -- npm run dev
```

The cloud VM provides `DISPLAY=:1`; Electron starts without extra Xvfb configuration.

### Postinstall

`npm install` triggers `postinstall` → `scripts/install-electron.cjs`, which downloads the Electron binary (required for Electron 42+).

### Harmless log noise

DBus/dconf warnings in Electron output on Linux cloud VMs are expected and can be ignored.

### Verifying the graph pipeline (hello-world)

1. **Static checks:** `npm run typecheck` and `npm run build` should pass.
2. **App launch:** After `npm run dev`, the PreBase welcome screen should appear.
3. **Open a small project:** Use a tiny local folder for fast scans, e.g. `/tmp/test-project` (two linked JS files). Opening the full `/workspace` repo also works (~164 nodes) but is slower than a minimal fixture.

**Manual GUI:** Use **Open Project** or `Ctrl+O` and pick a project directory. The native file dialog can be finicky under remote desktop automation; if the UI stays blank after picking a folder, reload (`Ctrl+R`) and retry, or use the automated path below.

**Automated graph demo (Playwright):** Install Playwright without changing `package.json`:

```bash
npm install --no-save playwright
```

Launch against an already-running dev server (`npm run dev`), open a project via IPC, push the snapshot to the renderer with `webContents.send('graph:full', snapshot)`, then screenshot. Example pattern:

```javascript
const { _electron: electron } = require('playwright')
const app = await electron.launch({
  args: ['.'],
  cwd: '/workspace',
  env: { ...process.env, ELECTRON_RENDERER_URL: 'http://localhost:5173', NODE_ENV: 'development' }
})
const page = await app.firstWindow()
await app.evaluate(async ({ BrowserWindow }, projectPath) => {
  const win = BrowserWindow.getAllWindows()[0]
  const result = await win.webContents.executeJavaScript(
    `window.prebase.openProject(${JSON.stringify(projectPath)})`
  )
  win.webContents.send('graph:full', result.snapshot)
})
```

Expect React Flow nodes (e.g. 2 visible nodes for `/tmp/test-project`).

### Gotchas

- Do **not** set `ELECTRON_DISABLE_GPU=1` unless debugging GPU issues; React Flow canvas rendering may fail silently.
- Only run one Electron instance against port 5173 at a time.
- `npm run dev` must stay running while using `ELECTRON_RENDERER_URL=http://localhost:5173` for Playwright-launched Electron windows.
- Core analysis (`ProjectService`) can be exercised headlessly via `npx tsx` importing `src/core/services/project-service.ts`; the chokidar watcher keeps the Node process alive until exit.

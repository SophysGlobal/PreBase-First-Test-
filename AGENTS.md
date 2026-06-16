# PreBase

AI-native, real-time codebase visualization desktop app (Electron + Vite + React + TypeScript). See `README.md` for product overview and standard scripts.

## Cursor Cloud specific instructions

PreBase is a single Electron desktop application. The standard commands live in `package.json` (`dev`, `build`, `typecheck`). Notes below are the non-obvious bits for running it in this cloud VM.

- This repo has no test runner and no ESLint config. The "lint"/static check is `npm run typecheck` (runs both `typecheck:web` and `typecheck:node`).
- `npm run dev` (electron-vite) starts the Vite renderer dev server and launches the Electron window on the existing X server (`DISPLAY=:1`). Run it in a long-lived session (e.g. tmux) since it stays in the foreground.
- Expect harmless noise in the dev/electron logs: `Failed to connect to the bus` (dbus) and `failed to commit changes to dconf` warnings. These do not indicate a failure.
- `electron` (v42+) does not download its binary via npm anymore; the `postinstall` script (`scripts/install-electron.cjs`) handles it. So a plain `npm install` is sufficient — no extra steps to get the Electron binary.
- Core hello-world flow to verify the app: launch dev, click "Open Project" on the Welcome screen, and in the native directory picker use `Ctrl+L` to type a path (e.g. `/workspace`) since folder navigation in the picker is fiddly. The dependency graph (nodes + import edges) renders after a short scan. A black screen with the PreBase logo may briefly appear while the graph is settling/relaying out — this is a transient loading state, not a crash.

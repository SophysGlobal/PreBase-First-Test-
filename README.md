# PreBase .

AI-native, real-time codebase visualization for developers. Transform local projects into living architecture graphs.

## Features (MVP)

- **Project import** — Open local TypeScript/JavaScript/React folders
- **Dependency graph** — Files, components, and import relationships
- **Real-time watching** — Incremental graph updates on file changes
- **ELK layout** — Layered, force, and clustered layout modes
- **Search & focus** — Highlight nodes and cinematic camera focus
- **Premium UI** — Dark, minimal interface inspired by Linear and Arc

## Stack

- Electron + Vite + React + TypeScript
- React Flow, Framer Motion, Zustand, Tailwind CSS
- Babel parser, ELK.js, Chokidar, fast-glob

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Architecture

```
src/
├── core/           # Scanner, parser, graph, layout, watcher
├── main/           # Electron main process
├── preload/        # IPC bridge
└── renderer/       # React UI
```

## Keyboard shortcuts

- `⌘/Ctrl + O` — Open project
- `Escape` — Clear focus

## Roadmap

- Phase 4: Advanced clustering, virtualization
- Phase 5: Semantic analysis, AI-assisted architecture

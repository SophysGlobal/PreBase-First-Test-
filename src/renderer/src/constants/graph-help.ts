import type { LayoutMode } from '../../../core/types'

export const LAYOUT_MODE_HELP: Record<LayoutMode, { title: string; body: string }> = {
  hierarchy: {
    title: 'Hierarchy',
    body: 'Concentric dependency rings from the entry point outward. Each ring caps node count to stay readable.'
  },
  pyramid: {
    title: 'Pyramid',
    body: 'Vertical dependency tiers with compact row spacing. Entry at top, deeper imports cascade downward.'
  },
  scattered: {
    title: 'Scattered',
    body: 'Compact exploratory layout with controlled radial spread. Related systems stay reachable without extreme panning.'
  }
}

export const LAYOUT_PRESETS: LayoutMode[] = ['hierarchy', 'pyramid', 'scattered']

export const EDGE_TYPE_HELP = [
  {
    label: 'Static import',
    style: 'solid',
    color: 'rgba(255,255,255,0.35)',
    body: 'Standard compile-time dependency between modules.'
  },
  {
    label: 'Dynamic import',
    style: 'dashed',
    color: 'rgba(168,85,247,0.6)',
    body: 'Runtime-loaded module (import()). Often used for code-splitting or lazy loading.'
  },
  {
    label: 'Highlighted',
    style: 'solid',
    color: 'rgba(45, 212, 191, 0.65)',
    body: 'Connection related to your current search or focused file.'
  },
  {
    label: 'Selected edge',
    style: 'solid',
    color: 'rgba(245,158,11,0.85)',
    body: 'The dependency link you clicked for detailed inspection.'
  }
]

export const LAYERS_PANEL_HELP = {
  title: 'Architecture layers',
  body: 'Toggle visibility of logical systems (frontend, API, auth, etc.). Use Isolate to view only one layer. Combine with depth controls to reduce noise in large projects.'
}

export const DEPTH_HELP = {
  title: 'Depth from entry',
  body: 'Limits how many import hops are shown from the entry file. Start shallow (1–2) and expand as you explore.'
}

export const FOCUS_NEIGHBORHOOD_HELP = {
  title: 'Focus neighborhood',
  body: 'Softly de-emphasizes nodes outside the 2-hop import neighborhood of your selection. Keeps surrounding architecture visible while drawing attention to related files.'
}

export const HIDE_LOW_IMPORTANCE_HELP = {
  title: 'Hide low-importance',
  body: 'Hides leaf files with no dependents and minimal exports to reduce clutter in large codebases.'
}

export const GRAPH_ORG_MODE_HELP = {
  dependencies: {
    title: 'Dependencies',
    body: 'Pure file-to-file dependency graph without folder containers. Best for tracing imports and architecture relationships.'
  },
  tree: {
    title: 'Project tree',
    body: 'Organizes the graph by real project folders. Click a folder to select, click again to expand or collapse its contents radially.'
  }
}

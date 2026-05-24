import {
  ChevronLeft,
  FileCode,
  GitBranch,
  Layers,
  LayoutGrid,
  Map,
  Search,
  SlidersHorizontal
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useGraphStore, type FilterKind, type LayerCategory } from '../../state/graph-store'

const filters: { id: FilterKind; label: string; icon: typeof FileCode }[] = [
  { id: 'all', label: 'All', icon: LayoutGrid },
  { id: 'files', label: 'Files', icon: FileCode },
  { id: 'components', label: 'Components', icon: Layers },
  { id: 'imports', label: 'Dependencies', icon: GitBranch }
]

interface GraphSidebarProps {
  onRelayout: (mode: 'hierarchy' | 'layered' | 'force' | 'clustered') => void
}

export function GraphSidebar({ onRelayout }: GraphSidebarProps) {
  const collapsed = useGraphStore((s) => s.secondarySidebarCollapsed)
  const toggle = useGraphStore((s) => s.toggleSecondarySidebar)
  const filter = useGraphStore((s) => s.filter)
  const setFilter = useGraphStore((s) => s.setFilter)
  const searchQuery = useGraphStore((s) => s.searchQuery)
  const setSearchQuery = useGraphStore((s) => s.setSearchQuery)
  const snapshot = useGraphStore((s) => s.snapshot)
  const focusedNodeId = useGraphStore((s) => s.focusedNodeId)
  const setFocusedNodeId = useGraphStore((s) => s.setFocusedNodeId)
  const setSelectedNodeId = useGraphStore((s) => s.setSelectedNodeId)
  const graphDepth = useGraphStore((s) => s.graphDepth)
  const setGraphDepth = useGraphStore((s) => s.setGraphDepth)
  const showLegend = useGraphStore((s) => s.showLegend)
  const setShowLegend = useGraphStore((s) => s.setShowLegend)
  const showMinimap = useGraphStore((s) => s.showMinimap)
  const setShowMinimap = useGraphStore((s) => s.setShowMinimap)
  const layoutModeValue = useGraphStore((s) => s.layoutMode)
  const activeLayers = useGraphStore((s) => s.activeLayers)
  const toggleLayer = useGraphStore((s) => s.toggleLayer)
  const maxNodesVisible = useGraphStore((s) => s.maxNodesVisible)
  const setMaxNodesVisible = useGraphStore((s) => s.setMaxNodesVisible)
  const setLayoutMode = useGraphStore((s) => s.setLayoutMode)

  const fileNodes =
    snapshot?.nodes.filter((n) => n.kind === 'file' || n.kind === 'component') ?? []

  const filteredFiles = fileNodes.filter((n) => {
    const q = searchQuery.toLowerCase()
    if (!q) return true
    return n.label.toLowerCase().includes(q) || n.path?.toLowerCase().includes(q)
  })

  return (
    <motion.aside
      animate={{ width: collapsed ? 0 : 260 }}
      transition={{ type: 'spring', stiffness: 400, damping: 35 }}
      className="flex flex-col h-full border-r border-border-subtle bg-surface-raised/70 backdrop-blur-xl shrink-0 overflow-hidden"
    >
      <motion.div
        className={`flex flex-col flex-1 min-w-[260px] ${collapsed ? 'opacity-0 pointer-events-none' : ''}`}
      >
        <div className="flex items-center justify-between h-10 px-3 border-b border-border-subtle">
          <span className="text-xs font-medium text-text-secondary flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Graph Controls
          </span>
          <button
            onClick={toggle}
            className="p-1 rounded hover:bg-surface-muted text-text-muted"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-2 space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
            <input
              type="text"
              placeholder="Search dependencies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-md bg-surface-overlay border border-border-subtle text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/30"
            />
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1.5 px-0.5">Layers</p>
            <div className="flex flex-wrap gap-1">
              {(['frontend','backend','auth','api','ui','database','services','utilities','core'] as LayerCategory[]).map((layer) => (
                <button key={layer} onClick={() => toggleLayer(layer)} className={`px-2 py-1 rounded text-[10px] capitalize transition-colors ${activeLayers.includes(layer) ? 'bg-accent-soft text-accent' : 'bg-surface-muted text-text-muted'}`}>
                  {layer}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1.5 px-0.5">Density</p>
            <input type="range" min={120} max={1200} step={30} value={maxNodesVisible} onChange={(e) => setMaxNodesVisible(Number(e.target.value))} className="w-full" />
            <p className="text-[10px] text-text-muted mt-1">Visible nodes cap: {maxNodesVisible}</p>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1.5 px-0.5">
              Filter
            </p>
            <div className="flex flex-wrap gap-1">
              {filters.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setFilter(id)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] transition-colors ${
                    filter === id
                      ? 'bg-accent-soft text-accent'
                      : 'text-text-muted hover:bg-surface-muted'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <motion.div>
            <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1.5 px-0.5">
              Depth from entry
            </p>
            <div className="flex gap-1">
              {[1, 2, 3, -1].map((d) => (
                <button
                  key={d}
                  onClick={() => setGraphDepth(d)}
                  className={`flex-1 py-1 rounded text-[10px] transition-colors ${
                    graphDepth === d
                      ? 'bg-accent-soft text-accent'
                      : 'bg-surface-muted text-text-muted'
                  }`}
                >
                  {d < 0 ? 'All' : d}
                </button>
              ))}
            </div>
          </motion.div>

          <div>
            <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1.5 px-0.5">
              Layout
            </p>
            <div className="flex flex-wrap gap-1">
              {(['hierarchy', 'layered', 'force', 'clustered'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => {
                    setLayoutMode(mode)
                    onRelayout(mode)
                  }}
                  className={`px-2 py-1 rounded text-[10px] capitalize transition-colors ${
                    layoutModeValue === mode
                      ? 'bg-accent-soft text-accent'
                      : 'bg-surface-muted text-text-muted'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center justify-between text-[11px] text-text-secondary">
              <span className="flex items-center gap-1.5">
                <Map className="w-3 h-3" /> Legend
              </span>
              <input
                type="checkbox"
                checked={showLegend}
                onChange={(e) => setShowLegend(e.target.checked)}
                className="accent-indigo-500"
              />
            </label>
            <label className="flex items-center justify-between text-[11px] text-text-secondary">
              <span>Minimap</span>
              <input
                type="checkbox"
                checked={showMinimap}
                onChange={(e) => setShowMinimap(e.target.checked)}
                className="accent-indigo-500"
              />
            </label>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-4">
          <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1.5 px-0.5">
            Nodes
          </p>
          <div className="space-y-0.5">
            {filteredFiles.slice(0, 150).map((node) => (
              <button
                key={node.id}
                onClick={() => {
                  setSelectedNodeId(node.id)
                  setFocusedNodeId(node.id)
                }}
                className={`w-full flex items-center gap-2 px-2 py-1 rounded-md text-left text-xs transition-colors ${
                  focusedNodeId === node.id
                    ? 'bg-accent-soft text-text-primary'
                    : 'text-text-secondary hover:bg-surface-muted'
                }`}
              >
                {node.isEntry && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                )}
                {node.kind === 'component' ? (
                  <Layers className="w-3.5 h-3.5 shrink-0 text-purple-400" />
                ) : (
                  <FileCode className="w-3.5 h-3.5 shrink-0 text-indigo-400" />
                )}
                <span className="truncate">{node.label}</span>
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.aside>
  )
}

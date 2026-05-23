import { motion } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  FileCode,
  FolderTree,
  GitBranch,
  Layers,
  LayoutGrid,
  Search,
  Sparkles
} from 'lucide-react'
import { useGraphStore, type FilterKind } from '../../state/graph-store'

const filters: { id: FilterKind; label: string; icon: typeof FileCode }[] = [
  { id: 'all', label: 'All', icon: LayoutGrid },
  { id: 'files', label: 'Files', icon: FileCode },
  { id: 'components', label: 'Components', icon: Layers },
  { id: 'imports', label: 'Dependencies', icon: GitBranch }
]

interface SidebarProps {
  onOpenProject: () => void
  onRelayout: (mode: 'layered' | 'force' | 'clustered') => void
}

export function Sidebar({ onOpenProject, onRelayout }: SidebarProps) {
  const collapsed = useGraphStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useGraphStore((s) => s.toggleSidebar)
  const filter = useGraphStore((s) => s.filter)
  const setFilter = useGraphStore((s) => s.setFilter)
  const searchQuery = useGraphStore((s) => s.searchQuery)
  const setSearchQuery = useGraphStore((s) => s.setSearchQuery)
  const snapshot = useGraphStore((s) => s.snapshot)
  const focusedNodeId = useGraphStore((s) => s.focusedNodeId)
  const setFocusedNodeId = useGraphStore((s) => s.setFocusedNodeId)
  const showFolders = useGraphStore((s) => s.showFolders)
  const setShowFolders = useGraphStore((s) => s.setShowFolders)
  const layoutMode = useGraphStore((s) => s.layoutMode)
  const setLayoutMode = useGraphStore((s) => s.setLayoutMode)

  const fileNodes = snapshot?.nodes.filter((n) => n.kind === 'file' || n.kind === 'component') ?? []

  const filteredFiles = fileNodes.filter((n) => {
    const q = searchQuery.toLowerCase()
    if (!q) return true
    return n.label.toLowerCase().includes(q) || n.path?.toLowerCase().includes(q)
  })

  return (
    <motion.aside
      animate={{ width: collapsed ? 56 : 280 }}
      transition={{ type: 'spring', stiffness: 400, damping: 35 }}
      className="relative flex flex-col h-full border-r border-border-subtle bg-surface-raised/80 backdrop-blur-xl shrink-0"
    >
      <div className="flex items-center justify-between h-12 px-3 border-b border-border-subtle">
        {!collapsed && (
          <div className="flex items-center gap-2 pl-14">
            <Sparkles className="w-4 h-4 text-accent" />
            <span className="text-sm font-semibold tracking-tight">PreBase</span>
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-lg hover:bg-surface-muted text-text-muted hover:text-text-primary transition-colors ml-auto"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {!collapsed && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="p-3 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
              <input
                type="text"
                placeholder="Search files, components..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-surface-overlay border border-border-subtle text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-all"
              />
            </div>

            <div className="flex flex-wrap gap-1">
              {filters.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setFilter(id)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] transition-colors ${
                    filter === id
                      ? 'bg-accent-soft text-accent'
                      : 'text-text-muted hover:text-text-secondary hover:bg-surface-muted'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="px-3 pb-2">
            <p className="text-[10px] uppercase tracking-wider text-text-muted font-medium mb-2">
              Explorer
            </p>
            <div className="flex-1 overflow-y-auto max-h-[calc(100vh-320px)] space-y-0.5 scrollbar-thin">
              {filteredFiles.slice(0, 200).map((node) => (
                <button
                  key={node.id}
                  onClick={() => setFocusedNodeId(node.id === focusedNodeId ? null : node.id)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs transition-colors ${
                    focusedNodeId === node.id
                      ? 'bg-accent-soft text-text-primary'
                      : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary'
                  }`}
                >
                  {node.kind === 'component' ? (
                    <Layers className="w-3.5 h-3.5 shrink-0 text-purple-400" />
                  ) : (
                    <FileCode className="w-3.5 h-3.5 shrink-0 text-indigo-400" />
                  )}
                  <span className="truncate">{node.label}</span>
                </button>
              ))}
              {filteredFiles.length > 200 && (
                <p className="text-[10px] text-text-muted px-2 py-1">
                  +{filteredFiles.length - 200} more
                </p>
              )}
            </div>
          </div>

          <div className="mt-auto p-3 border-t border-border-subtle space-y-2">
            <label className="flex items-center justify-between text-xs text-text-secondary cursor-pointer">
              <span className="flex items-center gap-2">
                <FolderTree className="w-3.5 h-3.5" />
                Show folders
              </span>
              <input
                type="checkbox"
                checked={showFolders}
                onChange={(e) => setShowFolders(e.target.checked)}
                className="rounded accent-indigo-500"
              />
            </label>

            <div className="flex gap-1">
              {(['layered', 'force', 'clustered'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => {
                    setLayoutMode(mode)
                    onRelayout(mode)
                  }}
                  className={`flex-1 py-1 rounded text-[10px] capitalize transition-colors ${
                    layoutMode === mode
                      ? 'bg-accent-soft text-accent'
                      : 'bg-surface-muted text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            {!snapshot && (
              <button
                onClick={onOpenProject}
                className="w-full py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-indigo-500 transition-colors"
              >
                Open Project
              </button>
            )}
          </div>
        </div>
      )}
    </motion.aside>
  )
}

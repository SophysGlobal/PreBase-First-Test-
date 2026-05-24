import { ChevronLeft, FileCode, Folder, Layers } from 'lucide-react'
import { motion } from 'framer-motion'
import type { GraphNode } from '../../../../core/types'
import { useGraphStore } from '../../state/graph-store'
import { buildFileTree } from '../../utils/graph-metadata'

interface CodeExplorerSidebarProps {
  onOpenProject: () => void
}

export function CodeExplorerSidebar({ onOpenProject }: CodeExplorerSidebarProps) {
  const collapsed = useGraphStore((s) => s.secondarySidebarCollapsed)
  const toggle = useGraphStore((s) => s.toggleSecondarySidebar)
  const snapshot = useGraphStore((s) => s.snapshot)
  const searchQuery = useGraphStore((s) => s.searchQuery)
  const setSearchQuery = useGraphStore((s) => s.setSearchQuery)
  const setSelectedNodeId = useGraphStore((s) => s.setSelectedNodeId)
  const setFocusedNodeId = useGraphStore((s) => s.setFocusedNodeId)
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId)

  const tree = snapshot ? buildFileTree(snapshot.nodes) : new Map()
  const dirs = [...tree.keys()].sort()

  return (
    <motion.aside
      animate={{ width: collapsed ? 0 : 260 }}
      transition={{ type: 'spring', stiffness: 400, damping: 35 }}
      className="relative flex flex-col h-full border-r border-border-subtle bg-surface-raised/70 backdrop-blur-xl shrink-0 overflow-hidden"
    >
      <div
        className={`flex flex-col flex-1 min-w-[260px] transition-opacity ${collapsed ? 'opacity-0 pointer-events-none' : ''}`}
      >
        <div className="flex items-center justify-between h-10 px-3 border-b border-border-subtle">
          <span className="text-xs font-medium text-text-secondary">Explorer</span>
          <button
            onClick={toggle}
            className="p-1 rounded hover:bg-surface-muted text-text-muted"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-2">
          <input
            type="text"
            placeholder="Filter files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs rounded-md bg-surface-overlay border border-border-subtle text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/30"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-3">
          {dirs.map((dir) => {
            const files = tree.get(dir)!.filter((f: GraphNode) => {
              const q = searchQuery.toLowerCase()
              if (!q) return true
              return f.label.toLowerCase().includes(q) || f.path?.toLowerCase().includes(q)
            })
            if (files.length === 0) return null
            return (
              <div key={dir}>
                <div className="flex items-center gap-1.5 px-1.5 py-1 text-[10px] uppercase tracking-wider text-text-muted">
                  <Folder className="w-3 h-3" />
                  {dir}
                </div>
                {files.map((f: GraphNode) => (
                  <button
                    key={f.id}
                    onClick={() => {
                      setSelectedNodeId(f.id)
                      setFocusedNodeId(f.id)
                    }}
                    className={`w-full flex items-center gap-2 px-2 py-1 rounded-md text-left text-xs transition-colors ${
                      selectedNodeId === f.id
                        ? 'bg-accent-soft text-text-primary'
                        : 'text-text-secondary hover:bg-surface-muted'
                    }`}
                  >
                    {f.kind === 'component' ? (
                      <Layers className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    ) : (
                      <FileCode className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    )}
                    <span className="truncate">{f.label}</span>
                  </button>
                ))}
              </div>
            )
          })}
        </div>

        {!snapshot && (
          <div className="p-3 border-t border-border-subtle">
            <button
              onClick={onOpenProject}
              className="w-full py-2 rounded-lg bg-accent text-white text-xs font-medium"
            >
              Open Project
            </button>
          </div>
        )}
      </div>
    </motion.aside>
  )
}

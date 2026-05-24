import { FileCode, Folder, FolderOpen, Layers } from 'lucide-react'
import type { GraphNode } from '../../../../core/types'
import { useGraphStore } from '../../state/graph-store'
import { buildFileTree } from '../../utils/graph-metadata'
import { CollapsibleSidebar } from '../layout/CollapsibleSidebar'
import { toProjectRelativePath } from '../../utils/path-utils'

interface CodeExplorerSidebarProps {
  onOpenProject: () => void
}

function isReadableFile(node: GraphNode, projectPath: string): boolean {
  if (node.kind !== 'file' && node.kind !== 'component') return false
  if (!node.path) return false
  return toProjectRelativePath(projectPath, node.path) !== null
}

export function CodeExplorerSidebar({ onOpenProject }: CodeExplorerSidebarProps) {
  const collapsed = useGraphStore((s) => s.secondarySidebarCollapsed)
  const toggle = useGraphStore((s) => s.toggleSecondarySidebar)
  const snapshot = useGraphStore((s) => s.snapshot)
  const searchQuery = useGraphStore((s) => s.searchQuery)
  const setSearchQuery = useGraphStore((s) => s.setSearchQuery)
  const openFileInCodeView = useGraphStore((s) => s.openFileInCodeView)
  const activeCodePath = useGraphStore((s) => s.activeCodePath)

  const tree = snapshot ? buildFileTree(snapshot.nodes) : new Map()
  const dirs = [...tree.keys()].sort()
  const projectPath = snapshot?.projectPath ?? ''

  return (
    <CollapsibleSidebar
      collapsed={collapsed}
      onToggle={toggle}
      title="Explorer"
      railIcon={<FolderOpen className="w-4 h-4" />}
    >
      <div className="p-2 space-y-3 pb-4">
        <input
          type="text"
          placeholder="Filter files..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-2.5 py-1.5 text-xs rounded-md bg-surface-overlay border border-border-subtle text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40"
        />

        {dirs.map((dir) => {
          const files = tree
            .get(dir)!
            .filter((f: GraphNode) => isReadableFile(f, projectPath))
            .filter((f: GraphNode) => {
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
              {files.map((f: GraphNode) => {
                const rel = toProjectRelativePath(projectPath, f.path!)
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => openFileInCodeView(f.id)}
                    className={`w-full flex items-center gap-2 px-2 py-1 rounded-md text-left text-xs transition-colors ${
                      activeCodePath === rel
                        ? 'bg-accent-soft text-text-primary'
                        : 'text-text-secondary hover:bg-surface-muted'
                    }`}
                  >
                    {f.kind === 'component' ? (
                      <Layers className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    ) : (
                      <FileCode className="w-3.5 h-3.5 text-accent shrink-0" />
                    )}
                    <span className="truncate">{f.label}</span>
                  </button>
                )
              })}
            </div>
          )
        })}

        {!snapshot && (
          <button
            type="button"
            onClick={onOpenProject}
            className="w-full py-2 rounded-lg bg-accent text-surface text-xs font-medium hover:opacity-90 transition-opacity"
          >
            Open Project
          </button>
        )}
      </div>
    </CollapsibleSidebar>
  )
}

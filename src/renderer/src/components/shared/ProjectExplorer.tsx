import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  ChevronDown,
  ChevronRight,
  FileCode,
  Folder,
  FolderOpen,
  Layers,
  List,
  Trees
} from 'lucide-react'
import type { GraphNode } from '../../../../core/types'
import {
  buildProjectTree,
  filterTree,
  flattenFiles,
  getAllDirPaths,
  type TreeEntry
} from '../../utils/project-tree'

export interface ProjectExplorerProps {
  nodes: GraphNode[]
  projectPath: string
  /** Currently selected node id (drives highlight + sync). */
  selectedId: string | null
  /** Single click — selects/highlights the node. */
  onSelect: (nodeId: string) => void
  /** Optional double click — open in code view. */
  onOpen?: (nodeId: string) => void
  viewMode: 'flat' | 'tree'
  onViewModeChange: (mode: 'flat' | 'tree') => void
}

function FileIcon({ node }: { node: GraphNode }) {
  if (node.kind === 'component')
    return <Layers className="w-3.5 h-3.5 text-purple-400 shrink-0" />
  return <FileCode className="w-3.5 h-3.5 text-accent shrink-0" />
}

interface TreeNodeProps {
  entry: TreeEntry
  depth: number
  expandedDirs: Set<string>
  toggleDir: (path: string) => void
  selectedId: string | null
  onSelect: (nodeId: string) => void
  onOpen?: (nodeId: string) => void
}

function TreeNodeRenderer({
  entry,
  depth,
  expandedDirs,
  toggleDir,
  selectedId,
  onSelect,
  onOpen
}: TreeNodeProps) {
  const indent = depth * 12

  if (entry.type === 'file') {
    const isActive = selectedId === entry.node.id
    return (
      <button
        type="button"
        onClick={() => onSelect(entry.node.id)}
        onDoubleClick={() => onOpen?.(entry.node.id)}
        className={`w-full flex items-center gap-1.5 py-[3px] pr-2 rounded-md text-left text-xs transition-colors group ${
          isActive ? 'bg-accent-soft' : 'hover:bg-surface-muted/60'
        }`}
        style={{ paddingLeft: `${indent + 6}px` }}
        title={entry.relativePath}
      >
        <FileIcon node={entry.node} />
        <span
          className={`truncate transition-colors duration-100 ${
            isActive
              ? 'text-accent font-medium'
              : 'text-text-secondary group-hover:text-text-primary'
          }`}
        >
          {entry.name}
        </span>
        {isActive && <span className="ml-auto w-1 h-1 rounded-full bg-accent shrink-0" />}
      </button>
    )
  }

  const isExpanded = expandedDirs.has(entry.fullPath)

  return (
    <div>
      <button
        type="button"
        onClick={() => toggleDir(entry.fullPath)}
        className="w-full flex items-center gap-1.5 py-[3px] pr-2 rounded-md text-left transition-colors hover:bg-surface-muted/60 group"
        style={{ paddingLeft: `${indent + 2}px` }}
      >
        {isExpanded ? (
          <ChevronDown className="w-3 h-3 text-text-muted shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 text-text-muted shrink-0" />
        )}
        {isExpanded ? (
          <FolderOpen className="w-3.5 h-3.5 text-amber-400/70 shrink-0" />
        ) : (
          <Folder className="w-3.5 h-3.5 text-text-muted shrink-0" />
        )}
        <span className="text-xs text-text-secondary group-hover:text-text-primary truncate transition-colors duration-100">
          {entry.name}
        </span>
        <span className="ml-auto text-[9px] text-text-muted opacity-0 group-hover:opacity-100 transition-opacity tabular-nums">
          {entry.children.length}
        </span>
      </button>
      {isExpanded && (
        <div>
          {entry.children.map((child) => (
            <TreeNodeRenderer
              key={child.type === 'file' ? child.node.id : child.fullPath}
              entry={child}
              depth={depth + 1}
              expandedDirs={expandedDirs}
              toggleDir={toggleDir}
              selectedId={selectedId}
              onSelect={onSelect}
              onOpen={onOpen}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function ProjectExplorer({
  nodes,
  projectPath,
  selectedId,
  onSelect,
  onOpen,
  viewMode,
  onViewModeChange
}: ProjectExplorerProps) {
  const [query, setQuery] = useState('')
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(() => new Set(['src']))

  const toggleDir = useCallback((path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const projectTree = useMemo(
    () => buildProjectTree(nodes, projectPath),
    [nodes, projectPath]
  )

  const filteredTree = useMemo(
    () => (query ? filterTree(projectTree, query) : projectTree),
    [projectTree, query]
  )

  // Auto-expand path to selected node so sidebar selection stays visible.
  useEffect(() => {
    if (!selectedId) return
    const node = nodes.find((n) => n.id === selectedId)
    if (!node?.path) return
    const rel = node.path.replace(/\\/g, '/')
    const parts = rel.split('/')
    if (parts.length <= 1) return
    setExpandedDirs((prev) => {
      const next = new Set(prev)
      let acc = ''
      for (let i = 0; i < parts.length - 1; i++) {
        acc = acc ? `${acc}/${parts[i]}` : parts[i]
        next.add(acc)
      }
      return next
    })
  }, [selectedId, nodes])

  const flatFiles = useMemo(() => flattenFiles(filteredTree), [filteredTree])
  const dirExpansion = query ? new Set(getAllDirPaths(filteredTree)) : expandedDirs

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-2 space-y-2 border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-0.5 p-0.5 bg-surface-overlay rounded-lg border border-border-subtle">
          <button
            type="button"
            onClick={() => onViewModeChange('flat')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1 rounded-md text-[10px] font-medium transition-all duration-150 ${
              viewMode === 'flat'
                ? 'bg-surface-muted text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <List className="w-3 h-3" />
            Flat
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('tree')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1 rounded-md text-[10px] font-medium transition-all duration-150 ${
              viewMode === 'tree'
                ? 'bg-surface-muted text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <Trees className="w-3 h-3" />
            Tree
          </button>
        </div>
        <input
          type="text"
          placeholder="Filter files..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full px-2.5 py-1.5 text-xs rounded-md bg-surface-overlay border border-border-subtle text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors"
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto sidebar-scroll p-1.5 pb-4">
        {viewMode === 'flat' ? (
          <div className="space-y-0.5">
            {flatFiles.map((f) => {
              const isActive = selectedId === f.node.id
              return (
                <button
                  key={f.node.id}
                  type="button"
                  onClick={() => onSelect(f.node.id)}
                  onDoubleClick={() => onOpen?.(f.node.id)}
                  className={`w-full flex items-center gap-2 px-2 py-1 rounded-md text-left text-xs transition-colors group ${
                    isActive
                      ? 'bg-accent-soft text-accent'
                      : 'text-text-secondary hover:bg-surface-muted'
                  }`}
                  title={f.relativePath}
                >
                  <FileIcon node={f.node} />
                  <span className="truncate">{f.name}</span>
                  <span className="ml-auto text-[9px] text-text-muted truncate max-w-[45%]">
                    {f.relativePath.split('/').slice(0, -1).join('/')}
                  </span>
                </button>
              )
            })}
            {flatFiles.length === 0 && (
              <p className="text-[11px] text-text-muted px-2 py-3 text-center">
                {query ? `No files match "${query}"` : 'No files'}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-0.5">
            {filteredTree.children.map((entry) => (
              <TreeNodeRenderer
                key={entry.type === 'file' ? entry.node.id : entry.fullPath}
                entry={entry}
                depth={0}
                expandedDirs={dirExpansion}
                toggleDir={toggleDir}
                selectedId={selectedId}
                onSelect={onSelect}
                onOpen={onOpen}
              />
            ))}
            {filteredTree.children.length === 0 && (
              <p className="text-[11px] text-text-muted px-2 py-3 text-center">
                {query ? `No files match "${query}"` : 'No files'}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

import { useState, useMemo, useCallback } from 'react'
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
import type { GraphNode, GraphSnapshot } from '../../../../core/types'
import { useGraphStore } from '../../state/graph-store'
import { buildFileTree } from '../../utils/graph-metadata'
import { CollapsibleSidebar } from '../layout/CollapsibleSidebar'
import { LanguageCompositionBar } from '../shared/LanguageCompositionBar'
import { toProjectRelativePath } from '../../utils/path-utils'

interface CodeExplorerSidebarProps {
  onOpenProject: () => void
}

function isReadableFile(node: GraphNode, projectPath: string): boolean {
  if (!node.path) return false
  if (node.kind !== 'file' && node.kind !== 'component') return false
  return toProjectRelativePath(projectPath, node.path) !== null
}

// ─── Tree node types ───────────────────────────────────────────────────

interface FileNode {
  type: 'file'
  node: GraphNode
  name: string
  relativePath: string
}

interface DirNode {
  type: 'dir'
  name: string
  fullPath: string
  children: TreeEntry[]
}

type TreeEntry = FileNode | DirNode

function buildProjectTree(nodes: GraphNode[], projectPath: string): DirNode {
  const root: DirNode = { type: 'dir', name: '', fullPath: '', children: [] }

  for (const node of nodes) {
    if (!isReadableFile(node, projectPath)) continue
    const rel = toProjectRelativePath(projectPath, node.path!)
    if (!rel) continue

    const parts = rel.split('/')
    let current = root

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]
      let dir = current.children.find(
        (c): c is DirNode => c.type === 'dir' && c.name === part
      )
      if (!dir) {
        dir = {
          type: 'dir',
          name: part,
          fullPath: parts.slice(0, i + 1).join('/'),
          children: []
        }
        current.children.push(dir)
      }
      current = dir
    }

    current.children.push({
      type: 'file',
      node,
      name: parts[parts.length - 1],
      relativePath: rel
    })
  }

  // Sort: dirs first, then files, each alphabetically
  function sortChildren(node: DirNode) {
    node.children.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    })
    for (const child of node.children) {
      if (child.type === 'dir') sortChildren(child)
    }
  }
  sortChildren(root)
  return root
}

function filterTree(node: DirNode, query: string): DirNode {
  if (!query) return node
  const q = query.toLowerCase()

  function filterDir(dir: DirNode): DirNode | null {
    const filtered: TreeEntry[] = []
    for (const child of dir.children) {
      if (child.type === 'file') {
        if (
          child.name.toLowerCase().includes(q) ||
          child.node.path?.toLowerCase().includes(q)
        ) {
          filtered.push(child)
        }
      } else {
        const filteredDir = filterDir(child)
        if (filteredDir) filtered.push(filteredDir)
      }
    }
    if (filtered.length === 0) return null
    return { ...dir, children: filtered }
  }

  return filterDir(node) ?? { ...node, children: [] }
}

// ─── File icon helper ──────────────────────────────────────────────────

function FileIcon({ node }: { node: GraphNode }) {
  if (node.kind === 'component')
    return <Layers className="w-3.5 h-3.5 text-purple-400 shrink-0" />
  return <FileCode className="w-3.5 h-3.5 text-accent shrink-0" />
}

// ─── Tree node renderer ────────────────────────────────────────────────

interface TreeNodeProps {
  entry: TreeEntry
  depth: number
  expandedDirs: Set<string>
  toggleDir: (path: string) => void
  activeCodePath: string | null
  openFile: (nodeId: string) => void
}

function TreeNodeRenderer({
  entry,
  depth,
  expandedDirs,
  toggleDir,
  activeCodePath,
  openFile
}: TreeNodeProps) {
  const indent = depth * 12

  if (entry.type === 'file') {
    const isActive = activeCodePath === entry.relativePath
    return (
      <button
        type="button"
        onClick={() => openFile(entry.node.id)}
        className={`w-full flex items-center gap-1.5 py-[3px] pr-2 rounded-md text-left text-xs transition-colors group`}
        style={{ paddingLeft: `${indent + 6}px` }}
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
        {isActive && (
          <span className="ml-auto w-1 h-1 rounded-full bg-accent shrink-0" />
        )}
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
              activeCodePath={activeCodePath}
              openFile={openFile}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Flat view ────────────────────────────────────────────────────────

function FlatView({
  snapshot,
  searchQuery,
  activeCodePath,
  openFile
}: {
  snapshot: GraphSnapshot | null
  searchQuery: string
  activeCodePath: string | null
  openFile: (nodeId: string) => void
}) {
  if (!snapshot) return null
  const tree = buildFileTree(snapshot.nodes)
  const dirs = [...tree.keys()].sort()
  const projectPath = snapshot.projectPath

  return (
    <>
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
            <div className="flex items-center gap-1.5 px-1.5 py-1 text-[10px] uppercase tracking-wider text-text-muted select-none">
              <Folder className="w-3 h-3 shrink-0" />
              <span className="truncate">{dir}</span>
            </div>
            {files.map((f: GraphNode) => {
              const rel = toProjectRelativePath(projectPath, f.path!)
              const isActive = activeCodePath === rel
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => openFile(f.id)}
                  className={`w-full flex items-center gap-2 px-2 py-1 rounded-md text-left text-xs transition-colors group ${
                    isActive ? 'bg-accent-soft text-accent' : 'text-text-secondary hover:bg-surface-muted'
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
    </>
  )
}

// ─── Main component ───────────────────────────────────────────────────

export function CodeExplorerSidebar({ onOpenProject }: CodeExplorerSidebarProps) {
  const collapsed = useGraphStore((s) => s.secondarySidebarCollapsed)
  const toggle = useGraphStore((s) => s.toggleSecondarySidebar)
  const snapshot = useGraphStore((s) => s.snapshot)
  const searchQuery = useGraphStore((s) => s.searchQuery)
  const setSearchQuery = useGraphStore((s) => s.setSearchQuery)
  const openFileInCodeView = useGraphStore((s) => s.openFileInCodeView)
  const activeCodePath = useGraphStore((s) => s.activeCodePath)
  const codeViewMode = useGraphStore((s) => s.codeViewMode)
  const setCodeViewMode = useGraphStore((s) => s.setCodeViewMode)

  const projectPath = snapshot?.projectPath ?? ''

  // Track expanded directories in tree mode
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(() => new Set(['src']))

  const toggleDir = useCallback((path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  // Build the project tree (memoized)
  const projectTree = useMemo(() => {
    if (!snapshot) return null
    return buildProjectTree(snapshot.nodes, projectPath)
  }, [snapshot, projectPath])

  const filteredTree = useMemo(() => {
    if (!projectTree) return null
    if (!searchQuery) return projectTree
    // When searching, expand everything
    const result = filterTree(projectTree, searchQuery)
    // Collect all dir paths and expand them
    function collectDirs(node: DirNode, paths: Set<string>) {
      for (const child of node.children) {
        if (child.type === 'dir') {
          paths.add(child.fullPath)
          collectDirs(child, paths)
        }
      }
    }
    const allDirs = new Set<string>()
    collectDirs(result, allDirs)
    if (searchQuery && allDirs.size > 0) {
      setExpandedDirs(allDirs)
    }
    return result
  }, [projectTree, searchQuery])

  return (
    <CollapsibleSidebar
      collapsed={collapsed}
      onToggle={toggle}
      title="Explorer"
      railIcon={<FolderOpen className="w-4 h-4" />}
    >
      <div className="flex flex-col h-full">
        {/* View mode toggle + search */}
        <div className="p-2 space-y-2 border-b border-border-subtle pb-2">
          {/* Segmented toggle: Flat | Tree */}
          <div className="flex items-center gap-0.5 p-0.5 bg-surface-overlay rounded-lg border border-border-subtle">
            <button
              type="button"
              onClick={() => setCodeViewMode('flat')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1 rounded-md text-[10px] font-medium transition-all duration-150 ${
                codeViewMode === 'flat'
                  ? 'bg-surface-muted text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              <List className="w-3 h-3" />
              Flat
            </button>
            <button
              type="button"
              onClick={() => setCodeViewMode('tree')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1 rounded-md text-[10px] font-medium transition-all duration-150 ${
                codeViewMode === 'tree'
                  ? 'bg-surface-muted text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              <Trees className="w-3 h-3" />
              Tree
            </button>
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="Filter files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs rounded-md bg-surface-overlay border border-border-subtle text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors"
          />
        </div>

        {snapshot && <LanguageCompositionBar nodes={snapshot.nodes} />}

        {/* File list / tree */}
        <div className="flex-1 overflow-y-auto sidebar-scroll p-1.5 pb-4">
          {!snapshot ? (
            <div className="p-2">
              <button
                type="button"
                onClick={onOpenProject}
                className="w-full py-2 rounded-lg bg-accent text-surface text-xs font-medium hover:opacity-90 transition-opacity"
              >
                Open Project
              </button>
            </div>
          ) : codeViewMode === 'flat' ? (
            <FlatView
              snapshot={snapshot}
              searchQuery={searchQuery}
              activeCodePath={activeCodePath}
              openFile={openFileInCodeView}
            />
          ) : (
            <div className="space-y-0.5">
              {filteredTree &&
                filteredTree.children.map((entry) => (
                  <TreeNodeRenderer
                    key={entry.type === 'file' ? entry.node.id : entry.fullPath}
                    entry={entry}
                    depth={0}
                    expandedDirs={searchQuery ? new Set(getAllDirPaths(filteredTree)) : expandedDirs}
                    toggleDir={toggleDir}
                    activeCodePath={activeCodePath}
                    openFile={openFileInCodeView}
                  />
                ))}
              {filteredTree && filteredTree.children.length === 0 && (
                <p className="text-[11px] text-text-muted px-2 py-3 text-center">
                  No files match &ldquo;{searchQuery}&rdquo;
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </CollapsibleSidebar>
  )
}

function getAllDirPaths(node: DirNode): string[] {
  const paths: string[] = []
  function collect(n: DirNode) {
    for (const child of n.children) {
      if (child.type === 'dir') {
        paths.push(child.fullPath)
        collect(child)
      }
    }
  }
  collect(node)
  return paths
}

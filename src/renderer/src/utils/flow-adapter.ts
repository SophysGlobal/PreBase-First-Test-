import type { Edge, Node } from '@xyflow/react'
import type { GraphNode, GraphSnapshot } from '../../../core/types'
import type { FilterKind } from '../state/graph-store'

const KIND_COLORS: Record<string, string> = {
  folder: '#52525b',
  file: '#6366f1',
  component: '#8b5cf6',
  function: '#06b6d4',
  service: '#10b981',
  module: '#71717a'
}

export function toFlowNodes(
  snapshot: GraphSnapshot,
  options: {
    searchQuery: string
    focusedNodeId: string | null
    filter: FilterKind
    showFolders: boolean
    userPositions: Record<string, { x: number; y: number }>
    dimUnrelated: boolean
  }
): Node[] {
  const query = options.searchQuery.toLowerCase().trim()
  const matchIds = new Set<string>()

  if (query) {
    for (const node of snapshot.nodes) {
      if (
        node.label.toLowerCase().includes(query) ||
        node.path?.toLowerCase().includes(query) ||
        node.meta?.exports?.some((e) => e.toLowerCase().includes(query))
      ) {
        matchIds.add(node.id)
      }
    }
  }

  if (options.focusedNodeId) {
    matchIds.add(options.focusedNodeId)
    const connected = getConnectedIds(snapshot, options.focusedNodeId)
    connected.forEach((id) => matchIds.add(id))
  }

  const hasHighlight = query.length > 0 || options.focusedNodeId !== null

  return snapshot.nodes
    .filter((node) => {
      if (!options.showFolders && node.kind === 'folder') return false
      switch (options.filter) {
        case 'files':
          return node.kind === 'file' || node.kind === 'module'
        case 'components':
          return node.kind === 'component'
        case 'imports':
          return node.kind !== 'folder'
        case 'folders':
          return node.kind === 'folder'
        default:
          return node.kind !== 'folder' || options.showFolders
      }
    })
    .map((node) => {
      const pos = options.userPositions[node.id] ?? snapshot.positions[node.id] ?? { x: 0, y: 0 }
      const isMatch = !hasHighlight || matchIds.has(node.id)
      const isFocused = node.id === options.focusedNodeId

      return {
        id: node.id,
        type: 'architecture',
        position: pos,
        data: {
          label: node.label,
          kind: node.kind,
          path: node.path,
          meta: node.meta,
          color: KIND_COLORS[node.kind] ?? KIND_COLORS.file,
          dimmed: hasHighlight && options.dimUnrelated && !isMatch,
          highlighted: isMatch && hasHighlight,
          focused: isFocused
        },
        draggable: true
      }
    })
}

export function toFlowEdges(
  snapshot: GraphSnapshot,
  options: { showFolders: boolean; focusedNodeId: string | null; searchQuery: string }
): Edge[] {
  const visibleIds = new Set(
    snapshot.nodes
      .filter((n) => options.showFolders || n.kind !== 'folder')
      .map((n) => n.id)
  )

  const highlightIds = new Set<string>()
  if (options.focusedNodeId) {
    getConnectedIds(snapshot, options.focusedNodeId).forEach((id) => highlightIds.add(id))
    highlightIds.add(options.focusedNodeId)
  }

  const hasHighlight = options.focusedNodeId !== null || options.searchQuery.trim().length > 0

  return snapshot.edges
    .filter((e) => {
      if (e.kind === 'contains' && !options.showFolders) return false
      return visibleIds.has(e.source) && visibleIds.has(e.target)
    })
    .map((edge) => {
      const highlighted =
        hasHighlight && (highlightIds.has(edge.source) || highlightIds.has(edge.target))
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'smoothstep',
        animated: edge.kind === 'import' && highlighted,
        style: {
          stroke: highlighted ? 'rgba(99, 102, 241, 0.5)' : 'rgba(255, 255, 255, 0.1)',
          strokeWidth: highlighted ? 1.5 : 1
        },
        data: { kind: edge.kind }
      }
    })
}

function getConnectedIds(snapshot: GraphSnapshot, nodeId: string): Set<string> {
  const ids = new Set<string>()
  for (const edge of snapshot.edges) {
    if (edge.source === nodeId) ids.add(edge.target)
    if (edge.target === nodeId) ids.add(edge.source)
  }
  return ids
}

export function findNodeByQuery(nodes: GraphNode[], query: string): GraphNode | null {
  const q = query.toLowerCase().trim()
  if (!q) return null
  return (
    nodes.find(
      (n) =>
        n.label.toLowerCase() === q ||
        n.path?.toLowerCase().endsWith(q) ||
        n.path?.toLowerCase().includes(q)
    ) ?? nodes.find((n) => n.label.toLowerCase().includes(q)) ?? null
  )
}

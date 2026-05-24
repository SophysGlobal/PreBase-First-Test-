import type { Edge, Node } from '@xyflow/react'
import type { GraphNode, GraphSnapshot } from '../../../core/types'
import type { FilterKind } from '../state/graph-store'
import { getNodesWithinDepth } from '../../../core/layout/hierarchy-layout'

const KIND_COLORS: Record<string, string> = {
  folder: '#52525b',
  file: '#6366f1',
  component: '#a78bfa',
  function: '#22d3ee',
  service: '#34d399',
  module: '#71717a',
  entry: '#f59e0b'
}

export function toFlowNodes(
  snapshot: GraphSnapshot,
  options: {
    searchQuery: string
    focusedNodeId: string | null
    selectedNodeId: string | null
    filter: FilterKind
    showFolders: boolean
    graphDepth: number
    userPositions: Record<string, { x: number; y: number }>
    dimUnrelated: boolean
  }
): Node[] {
  const query = options.searchQuery.toLowerCase().trim()
  const matchIds = new Set<string>()

  let depthVisible: Set<string> | null = null
  if (snapshot.entryNodeId && options.graphDepth >= 0) {
    depthVisible = getNodesWithinDepth(
      snapshot.entryNodeId,
      snapshot.edges,
      options.graphDepth
    )
    if (snapshot.entryNodeId) depthVisible.add(snapshot.entryNodeId)
  }

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

  const focusId = options.focusedNodeId ?? options.selectedNodeId
  if (focusId) {
    matchIds.add(focusId)
    getConnectedIds(snapshot, focusId).forEach((id) => matchIds.add(id))
  }

  const hasHighlight = query.length > 0 || focusId !== null

  return snapshot.nodes
    .filter((node) => {
      if (depthVisible && !depthVisible.has(node.id)) return false
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
      const isFocused = node.id === focusId
      const isSelected = node.id === options.selectedNodeId
      const isEntry = node.isEntry || node.id === snapshot.entryNodeId

      return {
        id: node.id,
        type: 'architecture',
        position: pos,
        zIndex: isEntry ? 10 : isFocused ? 5 : 1,
        data: {
          label: node.label,
          kind: node.kind,
          path: node.path,
          meta: node.meta,
          color: isEntry ? KIND_COLORS.entry : (KIND_COLORS[node.kind] ?? KIND_COLORS.file),
          dimmed: hasHighlight && options.dimUnrelated && !isMatch,
          highlighted: isMatch && hasHighlight,
          focused: isFocused,
          selected: isSelected,
          isEntry
        },
        draggable: true
      }
    })
}

export function toFlowEdges(
  snapshot: GraphSnapshot,
  options: {
    showFolders: boolean
    focusedNodeId: string | null
    selectedNodeId: string | null
    selectedEdgeId: string | null
    searchQuery: string
    graphDepth: number
  }
): Edge[] {
  const visibleNodeIds = new Set(
    toFlowNodes(snapshot, {
      searchQuery: options.searchQuery,
      focusedNodeId: options.focusedNodeId,
      selectedNodeId: options.selectedNodeId,
      filter: 'all',
      showFolders: options.showFolders,
      graphDepth: options.graphDepth,
      userPositions: snapshot.positions,
      dimUnrelated: false
    }).map((n) => n.id)
  )

  const focusId = options.focusedNodeId ?? options.selectedNodeId
  const highlightIds = new Set<string>()
  if (focusId) {
    getConnectedIds(snapshot, focusId).forEach((id) => highlightIds.add(id))
    highlightIds.add(focusId)
  }

  const hasHighlight = focusId !== null || options.searchQuery.trim().length > 0

  return snapshot.edges
    .filter((e) => {
      if (e.kind === 'contains' && !options.showFolders) return false
      if (e.kind !== 'import') return false
      return visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)
    })
    .map((edge) => {
      const highlighted =
        hasHighlight && (highlightIds.has(edge.source) || highlightIds.has(edge.target))
      const selected = edge.id === options.selectedEdgeId
      const isDynamic = edge.meta?.isDynamic

      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'architecture',
        animated: (highlighted || selected) && !isDynamic,
        selectable: true,
        style: {
          stroke: selected
            ? 'rgba(245, 158, 11, 0.85)'
            : highlighted
              ? 'rgba(99, 102, 241, 0.55)'
              : isDynamic
                ? 'rgba(168, 85, 247, 0.35)'
                : 'rgba(255, 255, 255, 0.14)',
          strokeWidth: selected ? 2 : highlighted ? 1.5 : 1,
          filter: selected ? 'drop-shadow(0 0 6px rgba(245,158,11,0.4))' : undefined
        },
        data: {
          kind: edge.kind,
          meta: edge.meta,
          sourceLabel: snapshot.nodes.find((n) => n.id === edge.source)?.label,
          targetLabel: snapshot.nodes.find((n) => n.id === edge.target)?.label
        }
      }
    })
}

function getConnectedIds(snapshot: GraphSnapshot, nodeId: string): Set<string> {
  const ids = new Set<string>()
  for (const edge of snapshot.edges) {
    if (edge.kind !== 'import') continue
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

import type { Edge, Node } from '@xyflow/react'
import type { ArchitectureLayerId } from '../../../core/utils/architecture-layers'
import type { GraphNode, GraphSnapshot } from '../../../core/types'
import type { FilterKind } from '../state/graph-store'
import { inferFileDescription } from './file-description'
import { getVisibleNodeIds } from './graph-visibility'

const KIND_COLORS: Record<string, string> = {
  folder: '#52525b',
  file: '#6366f1',
  component: '#a78bfa',
  function: '#22d3ee',
  service: '#34d399',
  module: '#71717a',
  entry: '#f59e0b'
}

const LAYER_COLORS: Partial<Record<ArchitectureLayerId, string>> = {
  frontend: '#818cf8',
  ui: '#a78bfa',
  components: '#c084fc',
  api: '#38bdf8',
  auth: '#f472b6',
  services: '#34d399',
  backend: '#2dd4bf',
  database: '#fb923c',
  utils: '#71717a',
  config: '#52525b',
  tests: '#52525b',
  other: '#6366f1'
}

export interface FlowAdapterOptions {
  searchQuery: string
  focusedNodeId: string | null
  selectedNodeId: string | null
  filter: FilterKind
  showFolders: boolean
  graphDepth: number
  layerVisibility: Record<ArchitectureLayerId, boolean>
  isolatedLayer: ArchitectureLayerId | null
  focusNeighborhood: boolean
  hideLowImportance: boolean
  userPositions: Record<string, { x: number; y: number }>
  dimOnSearch: boolean
}

function getNeighborhood(snapshot: GraphSnapshot, nodeId: string, hops: number): Set<string> {
  const set = new Set<string>([nodeId])
  let frontier = [nodeId]
  for (let h = 0; h < hops; h++) {
    const next: string[] = []
    for (const id of frontier) {
      for (const e of snapshot.edges) {
        if (e.kind !== 'import') continue
        const other = e.source === id ? e.target : e.target === id ? e.source : null
        if (other && !set.has(other)) {
          set.add(other)
          next.push(other)
        }
      }
    }
    frontier = next
  }
  return set
}

export function toFlowNodes(snapshot: GraphSnapshot, options: FlowAdapterOptions): Node[] {
  const visibleIds = getVisibleNodeIds(snapshot, {
    graphDepth: options.graphDepth,
    layerVisibility: options.layerVisibility,
    isolatedLayer: options.isolatedLayer,
    focusNeighborhood: false,
    hideLowImportance: options.hideLowImportance,
    focusedNodeId: options.focusedNodeId,
    selectedNodeId: options.selectedNodeId,
    showFolders: options.showFolders
  })

  const query = options.searchQuery.toLowerCase().trim()
  const searchMatchIds = new Set<string>()

  if (query) {
    for (const node of snapshot.nodes) {
      if (!visibleIds.has(node.id)) continue
      if (
        node.label.toLowerCase().includes(query) ||
        node.path?.toLowerCase().includes(query) ||
        node.meta?.exports?.some((e) => e.toLowerCase().includes(query))
      ) {
        searchMatchIds.add(node.id)
      }
    }
  }

  const focusId = options.focusedNodeId ?? options.selectedNodeId
  const neighborhood =
    options.focusNeighborhood && focusId
      ? getNeighborhood(snapshot, focusId, 2)
      : null

  return snapshot.nodes
    .filter((node) => {
      if (!visibleIds.has(node.id)) return false
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
      const isSelected = node.id === options.selectedNodeId
      const isFocused = node.id === focusId
      const isEntry = node.isEntry || node.id === snapshot.entryNodeId
      const archLayer = node.meta?.architectureLayer as ArchitectureLayerId | undefined

      const dimmed =
        options.dimOnSearch && query.length > 0 && !searchMatchIds.has(node.id)
      const softDimmed =
        !dimmed && neighborhood !== null && !neighborhood.has(node.id)

      return {
        id: node.id,
        type: 'architecture',
        position: pos,
        zIndex: isEntry ? 10 : isSelected ? 6 : isFocused ? 4 : 1,
        data: {
          label: node.label,
          kind: node.kind,
          path: node.path,
          meta: node.meta,
          architectureLayer: archLayer,
          color: isEntry
            ? KIND_COLORS.entry
            : (archLayer && LAYER_COLORS[archLayer]) ||
              KIND_COLORS[node.kind] ||
              KIND_COLORS.file,
          dimmed,
          softDimmed,
          highlighted: query.length > 0 && searchMatchIds.has(node.id),
          focused: isFocused,
          selected: isSelected,
          isEntry,
          description: inferFileDescription(node)
        },
        draggable: true
      }
    })
}

export function toFlowEdges(
  snapshot: GraphSnapshot,
  options: Omit<FlowAdapterOptions, 'dimOnSearch'> & { selectedEdgeId: string | null }
): Edge[] {
  const visibleNodeIds = new Set(
    toFlowNodes(snapshot, { ...options, dimOnSearch: false }).map((n) => n.id)
  )

  const focusId = options.focusedNodeId ?? options.selectedNodeId
  const highlightIds = new Set<string>()
  if (focusId) {
    getConnectedIds(snapshot, focusId).forEach((id) => highlightIds.add(id))
    highlightIds.add(focusId)
  }

  return snapshot.edges
    .filter((e) => {
      if (e.kind === 'contains' && !options.showFolders) return false
      if (e.kind !== 'import') return false
      return visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)
    })
    .map((edge) => {
      const selected = edge.id === options.selectedEdgeId
      const isDynamic = edge.meta?.isDynamic
      const connectedToFocus =
        focusId !== null &&
        (edge.source === focusId ||
          edge.target === focusId ||
          highlightIds.has(edge.source) ||
          highlightIds.has(edge.target))

      let variant: 'static' | 'dynamic' | 'highlighted' | 'selected' = 'static'
      if (selected) variant = 'selected'
      else if (connectedToFocus) variant = 'highlighted'
      else if (isDynamic) variant = 'dynamic'

      const styles = {
        static: {
          stroke: 'rgba(255, 255, 255, 0.28)',
          strokeWidth: 1,
          opacity: 0.85
        },
        dynamic: {
          stroke: 'rgba(168, 85, 247, 0.55)',
          strokeWidth: 1.1,
          opacity: 0.9
        },
        highlighted: {
          stroke: 'rgba(45, 212, 191, 0.55)',
          strokeWidth: 1.25,
          opacity: 1
        },
        selected: {
          stroke: 'rgba(245, 158, 11, 0.9)',
          strokeWidth: 1.75,
          opacity: 1
        }
      }[variant]

      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'architecture',
        animated: variant === 'highlighted' || variant === 'selected',
        selectable: true,
        style: styles,
        markerEnd: {
          type: 'arrowclosed' as const,
          width: 12,
          height: 12,
          color: styles.stroke
        },
        data: {
          kind: edge.kind,
          variant,
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

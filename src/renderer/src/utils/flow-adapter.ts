import { MarkerType, type Edge, type Node } from '@xyflow/react'
import type { ArchitectureLayerId } from '../../../core/utils/architecture-layers'
import type { GraphEdge, GraphSnapshot } from '../../../core/types'
import type { FilterKind, GraphOrganizationMode } from '../state/graph-store'
import { isTreeGraphMode } from '../state/graph-store'
import { inferFileDescription } from './file-description'
import { searchHighlightStrength } from './graph-search'
import { getVisibleNodeIds } from './graph-visibility'
import { selectVisibleImportEdgeIds } from './edge-ranking'
import {
  styleForGraphEdgeWithFocus,
  type EdgeRenderStyle
} from './edge-render-strategy'
import { getFileTypeColor } from './file-type-colors'
import { getModeNodeIds, type ArchitectureMode } from './architecture-modes'
import {
  buildChildrenIndex,
  computeRadialPositions,
  getDirectChildren,
  isNodeHiddenByCollapsedFolders
} from './folder-expansion'

const KIND_COLORS: Record<string, string> = {
  folder: '#71717a',
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

/** Canonical node fill color, shared by the tree (React Flow) and network (3D) views. */
export function nodeDisplayColor(
  node: import('../../../core/types').GraphNode,
  entryNodeId: string | null | undefined
): string {
  const isEntry = node.isEntry || node.id === entryNodeId
  if (isEntry) return '#f59e0b'
  if (node.kind === 'folder') return KIND_COLORS.folder
  if (node.path && (node.kind === 'file' || node.kind === 'component' || node.kind === 'module')) {
    return getFileTypeColor(node.path)
  }
  const archLayer = node.meta?.architectureLayer as ArchitectureLayerId | undefined
  return (
    (archLayer && LAYER_COLORS[archLayer]) || KIND_COLORS[node.kind] || KIND_COLORS.file
  )
}

export type EdgeVisualVariant =
  | 'import'
  | 'service'
  | 'utility'
  | 'entry'
  | 'component'
  | 'dynamic'
  | 'folder-link'
  | 'contains'
  | 'highlighted'
  | 'selected'

export interface FlowAdapterOptions {
  searchQuery: string
  focusedNodeId: string | null
  selectedNodeId: string | null
  filter: FilterKind
  graphOrganizationMode: GraphOrganizationMode
  graphDepth: number
  layerVisibility: Record<ArchitectureLayerId, boolean>
  isolatedLayer: ArchitectureLayerId | null
  focusNeighborhood: boolean
  hideLowImportance: boolean
  userPositions: Record<string, { x: number; y: number }>
  dimOnSearch: boolean
  expandedFolderIds: Set<string>
  dragEnabledNodeIds: Set<string>
  showEdgeLabels: boolean
  reduceAnimations?: boolean
  edgeDebugMode?: boolean
  visibleRelatedConnections?: 0 | 1 | 2
  edgeSimplificationThreshold?: number
  folderExpansionRadius?: number
  maxRenderedNodes?: number
  /**
   * When set (architecture/tree view only), restricts rendered nodes to the
   * focused architectural slice for the mode. Not used by the network view.
   */
  architectureMode?: ArchitectureMode
}

export function getNeighborhood(snapshot: GraphSnapshot, nodeId: string, hops: number): Set<string> {
  const set = new Set<string>([nodeId])
  let frontier = [nodeId]
  for (let h = 0; h < hops; h++) {
    const next: string[] = []
    for (const id of frontier) {
      for (const e of snapshot.edges) {
        if (e.kind !== 'import' && e.kind !== 'dependency') continue
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

export const FLOW_NODE_WIDTH = 64
export const FLOW_NODE_HEIGHT = 62
export const FLOW_ENTRY_HEIGHT = 66

export function styleForGraphEdge(
  edge: GraphEdge,
  snapshot: GraphSnapshot,
  focusId: string | null,
  selectedEdgeId: string | null,
  userPositions: Record<string, { x: number; y: number }> = {}
): EdgeRenderStyle & { dashed?: boolean } {
  return styleForGraphEdgeWithFocus(
    edge,
    snapshot,
    focusId,
    selectedEdgeId,
    { ...snapshot.positions, ...userPositions },
    FLOW_NODE_WIDTH,
    FLOW_NODE_HEIGHT
  )
}

function buildRadialOverrides(
  snapshot: GraphSnapshot,
  options: FlowAdapterOptions,
  visibleIds: Set<string>,
  childrenIndex: Map<string, import('../../../core/types').GraphNode[]>
): Record<string, { x: number; y: number }> {
  if (!isTreeGraphMode(options.graphOrganizationMode)) return {}

  const radialOverrides: Record<string, { x: number; y: number }> = {}
  for (const folder of snapshot.nodes) {
    if (folder.kind !== 'folder') continue
    if (!options.expandedFolderIds.has(folder.id)) continue
    const center =
      options.userPositions[folder.id] ??
      snapshot.positions[folder.id] ?? { x: 0, y: 0 }
    const children = getDirectChildren(snapshot, folder.id, childrenIndex)
      .filter((c) => visibleIds.has(c.id))
      .map((c) => c.id)
    Object.assign(
      radialOverrides,
      computeRadialPositions(center, children, options.folderExpansionRadius ?? 82)
    )
  }
  return radialOverrides
}

export function toFlowNodes(snapshot: GraphSnapshot, options: FlowAdapterOptions): Node[] {
  const childrenIndex = buildChildrenIndex(snapshot.nodes)
  const renderable = getRenderableNodeIds(snapshot, options)
  const query = options.searchQuery.trim()

  const focusId = options.focusedNodeId ?? options.selectedNodeId
  const neighborhood =
    options.focusNeighborhood && focusId
      ? getNeighborhood(snapshot, focusId, 2)
      : null

  // When a node is selected, emphasize its directly connected files and gently
  // de-emphasize everything else (Issue #1 — selection highlights relationships).
  const selectionNeighbors =
    options.selectedNodeId && !query
      ? getNeighborhood(snapshot, options.selectedNodeId, 1)
      : null

  const radialOverrides = buildRadialOverrides(snapshot, options, renderable, childrenIndex)

  return snapshot.nodes
    .filter((node) => renderable.has(node.id))
    .map((node) => {
      const pos =
        radialOverrides[node.id] ??
        options.userPositions[node.id] ??
        snapshot.positions[node.id] ??
        { x: 0, y: 0 }
      const isSelected = node.id === options.selectedNodeId
      const isFocused = node.id === focusId
      const canDrag =
        options.dragEnabledNodeIds.has(node.id) || isSelected
      const isEntry = node.isEntry || node.id === snapshot.entryNodeId
      const isFolder = node.kind === 'folder'
      const archLayer = node.meta?.architectureLayer as ArchitectureLayerId | undefined
      const folderExpanded = isFolder && options.expandedFolderIds.has(node.id)

      const highlightStrength = query ? searchHighlightStrength(node, query) : 'none'
      const isConnectedToSelection =
        selectionNeighbors !== null && selectionNeighbors.has(node.id) && !isSelected
      const dimmed =
        options.dimOnSearch && query.length > 0 && highlightStrength === 'none'
      const softDimmed =
        !dimmed &&
        ((neighborhood !== null && !neighborhood.has(node.id)) ||
          (selectionNeighbors !== null && !selectionNeighbors.has(node.id) && !isSelected))

      const nodeHeight = isEntry ? FLOW_ENTRY_HEIGHT : FLOW_NODE_HEIGHT

      return {
        id: node.id,
        type: 'architecture',
        position: pos,
        width: FLOW_NODE_WIDTH,
        height: nodeHeight,
        zIndex: isEntry ? 10 : isSelected ? 6 : isFocused ? 4 : isFolder ? 2 : 1,
        data: {
          label: node.label,
          kind: node.kind,
          path: node.path,
          meta: node.meta,
          architectureLayer: archLayer,
          color: nodeDisplayColor(node, snapshot.entryNodeId),
          dimmed,
          softDimmed,
          highlighted: highlightStrength !== 'none' || isConnectedToSelection,
          searchHighlight: highlightStrength,
          focused: isFocused,
          selected: isSelected,
          canDrag,
          isEntry,
          isFolder,
          folderExpanded,
          childCount: isFolder
            ? getDirectChildren(snapshot, node.id, childrenIndex).length
            : undefined,
          description: isFolder
            ? `Directory: ${node.path || node.label}`
            : inferFileDescription(node)
        },
        selected: isSelected,
        draggable: true
      }
    })
}

/** Node IDs that should appear on canvas — shared by nodes and edges. */
export function getRenderableNodeIds(
  snapshot: GraphSnapshot,
  options: FlowAdapterOptions
): Set<string> {
  const treeMode = isTreeGraphMode(options.graphOrganizationMode)
  const visibleIds = getVisibleNodeIds(snapshot, {
    graphDepth: options.graphDepth,
    layerVisibility: options.layerVisibility,
    isolatedLayer: options.isolatedLayer,
    focusNeighborhood: false,
    hideLowImportance: options.hideLowImportance,
    focusedNodeId: options.focusedNodeId,
    selectedNodeId: options.selectedNodeId,
    graphOrganizationMode: options.graphOrganizationMode,
    expandedFolderIds: options.expandedFolderIds,
    maxRenderedNodes: options.maxRenderedNodes
  })

  // Architecture mode slice — only render the focused architectural layer.
  // This is what stops the graph from dumping the whole project at once.
  const modeIds =
    options.architectureMode && options.architectureMode !== 'overview'
      ? getModeNodeIds(snapshot, options.architectureMode)
      : null

  const renderable = new Set<string>()
  for (const node of snapshot.nodes) {
    if (!visibleIds.has(node.id)) continue
    if (modeIds && node.kind !== 'folder' && !modeIds.has(node.id)) continue
    if (
      node.kind !== 'folder' &&
      isNodeHiddenByCollapsedFolders(
        node,
        snapshot,
        options.expandedFolderIds,
        treeMode
      )
    ) {
      continue
    }
    switch (options.filter) {
      case 'files':
        if (node.kind === 'file' || node.kind === 'module') renderable.add(node.id)
        break
      case 'components':
        if (node.kind === 'component') renderable.add(node.id)
        break
      case 'imports':
        if (node.kind !== 'folder') renderable.add(node.id)
        break
      case 'folders':
        if (node.kind === 'folder') renderable.add(node.id)
        break
      default:
        if (node.kind !== 'folder' || treeMode) renderable.add(node.id)
    }
  }
  return renderable
}

export function toFlowEdges(
  snapshot: GraphSnapshot,
  options: Omit<FlowAdapterOptions, 'dimOnSearch'> & {
    selectedEdgeId: string | null
    renderableNodeIds: Set<string>
  }
): Edge[] {
  const treeMode = isTreeGraphMode(options.graphOrganizationMode)
  const renderable = options.renderableNodeIds
  const maxRelated = options.visibleRelatedConnections ?? 2
  const visibleImportIds =
    options.edgeDebugMode ? null : selectVisibleImportEdgeIds(snapshot, maxRelated, snapshot.entryNodeId)

  // Resolve a node's on-canvas center so edges can attach to the side that faces
  // the connected node (clean 4-side contact points instead of one center point).
  const nodeById = new Map(snapshot.nodes.map((n) => [n.id, n]))
  const centerOf = (id: string): { x: number; y: number } => {
    const node = nodeById.get(id)
    const pos = options.userPositions[id] ?? snapshot.positions[id] ?? { x: 0, y: 0 }
    const h = node?.isEntry || id === snapshot.entryNodeId ? FLOW_ENTRY_HEIGHT : FLOW_NODE_HEIGHT
    return { x: pos.x + FLOW_NODE_WIDTH / 2, y: pos.y + h / 2 }
  }

  return snapshot.edges
    .filter((e) => {
      if (options.edgeDebugMode) {
        return renderable.has(e.source) && renderable.has(e.target)
      }
      if (e.kind === 'contains') {
        if (!treeMode) return false
        const parentFolder = e.source.startsWith('folder:') ? e.source : null
        if (parentFolder && !options.expandedFolderIds.has(parentFolder)) return false
        return renderable.has(e.source) && renderable.has(e.target)
      }
      if (e.kind === 'dependency') {
        if (!treeMode) return false
        return renderable.has(e.source) && renderable.has(e.target)
      }
      if (e.kind !== 'import') return false
      if (!renderable.has(e.source) || !renderable.has(e.target)) return false
      if (visibleImportIds && !visibleImportIds.has(e.id)) return false
      return true
    })
    .map((edge) => {
      const handles = pickHandles(centerOf(edge.source), centerOf(edge.target))
      if (options.edgeDebugMode) {
        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: handles.sourceHandle,
          targetHandle: handles.targetHandle,
          type: 'architecture',
          zIndex: 2,
          selectable: true,
          animated: false,
          style: {
            stroke: 'rgba(255,64,64,0.98)',
            strokeWidth: 2.8,
            opacity: 1
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 16,
            height: 16,
            color: 'rgba(255,64,64,0.98)'
          },
          data: {
            kind: edge.kind,
            variant: 'import' as EdgeVisualVariant,
            meta: edge.meta
          }
        }
      }
      const focusId = options.focusedNodeId ?? options.selectedNodeId
      const styled = styleForGraphEdgeWithFocus(
        edge,
        snapshot,
        focusId,
        options.selectedEdgeId,
        { ...snapshot.positions, ...options.userPositions },
        FLOW_NODE_WIDTH,
        FLOW_NODE_HEIGHT
      )
      const importLabel =
        options.showEdgeLabels && edge.kind === 'import'
          ? (edge.meta?.importSource as string | undefined)
          : undefined

      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: handles.sourceHandle,
        targetHandle: handles.targetHandle,
        type: 'architecture',
        zIndex: styled.zIndex,
        label: importLabel,
        labelStyle: importLabel
          ? { fill: 'rgba(161,161,170,0.85)', fontSize: 9 }
          : undefined,
        labelBgStyle: importLabel
          ? { fill: 'rgba(22,22,24,0.88)', fillOpacity: 0.92 }
          : undefined,
        // Edges are non-interactive and non-animated: animation forces continuous
        // SVG repaints (flicker + tile memory). Relationship info lives in the
        // node inspector instead.
        animated: false,
        selectable: false,
        style: {
          stroke: styled.stroke,
          strokeWidth: styled.strokeWidth,
          opacity: styled.opacity,
          strokeDasharray: styled.dashed ? '6 4' : undefined
        },
        markerEnd:
          !styled.showMarker
            ? undefined
            : {
                type: MarkerType.ArrowClosed,
                width: 14,
                height: 14,
                color: styled.stroke
              },
        data: {
          kind: edge.kind,
          variant: styled.variant,
          curvature: styled.curvature,
          meta: edge.meta,
          sourceLabel: snapshot.nodes.find((n) => n.id === edge.source)?.label,
          targetLabel: snapshot.nodes.find((n) => n.id === edge.target)?.label
        }
      }
    })
}

/** Choose source/target handle sides from the relative position of two nodes. */
function pickHandles(
  s: { x: number; y: number },
  t: { x: number; y: number }
): { sourceHandle: string; targetHandle: string } {
  const dx = t.x - s.x
  const dy = t.y - s.y
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { sourceHandle: 's-right', targetHandle: 't-left' }
      : { sourceHandle: 's-left', targetHandle: 't-right' }
  }
  return dy >= 0
    ? { sourceHandle: 's-bottom', targetHandle: 't-top' }
    : { sourceHandle: 's-top', targetHandle: 't-bottom' }
}

export function findNodeByQuery(
  nodes: import('../../../core/types').GraphNode[],
  query: string
) {
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

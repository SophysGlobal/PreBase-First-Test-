import type { GraphEdge, GraphSnapshot } from '../../../core/types'
import type { EdgeVisualVariant } from './flow-adapter'

export type EdgeVisibilityMode = 'minimal' | 'balanced' | 'detailed'

export function edgeVisibilityModeFromMaxRelated(max: 0 | 1 | 2): EdgeVisibilityMode {
  if (max <= 0) return 'minimal'
  if (max === 1) return 'balanced'
  return 'detailed'
}

export function maxRelatedFromEdgeVisibilityMode(mode: EdgeVisibilityMode): 0 | 1 | 2 {
  if (mode === 'minimal') return 0
  if (mode === 'balanced') return 1
  return 2
}

export interface EdgeRenderState {
  isConnectedToSelection: boolean
  isPrimary: boolean
  isSecondary: boolean
  isLongDistance: boolean
  isUnrelatedDuringSelection: boolean
  edgeType: GraphEdge['kind']
  variant: EdgeVisualVariant
}

export interface EdgeRenderStyle {
  variant: EdgeVisualVariant
  stroke: string
  strokeWidth: number
  opacity: number
  dashed?: boolean
  curvature: number
  showMarker: boolean
  zIndex: number
}

const LONG_EDGE_THRESHOLD = 360

const BASE_STYLES: Record<
  EdgeVisualVariant,
  { stroke: string; strokeWidth: number; opacity: number; dashed?: boolean }
> = {
  import: { stroke: 'rgba(240,244,255,0.82)', strokeWidth: 1.4, opacity: 0.82 },
  service: { stroke: 'rgba(74,222,168,0.85)', strokeWidth: 1.4, opacity: 0.85 },
  utility: { stroke: 'rgba(180,180,196,0.70)', strokeWidth: 1.15, opacity: 0.68, dashed: true },
  entry: { stroke: 'rgba(250,176,40,0.88)', strokeWidth: 1.5, opacity: 0.88 },
  dynamic: { stroke: 'rgba(196,120,255,0.78)', strokeWidth: 1.25, opacity: 0.76, dashed: true },
  component: { stroke: 'rgba(205,190,255,0.78)', strokeWidth: 1.25, opacity: 0.76 },
  'folder-link': { stroke: 'rgba(160,160,176,0.60)', strokeWidth: 1.05, opacity: 0.56, dashed: true },
  contains: { stroke: 'rgba(113,113,122,0.30)', strokeWidth: 0.80, opacity: 0.34, dashed: true },
  highlighted: { stroke: 'rgba(94,234,212,0.96)', strokeWidth: 1.85, opacity: 1.0 },
  selected: { stroke: 'rgba(250,176,40,1)', strokeWidth: 2.05, opacity: 1 }
}

function classifyEdgeVariant(
  edge: GraphEdge,
  snapshot: GraphSnapshot,
  focusId: string | null,
  selected: boolean
): EdgeVisualVariant {
  if (selected) return 'selected'
  if (focusId && (edge.source === focusId || edge.target === focusId)) {
    return 'highlighted'
  }
  if (edge.kind === 'contains') return 'contains'
  if (edge.kind === 'dependency') return 'folder-link'
  if (edge.meta?.isDynamic) return 'dynamic'

  const source = snapshot.nodes.find((n) => n.id === edge.source)
  const target = snapshot.nodes.find((n) => n.id === edge.target)

  if (
    source?.isEntry ||
    source?.id === snapshot.entryNodeId ||
    target?.isEntry ||
    target?.id === snapshot.entryNodeId
  ) {
    return 'entry'
  }

  const targetLayer = target?.meta?.architectureLayer
  if (targetLayer === 'services' || target?.kind === 'service') return 'service'
  if (targetLayer === 'utils' || targetLayer === 'config') return 'utility'
  if (target?.kind === 'component' || target?.meta?.isComponent) return 'component'
  return 'import'
}

function edgeLength(
  snapshot: GraphSnapshot,
  edge: GraphEdge,
  positions: Record<string, { x: number; y: number }>,
  nodeWidth: number,
  nodeHeight: number
): number {
  const sourcePos = positions[edge.source] ?? snapshot.positions[edge.source] ?? { x: 0, y: 0 }
  const targetPos = positions[edge.target] ?? snapshot.positions[edge.target] ?? { x: 0, y: 0 }
  const sx = sourcePos.x + nodeWidth / 2
  const sy = sourcePos.y + nodeHeight / 2
  const tx = targetPos.x + nodeWidth / 2
  const ty = targetPos.y + nodeHeight / 2
  return Math.hypot(tx - sx, ty - sy)
}

export function computeEdgeRenderState(
  edge: GraphEdge,
  snapshot: GraphSnapshot,
  focusId: string | null,
  selectedEdgeId: string | null,
  positions: Record<string, { x: number; y: number }>,
  nodeWidth: number,
  nodeHeight: number
): EdgeRenderState {
  const selectionId = focusId

  const variant = classifyEdgeVariant(
    edge,
    snapshot,
    focusId,
    edge.id === selectedEdgeId
  )

  const isDirect =
    !!selectionId && (edge.source === selectionId || edge.target === selectionId)
  const isConnectedToSelection = isDirect
  const isPrimary = isDirect && edge.kind === 'import'
  const isSecondary = false
  const length = edgeLength(snapshot, edge, positions, nodeWidth, nodeHeight)
  const isLongDistance = length > LONG_EDGE_THRESHOLD
  const isUnrelatedDuringSelection =
    !!selectionId && !isConnectedToSelection && edge.kind !== 'contains'

  return {
    isConnectedToSelection,
    isPrimary,
    isSecondary,
    isLongDistance,
    isUnrelatedDuringSelection,
    edgeType: edge.kind,
    variant
  }
}

export function computeEdgeRenderStyle(
  state: EdgeRenderState,
  baseVariant: EdgeVisualVariant = state.variant
): EdgeRenderStyle {
  const base = BASE_STYLES[baseVariant]
  let opacity = base.opacity
  let strokeWidth = base.strokeWidth
  let variant = baseVariant
  let zIndex = state.edgeType === 'contains' ? 0 : 1
  let stroke = base.stroke

  if (state.isUnrelatedDuringSelection) {
    opacity = state.edgeType === 'contains' ? 0.06 : 0.1
    strokeWidth = Math.max(0.65, base.strokeWidth * 0.75)
    zIndex = 0
  } else if (state.isPrimary) {
    variant = 'highlighted'
    const highlighted = BASE_STYLES.highlighted
    opacity = highlighted.opacity
    strokeWidth = highlighted.strokeWidth
    zIndex = 4
  } else if (state.isConnectedToSelection && state.variant === 'highlighted') {
    opacity = BASE_STYLES.highlighted.opacity
    strokeWidth = BASE_STYLES.highlighted.strokeWidth
    zIndex = 3
  } else if (state.isSecondary) {
    opacity = Math.min(base.opacity * 1.15, 0.62)
    strokeWidth = base.strokeWidth
    zIndex = 2
  } else if (state.isLongDistance && !state.isConnectedToSelection) {
    opacity *= 0.72
    strokeWidth = Math.max(0.7, strokeWidth * 0.92)
  }

  const curvature =
    state.isLongDistance && !state.isPrimary
      ? 0.38
      : state.isPrimary
        ? 0.22
        : baseVariant === 'dynamic'
          ? 0.35
          : 0.28

  return {
    variant,
    stroke: variant === 'highlighted' || variant === 'selected' ? BASE_STYLES[variant].stroke : stroke,
    strokeWidth,
    opacity,
    dashed: base.dashed,
    curvature,
    showMarker: state.edgeType !== 'contains',
    zIndex
  }
}

export function styleForGraphEdgeWithFocus(
  edge: GraphEdge,
  snapshot: GraphSnapshot,
  focusId: string | null,
  selectedEdgeId: string | null,
  positions: Record<string, { x: number; y: number }>,
  nodeWidth: number,
  nodeHeight: number
): EdgeRenderStyle & { dashed?: boolean } {
  const state = computeEdgeRenderState(
    edge,
    snapshot,
    focusId,
    selectedEdgeId,
    positions,
    nodeWidth,
    nodeHeight
  )
  const styled = computeEdgeRenderStyle(state, state.variant)
  return styled
}

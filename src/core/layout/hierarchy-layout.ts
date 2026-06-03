import type { GraphEdge, GraphNode, LayoutPosition } from '../types'
import {
  computeDependencyDepths,
  labelForDepth,
  type DependencyDepthResult
} from './dependency-depth'
import {
  DEFAULT_LAYOUT_RUNTIME,
  mergeLayoutRuntime,
  type LayoutRuntimeConfig
} from './layout-config'
import {
  applyUniversalLayoutConstraints,
  centerGraph,
  LAYOUT_NODE_BOX
} from './layout-constraints'

export interface HierarchyLayoutOptions {
  entryNodeId: string
  runtime?: Partial<LayoutRuntimeConfig>
  nodeWidth?: number
  nodeGap?: number
  maxRadius?: number
}

export interface HierarchyRingLabel {
  depth: number
  label: string
  radius: number
  x: number
  y: number
}

export interface PyramidLayerLabel {
  depth: number
  label: string
  x: number
  y: number
}

const NODE_W = 168
const NODE_GAP = 28
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

const HIERARCHY_DEFAULTS = {
  maxRadius: 520,
  subRingGap: 36,
  nodeWidth: NODE_W,
  nodeGap: NODE_GAP
}

const SCATTER_DEFAULTS = {
  maxRadius: 440,
  nodeWidth: NODE_W,
  nodeGap: 26,
  minNodeDist: 188
}

const PYRAMID_DEFAULTS = {
  tierGap: 96,
  rowHeight: 88,
  boxW: 176,
  boxH: 60,
  minColWidth: 168
}

function minRadiusForCount(count: number, nodeWidth: number, gap: number): number {
  if (count <= 1) return 0
  const chord = nodeWidth + gap
  return (count * chord) / (2 * Math.PI)
}

function depthBaseRadius(depth: number, runtime: LayoutRuntimeConfig): number {
  if (depth <= 0) return 0
  return (runtime.centerClearance + (depth - 1) * runtime.layerGap) * runtime.layerRadiusScale
}

function ringRadiusForLayer(count: number, depth: number, runtime: LayoutRuntimeConfig, maxRadius: number): number {
  const base = depthBaseRadius(depth, runtime)
  const minR = minRadiusForCount(count, NODE_W, NODE_GAP)
  return Math.min(maxRadius, Math.max(base, minR))
}

function placeOnRing(
  ids: string[],
  radius: number,
  positions: Record<string, LayoutPosition>
): void {
  if (ids.length === 0) return
  if (ids.length === 1) {
    positions[ids[0]] = { x: 0, y: -radius }
    return
  }
  ids.forEach((id, i) => {
    const angle = (2 * Math.PI * i) / ids.length - Math.PI / 2
    positions[id] = {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius
    }
  })
}

function placeOnGoldenRing(
  ids: string[],
  radius: number,
  positions: Record<string, LayoutPosition>,
  depth: number
): void {
  if (ids.length === 0) return
  const phase = depth * 0.35
  ids.forEach((id, i) => {
    const angle = i * GOLDEN_ANGLE + phase - Math.PI / 2
    positions[id] = {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius
    }
  })
}

function balanceSpacing(
  positions: Record<string, LayoutPosition>,
  ids: string[],
  anchors: Record<string, LayoutPosition>,
  minDist: number,
  iterations: number,
  anchorStrength = 0.12
): void {
  if (ids.length < 2) return

  for (let pass = 0; pass < iterations; pass++) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = positions[ids[i]]
        const b = positions[ids[j]]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dist = Math.hypot(dx, dy) || 0.001
        if (dist >= minDist) continue
        const push = (minDist - dist) / 2
        const nx = dx / dist
        const ny = dy / dist
        a.x -= nx * push
        a.y -= ny * push
        b.x += nx * push
        b.y += ny * push
      }
    }

    for (const id of ids) {
      const anchor = anchors[id]
      if (!anchor) continue
      const p = positions[id]
      p.x += (anchor.x - p.x) * anchorStrength
      p.y += (anchor.y - p.y) * anchorStrength
    }
  }
}

function placeLayerRings(
  depth: number,
  ids: string[],
  runtime: LayoutRuntimeConfig,
  maxRadius: number,
  positions: Record<string, LayoutPosition>,
  useGolden: boolean
): void {
  if (ids.length === 0) return

  const maxPer = Math.max(4, runtime.maxNodesPerLayer)
  if (ids.length <= maxPer) {
    const radius = ringRadiusForLayer(ids.length, depth, runtime, maxRadius)
    if (useGolden) placeOnGoldenRing(ids, radius, positions, depth)
    else placeOnRing(ids, radius, positions)
    return
  }

  const ringCount = Math.ceil(ids.length / maxPer)
  for (let ringIndex = 0; ringIndex < ringCount; ringIndex++) {
    const slice = ids.slice(ringIndex * maxPer, (ringIndex + 1) * maxPer)
    const base = depthBaseRadius(depth, runtime)
    const minR = minRadiusForCount(slice.length, NODE_W, NODE_GAP)
    const radius = Math.min(
      maxRadius,
      Math.max(base + ringIndex * HIERARCHY_DEFAULTS.subRingGap, minR)
    )
    if (useGolden) placeOnGoldenRing(slice, radius, positions, depth + ringIndex * 0.2)
    else placeOnRing(slice, radius, positions)
  }
}

export function computeHierarchyLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: HierarchyLayoutOptions
): Record<string, LayoutPosition> {
  const runtime = mergeLayoutRuntime(options.runtime)
  const maxRadius = options.maxRadius ?? HIERARCHY_DEFAULTS.maxRadius
  const { layers, entryNodeId } = computeDependencyDepths(nodes, edges, options.entryNodeId)
  const positions: Record<string, LayoutPosition> = {}

  for (const [depth, ids] of [...layers.entries()].sort((a, b) => a[0] - b[0])) {
    if (depth === 0) {
      positions[entryNodeId] = { x: 0, y: 0 }
      continue
    }
    placeLayerRings(depth, ids, runtime, maxRadius, positions, false)
  }

  applyUniversalLayoutConstraints(positions)
  centerGraph(positions)
  return positions
}

export function computeScatterLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: HierarchyLayoutOptions
): Record<string, LayoutPosition> {
  const runtime = mergeLayoutRuntime({
    ...options.runtime,
    layerGap: (options.runtime?.layerGap ?? DEFAULT_LAYOUT_RUNTIME.layerGap) * 0.92,
    centerClearance: (options.runtime?.centerClearance ?? DEFAULT_LAYOUT_RUNTIME.centerClearance) * 0.95
  })
  const maxRadius = options.maxRadius ?? SCATTER_DEFAULTS.maxRadius
  const { layers, entryNodeId } = computeDependencyDepths(nodes, edges, options.entryNodeId)
  const positions: Record<string, LayoutPosition> = {}
  const anchors: Record<string, LayoutPosition> = {}

  for (const [depth, ids] of [...layers.entries()].sort((a, b) => a[0] - b[0])) {
    if (depth === 0) {
      positions[entryNodeId] = { x: 0, y: 0 }
      continue
    }

    const radius = ringRadiusForLayer(ids.length, depth, runtime, maxRadius)
    placeOnGoldenRing(ids, radius, positions, depth)
    for (const id of ids) {
      anchors[id] = { ...positions[id] }
    }
    balanceSpacing(
      positions,
      ids,
      anchors,
      SCATTER_DEFAULTS.minNodeDist,
      runtime.scatterRelaxIterations,
      0.18
    )
  }

  applyUniversalLayoutConstraints(positions)
  centerGraph(positions)
  return positions
}

export function computePyramidLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: HierarchyLayoutOptions
): Record<string, LayoutPosition> {
  const runtime = mergeLayoutRuntime(options.runtime)
  const { layers, entryNodeId } = computeDependencyDepths(nodes, edges, options.entryNodeId)
  const positions: Record<string, LayoutPosition> = {}
  const { tierGap, rowHeight, boxW, minColWidth } = PYRAMID_DEFAULTS
  const maxPerRow = Math.max(4, runtime.maxNodesPerLayer)

  for (const [depth, ids] of [...layers.entries()].sort((a, b) => a[0] - b[0])) {
    if (depth === 0) {
      positions[entryNodeId] = { x: 0, y: 0 }
      continue
    }

    const rowCount = Math.ceil(ids.length / maxPerRow)
    const colWidth = Math.max(minColWidth, boxW + 16)

    for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
      const rowIds = ids.slice(rowIndex * maxPerRow, (rowIndex + 1) * maxPerRow)
      const y = depth * tierGap + rowIndex * rowHeight
      const span = Math.max(0, (rowIds.length - 1) * colWidth)
      rowIds.forEach((id, i) => {
        positions[id] = { x: -span / 2 + i * colWidth, y }
      })
    }
  }

  applyUniversalLayoutConstraints(positions)
  centerGraph(positions)
  return positions
}

const LABEL_ABOVE_PAD = 40

export function getHierarchyRingLabels(
  nodes: GraphNode[],
  edges: GraphEdge[],
  entryNodeId: string,
  runtimePartial?: Partial<LayoutRuntimeConfig>,
  visibleNodeIds?: Set<string>
): HierarchyRingLabel[] {
  const runtime = mergeLayoutRuntime(runtimePartial)
  const { layers } = computeDependencyDepths(nodes, edges, entryNodeId)
  const labels: HierarchyRingLabel[] = []
  const maxRadius = HIERARCHY_DEFAULTS.maxRadius

  for (const depth of [...layers.keys()].sort((a, b) => a - b)) {
    const ids = layers.get(depth) ?? []
    const visibleAtDepth =
      !visibleNodeIds || depth === 0
        ? ids
        : ids.filter((id) => visibleNodeIds.has(id))
    if (visibleAtDepth.length === 0) continue

    if (depth === 0) {
      labels.push({
        depth: 0,
        label: labelForDepth(0),
        radius: 0,
        x: 0,
        y: -LAYOUT_NODE_BOX.height / 2 - 24
      })
      continue
    }

    const radius = ringRadiusForLayer(ids.length, depth, runtime, maxRadius)
    labels.push({
      depth,
      label: labelForDepth(depth),
      radius,
      x: 0,
      y: -radius - LABEL_ABOVE_PAD
    })
  }

  return labels
}

export function getPyramidLayerLabels(
  nodes: GraphNode[],
  edges: GraphEdge[],
  entryNodeId: string,
  runtimePartial?: Partial<LayoutRuntimeConfig>,
  visibleNodeIds?: Set<string>
): PyramidLayerLabel[] {
  const runtime = mergeLayoutRuntime(runtimePartial)
  const { layers } = computeDependencyDepths(nodes, edges, entryNodeId)
  const labels: PyramidLayerLabel[] = []
  const { tierGap, rowHeight, minColWidth } = PYRAMID_DEFAULTS
  const maxPerRow = Math.max(4, runtime.maxNodesPerLayer)

  for (const depth of [...layers.keys()].sort((a, b) => a - b)) {
    const ids = layers.get(depth) ?? []
    const visibleAtDepth =
      !visibleNodeIds || depth === 0
        ? ids
        : ids.filter((id) => visibleNodeIds.has(id))
    if (visibleAtDepth.length === 0) continue

    if (depth === 0) {
      labels.push({ depth: 0, label: labelForDepth(0), x: -72, y: -8 })
      continue
    }

    const rowCount = Math.ceil(ids.length / maxPerRow)
    const colWidth = Math.max(minColWidth, PYRAMID_DEFAULTS.boxW + 16)
    const bottomRow = rowCount - 1
    const rowIds = ids.slice(bottomRow * maxPerRow, (bottomRow + 1) * maxPerRow)
    const span = Math.max(0, (rowIds.length - 1) * colWidth)
    const minX = rowIds.length > 0 ? -span / 2 : 0
    const y = depth * tierGap + bottomRow * rowHeight

    labels.push({
      depth,
      label: labelForDepth(depth),
      x: minX - 88,
      y
    })
  }

  return labels
}

export function getNodesWithinDepth(
  entryNodeId: string,
  edges: GraphEdge[],
  maxDepth: number
): Set<string> {
  const visible = new Set<string>([entryNodeId])
  if (maxDepth < 0) {
    for (const e of edges) {
      if (e.kind !== 'import') continue
      visible.add(e.source)
      visible.add(e.target)
    }
    return visible
  }

  const outbound = new Map<string, string[]>()
  for (const e of edges) {
    if (e.kind !== 'import') continue
    if (!outbound.has(e.source)) outbound.set(e.source, [])
    outbound.get(e.source)!.push(e.target)
  }

  let frontier = [entryNodeId]
  for (let d = 0; d < maxDepth; d++) {
    const next: string[] = []
    for (const id of frontier) {
      for (const t of outbound.get(id) ?? []) {
        if (!visible.has(t)) {
          visible.add(t)
          next.push(t)
        }
      }
    }
    frontier = next
  }

  return visible
}

export type { DependencyDepthResult }

import type { GraphEdge, GraphNode, LayoutPosition } from '../types'
import {
  computeDependencyDepths,
  labelForDepth,
  type DependencyDepthResult
} from './dependency-depth'
import {
  mergeLayoutRuntime,
  type LayoutRuntimeConfig
} from './layout-config'
import {
  cellHeight,
  cellWidth,
  centerGraph,
  centerGraphHorizontally,
  convertCentersToTopLeft,
  boxesOverlap,
  finalizeLayoutPositions,
  finalizePyramidLayout,
  finalizeScatterLayout,
  pyramidMaxHeight,
  scatterMaxRadius,
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

const NODE_W = LAYOUT_NODE_BOX.width
const NODE_GAP = 32
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

function hash01(id: string, salt = 0): number {
  let h = salt
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return ((h >>> 0) % 1000) / 1000
}

const SCATTER_DEFAULTS = {
  minNodeDist: 96
}

const PYRAMID_DEFAULTS = {
  tierGapMul: 1.28,
  rowGapMul: 1.12
}

function finishLayout(
  positions: Record<string, LayoutPosition>,
  options: { minDist?: number; maxSpread?: number }
): void {
  const { width, height } = LAYOUT_NODE_BOX
  convertCentersToTopLeft(positions, width, height)
  finalizeLayoutPositions(positions, options)
}

function hasCenterOverlap(
  positions: Record<string, LayoutPosition>,
  id: string,
  cx: number,
  cy: number
): boolean {
  const tlX = cx - LAYOUT_NODE_BOX.width / 2
  const tlY = cy - LAYOUT_NODE_BOX.height / 2
  for (const [otherId, p] of Object.entries(positions)) {
    if (otherId === id) continue
    const otlX = p.x - LAYOUT_NODE_BOX.width / 2
    const otlY = p.y - LAYOUT_NODE_BOX.height / 2
    if (
      boxesOverlap(
        tlX,
        tlY,
        otlX,
        otlY,
        LAYOUT_NODE_BOX.width,
        LAYOUT_NODE_BOX.height,
        LAYOUT_NODE_BOX.gap
      )
    ) {
      return true
    }
  }
  return false
}

function scaledGap(runtime: LayoutRuntimeConfig): number {
  return NODE_GAP * (runtime.spacingScale ?? 1)
}

function scaledMinDist(runtime: LayoutRuntimeConfig): number {
  return LAYOUT_NODE_BOX.minDist * (runtime.spacingScale ?? 1)
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
  const minR = minRadiusForCount(count, NODE_W, scaledGap(runtime))
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
  const ringStep = Math.max(LAYOUT_NODE_BOX.minDist, cellHeight() * 1.05)
  let prevRadius = depth > 0 ? depthBaseRadius(depth - 1, runtime) : 0
  for (let ringIndex = 0; ringIndex < ringCount; ringIndex++) {
    const slice = ids.slice(ringIndex * maxPer, (ringIndex + 1) * maxPer)
    const base = depthBaseRadius(depth, runtime)
    const minR = minRadiusForCount(slice.length, NODE_W, scaledGap(runtime))
    const radius = Math.min(
      maxRadius,
      Math.max(base, minR, prevRadius + ringStep)
    )
    prevRadius = radius
    if (useGolden) placeOnGoldenRing(slice, radius, positions, depth + ringIndex * 0.2)
    else placeOnRing(slice, radius, positions)
  }
}

function hierarchyMaxRadius(nodeCount: number, spacingScale = 1): number {
  const n = Math.max(1, nodeCount)
  return Math.min(520, 110 + Math.sqrt(n) * 34) * spacingScale
}

export function computeHierarchyLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: HierarchyLayoutOptions
): Record<string, LayoutPosition> {
  const runtime = mergeLayoutRuntime(options.runtime)
  const nodeCount = nodes.filter((n) => n.kind !== 'folder').length
  const scale = runtime.spacingScale ?? 1
  const maxRadius = options.maxRadius ?? hierarchyMaxRadius(nodeCount, scale)
  const { layers, entryNodeId } = computeDependencyDepths(nodes, edges, options.entryNodeId)
  const positions: Record<string, LayoutPosition> = {}

  for (const [depth, ids] of [...layers.entries()].sort((a, b) => a[0] - b[0])) {
    if (depth === 0) {
      positions[entryNodeId] = { x: 0, y: 0 }
      continue
    }
    placeLayerRings(depth, ids, runtime, maxRadius, positions, false)
  }

  centerGraph(positions)
  finishLayout(positions, {
    minDist: scaledMinDist(runtime),
    maxSpread: hierarchyMaxRadius(nodeCount, scale)
  })
  return positions
}

export function computeScatterLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: HierarchyLayoutOptions
): Record<string, LayoutPosition> {
  const runtime = mergeLayoutRuntime(options.runtime)
  const scale = runtime.spacingScale ?? 1
  const { entryNodeId } = computeDependencyDepths(nodes, edges, options.entryNodeId)
  const positions: Record<string, LayoutPosition> = {}
  const nodeCount = nodes.filter((n) => n.kind !== 'folder').length
  const maxSpread = scatterMaxRadius(nodeCount, scale)
  const minDist = SCATTER_DEFAULTS.minNodeDist * scale
  positions[entryNodeId] = { x: 0, y: 0 }

  const otherIds = nodes
    .filter((n) => n.kind !== 'folder' && n.id !== entryNodeId)
    .map((n) => n.id)
    .sort((a, b) => a.localeCompare(b))

  let spiral = 0
  for (const id of otherIds) {
    let placed = false
    for (let attempt = 0; attempt < 140; attempt++) {
      const h1 = hash01(id, attempt)
      const h2 = hash01(id, attempt + 19)
      const h3 = hash01(id, attempt + 47)
      const h4 = hash01(id, attempt + 83)
      const angle = h1 * Math.PI * 2 + h3 * 0.6
      const radius = Math.sqrt(h2) * maxSpread * (0.42 + h4 * 0.48)
      const x = Math.cos(angle) * radius + (h3 - 0.5) * minDist * 0.22
      const y = Math.sin(angle) * radius * (0.72 + h4 * 0.22) + (h4 - 0.5) * minDist * 0.18
      if (!hasCenterOverlap(positions, id, x, y)) {
        positions[id] = { x, y }
        placed = true
        break
      }
    }
    if (!placed) {
      const angle = spiral * GOLDEN_ANGLE * 1.31 + hash01(id, 3) * 0.4
      const radius = minDist * (0.9 + spiral * 0.16)
      positions[id] = {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius * 0.78
      }
      spiral++
    }
  }

  finalizeScatterLayout(positions, { minDist: scaledMinDist(runtime), maxSpread })
  centerGraph(positions)
  return positions
}

export function computePyramidLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: HierarchyLayoutOptions
): Record<string, LayoutPosition> {
  const runtime = mergeLayoutRuntime(options.runtime)
  const scale = runtime.spacingScale ?? 1
  const { layers, entryNodeId } = computeDependencyDepths(nodes, edges, options.entryNodeId)
  const positions: Record<string, LayoutPosition> = {}
  const layoutNodeCount = nodes.filter((n) => n.kind !== 'folder').length
  const maxDepth = Math.max(1, ...[...layers.keys()])
  const cw = cellWidth() * scale
  const ch = cellHeight() * scale
  const tierGap = ch * PYRAMID_DEFAULTS.tierGapMul
  const rowGap = cellHeight() * scale
  const maxRowWidth = Math.min(
    560 * scale,
    Math.max(240 * scale, Math.ceil(Math.sqrt(Math.max(1, layoutNodeCount))) * cw * 1.75)
  )
  const maxPerRow = Math.max(
    2,
    Math.min(runtime.maxNodesPerLayer, Math.floor(maxRowWidth / Math.max(cw, 1)))
  )

  function tierCapacity(depth: number): number {
    const t = Math.pow(depth / maxDepth, 1.05)
    return Math.min(maxPerRow, Math.max(1, Math.ceil(maxPerRow * t)))
  }

  const topPad = 48 * scale
  positions[entryNodeId] = { x: 0, y: topPad + LAYOUT_NODE_BOX.height / 2 }
  const firstTierCenter = topPad + LAYOUT_NODE_BOX.height + LAYOUT_NODE_BOX.gap + LAYOUT_NODE_BOX.height / 2

  for (const [depth, ids] of [...layers.entries()].sort((a, b) => a[0] - b[0])) {
    if (depth === 0) continue

    const sorted = [...ids].sort((a, b) => a.localeCompare(b))
    const tierMax = tierCapacity(depth)
    const rowCount = Math.ceil(sorted.length / tierMax)

    for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
      const rowIds = sorted.slice(rowIndex * tierMax, (rowIndex + 1) * tierMax)
      const y = firstTierCenter + (depth - 1) * tierGap + rowIndex * rowGap
      const span = Math.max(0, (rowIds.length - 1) * cw)
      rowIds.forEach((id, i) => {
        positions[id] = { x: -span / 2 + i * cw, y }
      })
    }
  }

  centerGraphHorizontally(positions)
  finalizePyramidLayout(positions, {
    minDist: scaledMinDist(runtime),
    maxSpread: pyramidMaxHeight(layoutNodeCount, scale)
  })
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
  const layoutNodeCount = nodes.filter((n) => n.kind !== 'folder').length
  const maxRadius = hierarchyMaxRadius(
    layoutNodeCount,
    mergeLayoutRuntime(runtimePartial).spacingScale ?? 1
  )

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
  const { tierGapMul, rowGapMul } = PYRAMID_DEFAULTS
  const cw = cellWidth()
  const ch = cellHeight()
  const tierGap = ch * tierGapMul
  const rowHeight = ch * rowGapMul
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
    const colWidth = cw
    const bottomRow = rowCount - 1
    const rowIds = ids.slice(bottomRow * maxPerRow, (bottomRow + 1) * maxPerRow)
    const span = Math.max(0, (rowIds.length - 1) * colWidth)
    const minX = rowIds.length > 0 ? -span / 2 : 0
    const firstTier = ch + LAYOUT_NODE_BOX.gap + ch / 2
    const y = firstTier + (depth - 1) * tierGap + bottomRow * rowHeight

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

import type { GraphEdge, GraphNode, LayoutPosition } from '../types'
import {
  computeDependencyDepths,
  type DependencyDepthResult
} from './dependency-depth'
import {
  computeOrganizationLayers,
  type LayoutOrganizationMethod
} from './layout-organization'
import {
  mergeLayoutRuntime,
  type LayoutRuntimeConfig
} from './layout-config'
import { depthLevelColor } from './layout-depth-colors'
import {
  cellHeight,
  cellWidth,
  centerGraph,
  centerLayoutHorizontally,
  convertCentersToTopLeft,
  boxesOverlap,
  finalizePyramidLayoutTopLeft,
  finalizeScatterLayout,
  capLayoutBoundingBox,
  layoutMaxBounds,
  scatterMaxRadius,
  resolveRectCollisions,
  ensureZeroOverlaps,
  countLayoutOverlaps,
  measureAxisAlignedBounds,
  LAYOUT_NODE_BOX
} from './layout-constraints'

export interface HierarchyLayoutOptions {
  entryNodeId: string
  runtime?: Partial<LayoutRuntimeConfig>
  nodeWidth?: number
  nodeGap?: number
  maxRadius?: number
  organizationMethod?: LayoutOrganizationMethod
}

export interface HierarchyRingGuide {
  depth: number
  ringIndex: number
  radius: number
}

/** Ring layer with member files for selection/inspector. */
export interface HierarchyRingLayer extends HierarchyRingGuide {
  key: string
  nodeIds: string[]
}

interface RingSlot {
  radius: number
  angle: number
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

function minAngleForRadius(radius: number): number {
  const chord = Math.hypot(LAYOUT_NODE_BOX.width, LAYOUT_NODE_BOX.height) + LAYOUT_NODE_BOX.gap
  if (radius < 4) return Math.PI * 2
  return 2 * Math.asin(Math.min(1, chord / (2 * radius)))
}

/** Max nodes that fit on a ring without box overlap. */
function maxNodesOnRing(radius: number): number {
  if (radius < 8) return 1
  const minAngle = minAngleForRadius(radius)
  return Math.max(1, Math.floor((Math.PI * 2 * 0.92) / (minAngle * 1.08)))
}

function effectiveMaxPerRing(radius: number, runtime: LayoutRuntimeConfig): number {
  const capacity = maxNodesOnRing(radius)
  const configMax = Math.max(4, runtime.maxNodesPerLayer)
  return Math.min(configMax, capacity)
}

function applyRingSlots(
  ringSlots: Map<string, RingSlot>,
  positions: Record<string, LayoutPosition>
): void {
  for (const [id, slot] of ringSlots) {
    positions[id] = {
      x: Math.cos(slot.angle) * slot.radius,
      y: Math.sin(slot.angle) * slot.radius
    }
  }
}

/** Spread angles on each ring; bump radius when circumference is too tight (capped). */
function resolveRingSlotOverlaps(ringSlots: Map<string, RingSlot>, maxRadius: number): void {
  const groups = new Map<number, string[]>()
  for (const [id, slot] of ringSlots) {
    const key = Math.round(slot.radius * 2) / 2
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(id)
  }

  for (const ids of groups.values()) {
    if (ids.length < 2) continue
    ids.sort((a, b) => ringSlots.get(a)!.angle - ringSlots.get(b)!.angle)

    let radius = ringSlots.get(ids[0])!.radius
    let minAngle = minAngleForRadius(radius)
    if (ids.length * minAngle > Math.PI * 2 * 0.97) {
      const chord = Math.hypot(LAYOUT_NODE_BOX.width, LAYOUT_NODE_BOX.height) + LAYOUT_NODE_BOX.gap
      radius = Math.min(maxRadius, (chord * ids.length) / (2 * Math.PI) * 1.04)
      minAngle = minAngleForRadius(radius)
    }

    const step = Math.max((2 * Math.PI) / ids.length, minAngle * 1.08)
    const span = step * (ids.length - 1)
    const start = -Math.PI / 2 - span / 2
    ids.forEach((id, i) => {
      const slot = ringSlots.get(id)!
      slot.radius = Math.min(maxRadius, radius)
      slot.angle = start + i * step
    })
  }
}

/** Scale all rings inward if any slot exceeds the hierarchy bound. */
function compactRingRadii(ringSlots: Map<string, RingSlot>, maxRadius: number): void {
  let maxR = 0
  for (const slot of ringSlots.values()) maxR = Math.max(maxR, slot.radius)
  if (maxR <= maxRadius || maxR === 0) return
  const scale = maxRadius / maxR
  for (const slot of ringSlots.values()) slot.radius *= scale
}

function finishHierarchyLayout(
  positions: Record<string, LayoutPosition>,
  ringSlots: Map<string, RingSlot>,
  maxRadius: number
): void {
  resolveRingSlotOverlaps(ringSlots, maxRadius)
  compactRingRadii(ringSlots, maxRadius)
  applyRingSlots(ringSlots, positions)
  const { width, height } = LAYOUT_NODE_BOX
  convertCentersToTopLeft(positions, width, height)

  for (let attempt = 0; attempt < 32; attempt++) {
    resolveRectCollisions(positions, width, height, 12)
    if (countLayoutOverlaps(positions, width, height) === 0) break
  }
  ensureZeroOverlaps(positions, width, height, 64)

  const nodeCount = Object.keys(positions).length
  if (nodeCount > 0) {
    const bounds = layoutMaxBounds(nodeCount)
    const measured = measureAxisAlignedBounds(positions, width, height)
    if (measured.width > bounds.width || measured.height > bounds.height) {
      const saved = Object.fromEntries(
        Object.keys(positions).map((id) => [id, { ...positions[id] }])
      )
      capLayoutBoundingBox(positions, bounds.width, bounds.height, width, height)
      if (countLayoutOverlaps(positions, width, height) > 0) {
        for (const id of Object.keys(saved)) positions[id] = saved[id]
      } else {
        ensureZeroOverlaps(positions, width, height, 48)
      }
    }
  }
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

function organizationLayers(
  nodes: GraphNode[],
  edges: GraphEdge[],
  entryNodeId: string,
  method: LayoutOrganizationMethod
) {
  return computeOrganizationLayers(nodes, edges, entryNodeId, method)
}

function ringRadiusForDepth(depth: number, runtime: LayoutRuntimeConfig): number {
  if (depth <= 0) return 0
  return (runtime.centerClearance + (depth - 1) * runtime.layerGap) * runtime.layerRadiusScale
}

function ringRadiusForLayer(
  count: number,
  depth: number,
  runtime: LayoutRuntimeConfig,
  maxRadius: number,
  prevDepthRadius = 0
): number {
  const base = ringRadiusForDepth(depth, runtime)
  const minR = minRadiusForCount(count, NODE_W, scaledGap(runtime))
  const minSep = Math.max(runtime.layerGap * 0.22, cellHeight() * 0.58)
  const separated = Math.max(base, minR, prevDepthRadius + minSep)
  return Math.min(maxRadius, separated)
}

function placeOnRing(
  ids: string[],
  radius: number,
  positions: Record<string, LayoutPosition>,
  ringSlots: Map<string, RingSlot>
): void {
  if (ids.length === 0) return
  if (ids.length === 1) {
    const angle = -Math.PI / 2
    ringSlots.set(ids[0], { radius, angle })
    positions[ids[0]] = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }
    return
  }
  ids.forEach((id, i) => {
    const angle = (2 * Math.PI * i) / ids.length - Math.PI / 2
    ringSlots.set(id, { radius, angle })
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
  depth: number,
  ringSlots: Map<string, RingSlot>
): void {
  if (ids.length === 0) return
  const phase = depth * 0.35
  ids.forEach((id, i) => {
    const angle = i * GOLDEN_ANGLE + phase - Math.PI / 2
    ringSlots.set(id, { radius, angle })
    positions[id] = {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius
    }
  })
}

function layerRingRadii(
  depth: number,
  ids: string[],
  runtime: LayoutRuntimeConfig,
  maxRadius: number,
  prevOuterRadius = 0
): number[] {
  if (ids.length === 0) return []

  const minSep = Math.max(runtime.layerGap * 0.24, cellHeight() * 0.62)
  const floorRadius =
    depth > 0 ? Math.max(ringRadiusForDepth(depth, runtime), prevOuterRadius + minSep * 0.38) : 0
  const maxPer = effectiveMaxPerRing(
    Math.max(floorRadius, ringRadiusForDepth(depth, runtime)),
    runtime
  )

  if (ids.length <= maxPer) {
    const prevDepthRadius = Math.max(prevOuterRadius + minSep, ringRadiusForDepth(depth - 1, runtime))
    return [
      Math.max(
        ringRadiusForLayer(ids.length, depth, runtime, maxRadius, prevDepthRadius),
        floorRadius
      )
    ]
  }

  const ringCount = Math.ceil(ids.length / maxPer)
  const ringStep = Math.max(cellHeight() * 0.42, scaledMinDist(runtime) * 0.34)
  let prevRadius = Math.max(prevOuterRadius + minSep * 0.45, depth > 0 ? ringRadiusForDepth(depth - 1, runtime) : 0)
  const radii: number[] = []
  for (let ringIndex = 0; ringIndex < ringCount; ringIndex++) {
    const slice = ids.slice(ringIndex * maxPer, (ringIndex + 1) * maxPer)
    const base = ringRadiusForDepth(depth, runtime)
    const minR = minRadiusForCount(slice.length, NODE_W, scaledGap(runtime))
    const radius = Math.min(
      maxRadius,
      Math.max(base, minR, prevRadius + ringStep, floorRadius)
    )
    prevRadius = radius
    radii.push(radius)
  }
  return radii
}

function placeLayerRings(
  depth: number,
  ids: string[],
  runtime: LayoutRuntimeConfig,
  maxRadius: number,
  positions: Record<string, LayoutPosition>,
  useGolden: boolean,
  ringSlots: Map<string, RingSlot>,
  prevOuterRadius = 0
): void {
  if (ids.length === 0) return

  const minSep = Math.max(runtime.layerGap * 0.24, cellHeight() * 0.62)
  const floorRadius =
    depth > 0 ? Math.max(ringRadiusForDepth(depth, runtime), prevOuterRadius + minSep * 0.38) : 0

  const maxPer = effectiveMaxPerRing(
    Math.max(floorRadius, ringRadiusForDepth(depth, runtime)),
    runtime
  )
  if (ids.length <= maxPer) {
    const prevDepthRadius = Math.max(prevOuterRadius + minSep, ringRadiusForDepth(depth - 1, runtime))
    const radius = Math.max(
      ringRadiusForLayer(ids.length, depth, runtime, maxRadius, prevDepthRadius),
      floorRadius
    )
    if (useGolden) placeOnGoldenRing(ids, radius, positions, depth, ringSlots)
    else placeOnRing(ids, radius, positions, ringSlots)
    return
  }

  const ringCount = Math.ceil(ids.length / maxPer)
  const ringStep = Math.max(cellHeight() * 0.42, scaledMinDist(runtime) * 0.34)
  let prevRadius = Math.max(prevOuterRadius + minSep * 0.45, depth > 0 ? ringRadiusForDepth(depth - 1, runtime) : 0)
  for (let ringIndex = 0; ringIndex < ringCount; ringIndex++) {
    const slice = ids.slice(ringIndex * maxPer, (ringIndex + 1) * maxPer)
    const base = ringRadiusForDepth(depth, runtime)
    const minR = minRadiusForCount(slice.length, NODE_W, scaledGap(runtime))
    const radius = Math.min(
      maxRadius,
      Math.max(base, minR, prevRadius + ringStep, floorRadius)
    )
    prevRadius = radius
    if (useGolden) placeOnGoldenRing(slice, radius, positions, depth + ringIndex * 0.2, ringSlots)
    else placeOnRing(slice, radius, positions, ringSlots)
  }
}

function hierarchyMaxRadius(nodeCount: number, spacingScale = 1): number {
  const n = Math.max(1, nodeCount)
  return Math.min(340, 82 + Math.sqrt(n) * 22) * spacingScale
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
  const orgMethod = options.organizationMethod ?? runtime.organizationMethod
  const { layers, entryNodeId } = organizationLayers(nodes, edges, options.entryNodeId, orgMethod)
  const positions: Record<string, LayoutPosition> = {}
  const ringSlots = new Map<string, RingSlot>()

  let prevOuterRadius = 0

  for (const [depth, ids] of [...layers.entries()].sort((a, b) => a[0] - b[0])) {
    if (depth === 0) {
      positions[entryNodeId] = { x: 0, y: 0 }
      continue
    }
    placeLayerRings(depth, ids, runtime, maxRadius, positions, false, ringSlots, prevOuterRadius)
    for (const id of ids) {
      const slot = ringSlots.get(id)
      if (slot) prevOuterRadius = Math.max(prevOuterRadius, slot.radius)
    }
  }

  finishHierarchyLayout(positions, ringSlots, maxRadius)
  return positions
}

/** Ring radii for subtle hierarchy guides (graph coordinates, node centers). */
export function getHierarchyRingGuides(
  nodes: GraphNode[],
  edges: GraphEdge[],
  entryNodeId: string,
  runtimePartial?: Partial<LayoutRuntimeConfig>,
  organizationMethod?: LayoutOrganizationMethod
): HierarchyRingGuide[] {
  const runtime = mergeLayoutRuntime(runtimePartial)
  const method = organizationMethod ?? runtime.organizationMethod
  const { layers } = organizationLayers(nodes, edges, entryNodeId, method)
  const layoutNodeCount = nodes.filter((n) => n.kind !== 'folder').length
  const maxRadius = hierarchyMaxRadius(layoutNodeCount, runtime.spacingScale ?? 1)
  const guides: HierarchyRingGuide[] = []
  let prevGuideRadius = 0

  for (const depth of [...layers.keys()].sort((a, b) => a - b)) {
    if (depth === 0) continue
    const ids = layers.get(depth) ?? []
    if (ids.length === 0) continue
    const radii = layerRingRadii(depth, ids, runtime, maxRadius, prevGuideRadius)
    radii.forEach((radius, ringIndex) => {
      guides.push({ depth, ringIndex, radius })
    })
    if (radii.length > 0) prevGuideRadius = radii[radii.length - 1]
  }
  return guides
}

/** Ring layers with member node ids (from layout algorithm, not position bucketing). */
export function getHierarchyRingLayers(
  nodes: GraphNode[],
  edges: GraphEdge[],
  entryNodeId: string,
  _positions?: Record<string, LayoutPosition>,
  runtimePartial?: Partial<LayoutRuntimeConfig>,
  organizationMethod?: LayoutOrganizationMethod
): HierarchyRingLayer[] {
  const runtime = mergeLayoutRuntime(runtimePartial)
  const method = organizationMethod ?? runtime.organizationMethod
  const { layers } = organizationLayers(nodes, edges, entryNodeId, method)
  const layoutNodeCount = nodes.filter((n) => n.kind !== 'folder').length
  const maxRadius = hierarchyMaxRadius(layoutNodeCount, runtime.spacingScale ?? 1)
  const out: HierarchyRingLayer[] = []
  let prevOuterRadius = 0

  for (const depth of [...layers.keys()].sort((a, b) => a - b)) {
    if (depth === 0) continue
    const ids = [...(layers.get(depth) ?? [])].sort((a, b) => a.localeCompare(b))
    if (ids.length === 0) continue

    const minSep = Math.max(runtime.layerGap * 0.24, cellHeight() * 0.62)
    const floorRadius =
      depth > 0 ? Math.max(ringRadiusForDepth(depth, runtime), prevOuterRadius + minSep * 0.38) : 0
    const maxPer = effectiveMaxPerRing(
      Math.max(floorRadius, ringRadiusForDepth(depth, runtime)),
      runtime
    )

    if (ids.length <= maxPer) {
      const prevDepthRadius = Math.max(prevOuterRadius + minSep, ringRadiusForDepth(depth - 1, runtime))
      const radius = Math.max(
        ringRadiusForLayer(ids.length, depth, runtime, maxRadius, prevDepthRadius),
        floorRadius
      )
      out.push({
        key: `${depth}-0-${radius}`,
        depth,
        ringIndex: 0,
        radius,
        nodeIds: ids
      })
      prevOuterRadius = Math.max(prevOuterRadius, radius)
      continue
    }

    const ringCount = Math.ceil(ids.length / maxPer)
    const ringStep = Math.max(cellHeight() * 0.42, scaledMinDist(runtime) * 0.34)
    let prevRadius = Math.max(
      prevOuterRadius + minSep * 0.45,
      depth > 0 ? ringRadiusForDepth(depth - 1, runtime) : 0
    )
    for (let ringIndex = 0; ringIndex < ringCount; ringIndex++) {
      const slice = ids.slice(ringIndex * maxPer, (ringIndex + 1) * maxPer)
      const base = ringRadiusForDepth(depth, runtime)
      const minR = minRadiusForCount(slice.length, NODE_W, scaledGap(runtime))
      const radius = Math.min(
        maxRadius,
        Math.max(base, minR, prevRadius + ringStep, floorRadius)
      )
      prevRadius = radius
      out.push({
        key: `${depth}-${ringIndex}-${radius}`,
        depth,
        ringIndex,
        radius,
        nodeIds: slice
      })
    }
    prevOuterRadius = Math.max(prevOuterRadius, prevRadius)
  }
  return out
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
  const orgMethod = options.organizationMethod ?? runtime.organizationMethod
  const { layers, entryNodeId } = organizationLayers(nodes, edges, options.entryNodeId, orgMethod)
  const positions: Record<string, LayoutPosition> = {}
  const layoutNodeCount = nodes.filter((n) => n.kind !== 'folder').length
  const maxDepth = Math.max(1, ...[...layers.keys()])
  const { width: boxW, height: boxH, gap } = LAYOUT_NODE_BOX
  const bounds = layoutMaxBounds(layoutNodeCount, scale)
  const cw = cellWidth() * scale
  const ch = cellHeight() * scale
  const tierGap = ch * PYRAMID_DEFAULTS.tierGapMul
  const rowGap = ch * PYRAMID_DEFAULTS.rowGapMul
  const topPad = 40 * scale
  const maxRowWidth = Math.min(
    bounds.width * 0.92,
    Math.max(200 * scale, Math.ceil(Math.sqrt(Math.max(1, layoutNodeCount))) * cw * 1.2)
  )
  const maxCols = Math.max(
    2,
    Math.min(12, runtime.maxNodesPerLayer, Math.floor(maxRowWidth / Math.max(cw, 1)))
  )

  const sortedLayers = [...layers.entries()]
    .filter(([d]) => d !== 0)
    .sort((a, b) => a[0] - b[0])

  function tierCapacity(depth: number): number {
    if (depth <= 0) return 1
    const byWidth = Math.max(1, Math.floor(maxRowWidth / cw))
    const byBound = Math.max(2, Math.floor((bounds.width - boxW) / Math.max(cw, 1)) + 1)
    const t = Math.pow(depth / maxDepth, 0.72)
    const byDepth = Math.max(2, Math.ceil(maxCols * t))
    return Math.min(byWidth, byDepth, maxCols, byBound)
  }

  positions[entryNodeId] = { x: -boxW / 2, y: topPad }
  let blockY = topPad + boxH + gap

  for (const [depth, ids] of sortedLayers) {
    const sorted = [...ids].sort((a, b) => a.localeCompare(b))
    const tierMax = tierCapacity(depth)
    const rowCount = Math.ceil(sorted.length / tierMax)

    for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
      const rowIds = sorted.slice(rowIndex * tierMax, (rowIndex + 1) * tierMax)
      const rowWidth = Math.max(boxW, (rowIds.length - 1) * cw + boxW)
      const startX = -rowWidth / 2
      const y = blockY + rowIndex * rowGap

      rowIds.forEach((id, i) => {
        positions[id] = { x: startX + i * cw, y }
      })
    }

    blockY += Math.max(1, rowCount) * rowGap + tierGap
  }

  centerLayoutHorizontally(positions, boxW, boxH)
  finalizePyramidLayoutTopLeft(positions, {
    nodeCount: layoutNodeCount,
    spacingScale: scale
  })
  return positions
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

export interface PyramidDepthGuide {
  depth: number
  rowIndex: number
  y: number
}

export interface PyramidDepthBand {
  depth: number
  y: number
  height: number
}

/** One horizontal band per depth level from actual node positions (top-left coordinates). */
export function getPyramidDepthBands(
  nodes: GraphNode[],
  edges: GraphEdge[],
  entryNodeId: string,
  positions: Record<string, LayoutPosition>,
  runtimePartial?: Partial<LayoutRuntimeConfig>,
  organizationMethod?: LayoutOrganizationMethod
): PyramidDepthBand[] {
  const runtime = mergeLayoutRuntime(runtimePartial)
  const method = organizationMethod ?? runtime.organizationMethod
  const { layers } = organizationLayers(nodes, edges, entryNodeId, method)
  const boxH = LAYOUT_NODE_BOX.height
  const bands: PyramidDepthBand[] = []

  for (const depth of [...layers.keys()].sort((a, b) => a - b)) {
    if (depth === 0) continue
    const ids = layers.get(depth) ?? []
    let minY = Infinity
    let maxY = -Infinity
    for (const id of ids) {
      const p = positions[id]
      if (!p) continue
      minY = Math.min(minY, p.y)
      maxY = Math.max(maxY, p.y + boxH)
    }
    if (!Number.isFinite(minY)) continue
    bands.push({ depth, y: minY, height: Math.max(boxH, maxY - minY) })
  }
  return bands
}

/** @deprecated Prefer getPyramidDepthBands — kept for layout preview helpers. */
export function getPyramidDepthGuides(
  nodes: GraphNode[],
  edges: GraphEdge[],
  entryNodeId: string,
  _positions: Record<string, LayoutPosition>,
  runtimePartial?: Partial<LayoutRuntimeConfig>,
  organizationMethod?: LayoutOrganizationMethod
): PyramidDepthGuide[] {
  const runtime = mergeLayoutRuntime(runtimePartial)
  const method = organizationMethod ?? runtime.organizationMethod
  const { layers } = organizationLayers(nodes, edges, entryNodeId, method)
  const scale = runtime.spacingScale ?? 1
  const ch = cellHeight() * scale
  const tierGap = ch * PYRAMID_DEFAULTS.tierGapMul
  const rowGap = ch * PYRAMID_DEFAULTS.rowGapMul
  const topPad = 40 * scale
  const firstTierCenter = topPad + LAYOUT_NODE_BOX.height + LAYOUT_NODE_BOX.gap + LAYOUT_NODE_BOX.height / 2
  const layoutNodeCount = nodes.filter((n) => n.kind !== 'folder').length
  const maxDepth = Math.max(1, ...[...layers.keys()])
  const cw = cellWidth() * scale
  const maxRowWidth = Math.min(
    380 * scale,
    Math.max(180 * scale, Math.ceil(Math.sqrt(Math.max(1, layoutNodeCount))) * cw * 1.35)
  )
  const maxPerRow = Math.max(
    2,
    Math.min(8, runtime.maxNodesPerLayer, Math.floor(maxRowWidth / Math.max(cw, 1)))
  )

  function tierCapacity(depth: number, countAtDepth: number): number {
    if (depth <= 0) return 1
    const byWidth = Math.max(1, Math.floor(maxRowWidth / cw))
    const t = Math.pow(depth / maxDepth, 0.62)
    const byDepth = Math.max(1, Math.ceil(maxPerRow * t))
    return Math.min(byWidth, byDepth, maxPerRow, Math.max(1, Math.ceil(Math.sqrt(countAtDepth))))
  }

  const guides: PyramidDepthGuide[] = []
  for (const depth of [...layers.keys()].sort((a, b) => a - b)) {
    if (depth === 0) continue
    const ids = layers.get(depth) ?? []
    if (ids.length === 0) continue
    const tierMax = tierCapacity(depth, ids.length)
    const rowCount = Math.ceil(ids.length / tierMax)
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
      const y = firstTierCenter + (depth - 1) * tierGap + rowIndex * rowGap
      guides.push({ depth, rowIndex, y })
    }
  }
  return guides
}

export { depthLevelColor }
export type { DependencyDepthResult }

import type { GraphEdge, GraphNode, LayoutPosition } from '../types'
import {
  computeDependencyDepths,
  computeEntryPointDepthGroups,
  UNREACHABLE_DEPTH,
  type DependencyDepthResult
} from './dependency-depth'
import {
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
  anchorEntryTop,
  convertCentersToTopLeft,
  boxesOverlap,
  finalizePyramidLayoutTopLeft,
  finalizeScatterLayout,
  capRadialLayoutFromCenter,
  countLayoutOverlaps,
  scatterMaxRadius,
  resolvePyramidCollisions,
  ensureZeroOverlaps,
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

/** Explicit annulus band for hierarchy rings (rendering + hit-testing). */
export interface HierarchyRingBand {
  key: string
  semanticDepth: number
  subRingIndex: number
  innerRadius: number
  outerRadius: number
  midRadius: number
  nodeIds: string[]
}

/** Ring layer with member files for selection/inspector. */
export interface HierarchyRingLayer extends HierarchyRingGuide {
  key: string
  nodeIds: string[]
}

export function ringBandKey(depth: number, ringIndex: number): string {
  return `h-${depth}-${ringIndex}`
}

export function pyramidBandKey(depth: number): string {
  return `p-${depth}`
}

function nodeBandHalf(): number {
  return Math.hypot(NODE_W, LAYOUT_NODE_BOX.height) / 2 + LAYOUT_NODE_BOX.gap * 0.30
}

function entryCenterOuterRadius(runtime: LayoutRuntimeConfig): number {
  return Math.max(cellHeight() * 0.46, runtime.centerClearance * 0.32)
}

function minRingBandWidth(): number {
  return nodeBandHalf() * 2 + LAYOUT_NODE_BOX.gap * 0.38
}

const NODE_W = LAYOUT_NODE_BOX.width
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
  tierGapMul: 0.28,
  rowGapMul: 0.92
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

/** Place nodes on their band mid-radius with even angular spacing (preserves ring structure). */
function resolveHierarchyBandAngularSpacing(
  positions: Record<string, LayoutPosition>,
  bands: HierarchyRingBand[],
  entryNodeId: string
): void {
  const entry = positions[entryNodeId]
  if (!entry) return

  const { width: boxW, height: boxH } = LAYOUT_NODE_BOX
  const cx = entry.x + boxW / 2
  const cy = entry.y + boxH / 2
  const margin = nodeBandHalf() * 0.45

  const byAnnulus = new Map<string, HierarchyRingBand[]>()
  for (const band of bands) {
    const key = `${band.innerRadius.toFixed(2)}:${band.outerRadius.toFixed(2)}`
    const list = byAnnulus.get(key) ?? []
    list.push(band)
    byAnnulus.set(key, list)
  }

  const sortedAnnuli = [...byAnnulus.entries()].sort((a, b) => {
    const aOuter = parseFloat(a[0].split(':')[1] ?? '0')
    const bOuter = parseFloat(b[0].split(':')[1] ?? '0')
    return aOuter - bOuter
  })

  let annulusIndex = 0
  for (const [, group] of sortedAnnuli) {
    group.sort((a, b) => a.semanticDepth - b.semanticDepth || a.subRingIndex - b.subRingIndex)
    const sectorCount = group.length
    const sectorSpan = (2 * Math.PI) / sectorCount
    const ringPhase = (annulusIndex * GOLDEN_ANGLE * 1.17) % (Math.PI * 2)
    annulusIndex += 1

    for (let si = 0; si < group.length; si++) {
      const band = group[si]!
      const ids = band.nodeIds.filter((id) => id !== entryNodeId)
      if (ids.length === 0) continue

      const inner = band.innerRadius + margin
      const outer = band.outerRadius - margin
      const radius =
        outer > inner
          ? Math.max(inner, Math.min(outer, band.midRadius))
          : band.midRadius

      const arcStart =
        sectorCount === 1
          ? -Math.PI + ringPhase
          : -Math.PI + si * sectorSpan + ringPhase * 0.31
      const arcEnd =
        sectorCount === 1 ? Math.PI + ringPhase : arcStart + sectorSpan * 0.94

      placeBandNodesOnArc(
        positions,
        ids,
        cx,
        cy,
        radius,
        boxW,
        boxH,
        entryNodeId,
        arcStart,
        arcEnd,
        inner,
        outer
      )
    }
  }
}

function placeBandNodesOnArc(
  positions: Record<string, LayoutPosition>,
  ids: string[],
  cx: number,
  cy: number,
  radius: number,
  boxW: number,
  boxH: number,
  entryNodeId: string,
  arcStart: number,
  arcEnd: number,
  radiusMin?: number,
  radiusMax?: number
): void {
  const nodeIds = ids.filter((id) => id !== entryNodeId)
  if (nodeIds.length === 0) return

  if (radiusMin !== undefined && radiusMax !== undefined && radiusMax > radiusMin) {
    radius = Math.max(radiusMin, Math.min(radiusMax, radius))
  }

  let minAngle = minAngleForRadius(radius) * 1.06
  const arcSpan = Math.max(arcEnd - arcStart, minAngle)
  if (nodeIds.length > 1 && nodeIds.length * minAngle > arcSpan * 0.98) {
    const chord = Math.hypot(boxW, boxH) + LAYOUT_NODE_BOX.gap
    const neededR = (chord * nodeIds.length) / arcSpan * 1.04
    radius = Math.max(radius, neededR)
    if (radiusMin !== undefined && radiusMax !== undefined && radiusMax > radiusMin) {
      radius = Math.min(radiusMax, Math.max(radiusMin, radius))
    }
    minAngle = minAngleForRadius(radius) * 1.06
  }

  nodeIds.sort((a, b) => a.localeCompare(b))
  const usableArc = Math.max(arcEnd - arcStart, minAngle)
  let step =
    nodeIds.length <= 1 ? 0 : Math.max(usableArc / (nodeIds.length - 1), minAngle)
  let span = step * (nodeIds.length - 1)
  if (nodeIds.length > 1 && span > usableArc * 0.98) {
    step = usableArc / (nodeIds.length - 1)
    span = step * (nodeIds.length - 1)
  }
  const center = (arcStart + arcEnd) / 2
  const start = nodeIds.length === 1 ? center : center - span / 2

  nodeIds.forEach((id, i) => {
    const angle = nodeIds.length === 1 ? center : start + i * step
    positions[id] = {
      x: cx + Math.cos(angle) * radius - boxW / 2,
      y: cy + Math.sin(angle) * radius - boxH / 2
    }
  })
}

/** Tangential nudging within a single band — preserves radial ring structure. */
function resolveSameBandCollisions(
  positions: Record<string, LayoutPosition>,
  band: HierarchyRingBand,
  entryNodeId: string,
  maxRounds = 48
): void {
  const ids = band.nodeIds.filter((id) => id !== entryNodeId && positions[id])
  if (ids.length < 2) return

  const { width: boxW, height: boxH, gap } = LAYOUT_NODE_BOX
  const entry = positions[entryNodeId]
  if (!entry) return
  const cx = entry.x + boxW / 2
  const cy = entry.y + boxH / 2

  for (let round = 0; round < maxRounds; round++) {
    let moved = false
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = positions[ids[i]!]!
        const b = positions[ids[j]!]!
        if (!boxesOverlap(a.x, a.y, b.x, b.y, boxW, boxH, gap)) continue

        const acx = a.x + boxW / 2
        const acy = a.y + boxH / 2
        const bcx = b.x + boxW / 2
        const bcy = b.y + boxH / 2
        const aAngle = Math.atan2(acy - cy, acx - cx)
        const bAngle = Math.atan2(bcy - cy, bcx - cx)
        const aRadius = Math.hypot(acx - cx, acy - cy)
        const bRadius = Math.hypot(bcx - cx, bcy - cy)
        const avgR = (aRadius + bRadius) / 2

        let delta = bAngle - aAngle
        while (delta <= -Math.PI) delta += Math.PI * 2
        while (delta > Math.PI) delta -= Math.PI * 2
        const sign = delta >= 0 ? 1 : -1
        const push = Math.max(minAngleForRadius(avgR) * 0.52, 0.035)

        positions[ids[i]!] = {
          x: cx + Math.cos(aAngle - sign * push * 0.5) * aRadius - boxW / 2,
          y: cy + Math.sin(aAngle - sign * push * 0.5) * aRadius - boxH / 2
        }
        positions[ids[j]!] = {
          x: cx + Math.cos(bAngle + sign * push * 0.5) * bRadius - boxW / 2,
          y: cy + Math.sin(bAngle + sign * push * 0.5) * bRadius - boxH / 2
        }
        moved = true
      }
    }
    if (!moved || countLayoutOverlaps(positions, boxW, boxH, gap) === 0) return
  }
}

function finishHierarchyLayout(
  positions: Record<string, LayoutPosition>,
  bands: HierarchyRingBand[],
  entryNodeId: string,
  maxRadius: number
): void {
  const { width, height } = LAYOUT_NODE_BOX
  resolveHierarchyBandAngularSpacing(positions, bands, entryNodeId)
  convertCentersToTopLeft(positions, width, height)
  for (const band of bands) {
    resolveSameBandCollisions(positions, band, entryNodeId)
  }
  clampHierarchyNodesToBands(positions, bands, entryNodeId)
  capRadialLayoutFromCenter(
    positions,
    entryNodeId,
    maxRadius + Math.hypot(width, height) / 2,
    width,
    height
  )
  for (const band of bands) {
    resolveSameBandCollisions(positions, band, entryNodeId)
  }
  clampHierarchyNodesToBands(positions, bands, entryNodeId)
}

/** Keep nodes inside their assigned annulus after collision resolution. */
function clampHierarchyNodesToBands(
  positions: Record<string, LayoutPosition>,
  bands: HierarchyRingBand[],
  entryNodeId: string
): void {
  const entry = positions[entryNodeId]
  if (!entry) return

  const { width: boxW, height: boxH } = LAYOUT_NODE_BOX
  const cx = entry.x + boxW / 2
  const cy = entry.y + boxH / 2
  const margin = nodeBandHalf() * 0.52
  const bandByNode = new Map<string, HierarchyRingBand>()
  for (const band of bands) {
    for (const id of band.nodeIds) bandByNode.set(id, band)
  }

  for (const [id, p] of Object.entries(positions)) {
    if (id === entryNodeId) continue
    const band = bandByNode.get(id)
    if (!band) continue

    const dx = p.x + boxW / 2 - cx
    const dy = p.y + boxH / 2 - cy
    const angle = Math.atan2(dy, dx)
    let radius = Math.hypot(dx, dy)
    const inner = band.innerRadius + margin
    const outer = band.outerRadius - margin
    if (outer <= inner) continue

    radius = Math.max(inner, Math.min(outer, radius))
    positions[id] = {
      x: cx + Math.cos(angle) * radius - boxW / 2,
      y: cy + Math.sin(angle) * radius - boxH / 2
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

function scaledMinDist(runtime: LayoutRuntimeConfig): number {
  return LAYOUT_NODE_BOX.minDist * (runtime.spacingScale ?? 1)
}

function entryPointDepthLayers(
  nodes: GraphNode[],
  edges: GraphEdge[],
  entryNodeId: string
): DependencyDepthResult {
  return computeEntryPointDepthGroups(nodes, edges, entryNodeId)
}

/** Depth layers for hierarchy/pyramid — always entry-point shortest path. */
function layoutDepthLayers(
  nodes: GraphNode[],
  edges: GraphEdge[],
  entryNodeId: string
): DependencyDepthResult {
  return entryPointDepthLayers(nodes, edges, entryNodeId)
}

function ringRadiusForDepth(depth: number, runtime: LayoutRuntimeConfig): number {
  if (depth <= 0) return 0
  return (runtime.centerClearance + (depth - 1) * runtime.layerGap) * runtime.layerRadiusScale
}

function hierarchyMaxRadius(nodeCount: number, spacingScale = 1): number {
  const n = Math.max(1, nodeCount)
  const minBand = minRingBandWidth()
  const center = entryCenterOuterRadius(mergeLayoutRuntime({}))
  // n/16 packs more nodes per ring, keeps overall radius compact and reduces zoom-out
  const ringsNeeded = Math.max(2, Math.ceil(n / 16))
  const radial = center + ringsNeeded * minBand * 0.96
  return Math.min(440, Math.max(150, radial)) * spacingScale
}

export function computeHierarchyLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: HierarchyLayoutOptions
): Record<string, LayoutPosition> {
  const runtime = mergeLayoutRuntime(options.runtime)
  const layoutNodeCount = nodes.filter((n) => n.kind !== 'folder').length
  const scale = runtime.spacingScale ?? 1
  const { layers, entryNodeId } = layoutDepthLayers(nodes, edges, options.entryNodeId)
  const minBand = minRingBandWidth()
  const centerOuter = entryCenterOuterRadius(runtime)
  let estimatedBands = 0
  for (const depth of [...layers.keys()].sort((a, b) => a - b)) {
    if (depth === 0) continue
    const ids = layers.get(depth) ?? []
    if (ids.length === 0) continue
    const estMid = centerOuter + (estimatedBands + 1.5) * minBand
    const cap = Math.max(1, maxNodesOnRing(estMid))
    estimatedBands += Math.ceil(ids.length / cap)
  }
  const baseMax = hierarchyMaxRadius(layoutNodeCount, scale)
  const radialNeed = centerOuter + Math.max(estimatedBands, 2) * minBand * 1.06
  const softCap = centerOuter + minBand * 100
  const maxRadius = options.maxRadius ?? Math.min(softCap, Math.max(baseMax, radialNeed))
  const positions: Record<string, LayoutPosition> = {}
  const bands = buildHierarchyRingBands(nodes, edges, options.entryNodeId, runtime, maxRadius)

  positions[entryNodeId] = { x: 0, y: 0 }
  finishHierarchyLayout(positions, bands, entryNodeId, maxRadius)
  return positions
}

/** Plan non-overlapping annulus bands with explicit node membership. */
export function buildHierarchyRingBands(
  nodes: GraphNode[],
  edges: GraphEdge[],
  entryNodeId: string,
  runtimePartial?: Partial<LayoutRuntimeConfig>,
  maxRadiusOverride?: number,
  _organizationMethod?: LayoutOrganizationMethod
): HierarchyRingBand[] {
  const runtime = mergeLayoutRuntime(runtimePartial)
  const { layers } = layoutDepthLayers(nodes, edges, entryNodeId)
  const layoutNodeCount = nodes.filter((n) => n.kind !== 'folder').length
  const minBand = minRingBandWidth()
  const centerOuter = entryCenterOuterRadius(runtime)
  let estimatedBands = 0
  for (const depth of [...layers.keys()].sort((a, b) => a - b)) {
    if (depth === 0) continue
    const ids = layers.get(depth) ?? []
    if (ids.length === 0) continue
    const estMid = centerOuter + (estimatedBands + 1.5) * minBand
    const cap = Math.max(1, maxNodesOnRing(estMid))
    estimatedBands += Math.ceil(ids.length / cap)
  }
  const baseMax = hierarchyMaxRadius(layoutNodeCount, runtime.spacingScale ?? 1)
  const radialNeed = centerOuter + Math.max(estimatedBands, 2) * minBand * 1.06
  const softCap = centerOuter + minBand * 100
  const maxRadius = maxRadiusOverride ?? Math.min(softCap, Math.max(baseMax, radialNeed))
  const bands: HierarchyRingBand[] = []
  let prevOuterEdge = centerOuter
  let overflowStack = 0

  for (const depth of [...layers.keys()].sort((a, b) => a - b)) {
    if (depth === 0) continue
    const ids = [...(layers.get(depth) ?? [])].sort((a, b) => a.localeCompare(b))
    if (ids.length === 0) continue

    const minSep = Math.max(runtime.layerGap * 0.24, cellHeight() * 0.62, nodeBandHalf() * 1.05)
    const sortedIds = [...ids].sort((a, b) => a.localeCompare(b))
    let subRingIndex = 0
    let remaining = sortedIds

    while (remaining.length > 0) {
      const atRadialLimit = prevOuterEdge + minBand * 0.85 >= maxRadius
      let innerRadius: number
      let outerRadius: number
      let midRadius: number

      if (atRadialLimit) {
        outerRadius = Math.max(
          entryCenterOuterRadius(runtime) + minBand,
          maxRadius - overflowStack * minBand * 0.94
        )
        innerRadius = Math.max(
          entryCenterOuterRadius(runtime) + minBand * 0.35,
          outerRadius - minBand
        )
        if (outerRadius - innerRadius < minBand * 0.45) {
          innerRadius = Math.max(entryCenterOuterRadius(runtime), outerRadius - minBand)
        }
        midRadius = (innerRadius + outerRadius) / 2
        overflowStack += 1
      } else {
        const targetMid = Math.max(
          ringRadiusForDepth(depth, runtime),
          prevOuterEdge + minSep,
          prevOuterEdge + minBand * 0.55
        )
        innerRadius = Math.max(prevOuterEdge + nodeBandHalf() * 0.28, targetMid - minBand / 2)
        outerRadius = Math.min(maxRadius, Math.max(targetMid + minBand / 2, innerRadius + minBand))
        if (outerRadius - innerRadius < minBand * 0.45) {
          innerRadius = Math.max(prevOuterEdge, outerRadius - minBand)
        }
        midRadius = (innerRadius + outerRadius) / 2
      }

      const capacity = Math.max(1, maxNodesOnRing(midRadius))
      const batch = remaining.slice(0, capacity)
      remaining = remaining.slice(capacity)

      bands.push({
        key: ringBandKey(depth, subRingIndex),
        semanticDepth: depth,
        subRingIndex,
        innerRadius,
        outerRadius,
        midRadius,
        nodeIds: batch
      })

      subRingIndex += 1
      if (!atRadialLimit) prevOuterEdge = outerRadius
    }
  }

  return bands
}

/** Align planned ring bands to actual node positions after collision resolution. */
export function reconcileHierarchyBandsWithPositions(
  bands: HierarchyRingBand[],
  positions: Record<string, LayoutPosition>,
  entryNodeId: string,
  centerOuterRadius: number
): HierarchyRingBand[] {
  const entry = positions[entryNodeId]
  if (!entry || bands.length === 0) return bands

  const { width: boxW, height: boxH, gap } = LAYOUT_NODE_BOX
  const cx = entry.x + boxW / 2
  const cy = entry.y + boxH / 2
  const nodePad = nodeBandHalf() + gap * 0.32
  const minBand = minRingBandWidth()

  let prevOuter = centerOuterRadius
  const sorted = [...bands].sort(
    (a, b) => a.semanticDepth - b.semanticDepth || a.subRingIndex - b.subRingIndex
  )

  return sorted.map((band) => {
    let minDist = Infinity
    let maxDist = -Infinity
    for (const id of band.nodeIds) {
      const p = positions[id]
      if (!p) continue
      const dist = Math.hypot(p.x + boxW / 2 - cx, p.y + boxH / 2 - cy)
      minDist = Math.min(minDist, dist)
      maxDist = Math.max(maxDist, dist)
    }

    if (!Number.isFinite(minDist)) {
      const innerRadius = prevOuter
      const outerRadius = innerRadius + minBand
      prevOuter = outerRadius
      return { ...band, innerRadius, outerRadius, midRadius: (innerRadius + outerRadius) / 2 }
    }

    let innerRadius = Math.max(prevOuter, minDist - nodePad)
    let outerRadius = Math.max(innerRadius + minBand * 0.55, maxDist + nodePad)

    if (minDist - nodePad < prevOuter) {
      innerRadius = Math.max(centerOuterRadius, minDist - nodePad)
      outerRadius = Math.max(innerRadius + minBand * 0.55, maxDist + nodePad)
    }

    prevOuter = Math.max(prevOuter, outerRadius)

    return {
      ...band,
      innerRadius,
      outerRadius,
      midRadius: (innerRadius + outerRadius) / 2
    }
  })
}

/** Bands for rendering/hit-testing — reconciled to actual node positions when available. */
export function getHierarchyRingBandsForSnapshot(
  nodes: GraphNode[],
  edges: GraphEdge[],
  entryNodeId: string,
  positions: Record<string, LayoutPosition>,
  runtimePartial?: Partial<LayoutRuntimeConfig>,
  _organizationMethod?: LayoutOrganizationMethod
): HierarchyRingBand[] {
  const runtime = mergeLayoutRuntime(runtimePartial)
  const planned = buildHierarchyRingBands(nodes, edges, entryNodeId, runtime)
  if (!positions[entryNodeId] || planned.length === 0) return planned
  return reconcileHierarchyBandsWithPositions(
    planned,
    positions,
    entryNodeId,
    entryCenterOuterRadius(runtime)
  )
}

export function getHierarchyCenterRadius(
  runtimePartial?: Partial<LayoutRuntimeConfig>
): number {
  return entryCenterOuterRadius(mergeLayoutRuntime(runtimePartial))
}

/** Ring radii for subtle hierarchy guides (graph coordinates, node centers). */
export function getHierarchyRingGuides(
  nodes: GraphNode[],
  edges: GraphEdge[],
  entryNodeId: string,
  runtimePartial?: Partial<LayoutRuntimeConfig>,
  _organizationMethod?: LayoutOrganizationMethod
): HierarchyRingGuide[] {
  const runtime = mergeLayoutRuntime(runtimePartial)
  return buildHierarchyRingBands(nodes, edges, entryNodeId, runtime).map(
    (b) => ({
      depth: b.semanticDepth,
      ringIndex: b.subRingIndex,
      radius: b.outerRadius
    })
  )
}

/** Ring layers with member node ids (from layout algorithm). */
export function getHierarchyRingLayers(
  nodes: GraphNode[],
  edges: GraphEdge[],
  entryNodeId: string,
  _positions?: Record<string, LayoutPosition>,
  runtimePartial?: Partial<LayoutRuntimeConfig>,
  _organizationMethod?: LayoutOrganizationMethod
): HierarchyRingLayer[] {
  const runtime = mergeLayoutRuntime(runtimePartial)
  return buildHierarchyRingBands(nodes, edges, entryNodeId, runtime).map(
    (b) => ({
      key: b.key,
      depth: b.semanticDepth,
      ringIndex: b.subRingIndex,
      radius: b.outerRadius,
      nodeIds: b.nodeIds
    })
  )
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
  const { layers, entryNodeId } = layoutDepthLayers(nodes, edges, options.entryNodeId)
  const positions: Record<string, LayoutPosition> = {}
  const layoutNodeCount = nodes.filter((n) => n.kind !== 'folder').length
  const { width: boxW, height: boxH, gap } = LAYOUT_NODE_BOX
  const cw = cellWidth() * scale
  const ch = cellHeight() * scale
  const tierGap = ch * PYRAMID_DEFAULTS.tierGapMul
  const topPad = 32 * scale
  // Allow generous row width so pyramid groups can use many columns
  const maxRowWidth = Math.max(
    500 * scale,
    Math.ceil(Math.sqrt(Math.max(1, layoutNodeCount))) * cw * 2.4
  )
  const maxCols = Math.max(
    6,
    Math.min(24, runtime.maxNodesPerLayer, Math.floor(maxRowWidth / Math.max(cw, 1)))
  )

  const sortedLayers = [...layers.entries()]
    .filter(([d]) => d !== 0)
    .sort((a, b) => a[0] - b[0])
  const reachableDepths = sortedLayers
    .map(([d]) => d)
    .filter((d) => d < UNREACHABLE_DEPTH)
  const maxReachableDepth = reachableDepths.length > 0 ? Math.max(...reachableDepths) : 1

  positions[entryNodeId] = { x: -boxW / 2, y: topPad }
  let blockY = topPad + boxH + gap * 0.65
  const layerPadY = 8 * scale

  for (const [depth, ids] of sortedLayers) {
    const sorted = [...ids].sort((a, b) => a.localeCompare(b))
    if (sorted.length === 0) continue

    const depthMaxCols =
      depth >= UNREACHABLE_DEPTH
        ? maxCols
        : Math.max(
            4,
            Math.min(
              maxCols,
              // Start at 50% of maxCols and scale up, so even shallow depths get wide groups
              Math.ceil(maxCols * 0.5 + (depth / Math.max(1, maxReachableDepth)) * maxCols * 0.5)
            )
          )
    const cols = pyramidGridCols(sorted.length, depthMaxCols)
    const rows = Math.ceil(sorted.length / cols)
    const rowStep = Math.max(ch, boxH + gap * 0.9)

    sorted.forEach((id, i) => {
      const row = Math.floor(i / cols)
      const col = i % cols
      const rowStart = row * cols
      const itemsInRow = Math.min(cols, sorted.length - rowStart)
      const rowWidth = Math.max(boxW, (itemsInRow - 1) * cw + boxW)
      const rowStartX = -rowWidth / 2
      positions[id] = {
        x: rowStartX + col * cw,
        y: blockY + layerPadY + row * rowStep
      }
    })

    const layerHeight = layerPadY * 2 + Math.max(1, rows) * rowStep
    const depthGap = Math.max(ch * 0.14, tierGap * Math.min(0.26, 0.08 + sorted.length / 42))
    blockY += layerHeight + depthGap
  }

  centerLayoutHorizontally(positions, boxW, boxH)
  for (let attempt = 0; attempt < 28; attempt++) {
    resolvePyramidCollisions(positions, boxW, boxH, 10)
    if (countLayoutOverlaps(positions, boxW, boxH, gap) === 0) break
  }
  ensureZeroOverlaps(positions, boxW, boxH, 64)
  anchorEntryTop(positions, entryNodeId, topPad, boxH)
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
  key: string
  depth: number
  x: number
  y: number
  width: number
  height: number
  nodeIds: string[]
}

function pyramidGridCols(count: number, maxCols: number): number {
  if (count <= 1) return 1
  // Prefer wider aspect ratio (4:1 width-to-height) so groups are wide and short
  const targetAspect = 4.0
  const maxRows = Math.max(2, Math.ceil(Math.sqrt(count / targetAspect)))
  const fromRows = Math.ceil(count / maxRows)
  const fromAspect = Math.ceil(Math.sqrt(count * targetAspect))
  return Math.min(maxCols, Math.max(fromRows, fromAspect, Math.ceil(count / targetAspect)))
}

/** One tight band per depth level from actual node positions (top-left coordinates). */
export function getPyramidDepthBands(
  nodes: GraphNode[],
  edges: GraphEdge[],
  entryNodeId: string,
  positions: Record<string, LayoutPosition>,
  _runtimePartial?: Partial<LayoutRuntimeConfig>,
  _organizationMethod?: LayoutOrganizationMethod
): PyramidDepthBand[] {
  const { layers } = layoutDepthLayers(nodes, edges, entryNodeId)
  const { width: boxW, height: boxH } = LAYOUT_NODE_BOX
  const padX = 14
  const padY = 10
  const bands: PyramidDepthBand[] = []

  for (const depth of [...layers.keys()].sort((a, b) => a - b)) {
    if (depth === 0) continue
    const ids = (layers.get(depth) ?? []).filter((id) => positions[id])
    if (ids.length === 0) continue

    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (const id of ids) {
      const p = positions[id]
      minX = Math.min(minX, p.x)
      maxX = Math.max(maxX, p.x + boxW)
      minY = Math.min(minY, p.y)
      maxY = Math.max(maxY, p.y + boxH)
    }
    if (!Number.isFinite(minX)) continue

    bands.push({
      key: pyramidBandKey(depth),
      depth,
      x: minX - padX,
      y: minY - padY,
      width: maxX - minX + padX * 2,
      height: maxY - minY + padY * 2,
      nodeIds: ids
    })
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
  _organizationMethod?: LayoutOrganizationMethod
): PyramidDepthGuide[] {
  const runtime = mergeLayoutRuntime(runtimePartial)
  const { layers } = layoutDepthLayers(nodes, edges, entryNodeId)
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

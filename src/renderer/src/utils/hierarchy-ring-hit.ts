import {
  getHierarchyRingBandsForSnapshot,
  getHierarchyCenterRadius,
  getPyramidDepthBands,
  type HierarchyRingBand
} from '@core/layout/hierarchy-layout'
import { consolidateHierarchyDepthVisuals } from '@core/layout/hierarchy-depth-visuals'
import type { LayoutRuntimeConfig } from '@core/layout/layout-config'
import { LAYOUT_NODE_BOX } from '@core/layout/layout-constraints'
import type { GraphSnapshot, LayoutMode, LayoutPosition } from '@core/types'
import { getEffectiveGraphPositions } from './effective-graph-positions'

function effectivePositions(
  snapshot: GraphSnapshot,
  userPositions?: Record<string, LayoutPosition>
): Record<string, LayoutPosition> {
  return getEffectiveGraphPositions(snapshot, userPositions ?? {})
}

function normalizeAngle(angle: number): number {
  let a = angle
  while (a <= -Math.PI) a += Math.PI * 2
  while (a > Math.PI) a -= Math.PI * 2
  return a
}

function angleInSpan(angle: number, start: number, end: number, pad = 0.08): boolean {
  const a = normalizeAngle(angle)
  const s = normalizeAngle(start - pad)
  const e = normalizeAngle(end + pad)
  if (s <= e) return a >= s && a <= e
  return a >= s || a <= e
}

/** Angular span covered by a band's placed nodes (for shared-annulus hit-testing). */
function bandAngularSpan(
  band: HierarchyRingBand,
  positions: Record<string, LayoutPosition>,
  entryNodeId: string
): { start: number; end: number } | null {
  const entry = positions[entryNodeId]
  if (!entry) return null

  const { width: boxW, height: boxH } = LAYOUT_NODE_BOX
  const cx = entry.x + boxW / 2
  const cy = entry.y + boxH / 2
  let minA = Infinity
  let maxA = -Infinity

  for (const id of band.nodeIds) {
    const p = positions[id]
    if (!p) continue
    const angle = Math.atan2(p.y + boxH / 2 - cy, p.x + boxW / 2 - cx)
    minA = Math.min(minA, angle)
    maxA = Math.max(maxA, angle)
  }

  if (!Number.isFinite(minA)) return null
  return { start: minA, end: maxA }
}

/** Find hierarchy ring band under a graph-space point. */
export function pickHierarchyRingAtPoint(
  snapshot: GraphSnapshot,
  runtime: LayoutRuntimeConfig,
  flowX: number,
  flowY: number,
  userPositions?: Record<string, LayoutPosition>
): string | null {
  if (!snapshot.entryNodeId) return null
  const positions = effectivePositions(snapshot, userPositions)
  const entry = positions[snapshot.entryNodeId]
  if (!entry) return null

  const { width: boxW, height: boxH } = LAYOUT_NODE_BOX
  const cx = entry.x + boxW / 2
  const cy = entry.y + boxH / 2
  const dist = Math.hypot(flowX - cx, flowY - cy)
  const clickAngle = Math.atan2(flowY - cy, flowX - cx)

  const bands = getHierarchyRingBandsForSnapshot(
    snapshot.nodes,
    snapshot.edges,
    snapshot.entryNodeId,
    positions,
    runtime,
    runtime.organizationMethod
  )

  const centerRadius = getHierarchyCenterRadius(runtime)
  if (dist <= centerRadius) return null

  const depthVisuals = consolidateHierarchyDepthVisuals(bands, centerRadius).filter(
    (d) => dist >= d.innerRadius && dist <= d.outerRadius
  )
  if (depthVisuals.length === 0) return null

  depthVisuals.sort(
    (a, b) =>
      a.outerRadius - a.innerRadius - (b.outerRadius - b.innerRadius) ||
      a.depth - b.depth
  )
  const targetDepth = depthVisuals[0]!.depth

  const annulusCounts = new Map<string, number>()
  for (const band of bands) {
    const key = `${band.innerRadius.toFixed(2)}:${band.outerRadius.toFixed(2)}`
    annulusCounts.set(key, (annulusCounts.get(key) ?? 0) + 1)
  }

  const candidates: { band: HierarchyRingBand; width: number }[] = []
  for (const band of bands) {
    if (band.semanticDepth !== targetDepth) continue
    if (dist < band.innerRadius || dist > band.outerRadius) continue
    const annulusKey = `${band.innerRadius.toFixed(2)}:${band.outerRadius.toFixed(2)}`
    const soleOnAnnulus = (annulusCounts.get(annulusKey) ?? 0) === 1
    if (!soleOnAnnulus) {
      const span = bandAngularSpan(band, positions, snapshot.entryNodeId)
      if (span && !angleInSpan(clickAngle, span.start, span.end)) continue
    }
    candidates.push({ band, width: band.outerRadius - band.innerRadius })
  }

  if (candidates.length === 0) {
    const fallback = bands.find(
      (b) => b.semanticDepth === targetDepth && dist >= b.innerRadius && dist <= b.outerRadius
    )
    return fallback?.key ?? depthVisuals[0]!.bandKeys[0] ?? null
  }

  candidates.sort(
    (a, b) => a.width - b.width || a.band.subRingIndex - b.band.subRingIndex
  )
  return candidates[0]!.band.key
}

/** Find pyramid depth group under a graph-space point. */
export function pickPyramidBandAtPoint(
  snapshot: GraphSnapshot,
  runtime: LayoutRuntimeConfig,
  flowX: number,
  flowY: number,
  userPositions?: Record<string, LayoutPosition>
): string | null {
  if (!snapshot.entryNodeId) return null
  const positions = effectivePositions(snapshot, userPositions)
  const bands = getPyramidDepthBands(
    snapshot.nodes,
    snapshot.edges,
    snapshot.entryNodeId,
    positions,
    runtime,
    runtime.organizationMethod
  )

  for (const band of [...bands].reverse()) {
    if (
      flowX >= band.x &&
      flowX <= band.x + band.width &&
      flowY >= band.y &&
      flowY <= band.y + band.height
    ) {
      return band.key
    }
  }
  return null
}

export function pickLayoutGroupAtPoint(
  snapshot: GraphSnapshot,
  runtime: LayoutRuntimeConfig,
  layoutMode: LayoutMode,
  flowX: number,
  flowY: number,
  userPositions?: Record<string, LayoutPosition>
): string | null {
  if (layoutMode === 'hierarchy') {
    return pickHierarchyRingAtPoint(snapshot, runtime, flowX, flowY, userPositions)
  }
  if (layoutMode === 'pyramid') {
    return pickPyramidBandAtPoint(snapshot, runtime, flowX, flowY, userPositions)
  }
  return null
}

import {
  getHierarchyCenterRadius,
  getHierarchyRingBandsForSnapshot
} from '@core/layout/hierarchy-layout'
import type { LayoutRuntimeConfig } from '@core/layout/layout-config'
import { LAYOUT_NODE_BOX } from '@core/layout/layout-constraints'
import type { GraphSnapshot, LayoutMode } from '@core/types'
import { getEffectiveGraphPositions } from './effective-graph-positions'

/** Extra normalized fit padding so hierarchy depth rings stay in view. */
export function hierarchyFitPaddingBoost(
  snapshot: GraphSnapshot | null,
  layoutMode: LayoutMode,
  runtime: LayoutRuntimeConfig,
  userPositions: Record<string, { x: number; y: number }> = {}
): number {
  if (layoutMode !== 'hierarchy' || !snapshot?.entryNodeId) return 0

  const positions = getEffectiveGraphPositions(snapshot, userPositions)
  const entry = positions[snapshot.entryNodeId]
  if (!entry) return 0

  const bands = getHierarchyRingBandsForSnapshot(
    snapshot.nodes,
    snapshot.edges,
    snapshot.entryNodeId,
    positions,
    runtime,
    runtime.organizationMethod
  )
  if (bands.length === 0) return 0

  const { width, height } = LAYOUT_NODE_BOX
  const cx = entry.x + width / 2
  const cy = entry.y + height / 2
  let maxNodeDist = getHierarchyCenterRadius(runtime)

  for (const [id, p] of Object.entries(positions)) {
    if (id === snapshot.entryNodeId) continue
    maxNodeDist = Math.max(
      maxNodeDist,
      Math.hypot(p.x + width / 2 - cx, p.y + height / 2 - cy) + Math.hypot(width, height) / 2
    )
  }

  const maxRingOuter = Math.max(...bands.map((b) => b.outerRadius))
  if (maxRingOuter <= maxNodeDist * 1.08) return 0

  const ratio = maxRingOuter / Math.max(1, maxNodeDist)
  return Math.min(0.12, Math.max(0, (ratio - 1) * 0.06))
}

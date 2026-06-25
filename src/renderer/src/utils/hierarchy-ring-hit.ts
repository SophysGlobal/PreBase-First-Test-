import { getHierarchyRingGuides } from '@core/layout/hierarchy-layout'
import type { LayoutRuntimeConfig } from '@core/layout/layout-config'
import { LAYOUT_NODE_BOX } from '@core/layout/layout-constraints'
import type { GraphSnapshot } from '@core/types'

/** Find the ring layer whose circumference is closest to a graph-space point. */
export function pickHierarchyRingAtPoint(
  snapshot: GraphSnapshot,
  runtime: LayoutRuntimeConfig,
  flowX: number,
  flowY: number,
  zoom: number
): string | null {
  if (!snapshot.entryNodeId) return null
  const entry = snapshot.positions[snapshot.entryNodeId]
  if (!entry) return null

  const cx = entry.x + LAYOUT_NODE_BOX.width / 2
  const cy = entry.y + LAYOUT_NODE_BOX.height / 2
  const dist = Math.hypot(flowX - cx, flowY - cy)
  const band = Math.max(14, 22 / Math.max(0.35, zoom))

  const guides = getHierarchyRingGuides(
    snapshot.nodes,
    snapshot.edges,
    snapshot.entryNodeId,
    runtime,
    runtime.organizationMethod
  )

  let bestKey: string | null = null
  let bestDelta = band
  for (const ring of guides) {
    const key = `${ring.depth}-${ring.ringIndex}-${ring.radius}`
    const delta = Math.abs(dist - ring.radius)
    if (delta < bestDelta) {
      bestDelta = delta
      bestKey = key
    }
  }
  return bestKey
}

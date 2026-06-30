import type { HierarchyRingBand } from './hierarchy-layout'

/** One visual annulus per semantic depth (merges overflow sub-rings). */
export interface HierarchyDepthVisual {
  depth: number
  innerRadius: number
  outerRadius: number
  bandKeys: string[]
}

/** Consolidate layout bands into depth-level guide rings for rendering. */
export function consolidateHierarchyDepthVisuals(
  bands: HierarchyRingBand[],
  centerOuterRadius: number
): HierarchyDepthVisual[] {
  const byDepth = new Map<number, HierarchyDepthVisual>()

  for (const band of bands) {
    if (band.outerRadius <= centerOuterRadius + 2) continue
    const existing = byDepth.get(band.semanticDepth)
    if (!existing) {
      byDepth.set(band.semanticDepth, {
        depth: band.semanticDepth,
        innerRadius: Math.max(centerOuterRadius, band.innerRadius),
        outerRadius: band.outerRadius,
        bandKeys: [band.key]
      })
      continue
    }
    existing.innerRadius = Math.min(existing.innerRadius, Math.max(centerOuterRadius, band.innerRadius))
    existing.outerRadius = Math.max(existing.outerRadius, band.outerRadius)
    existing.bandKeys.push(band.key)
  }

  return [...byDepth.values()].sort((a, b) => a.depth - b.depth)
}

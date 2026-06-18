import {
  computeHierarchyLayout,
  computePyramidLayout,
  computeScatterLayout
} from '@core/layout/hierarchy-layout'
import type { LayoutRuntimeConfig } from '@core/layout/layout-config'
import type { GraphSnapshot, LayoutMode, LayoutPosition } from '@core/types'

/** Compute architecture layout positions in the renderer (no IPC). */
export function computeClientLayout(
  snapshot: GraphSnapshot,
  mode: LayoutMode,
  runtime: LayoutRuntimeConfig
): Record<string, LayoutPosition> {
  const layoutNodes = snapshot.nodes.filter((n) => n.kind !== 'folder')
  if (layoutNodes.length === 0 || !snapshot.entryNodeId) return {}

  const opts = {
    entryNodeId: snapshot.entryNodeId,
    runtime
  }

  let positions: Record<string, LayoutPosition>
  switch (mode) {
    case 'pyramid':
      positions = computePyramidLayout(layoutNodes, snapshot.edges, opts)
      break
    case 'scattered':
      positions = computeScatterLayout(layoutNodes, snapshot.edges, opts)
      break
    case 'hierarchy':
    default:
      positions = computeHierarchyLayout(layoutNodes, snapshot.edges, opts)
      break
  }

  for (const folder of snapshot.nodes.filter((n) => n.kind === 'folder')) {
    const children = snapshot.nodes.filter(
      (n) => n.parentId === folder.id && positions[n.id]
    )
    if (children.length > 0) {
      positions[folder.id] = {
        x: children.reduce((s, c) => s + positions[c.id].x, 0) / children.length,
        y: children.reduce((s, c) => s + positions[c.id].y, 0) / children.length
      }
    }
  }

  return positions
}

import type { NodeObject } from 'react-force-graph-2d'
import type { NetworkNode } from './network-model'

export type PickableNetworkNode = NetworkNode & NodeObject

export interface NetworkPickContext {
  clientX: number
  clientY: number
  containerRect: DOMRect
  screen2GraphCoords: (canvasX: number, canvasY: number) => { x: number; y: number }
  nodes: PickableNetworkNode[]
  settleOffset: { x: number; y: number }
  hitRadiusFor: (node: PickableNetworkNode) => number
  depthFor: (nodeId: string) => number
}

/**
 * Single picking pipeline for hover and click — uses canvas-local coordinates,
 * settle offset, hit radius, and frontmost depth (highest depthScale wins).
 */
export function pickNetworkNodeAtScreenPoint(ctx: NetworkPickContext): string | null {
  const canvasX = ctx.clientX - ctx.containerRect.left
  const canvasY = ctx.clientY - ctx.containerRect.top
  const coords = ctx.screen2GraphCoords(canvasX, canvasY)
  const { x: offX, y: offY } = ctx.settleOffset

  let bestId: string | null = null
  let bestDepth = -Infinity

  for (const node of ctx.nodes) {
    const x = (node.x ?? 0) + offX
    const y = (node.y ?? 0) + offY
    const r = ctx.hitRadiusFor(node)
    if (Math.hypot(coords.x - x, coords.y - y) > r) continue

    const depth = ctx.depthFor(node.id)
    if (depth > bestDepth) {
      bestDepth = depth
      bestId = node.id
    }
  }

  return bestId
}

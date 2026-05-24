import type { GraphEdge, GraphNode, LayoutPosition } from '../types'

export interface HierarchyLayoutOptions {
  entryNodeId: string
  layerSpacing?: number
  baseRadius?: number
  nodePadding?: number
}

/**
 * Radial hierarchy: entry at center, dependencies on expanding rings by BFS depth.
 */
export function computeHierarchyLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: HierarchyLayoutOptions
): Record<string, LayoutPosition> {
  const { entryNodeId, layerSpacing = 200, baseRadius = 0, nodePadding = 28 } = options

  const layoutNodes = nodes.filter((n) => n.kind !== 'folder')
  const nodeIds = new Set(layoutNodes.map((n) => n.id))
  const importEdges = edges.filter(
    (e) => e.kind === 'import' && nodeIds.has(e.source) && nodeIds.has(e.target)
  )

  const outbound = new Map<string, string[]>()
  const inbound = new Map<string, string[]>()
  for (const e of importEdges) {
    if (!outbound.has(e.source)) outbound.set(e.source, [])
    outbound.get(e.source)!.push(e.target)
    if (!inbound.has(e.target)) inbound.set(e.target, [])
    inbound.get(e.target)!.push(e.source)
  }

  const depth = new Map<string, number>()
  const queue: string[] = []

  if (nodeIds.has(entryNodeId)) {
    depth.set(entryNodeId, 0)
    queue.push(entryNodeId)
  }

  while (queue.length > 0) {
    const current = queue.shift()!
    const d = depth.get(current)!
    for (const next of outbound.get(current) ?? []) {
      if (!depth.has(next)) {
        depth.set(next, d + 1)
        queue.push(next)
      }
    }
  }

  const maxBfsDepth = Math.max(0, ...depth.values())
  for (const node of layoutNodes) {
    if (!depth.has(node.id)) {
      const importers = inbound.get(node.id)?.length ?? 0
      depth.set(node.id, maxBfsDepth + 1 + Math.min(importers, 3))
    }
  }

  const layers = new Map<number, string[]>()
  for (const node of layoutNodes) {
    const d = depth.get(node.id) ?? 1
    if (!layers.has(d)) layers.set(d, [])
    layers.get(d)!.push(node.id)
  }

  const positions: Record<string, LayoutPosition> = {}

  for (const [layer, ids] of layers) {
    const count = ids.length
    const radius = layer === 0 ? baseRadius : baseRadius + layer * layerSpacing
    const angleStep = count > 0 ? (2 * Math.PI) / count : 0
    const startAngle = layer % 2 === 0 ? -Math.PI / 2 : -Math.PI / 2 + angleStep / 2

    ids.forEach((id, i) => {
      if (layer === 0) {
        positions[id] = { x: 0, y: 0 }
        return
      }
      const angle = startAngle + i * angleStep
      positions[id] = {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius
      }
    })
  }

  resolveCollisions(positions, layoutNodes, nodePadding)
  centerGraph(positions)

  return positions
}

function resolveCollisions(
  positions: Record<string, LayoutPosition>,
  nodes: GraphNode[],
  minDist: number
): void {
  const ids = nodes.map((n) => n.id).filter((id) => positions[id])
  for (let pass = 0; pass < 6; pass++) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = positions[ids[i]]
        const b = positions[ids[j]]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01
        if (dist < minDist) {
          const push = (minDist - dist) / 2
          const nx = dx / dist
          const ny = dy / dist
          a.x -= nx * push
          a.y -= ny * push
          b.x += nx * push
          b.y += ny * push
        }
      }
    }
  }
}

function centerGraph(positions: Record<string, LayoutPosition>): void {
  const vals = Object.values(positions)
  if (vals.length === 0) return
  const cx = vals.reduce((s, p) => s + p.x, 0) / vals.length
  const cy = vals.reduce((s, p) => s + p.y, 0) / vals.length
  for (const id of Object.keys(positions)) {
    positions[id] = {
      x: positions[id].x - cx,
      y: positions[id].y - cy
    }
  }
}

export function getNodesWithinDepth(
  entryNodeId: string,
  edges: GraphEdge[],
  maxDepth: number
): Set<string> {
  const visible = new Set<string>([entryNodeId])
  if (maxDepth < 0) return visible

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

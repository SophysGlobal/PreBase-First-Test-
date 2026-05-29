import type { GraphEdge, GraphNode } from '../types'

export interface DependencyDepthResult {
  depth: Map<string, number>
  layers: Map<number, string[]>
  entryNodeId: string
}

export function computeDependencyDepths(
  nodes: GraphNode[],
  edges: GraphEdge[],
  entryNodeId: string
): DependencyDepthResult {
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

  const maxBfsDepth = depth.size > 0 ? Math.max(...depth.values()) : 0
  for (const node of layoutNodes) {
    if (!depth.has(node.id)) {
      depth.set(node.id, maxBfsDepth + 1 + Math.min(inbound.get(node.id)?.length ?? 0, 2))
    }
  }

  const layers = new Map<number, string[]>()
  for (const node of layoutNodes) {
    const d = depth.get(node.id) ?? 1
    if (!layers.has(d)) layers.set(d, [])
    layers.get(d)!.push(node.id)
  }

  return { depth, layers, entryNodeId }
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return []
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

export const HIERARCHY_LAYER_LABELS = [
  'Root',
  'Layer 1 · Direct',
  'Layer 2 · Secondary',
  'Layer 3 · Deep',
  'Layer 4+ · Outer'
] as const

export function labelForDepth(depth: number): string {
  if (depth <= 0) return HIERARCHY_LAYER_LABELS[0]
  if (depth < HIERARCHY_LAYER_LABELS.length) return HIERARCHY_LAYER_LABELS[depth]
  return HIERARCHY_LAYER_LABELS[HIERARCHY_LAYER_LABELS.length - 1]
}

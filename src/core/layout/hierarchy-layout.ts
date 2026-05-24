import type { ArchitectureLayerId } from '../utils/architecture-layers'
import type { GraphEdge, GraphNode, LayoutPosition } from '../types'

export interface HierarchyLayoutOptions {
  entryNodeId: string
  layerSpacing?: number
  baseRadius?: number
  nodePadding?: number
  clusterSeparation?: number
}

const LAYER_SECTOR_ORDER: ArchitectureLayerId[] = [
  'entry',
  'frontend',
  'ui',
  'components',
  'api',
  'auth',
  'services',
  'backend',
  'database',
  'utils',
  'config',
  'other',
  'tests'
]

/**
 * Radial hierarchy with cluster-aware sector spacing and strong collision resolution.
 */
export function computeHierarchyLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: HierarchyLayoutOptions
): Record<string, LayoutPosition> {
  const {
    entryNodeId,
    layerSpacing = 340,
    baseRadius = 0,
    nodePadding = 88,
    clusterSeparation = 420
  } = options

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
      depth.set(node.id, maxBfsDepth + 1 + Math.min(inbound.get(node.id)?.length ?? 0, 2))
    }
  }

  const layers = new Map<number, string[]>()
  for (const node of layoutNodes) {
    const d = depth.get(node.id) ?? 1
    if (!layers.has(d)) layers.set(d, [])
    layers.get(d)!.push(node.id)
  }

  const positions: Record<string, LayoutPosition> = {}
  const nodeById = new Map(layoutNodes.map((n) => [n.id, n]))

  for (const [layer, ids] of layers) {
    if (layer === 0) {
      positions[entryNodeId] = { x: 0, y: 0 }
      continue
    }

    const radius = baseRadius + layer * layerSpacing
    const byArchLayer = new Map<ArchitectureLayerId, string[]>()

    for (const id of ids) {
      const arch =
        (nodeById.get(id)?.meta?.architectureLayer as ArchitectureLayerId | undefined) ?? 'other'
      if (!byArchLayer.has(arch)) byArchLayer.set(arch, [])
      byArchLayer.get(arch)!.push(id)
    }

    const archKeys = [...byArchLayer.keys()].sort(
      (a, b) => LAYER_SECTOR_ORDER.indexOf(a) - LAYER_SECTOR_ORDER.indexOf(b)
    )
    const sectorCount = Math.max(archKeys.length, 1)
    const sectorWidth = (2 * Math.PI) / sectorCount

    archKeys.forEach((archId, sectorIndex) => {
      const sectorIds = byArchLayer.get(archId)!
      const sectorStart = -Math.PI / 2 + sectorIndex * sectorWidth
      const angleStep = sectorIds.length > 0 ? sectorWidth / (sectorIds.length + 1) : sectorWidth

      sectorIds.forEach((id, i) => {
        const angle = sectorStart + angleStep * (i + 1)
        const jitter = layer % 2 === 0 ? 0.04 * i : -0.04 * i
        positions[id] = {
          x: Math.cos(angle + jitter) * radius,
          y: Math.sin(angle + jitter) * radius
        }
      })
    })
  }

  resolveCollisions(positions, layoutNodes, nodePadding, 12)
  separateArchitectureClusters(positions, layoutNodes, clusterSeparation)
  resolveCollisions(positions, layoutNodes, nodePadding * 0.85, 6)
  centerGraph(positions)

  return positions
}

function separateArchitectureClusters(
  positions: Record<string, LayoutPosition>,
  nodes: GraphNode[],
  minClusterDist: number
): void {
  const clusters = new Map<ArchitectureLayerId, { ids: string[]; cx: number; cy: number }>()

  for (const node of nodes) {
    const arch =
      (node.meta?.architectureLayer as ArchitectureLayerId | undefined) ?? 'other'
    if (arch === 'entry') continue
    if (!positions[node.id]) continue
    if (!clusters.has(arch)) clusters.set(arch, { ids: [], cx: 0, cy: 0 })
    clusters.get(arch)!.ids.push(node.id)
  }

  for (const cluster of clusters.values()) {
    if (cluster.ids.length === 0) continue
    let sx = 0
    let sy = 0
    for (const id of cluster.ids) {
      sx += positions[id].x
      sy += positions[id].y
    }
    cluster.cx = sx / cluster.ids.length
    cluster.cy = sy / cluster.ids.length
  }

  const clusterList = [...clusters.entries()]
  for (let pass = 0; pass < 8; pass++) {
    for (let i = 0; i < clusterList.length; i++) {
      for (let j = i + 1; j < clusterList.length; j++) {
        const [, a] = clusterList[i]
        const [, b] = clusterList[j]
        const dx = b.cx - a.cx
        const dy = b.cy - a.cy
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01
        if (dist >= minClusterDist) continue

        const push = (minClusterDist - dist) / 2
        const nx = dx / dist
        const ny = dy / dist
        translateCluster(positions, a.ids, -nx * push, -ny * push)
        translateCluster(positions, b.ids, nx * push, ny * push)
        a.cx -= nx * push
        a.cy -= ny * push
        b.cx += nx * push
        b.cy += ny * push
      }
    }
  }
}

function translateCluster(
  positions: Record<string, LayoutPosition>,
  ids: string[],
  dx: number,
  dy: number
): void {
  for (const id of ids) {
    if (positions[id]) {
      positions[id] = { x: positions[id].x + dx, y: positions[id].y + dy }
    }
  }
}

function resolveCollisions(
  positions: Record<string, LayoutPosition>,
  nodes: GraphNode[],
  minDist: number,
  passes: number
): void {
  const ids = nodes.map((n) => n.id).filter((id) => positions[id])
  for (let pass = 0; pass < passes; pass++) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = positions[ids[i]]
        const b = positions[ids[j]]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01
        const entryBoost = ids[i].includes('entry') || ids[j].includes('entry') ? 1.25 : 1
        const required = minDist * entryBoost
        if (dist < required) {
          const push = (required - dist) / 2
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
    positions[id] = { x: positions[id].x - cx, y: positions[id].y - cy }
  }
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

import type { GraphEdge, GraphNode, LayoutPosition } from '../types'
import {
  chunkArray,
  computeDependencyDepths,
  labelForDepth,
  type DependencyDepthResult
} from './dependency-depth'

export interface HierarchyLayoutOptions {
  entryNodeId: string
  maxNodesPerRing?: number
  layerGap?: number
  subRingGap?: number
  centerClearance?: number
  maxRadius?: number
  nodeWidth?: number
  nodeGap?: number
}

export interface HierarchyRingLabel {
  depth: number
  label: string
  radius: number
  x: number
  y: number
}

const NODE_W = 168
const NODE_GAP = 28

const DEFAULTS = {
  maxNodesPerRing: 10,
  layerGap: 132,
  subRingGap: 44,
  centerClearance: 108,
  maxRadius: 520,
  nodeWidth: NODE_W,
  nodeGap: NODE_GAP
}

/** Minimum ring radius so `count` nodes do not overlap on the circle. */
function minRadiusForCount(count: number, nodeWidth: number, gap: number): number {
  if (count <= 1) return 0
  const chord = nodeWidth + gap
  return (count * chord) / (2 * Math.PI)
}

function placeOnRing(
  ids: string[],
  radius: number,
  positions: Record<string, LayoutPosition>
): void {
  if (ids.length === 0) return
  if (ids.length === 1) {
    positions[ids[0]] = { x: 0, y: -radius }
    return
  }
  ids.forEach((id, i) => {
    const angle = (2 * Math.PI * i) / ids.length - Math.PI / 2
    positions[id] = {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius
    }
  })
}

function depthBaseRadius(depth: number, cfg: typeof DEFAULTS): number {
  if (depth <= 0) return 0
  return cfg.centerClearance + (depth - 1) * cfg.layerGap
}

export function computeHierarchyLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: HierarchyLayoutOptions
): Record<string, LayoutPosition> {
  const cfg = { ...DEFAULTS, ...options }
  const { layers, entryNodeId } = computeDependencyDepths(nodes, edges, options.entryNodeId)
  const positions: Record<string, LayoutPosition> = {}

  for (const [depth, ids] of [...layers.entries()].sort((a, b) => a[0] - b[0])) {
    if (depth === 0) {
      positions[entryNodeId] = { x: 0, y: 0 }
      continue
    }

    const rings = chunkArray(ids, cfg.maxNodesPerRing)
    const base = depthBaseRadius(depth, cfg)

    rings.forEach((ringIds, ringIndex) => {
      const minR = minRadiusForCount(ringIds.length, cfg.nodeWidth, cfg.nodeGap)
      const radius = Math.min(
        cfg.maxRadius,
        Math.max(base + ringIndex * cfg.subRingGap, minR + base * 0.15)
      )
      placeOnRing(ringIds, radius, positions)
    })
  }

  centerGraph(positions)
  return positions
}

export function computePyramidLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: HierarchyLayoutOptions
): Record<string, LayoutPosition> {
  const maxNodesPerRow = options.maxNodesPerRing ?? DEFAULTS.maxNodesPerRing
  const colWidth = 192
  const rowHeight = 88
  const tierGap = 96
  const boxW = 176
  const boxH = 60

  const { layers, entryNodeId } = computeDependencyDepths(nodes, edges, options.entryNodeId)
  const positions: Record<string, LayoutPosition> = {}

  for (const [depth, ids] of [...layers.entries()].sort((a, b) => a[0] - b[0])) {
    if (depth === 0) {
      positions[entryNodeId] = { x: 0, y: 0 }
      continue
    }

    const rows = chunkArray(ids, maxNodesPerRow)
    rows.forEach((rowIds, rowIndex) => {
      const y = depth * tierGap + rowIndex * rowHeight
      const span = Math.max(0, (rowIds.length - 1) * colWidth)
      rowIds.forEach((id, i) => {
        positions[id] = { x: -span / 2 + i * colWidth, y }
      })
    })
  }

  resolveRectCollisions(positions, boxW, boxH, 12)
  centerGraph(positions)
  return positions
}

export function computeScatterLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: HierarchyLayoutOptions
): Record<string, LayoutPosition> {
  const cfg = {
    maxNodesPerRing: 8,
    layerGap: 100,
    subRingGap: 32,
    centerClearance: 92,
    maxRadius: 400,
    nodeWidth: NODE_W,
    nodeGap: 24,
    ...options
  }
  const { layers, entryNodeId } = computeDependencyDepths(nodes, edges, options.entryNodeId)
  const positions: Record<string, LayoutPosition> = {}

  for (const [depth, ids] of [...layers.entries()].sort((a, b) => a[0] - b[0])) {
    if (depth === 0) {
      positions[entryNodeId] = { x: 0, y: 0 }
      continue
    }

    const rings = chunkArray(ids, cfg.maxNodesPerRing)
    const base = depthBaseRadius(depth, cfg)

    rings.forEach((ringIds, ringIndex) => {
      const minR = minRadiusForCount(ringIds.length, cfg.nodeWidth, cfg.nodeGap)
      const radius = Math.min(
        cfg.maxRadius,
        Math.max(base + ringIndex * cfg.subRingGap, minR + base * 0.12)
      )
      ringIds.forEach((id, i) => {
        const baseAngle = (2 * Math.PI * i) / ringIds.length - Math.PI / 2
        const jitter = ((i * 5 + depth * 2) % 7) * 0.012
        const angle = baseAngle + jitter
        positions[id] = {
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius
        }
      })
    })
  }

  centerGraph(positions)
  return positions
}

export function getHierarchyRingLabels(
  nodes: GraphNode[],
  edges: GraphEdge[],
  entryNodeId: string
): HierarchyRingLabel[] {
  const { layers } = computeDependencyDepths(nodes, edges, entryNodeId)
  const labels: HierarchyRingLabel[] = []
  const cfg = DEFAULTS

  for (const depth of [...layers.keys()].sort((a, b) => a - b)) {
    if (depth === 0) continue
    const ids = layers.get(depth) ?? []
    const ringCount = Math.ceil(ids.length / cfg.maxNodesPerRing)
    const outerRingIndex = Math.max(0, ringCount - 1)
    const base = depthBaseRadius(depth, cfg)
    const minR = minRadiusForCount(
      Math.min(ids.length, cfg.maxNodesPerRing),
      cfg.nodeWidth,
      cfg.nodeGap
    )
    const radius = Math.min(
      cfg.maxRadius,
      Math.max(base + outerRingIndex * cfg.subRingGap, minR + base * 0.15)
    )
    labels.push({
      depth,
      label: labelForDepth(depth),
      radius,
      x: 0,
      y: -radius - 32
    })
  }

  return labels
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

function resolveRectCollisions(
  positions: Record<string, LayoutPosition>,
  boxW: number,
  boxH: number,
  passes: number
): void {
  const ids = Object.keys(positions)
  const padX = boxW * 0.55
  const padY = boxH * 0.55

  for (let pass = 0; pass < passes; pass++) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = positions[ids[i]]
        const b = positions[ids[j]]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const overlapX = padX - Math.abs(dx)
        const overlapY = padY - Math.abs(dy)
        if (overlapX > 0 && overlapY > 0) {
          const pushX = overlapX / 2
          const pushY = overlapY / 2
          const signX = dx === 0 ? (i % 2 === 0 ? 1 : -1) : Math.sign(dx)
          const signY = dy === 0 ? (j % 2 === 0 ? 1 : -1) : Math.sign(dy)
          a.x -= signX * pushX
          a.y -= signY * pushY
          b.x += signX * pushX
          b.y += signY * pushY
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

export type { DependencyDepthResult }

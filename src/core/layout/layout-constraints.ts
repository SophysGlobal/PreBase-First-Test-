import type { LayoutPosition } from '../types'

/** Shared node bounding box used across all layout modes. */
export const LAYOUT_NODE_BOX = {
  width: 176,
  height: 60,
  // Spacing factors below resolve overlap to a readable gap. Rendered nodes are
  // 168px wide, so the previous 0.55 factor (~97px min center distance) let cards
  // overlap by ~70px. These factors keep a clear gutter on every side.
  padX: 176 * 1.06,
  padY: 60 * 1.5,
  minDist: 196
} as const

export interface LayoutConstraintOptions {
  collisionPasses?: number
  minDist?: number
}

/** Rectangular collision resolution — shared by all layouts. */
export function resolveRectCollisions(
  positions: Record<string, LayoutPosition>,
  boxW: number,
  boxH: number,
  passes: number
): void {
  const ids = Object.keys(positions)
  // Minimum center-to-center separation that still reads as non-overlapping with a
  // comfortable gutter. boxW≈node width + gutter, boxH gives generous vertical air.
  const padX = boxW * 1.06
  const padY = boxH * 1.5

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

/** Minimum-distance spacing for ring / scatter groups. */
export function enforceMinimumSpacing(
  positions: Record<string, LayoutPosition>,
  ids: string[],
  minDist: number,
  iterations: number
): void {
  if (ids.length < 2) return
  for (let pass = 0; pass < iterations; pass++) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = positions[ids[i]]
        const b = positions[ids[j]]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dist = Math.hypot(dx, dy) || 0.001
        if (dist >= minDist) continue
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

/** Clamp node positions to a bounded disc so SVG/compositor layers stay finite. */
export function clampLayoutSpread(
  positions: Record<string, LayoutPosition>,
  maxRadius = 680
): void {
  for (const id of Object.keys(positions)) {
    const p = positions[id]
    const d = Math.hypot(p.x, p.y)
    if (d > maxRadius) {
      const k = maxRadius / d
      positions[id] = { x: p.x * k, y: p.y * k }
    }
  }
}

/** Apply universal post-layout constraints to every layout mode. */
export function applyUniversalLayoutConstraints(
  positions: Record<string, LayoutPosition>,
  options: LayoutConstraintOptions = {}
): void {
  const { width, height } = LAYOUT_NODE_BOX
  resolveRectCollisions(positions, width, height, options.collisionPasses ?? 20)
  clampLayoutSpread(positions)
}

export function centerGraph(positions: Record<string, LayoutPosition>): void {
  const vals = Object.values(positions)
  if (vals.length === 0) return
  const cx = vals.reduce((s, p) => s + p.x, 0) / vals.length
  const cy = vals.reduce((s, p) => s + p.y, 0) / vals.length
  for (const id of Object.keys(positions)) {
    positions[id] = { x: positions[id].x - cx, y: positions[id].y - cy }
  }
}

/** Viewport fit parameters per layout mode. */
export function viewportFitForLayout(mode: string): {
  padding: number
  minZoom: number
  maxZoom: number
} {
  switch (mode) {
    case 'pyramid':
      return { padding: 0.08, minZoom: 0.45, maxZoom: 0.92 }
    case 'scattered':
      return { padding: 0.14, minZoom: 0.5, maxZoom: 1.0 }
    case 'hierarchy':
    default:
      return { padding: 0.16, minZoom: 0.55, maxZoom: 1.02 }
  }
}

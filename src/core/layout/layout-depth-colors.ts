/** Shared depth palette for Hierarchy rings and Pyramid bands. */

const DEPTH_COLORS = [
  'rgba(45,212,191,0.38)',
  'rgba(96,165,250,0.34)',
  'rgba(167,139,250,0.32)',
  'rgba(251,191,36,0.30)',
  'rgba(244,114,182,0.28)',
  'rgba(74,222,128,0.26)',
  'rgba(196,181,253,0.24)',
  'rgba(148,163,184,0.22)'
] as const

/** Color for a depth level (1 = innermost ring/band after entry). */
export function depthLevelColor(depth: number): string {
  if (depth <= 0) return 'rgba(45,212,191,0.45)'
  return DEPTH_COLORS[(depth - 1) % DEPTH_COLORS.length]
}

/** Border color with higher opacity for selected state. */
export function depthLevelBorderColor(depth: number, selected = false): string {
  const base = depthLevelColor(depth)
  if (!selected) return base.replace(/[\d.]+\)$/, '0.42)')
  return base.replace(/[\d.]+\)$/, '0.62)')
}

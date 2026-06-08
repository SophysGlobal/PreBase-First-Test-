/** Obsidian-style cluster palette (saturated hues on dark background). */
export const OBSIDIAN_GROUP_PALETTE = [
  '#c75c5c',
  '#6dbd6d',
  '#d484a8',
  '#6aace8',
  '#d4b454',
  '#9b7ed4',
  '#5cc5c5',
  '#c49a5c',
  '#8b9fd4',
  '#7bc97b'
] as const

const groupColorIndex = new Map<string, number>()

export function topLevelGroup(path: string | undefined): string {
  if (!path) return '(root)'
  const norm = path.replace(/\\/g, '/')
  const slash = norm.indexOf('/')
  return slash >= 0 ? norm.slice(0, slash) : norm
}

/** Stable color per top-level folder / package segment. */
export function colorForPathGroup(path: string | undefined): string {
  const group = topLevelGroup(path)
  let idx = groupColorIndex.get(group)
  if (idx === undefined) {
    idx = groupColorIndex.size % OBSIDIAN_GROUP_PALETTE.length
    groupColorIndex.set(group, idx)
  }
  return OBSIDIAN_GROUP_PALETTE[idx]
}

export function resetGroupColorCache(): void {
  groupColorIndex.clear()
}

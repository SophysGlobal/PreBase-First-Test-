import type { GraphNode, GraphSnapshot } from '../../../core/types'

export function getDirectChildren(snapshot: GraphSnapshot, folderId: string): GraphNode[] {
  return snapshot.nodes.filter((n) => n.parentId === folderId)
}

export function getDescendantIds(snapshot: GraphSnapshot, folderId: string): Set<string> {
  const result = new Set<string>()
  const queue = [folderId]

  while (queue.length > 0) {
    const id = queue.shift()!
    for (const node of snapshot.nodes) {
      if (node.parentId === id && !result.has(node.id)) {
        result.add(node.id)
        queue.push(node.id)
      }
    }
  }
  return result
}

export function isNodeHiddenByCollapsedFolders(
  node: GraphNode,
  snapshot: GraphSnapshot,
  expandedFolderIds: Set<string>
): boolean {
  if (node.kind === 'folder') return false

  let parentId = node.parentId
  while (parentId) {
    if (parentId.startsWith('folder:') && !expandedFolderIds.has(parentId)) {
      return true
    }
    const parent = snapshot.nodes.find((n) => n.id === parentId)
    parentId = parent?.parentId
  }
  return false
}

export function computeRadialPositions(
  center: { x: number; y: number },
  childIds: string[],
  radius = 120
): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {}
  const n = childIds.length
  if (n === 0) return positions

  const r = radius + Math.min(n * 6, 48)
  childIds.forEach((id, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2
    positions[id] = {
      x: center.x + Math.cos(angle) * r,
      y: center.y + Math.sin(angle) * r
    }
  })
  return positions
}

export function getFolderInspectorContents(
  snapshot: GraphSnapshot,
  folderId: string
): {
  files: GraphNode[]
  subfolders: GraphNode[]
  fileCount: number
  folderCount: number
} {
  const direct = getDirectChildren(snapshot, folderId)
  const subfolders = direct.filter((n) => n.kind === 'folder')
  const files = direct.filter(
    (n) => n.kind === 'file' || n.kind === 'component' || n.kind === 'module'
  )
  const descendants = getDescendantIds(snapshot, folderId)
  const fileCount = [...descendants].filter((id) => {
    const n = snapshot.nodes.find((x) => x.id === id)
    return n && n.kind !== 'folder'
  }).length
  const folderCount = [...descendants].filter((id) => {
    const n = snapshot.nodes.find((x) => x.id === id)
    return n?.kind === 'folder'
  }).length

  return { files, subfolders, fileCount, folderCount }
}

export function folderPathFromId(folderId: string): string {
  return folderId.replace(/^folder:/, '') || '(root)'
}

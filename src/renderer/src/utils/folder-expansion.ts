import type { GraphNode, GraphSnapshot } from '../../../core/types'
import { chunkArray } from '../../../core/layout/dependency-depth'

const MAX_CHILDREN_PER_RING = 8
const BASE_RADIUS = 82
const RING_STEP = 26
const MAX_EXPANSION_RADIUS = 210

export function buildChildrenIndex(nodes: GraphNode[]): Map<string, GraphNode[]> {
  const index = new Map<string, GraphNode[]>()
  for (const node of nodes) {
    if (!node.parentId) continue
    const list = index.get(node.parentId)
    if (list) list.push(node)
    else index.set(node.parentId, [node])
  }
  return index
}

export function getDirectChildren(
  snapshot: GraphSnapshot,
  folderId: string,
  index?: Map<string, GraphNode[]>
): GraphNode[] {
  if (index) return index.get(folderId) ?? []
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
  expandedFolderIds: Set<string>,
  treeMode: boolean
): boolean {
  if (!treeMode || node.kind === 'folder') return false

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
  baseRadius = BASE_RADIUS
): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {}
  if (childIds.length === 0) return positions

  const rings = chunkArray(childIds, MAX_CHILDREN_PER_RING)
  rings.forEach((ringIds, ringIndex) => {
    const radius = Math.min(MAX_EXPANSION_RADIUS, baseRadius + ringIndex * RING_STEP)
    ringIds.forEach((id, i) => {
      const angle = (2 * Math.PI * i) / ringIds.length - Math.PI / 2
      positions[id] = {
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius
      }
    })
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

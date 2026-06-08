import type { GraphNode } from '../../../core/types'
import { toProjectRelativePath } from './path-utils'

export interface FileNode {
  type: 'file'
  node: GraphNode
  name: string
  relativePath: string
}

export interface DirNode {
  type: 'dir'
  name: string
  fullPath: string
  children: TreeEntry[]
}

export type TreeEntry = FileNode | DirNode

export function isReadableFile(node: GraphNode, projectPath: string): boolean {
  if (!node.path) return false
  if (node.kind !== 'file' && node.kind !== 'component') return false
  return toProjectRelativePath(projectPath, node.path) !== null
}

export function buildProjectTree(nodes: GraphNode[], projectPath: string): DirNode {
  const root: DirNode = { type: 'dir', name: '', fullPath: '', children: [] }

  for (const node of nodes) {
    if (!isReadableFile(node, projectPath)) continue
    const rel = toProjectRelativePath(projectPath, node.path!)
    if (!rel) continue

    const parts = rel.split('/')
    let current = root

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]
      let dir = current.children.find(
        (c): c is DirNode => c.type === 'dir' && c.name === part
      )
      if (!dir) {
        dir = {
          type: 'dir',
          name: part,
          fullPath: parts.slice(0, i + 1).join('/'),
          children: []
        }
        current.children.push(dir)
      }
      current = dir
    }

    current.children.push({
      type: 'file',
      node,
      name: parts[parts.length - 1],
      relativePath: rel
    })
  }

  function sortChildren(node: DirNode) {
    node.children.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    })
    for (const child of node.children) {
      if (child.type === 'dir') sortChildren(child)
    }
  }
  sortChildren(root)
  return root
}

export function filterTree(node: DirNode, query: string): DirNode {
  if (!query) return node
  const q = query.toLowerCase()

  function filterDir(dir: DirNode): DirNode | null {
    const filtered: TreeEntry[] = []
    for (const child of dir.children) {
      if (child.type === 'file') {
        if (
          child.name.toLowerCase().includes(q) ||
          child.node.path?.toLowerCase().includes(q)
        ) {
          filtered.push(child)
        }
      } else {
        const filteredDir = filterDir(child)
        if (filteredDir) filtered.push(filteredDir)
      }
    }
    if (filtered.length === 0) return null
    return { ...dir, children: filtered }
  }

  return filterDir(node) ?? { ...node, children: [] }
}

export function getAllDirPaths(node: DirNode): string[] {
  const paths: string[] = []
  function collect(n: DirNode) {
    for (const child of n.children) {
      if (child.type === 'dir') {
        paths.push(child.fullPath)
        collect(child)
      }
    }
  }
  collect(node)
  return paths
}

export function flattenFiles(node: DirNode): FileNode[] {
  const files: FileNode[] = []
  function walk(n: DirNode) {
    for (const child of n.children) {
      if (child.type === 'file') files.push(child)
      else walk(child)
    }
  }
  walk(node)
  return files.sort((a, b) =>
    a.relativePath.localeCompare(b.relativePath, undefined, { sensitivity: 'base' })
  )
}

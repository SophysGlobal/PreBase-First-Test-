import type { GraphSnapshot } from '../../../core/types'
import type { ArchitectureLayerId } from '../../../core/utils/architecture-layers'
import { computeNodeImportance } from '../../../core/utils/architecture-layers'
import { getRenderableNodeIds, type FlowAdapterOptions } from './flow-adapter'
import { selectVisibleImportEdgeIds } from './edge-ranking'
import { getFileTypeColor, getFileTypeInfo } from './file-type-colors'

export interface NetworkNode {
  id: string
  label: string
  kind: string
  path?: string
  color: string
  fileTypeId: string
  layer?: ArchitectureLayerId
  /** Render size, scaled by architectural importance. */
  val: number
  isEntry: boolean
}

export interface NetworkLink {
  source: string
  target: string
  kind: 'import' | 'dependency'
}

export interface NetworkModel {
  nodes: NetworkNode[]
  links: NetworkLink[]
}

/**
 * Build data for the Obsidian-style 2D network view. Reuses the same renderable-node
 * resolution and max-2 edge-reduction ranking as the tree view.
 */
export function buildNetworkModel(
  snapshot: GraphSnapshot,
  options: FlowAdapterOptions
): NetworkModel {
  const renderable = getRenderableNodeIds(snapshot, options)
  const entryNodeId = snapshot.entryNodeId

  const importanceByNode = new Map<string, ReturnType<typeof computeNodeImportance>>()
  for (const node of snapshot.nodes) {
    if (node.kind === 'folder') continue
    importanceByNode.set(node.id, computeNodeImportance(node.id, snapshot.edges))
  }

  const nodes: NetworkNode[] = []
  for (const node of snapshot.nodes) {
    if (!renderable.has(node.id)) continue
    if (node.kind === 'function') continue
    const isEntry = Boolean(node.isEntry || node.id === entryNodeId)
    const imp = importanceByNode.get(node.id)
    const degree = (imp?.inDegree ?? 0) + (imp?.outDegree ?? 0)
    const fileType = getFileTypeInfo(node.path)
    nodes.push({
      id: node.id,
      label: node.label,
      kind: node.kind,
      path: node.path,
      fileTypeId: fileType.id,
      color: isEntry ? '#e8b84a' : getFileTypeColor(node.path),
      layer: node.meta?.architectureLayer as ArchitectureLayerId | undefined,
      // Hub nodes grow with connectivity (Obsidian-style).
      val: isEntry ? 10 : Math.max(1.5, 1.2 + Math.sqrt(degree) * 1.4),
      isEntry
    })
  }

  const nodeIds = new Set(nodes.map((n) => n.id))

  // Same edge-reduction rule as the tree view (root link + up to N ranked links).
  const maxRelated = options.visibleRelatedConnections ?? 2
  const visibleImportIds = options.edgeDebugMode
    ? null
    : selectVisibleImportEdgeIds(snapshot, maxRelated, entryNodeId)

  const links: NetworkLink[] = []
  const seen = new Set<string>()
  for (const edge of snapshot.edges) {
    if (edge.kind !== 'import') continue
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue
    if (visibleImportIds && !visibleImportIds.has(edge.id)) continue
    const key = `${edge.source}->${edge.target}`
    if (seen.has(key)) continue
    seen.add(key)
    links.push({ source: edge.source, target: edge.target, kind: 'import' })
  }

  return { nodes, links }
}

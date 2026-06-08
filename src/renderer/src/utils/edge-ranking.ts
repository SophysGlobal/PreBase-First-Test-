import { computeNodeImportance } from '../../../core/utils/architecture-layers'
import type { ArchitectureLayerId } from '../../../core/utils/architecture-layers'
import type { GraphEdge, GraphSnapshot } from '../../../core/types'

const LAYER_WEIGHT: Partial<Record<ArchitectureLayerId, number>> = {
  entry: 12,
  services: 8,
  api: 7,
  backend: 6,
  database: 6,
  components: 5,
  frontend: 4,
  ui: 4,
  auth: 4,
  utils: 2,
  config: 1,
  tests: 0.5,
  other: 1
}

function isRootEdge(edge: GraphEdge, entryNodeId: string | null | undefined): boolean {
  if (!entryNodeId) return false
  return edge.source === entryNodeId || edge.target === entryNodeId
}

function edgeRankScore(
  edge: GraphEdge,
  snapshot: GraphSnapshot,
  importanceByNode: Map<string, number>
): number {
  const source = snapshot.nodes.find((n) => n.id === edge.source)
  const target = snapshot.nodes.find((n) => n.id === edge.target)
  const targetLayer = (target?.meta?.architectureLayer as ArchitectureLayerId) ?? 'other'
  const sourceLayer = (source?.meta?.architectureLayer as ArchitectureLayerId) ?? 'other'

  let score = 10
  score += (importanceByNode.get(edge.target) ?? 0) * 2
  score += (importanceByNode.get(edge.source) ?? 0) * 1.2
  score += LAYER_WEIGHT[targetLayer] ?? 1
  score += (LAYER_WEIGHT[sourceLayer] ?? 1) * 0.5

  if (edge.meta?.isDynamic) score *= 0.65
  if (target?.kind === 'module') score *= 0.4

  const specifiers = edge.meta?.specifiers?.length ?? 0
  score += Math.min(specifiers, 4) * 0.5

  return score
}

/**
 * Select import edges to render based on "Visible Related Connections".
 * Root/entry connections are always included. Each file may show up to
 * `maxRelated` additional ranked import edges (0–3).
 */
export function selectVisibleImportEdgeIds(
  snapshot: GraphSnapshot,
  maxRelated: number,
  entryNodeId: string | null | undefined
): Set<string> {
  const importEdges = snapshot.edges.filter((e) => e.kind === 'import')
  const visible = new Set<string>()

  for (const edge of importEdges) {
    if (isRootEdge(edge, entryNodeId)) visible.add(edge.id)
  }

  if (maxRelated <= 0) return visible

  const importanceByNode = new Map<string, number>()
  for (const node of snapshot.nodes) {
    if (node.kind === 'folder') continue
    importanceByNode.set(node.id, computeNodeImportance(node.id, snapshot.edges).score)
  }

  const edgesByNode = new Map<string, GraphEdge[]>()
  for (const edge of importEdges) {
    if (isRootEdge(edge, entryNodeId)) continue
    for (const nodeId of [edge.source, edge.target]) {
      const list = edgesByNode.get(nodeId) ?? []
      list.push(edge)
      edgesByNode.set(nodeId, list)
    }
  }

  for (const [nodeId, edges] of edgesByNode) {
    if (nodeId === entryNodeId) continue
    const ranked = [...edges]
      .sort((a, b) => edgeRankScore(b, snapshot, importanceByNode) - edgeRankScore(a, snapshot, importanceByNode))
      .slice(0, maxRelated)
    for (const edge of ranked) visible.add(edge.id)
  }

  if (entryNodeId) {
    const entryEdges = importEdges.filter(
      (e) => !isRootEdge(e, entryNodeId) && (e.source === entryNodeId || e.target === entryNodeId)
    )
    const ranked = [...entryEdges]
      .sort((a, b) => edgeRankScore(b, snapshot, importanceByNode) - edgeRankScore(a, snapshot, importanceByNode))
      .slice(0, maxRelated)
    for (const edge of ranked) visible.add(edge.id)
  }

  return visible
}

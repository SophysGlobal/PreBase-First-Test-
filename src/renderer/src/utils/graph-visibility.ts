import type { ArchitectureLayerId } from '../../../core/utils/architecture-layers'
import { computeNodeImportance } from '../../../core/utils/architecture-layers'
import type { GraphNode, GraphSnapshot } from '../../../core/types'
import { getNodesWithinDepth } from '../../../core/layout/hierarchy-layout'

export interface VisibilityOptions {
  graphDepth: number
  layerVisibility: Record<ArchitectureLayerId, boolean>
  isolatedLayer: ArchitectureLayerId | null
  focusNeighborhood: boolean
  hideLowImportance: boolean
  focusedNodeId: string | null
  selectedNodeId: string | null
  showFolders: boolean
}

export function getVisibleNodeIds(
  snapshot: GraphSnapshot,
  options: VisibilityOptions
): Set<string> {
  const ids = new Set<string>()

  let depthSet: Set<string> | null = null
  if (snapshot.entryNodeId && options.graphDepth >= 0) {
    depthSet = getNodesWithinDepth(
      snapshot.entryNodeId,
      snapshot.edges,
      options.graphDepth
    )
    depthSet.add(snapshot.entryNodeId)
  }

  const focusId = options.focusNeighborhood
    ? (options.focusedNodeId ?? options.selectedNodeId)
    : null
  const neighborhood = focusId ? getNeighborhood(snapshot, focusId, 2) : null

  const importanceScores = new Map<string, number>()
  if (options.hideLowImportance) {
    for (const n of snapshot.nodes) {
      importanceScores.set(n.id, computeNodeImportance(n.id, snapshot.edges).score)
    }
  }

  const scores = [...importanceScores.values()].sort((a, b) => b - a)
  const threshold = scores[Math.floor(scores.length * 0.35)] ?? 0

  for (const node of snapshot.nodes) {
    if (!options.showFolders && node.kind === 'folder') continue
    if (depthSet && !depthSet.has(node.id)) continue

    const layer = (node.meta?.architectureLayer as ArchitectureLayerId) ?? 'other'
    if (node.isEntry || node.id === snapshot.entryNodeId) {
      ids.add(node.id)
      continue
    }

    if (options.isolatedLayer) {
      if (layer !== options.isolatedLayer) continue
    } else if (!options.layerVisibility[layer]) {
      continue
    }

    if (neighborhood && !neighborhood.has(node.id)) continue

    if (options.hideLowImportance && layer === 'utils') {
      const score = importanceScores.get(node.id) ?? 0
      if (score < threshold && node.id !== focusId) continue
    }
    if (options.hideLowImportance && layer === 'tests') continue

    ids.add(node.id)
  }

  return ids
}

function getNeighborhood(snapshot: GraphSnapshot, nodeId: string, hops: number): Set<string> {
  const set = new Set<string>([nodeId])
  let frontier = [nodeId]
  for (let h = 0; h < hops; h++) {
    const next: string[] = []
    for (const id of frontier) {
      for (const e of snapshot.edges) {
        if (e.kind !== 'import') continue
        const other = e.source === id ? e.target : e.target === id ? e.source : null
        if (other && !set.has(other)) {
          set.add(other)
          next.push(other)
        }
      }
    }
    frontier = next
  }
  return set
}

export function getNodeVisualWeight(node: GraphNode, snapshot: GraphSnapshot): number {
  if (node.isEntry || node.id === snapshot.entryNodeId) return 1.15
  const { score } = computeNodeImportance(node.id, snapshot.edges)
  const maxScore = 12
  const normalized = Math.min(score / maxScore, 1)
  const layer = node.meta?.architectureLayer
  if (layer === 'services' || layer === 'api') return 1 + normalized * 0.12
  if (layer === 'utils' || layer === 'config') return 0.92
  return 1 + normalized * 0.06
}

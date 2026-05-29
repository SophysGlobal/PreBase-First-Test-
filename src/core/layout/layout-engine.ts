import type { GraphEdge, GraphNode, LayoutMode, LayoutPosition } from '../types'
import {
  computeHierarchyLayout,
  computePyramidLayout,
  computeScatterLayout
} from './hierarchy-layout'

export interface LayoutOptions {
  mode?: LayoutMode
  preservePositions?: Record<string, LayoutPosition>
  entryNodeId?: string | null
}

export class LayoutEngine {
  async layout(
    nodes: GraphNode[],
    edges: GraphEdge[],
    options: LayoutOptions = {}
  ): Promise<Record<string, LayoutPosition>> {
    const mode = options.mode ?? 'hierarchy'
    const layoutNodes = nodes.filter((n) => n.kind !== 'folder')
    if (layoutNodes.length === 0) return {}

    const entryNodeId = options.entryNodeId
    if (!entryNodeId) {
      return this.mergePreserved({}, nodes, options.preservePositions)
    }

    let positions: Record<string, LayoutPosition>
    switch (mode) {
      case 'pyramid':
        positions = computePyramidLayout(layoutNodes, edges, { entryNodeId })
        break
      case 'scattered':
        positions = computeScatterLayout(layoutNodes, edges, { entryNodeId })
        break
      case 'hierarchy':
      default:
        positions = computeHierarchyLayout(layoutNodes, edges, { entryNodeId })
        break
    }

    return this.mergePreserved(positions, nodes, options.preservePositions)
  }

  async layoutIncremental(
    nodes: GraphNode[],
    edges: GraphEdge[],
    existingPositions: Record<string, LayoutPosition>,
    changedNodeIds: string[],
    entryNodeId?: string | null
  ): Promise<Record<string, LayoutPosition>> {
    const changed = new Set(changedNodeIds)
    const hasNewNodes = nodes.some((n) => changed.has(n.id) || !existingPositions[n.id])

    if (hasNewNodes && entryNodeId) {
      const layoutNodes = nodes.filter((n) => n.kind !== 'folder')
      const fresh = computeHierarchyLayout(layoutNodes, edges, { entryNodeId })
      for (const id of Object.keys(existingPositions)) {
        if (!changed.has(id) && existingPositions[id]) {
          fresh[id] = existingPositions[id]
        }
      }
      return fresh
    }

    return { ...existingPositions }
  }

  private mergePreserved(
    positions: Record<string, LayoutPosition>,
    nodes: GraphNode[],
    preserve?: Record<string, LayoutPosition>
  ): Record<string, LayoutPosition> {
    const merged = { ...positions }
    for (const node of nodes) {
      if (!merged[node.id] && preserve?.[node.id]) {
        merged[node.id] = preserve[node.id]
      }
    }
    return merged
  }
}

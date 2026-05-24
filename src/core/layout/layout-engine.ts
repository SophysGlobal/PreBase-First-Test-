import ELK, { type ElkNode } from 'elkjs/lib/elk.bundled.js'
import type { GraphEdge, GraphNode, LayoutMode, LayoutPosition } from '../types'
import { computeHierarchyLayout } from './hierarchy-layout'

export interface LayoutOptions {
  mode?: LayoutMode
  preservePositions?: Record<string, LayoutPosition>
  entryNodeId?: string | null
  width?: number
  height?: number
}

export class LayoutEngine {
  private elk = new ELK()

  async layout(
    nodes: GraphNode[],
    edges: GraphEdge[],
    options: LayoutOptions = {}
  ): Promise<Record<string, LayoutPosition>> {
    const mode = options.mode ?? 'hierarchy'
    const layoutNodes = nodes.filter((n) => n.kind !== 'folder')

    if (layoutNodes.length === 0) return {}

    if (mode === 'hierarchy' && options.entryNodeId) {
      const positions = computeHierarchyLayout(layoutNodes, edges, {
        entryNodeId: options.entryNodeId,
        layerSpacing: 220,
        baseRadius: 0
      })
      return this.mergePreserved(positions, nodes, options.preservePositions)
    }

    const nodeIds = new Set(layoutNodes.map((n) => n.id))
    const layoutEdges = edges.filter(
      (e) => e.kind === 'import' && nodeIds.has(e.source) && nodeIds.has(e.target)
    )

    const elkGraph: ElkNode = {
      id: 'root',
      layoutOptions: this.getLayoutOptions(mode),
      children: layoutNodes.map((n) => ({
        id: n.id,
        width: this.nodeWidth(n, n.isEntry),
        height: this.nodeHeight(n, n.isEntry)
      })),
      edges: layoutEdges.map((e) => ({
        id: e.id,
        sources: [e.source],
        targets: [e.target]
      }))
    }

    try {
      const result = await this.elk.layout(elkGraph)
      const positions: Record<string, LayoutPosition> = {}

      for (const child of result.children ?? []) {
        if (child.id && child.x !== undefined && child.y !== undefined) {
          const preserved = options.preservePositions?.[child.id]
          positions[child.id] = preserved ?? { x: child.x, y: child.y }
        }
      }

      return this.mergePreserved(positions, nodes, options.preservePositions)
    } catch {
      return this.fallbackGridLayout(layoutNodes, options.preservePositions)
    }
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
      const fresh = computeHierarchyLayout(layoutNodes, edges, {
        entryNodeId,
        layerSpacing: 220
      })
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

  private getLayoutOptions(mode: LayoutMode): Record<string, string> {
    switch (mode) {
      case 'force':
        return {
          'elk.algorithm': 'org.eclipse.elk.force',
          'elk.spacing.nodeNode': '100'
        }
      case 'clustered':
        return {
          'elk.algorithm': 'org.eclipse.elk.layered',
          'elk.direction': 'DOWN',
          'elk.spacing.nodeNode': '70',
          'elk.layered.spacing.nodeNodeBetweenLayers': '120'
        }
      case 'layered':
        return {
          'elk.algorithm': 'org.eclipse.elk.layered',
          'elk.direction': 'RIGHT',
          'elk.spacing.nodeNode': '60',
          'elk.layered.spacing.nodeNodeBetweenLayers': '100',
          'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX'
        }
      case 'hierarchy':
      default:
        return {
          'elk.algorithm': 'org.eclipse.elk.layered',
          'elk.direction': 'RIGHT',
          'elk.spacing.nodeNode': '60'
        }
    }
  }

  private nodeWidth(node: GraphNode, isEntry?: boolean): number {
    const base = isEntry ? 200 : node.kind === 'folder' ? 140 : 160
    return Math.min(base, 80 + node.label.length * 7)
  }

  private nodeHeight(node: GraphNode, isEntry?: boolean): number {
    return isEntry ? 52 : node.kind === 'folder' ? 36 : 44
  }

  private fallbackGridLayout(
    nodes: GraphNode[],
    preserve?: Record<string, LayoutPosition>
  ): Record<string, LayoutPosition> {
    const cols = Math.ceil(Math.sqrt(nodes.length))
    const positions: Record<string, LayoutPosition> = {}

    nodes.forEach((node, i) => {
      if (preserve?.[node.id]) {
        positions[node.id] = preserve[node.id]
        return
      }
      const col = i % cols
      const row = Math.floor(i / cols)
      positions[node.id] = { x: col * 240, y: row * 110 }
    })

    return positions
  }
}

import ELK, { type ElkNode } from 'elkjs/lib/elk.bundled.js'
import type { GraphEdge, GraphNode, LayoutMode, LayoutPosition } from '../types'

export interface LayoutOptions {
  mode?: LayoutMode
  preservePositions?: Record<string, LayoutPosition>
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
    const mode = options.mode ?? 'layered'
    const fileNodes = nodes.filter((n) => n.kind !== 'folder' || mode === 'clustered')
    const layoutNodes =
      mode === 'clustered'
        ? nodes.filter((n) => n.kind === 'folder' || n.kind === 'file' || n.kind === 'component')
        : fileNodes.length > 0
          ? fileNodes
          : nodes

    if (layoutNodes.length === 0) return {}

    const nodeIds = new Set(layoutNodes.map((n) => n.id))
    const layoutEdges = edges.filter(
      (e) =>
        e.kind === 'import' &&
        nodeIds.has(e.source) &&
        nodeIds.has(e.target)
    )

    const elkGraph: ElkNode = {
      id: 'root',
      layoutOptions: this.getLayoutOptions(mode),
      children: layoutNodes.map((n) => ({
        id: n.id,
        width: this.nodeWidth(n),
        height: this.nodeHeight(n)
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

      for (const node of nodes) {
        if (!positions[node.id] && options.preservePositions?.[node.id]) {
          positions[node.id] = options.preservePositions[node.id]
        }
      }

      return positions
    } catch {
      return this.fallbackGridLayout(layoutNodes, options.preservePositions)
    }
  }

  async layoutIncremental(
    nodes: GraphNode[],
    edges: GraphEdge[],
    existingPositions: Record<string, LayoutPosition>,
    changedNodeIds: string[]
  ): Promise<Record<string, LayoutPosition>> {
    const changed = new Set(changedNodeIds)
    const preserve: Record<string, LayoutPosition> = { ...existingPositions }

    const nodesToLayout = nodes.filter((n) => changed.has(n.id) || !existingPositions[n.id])
    if (nodesToLayout.length === 0) return existingPositions

    const newPositions = await this.layout(nodesToLayout, edges, {
      preservePositions: preserve,
      mode: 'layered'
    })

    return { ...existingPositions, ...newPositions }
  }

  private getLayoutOptions(mode: LayoutMode): Record<string, string> {
    switch (mode) {
      case 'force':
        return {
          'elk.algorithm': 'org.eclipse.elk.force',
          'elk.spacing.nodeNode': '80'
        }
      case 'clustered':
        return {
          'elk.algorithm': 'org.eclipse.elk.layered',
          'elk.direction': 'DOWN',
          'elk.spacing.nodeNode': '60',
          'elk.layered.spacing.nodeNodeBetweenLayers': '100'
        }
      case 'layered':
      default:
        return {
          'elk.algorithm': 'org.eclipse.elk.layered',
          'elk.direction': 'RIGHT',
          'elk.spacing.nodeNode': '50',
          'elk.layered.spacing.nodeNodeBetweenLayers': '80',
          'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX'
        }
    }
  }

  private nodeWidth(node: GraphNode): number {
    if (node.kind === 'folder') return 140
    if (node.kind === 'function') return 120
    return Math.min(200, 80 + node.label.length * 7)
  }

  private nodeHeight(node: GraphNode): number {
    if (node.kind === 'folder') return 36
    if (node.kind === 'function') return 32
    return 40
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
      positions[node.id] = { x: col * 220, y: row * 100 }
    })

    return positions
  }
}

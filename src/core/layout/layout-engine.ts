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

const NODE_W = 168
const NODE_H = 52

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

    if ((mode === 'hierarchy' || mode === 'circular') && options.entryNodeId) {
      const positions = computeHierarchyLayout(layoutNodes, edges, {
        entryNodeId: options.entryNodeId,
        layerSpacing: mode === 'circular' ? 185 : 165,
        nodePadding: 68,
        clusterSeparation: 240,
        baseRadius: 0
      })
      return this.mergePreserved(positions, nodes, options.preservePositions)
    }

    if (mode === 'grid') {
      return this.mergePreserved(
        this.gridLayout(layoutNodes, 185, 78),
        nodes,
        options.preservePositions
      )
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
        width: NODE_W,
        height: n.isEntry ? 58 : NODE_H
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

      this.centerPositions(positions)
      return this.mergePreserved(positions, nodes, options.preservePositions)
    } catch {
      return this.mergePreserved(
        this.gridLayout(layoutNodes, 195, 85),
        nodes,
        options.preservePositions
      )
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
        layerSpacing: 240
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
          'elk.spacing.nodeNode': '82'
        }
      case 'scattered':
        return {
          'elk.algorithm': 'org.eclipse.elk.force',
          'elk.spacing.nodeNode': '88',
          'elk.force.iterations': '220'
        }
      case 'clustered':
        return {
          'elk.algorithm': 'org.eclipse.elk.layered',
          'elk.direction': 'DOWN',
          'elk.spacing.nodeNode': '58',
          'elk.layered.spacing.nodeNodeBetweenLayers': '88'
        }
      case 'pyramid':
        return {
          'elk.algorithm': 'org.eclipse.elk.layered',
          'elk.direction': 'DOWN',
          'elk.spacing.nodeNode': '52',
          'elk.layered.spacing.nodeNodeBetweenLayers': '72',
          'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX'
        }
      case 'grid':
        return {
          'elk.algorithm': 'org.eclipse.elk.rectpacking',
          'elk.spacing.nodeNode': '48'
        }
      case 'hierarchy':
      default:
        return {
          'elk.algorithm': 'org.eclipse.elk.layered',
          'elk.direction': 'RIGHT',
          'elk.spacing.nodeNode': '64'
        }
    }
  }

  private gridLayout(
    nodes: GraphNode[],
    colGap: number,
    rowGap: number
  ): Record<string, LayoutPosition> {
    const cols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)))
    const positions: Record<string, LayoutPosition> = {}

    nodes.forEach((node, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      positions[node.id] = { x: col * colGap, y: row * rowGap }
    })

    this.centerPositions(positions)
    return positions
  }

  private centerPositions(positions: Record<string, LayoutPosition>): void {
    const vals = Object.values(positions)
    if (vals.length === 0) return
    const cx = vals.reduce((s, p) => s + p.x, 0) / vals.length
    const cy = vals.reduce((s, p) => s + p.y, 0) / vals.length
    for (const id of Object.keys(positions)) {
      positions[id] = { x: positions[id].x - cx, y: positions[id].y - cy }
    }
  }
}

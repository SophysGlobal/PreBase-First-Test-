import { basename } from 'path'
import type {
  GraphEdge,
  GraphNode,
  GraphSnapshot,
  IncrementalUpdate,
  ParseResult
} from '../types'
import {
  folderIdForPath,
  getParentFolderPath,
  nodeIdForPath,
  resolveImportPath
} from '../utils/paths'
import type { PathMappings } from '../utils/tsconfig-paths'

export interface GraphGeneratorOptions {
  includeFolders?: boolean
  includeFunctions?: boolean
  maxFunctionNodesPerFile?: number
  pathMappings?: PathMappings
}

export class GraphGenerator {
  private options: Required<GraphGeneratorOptions>

  constructor(options: GraphGeneratorOptions = {}) {
    this.options = {
      includeFolders: options.includeFolders ?? true,
      includeFunctions: options.includeFunctions ?? false,
      maxFunctionNodesPerFile: options.maxFunctionNodesPerFile ?? 8,
      pathMappings: options.pathMappings ?? {}
    }
  }

  buildFromParseResults(
    projectPath: string,
    projectName: string,
    results: ParseResult[]
  ): Omit<GraphSnapshot, 'positions' | 'entryNodeId'> {
    const nodes: GraphNode[] = []
    const edges: GraphEdge[] = []
    const nodeIds = new Set<string>()
    const folderIds = new Set<string>()

    const ensureFolder = (folderPath: string) => {
      const id = folderIdForPath(folderPath)
      if (folderIds.has(id)) return
      folderIds.add(id)
      const parent = getParentFolderPath(folderPath)
      nodes.push({
        id,
        kind: 'folder',
        label: folderPath ? basename(folderPath) : projectName,
        path: folderPath || undefined,
        parentId: parent ? folderIdForPath(parent) : undefined
      })
      if (parent !== null) {
        ensureFolder(parent)
        edges.push({
          id: `contains:${folderIdForPath(parent)}->${id}`,
          source: folderIdForPath(parent),
          target: id,
          kind: 'contains'
        })
      }
    }

    if (this.options.includeFolders) {
      ensureFolder('')
    }

    for (const result of results) {
      const fileId = nodeIdForPath(result.relativePath)
      if (!nodeIds.has(fileId)) {
        nodeIds.add(fileId)
        const parentFolder = getParentFolderPath(result.relativePath)
        if (this.options.includeFolders && parentFolder !== null) {
          ensureFolder(parentFolder)
        }

        nodes.push({
          id: fileId,
          kind: result.isComponentFile ? 'component' : 'file',
          label: basename(result.relativePath),
          path: result.relativePath,
          parentId:
            this.options.includeFolders && parentFolder !== null
              ? folderIdForPath(parentFolder)
              : undefined,
          meta: {
            exports: result.exports.map((e) => e.name),
            imports: result.imports.map((i) => i.source),
            isComponent: result.isComponentFile,
            language: result.relativePath.split('.').pop(),
            functionCount: result.functions.length,
            componentCount: result.components.length
          }
        })

        if (this.options.includeFolders && parentFolder !== null) {
          edges.push({
            id: `contains:${folderIdForPath(parentFolder)}->${fileId}`,
            source: folderIdForPath(parentFolder),
            target: fileId,
            kind: 'contains'
          })
        }
      }

      if (this.options.includeFunctions) {
        const fnNames = [...result.functions, ...result.components].slice(
          0,
          this.options.maxFunctionNodesPerFile
        )
        for (const fn of fnNames) {
          const fnId = `${fileId}:fn:${fn}`
          if (nodeIds.has(fnId)) continue
          nodeIds.add(fnId)
          nodes.push({
            id: fnId,
            kind: result.components.includes(fn) ? 'component' : 'function',
            label: fn,
            path: result.relativePath,
            parentId: fileId
          })
          edges.push({
            id: `contains:${fileId}->${fnId}`,
            source: fileId,
            target: fnId,
            kind: 'contains'
          })
        }
      }

      for (const imp of result.imports) {
        const resolved = resolveImportPath(
          projectPath,
          result.relativePath,
          imp.source,
          this.options.pathMappings
        )
        if (!resolved) continue
        const targetId = nodeIdForPath(resolved)
        if (!nodeIds.has(targetId)) {
          nodeIds.add(targetId)
          nodes.push({
            id: targetId,
            kind: 'module',
            label: basename(resolved),
            path: resolved,
            meta: { imports: [], exports: [] }
          })
        }
        const edgeId = `import:${fileId}->${targetId}:${imp.source}`
        const isDynamic = imp.source.includes('?') || imp.specifiers.includes('dynamic')
        edges.push({
          id: edgeId,
          source: fileId,
          target: targetId,
          kind: 'import',
          meta: {
            importSource: imp.source,
            specifiers: imp.specifiers,
            isDefault: imp.isDefault,
            isDynamic,
            line: imp.line
          }
        })
      }
    }

    this.addFolderDependencyEdges(nodes, edges)

    return {
      nodes,
      edges,
      projectPath,
      projectName,
      scannedAt: Date.now()
    }
  }

  /** Aggregate file imports into folder-to-folder architecture links. */
  private addFolderDependencyEdges(nodes: GraphNode[], edges: GraphEdge[]): void {
    const nodeById = new Map(nodes.map((n) => [n.id, n]))
    const folderOfFile = (nodeId: string): string | null => {
      let current = nodeById.get(nodeId)
      while (current?.parentId) {
        if (current.parentId.startsWith('folder:')) return current.parentId
        current = nodeById.get(current.parentId)
      }
      return null
    }

    const seen = new Set<string>()
    for (const edge of [...edges]) {
      if (edge.kind !== 'import') continue
      const sourceFolder = folderOfFile(edge.source)
      const targetFolder = folderOfFile(edge.target)
      if (!sourceFolder || !targetFolder || sourceFolder === targetFolder) continue
      const id = `folder-link:${sourceFolder}->${targetFolder}`
      if (seen.has(id)) continue
      seen.add(id)
      edges.push({
        id,
        source: sourceFolder,
        target: targetFolder,
        kind: 'dependency'
      })
    }
  }

  diff(
    oldSnapshot: Pick<GraphSnapshot, 'nodes' | 'edges'>,
    newSnapshot: Pick<GraphSnapshot, 'nodes' | 'edges'>
  ): IncrementalUpdate {
    const oldNodeMap = new Map(oldSnapshot.nodes.map((n) => [n.id, n]))
    const newNodeMap = new Map(newSnapshot.nodes.map((n) => [n.id, n]))
    const oldEdgeIds = new Set(oldSnapshot.edges.map((e) => e.id))
    const newEdgeIds = new Set(newSnapshot.edges.map((e) => e.id))

    const addedNodes: GraphNode[] = []
    const removedNodeIds: string[] = []
    const updatedNodes: GraphNode[] = []

    for (const [id, node] of newNodeMap) {
      if (!oldNodeMap.has(id)) addedNodes.push(node)
      else if (JSON.stringify(oldNodeMap.get(id)) !== JSON.stringify(node)) {
        updatedNodes.push(node)
      }
    }
    for (const id of oldNodeMap.keys()) {
      if (!newNodeMap.has(id)) removedNodeIds.push(id)
    }

    const addedEdges = newSnapshot.edges.filter((e) => !oldEdgeIds.has(e.id))
    const removedEdgeIds = oldSnapshot.edges
      .filter((e) => !newEdgeIds.has(e.id))
      .map((e) => e.id)

    return {
      addedNodes,
      removedNodeIds,
      addedEdges,
      removedEdgeIds,
      updatedNodes
    }
  }
}

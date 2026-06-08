import { basename } from 'path'
import { FileScanner } from '../scanner/file-scanner'
import { ParserEngine } from '../parser/parser-engine'
import { GraphGenerator } from '../graph/graph-generator'
import { LayoutEngine } from '../layout/layout-engine'
import { WatcherEngine, type WatcherEvent } from '../watcher/watcher-engine'
import { assignLayersToNodes } from '../utils/architecture-layers'
import { auditGraphCompleteness, summarizeMissing } from '../graph/graph-completeness'
import { detectEntryNodeId, readPackageMain } from '../utils/entry-detector'
import { loadTsconfigPaths, type PathMappings } from '../utils/tsconfig-paths'
import type { LayoutRuntimeConfig } from '../layout/layout-config'
import { mergeLayoutRuntime } from '../layout/layout-config'
import type { GraphSnapshot, IncrementalUpdate, LayoutMode, ScannedFile } from '../types'

export class ProjectService {
  private scanner = new FileScanner()
  private parser = new ParserEngine()
  private graphGen = new GraphGenerator({ includeFolders: true, includeFunctions: false })
  private layout = new LayoutEngine()
  private watcher = new WatcherEngine()

  private snapshot: GraphSnapshot | null = null
  private fileIndex = new Map<string, ScannedFile>()
  private pathMappings: PathMappings = {}
  private onUpdate: ((payload: GraphSnapshot | IncrementalUpdate, full: boolean) => void) | null =
    null
  private lastLayoutMode: LayoutMode = 'hierarchy'
  private lastLayoutRuntime = mergeLayoutRuntime()
  private edgeDiagEnabled = process.env.PREBASE_EDGE_DIAG === '1'

  getSnapshot(): GraphSnapshot | null {
    return this.snapshot
  }

  async openProject(
    projectPath: string,
    onUpdate: (payload: GraphSnapshot | IncrementalUpdate, full: boolean) => void
  ): Promise<GraphSnapshot> {
    this.closeProject()
    this.onUpdate = onUpdate

    const files = await this.scanner.scanProject(projectPath)
    if (this.edgeDiagEnabled) {
      console.info('[EdgeDiag] Stage 1 files discovered:', files.length)
    }
    const projectName = basename(projectPath)
    const packageMain = await readPackageMain(projectPath)
    this.pathMappings = loadTsconfigPaths(projectPath)
    this.graphGen = new GraphGenerator({
      includeFolders: true,
      includeFunctions: false,
      pathMappings: this.pathMappings
    })

    this.fileIndex = new Map(files.map((f) => [f.relativePath, f]))

    const parseResults = await this.parser.parseFiles(files)
    if (this.edgeDiagEnabled) {
      const dependencies = parseResults.reduce((s, r) => s + r.imports.length, 0)
      console.info('[EdgeDiag] Stage 2 dependencies discovered:', dependencies)
    }
    const graph = this.graphGen.buildFromParseResults(projectPath, projectName, parseResults)
    if (this.edgeDiagEnabled) {
      const importEdges = graph.edges.filter((e) => e.kind === 'import').length
      const containsEdges = graph.edges.filter((e) => e.kind === 'contains').length
      const dependencyEdges = graph.edges.filter((e) => e.kind === 'dependency').length
      console.info('[EdgeDiag] Stage 3 edges generated:', graph.edges.length, {
        import: importEdges,
        contains: containsEdges,
        dependency: dependencyEdges
      })
    }

    const layoutNodes = graph.nodes.filter((n) => n.kind !== 'folder')
    const entryNodeId = detectEntryNodeId(
      projectPath,
      layoutNodes,
      graph.edges,
      packageMain
    )

    const allNodesForLayout = graph.nodes.filter((n) => n.kind !== 'folder')
    const positions = await this.layout.layout(allNodesForLayout, graph.edges, {
      mode: 'hierarchy',
      entryNodeId: entryNodeId ?? undefined
    })

    // Place folder nodes near centroid of their children
    for (const folder of graph.nodes.filter((n) => n.kind === 'folder')) {
      const children = graph.nodes.filter((n) => n.parentId === folder.id && positions[n.id])
      if (children.length > 0) {
        positions[folder.id] = {
          x: children.reduce((s, c) => s + positions[c.id].x, 0) / children.length,
          y: children.reduce((s, c) => s + positions[c.id].y, 0) / children.length
        }
      } else {
        positions[folder.id] = { x: 0, y: 0 }
      }
    }

    const tagged = graph.nodes.map((n) => {
      if (n.id === entryNodeId) return { ...n, isEntry: true, depth: 0 }
      return n
    })
    const nodesWithMeta = assignLayersToNodes(tagged, entryNodeId)

    this.snapshot = {
      ...graph,
      nodes: nodesWithMeta,
      positions,
      projectPath,
      projectName,
      entryNodeId,
      scannedAt: Date.now()
    }
    if (this.edgeDiagEnabled) {
      console.info('[EdgeDiag] Stage 4 graph state edges:', this.snapshot.edges.length)
    }

    const completeness = auditGraphCompleteness(files, this.snapshot)
    if (!completeness.isComplete) {
      console.warn('[PreBase]', summarizeMissing(completeness))
    }

    this.watcher.start(projectPath, (events) => void this.handleWatcherEvents(events))

    return this.snapshot
  }

  closeProject(): void {
    this.watcher.stop()
    this.snapshot = null
    this.fileIndex.clear()
    this.onUpdate = null
  }

  async relayout(
    mode: LayoutMode = 'hierarchy',
    runtime?: Partial<LayoutRuntimeConfig>
  ): Promise<GraphSnapshot | null> {
    if (!this.snapshot) return null

    this.lastLayoutMode = mode
    if (runtime) this.lastLayoutRuntime = mergeLayoutRuntime(runtime)

    const layoutNodes = this.snapshot.nodes.filter((n) => n.kind !== 'folder')
    const entryId = this.snapshot.entryNodeId
    const positions = await this.layout.layout(layoutNodes, this.snapshot.edges, {
      mode,
      entryNodeId: entryId,
      preservePositions: {},
      runtime: this.lastLayoutRuntime
    })

    for (const folder of this.snapshot.nodes.filter((n) => n.kind === 'folder')) {
      const children = this.snapshot.nodes.filter(
        (n) => n.parentId === folder.id && positions[n.id]
      )
      if (children.length > 0) {
        positions[folder.id] = {
          x: children.reduce((s, c) => s + positions[c.id].x, 0) / children.length,
          y: children.reduce((s, c) => s + positions[c.id].y, 0) / children.length
        }
      }
    }

    this.snapshot = { ...this.snapshot, positions, scannedAt: Date.now() }
    this.onUpdate?.(this.snapshot, true)
    return this.snapshot
  }

  private async handleWatcherEvents(events: WatcherEvent[]): Promise<void> {
    if (!this.snapshot || !this.onUpdate) return

    const projectPath = this.snapshot.projectPath
    let needsFullRebuild = false
    const changedPaths = new Set<string>()

    for (const event of events) {
      if (event.type === 'unlinkDir' || event.type === 'addDir') {
        needsFullRebuild = true
        break
      }
      changedPaths.add(event.relativePath)
      if (event.type === 'unlink') {
        this.fileIndex.delete(event.relativePath)
      } else if (event.type === 'add' || event.type === 'change') {
        const scanned = await this.scanner.scanProject(projectPath)
        const file = scanned.find((f) => f.relativePath === event.relativePath)
        if (file) this.fileIndex.set(event.relativePath, file)
      }
    }

    if (needsFullRebuild) {
      await this.incrementalFullRebuild()
      return
    }

    await this.incrementalUpdate([...changedPaths])
  }

  private async incrementalFullRebuild(): Promise<void> {
    if (!this.snapshot || !this.onUpdate) return
    const projectPath = this.snapshot.projectPath
    const files = await this.scanner.scanProject(projectPath)
    this.fileIndex = new Map(files.map((f) => [f.relativePath, f]))
    const parseResults = await this.parser.parseFiles(files)
    const newGraph = this.graphGen.buildFromParseResults(
      projectPath,
      this.snapshot.projectName,
      parseResults
    )

    const diff = this.graphGen.diff(this.snapshot, newGraph)
    const layoutNodes = newGraph.nodes.filter((n) => n.kind !== 'folder')
    const entryNodeId =
      this.snapshot.entryNodeId ??
      detectEntryNodeId(projectPath, layoutNodes, newGraph.edges, null)

    const positions = await this.layout.layoutIncremental(
      layoutNodes,
      newGraph.edges,
      this.snapshot.positions,
      [...diff.addedNodes.map((n) => n.id), ...diff.removedNodeIds],
      entryNodeId,
      this.lastLayoutMode,
      this.lastLayoutRuntime
    )

    this.snapshot = {
      ...newGraph,
      nodes: assignLayersToNodes(newGraph.nodes, entryNodeId),
      positions,
      entryNodeId,
      scannedAt: Date.now()
    }
    this.repositionFolders(positions)
    this.snapshot = { ...this.snapshot, positions }
    this.onUpdate({ ...diff, positions }, false)
  }

  private async incrementalUpdate(changedPaths: string[]): Promise<void> {
    if (!this.snapshot || !this.onUpdate) return

    const filesToParse: ScannedFile[] = []
    for (const p of changedPaths) {
      const f = this.fileIndex.get(p)
      if (f) filesToParse.push(f)
    }

    if (filesToParse.length === 0) return

    await this.parser.parseFiles(filesToParse)
    const allResults = await this.buildAllParseResults()
    const newGraph = this.graphGen.buildFromParseResults(
      this.snapshot.projectPath,
      this.snapshot.projectName,
      allResults
    )

    const diff = this.graphGen.diff(this.snapshot, newGraph)
    if (
      diff.addedNodes.length === 0 &&
      diff.removedNodeIds.length === 0 &&
      diff.addedEdges.length === 0 &&
      diff.removedEdgeIds.length === 0 &&
      diff.updatedNodes.length === 0
    ) {
      return
    }

    const changedIds = [
      ...diff.addedNodes.map((n) => n.id),
      ...diff.removedNodeIds,
      ...diff.updatedNodes.map((n) => n.id)
    ]

    const layoutNodes = newGraph.nodes.filter((n) => n.kind !== 'folder')
    const positions = await this.layout.layoutIncremental(
      layoutNodes,
      newGraph.edges,
      this.snapshot.positions,
      changedIds,
      this.snapshot.entryNodeId,
      this.lastLayoutMode,
      this.lastLayoutRuntime
    )

    for (const id of diff.removedNodeIds) {
      delete positions[id]
    }

    this.repositionFolders(positions)

    this.snapshot = {
      ...newGraph,
      nodes: assignLayersToNodes(newGraph.nodes, this.snapshot.entryNodeId),
      positions,
      entryNodeId: this.snapshot.entryNodeId,
      scannedAt: Date.now()
    }
    this.onUpdate({ ...diff, positions }, false)
  }

  private repositionFolders(positions: Record<string, import('../types').LayoutPosition>): void {
    if (!this.snapshot) return
    for (const folder of this.snapshot.nodes.filter((n) => n.kind === 'folder')) {
      const children = this.snapshot.nodes.filter(
        (n) => n.parentId === folder.id && positions[n.id]
      )
      if (children.length > 0) {
        positions[folder.id] = {
          x: children.reduce((s, c) => s + positions[c.id].x, 0) / children.length,
          y: children.reduce((s, c) => s + positions[c.id].y, 0) / children.length
        }
      }
    }
  }

  private async buildAllParseResults() {
    const files = [...this.fileIndex.values()]
    return this.parser.parseFiles(files)
  }
}

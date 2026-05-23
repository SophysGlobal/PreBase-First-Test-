import { basename } from 'path'
import { FileScanner } from '../scanner/file-scanner'
import { ParserEngine } from '../parser/parser-engine'
import { GraphGenerator } from '../graph/graph-generator'
import { LayoutEngine } from '../layout/layout-engine'
import { WatcherEngine, type WatcherEvent } from '../watcher/watcher-engine'
import type { GraphSnapshot, IncrementalUpdate, LayoutMode, ScannedFile } from '../types'
import { nodeIdForPath } from '../utils/paths'

export class ProjectService {
  private scanner = new FileScanner()
  private parser = new ParserEngine()
  private graphGen = new GraphGenerator({ includeFolders: true, includeFunctions: false })
  private layout = new LayoutEngine()
  private watcher = new WatcherEngine()

  private snapshot: GraphSnapshot | null = null
  private fileIndex = new Map<string, ScannedFile>()
  private onUpdate: ((payload: GraphSnapshot | IncrementalUpdate, full: boolean) => void) | null =
    null

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
    const projectName = basename(projectPath)
    const projectType = this.scanner.detectProjectType(projectPath, files)

    this.fileIndex = new Map(files.map((f) => [f.relativePath, f]))

    const parseResults = await this.parser.parseFiles(files)
    const graph = this.graphGen.buildFromParseResults(projectPath, projectName, parseResults)

    const layoutNodes = graph.nodes.filter((n) => n.kind !== 'folder')
    const positions = await this.layout.layout(layoutNodes.length ? layoutNodes : graph.nodes, graph.edges, {
      mode: 'layered' as LayoutMode
    })

    this.snapshot = {
      ...graph,
      positions,
      projectPath,
      projectName,
      scannedAt: Date.now()
    }

    this.watcher.start(projectPath, (events) => void this.handleWatcherEvents(events))

    void projectType
    return this.snapshot
  }

  closeProject(): void {
    this.watcher.stop()
    this.snapshot = null
    this.fileIndex.clear()
    this.onUpdate = null
  }

  async relayout(mode: LayoutMode = 'layered'): Promise<GraphSnapshot | null> {
    if (!this.snapshot) return null

    const layoutNodes = this.snapshot.nodes.filter((n) => n.kind !== 'folder')
    const positions = await this.layout.layout(
      layoutNodes.length ? layoutNodes : this.snapshot.nodes,
      this.snapshot.edges,
      { mode, preservePositions: {} }
    )

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
    const positions = await this.layout.layoutIncremental(
      layoutNodes,
      newGraph.edges,
      this.snapshot.positions,
      [...diff.addedNodes.map((n) => n.id), ...diff.removedNodeIds]
    )

    this.snapshot = { ...newGraph, positions, scannedAt: Date.now() }
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

    const newResults = await this.parser.parseFiles(filesToParse)
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
      changedIds
    )

    for (const id of diff.removedNodeIds) {
      delete positions[id]
    }

    this.snapshot = { ...newGraph, positions, scannedAt: Date.now() }
    this.onUpdate({ ...diff, positions }, false)
  }

  private async buildAllParseResults() {
    const files = [...this.fileIndex.values()]
    return this.parser.parseFiles(files)
  }
}

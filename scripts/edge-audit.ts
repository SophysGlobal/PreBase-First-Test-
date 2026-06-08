import { basename, resolve } from 'path'
import { stat } from 'fs/promises'
import { FileScanner } from '../src/core/scanner/file-scanner'
import { ParserEngine } from '../src/core/parser/parser-engine'
import { GraphGenerator } from '../src/core/graph/graph-generator'
import { detectEntryNodeId, readPackageMain } from '../src/core/utils/entry-detector'
import { loadTsconfigPaths } from '../src/core/utils/tsconfig-paths'
import { LayoutEngine } from '../src/core/layout/layout-engine'
import { assignLayersToNodes, buildDefaultLayerVisibility } from '../src/core/utils/architecture-layers'
import { getRenderableNodeIds, toFlowEdges, toFlowNodes } from '../src/renderer/src/utils/flow-adapter'

async function main() {
  const rawArg = process.argv[2] ?? process.cwd()
  const projectPath = resolve(rawArg)

  try {
    const info = await stat(projectPath)
    if (!info.isDirectory()) {
      console.error('edge-audit: path must be a project folder, not a file.')
      console.error(`  Received: ${projectPath}`)
      console.error('  Usage: npx -y tsx scripts/edge-audit.ts "/absolute/path/to/project"')
      process.exit(1)
    }
  } catch {
    console.error('edge-audit: path does not exist.')
    console.error(`  Received: ${projectPath}`)
    console.error('  Usage: npx -y tsx scripts/edge-audit.ts "/absolute/path/to/project"')
    process.exit(1)
  }

  console.log(`Project: ${projectPath}\n`)

  const scanner = new FileScanner()
  const parser = new ParserEngine()
  const pathMappings = loadTsconfigPaths(projectPath)
  const graphGen = new GraphGenerator({ includeFolders: true, includeFunctions: false, pathMappings })
  const layout = new LayoutEngine()

  const files = await scanner.scanProject(projectPath)
  console.log(`Stage 1 - Files discovered: ${files.length}`)

  const parseResults = await parser.parseFiles(files)
  const discoveredDeps = parseResults.reduce((s, r) => s + r.imports.length, 0)
  console.log(`Stage 2 - Dependencies discovered: ${discoveredDeps}`)

  const graph = graphGen.buildFromParseResults(projectPath, basename(projectPath), parseResults)
  const edgeKinds = graph.edges.reduce<Record<string, number>>((acc, e) => {
    acc[e.kind] = (acc[e.kind] ?? 0) + 1
    return acc
  }, {})
  console.log(`Stage 3 - Edges generated: ${graph.edges.length}`)
  console.log(`          By kind: ${JSON.stringify(edgeKinds)}`)

  const layoutNodes = graph.nodes.filter((n) => n.kind !== 'folder')
  const packageMain = await readPackageMain(projectPath)
  const entryNodeId = detectEntryNodeId(projectPath, layoutNodes, graph.edges, packageMain)
  const positions = await layout.layout(layoutNodes, graph.edges, {
    mode: 'hierarchy',
    entryNodeId: entryNodeId ?? undefined
  })
  const nodes = assignLayersToNodes(
    graph.nodes.map((n) => (n.id === entryNodeId ? { ...n, isEntry: true } : n)),
    entryNodeId
  )

  const snapshot = {
    ...graph,
    nodes,
    positions,
    entryNodeId
  }

  console.log(`Stage 4 - Edges in graph state snapshot: ${snapshot.edges.length}`)

  const flowOpts = {
    searchQuery: '',
    focusedNodeId: entryNodeId,
    selectedNodeId: entryNodeId,
    filter: 'all' as const,
    graphOrganizationMode: 'dependencies' as const,
    graphDepth: -1,
    layerVisibility: buildDefaultLayerVisibility(),
    isolatedLayer: null,
    focusNeighborhood: false,
    hideLowImportance: false,
    userPositions: {},
    expandedFolderIds: new Set<string>(),
    dragEnabledNodeIds: new Set<string>(),
    showEdgeLabels: false,
    reduceAnimations: false,
    edgeSimplificationThreshold: 0,
    visibleRelatedConnections: 2 as const,
    folderExpansionRadius: 82,
    maxRenderedNodes: 0,
    dimOnSearch: false
  }

  const flowNodes = toFlowNodes(snapshot, flowOpts)
  const renderableNodeIds = getRenderableNodeIds(snapshot, flowOpts)
  const flowEdges = toFlowEdges(snapshot, {
    ...flowOpts,
    selectedEdgeId: null,
    renderableNodeIds
  })

  console.log(`Stage 5 - Nodes passed to React Flow: ${flowNodes.length}`)
  console.log(`Stage 5 - Edges passed to React Flow: ${flowEdges.length}`)

  const flowNodeIds = new Set(flowNodes.map((n) => n.id))
  const validEdges = flowEdges.filter((e) => flowNodeIds.has(e.source) && flowNodeIds.has(e.target))
  const invalidEdges = flowEdges.length - validEdges.length
  console.log(`Stage 6 - Edges with valid source/target IDs: ${validEdges.length}`)
  console.log(`Stage 6 - Invalid source/target edge refs: ${invalidEdges}`)

  const invisibleStyles = flowEdges.filter((e) => {
    const opacity = Number((e.style as { opacity?: number } | undefined)?.opacity ?? 1)
    const width = Number((e.style as { strokeWidth?: number } | undefined)?.strokeWidth ?? 1)
    return opacity <= 0 || width <= 0
  }).length
  console.log(`Stage 7 - Potentially invisible styled edges: ${invisibleStyles}`)
}

main().catch((err) => {
  console.error('edge-audit failed:', err)
  process.exit(1)
})


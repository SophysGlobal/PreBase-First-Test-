import { resolve as resolvePath } from 'path'
import { FileScanner } from '../src/core/scanner/file-scanner'
import { ParserEngine } from '../src/core/parser/parser-engine'
import { GraphGenerator } from '../src/core/graph/graph-generator'
import { auditGraphCompleteness, summarizeMissing } from '../src/core/graph/graph-completeness'
import { loadTsconfigPaths } from '../src/core/utils/tsconfig-paths'

async function main() {
  const projectPath = resolvePath(process.argv[2] ?? process.cwd())
  const scanner = new FileScanner()
  const parser = new ParserEngine()
  const pathMappings = loadTsconfigPaths(projectPath)
  const gen = new GraphGenerator({ includeFolders: true, includeFunctions: false, pathMappings })
  const files = await scanner.scanProject(projectPath)
  const parsed = await parser.parseFiles(files)
  const graph = gen.buildFromParseResults(projectPath, 'check', parsed)
  const report = auditGraphCompleteness(files, graph)
  console.log(summarizeMissing(report))
  console.log(
    'scanned:',
    report.scannedCount,
    '| file-nodes:',
    report.nodeFileCount,
    '| missing:',
    report.missingFromGraph.length
  )
  const modules = graph.nodes.filter((n) => n.kind === 'module').length
  console.log('module stub nodes (external/unscanned):', modules)
  if (report.missingFromGraph.length > 0) {
    console.log('sample missing:', report.missingFromGraph.slice(0, 10))
  }
}

main()

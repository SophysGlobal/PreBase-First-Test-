import { statSync } from 'fs'
import { resolve } from 'path'
import { FileScanner } from '../src/core/scanner/file-scanner'
import { ParserEngine } from '../src/core/parser/parser-engine'
import { GraphGenerator } from '../src/core/graph/graph-generator'
import { loadTsconfigPaths } from '../src/core/utils/tsconfig-paths'

const LANGUAGE_SAMPLES: Record<string, { files: string[]; imports: string[] }> = {
  typescript: {
    files: ['src/index.ts', 'src/utils/helper.ts'],
    imports: ["import { x } from './utils/helper'"]
  },
  javascript: {
    files: ['index.js', 'lib/util.js'],
    imports: ["const u = require('./lib/util')"]
  },
  java: {
    files: ['src/main/java/com/example/app/MainActivity.java', 'src/main/java/com/example/service/UserService.java'],
    imports: ['import com.example.service.UserService;']
  },
  kotlin: {
    files: ['src/main/kotlin/com/example/App.kt'],
    imports: ['import com.example.service.UserService']
  },
  python: {
    files: ['main.py', 'api/database.py'],
    imports: ['from api.database import connect', 'import api.database']
  },
  go: {
    files: ['main.go', 'internal/api/handler.go'],
    imports: ['import "myapp/internal/api"']
  },
  rust: {
    files: ['src/main.rs', 'src/lib.rs'],
    imports: ['use crate::api;']
  },
  csharp: {
    files: ['Program.cs', 'Services/UserService.cs'],
    imports: ['using MyApp.Services;']
  },
  swift: {
    files: ['Sources/App/main.swift'],
    imports: ['import Foundation']
  },
  php: {
    files: ['index.php', 'src/UserService.php'],
    imports: ["require_once 'src/UserService.php'"]
  },
  ruby: {
    files: ['main.rb', 'lib/user_service.rb'],
    imports: ["require_relative 'lib/user_service'"]
  },
  dart: {
    files: ['lib/main.dart', 'lib/services/user.dart'],
    imports: ["import 'services/user.dart'"]
  },
  scala: {
    files: ['src/main/scala/App.scala'],
    imports: ['import com.example.UserService']
  }
}

async function auditProject(projectPath: string) {
  const scanner = new FileScanner()
  const parser = new ParserEngine()
  const pathMappings = loadTsconfigPaths(projectPath)
  const graphGen = new GraphGenerator({ includeFolders: true, includeFunctions: false, pathMappings })

  const files = await scanner.scanProject(projectPath)
  const byExt = new Map<string, number>()
  for (const f of files) {
    byExt.set(f.extension, (byExt.get(f.extension) ?? 0) + 1)
  }

  const parseResults = await parser.parseFiles(files)
  const depsByExt = new Map<string, number>()
  for (const r of parseResults) {
    const ext = r.relativePath.match(/\.[^.]+$/)?.[0] ?? 'unknown'
    depsByExt.set(ext, (depsByExt.get(ext) ?? 0) + r.imports.length)
  }

  const graph = graphGen.buildFromParseResults(projectPath, 'audit', parseResults)
  const importEdges = graph.edges.filter((e) => e.kind === 'import')
  const edgesByExt = new Map<string, number>()
  for (const edge of importEdges) {
    const sourceNode = graph.nodes.find((n) => n.id === edge.source)
    const ext = sourceNode?.path?.match(/\.[^.]+$/)?.[0] ?? 'unknown'
    edgesByExt.set(ext, (edgesByExt.get(ext) ?? 0) + 1)
  }

  console.log(`\nProject: ${projectPath}`)
  console.log(`Files: ${files.length} | Dependencies: ${parseResults.reduce((s, r) => s + r.imports.length, 0)} | Import edges: ${importEdges.length}\n`)
  console.log('Extension breakdown:')
  console.log('  ext        files   deps   edges')
  for (const [ext, count] of [...byExt.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(
      `  ${ext.padEnd(8)} ${String(count).padStart(5)}  ${String(depsByExt.get(ext) ?? 0).padStart(5)}  ${String(edgesByExt.get(ext) ?? 0).padStart(5)}`
    )
  }
}

async function main() {
  const projectPath = resolve(process.argv[2] ?? process.cwd())
  try {
    if (!statSync(projectPath).isDirectory()) {
      console.error('Usage: npx -y tsx scripts/language-edge-audit.ts "/path/to/project"')
      process.exit(1)
    }
  } catch {
    console.error('Path not found:', projectPath)
    process.exit(1)
  }

  console.log('Language edge audit')
  console.log('Supported language extractors:', Object.keys(LANGUAGE_SAMPLES).join(', '))

  await auditProject(projectPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

import { readFile } from 'fs/promises'
import { join } from 'path'
import type { GraphEdge, GraphNode } from '../types'
import { nodeIdForPath } from './paths'

const ENTRY_CANDIDATES = [
  'src/main.tsx',
  'src/main.ts',
  'src/index.tsx',
  'src/index.ts',
  'src/App.tsx',
  'src/app.tsx',
  'app/page.tsx',
  'pages/index.tsx',
  'index.tsx',
  'index.ts',
  'main.tsx',
  'main.ts',
  'App.tsx',
  'app.tsx',
  'server.ts',
  'server.js'
]

export function detectEntryNodeId(
  projectPath: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
  packageMain?: string | null
): string | null {
  const fileNodes = nodes.filter(
    (n) => n.kind === 'file' || n.kind === 'component' || n.kind === 'module'
  )
  const byPath = new Map(fileNodes.map((n) => [n.path ?? '', n]))

  if (packageMain) {
    const normalized = packageMain.replace(/^\.\//, '')
    const id = nodeIdForPath(normalized)
    if (fileNodes.some((n) => n.id === id)) return id
    for (const n of fileNodes) {
      if (n.path?.endsWith(normalized)) return n.id
    }
  }

  for (const candidate of ENTRY_CANDIDATES) {
    const id = nodeIdForPath(candidate)
    if (byPath.has(candidate) || fileNodes.some((n) => n.id === id)) {
      return fileNodes.find((n) => n.path === candidate || n.id === id)?.id ?? null
    }
  }

  const scores = new Map<string, number>()
  for (const node of fileNodes) {
    let score = 0
    const path = node.path ?? ''
    if (/App\.(tsx|jsx)$/i.test(path)) score += 50
    if (/main\.(tsx|ts|jsx|js)$/i.test(path)) score += 45
    if (/index\.(tsx|ts|jsx|js)$/i.test(path)) score += 40
    if (path.startsWith('src/')) score += 10
    if (node.kind === 'component') score += 8
    scores.set(node.id, score)
  }

  for (const edge of edges) {
    if (edge.kind !== 'import') continue
    scores.set(edge.target, (scores.get(edge.target) ?? 0) + 1)
    scores.set(edge.source, (scores.get(edge.source) ?? 0) + 3)
  }

  let best: string | null = null
  let bestScore = -1
  for (const [id, score] of scores) {
    if (score > bestScore) {
      bestScore = score
      best = id
    }
  }

  return best ?? fileNodes[0]?.id ?? null
}

export async function readPackageMain(projectPath: string): Promise<string | null> {
  try {
    const raw = await readFile(join(projectPath, 'package.json'), 'utf-8')
    const pkg = JSON.parse(raw) as { main?: string; module?: string }
    return pkg.module ?? pkg.main ?? null
  } catch {
    return null
  }
}

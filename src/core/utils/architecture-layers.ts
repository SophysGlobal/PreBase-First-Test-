import type { GraphEdge, GraphNode } from '../types'

export type ArchitectureLayerId =
  | 'entry'
  | 'frontend'
  | 'ui'
  | 'components'
  | 'api'
  | 'auth'
  | 'services'
  | 'backend'
  | 'database'
  | 'utils'
  | 'config'
  | 'tests'
  | 'other'

export interface ArchitectureLayerDef {
  id: ArchitectureLayerId
  label: string
  color: string
  defaultEnabled: boolean
}

export const ARCHITECTURE_LAYERS: ArchitectureLayerDef[] = [
  { id: 'entry', label: 'Entry', color: '#f59e0b', defaultEnabled: true },
  { id: 'frontend', label: 'Frontend', color: '#818cf8', defaultEnabled: true },
  { id: 'ui', label: 'UI', color: '#a78bfa', defaultEnabled: true },
  { id: 'components', label: 'Components', color: '#c084fc', defaultEnabled: true },
  { id: 'api', label: 'API', color: '#38bdf8', defaultEnabled: true },
  { id: 'auth', label: 'Auth', color: '#f472b6', defaultEnabled: true },
  { id: 'services', label: 'Services', color: '#34d399', defaultEnabled: true },
  { id: 'backend', label: 'Backend', color: '#2dd4bf', defaultEnabled: true },
  { id: 'database', label: 'Database', color: '#fb923c', defaultEnabled: true },
  { id: 'utils', label: 'Utilities', color: '#71717a', defaultEnabled: false },
  { id: 'config', label: 'Config', color: '#52525b', defaultEnabled: false },
  { id: 'tests', label: 'Tests', color: '#52525b', defaultEnabled: false },
  { id: 'other', label: 'Other', color: '#6366f1', defaultEnabled: true }
]

export function classifyNodeLayer(path: string | undefined, isEntry?: boolean): ArchitectureLayerId {
  if (isEntry) return 'entry'
  const p = (path ?? '').toLowerCase().replace(/\\/g, '/')
  const filename = p.split('/').pop() ?? p

  if (/\.(test|spec)\.(tsx?|jsx?)$/.test(p) || /__tests__|\/tests?\//.test(p)) return 'tests'

  // Lock files, git files, env files, metadata → config (hidden by default)
  if (
    /^(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|.*\.lock)$/.test(filename) ||
    /^\.git(ignore|attributes|modules|keep)$/.test(filename) ||
    /^\.(env|env\..*)$/.test(filename) ||
    /^(readme|changelog|license|contributing)(\.md)?$/i.test(filename) ||
    /\/(\.github|\.husky|\.changeset)\//.test(p) ||
    /\/(dist|build|out|\.next|\.nuxt|\.output)\//i.test(p)
  )
    return 'config'

  if (/auth|login|session|oauth|passport/.test(p)) return 'auth'
  if (/\/api\/|\/routes\/|\/endpoints\/|\.route\.|\.controller\./.test(p)) return 'api'
  if (/prisma|database|db\/|\/models\/|drizzle|typeorm/.test(p)) return 'database'
  if (/\.service\.|\/services\/|service\//.test(p)) return 'services'
  if (/server\.|\/server\/|\/backend\/|express|fastify|hono/.test(p)) return 'backend'
  if (/components\/|\/components\/|\.component\./.test(p) || /[A-Z][a-zA-Z]+\.tsx$/.test(p)) {
    return 'components'
  }
  if (/pages\/|app\/|views\/|screens\/|layouts\//.test(p)) return 'ui'
  if (/src\/renderer|src\/ui|styles\/|\.css$|frontend/.test(p)) return 'frontend'
  if (/utils\/|lib\/|helpers\/|shared\/|common\//.test(p)) return 'utils'
  if (
    /config|\.config\.|vite\.|webpack|tsconfig|eslint|prettier|babel|rollup|jest/.test(p) ||
    /^(\.|_)/.test(filename)
  )
    return 'config'
  if (/hooks\/|store\/|state\//.test(p)) return 'frontend'

  return 'other'
}

export function assignLayersToNodes(nodes: GraphNode[], entryNodeId: string | null): GraphNode[] {
  return nodes.map((n) => {
    const isEntry = n.isEntry || n.id === entryNodeId
    const architectureLayer = classifyNodeLayer(n.path, isEntry)
    return {
      ...n,
      meta: { ...n.meta, architectureLayer }
    }
  })
}

export function buildDefaultLayerVisibility(): Record<ArchitectureLayerId, boolean> {
  const vis = {} as Record<ArchitectureLayerId, boolean>
  for (const layer of ARCHITECTURE_LAYERS) {
    vis[layer.id] = layer.defaultEnabled
  }
  return vis
}

export function countNodesPerLayer(nodes: GraphNode[]): Record<ArchitectureLayerId, number> {
  const counts = {} as Record<ArchitectureLayerId, number>
  for (const layer of ARCHITECTURE_LAYERS) counts[layer.id] = 0
  for (const n of nodes) {
    const id = (n.meta?.architectureLayer as ArchitectureLayerId) ?? 'other'
    counts[id] = (counts[id] ?? 0) + 1
  }
  return counts
}

export function computeNodeImportance(
  nodeId: string,
  edges: GraphEdge[]
): { inDegree: number; outDegree: number; score: number } {
  let inDegree = 0
  let outDegree = 0
  for (const e of edges) {
    if (e.kind !== 'import') continue
    if (e.target === nodeId) inDegree++
    if (e.source === nodeId) outDegree++
  }
  const score = inDegree * 1.2 + outDegree * 0.8
  return { inDegree, outDegree, score }
}

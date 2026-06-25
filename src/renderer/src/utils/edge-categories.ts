import type { GraphEdge, GraphNode, GraphSnapshot } from '../../../core/types'

/** Relationship categories shown in sidebar, legend, and graph rendering. */
export type GraphEdgeCategory =
  | 'import'
  | 'composition'
  | 'route'
  | 'state'
  | 'data'
  | 'style'
  | 'config'
  | 'test'
  | 'type'

export const MAX_VISIBLE_EDGE_CATEGORIES = 2

export const DEFAULT_VISIBLE_EDGE_CATEGORIES: GraphEdgeCategory[] = ['import', 'composition']

export interface EdgeCategoryDefinition {
  id: GraphEdgeCategory
  label: string
  shortLabel: string
  color: string
  description: string
}

export const EDGE_CATEGORY_DEFINITIONS: EdgeCategoryDefinition[] = [
  {
    id: 'import',
    label: 'Import / Dependency',
    shortLabel: 'Import',
    color: 'rgba(96,165,250,0.72)',
    description: 'File imports another module to compile or run.'
  },
  {
    id: 'composition',
    label: 'Component Composition',
    shortLabel: 'Composition',
    color: 'rgba(167,139,250,0.72)',
    description: 'UI or component file composes another component.'
  },
  {
    id: 'route',
    label: 'Route / Navigation',
    shortLabel: 'Route',
    color: 'rgba(251,191,36,0.72)',
    description: 'Router, page, or navigation target relationship.'
  },
  {
    id: 'state',
    label: 'State / Context / Hook',
    shortLabel: 'State',
    color: 'rgba(34,211,238,0.72)',
    description: 'Shared state via hooks, context, or stores.'
  },
  {
    id: 'data',
    label: 'Data / API / Service',
    shortLabel: 'Data',
    color: 'rgba(74,222,128,0.72)',
    description: 'API clients, services, Supabase, or data utilities.'
  },
  {
    id: 'style',
    label: 'Style / Asset',
    shortLabel: 'Style',
    color: 'rgba(244,114,182,0.72)',
    description: 'CSS, SCSS, images, fonts, or static assets.'
  },
  {
    id: 'config',
    label: 'Config / Build',
    shortLabel: 'Config',
    color: 'rgba(148,163,184,0.68)',
    description: 'Build, tooling, or configuration dependencies.'
  },
  {
    id: 'test',
    label: 'Test / Coverage',
    shortLabel: 'Test',
    color: 'rgba(163,230,53,0.72)',
    description: 'Test file targeting or covering source files.'
  },
  {
    id: 'type',
    label: 'Type / Schema',
    shortLabel: 'Type',
    color: 'rgba(196,181,253,0.72)',
    description: 'Shared types, schemas, validators, or interfaces.'
  }
]

const EDGE_CATEGORY_BY_ID = new Map(EDGE_CATEGORY_DEFINITIONS.map((d) => [d.id, d]))

export function getEdgeCategoryDefinition(id: GraphEdgeCategory): EdgeCategoryDefinition {
  return EDGE_CATEGORY_BY_ID.get(id)!
}

export function getEdgeCategoryColor(id: GraphEdgeCategory): string {
  return getEdgeCategoryDefinition(id).color
}

const TEST_PATH = /(?:^|\/)(?:__tests__|tests?)(?:\/|$)|\.(?:test|spec)\.[a-z]+$/i
const STYLE_EXT = /\.(?:css|scss|sass|less|styl|pcss|module\.css|svg|png|jpe?g|gif|webp|ico|woff2?|ttf|eot)$/i
const CONFIG_PATH =
  /(?:^|\/)(?:vite|webpack|rollup|esbuild|tsconfig|eslint|prettier|babel|postcss|tailwind|electron|package)\.|\.(?:config|rc)\.[a-z]+$/i
const TYPE_PATH = /(?:^|\/)(?:types?|schemas?|interfaces?|validators?|generated)(?:\/|$)|\.d\.ts$/i
const STATE_PATH = /(?:^|\/)(?:hooks?|contexts?|stores?|state|providers?|redux|zustand)(?:\/|$)|(?:use[A-Z][\w]+|Context|Provider|Store)\.[jt]sx?$/i
const DATA_PATH =
  /(?:^|\/)(?:api|apis|services?|lib\/supabase|integrations?|clients?|backend|server|data)(?:\/|$)|supabase|firebase|axios|fetch/i
const ROUTE_PATH = /(?:^|\/)(?:pages?|routes?|router|navigation|screens?|views?)(?:\/|$)/i

function nodeById(snapshot: GraphSnapshot, id: string): GraphNode | undefined {
  return snapshot.nodes.find((n) => n.id === id)
}

function pathOf(node: GraphNode | undefined): string {
  return (node?.path ?? node?.label ?? '').replace(/\\/g, '/').toLowerCase()
}

function isComponentNode(node: GraphNode | undefined): boolean {
  if (!node) return false
  return Boolean(
    node.kind === 'component' ||
      node.meta?.isComponent ||
      /\.(tsx|jsx|vue|svelte)$/i.test(node.path ?? '')
  )
}

/** Classify an import edge into a user-facing relationship category. */
export function classifyEdgeCategory(edge: GraphEdge, snapshot: GraphSnapshot): GraphEdgeCategory {
  if (edge.kind !== 'import') return 'import'

  const source = nodeById(snapshot, edge.source)
  const target = nodeById(snapshot, edge.target)
  const sourcePath = pathOf(source)
  const targetPath = pathOf(target)
  const combined = `${sourcePath} ${targetPath}`

  if (TEST_PATH.test(sourcePath) || TEST_PATH.test(targetPath)) return 'test'
  if (STYLE_EXT.test(targetPath) || STYLE_EXT.test(edge.meta?.importSource ?? '')) return 'style'
  if (CONFIG_PATH.test(targetPath) || CONFIG_PATH.test(sourcePath)) return 'config'
  if (TYPE_PATH.test(targetPath) || /\/types?\//i.test(edge.meta?.importSource ?? '')) return 'type'
  if (DATA_PATH.test(targetPath) || DATA_PATH.test(edge.meta?.importSource ?? '')) return 'data'
  if (STATE_PATH.test(targetPath) || STATE_PATH.test(combined)) return 'state'
  if (ROUTE_PATH.test(sourcePath) || ROUTE_PATH.test(targetPath)) return 'route'
  if (isComponentNode(target) && (isComponentNode(source) || ROUTE_PATH.test(sourcePath))) {
    return 'composition'
  }
  if (isComponentNode(target) && /\.(tsx|jsx|vue)$/i.test(sourcePath)) return 'composition'

  return 'import'
}

export function edgeMatchesVisibleCategories(
  edge: GraphEdge,
  snapshot: GraphSnapshot,
  visible: GraphEdgeCategory[]
): boolean {
  if (edge.kind === 'contains' || edge.kind === 'dependency') return false
  if (edge.kind !== 'import') return false
  const category = classifyEdgeCategory(edge, snapshot)
  return visible.includes(category)
}

export function toggleVisibleEdgeCategory(
  current: GraphEdgeCategory[],
  category: GraphEdgeCategory
): GraphEdgeCategory[] {
  if (current.includes(category)) {
    const next = current.filter((c) => c !== category)
    return next.length > 0 ? next : [category]
  }
  if (current.length >= MAX_VISIBLE_EDGE_CATEGORIES) {
    return [current[1], category]
  }
  return [...current, category]
}

/** Map depth scale (from 3D projection) to 0–1 where 1 = closest. */
export function normalizeDepthScale(depthScale: number): number {
  return Math.max(0, Math.min(1, (depthScale - 0.72) / 0.48))
}

export function depthOpacity(min: number, max: number, depthScale: number): number {
  const t = normalizeDepthScale(depthScale)
  return min + (max - min) * t
}

export function applyDepthToRgba(color: string, depthScale: number, minAlpha = 0.28): string {
  const t = normalizeDepthScale(depthScale)
  const alphaScale = minAlpha + (1 - minAlpha) * t
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
  if (!m) return color
  const r = Number(m[1])
  const g = Number(m[2])
  const b = Number(m[3])
  const a = Number(m[4] ?? 1) * alphaScale
  return `rgba(${r},${g},${b},${a.toFixed(3)})`
}

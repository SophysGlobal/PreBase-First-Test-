import type { GraphNode } from '../../../core/types'
import { SUPPORTED_LANGUAGES } from '../../../core/constants/supported-languages'

export interface LanguageStat {
  id: string
  name: string
  count: number
  percent: number
  color: string
}

const LANGUAGE_COLORS: Record<string, string> = {
  typescript: '#3178c6',
  javascript: '#f1e05a',
  java: '#b07219',
  kotlin: '#a97bff',
  python: '#3572a5',
  go: '#00add8',
  rust: '#dea584',
  csharp: '#178600',
  cpp: '#f34b7d',
  swift: '#f05138',
  php: '#4f5d95',
  ruby: '#701516',
  lua: '#000080',
  dart: '#00b4ab',
  scala: '#c22d40',
  vue: '#41b883',
  svelte: '#ff3e00',
  css: '#563d7c',
  html: '#e34c26',
  json: '#292929',
  other: '#71717a'
}

const EXT_TO_LANG = new Map<string, { id: string; name: string; color: string }>()

for (const lang of SUPPORTED_LANGUAGES) {
  for (const ext of lang.extensions) {
    EXT_TO_LANG.set(ext.replace(/^\./, ''), {
      id: lang.id,
      name: lang.name,
      color: LANGUAGE_COLORS[lang.id] ?? '#6366f1'
    })
  }
}

function languageForPath(path: string): { id: string; name: string; color: string } {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  return EXT_TO_LANG.get(ext) ?? { id: 'other', name: 'Other', color: LANGUAGE_COLORS.other }
}

export function computeLanguageStats(nodes: GraphNode[]): LanguageStat[] {
  const counts = new Map<string, { name: string; color: string; count: number }>()

  for (const node of nodes) {
    if (node.kind === 'folder') continue
    if (!node.path) continue
    const { id, name, color } = languageForPath(node.path)
    const existing = counts.get(id)
    if (existing) existing.count += 1
    else counts.set(id, { name, color, count: 1 })
  }

  const total = [...counts.values()].reduce((s, v) => s + v.count, 0)
  if (total === 0) return []

  return [...counts.entries()]
    .map(([id, { name, color, count }]) => ({
      id,
      name,
      count,
      percent: Math.round((count / total) * 1000) / 10,
      color
    }))
    .sort((a, b) => b.count - a.count)
}

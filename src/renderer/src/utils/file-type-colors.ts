/** Shared file-type colors used across graph views, legends, and inspectors. */
import { SUPPORTED_LANGUAGES } from '../../../core/constants/supported-languages'

export interface FileTypeInfo {
  id: string
  name: string
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
  css: '#a371f7',
  html: '#e34c26',
  json: '#8b8b8b',
  markdown: '#519aba',
  image: '#c678dd',
  config: '#6b7280',
  other: '#71717a'
}

const EXT_TO_LANG = new Map<string, FileTypeInfo>()

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp'])
const CONFIG_EXTS = new Set([
  'json',
  'yaml',
  'yml',
  'toml',
  'env',
  'lock',
  'config',
  'rc',
  'ini'
])
const MARKDOWN_EXTS = new Set(['md', 'mdx', 'markdown'])

for (const lang of SUPPORTED_LANGUAGES) {
  for (const ext of lang.extensions) {
    const key = ext.replace(/^\./, '').toLowerCase()
    EXT_TO_LANG.set(key, {
      id: lang.id,
      name: lang.name,
      color: LANGUAGE_COLORS[lang.id] ?? LANGUAGE_COLORS.other
    })
  }
}

export function getFileTypeInfo(path: string | undefined): FileTypeInfo {
  if (!path) {
    return { id: 'other', name: 'Other', color: LANGUAGE_COLORS.other }
  }
  const base = path.split('/').pop() ?? path
  const ext = base.includes('.') ? (base.split('.').pop()?.toLowerCase() ?? '') : ''

  if (IMAGE_EXTS.has(ext)) {
    return { id: 'image', name: 'Image', color: LANGUAGE_COLORS.image }
  }
  if (MARKDOWN_EXTS.has(ext)) {
    return { id: 'markdown', name: 'Markdown', color: LANGUAGE_COLORS.markdown }
  }
  if (CONFIG_EXTS.has(ext) || base.startsWith('.') || /config|rc$/i.test(base)) {
    return { id: 'config', name: 'Config', color: LANGUAGE_COLORS.config }
  }

  const mapped = EXT_TO_LANG.get(ext)
  if (mapped) return mapped

  return { id: 'other', name: ext ? ext.toUpperCase() : 'Other', color: LANGUAGE_COLORS.other }
}

export function getFileTypeColor(path: string | undefined): string {
  return getFileTypeInfo(path).color
}

/** Distinct file types present in a node list (for legends). */
export function collectFileTypes(paths: (string | undefined)[]): FileTypeInfo[] {
  const seen = new Map<string, FileTypeInfo>()
  for (const p of paths) {
    const info = getFileTypeInfo(p)
    if (!seen.has(info.id)) seen.set(info.id, info)
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export const ARCHITECTURE_EDGE_LEGEND = [
  { id: 'import', label: 'Import', color: 'rgba(200,200,210,0.55)', dashed: false },
  { id: 'entry', label: 'Root', color: 'rgba(245,158,11,0.7)', dashed: false },
  { id: 'service', label: 'Service', color: 'rgba(52,211,153,0.6)', dashed: false },
  { id: 'utility', label: 'Utility', color: 'rgba(140,140,150,0.5)', dashed: true },
  { id: 'component', label: 'Component', color: 'rgba(167,139,250,0.55)', dashed: false },
  { id: 'dynamic', label: 'Dynamic', color: 'rgba(168,85,247,0.55)', dashed: true },
  { id: 'contains', label: 'Contains', color: 'rgba(120,120,130,0.35)', dashed: true }
] as const

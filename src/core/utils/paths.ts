import { extname, join, normalize, relative, resolve } from 'path'
import type { PathMappings } from './tsconfig-paths'

const CODE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.mts',
  '.cts'
])

export function isCodeFile(filePath: string): boolean {
  return CODE_EXTENSIONS.has(extname(filePath).toLowerCase())
}

export function normalizePath(p: string): string {
  return normalize(p).replace(/\\/g, '/')
}

export function toRelative(projectRoot: string, absolutePath: string): string {
  return normalizePath(relative(projectRoot, absolutePath))
}

function tryResolveFile(projectRoot: string, absoluteBase: string): string | null {
  const candidates = [
    absoluteBase,
    `${absoluteBase}.ts`,
    `${absoluteBase}.tsx`,
    `${absoluteBase}.js`,
    `${absoluteBase}.jsx`,
    `${absoluteBase}.mjs`,
    `${absoluteBase}.cjs`,
    join(absoluteBase, 'index.ts'),
    join(absoluteBase, 'index.tsx'),
    join(absoluteBase, 'index.js'),
    join(absoluteBase, 'index.jsx')
  ]

  for (const c of candidates) {
    const rel = toRelative(projectRoot, c)
    if (!rel.startsWith('..') && !rel.startsWith('/')) return rel
  }
  return null
}

export function resolveImportPath(
  projectRoot: string,
  fromFile: string,
  importSource: string,
  pathMappings: PathMappings = {}
): string | null {
  const source = importSource.split('?')[0]

  // Relative imports
  if (source.startsWith('.')) {
    const fromDir = join(projectRoot, fromFile.replace(/\/[^/]+$/, ''))
    const base = resolve(fromDir, source)
    return tryResolveFile(projectRoot, base)
  }

  // Path alias imports (@/, ~/, etc.)
  for (const [pattern, targets] of Object.entries(pathMappings)) {
    if (!source.startsWith(pattern)) continue
    const rest = source.slice(pattern.length)
    for (const targetRoot of targets) {
      const base = join(targetRoot, rest)
      const resolved = tryResolveFile(projectRoot, base)
      if (resolved) return resolved
    }
  }

  return null
}

export function nodeIdForPath(relativePath: string): string {
  return `file:${relativePath}`
}

export function folderIdForPath(relativePath: string): string {
  return `folder:${relativePath || '.'}`
}

export function getParentFolderPath(relativePath: string): string | null {
  const parts = relativePath.split('/')
  if (parts.length <= 1) return null
  parts.pop()
  return parts.join('/')
}

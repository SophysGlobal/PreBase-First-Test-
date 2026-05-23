import { extname, join, normalize, relative, resolve } from 'path'

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

export function resolveImportPath(
  projectRoot: string,
  fromFile: string,
  importSource: string
): string | null {
  if (!importSource.startsWith('.')) return null

  const fromDir = join(projectRoot, fromFile.replace(/\/[^/]+$/, ''))
  const base = resolve(fromDir, importSource)
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
    join(base, 'index.js'),
    join(base, 'index.jsx')
  ]

  for (const c of candidates) {
    const rel = toRelative(projectRoot, c)
    if (!rel.startsWith('..')) return rel
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
